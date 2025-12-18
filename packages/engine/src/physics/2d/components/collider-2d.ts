/**
 * Collider2D Component
 *
 * Collision shape for 2D physics.
 * Can be used with RigidBody2D or standalone (creates implicit static body).
 *
 * Shapes:
 * - cuboid: Rectangle (defined by half-width and half-height)
 * - ball: Circle (defined by radius)
 * - capsule: Rounded rectangle (defined by half-height and radius)
 *
 * Properties:
 * - offset: Position offset from body origin
 * - rotationOffset: Rotation offset in radians
 * - isSensor: If true, detects collisions but doesn't respond (trigger)
 * - friction: Surface friction (0 = ice, 1 = rubber)
 * - restitution: Bounciness (0 = no bounce, 1 = perfect bounce)
 * - density: Mass per unit area (mass = density × area)
 */

import { component } from '../../../ecs/component.js';
import type { ColliderShape2D } from '../../types.js';
import * as THREE from 'three';

export interface Collider2DData {
  /** Collision shape definition */
  shape: ColliderShape2D;

  /** Position offset from body origin */
  offset: THREE.Vector2;

  /** Rotation offset in radians */
  rotationOffset: number;

  /** If true, collider is a sensor (trigger only, no collision response) */
  isSensor: boolean;

  /** Surface friction coefficient (0-1+, typical range 0-1) */
  friction: number;

  /** Restitution/bounciness (0 = no bounce, 1 = perfect bounce) */
  restitution: number;

  /** Density for mass calculation (mass = density × area) */
  density: number;
}

const serializeVector2 = {
  serialize: (val: THREE.Vector2) => ({ x: val.x, y: val.y }),
  deserialize: (val: any) => new THREE.Vector2(val.x, val.y),
};

export const Collider2D = component<Collider2DData>(
  'Collider2D',
  {
    shape: {
      serializable: true,
    },
    offset: {
      serializable: true,
      customSerializer: serializeVector2,
    },
    rotationOffset: {
      serializable: true,
      instanceType: Number,
    },
    isSensor: {
      serializable: true,
      instanceType: Boolean,
    },
    friction: {
      serializable: true,
      instanceType: Number,
    },
    restitution: {
      serializable: true,
      instanceType: Number,
    },
    density: {
      serializable: true,
      instanceType: Number,
    },
  },
  {
    path: 'physics/2d',
    defaultValue: () => ({
      shape: { type: 'cuboid', halfWidth: 0.5, halfHeight: 0.5 },
      offset: new THREE.Vector2(0, 0),
      rotationOffset: 0,
      isSensor: false,
      friction: 0.5,
      restitution: 0.0,
      density: 1.0,
    }),
    displayName: 'Collider 2D',
    description: 'Collision shape for 2D physics',
    showHelper: true,
  },
);
