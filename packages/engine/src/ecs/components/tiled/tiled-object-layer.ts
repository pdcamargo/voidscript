/**
 * TiledObjectLayer Component
 *
 * Represents an object layer (object group) from a Tiled map. Objects in this
 * layer will be spawned as individual entities with Transform3D and optionally
 * Sprite2D components.
 *
 * Usage:
 * ```typescript
 * commands.spawn()
 *   .with(TiledObjectLayer, {
 *     mapEntity: parentMapEntity,
 *     layerData: objectGroupData,
 *     name: 'Objects',
 *     objectEntities: new Set(),
 *     opacity: 1,
 *     visible: true,
 *     zOrder: 0,
 *     properties: new Map(),
 *   })
 *   .build();
 * ```
 */

import { component } from '@voidscript/core';
import type { Entity } from '@voidscript/core';
import type * as tiled from '@kayahr/tiled';

/**
 * TiledObjectLayer component data
 */
export interface TiledObjectLayerData {
  /** Reference to parent TiledMap entity */
  mapEntity: Entity;

  /** The Tiled object group data */
  layerData: tiled.ObjectGroup;

  /** Layer name from Tiled */
  name: string;

  /** Set of spawned object entities */
  objectEntities: Set<Entity>;

  /** Layer opacity (0-1) */
  opacity: number;

  /** Layer visibility */
  visible: boolean;

  /** Z-order for spawned objects */
  zOrder: number;

  /** Custom properties from Tiled */
  properties: Map<string, any>;
}

export const TiledObjectLayer = component<TiledObjectLayerData>(
  'TiledObjectLayer',
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
    objectEntities: {
      serializable: false, // Entities managed separately
    },
    opacity: {
      serializable: true,
    },
    visible: {
      serializable: true,
    },
    zOrder: {
      serializable: true,
    },
    properties: {
      serializable: true,
    },
  },
  {
    path: 'tiled',
    defaultValue: () => ({
      mapEntity: 0 as Entity,
      layerData: null as any,
      name: '',
      objectEntities: new Set(),
      opacity: 1,
      visible: true,
      zOrder: 0,
      properties: new Map(),
    }),
    displayName: 'Tiled Object Layer',
    description: 'Object layer from a Tiled map, spawns entities for each object',
  }
);
