/**
 * Physics3D Sync System
 *
 * FixedUpdate system that steps the Rapier physics simulation and syncs results back to ECS.
 * Runs at fixed timestep (default 60 FPS) for deterministic physics.
 * Only runs during play mode (isGameplayActive).
 *
 * Handles:
 * 1. Step physics simulation (world.step())
 * 2. Sync Rapier transforms → Transform3D (position/rotation)
 * 3. Sync Rapier velocities → Velocity3D (if component exists)
 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import { system } from '../../ecs/system.js';
import { isGameplayActive } from '../../editor/system-conditions.js';
import { Physics3DContext } from './physics-3d-context.js';
import { RigidBody3D } from './components/rigidbody-3d.js';
import { Velocity3D } from './components/velocity-3d.js';
import { PhysicsObject3D } from './components/physics-object-3d.js';
import { Transform3D } from '../../ecs/components/rendering/transform-3d.js';
import { CharacterController3D } from './components/character-controller-3d.js';
import { DesiredMovement3D } from './components/desired-movement-3d.js';

/**
 * Convert Rapier quaternion to Euler angles
 */
function quaternionToEuler(quat: {
  x: number;
  y: number;
  z: number;
  w: number;
}): THREE.Vector3 {
  const threeQuat = new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w);
  const euler = new THREE.Euler();
  euler.setFromQuaternion(threeQuat, 'XYZ');
  return new THREE.Vector3(euler.x, euler.y, euler.z);
}

export const physics3DSyncSystem = system(({ commands }) => {
  const physics = commands.tryGetResource(Physics3DContext);
  if (!physics) return;

  const world = physics.getWorld();

  // ==========================================================================
  // Character controller movement (BEFORE world.step())
  // ==========================================================================

  commands
    .query()
    .all(CharacterController3D, DesiredMovement3D, PhysicsObject3D)
    .each((entity, controller, desiredMovement, physicsObj) => {
      if (physicsObj.controllerHandle === undefined) return;
      if (physicsObj.colliderHandle === undefined) return;

      const rapierController = physics.getController(physicsObj.controllerHandle);
      const rapierCollider = world.getCollider(physicsObj.colliderHandle);

      if (!rapierController || !rapierCollider) return;

      // Compute movement with collision resolution
      // Use QueryFilterFlags to exclude sensors from collision response
      rapierController.computeColliderMovement(
        rapierCollider,
        desiredMovement.translation,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, // Exclude sensors from collision
      );

      // Store results in PhysicsObject3D
      const computed = rapierController.computedMovement();
      physicsObj.computedMovement = new THREE.Vector3(computed.x, computed.y, computed.z);
      physicsObj.isGrounded = rapierController.computedGrounded();

      // Apply movement
      const currentPos = rapierCollider.translation();
      const newPos = {
        x: currentPos.x + computed.x,
        y: currentPos.y + computed.y,
        z: currentPos.z + computed.z,
      };

      // If collider has parent rigid body, update body position
      const rapierBody = rapierCollider.parent();
      if (rapierBody) {
        // For character controllers, use setTranslation (not setNextKinematicTranslation)
        // because we've already computed the safe movement position
        rapierBody.setTranslation(newPos, true);
      } else {
        // Standalone collider - update position directly
        rapierCollider.setTranslation(newPos);
      }

      // Clear desired movement for next frame
      desiredMovement.translation.set(0, 0, 0);
    });

  // Step physics simulation (pass event queue to collect collision events)
  const eventQueue = physics.getEventQueue();
  world.step(eventQueue);

  // ==========================================================================
  // Sync Rapier transforms → Transform3D (for normal rigid bodies)
  // Exclude entities with CharacterController3D (they have separate sync below)
  // ==========================================================================

  commands
    .query()
    .all(RigidBody3D, Transform3D, PhysicsObject3D)
    .none(CharacterController3D)
    .each((entity, body, transform, physicsObj) => {
      const rapierBody = world.getRigidBody(physicsObj.bodyHandle);
      if (!rapierBody || body.bodyType === 'static') return;

      // Sync position
      const pos = rapierBody.translation();
      transform.position.x = pos.x;
      transform.position.y = pos.y;
      transform.position.z = pos.z;

      // Sync rotation (convert quaternion to Euler)
      const quat = rapierBody.rotation();
      const euler = quaternionToEuler(quat);
      transform.rotation.x = euler.x;
      transform.rotation.y = euler.y;
      transform.rotation.z = euler.z;
    });

  // ==========================================================================
  // Sync transforms for character controller entities
  // (Read from collider position instead of body)
  // ==========================================================================

  commands
    .query()
    .all(CharacterController3D, Transform3D, PhysicsObject3D)
    .each((entity, controller, transform, physicsObj) => {
      if (physicsObj.colliderHandle === undefined) return;

      const rapierCollider = world.getCollider(physicsObj.colliderHandle);
      if (!rapierCollider) return;

      // Sync position from collider
      const pos = rapierCollider.translation();
      transform.position.x = pos.x;
      transform.position.y = pos.y;
      transform.position.z = pos.z;

      // Sync rotation if collider has parent body
      const rapierBody = rapierCollider.parent();
      if (rapierBody) {
        const quat = rapierBody.rotation();
        const euler = quaternionToEuler(quat);
        transform.rotation.x = euler.x;
        transform.rotation.y = euler.y;
        transform.rotation.z = euler.z;
      }
    });

  // ==========================================================================
  // Sync velocities back to Velocity3D component (if entity has it)
  // ==========================================================================

  commands
    .query()
    .all(RigidBody3D, Velocity3D, PhysicsObject3D)
    .each((entity, body, velocity, physicsObj) => {
      const rapierBody = world.getRigidBody(physicsObj.bodyHandle);
      if (!rapierBody) return;

      const linvel = rapierBody.linvel();
      velocity.linear.set(linvel.x, linvel.y, linvel.z);

      const angvel = rapierBody.angvel();
      velocity.angular.set(angvel.x, angvel.y, angvel.z);
    });
}).runIf(isGameplayActive());
