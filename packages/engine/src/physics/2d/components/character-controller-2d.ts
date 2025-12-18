/**
 * CharacterController2D Component
 *
 * Provides kinematic character movement with automatic collision resolution (move-and-slide).
 * Based on Rapier's KinematicCharacterController API.
 *
 * Features:
 * - Automatic collision response (sliding along walls)
 * - Slope handling (climb shallow slopes, slide down steep ones)
 * - Auto-stepping (climb stairs and small obstacles)
 * - Snap-to-ground (stick to terrain when moving downhill)
 * - Ground detection (for jump logic)
 *
 * Usage:
 * - Requires Collider2D component
 * - Works with kinematic RigidBody2D (recommended) or standalone collider
 * - Use DesiredMovement2D to set intended movement each frame
 * - Check PhysicsObject2D.isGrounded for ground state
 *
 * @see https://rapier.rs/docs/user_guides/javascript/character_controller
 */

import { component } from '../../../ecs/component.js';
import * as THREE from 'three';

export interface CharacterController2DData {
  /**
   * Offset to maintain between character and obstacles (default: 0.01).
   * Small gap for numerical stability.
   */
  offset: number;

  /**
   * Up direction vector defining vertical axis (default: (0, 1)).
   * Determines what counts as floor/ceiling and horizontal movement.
   */
  up: THREE.Vector2;

  /**
   * Maximum slope angle the character can climb, in radians (default: π/4 = 45°).
   * Slopes steeper than this will be treated as walls.
   */
  maxSlopeClimbAngle: number;

  /**
   * Minimum slope angle before sliding starts, in radians (default: π/3 = 60°).
   * Character will slide down slopes steeper than this.
   */
  minSlopeSlideAngle: number;

  /**
   * Enable automatic step climbing (default: false).
   * Allows traversing stairs and small obstacles.
   */
  autostepEnabled: boolean;

  /**
   * Maximum step height for auto-stepping (default: 0.5).
   * Only relevant if autostepEnabled is true.
   */
  autostepMaxHeight: number;

  /**
   * Minimum step width for auto-stepping (default: 0.2).
   * Only relevant if autostepEnabled is true.
   */
  autostepMinWidth: number;

  /**
   * Whether auto-stepping includes dynamic bodies (default: false).
   * If true, can step onto moving objects.
   */
  autostepIncludesDynamicBodies: boolean;

  /**
   * Enable snap-to-ground (default: false).
   * Forces character downward when moving downhill to stay grounded.
   */
  snapToGroundEnabled: boolean;

  /**
   * Maximum distance to snap downward (default: 0.2).
   * Only relevant if snapToGroundEnabled is true.
   */
  snapToGroundDistance: number;

  /**
   * Enable sliding along surfaces (default: true).
   * If false, character stops completely on contact.
   */
  slideEnabled: boolean;

  /**
   * Normal nudge factor (default: 0.0).
   * Increase slightly (e.g., 0.01) if character gets stuck on surfaces.
   */
  normalNudgeFactor: number;

  /**
   * Whether to apply impulses to dynamic bodies when pushing them (default: false).
   * Requires characterMass to be set.
   */
  applyImpulsesToDynamicBodies: boolean;

  /**
   * Character mass for computing push forces (default: null = auto from rigid body).
   * Only relevant if applyImpulsesToDynamicBodies is true.
   */
  characterMass: number | null;
}

const serializeVector2 = {
  serialize: (val: THREE.Vector2) => ({ x: val.x, y: val.y }),
  deserialize: (val: any) => new THREE.Vector2(val.x, val.y),
};

/**
 * Character controller component for kinematic character movement.
 * Provides move-and-slide functionality with collision resolution.
 */
export const CharacterController2D = component<CharacterController2DData>(
  'CharacterController2D',
  {
    offset: { serializable: true, instanceType: Number },
    up: { serializable: true, customSerializer: serializeVector2 },
    maxSlopeClimbAngle: { serializable: true, instanceType: Number },
    minSlopeSlideAngle: { serializable: true, instanceType: Number },
    autostepEnabled: { serializable: true, instanceType: Boolean },
    autostepMaxHeight: { serializable: true, instanceType: Number },
    autostepMinWidth: { serializable: true, instanceType: Number },
    autostepIncludesDynamicBodies: { serializable: true, instanceType: Boolean },
    snapToGroundEnabled: { serializable: true, instanceType: Boolean },
    snapToGroundDistance: { serializable: true, instanceType: Number },
    slideEnabled: { serializable: true, instanceType: Boolean },
    normalNudgeFactor: { serializable: true, instanceType: Number },
    applyImpulsesToDynamicBodies: { serializable: true, instanceType: Boolean },
    characterMass: { serializable: true },
  },
  {
    path: 'physics/2d',
    defaultValue: () => ({
      offset: 0.01,
      up: new THREE.Vector2(0, 1),
      maxSlopeClimbAngle: Math.PI / 4, // 45 degrees
      minSlopeSlideAngle: Math.PI / 3, // 60 degrees
      autostepEnabled: false,
      autostepMaxHeight: 0.5,
      autostepMinWidth: 0.2,
      autostepIncludesDynamicBodies: false,
      snapToGroundEnabled: false,
      snapToGroundDistance: 0.2,
      slideEnabled: true,
      normalNudgeFactor: 0.0,
      applyImpulsesToDynamicBodies: false,
      characterMass: null,
    }),
    displayName: 'Character Controller 2D',
    description: 'Kinematic character controller with move-and-slide',
  },
);
