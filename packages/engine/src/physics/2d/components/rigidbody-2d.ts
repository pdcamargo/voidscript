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

import { component } from '../../../ecs/component.js';
import type { BodyType } from '../../types.js';

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
  },
);
