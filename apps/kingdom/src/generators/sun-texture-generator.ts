/**
 * Sun Texture Generator
 *
 * Procedural pixel-art style sun textures with comprehensive controls.
 * Generates vibrant suns with corona flares, surface detail, pulsing core, and atmospheric glow.
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
 * Options for generating a sun texture
 */
export interface SunTextureOptions {
  /** Random seed for reproducible generation (default: 0) */
  seed?: number;
  /** Texture width in pixels (default: 128) */
  width?: number;
  /** Texture height in pixels (default: 128) */
  height?: number;

  // Core controls
  /** Sun core radius as fraction of texture (default: 0.35) */
  coreRadius?: number;
  /** Core brightness intensity (0-1, default: 1.0) */
  coreBrightness?: number;
  /** Core pulse amount (0-1, default: 0.1) - creates pulsing effect */
  corePulse?: number;

  // Surface controls
  /** Surface turbulence scale (default: 0.08) */
  surfaceScale?: number;
  /** Surface turbulence strength (0-1, default: 0.15) */
  surfaceStrength?: number;
  /** Surface detail scale for fine features (default: 0.2) */
  detailScale?: number;
  /** Surface detail strength (0-1, default: 0.1) */
  detailStrength?: number;

  // Corona flare controls
  /** Number of corona flares (default: 8) */
  flareCount?: number;
  /** Minimum flare length as fraction of radius (default: 0.15) */
  flareMinLength?: number;
  /** Maximum flare length as fraction of radius (default: 0.4) */
  flareMaxLength?: number;
  /** Flare width as fraction of radius (default: 0.12) */
  flareWidth?: number;
  /** Flare intensity boost (0-1, default: 0.5) */
  flareIntensity?: number;

  // Glow controls
  /** Outer glow intensity (0-1, default: 0.7) */
  glowIntensity?: number;
  /** Glow size multiplier (default: 1.5) */
  glowSize?: number;
  /** Glow falloff power (default: 2.0) - higher = sharper falloff */
  glowFalloff?: number;

  // Pixelation controls
  /** Edge pixelation (0-1, default: 0.2) - higher = more pixelated edges */
  edgePixelation?: number;
  /** Flare pixelation (0-1, default: 0.3) - higher = more chunky flares */
  flarePixelation?: number;

  // Colors
  /** Core color (default: bright yellow-white) */
  coreColor?: RGBA;
  /** Mid/transition color (default: orange-yellow) */
  midColor?: RGBA;
  /** Edge/corona color (default: orange-red) */
  edgeColor?: RGBA;
  /** Glow color (default: uses edge color) */
  glowColor?: RGBA;
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
 * Corona flare definition
 */
interface Flare {
  angle: number;
  length: number;
  width: number;
  intensity: number;
}

/**
 * Generate a procedural pixel-art sun texture
 *
 * @param options - Configuration options
 * @returns Three.js DataTexture with sun image
 */
export function generateSunTexture(
  options?: SunTextureOptions,
): THREE.DataTexture {
  // Default values
  const seed = options?.seed ?? 0;
  const width = options?.width ?? 128;
  const height = options?.height ?? 128;

  // Core defaults
  const coreRadius = options?.coreRadius ?? 0.35;
  const coreBrightness = options?.coreBrightness ?? 1.0;
  const corePulse = options?.corePulse ?? 0.1;

  // Surface defaults
  const surfaceScale = options?.surfaceScale ?? 0.08;
  const surfaceStrength = options?.surfaceStrength ?? 0.08;
  const detailScale = options?.detailScale ?? 0.2;
  const detailStrength = options?.detailStrength ?? 0.05;

  // Flare defaults
  const flareCount = options?.flareCount ?? 8;
  const flareMinLength = options?.flareMinLength ?? 0.15;
  const flareMaxLength = options?.flareMaxLength ?? 0.4;
  const flareWidth = options?.flareWidth ?? 0.12;
  const flareIntensity = options?.flareIntensity ?? 0.5;

  // Glow defaults
  const glowIntensity = options?.glowIntensity ?? 0.7;
  const glowSize = options?.glowSize ?? 1.5;
  const glowFalloff = options?.glowFalloff ?? 2.0;

  // Pixelation defaults
  const edgePixelation = options?.edgePixelation ?? 0.2;
  const flarePixelation = options?.flarePixelation ?? 0.3;

  // Default colors (0-1 range)
  const coreColor = options?.coreColor ?? { r: 1.0, g: 0.98, b: 0.85, a: 1.0 };
  const midColor = options?.midColor ?? { r: 1.0, g: 0.75, b: 0.3, a: 1.0 };
  const edgeColor = options?.edgeColor ?? { r: 1.0, g: 0.45, b: 0.15, a: 1.0 };
  const glowColor = options?.glowColor ?? edgeColor;

  // Initialize noise and random generators
  const noise = new SimplexNoise(seed);
  const rng = new SeededRandom(seed);

  // Create pixel data buffer
  const data = new Uint8Array(width * height * 4);

  const centerX = width / 2;
  const centerY = height / 2;
  const minDimension = Math.min(width, height);
  // Ensure sun + flares + glow fit within texture
  const maxExtent = minDimension / 2; // Half of texture dimension
  const sunRadius = maxExtent * coreRadius / (coreRadius + flareMaxLength + (glowSize - 1.0) * coreRadius);

  // Generate corona flares with varying properties
  const flares: Flare[] = [];
  for (let i = 0; i < flareCount; i++) {
    const angle = (i / flareCount) * Math.PI * 2 + rng.next() * 0.3;
    const lengthRange = flareMaxLength - flareMinLength;
    const length = sunRadius * (flareMinLength + rng.next() * lengthRange);
    const width = sunRadius * flareWidth * (0.7 + rng.next() * 0.6);
    const intensity = 0.7 + rng.next() * 0.3; // Vary flare intensity
    flares.push({ angle, length, width, intensity });
  }

  // Generate sun texture
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;

      const dx = x - centerX;
      const dy = y - centerY;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      // === Surface Noise ===
      // Coarse turbulence for overall surface variation
      const turbulence = noise.fbmNormalized(x * surfaceScale, y * surfaceScale, {
        octaves: 4,
        lacunarity: 2.0,
        gain: 0.5,
      });

      // Fine detail for surface texture
      const fineDetail = noise.fbmNormalized(x * detailScale, y * detailScale, {
        octaves: 3,
        lacunarity: 2.0,
        gain: 0.5,
      });

      // Core pulse (radial variation)
      const pulseNoise = noise.fbmNormalized(angle * 4, distFromCenter * 0.05, {
        octaves: 2,
        lacunarity: 2.0,
        gain: 0.5,
      });
      const pulseVariation = 1.0 + (pulseNoise - 0.5) * corePulse;

      // Calculate effective radius with turbulence (apply to the radius, not the distance)
      const radiusVariation = 1.0 + (turbulence - 0.5) * surfaceStrength;
      const turbulentRadius = sunRadius * radiusVariation * pulseVariation;

      // Normalize distance without pixelation first
      const normalizedDist = distFromCenter / sunRadius;

      // Apply edge pixelation only to the EDGE region (> 0.8)
      let pixelatedDist = normalizedDist;
      if (normalizedDist > 0.7) {
        const edgeRegion = (normalizedDist - 0.7) / 0.3; // 0-1 in edge region
        const pixelSize = 1.0 + edgePixelation * 8.0;
        const pixelatedEdge = Math.floor(edgeRegion * pixelSize) / pixelSize;
        pixelatedDist = 0.7 + pixelatedEdge * 0.3;
      }

      // === Corona Flare Check ===
      let flareInfluence = 0;
      for (const flare of flares) {
        // Calculate angular difference (wrap around)
        let angleDiff = Math.abs(angle - flare.angle);
        if (angleDiff > Math.PI) {
          angleDiff = Math.PI * 2 - angleDiff;
        }

        // Check if within flare's angular width
        if (angleDiff < flare.width / sunRadius) {
          const angleBlend = 1.0 - (angleDiff / (flare.width / sunRadius));

          // Distance from sun edge
          const distanceFromEdge = distFromCenter - turbulentRadius;

          if (distanceFromEdge > -sunRadius * 0.1 && distanceFromEdge < flare.length) {
            // Pixelate flare distance for chunky pixel-art effect
            const normalizedFlareDist = Math.max(0, distanceFromEdge) / flare.length;
            const flarePixelSize = 1.0 + flarePixelation * 6.0;
            const pixelatedFlareDist = Math.floor(normalizedFlareDist * flarePixelSize) / flarePixelSize;

            const distBlend = 1.0 - pixelatedFlareDist;
            flareInfluence = Math.max(
              flareInfluence,
              angleBlend * distBlend * flare.intensity * flareIntensity,
            );
          }
        }
      }

      // === Glow Calculation ===
      const glowRadius = turbulentRadius * glowSize;

      if (pixelatedDist < 1.0 || flareInfluence > 0) {
        // === Inside sun body or in corona flare ===

        // Radial gradient: core -> mid -> edge
        let r: number, g: number, b: number;

        const effectiveDist = Math.min(1.0, pixelatedDist);

        if (effectiveDist < 0.4) {
          // Core region - very bright
          const blend = effectiveDist / 0.4;
          r = coreColor.r * (1 - blend) + midColor.r * blend;
          g = coreColor.g * (1 - blend) + midColor.g * blend;
          b = coreColor.b * (1 - blend) + midColor.b * blend;

          // Boost core brightness
          const brightnessMult = 1.0 + (1.0 - effectiveDist) * (coreBrightness - 1.0);
          r *= brightnessMult;
          g *= brightnessMult;
          b *= brightnessMult;
        } else if (effectiveDist < 0.8) {
          // Mid section
          const blend = (effectiveDist - 0.4) / 0.4;
          r = midColor.r * (1 - blend) + edgeColor.r * blend;
          g = midColor.g * (1 - blend) + edgeColor.g * blend;
          b = midColor.b * (1 - blend) + edgeColor.b * blend;
        } else {
          // Edge region
          const blend = (effectiveDist - 0.8) / 0.2;
          r = edgeColor.r;
          g = edgeColor.g;
          b = edgeColor.b;

          // Slight darkening at very edge
          const edgeDarken = 1.0 - blend * 0.2;
          r *= edgeDarken;
          g *= edgeDarken;
          b *= edgeDarken;
        }

        // Apply surface turbulence variation
        const variation = 0.85 + turbulence * 0.3 + (fineDetail - 0.5) * detailStrength;
        r *= variation;
        g *= variation;
        b *= variation;

        // Boost intensity for flares
        if (flareInfluence > 0) {
          const flareBoost = 1.0 + flareInfluence * 0.6;
          r = Math.min(1.0, r * flareBoost);
          g = Math.min(1.0, g * flareBoost);
          b = Math.min(1.0, b * flareBoost);
        }

        data[index] = Math.floor(Math.max(0, Math.min(1, r)) * 255);
        data[index + 1] = Math.floor(Math.max(0, Math.min(1, g)) * 255);
        data[index + 2] = Math.floor(Math.max(0, Math.min(1, b)) * 255);
        data[index + 3] = 255; // Fully opaque
      } else if (distFromCenter < glowRadius) {
        // === Outer glow (semi-transparent atmospheric halo) ===
        const glowDist = (distFromCenter - turbulentRadius) / (glowRadius - turbulentRadius);
        const glowFalloffCurve = Math.pow(1.0 - glowDist, glowFalloff);
        const glowStrength = glowFalloffCurve * glowIntensity;

        // Add subtle variation to glow
        const glowVariation = 0.9 + turbulence * 0.2;

        // Use glow color
        const r = glowColor.r * glowVariation;
        const g = glowColor.g * glowVariation;
        const b = glowColor.b * glowVariation;

        data[index] = Math.floor(Math.max(0, Math.min(1, r)) * 255);
        data[index + 1] = Math.floor(Math.max(0, Math.min(1, g)) * 255);
        data[index + 2] = Math.floor(Math.max(0, Math.min(1, b)) * 255);
        data[index + 3] = Math.floor(glowStrength * 255); // Semi-transparent
      } else {
        // Outside sun - transparent
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
