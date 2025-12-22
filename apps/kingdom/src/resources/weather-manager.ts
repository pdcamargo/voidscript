/**
 * WeatherManager Resource
 *
 * Manages weather conditions and daily weather schedules.
 * Also includes light settings for different weather/environment conditions.
 * Used by systems to adjust lighting, particles, fog, etc.
 */

import { WeatherCondition } from '../types/enums.js';

/**
 * A single entry in the daily weather schedule.
 */
export interface WeatherScheduleEntry {
  /** Hour when this weather starts (0-24) */
  startHour: number;
  /** Weather conditions (bitfield of WeatherCondition flags) */
  conditions: number;
  /** Weather intensity (0.0 - 1.0, affects rain/fog strength) */
  intensity?: number;
}

/**
 * Preset weather schedules for common day types.
 */
export const WeatherPresets = {
  /** Clear sunny day */
  sunny: [
    { startHour: 0, conditions: WeatherCondition.Clear, intensity: 0 },
  ] as WeatherScheduleEntry[],

  /** Light clouds in the afternoon */
  partlyCloudy: [
    { startHour: 0, conditions: WeatherCondition.Clear, intensity: 0 },
    { startHour: 12, conditions: WeatherCondition.Cloudy, intensity: 0.3 },
    { startHour: 18, conditions: WeatherCondition.Clear, intensity: 0 },
  ] as WeatherScheduleEntry[],

  /** Rain starting in the evening */
  eveningRain: [
    { startHour: 0, conditions: WeatherCondition.Clear, intensity: 0 },
    { startHour: 14, conditions: WeatherCondition.Cloudy, intensity: 0.4 },
    {
      startHour: 18,
      conditions: WeatherCondition.Rainy | WeatherCondition.Cloudy,
      intensity: 0.7,
    },
  ] as WeatherScheduleEntry[],

  /** Rainy all day */
  rainyDay: [
    {
      startHour: 0,
      conditions: WeatherCondition.Rainy | WeatherCondition.Cloudy,
      intensity: 0.6,
    },
  ] as WeatherScheduleEntry[],

  /** Storm at night */
  nightStorm: [
    { startHour: 0, conditions: WeatherCondition.Cloudy, intensity: 0.3 },
    { startHour: 12, conditions: WeatherCondition.Cloudy, intensity: 0.5 },
    {
      startHour: 20,
      conditions:
        WeatherCondition.Stormy |
        WeatherCondition.Rainy |
        WeatherCondition.Windy,
      intensity: 0.9,
    },
  ] as WeatherScheduleEntry[],

  /** Foggy morning */
  foggyMorning: [
    {
      startHour: 0,
      conditions: WeatherCondition.Foggy | WeatherCondition.Cloudy,
      intensity: 0.7,
    },
    { startHour: 10, conditions: WeatherCondition.Cloudy, intensity: 0.3 },
    { startHour: 14, conditions: WeatherCondition.Clear, intensity: 0 },
  ] as WeatherScheduleEntry[],
};

export class WeatherManager {
  // ============================================================================
  // Weather State
  // ============================================================================

  /**
   * Current weather conditions (bitfield of WeatherCondition flags).
   */
  currentConditions: number = WeatherCondition.Clear;

  /**
   * Previous weather conditions (for detecting changes).
   */
  private _previousConditions: number = WeatherCondition.Clear;

  /**
   * Whether conditions changed this frame.
   */
  private _conditionsChangedThisFrame = false;

  /**
   * Current weather intensity (0.0 - 1.0).
   * Affects visual strength of rain, fog, etc.
   */
  intensity = 0;

  /**
   * Today's weather schedule.
   */
  todaySchedule: WeatherScheduleEntry[] = [
    { startHour: 0, conditions: WeatherCondition.Clear, intensity: 0 },
  ];

  /**
   * Index of the current schedule entry being applied.
   */
  private _currentScheduleIndex = 0;

  // ============================================================================
  // Light Settings (preserved from original)
  // ============================================================================

  // Light intensities
  dayLightIntensity = 3;
  nightLightIntensity = 1;
  forestLightIntensity = 1.8;

  // Ambient light intensities
  dayAmbientLightIntensity = 1.3;
  nightAmbientLightIntensity = 0.7;
  forestAmbientLightIntensity = 0.5;

  // Light colors (all default to white)
  dayLightColor = { r: 1, g: 1, b: 1 };
  nightLightColor = { r: 1, g: 1, b: 1 };
  forestLightColor = { r: 1, g: 1, b: 1 };

  // Ambient light colors (all default to white)
  dayAmbientLightColor = { r: 1, g: 1, b: 1 };
  nightAmbientLightColor = { r: 1, g: 1, b: 1 };
  forestAmbientLightColor = { r: 1, g: 1, b: 1 };

  // Weather-specific light modifiers
  rainyLightMultiplier = 0.6;
  foggyLightMultiplier = 0.7;
  stormyLightMultiplier = 0.4;

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Get the previous weather conditions.
   */
  get previousConditions(): number {
    return this._previousConditions;
  }

  /**
   * Check if conditions changed this frame.
   */
  get conditionsChangedThisFrame(): boolean {
    return this._conditionsChangedThisFrame;
  }

  // ============================================================================
  // Weather Condition Methods
  // ============================================================================

  /**
   * Check if a specific condition is currently active.
   */
  hasCondition(condition: WeatherCondition): boolean {
    return (this.currentConditions & condition) !== 0;
  }

  /**
   * Set weather conditions directly (bypasses schedule).
   */
  setConditions(conditions: number, intensity = 0.5): void {
    this._previousConditions = this.currentConditions;
    this.currentConditions = conditions;
    this.intensity = intensity;
    this._conditionsChangedThisFrame =
      this._previousConditions !== this.currentConditions;
  }

  /**
   * Add a condition to current weather.
   */
  addCondition(condition: WeatherCondition): void {
    this._previousConditions = this.currentConditions;
    this.currentConditions |= condition;
    this._conditionsChangedThisFrame =
      this._previousConditions !== this.currentConditions;
  }

  /**
   * Remove a condition from current weather.
   */
  removeCondition(condition: WeatherCondition): void {
    this._previousConditions = this.currentConditions;
    this.currentConditions &= ~condition;
    this._conditionsChangedThisFrame =
      this._previousConditions !== this.currentConditions;
  }

  /**
   * Clear all weather conditions (set to Clear).
   */
  clearConditions(): void {
    this.setConditions(WeatherCondition.Clear, 0);
  }

  // ============================================================================
  // Schedule Methods
  // ============================================================================

  /**
   * Set today's weather schedule.
   * Schedule entries must be sorted by startHour.
   */
  setDailySchedule(schedule: WeatherScheduleEntry[]): void {
    // Sort by start hour
    this.todaySchedule = [...schedule].sort((a, b) => a.startHour - b.startHour);
    this._currentScheduleIndex = 0;
  }

  /**
   * Set schedule from a preset.
   */
  setPreset(presetName: keyof typeof WeatherPresets): void {
    this.setDailySchedule(WeatherPresets[presetName]);
  }

  /**
   * Generate a random weather schedule.
   *
   * @param seed Optional seed for deterministic generation
   */
  generateRandomSchedule(seed?: number): void {
    // Simple seeded random (if no seed, use current time)
    const rng = this.createRng(seed ?? Date.now());

    const schedule: WeatherScheduleEntry[] = [];

    // Morning weather
    const morningRoll = rng();
    if (morningRoll < 0.6) {
      schedule.push({
        startHour: 0,
        conditions: WeatherCondition.Clear,
        intensity: 0,
      });
    } else if (morningRoll < 0.8) {
      schedule.push({
        startHour: 0,
        conditions: WeatherCondition.Foggy,
        intensity: 0.5 + rng() * 0.3,
      });
    } else {
      schedule.push({
        startHour: 0,
        conditions: WeatherCondition.Cloudy,
        intensity: 0.3 + rng() * 0.3,
      });
    }

    // Afternoon weather
    const afternoonRoll = rng();
    if (afternoonRoll < 0.5) {
      schedule.push({
        startHour: 12,
        conditions: WeatherCondition.Clear,
        intensity: 0,
      });
    } else if (afternoonRoll < 0.7) {
      schedule.push({
        startHour: 12,
        conditions: WeatherCondition.Cloudy,
        intensity: 0.3 + rng() * 0.3,
      });
    } else {
      schedule.push({
        startHour: 12,
        conditions: WeatherCondition.Rainy | WeatherCondition.Cloudy,
        intensity: 0.4 + rng() * 0.4,
      });
    }

    // Evening/Night weather
    const nightRoll = rng();
    if (nightRoll < 0.4) {
      schedule.push({
        startHour: 18,
        conditions: WeatherCondition.Clear,
        intensity: 0,
      });
    } else if (nightRoll < 0.7) {
      schedule.push({
        startHour: 18,
        conditions: WeatherCondition.Cloudy,
        intensity: 0.3 + rng() * 0.3,
      });
    } else if (nightRoll < 0.9) {
      schedule.push({
        startHour: 18,
        conditions: WeatherCondition.Rainy | WeatherCondition.Cloudy,
        intensity: 0.5 + rng() * 0.4,
      });
    } else {
      schedule.push({
        startHour: 18,
        conditions:
          WeatherCondition.Stormy |
          WeatherCondition.Rainy |
          WeatherCondition.Windy,
        intensity: 0.7 + rng() * 0.3,
      });
    }

    this.setDailySchedule(schedule);
  }

  /**
   * Update weather based on current game time.
   * Called by WeatherScheduleSystem.
   *
   * @param currentTime Current game time (0-24)
   */
  updateFromSchedule(currentTime: number): void {
    if (this.todaySchedule.length === 0) return;

    // Find the applicable schedule entry
    let applicableIndex = 0;
    for (let i = 0; i < this.todaySchedule.length; i++) {
      const scheduleEntry = this.todaySchedule[i];
      if (scheduleEntry && currentTime >= scheduleEntry.startHour) {
        applicableIndex = i;
      }
    }

    // Only update if we moved to a new schedule entry
    if (applicableIndex !== this._currentScheduleIndex) {
      this._currentScheduleIndex = applicableIndex;
      const entry = this.todaySchedule[applicableIndex];
      if (!entry) return;

      this._previousConditions = this.currentConditions;
      this.currentConditions = entry.conditions;
      this.intensity = entry.intensity ?? 0.5;
      this._conditionsChangedThisFrame =
        this._previousConditions !== this.currentConditions;
    } else {
      this._conditionsChangedThisFrame = false;
    }
  }

  /**
   * Reset for a new day (called when day changes).
   */
  onNewDay(): void {
    this._currentScheduleIndex = 0;
    // Optionally generate new random schedule
    // this.generateRandomSchedule();
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get a light intensity multiplier based on current weather.
   */
  getWeatherLightMultiplier(): number {
    if (this.hasCondition(WeatherCondition.Stormy)) {
      return this.stormyLightMultiplier * this.intensity;
    }
    if (this.hasCondition(WeatherCondition.Rainy)) {
      return this.rainyLightMultiplier * this.intensity;
    }
    if (this.hasCondition(WeatherCondition.Foggy)) {
      return this.foggyLightMultiplier * this.intensity;
    }
    if (this.hasCondition(WeatherCondition.Cloudy)) {
      return 1 - 0.2 * this.intensity;
    }
    return 1;
  }

  /**
   * Get a human-readable description of current weather.
   */
  getWeatherDescription(): string {
    const parts: string[] = [];

    if (this.hasCondition(WeatherCondition.Stormy)) parts.push('Stormy');
    else if (this.hasCondition(WeatherCondition.Rainy)) parts.push('Rainy');

    if (this.hasCondition(WeatherCondition.Foggy)) parts.push('Foggy');
    if (this.hasCondition(WeatherCondition.Windy)) parts.push('Windy');
    if (this.hasCondition(WeatherCondition.Snowy)) parts.push('Snowy');

    if (this.hasCondition(WeatherCondition.Cloudy) && parts.length === 0) {
      parts.push('Cloudy');
    }

    if (parts.length === 0 && this.hasCondition(WeatherCondition.Clear)) {
      parts.push('Clear');
    }

    return parts.join(', ') || 'Unknown';
  }

  /**
   * Reset frame flags (called at end of frame).
   */
  resetFrameFlags(): void {
    this._conditionsChangedThisFrame = false;
  }

  /**
   * Simple seeded random number generator.
   */
  private createRng(seed: number): () => number {
    let s = seed;
    return () => {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
  }
}
