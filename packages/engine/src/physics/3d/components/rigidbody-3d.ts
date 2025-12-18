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

import { component } from '../../../ecs/component.js';
import type { BodyType } from '../../types.js';

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
  },
);
