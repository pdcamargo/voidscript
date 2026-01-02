/**
 * Tiled Loader
 *
 * High-level API for loading and working with Tiled maps.
 *
 * Provides convenient helper functions:
 * - loadTiledMap() - Load a map from a file path
 * - getLayerByName() - Find a layer by name
 * - getObjectsByType() - Find objects by type
 * - getTileLayers() - Get all tile layers from a map
 */

import type { Command } from '@voidscript/core';
import type { Entity } from '@voidscript/core';
import type { EntityHandle } from '@voidscript/core';
import type { RuntimeAsset } from '@voidscript/core';
import { TiledMap, type ObjectSpawnerFactory } from '../ecs/components/tiled/tiled-map.js';
import { TiledTileLayer } from '../ecs/components/tiled/tiled-tile-layer.js';
import { TiledObjectLayer } from '../ecs/components/tiled/tiled-object-layer.js';
import { TiledObject } from '../ecs/components/tiled/tiled-object.js';
import { Transform3D } from '../ecs/components/rendering/transform-3d.js';
import { TiledAssetRegistry } from './tiled-asset-registry.js';
import { parseProperties } from './tiled-utils.js';
import { Vector3 } from '../math/vector3.js';

/**
 * Options for loading a Tiled map
 */
export interface LoadTiledMapOptions {
  /** Pixels per unit for world-space sizing (default: map's tilewidth) */
  pixelsPerUnit?: number;

  /** World-space offset for the entire map (default: { x: 0, y: 0, z: 0 }) */
  worldOffset?: { x: number; y: number; z: number };

  /** Whether to automatically spawn layers (default: true) */
  autoSpawnLayers?: boolean;

  /** Optional factory for custom object spawning */
  objectSpawnerFactory?: ObjectSpawnerFactory;

  /** Optional RuntimeAsset reference (for asset-based workflow) */
  mapAsset?: RuntimeAsset<any> | null;
}

/**
 * Load a Tiled map from a file path
 *
 * @param commands - Command API
 * @param mapPath - Path to the map JSON file
 * @param options - Load options
 * @returns Entity handle for the map
 *
 * @example
 * ```typescript
 * const mapEntity = await loadTiledMap(commands, '/assets/maps/level1.json', {
 *   pixelsPerUnit: 16,
 *   worldOffset: { x: 0, y: 0, z: 0 },
 * });
 * ```
 */
export async function loadTiledMap(
  commands: Command,
  mapPath: string,
  options?: LoadTiledMapOptions
): Promise<EntityHandle> {
  const registry = commands.getResource(TiledAssetRegistry);

  // Load map data
  const mapData = await registry.loadMap(mapPath);

  // Parse options
  const worldOffset = options?.worldOffset ?? { x: 0, y: 0, z: 0 };
  const autoSpawnLayers = options?.autoSpawnLayers ?? true;

  // Create map entity
  const entity = commands
    .spawn()
    .with(Transform3D, {
      position: new Vector3(worldOffset.x, worldOffset.y, worldOffset.z),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
    })
    .with(TiledMap, {
      mapData,
      mapAsset: options?.mapAsset ?? null,
      sourcePath: mapPath,
      layerEntities: new Set<Entity>(),
      tilesetMapping: new Map(),
      properties: parseProperties(mapData.properties),
      worldOffset,
      autoSpawnLayers,
      objectSpawnerFactory: options?.objectSpawnerFactory,
    })
    .build();

  return entity;
}

/**
 * Get a layer by name from a map
 *
 * @param mapEntity - Map entity ID
 * @param layerName - Layer name from Tiled
 * @param commands - Command API
 * @returns Layer entity or null if not found
 *
 * @example
 * ```typescript
 * const backgroundLayer = getLayerByName(mapEntity.id(), 'Background', commands);
 * if (backgroundLayer) {
 *   const tileLayer = commands.getComponent(backgroundLayer, TiledTileLayer);
 *   tileLayer.visible = false; // Hide layer
 * }
 * ```
 */
export function getLayerByName(
  mapEntity: Entity,
  layerName: string,
  commands: Command
): Entity | null {
  const tiledMap = commands.tryGetComponent(mapEntity, TiledMap);
  if (!tiledMap) return null;

  for (const layerEntity of tiledMap.layerEntities) {
    // Check tile layer
    const tileLayer = commands.tryGetComponent(layerEntity, TiledTileLayer);
    if (tileLayer && tileLayer.name === layerName) {
      return layerEntity;
    }

    // Check object layer
    const objLayer = commands.tryGetComponent(layerEntity, TiledObjectLayer);
    if (objLayer && objLayer.name === layerName) {
      return layerEntity;
    }
  }

  return null;
}

/**
 * Get all objects of a specific type from a map
 *
 * @param mapEntity - Map entity ID
 * @param type - Object type from Tiled
 * @param commands - Command API
 * @returns Array of object entities
 *
 * @example
 * ```typescript
 * const enemySpawns = getObjectsByType(mapEntity.id(), 'Enemy', commands);
 * for (const enemyEntity of enemySpawns) {
 *   const tiledObj = commands.getComponent(enemyEntity, TiledObject);
 *   console.log('Enemy at:', tiledObj.objectData.x, tiledObj.objectData.y);
 * }
 * ```
 */
export function getObjectsByType(
  mapEntity: Entity,
  type: string,
  commands: Command
): Entity[] {
  const tiledMap = commands.tryGetComponent(mapEntity, TiledMap);
  if (!tiledMap) return [];

  const objects: Entity[] = [];

  for (const layerEntity of tiledMap.layerEntities) {
    const objLayer = commands.tryGetComponent(layerEntity, TiledObjectLayer);
    if (objLayer) {
      for (const objEntity of objLayer.objectEntities) {
        const tiledObj = commands.tryGetComponent(objEntity, TiledObject);
        if (tiledObj && tiledObj.type === type) {
          objects.push(objEntity);
        }
      }
    }
  }

  return objects;
}

/**
 * Get all tile layers from a map
 *
 * @param mapEntity - Map entity ID
 * @param commands - Command API
 * @returns Array of tile layer entities
 *
 * @example
 * ```typescript
 * const tileLayers = getTileLayers(mapEntity.id(), commands);
 * for (const layerEntity of tileLayers) {
 *   const tileLayer = commands.getComponent(layerEntity, TiledTileLayer);
 *   console.log('Layer:', tileLayer.name);
 * }
 * ```
 */
export function getTileLayers(mapEntity: Entity, commands: Command): Entity[] {
  const tiledMap = commands.tryGetComponent(mapEntity, TiledMap);
  if (!tiledMap) return [];

  const layers: Entity[] = [];

  for (const layerEntity of tiledMap.layerEntities) {
    if (commands.hasComponent(layerEntity, TiledTileLayer)) {
      layers.push(layerEntity);
    }
  }

  return layers;
}

/**
 * Get all object layers from a map
 *
 * @param mapEntity - Map entity ID
 * @param commands - Command API
 * @returns Array of object layer entities
 *
 * @example
 * ```typescript
 * const objectLayers = getObjectLayers(mapEntity.id(), commands);
 * ```
 */
export function getObjectLayers(mapEntity: Entity, commands: Command): Entity[] {
  const tiledMap = commands.tryGetComponent(mapEntity, TiledMap);
  if (!tiledMap) return [];

  const layers: Entity[] = [];

  for (const layerEntity of tiledMap.layerEntities) {
    if (commands.hasComponent(layerEntity, TiledObjectLayer)) {
      layers.push(layerEntity);
    }
  }

  return layers;
}
