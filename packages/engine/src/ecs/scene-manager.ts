/**
 * SceneManager - Manages scene asset loading, caching, and instantiation
 *
 * Singleton pattern provides:
 * - Scene asset caching (load once, instantiate many times)
 * - Scene instantiation with entity ID remapping
 * - Scene despawning (single command destroys all entities)
 * - Nested scene support (recursive loading)
 */

import type { World } from "./world.js";
import type { Command } from "./command.js";
import type {
  SceneAsset,
  InstantiateSceneOptions,
  InstantiateSceneResult,
} from "./scene-asset.js";
import type { SaveSceneOptions } from "./scene-serializer.js";
import { SceneSerializer } from "./scene-serializer.js";
import { WorldSerializer } from "./serialization/world-serializer.js";
import { SceneRoot, type SceneRootData } from "./components/scene-root.js";
import { SceneChild, type SceneChildData } from "./components/scene-child.js";
import { Parent } from "./components/parent.js";
import { Children } from "./components/children.js";
import { globalComponentRegistry } from "./component.js";

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * SceneManager - Singleton for scene asset management
 */
export class SceneManager {
  private static instance: SceneManager | null = null;

  private sceneCache: Map<string, SceneAsset> = new Map();
  private sceneSerializer: SceneSerializer;
  private worldSerializer: WorldSerializer;

  private constructor() {
    this.sceneSerializer = new SceneSerializer();
    this.worldSerializer = new WorldSerializer();
  }

  // ============================================================================
  // Singleton Pattern
  // ============================================================================

  /**
   * Initialize the SceneManager singleton
   * @throws Error if already initialized
   */
  static initialize(): SceneManager {
    if (SceneManager.instance !== null) {
      throw new Error("SceneManager already initialized");
    }
    SceneManager.instance = new SceneManager();
    return SceneManager.instance;
  }

  /**
   * Get the SceneManager singleton instance
   * @throws Error if not initialized
   */
  static get(): SceneManager {
    if (SceneManager.instance === null) {
      throw new Error(
        "SceneManager not initialized. Call SceneManager.initialize() first."
      );
    }
    return SceneManager.instance;
  }

  /**
   * Check if SceneManager has been initialized
   */
  static has(): boolean {
    return SceneManager.instance !== null;
  }

  /**
   * Clear the singleton instance (useful for testing)
   */
  static clear(): void {
    SceneManager.instance = null;
  }

  // ============================================================================
  // Scene Asset Loading & Caching
  // ============================================================================

  /**
   * Load a scene asset and cache it in memory
   *
   * This is an async operation that loads the scene JSON from disk (via FileSystem)
   * and recursively loads any nested scenes.
   *
   * Once loaded, the scene is cached in memory for instant instantiation.
   *
   * @param guid - Scene asset GUID
   * @param loader - Async function that loads scene JSON by GUID
   * @returns Promise that resolves when scene (and nested scenes) are loaded
   */
  async loadSceneAsset(
    guid: string,
    loader: (guid: string) => Promise<SceneAsset>
  ): Promise<void> {
    // Already cached?
    if (this.sceneCache.has(guid)) {
      return;
    }

    // Load scene JSON
    const sceneAsset = await loader(guid);

    // Validate and cache
    const validatedScene = this.sceneSerializer.loadScene(sceneAsset);
    this.sceneCache.set(guid, validatedScene);

    // Recursively load nested scenes
    for (const nestedGuid of validatedScene.metadata.nestedScenes) {
      if (!this.sceneCache.has(nestedGuid)) {
        await this.loadSceneAsset(nestedGuid, loader);
      }
    }
  }

  /**
   * Unload a scene asset from cache
   */
  unloadSceneAsset(guid: string): void {
    this.sceneCache.delete(guid);
  }

  /**
   * Clear all cached scene assets
   */
  clearCache(): void {
    this.sceneCache.clear();
  }

  /**
   * Check if scene asset is cached
   */
  isLoaded(guid: string): boolean {
    return this.sceneCache.has(guid);
  }

  // ============================================================================
  // Scene Instantiation
  // ============================================================================

  /**
   * Instantiate a scene from cached asset (sync operation)
   *
   * Prerequisites:
   * - Scene must be loaded via loadSceneAsset() first
   * - All nested scenes must also be loaded
   *
   * Returns:
   * - Array of root entity IDs
   * - Virtual container entity ID (has SceneRoot component)
   * - All entity IDs created
   * - Entity ID mapping (local ID -> runtime ID)
   *
   * @param guid - Scene asset GUID
   * @param world - World to instantiate into
   * @param commands - Command instance for entity creation
   * @param options - Instantiation options (position offset, parent, overrides)
   * @returns Instantiation result with entity IDs and mapping
   * @throws Error if scene not loaded
   */
  instantiateScene(
    guid: string,
    world: World,
    commands: Command,
    options?: InstantiateSceneOptions
  ): InstantiateSceneResult {
    // Get cached scene
    const sceneAsset = this.sceneCache.get(guid);
    if (!sceneAsset) {
      throw new Error(
        `Scene ${guid} not loaded. Call loadSceneAsset() first.`
      );
    }

    const instanceId = generateUUID();

    // Build entity mapping (local ID -> new runtime ID)
    const entityMapping = new Map<string, number>();
    const entityIdMap = sceneAsset.sceneData.entityIdMap;

    // Pass 1: Create all entities (spawn without components)
    for (const serializedEntity of sceneAsset.world.entities) {
      const localId = entityIdMap[serializedEntity.id];
      if (!localId) {
        throw new Error(
          `Entity ${serializedEntity.id} missing from entityIdMap`
        );
      }

      const newEntity = commands.spawn().build();
      if (!newEntity) {
        throw new Error("Failed to spawn entity");
      }
      entityMapping.set(localId, newEntity.id());
    }

    // Pass 2: Add components with remapped entity references
    const context = {
      entityMapping: new Map<number, number>(), // WorldSerializer expects number -> number
      assetMetadataResolver: options?.assetMetadataResolver,
    };

    // Build reverse mapping for WorldSerializer (serialized ID -> runtime ID)
    for (const serializedEntity of sceneAsset.world.entities) {
      const localId = entityIdMap[serializedEntity.id];
      const runtimeId = entityMapping.get(localId!);
      if (runtimeId !== undefined) {
        context.entityMapping.set(serializedEntity.id, runtimeId);
      }
    }
    for (const serializedEntity of sceneAsset.world.entities) {
      const localId = entityIdMap[serializedEntity.id];
      const runtimeId = entityMapping.get(localId!);
      if (runtimeId === undefined) {
        continue;
      }

      // Add each component
      for (const serializedComponent of serializedEntity.components) {
        // Lookup component type
        const componentType = globalComponentRegistry.getByName(
          serializedComponent.typeName
        );
        if (!componentType) {
          console.warn(
            `Component type "${serializedComponent.typeName}" not found, skipping`
          );
          continue;
        }

        // Deserialize component data
        let componentData: any;

        if (componentType.serializerConfig) {
          // Use property-level config (handles entity remapping internally)
          componentData = this.worldSerializer["deserializeWithPropertyConfig"](
            serializedComponent.data,
            componentType.serializerConfig,
            context
          );
        } else {
          // Fall back to default serializer (without entity remapping yet)
          const serializer = this.worldSerializer["getSerializer"](componentType);
          componentData = serializer.deserialize(
            serializedComponent.data,
            { entityMapping: new Map() } // Empty entityMapping for first pass
          );
        }

        // Add component to entity
        commands.entity(runtimeId).addComponent(componentType, componentData);
      }
    }

    // Pass 2b: Fix entity references for components with custom serializers
    // This handles Parent/Children components which need entity ID remapping
    for (const serializedEntity of sceneAsset.world.entities) {
      const localId = entityIdMap[serializedEntity.id];
      const runtimeId = entityMapping.get(localId!);
      if (runtimeId === undefined) {
        continue;
      }

      for (const serializedComponent of serializedEntity.components) {
        const componentType = globalComponentRegistry.getByName(
          serializedComponent.typeName
        );
        if (!componentType) {
          continue;
        }

        // Skip components with property-level config (already handled in pass 1)
        if (componentType.serializerConfig) {
          continue;
        }

        // Check if this component has a custom serializer
        const serializer = this.worldSerializer["getSerializer"](componentType);
        const hasCustomSerializer = this.worldSerializer["customSerializers"].has(componentType);

        if (hasCustomSerializer) {
          // Re-deserialize with entity mapping context
          const componentData = serializer.deserialize(
            serializedComponent.data,
            context
          );

          // Update component with fixed entity references
          commands.entity(runtimeId).addComponent(componentType, componentData);
        }
      }
    }

    // Pass 3: Add SceneChild marker to all entities
    for (const [localId, runtimeId] of entityMapping) {
      const sceneChildData: SceneChildData = {
        sceneRootEntity: 0, // Will be set after container entity created
        sceneAssetGuid: guid,
        localEntityId: localId,
      };

      commands.entity(runtimeId).addComponent(SceneChild, sceneChildData);
    }

    // Create virtual container entity with SceneRoot component
    const sceneRootEntity = commands.spawn().build();
    if (!sceneRootEntity) {
      throw new Error("Failed to spawn scene root entity");
    }

    const sceneRootData: SceneRootData = {
      sceneAssetGuid: guid,
      instanceId: instanceId,
      isPrefabRoot: true,
      overrides: options?.overrides as Record<string, unknown> | undefined,
      rootEntityLocalIds: sceneAsset.sceneData.rootEntityLocalIds,
    };

    commands
      .entity(sceneRootEntity.id())
      .addComponent(SceneRoot, sceneRootData);

    // Update SceneChild components to reference the container entity
    for (const [, runtimeId] of entityMapping) {
      const sceneChild = commands.getComponent(runtimeId, SceneChild);
      if (sceneChild) {
        sceneChild.sceneRootEntity = sceneRootEntity.id();
      }
    }

    // Pass 4: Apply position offset to root entities
    const rootEntityIds: number[] = [];
    for (const rootLocalId of sceneAsset.sceneData.rootEntityLocalIds) {
      const rootId = entityMapping.get(rootLocalId);
      if (rootId !== undefined) {
        rootEntityIds.push(rootId);

        // Apply position offset (if provided and entity has Position component)
        if (options?.positionOffset) {
          // Note: We'd need a Position component here - for now skip
          // This can be added as a helper or left to user code
        }
      }
    }

    // Pass 5: Parent root entities to specified parent (if provided)
    if (options?.parentEntity !== undefined) {
      for (const rootId of rootEntityIds) {
        commands.entity(options.parentEntity).addChild(rootId);
      }
    }

    // Pass 6: Apply component overrides (if provided)
    if (options?.overrides) {
      for (const [path, value] of Object.entries(options.overrides)) {
        const [componentName, propertyName] = path.split(".");
        if (!componentName || !propertyName) {
          console.warn(`Invalid override path: ${path}`);
          continue;
        }

        const componentType = globalComponentRegistry.getByName(componentName);
        if (!componentType) {
          console.warn(`Component type "${componentName}" not found`);
          continue;
        }

        // Apply override to all entities that have this component
        for (const [, runtimeId] of entityMapping) {
          const componentData = commands.tryGetComponent(runtimeId, componentType);
          if (componentData) {
            (componentData as any)[propertyName] = value;
          }
        }
      }
    }

    return {
      rootEntities: rootEntityIds,
      sceneRootEntity: sceneRootEntity.id(),
      allEntities: Array.from(entityMapping.values()),
      entityMapping: entityMapping,
    };
  }

  /**
   * Convenience method: Load scene asset and instantiate in one call
   *
   * @param guid - Scene asset GUID
   * @param world - World to instantiate into
   * @param commands - Command instance
   * @param loader - Async function that loads scene JSON
   * @param options - Instantiation options
   * @returns Promise that resolves with instantiation result
   */
  async instantiateSceneAsync(
    guid: string,
    world: World,
    commands: Command,
    loader: (guid: string) => Promise<SceneAsset>,
    options?: InstantiateSceneOptions
  ): Promise<InstantiateSceneResult> {
    await this.loadSceneAsset(guid, loader);
    return this.instantiateScene(guid, world, commands, options);
  }

  /**
   * Preload multiple scene assets (e.g., at level start)
   *
   * @param guids - Array of scene asset GUIDs
   * @param loader - Async function that loads scene JSON
   */
  async preloadScenes(
    guids: string[],
    loader: (guid: string) => Promise<SceneAsset>
  ): Promise<void> {
    await Promise.all(guids.map((guid) => this.loadSceneAsset(guid, loader)));
  }

  // ============================================================================
  // Scene Despawning
  // ============================================================================

  /**
   * Despawn a scene instance by instance ID
   *
   * Finds the scene root entity and destroys it recursively.
   *
   * @param instanceId - Scene instance ID (from SceneRoot.instanceId)
   * @param commands - Command instance
   */
  despawnSceneByInstanceId(instanceId: string, commands: Command): void {
    // Find scene root entity with matching instanceId
    let sceneRootEntityId: number | null = null;

    commands.query().all(SceneRoot).each((entity, sceneRoot) => {
      if (sceneRoot.instanceId === instanceId) {
        sceneRootEntityId = entity;
      }
    });

    if (sceneRootEntityId === null) {
      throw new Error(`Scene instance ${instanceId} not found`);
    }

    this.despawnSceneByRootEntity(sceneRootEntityId, commands);
  }

  /**
   * Despawn a scene instance by its root entity ID
   *
   * Destroys the virtual container entity and all scene entities.
   *
   * @param sceneRootEntityId - Virtual container entity ID (has SceneRoot component)
   * @param commands - Command instance
   */
  despawnSceneByRootEntity(sceneRootEntityId: number, commands: Command): void {
    // Validate it's a scene root
    const sceneRoot = commands.tryGetComponent(sceneRootEntityId, SceneRoot);
    if (!sceneRoot) {
      throw new Error("Entity is not a scene root");
    }

    // Get all entities in this scene instance
    const sceneEntities: number[] = [];
    commands.query().all(SceneChild).each((entity, sceneChild) => {
      if (sceneChild.sceneRootEntity === sceneRootEntityId) {
        sceneEntities.push(entity);
      }
    });

    // Destroy all scene entities recursively
    // Note: destroyRecursive() handles Parent/Children hierarchy automatically
    for (const entityId of sceneEntities) {
      commands.entity(entityId).destroy();
    }

    // Destroy the virtual container entity
    commands.entity(sceneRootEntityId).destroy();
  }

  // ============================================================================
  // Scene Saving
  // ============================================================================

  /**
   * Save entities as a scene asset
   *
   * @param rootEntities - Root entities of the scene
   * @param world - World instance
   * @param commands - Command instance
   * @param options - Save options (GUID, path, metadata)
   * @returns Scene asset ready to be serialized to JSON
   */
  saveScene(
    rootEntities: number[],
    world: World,
    commands: Command,
    options: SaveSceneOptions
  ): SceneAsset {
    return this.sceneSerializer.saveScene(rootEntities, world, commands, options);
  }

  // ============================================================================
  // Scene Queries
  // ============================================================================

  /**
   * Get scene root entity from any entity in the scene
   *
   * @param entity - Any entity in the scene
   * @param commands - Command instance
   * @returns Scene root entity ID or null if entity is not in a scene
   */
  getSceneRoot(entity: number, commands: Command): number | null {
    const sceneChild = commands.tryGetComponent(entity, SceneChild);
    if (!sceneChild) {
      return null;
    }
    return sceneChild.sceneRootEntity;
  }

  /**
   * Get all entities in a scene instance
   *
   * @param sceneRootEntityId - Virtual container entity ID (has SceneRoot component)
   * @param commands - Command instance
   * @returns Array of all entity IDs in the scene
   */
  getAllEntitiesInScene(
    sceneRootEntityId: number,
    commands: Command
  ): number[] {
    const sceneEntities: number[] = [];

    commands.query().all(SceneChild).each((entity, sceneChild) => {
      if (sceneChild.sceneRootEntity === sceneRootEntityId) {
        sceneEntities.push(entity);
      }
    });

    return sceneEntities;
  }
}

// Add assetMetadataResolver to InstantiateSceneOptions
declare module "./scene-asset" {
  interface InstantiateSceneOptions {
    /** Optional resolver for asset metadata during deserialization */
    assetMetadataResolver?: (guid: string) => any | null;
  }
}
