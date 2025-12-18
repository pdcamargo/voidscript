/**
 * Physics2D Sync System
 *
 * FixedUpdate system that steps the Rapier physics simulation and syncs results back to ECS.
 * Runs at fixed timestep (default 60 FPS) for deterministic physics.
 * Only runs during play mode (isGameplayActive).
 *
 * Handles:
 * 1. Step physics simulation (world.step())
 * 2. Sync Rapier transforms → Transform3D (position/rotation)
 * 3. Sync Rapier velocities → Velocity2D (if component exists)
 */

import * as THREE from 'three';
import { system } from '../../ecs/system.js';
import { isGameplayActive } from '../../editor/system-conditions.js';
import { Physics2DContext } from './physics-2d-context.js';
import { RigidBody2D } from './components/rigidbody-2d.js';
import { Velocity2D } from './components/velocity-2d.js';
import { PhysicsObject2D } from './components/physics-object-2d.js';
import { Transform3D } from '../../ecs/components/rendering/transform-3d.js';
import { CharacterController2D } from './components/character-controller-2d.js';
import { DesiredMovement2D } from './components/desired-movement-2d.js';

export const physics2DSyncSystem = system(({ commands }) => {
  const physics = commands.tryGetResource(Physics2DContext);
  if (!physics) return;

  const world = physics.getWorld();

  // ==========================================================================
  // Character controller movement (BEFORE world.step())
  // ==========================================================================

  commands
    .query()
    .all(CharacterController2D, DesiredMovement2D, PhysicsObject2D)
    .each((entity, controller, desiredMovement, physicsObj) => {
      if (physicsObj.controllerHandle === undefined) return;
      if (physicsObj.colliderHandle === undefined) return;

      const rapierController = physics.getController(physicsObj.controllerHandle);
      const rapierCollider = world.getCollider(physicsObj.colliderHandle);

      if (!rapierController || !rapierCollider) return;

      // Compute movement with collision resolution
      const currentPos = rapierCollider.translation();
      rapierController.computeColliderMovement(
        rapierCollider,
        desiredMovement.translation,
      );

      // Store results in PhysicsObject2D
      const computed = rapierController.computedMovement();
      physicsObj.computedMovement = new THREE.Vector2(computed.x, computed.y);
      physicsObj.isGrounded = rapierController.computedGrounded();

      // Apply movement
      const newPos = {
        x: currentPos.x + computed.x,
        y: currentPos.y + computed.y,
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
      desiredMovement.translation.set(0, 0);
    });

  // Step physics simulation
  world.step();

  // ==========================================================================
  // Sync Rapier transforms → Transform3D (for normal rigid bodies)
  // Exclude entities with CharacterController2D (they have separate sync below)
  // ==========================================================================

  commands
    .query()
    .all(RigidBody2D, Transform3D, PhysicsObject2D)
    .none(CharacterController2D)
    .each((entity, body, transform, physicsObj) => {
      const rapierBody = world.getRigidBody(physicsObj.bodyHandle);
      if (!rapierBody || body.bodyType === 'static') return;

      // Sync position (only X/Y)
      const pos = rapierBody.translation();
      transform.position.x = pos.x;
      transform.position.y = pos.y;

      // Sync rotation (only Z)
      transform.rotation.z = rapierBody.rotation();
    });

  // ==========================================================================
  // Sync transforms for character controller entities
  // (Read from collider position instead of body)
  // ==========================================================================

  commands
    .query()
    .all(CharacterController2D, Transform3D, PhysicsObject2D)
    .each((entity, controller, transform, physicsObj) => {
      if (physicsObj.colliderHandle === undefined) return;

      const rapierCollider = world.getCollider(physicsObj.colliderHandle);
      if (!rapierCollider) return;

      // Sync position from collider
      const pos = rapierCollider.translation();
      transform.position.x = pos.x;
      transform.position.y = pos.y;

      // Sync rotation if collider has parent body
      const rapierBody = rapierCollider.parent();
      if (rapierBody) {
        transform.rotation.z = rapierBody.rotation();
      }
    });

  // ==========================================================================
  // Sync velocities back to Velocity2D component (if entity has it)
  // ==========================================================================

  commands
    .query()
    .all(RigidBody2D, Velocity2D, PhysicsObject2D)
    .each((entity, body, velocity, physicsObj) => {
      const rapierBody = world.getRigidBody(physicsObj.bodyHandle);
      if (!rapierBody) return;

      const linvel = rapierBody.linvel();
      velocity.linear.set(linvel.x, linvel.y);
      velocity.angular = rapierBody.angvel();
    });
}).runIf(isGameplayActive());
