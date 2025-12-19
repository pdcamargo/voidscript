/**
 * VirtualCameraBounds Component
 *
 * Defines a 2D boundary region in world space that constrains camera movement.
 * This component should be placed on an entity with Transform3D - the bounds
 * are defined relative to that entity's position.
 *
 * VirtualCamera entities can reference a VirtualCameraBounds entity to limit
 * their movement within the defined area. This allows:
 * - Multiple boundary regions in a scene
 * - Dynamic switching between boundaries
 * - Visual editing of bounds via Transform3D gizmos
 *
 * @example
 * ```typescript
 * // Create a bounds entity
 * const boundsEntity = commands.spawn()
 *   .with(Name, { name: 'Level 1 Bounds' })
 *   .with(Transform3D, { position: new Vector3(0, 0, 0) })
 *   .with(VirtualCameraBounds, {
 *     size: { x: 20, y: 15 }, // Total width/height of the bounds
 *   })
 *   .build();
 *
 * // Reference it from a VirtualCamera
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 0, 10) })
 *   .with(VirtualCamera, {
 *     enableCameraBounds: true,
 *     boundsEntity: boundsEntity,
 *   })
 *   .build();
 * ```
 */

import { component } from "../../component.js";
import { ImGui } from "@mori2003/jsimgui";

export interface VirtualCameraBoundsData {
  /**
   * Size of the bounds in world units (width, height).
   * The bounds extend from -size/2 to +size/2 relative to the entity's Transform3D position.
   * @default { x: 20, y: 15 }
   */
  size: { x: number; y: number };
}

export const VirtualCameraBounds = component<VirtualCameraBoundsData>(
  "VirtualCameraBounds",
  {
    size: { serializable: true },
  },
  {
    defaultValue: () => ({
      size: { x: 20, y: 15 },
    }),
    displayName: "Virtual Camera Bounds",
    description:
      "Defines a 2D boundary region that constrains camera movement. Place on an entity with Transform3D.",
    path: "rendering/camera",
    customEditor: ({ componentData }) => {
      ImGui.TextColored(
        { x: 0.2, y: 0.8, z: 0.4, w: 1 },
        "Camera Bounds Region"
      );

      ImGui.Text("Size (Width, Height):");
      const size: [number, number] = [componentData.size.x, componentData.size.y];
      if (ImGui.DragFloat2("##boundsSize", size, 0.5, 0.1, 1000)) {
        componentData.size = {
          x: Math.max(0.1, size[0]),
          y: Math.max(0.1, size[1]),
        };
      }

      ImGui.Spacing();
      ImGui.TextColored(
        { x: 0.6, y: 0.6, z: 0.6, w: 1 },
        "Bounds extend from -size/2 to +size/2"
      );
      ImGui.TextColored(
        { x: 0.6, y: 0.6, z: 0.6, w: 1 },
        "relative to the entity's position."
      );

      // Show calculated world bounds
      ImGui.Spacing();
      ImGui.Separator();
      ImGui.Text("Local Bounds:");
      ImGui.Indent();
      ImGui.Text(`Min: (${(-componentData.size.x / 2).toFixed(1)}, ${(-componentData.size.y / 2).toFixed(1)})`);
      ImGui.Text(`Max: (${(componentData.size.x / 2).toFixed(1)}, ${(componentData.size.y / 2).toFixed(1)})`);
      ImGui.Unindent();
    },
  }
);
