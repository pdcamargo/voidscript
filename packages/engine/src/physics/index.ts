/**
 * Physics System
 *
 * Rapier-based 2D and 3D physics integration for VoidScript ECS.
 *
 * @example
 * ```typescript
 * // Enable 2D physics
 * const app = new Application({
 *   window: { canvas: 'canvas' },
 *   physics: {
 *     enable2D: true,
 *     gravity2D: { x: 0, y: -980 }, // pixels/second²
 *   },
 * });
 *
 * // Spawn a dynamic 2D physics body
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 10, 0), ... })
 *   .with(RigidBody2D, { bodyType: 'dynamic', canSleep: true })
 *   .with(Velocity2D, { linear: new THREE.Vector2(0, 0), angular: 0 })
 *   .with(Collider2D, {
 *     shape: { type: 'cuboid', halfWidth: 1, halfHeight: 1 },
 *     friction: 0.5,
 *     restitution: 0.3,
 *   })
 *   .build();
 *
 * // Query physics world
 * const physics = commands.getResource(Physics2DContext);
 * const hit = physics.raycast(origin, direction, maxDistance);
 * ```
 */

// Types
export type {
  BodyType,
  ColliderShape2D,
  ColliderShape3D,
  RapierBodyHandle,
  RapierColliderHandle,
} from './types.js';

// Shared Components
export {
  GravityScale,
  type GravityScaleData,
  Damping,
  type DampingData,
  Ccd,
  type CcdData,
} from './components/index.js';

// 2D Physics
export {
  // Context
  Physics2DContext,
  type RaycastHit2D,
  // Components
  RigidBody2D,
  type RigidBody2DData,
  Velocity2D,
  type Velocity2DData,
  LockedAxes2D,
  type LockedAxes2DData,
  Collider2D,
  type Collider2DData,
  PhysicsObject2D,
  type PhysicsObject2DData,
  CharacterController2D,
  type CharacterController2DData,
  DesiredMovement2D,
  type DesiredMovement2DData,
  // Systems
  physics2DComponentSyncSystem,
  physics2DSyncSystem,
  physics2DCleanupSystem,
} from './2d/index.js';

// 3D Physics
export {
  // Context
  Physics3DContext,
  type RaycastHit3D,
  // Components
  RigidBody3D,
  type RigidBody3DData,
  Velocity3D,
  type Velocity3DData,
  LockedAxes3D,
  type LockedAxes3DData,
  Collider3D,
  type Collider3DData,
  PhysicsObject3D,
  type PhysicsObject3DData,
  CharacterController3D,
  type CharacterController3DData,
  DesiredMovement3D,
  type DesiredMovement3DData,
  // Systems
  physics3DComponentSyncSystem,
  physics3DSyncSystem,
  physics3DCleanupSystem,
} from './3d/index.js';

// Config (re-export from Application)
export type { PhysicsConfig } from '../app/application.js';
