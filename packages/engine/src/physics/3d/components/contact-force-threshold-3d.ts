/**
 * ContactForceEventThreshold3D Component
 *
 * Sets the minimum force magnitude required to generate ContactForce3D events.
 * Only affects entities with ActiveCollisionEvents3D.CONTACT_FORCE_EVENTS enabled.
 *
 * Use this to filter out low-impact collisions and only receive events for
 * significant impacts (hard landings, crashes, etc.).
 *
 * @example
 * ```typescript
 * // Only emit events for impacts > 100 force units
 * commands.spawn()
 *   .with(RigidBody3D, { bodyType: 'dynamic' })
 *   .with(Collider3D, { shape: { type: 'ball', radius: 0.5 } })
 *   .with(ActiveCollisionEvents3D, { events: ActiveCollisionEventsFlags3D.ALL })
 *   .with(ContactForceEventThreshold3D, { threshold: 100 })
 *   .build();
 * ```
 */

import { component } from '../../../ecs/component.js';

export interface ContactForceEventThreshold3DData {
  /**
   * Minimum total force magnitude to trigger a ContactForce3D event.
   * Default: 0.0 (all contact forces generate events)
   *
   * Higher values filter out weaker impacts.
   * The force magnitude depends on masses, velocities, and physics timestep.
   */
  threshold: number;
}

export const ContactForceEventThreshold3D =
  component<ContactForceEventThreshold3DData>(
    'ContactForceEventThreshold3D',
    {
      threshold: {
        serializable: true,
        instanceType: Number,
      },
    },
    {
      path: 'physics/3d',
      defaultValue: () => ({
        threshold: 0.0,
      }),
      displayName: 'Contact Force Threshold 3D',
      description: 'Minimum force for contact force events',
    },
  );
