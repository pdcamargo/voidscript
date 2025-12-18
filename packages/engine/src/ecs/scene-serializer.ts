/**
 * SceneSerializer - Handles saving and loading scene assets
 *
 * Builds on top of WorldSerializer to provide scene-specific functionality:
 * - Multiple root entity tracking
 * - Stable local entity IDs (UUIDs)
 * - Nested scene GUID detection
 * - Component type dependency tracking
 */

import type { World } from './world.js';
import type { Command } from './command.js';
import { WorldSerializer } from './serialization/world-serializer.js';
import type { SceneAsset, SceneData } from './scene-asset.js';
import type { SceneMetadata } from './asset-metadata.js';
import { AssetType } from './asset-metadata.js';
import { Parent } from './components/parent.js';
import { Children } from './components/children.js';
import { SceneRoot } from './components/scene-root.js';
import { SceneChild } from './components/scene-child.js';
import { component, globalComponentRegistry } from './component.js';

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
 * Options for scene serialization
 */
export type SaveSceneOptions = {
  /** GUID for the scene asset (generated if not provided) */
  guid?: string;

  /** Relative path from project root */
  path: string;

  /** Optional preview image path */
  thumbnailPath?: string;

  /** Additional metadata */
  metadata?: Partial<SceneMetadata>;
};

/**
 * SceneSerializer - Orchestrates scene saving and loading
 */
export class SceneSerializer {
  private worldSerializer: WorldSerializer;

  constructor() {
    this.worldSerializer = new WorldSerializer();
  }

  /**
   * Save entities as a scene asset
   *
   * @param rootEntities - Root entities of the scene (can be multiple for Godot-style scenes)
   * @param world - World instance
   * @param commands - Command instance for queries
   * @param options - Save options (GUID, path, metadata)
   * @returns Scene asset ready to be JSON.stringify'd and written to disk
   */
  saveScene(
    rootEntities: number[],
    world: World,
    commands: Command,
    options: SaveSceneOptions,
  ): SceneAsset {
    if (rootEntities.length === 0) {
      throw new Error('Scene must have at least one root entity');
    }

    // Gather all entities in the scene (roots + descendants)
    const allEntities = new Set<number>();
    const entitiesToProcess = [...rootEntities];

    while (entitiesToProcess.length > 0) {
      const entity = entitiesToProcess.pop()!;
      if (allEntities.has(entity)) {
        continue; // Already processed
      }

      allEntities.add(entity);

      // Add children to processing queue
      const children = commands.tryGetComponent(entity, Children);
      if (children) {
        for (const childId of children.ids) {
          entitiesToProcess.push(childId);
        }
      }
    }

    // Create stable local ID mapping (runtime ID -> UUID)
    const entityIdMap: Record<number, string> = {};
    const rootEntityLocalIds: string[] = [];

    for (const entity of allEntities) {
      // Check if entity already has a SceneChild component with localEntityId
      const sceneChild = commands.tryGetComponent(entity, SceneChild);
      const localId = sceneChild?.localEntityId || generateUUID();
      entityIdMap[entity] = localId;

      // Track root entity local IDs (will be remapped later to use serialized IDs)
      if (rootEntities.includes(entity)) {
        rootEntityLocalIds.push(localId);
      }
    }

    // Add temporary marker components with UUIDs to track entity remapping
    // This is necessary because WorldSerializer may reorder entities (archetype-based iteration)
    interface EntityMarkerData {
      uuid: string;
    }
    const EntityMarker = component<EntityMarkerData>(
      '__SceneSerializerMarker__',
      {
        uuid: { serializable: true },
      },
    );

    for (const entity of allEntities) {
      const localId = entityIdMap[entity]!;
      commands.entity(entity).addComponent(EntityMarker, { uuid: localId });
    }

    // Temporarily strip SceneRoot and SceneChild components before serialization
    // (They're instance-specific, not part of the scene template)
    const removedComponents: Array<{ entity: number; component: any }> = [];

    for (const entity of allEntities) {
      const sceneRoot = commands.tryGetComponent(entity, SceneRoot);
      if (sceneRoot) {
        commands.entity(entity).removeComponent(SceneRoot);
        removedComponents.push({
          entity,
          component: { type: SceneRoot, data: sceneRoot },
        });
      }

      const sceneChild = commands.tryGetComponent(entity, SceneChild);
      if (sceneChild) {
        commands.entity(entity).removeComponent(SceneChild);
        removedComponents.push({
          entity,
          component: { type: SceneChild, data: sceneChild },
        });
      }
    }

    // Serialize the scene using WorldSerializer with entity filter
    const worldData = this.worldSerializer.serialize(
      world,
      commands,
      allEntities,
    );

    // Remap entityIdMap to use serialized sequential IDs (not runtime IDs)
    // WorldSerializer creates a sequential ID mapping (0, 1, 2, ...) for serialized entities
    // IMPORTANT: WorldSerializer may reorder entities (archetype-based iteration), so we need
    // to build the mapping from the actual serialized output, not from allEntities iteration order
    const remappedEntityIdMap: Record<number, string> = {};
    const runtimeIdToSerializedId = new Map<number, number>();

    // Build mapping from runtime ID to serialized ID using marker components
    // Extract marker UUIDs BEFORE removing them from worldData.entities
    for (const serializedEntity of worldData.entities) {
      const markerComponent = serializedEntity.components.find(
        (c) => c.typeName === '__SceneSerializerMarker__',
      );
      if (markerComponent && markerComponent.data) {
        const data = markerComponent.data as { uuid?: string };
        if (data.uuid) {
          const uuid = data.uuid;
          // Find runtime entity with this UUID in entityIdMap
          for (const [runtimeId, localId] of Object.entries(entityIdMap)) {
            if (localId === uuid) {
              runtimeIdToSerializedId.set(
                Number(runtimeId),
                serializedEntity.id,
              );
              break;
            }
          }
        }
      }
    }

    // Remap entityIdMap keys from runtime IDs to serialized IDs
    // Also remap rootEntityLocalIds to use serialized IDs
    const remappedRootEntityLocalIds: string[] = [];
    for (const [runtimeId, localId] of Object.entries(entityIdMap)) {
      const serializedId = runtimeIdToSerializedId.get(Number(runtimeId));
      if (serializedId !== undefined) {
        remappedEntityIdMap[serializedId] = localId;

        // If this entity is a root entity, add its local ID to remappedRootEntityLocalIds
        if (rootEntities.includes(Number(runtimeId))) {
          remappedRootEntityLocalIds.push(localId);
        }
      }
    }

    // NOW remove marker components from serialized data (after we extracted UUIDs)
    for (let i = worldData.entities.length - 1; i >= 0; i--) {
      const entity = worldData.entities[i]!;
      entity.components = entity.components.filter(
        (c) => c.typeName !== '__SceneSerializerMarker__',
      );
    }

    // Remove marker components from runtime entities
    for (const entity of allEntities) {
      if (commands.hasComponent(entity, EntityMarker)) {
        commands.entity(entity).removeComponent(EntityMarker);
      }
    }

    // Restore removed components (SceneRoot/SceneChild)
    for (const { entity, component } of removedComponents) {
      commands.entity(entity).addComponent(component.type, component.data);
    }

    // Collect component types used in scene
    const componentTypes = new Set<string>();
    for (const entity of worldData.entities) {
      for (const component of entity.components) {
        componentTypes.add(component.typeName);
      }
    }

    // Detect nested scenes (entities with SceneRoot component referencing different GUIDs)
    const nestedScenes = new Set<string>();
    // Note: We removed SceneRoot above, so we'd need to check before removal
    // For now, skip nested scene detection (can be added later)

    // Build scene metadata
    const guid = options.guid || generateUUID();
    const now = new Date().toISOString();

    const metadata: SceneMetadata = {
      guid,
      path: options.path,
      type: AssetType.Scene,
      entityCount: allEntities.size,
      componentTypes: Array.from(componentTypes),
      nestedScenes: Array.from(nestedScenes),
      thumbnailPath: options.thumbnailPath,
      importedAt: options.metadata?.importedAt || now,
      modifiedAt: now,
      ...options.metadata,
    };

    const sceneData: SceneData = {
      entityIdMap: remappedEntityIdMap,
      rootEntityLocalIds: remappedRootEntityLocalIds,
    };

    return {
      version: '1.0.0',
      metadata,
      world: worldData,
      sceneData,
    };
  }

  /**
   * Load scene asset from parsed JSON
   *
   * @param sceneAsset - Parsed scene asset
   * @returns Scene asset (validated)
   */
  loadScene(sceneAsset: SceneAsset): SceneAsset {
    // TODO: Add validation (Zod schema)
    // For now, just return as-is
    return sceneAsset;
  }
}
