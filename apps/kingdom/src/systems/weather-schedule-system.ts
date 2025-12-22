/**
 * WeatherScheduleSystem
 *
 * Updates weather conditions based on the daily schedule.
 * Fires weather change events when conditions change.
 * Only runs during play mode.
 */

import { system, isGameplayActive } from '@voidscript/engine';
import { GameTimeManager } from '../resources/game-time-manager.js';
import { WeatherManager } from '../resources/weather-manager.js';
import { WeatherChanged } from '../events/weather-events.js';

/**
 * System that updates weather from schedule and fires events.
 */
export const weatherScheduleSystem = system(({ commands }) => {
  // Get managers
  const timeManager = commands.tryGetResource(GameTimeManager);
  const weatherManager = commands.tryGetResource(WeatherManager);

  if (!timeManager || !weatherManager) return;

  // Update weather from schedule
  weatherManager.updateFromSchedule(timeManager.currentTime);

  // Fire WeatherChanged event if conditions changed
  if (weatherManager.conditionsChangedThisFrame) {
    const writer = commands.eventWriter(WeatherChanged);
    writer.send(
      new WeatherChanged(
        weatherManager.previousConditions,
        weatherManager.currentConditions,
        weatherManager.intensity,
      ),
    );
  }
}).runIf(isGameplayActive());
