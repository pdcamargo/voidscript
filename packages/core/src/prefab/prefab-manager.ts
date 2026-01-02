/**
 * PrefabManager - Manages prefab asset loading, caching, and instantiation
 *
 * Singleton pattern provides:
 * - Prefab asset caching (load once, instantiate many times)
 * - Prefab instantiation with entity ID remapping
 * - Prefab despawning (destroyRecursive destroys root and children)
 * - Nested prefab support
 */

import type { Scene } from '../ecs/scene.js';
import type { Command } from '../ecs/command.js';
import type {
  PrefabAsset,
  InstantiatePrefabOptions,
  InstantiatePrefabResult,
} from './prefab-asset.js';
import { PrefabSerializer } from './prefab-serializer.js';
import { SceneSerializer } from '../serialization/scene-serializer.js';
import { PrefabInstance, type PrefabInstanceData } from '../ecs/components/prefab-instance.js';
import { Parent } from '../ecs/components/parent.js';
import { globalComponentRegistry } from '../ecs/component.js';
import type { RuntimeAsset } from '../ecs/runtime-asset.js';

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * PrefabManager - Singleton for prefab asset management
 */
export class PrefabManager {
  private static instance: PrefabManager | null = null;

  private prefabCache: Map<string, PrefabAsset> = new Map();
  private prefabSerializer: PrefabSerializer;
  private worldSerializer: SceneSerializer;

  private constructor() {
    this.prefabSerializer = new PrefabSerializer();
    this.worldSerializer = new SceneSerializer();
  }

  // ============================================================================
  // Singleton Pattern
  // ============================================================================

  /**
   * Initialize the PrefabManager singleton
   * @throws Error if already initialized
   */
  static initialize(): PrefabManager {
    if (PrefabManager.instance !== null) {
      throw new Error('PrefabManager already initialized');
    }
    PrefabManager.instance = new PrefabManager();
    return PrefabManager.instance;
  }

  /**
   * Get the PrefabManager singleton instance
   * @throws Error if not initialized
   */
  static get(): PrefabManager {
    if (PrefabManager.instance === null) {
      throw new Error(
        'PrefabManager not initialized. Call PrefabManager.initialize() first.',
      );
    }
    return PrefabManager.instance;
  }

  /**
   * Check if PrefabManager has been initialized
   */
  static has(): boolean {
    return PrefabManager.instance !== null;
  }

  /**
   * Clear the singleton instance (useful for testing)
   */
  static clear(): void {
    if (PrefabManager.instance) {
      PrefabManager.instance.prefabCache.clear();
    }
    PrefabManager.instance = null;
  }

  // ============================================================================
  // Prefab Loading & Caching
  // ============================================================================

  /**
   * Load a prefab asset from RuntimeAsset and cache it
   *
   * Once loaded, the prefab is cached for instant instantiation.
   *
   * @param asset - RuntimeAsset for the prefab
   * @returns Promise that resolves when prefab is loaded
   */
  async loadPrefab(asset: RuntimeAsset<PrefabAsset>): Promise<void> {
    const guid = asset.guid;

    // Already cached?
    if (this.prefabCache.has(guid)) {
      return;
    }

    // Load if not already loaded
    if (!asset.isLoaded) {
      await asset.load();
    }

    if (!asset.data) {
      throw new Error(`Failed to load prefab asset: ${guid}`);
    }

    // Validate and cache
    const validatedPrefab = this.prefabSerializer.loadPrefab(asset.data);
    this.prefabCache.set(guid, validatedPrefab);

    // TODO: Recursively load nested prefabs
    // for (const nestedGuid of validatedPrefab.metadata.nestedPrefabs) {
    //   if (!this.prefabCache.has(nestedGuid)) {
    //     const nestedAsset = RuntimeAssetManager.get().get(nestedGuid);
    //     if (nestedAsset) await this.loadPrefab(nestedAsset);
    //   }
    // }
  }

  /**
   * Load a prefab directly from PrefabAsset data (already parsed)
   * Useful for runtime-generated prefabs or editor workflows
   */
  loadPrefabFromData(guid: string, data: PrefabAsset): void {
    const validatedPrefab = this.prefabSerializer.loadPrefab(data);
    this.prefabCache.set(guid, validatedPrefab);
  }

  /**
   * Unload a prefab from cache
   */
  unloadPrefab(guid: string): void {
    this.prefabCache.delete(guid);
  }

  /**
   * Clear all cached prefabs
   */
  clearCache(): void {
    this.prefabCache.clear();
  }

  /**
   * Check if prefab is loaded in cache
   */
  isLoaded(guid: string): boolean {
    return this.prefabCache.has(guid);
  }

  /**
   * Get cached prefab data (for editor inspection)
   */
  getCachedPrefab(guid: string): PrefabAsset | undefined {
    return this.prefabCache.get(guid);
  }

  // ============================================================================
  // Prefab Instantiation
  // ============================================================================

  /**
   * Instantiate a prefab from cached asset (sync operation)
   *
   * Prerequisites:
   * - Prefab must be loaded via loadPrefab() first
   *
   * Process:
   * 1. Create all entities with fresh IDs
   * 2. Add components with remapped entity references
   * 3. Rebuild Parent/Children hierarchy
   * 4. Add PrefabInstance to root entity
   * 5. Apply position/rotation/scale to root
   * 6. Apply any overrides
   *
   * @param guid - Prefab asset GUID
   * @param world - Scene to instantiate into
   * @param commands - Command instance for entity creation
   * @param options - Instantiation options (position, parent, overrides)
   * @returns Instantiation result with entity IDs and mapping
   * @throws Error if prefab not loaded
   */
  instantiate(
    guid: string,
    world: Scene,
    commands: Command,
    options?: InstantiatePrefabOptions,
  ): InstantiatePrefabResult {
    const prefabAsset = this.prefabCache.get(guid);
    if (!prefabAsset) {
      throw new Error(`Prefab ${guid} not loaded. Call loadPrefab() first.`);
    }

    const instanceId = generateUUID();
    const entityMapping = new Map<string, number>();

    // Build reverse lookup: serialized ID -> local UUID
    const serializedToUuid = new Map<number, string>();
    for (const [serializedIdStr, uuid] of Object.entries(
      prefabAsset.prefabData.entityIdMap,
    )) {
      serializedToUuid.set(Number(serializedIdStr), uuid);
    }

    // Pass 1: Create all entities (without components)
    const serializedToRuntime = new Map<number, number>();

    for (const serializedEntity of prefabAsset.scene.entities) {
      const newEntity = commands.spawn().build();
      if (!newEntity) {
        throw new Error('Failed to spawn entity');
      }

      const uuid = serializedToUuid.get(serializedEntity.id);
      if (uuid) {
        entityMapping.set(uuid, newEntity.id());
      }
      serializedToRuntime.set(serializedEntity.id, newEntity.id());
    }

    // Pass 2: Add components with entity reference remapping
    const context = {
      entityMapping: serializedToRuntime,
      assetMetadataResolver: options?.assetMetadataResolver,
    };

    for (const serializedEntity of prefabAsset.scene.entities) {
      const runtimeId = serializedToRuntime.get(serializedEntity.id);
      if (runtimeId === undefined) continue;

      for (const serializedComponent of serializedEntity.components) {
        const componentType = globalComponentRegistry.getByName(
          serializedComponent.typeName,
        );
        if (!componentType) {
          console.warn(
            `Component type "${serializedComponent.typeName}" not found, skipping`,
          );
          continue;
        }

        // Skip PrefabInstance if somehow serialized
        if (componentType.name === 'PrefabInstance') {
          continue;
        }

        // Deserialize component data with entity remapping
        let componentData: unknown;
        if (componentType.serializerConfig) {
          componentData = this.worldSerializer['deserializeWithPropertyConfig'](
            serializedComponent.data,
            componentType.serializerConfig,
            context,
            componentType,
          );
        } else {
          componentData = serializedComponent.data;
        }

        commands.entity(runtimeId).addComponent(componentType, componentData);
      }
    }

    // Get root entity
    const rootUuid = prefabAsset.prefabData.rootEntityId;
    const rootEntity = entityMapping.get(rootUuid);
    if (rootEntity === undefined) {
      throw new Error('Root entity not found in prefab');
    }

    // Pass 3: Add PrefabInstance to root
    const prefabInstanceData: PrefabInstanceData = {
      prefabAssetGuid: guid,
      instanceId,
      entityMapping: entityMapping,
      overrides: options?.overrides,
    };
    commands.entity(rootEntity).addComponent(PrefabInstance, prefabInstanceData);

    // Pass 4: Apply transform to root (look up Transform3D by name to avoid engine dependency)
    if (options?.position || options?.rotation || options?.scale) {
      const Transform3D = globalComponentRegistry.getByName('Transform3D');
      if (Transform3D) {
        const transform = commands.tryGetComponent(rootEntity, Transform3D) as {
          position: { x: number; y: number; z: number };
          rotation: { x: number; y: number; z: number };
          scale: { x: number; y: number; z: number };
        } | undefined;
        if (transform) {
          if (options.position) {
            transform.position.x = options.position.x;
            transform.position.y = options.position.y;
            transform.position.z = options.position.z;
          }
          if (options.rotation) {
            transform.rotation.x = options.rotation.x;
            transform.rotation.y = options.rotation.y;
            transform.rotation.z = options.rotation.z;
          }
          if (options.scale) {
            transform.scale.x = options.scale.x;
            transform.scale.y = options.scale.y;
            transform.scale.z = options.scale.z;
          }
        }
      }
    }

    // Pass 5: Parent to specified entity
    if (options?.parentEntity !== undefined) {
      commands.entity(options.parentEntity).addChild(rootEntity);
    }

    // Pass 6: Apply overrides
    if (options?.overrides) {
      this.applyOverrides(options.overrides, entityMapping, commands);
    }

    return {
      rootEntity,
      allEntities: Array.from(entityMapping.values()),
      entityMapping,
      instanceId,
    };
  }

  /**
   * Apply component property overrides
   *
   * Format: "localEntityId.ComponentName.propertyName": value
   */
  private applyOverrides(
    overrides: Record<string, unknown>,
    entityMapping: Map<string, number>,
    commands: Command,
  ): void {
    for (const [path, value] of Object.entries(overrides)) {
      // Format: "localEntityId.ComponentName.propertyName" or deeper paths
      const parts = path.split('.');
      if (parts.length < 3) {
        console.warn(`Invalid override path: ${path}`);
        continue;
      }

      const [localEntityId, componentName, ...propertyPath] = parts;
      const runtimeId = entityMapping.get(localEntityId!);
      if (runtimeId === undefined) {
        console.warn(`Entity ${localEntityId} not found for override`);
        continue;
      }

      const componentType = globalComponentRegistry.getByName(componentName!);
      if (!componentType) {
        console.warn(`Component type "${componentName}" not found`);
        continue;
      }

      const componentData = commands.tryGetComponent(runtimeId, componentType);
      if (!componentData) {
        continue;
      }

      // Apply nested property path
      let target: Record<string, unknown> = componentData as Record<string, unknown>;
      for (let i = 0; i < propertyPath.length - 1; i++) {
        const key = propertyPath[i]!;
        if (target[key] === undefined) break;
        target = target[key] as Record<string, unknown>;
      }

      if (target !== undefined && propertyPath.length > 0) {
        target[propertyPath[propertyPath.length - 1]!] = value;
      }
    }
  }

  // ============================================================================
  // Prefab Despawning
  // ============================================================================

  /**
   * Despawn a prefab instance by its root entity.
   * Uses destroyRecursive to destroy root and all children.
   *
   * @param rootEntity - The prefab root entity (has PrefabInstance component)
   * @param commands - Command instance
   * @throws Error if entity is not a prefab root
   */
  despawn(rootEntity: number, commands: Command): void {
    // Verify it's a prefab root
    const prefabInstance = commands.tryGetComponent(rootEntity, PrefabInstance);
    if (!prefabInstance) {
      throw new Error('Entity is not a prefab root');
    }

    // destroyRecursive handles Parent/Children cleanup automatically
    commands.entity(rootEntity).destroyRecursive();
  }

  // ============================================================================
  // Prefab Queries
  // ============================================================================

  /**
   * Find all prefab instances of a specific prefab
   *
   * @param prefabGuid - Prefab asset GUID to search for
   * @param commands - Command instance
   * @returns Array of root entity IDs
   */
  findInstances(prefabGuid: string, commands: Command): number[] {
    const instances: number[] = [];
    commands
      .query()
      .all(PrefabInstance)
      .each((entity, instance) => {
        if (instance.prefabAssetGuid === prefabGuid) {
          instances.push(entity);
        }
      });
    return instances;
  }

  /**
   * Check if an entity is part of a prefab instance.
   * Returns the root entity if it is, null otherwise.
   *
   * @param entity - Entity to check
   * @param commands - Command instance
   * @returns Root entity ID or null
   */
  getPrefabRoot(entity: number, commands: Command): number | null {
    // Check if this entity is the root
    if (commands.hasComponent(entity, PrefabInstance)) {
      return entity;
    }

    // Walk up the parent chain
    let current = entity;
    while (true) {
      const parent = commands.tryGetComponent(current, Parent);
      if (!parent) {
        return null; // No parent, not in a prefab
      }

      if (commands.hasComponent(parent.id, PrefabInstance)) {
        return parent.id;
      }

      current = parent.id;
    }
  }

  /**
   * Check if an entity is part of a prefab (either root or child)
   */
  isPartOfPrefab(entity: number, commands: Command): boolean {
    return this.getPrefabRoot(entity, commands) !== null;
  }

  /**
   * Unpack a prefab instance (remove PrefabInstance marker)
   * This makes it a regular entity hierarchy that can be edited
   *
   * @param rootEntity - The prefab root entity
   * @param commands - Command instance
   */
  unpack(rootEntity: number, commands: Command): void {
    const prefabInstance = commands.tryGetComponent(rootEntity, PrefabInstance);
    if (!prefabInstance) {
      throw new Error('Entity is not a prefab root');
    }

    commands.entity(rootEntity).removeComponent(PrefabInstance);
  }

  // ============================================================================
  // Serializer Access
  // ============================================================================

  /**
   * Get the PrefabSerializer instance for saving prefabs
   */
  getSerializer(): PrefabSerializer {
    return this.prefabSerializer;
  }
}
