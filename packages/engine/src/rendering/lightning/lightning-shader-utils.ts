/**
 * Lightning Shader Utilities
 *
 * Shared utilities for Lightning Field 2D materials.
 * Contains uniform definitions, shader fragments, and helper functions.
 *
 * Key features:
 * - Midpoint displacement algorithm for procedural bolt generation
 * - Distance-field glow calculation
 * - Multi-level branching (branches spawn sub-branches)
 * - Crisp pixel-art pixelation
 * - Multiple simultaneous bolt support
 * - Aspect ratio correction
 *
 * PERFORMANCE: Optimized to reduce loop iterations and shader complexity
 *
 * TODO: Migrate to VoidShader Language (VSL)
 * This shader can be rewritten as a .vsl file using the new shader system.
 * See packages/engine/src/shader/built-in-shaders/ for examples.
 * Migration benefits: Better tooling, uniform hints for editor, shader library includes.
 */

import * as THREE from 'three';

/** Maximum number of simultaneous bolts supported */
export const MAX_BOLTS = 5;

/** Maximum number of segments per bolt (2^5 = 32 with 5 subdivision levels) */
export const MAX_SEGMENTS = 32;

/**
 * Lightning material uniforms interface
 */
export interface LightningUniforms {
  [key: string]: THREE.IUniform<unknown>;
  time: THREE.IUniform<number>;

  // Size and tiling
  meshWorldScale: THREE.IUniform<THREE.Vector2>;

  // Bolt appearance
  boltColor: THREE.IUniform<THREE.Vector3>;
  glowColor: THREE.IUniform<THREE.Vector3>;
  boltWidth: THREE.IUniform<number>;
  glowRadius: THREE.IUniform<number>;
  glowIntensity: THREE.IUniform<number>;
  pixelSize: THREE.IUniform<number>;

  // Procedural generation
  segments: THREE.IUniform<number>;
  displacement: THREE.IUniform<number>;
  noiseStrength: THREE.IUniform<number>;
  branchProbability: THREE.IUniform<number>;
  branchLengthFactor: THREE.IUniform<number>;
  subBranchProbability: THREE.IUniform<number>;

  // Per-bolt data (arrays for simultaneousStrikes)
  boltSeeds: THREE.IUniform<Float32Array>;
  boltProgress: THREE.IUniform<Float32Array>;
  boltActive: THREE.IUniform<Float32Array>;
  boltAngles: THREE.IUniform<Float32Array>;

  // Effects
  flashIntensity: THREE.IUniform<number>;
  enableGroundGlow: THREE.IUniform<boolean>;
  groundGlowRadius: THREE.IUniform<number>;
}

/**
 * Options for creating lightning materials
 */
export interface LightningMaterialOptions {
  boltColor?: THREE.Vector3;
  glowColor?: THREE.Vector3;
  boltWidth?: number;
  glowRadius?: number;
  glowIntensity?: number;
  pixelSize?: number;
  segments?: number;
  displacement?: number;
  noiseStrength?: number;
  branchProbability?: number;
  branchLengthFactor?: number;
  subBranchProbability?: number;
  enableGroundGlow?: boolean;
  groundGlowRadius?: number;
}

/**
 * Create lightning uniforms with default values
 */
export function createLightningUniforms(
  options: LightningMaterialOptions = {},
): LightningUniforms {
  return {
    time: { value: 0 },

    // Size and tiling
    meshWorldScale: { value: new THREE.Vector2(1, 1) },

    // Bolt appearance (electric blue default)
    boltColor: {
      value:
        options.boltColor ?? new THREE.Vector3(0.302, 0.651, 1.0), // #4da6ff
    },
    glowColor: {
      value:
        options.glowColor ?? new THREE.Vector3(0.502, 0.753, 1.0), // #80c0ff
    },
    boltWidth: { value: options.boltWidth ?? 2 },
    glowRadius: { value: options.glowRadius ?? 8 },
    glowIntensity: { value: options.glowIntensity ?? 0.8 },
    pixelSize: { value: options.pixelSize ?? 1 },

    // Procedural generation
    segments: { value: options.segments ?? 16 },
    displacement: { value: options.displacement ?? 0.5 },
    noiseStrength: { value: options.noiseStrength ?? 0.3 },
    branchProbability: { value: options.branchProbability ?? 0.2 },
    branchLengthFactor: { value: options.branchLengthFactor ?? 0.4 },
    subBranchProbability: { value: options.subBranchProbability ?? 0.3 },

    // Per-bolt data (pre-allocate arrays for MAX_BOLTS)
    boltSeeds: { value: new Float32Array(MAX_BOLTS) },
    boltProgress: { value: new Float32Array(MAX_BOLTS) },
    boltActive: { value: new Float32Array(MAX_BOLTS) },
    boltAngles: { value: new Float32Array(MAX_BOLTS) },

    // Effects
    flashIntensity: { value: 0 },
    enableGroundGlow: { value: options.enableGroundGlow ?? false },
    groundGlowRadius: { value: options.groundGlowRadius ?? 20 },
  };
}

/**
 * Vertex shader for lightning 2D effect
 *
 * Simple pass-through with world-space scaling for consistent rendering.
 */
export const lightningVertexShader = /* glsl */ `
varying vec2 vUv;

uniform vec2 meshWorldScale;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Fragment shader for lightning 2D effect
 *
 * OPTIMIZED VERSION:
 * - Reduced max segments from 48 to 24
 * - Reduced max branches from 16 to 8
 * - Reduced subdivision levels from 6 to 5
 * - Simplified sub-branch logic
 * - Early exit optimizations
 */
export const lightningFragmentShader = /* glsl */ `
#define MAX_BOLTS 5
#define MAX_SEGMENTS 24
#define MAX_BRANCHES 8
#define SUBDIVISION_LEVELS 5

varying vec2 vUv;

uniform float time;
uniform vec2 meshWorldScale;

// Bolt appearance
uniform vec3 boltColor;
uniform vec3 glowColor;
uniform float boltWidth;
uniform float glowRadius;
uniform float glowIntensity;
uniform float pixelSize;

// Procedural generation
uniform float segments;
uniform float displacement;
uniform float noiseStrength;
uniform float branchProbability;
uniform float branchLengthFactor;
uniform float subBranchProbability;

// Per-bolt data
uniform float boltSeeds[MAX_BOLTS];
uniform float boltProgress[MAX_BOLTS];
uniform float boltActive[MAX_BOLTS];
uniform float boltAngles[MAX_BOLTS];

// Effects
uniform float flashIntensity;
uniform bool enableGroundGlow;
uniform float groundGlowRadius;

// ============================================================================
// Hash Functions for Deterministic Randomness
// ============================================================================

float hash11(float p, float seed) {
  p = fract(p * 0.1031 + seed * 0.0317);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash12(vec2 p, float seed) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
  p3 += dot(p3, p3.yzx + 19.19 + seed);
  return fract((p3.x + p3.y) * p3.z);
}

// ============================================================================
// Distance Field Utilities
// ============================================================================

// Distance from point p to line segment a-b
float distanceToSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float denom = dot(ba, ba);
  if (denom < 0.0001) return length(pa);
  float h = clamp(dot(pa, ba) / denom, 0.0, 1.0);
  return length(pa - ba * h);
}

// ============================================================================
// Midpoint Displacement Algorithm (Optimized)
// ============================================================================

vec2 getBoltPoint(vec2 start, vec2 end, float t, float seed, float displacementStrength) {
  vec2 p0 = start;
  vec2 p1 = end;
  float tLocal = t;
  float dispScale = displacementStrength;

  for (int level = 0; level < SUBDIVISION_LEVELS; level++) {
    vec2 mid = (p0 + p1) * 0.5;
    vec2 dir = p1 - p0;
    vec2 perpendicular = vec2(-dir.y, dir.x);
    float perpLen = length(perpendicular);
    if (perpLen > 0.0001) {
      perpendicular /= perpLen;
    }

    // More varied randomness using different multipliers per level
    float levelMult = float(level) * 7.31 + 3.14;
    float randOffset = (hash12(mid * 100.0 + levelMult, seed) - 0.5) * 2.0;
    // Add extra variation based on position along bolt
    randOffset += (hash12(vec2(t * 50.0, seed), seed + levelMult) - 0.5) * 0.8;

    float segmentLength = length(dir);
    vec2 displacedMid = mid + perpendicular * randOffset * dispScale * segmentLength * 0.5;

    if (tLocal < 0.5) {
      p1 = displacedMid;
      tLocal = tLocal * 2.0;
    } else {
      p0 = displacedMid;
      tLocal = (tLocal - 0.5) * 2.0;
    }

    dispScale *= 0.6;
  }

  vec2 result = mix(p0, p1, tLocal);

  // Small noise for organic look
  float noiseScale = noiseStrength * 0.03;
  result += vec2(
    hash12(result * 80.0, seed + 100.0) - 0.5,
    hash12(result * 80.0, seed + 101.0) - 0.5
  ) * noiseScale;

  return result;
}

// Calculate minimum distance from a point to the entire bolt path with branches
// OPTIMIZED: Single function, reduced iterations
float distanceToBolt(vec2 p, vec2 start, vec2 end, float seed, int numSegments, float boltWidthUV) {
  float minDist = 1e10;
  float segmentCount = float(numSegments);

  // Early culling - if we're far from the bolt line, skip detailed calculation
  float roughDist = distanceToSegment(p, start, end);
  if (roughDist > 0.3) return roughDist;

  // Main bolt segments
  for (int i = 0; i < MAX_SEGMENTS; i++) {
    if (i >= numSegments) break;

    float t0 = float(i) / segmentCount;
    float t1 = float(i + 1) / segmentCount;

    vec2 p0 = getBoltPoint(start, end, t0, seed, displacement);
    vec2 p1 = getBoltPoint(start, end, t1, seed, displacement);

    float segDist = distanceToSegment(p, p0, p1);
    minDist = min(minDist, segDist);

    // Early exit if we're already very close
    if (minDist < boltWidthUV * 0.5) continue;

    // Branch generation - use hash to determine if this segment has a branch
    float branchHash = hash12(vec2(float(i) * 7.3, seed * 3.7), seed + 50.0);
    if (branchHash >= branchProbability) continue;
    if (i < 1 || i > numSegments - 2) continue;

    // Create branch with varied angle
    vec2 mainDir = normalize(p1 - p0);

    // More varied branch angles - use multiple hashes for uniqueness
    float angleBase = hash12(vec2(float(i) * 3.7, seed * 2.1), seed + 60.0);
    float angleMod = hash12(p0 * 30.0 + vec2(seed), seed + 65.0);
    float positionMod = hash12(vec2(t0 * 100.0, seed * 5.3), seed + 67.0);
    float side = hash12(p0 * 50.0 + vec2(float(i) * 11.0), seed + 70.0) > 0.5 ? 1.0 : -1.0;

    // Angle ranges from 20 to 70 degrees with high variation
    float branchAngle = side * (0.35 + angleBase * 0.7 + angleMod * 0.4 + positionMod * 0.3);

    vec2 branchDir = vec2(
      mainDir.x * cos(branchAngle) - mainDir.y * sin(branchAngle),
      mainDir.x * sin(branchAngle) + mainDir.y * cos(branchAngle)
    );

    // Variable branch length - longer branches (0.15 to 0.35 of branchLengthFactor)
    float lengthVar = hash12(p0 + vec2(seed * 2.0), seed + 80.0);
    float branchLen = branchLengthFactor * (0.15 + lengthVar * 0.2);
    vec2 branchEnd = p0 + branchDir * branchLen;

    // Simple branch with 4 segments
    float branchSeed = seed + float(i) * 17.3 + lengthVar * 500.0 + 1000.0;
    float branchDisp = displacement * 0.6;

    for (int j = 0; j < 4; j++) {
      float bt0 = float(j) / 4.0;
      float bt1 = float(j + 1) / 4.0;

      vec2 bp0 = getBoltPoint(p0, branchEnd, bt0, branchSeed, branchDisp);
      vec2 bp1 = getBoltPoint(p0, branchEnd, bt1, branchSeed, branchDisp);

      float branchDist = distanceToSegment(p, bp0, bp1);
      // Branches are slightly thinner
      minDist = min(minDist, branchDist * 1.2);

      // Sub-branch - more variation and longer
      if (j >= 1 && j <= 3) {
        // Different hash for each segment position
        float subHash = hash12(vec2(float(j) * 11.0 + bt0 * 50.0, branchSeed * 1.7), branchSeed + 150.0 + float(j) * 20.0);
        if (subHash < subBranchProbability) {
          vec2 subDir = normalize(bp1 - bp0);

          // More varied sub-branch angles
          float subAngleBase = hash12(bp0 * 40.0 + vec2(branchSeed), branchSeed + 160.0);
          float subAngleMod = hash12(vec2(float(j) * 7.0, branchSeed * 3.0), branchSeed + 165.0);
          float subSide = hash12(bp0 * 60.0 + vec2(float(j)), branchSeed + 170.0) > 0.5 ? 1.0 : -1.0;
          float subAngle = subSide * (0.4 + subAngleBase * 0.6 + subAngleMod * 0.4);

          vec2 subBranchDir = vec2(
            subDir.x * cos(subAngle) - subDir.y * sin(subAngle),
            subDir.x * sin(subAngle) + subDir.y * cos(subAngle)
          );

          // Longer sub-branches (0.4 to 0.7 of branch length)
          float subLenVar = hash12(bp0 + vec2(branchSeed), branchSeed + 180.0);
          float subLen = branchLen * (0.4 + subLenVar * 0.3);
          vec2 subEnd = bp0 + subBranchDir * subLen;

          // 3 segments for sub-branch (longer)
          vec2 subMid1 = mix(bp0, subEnd, 0.33);
          vec2 subMid2 = mix(bp0, subEnd, 0.66);
          float subDist1 = distanceToSegment(p, bp0, subMid1);
          float subDist2 = distanceToSegment(p, subMid1, subMid2);
          float subDist3 = distanceToSegment(p, subMid2, subEnd);
          minDist = min(minDist, min(min(subDist1, subDist2), subDist3) * 1.4);
        }
      }
    }
  }

  return minDist;
}

// ============================================================================
// Main Shader
// ============================================================================

void main() {
  vec4 color = vec4(0.0);

  // Calculate aspect ratio - used to prevent stretching
  float aspectRatio = meshWorldScale.x / max(meshWorldScale.y, 0.001);

  // Use minimum dimension as the reference for pixel sizing
  // This ensures consistent pixel size regardless of aspect ratio
  float minScale = min(meshWorldScale.x, meshWorldScale.y);

  // Calculate pixel size in normalized space (relative to min dimension)
  float pixelSizeNorm = pixelSize / minScale;

  // Apply pixelation to UV coordinates (crisp pixel-art style)
  vec2 uv = vUv;

  if (pixelSize > 0.01) {
    // Create a pixel grid based on the smaller dimension
    float pixelCount = minScale / pixelSize;
    vec2 resolution = vec2(pixelCount * aspectRatio, pixelCount);
    uv = floor(vUv * resolution + 0.5) / resolution;
  }

  // Transform UV to aspect-ratio-corrected coordinates for bolt generation
  // This prevents bolts from stretching when width != height
  // Scale X so that the coordinate space is square (based on height)
  vec2 squareUV = uv;
  squareUV.x = (uv.x - 0.5) * aspectRatio + 0.5;

  // Convert boltWidth and glowRadius to the square coordinate space
  // boltWidth of 1 = 1 pixel thick, etc.
  float boltWidthSq = boltWidth * pixelSizeNorm * 0.5;
  float glowRadiusSq = glowRadius * pixelSizeNorm;

  // Ground glow accumulator
  float groundGlowAccum = 0.0;

  // Process each active bolt
  for (int i = 0; i < MAX_BOLTS; i++) {
    if (boltActive[i] < 0.5) continue;

    float seed = boltSeeds[i];
    float progress = boltProgress[i];
    float angle = boltAngles[i];

    // Calculate bolt start and end based on direction angle
    // Work in square UV space so bolts don't stretch
    vec2 dir = vec2(sin(angle), -cos(angle));
    vec2 center = vec2(0.5, 0.5);

    // Extend bolt to cover the full area (accounting for aspect ratio)
    // For wider areas, extend more in X; for taller areas, extend more in Y
    float extentX = aspectRatio > 1.0 ? 0.5 * aspectRatio : 0.5;
    float extentY = aspectRatio < 1.0 ? 0.5 / aspectRatio : 0.5;
    float extent = max(extentX, extentY);

    vec2 boltStart = center - dir * extent;
    vec2 boltEnd = center + dir * extent;

    // Add randomness to start/end positions (perpendicular offset)
    vec2 perp = vec2(-dir.y, dir.x);
    float startOffset = (hash11(seed, 0.0) - 0.5) * extent;
    float endOffset = (hash11(seed + 1.0, 0.0) - 0.5) * extent;
    boltStart += perp * startOffset;
    boltEnd += perp * endOffset;

    // Calculate distance to this bolt in square space
    int numSegs = min(int(segments), MAX_SEGMENTS);
    float dist = distanceToBolt(squareUV, boltStart, boltEnd, seed, numSegs, boltWidthSq);

    // Core bolt - use step for crisp 1-pixel edges
    float core = 1.0 - step(boltWidthSq, dist);

    // Glow (soft falloff around the core)
    float glowStart = boltWidthSq;
    float glowEnd = boltWidthSq + glowRadiusSq;
    float glow = 1.0 - smoothstep(glowStart, glowEnd, dist);
    glow = glow * glow * glowIntensity;

    // Apply fade based on progress
    float fadeMultiplier = progress;

    // Combine core and glow
    vec3 coreColor = mix(boltColor, vec3(1.0), 0.7);
    vec3 boltResult = coreColor * core + glowColor * glow * (1.0 - core);
    float alpha = max(core, glow * 0.6) * fadeMultiplier;

    // Accumulate
    color.rgb += boltResult * alpha;
    color.a = max(color.a, alpha);

    // Ground glow at impact point
    if (enableGroundGlow && progress > 0.0) {
      float groundDist = length(squareUV - boltEnd);
      float groundGlowSq = groundGlowRadius * pixelSizeNorm;
      float groundGlow = 1.0 - smoothstep(0.0, groundGlowSq, groundDist);
      groundGlow = groundGlow * groundGlow * progress;
      groundGlowAccum += groundGlow;
    }
  }

  // Add ground glow effect
  if (enableGroundGlow && groundGlowAccum > 0.0) {
    color.rgb += glowColor * groundGlowAccum * 0.5;
    color.a = max(color.a, groundGlowAccum * 0.4);
  }

  // Screen flash effect
  if (flashIntensity > 0.0) {
    color.rgb += vec3(1.0) * flashIntensity * 0.6;
    color.a = max(color.a, flashIntensity * 0.4);
  }

  color.a = clamp(color.a, 0.0, 1.0);

  gl_FragColor = color;
}
`;

/**
 * Bolt state for CPU-side tracking
 */
export interface BoltState {
  active: boolean;
  seed: number;
  angle: number;
  timeRemaining: number;
  duration: number;
}

/**
 * Update lightning material uniforms from component data
 */
export function updateLightningUniforms(
  uniforms: LightningUniforms,
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
  uniforms.time.value = time;

  // Bolt appearance
  uniforms.boltColor.value.set(
    data.boltColor.r,
    data.boltColor.g,
    data.boltColor.b,
  );
  uniforms.glowColor.value.set(
    data.glowColor.r,
    data.glowColor.g,
    data.glowColor.b,
  );
  uniforms.boltWidth.value = data.boltWidth;
  uniforms.glowRadius.value = data.glowRadius;
  uniforms.glowIntensity.value = data.glowIntensity;
  uniforms.pixelSize.value = data.pixelSize;

  // Procedural generation
  uniforms.segments.value = data.segments;
  uniforms.displacement.value = data.displacement;
  uniforms.noiseStrength.value = data.noiseStrength;
  uniforms.branchProbability.value = data.branchProbability;
  uniforms.branchLengthFactor.value = data.branchLengthFactor;
  uniforms.subBranchProbability.value = data.subBranchProbability ?? 0.3;

  // Effects
  uniforms.enableGroundGlow.value = data.enableGroundGlow;
  uniforms.groundGlowRadius.value = data.groundGlowRadius;
  uniforms.flashIntensity.value = flashIntensity ?? 0;

  // Mesh world scale
  if (meshWorldScale) {
    uniforms.meshWorldScale.value.set(meshWorldScale.x, meshWorldScale.y);
  }

  // Per-bolt data
  if (boltStates) {
    const seeds = uniforms.boltSeeds.value;
    const progress = uniforms.boltProgress.value;
    const active = uniforms.boltActive.value;
    const angles = uniforms.boltAngles.value;

    for (let i = 0; i < MAX_BOLTS; i++) {
      const bolt = boltStates[i];
      if (bolt) {
        seeds[i] = bolt.seed;
        active[i] = bolt.active ? 1.0 : 0.0;
        angles[i] = bolt.angle;
        // Calculate progress as remaining time / duration (1 = just started, 0 = finished)
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
}
