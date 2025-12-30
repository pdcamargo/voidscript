/**
 * Lightning Controller Component
 *
 * Controls timing and behavior of lightning bolts rendered by the lightning-2d.vsl shader.
 * Visual properties (colors, glow, branching) are controlled via Sprite2DMaterial.uniforms.
 * This component only handles timing/control logic.
 *
 * Usage:
 * 1. Add Sprite2D, Sprite2DMaterial (with lightning-2d shader), and LightningController
 * 2. Size is controlled via Transform3D.scale (no baseSize needed)
 * 3. Visual properties are set in Sprite2DMaterial.uniforms
 * 4. Timing/control properties are set here
 */
import {
  component,
  EditorLayout,
  renderDefaultProperties,
} from '@voidscript/engine';

/** Maximum number of simultaneous bolts (must match shader) */
const MAX_BOLTS = 5;

/**
 * Get angle in radians for a given strike direction
 */
function getDirectionAngle(direction: StrikeDirection, angleVariation: number): number {
  let baseAngle: number;

  switch (direction) {
    case 'top-down':
      baseAngle = 0;
      break;
    case 'bottom-up':
      baseAngle = Math.PI;
      break;
    case 'left-right':
      baseAngle = Math.PI / 2;
      break;
    case 'right-left':
      baseAngle = -Math.PI / 2;
      break;
    case 'random':
      baseAngle = Math.random() * Math.PI * 2;
      break;
    default:
      baseAngle = 0;
  }

  // Add random variation
  const variation = (Math.random() - 0.5) * 2 * angleVariation;
  return baseAngle + variation;
}

/**
 * Manually trigger a lightning strike (used by editor button)
 */
function triggerLightningStrike(controller: LightningControllerData): void {
  // Ensure arrays are initialized
  if (!controller._boltActive || controller._boltActive.length !== MAX_BOLTS) {
    controller._boltActive = [0, 0, 0, 0, 0];
    controller._boltSeeds = [0, 0, 0, 0, 0];
    controller._boltAngles = [0, 0, 0, 0, 0];
    controller._boltTimeRemaining = [0, 0, 0, 0, 0];
    controller._boltDuration = [0, 0, 0, 0, 0];
  }

  // Find an inactive bolt slot
  for (let i = 0; i < MAX_BOLTS; i++) {
    if (controller._boltActive[i]! < 0.5) {
      // Activate this bolt
      controller._boltActive[i] = 1;
      controller._boltSeeds[i] = Math.random() * 10000;
      controller._boltAngles[i] = getDirectionAngle(
        controller.strikeDirection,
        controller.angleVariation,
      );
      controller._boltDuration[i] = controller.strikeDuration;
      controller._boltTimeRemaining[i] = controller.strikeDuration;

      // Trigger screen flash if enabled
      if (controller.enableScreenFlash) {
        controller._flashRemaining = controller.strikeDuration;
      }

      break; // Only spawn one bolt per trigger
    }
  }
}

/** Strike direction options */
export type StrikeDirection =
  | 'top-down'
  | 'bottom-up'
  | 'left-right'
  | 'right-left'
  | 'random';

/** Fade mode options */
export type FadeMode = 'instant' | 'fade' | 'flicker';

export interface LightningControllerData {
  // Strike timing
  /** Minimum time between strikes (seconds) */
  minInterval: number;
  /** Maximum time between strikes (seconds) */
  maxInterval: number;
  /** Duration of each strike (seconds) */
  strikeDuration: number;
  /** Maximum number of simultaneous strikes (1-5) */
  simultaneousStrikes: number;

  // Animation
  /** How bolts disappear: instant, fade, or flicker */
  fadeMode: FadeMode;
  /** Speed of flicker effect (only used if fadeMode is 'flicker') */
  flickerSpeed: number;

  // Direction
  /** Direction of lightning strikes */
  strikeDirection: StrikeDirection;
  /** Random angle variation in radians */
  angleVariation: number;

  // Effects
  /** Enable screen flash effect on strike */
  enableScreenFlash: boolean;
  /** Intensity of screen flash (0-1) */
  flashIntensity: number;

  // Runtime state (not serialized - managed by system)
  /** @internal Current timer until next strike */
  _strikeTimer: number;
  /** @internal Time until next strike */
  _nextStrikeTime: number;
  /** @internal Screen flash remaining time */
  _flashRemaining: number;
  /** @internal Elapsed time for animations */
  _elapsedTime: number;
  /** @internal Per-bolt state arrays (managed by system) */
  _boltActive: number[];
  _boltSeeds: number[];
  _boltAngles: number[];
  _boltTimeRemaining: number[];
  _boltDuration: number[];
}

export const LightningController = component<LightningControllerData>(
  'LightningController',
  {
    // Strike timing
    minInterval: {
      serializable: true,
      instanceType: Number,
    },
    maxInterval: {
      serializable: true,
      instanceType: Number,
    },
    strikeDuration: {
      serializable: true,
      instanceType: Number,
    },
    simultaneousStrikes: {
      serializable: true,
      instanceType: Number,
    },

    // Animation
    fadeMode: {
      serializable: true,
      type: 'enum',
      enum: { instant: 'instant', fade: 'fade', flicker: 'flicker' },
    },
    flickerSpeed: {
      serializable: true,
      instanceType: Number,
    },

    // Direction
    strikeDirection: {
      serializable: true,
      type: 'enum',
      enum: {
        'top-down': 'top-down',
        'bottom-up': 'bottom-up',
        'left-right': 'left-right',
        'right-left': 'right-left',
        random: 'random',
      },
    },
    angleVariation: {
      serializable: true,
      instanceType: Number,
    },

    // Effects
    enableScreenFlash: {
      serializable: true,
      instanceType: Boolean,
    },
    flashIntensity: {
      serializable: true,
      instanceType: Number,
    },

    // Runtime state (not serialized)
    _strikeTimer: { serializable: false },
    _nextStrikeTime: { serializable: false },
    _flashRemaining: { serializable: false },
    _elapsedTime: { serializable: false },
    _boltActive: { serializable: false },
    _boltSeeds: { serializable: false },
    _boltAngles: { serializable: false },
    _boltTimeRemaining: { serializable: false },
    _boltDuration: { serializable: false },
  },
  {
    displayName: 'Lightning Controller',
    description:
      'Controls timing and behavior of lightning bolts. Add with Sprite2D + Sprite2DMaterial (lightning-2d shader).',
    path: 'effects/lightning',
    customEditor: ({ componentData, componentType, commands }) => {
      // Trigger Strike button at the top
      if (EditorLayout.button('Trigger Strike')) {
        triggerLightningStrike(componentData);
      }

      EditorLayout.separator();

      // Render all default properties
      renderDefaultProperties(componentType, componentData, commands);
    },
    defaultValue: () => ({
      // Strike timing
      minInterval: 2.0,
      maxInterval: 8.0,
      strikeDuration: 0.15,
      simultaneousStrikes: 1,

      // Animation
      fadeMode: 'fade' as FadeMode,
      flickerSpeed: 15,

      // Direction
      strikeDirection: 'top-down' as StrikeDirection,
      angleVariation: 0.1,

      // Effects
      enableScreenFlash: false,
      flashIntensity: 0.3,

      // Runtime state (initialized by system)
      _strikeTimer: 0,
      _nextStrikeTime: 0,
      _flashRemaining: 0,
      _elapsedTime: 0,
      _boltActive: [0, 0, 0, 0, 0],
      _boltSeeds: [0, 0, 0, 0, 0],
      _boltAngles: [0, 0, 0, 0, 0],
      _boltTimeRemaining: [0, 0, 0, 0, 0],
      _boltDuration: [0, 0, 0, 0, 0],
    }),
  },
);
