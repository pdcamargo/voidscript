/**
 * ShaderLibrary - Registry for reusable shader snippets and includes
 *
 * Provides common shader functions (noise, color utilities, effects)
 * that can be included in VSL shaders using `#include "path"` syntax.
 *
 * @example
 * ```vsl
 * shader_type canvas_item;
 *
 * #include "noise/simplex"
 * #include "color/hsv"
 *
 * void fragment() {
 *     float n = simplex2d(UV * 10.0);
 *     vec3 hsv = rgb2hsv(COLOR.rgb);
 *     hsv.x += TIME * 0.1;
 *     COLOR.rgb = hsv2rgb(hsv);
 * }
 * ```
 */

/**
 * Shader snippet definition
 */
export interface ShaderSnippet {
  /** Unique path for include (e.g., "noise/simplex") */
  path: string;

  /** GLSL code for this snippet */
  code: string;

  /** Brief description */
  description?: string;

  /** Dependencies (other snippet paths to include first) */
  dependencies?: string[];
}

/**
 * ShaderLibrary - Central registry for shader snippets
 */
export class ShaderLibrary {
  private static snippets = new Map<string, ShaderSnippet>();
  private static initialized = false;

  /**
   * Register a shader snippet
   *
   * @param snippet - Snippet definition
   */
  static register(snippet: ShaderSnippet): void {
    ShaderLibrary.snippets.set(snippet.path, snippet);
  }

  /**
   * Get a snippet by path
   *
   * @param path - Include path (e.g., "noise/simplex")
   * @returns Snippet or undefined if not found
   */
  static get(path: string): ShaderSnippet | undefined {
    ShaderLibrary.ensureInitialized();
    return ShaderLibrary.snippets.get(path);
  }

  /**
   * Check if a snippet exists
   *
   * @param path - Include path
   */
  static has(path: string): boolean {
    ShaderLibrary.ensureInitialized();
    return ShaderLibrary.snippets.has(path);
  }

  /**
   * Resolve a snippet and all its dependencies
   * Returns GLSL code with dependencies included first (topologically sorted)
   *
   * @param path - Include path
   * @returns Resolved GLSL code
   * @throws Error if snippet not found or circular dependency detected
   */
  static resolve(path: string): string {
    ShaderLibrary.ensureInitialized();

    const resolved = new Set<string>();
    const result: string[] = [];

    const visit = (p: string, stack: Set<string>) => {
      if (resolved.has(p)) return;

      if (stack.has(p)) {
        throw new Error(
          `[ShaderLibrary] Circular dependency detected: ${Array.from(stack).join(' -> ')} -> ${p}`,
        );
      }

      const snippet = ShaderLibrary.snippets.get(p);
      if (!snippet) {
        throw new Error(`[ShaderLibrary] Snippet not found: "${p}"`);
      }

      stack.add(p);

      // Resolve dependencies first
      if (snippet.dependencies) {
        for (const dep of snippet.dependencies) {
          visit(dep, stack);
        }
      }

      stack.delete(p);
      resolved.add(p);
      result.push(`// === Include: ${p} ===\n${snippet.code}`);
    };

    visit(path, new Set());

    return result.join('\n\n');
  }

  /**
   * Resolve multiple includes and return combined GLSL code
   *
   * @param paths - Array of include paths
   * @returns Combined GLSL code with all dependencies
   */
  static resolveAll(paths: string[]): string {
    ShaderLibrary.ensureInitialized();

    const resolved = new Set<string>();
    const result: string[] = [];

    const visit = (p: string, stack: Set<string>) => {
      if (resolved.has(p)) return;

      if (stack.has(p)) {
        throw new Error(
          `[ShaderLibrary] Circular dependency detected: ${Array.from(stack).join(' -> ')} -> ${p}`,
        );
      }

      const snippet = ShaderLibrary.snippets.get(p);
      if (!snippet) {
        throw new Error(`[ShaderLibrary] Snippet not found: "${p}"`);
      }

      stack.add(p);

      if (snippet.dependencies) {
        for (const dep of snippet.dependencies) {
          visit(dep, stack);
        }
      }

      stack.delete(p);
      resolved.add(p);
      result.push(`// === Include: ${p} ===\n${snippet.code}`);
    };

    for (const path of paths) {
      visit(path, new Set());
    }

    return result.join('\n\n');
  }

  /**
   * Get all registered snippet paths
   */
  static getAllPaths(): string[] {
    ShaderLibrary.ensureInitialized();
    return Array.from(ShaderLibrary.snippets.keys());
  }

  /**
   * Clear all snippets (for testing)
   */
  static clear(): void {
    ShaderLibrary.snippets.clear();
    ShaderLibrary.initialized = false;
  }

  /**
   * Ensure built-in snippets are registered
   */
  private static ensureInitialized(): void {
    if (ShaderLibrary.initialized) return;
    ShaderLibrary.initialized = true;
    registerBuiltInSnippets();
  }
}

// ============================================================================
// Built-in Shader Snippets
// ============================================================================

function registerBuiltInSnippets(): void {
  // ---------------------------------------------------------------------------
  // Math Utilities
  // ---------------------------------------------------------------------------

  ShaderLibrary.register({
    path: 'math/constants',
    description: 'Common mathematical constants',
    code: `
#ifndef VSL_MATH_CONSTANTS
#define VSL_MATH_CONSTANTS

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
const float E = 2.71828182846;
const float SQRT2 = 1.41421356237;
const float PHI = 1.61803398875;

#endif
`,
  });

  ShaderLibrary.register({
    path: 'math/utils',
    description: 'Common math utility functions',
    dependencies: ['math/constants'],
    code: `
#ifndef VSL_MATH_UTILS
#define VSL_MATH_UTILS

// Remap value from one range to another
float remap(float value, float fromMin, float fromMax, float toMin, float toMax) {
    return toMin + (value - fromMin) * (toMax - toMin) / (fromMax - fromMin);
}

// Smooth step with customizable edge
float smootherstep(float edge0, float edge1, float x) {
    x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

// Rotate 2D point around origin
vec2 rotate2d(vec2 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Smooth minimum (useful for blending SDFs)
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// Quantize value to steps
float quantize(float value, float steps) {
    return floor(value * steps) / steps;
}

#endif
`,
  });

  // ---------------------------------------------------------------------------
  // Random / Hash
  // ---------------------------------------------------------------------------

  ShaderLibrary.register({
    path: 'random/hash',
    description: 'Hash functions for pseudo-random number generation',
    code: `
#ifndef VSL_RANDOM_HASH
#define VSL_RANDOM_HASH

// Simple hash function for pseudo-random numbers
float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yxx) * p3.zyx);
}

#endif
`,
  });

  ShaderLibrary.register({
    path: 'random/random',
    description: 'Random value generation',
    dependencies: ['random/hash'],
    code: `
#ifndef VSL_RANDOM_RANDOM
#define VSL_RANDOM_RANDOM

// Random float from seed
float random(float seed) {
    return hash11(seed);
}

// Random float from 2D seed
float random2(vec2 seed) {
    return hash12(seed);
}

// Random vec2 from 2D seed
vec2 randomVec2(vec2 seed) {
    return hash22(seed);
}

// Random vec3 from 3D seed
vec3 randomVec3(vec3 seed) {
    return hash33(seed);
}

#endif
`,
  });

  // ---------------------------------------------------------------------------
  // Noise Functions
  // ---------------------------------------------------------------------------

  ShaderLibrary.register({
    path: 'noise/value',
    description: 'Value noise implementation',
    dependencies: ['random/hash'],
    code: `
#ifndef VSL_NOISE_VALUE
#define VSL_NOISE_VALUE

// 2D Value noise
float valueNoise2d(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    // Smooth interpolation
    vec2 u = f * f * (3.0 - 2.0 * f);

    // Four corners
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractal Brownian Motion (FBM) with value noise
float fbmValue2d(vec2 p, int octaves, float lacunarity, float persistence) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < octaves; i++) {
        value += amplitude * valueNoise2d(p * frequency);
        frequency *= lacunarity;
        amplitude *= persistence;
    }

    return value;
}

#endif
`,
  });

  ShaderLibrary.register({
    path: 'noise/simplex',
    description: 'Simplex noise implementation',
    code: `
#ifndef VSL_NOISE_SIMPLEX
#define VSL_NOISE_SIMPLEX

// Simplex 2D noise (optimized)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float simplex2d(vec2 v) {
    const vec4 C = vec4(
        0.211324865405187,  // (3.0 - sqrt(3.0)) / 6.0
        0.366025403784439,  // 0.5 * (sqrt(3.0) - 1.0)
        -0.577350269189626, // -1.0 + 2.0 * C.x
        0.024390243902439   // 1.0 / 41.0
    );

    // First corner
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);

    // Other corners
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;

    // Permutations
    i = mod289v2(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;

    // Gradients
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;

    // Normalize gradients
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

    // Compute final noise value
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;

    return 130.0 * dot(m, g);
}

// Fractal Brownian Motion (FBM) with simplex noise
float fbmSimplex2d(vec2 p, int octaves, float lacunarity, float persistence) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < octaves; i++) {
        value += amplitude * simplex2d(p * frequency);
        frequency *= lacunarity;
        amplitude *= persistence;
    }

    return value;
}

#endif
`,
  });

  ShaderLibrary.register({
    path: 'noise/perlin',
    description: 'Classic Perlin noise implementation',
    dependencies: ['random/hash'],
    code: `
#ifndef VSL_NOISE_PERLIN
#define VSL_NOISE_PERLIN

// 2D Perlin noise
float perlin2d(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    // Quintic interpolation
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

    // Gradients at corners
    vec2 ga = hash22(i + vec2(0.0, 0.0)) * 2.0 - 1.0;
    vec2 gb = hash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0;
    vec2 gc = hash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0;
    vec2 gd = hash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0;

    // Dot products
    float va = dot(ga, f - vec2(0.0, 0.0));
    float vb = dot(gb, f - vec2(1.0, 0.0));
    float vc = dot(gc, f - vec2(0.0, 1.0));
    float vd = dot(gd, f - vec2(1.0, 1.0));

    return mix(mix(va, vb, u.x), mix(vc, vd, u.x), u.y);
}

// FBM with Perlin noise
float fbmPerlin2d(vec2 p, int octaves, float lacunarity, float persistence) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < octaves; i++) {
        value += amplitude * perlin2d(p * frequency);
        frequency *= lacunarity;
        amplitude *= persistence;
    }

    return value;
}

#endif
`,
  });

  ShaderLibrary.register({
    path: 'noise/voronoi',
    description: 'Voronoi/Worley noise implementation',
    dependencies: ['random/hash'],
    code: `
#ifndef VSL_NOISE_VORONOI
#define VSL_NOISE_VORONOI

// 2D Voronoi noise - returns distance to nearest point
float voronoi2d(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float minDist = 1.0;

    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = hash22(i + neighbor);
            vec2 diff = neighbor + point - f;
            float dist = length(diff);
            minDist = min(minDist, dist);
        }
    }

    return minDist;
}

// Voronoi with cell ID
vec3 voronoi2dCell(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float minDist = 1.0;
    vec2 minCell = vec2(0.0);

    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = hash22(i + neighbor);
            vec2 diff = neighbor + point - f;
            float dist = length(diff);

            if (dist < minDist) {
                minDist = dist;
                minCell = i + neighbor;
            }
        }
    }

    return vec3(minDist, minCell);
}

#endif
`,
  });

  // ---------------------------------------------------------------------------
  // Color Utilities
  // ---------------------------------------------------------------------------

  ShaderLibrary.register({
    path: 'color/hsv',
    description: 'HSV/RGB color space conversion',
    code: `
#ifndef VSL_COLOR_HSV
#define VSL_COLOR_HSV

// RGB to HSV conversion
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Adjust hue (0-1 range)
vec3 adjustHue(vec3 rgb, float hueShift) {
    vec3 hsv = rgb2hsv(rgb);
    hsv.x = fract(hsv.x + hueShift);
    return hsv2rgb(hsv);
}

// Adjust saturation (0-2+ range, 1 = unchanged)
vec3 adjustSaturation(vec3 rgb, float satMult) {
    vec3 hsv = rgb2hsv(rgb);
    hsv.y *= satMult;
    return hsv2rgb(hsv);
}

// Adjust brightness/value (0-2+ range, 1 = unchanged)
vec3 adjustBrightness(vec3 rgb, float brightMult) {
    vec3 hsv = rgb2hsv(rgb);
    hsv.z *= brightMult;
    return hsv2rgb(hsv);
}

#endif
`,
  });

  ShaderLibrary.register({
    path: 'color/hsl',
    description: 'HSL/RGB color space conversion',
    code: `
#ifndef VSL_COLOR_HSL
#define VSL_COLOR_HSL

// RGB to HSL conversion
vec3 rgb2hsl(vec3 c) {
    float maxC = max(max(c.r, c.g), c.b);
    float minC = min(min(c.r, c.g), c.b);
    float l = (maxC + minC) * 0.5;

    if (maxC == minC) {
        return vec3(0.0, 0.0, l);
    }

    float d = maxC - minC;
    float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);

    float h;
    if (maxC == c.r) {
        h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    } else if (maxC == c.g) {
        h = (c.b - c.r) / d + 2.0;
    } else {
        h = (c.r - c.g) / d + 4.0;
    }
    h /= 6.0;

    return vec3(h, s, l);
}

// Helper for hsl2rgb
float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0/2.0) return q;
    if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
    return p;
}

// HSL to RGB conversion
vec3 hsl2rgb(vec3 c) {
    if (c.y == 0.0) {
        return vec3(c.z);
    }

    float q = c.z < 0.5 ? c.z * (1.0 + c.y) : c.z + c.y - c.z * c.y;
    float p = 2.0 * c.z - q;

    return vec3(
        hue2rgb(p, q, c.x + 1.0/3.0),
        hue2rgb(p, q, c.x),
        hue2rgb(p, q, c.x - 1.0/3.0)
    );
}

#endif
`,
  });

  ShaderLibrary.register({
    path: 'color/blend',
    description: 'Color blending modes',
    code: `
#ifndef VSL_COLOR_BLEND
#define VSL_COLOR_BLEND

// Screen blend mode
vec3 blendScreen(vec3 base, vec3 blend) {
    return 1.0 - (1.0 - base) * (1.0 - blend);
}

// Multiply blend mode
vec3 blendMultiply(vec3 base, vec3 blend) {
    return base * blend;
}

// Overlay blend mode
vec3 blendOverlay(vec3 base, vec3 blend) {
    return mix(
        2.0 * base * blend,
        1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
        step(0.5, base)
    );
}

// Soft light blend mode
vec3 blendSoftLight(vec3 base, vec3 blend) {
    return mix(
        2.0 * base * blend + base * base * (1.0 - 2.0 * blend),
        sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend),
        step(0.5, blend)
    );
}

// Hard light blend mode
vec3 blendHardLight(vec3 base, vec3 blend) {
    return blendOverlay(blend, base);
}

// Color dodge blend mode
vec3 blendColorDodge(vec3 base, vec3 blend) {
    return base / max(1.0 - blend, 0.0001);
}

// Color burn blend mode
vec3 blendColorBurn(vec3 base, vec3 blend) {
    return 1.0 - (1.0 - base) / max(blend, 0.0001);
}

// Difference blend mode
vec3 blendDifference(vec3 base, vec3 blend) {
    return abs(base - blend);
}

// Exclusion blend mode
vec3 blendExclusion(vec3 base, vec3 blend) {
    return base + blend - 2.0 * base * blend;
}

#endif
`,
  });

  ShaderLibrary.register({
    path: 'color/utils',
    description: 'Color utility functions',
    code: `
#ifndef VSL_COLOR_UTILS
#define VSL_COLOR_UTILS

// Luminance calculation (ITU-R BT.709)
float luminance(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// Grayscale conversion
vec3 grayscale(vec3 c) {
    float l = luminance(c);
    return vec3(l);
}

// Contrast adjustment (-1 to 1 range, 0 = unchanged)
vec3 adjustContrast(vec3 c, float contrast) {
    return (c - 0.5) * (1.0 + contrast) + 0.5;
}

// Gamma correction
vec3 gammaCorrect(vec3 c, float gamma) {
    return pow(c, vec3(1.0 / gamma));
}

// Linear to sRGB
vec3 linearToSrgb(vec3 c) {
    return pow(c, vec3(1.0 / 2.2));
}

// sRGB to linear
vec3 srgbToLinear(vec3 c) {
    return pow(c, vec3(2.2));
}

// Posterize effect
vec3 posterize(vec3 c, float levels) {
    return floor(c * levels) / levels;
}

// Invert colors
vec3 invertColor(vec3 c) {
    return 1.0 - c;
}

// Sepia tone
vec3 sepia(vec3 c) {
    return vec3(
        dot(c, vec3(0.393, 0.769, 0.189)),
        dot(c, vec3(0.349, 0.686, 0.168)),
        dot(c, vec3(0.272, 0.534, 0.131))
    );
}

#endif
`,
  });

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  ShaderLibrary.register({
    path: 'effects/distortion',
    description: 'UV distortion effects',
    dependencies: ['math/constants', 'noise/simplex'],
    code: `
#ifndef VSL_EFFECTS_DISTORTION
#define VSL_EFFECTS_DISTORTION

// Simple wave distortion
vec2 waveDistort(vec2 uv, float time, float amplitude, float frequency) {
    uv.x += sin(uv.y * frequency + time) * amplitude;
    uv.y += cos(uv.x * frequency + time) * amplitude;
    return uv;
}

// Circular ripple distortion from center
vec2 rippleDistort(vec2 uv, vec2 center, float time, float amplitude, float frequency) {
    vec2 offset = uv - center;
    float dist = length(offset);
    float wave = sin(dist * frequency - time) * amplitude;
    return uv + normalize(offset) * wave;
}

// Noise-based distortion
vec2 noiseDistort(vec2 uv, float time, float scale, float amplitude) {
    float nx = simplex2d(uv * scale + time);
    float ny = simplex2d(uv * scale + time + 100.0);
    return uv + vec2(nx, ny) * amplitude;
}

// Barrel distortion (fisheye)
vec2 barrelDistort(vec2 uv, float strength) {
    vec2 centered = uv * 2.0 - 1.0;
    float r2 = dot(centered, centered);
    centered *= 1.0 + strength * r2;
    return centered * 0.5 + 0.5;
}

// Pincushion distortion (inverse barrel)
vec2 pincushionDistort(vec2 uv, float strength) {
    return barrelDistort(uv, -strength);
}

#endif
`,
  });

  ShaderLibrary.register({
    path: 'effects/vignette',
    description: 'Vignette effect',
    code: `
#ifndef VSL_EFFECTS_VIGNETTE
#define VSL_EFFECTS_VIGNETTE

// Simple vignette
float vignette(vec2 uv, float intensity, float smoothness) {
    vec2 centered = uv * 2.0 - 1.0;
    float dist = length(centered);
    return 1.0 - smoothstep(1.0 - intensity, 1.0 - intensity + smoothness, dist);
}

// Oval vignette with aspect ratio control
float vignetteOval(vec2 uv, vec2 aspect, float intensity, float smoothness) {
    vec2 centered = (uv * 2.0 - 1.0) * aspect;
    float dist = length(centered);
    return 1.0 - smoothstep(1.0 - intensity, 1.0 - intensity + smoothness, dist);
}

// Apply vignette to color
vec3 applyVignette(vec3 color, vec2 uv, float intensity, float smoothness) {
    return color * vignette(uv, intensity, smoothness);
}

#endif
`,
  });

  ShaderLibrary.register({
    path: 'effects/outline',
    description: 'Outline/edge detection effects',
    code: `
#ifndef VSL_EFFECTS_OUTLINE
#define VSL_EFFECTS_OUTLINE

// Sobel edge detection (requires texture sampling)
// Call with texel size = 1.0 / textureSize
float sobelEdge(sampler2D tex, vec2 uv, vec2 texelSize) {
    float tl = texture(tex, uv + texelSize * vec2(-1, -1)).r;
    float t  = texture(tex, uv + texelSize * vec2( 0, -1)).r;
    float tr = texture(tex, uv + texelSize * vec2( 1, -1)).r;
    float l  = texture(tex, uv + texelSize * vec2(-1,  0)).r;
    float r  = texture(tex, uv + texelSize * vec2( 1,  0)).r;
    float bl = texture(tex, uv + texelSize * vec2(-1,  1)).r;
    float b  = texture(tex, uv + texelSize * vec2( 0,  1)).r;
    float br = texture(tex, uv + texelSize * vec2( 1,  1)).r;

    float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
    float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;

    return sqrt(gx*gx + gy*gy);
}

// Simple alpha-based outline detection
float alphaOutline(sampler2D tex, vec2 uv, vec2 texelSize, float thickness) {
    float center = texture(tex, uv).a;
    float edge = 0.0;

    for (float x = -thickness; x <= thickness; x += 1.0) {
        for (float y = -thickness; y <= thickness; y += 1.0) {
            if (x == 0.0 && y == 0.0) continue;
            edge = max(edge, texture(tex, uv + texelSize * vec2(x, y)).a);
        }
    }

    return edge * (1.0 - center);
}

#endif
`,
  });

  ShaderLibrary.register({
    path: 'effects/pixelate',
    description: 'Pixelation effect',
    code: `
#ifndef VSL_EFFECTS_PIXELATE
#define VSL_EFFECTS_PIXELATE

// Pixelate UV coordinates
vec2 pixelateUV(vec2 uv, vec2 resolution, float pixelSize) {
    vec2 pixels = resolution / pixelSize;
    return floor(uv * pixels) / pixels;
}

// Pixelate with aspect-correct pixels
vec2 pixelateUVAspect(vec2 uv, vec2 resolution, float pixelCount) {
    float aspect = resolution.x / resolution.y;
    vec2 pixels = vec2(pixelCount * aspect, pixelCount);
    return floor(uv * pixels) / pixels;
}

// Mosaic effect (hexagonal pixelation)
vec2 hexPixelateUV(vec2 uv, float size) {
    vec2 hex = uv * size;
    vec2 ri = floor(hex);
    vec2 rf = fract(hex);

    float offset = mod(ri.y, 2.0) * 0.5;
    vec2 h1 = vec2(floor(rf.x + offset), ri.y);
    vec2 h2 = vec2(floor(rf.x + offset + 0.5), ri.y + 1.0);

    vec2 c1 = vec2(h1.x - offset + 0.5, h1.y + 0.5) / size;
    vec2 c2 = vec2(h2.x - 0.5 - offset + 0.5, h2.y + 0.5) / size;

    return distance(uv, c1) < distance(uv, c2) ? c1 : c2;
}

#endif
`,
  });

  ShaderLibrary.register({
    path: 'effects/dissolve',
    description: 'Dissolve/burn transition effect',
    dependencies: ['noise/simplex'],
    code: `
#ifndef VSL_EFFECTS_DISSOLVE
#define VSL_EFFECTS_DISSOLVE

// Basic dissolve based on noise
float dissolve(vec2 uv, float progress, float noiseScale, float edgeWidth) {
    float noise = simplex2d(uv * noiseScale) * 0.5 + 0.5;
    return smoothstep(progress, progress + edgeWidth, noise);
}

// Dissolve with edge glow
vec4 dissolveWithEdge(vec4 color, vec2 uv, float progress, float noiseScale, float edgeWidth, vec3 edgeColor) {
    float noise = simplex2d(uv * noiseScale) * 0.5 + 0.5;
    float alpha = smoothstep(progress, progress + edgeWidth, noise);
    float edge = smoothstep(progress - edgeWidth * 0.5, progress, noise) - alpha;

    return vec4(mix(color.rgb, edgeColor, edge), color.a * alpha);
}

// Directional dissolve (wipe)
float dissolveDirectional(vec2 uv, vec2 direction, float progress, float edgeWidth) {
    float d = dot(uv - 0.5, normalize(direction)) + 0.5;
    return smoothstep(progress, progress + edgeWidth, d);
}

#endif
`,
  });

  // ---------------------------------------------------------------------------
  // Patterns
  // ---------------------------------------------------------------------------

  ShaderLibrary.register({
    path: 'patterns/grid',
    description: 'Grid and line patterns',
    code: `
#ifndef VSL_PATTERNS_GRID
#define VSL_PATTERNS_GRID

// Simple grid pattern
float grid(vec2 uv, float cellSize, float lineWidth) {
    vec2 wrapped = mod(uv, cellSize) / cellSize;
    vec2 lines = smoothstep(lineWidth, 0.0, wrapped) + smoothstep(1.0 - lineWidth, 1.0, wrapped);
    return max(lines.x, lines.y);
}

// Dotted grid pattern
float dottedGrid(vec2 uv, float cellSize, float dotRadius) {
    vec2 cell = mod(uv, cellSize) / cellSize - 0.5;
    return 1.0 - smoothstep(dotRadius - 0.01, dotRadius, length(cell));
}

// Checker pattern
float checker(vec2 uv, float scale) {
    vec2 cell = floor(uv * scale);
    return mod(cell.x + cell.y, 2.0);
}

// Diagonal lines
float diagonalLines(vec2 uv, float scale, float lineWidth) {
    float d = fract((uv.x + uv.y) * scale);
    return smoothstep(lineWidth, 0.0, d) + smoothstep(1.0 - lineWidth, 1.0, d);
}

#endif
`,
  });

  ShaderLibrary.register({
    path: 'patterns/shapes',
    description: 'Basic shape SDFs',
    code: `
#ifndef VSL_PATTERNS_SHAPES
#define VSL_PATTERNS_SHAPES

// Circle SDF
float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

// Box SDF
float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// Rounded box SDF
float sdRoundedBox(vec2 p, vec2 b, float r) {
    vec2 d = abs(p) - b + r;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

// Triangle SDF (equilateral)
float sdTriangle(vec2 p, float r) {
    const float k = sqrt(3.0);
    p.x = abs(p.x) - r;
    p.y = p.y + r / k;
    if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
    p.x -= clamp(p.x, -2.0 * r, 0.0);
    return -length(p) * sign(p.y);
}

// Star SDF (5-pointed)
float sdStar5(vec2 p, float r, float rf) {
    const vec2 k1 = vec2(0.809016994375, -0.587785252292);
    const vec2 k2 = vec2(-k1.x, k1.y);
    p.x = abs(p.x);
    p -= 2.0 * max(dot(k1, p), 0.0) * k1;
    p -= 2.0 * max(dot(k2, p), 0.0) * k2;
    p.x = abs(p.x);
    p.y -= r;
    vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0, 1);
    float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
    return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

// Hexagon SDF
float sdHexagon(vec2 p, float r) {
    const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
    p = abs(p);
    p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
    p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
    return length(p) * sign(p.y);
}

#endif
`,
  });

  // ---------------------------------------------------------------------------
  // Sprite Utilities
  // ---------------------------------------------------------------------------

  ShaderLibrary.register({
    path: 'sprite/utils',
    description: 'Sprite-specific utility functions',
    code: `
#ifndef VSL_SPRITE_UTILS
#define VSL_SPRITE_UTILS

// Calculate UV offset for sprite sheet animation
vec2 spriteSheetUV(vec2 uv, vec2 tileSize, vec2 tilesetSize, float tileIndex) {
    vec2 tilesPerRow = tilesetSize / tileSize;
    float col = mod(tileIndex, tilesPerRow.x);
    float row = floor(tileIndex / tilesPerRow.x);

    vec2 tileUV = uv * (tileSize / tilesetSize);
    vec2 offset = vec2(col, row) * (tileSize / tilesetSize);

    return tileUV + offset;
}

// Flip UV horizontally
vec2 flipH(vec2 uv) {
    return vec2(1.0 - uv.x, uv.y);
}

// Flip UV vertically
vec2 flipV(vec2 uv) {
    return vec2(uv.x, 1.0 - uv.y);
}

// Rotate UV 90 degrees clockwise
vec2 rotate90CW(vec2 uv) {
    return vec2(1.0 - uv.y, uv.x);
}

// Rotate UV 90 degrees counter-clockwise
vec2 rotate90CCW(vec2 uv) {
    return vec2(uv.y, 1.0 - uv.x);
}

// Scale UV from center
vec2 scaleFromCenter(vec2 uv, float scale) {
    return (uv - 0.5) * scale + 0.5;
}

#endif
`,
  });

  ShaderLibrary.register({
    path: 'sprite/flash',
    description: 'Sprite flash/hit effects',
    code: `
#ifndef VSL_SPRITE_FLASH
#define VSL_SPRITE_FLASH

// Simple white flash (for hit effects)
vec4 flashWhite(vec4 color, float intensity) {
    return vec4(mix(color.rgb, vec3(1.0), intensity), color.a);
}

// Colored flash
vec4 flashColor(vec4 color, vec3 flashCol, float intensity) {
    return vec4(mix(color.rgb, flashCol, intensity), color.a);
}

// Additive flash (brighter)
vec4 flashAdditive(vec4 color, vec3 flashCol, float intensity) {
    return vec4(color.rgb + flashCol * intensity, color.a);
}

// Pulsing flash (use with TIME)
float pulseFlash(float time, float speed, float minIntensity, float maxIntensity) {
    return mix(minIntensity, maxIntensity, (sin(time * speed) * 0.5 + 0.5));
}

#endif
`,
  });
}
