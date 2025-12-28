/**
 * GameTimeManager Resource
 *
 * Manages the game's day/night cycle and time progression.
 * Tracks current time (0-24 hours), day count, and time phases.
 */

import { TimePhase } from '../types/enums.js';

/**
 * Configuration for time phase thresholds.
 */
export interface TimePhaseConfig {
  /** Hour when Dawn starts (default: 5) */
  dawnStart: number;
  /** Hour when Morning starts (default: 7) */
  morningStart: number;
  /** Hour when Noon starts (default: 12) */
  noonStart: number;
  /** Hour when Afternoon starts (default: 14) */
  afternoonStart: number;
  /** Hour when Dusk starts (default: 17) */
  duskStart: number;
  /** Hour when Night starts (default: 20) */
  nightStart: number;
}

/**
 * Default time phase configuration.
 */
export const DEFAULT_TIME_PHASE_CONFIG: TimePhaseConfig = {
  dawnStart: 5,
  morningStart: 7,
  noonStart: 12,
  afternoonStart: 14,
  duskStart: 17,
  nightStart: 20,
};

export class GameTimeManager {
  // ============================================================================
  // State
  // ============================================================================

  /**
   * Current game time in hours (0.0 - 24.0).
   * Wraps around at 24.0 back to 0.0.
   */
  currentTime = 6.0; // Start at 6 AM

  /**
   * Current day number (1-indexed).
   */
  currentDay = 1;

  /**
   * Game hours per real second.
   * Default: 0.5 = 2 real minutes per game hour = 48 real minutes per game day.
   */
  timeSpeed = 0.5;

  /**
   * Whether time progression is paused.
   */
  isPaused = false;

  /**
   * Current time phase based on currentTime.
   */
  private _currentPhase: TimePhase = TimePhase.Morning;

  /**
   * Previous phase (for detecting transitions).
   */
  private _previousPhase: TimePhase = TimePhase.Morning;

  /**
   * Whether a phase change occurred this frame.
   */
  private _phaseChangedThisFrame = false;

  /**
   * Whether a new day started this frame.
   */
  private _dayStartedThisFrame = false;

  /**
   * Time phase thresholds configuration.
   */
  phaseConfig: TimePhaseConfig = { ...DEFAULT_TIME_PHASE_CONFIG };

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Get the current time phase.
   */
  get currentPhase(): TimePhase {
    return this._currentPhase;
  }

  /**
   * Get the previous time phase (from last frame).
   */
  get previousPhase(): TimePhase {
    return this._previousPhase;
  }

  /**
   * Check if a phase change occurred this frame.
   */
  get phaseChangedThisFrame(): boolean {
    return this._phaseChangedThisFrame;
  }

  /**
   * Check if a new day started this frame.
   */
  get dayStartedThisFrame(): boolean {
    return this._dayStartedThisFrame;
  }

  // ============================================================================
  // Methods
  // ============================================================================

  /**
   * Advance time by the given real-time delta.
   * Called by GameTimeSystem each frame.
   *
   * @param deltaSeconds Real-time seconds since last frame
   */
  advanceTime(deltaSeconds: number): void {
    if (this.isPaused) {
      this._phaseChangedThisFrame = false;
      this._dayStartedThisFrame = false;
      return;
    }

    // Calculate time advance
    const timeAdvance = deltaSeconds * this.timeSpeed;
    const previousTime = this.currentTime;
    this.currentTime += timeAdvance;

    // Check for day wrap
    this._dayStartedThisFrame = false;
    if (this.currentTime >= 24.0) {
      this.currentTime -= 24.0;
      this.currentDay++;
      this._dayStartedThisFrame = true;
    }

    // Update phase
    this._previousPhase = this._currentPhase;
    this._currentPhase = this.calculatePhase(this.currentTime);
    this._phaseChangedThisFrame = this._previousPhase !== this._currentPhase;
  }

  /**
   * Set the current time directly (for debug/editor).
   *
   * @param hour Hour to set (0-24)
   */
  setTime(hour: number): void {
    this.currentTime = Math.max(0, Math.min(24, hour));
    this._previousPhase = this._currentPhase;
    this._currentPhase = this.calculatePhase(this.currentTime);
    this._phaseChangedThisFrame = this._previousPhase !== this._currentPhase;
    this._dayStartedThisFrame = false;
  }

  /**
   * Skip to the start of the next time phase.
   */
  skipToNextPhase(): void {
    const config = this.phaseConfig;
    const phase = this._currentPhase;

    let nextHour: number;
    switch (phase) {
      case TimePhase.Night:
        nextHour = config.dawnStart;
        break;
      case TimePhase.Dawn:
        nextHour = config.morningStart;
        break;
      case TimePhase.Morning:
        nextHour = config.noonStart;
        break;
      case TimePhase.Noon:
        nextHour = config.afternoonStart;
        break;
      case TimePhase.Afternoon:
        nextHour = config.duskStart;
        break;
      case TimePhase.Dusk:
        nextHour = config.nightStart;
        break;
      default:
        nextHour = config.dawnStart;
    }

    // Handle wrap-around for night -> dawn
    if (nextHour < this.currentTime) {
      this.currentDay++;
      this._dayStartedThisFrame = true;
    }

    this.setTime(nextHour);
  }

  /**
   * Get the progress within the current phase (0.0 - 1.0).
   */
  getPhaseProgress(): number {
    const config = this.phaseConfig;
    const time = this.currentTime;

    let phaseStart: number;
    let phaseEnd: number;

    switch (this._currentPhase) {
      case TimePhase.Dawn:
        phaseStart = config.dawnStart;
        phaseEnd = config.morningStart;
        break;
      case TimePhase.Morning:
        phaseStart = config.morningStart;
        phaseEnd = config.noonStart;
        break;
      case TimePhase.Noon:
        phaseStart = config.noonStart;
        phaseEnd = config.afternoonStart;
        break;
      case TimePhase.Afternoon:
        phaseStart = config.afternoonStart;
        phaseEnd = config.duskStart;
        break;
      case TimePhase.Dusk:
        phaseStart = config.duskStart;
        phaseEnd = config.nightStart;
        break;
      case TimePhase.Night:
        // Night wraps around midnight
        if (time >= config.nightStart) {
          phaseStart = config.nightStart;
          phaseEnd = 24 + config.dawnStart;
          return (time - phaseStart) / (phaseEnd - phaseStart);
        } else {
          phaseStart = config.nightStart - 24;
          phaseEnd = config.dawnStart;
          return (time - 0) / (phaseEnd - 0);
        }
      default:
        return 0;
    }

    return (time - phaseStart) / (phaseEnd - phaseStart);
  }

  /**
   * Check if it's currently daytime (Dawn through Dusk).
   */
  isDaytime(): boolean {
    return (
      this._currentPhase !== TimePhase.Night &&
      this._currentPhase !== TimePhase.Dusk
    );
  }

  /**
   * Check if it's currently nighttime (Night phase only).
   */
  isNighttime(): boolean {
    return this._currentPhase === TimePhase.Night;
  }

  /**
   * Get the current time as a formatted string (e.g., "14:30").
   */
  getTimeString(): string {
    const hours = Math.floor(this.currentTime);
    const minutes = Math.floor((this.currentTime % 1) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Calculate which phase a given hour falls into.
   */
  private calculatePhase(hour: number): TimePhase {
    const config = this.phaseConfig;

    // Night wraps around midnight
    if (hour >= config.nightStart || hour < config.dawnStart) {
      return TimePhase.Night;
    }
    if (hour >= config.duskStart) {
      return TimePhase.Dusk;
    }
    if (hour >= config.afternoonStart) {
      return TimePhase.Afternoon;
    }
    if (hour >= config.noonStart) {
      return TimePhase.Noon;
    }
    if (hour >= config.morningStart) {
      return TimePhase.Morning;
    }
    if (hour >= config.dawnStart) {
      return TimePhase.Dawn;
    }

    return TimePhase.Night;
  }

  /**
   * Reset the frame flags (called at end of frame by system).
   */
  resetFrameFlags(): void {
    this._phaseChangedThisFrame = false;
    this._dayStartedThisFrame = false;
  }
}

// Register GameTimeManager as a resource with serializable properties
import { registerResource } from '@voidscript/engine';
registerResource(GameTimeManager, {
  currentTime: {
    serializable: true,
    instanceType: Number,
    tooltip: 'Current game time in hours (0.0 - 24.0)',
  },
  currentDay: {
    serializable: true,
    instanceType: Number,
    tooltip: 'Current day number (1-indexed)',
  },
  timeSpeed: {
    serializable: true,
    instanceType: Number,
    tooltip: 'Game hours per real second',
  },
  isPaused: {
    serializable: true,
    instanceType: Boolean,
    tooltip: 'Whether time progression is paused',
  },
}, {
  path: 'kingdom/time',
  displayName: 'Game Time Manager',
  description: 'Manages day/night cycle and time progression',
  builtIn: false,
  defaultValue: () => new GameTimeManager(),
});
