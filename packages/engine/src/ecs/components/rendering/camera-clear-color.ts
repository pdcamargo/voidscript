import * as THREE from 'three';
import { component } from "../../component.js";
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

export interface CameraClearColorData {
  /**
   * Clear color for the camera as THREE.Color
   * Use `new THREE.Color(r, g, b)` or `new THREE.Color('#hex')`
   * @default new THREE.Color(0x1a1a2e)
   */
  color: THREE.Color;

  /**
   * Alpha value for the clear color (0-1)
   * Note: THREE.Color doesn't support alpha, so it's a separate property
   * @default 1
   */
  alpha: number;
}

/**
 * Camera clear color component (optional).
 *
 * Attach this to a camera entity to override the renderer's default clear color.
 * If not present on the active camera, the renderer uses its default clear color.
 *
 * @example
 * ```typescript
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 0, 10) })
 *   .with(OrthographicCamera, { size: 5 })
 *   .with(CameraClearColor, { color: new THREE.Color(0.04, 0.04, 0.1), alpha: 1 })
 *   .with(MainCamera, {})
 *   .build();
 * ```
 */
export const CameraClearColor = component<CameraClearColorData>(
  "CameraClearColor",
  {
    color: {
      serializable: true,
      // Custom serialization for THREE.Color
      customSerializer: {
        serialize: (value: THREE.Color) => ({
          r: value.r,
          g: value.g,
          b: value.b,
        }),
        deserialize: (data: unknown) => {
          const colorData = data as { r: number; g: number; b: number };
          return new THREE.Color(colorData.r, colorData.g, colorData.b);
        },
      },
    },
    alpha: { serializable: true },
  },
  {
    defaultValue: () => ({
      color: new THREE.Color(0x1a1a2e),
      alpha: 1,
    }),
    displayName: "Camera Clear Color",
    description: "Clear color for camera rendering",
    path: "rendering/camera",
    customEditor: ({ componentData }) => {
      EditorLayout.beginLabelsWidth(['Color', 'Alpha']);

      const [color, colorChanged] = EditorLayout.colorField(
        'Color',
        { r: componentData.color.r, g: componentData.color.g, b: componentData.color.b },
        { tooltip: 'Background color for camera rendering' }
      );
      if (colorChanged) {
        componentData.color.r = color.r;
        componentData.color.g = color.g;
        componentData.color.b = color.b;
      }

      const [alpha, alphaChanged] = EditorLayout.numberField(
        'Alpha',
        componentData.alpha,
        { speed: 0.01, min: 0, max: 1, tooltip: 'Background alpha (0 = transparent, 1 = opaque)' }
      );
      if (alphaChanged) {
        componentData.alpha = alpha;
      }

      EditorLayout.endLabelsWidth();
    },
  }
);
