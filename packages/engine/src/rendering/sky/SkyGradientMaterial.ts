import * as THREE from 'three';
import {
  createSkyGradientUniforms,
  skyGradientVertexShader,
  skyGradientFragmentUnlit,
} from './sky-gradient-shader-utils.js';

export class SkyGradientMaterial extends THREE.ShaderMaterial {
  constructor(gradientTexture: THREE.DataTexture, options: {
    enableStars?: boolean;
    starCount?: number;
    starMinSize?: number;
    starMaxSize?: number;
    starHeightRange?: number;
    starSeed?: number;
    flickerSpeed?: number;
    flickerIntensity?: number;
    skyResolution?: THREE.Vector2;
  } = {}) {
    const uniforms = createSkyGradientUniforms({
      gradientTexture,
      ...options,
    });

    super({
      uniforms,
      vertexShader: skyGradientVertexShader,
      fragmentShader: skyGradientFragmentUnlit,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      lights: false, // Unlit
    });
  }
}
