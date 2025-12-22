import * as THREE from 'three';
import {
  createSkyGradientUniforms,
  skyGradientVertexShader,
  skyGradientFragmentCommon,
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
    const customUniforms = createSkyGradientUniforms({
      gradientTexture,
      ...options,
    });

    // Merge with THREE.js lighting uniforms (provides ambientLightColor)
    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.lights,
      customUniforms,
    ]);

    super({
      uniforms,
      vertexShader: skyGradientVertexShader,
      fragmentShader: `
        // Ambient light uniform from THREE.js lighting system
        uniform vec3 ambientLightColor;

        ${skyGradientFragmentCommon}
        ${skyGradientFragmentLit}
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      lights: true, // Enable THREE.js lighting system
    });
  }
}
