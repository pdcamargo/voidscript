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
}
