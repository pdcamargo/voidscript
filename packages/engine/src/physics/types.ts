/**
 * Physics Types
 *
 * Shared type definitions for 2D and 3D physics systems.
 */

/**
 * Rigid body type determines how the physics engine simulates the body.
 * - dynamic: Affected by forces, gravity, and collisions (e.g., falling objects)
 * - static: Never moves, infinite mass (e.g., walls, ground)
 * - kinematic: Moves via velocity, not affected by forces (e.g., moving platforms)
 */
export type BodyType = 'dynamic' | 'static' | 'kinematic';

/**
 * 2D Collider Shapes
 */
export type ColliderShape2D =
  | {
      type: 'cuboid';
      /** Half-width (distance from center to edge on X axis) */
      halfWidth: number;
      /** Half-height (distance from center to edge on Y axis) */
      halfHeight: number;
    }
  | {
      type: 'ball';
      /** Radius of the circle */
      radius: number;
    }
  | {
      type: 'capsule';
      /** Half-height of the capsule (excluding end caps) */
      halfHeight: number;
      /** Radius of the capsule end caps */
      radius: number;
    };

/**
 * 3D Collider Shapes
 */
export type ColliderShape3D =
  | {
      type: 'cuboid';
      /** Half-extents (distance from center to edge on each axis) */
      halfWidth: number;
      halfHeight: number;
      halfDepth: number;
    }
  | {
      type: 'ball';
      /** Radius of the sphere */
      radius: number;
    }
  | {
      type: 'capsule';
      /** Half-height of the capsule (excluding end caps) */
      halfHeight: number;
      /** Radius of the capsule end caps */
      radius: number;
    }
  | {
      type: 'cylinder';
      /** Half-height of the cylinder */
      halfHeight: number;
      /** Radius of the cylinder */
      radius: number;
    }
  | {
      type: 'cone';
      /** Half-height of the cone */
      halfHeight: number;
      /** Radius of the cone base */
      radius: number;
    };

/**
 * Opaque handle to a Rapier rigid body.
 * Internal use only - never exposed to users.
 */
export type RapierBodyHandle = number;

/**
 * Opaque handle to a Rapier collider.
 * Internal use only - never exposed to users.
 */
export type RapierColliderHandle = number;
