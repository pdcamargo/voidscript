/**
 * Weather-related events for the Kingdom game.
 */

import { WeatherCondition } from '../types/enums.js';

/**
 * Fired when weather conditions change.
 */
export class WeatherChanged {
  constructor(
    /** The previous weather conditions (bitfield) */
    public readonly previousConditions: number,
    /** The new weather conditions (bitfield) */
    public readonly newConditions: number,
    /** Current weather intensity (0.0 - 1.0) */
    public readonly intensity: number,
  ) {}

  /**
   * Check if a specific condition is now active.
   */
  hasCondition(condition: WeatherCondition): boolean {
    return (this.newConditions & condition) !== 0;
  }

  /**
   * Check if a specific condition was previously active.
   */
  hadCondition(condition: WeatherCondition): boolean {
    return (this.previousConditions & condition) !== 0;
  }

  /**
   * Check if a specific condition just started.
   */
  conditionStarted(condition: WeatherCondition): boolean {
    return !this.hadCondition(condition) && this.hasCondition(condition);
  }

  /**
   * Check if a specific condition just ended.
   */
  conditionEnded(condition: WeatherCondition): boolean {
    return this.hadCondition(condition) && !this.hasCondition(condition);
  }
}
