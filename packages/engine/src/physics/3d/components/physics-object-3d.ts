/**
 * PhysicsObject3D Component
 *
 * Runtime marker component for entities synchronized to Rapier 3D physics.
 * This component is NOT serialized - it's created automatically during play mode.
 *
 * Pattern inspired by RenderObject component:
 * - Marks entities that have been synced to physics engine
 * - Stores opaque handles to Rapier objects
 * - Allows querying: .none(PhysicsObject3D) for new entities, .all(PhysicsObject3D) for synced
 *
 * Lifecycle:
 * - Created by physics component sync system when RigidBody3D/Collider3D is added
 * - Updated during physics simulation
 * - Removed by cleanup system when physics components are removed
 * - Automatically cleaned up when exiting play mode (world snapshot restoration)
 */

import { component } from '../../../ecs/component.js';
import * as THREE from 'three';

export interface PhysicsObject3DData {
  /** Rapier rigid body handle */
  bodyHandle: number;

  /** Rapier collider handle (if entity has Collider3D) */
  colliderHandle?: number;

  // ============================================================================
  // Character Controller Fields (only present if entity has CharacterController3D)
  // ============================================================================

  /** Rapier character controller handle (only if CharacterController3D component exists) */
  controllerHandle?: number;

  /** Actual movement computed by controller after collision resolution */
  computedMovement?: THREE.Vector3;

  /** Whether character is currently grounded (touching floor) */
  isGrounded?: boolean;
}

/**
 * Runtime component marking entities that have been synced to Rapier physics.
 * Not serialized - created automatically when physics is enabled.
 */
export const PhysicsObject3D = component<PhysicsObject3DData>(
  'PhysicsObject3D',
  false, // Non-serializable runtime component
);
