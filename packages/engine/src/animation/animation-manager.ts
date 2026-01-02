/**
 * Animation Manager
 *
 * Global resource for controlling animation playback across the engine.
 * Provides time scaling and pause functionality for all animations.
 */

// ============================================================================
// AnimationManager
// ============================================================================

/**
 * Global animation manager resource.
 *
 * Register as a resource with Application to enable global animation control:
 * ```typescript
 * app.insertResource(new AnimationManager());
 * ```
 *
 * The AnimationUpdateSystem uses this to get effective delta time.
 */
export class AnimationManager {
  private _globalSpeed: number = 1.0;
  private _isPaused: boolean = false;

  // ============================================================================
  // Global Speed Control
  // ============================================================================

  /**
   * Set global speed multiplier for all animations.
   * @param speed - Speed multiplier (1.0 = normal, 0.5 = half speed, 2.0 = double speed)
   */
  setGlobalSpeed(speed: number): void {
    this._globalSpeed = Math.max(0, speed);
  }

  /**
   * Get the current global speed multiplier.
   */
  getGlobalSpeed(): number {
    return this._globalSpeed;
  }

  // ============================================================================
  // Pause Control
  // ============================================================================

  /**
   * Pause all animations globally.
   */
  pauseAll(): void {
    this._isPaused = true;
  }

  /**
   * Resume all animations globally.
   */
  resumeAll(): void {
    this._isPaused = false;
  }

  /**
   * Check if animations are globally paused.
   */
  isPausedGlobally(): boolean {
    return this._isPaused;
  }

  /**
   * Toggle global pause state.
   * @returns New pause state
   */
  togglePause(): boolean {
    this._isPaused = !this._isPaused;
    return this._isPaused;
  }

  // ============================================================================
  // Delta Time Calculation
  // ============================================================================

  /**
   * Get effective delta time considering global speed and pause state.
   *
   * Used by AnimationUpdateSystem to scale animation time.
   *
   * @param deltaTime - Raw delta time from the frame
   * @returns Effective delta time (0 if paused)
   */
  getEffectiveDeltaTime(deltaTime: number): number {
    if (this._isPaused) return 0;
    return deltaTime * this._globalSpeed;
  }

  // Public getters/setters for serialization
  get globalSpeed(): number {
    return this._globalSpeed;
  }
  set globalSpeed(value: number) {
    this._globalSpeed = Math.max(0, value);
  }

  get isPaused(): boolean {
    return this._isPaused;
  }
  set isPaused(value: boolean) {
    this._isPaused = value;
  }
}

// Register AnimationManager as a resource with serializable properties
import { registerResource } from '@voidscript/core';
registerResource(AnimationManager, {
  globalSpeed: {
    serializable: true,
    instanceType: Number,
    tooltip: 'Global speed multiplier for all animations (1.0 = normal)',
  },
  isPaused: {
    serializable: true,
    instanceType: Boolean,
    tooltip: 'Whether all animations are globally paused',
  },
}, {
  path: 'animation',
  displayName: 'Animation Manager',
  description: 'Global animation playback control',
  builtIn: true,
});
