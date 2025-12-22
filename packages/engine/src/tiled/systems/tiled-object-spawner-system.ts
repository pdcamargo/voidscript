/**
 * Tiled Object Spawner System
 *
 * Startup system that spawns entities from Tiled object layers.
 *
 * Responsibilities:
 * - Spawn entities for each object in object layers
 * - Add Transform3D component with converted coordinates
 * - Add TiledObject component with metadata
 * - For tile objects (with GID): add Sprite2D and AnimationController
 * - Call custom ObjectSpawnerFactory if provided
 *
 * Runs in the startup phase (once per object layer).
 */

import { system } from '../../ecs/system.js';
import type { Entity } from '../../ecs/entity.js';
import type { Command } from '../../ecs/command.js';
import * as tiled from '@kayahr/tiled';
import { TiledMap, type TiledMapData } from '../../ecs/components/tiled/tiled-map.js';
import { TiledObjectLayer, type TiledObjectLayerData } from '../../ecs/components/tiled/tiled-object-layer.js';
import { TiledObject } from '../../ecs/components/tiled/tiled-object.js';
import { Transform3D } from '../../ecs/components/rendering/transform-3d.js';
import { LocalTransform3D } from '../../ecs/components/rendering/local-transform-3d.js';
import { Parent } from '../../ecs/components/parent.js';
import { Sprite2D } from '../../ecs/components/rendering/sprite-2d.js';
import { AnimationController } from '../../ecs/components/animation/animation-controller.js';
import { TiledAssetRegistry } from '../tiled-asset-registry.js';
import { RuntimeAsset } from '../../ecs/runtime-asset.js';
import { AssetType } from '../../ecs/asset-metadata.js';
import type { AnimationClip } from '../../animation/animation-clip.js';
import {
  tiledCoordsToWorld,
  extractGidAndFlips,
  parseProperties,
  findTilesetForGid,
} from '../tiled-utils.js';
import { Vector3 } from '../../math/vector3.js';

/**
 * Tiled Object Spawner System
 *
 * Spawns entities from object layers.
 */
export const tiledObjectSpawnerSystem = system(({ commands }) => {
  const registry = commands.getResource(TiledAssetRegistry);

  // Query for TiledObjectLayer components that haven't spawned objects yet
  commands
    .query()
    .all(TiledObjectLayer)
    .each((entity, objectLayer) => {
      // Skip if objects already spawned
      if (objectLayer.objectEntities.size > 0) return;

      // Skip if layer is not visible (user can manually spawn if needed)
      if (!objectLayer.visible) return;

      try {
        // Get parent map
        const tiledMap = commands.getComponent(objectLayer.mapEntity, TiledMap);
        if (!tiledMap) {
          console.error(
            `[tiledObjectSpawnerSystem] TiledObjectLayer entity ${entity} has invalid mapEntity`
          );
          return;
        }

        // Spawn objects
        for (const obj of objectLayer.layerData.objects) {
          spawnTiledObject(
            obj,
            entity,
            objectLayer.mapEntity,
            tiledMap,
            objectLayer,
            commands,
            registry
          );
        }
      } catch (error) {
        console.error(
          `[tiledObjectSpawnerSystem] Failed to spawn objects for layer entity ${entity}:`,
          error
        );
      }
    });
});

/**
 * Spawn an entity from a Tiled object
 */
function spawnTiledObject(
  obj: tiled.MapObject,
  layerEntity: Entity,
  mapEntity: Entity,
  tiledMap: TiledMapData,
  objectLayer: TiledObjectLayerData,
  commands: Command,
  registry: TiledAssetRegistry
): void {
  const builder = commands.spawn();
  const map = tiledMap.mapData;

  // Convert to local coordinates (relative to layer)
  // Simple conversion: pixel position → tile units, flip Y
  const localX = obj.x / map.tilewidth;
  const localY = -obj.y / map.tileheight;

  // Add LocalTransform3D component (position relative to layer)
  builder.with(LocalTransform3D, {
    position: new Vector3(localX, localY, 0),
    rotation: new Vector3(0, 0, -((obj.rotation ?? 0) * Math.PI) / 180), // Convert to radians, flip sign
    scale: new Vector3(
      (obj.width ?? 1) / map.tilewidth,
      (obj.height ?? 1) / map.tileheight,
      1
    ),
  });

  // Add Transform3D component (world position, will be computed by transformPropagationSystem)
  builder.with(Transform3D, {
    position: new Vector3(0, 0, 0),
    rotation: new Vector3(0, 0, 0),
    scale: new Vector3(1, 1, 1),
  });

  // Add Parent component
  builder.with(Parent, { id: layerEntity });

  // Add TiledObject component
  builder.with(TiledObject, {
    layerEntity,
    mapEntity,
    objectData: obj,
    name: obj.name ?? '',
    type: obj.type ?? '',
    id: obj.id,
    properties: parseProperties(obj.properties),
    gid: obj.gid ?? null,
  });

  // If object has GID, it's a tile object -> spawn as Sprite2D
  if (obj.gid) {
    const { gid: cleanGid, flipX, flipY } = extractGidAndFlips(obj.gid);
    const tilesetInfo = findTilesetForGid(cleanGid, tiledMap);

    if (tilesetInfo) {
      const localTileId = cleanGid - tilesetInfo.firstGid;

      // Add Sprite2D component using the tileset's RuntimeAsset
      builder.with(Sprite2D, {
        texture: tilesetInfo.texture, // Use the RuntimeAsset from TilesetInfo
        color: { r: 1, g: 1, b: 1, a: 1 },
        tileIndex: localTileId,
        tileSize: { x: tilesetInfo.tileWidth, y: tilesetInfo.tileHeight },
        tilesetSize: { x: tilesetInfo.imageWidth, y: tilesetInfo.imageHeight },
        spriteRect: null, // Tiled uses tile-based sprites
        pixelsPerUnit: map.tilewidth, // Use map's tile size as pixelsPerUnit
        flipX,
        flipY,
        sortingLayer: objectLayer.zOrder,
        sortingOrder: 0,
        anchor: { x: 0, y: 1 }, // Tiled uses bottom-left for tile objects
        visible: objectLayer.visible,
        isLit: false,
      });

      // Add animation if tile is animated
      const animation = tilesetInfo.animations.get(localTileId);
      if (animation) {
        // Create a RuntimeAsset wrapper for the programmatically-generated clip
        const clipAsset = RuntimeAsset.createLoaded<AnimationClip>(
          `tiled-animation-${animation.clip.id}`,
          AssetType.Animation,
          animation.clip
        );
        builder.with(AnimationController, {
          animations: [clipAsset],
          currentAnimationId: null,
          isPlaying: false,
          currentTime: 0,
          speed: 1.0,
          loopCount: 0,
        });
      }
    } else {
      console.warn(
        `[tiledObjectSpawnerSystem] Could not find tileset for GID ${cleanGid} ` +
          `in object "${obj.name}" (ID ${obj.id})`
      );
    }
  }

  // Call custom object spawner factory if provided
  if (tiledMap.objectSpawnerFactory) {
    tiledMap.objectSpawnerFactory(obj, builder, tiledMap, commands);
  }

  // Build the entity
  const objEntity = builder.build();

  // Add to object layer's tracking
  objectLayer.objectEntities.add(objEntity.id());

  // Register as child of layer
  commands.entity(layerEntity).addChild(objEntity.id());
}
