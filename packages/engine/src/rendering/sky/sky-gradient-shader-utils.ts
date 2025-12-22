import * as THREE from 'three';

export interface SkyGradientUniforms {
  gradientTexture: THREE.IUniform<THREE.DataTexture>;
  enableStars: THREE.IUniform<boolean>;
  starCount: THREE.IUniform<number>;
  starMinSize: THREE.IUniform<number>;
  starMaxSize: THREE.IUniform<number>;
  starHeightRange: THREE.IUniform<number>;
  starSeed: THREE.IUniform<number>;
  time: THREE.IUniform<number>;
  flickerSpeed: THREE.IUniform<number>;
  flickerIntensity: THREE.IUniform<number>;
  skyResolution: THREE.IUniform<THREE.Vector2>;
}

// Vertex shader (simple passthrough)
export const skyGradientVertexShader = /* glsl */`
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Common fragment shader utilities (hash functions + star generation)
export const skyGradientFragmentCommon = /* glsl */`
  varying vec2 vUv;
  uniform sampler2D gradientTexture;
  uniform bool enableStars;
  uniform float starCount;
  uniform float starMinSize;
  uniform float starMaxSize;
  uniform float starHeightRange;
  uniform float starSeed;
  uniform float time;
  uniform float flickerSpeed;
  uniform float flickerIntensity;
  uniform vec2 skyResolution;

  // Hash function for 1D output (cell has star?)
  float hash12(vec2 p, float seed) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z + seed);
  }

  // Hash function for 2D output (star position in cell)
  vec2 hash22(vec2 p, float seed) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract(vec2((p3.x + p3.y) * p3.z, (p3.y + p3.z) * p3.x) + seed);
  }

  // Generate stars procedurally
  vec3 generateStars(vec2 uv, float time) {
    if (!enableStars) return vec3(0.0);

    // Only generate stars in upper portion
    if (uv.y < 1.0 - starHeightRange) return vec3(0.0);

    // Scale UV to world space
    vec2 scaledUv = uv * skyResolution;

    // Calculate grid size from star count (larger grid = fewer stars)
    float totalArea = skyResolution.x * skyResolution.y;
    float gridSize = sqrt(totalArea / starCount);
    vec2 gridUv = scaledUv / gridSize;
    vec2 gridId = floor(gridUv);

    float starBrightness = 0.0;

    // Check 3x3 neighborhood to prevent edge artifacts
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighborId = gridId + vec2(float(x), float(y));

        // Determine if cell has a star (20% chance)
        float hasStarRand = hash12(neighborId, starSeed);
        if (hasStarRand > 0.2) continue;

        // Star position within cell (0-1)
        vec2 starPosLocal = hash22(neighborId, starSeed + 1.0);
        vec2 starPos = neighborId + starPosLocal;

        // Distance to star (in world space)
        vec2 diff = gridUv - starPos;
        float dist = length(diff * gridSize);

        // Star size (varied per star)
        float starSizeRand = hash12(neighborId, starSeed + 2.0);
        float starSize = mix(starMinSize, starMaxSize, starSizeRand);

        // Star base intensity
        float starBaseIntensity = hash12(neighborId, starSeed + 3.0) * 0.5 + 0.5;

        // Flicker animation (unique phase AND frequency per star)
        float flickerPhase = hash12(neighborId, starSeed + 4.0) * 6.28318 * 10.0; // Larger phase variation
        float flickerFreq = hash12(neighborId, starSeed + 5.0) * 0.5 + 0.75; // 0.75-1.25x speed variation
        float flicker = 1.0 - flickerIntensity +
                       flickerIntensity * (0.5 + 0.5 * sin(time * flickerSpeed * flickerFreq + flickerPhase));

        // Pixel-art style: hard edge cutoff (step function instead of smoothstep)
        float starShape = step(dist, starSize);
        starShape *= starBaseIntensity * flicker;

        starBrightness += starShape;
      }
    }

    starBrightness = clamp(starBrightness, 0.0, 1.0);
    return vec3(starBrightness);
  }
`;

// Unlit fragment shader
export const skyGradientFragmentUnlit = /* glsl */`
  ${skyGradientFragmentCommon}

  void main() {
    vec4 gradient = texture2D(gradientTexture, vec2(0.5, vUv.y));
    vec3 stars = generateStars(vUv, time);

    // Additive blending for stars
    vec3 finalColor = gradient.rgb + stars;

    gl_FragColor = vec4(finalColor, gradient.a);
  }
`;

// Lit fragment shader (integrates Three.js ambient lighting)
export const skyGradientFragmentLit = /* glsl */`
  void main() {
    vec4 gradient = texture2D(gradientTexture, vec2(0.5, vUv.y));
    vec3 stars = generateStars(vUv, time);

    // Apply ambient lighting to gradient and stars
    // Multiply both by ambientLightColor for consistent scene lighting
    vec3 litGradient = gradient.rgb * ambientLightColor;
    vec3 litStars = stars * ambientLightColor;

    // Additive blending for stars (with lighting applied)
    vec3 finalColor = litGradient + litStars;

    gl_FragColor = vec4(finalColor, gradient.a);
  }
`;

// Create uniforms with defaults
export function createSkyGradientUniforms(options: {
  gradientTexture: THREE.DataTexture;
  enableStars?: boolean;
  starCount?: number;
  starMinSize?: number;
  starMaxSize?: number;
  starHeightRange?: number;
  starSeed?: number;
  flickerSpeed?: number;
  flickerIntensity?: number;
  skyResolution?: THREE.Vector2;
}): { [key: string]: THREE.IUniform } {
  return {
    gradientTexture: { value: options.gradientTexture },
    enableStars: { value: options.enableStars ?? false },
    starCount: { value: options.starCount ?? 500 },
    starMinSize: { value: options.starMinSize ?? 1.0 },
    starMaxSize: { value: options.starMaxSize ?? 3.0 },
    starHeightRange: { value: options.starHeightRange ?? 0.6 },
    starSeed: { value: options.starSeed ?? 0 },
    time: { value: 0 },
    flickerSpeed: { value: options.flickerSpeed ?? 2.0 },
    flickerIntensity: { value: options.flickerIntensity ?? 0.3 },
    skyResolution: { value: options.skyResolution ?? new THREE.Vector2(1, 1) },
  };
}

// Update uniforms from component data
export function updateSkyGradientUniforms(
  uniforms: { [key: string]: THREE.IUniform },
  data: {
    enableStars: boolean;
    starCount: number;
    starMinSize: number;
    starMaxSize: number;
    starHeightRange: number;
    starSeed: number;
    flickerSpeed: number;
    flickerIntensity: number;
  },
  time: number,
  resolution: THREE.Vector2
) {
  uniforms['enableStars']!.value = data.enableStars;
  uniforms['starCount']!.value = data.starCount;
  uniforms['starMinSize']!.value = data.starMinSize;
  uniforms['starMaxSize']!.value = data.starMaxSize;
  uniforms['starHeightRange']!.value = data.starHeightRange;
  uniforms['starSeed']!.value = data.starSeed;
  uniforms['time']!.value = time;
  uniforms['flickerSpeed']!.value = data.flickerSpeed;
  uniforms['flickerIntensity']!.value = data.flickerIntensity;
  uniforms['skyResolution']!.value = resolution;
}
