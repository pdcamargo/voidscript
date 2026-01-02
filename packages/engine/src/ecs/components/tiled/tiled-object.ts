/**
 * TiledObject Component
 *
 * Represents an individual object spawned from a Tiled object layer.
 * Contains references to the parent layer and map, as well as the object's
 * properties and metadata.
 *
 * Usage:
 * ```typescript
 * commands.spawn()
 *   .with(Transform3D, { ... })
 *   .with(TiledObject, {
 *     layerEntity: parentLayerEntity,
 *     mapEntity: parentMapEntity,
 *     objectData: tiledObjectData,
 *     name: 'Player Spawn',
 *     type: 'PlayerSpawn',
 *     id: 1,
 *     properties: new Map([['startWeapon', 'sword']]),
 *     gid: null,
 *   })
 *   .build();
 * ```
 */

import { component } from '@voidscript/core';
import type { Entity } from '@voidscript/core';
import type * as tiled from '@kayahr/tiled';

/**
 * TiledObject component data
 */
export interface TiledObjectData {
  /** Reference to parent TiledObjectLayer entity */
  layerEntity: Entity;

  /** Reference to parent TiledMap entity */
  mapEntity: Entity;

  /** The Tiled object data */
  objectData: tiled.MapObject;

  /** Object name from Tiled */
  name: string;

  /** Object type from Tiled */
  type: string;

  /** Object ID from Tiled */
  id: number;

  /** Custom properties from Tiled */
  properties: Map<string, any>;

  /** GID if this is a tile object (for sprites), null otherwise */
  gid: number | null;
}

export const TiledObject = component<TiledObjectData>(
  'TiledObject',
  {
    layerEntity: {
      serializable: true,
    },
    mapEntity: {
      serializable: true,
    },
    objectData: {
      serializable: false, // Too complex to serialize
    },
    name: {
      serializable: true,
    },
    type: {
      serializable: true,
    },
    id: {
      serializable: true,
    },
    properties: {
      serializable: true,
    },
    gid: {
      serializable: true,
      whenNullish: 'keep',
    },
  },
  {
    path: 'tiled',
    defaultValue: () => ({
      layerEntity: 0 as Entity,
      mapEntity: 0 as Entity,
      objectData: null as any,
      name: '',
      type: '',
      id: 0,
      properties: new Map(),
      gid: null,
    }),
    displayName: 'Tiled Object',
    description: 'Individual object spawned from a Tiled object layer',
  }
);
