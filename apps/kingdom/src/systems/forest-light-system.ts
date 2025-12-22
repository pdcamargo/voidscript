import { system, Light3D, isGameplayActive } from '@voidscript/engine';
import { SunLight } from '../components/sun-light.js';
import { WeatherManager } from '../resources/weather-manager.js';
import { EnteredForest, ExitedForest } from '../events/forest-events.js';

/**
 * Forest Light System
 *
 * Reacts to EnteredForest/ExitedForest events and updates Light3D components
 * that have the SunLight marker component.
 *
 * When entering forest: applies forest light settings (dimmer, for forest ambiance)
 * When exiting forest: restores day light settings
 */
export const forestLightSystem = system(({ commands }) => {
  const weatherManager = commands.tryGetResource(WeatherManager);
  if (!weatherManager) return;

  // Check for entered forest events
  const enteredReader = commands.eventReader(EnteredForest);
  for (const _event of enteredReader.read()) {
    console.log('Entered forest');

    // Apply forest light settings
    commands
      .query()
      .all(Light3D, SunLight)
      .each((_entity, light, sunLight) => {
        if (sunLight.isAmbient) {
          light.intensity = weatherManager.forestAmbientLightIntensity;
          light.color = { ...weatherManager.forestAmbientLightColor };
        } else {
          light.intensity = weatherManager.forestLightIntensity;
          light.color = { ...weatherManager.forestLightColor };
        }
      });
  }

  // Check for exited forest events
  const exitedReader = commands.eventReader(ExitedForest);
  for (const _event of exitedReader.read()) {
    // Restore day light settings (could be expanded for day/night cycle)
    commands
      .query()
      .all(Light3D, SunLight)
      .each((_entity, light, sunLight) => {
        if (sunLight.isAmbient) {
          light.intensity = weatherManager.dayAmbientLightIntensity;
          light.color = { ...weatherManager.dayAmbientLightColor };
        } else {
          light.intensity = weatherManager.dayLightIntensity;
          light.color = { ...weatherManager.dayLightColor };
        }
      });
  }
}).runIf(isGameplayActive());
