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

import { component } from "../../component.js";
import type { Entity } from "../../entity.js";
import { ImGui } from "@mori2003/jsimgui";

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
      // Blend Time slider
      ImGui.Text("Blend Time:");
      const blendTime: [number] = [componentData.blendTime];
      if (ImGui.SliderFloat("##blendTime", blendTime, 0, 3)) {
        componentData.blendTime = blendTime[0];
      }

      // Blend Curve dropdown
      ImGui.Text("Blend Curve:");
      const curves: BlendCurve[] = ["linear", "easeIn", "easeOut", "easeInOut"];
      if (ImGui.BeginCombo("##blendCurve", componentData.blendCurve)) {
        for (const curve of curves) {
          const isSelected = componentData.blendCurve === curve;
          if (ImGui.Selectable(curve, isSelected)) {
            componentData.blendCurve = curve;
          }
          if (isSelected) {
            ImGui.SetItemDefaultFocus();
          }
        }
        ImGui.EndCombo();
      }

      // Update Mode dropdown
      ImGui.Text("Update Mode:");
      const modes: CameraBrainUpdateMode[] = [
        "update",
        "fixedUpdate",
        "lateUpdate",
      ];
      if (ImGui.BeginCombo("##updateMode", componentData.updateMode)) {
        for (const mode of modes) {
          const isSelected = componentData.updateMode === mode;
          if (ImGui.Selectable(mode, isSelected)) {
            componentData.updateMode = mode;
          }
          if (isSelected) {
            ImGui.SetItemDefaultFocus();
          }
        }
        ImGui.EndCombo();
      }

      ImGui.Separator();

      // World Up
      ImGui.Text("World Up:");
      const worldUp = [
        componentData.worldUp.x,
        componentData.worldUp.y,
        componentData.worldUp.z,
      ] as [number, number, number];
      if (ImGui.DragFloat3("##worldUp", worldUp, 0.1, -1, 1)) {
        componentData.worldUp = { x: worldUp[0], y: worldUp[1], z: worldUp[2] };
      }

      ImGui.Separator();

      // Runtime status (read-only)
      ImGui.TextColored(
        { x: 0.6, y: 0.6, z: 0.6, w: 1 },
        "Runtime Status:"
      );
      ImGui.Text(
        `Active VCam: ${componentData._activeVCam !== null ? `Entity ${componentData._activeVCam}` : "None"}`
      );
      ImGui.Text(`Blending: ${componentData._isBlending ? "Yes" : "No"}`);
      if (componentData._isBlending) {
        ImGui.ProgressBar(componentData._blendProgress, { x: -1, y: 0 });
      }
    },
  }
);
