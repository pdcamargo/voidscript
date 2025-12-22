/**
 * Rain 2D Component
 *
 * Renders 2D pixel-art rain droplets with advanced weather features.
 * Uses world-space tiling to maintain consistent density regardless of entity size.
 *
 * Features:
 * - Pixel-art style droplets with hard edges
 * - Multi-layer depth (near/mid/far parallax)
 * - Wind and angle effects
 * - Lightning flash with timing
 * - Wetness tint overlay
 * - Storm intensity presets
 *
 * @example
 * ```typescript
 * commands.spawn()
 *   .with(Transform3D, {
 *     position: { x: 0, y: 0, z: 50 },
 *     scale: { x: 1000, y: 1000, z: 1 },
 *   })
 *   .with(Rain2D, {
 *     density: 200,
 *     fallSpeed: 900,
 *     enableLightning: true,
 *     stormIntensity: 0.8,
 *   })
 *   .build();
 * ```
 */

import { component } from '../../component.js';
import { ImGui } from '@mori2003/jsimgui';

/**
 * Rain 2D component data
 */
export interface Rain2DData {
  /**
   * Base size of the rain quad before Transform.scale is applied.
   * Similar to how Sprite2D works - the actual rain size = baseSize * transform.scale.
   * @default { x: 1, y: 1 }
   */
  baseSize: { x: number; y: number };

  /**
   * Size of one texture tile in world units.
   * Higher values = larger patterns, lower values = more dense repetition.
   * For example, tileSize=50 means rain patterns repeat every 50 world units.
   * @default 50
   */
  tileSize: number;

  /**
   * Whether the rain is visible
   * @default true
   */
  visible: boolean;

  /**
   * Sorting layer for Z-ordering (higher = rendered later/on top)
   * Rain should typically have a high sorting layer to render on top of most things.
   * @default 500
   */
  sortingLayer: number;

  /**
   * Sorting order within the layer (higher = rendered later/on top)
   * @default 0
   */
  sortingOrder: number;

  /**
   * Rain density - controls the number of droplets.
   * Higher values = more droplets.
   * @default 150
   */
  density: number;

  /**
   * Base fall speed in world units per second.
   * Higher values = faster falling rain.
   * @default 800
   */
  fallSpeed: number;

  /**
   * Speed variation factor (0-1).
   * Higher values = more varied speeds between individual droplets.
   * @default 0.3
   */
  speedVariation: number;

  /**
   * Rain angle in radians (0 = vertical, positive = slant right).
   * @default 0
   */
  angle: number;

  /**
   * Wind effect strength multiplier.
   * Controls how much the rain sways with wind oscillation.
   * @default 0
   */
  windStrength: number;

  /**
   * Wind oscillation speed (for gusts).
   * Higher values = faster wind direction changes.
   * @default 1.0
   */
  windSpeed: number;

  /**
   * Minimum droplet length in pixels.
   * @default 3
   */
  dropletMinLength: number;

  /**
   * Maximum droplet length in pixels.
   * @default 8
   */
  dropletMaxLength: number;

  /**
   * Droplet width in pixels.
   * @default 1
   */
  dropletWidth: number;

  /**
   * Random seed for deterministic droplet placement.
   * @default 0
   */
  seed: number;

  /**
   * Rain droplet color (RGB, 0-1 range).
   * @default { r: 0.7, g: 0.8, b: 0.9 }
   */
  dropletColor: { r: number; g: number; b: number };

  /**
   * Base opacity of rain droplets (0-1).
   * @default 0.6
   */
  dropletOpacity: number;

  /**
   * Enable multi-layer depth effect.
   * When enabled, renders three layers with different speeds and opacities.
   * @default true
   */
  enableLayers: boolean;

  /**
   * Near layer speed multiplier (fastest, largest drops).
   * @default 1.5
   */
  nearLayerSpeed: number;

  /**
   * Near layer opacity.
   * @default 0.8
   */
  nearLayerOpacity: number;

  /**
   * Near layer scale multiplier for droplet size.
   * @default 1.3
   */
  nearLayerScale: number;

  /**
   * Mid layer speed multiplier.
   * @default 1.0
   */
  midLayerSpeed: number;

  /**
   * Mid layer opacity.
   * @default 0.5
   */
  midLayerOpacity: number;

  /**
   * Mid layer scale multiplier.
   * @default 1.0
   */
  midLayerScale: number;

  /**
   * Far layer speed multiplier (slowest, smallest drops).
   * @default 0.6
   */
  farLayerSpeed: number;

  /**
   * Far layer opacity.
   * @default 0.3
   */
  farLayerOpacity: number;

  /**
   * Far layer scale multiplier.
   * @default 0.7
   */
  farLayerScale: number;

  /**
   * Enable wetness tint overlay.
   * @default false
   */
  enableWetnessTint: boolean;

  /**
   * Wetness tint color (RGB, 0-1 range).
   * @default { r: 0.4, g: 0.5, b: 0.6 }
   */
  wetnessTintColor: { r: number; g: number; b: number };

  /**
   * Wetness tint intensity (0-1).
   * @default 0.1
   */
  wetnessTintIntensity: number;

  /**
   * Enable lightning flash effect.
   * @default false
   */
  enableLightning: boolean;

  /**
   * Lightning flash color (RGB, 0-1 range).
   * @default { r: 1.0, g: 1.0, b: 1.0 }
   */
  lightningColor: { r: number; g: number; b: number };

  /**
   * Minimum time between lightning strikes (seconds).
   * @default 5.0
   */
  lightningMinInterval: number;

  /**
   * Maximum time between lightning strikes (seconds).
   * @default 15.0
   */
  lightningMaxInterval: number;

  /**
   * Lightning flash duration (seconds).
   * @default 0.15
   */
  lightningDuration: number;

  /**
   * Lightning flash intensity (0-1).
   * @default 0.8
   */
  lightningIntensity: number;

  /**
   * Overall storm intensity multiplier (0-1).
   * Scales density, speed, and effects together.
   * @default 1.0
   */
  stormIntensity: number;
}

// ============================================================================
// Custom Editor - Preset System
// ============================================================================

type RainPreset =
  | 'custom'
  | 'light-drizzle'
  | 'steady-rain'
  | 'heavy-downpour'
  | 'thunderstorm';

const RAIN_PRESETS: Record<Exclude<RainPreset, 'custom'>, Partial<Rain2DData>> =
  {
    'light-drizzle': {
      density: 50,
      fallSpeed: 400,
      angle: 0.05,
      dropletMinLength: 2,
      dropletMaxLength: 4,
      dropletOpacity: 0.3,
      enableLayers: true,
      nearLayerOpacity: 0.4,
      midLayerOpacity: 0.25,
      farLayerOpacity: 0.15,
      enableWetnessTint: false,
      enableLightning: false,
      stormIntensity: 0.3,
    },
    'steady-rain': {
      density: 150,
      fallSpeed: 700,
      angle: 0.1,
      dropletMinLength: 3,
      dropletMaxLength: 7,
      dropletOpacity: 0.5,
      enableLayers: true,
      nearLayerOpacity: 0.6,
      midLayerOpacity: 0.4,
      farLayerOpacity: 0.25,
      enableWetnessTint: true,
      wetnessTintIntensity: 0.08,
      enableLightning: false,
      stormIntensity: 0.6,
    },
    'heavy-downpour': {
      density: 300,
      fallSpeed: 1000,
      angle: 0.15,
      windStrength: 0.3,
      windSpeed: 1.5,
      dropletMinLength: 5,
      dropletMaxLength: 12,
      dropletOpacity: 0.7,
      enableLayers: true,
      nearLayerOpacity: 0.85,
      midLayerOpacity: 0.6,
      farLayerOpacity: 0.35,
      enableWetnessTint: true,
      wetnessTintIntensity: 0.15,
      enableLightning: false,
      stormIntensity: 0.85,
    },
    thunderstorm: {
      density: 400,
      fallSpeed: 1200,
      angle: 0.2,
      windStrength: 0.6,
      windSpeed: 2.0,
      dropletMinLength: 6,
      dropletMaxLength: 15,
      dropletOpacity: 0.8,
      enableLayers: true,
      nearLayerOpacity: 0.9,
      midLayerOpacity: 0.7,
      farLayerOpacity: 0.4,
      enableWetnessTint: true,
      wetnessTintIntensity: 0.2,
      enableLightning: true,
      lightningMinInterval: 3.0,
      lightningMaxInterval: 10.0,
      lightningIntensity: 0.9,
      stormIntensity: 1.0,
    },
  };

// Preset state tracking (closure variable)
let currentPreset: RainPreset = 'custom';
let lastAppliedPresetData: Partial<Rain2DData> | null = null;

// ============================================================================
// Custom Editor - Helper Functions
// ============================================================================

function renderPresetSelector(data: Rain2DData): void {
  ImGui.TextColored({ x: 0.4, y: 0.8, z: 1.0, w: 1.0 }, 'Rain Preset');
  ImGui.SameLine();

  const presetMap: Record<RainPreset, string> = {
    custom: 'Custom',
    'light-drizzle': 'Light Drizzle',
    'steady-rain': 'Steady Rain',
    'heavy-downpour': 'Heavy Downpour',
    thunderstorm: 'Thunderstorm',
  };

  const presetLabel = presetMap[currentPreset];

  if (ImGui.BeginCombo('##rainPreset', presetLabel)) {
    for (const [preset, label] of Object.entries(presetMap)) {
      const isSelected = currentPreset === preset;
      if (ImGui.Selectable(label, isSelected)) {
        if (preset !== 'custom') {
          // Apply preset
          const presetData =
            RAIN_PRESETS[preset as Exclude<RainPreset, 'custom'>];
          Object.assign(data, presetData);
          lastAppliedPresetData = { ...presetData };
          currentPreset = preset as RainPreset;
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
      const dataKey = key as keyof Rain2DData;
      const presetValue = lastAppliedPresetData[dataKey];
      const currentValue = data[dataKey];

      if (typeof presetValue === 'object' && presetValue !== null) {
        // Compare objects (Vec2, RGB)
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

function renderSizeSection(data: Rain2DData): void {
  if (ImGui.CollapsingHeader('Size & Visibility##rainSize')) {
    ImGui.Indent();

    // baseSize Vec2 inline
    ImGui.Text('Base Size:');
    const baseX: [number] = [data.baseSize.x];
    const baseY: [number] = [data.baseSize.y];
    ImGui.SetNextItemWidth(100);
    ImGui.DragFloat('##baseSizeX', baseX, 0.01, 0.1, 100);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Base size of rain area before transform scaling');
    }
    ImGui.SameLine();
    ImGui.Text('x');
    ImGui.SameLine();
    ImGui.SetNextItemWidth(100);
    ImGui.DragFloat('##baseSizeY', baseY, 0.01, 0.1, 100);
    data.baseSize.x = baseX[0];
    data.baseSize.y = baseY[0];

    ImGui.Spacing();

    // tileSize
    ImGui.Text('Tile Size:');
    const tileSize: [number] = [data.tileSize];
    ImGui.DragFloat('##tileSize', tileSize, 1, 1, 500);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip(
        'World units between pattern repetitions (larger = less dense)',
      );
    }
    data.tileSize = tileSize[0];

    ImGui.Spacing();

    // visible checkbox
    const visible: [boolean] = [data.visible];
    ImGui.Checkbox('Visible', visible);
    data.visible = visible[0];

    ImGui.Spacing();

    // sortingLayer and sortingOrder
    ImGui.Text('Sorting Layer:');
    const sortingLayer: [number] = [data.sortingLayer];
    ImGui.DragInt('##sortingLayer', sortingLayer, 1, -1000, 1000);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Z-ordering for layered rendering (higher = on top)');
    }
    data.sortingLayer = sortingLayer[0];

    ImGui.Text('Sorting Order:');
    const sortingOrder: [number] = [data.sortingOrder];
    ImGui.DragInt('##sortingOrder', sortingOrder, 1, -1000, 1000);
    data.sortingOrder = sortingOrder[0];

    ImGui.Unindent();
  }
}

function renderDropletSection(data: Rain2DData): void {
  if (ImGui.CollapsingHeader('Droplet Properties##rainDroplet')) {
    ImGui.Indent();

    // density
    ImGui.Text('Density:');
    const density: [number] = [data.density];
    ImGui.SliderFloat('##density', density, 10, 500);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Number of droplets (higher = more rain)');
    }
    data.density = density[0];

    // fallSpeed
    ImGui.Text('Fall Speed:');
    const fallSpeed: [number] = [data.fallSpeed];
    ImGui.SliderFloat('##fallSpeed', fallSpeed, 100, 2000);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Base falling speed in world units/second');
    }
    data.fallSpeed = fallSpeed[0];

    // speedVariation
    ImGui.Text('Speed Variation:');
    const speedVariation: [number] = [data.speedVariation];
    ImGui.SliderFloat('##speedVariation', speedVariation, 0, 1);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('How much individual droplet speeds vary');
    }
    data.speedVariation = speedVariation[0];

    ImGui.Spacing();

    // angle
    ImGui.Text('Angle:');
    const angle: [number] = [data.angle];
    ImGui.SliderFloat('##angle', angle, -0.5, 0.5);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Rain slant in radians (0 = vertical)');
    }
    data.angle = angle[0];

    // windStrength
    ImGui.Text('Wind Strength:');
    const windStrength: [number] = [data.windStrength];
    ImGui.SliderFloat('##windStrength', windStrength, 0, 1);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Oscillating wind effect intensity');
    }
    data.windStrength = windStrength[0];

    // windSpeed
    ImGui.Text('Wind Speed:');
    const windSpeed: [number] = [data.windSpeed];
    ImGui.SliderFloat('##windSpeed', windSpeed, 0, 5);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Speed of wind direction changes');
    }
    data.windSpeed = windSpeed[0];

    ImGui.Spacing();

    // droplet dimensions
    ImGui.Text('Droplet Min Length:');
    const dropletMinLength: [number] = [data.dropletMinLength];
    ImGui.SliderFloat('##dropletMinLength', dropletMinLength, 1, 20);
    data.dropletMinLength = dropletMinLength[0];

    ImGui.Text('Droplet Max Length:');
    const dropletMaxLength: [number] = [data.dropletMaxLength];
    ImGui.SliderFloat('##dropletMaxLength', dropletMaxLength, 1, 30);
    data.dropletMaxLength = dropletMaxLength[0];

    ImGui.Text('Droplet Width:');
    const dropletWidth: [number] = [data.dropletWidth];
    ImGui.SliderFloat('##dropletWidth', dropletWidth, 0.5, 5);
    data.dropletWidth = dropletWidth[0];

    ImGui.Spacing();

    // seed
    ImGui.Text('Seed:');
    const seed: [number] = [data.seed];
    ImGui.DragInt('##seed', seed, 1, 0, 999999);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Random seed for deterministic droplet placement');
    }
    data.seed = seed[0];

    ImGui.Spacing();

    // dropletColor
    ImGui.Text('Droplet Color:');
    const dropletColor: [number, number, number] = [
      data.dropletColor.r,
      data.dropletColor.g,
      data.dropletColor.b,
    ];
    if (ImGui.ColorEdit3('##dropletColor', dropletColor)) {
      data.dropletColor.r = dropletColor[0];
      data.dropletColor.g = dropletColor[1];
      data.dropletColor.b = dropletColor[2];
    }

    // dropletOpacity
    ImGui.Text('Droplet Opacity:');
    const dropletOpacity: [number] = [data.dropletOpacity];
    ImGui.SliderFloat('##dropletOpacity', dropletOpacity, 0, 1);
    data.dropletOpacity = dropletOpacity[0];

    ImGui.Unindent();
  }
}

function renderLayerSection(data: Rain2DData): void {
  if (ImGui.CollapsingHeader('Layer Depth##rainLayer')) {
    ImGui.Indent();

    const enableLayers: [boolean] = [data.enableLayers];
    ImGui.Checkbox('Enable Multi-Layer', enableLayers);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip(
        'Enable near/mid/far parallax layers for depth effect',
      );
    }
    data.enableLayers = enableLayers[0];

    if (data.enableLayers) {
      ImGui.Indent();
      ImGui.Spacing();

      // Near layer
      ImGui.TextColored({ x: 1.0, y: 0.8, z: 0.4, w: 1.0 }, 'Near Layer');
      ImGui.Text('Speed:');
      const nearSpeed: [number] = [data.nearLayerSpeed];
      ImGui.SliderFloat('##nearSpeed', nearSpeed, 0.5, 3);
      data.nearLayerSpeed = nearSpeed[0];

      ImGui.Text('Opacity:');
      const nearOpacity: [number] = [data.nearLayerOpacity];
      ImGui.SliderFloat('##nearOpacity', nearOpacity, 0, 1);
      data.nearLayerOpacity = nearOpacity[0];

      ImGui.Text('Scale:');
      const nearScale: [number] = [data.nearLayerScale];
      ImGui.SliderFloat('##nearScale', nearScale, 0.5, 2);
      data.nearLayerScale = nearScale[0];

      ImGui.Spacing();

      // Mid layer
      ImGui.TextColored({ x: 0.8, y: 0.8, z: 1.0, w: 1.0 }, 'Mid Layer');
      ImGui.Text('Speed:');
      const midSpeed: [number] = [data.midLayerSpeed];
      ImGui.SliderFloat('##midSpeed', midSpeed, 0.5, 3);
      data.midLayerSpeed = midSpeed[0];

      ImGui.Text('Opacity:');
      const midOpacity: [number] = [data.midLayerOpacity];
      ImGui.SliderFloat('##midOpacity', midOpacity, 0, 1);
      data.midLayerOpacity = midOpacity[0];

      ImGui.Text('Scale:');
      const midScale: [number] = [data.midLayerScale];
      ImGui.SliderFloat('##midScale', midScale, 0.5, 2);
      data.midLayerScale = midScale[0];

      ImGui.Spacing();

      // Far layer
      ImGui.TextColored({ x: 0.6, y: 0.6, z: 0.8, w: 1.0 }, 'Far Layer');
      ImGui.Text('Speed:');
      const farSpeed: [number] = [data.farLayerSpeed];
      ImGui.SliderFloat('##farSpeed', farSpeed, 0.2, 2);
      data.farLayerSpeed = farSpeed[0];

      ImGui.Text('Opacity:');
      const farOpacity: [number] = [data.farLayerOpacity];
      ImGui.SliderFloat('##farOpacity', farOpacity, 0, 1);
      data.farLayerOpacity = farOpacity[0];

      ImGui.Text('Scale:');
      const farScale: [number] = [data.farLayerScale];
      ImGui.SliderFloat('##farScale', farScale, 0.3, 1.5);
      data.farLayerScale = farScale[0];

      ImGui.Unindent();
    }

    ImGui.Unindent();
  }
}

function renderWetnessTintSection(data: Rain2DData): void {
  if (ImGui.CollapsingHeader('Wetness Tint##rainWetness')) {
    ImGui.Indent();

    const enableWetnessTint: [boolean] = [data.enableWetnessTint];
    ImGui.Checkbox('Enable Wetness Tint', enableWetnessTint);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Add a subtle color overlay simulating wetness');
    }
    data.enableWetnessTint = enableWetnessTint[0];

    if (data.enableWetnessTint) {
      ImGui.Indent();
      ImGui.Spacing();

      ImGui.Text('Tint Color:');
      const wetnessTintColor: [number, number, number] = [
        data.wetnessTintColor.r,
        data.wetnessTintColor.g,
        data.wetnessTintColor.b,
      ];
      if (ImGui.ColorEdit3('##wetnessTintColor', wetnessTintColor)) {
        data.wetnessTintColor.r = wetnessTintColor[0];
        data.wetnessTintColor.g = wetnessTintColor[1];
        data.wetnessTintColor.b = wetnessTintColor[2];
      }

      ImGui.Text('Intensity:');
      const wetnessTintIntensity: [number] = [data.wetnessTintIntensity];
      ImGui.SliderFloat('##wetnessTintIntensity', wetnessTintIntensity, 0, 0.5);
      data.wetnessTintIntensity = wetnessTintIntensity[0];

      ImGui.Unindent();
    }

    ImGui.Unindent();
  }
}

function renderLightningSection(data: Rain2DData): void {
  if (ImGui.CollapsingHeader('Lightning##rainLightning')) {
    ImGui.Indent();

    const enableLightning: [boolean] = [data.enableLightning];
    ImGui.Checkbox('Enable Lightning', enableLightning);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Enable random lightning flash effects');
    }
    data.enableLightning = enableLightning[0];

    if (data.enableLightning) {
      ImGui.Indent();
      ImGui.Spacing();

      ImGui.Text('Flash Color:');
      const lightningColor: [number, number, number] = [
        data.lightningColor.r,
        data.lightningColor.g,
        data.lightningColor.b,
      ];
      if (ImGui.ColorEdit3('##lightningColor', lightningColor)) {
        data.lightningColor.r = lightningColor[0];
        data.lightningColor.g = lightningColor[1];
        data.lightningColor.b = lightningColor[2];
      }

      ImGui.Text('Min Interval:');
      const lightningMinInterval: [number] = [data.lightningMinInterval];
      ImGui.SliderFloat('##lightningMinInterval', lightningMinInterval, 1, 30);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Minimum seconds between lightning strikes');
      }
      data.lightningMinInterval = lightningMinInterval[0];

      ImGui.Text('Max Interval:');
      const lightningMaxInterval: [number] = [data.lightningMaxInterval];
      ImGui.SliderFloat('##lightningMaxInterval', lightningMaxInterval, 1, 60);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Maximum seconds between lightning strikes');
      }
      data.lightningMaxInterval = lightningMaxInterval[0];

      ImGui.Text('Flash Duration:');
      const lightningDuration: [number] = [data.lightningDuration];
      ImGui.SliderFloat('##lightningDuration', lightningDuration, 0.05, 0.5);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Duration of lightning flash in seconds');
      }
      data.lightningDuration = lightningDuration[0];

      ImGui.Text('Flash Intensity:');
      const lightningIntensity: [number] = [data.lightningIntensity];
      ImGui.SliderFloat('##lightningIntensity', lightningIntensity, 0, 1);
      data.lightningIntensity = lightningIntensity[0];

      ImGui.Unindent();
    }

    ImGui.Unindent();
  }
}

function renderStormIntensitySection(data: Rain2DData): void {
  if (ImGui.CollapsingHeader('Storm Intensity##rainStorm')) {
    ImGui.Indent();

    ImGui.Text('Storm Intensity:');
    const stormIntensity: [number] = [data.stormIntensity];
    ImGui.SliderFloat('##stormIntensity', stormIntensity, 0, 1);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip(
        'Master intensity control - scales density and all effects',
      );
    }
    data.stormIntensity = stormIntensity[0];

    ImGui.Unindent();
  }
}

export const Rain2D = component<Rain2DData>(
  'Rain2D',
  {
    baseSize: { serializable: true },
    tileSize: { serializable: true },
    visible: { serializable: true },
    sortingLayer: { serializable: true },
    sortingOrder: { serializable: true },
    density: { serializable: true },
    fallSpeed: { serializable: true },
    speedVariation: { serializable: true },
    angle: { serializable: true },
    windStrength: { serializable: true },
    windSpeed: { serializable: true },
    dropletMinLength: { serializable: true },
    dropletMaxLength: { serializable: true },
    dropletWidth: { serializable: true },
    seed: { serializable: true },
    dropletColor: { serializable: true },
    dropletOpacity: { serializable: true },
    enableLayers: { serializable: true },
    nearLayerSpeed: { serializable: true },
    nearLayerOpacity: { serializable: true },
    nearLayerScale: { serializable: true },
    midLayerSpeed: { serializable: true },
    midLayerOpacity: { serializable: true },
    midLayerScale: { serializable: true },
    farLayerSpeed: { serializable: true },
    farLayerOpacity: { serializable: true },
    farLayerScale: { serializable: true },
    enableWetnessTint: { serializable: true },
    wetnessTintColor: { serializable: true },
    wetnessTintIntensity: { serializable: true },
    enableLightning: { serializable: true },
    lightningColor: { serializable: true },
    lightningMinInterval: { serializable: true },
    lightningMaxInterval: { serializable: true },
    lightningDuration: { serializable: true },
    lightningIntensity: { serializable: true },
    stormIntensity: { serializable: true },
  },
  {
    path: 'rendering/2d',
    defaultValue: () => ({
      baseSize: { x: 1, y: 1 },
      tileSize: 50,
      visible: true,
      sortingLayer: 500,
      sortingOrder: 0,
      density: 150,
      fallSpeed: 800,
      speedVariation: 0.3,
      angle: 0,
      windStrength: 0,
      windSpeed: 1.0,
      dropletMinLength: 3,
      dropletMaxLength: 8,
      dropletWidth: 1,
      seed: 0,
      dropletColor: { r: 0.7, g: 0.8, b: 0.9 },
      dropletOpacity: 0.6,
      enableLayers: true,
      nearLayerSpeed: 1.5,
      nearLayerOpacity: 0.8,
      nearLayerScale: 1.3,
      midLayerSpeed: 1.0,
      midLayerOpacity: 0.5,
      midLayerScale: 1.0,
      farLayerSpeed: 0.6,
      farLayerOpacity: 0.3,
      farLayerScale: 0.7,
      enableWetnessTint: false,
      wetnessTintColor: { r: 0.4, g: 0.5, b: 0.6 },
      wetnessTintIntensity: 0.1,
      enableLightning: false,
      lightningColor: { r: 1.0, g: 1.0, b: 1.0 },
      lightningMinInterval: 5.0,
      lightningMaxInterval: 15.0,
      lightningDuration: 0.15,
      lightningIntensity: 0.8,
      stormIntensity: 1.0,
    }),
    displayName: 'Rain 2D',
    description: 'Pixel-art rain effect with advanced weather features',
    customEditor: ({ componentData }) => {
      // Preset selector at top
      renderPresetSelector(componentData);
      ImGui.Separator();
      ImGui.Spacing();

      // Collapsible sections
      renderSizeSection(componentData);
      renderDropletSection(componentData);
      renderLayerSection(componentData);
      renderWetnessTintSection(componentData);
      renderLightningSection(componentData);
      renderStormIntensitySection(componentData);
    },
  },
);
