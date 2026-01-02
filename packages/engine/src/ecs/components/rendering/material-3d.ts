/**
 * Material3D Component
 *
 * Defines the visual appearance of a mesh (color, texture, metalness, roughness).
 * Can reference a texture asset or use a solid color.
 *
 * IMPORTANT: This component is optional. If not present, the renderer will use
 * a default material (green color as placeholder).
 */

import { component } from "@voidscript/core";
import { RuntimeAsset } from "@voidscript/core";

export interface Material3DData {
  /**
   * Base color of the material (RGBA, 0-1 range)
   * Used when no texture is assigned or as a tint when texture is present
   * @default { r: 1, g: 1, b: 1, a: 1 } (white)
   */
  color: { r: number; g: number; b: number; a: number };

  /**
   * Reference to the texture asset (PNG, JPG, etc.)
   * null means use solid color only
   */
  texture: RuntimeAsset | null;

  /**
   * Metalness value (0 = dielectric, 1 = metallic)
   * @default 0
   */
  metalness: number;

  /**
   * Roughness value (0 = smooth, 1 = rough)
   * @default 1
   */
  roughness: number;

  /**
   * Opacity value (0 = transparent, 1 = opaque)
   * @default 1
   */
  opacity: number;
}

export const Material3D = component<Material3DData>("Material3D", {
  color: {
    serializable: true,
  },
  texture: {
    serializable: true,
    type: "runtimeAsset",
    whenNullish: "keep",
  },
  metalness: {
    serializable: true,
  },
  roughness: {
    serializable: true,
  },
  opacity: {
    serializable: true,
  },
});
