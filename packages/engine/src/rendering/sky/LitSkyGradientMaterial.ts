import * as THREE from 'three';
import {
  createSkyGradientUniforms,
  skyGradientVertexShader,
  skyGradientFragmentLit,
} from './sky-gradient-shader-utils.js';

export class LitSkyGradientMaterial extends THREE.ShaderMaterial {
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
      fragmentShader: skyGradientFragmentLit,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      lights: false, // Sky gradients don't need lighting (background element)
    });
  }
}
