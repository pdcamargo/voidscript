/**
 * TiledCollider Component
 *
 * Marker component for collision entities spawned from Tiled tilemaps.
 * Tracks the source of the collision (tileset or object layer) and parent entities.
 *
 * This component is automatically added to all collider entities spawned by the
 * Tiled collision systems, allowing for easy identification and debugging of
 * tilemap-based collisions.
 *
 * Usage:
 * ```typescript
 * commands.spawn()
 *   .with(Transform3D, { ... })
 *   .with(RigidBody2D, { bodyType: 'static' })
 *   .with(Collider2D, { ... })
 *   .with(TiledCollider, {
 *     mapEntity: tiledMapEntity,
 *     layerEntity: tileLayerEntity,
 *     sourceType: 'tileset',
 *     sourceTiles: [42, 43, 44],
 *   })
 *   .build();
 * ```
 */

import { component } from '../../component.js';
import type { Entity } from '../../entity.js';

/**
 * TiledCollider component data
 */
export interface TiledColliderData {
  /** Reference to parent TiledMap entity */
  mapEntity: Entity;

  /** Reference to parent layer entity (TiledTileLayer or TiledObjectLayer), null for merged colliders */
  layerEntity: Entity | null;

  /** Source type of the collision data */
  sourceType: 'tileset' | 'objectlayer';

  /** Original tile GIDs if this collider was merged from multiple tiles (tileset source only) */
  sourceTiles?: number[];
}

export const TiledCollider = component<TiledColliderData>(
  'TiledCollider',
  {
    mapEntity: {
      serializable: true,
    },
    layerEntity: {
      serializable: true,
      whenNullish: 'keep',
    },
    sourceType: {
      serializable: true,
    },
    sourceTiles: {
      serializable: true,
      whenNullish: 'keep',
    },
  },
  {
    path: 'tiled',
    defaultValue: () => ({
      mapEntity: 0 as Entity,
      layerEntity: null,
      sourceType: 'tileset' as 'tileset' | 'objectlayer',
      sourceTiles: undefined,
    }),
    displayName: 'Tiled Collider',
    description: 'Marker for collision entities spawned from Tiled tilemaps',
  }
);
