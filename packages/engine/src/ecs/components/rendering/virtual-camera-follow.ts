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

import { component } from "@voidscript/core";
import type { Entity } from "@voidscript/core";
import { EditorLayout } from "../../../app/imgui/editor-layout.js";

export type FollowMode =
  | "none" // No following
  | "hardLock" // Instant position sync
  | "transposer" // Position offset with damping (supports optional dead zone)
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

  /**
   * Enable dead zone framing (only applies to transposer mode)
   * @default false
   */
  enableDeadZone: boolean;

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
    enableDeadZone: { serializable: true },
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
      enableDeadZone: false,
      screenPosition: { x: 0.5, y: 0.5 },
      deadZone: { width: 0.1, height: 0.1 },
      softZone: { width: 0.3, height: 0.3 },
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
    showHelper: true,
    customEditor: ({ componentData }) => {
      EditorLayout.beginLabelsWidth(['Target Entity', 'Follow Mode', 'Position Offset']);

      // Target entity picker
      const [target, targetChanged] = EditorLayout.entityField("Target Entity", componentData.target, {
        allowNone: true,
        tooltip: "Entity to follow"
      });
      if (targetChanged) componentData.target = target;

      EditorLayout.separator();

      // Follow Mode
      const FollowModeEnum = {
        none: "none",
        hardLock: "hardLock",
        transposer: "transposer",
        orbitalTransposer: "orbitalTransposer",
        "2dFollow": "2dFollow",
      } as const;
      const [mode, modeChanged] = EditorLayout.enumField("Follow Mode", componentData.mode, FollowModeEnum, {
        tooltip: "How the camera follows the target"
      });
      if (modeChanged) componentData.mode = mode;

      EditorLayout.endLabelsWidth();

      EditorLayout.separator();

      // Common settings (shown for most modes)
      if (componentData.mode !== "none") {
        EditorLayout.beginLabelsWidth(['Position Offset', 'Damping', 'Per-Axis Damping', 'Damping Per Axis', 'Ignore Z (2D Mode)']);

        const [offset, offsetChanged] = EditorLayout.vector3Field("Position Offset", componentData.offset, {
          speed: 0.1, tooltip: "Offset from target position (world space)"
        });
        if (offsetChanged) componentData.offset = { x: offset.x, y: offset.y, z: offset.z };

        // Damping (not for hardLock)
        if (componentData.mode !== "hardLock") {
          EditorLayout.separator();

          const [damping, dampingChanged] = EditorLayout.numberField("Damping", componentData.damping, {
            min: 0, max: 20, speed: 0.1, tooltip: "Higher = smoother/slower following"
          });
          if (dampingChanged) componentData.damping = damping;

          // Per-axis damping toggle
          const hasPerAxis = componentData.dampingPerAxis !== null;
          const [usePerAxis, usePerAxisChanged] = EditorLayout.checkboxField("Per-Axis Damping", hasPerAxis, {
            tooltip: "Use different damping values for each axis"
          });
          if (usePerAxisChanged) {
            if (usePerAxis && !hasPerAxis) {
              componentData.dampingPerAxis = {
                x: componentData.damping,
                y: componentData.damping,
                z: componentData.damping,
              };
            } else if (!usePerAxis && hasPerAxis) {
              componentData.dampingPerAxis = null;
            }
          }

          if (componentData.dampingPerAxis) {
            const [perAxis, perAxisChanged] = EditorLayout.vector3Field("Damping Per Axis", componentData.dampingPerAxis, {
              speed: 0.1, min: 0, max: 20, tooltip: "Damping values for X, Y, Z axes"
            });
            if (perAxisChanged) {
              componentData.dampingPerAxis = { x: perAxis.x, y: perAxis.y, z: perAxis.z };
            }
          }

          EditorLayout.endLabelsWidth();

          EditorLayout.separator();

          // Look-ahead settings
          EditorLayout.header("Look-Ahead", { r: 0.6, g: 0.8, b: 1 });

          EditorLayout.beginLabelsWidth(['Time', 'Smoothing']);

          const [lookaheadTime, lookaheadTimeChanged] = EditorLayout.numberField("Time", componentData.lookaheadTime, {
            min: 0, max: 2, speed: 0.01, tooltip: "Look-ahead time based on target velocity (seconds)"
          });
          if (lookaheadTimeChanged) componentData.lookaheadTime = lookaheadTime;

          if (componentData.lookaheadTime > 0) {
            const [lookaheadSmoothing, lookaheadSmoothingChanged] = EditorLayout.numberField("Smoothing", componentData.lookaheadSmoothing, {
              min: 1, max: 50, speed: 0.5, tooltip: "Smoothing for look-ahead response"
            });
            if (lookaheadSmoothingChanged) componentData.lookaheadSmoothing = lookaheadSmoothing;
          }

          EditorLayout.endLabelsWidth();
        } else {
          EditorLayout.endLabelsWidth();
        }

        // 2D specific
        if (
          componentData.mode === "2dFollow" ||
          componentData.mode === "transposer"
        ) {
          EditorLayout.separator();

          EditorLayout.beginLabelsWidth(['Ignore Z (2D Mode)']);

          const [ignoreZ, ignoreZChanged] = EditorLayout.checkboxField("Ignore Z (2D Mode)", componentData.ignoreZ, {
            tooltip: "Ignore target's Z position for 2D games"
          });
          if (ignoreZChanged) componentData.ignoreZ = ignoreZ;

          EditorLayout.endLabelsWidth();
        }

        // Transposer dead zone
        if (componentData.mode === "transposer") {
          EditorLayout.separator();
          EditorLayout.header("Dead Zone", { r: 0.6, g: 0.8, b: 1 });

          // Initialize missing properties for backward compatibility
          if (componentData.enableDeadZone === undefined) {
            componentData.enableDeadZone = false;
          }
          if (!componentData.deadZone) {
            componentData.deadZone = { width: 0.1, height: 0.1 };
          }
          if (!componentData.softZone) {
            componentData.softZone = { width: 0.3, height: 0.3 };
          }

          EditorLayout.beginLabelsWidth(['Enable Dead Zone', 'Dead Zone (viewport %)', 'Soft Zone (viewport %)']);

          const [enableDeadZone, enableDeadZoneChanged] = EditorLayout.checkboxField("Enable Dead Zone", componentData.enableDeadZone, {
            tooltip: "Target can move within dead zone without camera response"
          });
          if (enableDeadZoneChanged) componentData.enableDeadZone = enableDeadZone;

          // Only show dead zone settings if enabled
          if (componentData.enableDeadZone) {
            // Convert width/height to x/y for vector2Field
            const deadZoneXY = { x: componentData.deadZone.width, y: componentData.deadZone.height };
            const [deadZone, deadZoneChanged] = EditorLayout.vector2Field("Dead Zone (viewport %)", deadZoneXY, {
              speed: 0.01, min: 0, max: 1, tooltip: "Dead zone size in viewport percentage"
            });
            if (deadZoneChanged) {
              componentData.deadZone = { width: deadZone.x, height: deadZone.y };
            }

            const softZoneXY = { x: componentData.softZone.width, y: componentData.softZone.height };
            const [softZone, softZoneChanged] = EditorLayout.vector2Field("Soft Zone (viewport %)", softZoneXY, {
              speed: 0.01, min: 0, max: 1, tooltip: "Soft zone size in viewport percentage"
            });
            if (softZoneChanged) {
              componentData.softZone = { width: softZone.x, height: softZone.y };
            }
          } else {
            EditorLayout.textDisabled("(Dead zone disabled - smooth follow without dead zone)");
          }

          EditorLayout.endLabelsWidth();
        }

        // Orbital settings
        if (componentData.mode === "orbitalTransposer") {
          EditorLayout.separator();
          EditorLayout.header("Orbital Settings", { r: 0.6, g: 0.8, b: 1 });

          EditorLayout.beginLabelsWidth(['Orbital Radius', 'Horizontal Angle', 'Vertical Angle', 'User Control']);

          const [radius, radiusChanged] = EditorLayout.numberField("Orbital Radius", componentData.orbitalRadius, {
            min: 0.1, max: 100, speed: 0.1, tooltip: "Distance from target"
          });
          if (radiusChanged) componentData.orbitalRadius = radius;

          const [angleX, angleXChanged] = EditorLayout.numberField("Horizontal Angle", componentData.orbitalAngleX, {
            min: -180, max: 180, useSlider: true, tooltip: "Horizontal orbital angle (degrees)"
          });
          if (angleXChanged) componentData.orbitalAngleX = angleX;

          const [angleY, angleYChanged] = EditorLayout.numberField("Vertical Angle", componentData.orbitalAngleY, {
            min: -89, max: 89, useSlider: true, tooltip: "Vertical orbital angle (degrees)"
          });
          if (angleYChanged) componentData.orbitalAngleY = angleY;

          const [userControl, userControlChanged] = EditorLayout.checkboxField("User Control", componentData.orbitalUserControl, {
            tooltip: "Allow user input to control orbital angles"
          });
          if (userControlChanged) componentData.orbitalUserControl = userControl;

          EditorLayout.endLabelsWidth();
        }
      }
    },
  }
);
