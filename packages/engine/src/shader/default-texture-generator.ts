/**
 * DefaultTextureGenerator - Procedural noise texture generation
 *
 * Generates noise textures for shaders using hint_default_texture.
 * Supports simplex, perlin, white, and fbm noise types.
 */

import * as THREE from 'three';
import type {
  NoiseTextureParams,
  SimplexNoiseParams,
  PerlinNoiseParams,
  WhiteNoiseParams,
  FbmNoiseParams,
} from './vsl/ast.js';

/**
 * Cache key for generated textures
 */
function generateCacheKey(params: NoiseTextureParams): string {
  return JSON.stringify(params);
}

/**
 * Seeded random number generator (mulberry32)
 */
function createSeededRandom(seed: number): () => number {
  let state = seed === 0 ? Math.random() * 0xFFFFFFFF : seed;
  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return ((state ^ (state >>> 14)) >>> 0) / 0xFFFFFFFF;
  };
}

/**
 * 2D Simplex noise implementation
 */
class SimplexNoise2D {
  private perm: Uint8Array;
  private permMod12: Uint8Array;

  // Gradient vectors for 2D
  private static grad2 = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];

  // Skewing factors for 2D
  private static F2 = 0.5 * (Math.sqrt(3) - 1);
  private static G2 = (3 - Math.sqrt(3)) / 6;

  constructor(seed: number = 0) {
    const random = createSeededRandom(seed);

    // Create permutation table
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);

    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Shuffle using Fisher-Yates
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [p[i], p[j]] = [p[j]!, p[i]!];
    }

    // Duplicate for wrapping
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255]!;
      this.permMod12[i] = this.perm[i]! % 12;
    }
  }

  private dot2(g: number[], x: number, y: number): number {
    return g[0]! * x + g[1]! * y;
  }

  noise(x: number, y: number): number {
    const F2 = SimplexNoise2D.F2;
    const G2 = SimplexNoise2D.G2;
    const grad2 = SimplexNoise2D.grad2;

    // Skew input space
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);

    // Unskew back
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    // Determine simplex
    let i1: number, j1: number;
    if (x0 > y0) {
      i1 = 1; j1 = 0;
    } else {
      i1 = 0; j1 = 1;
    }

    // Offsets for other corners
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    // Hash coordinates
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii + this.perm[jj]!]! % 8;
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]!]! % 8;
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]!]! % 8;

    // Calculate contributions
    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * this.dot2(grad2[gi0]!, x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * this.dot2(grad2[gi1]!, x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * this.dot2(grad2[gi2]!, x2, y2);
    }

    // Scale to [-1, 1]
    return 70.0 * (n0 + n1 + n2);
  }
}

/**
 * 2D Perlin noise implementation
 */
class PerlinNoise2D {
  private perm: Uint8Array;

  constructor(seed: number = 0) {
    const random = createSeededRandom(seed);

    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);

    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [p[i], p[j]] = [p[j]!, p[i]!];
    }

    // Duplicate
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255]!;
    }
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);

    const u = this.fade(x);
    const v = this.fade(y);

    const A = this.perm[X]! + Y;
    const B = this.perm[X + 1]! + Y;

    return this.lerp(
      this.lerp(
        this.grad(this.perm[A]!, x, y),
        this.grad(this.perm[B]!, x - 1, y),
        u
      ),
      this.lerp(
        this.grad(this.perm[A + 1]!, x, y - 1),
        this.grad(this.perm[B + 1]!, x - 1, y - 1),
        u
      ),
      v
    );
  }
}

/**
 * DefaultTextureGenerator - Generates procedural noise textures
 *
 * Used by the shader system to auto-generate textures for uniforms
 * with hint_default_texture hints.
 */
export class DefaultTextureGenerator {
  /** Cache of generated textures */
  private static cache = new Map<string, THREE.DataTexture>();

  /**
   * Generate a noise texture based on the provided parameters
   */
  static generate(params: NoiseTextureParams): THREE.DataTexture {
    const cacheKey = generateCacheKey(params);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Generate based on type
    let texture: THREE.DataTexture;

    switch (params.type) {
      case 'simplex':
        texture = this.generateSimplex(params);
        break;
      case 'perlin':
        texture = this.generatePerlin(params);
        break;
      case 'white':
        texture = this.generateWhite(params);
        break;
      case 'fbm':
        texture = this.generateFbm(params);
        break;
      default:
        throw new Error(`Unknown noise type: ${(params as any).type}`);
    }

    // Configure texture for tiling
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;

    // Cache it
    this.cache.set(cacheKey, texture);

    return texture;
  }

  /**
   * Generate simplex noise texture
   */
  private static generateSimplex(params: SimplexNoiseParams): THREE.DataTexture {
    const { width, height, frequency, offsetX, offsetY, amplitude, seed } = params;
    const noise = new SimplexNoise2D(seed);

    const size = width * height;
    const data = new Uint8Array(size * 4); // RGBA

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = (x / width + offsetX) * frequency;
        const ny = (y / height + offsetY) * frequency;

        // Get noise value [-1, 1] and map to [0, 1]
        let value = noise.noise(nx, ny) * amplitude;
        value = (value + 1) * 0.5;
        value = Math.max(0, Math.min(1, value));

        const pixelValue = Math.floor(value * 255);
        const idx = (y * width + x) * 4;

        data[idx] = pixelValue;     // R
        data[idx + 1] = pixelValue; // G
        data[idx + 2] = pixelValue; // B
        data[idx + 3] = 255;        // A
      }
    }

    return new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  }

  /**
   * Generate Perlin noise texture with octaves
   */
  private static generatePerlin(params: PerlinNoiseParams): THREE.DataTexture {
    const { width, height, cellSize, levels, attenuation, seed, color, alpha } = params;
    const noise = new PerlinNoise2D(seed);

    const size = width * height;
    const data = new Uint8Array(size * 4);

    // Separate noise instances for color channels if needed
    const noiseR = color ? new PerlinNoise2D(seed) : noise;
    const noiseG = color ? new PerlinNoise2D(seed + 1000) : noise;
    const noiseB = color ? new PerlinNoise2D(seed + 2000) : noise;
    const noiseA = alpha ? new PerlinNoise2D(seed + 3000) : null;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        // Calculate octave noise
        const getValue = (n: PerlinNoise2D) => {
          let value = 0;
          let amp = 1;
          let freq = 1 / cellSize;
          let maxValue = 0;

          for (let level = 0; level < levels; level++) {
            value += n.noise(x * freq, y * freq) * amp;
            maxValue += amp;
            amp *= attenuation;
            freq *= 2;
          }

          // Normalize and map to [0, 1]
          value = (value / maxValue + 1) * 0.5;
          return Math.max(0, Math.min(1, value));
        };

        if (color) {
          data[idx] = Math.floor(getValue(noiseR) * 255);
          data[idx + 1] = Math.floor(getValue(noiseG) * 255);
          data[idx + 2] = Math.floor(getValue(noiseB) * 255);
        } else {
          const v = Math.floor(getValue(noise) * 255);
          data[idx] = v;
          data[idx + 1] = v;
          data[idx + 2] = v;
        }

        if (alpha && noiseA) {
          data[idx + 3] = Math.floor(getValue(noiseA) * 255);
        } else {
          data[idx + 3] = 255;
        }
      }
    }

    return new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  }

  /**
   * Generate white noise texture
   */
  private static generateWhite(params: WhiteNoiseParams): THREE.DataTexture {
    const { width, height, seed } = params;
    const random = createSeededRandom(seed);

    const size = width * height;
    const data = new Uint8Array(size * 4);

    for (let i = 0; i < size; i++) {
      const value = Math.floor(random() * 256);
      const idx = i * 4;

      data[idx] = value;     // R
      data[idx + 1] = value; // G
      data[idx + 2] = value; // B
      data[idx + 3] = 255;   // A
    }

    return new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  }

  /**
   * Generate FBM (Fractal Brownian Motion) noise texture
   */
  private static generateFbm(params: FbmNoiseParams): THREE.DataTexture {
    const { width, height, frequency, octaves, lacunarity, gain, seed } = params;
    const noise = new SimplexNoise2D(seed);

    const size = width * height;
    const data = new Uint8Array(size * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let value = 0;
        let amp = 1;
        let freq = frequency;
        let maxValue = 0;

        const nx = x / width;
        const ny = y / height;

        for (let o = 0; o < octaves; o++) {
          value += noise.noise(nx * freq, ny * freq) * amp;
          maxValue += amp;
          amp *= gain;
          freq *= lacunarity;
        }

        // Normalize and map to [0, 1]
        value = (value / maxValue + 1) * 0.5;
        value = Math.max(0, Math.min(1, value));

        const pixelValue = Math.floor(value * 255);
        const idx = (y * width + x) * 4;

        data[idx] = pixelValue;     // R
        data[idx + 1] = pixelValue; // G
        data[idx + 2] = pixelValue; // B
        data[idx + 3] = 255;        // A
      }
    }

    return new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  }

  /**
   * Clear the texture cache
   */
  static clearCache(): void {
    for (const texture of this.cache.values()) {
      texture.dispose();
    }
    this.cache.clear();
  }

  /**
   * Get cache size (for debugging)
   */
  static getCacheSize(): number {
    return this.cache.size;
  }
}
