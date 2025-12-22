/**
 * ContactForceEventThreshold2D Component
 *
 * Sets the minimum force magnitude required to generate ContactForce2D events.
 * Only affects entities with ActiveCollisionEvents2D.CONTACT_FORCE_EVENTS enabled.
 *
 * Use this to filter out low-impact collisions and only receive events for
 * significant impacts (hard landings, crashes, etc.).
 *
 * @example
 * ```typescript
 * // Only emit events for impacts > 100 force units
 * commands.spawn()
 *   .with(RigidBody2D, { bodyType: 'dynamic' })
 *   .with(Collider2D, { shape: { type: 'ball', radius: 0.5 } })
 *   .with(ActiveCollisionEvents2D, { events: ActiveCollisionEventsFlags2D.ALL })
 *   .with(ContactForceEventThreshold2D, { threshold: 100 })
 *   .build();
 * ```
 */

import { component } from '../../../ecs/component.js';

export interface ContactForceEventThreshold2DData {
  /**
   * Minimum total force magnitude to trigger a ContactForce2D event.
   * Default: 0.0 (all contact forces generate events)
   *
   * Higher values filter out weaker impacts.
   * The force magnitude depends on masses, velocities, and physics timestep.
   */
  threshold: number;
}

export const ContactForceEventThreshold2D =
  component<ContactForceEventThreshold2DData>(
    'ContactForceEventThreshold2D',
    {
      threshold: {
        serializable: true,
        instanceType: Number,
      },
    },
    {
      path: 'physics/2d',
      defaultValue: () => ({
        threshold: 0.0,
      }),
      displayName: 'Contact Force Threshold 2D',
      description: 'Minimum force for contact force events',
    },
  );
