/**
 * PrefabSerializer - Handles saving and loading prefab assets
 *
 * Builds on top of SceneSerializer to provide prefab-specific functionality:
 * - Single root entity tracking
 * - Stable local entity IDs (UUIDs)
 * - Nested prefab GUID detection
 * - Component type dependency tracking
 */

import type { Scene } from '../ecs/scene.js';
import type { Command } from '../ecs/command.js';
import type { PrefabAsset, PrefabData, SavePrefabOptions, PrefabMetadata } from './prefab-asset.js';
import { SceneSerializer } from '../serialization/scene-serializer.js';
import { Children } from '../ecs/components/children.js';
import { PrefabInstance } from '../ecs/components/prefab-instance.js';
import { component } from '../ecs/component.js';
import { jsonToYaml, yamlToJson } from '../serialization/yaml-utils.js';

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
 * PrefabSerializer - Orchestrates prefab saving and loading
 */
export class PrefabSerializer {
  private worldSerializer: SceneSerializer;

  constructor() {
    this.worldSerializer = new SceneSerializer();
  }

  /**
   * Save an entity hierarchy as a prefab asset
   *
   * @param rootEntity - The root entity of the prefab (single root only)
   * @param world - Scene instance
   * @param commands - Command instance for queries
   * @param options - Save options (GUID, path, metadata)
   * @returns PrefabAsset ready to be serialized to YAML
   */
  savePrefab(
    rootEntity: number,
    world: Scene,
    commands: Command,
    options: SavePrefabOptions,
  ): PrefabAsset {
    // Gather all entities (root + descendants)
    const allEntities = new Set<number>();
    const entitiesToProcess = [rootEntity];

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

    for (const entity of allEntities) {
      entityIdMap[entity] = generateUUID();
    }

    // Add temporary marker components with UUIDs to track entity remapping
    // This is necessary because SceneSerializer may reorder entities (archetype-based iteration)
    interface EntityMarkerData {
      uuid: string;
    }
    const EntityMarker = component<EntityMarkerData>(
      '__PrefabSerializerMarker__',
      {
        uuid: { serializable: true },
      },
    );

    for (const entity of allEntities) {
      const localId = entityIdMap[entity]!;
      commands.entity(entity).addComponent(EntityMarker, { uuid: localId });
    }

    // Temporarily strip PrefabInstance before serialization
    // (It's instance-specific, not part of the prefab template)
    const removedPrefabInstances: Array<{ entity: number; data: any }> = [];

    for (const entity of allEntities) {
      const prefabInstance = commands.tryGetComponent(entity, PrefabInstance);
      if (prefabInstance) {
        commands.entity(entity).removeComponent(PrefabInstance);
        removedPrefabInstances.push({
          entity,
          data: prefabInstance,
        });
      }
    }

    // Serialize the prefab using SceneSerializer with entity filter
    const worldData = this.worldSerializer.serialize(world, commands, allEntities);

    // Remap entityIdMap to use serialized sequential IDs (not runtime IDs)
    // SceneSerializer creates a sequential ID mapping (0, 1, 2, ...) for serialized entities
    // IMPORTANT: SceneSerializer may reorder entities (archetype-based iteration), so we need
    // to build the mapping from the actual serialized output, not from allEntities iteration order
    const remappedEntityIdMap: Record<number, string> = {};
    let rootSerializedId: number | undefined;

    // Build mapping from runtime ID to serialized ID using marker components
    for (const serializedEntity of worldData.entities) {
      const markerComponent = serializedEntity.components.find(
        (c) => c.typeName === '__PrefabSerializerMarker__',
      );
      if (markerComponent && markerComponent.data) {
        const data = markerComponent.data as { uuid?: string };
        if (data.uuid) {
          const uuid = data.uuid;
          remappedEntityIdMap[serializedEntity.id] = uuid;

          // Check if this is the root entity
          if (uuid === entityIdMap[rootEntity]) {
            rootSerializedId = serializedEntity.id;
          }
        }
      }
    }

    // Remove marker components from serialized data
    for (const entity of worldData.entities) {
      entity.components = entity.components.filter(
        (c) => c.typeName !== '__PrefabSerializerMarker__',
      );
    }

    // Remove marker components from runtime entities
    for (const entity of allEntities) {
      if (commands.hasComponent(entity, EntityMarker)) {
        commands.entity(entity).removeComponent(EntityMarker);
      }
    }

    // Restore removed PrefabInstance components
    for (const { entity, data } of removedPrefabInstances) {
      commands.entity(entity).addComponent(PrefabInstance, data);
    }

    // Collect component types used in prefab
    const componentTypes = new Set<string>();
    for (const entity of worldData.entities) {
      for (const component of entity.components) {
        componentTypes.add(component.typeName);
      }
    }

    // Detect nested prefabs (entities that were PrefabInstances)
    const nestedPrefabs = new Set<string>();
    for (const { data } of removedPrefabInstances) {
      if (data.prefabAssetGuid) {
        nestedPrefabs.add(data.prefabAssetGuid);
      }
    }

    // Build prefab metadata
    const guid = options.guid || generateUUID();
    const now = new Date().toISOString();

    const metadata: PrefabMetadata = {
      guid,
      path: options.path,
      type: 'prefab',
      entityCount: allEntities.size,
      componentTypes: Array.from(componentTypes),
      nestedPrefabs: Array.from(nestedPrefabs),
    };

    const prefabData: PrefabData = {
      entityIdMap: remappedEntityIdMap,
      rootEntityId: remappedEntityIdMap[rootSerializedId!]!,
    };

    return {
      version: '1.0.0',
      metadata,
      scene: worldData,
      prefabData,
    };
  }

  /**
   * Load/validate prefab asset from parsed data
   *
   * @param prefabAsset - Parsed prefab asset
   * @returns PrefabAsset (validated)
   */
  loadPrefab(prefabAsset: PrefabAsset): PrefabAsset {
    // TODO: Add Zod validation for robust error handling
    // For now, just return as-is
    return prefabAsset;
  }

  /**
   * Serialize prefab to YAML string
   */
  toYaml(prefab: PrefabAsset): string {
    return jsonToYaml(JSON.stringify(prefab));
  }

  /**
   * Parse YAML string to PrefabAsset
   */
  fromYaml(yaml: string): PrefabAsset {
    const json = yamlToJson(yaml);
    return JSON.parse(json) as PrefabAsset;
  }
}
