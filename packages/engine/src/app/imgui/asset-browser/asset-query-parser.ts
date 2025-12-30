/**
 * Asset Query Parser
 *
 * Parses string queries for filtering assets in the asset browser.
 *
 * Query Syntax:
 * - `player` - Asset path/name contains "player" (case-insensitive)
 * - `T:texture` - Asset type is texture
 * - `T:audio,shader` - Asset type is audio OR shader
 * - `player T:texture` - Name contains "player" AND type is texture
 */

import { AssetType } from '../../../ecs/asset-metadata.js';
import { AssetDatabase } from '../../../ecs/asset-database.js';
import type { GUID } from '../../../ecs/asset-metadata.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a single filter condition
 */
export type AssetQueryFilter =
  | { type: 'name'; value: string } // Path/name contains "value"
  | { type: 'assetType'; types: AssetType[] }; // Asset type is one of these

/**
 * Parsed asset query result
 */
export interface AssetQueryResult {
  /** All filters that must be satisfied (AND) */
  filters: AssetQueryFilter[];
}

/**
 * Result of parsing - either success or error
 */
export type AssetQueryParseResult =
  | { success: true; query: AssetQueryResult }
  | { success: false; error: string };

// ============================================================================
// Asset Type Mapping
// ============================================================================

/**
 * Map of type filter strings to AssetType enum values
 */
const TYPE_MAP: Record<string, AssetType> = {
  texture: AssetType.Texture,
  tex: AssetType.Texture,
  image: AssetType.Texture,
  img: AssetType.Texture,
  audio: AssetType.Audio,
  sound: AssetType.Audio,
  music: AssetType.Audio,
  model: AssetType.Model3D,
  model3d: AssetType.Model3D,
  '3d': AssetType.Model3D,
  mesh: AssetType.Model3D,
  shader: AssetType.Shader,
  vsl: AssetType.Shader,
  tiledmap: AssetType.TiledMap,
  tiled: AssetType.TiledMap,
  map: AssetType.TiledMap,
  animation: AssetType.Animation,
  anim: AssetType.Animation,
  prefab: AssetType.Prefab,
  material: AssetType.Material,
  mat: AssetType.Material,
};

/**
 * Get AssetType from a filter string
 */
function parseAssetType(typeStr: string): AssetType | null {
  const normalized = typeStr.toLowerCase().trim();
  return TYPE_MAP[normalized] ?? null;
}

// ============================================================================
// Parser
// ============================================================================

/**
 * Parse an asset query string
 *
 * Syntax:
 * - `player` - Asset path/name contains "player" (case-insensitive)
 * - `T:texture` - Asset type is texture
 * - `T:audio,shader` - Asset type is audio OR shader
 * - `player T:texture` - Name contains "player" AND type is texture
 *
 * @param input - Query string
 * @returns Parse result with success/error
 */
export function parseAssetQuery(input: string): AssetQueryParseResult {
  try {
    const trimmed = input.trim();

    if (!trimmed) {
      return { success: true, query: { filters: [] } };
    }

    const filters: AssetQueryFilter[] = [];
    const nameTexts: string[] = [];

    // Regex to find T:... patterns
    const typePattern = /\bT:([A-Za-z0-9_,-]+)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = typePattern.exec(trimmed)) !== null) {
      // Add any text before this match as a name filter
      const textBefore = trimmed.slice(lastIndex, match.index).trim();
      if (textBefore) {
        nameTexts.push(textBefore);
      }

      // Parse type filter
      const typesStr = match[1] ?? '';
      const typeNames = typesStr.split(',').map((t) => t.trim()).filter(Boolean);
      const assetTypes: AssetType[] = [];

      for (const typeName of typeNames) {
        const assetType = parseAssetType(typeName);
        if (assetType !== null) {
          assetTypes.push(assetType);
        }
      }

      if (assetTypes.length > 0) {
        filters.push({ type: 'assetType', types: assetTypes });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text after last match
    const textAfter = trimmed.slice(lastIndex).trim();
    if (textAfter) {
      nameTexts.push(textAfter);
    }

    // Combine all name texts into one filter
    if (nameTexts.length > 0) {
      const combinedName = nameTexts.join(' ').trim();
      if (combinedName) {
        filters.push({ type: 'name', value: combinedName });
      }
    }

    return { success: true, query: { filters } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parse error',
    };
  }
}

/**
 * Evaluate if an asset matches a query
 *
 * @param guid - Asset GUID
 * @param query - Parsed query result
 * @returns True if asset matches all filters
 */
export function evaluateAssetQuery(guid: GUID, query: AssetQueryResult): boolean {
  const metadata = AssetDatabase.getMetadata(guid);
  if (!metadata) return false;

  // All filters must match (AND)
  for (const filter of query.filters) {
    switch (filter.type) {
      case 'name': {
        // Check if path contains the search text (case-insensitive)
        const searchLower = filter.value.toLowerCase();
        const pathLower = metadata.path.toLowerCase();
        const guidLower = guid.toLowerCase();

        if (!pathLower.includes(searchLower) && !guidLower.includes(searchLower)) {
          return false;
        }
        break;
      }

      case 'assetType': {
        // Check if asset type is one of the specified types
        if (!filter.types.includes(metadata.type)) {
          return false;
        }
        break;
      }
    }
  }

  return true;
}

/**
 * Get available asset type filter options for UI dropdown
 */
export function getAssetTypeFilterOptions(): { value: string; label: string; type: AssetType }[] {
  return [
    { value: 'texture', label: 'Texture', type: AssetType.Texture },
    { value: 'audio', label: 'Audio', type: AssetType.Audio },
    { value: 'model3d', label: '3D Model', type: AssetType.Model3D },
    { value: 'shader', label: 'Shader', type: AssetType.Shader },
    { value: 'tiledmap', label: 'Tiled Map', type: AssetType.TiledMap },
    { value: 'animation', label: 'Animation', type: AssetType.Animation },
    { value: 'prefab', label: 'Prefab', type: AssetType.Prefab },
    { value: 'material', label: 'Material', type: AssetType.Material },
  ];
}

/**
 * Get hint text for the search input
 */
export function getSearchHintText(): string {
  return 'Search assets... (use T:texture, T:audio, etc. to filter by type)';
}
