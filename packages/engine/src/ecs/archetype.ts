/**
 * Archetype System - Cache-friendly component storage
 *
 * Archetypes store entities with identical component signatures.
 * Uses Structure of Arrays (SOA) layout for maximum cache efficiency.
 */

import type { Entity } from "./entity.js";
import type { ComponentType } from "./component.js";

/**
 * Archetype - Stores entities with identical component set
 *
 * Layout (Structure of Arrays):
 * ```
 * entities:     [E1, E2, E3, E4]
 * Position[]:   [{x:0,y:0}, {x:1,y:1}, {x:2,y:2}, {x:3,y:3}]
 * Velocity[]:   [{x:1,y:0}, {x:0,y:1}, {x:1,y:1}, {x:-1,y:0}]
 * ```
 */
export class Archetype {
  /** Unique ID for this archetype */
  readonly id: number;

  /** Component type IDs in this archetype (sorted for fast comparison) */
  readonly componentIds: number[];

  /** Set of component IDs for O(1) membership checking */
  readonly componentSet: Set<number>;

  /** Dense array of entity handles */
  readonly entities: Entity[] = [];

  /** Component data arrays (componentId → array of components) */
  readonly components = new Map<number, any[]>();

  /** Map entity to its row index (entityId → row) */
  private readonly entityToRow = new Map<number, number>();

  constructor(id: number, componentIds: number[]) {
    this.id = id;
    // Sort component IDs for consistent signature comparison
    this.componentIds = [...componentIds].sort((a, b) => a - b);
    this.componentSet = new Set(this.componentIds);

    // Initialize component arrays
    for (const componentId of this.componentIds) {
      this.components.set(componentId, []);
    }
  }

  /**
   * Add entity to this archetype
   * @param entity Entity handle
   * @param components Map of componentId → component data
   * @returns Row index where entity was added
   */
  addEntity(entity: Entity, components: Map<number, any>): number {
    const row = this.entities.length;

    // Add entity to dense array
    this.entities.push(entity);

    // Add components to parallel arrays
    for (const componentId of this.componentIds) {
      const componentData = components.get(componentId);
      if (componentData === undefined) {
        throw new Error(
          `Missing component ${componentId} for entity ${entity}`
        );
      }
      this.components.get(componentId)!.push(componentData);
    }

    // Track entity row for fast lookup
    this.entityToRow.set(entity, row);

    return row;
  }

  /**
   * Remove entity from this archetype
   * Uses swap-remove: swap with last entity, then pop
   *
   * @param entity Entity to remove
   * @returns Components that were removed (for moving to new archetype)
   */
  removeEntity(entity: Entity): Map<number, any> | undefined {
    const row = this.entityToRow.get(entity);
    if (row === undefined) {
      return undefined;
    }

    // Store removed components
    const removedComponents = new Map<number, any>();
    for (const componentId of this.componentIds) {
      const componentArray = this.components.get(componentId)!;
      removedComponents.set(componentId, componentArray[row]);
    }

    // Swap-remove: swap with last entity
    const lastRow = this.entities.length - 1;
    if (row !== lastRow) {
      // Swap entity
      const lastEntity = this.entities[lastRow]!;
      this.entities[row] = lastEntity;
      this.entityToRow.set(lastEntity, row);

      // Swap components
      for (const componentId of this.componentIds) {
        const componentArray = this.components.get(componentId)!;
        componentArray[row] = componentArray[lastRow];
      }
    }

    // Pop last element
    this.entities.pop();
    for (const componentId of this.componentIds) {
      this.components.get(componentId)!.pop();
    }

    this.entityToRow.delete(entity);

    return removedComponents;
  }

  /**
   * Get component for entity
   * @param entity Entity handle
   * @param componentId Component type ID
   * @returns Component data or undefined
   */
  getComponent<T>(entity: Entity, componentId: number): T | undefined {
    const row = this.entityToRow.get(entity);
    if (row === undefined) {
      return undefined;
    }

    const componentArray = this.components.get(componentId);
    if (!componentArray) {
      return undefined;
    }

    return componentArray[row];
  }

  /**
   * Get component by row index (for fast iteration)
   * @param row Row index
   * @param componentId Component type ID
   * @returns Component data
   */
  getComponentByRow<T>(row: number, componentId: number): T {
    return this.components.get(componentId)![row];
  }

  /**
   * Set component for entity
   * @param entity Entity handle
   * @param componentId Component type ID
   * @param data Component data
   */
  setComponent(entity: Entity, componentId: number, data: any): void {
    const row = this.entityToRow.get(entity);
    if (row === undefined) {
      throw new Error(`Entity ${entity} not found in archetype ${this.id}`);
    }

    const componentArray = this.components.get(componentId);
    if (!componentArray) {
      throw new Error(
        `Component ${componentId} not found in archetype ${this.id}`
      );
    }

    componentArray[row] = data;
  }

  /**
   * Check if archetype has component type
   */
  hasComponent(componentId: number): boolean {
    return this.componentSet.has(componentId);
  }

  /**
   * Get entity count
   */
  getEntityCount(): number {
    return this.entities.length;
  }

  /**
   * Get signature hash for this archetype
   */
  getSignatureHash(): string {
    return this.componentIds.join(",");
  }

  /**
   * Check if this archetype matches component signature
   */
  matchesSignature(componentIds: number[]): boolean {
    if (componentIds.length !== this.componentIds.length) {
      return false;
    }

    const sorted = [...componentIds].sort((a, b) => a - b);
    return sorted.every((id, i) => id === this.componentIds[i]);
  }

  /**
   * Clear all entities from this archetype
   */
  clear(): void {
    this.entities.length = 0;
    for (const componentArray of this.components.values()) {
      componentArray.length = 0;
    }
    this.entityToRow.clear();
  }
}

/**
 * Archetype Graph - Manages archetype transitions
 *
 * When a component is added/removed from an entity, it must move to a different archetype.
 * The graph tracks edges between archetypes for O(1) transition lookup.
 */
export class ArchetypeGraph {
  /** All archetypes (archetypeId → archetype) */
  private readonly archetypes = new Map<number, Archetype>();

  /** Signature hash → archetype for fast lookup */
  private readonly signatureToArchetype = new Map<string, Archetype>();

  /** Next archetype ID */
  private nextArchetypeId = 0;

  /** Archetype edges for fast transitions */
  private readonly edges = new Map<
    number,
    {
      add: Map<number, Archetype>;
      remove: Map<number, Archetype>;
    }
  >();

  /** Callback when new archetype is created */
  onArchetypeCreated?: () => void;

  /**
   * Get or create archetype with given component signature
   */
  getOrCreateArchetype(componentIds: number[]): Archetype {
    // Sort for consistent signature
    const sorted = [...componentIds].sort((a, b) => a - b);
    const hash = sorted.join(",");

    // Check if archetype already exists
    let archetype = this.signatureToArchetype.get(hash);
    if (archetype) {
      return archetype;
    }

    // Create new archetype
    archetype = new Archetype(this.nextArchetypeId++, sorted);
    this.archetypes.set(archetype.id, archetype);
    this.signatureToArchetype.set(hash, archetype);

    // Initialize edges
    this.edges.set(archetype.id, {
      add: new Map(),
      remove: new Map(),
    });

    // Notify that archetype was created
    this.onArchetypeCreated?.();

    return archetype;
  }

  /**
   * Get archetype by ID
   */
  getArchetype(id: number): Archetype | undefined {
    return this.archetypes.get(id);
  }

  /**
   * Get archetype when adding component to entity
   * @param fromArchetype Current archetype
   * @param componentId Component to add
   * @returns Destination archetype
   */
  getArchetypeAdd(
    fromArchetype: Archetype,
    componentId: number
  ): Archetype | undefined {
    // Check if component already exists
    if (fromArchetype.hasComponent(componentId)) {
      return undefined;
    }

    // Check edge cache
    const edges = this.edges.get(fromArchetype.id);
    if (edges) {
      const cached = edges.add.get(componentId);
      if (cached) {
        return cached;
      }
    }

    // Create new archetype with added component
    const newComponentIds = [...fromArchetype.componentIds, componentId];
    const newArchetype = this.getOrCreateArchetype(newComponentIds);

    // Cache edge
    if (edges) {
      edges.add.set(componentId, newArchetype);
    }

    return newArchetype;
  }

  /**
   * Get archetype when removing component from entity
   * @param fromArchetype Current archetype
   * @param componentId Component to remove
   * @returns Destination archetype
   */
  getArchetypeRemove(
    fromArchetype: Archetype,
    componentId: number
  ): Archetype | undefined {
    // Check if component exists
    if (!fromArchetype.hasComponent(componentId)) {
      return undefined;
    }

    // Check edge cache
    const edges = this.edges.get(fromArchetype.id);
    if (edges) {
      const cached = edges.remove.get(componentId);
      if (cached) {
        return cached;
      }
    }

    // Create new archetype with removed component
    const newComponentIds = fromArchetype.componentIds.filter(
      (id) => id !== componentId
    );
    const newArchetype = this.getOrCreateArchetype(newComponentIds);

    // Cache edge
    if (edges) {
      edges.remove.set(componentId, newArchetype);
    }

    return newArchetype;
  }

  /**
   * Get all archetypes
   */
  getAllArchetypes(): Archetype[] {
    return Array.from(this.archetypes.values());
  }

  /**
   * Clear all archetypes
   */
  clear(): void {
    this.archetypes.clear();
    this.signatureToArchetype.clear();
    this.edges.clear();
    this.nextArchetypeId = 0;
  }
}
