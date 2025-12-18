/**
 * Asset Preloader
 *
 * Provides utilities for preloading assets from the RuntimeAssetManager.
 * Assets are loaded using the registered loaders from AssetLoaderRegistry.
 */

import type { World } from "./world.js";
import type { Command } from "./command.js";
import type { RuntimeAsset } from "./runtime-asset.js";
import type { ComponentType } from "./component.js";
import { RuntimeAssetManager } from "./runtime-asset-manager.js";
import type { GUID } from "./asset-metadata.js";

/**
 * Progress callback for asset loading
 */
export interface AssetLoadProgress {
  /** Number of assets loaded so far */
  loaded: number;
  /** Total number of assets to load */
  total: number;
  /** Currently loading asset GUID */
  currentAsset: string | null;
}

/**
 * Options for asset preloading
 */
export interface PreloadAssetsOptions {
  /** Progress callback */
  onProgress?: (progress: AssetLoadProgress) => void;
}

/**
 * Find all RuntimeAsset instances in a world by scanning all components
 *
 * @param world - The ECS World to scan
 * @param commands - The Command interface
 * @returns Array of unique RuntimeAsset instances
 */
export function findAllRuntimeAssets(
  world: World,
  commands: Command
): RuntimeAsset[] {
  const foundAssets = new Map<string, RuntimeAsset>(); // guid -> asset

  // Query all entities
  world.query().each((entityId) => {
    // Get all components for this entity
    const componentsMap = world.getAllComponents(entityId);
    if (!componentsMap) return;

    // Scan each component's data for RuntimeAsset instances
    for (const [componentType, componentData] of componentsMap.entries()) {
      scanObjectForAssets(componentData, foundAssets);
    }
  });

  return Array.from(foundAssets.values());
}

/**
 * Recursively scan an object for RuntimeAsset instances
 */
function scanObjectForAssets(
  obj: any,
  foundAssets: Map<string, RuntimeAsset>
): void {
  if (!obj || typeof obj !== "object") return;

  // Check if this is a RuntimeAsset
  if (
    obj.guid &&
    obj.metadata &&
    obj.path &&
    typeof obj.load === "function"
  ) {
    const asset = obj as RuntimeAsset;
    if (!foundAssets.has(asset.guid)) {
      foundAssets.set(asset.guid, asset);
    }
    return;
  }

  // Recursively scan object properties
  if (Array.isArray(obj)) {
    for (const item of obj) {
      scanObjectForAssets(item, foundAssets);
    }
  } else {
    for (const value of Object.values(obj)) {
      scanObjectForAssets(value, foundAssets);
    }
  }
}

/**
 * Preload specific assets by GUID
 *
 * Simple interface for preloading a list of assets from the RuntimeAssetManager.
 * Assets are loaded using registered loaders from AssetLoaderRegistry.
 *
 * @param guids - Asset GUIDs to preload
 * @returns Promise that resolves when all assets are loaded
 *
 * @example
 * ```typescript
 * // Preload specific assets
 * await preloadAssets(PLAYER_TEXTURE, ENEMY_MODEL, BACKGROUND_MUSIC);
 * ```
 */
export async function preloadAssets(...guids: GUID[]): Promise<void> {
  const manager = RuntimeAssetManager.get();
  const promises: Promise<void>[] = [];

  for (const guid of guids) {
    const asset = manager.get(guid);
    if (!asset) {
      console.warn(`[AssetPreloader] Asset ${guid} not found, skipping`);
      continue;
    }

    if (asset.isLoaded) continue;

    // RuntimeAsset.load() now handles loader selection automatically!
    promises.push(asset.load());
  }

  await Promise.all(promises);
}

/**
 * Preload all RuntimeAsset instances in a world
 *
 * @param world - The ECS World containing assets
 * @param commands - The Command interface
 * @param options - Preload options
 * @returns Promise that resolves when all assets are loaded
 *
 * @example
 * ```typescript
 * await preloadWorldAssets(world, commands, {
 *   onProgress: (progress) => {
 *     console.log(`Loading: ${progress.loaded}/${progress.total}`);
 *   }
 * });
 * ```
 */
export async function preloadWorldAssets(
  world: World,
  commands: Command,
  options?: PreloadAssetsOptions
): Promise<void> {
  const { onProgress } = options ?? {};

  // Find all RuntimeAsset instances
  const assets = findAllRuntimeAssets(world, commands);

  console.log(`[AssetPreloader] Found ${assets.length} assets to preload`);

  if (assets.length === 0) {
    return; // No assets to load
  }

  let loaded = 0;
  const total = assets.length;

  // Load all assets sequentially (to avoid overwhelming the system)
  for (const asset of assets) {
    // Report progress
    if (onProgress) {
      onProgress({
        loaded,
        total,
        currentAsset: asset.guid,
      });
    }

    console.log(`[AssetPreloader] Loading asset: ${asset.path}`);

    try {
      // Load the asset if not already loaded (using new parameterless API)
      if (!asset.isLoaded) {
        await asset.load();
        console.log(`[AssetPreloader] Loaded: ${asset.path}`);
      } else {
        console.log(`[AssetPreloader] Already loaded: ${asset.path}`);
      }
    } catch (error) {
      console.error(`[AssetPreloader] Failed to load asset: ${asset.path}`, error);
      // Continue loading other assets even if one fails
    }

    loaded++;
  }

  // Final progress update
  if (onProgress) {
    onProgress({
      loaded,
      total,
      currentAsset: null,
    });
  }
}
