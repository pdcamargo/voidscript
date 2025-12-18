/**
 * Tiled Tile Layer Sync System
 *
 * Render phase system that synchronizes TiledTileLayer components to Three.js meshes.
 *
 * Follows the three-phase pattern:
 * 1. Create meshes for new tile layers (have TiledTileLayer but no RenderObject)
 * 2. Update existing tile layer meshes
 * 3. Remove meshes for deleted tile layers (have RenderObject but no TiledTileLayer)
 *
 * Runs in the render phase (every frame).
 */

import { system } from '../../ecs/system.js';
import type { Entity } from '../../ecs/entity.js';
import type { Command } from '../../ecs/command.js';
import { Transform3D } from '../../ecs/components/rendering/transform-3d.js';
import { RenderObject } from '../../ecs/components/rendering/render-object.js';
import { TiledTileLayer } from '../../ecs/components/tiled/tiled-tile-layer.js';
import { TiledMap } from '../../ecs/components/tiled/tiled-map.js';
import { TilemapRenderManager } from '../tilemap-render-manager.js';
import { findTilesetForGid, decodeTileLayerData } from '../tiled-utils.js';
import { transformPropagationSystem } from '../../ecs/systems/renderer-sync-system.js';

/**
 * Tiled Tile Layer Sync System
 *
 * Synchronizes tile layers to TilemapRenderManager.
 */
export const tiledTileLayerSyncSystem = system(({ commands }) => {
  const tilemapManager = commands.getResource(TilemapRenderManager);

  // Phase 1: Create new tilemaps (have TiledTileLayer + Transform3D but no RenderObject)
  commands
    .query()
    .all(Transform3D, TiledTileLayer)
    .none(RenderObject)
    .each((entity, transform, tileLayer) => {
      try {
        const handle = createTilemapMesh(entity, transform, tileLayer, commands, tilemapManager);
        // Valid handle check: handle must be non-null and >= 0 (createTilemap returns -1 on failure)
        if (handle !== null && handle >= 0) {
          commands.entity(entity).addComponent(RenderObject, { handle });
        }
      } catch (error) {
        console.error(`[tiledTileLayerSyncSystem] Failed to create tilemap for entity ${entity}:`, error);
      }
    });

  // Phase 2: Update existing tilemaps
  commands
    .query()
    .all(Transform3D, TiledTileLayer, RenderObject)
    .each((entity, transform, tileLayer) => {
      // Get parent map to check for isLit inheritance
      const tiledMap = commands.tryGetComponent(tileLayer.mapEntity, TiledMap);

      // Determine effective isLit value:
      // - If layer has explicit isLit property from Tiled, use that
      // - Otherwise inherit from parent TiledMap
      let effectiveIsLit = tileLayer.isLit;
      if (!tileLayer.properties.has('isLit') && tiledMap) {
        effectiveIsLit = tiledMap.isLit ?? false;
      }

      // Create a modified layer data with the effective isLit value
      const layerDataWithInheritedLit = {
        ...tileLayer,
        isLit: effectiveIsLit,
      };

      // Transform3D is already world-space (computed by transformPropagationSystem)
      tilemapManager.updateTilemap(
        entity,
        {
          position: transform.position,
          rotation: { z: transform.rotation.z },
          scale: { x: transform.scale.x, y: transform.scale.y },
        },
        layerDataWithInheritedLit
      );
    });

  // Phase 3: Remove tilemaps for deleted layers
  // (have RenderObject but no TiledTileLayer)
  commands
    .query()
    .all(RenderObject)
    .none(TiledTileLayer)
    .each((entity) => {
      if (tilemapManager.hasTilemap(entity)) {
        tilemapManager.removeTilemap(entity);
      }
    });
}).runAfter(transformPropagationSystem);

/**
 * Create a tilemap mesh for a tile layer
 */
function createTilemapMesh(
  entity: Entity,
  transform: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number } },
  tileLayer: { mapEntity: Entity; layerData: any; name: string; offsetX: number; offsetY: number; opacity: number; visible: boolean; parallaxX: number; parallaxY: number; zOrder: number; properties: Map<string, any>; renderHandle: number | null; isLit?: boolean },
  commands: Command,
  tilemapManager: TilemapRenderManager
): number | null {
  // Get parent map
  const tiledMap = commands.tryGetComponent(tileLayer.mapEntity, TiledMap);
  if (!tiledMap) {
    console.error(
      `[tiledTileLayerSyncSystem] TiledTileLayer entity ${entity} has invalid mapEntity`
    );
    return null;
  }

  // Get tile data
  const layerData = tileLayer.layerData;

  // Decode tile data to find which tileset to use
  // We'll use the first non-zero GID to determine the tileset
  const tileGids = decodeTileLayerData(layerData);
  let firstGid = 0;
  for (const gid of tileGids) {
    if (gid !== 0) {
      firstGid = gid;
      break;
    }
  }

  if (firstGid === 0) {
    // Layer is empty, skip rendering
    console.warn(
      `[tiledTileLayerSyncSystem] Tile layer "${tileLayer.name}" is empty. Skipping rendering.`
    );
    return null;
  }

  // Find tileset for this GID
  const tilesetInfo = findTilesetForGid(firstGid, tiledMap);
  if (!tilesetInfo) {
    console.error(
      `[tiledTileLayerSyncSystem] Could not find tileset for GID ${firstGid} ` +
        `in layer "${tileLayer.name}"`
    );
    return null;
  }

  // Determine pixelsPerUnit (use map's tile width)
  const pixelsPerUnit = tiledMap.mapData.tilewidth;

  // Read sortingLayer and sortingOrder from custom properties (validate they're integers)
  let sortingLayer: number | undefined;
  let sortingOrder: number | undefined;

  if (tileLayer.properties.has('sortingLayer')) {
    const value = tileLayer.properties.get('sortingLayer');
    if (typeof value === 'number' && Number.isInteger(value)) {
      sortingLayer = value;
    } else {
      console.warn(
        `[tiledTileLayerSyncSystem] Layer "${tileLayer.name}" has invalid sortingLayer property. ` +
          `Expected integer, got ${typeof value}. Ignoring.`
      );
    }
  }

  if (tileLayer.properties.has('sortingOrder')) {
    const value = tileLayer.properties.get('sortingOrder');
    if (typeof value === 'number' && Number.isInteger(value)) {
      sortingOrder = value;
    } else {
      console.warn(
        `[tiledTileLayerSyncSystem] Layer "${tileLayer.name}" has invalid sortingOrder property. ` +
          `Expected integer, got ${typeof value}. Ignoring.`
      );
    }
  }

  // Create tilemap mesh
  const handle = tilemapManager.createTilemap(entity, layerData, tilesetInfo, {
    worldOffset: {
      x: transform.position.x,
      y: transform.position.y,
      z: transform.position.z,
    },
    pixelsPerUnit,
    zOrder: tileLayer.zOrder,
    opacity: tileLayer.opacity,
    sortingLayer,
    sortingOrder,
    isLit: tileLayer.isLit,
  });

  return handle;
}
