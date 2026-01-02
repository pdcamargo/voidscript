/**
 * Post-Processing Effect Configuration Types
 *
 * Defines all supported post-processing effects and their configurations.
 * Each effect has enabled/order fields plus effect-specific settings.
 */

import type { Entity } from "@voidscript/core";

// ============================================================================
// Base Configuration
// ============================================================================

export interface BaseEffectConfig {
  enabled: boolean;
  order: number; // Lower = earlier in pipeline
}

// ============================================================================
// Anti-Aliasing Effects
// ============================================================================

export interface FXAAConfig extends BaseEffectConfig {
  type: "fxaa";
}

export interface SMAAConfig extends BaseEffectConfig {
  type: "smaa";
}

export interface SSAAConfig extends BaseEffectConfig {
  type: "ssaa";
  sampleLevel: number; // 2, 4, 8, 16
  unbiased: boolean;
}

export interface TAAConfig extends BaseEffectConfig {
  type: "taa";
  sampleLevel: number;
  accumulate: boolean;
}

// ============================================================================
// Bloom
// ============================================================================

export interface BloomConfig extends BaseEffectConfig {
  type: "bloom";
  strength: number; // 0 - 3
  radius: number; // 0 - 1
  threshold: number; // 0 - 1
}

// ============================================================================
// Ambient Occlusion
// ============================================================================

export interface SSAOConfig extends BaseEffectConfig {
  type: "ssao";
  kernelRadius: number;
  minDistance: number;
  maxDistance: number;
  output: "default" | "ssao" | "blur" | "beauty" | "depth" | "normal";
}

export interface SAOConfig extends BaseEffectConfig {
  type: "sao";
  saoBias: number;
  saoIntensity: number;
  saoScale: number;
  saoKernelRadius: number;
  saoMinResolution: number;
  saoBlur: boolean;
  saoBlurRadius: number;
  saoBlurStdDev: number;
  saoBlurDepthCutoff: number;
}

export interface GTAOConfig extends BaseEffectConfig {
  type: "gtao";
  blendIntensity: number;
  output: "default" | "ao" | "denoise" | "depth" | "normal";
}

// ============================================================================
// Outline
// ============================================================================

export interface OutlineConfig extends BaseEffectConfig {
  type: "outline";
  selectedObjects: Entity[]; // Entities to outline
  visibleEdgeColor: { r: number; g: number; b: number };
  hiddenEdgeColor: { r: number; g: number; b: number };
  edgeThickness: number; // 1 - 4
  edgeStrength: number; // 0 - 10
  edgeGlow: number; // 0 - 1
  pulsePeriod: number; // 0 = no pulse
}

// ============================================================================
// Depth of Field
// ============================================================================

export interface BokehConfig extends BaseEffectConfig {
  type: "bokeh";
  focus: number;
  aperture: number;
  maxblur: number;
}

// ============================================================================
// Color / Film Effects
// ============================================================================

export interface FilmConfig extends BaseEffectConfig {
  type: "film";
  intensity: number; // 0 - 1
}

export interface VignetteConfig extends BaseEffectConfig {
  type: "vignette";
  offset: number; // 0 - 2
  darkness: number; // 0 - 2
}

export interface SepiaConfig extends BaseEffectConfig {
  type: "sepia";
  amount: number; // 0 - 1
}

export interface BrightnessContrastConfig extends BaseEffectConfig {
  type: "brightnessContrast";
  brightness: number; // -1 to 1
  contrast: number; // -1 to 1
}

export interface HueSaturationConfig extends BaseEffectConfig {
  type: "hueSaturation";
  hue: number; // -1 to 1
  saturation: number; // -1 to 1
}

export interface ColorCorrectionConfig extends BaseEffectConfig {
  type: "colorCorrection";
  powRGB: { r: number; g: number; b: number };
  mulRGB: { r: number; g: number; b: number };
  addRGB: { r: number; g: number; b: number };
}

// ============================================================================
// Stylized Effects
// ============================================================================

export interface DotScreenConfig extends BaseEffectConfig {
  type: "dotScreen";
  scale: number; // 1 - 10
  angle: number; // 0 - Math.PI
}

export interface GlitchConfig extends BaseEffectConfig {
  type: "glitch";
  goWild: boolean;
}

export interface PixelateConfig extends BaseEffectConfig {
  type: "pixelate";
  pixelSize: number; // 1 - 32
  normalEdgeStrength: number;
  depthEdgeStrength: number;
}

export interface HalftoneConfig extends BaseEffectConfig {
  type: "halftone";
  shape: 1 | 2 | 3 | 4; // 1=dot, 2=ellipse, 3=line, 4=square
  radius: number;
  scatter: number;
  blending: number;
  blendingMode: 1 | 2 | 3 | 4;
  greyscale: boolean;
}

export interface AfterimageConfig extends BaseEffectConfig {
  type: "afterimage";
  damp: number; // 0 - 1
}

export interface RGBShiftConfig extends BaseEffectConfig {
  type: "rgbShift";
  amount: number; // 0 - 0.1
  angle: number; // 0 - 2*PI
}

// ============================================================================
// Union Types
// ============================================================================

export type EffectConfig =
  | FXAAConfig
  | SMAAConfig
  | SSAAConfig
  | TAAConfig
  | BloomConfig
  | SSAOConfig
  | SAOConfig
  | GTAOConfig
  | OutlineConfig
  | BokehConfig
  | FilmConfig
  | VignetteConfig
  | SepiaConfig
  | BrightnessContrastConfig
  | HueSaturationConfig
  | ColorCorrectionConfig
  | DotScreenConfig
  | GlitchConfig
  | PixelateConfig
  | HalftoneConfig
  | AfterimageConfig
  | RGBShiftConfig;

export type EffectType = EffectConfig["type"];

// ============================================================================
// Effect Metadata (for UI)
// ============================================================================

export type EffectCategory =
  | "anti-aliasing"
  | "bloom"
  | "ambient-occlusion"
  | "outline"
  | "depth-of-field"
  | "color"
  | "stylized";

export interface EffectMetadata {
  type: EffectType;
  displayName: string;
  category: EffectCategory;
  description: string;
  defaultConfig: () => EffectConfig;
}
