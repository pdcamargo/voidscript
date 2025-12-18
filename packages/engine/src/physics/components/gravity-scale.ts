/**
 * GravityScale Component
 *
 * Multiplies the gravity applied to a rigid body.
 * Shared between 2D and 3D physics.
 *
 * Examples:
 * - scale = 1.0: Normal gravity
 * - scale = 0.0: No gravity (floating)
 * - scale = 2.0: Double gravity (falls faster)
 * - scale = -1.0: Reversed gravity (floats up)
 */

import { component } from '../../ecs/component.js';

export interface GravityScaleData {
  /** Gravity scale multiplier (1.0 = normal gravity, 0.0 = no gravity) */
  scale: number;
}

export const GravityScale = component<GravityScaleData>(
  'GravityScale',
  {
    scale: {
      serializable: true,
      instanceType: Number,
    },
  },
  {
    path: 'physics',
    defaultValue: () => ({ scale: 1.0 }),
    displayName: 'Gravity Scale',
    description: 'Multiplier for gravity force',
  },
);
