import * as THREE from 'three';
import { component } from "../../component.js";

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
  }
);
