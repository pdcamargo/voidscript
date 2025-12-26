/**
 * TiledAssetRegistry
 *
 * Resource for caching and loading Tiled assets:
 * - Maps
 * - External tilesets
 * - Textures
 * - Animation clips
 *
 * Provides async loading methods with automatic caching to avoid duplicate loads.
 *
 * Usage:
 * ```typescript
 * // In Application setup:
 * app.insertResource(new TiledAssetRegistry());
 *
 * // In a system:
 * const registry = commands.getResource(TiledAssetRegistry);
 * const map = await registry.loadMap('/assets/maps/level1.json');
 * ```
 */

import type * as tiled from '@kayahr/tiled';
import * as THREE from 'three';
import { AnimationClip, LoopMode } from '../animation/animation-clip.js';
import { PropertyTrack } from '../animation/property-track.js';
import { InterpolationMode } from '../animation/interpolation.js';
import { loadTexture, type TextureLoadOptions } from '../loaders/texture-loader.js';
import { resolvePath } from './tiled-utils.js';
import { AssetDatabase } from '../ecs/asset-database.js';
import { RuntimeAssetManager } from '../ecs/runtime-asset-manager.js';
import { RuntimeAsset } from '../ecs/runtime-asset.js';
import { AssetType, TextureFilter, TextureWrap, type TextureMetadata } from '../ecs/asset-metadata.js';

/**
 * Tiled Asset Registry Resource
 *
 * Manages loading and caching of Tiled assets
 */
export class TiledAssetRegistry {
  /** Cached loaded maps by path */
  private mapCache: Map<string, tiled.Map> = new Map();

  /** Cached tilesets by path */
  private tilesetCache: Map<string, tiled.Tileset> = new Map();

  /** Texture cache by image path */
  private textureCache: Map<string, RuntimeAsset<THREE.Texture>> = new Map();

  /** Animation clips cache (key: mapPath + ':' + tilesetFirstGid + ':' + localTileId) */
  private animationCache: Map<string, AnimationClip> = new Map();

  /**
   * Load a Tiled map JSON file
   *
   * @param path - Path to the map file
   * @returns Loaded map data
   */
  async loadMap(path: string): Promise<tiled.Map> {
    // Check cache
    if (this.mapCache.has(path)) {
      return this.mapCache.get(path)!;
    }

    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();

      // Validate map structure
      if (!json.type || json.type !== 'map') {
        throw new Error('Invalid Tiled map format: missing or incorrect type field');
      }

      if (!json.layers || !Array.isArray(json.layers)) {
        throw new Error('Invalid Tiled map format: missing or invalid layers array');
      }

      const map = json as tiled.Map;

      // Cache and return
      this.mapCache.set(path, map);
      return map;
    } catch (error) {
      console.error(`[TiledAssetRegistry] Failed to load map: ${path}`, error);
      throw new Error(`Failed to load Tiled map "${path}": ${error}`);
    }
  }

  /**
   * Load an external tileset
   *
   * @param path - Path to the tileset file
   * @returns Loaded tileset data
   */
  async loadTileset(path: string): Promise<tiled.Tileset> {
    // Check cache
    if (this.tilesetCache.has(path)) {
      return this.tilesetCache.get(path)!;
    }

    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();

      // Validate tileset structure
      if (!json.type || json.type !== 'tileset') {
        throw new Error('Invalid Tiled tileset format: missing or incorrect type field');
      }

      const tileset = json as tiled.Tileset;

      // Cache and return
      this.tilesetCache.set(path, tileset);
      return tileset;
    } catch (error) {
      console.error(`[TiledAssetRegistry] Failed to load external tileset: ${path}`, error);

      // Return minimal valid tileset to prevent crash
      return {
        type: 'tileset',
        name: 'ErrorTileset',
        tilewidth: 16,
        tileheight: 16,
        tilecount: 1,
        columns: 1,
        image: 'placeholder.png',
        imagewidth: 16,
        imageheight: 16,
        margin: 0,
        spacing: 0,
        tiles: [],
      } as tiled.Tileset;
    }
  }

  /**
   * Load a texture for a tileset
   *
   * @param imagePath - Path to the image file
   * @param options - Texture load options (currently unused, filtering determined by AssetDatabase metadata)
   * @returns RuntimeAsset for the loaded texture
   */
  async loadTilesetTexture(
    imagePath: string,
    options?: TextureLoadOptions
  ): Promise<RuntimeAsset<THREE.Texture>> {
    // Check cache
    if (this.textureCache.has(imagePath)) {
      return this.textureCache.get(imagePath)!;
    }

    try {
      let textureAsset: RuntimeAsset<THREE.Texture>;

      // Try to find asset in AssetDatabase
      const guid = AssetDatabase.findByPath(imagePath);

      if (guid) {
        // Found in asset database - use registered metadata
        const metadata = AssetDatabase.getMetadata(guid)!;
        textureAsset = RuntimeAssetManager.get().getOrCreate(guid, metadata);
      } else {
        // Not in asset database - create ad-hoc RuntimeAsset with tilemap-friendly defaults
        const adHocGuid = AssetDatabase.generateGuid();
        const adHocMetadata: TextureMetadata = {
          guid: adHocGuid,
          path: imagePath,
          type: AssetType.Texture,
          filtering: TextureFilter.Nearest, // Pixel-perfect rendering for tilemaps
          wrapS: TextureWrap.ClampToEdge,
          wrapT: TextureWrap.ClampToEdge,
          sRGB: true,
          generateMipmaps: false,
          importedAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
        };
        textureAsset = RuntimeAssetManager.get().getOrCreate(adHocGuid, adHocMetadata);
      }

      // Load texture using new parameterless API
      await textureAsset.load();

      // Cache and return
      this.textureCache.set(imagePath, textureAsset);
      return textureAsset;
    } catch (error) {
      console.error(`[TiledAssetRegistry] Failed to load texture: ${imagePath}`, error);

      // Return placeholder RuntimeAsset (1x1 magenta)
      const placeholderAsset = this.createPlaceholderRuntimeAsset(imagePath);
      this.textureCache.set(imagePath, placeholderAsset);
      return placeholderAsset;
    }
  }

  /**
   * Create a placeholder RuntimeAsset for missing images
   *
   * @param imagePath - Original image path (for metadata)
   * @returns RuntimeAsset with pre-loaded 1x1 magenta texture
   */
  private createPlaceholderRuntimeAsset(imagePath: string): RuntimeAsset<THREE.Texture> {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FF00FF'; // Magenta
    ctx.fillRect(0, 0, 1, 1);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Create ad-hoc RuntimeAsset for placeholder
    const placeholderGuid = AssetDatabase.generateGuid();
    const placeholderMetadata: TextureMetadata = {
      guid: placeholderGuid,
      path: imagePath, // Keep original path for debugging
      type: AssetType.Texture,
      filtering: TextureFilter.Nearest,
      wrapS: TextureWrap.ClampToEdge,
      wrapT: TextureWrap.ClampToEdge,
      sRGB: true,
      generateMipmaps: false,
      importedAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };

    const placeholderAsset = RuntimeAssetManager.get().getOrCreate(
      placeholderGuid,
      placeholderMetadata
    );

    // Manually set the data (pre-load the placeholder)
    // We access the private _data field through a workaround
    // Since this is a placeholder, we can directly set it
    (placeholderAsset as any)._data = texture;
    (placeholderAsset as any)._isLoaded = true;

    return placeholderAsset;
  }

  /**
   * Generate animation clips from a tileset
   *
   * @param tileset - Tileset data
   * @param firstGid - First GID for this tileset
   * @param mapPath - Path to the map (for cache key)
   * @returns Map of local tile ID to animation clip
   */
  generateAnimationClips(
    tileset: tiled.Tileset,
    firstGid: number,
    mapPath: string
  ): Map<number, AnimationClip> {
    const clips = new Map<number, AnimationClip>();

    if (!tileset.tiles) {
      return clips;
    }

    for (const tile of tileset.tiles) {
      if (!tile.animation || tile.animation.length === 0) {
        continue;
      }

      const localTileId = tile.id;
      const cacheKey = `${mapPath}:${firstGid}:${localTileId}`;

      // Check cache
      if (this.animationCache.has(cacheKey)) {
        clips.set(localTileId, this.animationCache.get(cacheKey)!);
        continue;
      }

      // Generate clip
      const clip = this.convertTiledAnimationToClip(tile.animation, localTileId);
      this.animationCache.set(cacheKey, clip);
      clips.set(localTileId, clip);
    }

    return clips;
  }

  /**
   * Convert Tiled tile animation to an AnimationClip
   *
   * @param animation - Tiled animation frames
   * @param tileId - Local tile ID
   * @returns Animation clip
   */
  private convertTiledAnimationToClip(
    animation: tiled.Frame[],
    tileId: number
  ): AnimationClip {
    const clipId = `tile_${tileId}_anim`;

    // Calculate total duration in seconds
    const totalDuration =
      animation.reduce((sum, frame) => sum + frame.duration, 0) / 1000;

    // Create PropertyTrack with discrete interpolation for frame changes
    const track = new PropertyTrack<number>('Sprite2D.tileIndex', InterpolationMode.Discrete);
    let time = 0;

    for (const frame of animation) {
      const normalizedTime = time / totalDuration;
      track.keyframe(normalizedTime, frame.tileid);
      time += frame.duration / 1000;
    }

    // Add final keyframe at t=1.0 to loop back to first frame
    const firstFrame = animation[0];
    if (firstFrame) {
      track.keyframe(1.0, firstFrame.tileid);
    }

    return AnimationClip.create(clipId)
      .addTrack(track)
      .setDuration(totalDuration)
      .setLoopMode(LoopMode.Loop);
  }

  /**
   * Load external tileset and resolve path
   *
   * @param tilesetRef - External tileset reference
   * @param mapBasePath - Base path of the map file
   * @returns Loaded tileset
   */
  async loadExternalTileset(
    tilesetRef: { source: string },
    mapBasePath: string
  ): Promise<tiled.Tileset> {
    const tilesetPath = resolvePath(mapBasePath, tilesetRef.source);
    return this.loadTileset(tilesetPath);
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.mapCache.clear();
    this.tilesetCache.clear();

    // Dispose RuntimeAsset textures
    for (const textureAsset of this.textureCache.values()) {
      if (textureAsset.data) {
        textureAsset.data.dispose();
      }
      textureAsset.unload();
    }
    this.textureCache.clear();

    this.animationCache.clear();
  }

  /**
   * Get cache statistics
   *
   * @returns Cache stats
   */
  getStats(): {
    maps: number;
    tilesets: number;
    textures: number;
    animations: number;
  } {
    return {
      maps: this.mapCache.size,
      tilesets: this.tilesetCache.size,
      textures: this.textureCache.size,
      animations: this.animationCache.size,
    };
  }
}
