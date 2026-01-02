/**
 * CameraBrain Component
 *
 * The CameraBrain is the "director" that controls the main camera based on active virtual cameras.
 * It handles smooth blending between virtual cameras when the active camera changes.
 *
 * Add this component to an entity that also has MainCamera and Camera components.
 * The brain will automatically sync the Camera/Transform3D to match the highest priority
 * enabled VirtualCamera in the scene.
 *
 * @example
 * ```typescript
 * // Create main camera with brain
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 0, 10) })
 *   .with(Camera, { type: 'perspective', fov: 60 })
 *   .with(MainCamera, {})
 *   .with(CameraBrain, { blendTime: 0.5, blendCurve: 'easeInOut' })
 *   .build();
 * ```
 */

import { component } from "@voidscript/core";
import type { Entity } from "@voidscript/core";
import { EditorLayout } from '../../../app/imgui/editor-layout.js';
import { ImGui } from "@voidscript/imgui";

export type BlendCurve = "linear" | "easeIn" | "easeOut" | "easeInOut";
export type CameraBrainUpdateMode = "update" | "fixedUpdate" | "lateUpdate";

export interface CameraBrainData {
  /**
   * Blend time when transitioning between virtual cameras (seconds)
   * @default 0.5
   */
  blendTime: number;

  /**
   * Default blend curve/easing
   * @default 'easeInOut'
   */
  blendCurve: BlendCurve;

  /**
   * Update mode for camera processing
   * 'update' - Every frame
   * 'fixedUpdate' - Physics timestep (for physics-driven targets)
   * 'lateUpdate' - After all other updates
   * @default 'lateUpdate'
   */
  updateMode: CameraBrainUpdateMode;

  /**
   * World up axis (typically Y-up)
   * Used to constrain rotations in 2D follow modes
   * @default { x: 0, y: 1, z: 0 }
   */
  worldUp: { x: number; y: number; z: number };

  // --- Internal state (not serialized) ---
  /** Currently active virtual camera entity (runtime) */
  _activeVCam: Entity | null;
  /** Previous virtual camera entity for blending (runtime) */
  _previousVCam: Entity | null;
  /** Current blend progress 0-1 (runtime) */
  _blendProgress: number;
  /** Is currently blending (runtime) */
  _isBlending: boolean;
}

export const CameraBrain = component<CameraBrainData>(
  "CameraBrain",
  {
    blendTime: { serializable: true },
    blendCurve: { serializable: true },
    updateMode: { serializable: true },
    worldUp: {
      serializable: true,
      customSerializer: {
        serialize: (val) => ({ x: val.x, y: val.y, z: val.z }),
        deserialize: (val) => val as { x: number; y: number; z: number },
      },
    },
    // Runtime state - not serialized
    _activeVCam: { serializable: false },
    _previousVCam: { serializable: false },
    _blendProgress: { serializable: false },
    _isBlending: { serializable: false },
  },
  {
    defaultValue: () => ({
      blendTime: 0.5,
      blendCurve: "easeInOut" as BlendCurve,
      updateMode: "lateUpdate" as CameraBrainUpdateMode,
      worldUp: { x: 0, y: 1, z: 0 },
      _activeVCam: null,
      _previousVCam: null,
      _blendProgress: 0,
      _isBlending: false,
    }),
    displayName: "Camera Brain",
    description:
      "Controls the main camera based on active virtual cameras with smooth blending",
    path: "rendering/camera",
    customEditor: ({ componentData }) => {
      EditorLayout.beginLabelsWidth(['Blend Time', 'Blend Curve', 'Update Mode', 'World Up']);

      const BlendCurveEnum = { linear: 'linear', easeIn: 'easeIn', easeOut: 'easeOut', easeInOut: 'easeInOut' } as const;
      const UpdateModeEnum = { update: 'update', fixedUpdate: 'fixedUpdate', lateUpdate: 'lateUpdate' } as const;

      const [blendTime, blendTimeChanged] = EditorLayout.numberField('Blend Time', componentData.blendTime, {
        min: 0, max: 3, useSlider: true, tooltip: 'Blend time in seconds when transitioning between virtual cameras',
      });
      if (blendTimeChanged) componentData.blendTime = blendTime;

      const [blendCurve, blendCurveChanged] = EditorLayout.enumField('Blend Curve', componentData.blendCurve, BlendCurveEnum, {
        tooltip: 'Easing curve for camera transitions',
      });
      if (blendCurveChanged) componentData.blendCurve = blendCurve;

      const [updateMode, updateModeChanged] = EditorLayout.enumField('Update Mode', componentData.updateMode, UpdateModeEnum, {
        tooltip: 'When to update the camera (update, fixedUpdate, or lateUpdate)',
      });
      if (updateModeChanged) componentData.updateMode = updateMode;

      EditorLayout.separator();

      const [worldUp, worldUpChanged] = EditorLayout.vector3Field('World Up', componentData.worldUp, {
        min: -1, max: 1, speed: 0.1, tooltip: 'World up axis for camera orientation',
      });
      if (worldUpChanged) componentData.worldUp = worldUp;

      EditorLayout.endLabelsWidth();

      EditorLayout.separator();

      // Runtime status (read-only)
      EditorLayout.textDisabled('Runtime Status:');
      EditorLayout.text(`Active VCam: ${componentData._activeVCam !== null ? `Entity ${componentData._activeVCam}` : 'None'}`);
      EditorLayout.text(`Blending: ${componentData._isBlending ? 'Yes' : 'No'}`);
      if (componentData._isBlending) {
        ImGui.ProgressBar(componentData._blendProgress, { x: -1, y: 0 });
      }
    },
  }
);
