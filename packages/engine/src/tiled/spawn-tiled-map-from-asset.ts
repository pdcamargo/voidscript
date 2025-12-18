/**
 * Spawn Tiled Map from Asset
 *
 * Helper function to spawn a Tiled map entity from a RuntimeAsset.
 * Separates asset loading from entity spawning for clean architecture.
 */

import type { Command } from '../ecs/command.js';
import type { RuntimeAsset } from '../ecs/runtime-asset.js';
import type { Entity } from '../ecs/entity.js';
import { loadTiledMap } from './tiled-loader.js';
import { isTiledMapMetadata } from '../ecs/asset-metadata.js';

/**
 * Spawn a Tiled map entity from a RuntimeAsset<tiled.Map>
 *
 * This helper function loads the asset (if not already loaded) and spawns
 * the map entity using the existing loadTiledMap function. This approach
 * separates asset loading from entity spawning, allowing the same map
 * to be spawned multiple times.
 *
 * @param asset - TiledMap RuntimeAsset
 * @param commands - Command API for entity spawning
 * @returns Entity ID of the spawned map
 *
 * @example
 * ```typescript
 * // Get the asset from RuntimeAssetManager
 * const mapAsset = RuntimeAssetManager.get().get('level-1');
 *
 * // Spawn the map entity
 * const mapEntity = await spawnTiledMapFromAsset(mapAsset, commands);
 *
 * // The map and all its layers are now spawned in the world
 * ```
 */
export async function spawnTiledMapFromAsset(
  asset: RuntimeAsset<any>,
  commands: Command
): Promise<Entity> {
  const metadata = asset.metadata;

  // Validate asset type
  if (!isTiledMapMetadata(metadata)) {
    throw new Error(
      `[spawnTiledMapFromAsset] Asset is not a TiledMap. Got type: ${metadata.type}`
    );
  }

  // Load asset if not already loaded
  // The asset loader returns raw tiled.Map JSON
  if (!asset.isLoaded) {
    await asset.load();
  }

  // Spawn map using existing loader (which handles TiledAssetRegistry, tileset loading, etc.)
  // We use the asset path directly since the asset loader just fetches the JSON
  const entityHandle = await loadTiledMap(commands, asset.path, {
    pixelsPerUnit: metadata.pixelsPerUnit,
    worldOffset: metadata.worldOffset,
    autoSpawnLayers: metadata.autoSpawnLayers,
    mapAsset: asset, // Pass RuntimeAsset reference for editor integration
  });

  return entityHandle.id();
}
