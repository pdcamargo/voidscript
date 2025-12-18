/**
 * Tiled Collision Merger
 *
 * Performance optimization utilities for merging adjacent tile collisions
 * into larger collider shapes.
 *
 * Algorithm: Greedy Horizontal-Vertical Merging
 * 1. Group tiles by identical collision shape
 * 2. Build 2D grid map for spatial queries
 * 3. For each unvisited tile:
 *    - Expand horizontally (right) while same shape
 *    - Try expand vertically (down) while row matches
 *    - Mark all tiles in rectangle as visited
 *    - Create merged collider
 *
 * Only merges cuboid (rectangle) shapes - circles/capsules cannot be efficiently merged.
 */

import type * as tiled from '@kayahr/tiled';
import type { ColliderShape2D } from '../physics/types.js';
import type { TiledMapData } from '../ecs/components/tiled/tiled-map.js';
import { Vector2 } from 'three';
import { extractGidAndFlips, findTilesetForGid, decodeTileLayerData } from './tiled-utils.js';
import { parseTiledCollisionShape } from './tiled-collision-utils.js';

/**
 * Tile collision data extracted from a tile layer
 */
export interface TileCollisionData {
  /** Tile X position in grid coordinates */
  tileX: number;

  /** Tile Y position in grid coordinates */
  tileY: number;

  /** Global tile ID */
  gid: number;

  /** Collision shape for this tile */
  collisionShape: ColliderShape2D;

  /** Offset from tile origin (in tile units) */
  offset: Vector2;

  /** Physics properties (matching Collider2D defaults) */
  friction: number;      // Default: 0.5
  restitution: number;   // Default: 0.0
  density: number;       // Default: 1.0
  isSensor: boolean;     // Default: false
}

/**
 * Merged collider result (in world coordinates)
 */
export interface MergedCollider {
  /** World X position (center) */
  x: number;

  /** World Y position (center) */
  y: number;

  /** Width in world units */
  width: number;

  /** Height in world units */
  height: number;

  /** Collision shape */
  shape: ColliderShape2D;

  /** Original tile GIDs that were merged */
  sourceTiles: number[];

  /** Physics properties (from merged tiles - all identical) */
  friction: number;
  restitution: number;
  density: number;
  isSensor: boolean;
}

/**
 * Parse physics properties from a Tiled object, with defaults matching Collider2D
 *
 * @param obj - Tiled map object
 * @returns Physics properties with type-safe defaults
 */
function parseColliderProperties(obj: tiled.MapObject): {
  friction: number;
  restitution: number;
  density: number;
  isSensor: boolean;
} {
  // Build property map (same pattern as object layer system)
  const properties = new Map<string, any>();
  if (obj.properties) {
    for (const prop of obj.properties) {
      properties.set(prop.name, prop.value);
    }
  }

  // Parse with type-safe defaults (matching object layer system)
  const friction = typeof properties.get('friction') === 'number'
    ? properties.get('friction')
    : 0.5;

  const restitution = typeof properties.get('restitution') === 'number'
    ? properties.get('restitution')
    : 0.0;

  const density = typeof properties.get('density') === 'number'
    ? properties.get('density')
    : 1.0;

  const isSensor = properties.get('sensor') === true;  // Note: property name is "sensor", not "isSensor"

  return { friction, restitution, density, isSensor };
}

/**
 * Extract collision data from all tiles in a tile layer
 *
 * @param layer - Tiled tile layer
 * @param tiledMap - TiledMap component data
 * @returns Array of tile collision data
 */
export function extractTileCollisions(
  layer: tiled.TileLayer,
  tiledMap: TiledMapData
): TileCollisionData[] {
  const collisions: TileCollisionData[] = [];

  // Decode tile layer data
  const tileData = decodeTileLayerData(layer);

  // Iterate through each tile in the layer
  for (let y = 0; y < layer.height; y++) {
    for (let x = 0; x < layer.width; x++) {
      const index = y * layer.width + x;
      const rawGid = tileData[index];

      // Skip empty tiles (GID 0 or undefined)
      if (!rawGid || rawGid === 0) continue;

      // Extract clean GID and flip flags
      const { gid: cleanGid } = extractGidAndFlips(rawGid);

      // Find tileset for this GID
      const tilesetInfo = findTilesetForGid(cleanGid, tiledMap);
      if (!tilesetInfo) continue;

      // Get local tile ID within the tileset
      const localTileId = cleanGid - tilesetInfo.firstGid;

      // Check if this tile has collision shapes defined
      const tileset = tilesetInfo.tilesetData;
      const tile = tileset.tiles?.find((t) => t.id === localTileId);

      if (!tile || !tile.objectgroup || !tile.objectgroup.objects.length) {
        continue; // No collision data for this tile
      }

      // Extract collision shapes from the tile's objectgroup
      // Only process objects with type "Collider2D"
      for (const obj of tile.objectgroup.objects) {
        // Skip objects that are not marked as Collider2D
        if (obj.type !== 'Collider2D') {
          continue;
        }

        const shape = parseTiledCollisionShape(obj);
        if (!shape) continue;

        // Parse physics properties from object
        const { friction, restitution, density, isSensor } = parseColliderProperties(obj);

        // Calculate offset from tile origin
        // Object coordinates are relative to tile (0,0 = top-left)
        const objX = obj.x ?? 0;
        const objY = obj.y ?? 0;
        const objWidth = obj.width ?? 0;
        const objHeight = obj.height ?? 0;

        // Offset to center of collision shape (in tile units)
        const offsetX = (objX + objWidth / 2) / tileset.tilewidth;
        const offsetY = -(objY + objHeight / 2) / tileset.tileheight; // Flip Y

        collisions.push({
          tileX: x,
          tileY: y,
          gid: cleanGid,
          collisionShape: shape,
          offset: new Vector2(offsetX, offsetY),
          friction,
          restitution,
          density,
          isSensor,
        });
      }
    }
  }

  if (collisions.length > 0) {
    console.log(
      `[extractTileCollisions] Extracted ${collisions.length} collision(s) with type "Collider2D" from layer`
    );
  }

  return collisions;
}

/**
 * Merge adjacent cuboid collisions into larger rectangles
 *
 * Uses greedy horizontal-vertical merging algorithm for performance.
 *
 * @param collisions - Array of tile collision data
 * @param tileWidth - Tile width in pixels
 * @param tileHeight - Tile height in pixels
 * @param worldOffsetX - World offset X
 * @param worldOffsetY - World offset Y
 * @param mapWidth - Map width in tiles
 * @param mapHeight - Map height in tiles
 * @returns Array of merged colliders in world coordinates
 */
export function mergeAdjacentCuboids(
  collisions: TileCollisionData[],
  tileWidth: number,
  tileHeight: number,
  worldOffsetX: number,
  worldOffsetY: number,
  mapWidth: number,
  mapHeight: number
): MergedCollider[] {
  if (collisions.length === 0) return [];

  // Group collisions by shape hash (only merge identical shapes)
  const shapeGroups = new Map<string, TileCollisionData[]>();

  for (const collision of collisions) {
    // Only merge cuboids
    if (collision.collisionShape.type !== 'cuboid') {
      // Non-cuboid shapes get their own group (no merging)
      const hash = `nonmerge_${collision.tileX}_${collision.tileY}`;
      shapeGroups.set(hash, [collision]);
      continue;
    }

    const hash = hashCollisionShape(
      collision.collisionShape,
      collision.offset,
      collision.friction,
      collision.restitution,
      collision.density,
      collision.isSensor
    );
    if (!shapeGroups.has(hash)) {
      shapeGroups.set(hash, []);
    }
    shapeGroups.get(hash)!.push(collision);
  }

  const mergedColliders: MergedCollider[] = [];

  // Process each group independently
  for (const [hash, group] of shapeGroups.entries()) {
    // If group has only one tile, no merging needed
    if (group.length === 1) {
      mergedColliders.push(
        ...convertToMergedColliders(group, tileWidth, tileHeight, worldOffsetX, worldOffsetY, mapWidth, mapHeight)
      );
      continue;
    }

    // Skip merging for non-cuboid shapes
    if (hash.startsWith('nonmerge_')) {
      mergedColliders.push(
        ...convertToMergedColliders(group, tileWidth, tileHeight, worldOffsetX, worldOffsetY, mapWidth, mapHeight)
      );
      continue;
    }

    // Build grid map for spatial queries
    const gridMap = new Map<string, TileCollisionData>();
    for (const tile of group) {
      gridMap.set(`${tile.tileX},${tile.tileY}`, tile);
    }

    // Track visited tiles
    const visited = new Set<string>();

    // Greedy merging
    for (const tile of group) {
      const key = `${tile.tileX},${tile.tileY}`;
      if (visited.has(key)) continue;

      // Expand horizontally (right)
      let width = 1;
      while (gridMap.has(`${tile.tileX + width},${tile.tileY}`)) {
        const nextKey = `${tile.tileX + width},${tile.tileY}`;
        if (visited.has(nextKey)) break;
        width++;
      }

      // Try to expand vertically (down)
      let height = 1;
      let canExpandDown = true;

      while (canExpandDown) {
        // Check if entire row below matches the width
        for (let dx = 0; dx < width; dx++) {
          const checkKey = `${tile.tileX + dx},${tile.tileY + height}`;
          if (!gridMap.has(checkKey) || visited.has(checkKey)) {
            canExpandDown = false;
            break;
          }
        }

        if (canExpandDown) {
          height++;
        }
      }

      // Mark all tiles in this rectangle as visited
      const sourceTiles: number[] = [];
      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
          const visitKey = `${tile.tileX + dx},${tile.tileY + dy}`;
          visited.add(visitKey);
          const visitTile = gridMap.get(visitKey);
          if (visitTile) {
            sourceTiles.push(visitTile.gid);
          }
        }
      }

      // Create merged collider
      // Position is center of the merged rectangle
      const centerTileX = tile.tileX + width / 2;
      const centerTileY = tile.tileY + height / 2;

      // Visual renderer positions tiles relative to map center
      // Tiles are positioned at their center (tile 0 has center at 0.5, 0.5)
      // Colliders are children of layer, so need LocalTransform that matches visual position
      const mapCenterX = mapWidth / 2 + 0.5;
      const mapCenterY = mapHeight / 2 + 0.5;

      const worldX = (centerTileX - mapCenterX) + worldOffsetX;
      const worldY = -(centerTileY - mapCenterY) + worldOffsetY;

      // Create merged shape (scale up the original shape)
      const baseShape = tile.collisionShape as Extract<ColliderShape2D, { type: 'cuboid' }>;

      // Get properties from first tile (all tiles in group have identical properties due to hash grouping)
      const { friction, restitution, density, isSensor } = tile;

      mergedColliders.push({
        x: worldX + tile.offset.x,
        y: worldY + tile.offset.y,
        width: width,
        height: height,
        shape: {
          type: 'cuboid',
          // baseShape is in pixels, need to convert to world units and scale by merge count
          halfWidth: (baseShape.halfWidth * width) / tileWidth,
          halfHeight: (baseShape.halfHeight * height) / tileHeight,
        },
        sourceTiles,
        friction,
        restitution,
        density,
        isSensor,
      });
    }
  }

  return mergedColliders;
}

/**
 * Convert individual tile collisions to merged colliders (1:1 mapping, no merging)
 */
function convertToMergedColliders(
  collisions: TileCollisionData[],
  tileWidth: number,
  tileHeight: number,
  worldOffsetX: number,
  worldOffsetY: number,
  mapWidth: number,
  mapHeight: number
): MergedCollider[] {
  return collisions.map((collision) => {
    // Center position of tile
    const centerTileX = collision.tileX + 0.5;
    const centerTileY = collision.tileY + 0.5;

    // Visual renderer positions tiles relative to map center
    // Tiles are positioned at their center (tile 0 has center at 0.5, 0.5)
    // Colliders are children of layer, so need LocalTransform that matches visual position
    const mapCenterX = mapWidth / 2 + 0.5;
    const mapCenterY = mapHeight / 2 + 0.5;

    const worldX = (centerTileX - mapCenterX) + worldOffsetX;
    const worldY = -(centerTileY - mapCenterY) + worldOffsetY;

    // Convert shape from pixel units to world units
    // Shapes from parseTiledCollisionShape() are in pixels, need conversion
    let shape = collision.collisionShape;
    if (shape.type === 'cuboid') {
      shape = {
        type: 'cuboid',
        halfWidth: shape.halfWidth / tileWidth,
        halfHeight: shape.halfHeight / tileHeight,
      };
    } else if (shape.type === 'ball') {
      const scale = (tileWidth + tileHeight) / 2;
      shape = {
        type: 'ball',
        radius: shape.radius / scale,
      };
    }

    // Include properties from source collision
    const { friction, restitution, density, isSensor } = collision;

    return {
      x: worldX + collision.offset.x,
      y: worldY + collision.offset.y,
      width: 1,
      height: 1,
      shape,
      sourceTiles: [collision.gid],
      friction,
      restitution,
      density,
      isSensor,
    };
  });
}

/**
 * Generate a hash for a collision shape + offset + properties for grouping identical tiles
 *
 * Only tiles with identical shapes AND properties will be grouped together for merging.
 */
function hashCollisionShape(
  shape: ColliderShape2D,
  offset: Vector2,
  friction: number,
  restitution: number,
  density: number,
  isSensor: boolean
): string {
  const offsetStr = `${offset.x.toFixed(3)},${offset.y.toFixed(3)}`;

  // Include properties in hash to ensure only identical tiles merge
  const propsStr = `_f${friction.toFixed(3)}_r${restitution.toFixed(3)}_d${density.toFixed(3)}_s${isSensor ? '1' : '0'}`;

  if (shape.type === 'cuboid') {
    return `cuboid_${shape.halfWidth.toFixed(3)}_${shape.halfHeight.toFixed(3)}_${offsetStr}${propsStr}`;
  } else if (shape.type === 'ball') {
    return `ball_${shape.radius.toFixed(3)}_${offsetStr}${propsStr}`;
  } else if (shape.type === 'capsule') {
    return `capsule_${shape.halfHeight.toFixed(3)}_${shape.radius.toFixed(3)}_${offsetStr}${propsStr}`;
  }

  return 'unknown';
}
