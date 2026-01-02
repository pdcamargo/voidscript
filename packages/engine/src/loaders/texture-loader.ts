/**
 * Texture Loader
 *
 * Built-in texture loading utility that wraps Three.js TextureLoader
 * with support for asset metadata filtering/wrapping settings.
 *
 * Features:
 * - Automatic filtering/wrapping from metadata
 * - Promise-based async loading
 * - In-flight request deduplication
 * - Optional caching
 */

import * as THREE from 'three';
import {
  TextureMetadata,
  TextureFilter,
  TextureWrap,
  isTextureMetadata,
  AssetMetadata,
} from '../ecs/asset/asset-metadata.js';

/**
 * Texture loading options
 */
export interface TextureLoadOptions {
  /** Texture filtering mode (overrides metadata) */
  filtering?: 'nearest' | 'linear';

  /** Horizontal wrap mode (overrides metadata) */
  wrapS?: 'repeat' | 'clamp' | 'mirror';

  /** Vertical wrap mode (overrides metadata) */
  wrapT?: 'repeat' | 'clamp' | 'mirror';

  /** Use sRGB color space (overrides metadata, default: true) */
  sRGB?: boolean;

  /** Generate mipmaps (overrides metadata, default: true) */
  generateMipmaps?: boolean;

  /** Flip texture vertically (default: false) */
  flipY?: boolean;
}

/**
 * Convert our TextureFilter enum to Three.js constants
 * Note: TextureFilter enum values are 'nearest' and 'linear', so we compare as strings
 */
function getThreeFilter(filter: TextureFilter | 'nearest' | 'linear', isMagnification: boolean): THREE.TextureFilter {
  // Cast to string to avoid TypeScript narrowing issues with enum + string literal union
  const filterStr = filter as string;
  if (filterStr === 'nearest') {
    return isMagnification ? THREE.NearestFilter : THREE.NearestMipmapNearestFilter;
  }
  return isMagnification ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
}

/**
 * Convert our TextureWrap enum to Three.js constants
 */
function getThreeWrap(wrap: TextureWrap | 'repeat' | 'clamp' | 'mirror'): THREE.Wrapping {
  switch (wrap) {
    case TextureWrap.Repeat:
    case 'repeat':
      return THREE.RepeatWrapping;
    case TextureWrap.MirroredRepeat:
    case 'mirror':
      return THREE.MirroredRepeatWrapping;
    case TextureWrap.ClampToEdge:
    case 'clamp':
    default:
      return THREE.ClampToEdgeWrapping;
  }
}

/**
 * Apply texture settings from metadata and options
 */
function applyTextureSettings(
  texture: THREE.Texture,
  metadata?: TextureMetadata | null,
  options?: TextureLoadOptions,
): void {
  // Filtering - cast to string to avoid TypeScript narrowing issues with enum + string literal union
  const filtering = (options?.filtering ?? metadata?.filtering ?? TextureFilter.Linear) as string;
  const generateMipmaps = options?.generateMipmaps ?? metadata?.generateMipmaps ?? true;

  texture.generateMipmaps = generateMipmaps;

  if (filtering === 'nearest') {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = generateMipmaps ? THREE.NearestMipmapNearestFilter : THREE.NearestFilter;
  } else {
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = generateMipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  }

  // Wrapping
  const wrapS = options?.wrapS ?? metadata?.wrapS ?? TextureWrap.ClampToEdge;
  const wrapT = options?.wrapT ?? metadata?.wrapT ?? TextureWrap.ClampToEdge;
  texture.wrapS = getThreeWrap(wrapS);
  texture.wrapT = getThreeWrap(wrapT);

  // Color space
  const sRGB = options?.sRGB ?? metadata?.sRGB ?? true;
  texture.colorSpace = sRGB ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;

  // Flip Y
  if (options?.flipY !== undefined) {
    texture.flipY = options.flipY;
  }

  texture.needsUpdate = true;
}

/**
 * In-flight request cache to prevent duplicate loads
 */
const inFlightRequests = new Map<string, Promise<THREE.Texture>>();

/**
 * Texture cache for reuse
 */
const textureCache = new Map<string, THREE.Texture>();

/**
 * Texture Loader class
 *
 * Provides async texture loading with metadata support
 */
export class TextureLoader {
  private threeLoader: THREE.TextureLoader;
  private useCache: boolean;

  /**
   * Create a new TextureLoader
   * @param useCache - Whether to cache loaded textures (default: true)
   */
  constructor(useCache: boolean = true) {
    this.threeLoader = new THREE.TextureLoader();
    this.useCache = useCache;
  }

  /**
   * Load a texture from a URL
   *
   * @param url - URL or path to the texture
   * @param options - Loading options (overrides metadata)
   * @returns Promise resolving to the loaded Three.js Texture
   */
  async load(url: string, options?: TextureLoadOptions): Promise<THREE.Texture> {
    // Check cache
    if (this.useCache && textureCache.has(url)) {
      const cached = textureCache.get(url)!;
      // Clone and apply options if different from cached
      if (options) {
        const clone = cached.clone();
        applyTextureSettings(clone, null, options);
        return clone;
      }
      return cached;
    }

    // Check for in-flight request
    if (inFlightRequests.has(url)) {
      const texture = await inFlightRequests.get(url)!;
      if (options) {
        const clone = texture.clone();
        applyTextureSettings(clone, null, options);
        return clone;
      }
      return texture;
    }

    // Create new load request
    const loadPromise = new Promise<THREE.Texture>((resolve, reject) => {
      this.threeLoader.load(
        url,
        (texture) => {
          applyTextureSettings(texture, null, options);
          if (this.useCache) {
            textureCache.set(url, texture);
          }
          inFlightRequests.delete(url);
          resolve(texture);
        },
        undefined,
        (error) => {
          inFlightRequests.delete(url);
          reject(new Error(`Failed to load texture from ${url}: ${String(error)}`));
        },
      );
    });

    inFlightRequests.set(url, loadPromise);
    return loadPromise;
  }

  /**
   * Load a texture using asset metadata
   *
   * @param metadata - Asset metadata (must be TextureMetadata)
   * @param options - Additional options (override metadata)
   * @returns Promise resolving to the loaded Three.js Texture
   */
  async loadFromMetadata(
    metadata: AssetMetadata,
    options?: TextureLoadOptions,
  ): Promise<THREE.Texture> {
    if (!isTextureMetadata(metadata)) {
      throw new Error(`Expected TextureMetadata, got ${metadata.type}`);
    }

    // Check cache using GUID
    const cacheKey = metadata.guid;
    if (this.useCache && textureCache.has(cacheKey)) {
      const cached = textureCache.get(cacheKey)!;
      if (options) {
        const clone = cached.clone();
        applyTextureSettings(clone, metadata, options);
        return clone;
      }
      return cached;
    }

    // Load texture
    const texture = await this.load(metadata.path, undefined);

    // Apply metadata settings
    applyTextureSettings(texture, metadata, options);

    // Cache by GUID
    if (this.useCache) {
      textureCache.set(cacheKey, texture);
    }

    return texture;
  }

  /**
   * Load a texture from a data URL or base64 string
   */
  async loadFromDataUrl(dataUrl: string, options?: TextureLoadOptions): Promise<THREE.Texture> {
    return this.load(dataUrl, options);
  }

  /**
   * Create a texture from an existing image element
   */
  createFromImage(image: HTMLImageElement, options?: TextureLoadOptions): THREE.Texture {
    const texture = new THREE.Texture(image);
    applyTextureSettings(texture, null, options);
    return texture;
  }

  /**
   * Create a texture from an existing canvas element
   */
  createFromCanvas(canvas: HTMLCanvasElement, options?: TextureLoadOptions): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(canvas);
    applyTextureSettings(texture, null, options);
    return texture;
  }

  /**
   * Clear the texture cache
   * @param dispose - Whether to dispose textures (free GPU memory)
   */
  clearCache(dispose: boolean = true): void {
    if (dispose) {
      for (const texture of textureCache.values()) {
        texture.dispose();
      }
    }
    textureCache.clear();
  }

  /**
   * Remove a specific texture from cache
   * @param key - URL or GUID of the texture
   * @param dispose - Whether to dispose the texture
   */
  removeFromCache(key: string, dispose: boolean = true): boolean {
    const texture = textureCache.get(key);
    if (texture) {
      if (dispose) {
        texture.dispose();
      }
      textureCache.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Check if a texture is cached
   */
  isCached(key: string): boolean {
    return textureCache.has(key);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { count: number; keys: string[] } {
    return {
      count: textureCache.size,
      keys: Array.from(textureCache.keys()),
    };
  }
}

/**
 * Default shared texture loader instance
 */
let defaultLoader: TextureLoader | null = null;

/**
 * Get the default shared TextureLoader instance
 */
export function getTextureLoader(): TextureLoader {
  if (!defaultLoader) {
    defaultLoader = new TextureLoader(true);
  }
  return defaultLoader;
}

/**
 * Quick texture loading helper
 *
 * Usage:
 * ```typescript
 * const texture = await loadTexture('/textures/player.png', { filtering: 'nearest' });
 * ```
 */
export async function loadTexture(
  url: string,
  options?: TextureLoadOptions,
): Promise<THREE.Texture> {
  return getTextureLoader().load(url, options);
}

/**
 * Clear the texture cache
 * @param dispose - Whether to dispose textures (free GPU memory)
 */
export function clearTextureCache(dispose: boolean = true): void {
  getTextureLoader().clearCache(dispose);
}
