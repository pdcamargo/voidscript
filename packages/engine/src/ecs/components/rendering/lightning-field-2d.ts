/**
 * Lightning Field 2D Component
 *
 * Renders procedural lightning bolts with advanced effects.
 * Uses GPU-based midpoint displacement, distance-field glow, and pixelation.
 *
 * Features:
 * - Procedural bolt generation with midpoint displacement
 * - Distance-field glow with configurable intensity
 * - Random branching
 * - Post-process pixelation for retro styling
 * - Multiple simultaneous bolt support
 * - Edge-to-edge strikes with directional control
 * - Screen flash and ground glow effects
 *
 * @example
 * ```typescript
 * commands.spawn()
 *   .with(Transform3D, {
 *     position: { x: 0, y: 0, z: 50 },
 *     scale: { x: 500, y: 300, z: 1 },
 *   })
 *   .with(LightningField2D, {
 *     minInterval: 2.0,
 *     maxInterval: 8.0,
 *     enableScreenFlash: true,
 *   })
 *   .build();
 * ```
 */

import { component } from '../../component.js';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';
import type { Entity } from '../../entity.js';
import type { Command } from '../../command.js';

/**
 * Lightning Field 2D component data
 */
export interface LightningField2DData {
  // ============================================================================
  // Area Definition
  // ============================================================================

  /**
   * Base size of the lightning field before Transform.scale is applied.
   * The actual field size = baseSize * transform.scale.
   * @default { x: 1, y: 1 }
   */
  baseSize: { x: number; y: number };

  /**
   * Whether the lightning field is visible
   * @default true
   */
  visible: boolean;

  /**
   * Sorting layer for Z-ordering (higher = rendered later/on top)
   * @default 600
   */
  sortingLayer: number;

  /**
   * Sorting order within the layer (higher = rendered later/on top)
   * @default 0
   */
  sortingOrder: number;

  // ============================================================================
  // Strike Timing
  // ============================================================================

  /**
   * Minimum time between lightning strikes (seconds).
   * @default 2.0
   */
  minInterval: number;

  /**
   * Maximum time between lightning strikes (seconds).
   * @default 8.0
   */
  maxInterval: number;

  /**
   * How long a bolt is visible (seconds).
   * @default 0.15
   */
  strikeDuration: number;

  /**
   * Maximum number of simultaneous bolts (1-5).
   * @default 1
   */
  simultaneousStrikes: number;

  // ============================================================================
  // Bolt Appearance
  // ============================================================================

  /**
   * Core bolt color (RGB, 0-1 range).
   * @default { r: 0.302, g: 0.651, b: 1.0 } (electric blue #4da6ff)
   */
  boltColor: { r: number; g: number; b: number };

  /**
   * Glow color (RGB, 0-1 range).
   * @default { r: 0.502, g: 0.753, b: 1.0 } (lighter blue #80c0ff)
   */
  glowColor: { r: number; g: number; b: number };

  /**
   * Core bolt width in pixels.
   * @default 2
   */
  boltWidth: number;

  /**
   * Glow radius in pixels.
   * @default 8
   */
  glowRadius: number;

  /**
   * Glow intensity (0-1).
   * @default 0.8
   */
  glowIntensity: number;

  /**
   * Pixelation grid size for retro styling.
   * Set to 1 for no pixelation.
   * @default 1
   */
  pixelSize: number;

  // ============================================================================
  // Procedural Generation
  // ============================================================================

  /**
   * Number of segments per bolt (8-32).
   * Higher values = more detailed bolts.
   * @default 16
   */
  segments: number;

  /**
   * Displacement strength (0-1).
   * Higher values = more jagged bolts.
   * @default 0.5
   */
  displacement: number;

  /**
   * Noise distortion strength (0-1).
   * Adds organic variation to bolt paths.
   * @default 0.3
   */
  noiseStrength: number;

  /**
   * Branch probability (0-1).
   * Chance of spawning branches from main bolt.
   * @default 0.2
   */
  branchProbability: number;

  /**
   * Branch length relative to main bolt (0.2-0.8).
   * @default 0.4
   */
  branchLengthFactor: number;

  /**
   * Sub-branch probability (0-1).
   * Chance of spawning sub-branches from branches.
   * @default 0.3
   */
  subBranchProbability: number;

  /**
   * Random seed for bolt generation.
   * Each strike uses seed + random offset.
   * @default 0
   */
  seed: number;

  // ============================================================================
  // Animation
  // ============================================================================

  /**
   * Fade mode for bolt disappearance.
   * - 'instant': Bolt disappears immediately
   * - 'fade': Gradual fade out
   * - 'flicker': Strobe effect before disappearing
   * @default 'fade'
   */
  fadeMode: 'instant' | 'fade' | 'flicker';

  /**
   * Flicker speed (cycles per second).
   * Only used when fadeMode is 'flicker'.
   * @default 15
   */
  flickerSpeed: number;

  // ============================================================================
  // Direction
  // ============================================================================

  /**
   * Strike direction (edge-to-edge mode).
   * @default 'top-down'
   */
  strikeDirection:
    | 'top-down'
    | 'bottom-up'
    | 'left-right'
    | 'right-left'
    | 'random';

  /**
   * Angle variation in radians (0-0.5).
   * Adds randomness to strike direction.
   * @default 0.1
   */
  angleVariation: number;

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Enable screen flash effect when lightning strikes.
   * @default false
   */
  enableScreenFlash: boolean;

  /**
   * Screen flash intensity (0-1).
   * @default 0.3
   */
  flashIntensity: number;

  /**
   * Enable glow effect at bolt impact point.
   * @default false
   */
  enableGroundGlow: boolean;

  /**
   * Ground glow radius in pixels.
   * @default 20
   */
  groundGlowRadius: number;
}

// ============================================================================
// Custom Editor - Preset System
// ============================================================================

type LightningPreset =
  | 'custom'
  | 'subtle-storm'
  | 'electric-storm'
  | 'dramatic-lightning'
  | 'continuous-discharge';

const LIGHTNING_PRESETS: Record<
  Exclude<LightningPreset, 'custom'>,
  Partial<LightningField2DData>
> = {
  'subtle-storm': {
    minInterval: 4.0,
    maxInterval: 12.0,
    strikeDuration: 0.1,
    simultaneousStrikes: 1,
    boltWidth: 0.5,
    glowRadius: 15,
    glowIntensity: 0.8,
    pixelSize: 0.1,
    segments: 12,
    displacement: 0.3,
    noiseStrength: 0.2,
    branchProbability: 0.1,
    branchLengthFactor: 0.3,
    subBranchProbability: 0.2,
    fadeMode: 'fade',
    enableScreenFlash: false,
    enableGroundGlow: false,
  },
  'electric-storm': {
    minInterval: 1.5,
    maxInterval: 5.0,
    strikeDuration: 0.2,
    simultaneousStrikes: 2,
    boltWidth: 0.5,
    glowRadius: 15,
    glowIntensity: 0.8,
    pixelSize: 0.1,
    segments: 20,
    displacement: 0.5,
    noiseStrength: 0.3,
    branchProbability: 0.5,
    branchLengthFactor: 0.5,
    subBranchProbability: 0.4,
    fadeMode: 'flicker',
    flickerSpeed: 15,
    enableScreenFlash: true,
    flashIntensity: 0.3,
    enableGroundGlow: true,
    groundGlowRadius: 15,
  },
  'dramatic-lightning': {
    minInterval: 3.0,
    maxInterval: 8.0,
    strikeDuration: 0.25,
    simultaneousStrikes: 1,
    boltWidth: 0.5,
    glowRadius: 15,
    glowIntensity: 0.8,
    pixelSize: 0.1,
    segments: 24,
    displacement: 0.6,
    noiseStrength: 0.4,
    branchProbability: 0.6,
    branchLengthFactor: 0.6,
    subBranchProbability: 0.5,
    fadeMode: 'fade',
    enableScreenFlash: true,
    flashIntensity: 0.5,
    enableGroundGlow: true,
    groundGlowRadius: 25,
  },
  'continuous-discharge': {
    minInterval: 0.1,
    maxInterval: 0.5,
    strikeDuration: 0.05,
    simultaneousStrikes: 5,
    boltWidth: 0.5,
    glowRadius: 15,
    glowIntensity: 0.8,
    pixelSize: 0.1,
    segments: 8,
    displacement: 0.4,
    noiseStrength: 0.2,
    branchProbability: 0.15,
    branchLengthFactor: 0.25,
    subBranchProbability: 0.2,
    fadeMode: 'instant',
    strikeDirection: 'random',
    enableScreenFlash: false,
    enableGroundGlow: false,
  },
};

// Preset state tracking (closure variable per component instance approach)
let currentLightningPreset: LightningPreset = 'custom';
let lastAppliedLightningPresetData: Partial<LightningField2DData> | null = null;

// ============================================================================
// Custom Editor - Helper Functions
// ============================================================================

function renderLightningPresetSelector(data: LightningField2DData): void {
  EditorLayout.header('Lightning Preset', { r: 1.0, g: 0.9, b: 0.3 });
  EditorLayout.sameLine();

  const presetMap: Record<LightningPreset, string> = {
    custom: 'Custom',
    'subtle-storm': 'Subtle Storm',
    'electric-storm': 'Electric Storm',
    'dramatic-lightning': 'Dramatic Lightning',
    'continuous-discharge': 'Continuous Discharge',
  };

  const presetLabel = presetMap[currentLightningPreset];
  const presetOptions = Object.values(presetMap);

  const [selected, changed] = EditorLayout.comboField('', presetLabel, presetOptions, {
    id: 'lightningPreset',
  });

  if (changed) {
    // Find the preset key from the selected label
    const selectedPreset = (Object.entries(presetMap).find(
      ([, label]) => label === selected
    )?.[0] ?? 'custom') as LightningPreset;

    if (selectedPreset !== 'custom') {
      // Apply preset
      const presetData =
        LIGHTNING_PRESETS[selectedPreset as Exclude<LightningPreset, 'custom'>];
      Object.assign(data, presetData);
      lastAppliedLightningPresetData = { ...presetData };
      currentLightningPreset = selectedPreset;
    } else {
      currentLightningPreset = 'custom';
      lastAppliedLightningPresetData = null;
    }
  }

  // Auto-detect custom changes
  if (
    currentLightningPreset !== 'custom' &&
    lastAppliedLightningPresetData
  ) {
    let hasCustomChanges = false;
    for (const key in lastAppliedLightningPresetData) {
      const dataKey = key as keyof LightningField2DData;
      const presetValue = lastAppliedLightningPresetData[dataKey];
      const currentValue = data[dataKey];

      if (typeof presetValue === 'object' && presetValue !== null) {
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
      currentLightningPreset = 'custom';
      lastAppliedLightningPresetData = null;
    }
  }
}

/**
 * Render preview section with Trigger Strike button
 */
function renderLightningPreviewSection(
  entity: Entity,
  commands: Command,
): void {
  if (EditorLayout.beginGroup('Preview', true)) {
    EditorLayout.hint('Trigger a lightning strike for preview');
    EditorLayout.spacing();

    if (EditorLayout.button('Trigger Strike', { tooltip: 'Click to manually trigger a lightning bolt' })) {
      // Dynamically import to avoid circular dependency
      import('../../systems/lightning-field-2d-system.js').then(
        ({ LightningField2DRenderManager }) => {
          const manager = commands.tryGetResource(LightningField2DRenderManager);
          if (manager) {
            manager.triggerStrike(entity);
          }
        }
      );
    }

    EditorLayout.endGroup();
  }
}

function renderLightningSizeSection(data: LightningField2DData): void {
  if (EditorLayout.beginGroup('Size & Visibility', false)) {
    EditorLayout.beginLabelsWidth(['Base Size', 'Visible', 'Sorting Layer', 'Sorting Order']);

    const [baseSize, baseSizeChanged] = EditorLayout.vector2Field('Base Size', data.baseSize, {
      speed: 0.01,
      min: 0.1,
      max: 100,
      tooltip: 'Base size of lightning field before transform scaling',
    });
    if (baseSizeChanged) {
      data.baseSize.x = baseSize.x;
      data.baseSize.y = baseSize.y;
    }

    EditorLayout.spacing();

    const [visible, visibleChanged] = EditorLayout.checkboxField('Visible', data.visible);
    if (visibleChanged) data.visible = visible;

    EditorLayout.spacing();

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

function renderLightningTimingSection(data: LightningField2DData): void {
  if (EditorLayout.beginGroup('Strike Timing', false)) {
    EditorLayout.beginLabelsWidth(['Min Interval', 'Max Interval', 'Strike Duration', 'Simultaneous Strikes']);

    const [minInterval, minIntervalChanged] = EditorLayout.numberField('Min Interval', data.minInterval, {
      min: 0.1, max: 30, useSlider: true,
      tooltip: 'Minimum seconds between lightning strikes',
    });
    if (minIntervalChanged) data.minInterval = minInterval;

    const [maxInterval, maxIntervalChanged] = EditorLayout.numberField('Max Interval', data.maxInterval, {
      min: 0.1, max: 60, useSlider: true,
      tooltip: 'Maximum seconds between lightning strikes',
    });
    if (maxIntervalChanged) data.maxInterval = Math.max(data.minInterval, maxInterval);

    const [strikeDuration, durationChanged] = EditorLayout.numberField('Strike Duration', data.strikeDuration, {
      min: 0.02, max: 0.5, useSlider: true,
      tooltip: 'How long each bolt is visible (seconds)',
    });
    if (durationChanged) data.strikeDuration = strikeDuration;

    const [simultaneousStrikes, strikesChanged] = EditorLayout.integerField('Simultaneous Strikes', data.simultaneousStrikes, {
      min: 1, max: 5, useSlider: true,
      tooltip: 'Maximum number of bolts visible at once',
    });
    if (strikesChanged) data.simultaneousStrikes = simultaneousStrikes;

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderLightningAppearanceSection(data: LightningField2DData): void {
  if (EditorLayout.beginGroup('Bolt Appearance', false)) {
    EditorLayout.beginLabelsWidth(['Bolt Color', 'Glow Color', 'Bolt Width', 'Glow Radius', 'Glow Intensity', 'Pixel Size']);

    const [boltColor, boltColorChanged] = EditorLayout.colorField('Bolt Color', data.boltColor, {
      tooltip: 'Core bolt color',
    });
    if (boltColorChanged) {
      data.boltColor.r = boltColor.r;
      data.boltColor.g = boltColor.g;
      data.boltColor.b = boltColor.b;
    }

    const [glowColor, glowColorChanged] = EditorLayout.colorField('Glow Color', data.glowColor, {
      tooltip: 'Outer glow color',
    });
    if (glowColorChanged) {
      data.glowColor.r = glowColor.r;
      data.glowColor.g = glowColor.g;
      data.glowColor.b = glowColor.b;
    }

    EditorLayout.spacing();

    const [boltWidth, boltWidthChanged] = EditorLayout.numberField('Bolt Width', data.boltWidth, {
      min: 0.5, max: 5, useSlider: true,
      tooltip: 'Core bolt width in pixels',
    });
    if (boltWidthChanged) data.boltWidth = boltWidth;

    const [glowRadius, glowRadiusChanged] = EditorLayout.numberField('Glow Radius', data.glowRadius, {
      min: 1, max: 30, useSlider: true,
      tooltip: 'Glow spread in pixels',
    });
    if (glowRadiusChanged) data.glowRadius = glowRadius;

    const [glowIntensity, glowIntensityChanged] = EditorLayout.numberField('Glow Intensity', data.glowIntensity, {
      min: 0, max: 1, useSlider: true,
    });
    if (glowIntensityChanged) data.glowIntensity = glowIntensity;

    EditorLayout.spacing();

    const [pixelSize, pixelSizeChanged] = EditorLayout.numberField('Pixel Size', data.pixelSize, {
      speed: 0.1, min: 0.1, max: 16,
      tooltip: 'Pixelation grid size (smaller = finer detail, 0.1 = no pixelation)',
    });
    if (pixelSizeChanged) data.pixelSize = Math.max(0.1, pixelSize);

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderLightningGenerationSection(data: LightningField2DData): void {
  if (EditorLayout.beginGroup('Procedural Generation', false)) {
    EditorLayout.beginLabelsWidth(['Segments', 'Displacement', 'Noise Strength', 'Branch Probability', 'Branch Length', 'Sub-Branch Probability', 'Seed']);

    const [segments, segmentsChanged] = EditorLayout.integerField('Segments', data.segments, {
      min: 4, max: 32, useSlider: true,
      tooltip: 'Number of segments per bolt (higher = more detail)',
    });
    if (segmentsChanged) data.segments = segments;

    const [displacement, displacementChanged] = EditorLayout.numberField('Displacement', data.displacement, {
      min: 0, max: 1, useSlider: true,
      tooltip: 'Jaggedness of bolt (higher = more displaced)',
    });
    if (displacementChanged) data.displacement = displacement;

    const [noiseStrength, noiseChanged] = EditorLayout.numberField('Noise Strength', data.noiseStrength, {
      min: 0, max: 1, useSlider: true,
      tooltip: 'Organic variation added to bolt paths',
    });
    if (noiseChanged) data.noiseStrength = noiseStrength;

    EditorLayout.spacing();

    const [branchProbability, branchProbChanged] = EditorLayout.numberField('Branch Probability', data.branchProbability, {
      min: 0, max: 1, useSlider: true,
      tooltip: 'Chance of spawning branches from main bolt',
    });
    if (branchProbChanged) data.branchProbability = branchProbability;

    const [branchLengthFactor, branchLenChanged] = EditorLayout.numberField('Branch Length', data.branchLengthFactor, {
      min: 0.1, max: 0.8, useSlider: true,
      tooltip: 'Branch length relative to main bolt',
    });
    if (branchLenChanged) data.branchLengthFactor = branchLengthFactor;

    const [subBranchProbability, subBranchChanged] = EditorLayout.numberField('Sub-Branch Probability', data.subBranchProbability ?? 0.3, {
      min: 0, max: 1, useSlider: true,
      tooltip: 'Chance of spawning sub-branches from branches (for more complex lightning)',
    });
    if (subBranchChanged) data.subBranchProbability = subBranchProbability;

    EditorLayout.spacing();

    const [seed, seedChanged] = EditorLayout.integerField('Seed', data.seed, {
      speed: 1, min: 0, max: 999999,
      tooltip: 'Base random seed for bolt generation',
    });
    if (seedChanged) data.seed = seed;

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderLightningAnimationSection(data: LightningField2DData): void {
  if (EditorLayout.beginGroup('Animation', false)) {
    EditorLayout.beginLabelsWidth(['Fade Mode', 'Flicker Speed']);

    const fadeModeMap: Record<LightningField2DData['fadeMode'], string> = {
      instant: 'Instant',
      fade: 'Fade Out',
      flicker: 'Flicker',
    };

    const fadeModeOptions = Object.values(fadeModeMap);
    const [selectedFade, fadeChanged] = EditorLayout.comboField('Fade Mode', fadeModeMap[data.fadeMode], fadeModeOptions, {
      tooltip: 'How bolts disappear after their duration',
    });
    if (fadeChanged) {
      const selectedMode = (Object.entries(fadeModeMap).find(
        ([, label]) => label === selectedFade
      )?.[0] ?? 'fade') as LightningField2DData['fadeMode'];
      data.fadeMode = selectedMode;
    }

    // flickerSpeed (only if flicker mode)
    if (data.fadeMode === 'flicker') {
      const [flickerSpeed, flickerChanged] = EditorLayout.numberField('Flicker Speed', data.flickerSpeed, {
        min: 5, max: 30, useSlider: true,
        tooltip: 'Flicker cycles per second',
      });
      if (flickerChanged) data.flickerSpeed = flickerSpeed;
    }

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderLightningDirectionSection(data: LightningField2DData): void {
  if (EditorLayout.beginGroup('Direction', false)) {
    EditorLayout.beginLabelsWidth(['Strike Direction', 'Angle Variation']);

    const directionMap: Record<
      LightningField2DData['strikeDirection'],
      string
    > = {
      'top-down': 'Top to Bottom',
      'bottom-up': 'Bottom to Top',
      'left-right': 'Left to Right',
      'right-left': 'Right to Left',
      random: 'Random',
    };

    const directionOptions = Object.values(directionMap);
    const [selectedDir, dirChanged] = EditorLayout.comboField('Strike Direction', directionMap[data.strikeDirection], directionOptions, {
      tooltip: 'Direction bolts travel across the field',
    });
    if (dirChanged) {
      const selectedDirection = (Object.entries(directionMap).find(
        ([, label]) => label === selectedDir
      )?.[0] ?? 'top-down') as LightningField2DData['strikeDirection'];
      data.strikeDirection = selectedDirection;
    }

    const [angleVariation, angleChanged] = EditorLayout.numberField('Angle Variation', data.angleVariation, {
      min: 0, max: 0.5, useSlider: true,
      tooltip: 'Random angle variation in radians',
    });
    if (angleChanged) data.angleVariation = angleVariation;

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderLightningEffectsSection(data: LightningField2DData): void {
  if (EditorLayout.beginGroup('Effects', false)) {
    EditorLayout.beginLabelsWidth(['Enable Screen Flash', 'Enable Ground Glow']);

    const [enableScreenFlash, flashEnableChanged] = EditorLayout.checkboxField('Enable Screen Flash', data.enableScreenFlash, {
      tooltip: 'Flash the screen white when lightning strikes',
    });
    if (flashEnableChanged) data.enableScreenFlash = enableScreenFlash;

    EditorLayout.endLabelsWidth();

    if (data.enableScreenFlash) {
      EditorLayout.beginIndent();
      EditorLayout.beginLabelsWidth(['Flash Intensity']);
      const [flashIntensity, flashIntensityChanged] = EditorLayout.numberField('Flash Intensity', data.flashIntensity, {
        min: 0, max: 1, useSlider: true,
      });
      if (flashIntensityChanged) data.flashIntensity = flashIntensity;
      EditorLayout.endLabelsWidth();
      EditorLayout.endIndent();
    }

    EditorLayout.spacing();

    EditorLayout.beginLabelsWidth(['Enable Ground Glow']);

    const [enableGroundGlow, glowEnableChanged] = EditorLayout.checkboxField('Enable Ground Glow', data.enableGroundGlow, {
      tooltip: 'Add a glow effect at bolt impact point',
    });
    if (glowEnableChanged) data.enableGroundGlow = enableGroundGlow;

    EditorLayout.endLabelsWidth();

    if (data.enableGroundGlow) {
      EditorLayout.beginIndent();
      EditorLayout.beginLabelsWidth(['Ground Glow Radius']);
      const [groundGlowRadius, radiusChanged] = EditorLayout.numberField('Ground Glow Radius', data.groundGlowRadius, {
        min: 5, max: 50, useSlider: true,
      });
      if (radiusChanged) data.groundGlowRadius = groundGlowRadius;
      EditorLayout.endLabelsWidth();
      EditorLayout.endIndent();
    }

    EditorLayout.endGroup();
  }
}

export const LightningField2D = component<LightningField2DData>(
  'LightningField2D',
  {
    // Area
    baseSize: { serializable: true },
    visible: { serializable: true },
    sortingLayer: { serializable: true },
    sortingOrder: { serializable: true },
    // Timing
    minInterval: { serializable: true },
    maxInterval: { serializable: true },
    strikeDuration: { serializable: true },
    simultaneousStrikes: { serializable: true },
    // Appearance
    boltColor: { serializable: true },
    glowColor: { serializable: true },
    boltWidth: { serializable: true },
    glowRadius: { serializable: true },
    glowIntensity: { serializable: true },
    pixelSize: { serializable: true },
    // Generation
    segments: { serializable: true },
    displacement: { serializable: true },
    noiseStrength: { serializable: true },
    branchProbability: { serializable: true },
    branchLengthFactor: { serializable: true },
    subBranchProbability: { serializable: true },
    seed: { serializable: true },
    // Animation
    fadeMode: { serializable: true },
    flickerSpeed: { serializable: true },
    // Direction
    strikeDirection: { serializable: true },
    angleVariation: { serializable: true },
    // Effects
    enableScreenFlash: { serializable: true },
    flashIntensity: { serializable: true },
    enableGroundGlow: { serializable: true },
    groundGlowRadius: { serializable: true },
  },
  {
    path: 'rendering/2d',
    defaultValue: () => ({
      // Area
      baseSize: { x: 1, y: 1 },
      visible: true,
      sortingLayer: 600,
      sortingOrder: 0,
      // Timing
      minInterval: 2.0,
      maxInterval: 8.0,
      strikeDuration: 0.15,
      simultaneousStrikes: 1,
      // Appearance (electric blue)
      boltColor: { r: 0.302, g: 0.651, b: 1.0 },
      glowColor: { r: 0.502, g: 0.753, b: 1.0 },
      boltWidth: 0.5,
      glowRadius: 15,
      glowIntensity: 0.8,
      pixelSize: 0.1,
      // Generation
      segments: 20,
      displacement: 0.6,
      noiseStrength: 0.4,
      branchProbability: 0.4,
      branchLengthFactor: 0.5,
      subBranchProbability: 0.3,
      seed: 0,
      // Animation
      fadeMode: 'fade' as const,
      flickerSpeed: 15,
      // Direction
      strikeDirection: 'top-down' as const,
      angleVariation: 0.1,
      // Effects
      enableScreenFlash: false,
      flashIntensity: 0.3,
      enableGroundGlow: false,
      groundGlowRadius: 20,
    }),
    displayName: 'Lightning Field 2D',
    description:
      'Procedural lightning bolt generator with glow and branching effects',
    customEditor: ({ entity, componentData, commands }) => {
      // Preview button at top (easy access)
      renderLightningPreviewSection(entity, commands);
      EditorLayout.spacing();

      // Preset selector
      renderLightningPresetSelector(componentData);
      EditorLayout.separator();
      EditorLayout.spacing();

      // Collapsible sections
      renderLightningSizeSection(componentData);
      renderLightningTimingSection(componentData);
      renderLightningAppearanceSection(componentData);
      renderLightningGenerationSection(componentData);
      renderLightningAnimationSection(componentData);
      renderLightningDirectionSection(componentData);
      renderLightningEffectsSection(componentData);
    },
  },
);
