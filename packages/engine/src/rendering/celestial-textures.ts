/**
 * Celestial Texture Generators
 *
 * Procedural pixel-art style textures for moon and sun.
 * Used for background celestial bodies in 2D games.
 */

import * as THREE from 'three';
import { SeededRandom } from '../math/seeded-random.js';
import { SimplexNoise } from '../math/noise.js';

/**
 * RGB color interface
 */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Crater definition for moon generation
 */
interface Crater {
  x: number;
  y: number;
  radius: number;
  depth: number; // 0-1, how dark the crater is
}

/**
 * Options for generating a moon texture
 */
export interface MoonTextureOptions {
  /** Texture size in pixels (default: 128) */
  size?: number;
  /** Moon radius in pixels (default: size/2 - 4) */
  radius?: number;
  /** Moon surface base color (default: light gray) */
  baseColor?: RGB;
  /** Crater floor color - darkest part (default: dark gray) */
  craterColor?: RGB;
  /** Crater rim highlight color (default: slightly lighter than base) */
  craterRimColor?: RGB;
  /** Number of large craters (default: 5) */
  largeCraterCount?: number;
  /** Number of medium craters (default: 12) */
  mediumCraterCount?: number;
  /** Number of small craters (default: 25) */
  smallCraterCount?: number;
  /** Random seed for reproducible crater placement (default: 0) */
  seed?: number;
  /** Edge glow/atmosphere width in pixels (default: 4) */
  glowWidth?: number;
  /** Edge glow color (default: very light blue-white) */
  glowColor?: RGB;
  /** Rim thickness as fraction of crater radius (default: 0.2) */
  rimThickness?: number;
}

/**
 * Options for generating a sun texture
 */
export interface SunTextureOptions {
  /** Texture size in pixels (default: 128) */
  size?: number;
  /** Sun disc radius in pixels (default: size/2 - 4) */
  radius?: number;
  /** Sun surface base color (default: bright yellow) */
  baseColor?: RGB;
  /** Sun edge/limb color - darker orange (default: orange) */
  limbColor?: RGB;
  /** Random seed for reproducible variation (default: 0) */
  seed?: number;
  /** Corona/glow width in pixels (default: 8) */
  coronaWidth?: number;
  /** Corona base color (default: orange-yellow) */
  coronaColor?: RGB;
  /** Number of sun rays (default: 12) */
  rayCount?: number;
  /** Ray length as fraction of corona width (default: 1.5) */
  rayLength?: number;
  /** Ray width in radians (default: 0.08) */
  rayWidth?: number;
  /** Ray intensity (default: 0.7) */
  rayIntensity?: number;
}

/**
 * Generate craters for moon surface
 */
function generateCraters(
  rng: SeededRandom,
  moonRadius: number,
  centerX: number,
  centerY: number,
  largeCraterCount: number,
  mediumCraterCount: number,
  smallCraterCount: number,
): Crater[] {
  const craters: Crater[] = [];

  // Large craters (10-20% of moon radius)
  for (let i = 0; i < largeCraterCount; i++) {
    const angle = rng.next() * Math.PI * 2;
    const dist = rng.next() * moonRadius * 0.75; // Keep within 75% of radius
    const craterRadius = moonRadius * (0.1 + rng.next() * 0.1);
    craters.push({
      x: centerX + Math.cos(angle) * dist,
      y: centerY + Math.sin(angle) * dist,
      radius: craterRadius,
      depth: 0.7 + rng.next() * 0.3,
    });
  }

  // Medium craters (5-10% of moon radius)
  for (let i = 0; i < mediumCraterCount; i++) {
    const angle = rng.next() * Math.PI * 2;
    const dist = rng.next() * moonRadius * 0.85;
    const craterRadius = moonRadius * (0.05 + rng.next() * 0.05);
    craters.push({
      x: centerX + Math.cos(angle) * dist,
      y: centerY + Math.sin(angle) * dist,
      radius: craterRadius,
      depth: 0.5 + rng.next() * 0.4,
    });
  }

  // Small craters (2-5% of moon radius)
  for (let i = 0; i < smallCraterCount; i++) {
    const angle = rng.next() * Math.PI * 2;
    const dist = rng.next() * moonRadius * 0.9;
    const craterRadius = moonRadius * (0.02 + rng.next() * 0.03);
    craters.push({
      x: centerX + Math.cos(angle) * dist,
      y: centerY + Math.sin(angle) * dist,
      radius: craterRadius,
      depth: 0.4 + rng.next() * 0.4,
    });
  }

  return craters;
}


/**
 * Generate a procedural pixel-art moon texture with circular craters
 *
 * @param options - Configuration options
 * @returns Three.js DataTexture with moon image
 *
 * @example
 * ```typescript
 * const moonTexture = createMoonTexture({
 *   size: 128,
 *   largeCraterCount: 5,
 *   seed: 12345,
 * });
 * const material = new THREE.SpriteMaterial({ map: moonTexture });
 * ```
 */
export function createMoonTexture(options?: MoonTextureOptions): THREE.DataTexture {
  const size = options?.size ?? 128;
  const radius = options?.radius ?? size / 2 - 4;
  const baseColor = options?.baseColor ?? { r: 0.78, g: 0.78, b: 0.82 };
  const craterColor = options?.craterColor ?? { r: 0.35, g: 0.35, b: 0.4 };
  const craterRimColor = options?.craterRimColor ?? { r: 0.92, g: 0.92, b: 0.95 };
  const largeCraterCount = options?.largeCraterCount ?? 5;
  const mediumCraterCount = options?.mediumCraterCount ?? 12;
  const smallCraterCount = options?.smallCraterCount ?? 25;
  const seed = options?.seed ?? 0;
  const glowWidth = options?.glowWidth ?? 4;
  const glowColor = options?.glowColor ?? { r: 0.85, g: 0.88, b: 1.0 };
  const rimThickness = options?.rimThickness ?? 0.2;

  const rng = new SeededRandom(seed);
  const noise = new SimplexNoise(seed);
  const data = new Uint8Array(size * size * 4);

  const centerX = size / 2;
  const centerY = size / 2;

  // Generate craters
  const craters = generateCraters(
    rng,
    radius,
    centerX,
    centerY,
    largeCraterCount,
    mediumCraterCount,
    smallCraterCount,
  );

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;

      // Distance from moon center
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Outside moon entirely (including glow)
      if (dist > radius + glowWidth) {
        data[index] = 0;
        data[index + 1] = 0;
        data[index + 2] = 0;
        data[index + 3] = 0;
        continue;
      }

      // Glow region (outer edge atmosphere)
      if (dist > radius) {
        const glowFactor = 1 - (dist - radius) / glowWidth;
        const alpha = glowFactor * glowFactor * 0.5;
        data[index] = Math.floor(glowColor.r * 255);
        data[index + 1] = Math.floor(glowColor.g * 255);
        data[index + 2] = Math.floor(glowColor.b * 255);
        data[index + 3] = Math.floor(alpha * 255);
        continue;
      }

      // Start with base moon color
      let r = baseColor.r;
      let g = baseColor.g;
      let b = baseColor.b;

      // Add multi-layered surface texture for rocky appearance
      // Large-scale color variation (maria-like darker regions)
      const largeNoise = noise.fbmNormalized(x * 0.03, y * 0.03, { octaves: 2, lacunarity: 2, gain: 0.5 });
      const largeVariation = (largeNoise - 0.5) * 0.12;
      r += largeVariation;
      g += largeVariation;
      b += largeVariation * 0.8; // Slightly less blue variation

      // Medium-scale surface roughness
      const mediumNoise = noise.fbmNormalized(x * 0.08, y * 0.08, { octaves: 3, lacunarity: 2, gain: 0.5 });
      const mediumVariation = (mediumNoise - 0.5) * 0.1;
      r += mediumVariation;
      g += mediumVariation;
      b += mediumVariation;

      // Fine grain texture (small rocks/dust)
      const fineNoise = noise.fbmNormalized(x * 0.2, y * 0.2, { octaves: 2, lacunarity: 2.5, gain: 0.4 });
      const fineVariation = (fineNoise - 0.5) * 0.06;
      r += fineVariation;
      g += fineVariation;
      b += fineVariation;

      // Check each crater
      for (const crater of craters) {
        const cdx = x - crater.x;
        const cdy = y - crater.y;
        const craterDist = Math.sqrt(cdx * cdx + cdy * cdy);

        if (craterDist < crater.radius) {
          // Inside crater
          const normalizedDist = craterDist / crater.radius;
          const innerRadius = 1 - rimThickness;

          if (normalizedDist < innerRadius) {
            // Crater floor - darker center with gradient
            const floorGradient = normalizedDist / innerRadius;
            const depthFactor = crater.depth * (1 - floorGradient * 0.3);

            r = baseColor.r + (craterColor.r - baseColor.r) * depthFactor;
            g = baseColor.g + (craterColor.g - baseColor.g) * depthFactor;
            b = baseColor.b + (craterColor.b - baseColor.b) * depthFactor;
          } else {
            // Crater rim - lighter highlight
            const rimGradient = (normalizedDist - innerRadius) / rimThickness;
            // Rim is brightest at inner edge, fades to base at outer edge
            const rimFactor = 1 - rimGradient;

            r = baseColor.r + (craterRimColor.r - baseColor.r) * rimFactor * 0.7;
            g = baseColor.g + (craterRimColor.g - baseColor.g) * rimFactor * 0.7;
            b = baseColor.b + (craterRimColor.b - baseColor.b) * rimFactor * 0.7;
          }
        }
      }

      // Add limb darkening (edges are darker)
      const limbFactor = dist / radius;
      const limbDarkening = 1 - limbFactor * limbFactor * 0.25;
      r *= limbDarkening;
      g *= limbDarkening;
      b *= limbDarkening;

      data[index] = Math.floor(Math.max(0, Math.min(1, r)) * 255);
      data[index + 1] = Math.floor(Math.max(0, Math.min(1, g)) * 255);
      data[index + 2] = Math.floor(Math.max(0, Math.min(1, b)) * 255);
      data[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.flipY = false;
  texture.needsUpdate = true;

  return texture;
}

/**
 * Generate a procedural pixel-art sun texture with rays/corona
 *
 * @param options - Configuration options
 * @returns Three.js DataTexture with sun image
 *
 * @example
 * ```typescript
 * const sunTexture = createSunTexture({
 *   size: 128,
 *   rayCount: 12,
 *   seed: 12345,
 * });
 * const material = new THREE.SpriteMaterial({ map: sunTexture });
 * ```
 */
export function createSunTexture(options?: SunTextureOptions): THREE.CanvasTexture {
  const size = options?.size ?? 128;
  const baseColor = options?.baseColor ?? { r: 1.0, g: 0.95, b: 0.7 };
  const limbColor = options?.limbColor ?? { r: 1.0, g: 0.7, b: 0.3 };
  const seed = options?.seed ?? 0;
  const coronaWidth = options?.coronaWidth ?? 8;
  const coronaColor = options?.coronaColor ?? { r: 1.0, g: 0.6, b: 0.2 };
  const rayCount = options?.rayCount ?? 16;
  const rayLength = options?.rayLength ?? 2.0;
  const rayWidth = options?.rayWidth ?? 0.15;
  const rayIntensity = options?.rayIntensity ?? 1.0;

  // Default disc radius: leave room for corona and rays
  // If not specified, use size/2 minus space for corona and rays
  const defaultRadius = (size / 2) - coronaWidth - (coronaWidth * (rayLength - 1));
  const radius = options?.radius ?? defaultRadius;

  const rng = new SeededRandom(seed);

  // Create canvas for drawing
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Clear canvas to transparent
  ctx.clearRect(0, 0, size, size);

  const centerX = size / 2;
  const centerY = size / 2;

  // Pre-calculate ray angles with slight randomization
  const rayAngles: number[] = [];
  const rayLengthMults: number[] = [];
  for (let i = 0; i < rayCount; i++) {
    const baseAngle = (i / rayCount) * Math.PI * 2;
    const angleOffset = (rng.next() - 0.5) * 0.2;
    rayAngles.push(baseAngle + angleOffset);
    rayLengthMults.push(0.7 + rng.next() * 0.6);
  }

  const maxRayExtent = coronaWidth * rayLength;

  // Draw rays first (behind the disc)
  for (let i = 0; i < rayCount; i++) {
    const rayAngle = rayAngles[i]!;
    const rayLenMult = rayLengthMults[i]!;
    const thisRayLength = maxRayExtent * rayLenMult;

    // Create gradient for ray
    const rayEndX = centerX + Math.cos(rayAngle) * (radius + thisRayLength);
    const rayEndY = centerY + Math.sin(rayAngle) * (radius + thisRayLength);

    const gradient = ctx.createLinearGradient(
      centerX + Math.cos(rayAngle) * radius,
      centerY + Math.sin(rayAngle) * radius,
      rayEndX,
      rayEndY
    );

    const r = Math.floor(coronaColor.r * 255);
    const g = Math.floor(coronaColor.g * 255);
    const b = Math.floor(coronaColor.b * 255);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.8 * rayIntensity})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    // Draw ray as a triangle
    ctx.beginPath();
    const halfWidth = rayWidth * 0.8;
    const startX1 = centerX + Math.cos(rayAngle - halfWidth) * radius;
    const startY1 = centerY + Math.sin(rayAngle - halfWidth) * radius;
    const startX2 = centerX + Math.cos(rayAngle + halfWidth) * radius;
    const startY2 = centerY + Math.sin(rayAngle + halfWidth) * radius;

    ctx.moveTo(startX1, startY1);
    ctx.lineTo(rayEndX, rayEndY);
    ctx.lineTo(startX2, startY2);
    ctx.closePath();

    ctx.fillStyle = gradient;
    ctx.fill();
  }

  // Draw the main sun disc with gradient
  const discGradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, radius
  );

  const baseR = Math.floor(baseColor.r * 255);
  const baseG = Math.floor(baseColor.g * 255);
  const baseB = Math.floor(baseColor.b * 255);
  const limbR = Math.floor(limbColor.r * 255);
  const limbG = Math.floor(limbColor.g * 255);
  const limbB = Math.floor(limbColor.b * 255);

  discGradient.addColorStop(0, `rgb(${baseR}, ${baseG}, ${baseB})`);
  discGradient.addColorStop(0.7, `rgb(${baseR}, ${baseG}, ${baseB})`);
  discGradient.addColorStop(1, `rgb(${limbR}, ${limbG}, ${limbB})`);

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = discGradient;
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;

  return texture;
}
