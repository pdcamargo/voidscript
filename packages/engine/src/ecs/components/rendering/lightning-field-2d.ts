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
import { ImGui } from '@mori2003/jsimgui';
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
  ImGui.TextColored({ x: 1.0, y: 0.9, z: 0.3, w: 1.0 }, 'Lightning Preset');
  ImGui.SameLine();

  const presetMap: Record<LightningPreset, string> = {
    custom: 'Custom',
    'subtle-storm': 'Subtle Storm',
    'electric-storm': 'Electric Storm',
    'dramatic-lightning': 'Dramatic Lightning',
    'continuous-discharge': 'Continuous Discharge',
  };

  const presetLabel = presetMap[currentLightningPreset];

  if (ImGui.BeginCombo('##lightningPreset', presetLabel)) {
    for (const [preset, label] of Object.entries(presetMap)) {
      const isSelected = currentLightningPreset === preset;
      if (ImGui.Selectable(label, isSelected)) {
        if (preset !== 'custom') {
          // Apply preset
          const presetData =
            LIGHTNING_PRESETS[preset as Exclude<LightningPreset, 'custom'>];
          Object.assign(data, presetData);
          lastAppliedLightningPresetData = { ...presetData };
          currentLightningPreset = preset as LightningPreset;
        } else {
          currentLightningPreset = 'custom';
          lastAppliedLightningPresetData = null;
        }
      }
      if (isSelected) {
        ImGui.SetItemDefaultFocus();
      }
    }
    ImGui.EndCombo();
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
  if (ImGui.CollapsingHeader('Preview##lightningPreview', ImGui.TreeNodeFlags.DefaultOpen)) {
    ImGui.Indent();

    ImGui.TextColored(
      { x: 0.7, y: 0.7, z: 0.7, w: 1.0 },
      'Trigger a lightning strike for preview'
    );
    ImGui.Spacing();

    if (ImGui.Button('⚡ Trigger Strike', { x: 150, y: 30 })) {
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
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Click to manually trigger a lightning bolt');
    }

    ImGui.Unindent();
  }
}

function renderLightningSizeSection(data: LightningField2DData): void {
  if (ImGui.CollapsingHeader('Size & Visibility##lightningSize')) {
    ImGui.Indent();

    // baseSize Vec2 inline
    ImGui.Text('Base Size:');
    const baseX: [number] = [data.baseSize.x];
    const baseY: [number] = [data.baseSize.y];
    ImGui.SetNextItemWidth(100);
    ImGui.DragFloat('##baseSizeX', baseX, 0.01, 0.1, 100);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Base size of lightning field before transform scaling');
    }
    ImGui.SameLine();
    ImGui.Text('x');
    ImGui.SameLine();
    ImGui.SetNextItemWidth(100);
    ImGui.DragFloat('##baseSizeY', baseY, 0.01, 0.1, 100);
    data.baseSize.x = baseX[0];
    data.baseSize.y = baseY[0];

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

function renderLightningTimingSection(data: LightningField2DData): void {
  if (ImGui.CollapsingHeader('Strike Timing##lightningTiming')) {
    ImGui.Indent();

    // minInterval
    ImGui.Text('Min Interval:');
    const minInterval: [number] = [data.minInterval];
    ImGui.SliderFloat('##minInterval', minInterval, 0.1, 30);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Minimum seconds between lightning strikes');
    }
    data.minInterval = minInterval[0];

    // maxInterval
    ImGui.Text('Max Interval:');
    const maxInterval: [number] = [data.maxInterval];
    ImGui.SliderFloat('##maxInterval', maxInterval, 0.1, 60);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Maximum seconds between lightning strikes');
    }
    data.maxInterval = Math.max(data.minInterval, maxInterval[0]);

    // strikeDuration
    ImGui.Text('Strike Duration:');
    const strikeDuration: [number] = [data.strikeDuration];
    ImGui.SliderFloat('##strikeDuration', strikeDuration, 0.02, 0.5);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('How long each bolt is visible (seconds)');
    }
    data.strikeDuration = strikeDuration[0];

    // simultaneousStrikes
    ImGui.Text('Simultaneous Strikes:');
    const simultaneousStrikes: [number] = [data.simultaneousStrikes];
    ImGui.SliderInt('##simultaneousStrikes', simultaneousStrikes, 1, 5);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Maximum number of bolts visible at once');
    }
    data.simultaneousStrikes = simultaneousStrikes[0];

    ImGui.Unindent();
  }
}

function renderLightningAppearanceSection(data: LightningField2DData): void {
  if (ImGui.CollapsingHeader('Bolt Appearance##lightningAppearance')) {
    ImGui.Indent();

    // boltColor
    ImGui.Text('Bolt Color:');
    const boltColor: [number, number, number] = [
      data.boltColor.r,
      data.boltColor.g,
      data.boltColor.b,
    ];
    if (ImGui.ColorEdit3('##boltColor', boltColor)) {
      data.boltColor.r = boltColor[0];
      data.boltColor.g = boltColor[1];
      data.boltColor.b = boltColor[2];
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Core bolt color');
    }

    // glowColor
    ImGui.Text('Glow Color:');
    const glowColor: [number, number, number] = [
      data.glowColor.r,
      data.glowColor.g,
      data.glowColor.b,
    ];
    if (ImGui.ColorEdit3('##glowColor', glowColor)) {
      data.glowColor.r = glowColor[0];
      data.glowColor.g = glowColor[1];
      data.glowColor.b = glowColor[2];
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Outer glow color');
    }

    ImGui.Spacing();

    // boltWidth
    ImGui.Text('Bolt Width:');
    const boltWidth: [number] = [data.boltWidth];
    ImGui.SliderFloat('##boltWidth', boltWidth, 0.5, 5);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Core bolt width in pixels');
    }
    data.boltWidth = boltWidth[0];

    // glowRadius
    ImGui.Text('Glow Radius:');
    const glowRadius: [number] = [data.glowRadius];
    ImGui.SliderFloat('##glowRadius', glowRadius, 1, 30);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Glow spread in pixels');
    }
    data.glowRadius = glowRadius[0];

    // glowIntensity
    ImGui.Text('Glow Intensity:');
    const glowIntensity: [number] = [data.glowIntensity];
    ImGui.SliderFloat('##glowIntensity', glowIntensity, 0, 1);
    data.glowIntensity = glowIntensity[0];

    ImGui.Spacing();

    // pixelSize (use DragFloat for fine control, including values < 1)
    ImGui.Text('Pixel Size:');
    const pixelSize: [number] = [data.pixelSize];
    ImGui.DragFloat('##pixelSize', pixelSize, 0.1, 0.1, 16.0, '%.1f');
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Pixelation grid size (smaller = finer detail, 0.1 = no pixelation)');
    }
    data.pixelSize = Math.max(0.1, pixelSize[0]);

    ImGui.Unindent();
  }
}

function renderLightningGenerationSection(data: LightningField2DData): void {
  if (ImGui.CollapsingHeader('Procedural Generation##lightningGeneration')) {
    ImGui.Indent();

    // segments
    ImGui.Text('Segments:');
    const segments: [number] = [data.segments];
    ImGui.SliderInt('##segments', segments, 4, 32);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Number of segments per bolt (higher = more detail)');
    }
    data.segments = segments[0];

    // displacement
    ImGui.Text('Displacement:');
    const displacement: [number] = [data.displacement];
    ImGui.SliderFloat('##displacement', displacement, 0, 1);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Jaggedness of bolt (higher = more displaced)');
    }
    data.displacement = displacement[0];

    // noiseStrength
    ImGui.Text('Noise Strength:');
    const noiseStrength: [number] = [data.noiseStrength];
    ImGui.SliderFloat('##noiseStrength', noiseStrength, 0, 1);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Organic variation added to bolt paths');
    }
    data.noiseStrength = noiseStrength[0];

    ImGui.Spacing();

    // branchProbability
    ImGui.Text('Branch Probability:');
    const branchProbability: [number] = [data.branchProbability];
    ImGui.SliderFloat('##branchProbability', branchProbability, 0, 1);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Chance of spawning branches from main bolt');
    }
    data.branchProbability = branchProbability[0];

    // branchLengthFactor
    ImGui.Text('Branch Length:');
    const branchLengthFactor: [number] = [data.branchLengthFactor];
    ImGui.SliderFloat('##branchLengthFactor', branchLengthFactor, 0.1, 0.8);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Branch length relative to main bolt');
    }
    data.branchLengthFactor = branchLengthFactor[0];

    // subBranchProbability (default to 0.3 if undefined for backwards compatibility)
    ImGui.Text('Sub-Branch Probability:');
    const subBranchProbability: [number] = [data.subBranchProbability ?? 0.3];
    ImGui.SliderFloat('##subBranchProbability', subBranchProbability, 0, 1);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Chance of spawning sub-branches from branches (for more complex lightning)');
    }
    data.subBranchProbability = subBranchProbability[0];

    ImGui.Spacing();

    // seed
    ImGui.Text('Seed:');
    const seed: [number] = [data.seed];
    ImGui.DragInt('##seed', seed, 1, 0, 999999);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Base random seed for bolt generation');
    }
    data.seed = seed[0];

    ImGui.Unindent();
  }
}

function renderLightningAnimationSection(data: LightningField2DData): void {
  if (ImGui.CollapsingHeader('Animation##lightningAnimation')) {
    ImGui.Indent();

    // fadeMode
    ImGui.Text('Fade Mode:');
    const fadeModeMap: Record<LightningField2DData['fadeMode'], string> = {
      instant: 'Instant',
      fade: 'Fade Out',
      flicker: 'Flicker',
    };

    if (ImGui.BeginCombo('##fadeMode', fadeModeMap[data.fadeMode])) {
      for (const [mode, label] of Object.entries(fadeModeMap)) {
        const isSelected = data.fadeMode === mode;
        if (ImGui.Selectable(label, isSelected)) {
          data.fadeMode = mode as LightningField2DData['fadeMode'];
        }
        if (isSelected) {
          ImGui.SetItemDefaultFocus();
        }
      }
      ImGui.EndCombo();
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('How bolts disappear after their duration');
    }

    // flickerSpeed (only if flicker mode)
    if (data.fadeMode === 'flicker') {
      ImGui.Text('Flicker Speed:');
      const flickerSpeed: [number] = [data.flickerSpeed];
      ImGui.SliderFloat('##flickerSpeed', flickerSpeed, 5, 30);
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Flicker cycles per second');
      }
      data.flickerSpeed = flickerSpeed[0];
    }

    ImGui.Unindent();
  }
}

function renderLightningDirectionSection(data: LightningField2DData): void {
  if (ImGui.CollapsingHeader('Direction##lightningDirection')) {
    ImGui.Indent();

    // strikeDirection
    ImGui.Text('Strike Direction:');
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

    if (ImGui.BeginCombo('##strikeDirection', directionMap[data.strikeDirection])) {
      for (const [direction, label] of Object.entries(directionMap)) {
        const isSelected = data.strikeDirection === direction;
        if (ImGui.Selectable(label, isSelected)) {
          data.strikeDirection = direction as LightningField2DData['strikeDirection'];
        }
        if (isSelected) {
          ImGui.SetItemDefaultFocus();
        }
      }
      ImGui.EndCombo();
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Direction bolts travel across the field');
    }

    // angleVariation
    ImGui.Text('Angle Variation:');
    const angleVariation: [number] = [data.angleVariation];
    ImGui.SliderFloat('##angleVariation', angleVariation, 0, 0.5);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Random angle variation in radians');
    }
    data.angleVariation = angleVariation[0];

    ImGui.Unindent();
  }
}

function renderLightningEffectsSection(data: LightningField2DData): void {
  if (ImGui.CollapsingHeader('Effects##lightningEffects')) {
    ImGui.Indent();

    // enableScreenFlash
    const enableScreenFlash: [boolean] = [data.enableScreenFlash];
    ImGui.Checkbox('Enable Screen Flash', enableScreenFlash);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Flash the screen white when lightning strikes');
    }
    data.enableScreenFlash = enableScreenFlash[0];

    if (data.enableScreenFlash) {
      ImGui.Indent();
      ImGui.Text('Flash Intensity:');
      const flashIntensity: [number] = [data.flashIntensity];
      ImGui.SliderFloat('##flashIntensity', flashIntensity, 0, 1);
      data.flashIntensity = flashIntensity[0];
      ImGui.Unindent();
    }

    ImGui.Spacing();

    // enableGroundGlow
    const enableGroundGlow: [boolean] = [data.enableGroundGlow];
    ImGui.Checkbox('Enable Ground Glow', enableGroundGlow);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Add a glow effect at bolt impact point');
    }
    data.enableGroundGlow = enableGroundGlow[0];

    if (data.enableGroundGlow) {
      ImGui.Indent();
      ImGui.Text('Ground Glow Radius:');
      const groundGlowRadius: [number] = [data.groundGlowRadius];
      ImGui.SliderFloat('##groundGlowRadius', groundGlowRadius, 5, 50);
      data.groundGlowRadius = groundGlowRadius[0];
      ImGui.Unindent();
    }

    ImGui.Unindent();
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
      ImGui.Spacing();

      // Preset selector
      renderLightningPresetSelector(componentData);
      ImGui.Separator();
      ImGui.Spacing();

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
