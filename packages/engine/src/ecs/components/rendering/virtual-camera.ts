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
import { ImGui } from "@mori2003/jsimgui";
import type { Entity } from "../../entity.js";
import { entityPicker } from "../../../app/imgui/entity-picker.js";
import { VirtualCameraBounds } from "./virtual-camera-bounds.js";
import { Name } from "../name.js";

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
      ImGui.TextColored(
        { x: 0.2, y: 0.8, z: 0.4, w: 1 },
        "Virtual Camera Settings"
      );

      const priority: [number] = [componentData.priority];
      if (ImGui.DragInt("Priority##priority", priority, 1, 0, 100)) {
        componentData.priority = priority[0];
      }

      const enabled: [boolean] = [componentData.enabled];
      if (ImGui.Checkbox("Enabled##enabled", enabled)) {
        componentData.enabled = enabled[0];
      }

      ImGui.Separator();

      // Camera projection type
      ImGui.Text("Projection Type:");
      const typeOptions: Array<"perspective" | "orthographic"> = [
        "perspective",
        "orthographic",
      ];
      if (ImGui.BeginCombo("##type", componentData.type)) {
        for (const option of typeOptions) {
          const isSelected = componentData.type === option;
          if (ImGui.Selectable(option, isSelected)) {
            componentData.type = option;
          }
          if (isSelected) {
            ImGui.SetItemDefaultFocus();
          }
        }
        ImGui.EndCombo();
      }

      ImGui.Separator();

      // Conditional perspective properties
      if (componentData.type === "perspective") {
        ImGui.Text("Perspective Properties");
        ImGui.Indent();
        const fov: [number] = [componentData.fov];
        if (ImGui.SliderFloat("Field of View##fov", fov, 10, 150)) {
          componentData.fov = fov[0];
        }
        ImGui.Unindent();
      }

      // Conditional orthographic properties
      if (componentData.type === "orthographic") {
        ImGui.Text("Orthographic Properties");
        ImGui.Indent();
        const size: [number] = [componentData.size];
        if (ImGui.DragFloat("Size##size", size, 0.1, 0.1, 100)) {
          componentData.size = size[0];
        }
        const zoom: [number] = [componentData.zoom];
        if (ImGui.DragFloat("Zoom##zoom", zoom, 0.01, 0.01, 10)) {
          componentData.zoom = zoom[0];
        }
        ImGui.Unindent();
      }

      ImGui.Separator();

      // Clipping planes
      ImGui.Text("Clipping Planes");
      ImGui.Indent();
      const near: [number] = [componentData.near];
      const far: [number] = [componentData.far];

      ImGui.DragFloat("Near##near", near, 0.01, 0.001, 10);
      ImGui.DragFloat("Far##far", far, 0.1, 1, 10000);

      // Validation
      if (near[0] >= far[0]) {
        ImGui.TextColored(
          { x: 1, y: 0.5, z: 0, w: 1 },
          "Warning: Near must be less than Far"
        );
        near[0] = Math.min(near[0], far[0] - 0.1);
      }

      componentData.near = near[0];
      componentData.far = far[0];
      ImGui.Unindent();

      ImGui.Separator();

      // Dutch angle
      const dutch: [number] = [componentData.dutch];
      if (ImGui.SliderFloat("Dutch Angle##dutch", dutch, -45, 45)) {
        componentData.dutch = dutch[0];
      }

      ImGui.Separator();

      // Camera Bounds
      ImGui.TextColored(
        { x: 0.2, y: 0.8, z: 0.4, w: 1 },
        "Camera Bounds"
      );

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

      const enableBounds: [boolean] = [componentData.enableCameraBounds];
      if (ImGui.Checkbox("Enable Bounds##enableBounds", enableBounds)) {
        componentData.enableCameraBounds = enableBounds[0];
      }

      if (componentData.enableCameraBounds) {
        ImGui.Indent();

        // Entity picker for bounds entity
        ImGui.Text("Bounds Entity:");

        const result = entityPicker({
          label: "boundsEntity",
          currentEntity: componentData.boundsEntity,
          commands,
          allowNone: true,
          requiredComponents: [VirtualCameraBounds as unknown as import("../../component.js").ComponentType<unknown>],
        });

        if (result.changed) {
          componentData.boundsEntity = result.entity;
        }

        // Show info about selected bounds entity
        if (componentData.boundsEntity !== null) {
          const boundsComp = commands.tryGetComponent(
            componentData.boundsEntity,
            VirtualCameraBounds
          );
          if (boundsComp) {
            ImGui.Spacing();
            ImGui.TextColored(
              { x: 0.6, y: 0.6, z: 0.6, w: 1 },
              `Size: ${boundsComp.size.x.toFixed(1)} x ${boundsComp.size.y.toFixed(1)}`
            );
          }
        } else {
          ImGui.Spacing();
          ImGui.TextColored(
            { x: 1, y: 0.6, z: 0, w: 1 },
            "No bounds entity selected"
          );
        }

        ImGui.Unindent();
      }
    },
  }
);
