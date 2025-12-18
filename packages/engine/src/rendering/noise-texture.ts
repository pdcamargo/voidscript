/**
 * Noise Texture Generator
 *
 * Generates procedural noise textures using SimplexNoise.
 * Used for water effects, terrain, and other procedural patterns.
 */

import * as THREE from 'three';
import { SimplexNoise } from '../math/noise.js';

/**
 * Options for generating a noise texture
 */
export interface NoiseTextureOptions {
  /** Texture width in pixels (default: 512) */
  width?: number;
  /** Texture height in pixels (default: 512) */
  height?: number;
  /** Random seed for reproducibility (default: 0) */
  seed?: number;
  /** Coordinate scale - higher values = smaller features (default: 1) */
  scale?: number;
  /** Number of FBM octaves (default: 3) */
  octaves?: number;
  /** Amplitude falloff between octaves (default: 0.5) */
  persistence?: number;
  /** Frequency multiplier between octaves (default: 2) */
  lacunarity?: number;
  /** Wrap mode for the texture (default: 'repeat') */
  wrapMode?: 'repeat' | 'clamp' | 'mirror';
}

/**
 * Generate a simplex noise texture
 *
 * @param options - Configuration options
 * @returns Three.js DataTexture with noise values
 *
 * @example
 * ```typescript
 * const noise = createNoiseTexture({
 *   width: 512,
 *   height: 512,
 *   seed: 12345,
 *   octaves: 4,
 *   scale: 0.01,
 * });
 * material.map = noise;
 * ```
 */
export function createNoiseTexture(options?: NoiseTextureOptions): THREE.DataTexture {
  const width = options?.width ?? 512;
  const height = options?.height ?? 512;
  const seed = options?.seed ?? 0;
  const scale = options?.scale ?? 1;
  const octaves = options?.octaves ?? 3;
  const persistence = options?.persistence ?? 0.5;
  const lacunarity = options?.lacunarity ?? 2;
  const wrapMode = options?.wrapMode ?? 'repeat';

  const noise = new SimplexNoise(seed);
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Scale coordinates
      const nx = (x / width) * scale;
      const ny = (y / height) * scale;

      // Generate FBM noise (normalized to 0-1)
      const value = noise.fbmNormalized(nx, ny, {
        octaves,
        gain: persistence,
        lacunarity,
      });

      // Convert to 0-255 range
      const pixelValue = Math.floor(value * 255);

      // RGBA (grayscale noise)
      const index = (y * width + x) * 4;
      data[index] = pixelValue;     // R
      data[index + 1] = pixelValue; // G
      data[index + 2] = pixelValue; // B
      data[index + 3] = 255;        // A
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);

  // Set wrap mode
  const threeWrapMode = wrapMode === 'repeat'
    ? THREE.RepeatWrapping
    : wrapMode === 'mirror'
      ? THREE.MirroredRepeatWrapping
      : THREE.ClampToEdgeWrapping;

  texture.wrapS = threeWrapMode;
  texture.wrapT = threeWrapMode;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return texture;
}

/**
 * Result of creating water noise textures
 */
export interface WaterNoiseTextures {
  /** Noise texture for wave distortion effect */
  distortionNoise: THREE.DataTexture;
  /** Noise texture for foam/water texture pattern */
  foamNoise: THREE.DataTexture;
}

/**
 * Generate the two specific noise textures required for the water shader
 *
 * Creates textures matching the Godot water shader parameters:
 * - distortionNoise: For wave animation and reflection distortion
 * - foamNoise: For the foam/water surface texture pattern
 *
 * @param seed - Random seed for reproducibility (default: 0)
 * @returns Object containing both noise textures
 *
 * @example
 * ```typescript
 * const { distortionNoise, foamNoise } = createWaterNoiseTextures(12345);
 * waterMaterial.uniforms.noiseTexture.value = distortionNoise;
 * waterMaterial.uniforms.noiseTexture2.value = foamNoise;
 * ```
 */
export function createWaterNoiseTextures(seed: number = 0): WaterNoiseTextures {
  // Distortion noise: Used for wave animation
  // Godot params: octaves 3, persistence 0.5, period 0 (we use scale 4 for nice waves)
  const distortionNoise = createNoiseTexture({
    width: 512,
    height: 512,
    seed,
    scale: 4, // Lower scale = larger features
    octaves: 3,
    persistence: 0.5,
    lacunarity: 1, // Minimal frequency increase between octaves
    wrapMode: 'repeat',
  });

  // Foam noise: Used for water surface texture
  // Godot params: octaves 3, period 15, persistence 0.5, lacunarity 4
  const foamNoise = createNoiseTexture({
    width: 512,
    height: 512,
    seed: seed + 1, // Different seed for variety
    scale: 15, // Higher scale = smaller, more detailed features
    octaves: 3,
    persistence: 0.5,
    lacunarity: 4, // Strong frequency increase for detailed pattern
    wrapMode: 'repeat',
  });

  return { distortionNoise, foamNoise };
}
