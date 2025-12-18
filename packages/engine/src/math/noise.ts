/**
 * Simplex Noise Implementation
 *
 * A seeded 2D Simplex noise generator with Fractal Brownian Motion (FBM) support.
 * Based on Stefan Gustavson's implementation, adapted for TypeScript.
 *
 * Features:
 * - Seeded generation for reproducibility
 * - 2D noise with smooth gradients
 * - FBM for natural-looking terrain
 * - Normalized output variants
 *
 * @example
 * ```typescript
 * const noise = new SimplexNoise(12345);
 *
 * // Single noise value at a point
 * const value = noise.noise2D(x, y);  // Returns [-1, 1]
 *
 * // Fractal Brownian Motion for terrain
 * const terrain = noise.fbm(x * 0.01, y * 0.01, { octaves: 4 });
 *
 * // Normalized [0, 1] for easier use
 * const normalized = noise.noise2DNormalized(x, y);
 * ```
 */

import { SeededRandom } from './seeded-random.js';

/**
 * Options for Fractal Brownian Motion
 */
export interface FBMOptions {
  /** Number of noise layers to combine (default: 4) */
  octaves?: number;
  /** Frequency multiplier between octaves (default: 2.0) */
  lacunarity?: number;
  /** Amplitude multiplier between octaves (default: 0.5) */
  gain?: number;
}

// Gradient vectors for 2D simplex noise
const GRAD2: readonly [number, number][] = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

// Skewing factors for 2D
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

export class SimplexNoise {
  private perm: Uint8Array;
  private permMod8: Uint8Array;

  /**
   * Create a new Simplex noise generator
   * @param seed - Numeric seed or SeededRandom instance
   */
  constructor(seed: number | SeededRandom) {
    const rng = seed instanceof SeededRandom ? seed : new SeededRandom(seed);
    this.perm = new Uint8Array(512);
    this.permMod8 = new Uint8Array(512);
    this.generatePermutation(rng);
  }

  /**
   * Generate the permutation table using the seeded RNG
   */
  private generatePermutation(rng: SeededRandom): void {
    // Initialize with values 0-255
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Fisher-Yates shuffle with seeded RNG
    for (let i = 255; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      const temp = p[i]!;
      p[i] = p[j]!;
      p[j] = temp;
    }

    // Duplicate the permutation table for wraparound
    for (let i = 0; i < 256; i++) {
      const value = p[i]!;
      this.perm[i] = value;
      this.perm[i + 256] = value;
      this.permMod8[i] = value % 8;
      this.permMod8[i + 256] = value % 8;
    }
  }

  /**
   * Calculate dot product of gradient and distance vector
   */
  private grad2(hash: number, x: number, y: number): number {
    const g = GRAD2[hash]!;
    return g[0] * x + g[1] * y;
  }

  /**
   * Generate 2D Simplex noise at the given coordinates
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns Noise value in range [-1, 1]
   */
  noise2D(x: number, y: number): number {
    // Skew input space to determine which simplex cell we're in
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);

    // Unskew back to (x, y) space
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;

    // Distances from cell origin
    const x0 = x - X0;
    const y0 = y - Y0;

    // Determine which simplex we're in
    let i1: number, j1: number;
    if (x0 > y0) {
      // Lower triangle
      i1 = 1;
      j1 = 0;
    } else {
      // Upper triangle
      i1 = 0;
      j1 = 1;
    }

    // Offsets for middle and last corners
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    // Hash coordinates of the three corners
    const ii = i & 255;
    const jj = j & 255;

    // Calculate contributions from the three corners
    let n0 = 0,
      n1 = 0,
      n2 = 0;

    // Corner 0
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const gi0 = this.permMod8[ii + this.perm[jj]!]!;
      t0 *= t0;
      n0 = t0 * t0 * this.grad2(gi0, x0, y0);
    }

    // Corner 1
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const gi1 = this.permMod8[ii + i1 + this.perm[jj + j1]!]!;
      t1 *= t1;
      n1 = t1 * t1 * this.grad2(gi1, x1, y1);
    }

    // Corner 2
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const gi2 = this.permMod8[ii + 1 + this.perm[jj + 1]!]!;
      t2 *= t2;
      n2 = t2 * t2 * this.grad2(gi2, x2, y2);
    }

    // Scale to [-1, 1] range
    // The factor 70 is empirical to get roughly [-1, 1] output
    return 70 * (n0 + n1 + n2);
  }

  /**
   * Generate 2D Simplex noise normalized to [0, 1]
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns Noise value in range [0, 1]
   */
  noise2DNormalized(x: number, y: number): number {
    return (this.noise2D(x, y) + 1) * 0.5;
  }

  /**
   * Generate Fractal Brownian Motion (layered noise)
   *
   * FBM combines multiple octaves of noise at different frequencies
   * and amplitudes to create more natural-looking patterns.
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param options - FBM configuration
   * @returns Noise value in range approximately [-1, 1]
   */
  fbm(x: number, y: number, options?: FBMOptions): number {
    const octaves = options?.octaves ?? 4;
    const lacunarity = options?.lacunarity ?? 2.0;
    const gain = options?.gain ?? 0.5;

    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    // Normalize to [-1, 1]
    return value / maxValue;
  }

  /**
   * Generate Fractal Brownian Motion normalized to [0, 1]
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param options - FBM configuration
   * @returns Noise value in range [0, 1]
   */
  fbmNormalized(x: number, y: number, options?: FBMOptions): number {
    return (this.fbm(x, y, options) + 1) * 0.5;
  }

  /**
   * Generate ridged multifractal noise
   *
   * Creates sharp ridges, useful for mountain ranges
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param options - FBM configuration
   * @returns Noise value in range [0, 1]
   */
  ridged(x: number, y: number, options?: FBMOptions): number {
    const octaves = options?.octaves ?? 4;
    const lacunarity = options?.lacunarity ?? 2.0;
    const gain = options?.gain ?? 0.5;

    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let weight = 1;

    for (let i = 0; i < octaves; i++) {
      // Get absolute value and invert for ridges
      let signal = 1 - Math.abs(this.noise2D(x * frequency, y * frequency));
      signal *= signal; // Square for sharper ridges
      signal *= weight;

      // Weight successive octaves by previous signal
      weight = Math.min(Math.max(signal * 2, 0), 1);

      value += signal * amplitude;
      frequency *= lacunarity;
      amplitude *= gain;
    }

    return value;
  }

  /**
   * Generate turbulence noise
   *
   * Similar to FBM but uses absolute values for a more turbulent look
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param options - FBM configuration
   * @returns Noise value in range [0, 1]
   */
  turbulence(x: number, y: number, options?: FBMOptions): number {
    const octaves = options?.octaves ?? 4;
    const lacunarity = options?.lacunarity ?? 2.0;
    const gain = options?.gain ?? 0.5;

    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += Math.abs(this.noise2D(x * frequency, y * frequency)) * amplitude;
      maxValue += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    return value / maxValue;
  }

  /**
   * Generate domain-warped noise
   *
   * Uses noise to distort the input coordinates, creating
   * more organic, flowing patterns
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param warpStrength - How much to distort (default: 1.0)
   * @param options - FBM options for the warping and final noise
   * @returns Noise value in range approximately [-1, 1]
   */
  warp(x: number, y: number, warpStrength: number = 1.0, options?: FBMOptions): number {
    // First pass: get warp offsets
    const warpX = this.fbm(x, y, options) * warpStrength;
    const warpY = this.fbm(x + 5.2, y + 1.3, options) * warpStrength;

    // Second pass: sample noise at warped coordinates
    return this.fbm(x + warpX, y + warpY, options);
  }
}
