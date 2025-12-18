/**
 * Physics3D Cleanup System
 *
 * LateUpdate system that removes Rapier objects for entities that lost their physics components.
 * Only runs during play mode (isGameplayActive).
 *
 * Pattern: Query for PhysicsObject3D without RigidBody3D/Collider3D
 * This means the entity was synced but the user removed the physics components.
 */

import { system } from '../../ecs/system.js';
import { isGameplayActive } from '../../editor/system-conditions.js';
import { Physics3DContext } from './physics-3d-context.js';
import { RigidBody3D } from './components/rigidbody-3d.js';
import { Collider3D } from './components/collider-3d.js';
import { PhysicsObject3D } from './components/physics-object-3d.js';
import { CharacterController3D } from './components/character-controller-3d.js';

export const physics3DCleanupSystem = system(({ commands }) => {
  const physics = commands.tryGetResource(Physics3DContext);
  if (!physics) return;

  const world = physics.getWorld();

  // Cleanup physics objects for entities that lost their physics components
  // Pattern: PhysicsObject3D exists but no RigidBody3D/Collider3D/CharacterController3D
  commands
    .query()
    .all(PhysicsObject3D)
    .none(RigidBody3D, Collider3D, CharacterController3D)
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

      // Remove PhysicsObject3D component
      commands.entity(entity).removeComponent(PhysicsObject3D);
    });
}).runIf(isGameplayActive());
