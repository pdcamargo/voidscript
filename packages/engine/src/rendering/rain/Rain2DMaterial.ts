/**
 * Rain 2D Material
 *
 * ShaderMaterial for rendering pixel-art rain droplets with world-space tiling.
 *
 * Features:
 * - Hash-based procedural droplet generation
 * - Multi-layer depth (near/mid/far)
 * - Wind and angle effects
 * - Lightning flash overlay
 * - Wetness tint
 * - Additive blending for rain overlay effect
 */

import * as THREE from 'three';
import {
  createRainUniforms,
  rainVertexShader,
  rainFragmentShader,
  updateRainUniforms,
  type RainUniforms,
  type RainMaterialOptions,
} from './rain-shader-utils.js';

/**
 * Rain 2D Material
 *
 * A ShaderMaterial that renders pixel-art rain droplets with consistent
 * density regardless of entity size (using world-space tiling).
 */
export class Rain2DMaterial extends THREE.ShaderMaterial {
  declare uniforms: RainUniforms;

  constructor(options: RainMaterialOptions = {}) {
    const uniforms = createRainUniforms(options);

    super({
      uniforms,
      vertexShader: rainVertexShader,
      fragmentShader: rainFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  /**
   * Update material uniforms from component data
   */
  updateFromData(
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
    updateRainUniforms(this.uniforms, data, time, meshWorldScale);
  }

  /**
   * Set the lightning flash intensity (0-1)
   * Called by the system during lightning strikes
   */
  setLightningFlash(intensity: number): void {
    this.uniforms.lightningFlashActive.value = intensity;
  }
}
