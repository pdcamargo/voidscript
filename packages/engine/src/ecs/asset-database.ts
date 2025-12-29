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
  TiledMapMetadata,
  AnimationMetadata,
  AudioAssetMetadata,
  PrefabMetadata,
  SpriteDefinition,
} from './asset-metadata.js';
import { AssetType, TextureFilter, TextureWrap, ModelFormat, isTextureMetadata } from './asset-metadata.js';
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
  /**
   * Named sprite definitions for sprite sheet atlases.
   * Supports both tile-based (tileIndex, tileWidth, tileHeight)
   * and rect-based (x, y, width, height) definitions.
   */
  sprites?: SpriteDefinition[];
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
 * Prefab asset configuration
 * Used in ApplicationConfig.assets
 */
export interface PrefabAssetConfig extends BaseAssetConfig {
  type: AssetType.Prefab;
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
  | AudioAssetConfig
  | PrefabAssetConfig;

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

  /**
   * Register additional assets (e.g., from manifest file)
   * Can be called after initialization to merge more assets
   *
   * @param assets - Assets to register (will merge with existing, overwriting on conflict)
   */
  static registerAdditionalAssets(assets: AssetsConfig): void {
    AssetDatabase.get().registerAssets(assets);
  }

  /**
   * Parse a JSON string into AssetsConfig format.
   * The JSON should be an object where keys are GUIDs and values are asset configurations.
   *
   * String values for enums are automatically converted:
   * - type: "texture" | "audio" | "model3d" | "tiledmap" | "animation"
   * - magFilter/minFilter: "nearest" | "linear"
   * - wrapS/wrapT: "repeat" | "clamp" | "mirror"
   * - format (Model3D): "gltf" | "glb" | "fbx"
   *
   * @param jsonString - JSON string containing asset configurations
   * @returns Parsed AssetsConfig object
   * @throws Error if JSON is invalid or contains unknown asset types
   *
   * @example
   * ```typescript
   * const json = `{
   *   "player-texture": {
   *     "type": "texture",
   *     "path": "/textures/player.png",
   *     "magFilter": "nearest"
   *   }
   * }`;
   * const assets = AssetDatabase.parseAssetsJson(json);
   * AssetDatabase.registerAdditionalAssets(assets);
   * ```
   */
  static parseAssetsJson(jsonString: string): AssetsConfig {
    const parsed = JSON.parse(jsonString) as Record<string, unknown>;
    const result: AssetsConfig = {};

    for (const [guid, rawConfig] of Object.entries(parsed)) {
      // Skip special JSON schema key (used for IDE validation)
      if (guid === '$schema') {
        continue;
      }

      if (!rawConfig || typeof rawConfig !== 'object') {
        console.warn(`[AssetDatabase] Invalid asset config for GUID ${guid}, skipping`);
        continue;
      }

      const config = rawConfig as Record<string, unknown>;
      const type = config['type'] as string;

      if (!type) {
        console.warn(`[AssetDatabase] Missing type for asset ${guid}, skipping`);
        continue;
      }

      // Validate and convert type string to AssetType enum
      if (!Object.values(AssetType).includes(type as AssetType)) {
        console.warn(`[AssetDatabase] Unknown asset type "${type}" for ${guid}, skipping`);
        continue;
      }

      // Build the typed config based on asset type
      switch (type as AssetType) {
        case AssetType.Texture: {
          const textureConfig: TextureAssetConfig = {
            type: AssetType.Texture,
            path: config['path'] as string,
            magFilter: config['magFilter'] as TextureFilter | undefined,
            minFilter: config['minFilter'] as TextureFilter | undefined,
            wrapS: config['wrapS'] as TextureWrap | undefined,
            wrapT: config['wrapT'] as TextureWrap | undefined,
            sRGB: config['sRGB'] as boolean | undefined,
            generateMipmaps: config['generateMipmaps'] as boolean | undefined,
            width: config['width'] as number | undefined,
            height: config['height'] as number | undefined,
            sprites: config['sprites'] as SpriteDefinition[] | undefined,
          };
          result[guid] = textureConfig;
          break;
        }

        case AssetType.Audio: {
          const audioConfig: AudioAssetConfig = {
            type: AssetType.Audio,
            path: config['path'] as string,
          };
          result[guid] = audioConfig;
          break;
        }

        case AssetType.Model3D: {
          const model3DConfig: Model3DAssetConfig = {
            type: AssetType.Model3D,
            path: config['path'] as string,
            format: config['format'] as ModelFormat,
            scale: config['scale'] as number | Vector3 | undefined,
            rotation: config['rotation'] as Vector3 | undefined,
            hasAnimations: config['hasAnimations'] as boolean | undefined,
            animationNames: config['animationNames'] as string[] | undefined,
            vertexCount: config['vertexCount'] as number | undefined,
            triangleCount: config['triangleCount'] as number | undefined,
            boundingBox: config['boundingBox'] as
              | { min: Vector3; max: Vector3 }
              | undefined,
          };
          result[guid] = model3DConfig;
          break;
        }

        case AssetType.TiledMap: {
          const tiledMapConfig: TiledMapAssetConfig = {
            type: AssetType.TiledMap,
            path: config['path'] as string,
            pixelsPerUnit: config['pixelsPerUnit'] as number | undefined,
            worldOffset: config['worldOffset'] as
              | { x: number; y: number; z: number }
              | undefined,
            autoSpawnLayers: config['autoSpawnLayers'] as boolean | undefined,
          };
          result[guid] = tiledMapConfig;
          break;
        }

        case AssetType.Animation: {
          const animationConfig: AnimationAssetConfig = {
            type: AssetType.Animation,
            path: config['path'] as string,
          };
          result[guid] = animationConfig;
          break;
        }

        case AssetType.Prefab: {
          const prefabConfig: PrefabAssetConfig = {
            type: AssetType.Prefab,
            path: config['path'] as string,
          };
          result[guid] = prefabConfig;
          break;
        }

        default:
          console.warn(`[AssetDatabase] Unsupported asset type "${type}" for ${guid}, skipping`);
      }
    }

    return result;
  }

  /**
   * Find a sprite by ID across all registered textures.
   * Returns the sprite definition along with the texture GUID it belongs to.
   *
   * @param spriteId - The sprite ID to search for
   * @returns Object with textureGuid and sprite, or null if not found
   *
   * @example
   * ```typescript
   * const result = AssetDatabase.findSpriteById('walk-frame-1');
   * if (result) {
   *   console.log(`Found sprite in texture: ${result.textureGuid}`);
   *   console.log(`Sprite name: ${result.sprite.name}`);
   * }
   * ```
   */
  static findSpriteById(spriteId: string): { textureGuid: GUID; sprite: SpriteDefinition } | null {
    const db = AssetDatabase.get();
    for (const [guid, metadata] of db.assetsByGuid) {
      if (isTextureMetadata(metadata) && metadata.sprites) {
        const sprite = metadata.sprites.find((s) => s.id === spriteId);
        if (sprite) {
          return { textureGuid: guid, sprite };
        }
      }
    }
    return null;
  }

  /**
   * Get all sprites from a specific texture
   *
   * @param textureGuid - The texture GUID
   * @returns Array of sprite definitions, or empty array if texture not found or has no sprites
   */
  static getSpritesForTexture(textureGuid: GUID): SpriteDefinition[] {
    const metadata = AssetDatabase.getMetadata(textureGuid);
    if (metadata && isTextureMetadata(metadata) && metadata.sprites) {
      return metadata.sprites;
    }
    return [];
  }

  /**
   * Get all sprites from all registered textures
   *
   * @returns Array of all sprite definitions across all textures
   */
  static getAllSprites(): SpriteDefinition[] {
    const db = AssetDatabase.get();
    const allSprites: SpriteDefinition[] = [];
    for (const [, metadata] of db.assetsByGuid) {
      if (isTextureMetadata(metadata) && metadata.sprites) {
        allSprites.push(...metadata.sprites);
      }
    }
    return allSprites;
  }

  /**
   * Serialize all registered assets to JSON format.
   * This is the inverse operation of parseAssetsJson().
   *
   * Note: The $schema property is preserved if assets were loaded from a manifest.
   *
   * @param pretty - If true, format with indentation (default: true)
   * @returns JSON string representing all assets
   *
   * @example
   * ```typescript
   * const json = AssetDatabase.serializeToJson();
   * await fs.writeFile('assets/manifest.json', json);
   * ```
   */
  static serializeToJson(pretty: boolean = true): string {
    const db = AssetDatabase.get();
    const result: Record<string, unknown> = {};

    // Add $schema reference if available
    result['$schema'] = '../../../packages/engine/schemas/asset-manifest.schema.json';

    for (const [guid, metadata] of db.assetsByGuid) {
      result[guid] = AssetDatabase.metadataToConfig(metadata);
    }

    return pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result);
  }

  /**
   * Convert metadata back to config format for JSON serialization.
   * Removes internal fields like guid, importedAt, modifiedAt.
   */
  private static metadataToConfig(metadata: AssetMetadata): Record<string, unknown> {
    switch (metadata.type) {
      case AssetType.Texture: {
        const textureMetadata = metadata as TextureMetadata;
        const config: Record<string, unknown> = {
          type: 'texture',
          path: metadata.path,
        };

        // Only include non-default values
        if (textureMetadata.filtering && textureMetadata.filtering !== TextureFilter.Linear) {
          config['magFilter'] = textureMetadata.filtering;
          config['minFilter'] = textureMetadata.filtering;
        } else {
          // Include filter settings if explicitly set
          config['magFilter'] = textureMetadata.filtering;
          config['minFilter'] = textureMetadata.filtering;
        }

        if (textureMetadata.wrapS) config['wrapS'] = textureMetadata.wrapS;
        if (textureMetadata.wrapT) config['wrapT'] = textureMetadata.wrapT;
        if (textureMetadata.width) config['width'] = textureMetadata.width;
        if (textureMetadata.height) config['height'] = textureMetadata.height;

        // Serialize sprites, removing the auto-populated textureGuid
        if (textureMetadata.sprites && textureMetadata.sprites.length > 0) {
          config['sprites'] = textureMetadata.sprites.map((sprite) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { textureGuid, ...rest } = sprite;
            return rest;
          });
        }

        return config;
      }

      case AssetType.Audio: {
        return {
          type: 'audio',
          path: metadata.path,
        };
      }

      case AssetType.Model3D: {
        const model3DMetadata = metadata as Model3DMetadata;
        const config: Record<string, unknown> = {
          type: 'model3d',
          path: metadata.path,
          format: model3DMetadata.format,
        };

        if (model3DMetadata.scale !== 1) config['scale'] = model3DMetadata.scale;
        if (model3DMetadata.rotation) config['rotation'] = model3DMetadata.rotation;
        if (model3DMetadata.hasAnimations) config['hasAnimations'] = model3DMetadata.hasAnimations;
        if (model3DMetadata.animationNames && model3DMetadata.animationNames.length > 0) {
          config['animationNames'] = model3DMetadata.animationNames;
        }
        if (model3DMetadata.vertexCount) config['vertexCount'] = model3DMetadata.vertexCount;
        if (model3DMetadata.triangleCount) config['triangleCount'] = model3DMetadata.triangleCount;
        if (model3DMetadata.boundingBox) config['boundingBox'] = model3DMetadata.boundingBox;

        return config;
      }

      case AssetType.TiledMap: {
        const tiledMapMetadata = metadata as TiledMapMetadata;
        const config: Record<string, unknown> = {
          type: 'tiledmap',
          path: metadata.path,
        };

        if (tiledMapMetadata.pixelsPerUnit) config['pixelsPerUnit'] = tiledMapMetadata.pixelsPerUnit;
        if (tiledMapMetadata.worldOffset) config['worldOffset'] = tiledMapMetadata.worldOffset;
        if (tiledMapMetadata.autoSpawnLayers !== undefined) {
          config['autoSpawnLayers'] = tiledMapMetadata.autoSpawnLayers;
        }

        return config;
      }

      case AssetType.Animation: {
        return {
          type: 'animation',
          path: metadata.path,
        };
      }

      case AssetType.Prefab: {
        return {
          type: 'prefab',
          path: metadata.path,
        };
      }

      default:
        // Fallback for unknown types
        return {
          type: metadata.type,
          path: metadata.path,
        };
    }
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
      case AssetType.Texture: {
        // Inject textureGuid into each sprite definition
        const sprites = config.sprites?.map((sprite) => ({
          ...sprite,
          textureGuid: guid,
        }));

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
          sprites,
        } as TextureMetadata;
      }

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

      case AssetType.Prefab: {
        return {
          ...base,
          type: AssetType.Prefab,
          entityCount: 0,
          componentTypes: [],
          nestedPrefabs: [],
        } satisfies PrefabMetadata;
      }

      default:
        // TypeScript exhaustiveness check
        const _exhaustiveCheck: never = config;
        throw new Error(`Unsupported asset type: ${(config as any).type}`);
    }
  }
}
