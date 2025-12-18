/**
 * Damping Component
 *
 * Reduces linear and angular velocity over time (like air resistance).
 * Shared between 2D and 3D physics.
 *
 * Damping values typically range from 0.0 to 1.0:
 * - 0.0: No damping (object maintains velocity)
 * - 0.1: Light damping (slowly slows down)
 * - 0.5: Medium damping (noticeable slowdown)
 * - 1.0+: Heavy damping (quickly comes to rest)
 */

import { component } from '../../ecs/component.js';

export interface DampingData {
  /** Linear damping (0-1, reduces linear velocity over time) */
  linear: number;

  /** Angular damping (0-1, reduces angular velocity over time) */
  angular: number;
}

export const Damping = component<DampingData>(
  'Damping',
  {
    linear: {
      serializable: true,
      instanceType: Number,
    },
    angular: {
      serializable: true,
      instanceType: Number,
    },
  },
  {
    path: 'physics',
    defaultValue: () => ({
      linear: 0.0,
      angular: 0.0,
    }),
    displayName: 'Damping',
    description: 'Linear and angular damping for physics bodies',
  },
);
