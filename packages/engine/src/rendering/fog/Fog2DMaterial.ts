import * as THREE from 'three';
import {
  createFogUniforms,
  fogVertexShader,
  fogFragmentUnlit,
  type FogUniforms,
} from './fog-shader-utils.js';
import type { Fog2DData, FogType } from '../../ecs/components/rendering/fog-2d.js';

export class Fog2DMaterial extends THREE.ShaderMaterial {
  declare uniforms: FogUniforms;

  constructor() {
    const uniforms = createFogUniforms();

    super({
      uniforms,
      vertexShader: fogVertexShader,
      fragmentShader: fogFragmentUnlit,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.uniforms = uniforms;
  }

  updateFromData(data: Fog2DData, time: number): void {
    this.uniforms.fogColor.value.setRGB(
      data.fogColor.r,
      data.fogColor.g,
      data.fogColor.b,
    );

    this.uniforms.fogOpacity.value = data.fogOpacity;
    this.uniforms.fogStart.value = data.fogStart;
    this.uniforms.fogEnd.value = data.fogEnd;
    this.uniforms.noiseStrength.value = data.noiseStrength;
    this.uniforms.time.value = time;

    // Map fog type to number
    this.uniforms.fogType.value = this.fogTypeToNumber(data.fogType);

    this.uniforms.pixelResolution.value.set(
      data.pixelResolution.x,
      data.pixelResolution.y,
    );
  }

  private fogTypeToNumber(fogType: FogType): number {
    const typeStr = typeof fogType === 'string' ? fogType : String(fogType);

    if (typeStr === 'smooth') return 0;
    if (typeStr === 'hard') return 1;
    if (typeStr === 'limited') return 2;

    return 0; // Default to smooth
  }
}
