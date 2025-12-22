/**
 * GameTimeSystem
 *
 * Advances game time each frame and fires time-related events.
 * Only runs during play mode.
 */

import { system, isGameplayActive } from '@voidscript/engine';
import { GameTimeManager } from '../resources/game-time-manager.js';
import { WeatherManager } from '../resources/weather-manager.js';
import { EconomyManager } from '../resources/economy-manager.js';
import { ProgressManager } from '../resources/progress-manager.js';
import { PopulationManager } from '../resources/population-manager.js';
import { DayStarted, TimePhaseChanged } from '../events/time-events.js';

/**
 * System that updates game time and fires time events.
 */
export const gameTimeSystem = system(({ commands }) => {
  // Get managers
  const timeManager = commands.tryGetResource(GameTimeManager);
  if (!timeManager) return;

  // Get delta time from commands
  const deltaTime = commands.getDeltaTime();

  // Advance time
  timeManager.advanceTime(deltaTime);

  // Update time references in other managers
  const economyManager = commands.tryGetResource(EconomyManager);
  if (economyManager) {
    economyManager.updateTimeReference(timeManager.currentTime, timeManager.currentDay);
  }

  const progressManager = commands.tryGetResource(ProgressManager);
  if (progressManager) {
    progressManager.updateTimeReference(timeManager.currentTime, timeManager.currentDay);
  }

  // Fire DayStarted event
  if (timeManager.dayStartedThisFrame) {
    const writer = commands.eventWriter(DayStarted);
    writer.send(new DayStarted(timeManager.currentDay));

    // Notify weather manager of new day
    const weatherManager = commands.tryGetResource(WeatherManager);
    if (weatherManager) {
      weatherManager.onNewDay();
    }

    // Check progress milestones
    if (progressManager) {
      const populationManager = commands.tryGetResource(PopulationManager);
      const population = populationManager?.totalVillagers ?? 0;
      progressManager.checkMilestones(timeManager.currentDay, population);
    }
  }

  // Fire TimePhaseChanged event
  if (timeManager.phaseChangedThisFrame) {
    const writer = commands.eventWriter(TimePhaseChanged);
    writer.send(
      new TimePhaseChanged(
        timeManager.previousPhase,
        timeManager.currentPhase,
        timeManager.currentDay,
        timeManager.currentTime,
      ),
    );
  }
}).runIf(isGameplayActive());
