/**
 * RuntimeAsset - Runtime asset management with lazy loading
 *
 * Holds asset metadata and loaded data. Components reference RuntimeAsset instances
 * instead of raw GUIDs. The same GUID always resolves to the same RuntimeAsset instance
 * via RuntimeAssetManager.
 *
 * RuntimeAsset automatically selects the correct loader from AssetLoaderRegistry based
 * on the asset's metadata type when load() is called.
 *
 * @example
 * ```typescript
 * // Get or create a runtime asset
 * const asset = RuntimeAssetManager.getOrCreate(guid, metadata);
 *
 * // Use in component
 * const sprite = { texture: asset };
 *
 * // Load data (no loader argument needed!)
 * await asset.load();
 *
 * // Access loaded data via .data property
 * if (asset.data) {
 *   const texture = asset.data;
 * }
 * ```
 */

import type { AssetMetadata, GUID, AssetType } from "./asset-metadata.js";
import { AssetLoaderRegistry } from "./asset-loader-registry.js";

/**
 * RuntimeAsset class - holds asset metadata and loaded data
 *
 * @template T - The type of loaded asset data (e.g., Texture, AudioBuffer, etc.)
 */
export class RuntimeAsset<T = any> {
  /** Unique asset identifier */
  readonly guid: GUID;

  /** Asset metadata (path, type, import settings, etc.) */
  readonly metadata: AssetMetadata;

  /** Whether asset data is loaded into memory */
  private _isLoaded: boolean = false;

  /** Loaded asset data (null until loaded) */
  private _data: T | null = null;

  /** Promise for in-progress loading (prevents duplicate loads) */
  private _loadingPromise: Promise<void> | null = null;

  constructor(guid: GUID, metadata: AssetMetadata) {
    this.guid = guid;
    this.metadata = metadata;
  }

  /**
   * Create a RuntimeAsset with pre-loaded data.
   *
   * Useful for programmatically-generated assets that don't come from files,
   * such as Tiled animations created from tileset data.
   *
   * @param guid Unique identifier for this asset
   * @param type Asset type (used for metadata)
   * @param data The pre-loaded data
   * @returns RuntimeAsset instance with isLoaded=true and data already set
   *
   * @example
   * ```typescript
   * const clip = new AnimationClip('walk', 1.0);
   * const asset = RuntimeAsset.createLoaded<AnimationClip>(
   *   'generated-walk-animation',
   *   AssetType.Animation,
   *   clip
   * );
   * // asset.isLoaded === true
   * // asset.data === clip
   * ```
   */
  static createLoaded<T>(guid: GUID, type: AssetType, data: T): RuntimeAsset<T> {
    // Create minimal metadata for the asset type
    const metadata: AssetMetadata = {
      guid,
      path: `generated://${guid}`,
      type,
    } as AssetMetadata;

    const asset = new RuntimeAsset<T>(guid, metadata);
    // Manually set the loaded state
    (asset as any)._isLoaded = true;
    (asset as any)._data = data;

    return asset;
  }

  /**
   * Check if asset data is loaded into memory
   */
  get isLoaded(): boolean {
    return this._isLoaded;
  }

  /**
   * Check if asset is currently loading
   */
  get isLoading(): boolean {
    return this._loadingPromise !== null && !this._isLoaded;
  }

  /**
   * Get loaded asset data
   * Returns null if not loaded yet
   *
   * @example
   * ```typescript
   * const texture: RuntimeAsset<THREE.Texture> = ...;
   * await texture.load();
   *
   * if (texture.data) {
   *   // Use texture
   * }
   * ```
   */
  get data(): T | null {
    return this._data;
  }

  /**
   * Get asset type from metadata
   */
  get type(): string {
    return this.metadata.type;
  }

  /**
   * Get asset path from metadata
   */
  get path(): string {
    return this.metadata.path;
  }

  /**
   * Get loadable URL for this asset
   *
   * Returns the asset path that can be used to load the asset.
   *
   * @returns URL string that can be passed to loaders (Three.js, etc.)
   *
   * @example
   * ```typescript
   * const asset = RuntimeAssetManager.getOrCreate(guid, metadata);
   * const url = asset.getLoadableUrl(); // "/assets/models/character.glb"
   * const gltf = await gltfLoader.loadAsync(url);
   * ```
   */
  getLoadableUrl(): string {
    return this.path;
  }

  /**
   * Load asset data into memory
   *
   * Automatically selects the correct loader from AssetLoaderRegistry based on
   * the asset's metadata type. Can be called multiple times safely - returns
   * the same promise if already loading, and does nothing if already loaded.
   *
   * @returns Promise that resolves when loading completes
   * @throws Error if no loader is registered for this asset type
   *
   * @example
   * ```typescript
   * const texture: RuntimeAsset<THREE.Texture> = ...;
   *
   * // Load (can call multiple times safely)
   * await texture.load();
   * await texture.load(); // Same promise, won't reload
   *
   * // Access data
   * if (texture.data) {
   *   const threeTexture = texture.data;
   * }
   * ```
   */
  async load(): Promise<void> {
    // If already loaded, do nothing
    if (this._isLoaded) {
      return;
    }

    // If loading is in progress, return same promise
    if (this._loadingPromise) {
      return this._loadingPromise;
    }

    // Get loader for this asset type
    const assetType = this.metadata.type as AssetType;
    const loaderFn = AssetLoaderRegistry.get(assetType);

    if (!loaderFn) {
      throw new Error(
        `No loader registered for asset type "${assetType}". ` +
        `Register a loader using AssetLoaderRegistry.register(AssetType.${assetType}, loaderFn)`
      );
    }

    // Start loading
    this._loadingPromise = (async () => {
      try {
        this._data = await loaderFn(this);
        this._isLoaded = true;
      } finally {
        this._loadingPromise = null;
      }
    })();

    return this._loadingPromise;
  }

  /**
   * Unload asset data from memory (keeps metadata)
   *
   * Useful for memory management in large projects.
   */
  unload(): void {
    this._data = null;
    this._isLoaded = false;
    this._loadingPromise = null;
  }

  /**
   * @deprecated Use .data property instead
   * Get loaded asset data
   *
   * @returns Loaded data, or null if not loaded
   */
  getData(): T | null {
    console.warn('RuntimeAsset.getData() is deprecated, use .data property instead');
    return this._data;
  }

  /**
   * @deprecated Use .data property with null check instead
   * Get loaded asset data or throw if not loaded
   *
   * @throws Error always - this method has been removed
   */
  getDataOrThrow(): T {
    throw new Error(
      'RuntimeAsset.getDataOrThrow() has been removed. Use .data property with null check instead:\n' +
      '  if (asset.data) { /* use asset.data */ }'
    );
  }

  /**
   * Check if this RuntimeAsset references the same asset as another
   */
  equals(other: RuntimeAsset<any> | null | undefined): boolean {
    if (!other) return false;
    return this.guid === other.guid;
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    return `RuntimeAsset(${this.guid}, ${this.path}, loaded: ${this._isLoaded})`;
  }
}

/**
 * Type guard to check if a value is a RuntimeAsset
 */
export function isRuntimeAsset(value: unknown): value is RuntimeAsset {
  return value instanceof RuntimeAsset;
}
