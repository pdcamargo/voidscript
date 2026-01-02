/**
 * DesiredMovement3D Component
 *
 * Runtime component for character controller movement input.
 * Set this each frame to specify intended movement direction.
 * The physics system will compute actual safe movement accounting for collisions.
 *
 * Lifecycle:
 * - User sets translation in UPDATE phase
 * - Physics system computes movement in FIXEDUPDATE phase
 * - Translation is cleared automatically after processing
 *
 * Usage:
 * ```typescript
 * // In your movement system:
 * commands
 *   .query()
 *   .all(CharacterController3D, DesiredMovement3D)
 *   .each((entity, controller, movement) => {
 *     const input = new THREE.Vector3();
 *     if (Input.isKeyPressed(KeyCode.KeyW)) input.z -= 1;
 *     movement.translation.copy(input.normalize().multiplyScalar(speed * dt));
 *   });
 * ```
 */

import { component } from '@voidscript/core';
import * as THREE from 'three';

export interface DesiredMovement3DData {
  /**
   * Desired translation vector for this frame (world space).
   * Set by user systems, consumed by physics system.
   * Automatically cleared after physics processing.
   */
  translation: THREE.Vector3;
}

const serializeVector3 = {
  serialize: (val: THREE.Vector3) => ({ x: val.x, y: val.y, z: val.z }),
  deserialize: (val: any) => new THREE.Vector3(val?.x ?? 0, val?.y ?? 0, val?.z ?? 0),
};

/**
 * Runtime component for character controller movement input.
 * Non-serializable - represents per-frame movement intent.
 */
export const DesiredMovement3D = component<DesiredMovement3DData>(
  'DesiredMovement3D',
  {
    translation: { serializable: true, customSerializer: serializeVector3 },
  },
  {
    path: 'physics/3d',
    defaultValue: () => ({
      translation: new THREE.Vector3(0, 0, 0),
    }),
    displayName: 'Desired Movement 3D',
    description: 'Runtime movement input for character controller',
  },
);
