/**
 * Water 2D Material (Unlit)
 *
 * Custom THREE.js material for 2D water reflection effects WITHOUT lighting.
 * Uses custom vertex and fragment shaders for screen-space reflections.
 *
 * Features:
 * - Screen space reflections (flipped Y)
 * - Noise-based wave distortion
 * - Animated waves
 * - Foam/water surface texture
 * - Configurable water color and opacity
 * - NO lighting calculations (pure reflections + color)
 */

import * as THREE from 'three';
import type { WaterUniforms, WaterMaterialOptions } from './water-shader-utils.js';
import {
  createWaterUniforms,
  waterVertexShader,
  waterFragmentCommon,
  waterFragmentUnlit,
  updateWaterUniforms,
} from './water-shader-utils.js';

/**
 * Water 2D Material (Unlit variant)
 *
 * A custom THREE.ShaderMaterial for 2D water reflection effects without lighting.
 * Uses screen-space reflections and noise-based wave distortion.
 *
 * @example
 * ```typescript
 * const material = new Water2DMaterial({
 *   waterColor: new THREE.Vector4(0.26, 0.23, 0.73, 1.0),
 *   waterOpacity: 0.35,
 * });
 * material.setScreenTexture(capturedScreen);
 * material.setNoiseTextures(distortionNoise, foamNoise);
 * const mesh = new THREE.Mesh(geometry, material);
 * ```
 */
export class Water2DMaterial extends THREE.ShaderMaterial {
  /**
   * Custom uniforms for water rendering
   */
  declare uniforms: WaterUniforms;

  constructor(options: WaterMaterialOptions = {}) {
    const customUniforms = createWaterUniforms(options);

    super({
      uniforms: customUniforms,
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentCommon + waterFragmentUnlit,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      lights: false, // NO lighting
    });
  }

  /**
   * Update water properties from component data
   */
  updateFromData(
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
    updateWaterUniforms(this.uniforms, data, time, resolution);
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
