import { component } from "../../component.js";
import { ImGui } from '@mori2003/jsimgui';

export interface CameraData {
  /**
   * Camera projection type
   * @default 'perspective'
   */
  type: 'perspective' | 'orthographic';

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
   * Field of view in degrees (vertical) - used for perspective cameras
   * @default 75
   */
  fov: number;

  /**
   * Half-height of the camera view in world units - used for orthographic cameras
   * Width is automatically calculated based on aspect ratio
   * @default 5
   */
  size: number;

  /**
   * Zoom multiplier (orthographic cameras only)
   * Applied as a divisor on the size (zoom=2 shows half the view)
   * @default 1
   */
  zoom: number;
}

/**
 * Unified camera component for 3D and 2D rendering.
 *
 * Supports both perspective (3D) and orthographic (2D/isometric) projection modes.
 * The camera type can be changed at runtime by modifying the `type` property.
 *
 * **Perspective Mode**: Uses field-of-view for 3D scenes
 * **Orthographic Mode**: Uses size for 2D/UI, with optional zoom
 *
 * Properties for inactive mode are preserved when switching types.
 *
 * Attach this to an entity with a Transform3D component to create a camera.
 * The camera will automatically sync its position and rotation from the Transform3D.
 *
 * Add the MainCamera component to make this the active rendering camera.
 *
 * @example
 * ```typescript
 * // Create perspective camera
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 0, 10) })
 *   .with(Camera, { type: 'perspective', fov: 75 })
 *   .with(MainCamera, {})
 *   .build();
 *
 * // Create orthographic camera
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 0, 10) })
 *   .with(Camera, { type: 'orthographic', size: 5, zoom: 1 })
 *   .with(MainCamera, {})
 *   .build();
 *
 * // Switch to orthographic at runtime
 * const camera = commands.getComponent(entity, Camera);
 * camera.type = 'orthographic';
 * camera.size = 10;
 * ```
 */
export const Camera = component<CameraData>(
  "Camera",
  {
    type: { serializable: true },
    near: { serializable: true },
    far: { serializable: true },
    fov: { serializable: true },
    size: { serializable: true },
    zoom: { serializable: true },
  },
  {
    defaultValue: () => ({
      type: 'perspective',
      near: 0.1,
      far: 1000,
      fov: 75,
      size: 5,
      zoom: 1,
    }),
    displayName: "Camera",
    description: "Camera for 3D and 2D rendering with switchable projection modes",
    path: "rendering/camera",
    showHelper: false,
    customEditor: ({ componentData }) => {
      // Type selector dropdown
      const typeOptions: Array<'perspective' | 'orthographic'> = ['perspective', 'orthographic'];
      const currentType = componentData.type || 'perspective';

      ImGui.Text('Projection Type:');
      ImGui.SameLine();
      if (ImGui.BeginCombo('##type', currentType)) {
        for (const option of typeOptions) {
          const isSelected = currentType === option;
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
      if (currentType === 'perspective') {
        ImGui.Text('Perspective Properties');
        ImGui.Indent();
        const fov: [number] = [componentData.fov];
        if (ImGui.SliderFloat('Field of View##fov', fov, 10, 150)) {
          componentData.fov = fov[0];
        }
        ImGui.Unindent();
      }

      // Conditional orthographic properties
      if (currentType === 'orthographic') {
        ImGui.Text('Orthographic Properties');
        ImGui.Indent();
        const size: [number] = [componentData.size];
        if (ImGui.DragFloat('Size##size', size, 0.1, 0.1, 100)) {
          componentData.size = size[0];
        }
        const zoom: [number] = [componentData.zoom];
        if (ImGui.DragFloat('Zoom##zoom', zoom, 0.01, 0.01, 10)) {
          componentData.zoom = zoom[0];
        }
        ImGui.Unindent();
      }

      ImGui.Separator();

      // Shared clipping planes
      ImGui.Text('Clipping Planes');
      ImGui.Indent();
      const near: [number] = [componentData.near];
      const far: [number] = [componentData.far];

      ImGui.DragFloat('Near##near', near, 0.01, 0.001, 10);
      ImGui.DragFloat('Far##far', far, 0.1, 1, 10000);

      // Validation
      if (near[0] >= far[0]) {
        ImGui.TextColored({ x: 1, y: 0.5, z: 0, w: 1 },
          'Warning: Near must be less than Far');
        near[0] = Math.min(near[0], far[0] - 0.1);
      }

      componentData.near = near[0];
      componentData.far = far[0];
      ImGui.Unindent();
    },
  }
);
