/**
 * ECS Scene - Main container for entities and components
 *
 * Provides high-level API for entity/component operations with deferred command buffer
 * for loop-safe modifications.
 */

import { Entity, EntityManager, entityId } from './entity.js';
import { ComponentType, globalComponentRegistry } from './component.js';
import { Archetype, ArchetypeGraph } from './archetype.js';
import { Query } from './query.js';
import { EventEmitter } from './event-emitter.js';

/**
 * Scene event types
 */
export type SceneEvent =
  | { type: 'entity:created'; entity: Entity }
  | { type: 'entity:destroyed'; entity: Entity }
  | {
      type: 'component:added';
      entity: Entity;
      componentId: number;
      component: ComponentType<any>;
    }
  | {
      type: 'component:removed';
      entity: Entity;
      componentId: number;
      component: ComponentType<any>;
    };

/**
 * Deferred command types for loop-safe operations
 */
type DeferredCommand =
  | {
      type: 'spawn';
      components: Map<number, any>;
      callback?: (entity: Entity) => void;
      reservedEntity?: Entity;
    }
  | { type: 'destroy'; entity: Entity }
  | { type: 'addComponent'; entity: Entity; componentId: number; data: any }
  | { type: 'removeComponent'; entity: Entity; componentId: number };

/**
 * Query cache entry
 */
interface QueryCacheEntry {
  allIds: number[];
  anyIds: number[];
  noneIds: number[];
  exclusiveIds: number[];
  matchedArchetypes: Archetype[];
  version: number;
}

/**
 * Scene - ECS container and API
 */
export class Scene {
  private readonly entityManager = new EntityManager();
  private readonly archetypeGraph = new ArchetypeGraph();
  private readonly commandBuffer: DeferredCommand[] = [];
  private isIterating = false;

  /** Query cache for faster repeated queries */
  private readonly queryCache = new Map<string, QueryCacheEntry>();
  /** Archetype version for cache invalidation */
  private archetypeVersion = 0;

  /** Event system for entity/component changes */
  private readonly eventQueue: SceneEvent[] = [];
  public readonly events = new EventEmitter<SceneEvent>();

  constructor() {
    // Hook into archetype creation to invalidate query cache
    this.archetypeGraph.onArchetypeCreated = () => {
      this.invalidateQueryCache();
    };
  }

  /**
   * Spawn a new entity with components
   * @returns Entity builder for fluent API
   */
  spawn(): EntityBuilder {
    return new EntityBuilder(this);
  }

  /**
   * Reserve an entity ID without spawning components
   * Useful for getting entity ID before components are added
   * @returns Reserved entity handle
   */
  reserveEntity(): Entity {
    return this.entityManager.spawn();
  }

  /**
   * Internal: Spawn entity with component map
   */
  private spawnInternal(
    components: Map<number, any>,
    callback?: (entity: Entity) => void,
    reservedEntity?: Entity,
  ): Entity | undefined {
    if (this.isIterating) {
      // Defer spawn until iteration completes
      this.commandBuffer.push({
        type: 'spawn',
        components,
        callback,
        reservedEntity,
      });
      return undefined;
    }

    // Use reserved entity or create new one
    const entity = reservedEntity ?? this.entityManager.spawn();

    // Get or create archetype
    const componentIds = Array.from(components.keys());
    const archetype = this.archetypeGraph.getOrCreateArchetype(componentIds);

    // Add entity to archetype
    const row = archetype.addEntity(entity, components);

    // Update entity location
    this.entityManager.setLocation(entity, archetype.id, row);

    // Queue entity creation event
    this.queueEvent({ type: 'entity:created', entity });

    for (const [componentId] of components) {
      const componentType = globalComponentRegistry.get(componentId);
      if (componentType) {
        this.queueEvent({
          type: 'component:added',
          entity,
          componentId,
          component: componentType,
        });
      }
    }

    // Call callback if provided
    if (callback) {
      callback(entity);
    }

    return entity;
  }

  /**
   * Destroy an entity
   * @param entity Entity to destroy
   */
  destroy(entity: Entity): void {
    if (this.isIterating) {
      // Defer destroy until iteration completes
      this.commandBuffer.push({ type: 'destroy', entity });
      return;
    }

    if (!this.entityManager.isAlive(entity)) {
      return;
    }

    // Get entity location
    const meta = this.entityManager.getMetadata(entity);
    if (!meta) {
      return;
    }

    // Remove from archetype
    const archetype = this.archetypeGraph.getArchetype(meta.archetypeId);
    if (archetype) {
      // IMPORTANT: Capture the actual row from archetype BEFORE removeEntity
      // meta.row might be stale if a previous operation failed to update it
      const actualRow = (archetype as any).entityToRow?.get(entity) ?? meta.row;

      const removedComponents = archetype.removeEntity(entity);

      // If we swapped with last entity, update its metadata
      // Use actualRow (captured before removal) to find the swapped entity
      if (actualRow < archetype.getEntityCount()) {
        const swappedEntity = archetype.entities[actualRow];
        if (swappedEntity !== undefined) {
          this.entityManager.setLocation(
            swappedEntity,
            meta.archetypeId,
            actualRow,
          );
        }
      }
    }

    // Queue entity destruction event
    this.queueEvent({ type: 'entity:destroyed', entity });

    // Mark entity as destroyed
    this.entityManager.destroy(entity);
  }

  /**
   * Check if entity is alive
   */
  isAlive(entity: Entity): boolean {
    return this.entityManager.isAlive(entity);
  }

  /**
   * Add component to entity
   * @param entity Entity to modify
   * @param type Component type
   * @param data Component data
   */
  addComponent<T>(entity: Entity, type: ComponentType<T>, data: T): void {
    if (this.isIterating) {
      // Defer add until iteration completes
      this.commandBuffer.push({
        type: 'addComponent',
        entity,
        componentId: type.id,
        data,
      });
      return;
    }

    if (!this.entityManager.isAlive(entity)) {
      return;
    }

    // Get current archetype
    const meta = this.entityManager.getMetadata(entity);
    if (!meta) {
      return;
    }

    const currentArchetype = this.archetypeGraph.getArchetype(meta.archetypeId);
    if (!currentArchetype) {
      return;
    }

    // Check if component already exists
    if (currentArchetype.hasComponent(type.id)) {
      // Just update the component data (no event for updates, only add/remove)
      currentArchetype.setComponent(entity, type.id, data);
      return;
    }

    // Get destination archetype
    const newArchetype = this.archetypeGraph.getArchetypeAdd(
      currentArchetype,
      type.id,
    );
    if (!newArchetype) {
      return;
    }

    // IMPORTANT: Capture the actual row from archetype BEFORE removeEntity
    // meta.row might be stale if a previous operation failed to update it
    const actualRow =
      (currentArchetype as any).entityToRow?.get(entity) ?? meta.row;

    // Remove from current archetype
    const components = currentArchetype.removeEntity(entity);
    if (!components) {
      return;
    }

    // Add new component
    components.set(type.id, data);

    // Add to new archetype
    const newRow = newArchetype.addEntity(entity, components);

    // Update entity location
    this.entityManager.setLocation(entity, newArchetype.id, newRow);

    // Update swapped entity metadata
    // Use actualRow (captured before removal) to find the swapped entity
    if (actualRow < currentArchetype.getEntityCount()) {
      const swappedEntity = currentArchetype.entities[actualRow];
      if (swappedEntity !== undefined) {
        this.entityManager.setLocation(
          swappedEntity,
          currentArchetype.id,
          actualRow,
        );
      }
    }

    // Queue component added event
    this.queueEvent({
      type: 'component:added',
      entity,
      componentId: type.id,
      component: type,
    });
  }

  /**
   * Remove component from entity
   * @param entity Entity to modify
   * @param type Component type
   */
  removeComponent<T>(entity: Entity, type: ComponentType<T>): void {
    if (this.isIterating) {
      // Defer remove until iteration completes
      this.commandBuffer.push({
        type: 'removeComponent',
        entity,
        componentId: type.id,
      });
      return;
    }

    if (!this.entityManager.isAlive(entity)) {
      return;
    }

    // Get current archetype
    const meta = this.entityManager.getMetadata(entity);
    if (!meta) {
      return;
    }

    const currentArchetype = this.archetypeGraph.getArchetype(meta.archetypeId);
    if (!currentArchetype) {
      return;
    }

    // Check if component exists
    if (!currentArchetype.hasComponent(type.id)) {
      return;
    }

    // Get destination archetype
    const newArchetype = this.archetypeGraph.getArchetypeRemove(
      currentArchetype,
      type.id,
    );
    if (!newArchetype) {
      return;
    }

    // IMPORTANT: Capture the actual row from archetype BEFORE removeEntity
    // meta.row might be stale if a previous operation failed to update it
    const actualRow =
      (currentArchetype as any).entityToRow?.get(entity) ?? meta.row;

    // Remove from current archetype
    const components = currentArchetype.removeEntity(entity);
    if (!components) {
      return;
    }

    // Remove component
    components.delete(type.id);

    // Add to new archetype
    const newRow = newArchetype.addEntity(entity, components);

    // Update entity location
    this.entityManager.setLocation(entity, newArchetype.id, newRow);

    // Update swapped entity metadata
    // Use actualRow (captured before removal) to find the swapped entity
    if (actualRow < currentArchetype.getEntityCount()) {
      const swappedEntity = currentArchetype.entities[actualRow];
      if (swappedEntity !== undefined) {
        this.entityManager.setLocation(
          swappedEntity,
          currentArchetype.id,
          actualRow,
        );
      }
    }

    // Queue component removed event
    this.queueEvent({
      type: 'component:removed',
      entity,
      componentId: type.id,
      component: type,
    });
  }

  /**
   * Get component from entity
   * @param entity Entity to query
   * @param type Component type
   * @returns Component data or undefined
   */
  getComponent<T>(entity: Entity, type: ComponentType<T>): T | undefined {
    if (!this.entityManager.isAlive(entity)) {
      return undefined;
    }

    const meta = this.entityManager.getMetadata(entity);
    if (!meta) {
      return undefined;
    }

    const archetype = this.archetypeGraph.getArchetype(meta.archetypeId);
    if (!archetype) {
      return undefined;
    }

    return archetype.getComponent<T>(entity, type.id);
  }

  /**
   * Get all components from entity (for serialization)
   * @param entity Entity to query
   * @returns Map of ComponentType → component data, or undefined if entity invalid
   */
  getAllComponents(entity: Entity): Map<ComponentType<any>, any> | undefined {
    if (!this.entityManager.isAlive(entity)) {
      return undefined;
    }

    const meta = this.entityManager.getMetadata(entity);
    if (!meta) {
      return undefined;
    }

    const archetype = this.archetypeGraph.getArchetype(meta.archetypeId);
    if (!archetype) {
      return undefined;
    }

    // Get entity row
    const row = meta.row;

    // VALIDATION: Check that archetype's view of this entity matches EntityManager
    // This catches bugs where entity metadata row is out of sync with archetype storage
    const archetypeEntity = archetype.entities[row];
    if (archetypeEntity !== entity) {
      console.error(
        `[Scene.getAllComponents] ENTITY ROW MISMATCH DETECTED!\n` +
        `  Entity: ${entity}\n` +
        `  meta.row: ${row}\n` +
        `  archetype.entities[${row}]: ${archetypeEntity}\n` +
        `  meta.archetypeId: ${meta.archetypeId}\n` +
        `  archetype.id: ${archetype.id}\n` +
        `  archetype.entityCount: ${archetype.getEntityCount()}`
      );
      // Return undefined to avoid returning wrong entity's components
      return undefined;
    }

    // ADDITIONAL VALIDATION: Check archetype's entityToRow consistency
    const archetypeRowCheck = (archetype as any).entityToRow?.get(entity);
    if (archetypeRowCheck !== undefined && archetypeRowCheck !== row) {
      console.error(
        `[Scene.getAllComponents] ARCHETYPE entityToRow MISMATCH!\n` +
        `  Entity: ${entity}\n` +
        `  meta.row: ${row}\n` +
        `  archetype.entityToRow.get(entity): ${archetypeRowCheck}`
      );
    }

    const components = new Map<ComponentType<any>, any>();

    // Collect all components for this entity using global registry
    for (const componentId of archetype.componentIds) {
      const componentArray = archetype.components.get(componentId);
      if (componentArray && componentArray[row] !== undefined) {
        // Get ComponentType from global registry
        const componentType = globalComponentRegistry.get(componentId);
        if (componentType) {
          components.set(componentType, componentArray[row]);
        }
      }
    }

    return components;
  }

  /**
   * Check if entity has component
   * @param entity Entity to check
   * @param type Component type
   * @returns True if entity has component
   */
  hasComponent<T>(entity: Entity, type: ComponentType<T>): boolean {
    if (!this.entityManager.isAlive(entity)) {
      return false;
    }

    const meta = this.entityManager.getMetadata(entity);
    if (!meta) {
      return false;
    }

    const archetype = this.archetypeGraph.getArchetype(meta.archetypeId);
    if (!archetype) {
      return false;
    }

    return archetype.hasComponent(type.id);
  }

  /**
   * Create a new query
   * @returns Query builder
   */
  query(): Query {
    return new Query(this);
  }

  /**
   * Internal: Execute query iteration
   */
  executeQuery(
    allTypes: ComponentType[],
    anyTypes: ComponentType[],
    noneTypes: ComponentType[],
    exclusiveTypes: ComponentType[],
    callback: (entity: Entity, ...components: any[]) => void,
  ): void {
    // Mark as iterating to defer modifications
    this.isIterating = true;

    try {
      // Get matched archetypes (with caching)
      const matchedArchetypes = this.getMatchedArchetypes(
        allTypes,
        anyTypes,
        noneTypes,
        exclusiveTypes,
      );

      // Reuse arrays across archetypes to avoid allocations
      const componentArrays: any[][] = [];

      // Iterate matched archetypes
      for (const archetype of matchedArchetypes) {
        const entityCount = archetype.getEntityCount();

        // Clear and repopulate component arrays (no new allocation)
        componentArrays.length = 0;

        if (exclusiveTypes.length > 0) {
          // Exclusive query: use exclusive types in order
          for (const type of exclusiveTypes) {
            componentArrays.push(archetype.components.get(type.id)!);
          }
        } else {
          // Normal query: use all types in order
          for (const type of allTypes) {
            componentArrays.push(archetype.components.get(type.id)!);
          }
        }

        // Iterate entities in this archetype
        // Optimized: direct parameter passing to avoid allocations
        const numComponents = componentArrays.length;

        for (let row = 0; row < entityCount; row++) {
          const entity = archetype.entities[row];
          if (entity === undefined) continue;

          // VALIDATION: Verify entity metadata matches iteration row
          const meta = this.entityManager.getMetadata(entity);
          if (meta && meta.row !== row) {
            console.error(
              `[Scene.executeQuery] ROW MISMATCH in query iteration!\n` +
              `  Entity: ${entity}\n` +
              `  iteration row: ${row}\n` +
              `  meta.row: ${meta.row}\n` +
              `  archetype.id: ${archetype.id}\n` +
              `  meta.archetypeId: ${meta.archetypeId}`
            );
          }

          // Direct parameter passing based on component count (zero allocations)
          switch (numComponents) {
            case 0:
              callback(entity);
              break;
            case 1:
              callback(entity, componentArrays[0]![row]);
              break;
            case 2:
              callback(
                entity,
                componentArrays[0]![row],
                componentArrays[1]![row],
              );
              break;
            case 3:
              callback(
                entity,
                componentArrays[0]![row],
                componentArrays[1]![row],
                componentArrays[2]![row],
              );
              break;
            case 4:
              callback(
                entity,
                componentArrays[0]![row],
                componentArrays[1]![row],
                componentArrays[2]![row],
                componentArrays[3]![row],
              );
              break;
            case 5:
              callback(
                entity,
                componentArrays[0]![row],
                componentArrays[1]![row],
                componentArrays[2]![row],
                componentArrays[3]![row],
                componentArrays[4]![row],
              );
              break;
            case 6:
              callback(
                entity,
                componentArrays[0]![row],
                componentArrays[1]![row],
                componentArrays[2]![row],
                componentArrays[3]![row],
                componentArrays[4]![row],
                componentArrays[5]![row],
              );
              break;
            case 7:
              callback(
                entity,
                componentArrays[0]![row],
                componentArrays[1]![row],
                componentArrays[2]![row],
                componentArrays[3]![row],
                componentArrays[4]![row],
                componentArrays[5]![row],
                componentArrays[6]![row],
              );
              break;
            case 8:
              callback(
                entity,
                componentArrays[0]![row],
                componentArrays[1]![row],
                componentArrays[2]![row],
                componentArrays[3]![row],
                componentArrays[4]![row],
                componentArrays[5]![row],
                componentArrays[6]![row],
                componentArrays[7]![row],
              );
              break;
            default:
              // Fallback for >8 components (rare case)
              const components = componentArrays.map((arr) => arr[row]);
              callback(entity, ...components);
              break;
          }
        }
      }
    } finally {
      // Mark iteration complete
      this.isIterating = false;

      // Flush command buffer
      this.flushCommands();
    }
  }

  /**
   * Get matched archetypes for query (with caching)
   */
  private getMatchedArchetypes(
    allTypes: ComponentType[],
    anyTypes: ComponentType[],
    noneTypes: ComponentType[],
    exclusiveTypes: ComponentType[],
  ): Archetype[] {
    // Create cache key
    const allIds = allTypes.map((t) => t.id).sort((a, b) => a - b);
    const anyIds = anyTypes.map((t) => t.id).sort((a, b) => a - b);
    const noneIds = noneTypes.map((t) => t.id).sort((a, b) => a - b);
    const exclusiveIds = exclusiveTypes.map((t) => t.id).sort((a, b) => a - b);
    const cacheKey = `${allIds.join(',')}_${anyIds.join(',')}_${noneIds.join(',')}_${exclusiveIds.join(',')}`;

    // Check cache
    const cached = this.queryCache.get(cacheKey);
    if (cached && cached.version === this.archetypeVersion) {
      return cached.matchedArchetypes;
    }

    // Cache miss: compute matched archetypes
    const archetypes = this.archetypeGraph.getAllArchetypes();
    const matchedArchetypes = archetypes.filter((archetype) =>
      this.matchesQuery(
        archetype,
        allTypes,
        anyTypes,
        noneTypes,
        exclusiveTypes,
      ),
    );

    // Update cache
    this.queryCache.set(cacheKey, {
      allIds,
      anyIds,
      noneIds,
      exclusiveIds,
      matchedArchetypes,
      version: this.archetypeVersion,
    });

    return matchedArchetypes;
  }

  /**
   * Check if archetype matches query
   */
  private matchesQuery(
    archetype: Archetype,
    allTypes: ComponentType[],
    anyTypes: ComponentType[],
    noneTypes: ComponentType[],
    exclusiveTypes: ComponentType[],
  ): boolean {
    // Exclusive: must have exactly these components
    if (exclusiveTypes.length > 0) {
      if (archetype.componentIds.length !== exclusiveTypes.length) {
        return false;
      }
      return exclusiveTypes.every((type) => archetype.hasComponent(type.id));
    }

    // All: must have all specified components
    if (!allTypes.every((type) => archetype.hasComponent(type.id))) {
      return false;
    }

    // None: must not have any specified components
    if (noneTypes.some((type) => archetype.hasComponent(type.id))) {
      return false;
    }

    // Any: must have at least one specified component
    if (anyTypes.length > 0) {
      if (!anyTypes.some((type) => archetype.hasComponent(type.id))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Invalidate query cache (called when archetypes change)
   */
  private invalidateQueryCache(): void {
    this.archetypeVersion++;
  }

  /**
   * Flush deferred command buffer
   */
  private flushCommands(): void {
    while (this.commandBuffer.length > 0) {
      const command = this.commandBuffer.shift()!;

      switch (command.type) {
        case 'spawn':
          this.spawnInternal(
            command.components,
            command.callback,
            command.reservedEntity,
          );
          break;
        case 'destroy':
          this.destroy(command.entity);
          break;
        case 'addComponent':
          this.addComponent(
            command.entity,
            { id: command.componentId } as ComponentType,
            command.data,
          );
          break;
        case 'removeComponent':
          this.removeComponent(command.entity, {
            id: command.componentId,
          } as ComponentType);
          break;
      }
    }
  }

  /**
   * Get entity count
   */
  getEntityCount(): number {
    return this.entityManager.getEntityCount();
  }

  /**
   * Clear all entities
   */
  clear(): void {
    this.entityManager.clear();
    this.archetypeGraph.clear();
    this.commandBuffer.length = 0;
    this.isIterating = false;
    // Invalidate query cache since all archetypes are cleared
    this.queryCache.clear();
    this.archetypeVersion++;
  }

  /**
   * Get entity generation for validation
   */
  getGeneration(entity: Entity): number {
    const meta = this.entityManager.getMetadata(entity);
    return meta?.generation ?? 0;
  }

  /**
   * Get archetype count (for metadata/debugging)
   */
  getArchetypeCount(): number {
    return this.archetypeGraph.getAllArchetypes().length;
  }

  /**
   * Queue an event to be emitted later (during flushEvents)
   */
  private queueEvent(event: SceneEvent): void {
    this.eventQueue.push(event);
  }

  /**
   * Flush all queued events
   * Should be called at safe points in the game loop or immediately when not running
   */
  flushEvents(): void {
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      this.events.emit(event);
    }
  }

  /**
   * Get number of queued events (for debugging/testing)
   */
  getQueuedEventCount(): number {
    return this.eventQueue.length;
  }
}

/**
 * Entity Builder - Fluent API for entity creation
 */
export class EntityBuilder {
  private components = new Map<number, any>();
  private callback?: (entity: Entity) => void;

  constructor(private scene: Scene) {}

  /**
   * Add component to entity
   */
  with<T>(type: ComponentType<T>, data: T): this {
    this.components.set(type.id, data);
    return this;
  }

  /**
   * Set callback to be called after entity is spawned
   */
  onCreate(callback: (entity: Entity) => void): this {
    this.callback = callback;
    return this;
  }

  /**
   * Finalize and spawn entity
   * @returns Entity handle (may be undefined if spawn is deferred)
   */
  build(): Entity | undefined {
    return (this.scene as any).spawnInternal(this.components, this.callback);
  }
}

