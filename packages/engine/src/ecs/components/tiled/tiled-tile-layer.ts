/**
 * TiledTileLayer Component
 *
 * Represents a tile layer from a Tiled map. The layer will be rendered
 * using TilemapMaterial and a Three.js mesh.
 *
 * Usage:
 * ```typescript
 * commands.spawn()
 *   .with(Transform3D, { ... })
 *   .with(TiledTileLayer, {
 *     mapEntity: parentMapEntity,
 *     layerData: tiledLayerData,
 *     name: 'Background',
 *     offsetX: 0,
 *     offsetY: 0,
 *     opacity: 1,
 *     visible: true,
 *     parallaxX: 1,
 *     parallaxY: 1,
 *     zOrder: 0,
 *     properties: new Map(),
 *     renderHandle: null,
 *   })
 *   .build();
 * ```
 */

import { component } from '@voidscript/core';
import type { Entity } from '@voidscript/core';
import type * as tiled from '@kayahr/tiled';

/**
 * TiledTileLayer component data
 */
export interface TiledTileLayerData {
  /** Reference to parent TiledMap entity */
  mapEntity: Entity;

  /** The Tiled tile layer data */
  layerData: tiled.TileLayer;

  /** Layer name from Tiled */
  name: string;

  /** Layer offset in tiles (X) */
  offsetX: number;

  /** Layer offset in tiles (Y) */
  offsetY: number;

  /** Layer opacity (0-1) */
  opacity: number;

  /** Layer visibility */
  visible: boolean;

  /** Parallax factor X (for scrolling layers) */
  parallaxX: number;

  /** Parallax factor Y (for scrolling layers) */
  parallaxY: number;

  /** Z-order for rendering (higher = rendered later/on top) */
  zOrder: number;

  /** Custom properties from Tiled */
  properties: Map<string, any>;

  /** Handle to the Three.js mesh (managed by TilemapRenderManager) */
  renderHandle: number | null;

  /** Whether this layer responds to scene lighting (default: false) */
  isLit?: boolean;
}

export const TiledTileLayer = component<TiledTileLayerData>(
  'TiledTileLayer',
  {
    mapEntity: {
      serializable: true,
    },
    layerData: {
      serializable: false, // Too complex to serialize
    },
    name: {
      serializable: true,
    },
    offsetX: {
      serializable: true,
    },
    offsetY: {
      serializable: true,
    },
    opacity: {
      serializable: true,
    },
    visible: {
      serializable: true,
    },
    parallaxX: {
      serializable: true,
    },
    parallaxY: {
      serializable: true,
    },
    zOrder: {
      serializable: true,
    },
    properties: {
      serializable: true,
    },
    renderHandle: {
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
      mapEntity: 0 as Entity,
      layerData: null as any,
      name: '',
      offsetX: 0,
      offsetY: 0,
      opacity: 1,
      visible: true,
      parallaxX: 1,
      parallaxY: 1,
      zOrder: 0,
      properties: new Map(),
      renderHandle: null,
      isLit: false,
    }),
    displayName: 'Tiled Tile Layer',
    description: 'Tile layer from a Tiled map, rendered with TilemapMaterial',
  }
);
