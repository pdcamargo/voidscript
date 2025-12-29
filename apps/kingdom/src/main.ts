import {
  Application,
  preloadAssets,
  createTauriPlatform,
  AssetDatabase,
  system,
  isGameplayActive,
} from '@voidscript/engine';
import { save, open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { resourceDir, join } from '@tauri-apps/api/path';

import { GameLayer } from './game-layer.js';
import { openCloudGeneratorWindow } from './ui/cloud-generator-panel.js';
import { openMoonGeneratorWindow } from './ui/moon-generator-panel.js';
import { openSunGeneratorWindow } from './ui/sun-generator-panel.js';

// Import events
import { EnteredForest, ExitedForest } from './events/forest-events.js';
import { DayStarted, TimePhaseChanged } from './events/time-events.js';
import { WeatherChanged } from './events/weather-events.js';
import {
  VillagerHired,
  VillagerAssigned,
  VillagerDied,
  HomelessSpawned,
} from './events/population-events.js';
import {
  BuildingConstructed,
  BuildingUpgraded,
  BuildingDestroyed,
  BuildingDamaged,
} from './events/building-events.js';
import {
  CurrencyChanged,
  TransactionRecorded,
} from './events/economy-events.js';
import {
  ProgressUnlocked,
  StatisticUpdated,
} from './events/progress-events.js';

// Import resources
import { GameTimeManager } from './resources/game-time-manager.js';
import { WeatherManager } from './resources/weather-manager.js';
import { PopulationManager } from './resources/population-manager.js';
import { BuildingManager } from './resources/building-manager.js';
import { EconomyManager } from './resources/economy-manager.js';
import { ProgressManager } from './resources/progress-manager.js';

// Import components to register them with the ECS
import './components/cloud-2d.js';
import './components/sun-light.js';
import './components/villager.js';
import './components/homeless.js';
import './components/building.js';
import './components/camp-fire.js';

async function main() {
  const app = new Application({
    window: {
      canvas: '#render-canvas',
      title: 'Reimagined',
      fullscreen: true,
    },
    renderer: {
      clearColor: 0x87ceeb,
      antialias: false,
      shadows: false,
    },
    imgui: {
      enableDocking: true,
      enableDemos: false,
      customFont: {
        url: '/font.ttf',
        size: 16,
      },
      theme: 'moonlight',
    },
    physics: {
      enable2D: true,
      gravity2D: { x: 0, y: -9.81 },
    },

    // Load assets from JSON manifest file
    assetsManifest: '/assets/manifest.json',

    // Platform for file operations (Tauri native dialogs + path utilities)
    platform: createTauriPlatform(save, open, readTextFile, writeTextFile, {
      pathUtils: { resourceDir, join },
      // Source assets directory for saving manifest during development
      sourceAssetsDir: '/Users/pdcamargo/dev/dreampact/apps/kingdom/public',
    }),

    // defaultWorld: {
    //   source:
    //     '/Users/pdcamargo/dev/dreampact/apps/reimagine/src/worlds/world.json',
    //   autoLoad: true,
    // },

    // Editor configuration
    editor: {
      enabled: true,
      showHelpers: true,
      showDebugPanel: true,
      onPlay: () => console.log('[Editor] Play mode started'),
      onStop: () => console.log('[Editor] Returned to edit mode'),
      onPause: () => console.log('[Editor] Paused'),
      menuCallbacks: {
        windowMenuItems: [
          {
            label: 'Cloud Texture Generator',
            onClick: () => openCloudGeneratorWindow(),
            separatorBefore: true,
          },
          {
            label: 'Moon Texture Generator',
            onClick: () => openMoonGeneratorWindow(),
          },
          {
            label: 'Sun Texture Generator',
            onClick: () => openSunGeneratorWindow(),
          },
        ],
      },
    },
  });

  class ClickEvent {}

  // Register events - Forest
  app.addEvent(EnteredForest);
  app.addEvent(ExitedForest);
  app.addEvent(ClickEvent);

  // Register events - Time
  app.addEvent(DayStarted);
  app.addEvent(TimePhaseChanged);

  // Register events - Weather
  app.addEvent(WeatherChanged);

  // Register events - Population
  app.addEvent(VillagerHired);
  app.addEvent(VillagerAssigned);
  app.addEvent(VillagerDied);
  app.addEvent(HomelessSpawned);

  // Register events - Building
  app.addEvent(BuildingConstructed);
  app.addEvent(BuildingUpgraded);
  app.addEvent(BuildingDestroyed);
  app.addEvent(BuildingDamaged);

  // Register events - Economy
  app.addEvent(CurrencyChanged);
  app.addEvent(TransactionRecorded);

  // Register events - Progress
  app.addEvent(ProgressUnlocked);
  app.addEvent(StatisticUpdated);

  // Register resources
  app.insertResource(new GameTimeManager());
  app.insertResource(new WeatherManager());
  app.insertResource(new PopulationManager());
  app.insertResource(new BuildingManager());
  app.insertResource(new EconomyManager());
  app.insertResource(new ProgressManager());

  await preloadAssets(...AssetDatabase.getAllGuids());

  app.addUpdateSystem(
    system(({ commands }) => {
      const clickEvent = commands.eventReader(ClickEvent);

      const read = clickEvent.read();

      for (const event of read) {
        console.log('Click event');
      }
    }).runIf(isGameplayActive()),
  );

  // Push game-specific layer for custom gameplay systems
  app.pushLayer(new GameLayer());

  console.log('Starting Reimagined...');
  await app.run();
}

main().catch(console.error);
