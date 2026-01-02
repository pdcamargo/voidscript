/**
 * LockedAxes2D Component
 *
 * Locks rotation for 2D physics bodies.
 * Optional component - prevents rotation caused by forces/collisions.
 *
 * Use cases:
 * - Top-down characters that should always face upright
 * - Platformer characters that shouldn't tumble
 * - Objects that should slide but not rotate
 */

import { component } from '@voidscript/core';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

export interface LockedAxes2DData {
  /** Lock rotation (prevent rotation around Z axis in 2D) */
  lockRotation: boolean;
}

export const LockedAxes2D = component<LockedAxes2DData>(
  'LockedAxes2D',
  {
    lockRotation: {
      serializable: true,
      instanceType: Boolean,
    },
  },
  {
    path: 'physics/2d',
    defaultValue: () => ({ lockRotation: false }),
    displayName: 'Locked Axes 2D',
    description: 'Lock rotation for 2D physics bodies',
    customEditor: ({ componentData }) => {
      EditorLayout.beginLabelsWidth(['Lock Rotation']);

      const [lockRotation, changed] = EditorLayout.checkboxField(
        'Lock Rotation',
        componentData.lockRotation,
        {
          tooltip: 'Prevent rotation around Z axis (keeps object upright)',
        }
      );
      if (changed) {
        componentData.lockRotation = lockRotation;
      }

      EditorLayout.endLabelsWidth();
    },
  },
);
