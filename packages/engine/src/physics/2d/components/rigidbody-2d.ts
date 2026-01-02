/**
 * RigidBody2D Component
 *
 * Core physics body for 2D simulation.
 * Must be combined with Transform3D to define position/rotation.
 *
 * Body Types:
 * - dynamic: Affected by forces, gravity, and collisions (e.g., falling objects, characters)
 * - static: Never moves, infinite mass (e.g., walls, ground, platforms)
 * - kinematic: Moves via velocity, not affected by forces (e.g., moving platforms, elevators)
 *
 * Optional Components:
 * - Velocity2D: Control linear/angular velocity
 * - GravityScale: Modify gravity effect
 * - Damping: Add air resistance
 * - Ccd: Prevent tunneling for fast objects
 * - LockedAxes2D: Lock rotation
 * - Collider2D: Add collision shape
 */

import { component } from '@voidscript/core';
import type { BodyType } from '../../types.js';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

export interface RigidBody2DData {
  /** Body type: dynamic, static, or kinematic */
  bodyType: BodyType;

  /** Can the body sleep? (performance optimization, default: true) */
  canSleep: boolean;
}

export const RigidBody2D = component<RigidBody2DData>(
  'RigidBody2D',
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
    path: 'physics/2d',
    defaultValue: () => ({
      bodyType: 'dynamic',
      canSleep: true,
    }),
    displayName: 'Rigid Body 2D',
    description: 'Physics rigid body for 2D simulation',
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
