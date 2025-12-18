/**
 * FBXModel Component
 *
 * References an FBX model asset via RuntimeAsset.
 * The renderer sync system will load the asset and create the mesh.
 *
 * IMPORTANT: This component MUST be used with Transform3D component.
 */

import { component } from "../../component.js";
import type { RuntimeAsset } from "../../runtime-asset.js";

export interface FBXModelData {
  /**
   * RuntimeAsset reference to the FBX model
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
class FBXModelAsset {}

export const FBXModel = component<FBXModelData>(
  "FBXModel",
  {
    asset: {
      serializable: true,
      type: "runtimeAsset",
      whenNullish: "keep",
      instanceType: FBXModelAsset,
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
    defaultValue: () => ({
      asset: null,
      castShadow: true,
      receiveShadow: true,
    }),
    description: "FBX model renderer",
    displayName: "FBX Model",
  }
);
