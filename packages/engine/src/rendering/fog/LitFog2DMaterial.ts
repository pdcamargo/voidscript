import * as THREE from 'three';
import {
  createFogUniforms,
  fogVertexShader,
  type FogUniforms,
} from './fog-shader-utils.js';
import type { Fog2DData, FogType } from '../../ecs/components/rendering/fog-2d.js';

export class LitFog2DMaterial extends THREE.ShaderMaterial {
  declare uniforms: FogUniforms;

  constructor() {
    const customUniforms = createFogUniforms();

    // Merge with THREE.js lighting uniforms (provides ambientLightColor)
    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.lights,
      customUniforms,
    ]) as FogUniforms;

    super({
      uniforms,
      vertexShader: fogVertexShader,
      fragmentShader: `
        uniform vec3 fogColor;
        uniform float fogOpacity;
        uniform float fogStart;
        uniform float fogEnd;
        uniform float noiseStrength;
        uniform int fogType;
        uniform vec2 pixelResolution;
        uniform vec3 ambientLightColor;
        uniform float time;

        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        void main() {
          // Snap UVs to pixel grid
          vec2 pixelUv = floor(vUv * pixelResolution) / pixelResolution;

          float fogFactor;

          if (fogType == 0) {
            // Smooth
            fogFactor = smoothstep(fogStart, fogEnd, pixelUv.y);
          } else if (fogType == 1) {
            // Hard
            fogFactor = step(fogStart, pixelUv.y);
          } else {
            // Limited (banded)
            fogFactor = smoothstep(fogStart, fogEnd, pixelUv.y);
            float bands = 12.0;
            fogFactor = floor(fogFactor * bands) / bands;
          }

          fogFactor = 1.0 - fogFactor;

          // Animated per-pixel noise
          float n = hash((pixelUv + vec2(time * 0.02, 0.0)) * pixelResolution);
          fogFactor += (n - 0.5) * noiseStrength;
          fogFactor = clamp(fogFactor, 0.0, 1.0);

          // Fade out horizontally on left and right edges
          float horizontalFade = smoothstep(0.0, 0.1, pixelUv.x) * smoothstep(1.0, 0.9, pixelUv.x);
          fogFactor *= horizontalFade;

          // Apply opacity
          fogFactor *= fogOpacity;

          // Apply ambient lighting to fog color
          vec3 litFogColor = fogColor * ambientLightColor;

          gl_FragColor = vec4(litFogColor, fogFactor);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      lights: true,
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
