/**
 * Velocity3D Component
 *
 * Linear and angular velocity for 3D physics bodies.
 * Optional component - add to RigidBody3D to control/read velocity.
 *
 * Usage:
 * - Read velocity after physics simulation (e.g., for animation states)
 * - Set velocity to apply instant movement (e.g., jump, dash)
 * - For gradual acceleration, prefer applying forces via physics context
 *
 * Units:
 * - Linear: meters/second (matches 3D coordinate system)
 * - Angular: radians/second (rotation axis vector, magnitude = rotation speed)
 */

import { component } from '../../../ecs/component.js';
import * as THREE from 'three';

export interface Velocity3DData {
  /** Linear velocity in meters/second */
  linear: THREE.Vector3;

  /** Angular velocity in radians/second (axis-angle representation) */
  angular: THREE.Vector3;
}

const serializeVector3 = {
  serialize: (val: THREE.Vector3) => ({ x: val.x, y: val.y, z: val.z }),
  deserialize: (val: any) => new THREE.Vector3(val.x, val.y, val.z),
};

export const Velocity3D = component<Velocity3DData>(
  'Velocity3D',
  {
    linear: {
      serializable: true,
      customSerializer: serializeVector3,
    },
    angular: {
      serializable: true,
      customSerializer: serializeVector3,
    },
  },
  {
    path: 'physics/3d',
    defaultValue: () => ({
      linear: new THREE.Vector3(0, 0, 0),
      angular: new THREE.Vector3(0, 0, 0),
    }),
    displayName: 'Velocity 3D',
    description: 'Linear and angular velocity for 3D physics',
  },
);
