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

import { component } from '@voidscript/core';
import { EditorLayout } from '../../app/imgui/editor-layout.js';

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
    customEditor: ({ componentData }) => {
      EditorLayout.beginLabelsWidth(['Scale']);

      const [scale, changed] = EditorLayout.numberField(
        'Scale',
        componentData.scale,
        {
          speed: 0.1,
          tooltip: '1.0 = normal gravity, 0.0 = no gravity, -1.0 = reversed gravity',
        }
      );
      if (changed) {
        componentData.scale = scale;
      }

      EditorLayout.endLabelsWidth();
    },
  },
);
