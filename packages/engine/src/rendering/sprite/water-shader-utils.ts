/**
 * Water Shader Utilities
 *
 * Shared utilities for Water2D materials to avoid code duplication.
 * Contains uniform definitions, shader fragments, and helper functions.
 */

import * as THREE from 'three';

/**
 * Water material uniforms interface
 */
export interface WaterUniforms {
  [key: string]: THREE.IUniform<unknown>;
  time: THREE.IUniform<number>;
  surfacePosition: THREE.IUniform<number>;
  waterColor: THREE.IUniform<THREE.Vector4>;
  waterOpacity: THREE.IUniform<number>;
  waveSpeed: THREE.IUniform<number>;
  waveDistortion: THREE.IUniform<number>;
  waveMultiplier: THREE.IUniform<number>;
  enableWaterTexture: THREE.IUniform<boolean>;
  foamScale: THREE.IUniform<THREE.Vector2>;
  foamSpeed: THREE.IUniform<number>;
  foamIntensity: THREE.IUniform<number>;
  foamThreshold: THREE.IUniform<number>;
  reflectionOffsetX: THREE.IUniform<number>;
  reflectionOffsetY: THREE.IUniform<number>;
  noiseTexture: THREE.IUniform<THREE.Texture | null>;
  noiseTexture2: THREE.IUniform<THREE.Texture | null>;
  screenTexture: THREE.IUniform<THREE.Texture | null>;
  resolution: THREE.IUniform<THREE.Vector2>;
  // Screen-space bounds of the water mesh (set in onBeforeRender)
  waterScreenBounds: THREE.IUniform<THREE.Vector4>; // minX, minY, maxX, maxY in screen UV space
  // Wetness system uniforms
  wetnessIntensity: THREE.IUniform<number>;
  wetnessOpacity: THREE.IUniform<number>;
  wetnessScale: THREE.IUniform<THREE.Vector2>;
  wetnessSpeed: THREE.IUniform<number>;
  wetnessDetailScale: THREE.IUniform<THREE.Vector2>;
  wetnessDetailSpeed: THREE.IUniform<number>;
  wetnessContrast: THREE.IUniform<number>;
  wetnessBrightness: THREE.IUniform<number>;
  wetnessColorTint: THREE.IUniform<THREE.Vector3>;
  foamSoftness: THREE.IUniform<number>;
  foamTurbulence: THREE.IUniform<number>;
  foamAnimationSpeed: THREE.IUniform<number>;
  foamLayerCount: THREE.IUniform<number>;
}

/**
 * Options for creating water materials
 */
export interface WaterMaterialOptions {
  screenTexture?: THREE.Texture | null;
  noiseTexture?: THREE.Texture | null;
  noiseTexture2?: THREE.Texture | null;
  waterColor?: THREE.Vector4;
  waterOpacity?: number;
  surfacePosition?: number;
  waveSpeed?: number;
  waveDistortion?: number;
  waveMultiplier?: number;
  enableWaterTexture?: boolean;
  foamScale?: THREE.Vector2;
  foamSpeed?: number;
  foamIntensity?: number;
  foamThreshold?: number;
  reflectionOffsetX?: number;
  reflectionOffsetY?: number;
  wetnessIntensity?: number;
  wetnessOpacity?: number;
  wetnessScale?: THREE.Vector2;
  wetnessSpeed?: number;
  wetnessDetailScale?: THREE.Vector2;
  wetnessDetailSpeed?: number;
  wetnessContrast?: number;
  wetnessBrightness?: number;
  wetnessColorTint?: THREE.Vector3;
  foamSoftness?: number;
  foamTurbulence?: number;
  foamAnimationSpeed?: number;
  foamLayerCount?: number;
}

/**
 * Create water uniforms with default values
 */
export function createWaterUniforms(options: WaterMaterialOptions = {}): WaterUniforms {
  return {
    time: { value: 0 },
    surfacePosition: { value: options.surfacePosition ?? 0.0 },
    waterColor: { value: options.waterColor ?? new THREE.Vector4(0.26, 0.23, 0.73, 1.0) },
    waterOpacity: { value: options.waterOpacity ?? 0.25 },
    waveSpeed: { value: options.waveSpeed ?? 0.05 },
    waveDistortion: { value: options.waveDistortion ?? 0.2 },
    waveMultiplier: { value: options.waveMultiplier ?? 7 },
    enableWaterTexture: { value: options.enableWaterTexture ?? true },
    foamScale: { value: options.foamScale ?? new THREE.Vector2(3, 8) },
    foamSpeed: { value: options.foamSpeed ?? 0.02 },
    foamIntensity: { value: options.foamIntensity ?? 0.22 },
    foamThreshold: { value: options.foamThreshold ?? 0.25 },
    reflectionOffsetX: { value: options.reflectionOffsetX ?? 0.0 },
    reflectionOffsetY: { value: options.reflectionOffsetY ?? 0.0 },
    noiseTexture: { value: options.noiseTexture ?? null },
    noiseTexture2: { value: options.noiseTexture2 ?? null },
    screenTexture: { value: options.screenTexture ?? null },
    resolution: { value: new THREE.Vector2(1, 1) },
    waterScreenBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
    wetnessIntensity: { value: options.wetnessIntensity ?? 0.45 },
    wetnessOpacity: { value: options.wetnessOpacity ?? 1.0 },
    wetnessScale: { value: options.wetnessScale ?? new THREE.Vector2(8, 12) },
    wetnessSpeed: { value: options.wetnessSpeed ?? 0.03 },
    wetnessDetailScale: { value: options.wetnessDetailScale ?? new THREE.Vector2(20, 30) },
    wetnessDetailSpeed: { value: options.wetnessDetailSpeed ?? 0.015 },
    wetnessContrast: { value: options.wetnessContrast ?? 1.2 },
    wetnessBrightness: { value: options.wetnessBrightness ?? 0.1 },
    wetnessColorTint: { value: options.wetnessColorTint ?? new THREE.Vector3(0.9, 0.95, 1.0) },
    foamSoftness: { value: options.foamSoftness ?? 1.0 },
    foamTurbulence: { value: options.foamTurbulence ?? 0.3 },
    foamAnimationSpeed: { value: options.foamAnimationSpeed ?? 0.5 },
    foamLayerCount: { value: options.foamLayerCount ?? 2 },
  };
}

/**
 * Vertex shader for water 2D effect
 * Used by both lit and unlit materials
 *
 * Simple screen-space reflection using clip position.
 */
export const waterVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec4 vClipPos;

void main() {
  vUv = uv;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Pass clip position to fragment shader for screen UV calculation
  vClipPos = gl_Position;
}
`;

/**
 * Fragment shader common code (shared between lit and unlit)
 * Contains varyings, uniforms, wave calculation, and reflection sampling
 *
 * Uses screen-space reflection based on water mesh bounds:
 * - waterScreenBounds contains the water mesh's screen-space bounds (minX, minY, maxX, maxY)
 * - For each water pixel, we map its UV to the corresponding position ABOVE the water
 * - The reflection samples from above the water surface in screen space
 */
export const waterFragmentCommon = /* glsl */ `
varying vec2 vUv;
varying vec4 vClipPos;

uniform float time;
uniform float surfacePosition;
uniform vec4 waterColor;
uniform float waterOpacity;
uniform float waveSpeed;
uniform float waveDistortion;
uniform float waveMultiplier;
uniform bool enableWaterTexture;
uniform vec2 foamScale;
uniform float foamSpeed;
uniform float foamIntensity;
uniform float foamThreshold;
uniform float reflectionOffsetX;
uniform float reflectionOffsetY;
uniform sampler2D noiseTexture;
uniform sampler2D noiseTexture2;
uniform sampler2D screenTexture;
uniform vec2 resolution;
uniform vec4 waterScreenBounds; // minX, minY, maxX, maxY in screen UV space (0-1)
uniform float wetnessIntensity;
uniform float wetnessOpacity;
uniform vec2 wetnessScale;
uniform float wetnessSpeed;
uniform vec2 wetnessDetailScale;
uniform float wetnessDetailSpeed;
uniform float wetnessContrast;
uniform float wetnessBrightness;
uniform vec3 wetnessColorTint;
uniform float foamSoftness;
uniform float foamTurbulence;
uniform float foamAnimationSpeed;
uniform float foamLayerCount;

void main() {
  vec2 uv = vUv;

  // Discard pixels above the surface position
  // surfacePosition = 0.0 means surface at bottom (entire quad shows water)
  // surfacePosition = 0.5 means surface at middle (top half transparent)
  // surfacePosition = 1.0 means surface at top (no water visible)
  float surfaceEdge = 1.0 - surfacePosition;
  if (uv.y > surfaceEdge) {
    discard;
  }

  // Wave distortion using noise texture
  // Scale UV vertically for wave repetition
  vec2 waterUv = vec2(uv.x, uv.y * waveMultiplier);

  // Sample noise with time-based animation for wave movement
  float noise = texture2D(noiseTexture, vec2(waterUv.x + time * waveSpeed, waterUv.y)).r;
  noise = noise * waveDistortion - (0.5 * waveDistortion);

  // Get water bounds in screen space
  float waterMinX = waterScreenBounds.x;
  float waterMinY = waterScreenBounds.y;
  float waterMaxX = waterScreenBounds.z;
  float waterMaxY = waterScreenBounds.w;
  float waterWidth = waterMaxX - waterMinX;
  float waterHeight = waterMaxY - waterMinY;

  // Calculate where this pixel is within the water (0-1)
  // uv.x goes left to right, uv.y goes bottom to top
  float pixelX = waterMinX + uv.x * waterWidth;

  // For reflection: sample from ABOVE the water surface
  // The water surface is at waterMaxY (top of water mesh)
  // A pixel at uv.y=0 (bottom of water) should sample from the highest point above
  // A pixel at uv.y=1 (top of water) should sample from just above the surface
  float distanceFromSurface = (1.0 - uv.y) * waterHeight;
  float reflectedY = waterMaxY + distanceFromSurface;

  // Reduce wave distortion intensity near the top edge
  // This prevents the reflection from trying to sample below the water surface
  float edgeFactor = smoothstep(0.0, 0.15, surfaceEdge - uv.y);
  float edgeAdjustedNoise = noise * edgeFactor;

  // Apply wave distortion and manual offset
  vec2 reflectedScreenUv = vec2(
    pixelX + edgeAdjustedNoise * 0.02 + reflectionOffsetX,
    reflectedY + edgeAdjustedNoise * 0.02 + reflectionOffsetY
  );

  // Clamp to screen bounds
  reflectedScreenUv = clamp(reflectedScreenUv, 0.001, 0.999);

  // Sample the screen texture for reflection
  vec4 reflectionColor = texture2D(screenTexture, reflectedScreenUv);

  // Start with reflection as base
  vec4 color = reflectionColor;

  // === WETNESS TEXTURE SYSTEM ===
  // Calculate multi-layer wetness effect for visible water surface texture
  float wetnessValue = 0.0;
  if (wetnessIntensity > 0.0) {
    // BASE WETNESS LAYER - Large-scale flowing patterns
    vec2 wetnessUv = uv * wetnessScale;
    wetnessUv.x += time * wetnessSpeed;
    float wetnessBase = texture2D(noiseTexture2, wetnessUv).r;

    // DETAIL WETNESS LAYER - Fine-scale variation
    vec2 detailUv = uv * wetnessDetailScale;
    detailUv.x += time * wetnessDetailSpeed;
    detailUv.y += sin(time * 0.5 + uv.x * 3.0) * 0.02; // Subtle vertical distortion
    float wetnessDetail = texture2D(noiseTexture, detailUv).r;

    // COMBINE LAYERS - Weighted blend for depth
    wetnessValue = wetnessBase * 0.7 + wetnessDetail * 0.3;

    // Apply contrast and brightness
    wetnessValue = clamp((wetnessValue - 0.5) * wetnessContrast + 0.5 + wetnessBrightness, 0.0, 1.0);
  }

  // === FOAM CALCULATION (multi-layer animated) ===
  // Calculate foam/water texture value (used by both lit and unlit variants)
  float waterTextureValue = 0.0;
  float foamValue = 0.0;
  if (enableWaterTexture) {
    float softEdge = foamSoftness * 0.01;

    // Layer 1: Static base foam (always visible, provides baseline)
    vec2 foamUv1 = uv * foamScale;
    foamUv1.x += time * foamSpeed;
    foamUv1.y += sin(time * foamSpeed * 2.0 + uv.x * 3.0) * foamTurbulence * 0.1;
    float foam1 = texture2D(noiseTexture2, foamUv1).r;
    float baseLayer = smoothstep(foamThreshold - softEdge, foamThreshold + softEdge, foam1);

    // Start with static baseline (40% of total, always visible)
    foamValue = baseLayer * 0.4;

    // Layer 2: Primary animated foam (pulsing at base speed)
    if (foamLayerCount >= 2.0) {
      vec2 foamUv2 = uv * (foamScale * 0.7);
      foamUv2.x += time * foamSpeed * 0.8;
      foamUv2.y += time * foamSpeed * foamTurbulence * 0.25;
      float foam2 = texture2D(noiseTexture2, foamUv2).r;
      float layer2 = smoothstep(foamThreshold - softEdge, foamThreshold + softEdge, foam2);

      // Pulse at base animation speed
      float pulse2 = 0.5 + abs(sin(time * foamAnimationSpeed)) * 0.5;
      foamValue += layer2 * pulse2 * 0.35;
    }

    // Layer 3: Secondary animated foam (pulsing at different phase)
    if (foamLayerCount >= 3.0) {
      vec2 foamUv3 = uv * (foamScale * 1.5);
      foamUv3.x += time * foamSpeed * 0.4;
      foamUv3.y += sin(time * foamSpeed * 1.5 + uv.x * 5.0) * foamTurbulence * 0.15;
      float foam3 = texture2D(noiseTexture2, foamUv3).r;
      float layer3 = smoothstep(foamThreshold - softEdge, foamThreshold + softEdge, foam3);

      // Pulse at offset phase (different timing than layer 2)
      float pulse3 = 0.5 + abs(sin(time * foamAnimationSpeed * 1.3 + 1.57)) * 0.5;
      foamValue += layer3 * pulse3 * 0.25;
    }

    waterTextureValue = foamValue; // Keep for compatibility
  }
`;

/**
 * Fragment shader ending for unlit water
 * Applies foam and water color WITHOUT lighting
 */
export const waterFragmentUnlit = /* glsl */ `
  // Apply water color and opacity (unlit - no lighting calculations)
  vec4 finalColor = mix(color, waterColor, waterOpacity);

  // Add foam/wetness texture on top
  if (wetnessIntensity > 0.0) {
    finalColor.rgb += wetnessColorTint * wetnessValue * wetnessIntensity * wetnessOpacity;
  }

  // Add foam on top
  finalColor.rgb = mix(finalColor.rgb, vec3(1.0), foamValue * foamIntensity);

  // Clamp to prevent bloom explosion (keep RGB in reasonable range)
  finalColor.rgb = clamp(finalColor.rgb, 0.0, 1.2);

  gl_FragColor = finalColor;
}
`;

/**
 * Fragment shader ending for lit water
 * Applies foam and water color WITH ambient lighting
 */
export const waterFragmentLit = /* glsl */ `
  // Apply ambient lighting to the reflection
  vec3 litReflection = color.rgb * ambientLightColor;

  // Apply water color and opacity WITH ambient lighting
  vec4 finalColor = mix(vec4(litReflection, color.a), waterColor, waterOpacity);

  // Add foam/wetness texture on top (also lit by ambient)
  if (wetnessIntensity > 0.0) {
    finalColor.rgb += wetnessColorTint * wetnessValue * wetnessIntensity * wetnessOpacity * ambientLightColor;
  }

  // Add foam on top (lit by ambient)
  finalColor.rgb = mix(finalColor.rgb, ambientLightColor, foamValue * foamIntensity);

  // Clamp to prevent bloom explosion (keep RGB in reasonable range)
  finalColor.rgb = clamp(finalColor.rgb, 0.0, 1.2);

  gl_FragColor = finalColor;
}
`;

/**
 * Update water material uniforms from component data
 * Shared helper function used by both materials
 */
export function updateWaterUniforms(
  uniforms: WaterUniforms,
  data: {
    surfacePosition: number;
    waterColor: { r: number; g: number; b: number; a: number };
    waterOpacity: number;
    waveSpeed: number;
    waveDistortion: number;
    waveMultiplier: number;
    enableWaterTexture: boolean;
    foamScale: { x: number; y: number };
    foamSpeed: number;
    foamIntensity: number;
    foamThreshold: number;
    reflectionOffsetX: number;
    reflectionOffsetY: number;
    wetnessIntensity: number;
    wetnessOpacity: number;
    wetnessScale: { x: number; y: number };
    wetnessSpeed: number;
    wetnessDetailScale: { x: number; y: number };
    wetnessDetailSpeed: number;
    wetnessContrast: number;
    wetnessBrightness: number;
    wetnessColorTint: { r: number; g: number; b: number };
    foamSoftness: number;
    foamTurbulence: number;
    foamAnimationSpeed: number;
    foamLayerCount: number;
  },
  time: number,
  resolution: { width: number; height: number },
): void {
  uniforms.time.value = time;
  uniforms.surfacePosition.value = data.surfacePosition;
  uniforms.waterColor.value.set(
    data.waterColor.r,
    data.waterColor.g,
    data.waterColor.b,
    data.waterColor.a,
  );
  uniforms.waterOpacity.value = data.waterOpacity;
  uniforms.waveSpeed.value = data.waveSpeed;
  uniforms.waveDistortion.value = data.waveDistortion;
  uniforms.waveMultiplier.value = data.waveMultiplier;
  uniforms.enableWaterTexture.value = data.enableWaterTexture;
  uniforms.foamScale.value.set(data.foamScale.x, data.foamScale.y);
  uniforms.foamSpeed.value = data.foamSpeed;
  uniforms.foamIntensity.value = data.foamIntensity;
  uniforms.foamThreshold.value = data.foamThreshold;
  uniforms.reflectionOffsetX.value = data.reflectionOffsetX;
  uniforms.reflectionOffsetY.value = data.reflectionOffsetY;
  uniforms.resolution.value.set(resolution.width, resolution.height);
  uniforms.wetnessIntensity.value = data.wetnessIntensity;
  uniforms.wetnessOpacity.value = data.wetnessOpacity;
  uniforms.wetnessScale.value.set(data.wetnessScale.x, data.wetnessScale.y);
  uniforms.wetnessSpeed.value = data.wetnessSpeed;
  uniforms.wetnessDetailScale.value.set(data.wetnessDetailScale.x, data.wetnessDetailScale.y);
  uniforms.wetnessDetailSpeed.value = data.wetnessDetailSpeed;
  uniforms.wetnessContrast.value = data.wetnessContrast;
  uniforms.wetnessBrightness.value = data.wetnessBrightness;
  uniforms.wetnessColorTint.value.set(
    data.wetnessColorTint.r,
    data.wetnessColorTint.g,
    data.wetnessColorTint.b,
  );
  uniforms.foamSoftness.value = data.foamSoftness;
  uniforms.foamTurbulence.value = data.foamTurbulence ?? 0.3;
  uniforms.foamAnimationSpeed.value = data.foamAnimationSpeed ?? 0.5;
  uniforms.foamLayerCount.value = data.foamLayerCount ?? 2;
}
