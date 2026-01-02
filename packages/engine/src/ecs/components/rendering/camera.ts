import { component } from "@voidscript/core";
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

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
      EditorLayout.beginLabelsWidth(['Projection Type']);

      const ProjectionType = { perspective: 'perspective', orthographic: 'orthographic' } as const;
      const currentType = componentData.type || 'perspective';

      const [newType, typeChanged] = EditorLayout.enumField('Projection Type', currentType, ProjectionType, {
        tooltip: 'Camera projection mode',
      });
      if (typeChanged) componentData.type = newType;

      EditorLayout.endLabelsWidth();

      EditorLayout.separator();

      // Conditional perspective properties
      if (currentType === 'perspective') {
        if (EditorLayout.beginGroup('Perspective Properties', true)) {
          EditorLayout.beginLabelsWidth(['Field of View']);

          const [fov, fovChanged] = EditorLayout.numberField('Field of View', componentData.fov, {
            min: 10, max: 150, useSlider: true, tooltip: 'Vertical field of view in degrees',
          });
          if (fovChanged) componentData.fov = fov;

          EditorLayout.endLabelsWidth();
          EditorLayout.endGroup();
        }
      }

      // Conditional orthographic properties
      if (currentType === 'orthographic') {
        if (EditorLayout.beginGroup('Orthographic Properties', true)) {
          EditorLayout.beginLabelsWidth(['Size', 'Zoom']);

          const [size, sizeChanged] = EditorLayout.numberField('Size', componentData.size, {
            min: 0.1, max: 100, speed: 0.1, tooltip: 'Half-height of the camera view in world units',
          });
          if (sizeChanged) componentData.size = size;

          const [zoom, zoomChanged] = EditorLayout.numberField('Zoom', componentData.zoom, {
            min: 0.01, max: 10, speed: 0.01, tooltip: 'Zoom multiplier (2 = shows half the view)',
          });
          if (zoomChanged) componentData.zoom = zoom;

          EditorLayout.endLabelsWidth();
          EditorLayout.endGroup();
        }
      }

      EditorLayout.separator();

      // Shared clipping planes
      if (EditorLayout.beginGroup('Clipping Planes', true)) {
        EditorLayout.beginLabelsWidth(['Near', 'Far']);

        const [near, nearChanged] = EditorLayout.numberField('Near', componentData.near, {
          min: 0.001, max: 10, speed: 0.01, tooltip: 'Near clipping plane distance',
        });
        const [far, farChanged] = EditorLayout.numberField('Far', componentData.far, {
          min: 1, max: 10000, speed: 0.1, tooltip: 'Far clipping plane distance',
        });

        // Validation
        if (near >= far) {
          EditorLayout.warning('Near must be less than Far');
          componentData.near = Math.min(near, far - 0.1);
        } else if (nearChanged) {
          componentData.near = near;
        }

        if (farChanged) componentData.far = far;

        EditorLayout.endLabelsWidth();
        EditorLayout.endGroup();
      }
    },
  }
);
