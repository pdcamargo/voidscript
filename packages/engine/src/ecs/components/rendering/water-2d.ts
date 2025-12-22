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
import { ImGui } from '@mori2003/jsimgui';

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
  ImGui.TextColored({ x: 0.4, y: 0.8, z: 1.0, w: 1.0 }, 'Water Preset');
  ImGui.SameLine();

  const presetMap: Record<WaterPreset, string> = {
    'custom': 'Custom',
    'calm-lake': 'Calm Lake',
    'ocean-waves': 'Ocean Waves',
    'river-stream': 'River/Stream',
    'swamp-lava': 'Swamp/Lava',
  };

  const presetLabel = presetMap[currentPreset];

  if (ImGui.BeginCombo('##waterPreset', presetLabel)) {
    for (const [preset, label] of Object.entries(presetMap)) {
      const isSelected = currentPreset === preset;
      if (ImGui.Selectable(label, isSelected)) {
        if (preset !== 'custom') {
          // Apply preset
          const presetData = WATER_PRESETS[preset as Exclude<WaterPreset, 'custom'>];
          Object.assign(data, presetData);
          lastAppliedPresetData = { ...presetData };
          currentPreset = preset as WaterPreset;
        } else {
          currentPreset = 'custom';
          lastAppliedPresetData = null;
        }
      }
      if (isSelected) {
        ImGui.SetItemDefaultFocus();
      }
    }
    ImGui.EndCombo();
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
  if (ImGui.CollapsingHeader('🌊 Surface & Visibility##surface')) {
    ImGui.Indent();

    // baseSize Vec2 inline
    ImGui.Text('Base Size:');
    const baseX: [number] = [data.baseSize.x];
    const baseY: [number] = [data.baseSize.y];
    ImGui.SetNextItemWidth(100);
    ImGui.DragFloat('##baseSizeX', baseX, 0.01, 0.1, 100);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Base size of water surface before transform scaling');
    }
    ImGui.SameLine();
    ImGui.Text('×');
    ImGui.SameLine();
    ImGui.SetNextItemWidth(100);
    ImGui.DragFloat('##baseSizeY', baseY, 0.01, 0.1, 100);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Base size of water surface before transform scaling');
    }
    data.baseSize.x = baseX[0];
    data.baseSize.y = baseY[0];

    ImGui.Spacing();

    // surfacePosition slider
    ImGui.Text('Surface Position:');
    const surfacePos: [number] = [data.surfacePosition];
    ImGui.SliderFloat('##surfacePosition', surfacePos, 0.0, 1.0);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Vertical position of water surface (0=bottom, 1=top)');
    }
    data.surfacePosition = surfacePos[0];

    ImGui.Spacing();

    // visible checkbox
    const visible: [boolean] = [data.visible];
    ImGui.Checkbox('Visible', visible);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Toggle water visibility');
    }
    data.visible = visible[0];

    ImGui.Spacing();

    // sortingLayer and sortingOrder
    ImGui.Text('Sorting Layer:');
    const sortingLayer: [number] = [data.sortingLayer];
    ImGui.DragInt('##sortingLayer', sortingLayer, 1, 0, 1000);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Z-ordering for layered rendering (higher = rendered later)');
    }
    data.sortingLayer = sortingLayer[0];

    ImGui.Text('Sorting Order:');
    const sortingOrder: [number] = [data.sortingOrder];
    ImGui.DragInt('##sortingOrder', sortingOrder, 1, -1000, 1000);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Secondary Z-ordering within the same layer');
    }
    data.sortingOrder = sortingOrder[0];

    ImGui.Spacing();

    // isLit checkbox
    const isLit: [boolean] = [data.isLit];
    ImGui.Checkbox('Lit by Scene Lighting', isLit);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Enable scene lighting to affect water surface');
    }
    data.isLit = isLit[0];

    ImGui.Unindent();
  }
}

function renderWaterAppearanceSection(data: Water2DData): void {
  if (ImGui.CollapsingHeader('💧 Water Appearance##waterAppearance')) {
    ImGui.Indent();

    // waterColor (RGBA color picker)
    ImGui.Text('Water Color:');
    const waterColor: [number, number, number, number] = [
      data.waterColor.r,
      data.waterColor.g,
      data.waterColor.b,
      data.waterColor.a,
    ];
    if (ImGui.ColorEdit4('##waterColor', waterColor)) {
      data.waterColor.r = waterColor[0];
      data.waterColor.g = waterColor[1];
      data.waterColor.b = waterColor[2];
      data.waterColor.a = waterColor[3];
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Tint color applied to water reflections');
    }

    ImGui.Spacing();

    // waterOpacity slider
    ImGui.Text('Water Opacity:');
    const waterOpacity: [number] = [data.waterOpacity];
    ImGui.SliderFloat('##waterOpacity', waterOpacity, 0.0, 1.0);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Strength of the color tint overlay');
    }
    data.waterOpacity = waterOpacity[0];

    ImGui.Unindent();
  }
}

function renderWaveSection(data: Water2DData): void {
  if (ImGui.CollapsingHeader('🌀 Wave Animation##waveAnimation')) {
    ImGui.Indent();

    // waveSpeed slider
    ImGui.Text('Wave Speed:');
    const waveSpeed: [number] = [data.waveSpeed];
    ImGui.SliderFloat('##waveSpeed', waveSpeed, 0.0, 0.2);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Animation speed of wave movement');
    }
    data.waveSpeed = waveSpeed[0];

    ImGui.Spacing();

    // waveDistortion slider
    ImGui.Text('Wave Distortion:');
    const waveDistortion: [number] = [data.waveDistortion];
    ImGui.SliderFloat('##waveDistortion', waveDistortion, 0.0, 1.0);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Warping strength of wave patterns');
    }
    data.waveDistortion = waveDistortion[0];

    ImGui.Spacing();

    // waveMultiplier slider
    ImGui.Text('Wave Multiplier:');
    const waveMultiplier: [number] = [data.waveMultiplier];
    ImGui.SliderFloat('##waveMultiplier', waveMultiplier, 1, 30);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Frequency/density of waves (higher = more waves)');
    }
    data.waveMultiplier = waveMultiplier[0];

    ImGui.Unindent();
  }
}

function renderReflectionSection(data: Water2DData): void {
  if (ImGui.CollapsingHeader('🪞 Reflection##reflection')) {
    ImGui.Indent();

    // reflectionOffset inline
    ImGui.Text('Reflection Offset:');
    const offsetX: [number] = [data.reflectionOffsetX];
    const offsetY: [number] = [data.reflectionOffsetY];
    ImGui.SetNextItemWidth(100);
    ImGui.DragFloat('X##reflOffsetX', offsetX, 0.001, -1.0, 1.0);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Fine-tune reflection position offset horizontally');
    }
    ImGui.SameLine();
    ImGui.SetNextItemWidth(100);
    ImGui.DragFloat('Y##reflOffsetY', offsetY, 0.001, -1.0, 1.0);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Fine-tune reflection position offset vertically');
    }
    data.reflectionOffsetX = offsetX[0];
    data.reflectionOffsetY = offsetY[0];

    ImGui.Spacing();

    // reflectionSkew inline
    ImGui.Text('Reflection Skew:');
    const skewX: [number] = [data.reflectionSkewX];
    const skewY: [number] = [data.reflectionSkewY];
    ImGui.SetNextItemWidth(100);
    ImGui.DragFloat('X##reflSkewX', skewX, 0.001, -0.5, 0.5);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Perspective distortion for reflection angle (horizontal)');
    }
    ImGui.SameLine();
    ImGui.SetNextItemWidth(100);
    ImGui.DragFloat('Y##reflSkewY', skewY, 0.001, -0.5, 0.5);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Perspective distortion for reflection angle (vertical)');
    }
    data.reflectionSkewX = skewX[0];
    data.reflectionSkewY = skewY[0];

    ImGui.Unindent();
  }
}

function renderFoamSection(data: Water2DData): void {
  if (ImGui.CollapsingHeader('🫧 Foam Effects##foamEffects')) {
    ImGui.Indent();

    // enableWaterTexture checkbox (master toggle)
    const enableFoam: [boolean] = [data.enableWaterTexture];
    ImGui.Checkbox('Enable Foam Texture', enableFoam);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Enable foam texture layer on water surface');
    }
    data.enableWaterTexture = enableFoam[0];

    // Only show foam settings if enabled
    if (data.enableWaterTexture) {
      ImGui.Indent();
      ImGui.Spacing();

      // foamScale Vec2 inline
      ImGui.Text('Foam Scale:');
      const foamScaleX: [number] = [data.foamScale.x];
      const foamScaleY: [number] = [data.foamScale.y];
      ImGui.SetNextItemWidth(100);
      ImGui.DragFloat('##foamScaleX', foamScaleX, 0.1, 0.1, 50);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Size of foam pattern (larger = bigger foam patches)');
      }
      ImGui.SameLine();
      ImGui.Text('×');
      ImGui.SameLine();
      ImGui.SetNextItemWidth(100);
      ImGui.DragFloat('##foamScaleY', foamScaleY, 0.1, 0.1, 50);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Size of foam pattern (larger = bigger foam patches)');
      }
      data.foamScale.x = foamScaleX[0];
      data.foamScale.y = foamScaleY[0];

      ImGui.Spacing();

      // foamSpeed slider
      ImGui.Text('Foam Speed:');
      const foamSpeed: [number] = [data.foamSpeed];
      ImGui.SliderFloat('##foamSpeed', foamSpeed, 0.0, 0.1);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Animation speed of foam movement');
      }
      data.foamSpeed = foamSpeed[0];

      // foamIntensity slider
      ImGui.Text('Foam Intensity:');
      const foamIntensity: [number] = [data.foamIntensity];
      ImGui.SliderFloat('##foamIntensity', foamIntensity, 0.0, 1.0);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Visibility strength of foam (0=invisible, 1=opaque)');
      }
      data.foamIntensity = foamIntensity[0];

      // foamThreshold slider
      ImGui.Text('Foam Threshold:');
      const foamThreshold: [number] = [data.foamThreshold];
      ImGui.SliderFloat('##foamThreshold', foamThreshold, 0.0, 1.0);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Cutoff point for foam visibility (higher = less foam)');
      }
      data.foamThreshold = foamThreshold[0];

      // foamSoftness slider
      ImGui.Text('Foam Softness:');
      const foamSoftness: [number] = [data.foamSoftness];
      ImGui.SliderFloat('##foamSoftness', foamSoftness, 0.0, 3.0);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Edge smoothness of foam patterns');
      }
      data.foamSoftness = foamSoftness[0];

      // foamTurbulence slider
      ImGui.Text('Foam Turbulence:');
      const foamTurbulence: [number] = [data.foamTurbulence];
      ImGui.SliderFloat('##foamTurbulence', foamTurbulence, 0.0, 1.0);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Chaotic motion in foam animation');
      }
      data.foamTurbulence = foamTurbulence[0];

      // foamAnimationSpeed slider
      ImGui.Text('Foam Anim Speed:');
      const foamAnimSpeed: [number] = [data.foamAnimationSpeed];
      ImGui.SliderFloat('##foamAnimSpeed', foamAnimSpeed, 0.0, 2.0);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Pulsing/fading speed of foam');
      }
      data.foamAnimationSpeed = foamAnimSpeed[0];

      // foamLayerCount slider (int)
      ImGui.Text('Foam Layer Count:');
      const foamLayers: [number] = [data.foamLayerCount];
      ImGui.SliderInt('##foamLayerCount', foamLayers, 1, 3);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Detail layers for foam (more layers = finer detail)');
      }
      data.foamLayerCount = foamLayers[0];

      ImGui.Unindent();
    }

    ImGui.Unindent();
  }
}

function renderWetnessSection(data: Water2DData): void {
  if (ImGui.CollapsingHeader('💦 Wetness Effects##wetnessEffects')) {
    ImGui.Indent();

    // wetnessIntensity slider (master control)
    ImGui.Text('Wetness Intensity:');
    const wetnessIntensity: [number] = [data.wetnessIntensity];
    ImGui.SliderFloat('##wetnessIntensity', wetnessIntensity, 0.0, 1.0);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Overall strength of wetness effect (0=disabled)');
    }
    data.wetnessIntensity = wetnessIntensity[0];

    // Only show wetness settings if intensity > 0
    if (data.wetnessIntensity > 0) {
      ImGui.Indent();
      ImGui.Spacing();

      // wetnessOpacity slider
      ImGui.Text('Wetness Opacity:');
      const wetnessOpacity: [number] = [data.wetnessOpacity];
      ImGui.SliderFloat('##wetnessOpacity', wetnessOpacity, 0.0, 1.0);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Opacity of wetness pattern overlay');
      }
      data.wetnessOpacity = wetnessOpacity[0];

      ImGui.Spacing();

      // wetnessScale Vec2 inline
      ImGui.Text('Wetness Scale:');
      const wetnessScaleX: [number] = [data.wetnessScale.x];
      const wetnessScaleY: [number] = [data.wetnessScale.y];
      ImGui.SetNextItemWidth(100);
      ImGui.DragFloat('##wetnessScaleX', wetnessScaleX, 0.1, 0.1, 50);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Size of wetness pattern');
      }
      ImGui.SameLine();
      ImGui.Text('×');
      ImGui.SameLine();
      ImGui.SetNextItemWidth(100);
      ImGui.DragFloat('##wetnessScaleY', wetnessScaleY, 0.1, 0.1, 50);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Size of wetness pattern');
      }
      data.wetnessScale.x = wetnessScaleX[0];
      data.wetnessScale.y = wetnessScaleY[0];

      ImGui.Spacing();

      // wetnessSpeed slider
      ImGui.Text('Wetness Speed:');
      const wetnessSpeed: [number] = [data.wetnessSpeed];
      ImGui.SliderFloat('##wetnessSpeed', wetnessSpeed, 0.0, 0.1);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Animation speed of wetness pattern');
      }
      data.wetnessSpeed = wetnessSpeed[0];

      ImGui.Spacing();

      // wetnessDetailScale Vec2 inline
      ImGui.Text('Wetness Detail Scale:');
      const detailScaleX: [number] = [data.wetnessDetailScale.x];
      const detailScaleY: [number] = [data.wetnessDetailScale.y];
      ImGui.SetNextItemWidth(100);
      ImGui.DragFloat('##detailScaleX', detailScaleX, 0.1, 0.1, 100);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Size of detail layer for fine wetness variation');
      }
      ImGui.SameLine();
      ImGui.Text('×');
      ImGui.SameLine();
      ImGui.SetNextItemWidth(100);
      ImGui.DragFloat('##detailScaleY', detailScaleY, 0.1, 0.1, 100);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Size of detail layer for fine wetness variation');
      }
      data.wetnessDetailScale.x = detailScaleX[0];
      data.wetnessDetailScale.y = detailScaleY[0];

      ImGui.Spacing();

      // wetnessDetailSpeed slider
      ImGui.Text('Wetness Detail Speed:');
      const detailSpeed: [number] = [data.wetnessDetailSpeed];
      ImGui.SliderFloat('##wetnessDetailSpeed', detailSpeed, 0.0, 0.05);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Animation speed of detail layer');
      }
      data.wetnessDetailSpeed = detailSpeed[0];

      ImGui.Spacing();

      // wetnessContrast slider
      ImGui.Text('Wetness Contrast:');
      const wetnessContrast: [number] = [data.wetnessContrast];
      ImGui.SliderFloat('##wetnessContrast', wetnessContrast, 0.0, 2.0);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Light/dark variation in wetness (1=normal)');
      }
      data.wetnessContrast = wetnessContrast[0];

      // wetnessBrightness slider
      ImGui.Text('Wetness Brightness:');
      const wetnessBrightness: [number] = [data.wetnessBrightness];
      ImGui.SliderFloat('##wetnessBrightness', wetnessBrightness, -1.0, 1.0);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Brightness adjustment (-1=darker, 1=brighter)');
      }
      data.wetnessBrightness = wetnessBrightness[0];

      ImGui.Spacing();

      // wetnessColorTint RGB color picker
      ImGui.Text('Wetness Color Tint:');
      const tint: [number, number, number] = [
        data.wetnessColorTint.r,
        data.wetnessColorTint.g,
        data.wetnessColorTint.b,
      ];
      if (ImGui.ColorEdit3('##wetnessColorTint', tint)) {
        data.wetnessColorTint.r = tint[0];
        data.wetnessColorTint.g = tint[1];
        data.wetnessColorTint.b = tint[2];
      }
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Color tint for wetness effect (default: subtle blue)');
      }

      ImGui.Spacing();

      // tileSize input
      ImGui.Text('Tile Size:');
      const tileSize: [number] = [data.tileSize];
      ImGui.DragFloat('##tileSize', tileSize, 1, 1, 500);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Texture repetition in world units (smaller = more tiling)');
      }
      data.tileSize = tileSize[0];

      ImGui.Unindent();
    }

    ImGui.Unindent();
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
      ImGui.Separator();
      ImGui.Spacing();

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
