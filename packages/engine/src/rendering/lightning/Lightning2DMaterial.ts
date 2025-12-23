/**
 * Lightning 2D Material
 *
 * ShaderMaterial for rendering procedural lightning bolts with glow effects.
 *
 * Features:
 * - Midpoint displacement algorithm for bolt generation
 * - Distance-field glow
 * - Random branching
 * - Post-process pixelation
 * - Multiple simultaneous bolt support
 * - Additive blending for lightning overlay effect
 */

import * as THREE from 'three';
import {
  createLightningUniforms,
  lightningVertexShader,
  lightningFragmentShader,
  updateLightningUniforms,
  type LightningUniforms,
  type LightningMaterialOptions,
  type BoltState,
} from './lightning-shader-utils.js';

/**
 * Lightning 2D Material
 *
 * A ShaderMaterial that renders procedural lightning bolts with
 * midpoint displacement and distance-field glow effects.
 */
export class Lightning2DMaterial extends THREE.ShaderMaterial {
  declare uniforms: LightningUniforms;

  constructor(options: LightningMaterialOptions = {}) {
    const uniforms = createLightningUniforms(options);

    super({
      uniforms,
      vertexShader: lightningVertexShader,
      fragmentShader: lightningFragmentShader,
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
      boltColor: { r: number; g: number; b: number };
      glowColor: { r: number; g: number; b: number };
      boltWidth: number;
      glowRadius: number;
      glowIntensity: number;
      pixelSize: number;
      segments: number;
      displacement: number;
      noiseStrength: number;
      branchProbability: number;
      branchLengthFactor: number;
      subBranchProbability?: number;
      enableGroundGlow: boolean;
      groundGlowRadius: number;
    },
    time: number,
    meshWorldScale?: { x: number; y: number },
    boltStates?: BoltState[],
    flashIntensity?: number,
  ): void {
    updateLightningUniforms(
      this.uniforms,
      data,
      time,
      meshWorldScale,
      boltStates,
      flashIntensity,
    );
  }

  /**
   * Set the screen flash intensity (0-1)
   * Called by the system during lightning strikes
   */
  setFlashIntensity(intensity: number): void {
    this.uniforms.flashIntensity.value = intensity;
  }

  /**
   * Update bolt states (active, progress, angles)
   */
  setBoltStates(boltStates: BoltState[]): void {
    const seeds = this.uniforms.boltSeeds.value;
    const progress = this.uniforms.boltProgress.value;
    const active = this.uniforms.boltActive.value;
    const angles = this.uniforms.boltAngles.value;

    const maxBolts = seeds.length;

    for (let i = 0; i < maxBolts; i++) {
      const bolt = boltStates[i];
      if (bolt) {
        seeds[i] = bolt.seed;
        active[i] = bolt.active ? 1.0 : 0.0;
        angles[i] = bolt.angle;
        progress[i] = bolt.active
          ? Math.max(0, bolt.timeRemaining / bolt.duration)
          : 0;
      } else {
        seeds[i] = 0;
        progress[i] = 0;
        active[i] = 0;
        angles[i] = 0;
      }
    }
  }

  /**
   * Set mesh world scale for consistent rendering
   */
  setMeshWorldScale(x: number, y: number): void {
    this.uniforms.meshWorldScale.value.set(x, y);
  }
}
