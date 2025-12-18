/**
 * AssetRef - A reference to an asset using its GUID from the AssetDatabase
 *
 * This type is used in ECS components to reference project assets (textures, models, etc.)
 * in a serialization-friendly way. The GUID is stable across serialization/deserialization
 * and can be resolved to an asset path at runtime.
 *
 * The engine package only stores GUIDs - asset resolution happens at the editor/runtime level.
 */
export type AssetRef = {
  guid: string;
};

/**
 * Creates an AssetRef from a GUID string
 *
 * @param guid - The asset GUID from the AssetDatabase
 * @returns An AssetRef object
 *
 * @example
 * ```typescript
 * const textureRef = assetRef("123e4567-e89b-12d3-a456-426614174000");
 * ```
 */
export function assetRef(guid: string): AssetRef {
  return { guid };
}

/**
 * Checks if a value is an AssetRef
 *
 * @param value - The value to check
 * @returns True if the value is an AssetRef
 */
export function isAssetRef(value: unknown): value is AssetRef {
  return (
    typeof value === "object" &&
    value !== null &&
    "guid" in value &&
    typeof value.guid === "string"
  );
}
