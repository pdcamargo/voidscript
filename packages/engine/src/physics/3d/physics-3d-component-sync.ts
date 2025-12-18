/**
 * Physics3D Component Sync System
 *
 * Update system that synchronizes ECS components → Rapier physics.
 * Creates/updates bodies and colliders based on component state.
 * Only runs during play mode (isGameplayActive).
 *
 * Handles:
 * 1. Creating new rigid bodies for RigidBody3D entities
 * 2. Updating optional properties (Velocity, GravityScale, Damping, LockedAxes, Ccd)
 * 3. Creating colliders for Collider3D entities
 * 4. Standalone colliders (without RigidBody3D - creates implicit static body)
 */

import RAPIER from '@dimforge/rapier3d';
import * as THREE from 'three';
import { system } from '../../ecs/system.js';
import { isGameplayActive } from '../../editor/system-conditions.js';
import { Physics3DContext } from './physics-3d-context.js';
import { RigidBody3D } from './components/rigidbody-3d.js';
import { Velocity3D } from './components/velocity-3d.js';
import { LockedAxes3D } from './components/locked-axes-3d.js';
import { Collider3D } from './components/collider-3d.js';
import { PhysicsObject3D } from './components/physics-object-3d.js';
import { GravityScale } from '../components/gravity-scale.js';
import { Damping } from '../components/damping.js';
import { Ccd } from '../components/ccd.js';
import { Transform3D } from '../../ecs/components/rendering/transform-3d.js';
import { CharacterController3D } from './components/character-controller-3d.js';
import type { ColliderShape3D } from '../types.js';

/**
 * Helper to create Rapier collider descriptor from shape definition
 */
function createColliderDesc3D(shape: ColliderShape3D): RAPIER.ColliderDesc {
  switch (shape.type) {
    case 'cuboid':
      return RAPIER.ColliderDesc.cuboid(
        shape.halfWidth,
        shape.halfHeight,
        shape.halfDepth,
      );
    case 'ball':
      return RAPIER.ColliderDesc.ball(shape.radius);
    case 'capsule':
      return RAPIER.ColliderDesc.capsule(shape.halfHeight, shape.radius);
    case 'cylinder':
      return RAPIER.ColliderDesc.cylinder(shape.halfHeight, shape.radius);
    case 'cone':
      return RAPIER.ColliderDesc.cone(shape.halfHeight, shape.radius);
  }
}

/**
 * Convert Euler angles (Vector3) to Rapier quaternion
 */
function eulerToQuaternion(euler: { x: number; y: number; z: number }): { x: number; y: number; z: number; w: number } {
  const quat = new THREE.Quaternion();
  quat.setFromEuler(new THREE.Euler(euler.x, euler.y, euler.z, 'XYZ'));
  return { x: quat.x, y: quat.y, z: quat.z, w: quat.w };
}

export const physics3DComponentSyncSystem = system(({ commands }) => {
  const physics = commands.tryGetResource(Physics3DContext);
  if (!physics) return; // 3D not enabled

  const world = physics.getWorld();

  // ==========================================================================
  // 1. Create physics objects for NEW RigidBody3D entities
  // (have RigidBody3D + Transform3D but no PhysicsObject3D)
  // ==========================================================================

  commands
    .query()
    .all(RigidBody3D, Transform3D)
    .none(PhysicsObject3D)
    .each((entity, body, transform) => {
      // Create body descriptor based on type
      let bodyDesc: RAPIER.RigidBodyDesc;
      switch (body.bodyType) {
        case 'dynamic':
          bodyDesc = RAPIER.RigidBodyDesc.dynamic();
          break;
        case 'static':
          bodyDesc = RAPIER.RigidBodyDesc.fixed();
          break;
        case 'kinematic':
          bodyDesc = RAPIER.RigidBodyDesc.kinematicVelocityBased();
          break;
      }

      // Use Transform3D position
      bodyDesc.setTranslation(
        transform.position.x,
        transform.position.y,
        transform.position.z,
      );

      // Convert Euler rotation to quaternion
      const quat = eulerToQuaternion(transform.rotation);
      bodyDesc.setRotation(quat);

      // Set sleep enabled
      bodyDesc.setCanSleep(body.canSleep);

      const rapierBody = world.createRigidBody(bodyDesc);
      physics.registerBody(entity, rapierBody.handle);

      // Add PhysicsObject3D component to mark as synced
      commands.entity(entity).addComponent(PhysicsObject3D, {
        bodyHandle: rapierBody.handle,
      });
    });

  // ==========================================================================
  // 2. Update optional physics properties for EXISTING bodies
  // ==========================================================================

  // Update velocity (if entity has Velocity3D component)
  commands
    .query()
    .all(RigidBody3D, Velocity3D, PhysicsObject3D)
    .each((entity, body, velocity, physicsObj) => {
      const rapierBody = world.getRigidBody(physicsObj.bodyHandle);
      if (!rapierBody) return;

      rapierBody.setLinvel(
        { x: velocity.linear.x, y: velocity.linear.y, z: velocity.linear.z },
        true,
      );
      rapierBody.setAngvel(
        { x: velocity.angular.x, y: velocity.angular.y, z: velocity.angular.z },
        true,
      );
    });

  // Update gravity scale (if entity has GravityScale component)
  commands
    .query()
    .all(RigidBody3D, GravityScale, PhysicsObject3D)
    .each((entity, body, gravityScale, physicsObj) => {
      const rapierBody = world.getRigidBody(physicsObj.bodyHandle);
      if (!rapierBody) return;

      rapierBody.setGravityScale(gravityScale.scale, true);
    });

  // Update damping (if entity has Damping component)
  commands
    .query()
    .all(RigidBody3D, Damping, PhysicsObject3D)
    .each((entity, body, damping, physicsObj) => {
      const rapierBody = world.getRigidBody(physicsObj.bodyHandle);
      if (!rapierBody) return;

      rapierBody.setLinearDamping(damping.linear);
      rapierBody.setAngularDamping(damping.angular);
    });

  // Update locked axes (if entity has LockedAxes3D component)
  commands
    .query()
    .all(RigidBody3D, LockedAxes3D, PhysicsObject3D)
    .each((entity, body, lockedAxes, physicsObj) => {
      const rapierBody = world.getRigidBody(physicsObj.bodyHandle);
      if (!rapierBody) return;

      rapierBody.setEnabledRotations(
        !lockedAxes.lockRotationX,
        !lockedAxes.lockRotationY,
        !lockedAxes.lockRotationZ,
        true,
      );
    });

  // Enable/disable CCD (if entity has Ccd component)
  commands
    .query()
    .all(RigidBody3D, Ccd, PhysicsObject3D)
    .each((entity, body, ccd, physicsObj) => {
      const rapierBody = world.getRigidBody(physicsObj.bodyHandle);
      if (!rapierBody) return;

      rapierBody.enableCcd(ccd.enabled);
    });

  // ==========================================================================
  // 3. Create colliders for entities with Collider3D + RigidBody3D
  // (PhysicsObject3D exists but colliderHandle is undefined)
  // ==========================================================================

  commands
    .query()
    .all(Collider3D, RigidBody3D, PhysicsObject3D)
    .each((entity, collider, body, physicsObj) => {
      if (physicsObj.colliderHandle !== undefined) return; // Already has collider

      const rapierBody = world.getRigidBody(physicsObj.bodyHandle);
      if (!rapierBody) return;

      // Create collider attached to body
      const colliderDesc = createColliderDesc3D(collider.shape);
      colliderDesc.setTranslation(
        collider.offset.x,
        collider.offset.y,
        collider.offset.z,
      );

      // Convert rotation offset to quaternion
      const rotQuat = eulerToQuaternion(collider.rotationOffset);
      colliderDesc.setRotation(rotQuat);

      colliderDesc.setSensor(collider.isSensor);
      colliderDesc.setFriction(collider.friction);
      colliderDesc.setRestitution(collider.restitution);
      colliderDesc.setDensity(collider.density);

      const rapierCollider = world.createCollider(colliderDesc, rapierBody);
      physics.registerCollider(entity, rapierCollider.handle);

      // Update PhysicsObject3D with collider handle
      physicsObj.colliderHandle = rapierCollider.handle;
    });

  // ==========================================================================
  // 4. Update EXISTING collider properties
  // ==========================================================================

  commands
    .query()
    .all(Collider3D, PhysicsObject3D)
    .each((entity, collider, physicsObj) => {
      if (physicsObj.colliderHandle === undefined) return;

      const rapierCollider = world.getCollider(physicsObj.colliderHandle);
      if (!rapierCollider) return;

      rapierCollider.setFriction(collider.friction);
      rapierCollider.setRestitution(collider.restitution);
      rapierCollider.setDensity(collider.density);
      rapierCollider.setSensor(collider.isSensor);
    });

  // ==========================================================================
  // 5. Create STANDALONE colliders (Collider3D without RigidBody3D)
  // These get an implicit static body
  // ==========================================================================

  commands
    .query()
    .all(Collider3D, Transform3D)
    .none(RigidBody3D, PhysicsObject3D)
    .each((entity, collider, transform) => {
      // Create implicit static rigid body
      const bodyDesc = RAPIER.RigidBodyDesc.fixed();
      bodyDesc.setTranslation(
        transform.position.x,
        transform.position.y,
        transform.position.z,
      );

      const quat = eulerToQuaternion(transform.rotation);
      bodyDesc.setRotation(quat);

      const rapierBody = world.createRigidBody(bodyDesc);
      physics.registerBody(entity, rapierBody.handle);

      // Create collider
      const colliderDesc = createColliderDesc3D(collider.shape);
      colliderDesc.setTranslation(
        collider.offset.x,
        collider.offset.y,
        collider.offset.z,
      );

      const rotQuat = eulerToQuaternion(collider.rotationOffset);
      colliderDesc.setRotation(rotQuat);

      colliderDesc.setSensor(collider.isSensor);
      colliderDesc.setFriction(collider.friction);
      colliderDesc.setRestitution(collider.restitution);
      colliderDesc.setDensity(collider.density);

      const rapierCollider = world.createCollider(colliderDesc, rapierBody);
      physics.registerCollider(entity, rapierCollider.handle);

      // Add PhysicsObject3D component
      commands.entity(entity).addComponent(PhysicsObject3D, {
        bodyHandle: rapierBody.handle,
        colliderHandle: rapierCollider.handle,
      });
    });

  // ==========================================================================
  // 6. Create character controllers for NEW entities with CharacterController3D
  // (have CharacterController3D + Collider3D + PhysicsObject3D but no controllerHandle)
  // ==========================================================================

  commands
    .query()
    .all(CharacterController3D, Collider3D, PhysicsObject3D)
    .each((entity, controller, collider, physicsObj) => {
      if (physicsObj.controllerHandle !== undefined) return; // Already has controller
      if (physicsObj.colliderHandle === undefined) return; // Need collider first

      // Validate body type if RigidBody3D exists
      if (physicsObj.bodyHandle !== undefined) {
        const rapierBody = world.getRigidBody(physicsObj.bodyHandle);
        if (rapierBody) {
          const bodyType = rapierBody.bodyType();
          if (bodyType === RAPIER.RigidBodyType.Dynamic) {
            console.warn(
              `[Physics3D] Entity ${entity} has CharacterController3D with Dynamic body. ` +
                `This may cause conflicts. Use 'kinematic' body type for character controllers.`,
            );
          } else if (bodyType === RAPIER.RigidBodyType.Fixed) {
            console.warn(
              `[Physics3D] Entity ${entity} has CharacterController3D with Static body. ` +
                `This may cause conflicts. Use 'kinematic' body type for character controllers.`,
            );
          }
        }
      }

      // Create Rapier character controller
      const rapierController = world.createCharacterController(controller.offset);

      // Configure controller
      rapierController.setUp(controller.up);
      rapierController.setMaxSlopeClimbAngle(controller.maxSlopeClimbAngle);
      rapierController.setMinSlopeSlideAngle(controller.minSlopeSlideAngle);
      rapierController.setSlideEnabled(controller.slideEnabled);
      rapierController.setNormalNudgeFactor(controller.normalNudgeFactor);
      rapierController.setApplyImpulsesToDynamicBodies(
        controller.applyImpulsesToDynamicBodies,
      );

      if (controller.characterMass !== null) {
        rapierController.setCharacterMass(controller.characterMass);
      }

      if (controller.autostepEnabled) {
        rapierController.enableAutostep(
          controller.autostepMaxHeight,
          controller.autostepMinWidth,
          controller.autostepIncludesDynamicBodies,
        );
      }

      if (controller.snapToGroundEnabled) {
        rapierController.enableSnapToGround(controller.snapToGroundDistance);
      }

      // Register and store handle
      const handle = physics.registerController(entity, rapierController);
      physicsObj.controllerHandle = handle;
    });

  // ==========================================================================
  // 7. Update EXISTING controller properties
  // ==========================================================================

  commands
    .query()
    .all(CharacterController3D, PhysicsObject3D)
    .each((entity, controller, physicsObj) => {
      if (physicsObj.controllerHandle === undefined) return;

      const rapierController = physics.getController(physicsObj.controllerHandle);
      if (!rapierController) return;

      // Sync all properties (user may have changed them)
      rapierController.setOffset(controller.offset);
      rapierController.setUp(controller.up);
      rapierController.setMaxSlopeClimbAngle(controller.maxSlopeClimbAngle);
      rapierController.setMinSlopeSlideAngle(controller.minSlopeSlideAngle);
      rapierController.setSlideEnabled(controller.slideEnabled);
      rapierController.setNormalNudgeFactor(controller.normalNudgeFactor);
      rapierController.setApplyImpulsesToDynamicBodies(
        controller.applyImpulsesToDynamicBodies,
      );

      if (controller.characterMass !== null) {
        rapierController.setCharacterMass(controller.characterMass);
      }

      // Update autostep
      if (controller.autostepEnabled) {
        rapierController.enableAutostep(
          controller.autostepMaxHeight,
          controller.autostepMinWidth,
          controller.autostepIncludesDynamicBodies,
        );
      } else {
        rapierController.disableAutostep();
      }

      // Update snap-to-ground
      if (controller.snapToGroundEnabled) {
        rapierController.enableSnapToGround(controller.snapToGroundDistance);
      } else {
        rapierController.disableSnapToGround();
      }
    });
}).runIf(isGameplayActive());
