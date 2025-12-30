// TODO: Migrate to VoidShader Language (VSL)
// This shader can be rewritten as a .vsl file using the new shader system.
// See packages/engine/src/shader/built-in-shaders/ for examples.
// Migration benefits: Better tooling, uniform hints for editor, shader library includes.

import * as THREE from 'three';

export interface FogUniforms {
  [key: string]: THREE.IUniform<unknown>;
  fogColor: THREE.IUniform<THREE.Color>;
  fogOpacity: THREE.IUniform<number>;
  fogStart: THREE.IUniform<number>;
  fogEnd: THREE.IUniform<number>;
  noiseStrength: THREE.IUniform<number>;
  fogType: THREE.IUniform<number>; // 0=smooth, 1=hard, 2=limited
  pixelResolution: THREE.IUniform<THREE.Vector2>;
  time: THREE.IUniform<number>;
}

export const fogVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const fogFragmentUnlit = `
uniform vec3 fogColor;
uniform float fogOpacity;
uniform float fogStart;
uniform float fogEnd;
uniform float noiseStrength;
uniform int fogType;
uniform vec2 pixelResolution;
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

  gl_FragColor = vec4(fogColor, fogFactor);
}
`;

export const fogFragmentLit = `
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
`;

export function createFogUniforms(): FogUniforms {
  return {
    fogColor: { value: new THREE.Color(0.8, 0.8, 0.8) },
    fogOpacity: { value: 1.0 },
    fogStart: { value: 0.3 },
    fogEnd: { value: 0.7 },
    noiseStrength: { value: 0.15 },
    fogType: { value: 0 }, // 0=smooth, 1=hard, 2=limited
    pixelResolution: { value: new THREE.Vector2(160, 90) },
    time: { value: 0.0 },
  };
}
