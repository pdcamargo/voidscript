/**
 * Velocity2D Component
 *
 * Linear and angular velocity for 2D physics bodies.
 * Optional component - add to RigidBody2D to control/read velocity.
 *
 * Usage:
 * - Read velocity after physics simulation (e.g., for animation states)
 * - Set velocity to apply instant movement (e.g., jump, dash)
 * - For gradual acceleration, prefer applying forces via physics context
 *
 * Units:
 * - Linear: pixels/second (matches 2D coordinate system)
 * - Angular: radians/second (positive = counter-clockwise)
 */

import { component } from '@voidscript/core';
import * as THREE from 'three';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

export interface Velocity2DData {
  /** Linear velocity in pixels/second */
  linear: THREE.Vector2;

  /** Angular velocity in radians/second */
  angular: number;
}

const serializeVector2 = {
  serialize: (val: THREE.Vector2) => ({ x: val.x, y: val.y }),
  deserialize: (val: any) => new THREE.Vector2(val.x, val.y),
};

export const Velocity2D = component<Velocity2DData>(
  'Velocity2D',
  {
    linear: {
      serializable: true,
      customSerializer: serializeVector2,
    },
    angular: {
      serializable: true,
      instanceType: Number,
    },
  },
  {
    path: 'physics/2d',
    defaultValue: () => ({
      linear: new THREE.Vector2(0, 0),
      angular: 0,
    }),
    displayName: 'Velocity 2D',
    description: 'Linear and angular velocity for 2D physics',
    customEditor: ({ componentData }) => {
      EditorLayout.beginLabelsWidth(['Linear Velocity', 'Angular Velocity']);

      const [linear, linearChanged] = EditorLayout.vector2Field(
        'Linear Velocity',
        componentData.linear,
        {
          speed: 1,
          tooltip: 'Linear velocity in pixels/second',
        }
      );
      if (linearChanged) {
        componentData.linear.x = linear.x;
        componentData.linear.y = linear.y;
      }

      const [angular, angularChanged] = EditorLayout.numberField(
        'Angular Velocity',
        componentData.angular,
        {
          speed: 0.1,
          tooltip: 'Angular velocity in radians/second (positive = counter-clockwise)',
        }
      );
      if (angularChanged) {
        componentData.angular = angular;
      }

      EditorLayout.endLabelsWidth();
    },
  },
);
