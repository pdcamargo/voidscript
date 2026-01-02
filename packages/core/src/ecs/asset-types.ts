/**
 * Core Asset Types
 *
 * Minimal asset type definitions for core ECS.
 * Engine extends these with specific asset types and loaders.
 */

/**
 * GUID type (UUID v4)
 */
export type GUID = string;

/**
 * Base asset metadata interface
 * Engine extends this with specific asset type metadata
 */
export interface BaseAssetMetadata {
  /** Unique identifier (UUID v4) */
  guid: GUID;

  /** Relative path from project root */
  path: string;

  /** Asset type discriminator */
  type: string;
}

/**
 * Asset loader function type
 * Loaders are registered in engine via AssetLoaderRegistry
 */
export type AssetLoaderFn<T = any> = (asset: {
  guid: GUID;
  metadata: BaseAssetMetadata;
  getLoadableUrl(): string;
}) => Promise<T>;

/**
 * AssetRef - A reference to an asset using its GUID
 *
 * Used in ECS components to reference project assets (textures, models, etc.)
 * in a serialization-friendly way.
 */
export type AssetRef = {
  guid: string;
};

/**
 * Creates an AssetRef from a GUID string
 */
export function assetRef(guid: string): AssetRef {
  return { guid };
}

/**
 * Checks if a value is an AssetRef
 */
export function isAssetRef(value: unknown): value is AssetRef {
  return (
    typeof value === "object" &&
    value !== null &&
    "guid" in value &&
    typeof value.guid === "string"
  );
}
