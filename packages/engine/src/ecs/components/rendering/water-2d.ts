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
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

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
   * Horizontal skew strength for reflection perspective distortion
   * Creates perspective-like distortion where the reflection skews based on vertical position.
   * Positive values skew right, negative values skew left.
   * @default 0.0
   */
  reflectionSkewX: number;

  /**
   * Vertical skew strength for reflection perspective distortion
   * Creates perspective-like distortion where the reflection skews based on horizontal position.
   * Positive values skew down, negative values skew up.
   * @default 0.0
   */
  reflectionSkewY: number;

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

  /**
   * Size of one texture tile in world units.
   * Higher values = larger patterns, lower values = smaller/more frequent patterns.
   * For example, tileSize=50 means foam/wetness patterns repeat every 50 world units.
   * @default 50
   */
  tileSize: number;
}

// ============================================================================
// Custom Editor - Preset System
// ============================================================================

type WaterPreset = 'custom' | 'calm-lake' | 'ocean-waves' | 'river-stream' | 'swamp-lava';

const WATER_PRESETS: Record<Exclude<WaterPreset, 'custom'>, Partial<Water2DData>> = {
  'calm-lake': {
    waveSpeed: 0.02,
    waveDistortion: 0.1,
    waveMultiplier: 5,
    waterColor: { r: 0.3, g: 0.5, b: 0.8, a: 1.0 },
    waterOpacity: 0.15,
    foamIntensity: 0.08,
    foamSpeed: 0.005,
    foamThreshold: 0.35,
    foamSoftness: 2.0,
    foamTurbulence: 0.1,
    foamAnimationSpeed: 0.3,
    wetnessIntensity: 0.2,
    wetnessOpacity: 0.8,
    wetnessSpeed: 0.01,
    wetnessContrast: 1.0,
    wetnessBrightness: 0.15,
    reflectionOffsetY: 0.0,
    reflectionSkewX: 0.0,
  },
  'ocean-waves': {
    waveSpeed: 0.08,
    waveDistortion: 0.4,
    waveMultiplier: 15,
    waterColor: { r: 0.1, g: 0.3, b: 0.6, a: 1.0 },
    waterOpacity: 0.3,
    foamIntensity: 0.45,
    foamSpeed: 0.03,
    foamThreshold: 0.2,
    foamSoftness: 1.2,
    foamTurbulence: 0.5,
    foamAnimationSpeed: 0.8,
    wetnessIntensity: 0.6,
    wetnessOpacity: 1.0,
    wetnessSpeed: 0.05,
    wetnessContrast: 1.4,
    wetnessBrightness: 0.05,
    reflectionOffsetY: 0.0,
    reflectionSkewX: 0.0,
  },
  'river-stream': {
    waveSpeed: 0.12,
    waveDistortion: 0.25,
    waveMultiplier: 10,
    waterColor: { r: 0.2, g: 0.45, b: 0.65, a: 1.0 },
    waterOpacity: 0.25,
    foamIntensity: 0.35,
    foamSpeed: 0.08,
    foamThreshold: 0.22,
    foamSoftness: 1.5,
    foamTurbulence: 0.4,
    foamAnimationSpeed: 1.0,
    wetnessIntensity: 0.5,
    wetnessOpacity: 0.9,
    wetnessSpeed: 0.1,
    wetnessContrast: 1.3,
    wetnessBrightness: 0.08,
    reflectionOffsetX: 0.02,
    reflectionSkewX: 0.01,
  },
  'swamp-lava': {
    waveSpeed: 0.03,
    waveDistortion: 0.15,
    waveMultiplier: 8,
    waterColor: { r: 0.8, g: 0.3, b: 0.1, a: 1.0 },
    waterOpacity: 0.7,
    foamIntensity: 0.6,
    foamSpeed: 0.01,
    foamThreshold: 0.3,
    foamSoftness: 0.5,
    foamTurbulence: 0.2,
    foamAnimationSpeed: 0.4,
    wetnessIntensity: 0.3,
    wetnessOpacity: 0.6,
    wetnessSpeed: 0.02,
    wetnessContrast: 1.8,
    wetnessBrightness: -0.1,
    wetnessColorTint: { r: 1.0, g: 0.5, b: 0.2 },
    reflectionOffsetY: 0.0,
    reflectionSkewX: 0.0,
  },
};

// Preset state tracking (closure variable)
let currentPreset: WaterPreset = 'custom';
let lastAppliedPresetData: Partial<Water2DData> | null = null;

// ============================================================================
// Custom Editor - Helper Functions
// ============================================================================

function renderPresetSelector(data: Water2DData): void {
  EditorLayout.header('Water Preset', { r: 0.4, g: 0.8, b: 1.0 });
  EditorLayout.sameLine();

  const presetOptions = ['Custom', 'Calm Lake', 'Ocean Waves', 'River/Stream', 'Swamp/Lava'];
  const presetKeys: WaterPreset[] = ['custom', 'calm-lake', 'ocean-waves', 'river-stream', 'swamp-lava'];
  const currentIndex = presetKeys.indexOf(currentPreset);
  const currentLabel = presetOptions[currentIndex] || 'Custom';

  const [newLabel, changed] = EditorLayout.comboField('', currentLabel, presetOptions, {
    id: 'waterPreset',
    tooltip: 'Select a water preset or customize settings',
  });

  if (changed) {
    const newIndex = presetOptions.indexOf(newLabel);
    const newPreset = presetKeys[newIndex] || 'custom';

    if (newPreset !== 'custom') {
      // Apply preset
      const presetData = WATER_PRESETS[newPreset as Exclude<WaterPreset, 'custom'>];
      Object.assign(data, presetData);
      lastAppliedPresetData = { ...presetData };
      currentPreset = newPreset;
    } else {
      currentPreset = 'custom';
      lastAppliedPresetData = null;
    }
  }

  // Auto-detect custom changes
  if (currentPreset !== 'custom' && lastAppliedPresetData) {
    let hasCustomChanges = false;
    for (const key in lastAppliedPresetData) {
      const dataKey = key as keyof Water2DData;
      const presetValue = lastAppliedPresetData[dataKey];
      const currentValue = data[dataKey];

      if (typeof presetValue === 'object' && presetValue !== null) {
        // Compare objects (Vec2, RGB, RGBA)
        if (JSON.stringify(presetValue) !== JSON.stringify(currentValue)) {
          hasCustomChanges = true;
          break;
        }
      } else if (presetValue !== currentValue) {
        hasCustomChanges = true;
        break;
      }
    }

    if (hasCustomChanges) {
      currentPreset = 'custom';
      lastAppliedPresetData = null;
    }
  }
}

function renderSurfaceSection(data: Water2DData): void {
  if (EditorLayout.beginGroup('Surface & Visibility', false)) {
    EditorLayout.beginLabelsWidth(['Base Size', 'Surface Position', 'Visible', 'Sorting Layer', 'Sorting Order', 'Lit by Scene Lighting']);

    // baseSize Vec2
    const [baseSize, baseSizeChanged] = EditorLayout.vector2Field('Base Size', data.baseSize, {
      speed: 0.01,
      min: 0.1,
      max: 100,
      tooltip: 'Base size of water surface before transform scaling',
    });
    if (baseSizeChanged) {
      data.baseSize.x = baseSize.x;
      data.baseSize.y = baseSize.y;
    }

    EditorLayout.spacing();

    // surfacePosition slider
    const [surfacePos, surfacePosChanged] = EditorLayout.numberField('Surface Position', data.surfacePosition, {
      min: 0,
      max: 1,
      useSlider: true,
      tooltip: 'Vertical position of water surface (0=bottom, 1=top)',
    });
    if (surfacePosChanged) data.surfacePosition = surfacePos;

    EditorLayout.spacing();

    // visible checkbox
    const [visible, visibleChanged] = EditorLayout.checkboxField('Visible', data.visible, {
      tooltip: 'Toggle water visibility',
    });
    if (visibleChanged) data.visible = visible;

    EditorLayout.spacing();

    // sortingLayer
    const [sortingLayer, sortingLayerChanged] = EditorLayout.integerField('Sorting Layer', data.sortingLayer, {
      min: 0,
      max: 1000,
      tooltip: 'Z-ordering for layered rendering (higher = rendered later)',
    });
    if (sortingLayerChanged) data.sortingLayer = sortingLayer;

    // sortingOrder
    const [sortingOrder, sortingOrderChanged] = EditorLayout.integerField('Sorting Order', data.sortingOrder, {
      min: -1000,
      max: 1000,
      tooltip: 'Secondary Z-ordering within the same layer',
    });
    if (sortingOrderChanged) data.sortingOrder = sortingOrder;

    EditorLayout.spacing();

    // isLit checkbox
    const [isLit, isLitChanged] = EditorLayout.checkboxField('Lit by Scene Lighting', data.isLit, {
      tooltip: 'Enable scene lighting to affect water surface',
    });
    if (isLitChanged) data.isLit = isLit;

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderWaterAppearanceSection(data: Water2DData): void {
  if (EditorLayout.beginGroup('Water Appearance', false)) {
    EditorLayout.beginLabelsWidth(['Water Color', 'Water Opacity']);

    // waterColor (RGBA color picker)
    const [waterColor, waterColorChanged] = EditorLayout.colorField('Water Color', data.waterColor, {
      hasAlpha: true,
      tooltip: 'Tint color applied to water reflections',
    });
    if (waterColorChanged) {
      data.waterColor.r = waterColor.r;
      data.waterColor.g = waterColor.g;
      data.waterColor.b = waterColor.b;
      data.waterColor.a = waterColor.a ?? 1;
    }

    EditorLayout.spacing();

    // waterOpacity slider
    const [waterOpacity, waterOpacityChanged] = EditorLayout.numberField('Water Opacity', data.waterOpacity, {
      min: 0,
      max: 1,
      useSlider: true,
      tooltip: 'Strength of the color tint overlay',
    });
    if (waterOpacityChanged) data.waterOpacity = waterOpacity;

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderWaveSection(data: Water2DData): void {
  if (EditorLayout.beginGroup('Wave Animation', false)) {
    EditorLayout.beginLabelsWidth(['Wave Speed', 'Wave Distortion', 'Wave Multiplier']);

    // waveSpeed slider
    const [waveSpeed, waveSpeedChanged] = EditorLayout.numberField('Wave Speed', data.waveSpeed, {
      min: 0,
      max: 0.2,
      useSlider: true,
      tooltip: 'Animation speed of wave movement',
    });
    if (waveSpeedChanged) data.waveSpeed = waveSpeed;

    EditorLayout.spacing();

    // waveDistortion slider
    const [waveDistortion, waveDistortionChanged] = EditorLayout.numberField('Wave Distortion', data.waveDistortion, {
      min: 0,
      max: 1,
      useSlider: true,
      tooltip: 'Warping strength of wave patterns',
    });
    if (waveDistortionChanged) data.waveDistortion = waveDistortion;

    EditorLayout.spacing();

    // waveMultiplier slider
    const [waveMultiplier, waveMultiplierChanged] = EditorLayout.numberField('Wave Multiplier', data.waveMultiplier, {
      min: 1,
      max: 30,
      useSlider: true,
      tooltip: 'Frequency/density of waves (higher = more waves)',
    });
    if (waveMultiplierChanged) data.waveMultiplier = waveMultiplier;

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderReflectionSection(data: Water2DData): void {
  if (EditorLayout.beginGroup('Reflection', false)) {
    EditorLayout.beginLabelsWidth(['Offset X', 'Offset Y', 'Skew X', 'Skew Y']);

    // reflectionOffset
    const [offsetX, offsetXChanged] = EditorLayout.numberField('Offset X', data.reflectionOffsetX, {
      speed: 0.001,
      min: -1,
      max: 1,
      tooltip: 'Fine-tune reflection position offset horizontally',
      id: 'reflOffsetX',
    });
    if (offsetXChanged) data.reflectionOffsetX = offsetX;

    const [offsetY, offsetYChanged] = EditorLayout.numberField('Offset Y', data.reflectionOffsetY, {
      speed: 0.001,
      min: -1,
      max: 1,
      tooltip: 'Fine-tune reflection position offset vertically',
      id: 'reflOffsetY',
    });
    if (offsetYChanged) data.reflectionOffsetY = offsetY;

    EditorLayout.spacing();

    // reflectionSkew
    const [skewX, skewXChanged] = EditorLayout.numberField('Skew X', data.reflectionSkewX, {
      speed: 0.001,
      min: -0.5,
      max: 0.5,
      tooltip: 'Perspective distortion for reflection angle (horizontal)',
      id: 'reflSkewX',
    });
    if (skewXChanged) data.reflectionSkewX = skewX;

    const [skewY, skewYChanged] = EditorLayout.numberField('Skew Y', data.reflectionSkewY, {
      speed: 0.001,
      min: -0.5,
      max: 0.5,
      tooltip: 'Perspective distortion for reflection angle (vertical)',
      id: 'reflSkewY',
    });
    if (skewYChanged) data.reflectionSkewY = skewY;

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderFoamSection(data: Water2DData): void {
  if (EditorLayout.beginGroup('Foam Effects', false)) {
    EditorLayout.beginLabelsWidth(['Enable Foam Texture']);

    // enableWaterTexture checkbox (master toggle)
    const [enableFoam, enableFoamChanged] = EditorLayout.checkboxField('Enable Foam Texture', data.enableWaterTexture, {
      tooltip: 'Enable foam texture layer on water surface',
    });
    if (enableFoamChanged) data.enableWaterTexture = enableFoam;

    EditorLayout.endLabelsWidth();

    // Only show foam settings if enabled
    if (data.enableWaterTexture) {
      EditorLayout.beginIndent();
      EditorLayout.spacing();

      EditorLayout.beginLabelsWidth(['Foam Scale', 'Foam Speed', 'Foam Intensity', 'Foam Threshold', 'Foam Softness', 'Foam Turbulence', 'Foam Anim Speed', 'Foam Layer Count']);

      // foamScale Vec2
      const [foamScale, foamScaleChanged] = EditorLayout.vector2Field('Foam Scale', data.foamScale, {
        speed: 0.1,
        min: 0.1,
        max: 50,
        tooltip: 'Size of foam pattern (larger = bigger foam patches)',
      });
      if (foamScaleChanged) {
        data.foamScale.x = foamScale.x;
        data.foamScale.y = foamScale.y;
      }

      EditorLayout.spacing();

      // foamSpeed slider
      const [foamSpeed, foamSpeedChanged] = EditorLayout.numberField('Foam Speed', data.foamSpeed, {
        min: 0,
        max: 0.1,
        useSlider: true,
        tooltip: 'Animation speed of foam movement',
      });
      if (foamSpeedChanged) data.foamSpeed = foamSpeed;

      // foamIntensity slider
      const [foamIntensity, foamIntensityChanged] = EditorLayout.numberField('Foam Intensity', data.foamIntensity, {
        min: 0,
        max: 1,
        useSlider: true,
        tooltip: 'Visibility strength of foam (0=invisible, 1=opaque)',
      });
      if (foamIntensityChanged) data.foamIntensity = foamIntensity;

      // foamThreshold slider
      const [foamThreshold, foamThresholdChanged] = EditorLayout.numberField('Foam Threshold', data.foamThreshold, {
        min: 0,
        max: 1,
        useSlider: true,
        tooltip: 'Cutoff point for foam visibility (higher = less foam)',
      });
      if (foamThresholdChanged) data.foamThreshold = foamThreshold;

      // foamSoftness slider
      const [foamSoftness, foamSoftnessChanged] = EditorLayout.numberField('Foam Softness', data.foamSoftness, {
        min: 0,
        max: 3,
        useSlider: true,
        tooltip: 'Edge smoothness of foam patterns',
      });
      if (foamSoftnessChanged) data.foamSoftness = foamSoftness;

      // foamTurbulence slider
      const [foamTurbulence, foamTurbulenceChanged] = EditorLayout.numberField('Foam Turbulence', data.foamTurbulence, {
        min: 0,
        max: 1,
        useSlider: true,
        tooltip: 'Chaotic motion in foam animation',
      });
      if (foamTurbulenceChanged) data.foamTurbulence = foamTurbulence;

      // foamAnimationSpeed slider
      const [foamAnimSpeed, foamAnimSpeedChanged] = EditorLayout.numberField('Foam Anim Speed', data.foamAnimationSpeed, {
        min: 0,
        max: 2,
        useSlider: true,
        tooltip: 'Pulsing/fading speed of foam',
      });
      if (foamAnimSpeedChanged) data.foamAnimationSpeed = foamAnimSpeed;

      // foamLayerCount slider (int)
      const [foamLayers, foamLayersChanged] = EditorLayout.integerField('Foam Layer Count', data.foamLayerCount, {
        min: 1,
        max: 3,
        useSlider: true,
        tooltip: 'Detail layers for foam (more layers = finer detail)',
      });
      if (foamLayersChanged) data.foamLayerCount = foamLayers;

      EditorLayout.endLabelsWidth();
      EditorLayout.endIndent();
    }

    EditorLayout.endGroup();
  }
}

function renderWetnessSection(data: Water2DData): void {
  if (EditorLayout.beginGroup('Wetness Effects', false)) {
    EditorLayout.beginLabelsWidth(['Wetness Intensity']);

    // wetnessIntensity slider (master control)
    const [wetnessIntensity, wetnessIntensityChanged] = EditorLayout.numberField('Wetness Intensity', data.wetnessIntensity, {
      min: 0,
      max: 1,
      useSlider: true,
      tooltip: 'Overall strength of wetness effect (0=disabled)',
    });
    if (wetnessIntensityChanged) data.wetnessIntensity = wetnessIntensity;

    EditorLayout.endLabelsWidth();

    // Only show wetness settings if intensity > 0
    if (data.wetnessIntensity > 0) {
      EditorLayout.beginIndent();
      EditorLayout.spacing();

      EditorLayout.beginLabelsWidth(['Wetness Opacity', 'Wetness Scale', 'Wetness Speed', 'Wetness Detail Scale', 'Wetness Detail Speed', 'Wetness Contrast', 'Wetness Brightness', 'Wetness Color Tint', 'Tile Size']);

      // wetnessOpacity slider
      const [wetnessOpacity, wetnessOpacityChanged] = EditorLayout.numberField('Wetness Opacity', data.wetnessOpacity, {
        min: 0,
        max: 1,
        useSlider: true,
        tooltip: 'Opacity of wetness pattern overlay',
      });
      if (wetnessOpacityChanged) data.wetnessOpacity = wetnessOpacity;

      EditorLayout.spacing();

      // wetnessScale Vec2
      const [wetnessScale, wetnessScaleChanged] = EditorLayout.vector2Field('Wetness Scale', data.wetnessScale, {
        speed: 0.1,
        min: 0.1,
        max: 50,
        tooltip: 'Size of wetness pattern',
      });
      if (wetnessScaleChanged) {
        data.wetnessScale.x = wetnessScale.x;
        data.wetnessScale.y = wetnessScale.y;
      }

      EditorLayout.spacing();

      // wetnessSpeed slider
      const [wetnessSpeed, wetnessSpeedChanged] = EditorLayout.numberField('Wetness Speed', data.wetnessSpeed, {
        min: 0,
        max: 0.1,
        useSlider: true,
        tooltip: 'Animation speed of wetness pattern',
      });
      if (wetnessSpeedChanged) data.wetnessSpeed = wetnessSpeed;

      EditorLayout.spacing();

      // wetnessDetailScale Vec2
      const [detailScale, detailScaleChanged] = EditorLayout.vector2Field('Wetness Detail Scale', data.wetnessDetailScale, {
        speed: 0.1,
        min: 0.1,
        max: 100,
        tooltip: 'Size of detail layer for fine wetness variation',
      });
      if (detailScaleChanged) {
        data.wetnessDetailScale.x = detailScale.x;
        data.wetnessDetailScale.y = detailScale.y;
      }

      EditorLayout.spacing();

      // wetnessDetailSpeed slider
      const [detailSpeed, detailSpeedChanged] = EditorLayout.numberField('Wetness Detail Speed', data.wetnessDetailSpeed, {
        min: 0,
        max: 0.05,
        useSlider: true,
        tooltip: 'Animation speed of detail layer',
      });
      if (detailSpeedChanged) data.wetnessDetailSpeed = detailSpeed;

      EditorLayout.spacing();

      // wetnessContrast slider
      const [wetnessContrast, wetnessContrastChanged] = EditorLayout.numberField('Wetness Contrast', data.wetnessContrast, {
        min: 0,
        max: 2,
        useSlider: true,
        tooltip: 'Light/dark variation in wetness (1=normal)',
      });
      if (wetnessContrastChanged) data.wetnessContrast = wetnessContrast;

      // wetnessBrightness slider
      const [wetnessBrightness, wetnessBrightnessChanged] = EditorLayout.numberField('Wetness Brightness', data.wetnessBrightness, {
        min: -1,
        max: 1,
        useSlider: true,
        tooltip: 'Brightness adjustment (-1=darker, 1=brighter)',
      });
      if (wetnessBrightnessChanged) data.wetnessBrightness = wetnessBrightness;

      EditorLayout.spacing();

      // wetnessColorTint RGB color picker
      const [colorTint, colorTintChanged] = EditorLayout.colorField('Wetness Color Tint', data.wetnessColorTint, {
        tooltip: 'Color tint for wetness effect (default: subtle blue)',
      });
      if (colorTintChanged) {
        data.wetnessColorTint.r = colorTint.r;
        data.wetnessColorTint.g = colorTint.g;
        data.wetnessColorTint.b = colorTint.b;
      }

      EditorLayout.spacing();

      // tileSize input
      const [tileSize, tileSizeChanged] = EditorLayout.numberField('Tile Size', data.tileSize, {
        speed: 1,
        min: 1,
        max: 500,
        tooltip: 'Texture repetition in world units (smaller = more tiling)',
      });
      if (tileSizeChanged) data.tileSize = tileSize;

      EditorLayout.endLabelsWidth();
      EditorLayout.endIndent();
    }

    EditorLayout.endGroup();
  }
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
    reflectionSkewX: {
      serializable: true,
    },
    reflectionSkewY: {
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
    tileSize: {
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
      reflectionSkewX: 0.0,
      reflectionSkewY: 0.0,
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
      tileSize: 50,
    }),
    displayName: 'Water 2D',
    description: '2D water surface with animated reflections',
    customEditor: ({ componentData }) => {
      // Preset selector at top
      renderPresetSelector(componentData);
      EditorLayout.separator();
      EditorLayout.spacing();

      // Collapsible sections
      renderSurfaceSection(componentData);
      renderWaterAppearanceSection(componentData);
      renderWaveSection(componentData);
      renderReflectionSection(componentData);
      renderFoamSection(componentData);
      renderWetnessSection(componentData);
    },
  },
);
