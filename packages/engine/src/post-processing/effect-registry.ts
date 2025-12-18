/**
 * Effect Registry
 *
 * Metadata for all available post-processing effects.
 * Used by the custom editor to display effects and create defaults.
 */

import type {
  EffectMetadata,
  EffectType,
  FXAAConfig,
  SMAAConfig,
  SSAAConfig,
  TAAConfig,
  BloomConfig,
  SSAOConfig,
  SAOConfig,
  GTAOConfig,
  OutlineConfig,
  BokehConfig,
  FilmConfig,
  VignetteConfig,
  SepiaConfig,
  BrightnessContrastConfig,
  HueSaturationConfig,
  ColorCorrectionConfig,
  DotScreenConfig,
  GlitchConfig,
  PixelateConfig,
  HalftoneConfig,
  AfterimageConfig,
  RGBShiftConfig,
} from "./types.js";

// Order counter for default ordering
let orderCounter = 0;

export const EFFECT_REGISTRY: EffectMetadata[] = [
  // ========== Anti-Aliasing ==========
  {
    type: "fxaa",
    displayName: "FXAA",
    category: "anti-aliasing",
    description: "Fast approximate anti-aliasing",
    defaultConfig: (): FXAAConfig => ({
      type: "fxaa",
      enabled: true,
      order: orderCounter++,
    }),
  },
  {
    type: "smaa",
    displayName: "SMAA",
    category: "anti-aliasing",
    description: "Subpixel morphological anti-aliasing",
    defaultConfig: (): SMAAConfig => ({
      type: "smaa",
      enabled: true,
      order: orderCounter++,
    }),
  },
  {
    type: "ssaa",
    displayName: "SSAA",
    category: "anti-aliasing",
    description: "Super-sampling anti-aliasing (expensive)",
    defaultConfig: (): SSAAConfig => ({
      type: "ssaa",
      enabled: true,
      order: orderCounter++,
      sampleLevel: 4,
      unbiased: true,
    }),
  },
  {
    type: "taa",
    displayName: "TAA",
    category: "anti-aliasing",
    description: "Temporal anti-aliasing",
    defaultConfig: (): TAAConfig => ({
      type: "taa",
      enabled: true,
      order: orderCounter++,
      sampleLevel: 4,
      accumulate: false,
    }),
  },

  // ========== Bloom ==========
  {
    type: "bloom",
    displayName: "Bloom",
    category: "bloom",
    description: "Unreal-style bloom effect",
    defaultConfig: (): BloomConfig => ({
      type: "bloom",
      enabled: true,
      order: orderCounter++,
      strength: 1.0,
      radius: 0.4,
      threshold: 0.85,
    }),
  },

  // ========== Ambient Occlusion ==========
  {
    type: "ssao",
    displayName: "SSAO",
    category: "ambient-occlusion",
    description: "Screen-space ambient occlusion",
    defaultConfig: (): SSAOConfig => ({
      type: "ssao",
      enabled: true,
      order: orderCounter++,
      kernelRadius: 8,
      minDistance: 0.005,
      maxDistance: 0.1,
      output: "default",
    }),
  },
  {
    type: "sao",
    displayName: "SAO",
    category: "ambient-occlusion",
    description: "Scalable ambient occlusion",
    defaultConfig: (): SAOConfig => ({
      type: "sao",
      enabled: true,
      order: orderCounter++,
      saoBias: 0.5,
      saoIntensity: 0.25,
      saoScale: 1,
      saoKernelRadius: 100,
      saoMinResolution: 0,
      saoBlur: true,
      saoBlurRadius: 8,
      saoBlurStdDev: 4,
      saoBlurDepthCutoff: 0.01,
    }),
  },
  {
    type: "gtao",
    displayName: "GTAO",
    category: "ambient-occlusion",
    description: "Ground truth ambient occlusion",
    defaultConfig: (): GTAOConfig => ({
      type: "gtao",
      enabled: true,
      order: orderCounter++,
      blendIntensity: 1.0,
      output: "default",
    }),
  },

  // ========== Outline ==========
  {
    type: "outline",
    displayName: "Outline",
    category: "outline",
    description: "Outline selected objects",
    defaultConfig: (): OutlineConfig => ({
      type: "outline",
      enabled: true,
      order: orderCounter++,
      selectedObjects: [],
      visibleEdgeColor: { r: 1, g: 1, b: 1 },
      hiddenEdgeColor: { r: 0.1, g: 0.04, b: 0.02 },
      edgeThickness: 1,
      edgeStrength: 3,
      edgeGlow: 0,
      pulsePeriod: 0,
    }),
  },

  // ========== Depth of Field ==========
  {
    type: "bokeh",
    displayName: "Depth of Field (Bokeh)",
    category: "depth-of-field",
    description: "Bokeh-style depth of field blur",
    defaultConfig: (): BokehConfig => ({
      type: "bokeh",
      enabled: true,
      order: orderCounter++,
      focus: 1.0,
      aperture: 0.025,
      maxblur: 0.01,
    }),
  },

  // ========== Color Effects ==========
  {
    type: "vignette",
    displayName: "Vignette",
    category: "color",
    description: "Darken edges of screen",
    defaultConfig: (): VignetteConfig => ({
      type: "vignette",
      enabled: true,
      order: orderCounter++,
      offset: 1.0,
      darkness: 1.0,
    }),
  },
  {
    type: "sepia",
    displayName: "Sepia",
    category: "color",
    description: "Sepia tone effect",
    defaultConfig: (): SepiaConfig => ({
      type: "sepia",
      enabled: true,
      order: orderCounter++,
      amount: 1.0,
    }),
  },
  {
    type: "brightnessContrast",
    displayName: "Brightness / Contrast",
    category: "color",
    description: "Adjust brightness and contrast",
    defaultConfig: (): BrightnessContrastConfig => ({
      type: "brightnessContrast",
      enabled: true,
      order: orderCounter++,
      brightness: 0,
      contrast: 0,
    }),
  },
  {
    type: "hueSaturation",
    displayName: "Hue / Saturation",
    category: "color",
    description: "Adjust hue and saturation",
    defaultConfig: (): HueSaturationConfig => ({
      type: "hueSaturation",
      enabled: true,
      order: orderCounter++,
      hue: 0,
      saturation: 0,
    }),
  },
  {
    type: "colorCorrection",
    displayName: "Color Correction",
    category: "color",
    description: "RGB color correction curves",
    defaultConfig: (): ColorCorrectionConfig => ({
      type: "colorCorrection",
      enabled: true,
      order: orderCounter++,
      powRGB: { r: 1, g: 1, b: 1 },
      mulRGB: { r: 1, g: 1, b: 1 },
      addRGB: { r: 0, g: 0, b: 0 },
    }),
  },
  {
    type: "rgbShift",
    displayName: "RGB Shift (Chromatic Aberration)",
    category: "color",
    description: "Chromatic aberration / RGB shift effect",
    defaultConfig: (): RGBShiftConfig => ({
      type: "rgbShift",
      enabled: true,
      order: orderCounter++,
      amount: 0.005,
      angle: 0,
    }),
  },

  // ========== Stylized Effects ==========
  {
    type: "film",
    displayName: "Film Grain",
    category: "stylized",
    description: "Film grain effect",
    defaultConfig: (): FilmConfig => ({
      type: "film",
      enabled: true,
      order: orderCounter++,
      intensity: 0.5,
    }),
  },
  {
    type: "glitch",
    displayName: "Glitch",
    category: "stylized",
    description: "Digital glitch effect",
    defaultConfig: (): GlitchConfig => ({
      type: "glitch",
      enabled: true,
      order: orderCounter++,
      goWild: false,
    }),
  },
  {
    type: "dotScreen",
    displayName: "Dot Screen",
    category: "stylized",
    description: "Halftone dot pattern",
    defaultConfig: (): DotScreenConfig => ({
      type: "dotScreen",
      enabled: true,
      order: orderCounter++,
      scale: 4,
      angle: 0,
    }),
  },
  {
    type: "pixelate",
    displayName: "Pixelate",
    category: "stylized",
    description: "Pixelation effect with edge detection",
    defaultConfig: (): PixelateConfig => ({
      type: "pixelate",
      enabled: true,
      order: orderCounter++,
      pixelSize: 6,
      normalEdgeStrength: 0.3,
      depthEdgeStrength: 0.4,
    }),
  },
  {
    type: "halftone",
    displayName: "Halftone",
    category: "stylized",
    description: "Halftone printing effect",
    defaultConfig: (): HalftoneConfig => ({
      type: "halftone",
      enabled: true,
      order: orderCounter++,
      shape: 1,
      radius: 4,
      scatter: 0,
      blending: 1,
      blendingMode: 1,
      greyscale: false,
    }),
  },
  {
    type: "afterimage",
    displayName: "Afterimage",
    category: "stylized",
    description: "Motion blur / trailing effect",
    defaultConfig: (): AfterimageConfig => ({
      type: "afterimage",
      enabled: true,
      order: orderCounter++,
      damp: 0.96,
    }),
  },
];

/**
 * Get effect metadata by type
 */
export function getEffectMetadata(type: EffectType): EffectMetadata | undefined {
  return EFFECT_REGISTRY.find((e) => e.type === type);
}

/**
 * Get all effects in a category
 */
export function getEffectsByCategory(
  category: EffectMetadata["category"]
): EffectMetadata[] {
  return EFFECT_REGISTRY.filter((e) => e.category === category);
}

/**
 * Get all effect categories in display order
 */
export function getEffectCategories(): EffectMetadata["category"][] {
  return [
    "anti-aliasing",
    "bloom",
    "ambient-occlusion",
    "outline",
    "depth-of-field",
    "color",
    "stylized",
  ];
}

/**
 * Format category name for display
 */
export function formatCategoryName(category: EffectMetadata["category"]): string {
  switch (category) {
    case "anti-aliasing":
      return "Anti-Aliasing";
    case "bloom":
      return "Bloom";
    case "ambient-occlusion":
      return "Ambient Occlusion";
    case "outline":
      return "Outline";
    case "depth-of-field":
      return "Depth of Field";
    case "color":
      return "Color";
    case "stylized":
      return "Stylized";
    default:
      return category;
  }
}
