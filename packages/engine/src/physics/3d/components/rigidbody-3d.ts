/**
 * RigidBody3D Component
 *
 * Core physics body for 3D simulation.
 * Must be combined with Transform3D to define position/rotation.
 *
 * Body Types:
 * - dynamic: Affected by forces, gravity, and collisions (e.g., falling objects, characters)
 * - static: Never moves, infinite mass (e.g., walls, ground, platforms)
 * - kinematic: Moves via velocity, not affected by forces (e.g., moving platforms, elevators)
 *
 * Optional Components:
 * - Velocity3D: Control linear/angular velocity
 * - GravityScale: Modify gravity effect
 * - Damping: Add air resistance
 * - Ccd: Prevent tunneling for fast objects
 * - LockedAxes3D: Lock rotation on specific axes
 * - Collider3D: Add collision shape
 */

import { component } from '@voidscript/core';
import type { BodyType } from '../../types.js';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

export interface RigidBody3DData {
  /** Body type: dynamic, static, or kinematic */
  bodyType: BodyType;

  /** Can the body sleep? (performance optimization, default: true) */
  canSleep: boolean;
}

export const RigidBody3D = component<RigidBody3DData>(
  'RigidBody3D',
  {
    bodyType: {
      serializable: true,
      instanceType: String,
    },
    canSleep: {
      serializable: true,
      instanceType: Boolean,
    },
  },
  {
    path: 'physics/3d',
    defaultValue: () => ({
      bodyType: 'dynamic',
      canSleep: true,
    }),
    displayName: 'Rigid Body 3D',
    description: 'Physics rigid body for 3D simulation',
    customEditor: ({ componentData }) => {
      EditorLayout.beginLabelsWidth(['Body Type', 'Can Sleep']);

      // Body Type dropdown
      const bodyTypes = ['dynamic', 'static', 'kinematic'] as const;
      const [bodyType, bodyTypeChanged] = EditorLayout.comboField(
        'Body Type',
        componentData.bodyType,
        [...bodyTypes],
        {
          tooltip: 'dynamic: affected by forces/gravity, static: never moves, kinematic: moves via velocity only',
        }
      );
      if (bodyTypeChanged) {
        componentData.bodyType = bodyType as BodyType;
      }

      // Can Sleep checkbox
      const [canSleep, canSleepChanged] = EditorLayout.checkboxField(
        'Can Sleep',
        componentData.canSleep,
        {
          tooltip: 'Performance optimization - allows body to sleep when inactive',
        }
      );
      if (canSleepChanged) {
        componentData.canSleep = canSleep;
      }

      EditorLayout.endLabelsWidth();
    },
  },
);
