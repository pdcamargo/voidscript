/**
 * VirtualCameraFollow Component
 *
 * Controls how a VirtualCamera follows a target entity.
 * Supports multiple follow modes with configurable damping and look-ahead.
 *
 * @example
 * ```typescript
 * // Basic 3D follow
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 5, -10) })
 *   .with(VirtualCamera, { priority: 10 })
 *   .with(VirtualCameraFollow, {
 *     target: playerEntity,
 *     mode: 'transposer',
 *     offset: { x: 0, y: 5, z: -10 },
 *     damping: 2,
 *   })
 *   .build();
 *
 * // 2D platformer follow
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 0, 10) })
 *   .with(VirtualCamera, { type: 'orthographic', size: 10 })
 *   .with(VirtualCameraFollow, {
 *     target: playerEntity,
 *     mode: '2dFollow',
 *     offset: { x: 0, y: 2, z: 0 },
 *     ignoreZ: true,
 *   })
 *   .build();
 * ```
 */

import { component } from "../../component.js";
import type { Entity } from "../../entity.js";
import { ImGui } from "@mori2003/jsimgui";
import { entityPicker } from "../../../app/imgui/entity-picker.js";

export type FollowMode =
  | "none" // No following
  | "hardLock" // Instant position sync
  | "transposer" // Position offset with damping
  | "framedTransposer" // Transposer with screen-space framing
  | "orbitalTransposer" // Orbit around target
  | "2dFollow"; // Optimized for 2D (XY only)

export interface FollowDeadZone {
  /** Dead zone width in viewport units (0-1) */
  width: number;
  /** Dead zone height in viewport units (0-1) */
  height: number;
}

export interface FollowSoftZone {
  /** Soft zone width in viewport units (0-1) */
  width: number;
  /** Soft zone height in viewport units (0-1) */
  height: number;
}

export interface VirtualCameraFollowData {
  /**
   * Target entity to follow
   * @default null
   */
  target: Entity | null;

  /**
   * Follow mode determining behavior
   * @default 'transposer'
   */
  mode: FollowMode;

  /**
   * Position offset from target (world space)
   * @default { x: 0, y: 2, z: -10 }
   */
  offset: { x: number; y: number; z: number };

  /**
   * Damping factor for position (higher = smoother/slower)
   * @default 1
   */
  damping: number;

  /**
   * Separate damping values for each axis (if null, uses uniform damping)
   * @default null
   */
  dampingPerAxis: { x: number; y: number; z: number } | null;

  /**
   * Look-ahead time based on target velocity (seconds)
   * Camera anticipates where target will be
   * @default 0
   */
  lookaheadTime: number;

  /**
   * Smoothing for look-ahead (higher = smoother response to velocity changes)
   * @default 10
   */
  lookaheadSmoothing: number;

  /**
   * Ignore target's Z position (useful for 2D games)
   * @default false
   */
  ignoreZ: boolean;

  // --- Screen-space framing (for framedTransposer) ---
  /**
   * Target screen position (0-1, where 0.5 is center)
   * @default { x: 0.5, y: 0.5 }
   */
  screenPosition: { x: number; y: number };

  /**
   * Dead zone where target can move without camera response
   * @default { width: 0.1, height: 0.1 }
   */
  deadZone: FollowDeadZone;

  /**
   * Soft zone where camera smoothly adjusts
   * @default { width: 0.8, height: 0.8 }
   */
  softZone: FollowSoftZone;

  // --- Orbital settings (for orbitalTransposer) ---
  /**
   * Orbital distance from target
   * @default 10
   */
  orbitalRadius: number;

  /**
   * Current orbital angle (horizontal, degrees)
   * @default 0
   */
  orbitalAngleX: number;

  /**
   * Current orbital angle (vertical, degrees)
   * @default 15
   */
  orbitalAngleY: number;

  /**
   * Allow user input to control orbital angles
   * @default false
   */
  orbitalUserControl: boolean;

  // --- Internal runtime state ---
  /** Last known target position (for velocity calculation) */
  _lastTargetPosition: { x: number; y: number; z: number } | null;
  /** Calculated target velocity */
  _targetVelocity: { x: number; y: number; z: number };
  /** Smoothed look-ahead position */
  _lookaheadPosition: { x: number; y: number; z: number };
}

export const VirtualCameraFollow = component<VirtualCameraFollowData>(
  "VirtualCameraFollow",
  {
    target: {
      serializable: true,
      type: "entity",
      whenNullish: "keep",
      isNullable: true,
    },
    mode: { serializable: true },
    offset: {
      serializable: true,
      customSerializer: {
        serialize: (val) => ({ x: val.x, y: val.y, z: val.z }),
        deserialize: (val) => val as { x: number; y: number; z: number },
      },
    },
    damping: { serializable: true },
    dampingPerAxis: {
      serializable: true,
      whenNullish: "keep",
      isNullable: true,
      customSerializer: {
        serialize: (val) =>
          val ? { x: val.x, y: val.y, z: val.z } : null,
        deserialize: (val) =>
          val as { x: number; y: number; z: number } | null,
      },
    },
    lookaheadTime: { serializable: true },
    lookaheadSmoothing: { serializable: true },
    ignoreZ: { serializable: true },
    screenPosition: {
      serializable: true,
      customSerializer: {
        serialize: (val) => ({ x: val.x, y: val.y }),
        deserialize: (val) => val as { x: number; y: number },
      },
    },
    deadZone: {
      serializable: true,
      customSerializer: {
        serialize: (val) => ({ width: val.width, height: val.height }),
        deserialize: (val) => val as FollowDeadZone,
      },
    },
    softZone: {
      serializable: true,
      customSerializer: {
        serialize: (val) => ({ width: val.width, height: val.height }),
        deserialize: (val) => val as FollowSoftZone,
      },
    },
    orbitalRadius: { serializable: true },
    orbitalAngleX: { serializable: true },
    orbitalAngleY: { serializable: true },
    orbitalUserControl: { serializable: true },
    // Runtime state - not serialized
    _lastTargetPosition: { serializable: false },
    _targetVelocity: { serializable: false },
    _lookaheadPosition: { serializable: false },
  },
  {
    defaultValue: () => ({
      target: null,
      mode: "transposer" as FollowMode,
      offset: { x: 0, y: 2, z: -10 },
      damping: 1,
      dampingPerAxis: null,
      lookaheadTime: 0,
      lookaheadSmoothing: 10,
      ignoreZ: false,
      screenPosition: { x: 0.5, y: 0.5 },
      deadZone: { width: 0.1, height: 0.1 },
      softZone: { width: 0.8, height: 0.8 },
      orbitalRadius: 10,
      orbitalAngleX: 0,
      orbitalAngleY: 15,
      orbitalUserControl: false,
      _lastTargetPosition: null,
      _targetVelocity: { x: 0, y: 0, z: 0 },
      _lookaheadPosition: { x: 0, y: 0, z: 0 },
    }),
    displayName: "Virtual Camera Follow",
    description: "Controls how a virtual camera follows a target entity",
    path: "rendering/camera",
    customEditor: ({ componentData, commands }) => {
      // Target entity picker
      ImGui.Text("Target Entity:");
      const result = entityPicker({
        label: "target",
        currentEntity: componentData.target,
        commands,
        allowNone: true,
      });
      if (result.changed) {
        componentData.target = result.entity;
      }

      ImGui.Separator();

      // Follow Mode
      ImGui.Text("Follow Mode:");
      const modes: FollowMode[] = [
        "none",
        "hardLock",
        "transposer",
        "framedTransposer",
        "orbitalTransposer",
        "2dFollow",
      ];
      if (ImGui.BeginCombo("##mode", componentData.mode)) {
        for (const mode of modes) {
          const isSelected = componentData.mode === mode;
          if (ImGui.Selectable(mode, isSelected)) {
            componentData.mode = mode;
          }
          if (isSelected) {
            ImGui.SetItemDefaultFocus();
          }
        }
        ImGui.EndCombo();
      }

      ImGui.Separator();

      // Common settings (shown for most modes)
      if (componentData.mode !== "none") {
        ImGui.Text("Position Offset:");
        const offset = [
          componentData.offset.x,
          componentData.offset.y,
          componentData.offset.z,
        ] as [number, number, number];
        if (ImGui.DragFloat3("##offset", offset, 0.1)) {
          componentData.offset = { x: offset[0], y: offset[1], z: offset[2] };
        }

        // Damping (not for hardLock)
        if (componentData.mode !== "hardLock") {
          ImGui.Separator();
          ImGui.Text("Damping:");
          const damping: [number] = [componentData.damping];
          if (ImGui.DragFloat("##damping", damping, 0.1, 0, 20)) {
            componentData.damping = damping[0];
          }

          // Per-axis damping toggle
          const hasPerAxis = componentData.dampingPerAxis !== null;
          const usePerAxis: [boolean] = [hasPerAxis];
          if (ImGui.Checkbox("Per-Axis Damping##usePerAxis", usePerAxis)) {
            if (usePerAxis[0] && !hasPerAxis) {
              componentData.dampingPerAxis = {
                x: componentData.damping,
                y: componentData.damping,
                z: componentData.damping,
              };
            } else if (!usePerAxis[0] && hasPerAxis) {
              componentData.dampingPerAxis = null;
            }
          }

          if (componentData.dampingPerAxis) {
            const perAxis = [
              componentData.dampingPerAxis.x,
              componentData.dampingPerAxis.y,
              componentData.dampingPerAxis.z,
            ] as [number, number, number];
            if (ImGui.DragFloat3("##dampingPerAxis", perAxis, 0.1, 0, 20)) {
              componentData.dampingPerAxis = {
                x: perAxis[0],
                y: perAxis[1],
                z: perAxis[2],
              };
            }
          }

          ImGui.Separator();
          // Look-ahead settings
          ImGui.Text("Look-Ahead:");
          const lookaheadTime: [number] = [componentData.lookaheadTime];
          if (
            ImGui.DragFloat("Time##lookahead", lookaheadTime, 0.01, 0, 2)
          ) {
            componentData.lookaheadTime = lookaheadTime[0];
          }

          if (componentData.lookaheadTime > 0) {
            const lookaheadSmoothing: [number] = [
              componentData.lookaheadSmoothing,
            ];
            if (
              ImGui.DragFloat(
                "Smoothing##lookaheadSmooth",
                lookaheadSmoothing,
                0.5,
                1,
                50
              )
            ) {
              componentData.lookaheadSmoothing = lookaheadSmoothing[0];
            }
          }
        }

        // 2D specific
        if (
          componentData.mode === "2dFollow" ||
          componentData.mode === "transposer"
        ) {
          ImGui.Separator();
          const ignoreZ: [boolean] = [componentData.ignoreZ];
          if (ImGui.Checkbox("Ignore Z (2D Mode)##ignoreZ", ignoreZ)) {
            componentData.ignoreZ = ignoreZ[0];
          }
        }

        // Framed transposer specific
        if (componentData.mode === "framedTransposer") {
          ImGui.Separator();
          ImGui.TextColored(
            { x: 0.6, y: 0.8, z: 1, w: 1 },
            "Screen Framing:"
          );

          ImGui.Text("Screen Position (0-1):");
          const screenPos = [
            componentData.screenPosition.x,
            componentData.screenPosition.y,
          ] as [number, number];
          if (ImGui.SliderFloat2("##screenPos", screenPos, 0, 1)) {
            componentData.screenPosition = { x: screenPos[0], y: screenPos[1] };
          }

          ImGui.Text("Dead Zone:");
          const deadZone = [
            componentData.deadZone.width,
            componentData.deadZone.height,
          ] as [number, number];
          if (ImGui.SliderFloat2("##deadZone", deadZone, 0, 1)) {
            componentData.deadZone = {
              width: deadZone[0],
              height: deadZone[1],
            };
          }

          ImGui.Text("Soft Zone:");
          const softZone = [
            componentData.softZone.width,
            componentData.softZone.height,
          ] as [number, number];
          if (ImGui.SliderFloat2("##softZone", softZone, 0, 1)) {
            componentData.softZone = {
              width: softZone[0],
              height: softZone[1],
            };
          }
        }

        // Orbital settings
        if (componentData.mode === "orbitalTransposer") {
          ImGui.Separator();
          ImGui.TextColored({ x: 0.6, y: 0.8, z: 1, w: 1 }, "Orbital Settings:");

          const radius: [number] = [componentData.orbitalRadius];
          if (
            ImGui.DragFloat("Orbital Radius##radius", radius, 0.1, 0.1, 100)
          ) {
            componentData.orbitalRadius = radius[0];
          }

          const angleX: [number] = [componentData.orbitalAngleX];
          if (
            ImGui.SliderFloat("Horizontal Angle##angleX", angleX, -180, 180)
          ) {
            componentData.orbitalAngleX = angleX[0];
          }

          const angleY: [number] = [componentData.orbitalAngleY];
          if (ImGui.SliderFloat("Vertical Angle##angleY", angleY, -89, 89)) {
            componentData.orbitalAngleY = angleY[0];
          }

          const userControl: [boolean] = [componentData.orbitalUserControl];
          if (ImGui.Checkbox("User Control##userControl", userControl)) {
            componentData.orbitalUserControl = userControl[0];
          }
        }
      }
    },
  }
);
