/**
 * Tiled Object Layer Collision System
 *
 * Startup system that spawns static 2D colliders from Tiled object layers.
 *
 * Responsibilities:
 * - Detect collision layers (by name or custom property)
 * - Convert object layer rectangles and ellipses to Collider2D components
 * - Spawn static RigidBody2D + Collider2D entities
 * - Support sensor objects via custom properties
 *
 * Collision Layer Detection:
 * - Layer name contains "collision" (case-insensitive)
 * - OR layer has custom property `collision: true`
 *
 * Object Filtering:
 * - Skip if `visible: false`
 * - Skip if object has property `collision: false`
 * - Support `sensor: true` property to create trigger colliders
 *
 * Runs in the startup phase after tiledMapLoaderSystem.
 */

import { system } from '@voidscript/core';
import type { Entity } from '@voidscript/core';
import type { Command } from '@voidscript/core';
import * as tiled from '@kayahr/tiled';
import { TiledMap, type TiledMapData } from '../../ecs/components/tiled/tiled-map.js';
import { TiledObjectLayer } from '../../ecs/components/tiled/tiled-object-layer.js';
import { TiledCollider } from '../../ecs/components/tiled/tiled-collider.js';
import { Transform3D } from '../../ecs/components/rendering/transform-3d.js';
import { LocalTransform3D } from '../../ecs/components/rendering/local-transform-3d.js';
import { Parent } from '@voidscript/core';
import { RigidBody2D } from '../../physics/2d/components/rigidbody-2d.js';
import { Collider2D } from '../../physics/2d/components/collider-2d.js';
import { tiledCoordsToWorld } from '../tiled-utils.js';
import { tiledObjectToColliderShape } from '../tiled-collision-utils.js';
import { Vector3 } from '../../math/vector3.js';
import { Vector2 } from 'three';
import { tiledMapLoaderSystem } from './tiled-map-loader-system.js';

/**
 * Track which object layers have already been processed for collisions
 * Key: Entity ID of TiledObjectLayer
 */
const processedLayers = new Set<Entity>();

/**
 * Tiled Object Layer Collision System
 *
 * Spawns static colliders from object layers marked as collision layers.
 */
export const tiledObjectCollisionSystem = system(({ commands }) => {
  // Query for TiledObjectLayer components
  commands
    .query()
    .all(TiledObjectLayer)
    .each((entity, objectLayer) => {
      // Skip if already processed
      if (processedLayers.has(entity)) return;

      // Check if this is a collision layer
      const isCollisionLayer =
        objectLayer.name.toLowerCase().includes('collision') ||
        objectLayer.properties.get('collision') === true;

      if (!isCollisionLayer) {
        processedLayers.add(entity);
        return;
      }

      // Skip if layer is not visible
      if (!objectLayer.visible) {
        processedLayers.add(entity);
        return;
      }

      // Get parent map
      const tiledMap = commands.getComponent(objectLayer.mapEntity, TiledMap);
      if (!tiledMap) {
        console.error(
          `[tiledObjectCollisionSystem] TiledObjectLayer entity ${entity} has invalid mapEntity`
        );
        processedLayers.add(entity);
        return;
      }

      // Process each object in the layer
      for (const obj of objectLayer.layerData.objects) {
        spawnObjectCollider(obj, entity, objectLayer.mapEntity, tiledMap, commands);
      }

      // Mark as processed
      processedLayers.add(entity);
    });
}).runAfter(tiledMapLoaderSystem);

/**
 * Spawn a collider entity from a Tiled object
 */
function spawnObjectCollider(
  obj: tiled.MapObject,
  layerEntity: Entity,
  mapEntity: Entity,
  tiledMap: TiledMapData,
  commands: Command
): void {
  const map = tiledMap.mapData;

  // Skip if object is invisible
  if (obj.visible === false) {
    return;
  }

  // Check if object has collision disabled via custom property
  const properties = new Map<string, any>();
  if (obj.properties) {
    for (const prop of obj.properties) {
      properties.set(prop.name, prop.value);
    }
  }

  if (properties.get('collision') === false) {
    return;
  }

  // Parse collision shape
  const result = tiledObjectToColliderShape(obj, map.tilewidth, map.tileheight);

  if (!result) {
    // Shape parsing failed (unsupported shape or warning already logged)
    return;
  }

  const { shape, offset } = result;

  // Convert object position to world space
  // Note: offset already includes the object's local position, so we just convert the base position
  const worldPos = tiledCoordsToWorld(
    0, // We'll use the offset instead
    0,
    map.tilewidth,
    map.tileheight,
    tiledMap.worldOffset,
    map.orientation
  );

  // Check if this should be a sensor (trigger)
  const isSensor = properties.get('sensor') === true;

  // Get custom friction and restitution if provided
  const friction = typeof properties.get('friction') === 'number' ? properties.get('friction') : 0.5;
  const restitution =
    typeof properties.get('restitution') === 'number' ? properties.get('restitution') : 0.0;

  // Spawn collider entity
  const colliderEntity = commands
    .spawn()
    .with(LocalTransform3D, {
      position: new Vector3(worldPos.x + offset.x, worldPos.y + offset.y, worldPos.z),
      rotation: new Vector3(0, 0, -((obj.rotation ?? 0) * Math.PI) / 180), // Convert degrees to radians, flip sign
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
      shape,
      offset: new Vector2(0, 0), // Offset already applied to Transform position
      rotationOffset: 0,
      isSensor,
      friction,
      restitution,
      density: 1.0,
    })
    .with(TiledCollider, {
      mapEntity,
      layerEntity,
      sourceType: 'objectlayer',
    })
    .build();

  // Register as child of layer (this will add Parent component and update Children)
  commands.entity(layerEntity).addChild(colliderEntity.id());
}
