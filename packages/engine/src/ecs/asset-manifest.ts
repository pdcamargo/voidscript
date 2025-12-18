/**
 * Asset Manifest Loader
 *
 * Provides utilities for loading asset metadata from JSON manifest files.
 * This is the standalone approach for games without an editor - you maintain
 * a JSON file that describes your assets and their metadata.
 *
 * Example manifest.json:
 * ```json
 * {
 *   "version": "1.0",
 *   "basePath": "/assets",
 *   "assets": {
 *     "player-texture": {
 *       "path": "textures/player.png",
 *       "type": "texture",
 *       "metadata": {
 *         "filtering": "nearest",
 *         "wrapS": "clamp",
 *         "wrapT": "clamp"
 *       }
 *     },
 *     "card-spritesheet": {
 *       "path": "sprites/cards.json",
 *       "type": "spritesheet",
 *       "metadata": {
 *         "textureGuid": "player-texture"
 *       }
 *     }
 *   }
 * }
 * ```
 */

import {
  AssetMetadata,
  AssetType,
  BaseAssetMetadata,
  GUID,
  TextureFilter,
  TextureMetadata,
  TextureWrap,
} from './asset-metadata.js';

/**
 * Asset entry in the manifest file
 */
export interface ManifestAssetEntry {
  /** Relative path from basePath (or absolute if basePath not set) */
  path: string;

  /** Asset type (texture, spritesheet, material, scene, model3d, etc.) */
  type: string;

  /** Type-specific metadata (optional, will use defaults if not provided) */
  metadata?: Record<string, unknown>;
}

/**
 * Asset manifest file structure
 */
export interface AssetManifest {
  /** Manifest version (for future compatibility) */
  version: string;

  /** Base path prepended to all asset paths (optional) */
  basePath?: string;

  /** Map of asset GUID/ID to asset entry */
  assets: Record<string, ManifestAssetEntry>;
}

/**
 * Options for loading a manifest
 */
export interface ManifestLoadOptions {
  /** Override the base path from the manifest */
  basePath?: string;

  /** Validate asset paths exist (requires fetch, may be slow) */
  validatePaths?: boolean;
}

/**
 * Result of manifest loading
 */
export interface ManifestLoadResult {
  /** The loaded manifest */
  manifest: AssetManifest;

  /** Number of assets in the manifest */
  assetCount: number;

  /** Any warnings during loading */
  warnings: string[];
}

/**
 * Generate ISO datetime string
 */
function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Parse texture metadata from manifest entry
 */
function parseTextureMetadata(
  guid: GUID,
  path: string,
  metadata: Record<string, unknown> = {},
): TextureMetadata {
  return {
    guid,
    path,
    type: AssetType.Texture,
    importedAt: nowISO(),
    modifiedAt: nowISO(),
    filtering: (metadata['filtering'] as TextureFilter) ?? TextureFilter.Linear,
    wrapS: (metadata['wrapS'] as TextureWrap) ?? TextureWrap.ClampToEdge,
    wrapT: (metadata['wrapT'] as TextureWrap) ?? TextureWrap.ClampToEdge,
    sRGB: (metadata['sRGB'] as boolean) ?? true,
    generateMipmaps: (metadata['generateMipmaps'] as boolean) ?? true,
    width: metadata['width'] as number | undefined,
    height: metadata['height'] as number | undefined,
  };
}

/**
 * Parse unknown/generic asset metadata
 */
function parseUnknownMetadata(
  guid: GUID,
  path: string,
  type: string,
): BaseAssetMetadata {
  return {
    guid,
    path,
    type: type as AssetType,
    importedAt: nowISO(),
    modifiedAt: nowISO(),
  };
}

/**
 * Convert manifest entry to full AssetMetadata
 */
function entryToMetadata(
  guid: GUID,
  entry: ManifestAssetEntry,
  basePath: string = '',
): AssetMetadata {
  const fullPath = basePath ? `${basePath}/${entry.path}` : entry.path;

  switch (entry.type) {
    case 'texture':
    case AssetType.Texture:
      return parseTextureMetadata(guid, fullPath, entry.metadata);

    // Add more type-specific parsers as needed
    // case 'material':
    // case 'scene':
    // case 'model3d':

    default:
      return parseUnknownMetadata(guid, fullPath, entry.type) as AssetMetadata;
  }
}

/**
 * Asset Manifest Loader
 *
 * Loads and parses asset manifest JSON files, providing utilities
 * for integrating with the RuntimeAssetManager.
 */
export class AssetManifestLoader {
  private manifest: AssetManifest | null = null;
  private metadataCache: Map<GUID, AssetMetadata> = new Map();
  private basePath: string = '';

  /**
   * Load a manifest from a URL
   */
  async load(url: string, options: ManifestLoadOptions = {}): Promise<ManifestLoadResult> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load manifest from ${url}: ${response.statusText}`);
    }

    const manifest = (await response.json()) as AssetManifest;
    return this.loadFromObject(manifest, options);
  }

  /**
   * Load a manifest from an object (already parsed JSON)
   */
  loadFromObject(manifest: AssetManifest, options: ManifestLoadOptions = {}): ManifestLoadResult {
    this.manifest = manifest;
    this.basePath = options.basePath ?? manifest.basePath ?? '';
    this.metadataCache.clear();

    const warnings: string[] = [];

    // Pre-parse all asset metadata
    for (const [guid, entry] of Object.entries(manifest.assets)) {
      try {
        const metadata = entryToMetadata(guid, entry, this.basePath);
        this.metadataCache.set(guid, metadata);
      } catch (err) {
        warnings.push(`Failed to parse asset ${guid}: ${String(err)}`);
      }
    }

    return {
      manifest,
      assetCount: this.metadataCache.size,
      warnings,
    };
  }

  /**
   * Get metadata for an asset by GUID
   */
  getMetadata(guid: GUID): AssetMetadata | null {
    return this.metadataCache.get(guid) ?? null;
  }

  /**
   * Check if an asset exists in the manifest
   */
  hasAsset(guid: GUID): boolean {
    return this.metadataCache.has(guid);
  }

  /**
   * Get all asset GUIDs
   */
  getAllGuids(): GUID[] {
    return Array.from(this.metadataCache.keys());
  }

  /**
   * Get all assets of a specific type
   */
  getAssetsByType(type: AssetType): AssetMetadata[] {
    return Array.from(this.metadataCache.values()).filter((m) => m.type === type);
  }

  /**
   * Create a metadata resolver function for use with RuntimeAssetManager
   *
   * Usage:
   * ```typescript
   * const loader = new AssetManifestLoader();
   * await loader.load('/assets/manifest.json');
   * const resolver = loader.createResolver();
   *
   * // Pass to scene loading, deserialization, etc.
   * SceneManager.get().loadSceneAsset(guid, sceneLoader, { assetMetadataResolver: resolver });
   * ```
   */
  createResolver(): (guid: GUID) => AssetMetadata | null {
    return (guid: GUID) => this.getMetadata(guid);
  }

  /**
   * Get the base path being used
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Get full path for an asset
   */
  getFullPath(guid: GUID): string | null {
    const metadata = this.getMetadata(guid);
    return metadata?.path ?? null;
  }

  /**
   * Clear the loaded manifest
   */
  clear(): void {
    this.manifest = null;
    this.metadataCache.clear();
    this.basePath = '';
  }
}

/**
 * Static helper to quickly load a manifest and create a resolver
 */
export async function loadManifest(
  url: string,
  options: ManifestLoadOptions = {},
): Promise<{
  loader: AssetManifestLoader;
  resolver: (guid: GUID) => AssetMetadata | null;
  result: ManifestLoadResult;
}> {
  const loader = new AssetManifestLoader();
  const result = await loader.load(url, options);
  const resolver = loader.createResolver();

  return { loader, resolver, result };
}

/**
 * Create an in-memory manifest programmatically
 * Useful for testing or simple projects without a JSON file
 *
 * Usage:
 * ```typescript
 * const manifest = createManifest('/assets', {
 *   'player-texture': { path: 'player.png', type: 'texture' },
 *   'enemy-texture': { path: 'enemy.png', type: 'texture', metadata: { filtering: 'nearest' } },
 * });
 *
 * const loader = new AssetManifestLoader();
 * loader.loadFromObject(manifest);
 * ```
 */
export function createManifest(
  basePath: string,
  assets: Record<string, ManifestAssetEntry>,
): AssetManifest {
  return {
    version: '1.0',
    basePath,
    assets,
  };
}
