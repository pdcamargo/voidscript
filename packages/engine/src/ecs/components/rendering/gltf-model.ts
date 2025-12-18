/**
 * GLTFModel Component
 *
 * References a GLTF/GLB model asset via RuntimeAsset.
 * The renderer sync system will load the asset and create the mesh.
 *
 * IMPORTANT: This component MUST be used with Transform3D component.
 */

import { component } from "../../component.js";
import type { RuntimeAsset } from "../../runtime-asset.js";

export interface GLTFModelData {
  /**
   * RuntimeAsset reference to the GLTF/GLB model
   */
  asset: RuntimeAsset | null;

  /**
   * Whether to cast shadows
   * @default true
   */
  castShadow: boolean;

  /**
   * Whether to receive shadows
   * @default true
   */
  receiveShadow: boolean;
}

// Dummy class for type hint (helps inspector infer AssetType.Model3D)
class GLTFModelAsset {}

export const GLTFModel = component<GLTFModelData>(
  "GLTFModel",
  {
    asset: {
      serializable: true,
      type: "runtimeAsset",
      whenNullish: "keep",
      instanceType: GLTFModelAsset,
    },
    castShadow: {
      serializable: true,
    },
    receiveShadow: {
      serializable: true,
    },
  },
  {
    path: "rendering/3d",
    displayName: "GLTF Model",
    description: "GLTF model renderer",
    defaultValue: {
      asset: null,
      castShadow: true,
      receiveShadow: true,
    },
  }
);
