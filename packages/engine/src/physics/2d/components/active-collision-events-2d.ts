/**
 * ActiveCollisionEvents2D Component
 *
 * Enables collision event generation for this entity's collider(s).
 * Without this component, no CollisionStarted2D/CollisionEnded2D events are emitted.
 *
 * This is a performance optimization - only entities that need collision events
 * should have this component, as Rapier must track additional state.
 *
 * @example
 * ```typescript
 * // Enable collision events on spawn
 * commands.spawn()
 *   .with(Transform3D, { position: new THREE.Vector3(0, 5, 0) })
 *   .with(RigidBody2D, { bodyType: 'dynamic' })
 *   .with(Collider2D, { shape: { type: 'ball', radius: 0.5 } })
 *   .with(ActiveCollisionEvents2D, { events: ActiveCollisionEventsFlags2D.ALL })
 *   .build();
 * ```
 */

import { component } from '../../../ecs/component.js';

/**
 * Flags for which collision events to generate
 */
export enum ActiveCollisionEventsFlags2D {
  /** No events generated (component can be present but disabled) */
  NONE = 0,
  /** Generate CollisionStarted2D/CollisionEnded2D events */
  COLLISION_EVENTS = 1 << 0,
  /** Generate ContactForce2D events (requires COLLISION_EVENTS to work) */
  CONTACT_FORCE_EVENTS = 1 << 1,
  /** All event types */
  ALL = COLLISION_EVENTS | CONTACT_FORCE_EVENTS,
}

export interface ActiveCollisionEvents2DData {
  /** Which events to generate (bitmask of ActiveCollisionEventsFlags2D) */
  events: ActiveCollisionEventsFlags2D;
}

export const ActiveCollisionEvents2D = component<ActiveCollisionEvents2DData>(
  'ActiveCollisionEvents2D',
  {
    events: {
      serializable: true,
      instanceType: Number,
      type: 'enum',
      enum: ActiveCollisionEventsFlags2D,
    },
  },
  {
    path: 'physics/2d',
    defaultValue: () => ({
      events: ActiveCollisionEventsFlags2D.COLLISION_EVENTS,
    }),
    displayName: 'Active Collision Events 2D',
    description: 'Enable collision event generation for this entity',
  },
);
