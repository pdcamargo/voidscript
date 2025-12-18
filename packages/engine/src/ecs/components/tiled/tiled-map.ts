/**
 * TiledMap Component
 *
 * Root component for a Tiled map. Stores the map data, tileset information,
 * and tracks all spawned layer entities.
 *
 * Usage:
 * ```typescript
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 0, 0), ... })
 *   .with(TiledMap, {
 *     mapData,
 *     sourcePath: '/assets/maps/level1.json',
 *     layerEntities: new Set(),
 *     tilesetMapping: new Map(),
 *     properties: new Map(),
 *     worldOffset: { x: 0, y: 0, z: 0 },
 *     autoSpawnLayers: true,
 *   })
 *   .build();
 * ```
 */

import { component } from '../../component.js';
import type { Entity } from '../../entity.js';
import type * as tiled from '@kayahr/tiled';
import * as THREE from 'three';
import type { AnimationClip } from '../../../animation/animation-clip.js';
import type { EntityCommandBuilder } from '../../command.js';
import type { Command } from '../../command.js';
import type { RuntimeAsset } from '../../runtime-asset.js';
import { AssetType } from '../../asset-metadata.js';

/**
 * Information about a loaded tileset
 */
export interface TilesetInfo {
  /** First global tile ID (GID) for this tileset */
  firstGid: number;

  /**
   * RuntimeAsset reference to the tileset texture
   * Use .data property to access the Three.js Texture
   */
  texture: RuntimeAsset<THREE.Texture>;

  /** Tileset data from Tiled */
  tilesetData: tiled.Tileset;

  /** Image width in pixels */
  imageWidth: number;

  /** Image height in pixels */
  imageHeight: number;

  /** Tile width in pixels */
  tileWidth: number;

  /** Tile height in pixels */
  tileHeight: number;

  /** Number of columns in the tileset */
  columns: number;

  /** Total number of tiles */
  tileCount: number;

  /** Animations keyed by local tile ID */
  animations: Map<number, TiledAnimation>;
}

/**
 * Animation data for a tile
 */
export interface TiledAnimation {
  /** Pre-generated animation clip */
  clip: AnimationClip;

  /** Frame sequence from Tiled */
  frames: { tileId: number; duration: number }[];
}

/**
 * Factory function for customizing object spawning
 *
 * Called for each object in an object layer, allowing custom components
 * to be added to spawned entities.
 *
 * @param object - The Tiled object data
 * @param builder - Entity builder to add components to
 * @param tiledMap - The parent TiledMap data
 * @param commands - Command API for ECS operations
 */
export type ObjectSpawnerFactory = (
  object: tiled.MapObject,
  builder: EntityCommandBuilder,
  tiledMap: TiledMapData,
  commands: Command
) => void;

/**
 * TiledMap component data
 */
export interface TiledMapData {
  /** The loaded Tiled map data */
  mapData: tiled.Map;

  /**
   * Reference to the Tiled map asset (.tmj file)
   * Use this for asset-based workflow (preferred)
   */
  mapAsset: RuntimeAsset<tiled.Map> | null;

  /** Path to the map file (for resolving relative paths, legacy code-based workflow) */
  sourcePath: string;

  /** Set of layer entities spawned from this map */
  layerEntities: Set<Entity>;

  /** Mapping from first GID to tileset information */
  tilesetMapping: Map<number, TilesetInfo>;

  /** Custom properties from Tiled */
  properties: Map<string, any>;

  /** World-space offset for the entire map */
  worldOffset: { x: number; y: number; z: number };

  /** Whether to automatically spawn layers (default: true) */
  autoSpawnLayers: boolean;

  /** Optional factory for custom object spawning */
  objectSpawnerFactory?: ObjectSpawnerFactory;

  /**
   * Whether spawned tile layers respond to scene lighting (default: false).
   * Individual layers can override this via a custom "isLit" boolean property in Tiled.
   */
  isLit?: boolean;
}

export const TiledMap = component<TiledMapData>(
  'TiledMap',
  {
    mapData: {
      serializable: false, // Too complex to serialize
    },
    mapAsset: {
      serializable: true,
      type: 'runtimeAsset',
      assetTypes: [AssetType.TiledMap],
      whenNullish: 'keep',
    },
    sourcePath: {
      serializable: true,
    },
    layerEntities: {
      serializable: false, // Entities managed separately
    },
    tilesetMapping: {
      serializable: false, // Will be regenerated on load
    },
    properties: {
      serializable: true,
    },
    worldOffset: {
      serializable: true,
    },
    autoSpawnLayers: {
      serializable: true,
    },
    objectSpawnerFactory: {
      serializable: false,
      whenNullish: 'keep',
    },
    isLit: {
      serializable: true,
    },
  },
  {
    path: 'tiled',
    defaultValue: () => ({
      mapData: null as any, // Must be provided
      mapAsset: null,
      sourcePath: '',
      layerEntities: new Set(),
      tilesetMapping: new Map(),
      properties: new Map(),
      worldOffset: { x: 0, y: 0, z: 0 },
      autoSpawnLayers: true,
      objectSpawnerFactory: undefined,
      isLit: false,
    }),
    displayName: 'Tiled Map',
    description: 'Root component for a Tiled map with layer tracking and tileset management',
    skipChildrenSerialization: true,
  }
);
