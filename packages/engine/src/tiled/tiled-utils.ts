/**
 * Tiled Utilities
 *
 * Helper functions for working with Tiled maps:
 * - Coordinate conversion between Tiled and engine coordinate systems
 * - GID manipulation and flip flag extraction
 * - Property parsing from Tiled format
 * - Tileset lookups
 */

import type * as tiled from '@kayahr/tiled';
import type { TilesetInfo, TiledMapData } from '../ecs/components/tiled/tiled-map.js';

/**
 * Flip flags from Tiled (embedded in GID)
 */
export const FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
export const FLIPPED_VERTICALLY_FLAG = 0x40000000;
export const FLIPPED_DIAGONALLY_FLAG = 0x20000000;
export const FLIP_FLAGS_MASK = 0xe0000000;

/**
 * Extract GID and flip flags from a Tiled GID
 *
 * @param gid - Raw GID from Tiled (may include flip flags)
 * @returns Cleaned GID and flip flags
 */
export function extractGidAndFlips(gid: number): {
  gid: number;
  flipX: boolean;
  flipY: boolean;
  flipD: boolean;
} {
  return {
    gid: gid & ~FLIP_FLAGS_MASK,
    flipX: !!(gid & FLIPPED_HORIZONTALLY_FLAG),
    flipY: !!(gid & FLIPPED_VERTICALLY_FLAG),
    flipD: !!(gid & FLIPPED_DIAGONALLY_FLAG),
  };
}

/**
 * Convert Tiled coordinates to engine world coordinates
 *
 * Tiled uses Y+ down, engine uses Y+ up
 *
 * @param tiledX - X coordinate in Tiled (pixels)
 * @param tiledY - Y coordinate in Tiled (pixels)
 * @param tileWidth - Tile width in pixels
 * @param tileHeight - Tile height in pixels
 * @param worldOffset - World-space offset
 * @param orientation - Map orientation (default: orthogonal)
 * @returns World-space coordinates
 */
export function tiledCoordsToWorld(
  tiledX: number,
  tiledY: number,
  tileWidth: number,
  tileHeight: number,
  worldOffset: { x: number; y: number; z: number },
  orientation: string = 'orthogonal'
): { x: number; y: number; z: number } {
  let worldX = tiledX;
  let worldY = -tiledY; // Flip Y (Tiled Y+ is down, engine Y+ is up)

  // Handle different map orientations
  if (orientation === 'isometric') {
    // Isometric conversion
    const isoX = (tiledX - tiledY) * (tileWidth / 2);
    const isoY = (tiledX + tiledY) * (tileHeight / 2);
    worldX = isoX;
    worldY = -isoY;
  }

  // Convert pixels to world units (pixelsPerUnit defaults to tileWidth)
  worldX = worldX / tileWidth;
  worldY = worldY / tileHeight;

  return {
    x: worldX + worldOffset.x,
    y: worldY + worldOffset.y,
    z: worldOffset.z,
  };
}

/**
 * Parse Tiled properties to a Map
 *
 * @param props - Array of Tiled properties
 * @returns Map of property name to value
 */
export function parseProperties(props?: tiled.Property[]): Map<string, any> {
  const map = new Map<string, any>();
  if (!props) return map;

  for (const prop of props) {
    let value: any = prop.value;

    // Convert based on type
    switch (prop.type) {
      case 'bool':
        value = Boolean(prop.value);
        break;
      case 'int':
      case 'float':
        value = Number(prop.value);
        break;
      case 'color':
        value = parseColorProperty(prop.value as string);
        break;
      case 'file':
        value = String(prop.value);
        break;
      case 'object':
        value = Number(prop.value); // Object ID
        break;
      default:
        value = prop.value;
    }

    map.set(prop.name, value);
  }

  return map;
}

/**
 * Parse a Tiled color property to RGBA (0-1 range)
 *
 * @param color - Tiled color string (#AARRGGBB)
 * @returns RGBA object
 */
export function parseColorProperty(color: string): {
  r: number;
  g: number;
  b: number;
  a: number;
} {
  // Tiled format: #AARRGGBB
  const hex = color.replace('#', '');
  return {
    a: parseInt(hex.substring(0, 2), 16) / 255,
    r: parseInt(hex.substring(2, 4), 16) / 255,
    g: parseInt(hex.substring(4, 6), 16) / 255,
    b: parseInt(hex.substring(6, 8), 16) / 255,
  };
}

/**
 * Find the tileset that contains a given GID
 *
 * @param gid - Global tile ID
 * @param tiledMap - TiledMap component data
 * @returns Tileset info or null if not found
 */
export function findTilesetForGid(
  gid: number,
  tiledMap: TiledMapData
): TilesetInfo | null {
  const cleanGid = extractGidAndFlips(gid).gid;

  // Tilesets are sorted by firstGid
  // Find the tileset where firstGid <= cleanGid and is the highest such firstGid
  let bestTileset: TilesetInfo | null = null;

  for (const [firstGid, tilesetInfo] of tiledMap.tilesetMapping.entries()) {
    if (firstGid <= cleanGid) {
      if (!bestTileset || firstGid > bestTileset.firstGid) {
        bestTileset = tilesetInfo;
      }
    }
  }

  return bestTileset;
}

/**
 * Decode Tiled tile layer data
 *
 * Handles both uncompressed arrays and encoded/compressed data
 *
 * @param layer - Tiled tile layer
 * @returns Array of GIDs (may include flip flags)
 */
export function decodeTileLayerData(layer: tiled.TileLayer): number[] {
  if (Array.isArray(layer.data)) {
    // Uncompressed array
    return layer.data;
  }

  // For compressed data, we need to implement decoding
  // The @kayahr/tiled package doesn't provide a built-in decoder in v0.0.1
  // For now, we'll throw an error and handle this in the future
  throw new Error(
    'Compressed tile layer data is not yet supported. ' +
      'Please export your Tiled map with uncompressed tile layer format (CSV or uncompressed).'
  );
}

/**
 * Validate that a Tiled map is supported
 *
 * @param map - Tiled map data
 * @throws Error if the map uses unsupported features
 */
export function validateMapSupport(map: tiled.Map): void {
  if (map.infinite) {
    throw new Error(
      'Infinite maps are not supported in Phase 1. ' +
        'Please export as a fixed-size map or wait for Phase 2 chunk-based loading.'
    );
  }

  if (map.orientation === 'hexagonal' || map.orientation === 'staggered') {
    console.warn(
      `[TiledMap] ${map.orientation} orientation is experimental. ` +
        'Only orthogonal and isometric are fully tested.'
    );
  }
}

/**
 * Resolve a path relative to a base path
 *
 * @param basePath - Base path (e.g., '/assets/maps/level1.json')
 * @param relativePath - Relative path (e.g., '../tilesets/terrain.tsx')
 * @returns Resolved absolute path
 */
export function resolvePath(basePath: string, relativePath: string): string {
  // Get directory of base path
  const baseDir = basePath.substring(0, basePath.lastIndexOf('/'));

  // Handle '..' in relative path
  const parts = relativePath.split('/');
  const dirParts = baseDir.split('/');

  for (const part of parts) {
    if (part === '..') {
      dirParts.pop();
    } else if (part !== '.') {
      dirParts.push(part);
    }
  }

  return dirParts.join('/');
}
