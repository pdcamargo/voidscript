/**
 * Water Sprite Material
 *
 * @deprecated Use Water2DMaterial (unlit) or LitWater2DMaterial (lit) instead.
 * This class will be removed in a future version.
 *
 * Migration:
 * ```typescript
 * // Old (deprecated):
 * const material = new WaterSpriteMaterial({
 *   screenTexture: capturedScreen,
 *   noiseTexture: noise1,
 *   noiseTexture2: noise2,
 *   waterColor: new THREE.Vector4(0.26, 0.23, 0.73, 1.0),
 *   waterOpacity: 0.35,
 * });
 *
 * // New (unlit):
 * const material = new Water2DMaterial({
 *   waterColor: new THREE.Vector4(0.26, 0.23, 0.73, 1.0),
 *   waterOpacity: 0.35,
 * });
 * material.setScreenTexture(capturedScreen);
 * material.setNoiseTextures(noise1, noise2);
 *
 * // New (lit - foam and water color respond to ambient light):
 * const material = new LitWater2DMaterial({
 *   waterColor: new THREE.Vector4(0.26, 0.23, 0.73, 1.0),
 *   waterOpacity: 0.35,
 * });
 * material.setScreenTexture(capturedScreen);
 * material.setNoiseTextures(noise1, noise2);
 * ```
 *
 * Custom THREE.js material for 2D water reflection effects.
 * Uses custom vertex and fragment shaders for screen-space reflections.
 *
 * Features:
 * - Screen space reflections (flipped Y)
 * - Noise-based wave distortion
 * - Animated waves
 * - Foam/water surface texture
 * - Configurable water color and opacity
 */

import * as THREE from 'three';

/**
 * Vertex shader for water 2D effect
 *
 * Passes UV coordinates and calculates screen-space position
 * for sampling the screen texture.
 */
const water2DVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec4 vScreenPosition;
varying float vWaterCenterScreenY;

uniform float waterWorldY;
uniform float waterHeight;

void main() {
  vUv = uv;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Store clip-space position for screen UV calculation
  vScreenPosition = gl_Position;

  // Calculate water center's screen Y position for auto-offset
  // Transform water center (world Y) to clip space
  vec4 waterCenterWorld = vec4(0.0, waterWorldY, 0.0, 1.0);
  vec4 waterCenterClip = projectionMatrix * viewMatrix * waterCenterWorld;
  // Convert to normalized screen coordinates (0 to 1)
  vWaterCenterScreenY = (waterCenterClip.y / waterCenterClip.w) * 0.5 + 0.5;
}
`;

/**
 * Fragment shader for water 2D effect
 *
 * Implements:
 * - Level-based water area masking
 * - Noise-based wave distortion
 * - Screen texture sampling with Y-flip for reflection
 * - Foam pattern from second noise texture
 * - Color blending
 * - Ambient lighting for surface effects only
 */
const water2DFragmentShader = /* glsl */ `
// Ambient light uniform (from THREE.js lighting system)
uniform vec3 ambientLightColor;

uniform float time;
uniform float level;
uniform vec4 waterColor;
uniform float waterOpacity;
uniform float waveSpeed;
uniform float waveDistortion;
uniform float waveMultiplier;
uniform bool enableWaterTexture;
uniform float reflectionOffsetX;
uniform float reflectionOffsetY;
uniform sampler2D noiseTexture;
uniform sampler2D noiseTexture2;
uniform sampler2D screenTexture;
uniform vec2 resolution;
uniform float waterWidth;
uniform float waterHeight;

varying vec2 vUv;
varying vec4 vScreenPosition;
varying float vWaterCenterScreenY;

void main() {
  vec2 uv = vUv;

  // Only render below the water level (level=0.5 means water starts at middle)
  if (uv.y < level) {
    discard;
  }

  // Calculate screen UV from clip space position
  vec2 screenUv = vScreenPosition.xy / vScreenPosition.w * 0.5 + 0.5;

  // Wave distortion using noise texture
  // Scale UV vertically for wave repetition
  vec2 waterUv = vec2(uv.x, uv.y * waveMultiplier);

  // Sample noise with time-based animation for wave movement
  float noise = texture2D(noiseTexture, vec2(waterUv.x + time * waveSpeed, waterUv.y)).r;
  noise = noise * waveDistortion - (0.5 * waveDistortion);

  // Auto-calculate reflection offset based on water's screen position
  // When Y is flipped (1.0 - screenUv.y), we need to offset by -2.0 * waterCenterScreenY
  // to make the reflection sample from the correct region above the water
  float autoOffsetY = -2.0 * vWaterCenterScreenY;

  // Calculate reflected UV coordinates
  // Flip Y for reflection effect, apply auto-offset + manual offset
  vec2 reflectedUv = vec2(
    screenUv.x + noise + reflectionOffsetX,
    1.0 - screenUv.y + autoOffsetY + reflectionOffsetY
  );

  // Clamp to prevent sampling outside screen bounds
  reflectedUv = clamp(reflectedUv, 0.001, 0.999);

  // Sample the screen texture for reflection
  // NOTE: Reflection already contains lighting from the reflected scene
  vec4 reflectionColor = texture2D(screenTexture, reflectedUv);

  // Start with reflection as base (unaffected by lighting)
  vec4 color = reflectionColor;

  // Use ambient light color, or default to white if no lights (prevents dark water)
  vec3 lightColor = max(ambientLightColor, vec3(1.0, 1.0, 1.0));

  // Foam/water texture pattern (optional) - add on top of reflection
  // Apply ambient lighting to foam (it's a surface effect)
  if (enableWaterTexture) {
    // Create horizontal line-like foam by using different X/Y scaling
    // X divisor controls line spacing, Y divisor controls line thickness
    float waterTextureLimit = 0.25;
    vec2 foamUv = uv * vec2(waterWidth / 300.0, waterHeight / 80.0);
    vec4 waterTex = texture2D(noiseTexture2, foamUv + vec2(noise, 0.0));
    float waterTextureValue = waterTex.r < waterTextureLimit ? 1.0 : 0.0;
    // Blend foam with reflection, modulated by light
    vec3 foamColor = vec3(1.0) * lightColor;
    color.rgb = mix(color.rgb, foamColor, waterTextureValue * 0.22);
  }

  // Apply water color tint, modulated by light
  vec4 litWaterColor = vec4(waterColor.rgb * lightColor, waterColor.a);
  color = mix(color, litWaterColor, waterOpacity);

  gl_FragColor = color;
}
`;

/**
 * Shader uniform interface for Water2D material
 */
export interface WaterSpriteUniforms {
  [key: string]: THREE.IUniform<unknown>;
  time: THREE.IUniform<number>;
  level: THREE.IUniform<number>;
  waterColor: THREE.IUniform<THREE.Vector4>;
  waterOpacity: THREE.IUniform<number>;
  waveSpeed: THREE.IUniform<number>;
  waveDistortion: THREE.IUniform<number>;
  waveMultiplier: THREE.IUniform<number>;
  enableWaterTexture: THREE.IUniform<boolean>;
  reflectionOffsetX: THREE.IUniform<number>;
  reflectionOffsetY: THREE.IUniform<number>;
  noiseTexture: THREE.IUniform<THREE.Texture | null>;
  noiseTexture2: THREE.IUniform<THREE.Texture | null>;
  screenTexture: THREE.IUniform<THREE.Texture | null>;
  resolution: THREE.IUniform<THREE.Vector2>;
  waterWorldY: THREE.IUniform<number>;
  waterHeight: THREE.IUniform<number>;
  waterWidth: THREE.IUniform<number>;
}

/**
 * Options for creating a WaterSpriteMaterial
 */
export interface WaterSpriteMaterialOptions {
  screenTexture?: THREE.Texture | null;
  noiseTexture?: THREE.Texture | null;
  noiseTexture2?: THREE.Texture | null;
  waterColor?: THREE.Vector4;
  waterOpacity?: number;
  level?: number;
  waveSpeed?: number;
  waveDistortion?: number;
  waveMultiplier?: number;
  enableWaterTexture?: boolean;
  reflectionOffsetX?: number;
  reflectionOffsetY?: number;
}

/**
 * Water Sprite Material
 *
 * @deprecated Use Water2DMaterial or LitWater2DMaterial instead.
 *
 * A custom THREE.ShaderMaterial for 2D water reflection effects.
 * Uses screen-space reflections and noise-based wave distortion.
 *
 * @example
 * ```typescript
 * const material = new WaterSpriteMaterial({
 *   screenTexture: capturedScreen,
 *   noiseTexture: distortionNoise,
 *   noiseTexture2: foamNoise,
 *   waterColor: new THREE.Vector4(0.26, 0.23, 0.73, 1.0),
 *   waterOpacity: 0.35,
 * });
 * const mesh = new THREE.Mesh(geometry, material);
 * ```
 */
export class WaterSpriteMaterial extends THREE.ShaderMaterial {
  /**
   * Custom uniforms for water rendering
   */
  declare uniforms: WaterSpriteUniforms;

  constructor(options: WaterSpriteMaterialOptions = {}) {
    const customUniforms = {
      time: { value: 0 },
      level: { value: options.level ?? 0.5 },
      waterColor: { value: options.waterColor ?? new THREE.Vector4(0.26, 0.23, 0.73, 1.0) },
      waterOpacity: { value: options.waterOpacity ?? 0.35 },
      waveSpeed: { value: options.waveSpeed ?? 0.05 },
      waveDistortion: { value: options.waveDistortion ?? 0.2 },
      waveMultiplier: { value: options.waveMultiplier ?? 7 },
      enableWaterTexture: { value: options.enableWaterTexture ?? true },
      reflectionOffsetX: { value: options.reflectionOffsetX ?? 0.0 },
      reflectionOffsetY: { value: options.reflectionOffsetY ?? 0.0 },
      noiseTexture: { value: options.noiseTexture ?? null },
      noiseTexture2: { value: options.noiseTexture2 ?? null },
      screenTexture: { value: options.screenTexture ?? null },
      resolution: { value: new THREE.Vector2(1, 1) },
      waterWorldY: { value: 0 },
      waterHeight: { value: 10 },
      waterWidth: { value: 10 },
    };

    // Merge with THREE.js lighting uniforms (provides ambientLightColor)
    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.lights,
      customUniforms,
    ]) as WaterSpriteUniforms;

    super({
      uniforms,
      vertexShader: water2DVertexShader,
      fragmentShader: water2DFragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      lights: true, // Enable THREE.js lighting system for ambientLightColor
    });
  }

  /**
   * Update water properties from component data
   */
  updateFromData(
    data: {
      level: number;
      waterColor: { r: number; g: number; b: number; a: number };
      waterOpacity: number;
      waveSpeed: number;
      waveDistortion: number;
      waveMultiplier: number;
      enableWaterTexture: boolean;
      reflectionOffsetX: number;
      reflectionOffsetY: number;
      width: number;
      height: number;
    },
    time: number,
    resolution: { width: number; height: number },
    waterWorldY: number,
  ): void {
    this.uniforms.time.value = time;
    this.uniforms.level.value = data.level;
    this.uniforms.waterColor.value.set(
      data.waterColor.r,
      data.waterColor.g,
      data.waterColor.b,
      data.waterColor.a,
    );
    this.uniforms.waterOpacity.value = data.waterOpacity;
    this.uniforms.waveSpeed.value = data.waveSpeed;
    this.uniforms.waveDistortion.value = data.waveDistortion;
    this.uniforms.waveMultiplier.value = data.waveMultiplier;
    this.uniforms.enableWaterTexture.value = data.enableWaterTexture;
    this.uniforms.reflectionOffsetX.value = data.reflectionOffsetX;
    this.uniforms.reflectionOffsetY.value = data.reflectionOffsetY;
    this.uniforms.resolution.value.set(resolution.width, resolution.height);
    this.uniforms.waterWorldY.value = waterWorldY;
    this.uniforms.waterHeight.value = data.height;
    this.uniforms.waterWidth.value = data.width;
  }

  /**
   * Set the screen texture (for reflections)
   */
  setScreenTexture(texture: THREE.Texture | null): void {
    this.uniforms.screenTexture.value = texture;
  }

  /**
   * Set noise textures (for wave distortion)
   */
  setNoiseTextures(noiseTexture: THREE.Texture, noiseTexture2: THREE.Texture): void {
    this.uniforms.noiseTexture.value = noiseTexture;
    this.uniforms.noiseTexture2.value = noiseTexture2;
  }

  /**
   * Update elapsed time (for wave animation)
   */
  setTime(time: number): void {
    this.uniforms.time.value = time;
  }
}
