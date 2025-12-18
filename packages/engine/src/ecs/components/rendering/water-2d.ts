/**
 * Water2D Component
 *
 * Represents a 2D water surface with reflection effects.
 * Captures what's already been rendered (based on render order) and displays it as a
 * distorted, animated reflection with configurable water color.
 *
 * Features:
 * - Screen-space reflections (flipped Y) based on render order
 * - Animated wave distortion using noise
 * - Configurable water color and opacity
 * - Foam/surface texture pattern
 * - Size controlled via Transform.scale (like Sprite2D)
 */

import { component } from '../../component.js';

/**
 * Water2D component data
 */
export interface Water2DData {
  /**
   * Base size of the water quad before Transform.scale is applied.
   * Similar to how Sprite2D works - the actual water size = baseSize * transform.scale.
   * @default { x: 1, y: 1 }
   */
  baseSize: { x: number; y: number };

  /**
   * Surface position within the water quad (0-1 range).
   * Controls where the water reflection effect starts vertically within the quad.
   *
   * - 0.0 = surface at bottom of quad (entire quad shows water/reflection)
   * - 0.5 = surface at middle (top half transparent, bottom half shows water)
   * - 1.0 = surface at top (no water visible, entire quad transparent)
   *
   * Use Transform.position to place the water surface in the world.
   * @default 0.0 (full water area visible)
   */
  surfacePosition: number;

  /**
   * Water base color (RGBA, 0-1 range)
   * This color is blended with the reflection.
   * @default { r: 0.26, g: 0.23, b: 0.73, a: 1.0 } (blue-purple)
   */
  waterColor: { r: number; g: number; b: number; a: number };

  /**
   * Opacity of the water color overlay (0-1)
   * Higher values make the water color more dominant over the reflection.
   * @default 0.35
   */
  waterOpacity: number;

  /**
   * Speed of wave animation
   * Higher values make waves move faster.
   * @default 0.05
   */
  waveSpeed: number;

  /**
   * Strength of wave distortion effect (0-1)
   * Higher values create more dramatic wave warping.
   * @default 0.2
   */
  waveDistortion: number;

  /**
   * Wave frequency multiplier
   * Higher values create more wave repetitions vertically.
   * @default 7
   */
  waveMultiplier: number;

  /**
   * Enable foam/water surface texture pattern
   * When true, adds a foam-like pattern on the water surface.
   * @default true
   */
  enableWaterTexture: boolean;

  /**
   * Foam scale (X, Y)
   * Controls the size/repetition of the foam pattern.
   * Higher values = smaller, more repetitive foam.
   * @default { x: 3, y: 8 }
   */
  foamScale: { x: number; y: number };

  /**
   * Foam speed
   * Controls how fast the foam pattern moves.
   * @default 0.02
   */
  foamSpeed: number;

  /**
   * Foam intensity (0-1)
   * Controls how visible/strong the foam effect is.
   * @default 0.22
   */
  foamIntensity: number;

  /**
   * Foam threshold (0-1)
   * Controls the cutoff for foam visibility.
   * Lower values = more foam, higher values = less foam.
   * @default 0.25
   */
  foamThreshold: number;

  /**
   * X offset for reflection position
   * Use to fine-tune where the reflection appears horizontally.
   * @default 0.0
   */
  reflectionOffsetX: number;

  /**
   * Y offset for reflection position
   * Use to fine-tune where the reflection appears vertically.
   * @default 0.0
   */
  reflectionOffsetY: number;

  /**
   * Sorting layer for Z-ordering (higher = rendered later/on top)
   * Water should typically have a high sorting layer to render after
   * everything it needs to reflect.
   * @default 100
   */
  sortingLayer: number;

  /**
   * Sorting order within the layer (higher = rendered later/on top)
   * @default 0
   */
  sortingOrder: number;

  /**
   * Whether the water is visible
   * @default true
   */
  visible: boolean;

  /**
   * Whether the water surface is affected by scene lighting
   * When true, foam and water color are modulated by ambient light.
   * Reflections are never lit (they're already lit from the reflected scene).
   * @default false
   */
  isLit: boolean;

  /**
   * Overall wetness effect intensity (0-1)
   * Controls how visible the wetness texture patterns are.
   * Higher values make water look more "wet" and textured.
   * Set to 0 to disable wetness effect entirely.
   * @default 0.45
   */
  wetnessIntensity: number;

  /**
   * Wetness opacity/visibility (0-1)
   * Controls the overall opacity of the wetness effect.
   * This multiplies with wetnessIntensity to control final wetness strength.
   * Useful for fading wetness in/out independently from its pattern intensity.
   * @default 1.0
   */
  wetnessOpacity: number;

  /**
   * Scale of base wetness pattern (X, Y)
   * Controls the size of large-scale flowing patterns.
   * Higher values = smaller, more frequent patterns.
   * @default { x: 8, y: 12 }
   */
  wetnessScale: { x: number; y: number };

  /**
   * Speed of wetness pattern animation
   * Controls how fast the wetness texture flows horizontally.
   * @default 0.03
   */
  wetnessSpeed: number;

  /**
   * Scale of wetness detail layer (X, Y)
   * Controls the size of fine detail patterns.
   * @default { x: 20, y: 30 }
   */
  wetnessDetailScale: { x: number; y: number };

  /**
   * Speed of wetness detail animation
   * Usually slower than base for depth effect.
   * @default 0.015
   */
  wetnessDetailSpeed: number;

  /**
   * Contrast of wetness patterns (0-2)
   * Higher values create more dramatic light/dark variation.
   * @default 1.2
   */
  wetnessContrast: number;

  /**
   * Brightness adjustment for wetness (-1 to 1)
   * Positive values brighten, negative darken.
   * @default 0.1
   */
  wetnessBrightness: number;

  /**
   * RGB color tint for wetness effect (0-1 range)
   * Multiplied with water color to create wetness color.
   * @default { r: 0.9, g: 0.95, b: 1.0 } (subtle blue tint)
   */
  wetnessColorTint: { r: number; g: number; b: number };

  /**
   * Softness of foam edges (0-3)
   * Controls the smoothness of foam edge transitions.
   * 0 = sharp pixel-art edges (almost binary)
   * 1 = subtle anti-aliasing
   * 3 = very soft, blurry edges
   * @default 1.0
   */
  foamSoftness: number;

  /**
   * Foam turbulence intensity (0-1)
   * Controls vertical/swirling movement of foam patterns.
   * Higher values create more chaotic, turbulent foam motion.
   * @default 0.3
   */
  foamTurbulence: number;

  /**
   * Foam animation speed
   * Controls how fast foam appears and disappears.
   * Higher values make foam pulse/fade faster.
   * @default 0.5
   */
  foamAnimationSpeed: number;

  /**
   * Number of foam layers (1-3)
   * Controls detail level of foam animation.
   * 1 = Single layer (best performance)
   * 2 = Two layers with different scales (balanced)
   * 3 = Three layers with morphing patterns (most detailed)
   * @default 2
   */
  foamLayerCount: number;
}

export const Water2D = component<Water2DData>(
  'Water2D',
  {
    baseSize: {
      serializable: true,
    },
    surfacePosition: {
      serializable: true,
    },
    waterColor: {
      serializable: true,
    },
    waterOpacity: {
      serializable: true,
    },
    waveSpeed: {
      serializable: true,
    },
    waveDistortion: {
      serializable: true,
    },
    waveMultiplier: {
      serializable: true,
    },
    enableWaterTexture: {
      serializable: true,
    },
    foamScale: {
      serializable: true,
    },
    foamSpeed: {
      serializable: true,
    },
    foamIntensity: {
      serializable: true,
    },
    foamThreshold: {
      serializable: true,
    },
    reflectionOffsetX: {
      serializable: true,
    },
    reflectionOffsetY: {
      serializable: true,
    },
    sortingLayer: {
      serializable: true,
    },
    sortingOrder: {
      serializable: true,
    },
    visible: {
      serializable: true,
    },
    isLit: {
      serializable: true,
    },
    wetnessIntensity: {
      serializable: true,
    },
    wetnessOpacity: {
      serializable: true,
    },
    wetnessScale: {
      serializable: true,
    },
    wetnessSpeed: {
      serializable: true,
    },
    wetnessDetailScale: {
      serializable: true,
    },
    wetnessDetailSpeed: {
      serializable: true,
    },
    wetnessContrast: {
      serializable: true,
    },
    wetnessBrightness: {
      serializable: true,
    },
    wetnessColorTint: {
      serializable: true,
    },
    foamSoftness: {
      serializable: true,
    },
    foamTurbulence: {
      serializable: true,
    },
    foamAnimationSpeed: {
      serializable: true,
    },
    foamLayerCount: {
      serializable: true,
    },
  },
  {
    path: 'rendering/2d',
    defaultValue: () => ({
      baseSize: { x: 1, y: 1 },
      surfacePosition: 0.0,
      waterColor: { r: 0.26, g: 0.23, b: 0.73, a: 1.0 },
      waterOpacity: 0.25,
      waveSpeed: 0.05,
      waveDistortion: 0.2,
      waveMultiplier: 7,
      enableWaterTexture: true,
      foamScale: { x: 3, y: 8 },
      foamSpeed: 0.02,
      foamIntensity: 0.22,
      foamThreshold: 0.25,
      reflectionOffsetX: 0.0,
      reflectionOffsetY: 0.0,
      sortingLayer: 100,
      sortingOrder: 0,
      visible: true,
      isLit: false,
      wetnessIntensity: 0.45,
      wetnessOpacity: 1.0,
      wetnessScale: { x: 8, y: 12 },
      wetnessSpeed: 0.03,
      wetnessDetailScale: { x: 20, y: 30 },
      wetnessDetailSpeed: 0.015,
      wetnessContrast: 1.2,
      wetnessBrightness: 0.1,
      wetnessColorTint: { r: 0.9, g: 0.95, b: 1.0 },
      foamSoftness: 1.0,
      foamTurbulence: 0.3,
      foamAnimationSpeed: 0.5,
      foamLayerCount: 2,
    }),
    displayName: 'Water 2D',
    description: '2D water surface with animated reflections',
  },
);
