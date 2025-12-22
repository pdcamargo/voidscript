/**
 * ActiveCollisionEvents3D Component
 *
 * Enables collision event generation for this entity's collider(s).
 * Without this component, no CollisionStarted3D/CollisionEnded3D events are emitted.
 *
 * This is a performance optimization - only entities that need collision events
 * should have this component, as Rapier must track additional state.
 *
 * @example
 * ```typescript
 * // Enable collision events on spawn
 * commands.spawn()
 *   .with(Transform3D, { position: new THREE.Vector3(0, 5, 0) })
 *   .with(RigidBody3D, { bodyType: 'dynamic' })
 *   .with(Collider3D, { shape: { type: 'ball', radius: 0.5 } })
 *   .with(ActiveCollisionEvents3D, { events: ActiveCollisionEventsFlags3D.ALL })
 *   .build();
 * ```
 */

import { component } from '../../../ecs/component.js';

/**
 * Flags for which collision events to generate
 */
export enum ActiveCollisionEventsFlags3D {
  /** No events generated (component can be present but disabled) */
  NONE = 0,
  /** Generate CollisionStarted3D/CollisionEnded3D events */
  COLLISION_EVENTS = 1 << 0,
  /** Generate ContactForce3D events (requires COLLISION_EVENTS to work) */
  CONTACT_FORCE_EVENTS = 1 << 1,
  /** All event types */
  ALL = COLLISION_EVENTS | CONTACT_FORCE_EVENTS,
}

export interface ActiveCollisionEvents3DData {
  /** Which events to generate (bitmask of ActiveCollisionEventsFlags3D) */
  events: ActiveCollisionEventsFlags3D;
}

export const ActiveCollisionEvents3D = component<ActiveCollisionEvents3DData>(
  'ActiveCollisionEvents3D',
  {
    events: {
      serializable: true,
      instanceType: Number,
      type: 'enum',
      enum: ActiveCollisionEventsFlags3D,
    },
  },
  {
    path: 'physics/3d',
    defaultValue: () => ({
      events: ActiveCollisionEventsFlags3D.COLLISION_EVENTS,
    }),
    displayName: 'Active Collision Events 3D',
    description: 'Enable collision event generation for this entity',
  },
);
