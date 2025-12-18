/**
 * Tiled Tileset Collision System
 *
 * Startup system that spawns static 2D colliders from tiles with collision shapes
 * defined in Tiled tilesets (using Tiled's built-in collision editor).
 *
 * Responsibilities:
 * - Extract collision shapes from tileset tile definitions (tile.objectgroup)
 * - Merge adjacent tiles with identical collision shapes for performance
 * - Spawn static RigidBody2D + Collider2D entities
 * - Track processed layers to avoid re-processing
 *
 * Performance Optimization:
 * - Adjacent tiles with identical cuboid shapes are merged into larger colliders
 * - Circle/capsule shapes are not merged (spawned individually)
 *
 * Runs in the startup phase after tiledMapLoaderSystem.
 */

import { system } from '../../ecs/system.js';
import type { Entity } from '../../ecs/entity.js';
import type { Command } from '../../ecs/command.js';
import { TiledMap, type TiledMapData } from '../../ecs/components/tiled/tiled-map.js';
import { TiledTileLayer, type TiledTileLayerData } from '../../ecs/components/tiled/tiled-tile-layer.js';
import { TiledCollider } from '../../ecs/components/tiled/tiled-collider.js';
import { Transform3D } from '../../ecs/components/rendering/transform-3d.js';
import { LocalTransform3D } from '../../ecs/components/rendering/local-transform-3d.js';
import { Parent } from '../../ecs/components/parent.js';
import { Children } from '../../ecs/components/children.js';
import { Name } from '../../ecs/components/name.js';
import { RigidBody2D } from '../../physics/2d/components/rigidbody-2d.js';
import { Collider2D } from '../../physics/2d/components/collider-2d.js';
import { extractTileCollisions, mergeAdjacentCuboids } from '../tiled-collision-merger.js';
import { Vector3 } from '../../math/vector3.js';
import { Vector2 } from 'three';
import { tiledMapLoaderSystem } from './tiled-map-loader-system.js';

/**
 * Track which tile layers have already been processed for collisions
 * Key: Entity ID of TiledTileLayer
 */
const processedLayers = new Set<Entity>();

/**
 * Tiled Tileset Collision System
 *
 * Spawns static colliders from tiles with collision shapes defined in tilesets.
 */
export const tiledTilesetCollisionSystem = system(({ commands }) => {
  // Query for TiledTileLayer components
  commands
    .query()
    .all(TiledTileLayer)
    .each((entity, tileLayer) => {
      // Skip if already processed
      if (processedLayers.has(entity)) {
        return;
      }

      // Skip if layer is not visible
      if (!tileLayer.visible) {
        processedLayers.add(entity);
        return;
      }

      // Get parent map
      const tiledMap = commands.getComponent(tileLayer.mapEntity, TiledMap);
      if (!tiledMap) {
        console.error(
          `[tiledTilesetCollisionSystem] TiledTileLayer entity ${entity} has invalid mapEntity`
        );
        processedLayers.add(entity);
        return;
      }

      // Check if layer has collision disabled via custom property
      if (tileLayer.properties.get('spawnCollisions') === false) {
        processedLayers.add(entity);
        return;
      }

      try {
        // Extract tile collisions from this layer
        const tileCollisions = extractTileCollisions(tileLayer.layerData, tiledMap);

        if (tileCollisions.length === 0) {
          processedLayers.add(entity);
          return;
        }

        // Merge adjacent cuboids for performance
        // Colliders are children of layer, so use 0 offset (layer position added by transform propagation)
        const map = tiledMap.mapData;
        const mergedColliders = mergeAdjacentCuboids(
          tileCollisions,
          map.tilewidth,
          map.tileheight,
          0,  // worldOffsetX: colliders are relative to layer parent
          0,  // worldOffsetY: colliders are relative to layer parent
          tileLayer.layerData.width,
          tileLayer.layerData.height
        );

        // Spawn collider entities
        for (const merged of mergedColliders) {
          spawnTileColliderEntity(merged, entity, tileLayer.mapEntity, commands);
        }

        // Mark as processed
        processedLayers.add(entity);

        if (mergedColliders.length > 0) {
          console.log(
            `[tiledTilesetCollisionSystem] Spawned ${mergedColliders.length} collider(s) for layer "${tileLayer.name}" ` +
              `(merged from ${tileCollisions.length} tile collision(s))`
          );
        }
      } catch (error) {
        console.error(
          `[tiledTilesetCollisionSystem] Failed to process layer "${tileLayer.name}":`,
          error
        );
        processedLayers.add(entity);
      }
    });
}).runAfter(tiledMapLoaderSystem);

/**
 * Spawn a collider entity from a merged collider
 */
function spawnTileColliderEntity(
  merged: {
    x: number;
    y: number;
    width: number;
    height: number;
    shape: any;
    sourceTiles: number[];
    friction: number;
    restitution: number;
    density: number;
    isSensor: boolean;
  },
  layerEntity: Entity,
  mapEntity: Entity,
  commands: Command
): void {
  // Generate descriptive name for the collider
  const tileGids = merged.sourceTiles.slice(0, 3).join(',');
  const colliderName =
    merged.sourceTiles.length > 1
      ? `Collider (${merged.width}x${merged.height} tiles: ${tileGids}${merged.sourceTiles.length > 3 ? '...' : ''})`
      : `Collider (tile ${merged.sourceTiles[0]})`;

  const colliderEntity = commands
    .spawn()
    .with(Name, { name: colliderName })
    .with(LocalTransform3D, {
      position: new Vector3(merged.x, merged.y, 0),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
    })
    .with(Transform3D, {
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
    })
    .with(RigidBody2D, {
      bodyType: 'static' as const,
      canSleep: true,
    })
    .with(Collider2D, {
      shape: merged.shape,
      offset: new Vector2(0, 0), // Position already includes offset
      rotationOffset: 0,
      isSensor: merged.isSensor,
      friction: merged.friction,
      restitution: merged.restitution,
      density: merged.density,
    })
    .with(TiledCollider, {
      mapEntity,
      layerEntity,
      sourceType: 'tileset',
      sourceTiles: merged.sourceTiles,
    })
    .build();

  // Register as child of layer (addChild will add Parent and Children components)
  commands.entity(layerEntity).addChild(colliderEntity.id());
}
