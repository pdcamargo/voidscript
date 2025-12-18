/**
 * DesiredMovement2D Component
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
 *   .all(CharacterController2D, DesiredMovement2D)
 *   .each((entity, controller, movement) => {
 *     const input = new THREE.Vector2();
 *     if (Input.isKeyPressed(KeyCode.KeyA)) input.x -= 1;
 *     if (Input.isKeyPressed(KeyCode.KeyD)) input.x += 1;
 *     movement.translation.copy(input.normalize().multiplyScalar(speed * dt));
 *   });
 * ```
 */

import { component } from '../../../ecs/component.js';
import * as THREE from 'three';

export interface DesiredMovement2DData {
  /**
   * Desired translation vector for this frame (world space).
   * Set by user systems, consumed by physics system.
   * Automatically cleared after physics processing.
   */
  translation: THREE.Vector2;
}

const serializeVector2 = {
  serialize: (val: THREE.Vector2) => ({ x: val.x, y: val.y }),
  deserialize: (val: any) => new THREE.Vector2(val?.x ?? 0, val?.y ?? 0),
};

/**
 * Runtime component for character controller movement input.
 * Non-serializable - represents per-frame movement intent.
 */
export const DesiredMovement2D = component<DesiredMovement2DData>(
  'DesiredMovement2D',
  {
    translation: { serializable: true, customSerializer: serializeVector2 },
  },
  {
    path: 'physics/2d',
    defaultValue: () => ({
      translation: new THREE.Vector2(0, 0),
    }),
    displayName: 'Desired Movement 2D',
    description: 'Runtime movement input for character controller',
  },
);
