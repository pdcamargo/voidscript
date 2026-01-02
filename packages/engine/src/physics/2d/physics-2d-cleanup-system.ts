/**
 * Physics2D Cleanup System
 *
 * LateUpdate system that removes Rapier objects for entities that lost their physics components.
 * Only runs during play mode (isGameplayActive).
 *
 * Pattern: Query for PhysicsObject2D without RigidBody2D/Collider2D
 * This means the entity was synced but the user removed the physics components.
 */

import { system } from '@voidscript/core';
import { isGameplayActive } from '../../editor/system-conditions.js';
import { Physics2DContext } from './physics-2d-context.js';
import { RigidBody2D } from './components/rigidbody-2d.js';
import { Collider2D } from './components/collider-2d.js';
import { PhysicsObject2D } from './components/physics-object-2d.js';
import { CharacterController2D } from './components/character-controller-2d.js';

export const physics2DCleanupSystem = system(({ commands }) => {
  const physics = commands.tryGetResource(Physics2DContext);
  if (!physics) return;

  const world = physics.getWorld();

  // Cleanup physics objects for entities that lost their physics components
  // Pattern: PhysicsObject2D exists but no RigidBody2D/Collider2D/CharacterController2D
  commands
    .query()
    .all(PhysicsObject2D)
    .none(RigidBody2D, Collider2D, CharacterController2D)
    .each((entity, physicsObj) => {
      // Remove character controller if exists
      if (physicsObj.controllerHandle !== undefined) {
        physics.unregisterController(entity);
        physicsObj.controllerHandle = undefined;
        physicsObj.computedMovement = undefined;
        physicsObj.isGrounded = undefined;
      }

      // Remove Rapier collider if exists
      if (physicsObj.colliderHandle !== undefined) {
        const collider = world.getCollider(physicsObj.colliderHandle);
        if (collider) {
          world.removeCollider(collider, true);
          physics.unregisterCollider(physicsObj.colliderHandle);
        }
      }

      // Remove Rapier body if exists
      if (physicsObj.bodyHandle !== undefined) {
        const body = world.getRigidBody(physicsObj.bodyHandle);
        if (body) {
          world.removeRigidBody(body);
          physics.unregisterBody(entity);
        }
      }

      // Remove PhysicsObject2D component
      commands.entity(entity).removeComponent(PhysicsObject2D);
    });
}).runIf(isGameplayActive());
