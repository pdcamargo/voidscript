/**
 * Physics2D Component Sync System
 *
 * Update system that synchronizes ECS components → Rapier physics.
 * Creates/updates bodies and colliders based on component state.
 * Only runs during play mode (isGameplayActive).
 *
 * Handles:
 * 1. Creating new rigid bodies for RigidBody2D entities
 * 2. Updating optional properties (Velocity, GravityScale, Damping, LockedAxes, Ccd)
 * 3. Creating colliders for Collider2D entities
 * 4. Standalone colliders (without RigidBody2D - creates implicit static body)
 */

import RAPIER from '@dimforge/rapier2d';
import { system } from '../../ecs/system.js';
import { isGameplayActive } from '../../editor/system-conditions.js';
import { Physics2DContext } from './physics-2d-context.js';
import { RigidBody2D } from './components/rigidbody-2d.js';
import { Velocity2D } from './components/velocity-2d.js';
import { LockedAxes2D } from './components/locked-axes-2d.js';
import { Collider2D } from './components/collider-2d.js';
import { PhysicsObject2D } from './components/physics-object-2d.js';
import { GravityScale } from '../components/gravity-scale.js';
import { Damping } from '../components/damping.js';
import { Ccd } from '../components/ccd.js';
import { Transform3D } from '../../ecs/components/rendering/transform-3d.js';
import { CharacterController2D } from './components/character-controller-2d.js';
import type { ColliderShape2D } from '../types.js';

/**
 * Helper to create Rapier collider descriptor from shape definition
 * Applies transform scale to shape dimensions (Unity/Godot behavior)
 */
function createColliderDesc2D(
  shape: ColliderShape2D,
  scaleX: number = 1,
  scaleY: number = 1,
): RAPIER.ColliderDesc {
  switch (shape.type) {
    case 'cuboid':
      return RAPIER.ColliderDesc.cuboid(
        shape.halfWidth * scaleX,
        shape.halfHeight * scaleY,
      );
    case 'ball':
      // For circles, use the maximum scale component (Unity behavior)
      return RAPIER.ColliderDesc.ball(shape.radius * Math.max(scaleX, scaleY));
    case 'capsule':
      return RAPIER.ColliderDesc.capsule(
        shape.halfHeight * scaleY,
        shape.radius * Math.max(scaleX, scaleY),
      );
  }
}

export const physics2DComponentSyncSystem = system(({ commands }) => {
  const physics = commands.tryGetResource(Physics2DContext);
  if (!physics) return; // 2D not enabled

  const world = physics.getWorld();

  // ==========================================================================
  // 1. Create physics objects for NEW RigidBody2D entities
  // (have RigidBody2D + Transform3D but no PhysicsObject2D)
  // ==========================================================================

  commands
    .query()
    .all(RigidBody2D, Transform3D)
    .none(PhysicsObject2D)
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

      // Use Transform3D position (X/Y only, ignore Z)
      bodyDesc.setTranslation(transform.position.x, transform.position.y);
      bodyDesc.setRotation(transform.rotation.z); // 2D rotation is Z axis

      // Set sleep enabled
      bodyDesc.setCanSleep(body.canSleep);

      const rapierBody = world.createRigidBody(bodyDesc);
      physics.registerBody(entity, rapierBody.handle);

      // Add PhysicsObject2D component to mark as synced
      commands.entity(entity).addComponent(PhysicsObject2D, {
        bodyHandle: rapierBody.handle,
      });
    });

  // ==========================================================================
  // 2. Update optional physics properties for EXISTING bodies
  // ==========================================================================

  // Update velocity (if entity has Velocity2D component)
  commands
    .query()
    .all(RigidBody2D, Velocity2D, PhysicsObject2D)
    .each((entity, body, velocity, physicsObj) => {
      const rapierBody = world.getRigidBody(physicsObj.bodyHandle);
      if (!rapierBody) return;

      rapierBody.setLinvel({ x: velocity.linear.x, y: velocity.linear.y }, true);
      rapierBody.setAngvel(velocity.angular, true);
    });

  // Update gravity scale (if entity has GravityScale component)
  commands
    .query()
    .all(RigidBody2D, GravityScale, PhysicsObject2D)
    .each((entity, body, gravityScale, physicsObj) => {
      const rapierBody = world.getRigidBody(physicsObj.bodyHandle);
      if (!rapierBody) return;

      rapierBody.setGravityScale(gravityScale.scale, true);
    });

  // Update damping (if entity has Damping component)
  commands
    .query()
    .all(RigidBody2D, Damping, PhysicsObject2D)
    .each((entity, body, damping, physicsObj) => {
      const rapierBody = world.getRigidBody(physicsObj.bodyHandle);
      if (!rapierBody) return;

      rapierBody.setLinearDamping(damping.linear);
      rapierBody.setAngularDamping(damping.angular);
    });

  // Update locked axes (if entity has LockedAxes2D component)
  commands
    .query()
    .all(RigidBody2D, LockedAxes2D, PhysicsObject2D)
    .each((entity, body, lockedAxes, physicsObj) => {
      const rapierBody = world.getRigidBody(physicsObj.bodyHandle);
      if (!rapierBody) return;

      rapierBody.lockRotations(lockedAxes.lockRotation, true);
    });

  // Enable/disable CCD (if entity has Ccd component)
  commands
    .query()
    .all(RigidBody2D, Ccd, PhysicsObject2D)
    .each((entity, body, ccd, physicsObj) => {
      const rapierBody = world.getRigidBody(physicsObj.bodyHandle);
      if (!rapierBody) return;

      rapierBody.enableCcd(ccd.enabled);
    });

  // ==========================================================================
  // 3. Create colliders for entities with Collider2D + RigidBody2D
  // (PhysicsObject2D exists but colliderHandle is undefined)
  // ==========================================================================

  commands
    .query()
    .all(Collider2D, RigidBody2D, PhysicsObject2D, Transform3D)
    .each((entity, collider, body, physicsObj, transform) => {
      if (physicsObj.colliderHandle !== undefined) return; // Already has collider

      const rapierBody = world.getRigidBody(physicsObj.bodyHandle);
      if (!rapierBody) return;

      // Create collider attached to body (apply transform scale to shape dimensions)
      const colliderDesc = createColliderDesc2D(
        collider.shape,
        transform.scale.x,
        transform.scale.y,
      );
      colliderDesc.setTranslation(collider.offset.x, collider.offset.y);
      colliderDesc.setRotation(collider.rotationOffset);
      colliderDesc.setSensor(collider.isSensor);
      colliderDesc.setFriction(collider.friction);
      colliderDesc.setRestitution(collider.restitution);
      colliderDesc.setDensity(collider.density);

      const rapierCollider = world.createCollider(colliderDesc, rapierBody);
      physics.registerCollider(entity, rapierCollider.handle);

      // Update PhysicsObject2D with collider handle
      physicsObj.colliderHandle = rapierCollider.handle;
    });

  // ==========================================================================
  // 4. Update EXISTING collider properties
  // ==========================================================================

  commands
    .query()
    .all(Collider2D, PhysicsObject2D)
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
  // 5. Create STANDALONE colliders (Collider2D without RigidBody2D)
  // These get an implicit static body
  // ==========================================================================

  commands
    .query()
    .all(Collider2D, Transform3D)
    .none(RigidBody2D, PhysicsObject2D)
    .each((entity, collider, transform) => {
      // Create implicit static rigid body
      const bodyDesc = RAPIER.RigidBodyDesc.fixed();
      bodyDesc.setTranslation(transform.position.x, transform.position.y);
      bodyDesc.setRotation(transform.rotation.z);

      const rapierBody = world.createRigidBody(bodyDesc);
      physics.registerBody(entity, rapierBody.handle);

      // Create collider (apply transform scale to shape dimensions)
      const colliderDesc = createColliderDesc2D(
        collider.shape,
        transform.scale.x,
        transform.scale.y,
      );
      colliderDesc.setTranslation(collider.offset.x, collider.offset.y);
      colliderDesc.setRotation(collider.rotationOffset);
      colliderDesc.setSensor(collider.isSensor);
      colliderDesc.setFriction(collider.friction);
      colliderDesc.setRestitution(collider.restitution);
      colliderDesc.setDensity(collider.density);

      const rapierCollider = world.createCollider(colliderDesc, rapierBody);
      physics.registerCollider(entity, rapierCollider.handle);

      // Add PhysicsObject2D component
      commands.entity(entity).addComponent(PhysicsObject2D, {
        bodyHandle: rapierBody.handle,
        colliderHandle: rapierCollider.handle,
      });
    });

  // ==========================================================================
  // 6. Create character controllers for NEW entities with CharacterController2D
  // (have CharacterController2D + Collider2D + PhysicsObject2D but no controllerHandle)
  // ==========================================================================

  commands
    .query()
    .all(CharacterController2D, Collider2D, PhysicsObject2D)
    .each((entity, controller, collider, physicsObj) => {
      if (physicsObj.controllerHandle !== undefined) return; // Already has controller
      if (physicsObj.colliderHandle === undefined) return; // Need collider first

      // Validate body type if RigidBody2D exists
      if (physicsObj.bodyHandle !== undefined) {
        const rapierBody = world.getRigidBody(physicsObj.bodyHandle);
        if (rapierBody) {
          const bodyType = rapierBody.bodyType();
          if (bodyType === RAPIER.RigidBodyType.Dynamic) {
            console.warn(
              `[Physics2D] Entity ${entity} has CharacterController2D with Dynamic body. ` +
                `This may cause conflicts. Use 'kinematic' body type for character controllers.`,
            );
          } else if (bodyType === RAPIER.RigidBodyType.Fixed) {
            console.warn(
              `[Physics2D] Entity ${entity} has CharacterController2D with Static body. ` +
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
    .all(CharacterController2D, PhysicsObject2D)
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
