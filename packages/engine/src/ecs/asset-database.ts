/**
 * AssetDatabase - Central registry for application assets
 *
 * Provides:
 * - Asset registration from ApplicationConfig
 * - Path-to-GUID bidirectional lookup
 * - GUID generation helpers
 * - Integration with RuntimeAssetManager
 *
 * @example
 * ```typescript
 * // Initialize with assets from ApplicationConfig
 * AssetDatabase.initialize({
 *   "player-texture": {
 *     type: AssetType.Texture,
 *     path: "/textures/player.png",
 *     magFilter: TextureFilter.Nearest,
 *   }
 * });
 *
 * // Find asset by path
 * const guid = AssetDatabase.findByPath("/textures/player.png");
 *
 * // Generate new GUID
 * const newGuid = AssetDatabase.generateGuid();
 * ```
 */

import type {
  GUID,
  AssetMetadata,
  TextureMetadata,
  Model3DMetadata,
  ModelFormat,
  TiledMapMetadata,
  AnimationMetadata,
  AudioAssetMetadata,
  SpriteDefinition,
} from './asset-metadata.js';
import { AssetType, TextureFilter, TextureWrap } from './asset-metadata.js';
import { RuntimeAssetManager } from './runtime-asset-manager.js';
import type { Vector3 } from '../math/index.js';

// ============================================================================
// Asset Config Types (Discriminated Union)
// ============================================================================

/**
 * Base asset configuration interface
 */
export interface BaseAssetConfig {
  type: AssetType;
  path: string;
}

/**
 * Texture asset configuration
 * Used in ApplicationConfig.assets
 */
export interface TextureAssetConfig extends BaseAssetConfig {
  type: AssetType.Texture;
  path: string;
  magFilter?: TextureFilter;
  minFilter?: TextureFilter;
  wrapS?: TextureWrap;
  wrapT?: TextureWrap;
  sRGB?: boolean;
  generateMipmaps?: boolean;
  width?: number;
  height?: number;
  sprites?: Array<{
    id: string;
    name: string;
    tileIndex: number;
    tileWidth: number;
    tileHeight: number;
  }>;
}

/**
 * Model3D asset configuration (GLTF/GLB/FBX)
 * Used in ApplicationConfig.assets
 */
export interface Model3DAssetConfig extends BaseAssetConfig {
  type: AssetType.Model3D;
  path: string;
  format: ModelFormat;
  scale?: number | Vector3;
  rotation?: Vector3;
  hasAnimations?: boolean;
  animationNames?: string[];
  vertexCount?: number;
  triangleCount?: number;
  boundingBox?: {
    min: Vector3;
    max: Vector3;
  };
}

/**
 * Tiled map asset configuration
 * Used in ApplicationConfig.assets
 */
export interface TiledMapAssetConfig extends BaseAssetConfig {
  type: AssetType.TiledMap;
  path: string;
  pixelsPerUnit?: number;
  worldOffset?: { x: number; y: number; z: number };
  autoSpawnLayers?: boolean;
}

/**
 * Animation clip asset configuration
 * Used in ApplicationConfig.assets
 */
export interface AnimationAssetConfig extends BaseAssetConfig {
  type: AssetType.Animation;
  path: string;
}

/**
 * Audio asset configuration
 * Used in ApplicationConfig.assets
 */
export interface AudioAssetConfig extends BaseAssetConfig {
  type: AssetType.Audio;
  path: string;
}
/**
 * Discriminated union of all asset configs
 */
export type AssetConfig =
  | TextureAssetConfig
  | Model3DAssetConfig
  | TiledMapAssetConfig
  | AnimationAssetConfig
  | AudioAssetConfig;

/**
 * Assets configuration for ApplicationConfig
 * Maps GUID -> AssetConfig
 */
export type AssetsConfig = Record<GUID, AssetConfig>;

// ============================================================================
// AssetDatabase Class
// ============================================================================

/**
 * AssetDatabase - Central asset registry with static utilities
 */
export class AssetDatabase {
  private static instance: AssetDatabase | null = null;

  // Bidirectional lookup maps
  private assetsByGuid = new Map<GUID, AssetMetadata>();
  private assetsByPath = new Map<string, GUID>();

  private constructor() {}

  /**
   * Initialize the AssetDatabase singleton
   * Automatically initializes RuntimeAssetManager if needed
   *
   * @param assets - Optional assets to register from ApplicationConfig
   */
  static initialize(assets?: AssetsConfig): void {
    if (!AssetDatabase.instance) {
      AssetDatabase.instance = new AssetDatabase();
    }

    if (assets) {
      AssetDatabase.instance.registerAssets(assets);
    }

    // Auto-initialize RuntimeAssetManager
    if (!RuntimeAssetManager.has()) {
      RuntimeAssetManager.initialize();
    }
  }

  /**
   * Get the AssetDatabase singleton instance
   * @throws Error if not initialized
   */
  static get(): AssetDatabase {
    if (!AssetDatabase.instance) {
      throw new Error(
        'AssetDatabase not initialized. Call AssetDatabase.initialize() first or pass assets to ApplicationConfig.',
      );
    }
    return AssetDatabase.instance;
  }

  /**
   * Check if AssetDatabase is initialized
   */
  static has(): boolean {
    return AssetDatabase.instance !== null;
  }

  // ===== Static Utility Methods =====

  /**
   * Find GUID by asset path
   * Returns null if not found
   *
   * @param path - Asset path to search for
   * @returns GUID or null
   *
   * @example
   * ```typescript
   * const guid = AssetDatabase.findByPath("/textures/player.png");
   * if (guid) {
   *   const asset = RuntimeAssetManager.get().get(guid);
   * }
   * ```
   */
  static findByPath(path: string): GUID | null {
    return AssetDatabase.get().assetsByPath.get(path) ?? null;
  }

  /**
   * Get asset metadata by GUID
   *
   * @param guid - Asset GUID
   * @returns AssetMetadata or null
   */
  static getMetadata(guid: GUID): AssetMetadata | null {
    return AssetDatabase.get().assetsByGuid.get(guid) ?? null;
  }

  /**
   * Generate a new GUID (UUID v4)
   *
   * Note: While this generates UUID v4 format, GUIDs can be any string.
   * You can use human-readable strings like "player-texture" or "background-music".
   *
   * @returns A new UUID v4 string
   *
   * @example
   * ```typescript
   * // Auto-generated UUID v4
   * const PLAYER_TEXTURE = AssetDatabase.generateGuid();
   *
   * // Or use human-readable strings
   * const assets = {
   *   "player-texture": {
   *     type: AssetType.Texture,
   *     path: "/textures/player.png"
   *   }
   * };
   * ```
   */
  static generateGuid(): GUID {
    return crypto.randomUUID();
  }

  /**
   * Register a single asset
   *
   * @param guid - Asset GUID
   * @param metadata - Asset metadata
   */
  static registerAsset(guid: GUID, metadata: AssetMetadata): void {
    AssetDatabase.get().registerSingleAsset(guid, metadata);
  }

  /**
   * Get all registered asset GUIDs
   */
  static getAllGuids(): GUID[] {
    return Array.from(AssetDatabase.get().assetsByGuid.keys());
  }

  /**
   * Get all registered assets as a map
   */
  static getAllAssets(): Map<GUID, AssetMetadata> {
    return new Map(AssetDatabase.get().assetsByGuid);
  }

  /**
   * Clear all registered assets (for testing)
   */
  static clear(): void {
    if (AssetDatabase.instance) {
      AssetDatabase.instance.assetsByGuid.clear();
      AssetDatabase.instance.assetsByPath.clear();
    }
    AssetDatabase.instance = null;
  }

  // ===== Instance Methods =====

  private registerAssets(assets: AssetsConfig): void {
    for (const [guid, config] of Object.entries(assets)) {
      const metadata = this.configToMetadata(guid, config);
      this.registerSingleAsset(guid, metadata);
    }
  }

  private registerSingleAsset(guid: GUID, metadata: AssetMetadata): void {
    // Check for duplicate GUIDs
    if (this.assetsByGuid.has(guid)) {
      console.warn(
        `[AssetDatabase] Asset GUID already registered: ${guid}, overwriting with new metadata`,
      );
    }

    // Check for duplicate paths
    if (this.assetsByPath.has(metadata.path)) {
      const existingGuid = this.assetsByPath.get(metadata.path);
      console.warn(
        `[AssetDatabase] Asset path "${metadata.path}" already registered with GUID ${existingGuid}, overwriting`,
      );
    }

    // Register bidirectionally
    this.assetsByGuid.set(guid, metadata);
    this.assetsByPath.set(metadata.path, guid);

    // Register with RuntimeAssetManager
    RuntimeAssetManager.get().getOrCreate(guid, metadata);
  }

  private configToMetadata(guid: GUID, config: AssetConfig): AssetMetadata {
    const now = new Date().toISOString();

    // Build metadata based on discriminated type
    const base = {
      guid,
      path: config.path,
      importedAt: now,
      modifiedAt: now,
    };

    switch (config.type) {
      case AssetType.Texture:
        return {
          ...base,
          type: AssetType.Texture,
          filtering: config.magFilter ?? TextureFilter.Linear,
          wrapS: config.wrapS ?? TextureWrap.ClampToEdge,
          wrapT: config.wrapT ?? TextureWrap.ClampToEdge,
          sRGB: config.sRGB ?? true,
          generateMipmaps: config.generateMipmaps ?? true,
          width: config.width,
          height: config.height,
          sprites: config.sprites,
        } as TextureMetadata;

      case AssetType.Model3D: {
        // Normalize scale to Vector3 format
        let scale: number | undefined;
        if (config.scale !== undefined) {
          scale = typeof config.scale === 'number' ? config.scale : undefined;
        }

        return {
          ...base,
          type: AssetType.Model3D,
          format: config.format,
          scale: scale ?? 1,
          rotation: config.rotation ?? { x: 0, y: 0, z: 0 },
          hasAnimations: config.hasAnimations ?? false,
          animationNames: config.animationNames ?? [],
          vertexCount: config.vertexCount,
          triangleCount: config.triangleCount,
          boundingBox: config.boundingBox,
        } as Model3DMetadata;
      }

      case AssetType.TiledMap: {
        return {
          ...base,
          type: AssetType.TiledMap,
          pixelsPerUnit: config.pixelsPerUnit,
          worldOffset: config.worldOffset ?? { x: 0, y: 0, z: 0 },
          autoSpawnLayers: config.autoSpawnLayers ?? true,
        } satisfies TiledMapMetadata;
      }

      case AssetType.Animation: {
        return {
          ...base,
          type: AssetType.Animation,
        } satisfies AnimationMetadata;
      }

      case AssetType.Audio: {
        return {
          ...base,
          type: AssetType.Audio,
        } satisfies AudioAssetMetadata;
      }

      default:
        // TypeScript exhaustiveness check
        const _exhaustiveCheck: never = config;
        throw new Error(`Unsupported asset type: ${(config as any).type}`);
    }
  }
}
