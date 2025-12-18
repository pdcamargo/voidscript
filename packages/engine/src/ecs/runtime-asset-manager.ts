/**
 * RuntimeAssetManager - Singleton registry for RuntimeAsset instances
 *
 * Ensures that the same GUID always resolves to the same RuntimeAsset instance.
 * This is critical for reference equality in components and systems.
 *
 * Auto-initializes on first access - no manual initialization required.
 *
 * @example
 * ```typescript
 * // Get or create an asset (auto-initializes if needed)
 * const asset1 = RuntimeAssetManager.get().getOrCreate(guid, metadata);
 * const asset2 = RuntimeAssetManager.get().getOrCreate(guid, metadata);
 *
 * console.log(asset1 === asset2); // true - same instance!
 * ```
 */

import { RuntimeAsset } from "./runtime-asset.js";
import type { AssetMetadata, GUID } from "./asset-metadata.js";

/**
 * RuntimeAssetManager - Manages RuntimeAsset instances with singleton pattern per GUID
 */
export class RuntimeAssetManager {
  private static instance: RuntimeAssetManager | null = null;

  /** Map of GUID -> RuntimeAsset for singleton pattern */
  private assets = new Map<GUID, RuntimeAsset>();

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Initialize the RuntimeAssetManager singleton
   *
   * Can be called multiple times safely (subsequent calls do nothing).
   */
  static initialize(): void {
    if (!RuntimeAssetManager.instance) {
      RuntimeAssetManager.instance = new RuntimeAssetManager();
    }
  }

  /**
   * Get the RuntimeAssetManager singleton instance
   *
   * Auto-initializes if not already initialized.
   */
  static get(): RuntimeAssetManager {
    if (!RuntimeAssetManager.instance) {
      RuntimeAssetManager.initialize();
    }
    return RuntimeAssetManager.instance!;
  }

  /**
   * Check if the RuntimeAssetManager singleton is initialized
   */
  static has(): boolean {
    return RuntimeAssetManager.instance !== null;
  }

  /**
   * Set a custom RuntimeAssetManager instance (for testing)
   */
  static set(instance: RuntimeAssetManager): void {
    if (RuntimeAssetManager.instance) {
      throw new Error("RuntimeAssetManager already initialized");
    }
    RuntimeAssetManager.instance = instance;
  }

  /**
   * Replace the RuntimeAssetManager instance (for testing)
   */
  static replace(instance: RuntimeAssetManager): void {
    RuntimeAssetManager.instance = instance;
  }

  /**
   * Clear the RuntimeAssetManager singleton (for testing)
   */
  static clear(): void {
    RuntimeAssetManager.instance = null;
  }

  /**
   * Get or create a RuntimeAsset by GUID
   *
   * If an asset with this GUID already exists, returns the existing instance.
   * Otherwise, creates a new RuntimeAsset with the provided metadata.
   *
   * @param guid - Asset GUID (UUID v4)
   * @param metadata - Asset metadata (only used if creating new instance)
   * @returns RuntimeAsset instance (always the same instance for a given GUID)
   *
   * @example
   * ```typescript
   * const manager = RuntimeAssetManager.get();
   * const asset = manager.getOrCreate(guid, metadata);
   * ```
   */
  getOrCreate(guid: GUID, metadata: AssetMetadata): RuntimeAsset {
    const existing = this.assets.get(guid);
    if (existing) {
      return existing;
    }

    const asset = new RuntimeAsset(guid, metadata);
    this.assets.set(guid, asset);
    return asset;
  }

  /**
   * Get a RuntimeAsset by GUID (returns null if not found)
   *
   * @param guid - Asset GUID
   * @returns RuntimeAsset instance or null
   */
  get(guid: GUID): RuntimeAsset | null {
    return this.assets.get(guid) ?? null;
  }

  /**
   * Check if a RuntimeAsset exists for a given GUID
   *
   * @param guid - Asset GUID
   * @returns true if asset exists
   */
  has(guid: GUID): boolean {
    return this.assets.has(guid);
  }

  /**
   * Get all registered RuntimeAsset instances
   *
   * @returns Array of all RuntimeAsset instances
   */
  getAll(): RuntimeAsset[] {
    return Array.from(this.assets.values());
  }

  /**
   * Get count of registered RuntimeAsset instances
   */
  getCount(): number {
    return this.assets.size;
  }

  /**
   * Remove a RuntimeAsset from the registry
   *
   * Note: This does not unload the asset data. Call asset.unload() first if needed.
   *
   * @param guid - Asset GUID to remove
   * @returns true if asset was removed, false if it didn't exist
   */
  remove(guid: GUID): boolean {
    return this.assets.delete(guid);
  }

  /**
   * Clear all RuntimeAsset instances from the registry
   *
   * Note: This does not unload asset data. Consider calling unload() on assets first.
   */
  clearAll(): void {
    this.assets.clear();
  }

  /**
   * Unload all assets and clear the registry
   *
   * Useful for cleaning up when switching projects or scenes.
   */
  unloadAll(): void {
    for (const asset of this.assets.values()) {
      asset.unload();
    }
    this.assets.clear();
  }

  /**
   * Get statistics about registered assets
   */
  getStats(): {
    total: number;
    loaded: number;
    unloaded: number;
  } {
    let loaded = 0;
    let unloaded = 0;

    for (const asset of this.assets.values()) {
      if (asset.isLoaded) {
        loaded++;
      } else {
        unloaded++;
      }
    }

    return {
      total: this.assets.size,
      loaded,
      unloaded,
    };
  }
}
