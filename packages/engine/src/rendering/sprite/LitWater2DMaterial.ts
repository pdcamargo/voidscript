/**
 * Lit Water 2D Material
 *
 * Custom THREE.js material for 2D water reflection effects WITH lighting.
 * Uses custom vertex and fragment shaders for screen-space reflections.
 *
 * Features:
 * - Screen space reflections (flipped Y, unlit)
 * - Noise-based wave distortion
 * - Animated waves
 * - Foam/water surface texture (lit by ambient light)
 * - Configurable water color and opacity (lit by ambient light)
 * - Ambient lighting applied to foam and water color overlay
 */

import * as THREE from 'three';
import type { WaterUniforms, WaterMaterialOptions } from './water-shader-utils.js';
import {
  createWaterUniforms,
  waterVertexShader,
  waterFragmentCommon,
  waterFragmentLit,
  updateWaterUniforms,
} from './water-shader-utils.js';

/**
 * Lit Water 2D Material
 *
 * A custom THREE.ShaderMaterial for 2D water reflection effects with lighting.
 * Uses screen-space reflections and noise-based wave distortion.
 * Foam and water color overlay respond to ambient lighting.
 *
 * @example
 * ```typescript
 * const material = new LitWater2DMaterial({
 *   waterColor: new THREE.Vector4(0.26, 0.23, 0.73, 1.0),
 *   waterOpacity: 0.35,
 * });
 * material.setScreenTexture(capturedScreen);
 * material.setNoiseTextures(distortionNoise, foamNoise);
 * const mesh = new THREE.Mesh(geometry, material);
 * ```
 */
export class LitWater2DMaterial extends THREE.ShaderMaterial {
  /**
   * Custom uniforms for water rendering
   * Includes THREE.js lighting uniforms (ambientLightColor)
   */
  declare uniforms: WaterUniforms;

  constructor(options: WaterMaterialOptions = {}) {
    const customUniforms = createWaterUniforms(options);

    // Merge with THREE.js lighting uniforms (provides ambientLightColor)
    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.lights,
      customUniforms,
    ]) as WaterUniforms;

    super({
      uniforms,
      vertexShader: waterVertexShader,
      fragmentShader: `
        // Ambient light uniform from THREE.js lighting system
        uniform vec3 ambientLightColor;

        ${waterFragmentCommon}
        ${waterFragmentLit}
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      lights: true, // Enable THREE.js lighting system
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
