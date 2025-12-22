/**
 * Moon Texture Generator
 *
 * Procedural pixel-art style moon textures with detailed crater and surface controls.
 * Generates realistic moon surfaces with maria (dark patches), craters with rims, and fine surface detail.
 */

import * as THREE from 'three';
import { SimplexNoise } from '@voidscript/engine';

/**
 * RGBA color interface
 */
export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Options for generating a moon texture
 */
export interface MoonTextureOptions {
  /** Random seed for reproducible generation (default: 0) */
  seed?: number;
  /** Texture width in pixels (default: 128) */
  width?: number;
  /** Texture height in pixels (default: 128) */
  height?: number;

  // Crater controls
  /** Number of craters to generate (default: 12) */
  craterCount?: number;
  /** Minimum crater size as fraction of moon radius (default: 0.03) */
  craterMinSize?: number;
  /** Maximum crater size as fraction of moon radius (default: 0.15) */
  craterMaxSize?: number;
  /** Crater depth intensity (0-1, default: 0.6) */
  craterDepth?: number;
  /** Crater rim brightness (0-1, default: 0.3) */
  craterRimBrightness?: number;
  /** Crater rim width as fraction of radius (default: 0.15) */
  craterRimWidth?: number;

  // Surface texture controls
  /** Surface noise scale (default: 0.15) */
  surfaceNoiseScale?: number;
  /** Surface noise strength (0-1, default: 0.2) */
  surfaceNoiseStrength?: number;
  /** Fine detail noise scale (default: 0.5) */
  fineDetailScale?: number;
  /** Fine detail strength (0-1, default: 0.1) */
  fineDetailStrength?: number;

  // Maria (dark patches) controls
  /** Number of maria regions (default: 3) */
  mariaCount?: number;
  /** Maria darkness (0-1, default: 0.3) */
  mariaDarkness?: number;
  /** Maria size as fraction of moon radius (default: 0.3) */
  mariaSize?: number;

  // Phase and lighting
  /** Moon phase (0.0 = new moon, 0.5 = full moon, 1.0 = new moon) */
  phase?: number;
  /** Lighting contrast (0-1, default: 0.4) */
  lightingContrast?: number;

  // Pixelation controls
  /** Crater edge pixelation (0-1, default: 0.3) - higher = more pixelated edges */
  craterPixelation?: number;
  /** Maria edge pixelation (0-1, default: 0.2) - higher = more pixelated edges */
  mariaPixelation?: number;

  // Colors
  /** Base surface color (default: light gray) */
  baseColor?: RGBA;
  /** Maria/shadow color (default: darker gray) */
  mariaColor?: RGBA;
  /** Highlight color (default: very light gray) */
  highlightColor?: RGBA;
}

/**
 * Seeded random number generator
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

/**
 * Crater definition with rim
 */
interface Crater {
  x: number;
  y: number;
  radius: number;
  depth: number; // 0-1, how deep/dark the crater is
  rimWidth: number; // Width of bright rim
}

/**
 * Maria (dark patch) definition
 */
interface Maria {
  x: number;
  y: number;
  radius: number;
  darkness: number;
}

/**
 * Generate a procedural pixel-art moon texture
 *
 * @param options - Configuration options
 * @returns Three.js DataTexture with moon image
 */
export function generateMoonTexture(
  options?: MoonTextureOptions,
): THREE.DataTexture {
  // Default values
  const seed = options?.seed ?? 0;
  const width = options?.width ?? 128;
  const height = options?.height ?? 128;

  // Crater defaults
  const craterCount = options?.craterCount ?? 12;
  const craterMinSize = options?.craterMinSize ?? 0.03;
  const craterMaxSize = options?.craterMaxSize ?? 0.15;
  const craterDepth = options?.craterDepth ?? 0.6;
  const craterRimBrightness = options?.craterRimBrightness ?? 0.3;
  const craterRimWidth = options?.craterRimWidth ?? 0.15;

  // Surface defaults
  const surfaceNoiseScale = options?.surfaceNoiseScale ?? 0.15;
  const surfaceNoiseStrength = options?.surfaceNoiseStrength ?? 0.2;
  const fineDetailScale = options?.fineDetailScale ?? 0.5;
  const fineDetailStrength = options?.fineDetailStrength ?? 0.1;

  // Maria defaults
  const mariaCount = options?.mariaCount ?? 3;
  const mariaDarkness = options?.mariaDarkness ?? 0.3;
  const mariaSize = options?.mariaSize ?? 0.3;

  // Phase and lighting
  const phase = options?.phase ?? 0.5;
  const lightingContrast = options?.lightingContrast ?? 0.4;

  // Pixelation
  const craterPixelation = options?.craterPixelation ?? 0.3;
  const mariaPixelation = options?.mariaPixelation ?? 0.2;

  // Default colors (0-1 range)
  const baseColor = options?.baseColor ?? { r: 0.88, g: 0.88, b: 0.90, a: 1.0 };
  const mariaColor = options?.mariaColor ?? { r: 0.25, g: 0.25, b: 0.30, a: 1.0 };
  const highlightColor = options?.highlightColor ?? { r: 0.98, g: 0.98, b: 1.0, a: 1.0 };

  // Initialize noise and random generators
  const noise = new SimplexNoise(seed);
  const rng = new SeededRandom(seed);

  // Create pixel data buffer
  const data = new Uint8Array(width * height * 4);

  const centerX = width / 2;
  const centerY = height / 2;
  const moonRadius = Math.min(width, height) * 0.45;

  // Generate maria (dark patches)
  const marias: Maria[] = [];
  for (let i = 0; i < mariaCount; i++) {
    const angle = rng.next() * Math.PI * 2;
    const distance = Math.sqrt(rng.next()) * moonRadius * 0.6;
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;
    const radius = moonRadius * mariaSize * (0.5 + rng.next() * 0.8);
    const darkness = mariaDarkness * (0.7 + rng.next() * 0.3);

    marias.push({ x, y, radius, darkness });
  }

  // Generate craters with varying sizes
  const craters: Crater[] = [];
  for (let i = 0; i < craterCount; i++) {
    const angle = rng.next() * Math.PI * 2;
    const distance = Math.sqrt(rng.next()) * moonRadius * 0.85;
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;

    // Larger size range for more variety
    const sizeRange = craterMaxSize - craterMinSize;
    const radius = moonRadius * (craterMinSize + rng.next() * sizeRange);
    const depth = craterDepth * (0.6 + rng.next() * 0.4);
    const rimWidth = radius * craterRimWidth;

    craters.push({ x, y, radius, depth, rimWidth });
  }

  // Sort craters by size (largest first) for proper layering
  craters.sort((a, b) => b.radius - a.radius);

  // Calculate phase shading direction
  const phaseFactor = Math.abs(phase - 0.5) * 2; // 0 = full moon, 1 = new moon
  const phaseAngle = phase < 0.5 ? Math.PI : 0;

  // Generate moon texture
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;

      // Check if pixel is inside moon circle
      const dx = x - centerX;
      const dy = y - centerY;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);

      if (distFromCenter < moonRadius) {
        const normalizedDist = distFromCenter / moonRadius;

        // === Surface Noise ===
        const surfaceNoise = noise.fbmNormalized(x * surfaceNoiseScale, y * surfaceNoiseScale, {
          octaves: 3,
          lacunarity: 2.0,
          gain: 0.5,
        });

        // Fine detail (smaller scale noise)
        const fineDetail = noise.fbmNormalized(x * fineDetailScale, y * fineDetailScale, {
          octaves: 2,
          lacunarity: 2.0,
          gain: 0.5,
        });

        // === Phase-based lighting (3D sphere) ===
        const angle = Math.atan2(dy, dx);
        const lightAngle = Math.cos(angle - phaseAngle);
        const phaseDarkness = Math.max(0, 1 - phaseFactor * (1 + lightAngle) * 0.5);

        // Sphere shading (darker at edges with adjustable contrast)
        const edgeFalloff = Math.pow(1.0 - normalizedDist, 0.5);
        const sphereShading = 1.0 - (1.0 - edgeFalloff) * lightingContrast;

        // === Maria (dark patches) ===
        let mariaInfluence = 0;
        for (const maria of marias) {
          const mdx = x - maria.x;
          const mdy = y - maria.y;
          const mariaDist = Math.sqrt(mdx * mdx + mdy * mdy);

          if (mariaDist < maria.radius) {
            // Soft edge falloff for maria with pixelation
            const normalizedMariaDist = mariaDist / maria.radius;

            // Apply pixelation to the edge
            const pixelSize = 1.0 + mariaPixelation * 8.0; // Pixel size in texture units
            const pixelatedDist = Math.floor(normalizedMariaDist * pixelSize) / pixelSize;

            const mariaFalloff = Math.pow(1.0 - pixelatedDist, 2);
            mariaInfluence = Math.max(mariaInfluence, mariaFalloff * maria.darkness);
          }
        }

        // === Crater effects ===
        let craterDarkness = 0;
        let craterRimBrightness = 0;

        for (const crater of craters) {
          const cdx = x - crater.x;
          const cdy = y - crater.y;
          const craterDist = Math.sqrt(cdx * cdx + cdy * cdy);

          if (craterDist < crater.radius) {
            // Inside crater - bowl shape with sharper edges and pixelation
            const normalizedCraterDist = craterDist / crater.radius;

            // Apply pixelation to create stepped/chunky edges
            const pixelSize = 1.0 + craterPixelation * 10.0; // Pixel size in texture units
            const pixelatedDist = Math.floor(normalizedCraterDist * pixelSize) / pixelSize;

            const craterDepthCurve = Math.pow(1.0 - pixelatedDist, 1.5);
            const craterStrength = craterDepthCurve * crater.depth;
            craterDarkness = Math.max(craterDarkness, craterStrength);

            // Bright rim at the edge with pixelation
            if (pixelatedDist > 1.0 - (crater.rimWidth / crater.radius)) {
              const rimPosition = (pixelatedDist - (1.0 - crater.rimWidth / crater.radius)) / (crater.rimWidth / crater.radius);
              const rimCurve = Math.sin(rimPosition * Math.PI);
              craterRimBrightness = Math.max(craterRimBrightness, rimCurve * craterRimBrightness);
            }
          }
        }

        // === Combine all effects ===
        const totalShading = sphereShading * phaseDarkness;
        const surfaceVariation = 1.0 + (surfaceNoise - 0.5) * surfaceNoiseStrength + (fineDetail - 0.5) * fineDetailStrength;

        // Determine base color (blend between baseColor and mariaColor)
        let r = baseColor.r * (1 - mariaInfluence) + mariaColor.r * mariaInfluence;
        let g = baseColor.g * (1 - mariaInfluence) + mariaColor.g * mariaInfluence;
        let b = baseColor.b * (1 - mariaInfluence) + mariaColor.b * mariaInfluence;

        // Apply crater darkness
        if (craterDarkness > 0.2) {
          const craterBlend = (craterDarkness - 0.2) / 0.8;
          r = r * (1 - craterBlend) + mariaColor.r * craterBlend * 0.5;
          g = g * (1 - craterBlend) + mariaColor.g * craterBlend * 0.5;
          b = b * (1 - craterBlend) + mariaColor.b * craterBlend * 0.5;
        }

        // Apply crater rim brightness
        if (craterRimBrightness > 0) {
          r = Math.min(1.0, r + craterRimBrightness);
          g = Math.min(1.0, g + craterRimBrightness);
          b = Math.min(1.0, b + craterRimBrightness);
        }

        // Apply highlights on bright areas
        if (totalShading > 0.8 && surfaceNoise > 0.65 && mariaInfluence < 0.3) {
          const highlightStrength = (totalShading - 0.8) / 0.2 * (surfaceNoise - 0.65) / 0.35;
          r = r * (1 - highlightStrength) + highlightColor.r * highlightStrength;
          g = g * (1 - highlightStrength) + highlightColor.g * highlightStrength;
          b = b * (1 - highlightStrength) + highlightColor.b * highlightStrength;
        }

        // Apply all shading
        r *= totalShading * surfaceVariation;
        g *= totalShading * surfaceVariation;
        b *= totalShading * surfaceVariation;

        data[index] = Math.floor(Math.max(0, Math.min(1, r)) * 255);
        data[index + 1] = Math.floor(Math.max(0, Math.min(1, g)) * 255);
        data[index + 2] = Math.floor(Math.max(0, Math.min(1, b)) * 255);
        data[index + 3] = 255; // Fully opaque
      } else {
        // Outside moon - transparent
        data[index] = 0;
        data[index + 1] = 0;
        data[index + 2] = 0;
        data[index + 3] = 0;
      }
    }
  }

  // Create DataTexture with pixel art filters
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.flipY = false;
  texture.needsUpdate = true;

  return texture;
}
