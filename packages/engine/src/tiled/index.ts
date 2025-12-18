/**
 * Tiled Integration
 *
 * Full ECS integration for Tiled maps with:
 * - @kayahr/tiled type definitions
 * - Components for maps, layers, and objects
 * - Resources for asset loading and rendering
 * - Systems for automatic layer spawning and rendering
 * - High-level API helpers
 */

// Re-export @kayahr/tiled
export * as tiled from '@kayahr/tiled';

// Export resources
export { TiledAssetRegistry } from './tiled-asset-registry.js';
export { TilemapRenderManager, type TilemapCreateOptions } from './tilemap-render-manager.js';

// Export systems
export {
  tiledMapLoaderSystem,
  tiledObjectSpawnerSystem,
  tiledTileLayerSyncSystem,
  tiledAnimationSystem,
  tiledTilesetCollisionSystem,
  tiledObjectCollisionSystem,
} from './systems/index.js';

// Export utilities
export * from './tiled-utils.js';
export * from './tiled-collision-utils.js';
export * from './tiled-collision-merger.js';

// Export loader helpers
export * from './tiled-loader.js';
export * from './spawn-tiled-map-from-asset.js';
