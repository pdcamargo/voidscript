/**
 * VirtualCamera Component
 *
 * A virtual camera defines a camera viewpoint with priority-based selection.
 * When multiple VirtualCameras exist, the CameraBrain will use the one with
 * the highest priority that is enabled.
 *
 * The VirtualCamera has the same projection properties as the Camera component
 * (fov, size, zoom, near, far, type) plus priority and enabled flags.
 *
 * @example
 * ```typescript
 * // Create a virtual camera following the player
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 5, -10) })
 *   .with(VirtualCamera, { priority: 10, type: 'perspective', fov: 60 })
 *   .with(VirtualCameraFollow, { target: playerEntity, mode: 'transposer' })
 *   .build();
 *
 * // Create a cutscene camera with higher priority
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 2, -5) })
 *   .with(VirtualCamera, { priority: 20, type: 'perspective', fov: 45, enabled: false })
 *   .build();
 *
 * // Create a virtual camera with bounds constraint
 * const boundsEntity = commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 0, 0) })
 *   .with(VirtualCameraBounds, { size: { x: 20, y: 15 } })
 *   .build();
 *
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 0, 10) })
 *   .with(VirtualCamera, { enableCameraBounds: true, boundsEntity: boundsEntity })
 *   .build();
 * ```
 */

import { component } from "../../component.js";
import type { Entity } from "../../entity.js";
import { EditorLayout } from "../../../app/imgui/editor-layout.js";
import { VirtualCameraBounds } from "./virtual-camera-bounds.js";

export interface VirtualCameraData {
  /**
   * Priority for camera selection (higher = more priority)
   * When multiple VirtualCameras exist, the one with highest priority becomes active
   * @default 10
   */
  priority: number;

  /**
   * Whether this virtual camera is enabled
   * Disabled cameras are ignored during selection
   * @default true
   */
  enabled: boolean;

  // --- Camera projection properties (same as Camera component) ---
  /**
   * Camera projection type
   * @default 'perspective'
   */
  type: "perspective" | "orthographic";

  /**
   * Field of view in degrees (vertical) - used for perspective cameras
   * @default 75
   */
  fov: number;

  /**
   * Half-height of the camera view in world units - used for orthographic cameras
   * @default 5
   */
  size: number;

  /**
   * Zoom multiplier (orthographic cameras only)
   * Applied as a divisor on the size (zoom=2 shows half the view)
   * @default 1
   */
  zoom: number;

  /**
   * Near clipping plane distance
   * @default 0.1
   */
  near: number;

  /**
   * Far clipping plane distance
   * @default 1000
   */
  far: number;

  /**
   * Dutch angle (roll) in degrees - camera rotation around forward axis
   * @default 0
   */
  dutch: number;

  // --- Camera bounds properties ---
  /**
   * Enable camera bounds clamping
   * When enabled, camera position will be constrained within the bounds
   * defined by the referenced boundsEntity.
   * @default false
   */
  enableCameraBounds: boolean;

  /**
   * Reference to an entity with VirtualCameraBounds component.
   * The camera's visible area will be constrained to stay within those bounds.
   * For orthographic cameras, this accounts for the camera's size/zoom.
   * For perspective cameras, only position clamping is applied.
   * @default null
   */
  boundsEntity: Entity | null;
}

export const VirtualCamera = component<VirtualCameraData>(
  "VirtualCamera",
  {
    priority: { serializable: true },
    enabled: { serializable: true },
    type: { serializable: true },
    fov: { serializable: true },
    size: { serializable: true },
    zoom: { serializable: true },
    near: { serializable: true },
    far: { serializable: true },
    dutch: { serializable: true },
    enableCameraBounds: { serializable: true },
    boundsEntity: { serializable: true, type: "entity", whenNullish: "keep" },
  },
  {
    defaultValue: () => ({
      priority: 10,
      enabled: true,
      type: "perspective" as "perspective" | "orthographic",
      fov: 75,
      size: 5,
      zoom: 1,
      near: 0.1,
      far: 1000,
      dutch: 0,
      enableCameraBounds: false,
      boundsEntity: null,
    }),
    displayName: "Virtual Camera",
    description:
      "A virtual camera viewpoint with priority-based selection for the CameraBrain",
    path: "rendering/camera",
    customEditor: ({ componentData, commands }) => {
      // Priority (prominent at top)
      EditorLayout.header("Virtual Camera Settings", { r: 0.2, g: 0.8, b: 0.4 });

      EditorLayout.beginLabelsWidth(['Priority', 'Enabled', 'Projection Type', 'Dutch Angle']);

      const [priority, priorityChanged] = EditorLayout.integerField("Priority", componentData.priority, {
        min: 0, max: 100, tooltip: "Higher priority cameras take precedence"
      });
      if (priorityChanged) componentData.priority = priority;

      const [enabled, enabledChanged] = EditorLayout.checkboxField("Enabled", componentData.enabled, {
        tooltip: "Disabled cameras are ignored during selection"
      });
      if (enabledChanged) componentData.enabled = enabled;

      EditorLayout.separator();

      // Camera projection type
      const ProjectionType = { perspective: "perspective", orthographic: "orthographic" } as const;
      const [newType, typeChanged] = EditorLayout.enumField("Projection Type", componentData.type, ProjectionType, {
        tooltip: "Camera projection mode"
      });
      if (typeChanged) componentData.type = newType;

      EditorLayout.endLabelsWidth();

      EditorLayout.separator();

      // Conditional perspective properties
      if (componentData.type === "perspective") {
        if (EditorLayout.beginGroup("Perspective Properties")) {
          EditorLayout.beginLabelsWidth(['Field of View']);

          const [fov, fovChanged] = EditorLayout.numberField("Field of View", componentData.fov, {
            min: 10, max: 150, useSlider: true, tooltip: "Vertical field of view in degrees"
          });
          if (fovChanged) componentData.fov = fov;

          EditorLayout.endLabelsWidth();
          EditorLayout.endGroup();
        }
      }

      // Conditional orthographic properties
      if (componentData.type === "orthographic") {
        if (EditorLayout.beginGroup("Orthographic Properties")) {
          EditorLayout.beginLabelsWidth(['Size', 'Zoom']);

          const [size, sizeChanged] = EditorLayout.numberField("Size", componentData.size, {
            min: 0.1, max: 100, speed: 0.1, tooltip: "Half-height of the camera view in world units"
          });
          if (sizeChanged) componentData.size = size;

          const [zoom, zoomChanged] = EditorLayout.numberField("Zoom", componentData.zoom, {
            min: 0.01, max: 10, speed: 0.01, tooltip: "Zoom multiplier (2 = half the view)"
          });
          if (zoomChanged) componentData.zoom = zoom;

          EditorLayout.endLabelsWidth();
          EditorLayout.endGroup();
        }
      }

      EditorLayout.separator();

      // Clipping planes
      if (EditorLayout.beginGroup("Clipping Planes")) {
        EditorLayout.beginLabelsWidth(['Near', 'Far']);

        const [near, nearChanged] = EditorLayout.numberField("Near", componentData.near, {
          min: 0.001, max: 10, speed: 0.01, tooltip: "Near clipping plane distance"
        });
        const [far, farChanged] = EditorLayout.numberField("Far", componentData.far, {
          min: 1, max: 10000, speed: 0.1, tooltip: "Far clipping plane distance"
        });

        // Validation
        if (near >= far) {
          EditorLayout.warning("Near must be less than Far");
          componentData.near = Math.min(near, far - 0.1);
        } else if (nearChanged) {
          componentData.near = near;
        }
        if (farChanged) componentData.far = far;

        EditorLayout.endLabelsWidth();
        EditorLayout.endGroup();
      }

      EditorLayout.separator();

      EditorLayout.beginLabelsWidth(['Dutch Angle']);

      // Dutch angle
      const [dutch, dutchChanged] = EditorLayout.numberField("Dutch Angle", componentData.dutch, {
        min: -45, max: 45, useSlider: true, tooltip: "Camera roll in degrees"
      });
      if (dutchChanged) componentData.dutch = dutch;

      EditorLayout.endLabelsWidth();

      EditorLayout.separator();

      // Camera Bounds
      EditorLayout.header("Camera Bounds", { r: 0.2, g: 0.8, b: 0.4 });

      // Handle undefined for components that were serialized before bounds existed
      if (componentData.enableCameraBounds === undefined) {
        componentData.enableCameraBounds = false;
      }
      // Migration: handle old cameraBounds property
      if ("cameraBounds" in componentData) {
        delete (componentData as Record<string, unknown>)["cameraBounds"];
      }
      if (componentData.boundsEntity === undefined) {
        componentData.boundsEntity = null;
      }

      EditorLayout.beginLabelsWidth(['Enable Bounds', 'Bounds Entity']);

      const [enableBounds, enableBoundsChanged] = EditorLayout.checkboxField("Enable Bounds", componentData.enableCameraBounds, {
        tooltip: "Constrain camera position within bounds"
      });
      if (enableBoundsChanged) componentData.enableCameraBounds = enableBounds;

      if (componentData.enableCameraBounds) {
        EditorLayout.beginIndent();

        // Entity picker for bounds entity
        const [boundsEntity, boundsEntityChanged] = EditorLayout.entityField(
          "Bounds Entity",
          componentData.boundsEntity,
          {
            allowNone: true,
            requiredComponents: [VirtualCameraBounds as unknown as import("../../component.js").ComponentType<unknown>],
            tooltip: "Entity with VirtualCameraBounds component"
          }
        );
        if (boundsEntityChanged) componentData.boundsEntity = boundsEntity;

        // Show info about selected bounds entity
        if (componentData.boundsEntity !== null) {
          const boundsComp = commands.tryGetComponent(
            componentData.boundsEntity,
            VirtualCameraBounds
          );
          if (boundsComp) {
            EditorLayout.spacing();
            EditorLayout.textDisabled(`Size: ${boundsComp.size.x.toFixed(1)} x ${boundsComp.size.y.toFixed(1)}`);
          }
        } else {
          EditorLayout.spacing();
          EditorLayout.warning("No bounds entity selected");
        }

        EditorLayout.endIndent();
      }

      EditorLayout.endLabelsWidth();
    },
  }
);
