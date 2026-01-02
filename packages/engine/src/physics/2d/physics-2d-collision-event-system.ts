/**
 * Physics2D Collision Event System
 *
 * Runs AFTER physics2DSyncSystem to drain Rapier's event queue and emit
 * ECS collision events (CollisionStarted2D, CollisionEnded2D, ContactForce2D).
 *
 * Only processes entities that have ActiveCollisionEvents2D component configured.
 */

import * as THREE from 'three';
import { system } from '@voidscript/core';
import { isGameplayActive } from '../../editor/system-conditions.js';
import { Physics2DContext } from './physics-2d-context.js';
import { physics2DSyncSystem } from './physics-2d-sync-system.js';
import {
  CollisionStarted2D,
  CollisionEnded2D,
  CollisionEventFlags,
} from '../collision/collision-events.js';
import { ContactForce2D } from '../collision/contact-events.js';
import {
  ActiveCollisionEvents2D,
  ActiveCollisionEventsFlags2D,
} from './components/active-collision-events-2d.js';
import { ContactForceEventThreshold2D } from './components/contact-force-threshold-2d.js';
import { PhysicsObject2D } from './components/physics-object-2d.js';

export const physics2DCollisionEventSystem = system(({ commands }) => {
  const physics = commands.tryGetResource(Physics2DContext);
  if (!physics) return; // 2D not enabled

  const world = physics.getWorld();
  const eventQueue = physics.getEventQueue();

  // Get event writers
  const collisionStartWriter = commands.eventWriter(CollisionStarted2D);
  const collisionEndWriter = commands.eventWriter(CollisionEnded2D);
  const contactForceWriter = commands.eventWriter(ContactForce2D);

  // ==========================================================================
  // Drain Collision Events (start/end)
  // ==========================================================================

  eventQueue.drainCollisionEvents((handle1, handle2, started) => {
    // Map handles to entities
    const entityA = physics.getEntityFromColliderHandle(handle1);
    const entityB = physics.getEntityFromColliderHandle(handle2);

    // Both entities must exist
    if (entityA === undefined || entityB === undefined) return;

    // At least one entity must have ActiveCollisionEvents2D configured for COLLISION_EVENTS
    const activeEventsA = commands.tryGetComponent(entityA, ActiveCollisionEvents2D);
    const activeEventsB = commands.tryGetComponent(entityB, ActiveCollisionEvents2D);

    const hasCollisionEventsA =
      activeEventsA &&
      (activeEventsA.events & ActiveCollisionEventsFlags2D.COLLISION_EVENTS) !== 0;
    const hasCollisionEventsB =
      activeEventsB &&
      (activeEventsB.events & ActiveCollisionEventsFlags2D.COLLISION_EVENTS) !== 0;

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
      collisionStartWriter.send(new CollisionStarted2D(entityA, entityB, flags));
    } else {
      collisionEndWriter.send(new CollisionEnded2D(entityA, entityB, flags));
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

    // At least one entity must have ActiveCollisionEvents2D configured for CONTACT_FORCE_EVENTS
    const activeEventsA = commands.tryGetComponent(entityA, ActiveCollisionEvents2D);
    const activeEventsB = commands.tryGetComponent(entityB, ActiveCollisionEvents2D);

    const hasContactForceEventsA =
      activeEventsA &&
      (activeEventsA.events & ActiveCollisionEventsFlags2D.CONTACT_FORCE_EVENTS) !== 0;
    const hasContactForceEventsB =
      activeEventsB &&
      (activeEventsB.events & ActiveCollisionEventsFlags2D.CONTACT_FORCE_EVENTS) !== 0;

    if (!hasContactForceEventsA && !hasContactForceEventsB) return;

    // Check thresholds
    const thresholdA = commands.tryGetComponent(entityA, ContactForceEventThreshold2D);
    const thresholdB = commands.tryGetComponent(entityB, ContactForceEventThreshold2D);

    const threshold = Math.max(
      thresholdA?.threshold ?? 0,
      thresholdB?.threshold ?? 0,
    );

    const totalForce = event.totalForceMagnitude();
    if (totalForce < threshold) return;

    // Get max force direction
    const maxForceDir = event.maxForceDirection();

    contactForceWriter.send(
      new ContactForce2D(
        entityA,
        entityB,
        totalForce,
        event.maxForceMagnitude(),
        new THREE.Vector2(maxForceDir.x, maxForceDir.y),
      ),
    );
  });

})
  .runAfter(physics2DSyncSystem)
  .runIf(isGameplayActive());
