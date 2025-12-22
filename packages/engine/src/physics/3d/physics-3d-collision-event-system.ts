/**
 * Physics3D Collision Event System
 *
 * Runs AFTER physics3DSyncSystem to drain Rapier's event queue and emit
 * ECS collision events (CollisionStarted3D, CollisionEnded3D, ContactForce3D).
 *
 * Only processes entities that have ActiveCollisionEvents3D component configured.
 */

import * as THREE from 'three';
import { system } from '../../ecs/system.js';
import { isGameplayActive } from '../../editor/system-conditions.js';
import { Physics3DContext } from './physics-3d-context.js';
import { physics3DSyncSystem } from './physics-3d-sync-system.js';
import {
  CollisionStarted3D,
  CollisionEnded3D,
  CollisionEventFlags,
} from '../collision/collision-events.js';
import { ContactForce3D } from '../collision/contact-events.js';
import {
  ActiveCollisionEvents3D,
  ActiveCollisionEventsFlags3D,
} from './components/active-collision-events-3d.js';
import { ContactForceEventThreshold3D } from './components/contact-force-threshold-3d.js';

export const physics3DCollisionEventSystem = system(({ commands }) => {
  const physics = commands.tryGetResource(Physics3DContext);
  if (!physics) return; // 3D not enabled

  const world = physics.getWorld();
  const eventQueue = physics.getEventQueue();

  // Get event writers
  const collisionStartWriter = commands.eventWriter(CollisionStarted3D);
  const collisionEndWriter = commands.eventWriter(CollisionEnded3D);
  const contactForceWriter = commands.eventWriter(ContactForce3D);

  // ==========================================================================
  // Drain Collision Events (start/end)
  // ==========================================================================

  eventQueue.drainCollisionEvents((handle1, handle2, started) => {
    // Map handles to entities
    const entityA = physics.getEntityFromColliderHandle(handle1);
    const entityB = physics.getEntityFromColliderHandle(handle2);

    // Both entities must exist
    if (entityA === undefined || entityB === undefined) return;

    // At least one entity must have ActiveCollisionEvents3D configured for COLLISION_EVENTS
    const activeEventsA = commands.tryGetComponent(entityA, ActiveCollisionEvents3D);
    const activeEventsB = commands.tryGetComponent(entityB, ActiveCollisionEvents3D);

    const hasCollisionEventsA =
      activeEventsA &&
      (activeEventsA.events & ActiveCollisionEventsFlags3D.COLLISION_EVENTS) !== 0;
    const hasCollisionEventsB =
      activeEventsB &&
      (activeEventsB.events & ActiveCollisionEventsFlags3D.COLLISION_EVENTS) !== 0;

    if (!hasCollisionEventsA && !hasCollisionEventsB) return;

    // Determine flags
    let flags = CollisionEventFlags.NONE;

    // Check if either collider is a sensor
    const colliderA = world.getCollider(handle1);
    const colliderB = world.getCollider(handle2);
    if ((colliderA && colliderA.isSensor()) || (colliderB && colliderB.isSensor())) {
      flags |= CollisionEventFlags.SENSOR;
    }

    // Emit appropriate event
    if (started) {
      collisionStartWriter.send(new CollisionStarted3D(entityA, entityB, flags));
    } else {
      collisionEndWriter.send(new CollisionEnded3D(entityA, entityB, flags));
    }
  });

  // ==========================================================================
  // Drain Contact Force Events
  // ==========================================================================

  eventQueue.drainContactForceEvents((event) => {
    // Map handles to entities
    const entityA = physics.getEntityFromColliderHandle(event.collider1());
    const entityB = physics.getEntityFromColliderHandle(event.collider2());

    // Both entities must exist
    if (entityA === undefined || entityB === undefined) return;

    // At least one entity must have ActiveCollisionEvents3D configured for CONTACT_FORCE_EVENTS
    const activeEventsA = commands.tryGetComponent(entityA, ActiveCollisionEvents3D);
    const activeEventsB = commands.tryGetComponent(entityB, ActiveCollisionEvents3D);

    const hasContactForceEventsA =
      activeEventsA &&
      (activeEventsA.events & ActiveCollisionEventsFlags3D.CONTACT_FORCE_EVENTS) !== 0;
    const hasContactForceEventsB =
      activeEventsB &&
      (activeEventsB.events & ActiveCollisionEventsFlags3D.CONTACT_FORCE_EVENTS) !== 0;

    if (!hasContactForceEventsA && !hasContactForceEventsB) return;

    // Check thresholds
    const thresholdA = commands.tryGetComponent(entityA, ContactForceEventThreshold3D);
    const thresholdB = commands.tryGetComponent(entityB, ContactForceEventThreshold3D);

    const threshold = Math.max(
      thresholdA?.threshold ?? 0,
      thresholdB?.threshold ?? 0,
    );

    const totalForce = event.totalForceMagnitude();
    if (totalForce < threshold) return;

    // Get max force direction
    const maxForceDir = event.maxForceDirection();

    contactForceWriter.send(
      new ContactForce3D(
        entityA,
        entityB,
        totalForce,
        event.maxForceMagnitude(),
        new THREE.Vector3(maxForceDir.x, maxForceDir.y, maxForceDir.z),
      ),
    );
  });
})
  .runAfter(physics3DSyncSystem)
  .runIf(isGameplayActive());
