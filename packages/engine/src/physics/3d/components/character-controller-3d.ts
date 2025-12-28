/**
 * CharacterController3D Component
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
 * - Requires Collider3D component
 * - Works with kinematic RigidBody3D (recommended) or standalone collider
 * - Use DesiredMovement3D to set intended movement each frame
 * - Check PhysicsObject3D.isGrounded for ground state
 *
 * @see https://rapier.rs/docs/user_guides/javascript/character_controller
 */

import { component } from '../../../ecs/component.js';
import * as THREE from 'three';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

export interface CharacterController3DData {
  /**
   * Offset to maintain between character and obstacles (default: 0.01).
   * Small gap for numerical stability.
   */
  offset: number;

  /**
   * Up direction vector defining vertical axis (default: (0, 1, 0)).
   * Determines what counts as floor/ceiling and horizontal movement.
   */
  up: THREE.Vector3;

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

const serializeVector3 = {
  serialize: (val: THREE.Vector3) => ({ x: val.x, y: val.y, z: val.z }),
  deserialize: (val: any) => new THREE.Vector3(val.x, val.y, val.z),
};

// ============================================================================
// Custom Editor Helper Functions
// ============================================================================

function renderBasicSettingsSection3D(data: CharacterController3DData): void {
  if (EditorLayout.beginGroup('Basic Settings', true)) {
    EditorLayout.beginLabelsWidth(['Offset', 'Up Direction', 'Slide Enabled', 'Normal Nudge']);

    const [offset, offsetChanged] = EditorLayout.numberField('Offset', data.offset, {
      speed: 0.001,
      min: 0,
      max: 1,
      tooltip: 'Gap between character and obstacles for numerical stability',
    });
    if (offsetChanged) data.offset = offset;

    const [up, upChanged] = EditorLayout.vector3Field('Up Direction', data.up, {
      speed: 0.1,
      tooltip: 'Vertical axis direction (determines floor/ceiling)',
    });
    if (upChanged) {
      data.up.x = up.x;
      data.up.y = up.y;
      data.up.z = up.z;
    }

    const [slideEnabled, slideChanged] = EditorLayout.checkboxField('Slide Enabled', data.slideEnabled, {
      tooltip: 'Enable sliding along surfaces on contact',
    });
    if (slideChanged) data.slideEnabled = slideEnabled;

    const [normalNudge, nudgeChanged] = EditorLayout.numberField('Normal Nudge', data.normalNudgeFactor, {
      speed: 0.001,
      min: 0,
      max: 0.1,
      tooltip: 'Increase slightly if character gets stuck on surfaces',
    });
    if (nudgeChanged) data.normalNudgeFactor = normalNudge;

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderSlopeSettingsSection3D(data: CharacterController3DData): void {
  if (EditorLayout.beginGroup('Slope Settings', false)) {
    EditorLayout.beginLabelsWidth(['Max Climb Angle', 'Min Slide Angle']);

    const [maxClimb, maxClimbChanged] = EditorLayout.numberField('Max Climb Angle', data.maxSlopeClimbAngle, {
      speed: 0.01,
      min: 0,
      max: Math.PI / 2,
      tooltip: 'Maximum slope angle character can climb (radians)',
    });
    if (maxClimbChanged) data.maxSlopeClimbAngle = maxClimb;

    const [minSlide, minSlideChanged] = EditorLayout.numberField('Min Slide Angle', data.minSlopeSlideAngle, {
      speed: 0.01,
      min: 0,
      max: Math.PI / 2,
      tooltip: 'Minimum slope angle before sliding starts (radians)',
    });
    if (minSlideChanged) data.minSlopeSlideAngle = minSlide;

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderAutostepSection3D(data: CharacterController3DData): void {
  if (EditorLayout.beginGroup('Auto-Step', false)) {
    EditorLayout.beginLabelsWidth(['Enabled']);

    const [autostepEnabled, enabledChanged] = EditorLayout.checkboxField('Enabled', data.autostepEnabled, {
      tooltip: 'Enable automatic step climbing for stairs and obstacles',
    });
    if (enabledChanged) data.autostepEnabled = autostepEnabled;

    EditorLayout.endLabelsWidth();

    if (data.autostepEnabled) {
      EditorLayout.beginIndent();
      EditorLayout.beginLabelsWidth(['Max Height', 'Min Width', 'Include Dynamic']);

      const [maxHeight, maxHeightChanged] = EditorLayout.numberField('Max Height', data.autostepMaxHeight, {
        speed: 0.01,
        min: 0,
        max: 2,
        tooltip: 'Maximum step height to climb',
      });
      if (maxHeightChanged) data.autostepMaxHeight = maxHeight;

      const [minWidth, minWidthChanged] = EditorLayout.numberField('Min Width', data.autostepMinWidth, {
        speed: 0.01,
        min: 0,
        max: 1,
        tooltip: 'Minimum step width required',
      });
      if (minWidthChanged) data.autostepMinWidth = minWidth;

      const [includeDynamic, dynamicChanged] = EditorLayout.checkboxField('Include Dynamic', data.autostepIncludesDynamicBodies, {
        tooltip: 'Allow stepping onto moving objects',
      });
      if (dynamicChanged) data.autostepIncludesDynamicBodies = includeDynamic;

      EditorLayout.endLabelsWidth();
      EditorLayout.endIndent();
    }

    EditorLayout.endGroup();
  }
}

function renderSnapToGroundSection3D(data: CharacterController3DData): void {
  if (EditorLayout.beginGroup('Snap to Ground', false)) {
    EditorLayout.beginLabelsWidth(['Enabled']);

    const [snapEnabled, enabledChanged] = EditorLayout.checkboxField('Enabled', data.snapToGroundEnabled, {
      tooltip: 'Force character downward when moving downhill',
    });
    if (enabledChanged) data.snapToGroundEnabled = snapEnabled;

    EditorLayout.endLabelsWidth();

    if (data.snapToGroundEnabled) {
      EditorLayout.beginIndent();
      EditorLayout.beginLabelsWidth(['Snap Distance']);

      const [snapDist, distChanged] = EditorLayout.numberField('Snap Distance', data.snapToGroundDistance, {
        speed: 0.01,
        min: 0,
        max: 1,
        tooltip: 'Maximum distance to snap downward',
      });
      if (distChanged) data.snapToGroundDistance = snapDist;

      EditorLayout.endLabelsWidth();
      EditorLayout.endIndent();
    }

    EditorLayout.endGroup();
  }
}

function renderPushSettingsSection3D(data: CharacterController3DData): void {
  if (EditorLayout.beginGroup('Push Settings', false)) {
    EditorLayout.beginLabelsWidth(['Apply Impulses']);

    const [applyImpulses, impulsesChanged] = EditorLayout.checkboxField('Apply Impulses', data.applyImpulsesToDynamicBodies, {
      tooltip: 'Apply impulses to dynamic bodies when pushing them',
    });
    if (impulsesChanged) data.applyImpulsesToDynamicBodies = applyImpulses;

    EditorLayout.endLabelsWidth();

    if (data.applyImpulsesToDynamicBodies) {
      EditorLayout.beginIndent();
      EditorLayout.beginLabelsWidth(['Character Mass']);

      const massValue = data.characterMass ?? 0;
      const [mass, massChanged] = EditorLayout.numberField('Character Mass', massValue, {
        speed: 0.1,
        min: 0,
        max: 1000,
        tooltip: 'Character mass for push force calculation (0 = auto from rigid body)',
      });
      if (massChanged) {
        data.characterMass = mass > 0 ? mass : null;
      }

      EditorLayout.endLabelsWidth();
      EditorLayout.endIndent();
    }

    EditorLayout.endGroup();
  }
}

// ============================================================================
// Component Definition
// ============================================================================

/**
 * Character controller component for kinematic character movement.
 * Provides move-and-slide functionality with collision resolution.
 */
export const CharacterController3D = component<CharacterController3DData>(
  'CharacterController3D',
  {
    offset: { serializable: true, instanceType: Number },
    up: { serializable: true, customSerializer: serializeVector3 },
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
    path: 'physics/3d',
    defaultValue: () => ({
      offset: 0.01,
      up: new THREE.Vector3(0, 1, 0),
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
    displayName: 'Character Controller 3D',
    description: 'Kinematic character controller with move-and-slide',
    customEditor: ({ componentData }) => {
      renderBasicSettingsSection3D(componentData);
      renderSlopeSettingsSection3D(componentData);
      renderAutostepSection3D(componentData);
      renderSnapToGroundSection3D(componentData);
      renderPushSettingsSection3D(componentData);
    },
  },
);
