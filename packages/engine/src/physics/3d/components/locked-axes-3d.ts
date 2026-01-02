/**
 * LockedAxes3D Component
 *
 * Locks rotation on specific axes for 3D physics bodies.
 * Optional component - prevents rotation caused by forces/collisions.
 *
 * Use cases:
 * - FPS character that shouldn't rotate on X/Z (only Y for looking)
 * - Vertical-only doors (lock X/Y rotation)
 * - Objects that should only tumble in one direction
 */

import { component } from '@voidscript/core';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

export interface LockedAxes3DData {
  /** Lock rotation around X axis */
  lockRotationX: boolean;

  /** Lock rotation around Y axis */
  lockRotationY: boolean;

  /** Lock rotation around Z axis */
  lockRotationZ: boolean;
}

export const LockedAxes3D = component<LockedAxes3DData>(
  'LockedAxes3D',
  {
    lockRotationX: {
      serializable: true,
      instanceType: Boolean,
    },
    lockRotationY: {
      serializable: true,
      instanceType: Boolean,
    },
    lockRotationZ: {
      serializable: true,
      instanceType: Boolean,
    },
  },
  {
    path: 'physics/3d',
    defaultValue: () => ({
      lockRotationX: false,
      lockRotationY: false,
      lockRotationZ: false,
    }),
    displayName: 'Locked Axes 3D',
    description: 'Lock rotation axes for 3D physics bodies',
    customEditor: ({ componentData }) => {
      EditorLayout.beginLabelsWidth(['Lock X', 'Lock Y', 'Lock Z']);

      const [lockX, xChanged] = EditorLayout.checkboxField(
        'Lock X',
        componentData.lockRotationX,
        {
          tooltip: 'Lock rotation around X axis',
        }
      );
      if (xChanged) {
        componentData.lockRotationX = lockX;
      }

      const [lockY, yChanged] = EditorLayout.checkboxField(
        'Lock Y',
        componentData.lockRotationY,
        {
          tooltip: 'Lock rotation around Y axis',
        }
      );
      if (yChanged) {
        componentData.lockRotationY = lockY;
      }

      const [lockZ, zChanged] = EditorLayout.checkboxField(
        'Lock Z',
        componentData.lockRotationZ,
        {
          tooltip: 'Lock rotation around Z axis',
        }
      );
      if (zChanged) {
        componentData.lockRotationZ = lockZ;
      }

      EditorLayout.endLabelsWidth();
    },
  },
);
