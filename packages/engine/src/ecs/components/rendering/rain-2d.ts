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
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

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
  EditorLayout.header('Rain Preset', { r: 0.4, g: 0.8, b: 1.0 });
  EditorLayout.sameLine();

  const presetOptions = ['Custom', 'Light Drizzle', 'Steady Rain', 'Heavy Downpour', 'Thunderstorm'];
  const presetMap: Record<string, RainPreset> = {
    'Custom': 'custom',
    'Light Drizzle': 'light-drizzle',
    'Steady Rain': 'steady-rain',
    'Heavy Downpour': 'heavy-downpour',
    'Thunderstorm': 'thunderstorm',
  };
  const reverseMap: Record<RainPreset, string> = {
    'custom': 'Custom',
    'light-drizzle': 'Light Drizzle',
    'steady-rain': 'Steady Rain',
    'heavy-downpour': 'Heavy Downpour',
    'thunderstorm': 'Thunderstorm',
  };

  const currentLabel = reverseMap[currentPreset];

  const [selectedLabel, changed] = EditorLayout.comboField('', currentLabel, presetOptions, {
    id: 'rainPreset',
    tooltip: 'Select a rain preset or customize settings',
  });

  if (changed) {
    const selectedPreset = presetMap[selectedLabel];
    if (selectedPreset && selectedPreset !== 'custom') {
      // Apply preset
      const presetData = RAIN_PRESETS[selectedPreset as Exclude<RainPreset, 'custom'>];
      Object.assign(data, presetData);
      lastAppliedPresetData = { ...presetData };
      currentPreset = selectedPreset;
    } else {
      currentPreset = 'custom';
      lastAppliedPresetData = null;
    }
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
  if (EditorLayout.beginGroup('Size & Visibility', false)) {
    EditorLayout.beginLabelsWidth(['Base Size', 'Tile Size', 'Visible', 'Sorting Layer', 'Sorting Order']);

    // baseSize Vec2
    const [baseSize, baseSizeChanged] = EditorLayout.vector2Field('Base Size', data.baseSize, {
      speed: 0.01,
      min: 0.1,
      max: 100,
      tooltip: 'Base size of rain area before transform scaling',
    });
    if (baseSizeChanged) {
      data.baseSize.x = baseSize.x;
      data.baseSize.y = baseSize.y;
    }

    EditorLayout.spacing();

    // tileSize
    const [tileSize, tileSizeChanged] = EditorLayout.numberField('Tile Size', data.tileSize, {
      speed: 1,
      min: 1,
      max: 500,
      tooltip: 'World units between pattern repetitions (larger = less dense)',
    });
    if (tileSizeChanged) data.tileSize = tileSize;

    EditorLayout.spacing();

    // visible checkbox
    const [visible, visibleChanged] = EditorLayout.checkboxField('Visible', data.visible);
    if (visibleChanged) data.visible = visible;

    EditorLayout.spacing();

    // sortingLayer and sortingOrder
    const [sortingLayer, layerChanged] = EditorLayout.integerField('Sorting Layer', data.sortingLayer, {
      speed: 1,
      min: -1000,
      max: 1000,
      tooltip: 'Z-ordering for layered rendering (higher = on top)',
    });
    if (layerChanged) data.sortingLayer = sortingLayer;

    const [sortingOrder, orderChanged] = EditorLayout.integerField('Sorting Order', data.sortingOrder, {
      speed: 1,
      min: -1000,
      max: 1000,
    });
    if (orderChanged) data.sortingOrder = sortingOrder;

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderDropletSection(data: Rain2DData): void {
  if (EditorLayout.beginGroup('Droplet Properties', false)) {
    EditorLayout.beginLabelsWidth(['Density', 'Fall Speed', 'Speed Variation', 'Angle', 'Wind Strength', 'Wind Speed', 'Droplet Min Length', 'Droplet Max Length', 'Droplet Width', 'Seed', 'Droplet Color', 'Droplet Opacity']);

    // density
    const [density, densityChanged] = EditorLayout.numberField('Density', data.density, {
      min: 10,
      max: 500,
      useSlider: true,
      tooltip: 'Number of droplets (higher = more rain)',
    });
    if (densityChanged) data.density = density;

    // fallSpeed
    const [fallSpeed, fallSpeedChanged] = EditorLayout.numberField('Fall Speed', data.fallSpeed, {
      min: 100,
      max: 2000,
      useSlider: true,
      tooltip: 'Base falling speed in world units/second',
    });
    if (fallSpeedChanged) data.fallSpeed = fallSpeed;

    // speedVariation
    const [speedVariation, speedVarChanged] = EditorLayout.numberField('Speed Variation', data.speedVariation, {
      min: 0,
      max: 1,
      useSlider: true,
      tooltip: 'How much individual droplet speeds vary',
    });
    if (speedVarChanged) data.speedVariation = speedVariation;

    EditorLayout.spacing();

    // angle
    const [angle, angleChanged] = EditorLayout.numberField('Angle', data.angle, {
      min: -0.5,
      max: 0.5,
      useSlider: true,
      tooltip: 'Rain slant in radians (0 = vertical)',
    });
    if (angleChanged) data.angle = angle;

    // windStrength
    const [windStrength, windStrengthChanged] = EditorLayout.numberField('Wind Strength', data.windStrength, {
      min: 0,
      max: 1,
      useSlider: true,
      tooltip: 'Oscillating wind effect intensity',
    });
    if (windStrengthChanged) data.windStrength = windStrength;

    // windSpeed
    const [windSpeed, windSpeedChanged] = EditorLayout.numberField('Wind Speed', data.windSpeed, {
      min: 0,
      max: 5,
      useSlider: true,
      tooltip: 'Speed of wind direction changes',
    });
    if (windSpeedChanged) data.windSpeed = windSpeed;

    EditorLayout.spacing();

    // droplet dimensions
    const [dropletMinLength, minLenChanged] = EditorLayout.numberField('Droplet Min Length', data.dropletMinLength, {
      min: 1,
      max: 20,
      useSlider: true,
    });
    if (minLenChanged) data.dropletMinLength = dropletMinLength;

    const [dropletMaxLength, maxLenChanged] = EditorLayout.numberField('Droplet Max Length', data.dropletMaxLength, {
      min: 1,
      max: 30,
      useSlider: true,
    });
    if (maxLenChanged) data.dropletMaxLength = dropletMaxLength;

    const [dropletWidth, widthChanged] = EditorLayout.numberField('Droplet Width', data.dropletWidth, {
      min: 0.5,
      max: 5,
      useSlider: true,
    });
    if (widthChanged) data.dropletWidth = dropletWidth;

    EditorLayout.spacing();

    // seed
    const [seed, seedChanged] = EditorLayout.integerField('Seed', data.seed, {
      speed: 1,
      min: 0,
      max: 999999,
      tooltip: 'Random seed for deterministic droplet placement',
    });
    if (seedChanged) data.seed = seed;

    EditorLayout.spacing();

    // dropletColor
    const [dropletColor, colorChanged] = EditorLayout.colorField('Droplet Color', data.dropletColor, {
      tooltip: 'Droplet color (RGB)',
    });
    if (colorChanged) {
      data.dropletColor.r = dropletColor.r;
      data.dropletColor.g = dropletColor.g;
      data.dropletColor.b = dropletColor.b;
    }

    // dropletOpacity
    const [dropletOpacity, opacityChanged] = EditorLayout.numberField('Droplet Opacity', data.dropletOpacity, {
      min: 0,
      max: 1,
      useSlider: true,
    });
    if (opacityChanged) data.dropletOpacity = dropletOpacity;

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderLayerSection(data: Rain2DData): void {
  if (EditorLayout.beginGroup('Layer Depth', false)) {
    EditorLayout.beginLabelsWidth(['Enable Multi-Layer']);

    const [enableLayers, enableLayersChanged] = EditorLayout.checkboxField('Enable Multi-Layer', data.enableLayers, {
      tooltip: 'Enable near/mid/far parallax layers for depth effect',
    });
    if (enableLayersChanged) data.enableLayers = enableLayers;

    EditorLayout.endLabelsWidth();

    if (data.enableLayers) {
      EditorLayout.beginIndent();
      EditorLayout.spacing();

      // Near layer
      EditorLayout.header('Near Layer', { r: 1.0, g: 0.8, b: 0.4 });

      EditorLayout.beginLabelsWidth(['Speed', 'Opacity', 'Scale']);

      const [nearSpeed, nearSpeedChanged] = EditorLayout.numberField('Speed', data.nearLayerSpeed, {
        min: 0.5, max: 3, useSlider: true, id: 'nearSpeed',
      });
      if (nearSpeedChanged) data.nearLayerSpeed = nearSpeed;

      const [nearOpacity, nearOpacityChanged] = EditorLayout.numberField('Opacity', data.nearLayerOpacity, {
        min: 0, max: 1, useSlider: true, id: 'nearOpacity',
      });
      if (nearOpacityChanged) data.nearLayerOpacity = nearOpacity;

      const [nearScale, nearScaleChanged] = EditorLayout.numberField('Scale', data.nearLayerScale, {
        min: 0.5, max: 2, useSlider: true, id: 'nearScale',
      });
      if (nearScaleChanged) data.nearLayerScale = nearScale;

      EditorLayout.endLabelsWidth();

      EditorLayout.spacing();

      // Mid layer
      EditorLayout.header('Mid Layer', { r: 0.8, g: 0.8, b: 1.0 });

      EditorLayout.beginLabelsWidth(['Speed', 'Opacity', 'Scale']);

      const [midSpeed, midSpeedChanged] = EditorLayout.numberField('Speed', data.midLayerSpeed, {
        min: 0.5, max: 3, useSlider: true, id: 'midSpeed',
      });
      if (midSpeedChanged) data.midLayerSpeed = midSpeed;

      const [midOpacity, midOpacityChanged] = EditorLayout.numberField('Opacity', data.midLayerOpacity, {
        min: 0, max: 1, useSlider: true, id: 'midOpacity',
      });
      if (midOpacityChanged) data.midLayerOpacity = midOpacity;

      const [midScale, midScaleChanged] = EditorLayout.numberField('Scale', data.midLayerScale, {
        min: 0.5, max: 2, useSlider: true, id: 'midScale',
      });
      if (midScaleChanged) data.midLayerScale = midScale;

      EditorLayout.endLabelsWidth();

      EditorLayout.spacing();

      // Far layer
      EditorLayout.header('Far Layer', { r: 0.6, g: 0.6, b: 0.8 });

      EditorLayout.beginLabelsWidth(['Speed', 'Opacity', 'Scale']);

      const [farSpeed, farSpeedChanged] = EditorLayout.numberField('Speed', data.farLayerSpeed, {
        min: 0.2, max: 2, useSlider: true, id: 'farSpeed',
      });
      if (farSpeedChanged) data.farLayerSpeed = farSpeed;

      const [farOpacity, farOpacityChanged] = EditorLayout.numberField('Opacity', data.farLayerOpacity, {
        min: 0, max: 1, useSlider: true, id: 'farOpacity',
      });
      if (farOpacityChanged) data.farLayerOpacity = farOpacity;

      const [farScale, farScaleChanged] = EditorLayout.numberField('Scale', data.farLayerScale, {
        min: 0.3, max: 1.5, useSlider: true, id: 'farScale',
      });
      if (farScaleChanged) data.farLayerScale = farScale;

      EditorLayout.endLabelsWidth();

      EditorLayout.endIndent();
    }

    EditorLayout.endGroup();
  }
}

function renderWetnessTintSection(data: Rain2DData): void {
  if (EditorLayout.beginGroup('Wetness Tint', false)) {
    EditorLayout.beginLabelsWidth(['Enable Wetness Tint']);

    const [enableWetnessTint, enableChanged] = EditorLayout.checkboxField('Enable Wetness Tint', data.enableWetnessTint, {
      tooltip: 'Add a subtle color overlay simulating wetness',
    });
    if (enableChanged) data.enableWetnessTint = enableWetnessTint;

    EditorLayout.endLabelsWidth();

    if (data.enableWetnessTint) {
      EditorLayout.beginIndent();
      EditorLayout.spacing();

      EditorLayout.beginLabelsWidth(['Tint Color', 'Intensity']);

      const [tintColor, colorChanged] = EditorLayout.colorField('Tint Color', data.wetnessTintColor, {
        tooltip: 'Color of the wetness overlay',
      });
      if (colorChanged) {
        data.wetnessTintColor.r = tintColor.r;
        data.wetnessTintColor.g = tintColor.g;
        data.wetnessTintColor.b = tintColor.b;
      }

      const [intensity, intensityChanged] = EditorLayout.numberField('Intensity', data.wetnessTintIntensity, {
        min: 0, max: 0.5, useSlider: true,
        tooltip: 'Strength of the wetness effect',
      });
      if (intensityChanged) data.wetnessTintIntensity = intensity;

      EditorLayout.endLabelsWidth();
      EditorLayout.endIndent();
    }

    EditorLayout.endGroup();
  }
}

function renderLightningSection(data: Rain2DData): void {
  if (EditorLayout.beginGroup('Lightning', false)) {
    EditorLayout.beginLabelsWidth(['Enable Lightning']);

    const [enableLightning, enableChanged] = EditorLayout.checkboxField('Enable Lightning', data.enableLightning, {
      tooltip: 'Enable random lightning flash effects',
    });
    if (enableChanged) data.enableLightning = enableLightning;

    EditorLayout.endLabelsWidth();

    if (data.enableLightning) {
      EditorLayout.beginIndent();
      EditorLayout.spacing();

      EditorLayout.beginLabelsWidth(['Flash Color', 'Min Interval', 'Max Interval', 'Flash Duration', 'Flash Intensity']);

      const [flashColor, colorChanged] = EditorLayout.colorField('Flash Color', data.lightningColor, {
        tooltip: 'Color of the lightning flash',
      });
      if (colorChanged) {
        data.lightningColor.r = flashColor.r;
        data.lightningColor.g = flashColor.g;
        data.lightningColor.b = flashColor.b;
      }

      const [minInterval, minIntervalChanged] = EditorLayout.numberField('Min Interval', data.lightningMinInterval, {
        min: 1, max: 30, useSlider: true,
        tooltip: 'Minimum seconds between lightning strikes',
      });
      if (minIntervalChanged) data.lightningMinInterval = minInterval;

      const [maxInterval, maxIntervalChanged] = EditorLayout.numberField('Max Interval', data.lightningMaxInterval, {
        min: 1, max: 60, useSlider: true,
        tooltip: 'Maximum seconds between lightning strikes',
      });
      if (maxIntervalChanged) data.lightningMaxInterval = maxInterval;

      const [duration, durationChanged] = EditorLayout.numberField('Flash Duration', data.lightningDuration, {
        min: 0.05, max: 0.5, useSlider: true,
        tooltip: 'Duration of lightning flash in seconds',
      });
      if (durationChanged) data.lightningDuration = duration;

      const [intensity, intensityChanged] = EditorLayout.numberField('Flash Intensity', data.lightningIntensity, {
        min: 0, max: 1, useSlider: true,
        tooltip: 'Brightness of the lightning flash',
      });
      if (intensityChanged) data.lightningIntensity = intensity;

      EditorLayout.endLabelsWidth();
      EditorLayout.endIndent();
    }

    EditorLayout.endGroup();
  }
}

function renderStormIntensitySection(data: Rain2DData): void {
  if (EditorLayout.beginGroup('Storm Intensity', false)) {
    EditorLayout.beginLabelsWidth(['Storm Intensity']);

    const [stormIntensity, intensityChanged] = EditorLayout.numberField('Storm Intensity', data.stormIntensity, {
      min: 0, max: 1, useSlider: true,
      tooltip: 'Master intensity control - scales density and all effects',
    });
    if (intensityChanged) data.stormIntensity = stormIntensity;

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
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
      EditorLayout.separator();
      EditorLayout.spacing();

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
