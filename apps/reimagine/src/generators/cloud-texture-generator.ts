/**
 * Cloud Texture Generator
 *
 * Procedural pixel-art style cloud textures with weather variation.
 * Generates clouds using FBM noise with quantized alpha for pixel art aesthetic.
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
 * Options for generating a cloud texture
 */
export interface CloudTextureOptions {
  /** Random seed for reproducible generation (default: 0) */
  seed?: number;
  /** Texture width in pixels (default: 128) */
  width?: number;
  /** Texture height in pixels (default: 128) */
  height?: number;
  /** Number of circles to use for cloud shape (default: 8) */
  circleCount?: number;
  /** Horizontal stretch factor (default: 1.0, range: 0.5-2.5) */
  horizontalStretch?: number;
  /** Vertical stretch factor (default: 1.0, range: 0.5-2.5) */
  verticalStretch?: number;
  /** Weather type (default: 'normal') */
  weatherType?: 'normal' | 'rainy';
  /** Normal weather base color (default: light white) */
  normalBase?: RGBA;
  /** Normal weather shade color (default: gray-white) */
  normalShade?: RGBA;
  /** Normal weather highlight color (default: very light white) */
  normalHighlight?: RGBA;
  /** Rainy weather base color (default: dark gray) */
  rainyBase?: RGBA;
  /** Rainy weather shade color (default: very dark gray) */
  rainyShade?: RGBA;
  /** Rainy weather highlight color (default: lighter gray) */
  rainyHighlight?: RGBA;
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
 * Circle for cloud shape mask
 */
interface Circle {
  x: number;
  y: number;
  radius: number;
  radiusX: number; // Horizontal radius (can differ from radiusY for ellipse)
  radiusY: number; // Vertical radius (can differ from radiusX for ellipse)
}

/**
 * Generate a procedural pixel-art cloud texture
 *
 * @param options - Configuration options
 * @returns Three.js DataTexture with cloud image
 *
 * @example
 * ```typescript
 * const cloudTexture = generateCloudTexture({
 *   seed: 12345,
 *   width: 128,
 *   height: 128,
 *   weatherType: 'normal',
 * });
 * const material = new THREE.SpriteMaterial({ map: cloudTexture });
 * ```
 */
export function generateCloudTexture(
  options?: CloudTextureOptions,
): THREE.DataTexture {
  // Default values
  const seed = options?.seed ?? 0;
  const width = options?.width ?? 128;
  const height = options?.height ?? 128;
  const circleCount = options?.circleCount ?? 8;
  const horizontalStretch = options?.horizontalStretch ?? 1.0;
  const verticalStretch = options?.verticalStretch ?? 1.0;
  const weatherType = options?.weatherType ?? 'normal';

  // Default colors (0-1 range)
  const normalBase = options?.normalBase ?? { r: 0.95, g: 0.95, b: 0.98, a: 1.0 };
  const normalShade = options?.normalShade ?? { r: 0.7, g: 0.72, b: 0.8, a: 1.0 };
  const normalHighlight = options?.normalHighlight ?? { r: 1.0, g: 1.0, b: 1.0, a: 1.0 };
  const rainyBase = options?.rainyBase ?? { r: 0.4, g: 0.42, b: 0.48, a: 1.0 };
  const rainyShade = options?.rainyShade ?? { r: 0.2, g: 0.22, b: 0.28, a: 1.0 };
  const rainyHighlight = options?.rainyHighlight ?? { r: 0.55, g: 0.57, b: 0.63, a: 1.0 };

  // Select colors based on weather type
  const baseColor = weatherType === 'normal' ? normalBase : rainyBase;
  const shadeColor = weatherType === 'normal' ? normalShade : rainyShade;
  const highlightColor = weatherType === 'normal' ? normalHighlight : rainyHighlight;

  // Initialize noise and random generators
  const noise = new SimplexNoise(seed);
  const rng = new SeededRandom(seed);

  // Create pixel data buffer
  const data = new Uint8Array(width * height * 4);

  // Generate overlapping circles for cloud shape mask
  const circles: Circle[] = [];
  const centerX = width / 2;
  const centerY = height / 2;
  const baseSize = Math.min(width, height);

  // Safety margin to prevent circles from being cut off at borders (10% of size)
  const margin = baseSize * 0.1;

  // Calculate how many circles to use for structural base (40% of total, min 1, max 6)
  const structuralCount = Math.max(1, Math.min(6, Math.floor(circleCount * 0.4)));

  // Track previous radius for size variation
  let previousRadius = 0;

  for (let i = 0; i < circleCount; i++) {
    // Seeded boolean: should this circle grow or shrink compared to previous?
    // Use deterministic random based on seed + index
    const sizeRandom = rng.next();
    const shouldGrow = sizeRandom > 0.5;

    // First few circles create the elongated base shape
    if (i === 0) {
      // Main central circle - larger for fewer circles, smaller for many
      const radiusFactor = circleCount <= 5 ? 0.22 : 0.18;
      const radius = baseSize * (radiusFactor + rng.next() * 0.08);
      previousRadius = radius;

      // Apply elliptical variation - ALWAYS applied, never perfectly round
      let radiusX = radius;
      let radiusY = radius;

      // Random chance of being horizontally or vertically flatter
      const flattenHorizontal = rng.next() > 0.5;
      // Flatten amount: 60-96% of original (never 100% = never perfectly round)
      const flattenAmount = 0.6 + rng.next() * 0.36; // Range: 0.6 to 0.96
      if (flattenHorizontal) {
        radiusY *= flattenAmount; // Flatter vertically (wider cloud)
      } else {
        radiusX *= flattenAmount; // Flatter horizontally (taller cloud)
      }

      // Apply stretch factors
      radiusX *= horizontalStretch;
      radiusY *= verticalStretch;

      circles.push({
        x: centerX,
        y: centerY,
        radius: radius,
        radiusX: radiusX,
        radiusY: radiusY,
      });
    } else if (i <= structuralCount) {
      // Create horizontal elongation with circles to left and right
      // Ensure overlap by placing circles closer together
      const prevCircle = circles[circles.length - 1]!;
      const side = i % 2 === 0 ? 1 : -1;

      // Apply size variation based on seeded boolean
      let radius: number;
      if (shouldGrow) {
        // Grow: 80-120% of previous radius
        radius = previousRadius * (0.8 + rng.next() * 0.4);
      } else {
        // Shrink: 60-90% of previous radius
        radius = previousRadius * (0.6 + rng.next() * 0.3);
      }

      // Clamp radius to reasonable bounds
      const minRadius = baseSize * 0.08;
      const maxRadius = baseSize * 0.25;
      radius = Math.max(minRadius, Math.min(maxRadius, radius));
      previousRadius = radius;

      // Apply elliptical variation - ALWAYS applied, never perfectly round
      let radiusX = radius;
      let radiusY = radius;

      // Prefer horizontal flattening for structural circles (wider clouds)
      const flattenHorizontal = rng.next() > 0.3; // 70% chance horizontal
      // Flatten amount: 60-96% of original (never 100% = never perfectly round)
      const flattenAmount = 0.6 + rng.next() * 0.36; // Range: 0.6 to 0.96
      if (flattenHorizontal) {
        radiusY *= flattenAmount; // Flatter vertically (wider cloud)
      } else {
        radiusX *= flattenAmount; // Flatter horizontally (taller cloud)
      }

      // Apply stretch factors
      radiusX *= horizontalStretch;
      radiusY *= verticalStretch;

      // Calculate spread that ensures overlap (combined radii minus a bit for overlap)
      const minOverlap = radius * 0.3; // Minimum 30% overlap
      const maxSpread = prevCircle.radius + radius - minOverlap;
      const spreadFactor = 0.1 + (circleCount - 5) * 0.015;
      const horizontalSpread = Math.min(
        baseSize * (spreadFactor + rng.next() * 0.1),
        maxSpread
      ) * horizontalStretch;

      const verticalOffset = (rng.next() - 0.5) * baseSize * 0.08 * verticalStretch;

      // Clamp position to stay within bounds
      const newX = centerX + side * horizontalSpread;
      const newY = centerY + verticalOffset;
      const clampedX = Math.max(margin + radius, Math.min(width - margin - radius, newX));
      const clampedY = Math.max(margin + radius, Math.min(height - margin - radius, newY));

      circles.push({
        x: clampedX,
        y: clampedY,
        radius: radius,
        radiusX: radiusX,
        radiusY: radiusY,
      });
    } else {
      // Fill in gaps with smaller circles for fluffy appearance
      // Pick a random existing circle to attach to (ensures connection)
      const attachToCircle = circles[Math.floor(rng.next() * circles.length)]!;

      // Apply size variation
      let radius: number;
      const baseRadiusFactor = circleCount <= 5 ? 0.08 : 0.06;
      if (shouldGrow) {
        // Grow: larger filler circles
        radius = baseSize * (baseRadiusFactor * 1.5 + rng.next() * 0.08);
      } else {
        // Shrink: smaller filler circles
        radius = baseSize * (baseRadiusFactor * 0.7 + rng.next() * 0.05);
      }

      // Clamp radius to reasonable bounds
      const minRadius = baseSize * 0.04;
      const maxRadius = baseSize * 0.18;
      radius = Math.max(minRadius, Math.min(maxRadius, radius));

      // Apply elliptical variation - ALWAYS applied, never perfectly round
      let radiusX = radius;
      let radiusY = radius;

      // 50/50 chance for filler circles
      const flattenHorizontal = rng.next() > 0.5;
      // Flatten amount: 50-96% of original (more variation for filler circles, but never 100%)
      const flattenAmount = 0.5 + rng.next() * 0.46; // Range: 0.5 to 0.96
      if (flattenHorizontal) {
        radiusY *= flattenAmount;
      } else {
        radiusX *= flattenAmount;
      }

      // Apply stretch factors
      radiusX *= horizontalStretch;
      radiusY *= verticalStretch;

      // Place near the attachment circle with guaranteed overlap
      const angle = rng.next() * Math.PI * 2;
      const minOverlap = radius * 0.4; // 40% overlap minimum
      const maxDist = attachToCircle.radius + radius - minOverlap;
      const dist = rng.next() * maxDist * 0.7; // Use 70% of max distance for better clustering

      const newX = attachToCircle.x + Math.cos(angle) * dist * horizontalStretch;
      const newY = attachToCircle.y + Math.sin(angle) * dist * verticalStretch;

      // Clamp position to stay within bounds
      const clampedX = Math.max(margin + radius, Math.min(width - margin - radius, newX));
      const clampedY = Math.max(margin + radius, Math.min(height - margin - radius, newY));

      circles.push({
        x: clampedX,
        y: clampedY,
        radius: radius,
        radiusX: radiusX,
        radiusY: radiusY,
      });
    }
  }

  // Generate cloud texture using the circle mask
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;

      // Check if pixel is inside any circle (cloud mask)
      let insideCloud = 0;
      let closestCircleY = 0;

      for (const circle of circles) {
        const dx = x - circle.x;
        const dy = y - circle.y;

        // Use ellipse equation: (dx/radiusX)^2 + (dy/radiusY)^2 < 1
        const normalizedDistX = dx / circle.radiusX;
        const normalizedDistY = dy / circle.radiusY;
        const ellipseDist = Math.sqrt(normalizedDistX * normalizedDistX + normalizedDistY * normalizedDistY);

        if (ellipseDist < 1.0) {
          // Inside this ellipse - use soft falloff
          const falloff = 1.0 - ellipseDist;
          if (falloff > insideCloud) {
            insideCloud = falloff;
            closestCircleY = circle.y;
          }
        }
      }

      if (insideCloud > 0.15) {
        // Three-color shading: highlight at top, base in middle, shade at bottom
        // This creates natural lighting from above
        const relativeY = y - closestCircleY;

        // Add noise to break up the hard lines
        const shadeNoise = noise.fbmNormalized(x * 0.1, y * 0.1, {
          octaves: 2,
          lacunarity: 2.0,
          gain: 0.5,
        });

        // Create gradient zones with noise variation
        const noiseOffset = shadeNoise * 10 - 5; // Range: -5 to 5

        // Highlight appears at the top (negative relativeY)
        const highlightThreshold = -3 + noiseOffset;
        // Shade appears at the bottom (positive relativeY)
        const shadeThreshold = 3 + noiseOffset;

        let r: number, g: number, b: number;
        if (relativeY < highlightThreshold) {
          // Top area - use highlight color
          r = highlightColor.r;
          g = highlightColor.g;
          b = highlightColor.b;
        } else if (relativeY > shadeThreshold) {
          // Bottom area - use shade color
          r = shadeColor.r;
          g = shadeColor.g;
          b = shadeColor.b;
        } else {
          // Middle area - use base color
          r = baseColor.r;
          g = baseColor.g;
          b = baseColor.b;
        }

        data[index] = Math.floor(Math.max(0, Math.min(1, r)) * 255);
        data[index + 1] = Math.floor(Math.max(0, Math.min(1, g)) * 255);
        data[index + 2] = Math.floor(Math.max(0, Math.min(1, b)) * 255);
        data[index + 3] = 255; // Always fully opaque
      } else {
        // Outside cloud - transparent
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
