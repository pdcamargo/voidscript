/**
 * Collider3D Component
 *
 * Collision shape for 3D physics.
 * Can be used with RigidBody3D or standalone (creates implicit static body).
 *
 * Shapes:
 * - cuboid: Box (defined by half-extents on each axis)
 * - ball: Sphere (defined by radius)
 * - capsule: Rounded cylinder (defined by half-height and radius)
 * - cylinder: Cylinder (defined by half-height and radius)
 * - cone: Cone (defined by half-height and base radius)
 *
 * Properties:
 * - offset: Position offset from body origin
 * - rotationOffset: Rotation offset as Euler angles
 * - isSensor: If true, detects collisions but doesn't respond (trigger)
 * - friction: Surface friction (0 = ice, 1 = rubber)
 * - restitution: Bounciness (0 = no bounce, 1 = perfect bounce)
 * - density: Mass per unit volume (mass = density × volume)
 */

import { component } from '../../../ecs/component.js';
import type { ColliderShape3D } from '../../types.js';
import * as THREE from 'three';

export interface Collider3DData {
  /** Collision shape definition */
  shape: ColliderShape3D;

  /** Position offset from body origin */
  offset: THREE.Vector3;

  /** Rotation offset as Euler angles (radians) */
  rotationOffset: THREE.Vector3;

  /** If true, collider is a sensor (trigger only, no collision response) */
  isSensor: boolean;

  /** Surface friction coefficient (0-1+, typical range 0-1) */
  friction: number;

  /** Restitution/bounciness (0 = no bounce, 1 = perfect bounce) */
  restitution: number;

  /** Density for mass calculation (mass = density × volume) */
  density: number;
}

const serializeVector3 = {
  serialize: (val: THREE.Vector3) => ({ x: val.x, y: val.y, z: val.z }),
  deserialize: (val: any) => new THREE.Vector3(val.x, val.y, val.z),
};

export const Collider3D = component<Collider3DData>(
  'Collider3D',
  {
    shape: {
      serializable: true,
    },
    offset: {
      serializable: true,
      customSerializer: serializeVector3,
    },
    rotationOffset: {
      serializable: true,
      customSerializer: serializeVector3,
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
    path: 'physics/3d',
    defaultValue: () => ({
      shape: { type: 'cuboid', halfWidth: 0.5, halfHeight: 0.5, halfDepth: 0.5 },
      offset: new THREE.Vector3(0, 0, 0),
      rotationOffset: new THREE.Vector3(0, 0, 0),
      isSensor: false,
      friction: 0.5,
      restitution: 0.0,
      density: 1.0,
    }),
    displayName: 'Collider 3D',
    description: 'Collision shape for 3D physics',
    showHelper: false,
  },
);
