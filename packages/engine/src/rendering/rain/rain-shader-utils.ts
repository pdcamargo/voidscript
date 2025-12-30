/**
 * Rain Shader Utilities
 *
 * Shared utilities for Rain2D materials.
 * Contains uniform definitions, shader fragments, and helper functions.
 *
 * Key features:
 * - World-space tiling (vTiledUv) to prevent stretching on large areas
 * - Hash-based procedural droplet generation for pixel-art style
 * - Multi-layer depth rendering (near/mid/far)
 * - Lightning flash overlay
 *
 * TODO: Migrate to VoidShader Language (VSL)
 * This shader can be rewritten as a .vsl file using the new shader system.
 * See packages/engine/src/shader/built-in-shaders/ for examples.
 * Migration benefits: Better tooling, uniform hints for editor, shader library includes.
 */

import * as THREE from 'three';

/**
 * Rain material uniforms interface
 */
export interface RainUniforms {
  [key: string]: THREE.IUniform<unknown>;
  time: THREE.IUniform<number>;

  // Size and tiling
  meshWorldScale: THREE.IUniform<THREE.Vector2>;
  tileSize: THREE.IUniform<number>;

  // Droplet properties
  density: THREE.IUniform<number>;
  fallSpeed: THREE.IUniform<number>;
  speedVariation: THREE.IUniform<number>;
  angle: THREE.IUniform<number>;
  windStrength: THREE.IUniform<number>;
  windSpeed: THREE.IUniform<number>;
  dropletMinLength: THREE.IUniform<number>;
  dropletMaxLength: THREE.IUniform<number>;
  dropletWidth: THREE.IUniform<number>;
  seed: THREE.IUniform<number>;
  dropletColor: THREE.IUniform<THREE.Vector3>;
  dropletOpacity: THREE.IUniform<number>;

  // Multi-layer depth
  enableLayers: THREE.IUniform<boolean>;
  nearLayerSpeed: THREE.IUniform<number>;
  nearLayerOpacity: THREE.IUniform<number>;
  nearLayerScale: THREE.IUniform<number>;
  midLayerSpeed: THREE.IUniform<number>;
  midLayerOpacity: THREE.IUniform<number>;
  midLayerScale: THREE.IUniform<number>;
  farLayerSpeed: THREE.IUniform<number>;
  farLayerOpacity: THREE.IUniform<number>;
  farLayerScale: THREE.IUniform<number>;

  // Wetness tint
  enableWetnessTint: THREE.IUniform<boolean>;
  wetnessTintColor: THREE.IUniform<THREE.Vector3>;
  wetnessTintIntensity: THREE.IUniform<number>;

  // Lightning
  enableLightning: THREE.IUniform<boolean>;
  lightningColor: THREE.IUniform<THREE.Vector3>;
  lightningFlashActive: THREE.IUniform<number>;
  lightningIntensity: THREE.IUniform<number>;

  // Storm intensity
  stormIntensity: THREE.IUniform<number>;
}

/**
 * Options for creating rain materials
 */
export interface RainMaterialOptions {
  density?: number;
  fallSpeed?: number;
  speedVariation?: number;
  angle?: number;
  windStrength?: number;
  windSpeed?: number;
  dropletMinLength?: number;
  dropletMaxLength?: number;
  dropletWidth?: number;
  seed?: number;
  dropletColor?: THREE.Vector3;
  dropletOpacity?: number;
  enableLayers?: boolean;
  nearLayerSpeed?: number;
  nearLayerOpacity?: number;
  nearLayerScale?: number;
  midLayerSpeed?: number;
  midLayerOpacity?: number;
  midLayerScale?: number;
  farLayerSpeed?: number;
  farLayerOpacity?: number;
  farLayerScale?: number;
  enableWetnessTint?: boolean;
  wetnessTintColor?: THREE.Vector3;
  wetnessTintIntensity?: number;
  enableLightning?: boolean;
  lightningColor?: THREE.Vector3;
  lightningIntensity?: number;
  stormIntensity?: number;
}

/**
 * Create rain uniforms with default values
 */
export function createRainUniforms(
  options: RainMaterialOptions = {},
): RainUniforms {
  return {
    time: { value: 0 },

    // Size and tiling
    meshWorldScale: { value: new THREE.Vector2(1, 1) },
    tileSize: { value: 50 },

    // Droplet properties
    density: { value: options.density ?? 150 },
    fallSpeed: { value: options.fallSpeed ?? 800 },
    speedVariation: { value: options.speedVariation ?? 0.3 },
    angle: { value: options.angle ?? 0 },
    windStrength: { value: options.windStrength ?? 0 },
    windSpeed: { value: options.windSpeed ?? 1.0 },
    dropletMinLength: { value: options.dropletMinLength ?? 3 },
    dropletMaxLength: { value: options.dropletMaxLength ?? 8 },
    dropletWidth: { value: options.dropletWidth ?? 1 },
    seed: { value: options.seed ?? 0 },
    dropletColor: {
      value: options.dropletColor ?? new THREE.Vector3(0.7, 0.8, 0.9),
    },
    dropletOpacity: { value: options.dropletOpacity ?? 0.6 },

    // Multi-layer depth
    enableLayers: { value: options.enableLayers ?? true },
    nearLayerSpeed: { value: options.nearLayerSpeed ?? 1.5 },
    nearLayerOpacity: { value: options.nearLayerOpacity ?? 0.8 },
    nearLayerScale: { value: options.nearLayerScale ?? 1.3 },
    midLayerSpeed: { value: options.midLayerSpeed ?? 1.0 },
    midLayerOpacity: { value: options.midLayerOpacity ?? 0.5 },
    midLayerScale: { value: options.midLayerScale ?? 1.0 },
    farLayerSpeed: { value: options.farLayerSpeed ?? 0.6 },
    farLayerOpacity: { value: options.farLayerOpacity ?? 0.3 },
    farLayerScale: { value: options.farLayerScale ?? 0.7 },

    // Wetness tint
    enableWetnessTint: { value: options.enableWetnessTint ?? false },
    wetnessTintColor: {
      value: options.wetnessTintColor ?? new THREE.Vector3(0.4, 0.5, 0.6),
    },
    wetnessTintIntensity: { value: options.wetnessTintIntensity ?? 0.1 },

    // Lightning
    enableLightning: { value: options.enableLightning ?? false },
    lightningColor: {
      value: options.lightningColor ?? new THREE.Vector3(1.0, 1.0, 1.0),
    },
    lightningFlashActive: { value: 0 },
    lightningIntensity: { value: options.lightningIntensity ?? 0.8 },

    // Storm intensity
    stormIntensity: { value: options.stormIntensity ?? 1.0 },
  };
}

/**
 * Vertex shader for rain 2D effect
 *
 * Uses world-space tiling to prevent stretching on large areas.
 * Same pattern as water-2d for consistent behavior.
 */
export const rainVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec2 vTiledUv;

uniform vec2 meshWorldScale;
uniform float tileSize;

void main() {
  vUv = uv;
  // Pre-multiply UVs by normalized world scale for tiling
  // This ensures rain pattern density is consistent regardless of quad size
  vTiledUv = uv * (meshWorldScale / tileSize);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Fragment shader for rain 2D effect
 *
 * Features:
 * - Hash-based procedural droplet generation
 * - Grid-based distribution for even coverage
 * - Hard-edged rectangles for pixel-art style
 * - Multi-layer depth (near/mid/far)
 * - Wind and angle effects
 * - Lightning flash overlay
 * - Wetness tint
 */
export const rainFragmentShader = /* glsl */ `
varying vec2 vUv;
varying vec2 vTiledUv;

uniform float time;

// Droplet properties
uniform float density;
uniform float fallSpeed;
uniform float speedVariation;
uniform float angle;
uniform float windStrength;
uniform float windSpeed;
uniform float dropletMinLength;
uniform float dropletMaxLength;
uniform float dropletWidth;
uniform float seed;
uniform vec3 dropletColor;
uniform float dropletOpacity;

// Multi-layer depth
uniform bool enableLayers;
uniform float nearLayerSpeed;
uniform float nearLayerOpacity;
uniform float nearLayerScale;
uniform float midLayerSpeed;
uniform float midLayerOpacity;
uniform float midLayerScale;
uniform float farLayerSpeed;
uniform float farLayerOpacity;
uniform float farLayerScale;

// Wetness tint
uniform bool enableWetnessTint;
uniform vec3 wetnessTintColor;
uniform float wetnessTintIntensity;

// Lightning
uniform bool enableLightning;
uniform vec3 lightningColor;
uniform float lightningFlashActive;
uniform float lightningIntensity;

// Storm intensity
uniform float stormIntensity;

// Hash function for deterministic random values (1D output)
float hash12(vec2 p, float s) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
  p3 += dot(p3, p3.yzx + 19.19 + s);
  return fract((p3.x + p3.y) * p3.z);
}

// Hash function for deterministic random values (2D output)
vec2 hash22(vec2 p, float s) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
  p3 += dot(p3, p3.yzx + 19.19 + s);
  return fract(vec2((p3.x + p3.y) * p3.z, (p3.y + p3.z) * p3.x));
}

// Generate rain droplets for a single layer
float generateRainLayer(
  vec2 tiledUv,
  float layerSeed,
  float speedMult,
  float scaleMult,
  float opacity
) {
  // Calculate grid size based on density
  // Higher density = smaller grid = more droplets
  float gridSize = 1.0 / sqrt(density * 0.01);

  // Apply time-based animation (falling motion)
  float fallOffset = time * fallSpeed * speedMult * 0.001;
  vec2 animatedUv = tiledUv;
  animatedUv.y += fallOffset;

  // Apply wind angle with oscillation
  float effectiveAngle = angle + sin(time * windSpeed) * windStrength;
  animatedUv.x += animatedUv.y * tan(effectiveAngle);

  // Grid-based droplet placement
  vec2 gridUv = animatedUv / gridSize;
  vec2 gridId = floor(gridUv);
  vec2 gridFrac = fract(gridUv);

  float rainValue = 0.0;

  // Check 3x3 neighborhood for droplets that might overlap current pixel
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighborId = gridId + vec2(float(x), float(y));

      // Determine if this cell has a droplet (probability based)
      float hasDroplet = hash12(neighborId, seed + layerSeed);
      if (hasDroplet > 0.3) continue; // 30% chance per cell

      // Get droplet position within cell (0-1)
      vec2 dropletPos = hash22(neighborId, seed + layerSeed + 1.0);
      vec2 dropletWorld = neighborId + dropletPos;

      // Distance from current pixel to droplet center
      vec2 diff = gridUv - dropletWorld;

      // Droplet dimensions (elongated rectangle for rain streak)
      float dropletLengthRand = hash12(neighborId, seed + layerSeed + 2.0);
      float dropLength = mix(dropletMinLength, dropletMaxLength, dropletLengthRand) * scaleMult * 0.01;
      float dropWidth = dropletWidth * scaleMult * 0.005;

      // Speed variation per droplet
      float speedVar = hash12(neighborId, seed + layerSeed + 3.0);
      float individualSpeed = 1.0 + (speedVar - 0.5) * speedVariation;

      // Adjust y position for individual speed variation
      float yOffset = fallOffset * (individualSpeed - 1.0);
      diff.y += yOffset * 0.1;

      // Pixel-art style: hard-edged rectangle using step()
      float inX = step(abs(diff.x), dropWidth * 0.5);
      float inY = step(abs(diff.y), dropLength * 0.5);

      // Droplet intensity based on random brightness
      float brightness = hash12(neighborId, seed + layerSeed + 4.0) * 0.3 + 0.7;

      rainValue += inX * inY * brightness * opacity;
    }
  }

  return clamp(rainValue, 0.0, 1.0);
}

void main() {
  float totalRain = 0.0;

  if (enableLayers) {
    // Near layer (fastest, largest, most opaque)
    totalRain += generateRainLayer(
      vTiledUv,
      0.0,
      nearLayerSpeed,
      nearLayerScale,
      nearLayerOpacity
    );

    // Mid layer (medium) - offset UV for variety
    totalRain += generateRainLayer(
      vTiledUv * 1.3 + vec2(0.5, 0.3),
      100.0,
      midLayerSpeed,
      midLayerScale,
      midLayerOpacity
    );

    // Far layer (slowest, smallest, most transparent)
    totalRain += generateRainLayer(
      vTiledUv * 1.6 + vec2(0.2, 0.7),
      200.0,
      farLayerSpeed,
      farLayerScale,
      farLayerOpacity
    );
  } else {
    // Single layer mode
    totalRain = generateRainLayer(
      vTiledUv,
      0.0,
      1.0,
      1.0,
      dropletOpacity
    );
  }

  // Apply storm intensity multiplier
  totalRain *= stormIntensity;

  // Base rain color with alpha
  vec3 color = dropletColor;
  float alpha = totalRain * dropletOpacity;

  // Apply wetness tint (subtle color overlay)
  if (enableWetnessTint && wetnessTintIntensity > 0.0) {
    // Wetness tint affects the entire quad subtly
    float wetnessFactor = wetnessTintIntensity * stormIntensity;
    color = mix(color, wetnessTintColor, wetnessFactor * 0.5);
    // Add slight base alpha for wetness overlay
    alpha = max(alpha, wetnessFactor * 0.1);
  }

  // Apply lightning flash
  if (enableLightning && lightningFlashActive > 0.0) {
    float flashStrength = lightningFlashActive * lightningIntensity;
    color = mix(color, lightningColor, flashStrength);
    // Boost alpha during flash for screen-wide effect
    alpha = max(alpha, flashStrength * 0.4);
  }

  gl_FragColor = vec4(color, alpha);
}
`;

/**
 * Update rain material uniforms from component data
 */
export function updateRainUniforms(
  uniforms: RainUniforms,
  data: {
    density: number;
    fallSpeed: number;
    speedVariation: number;
    angle: number;
    windStrength: number;
    windSpeed: number;
    dropletMinLength: number;
    dropletMaxLength: number;
    dropletWidth: number;
    seed: number;
    dropletColor: { r: number; g: number; b: number };
    dropletOpacity: number;
    enableLayers: boolean;
    nearLayerSpeed: number;
    nearLayerOpacity: number;
    nearLayerScale: number;
    midLayerSpeed: number;
    midLayerOpacity: number;
    midLayerScale: number;
    farLayerSpeed: number;
    farLayerOpacity: number;
    farLayerScale: number;
    enableWetnessTint: boolean;
    wetnessTintColor: { r: number; g: number; b: number };
    wetnessTintIntensity: number;
    enableLightning: boolean;
    lightningColor: { r: number; g: number; b: number };
    lightningIntensity: number;
    stormIntensity: number;
    tileSize: number;
  },
  time: number,
  meshWorldScale?: { x: number; y: number },
): void {
  uniforms.time.value = time;
  uniforms.tileSize.value = data.tileSize;

  // Droplet properties
  uniforms.density.value = data.density;
  uniforms.fallSpeed.value = data.fallSpeed;
  uniforms.speedVariation.value = data.speedVariation;
  uniforms.angle.value = data.angle;
  uniforms.windStrength.value = data.windStrength;
  uniforms.windSpeed.value = data.windSpeed;
  uniforms.dropletMinLength.value = data.dropletMinLength;
  uniforms.dropletMaxLength.value = data.dropletMaxLength;
  uniforms.dropletWidth.value = data.dropletWidth;
  uniforms.seed.value = data.seed;
  uniforms.dropletColor.value.set(
    data.dropletColor.r,
    data.dropletColor.g,
    data.dropletColor.b,
  );
  uniforms.dropletOpacity.value = data.dropletOpacity;

  // Multi-layer depth
  uniforms.enableLayers.value = data.enableLayers;
  uniforms.nearLayerSpeed.value = data.nearLayerSpeed;
  uniforms.nearLayerOpacity.value = data.nearLayerOpacity;
  uniforms.nearLayerScale.value = data.nearLayerScale;
  uniforms.midLayerSpeed.value = data.midLayerSpeed;
  uniforms.midLayerOpacity.value = data.midLayerOpacity;
  uniforms.midLayerScale.value = data.midLayerScale;
  uniforms.farLayerSpeed.value = data.farLayerSpeed;
  uniforms.farLayerOpacity.value = data.farLayerOpacity;
  uniforms.farLayerScale.value = data.farLayerScale;

  // Wetness tint
  uniforms.enableWetnessTint.value = data.enableWetnessTint;
  uniforms.wetnessTintColor.value.set(
    data.wetnessTintColor.r,
    data.wetnessTintColor.g,
    data.wetnessTintColor.b,
  );
  uniforms.wetnessTintIntensity.value = data.wetnessTintIntensity;

  // Lightning
  uniforms.enableLightning.value = data.enableLightning;
  uniforms.lightningColor.value.set(
    data.lightningColor.r,
    data.lightningColor.g,
    data.lightningColor.b,
  );
  uniforms.lightningIntensity.value = data.lightningIntensity;

  // Storm intensity
  uniforms.stormIntensity.value = data.stormIntensity;

  // Mesh world scale for texture tiling
  if (meshWorldScale) {
    uniforms.meshWorldScale.value.set(meshWorldScale.x, meshWorldScale.y);
  }
}
