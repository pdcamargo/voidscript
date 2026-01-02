/**
 * Command - High-level API wrapper for Scene
 * Provides cleaner syntax for entity/component operations
 */

import { Scene } from "./scene.js";
import type { Entity } from "./entity.js";
import type { ComponentType } from "./component.js";
import { Parent } from "./components/parent.js";
import { Children } from "./components/children.js";
import type { PrefabAsset, InstantiatePrefabOptions } from "./prefab-asset.js";
import type { SavePrefabOptions } from "./prefab-asset.js";
import { PrefabManager } from "./prefab-manager.js";
import type { BundleType, BundleSpawnData } from "./bundle.js";
import { resolveBundleComponents } from "./bundle.js";
import { Events, EventWriter, EventReader, type EventClass } from "./events.js";

// Type import to avoid circular dependency
type Application = import("../app/application.js").Application;

/**
 * Entity handle with helper methods
 * Provides shortcuts like entity.addChild() instead of commands.entity(id).addChild()
 */
export class EntityHandle {
  constructor(
    private entityId: Entity,
    private command: Command
  ) {}

  /**
   * Get entity ID
   */
  id(): Entity {
    return this.entityId;
  }

  /**
   * Add child entity (shortcut for command.entity(id).addChild())
   */
  addChild(childId: Entity): void {
    this.command.entity(this.entityId).addChild(childId);
  }

  /**
   * Remove child entity (shortcut for command.entity(id).removeChild())
   */
  removeChild(childId: Entity): void {
    this.command.entity(this.entityId).removeChild(childId);
  }

  /**
   * Destroy this entity recursively (shortcut for command.entity(id).destroyRecursive())
   */
  destroyRecursive(): void {
    this.command.entity(this.entityId).destroyRecursive();
  }

  // ============================================================================
  // Prefab Methods
  // ============================================================================

  /**
   * Instantiate a prefab as a child of this entity
   *
   * The prefab's root entity will become a child of this entity.
   *
   * @param guid - Prefab asset GUID
   * @param options - Instantiation options (position offset, overrides)
   * @returns Instantiation result with entity IDs and mapping
   * @throws Error if PrefabManager not initialized or prefab not loaded
   */
  instantiatePrefabAsChild(
    guid: string,
    options?: Omit<InstantiatePrefabOptions, "parentEntity">
  ) {
    const prefabManager = PrefabManager.get();
    return prefabManager.instantiate(
      guid,
      this.command["world"],
      this.command,
      {
        ...options,
        parentEntity: this.entityId,
      }
    );
  }

  /**
   * Save this entity and its descendants as a prefab asset
   *
   * @param options - Save options (GUID, path, metadata)
   * @returns Prefab asset ready to be serialized to YAML
   * @throws Error if PrefabManager not initialized
   */
  saveAsPrefab(options: SavePrefabOptions): PrefabAsset {
    const prefabManager = PrefabManager.get();
    return prefabManager.getSerializer().savePrefab(
      this.entityId,
      this.command["world"],
      this.command,
      options
    );
  }

  /**
   * Despawn this entity as a prefab (if it's a prefab root)
   *
   * Destroys the prefab root and all child entities.
   *
   * @throws Error if entity is not a prefab root or PrefabManager not initialized
   */
  despawnAsPrefab(): void {
    const prefabManager = PrefabManager.get();
    prefabManager.despawn(this.entityId, this.command);
  }

  /**
   * Get the prefab root entity (if this entity is part of a prefab)
   *
   * @returns Prefab root entity ID or null if not in a prefab
   * @throws Error if PrefabManager not initialized
   */
  getPrefabRoot(): number | null {
    const prefabManager = PrefabManager.get();
    return prefabManager.getPrefabRoot(this.entityId, this.command);
  }
}

/**
 * Entity command builder
 * Fluent API for building entities with components
 */
export class EntityCommandBuilder {
  private components = new Map<number, any>();
  private childrenBuilders: ((parent: Entity) => void)[] = [];
  private reservedEntity: Entity;

  constructor(
    private command: Command,
    private world: Scene
  ) {
    // Reserve entity ID immediately so it's available before build()
    this.reservedEntity = world.reserveEntity();
  }

  /**
   * Add component to entity
   */
  with<T>(type: ComponentType<T>, data: T): this {
    this.components.set(type.id, data);
    return this;
  }

  /**
   * Add components from a bundle
   *
   * Bundles provide a convenient way to spawn entities with pre-configured component sets.
   * Properties can be required, optional, or hidden, with full TypeScript type safety.
   *
   * @param bundleType - Bundle definition
   * @param spawnData - Property overrides for the bundle (TypeScript enforces required properties)
   * @returns this for method chaining
   *
   * @example
   * ```ts
   * const MyBundle = bundle({
   *   transform: {
   *     component: Transform3D,
   *     properties: {
   *       position: requiredProperty<Vector3>()
   *     }
   *   }
   * });
   *
   * commands.spawn()
   *   .withBundle(MyBundle, {
   *     transform: { position: new Vector3(10, 5, 0) }
   *   })
   *   .build();
   * ```
   */
  withBundle<B extends BundleType<any>>(
    bundleType: B,
    spawnData: B extends BundleType<infer S> ? BundleSpawnData<S> : never,
  ): this {
    // Resolve all components in the bundle
    const resolvedComponents = resolveBundleComponents(bundleType, spawnData);

    // Add all resolved components to this entity
    for (const [componentId, componentData] of resolvedComponents) {
      this.components.set(componentId, componentData);
    }

    return this;
  }

  /**
   * Spawn children for this entity
   * @param builder Function that receives parent entity ID and spawns children
   */
  withChildren(builder: (parentId: Entity) => void): this {
    this.childrenBuilders.push(builder);
    return this;
  }

  /**
   * Build and spawn the entity
   * @returns Entity handle with helper methods
   */
  build(): EntityHandle {
    // Spawn entity with reserved ID
    // Note: spawnInternal may return undefined if deferred, but we have reservedEntity
    (this.world as any).spawnInternal(
      this.components,
      undefined,
      this.reservedEntity
    );

    // Spawn children if any
    if (this.childrenBuilders.length > 0) {
      for (const builder of this.childrenBuilders) {
        builder(this.reservedEntity);
      }
    }

    // Always use reservedEntity ID (it's valid even when spawn is deferred)
    return new EntityHandle(this.reservedEntity, this.command);
  }
}

/**
 * Entity operations for specific entity
 */
export class EntityCommands {
  constructor(
    private entityId: Entity,
    private command: Command,
    private world: Scene
  ) {}

  /**
   * Add child to this entity
   */
  addChild(childId: Entity): void {
    this.command.addChildInternal(this.entityId, childId);
  }

  /**
   * Remove child from this entity
   */
  removeChild(childId: Entity): void {
    this.command.removeChildInternal(this.entityId, childId);
  }

  /**
   * Destroy this entity
   */
  destroy(): void {
    this.world.destroy(this.entityId);
  }

  /**
   * Destroy this entity recursively (removes from parent, destroys all children)
   */
  destroyRecursive(): void {
    this.command.destroyRecursiveInternal(this.entityId);
  }

  /**
   * Add component to entity
   */
  addComponent<T>(type: ComponentType<T>, data: T): void {
    this.world.addComponent(this.entityId, type, data);
  }

  /**
   * Remove component from entity
   */
  removeComponent<T>(type: ComponentType<T>): void {
    this.world.removeComponent(this.entityId, type);
  }
}

/**
 * Command - Main command API
 * Wraps Scene with cleaner API and parent-child operations
 */
export class Command {
  private systemIdentity?: object;

  constructor(
    private world: Scene,
    private app?: Application
  ) {}

  /**
   * Spawn a new entity
   * @returns Entity builder with reserved ID
   */
  spawn(): EntityCommandBuilder {
    return new EntityCommandBuilder(this, this.world);
  }

  /**
   * Get commands for specific entity
   * @param entityId Entity to operate on
   */
  entity(entityId: Entity): EntityCommands {
    return new EntityCommands(entityId, this, this.world);
  }

  /**
   * Query entities (delegates to Scene)
   */
  query() {
    return this.world.query();
  }

  /**
   * Get component from entity (delegates to Scene)
   */
  getComponent<T>(entity: Entity, type: ComponentType<T>): T {
    const component = this.world.getComponent(entity, type);
    if (component === undefined) {
      throw new Error(`Entity ${entity} does not have component ${type.name}`);
    }
    return component;
  }

  /**
   * Try to get component from entity (delegates to Scene)
   * Returns undefined if entity doesn't have the component
   */
  tryGetComponent<T>(entity: Entity, type: ComponentType<T>): T | undefined {
    return this.world.getComponent(entity, type);
  }

  /**
   * Check if entity has component (delegates to Scene)
   */
  hasComponent<T>(entity: Entity, type: ComponentType<T>): boolean {
    return this.world.hasComponent(entity, type);
  }

  /**
   * Check if entity is alive (delegates to Scene)
   */
  isAlive(entity: Entity): boolean {
    return this.world.isAlive(entity);
  }

  /**
   * Get entity count (delegates to Scene)
   */
  getEntityCount(): number {
    return this.world.getEntityCount();
  }

  /**
   * Get all components from entity (for serialization)
   */
  getAllComponents(entity: Entity): Map<ComponentType<any>, any> | undefined {
    return this.world.getAllComponents(entity);
  }

  /**
   * Internal: Add child to parent
   */
  addChildInternal(parentId: Entity, childId: Entity): void {
    if (!this.world.isAlive(parentId) || !this.world.isAlive(childId)) {
      return;
    }

    // Add Parent component to child
    this.world.addComponent(childId, Parent, { id: parentId });

    // Add or update Children component on parent
    const existingChildren = this.world.getComponent(parentId, Children);
    if (existingChildren) {
      existingChildren.ids.add(childId);
    } else {
      this.world.addComponent(parentId, Children, { ids: new Set([childId]) });
    }
  }

  /**
   * Internal: Remove child from parent
   */
  removeChildInternal(parentId: Entity, childId: Entity): void {
    if (!this.world.isAlive(parentId) || !this.world.isAlive(childId)) {
      return;
    }

    // Remove Parent component from child
    if (this.world.hasComponent(childId, Parent)) {
      this.world.removeComponent(childId, Parent);
    }

    // Remove from parent's Children component
    const parentChildren = this.world.getComponent(parentId, Children);
    if (parentChildren) {
      parentChildren.ids.delete(childId);

      // Remove Children component if no children left
      if (parentChildren.ids.size === 0) {
        this.world.removeComponent(parentId, Children);
      }
    }
  }

  /**
   * Internal: Destroy entity recursively (removes from parent, destroys all children)
   */
  destroyRecursiveInternal(entityId: Entity): void {
    if (!this.world.isAlive(entityId)) {
      return;
    }

    // Remove from parent's children list (if has parent)
    const parentComponent = this.world.getComponent(entityId, Parent);
    if (parentComponent) {
      this.removeChildInternal(parentComponent.id, entityId);
    }

    // Recursively destroy all children (safe iteration)
    const childrenComponent = this.world.getComponent(entityId, Children);
    if (childrenComponent) {
      // Copy to array to avoid modification during iteration
      const childIds = Array.from(childrenComponent.ids);
      for (const childId of childIds) {
        this.destroyRecursiveInternal(childId);
      }
    }

    // Finally destroy this entity
    this.world.destroy(entityId);
  }

  // ============================================================================
  // Resource Access
  // ============================================================================

  /**
   * Internal: Get app instance, throws if not available
   */
  private requireApp(): Application {
    if (!this.app) {
      throw new Error('Command requires Application instance for resource/time access');
    }
    return this.app;
  }

  /**
   * Get a resource by its type
   * @throws Error if the resource is not found or Application not available
   *
   * @example
   * ```ts
   * const tweenManager = commands.getResource(TweenManager);
   * tweenManager.update(deltaTime);
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getResource<T>(ResourceType: new (...args: any[]) => T): T {
    const resource = this.requireApp().getResource(ResourceType);
    if (resource === undefined) {
      throw new Error(`Resource not found: ${ResourceType.name}`);
    }
    return resource;
  }

  /**
   * Try to get a resource by its type
   * @returns The resource or undefined if not found
   * @throws Error if Application not available
   *
   * @example
   * ```ts
   * const animManager = commands.tryGetResource(AnimationManager);
   * if (animManager) {
   *   animManager.pauseAll();
   * }
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tryGetResource<T>(ResourceType: new (...args: any[]) => T): T | undefined {
    return this.requireApp().getResource(ResourceType);
  }

  /**
   * Check if a resource exists
   * @throws Error if Application not available
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hasResource<T>(ResourceType: new (...args: any[]) => T): boolean {
    return this.requireApp().hasResource(ResourceType);
  }

  // ============================================================================
  // Time Access
  // ============================================================================

  /**
   * Get delta time in seconds since last frame
   * @throws Error if Application not available
   */
  getDeltaTime(): number {
    return this.requireApp().getDeltaTime();
  }

  /**
   * Get fixed delta time in seconds (for physics)
   * @throws Error if Application not available
   */
  getFixedDeltaTime(): number {
    return this.requireApp().getFixedDeltaTime();
  }

  /**
   * Get elapsed time in seconds since application started
   * @throws Error if Application not available
   */
  getElapsedTime(): number {
    return this.requireApp().getElapsedTime();
  }

  // ============================================================================
  // Event System
  // ============================================================================

  /**
   * Set the system identity (called by scheduler before each system execution)
   * @internal Used by Scheduler.executeSystems()
   */
  setSystemIdentity(identity: object): void {
    this.systemIdentity = identity;
  }

  /**
   * Get the current system identity
   * @throws Error if called outside of a system execution context
   */
  private getSystemIdentity(): object {
    if (!this.systemIdentity) {
      throw new Error('System identity not set - eventReader can only be used inside systems');
    }
    return this.systemIdentity;
  }

  /**
   * Get an event writer for sending events of the specified type
   *
   * @example
   * ```ts
   * class PlayerDamagedEvent {
   *   constructor(public damage: number) {}
   * }
   *
   * const system = system(({ commands }) => {
   *   const writer = commands.eventWriter(PlayerDamagedEvent);
   *   writer.send(new PlayerDamagedEvent(10));
   * });
   * ```
   *
   * @throws Error if Events resource is not found
   */
  eventWriter<T>(cls: EventClass<T>): EventWriter<T> {
    const events = this.requireApp().getResource(Events);
    if (!events) {
      throw new Error('Events resource not found');
    }
    return events.writer(cls);
  }

  /**
   * Get an event reader for receiving events of the specified type
   *
   * Each system maintains its own read cursor, so multiple systems
   * can independently consume the same events.
   *
   * @example
   * ```ts
   * class PlayerDamagedEvent {
   *   constructor(public damage: number) {}
   * }
   *
   * const uiSystem = system(({ commands }) => {
   *   const reader = commands.eventReader(PlayerDamagedEvent);
   *   for (const event of reader.read()) {
   *     console.log(`Took ${event.damage} damage`);
   *   }
   * });
   * ```
   *
   * @throws Error if Events resource is not found or called outside system context
   */
  eventReader<T>(cls: EventClass<T>): EventReader<T> {
    const events = this.requireApp().getResource(Events);
    if (!events) {
      throw new Error('Events resource not found');
    }
    return events.reader(cls, this.getSystemIdentity());
  }
}
