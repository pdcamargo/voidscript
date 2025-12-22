import {
  Application,
  AssetType,
  preloadAssets,
  TextureFilter,
  TextureWrap,
  createTauriPlatform,
  AssetDatabase,
  system,
  isGameplayActive,
} from '@voidscript/engine';
import { save, open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

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
import './components/sprite-area-generator.js';
import './components/cloud-2d.js';
import './components/sun-light.js';
import './components/villager.js';
import './components/homeless.js';
import './components/building.js';

const repeatSprite = (
  id: string,
  name: string,
  tileWidth: number,
  tileHeight: number,
  count: number,
) => {
  return Array.from({ length: count }, (_, index) => ({
    id: `${id}-${index + 1}`,
    name: `${name} ${index + 1}`,
    tileIndex: index,
    tileWidth,
    tileHeight,
  }));
};

/**
 * repeatSpriteEveryN generates a sequence of sprite slices from a sprite sheet.
 * This is intended for cases where each frame is separated by a constant number of columns.
 *
 * For example, columns=5 means frames are at indices 0, 5, 10, etc.
 * The sprite sheet should be a single row, with (count-1) * columns between each frame.
 *
 * @param id        Base ID for sprite
 * @param name      Base name for sprite
 * @param tileWidth Width of each frame in pixels
 * @param tileHeight Height of each frame in pixels
 * @param count     Number of frames
 * @param columns   Spacing (interval) between frames
 * @returns         Array of sprite definitions
 */
const repeatSpriteEveryN = (
  id: string,
  name: string,
  tileWidth: number,
  tileHeight: number,
  count: number,
  columns: number,
) => {
  // Generate all sprites for all columns (e.g., sprite sheet with 'columns' columns, taking 'count' frames from each)
  const sprites = [];
  for (let col = 0; col < columns; col++) {
    for (let i = 0; i < count; i++) {
      sprites.push({
        id: `${id}-col${col + 1}-frame${i + 1}`,
        name: `${name} Col${col + 1} Frame${i + 1}`,
        tileIndex: col + i * columns,
        tileWidth,
        tileHeight,
      });
    }
  }
  return sprites;
};

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
    assets: {
      woods: {
        type: AssetType.Audio,
        path: '/assets/audio/woods.ogg',
      },
      'mountain-grass-1': {
        type: AssetType.Texture,
        path: '/assets/sprites/Mountain Grass 1.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        width: 2029,
        height: 700,
        sprites: repeatSprite('mountain-grass', 'Mountain Grass', 2029, 700, 1),
      },
      moon: {
        type: AssetType.Texture,
        path: '/assets/sprites/Moon.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        width: 512,
        height: 512,
        sprites: [
          {
            id: 'moon-1',
            name: 'Moon',
            tileIndex: 0,
            tileWidth: 512,
            tileHeight: 512,
          },
        ],
      },
      sun: {
        type: AssetType.Texture,
        path: '/assets/sprites/Sun.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        width: 512,
        height: 512,
        sprites: [
          {
            id: 'sun-1',
            name: 'Sun',
            tileIndex: 0,
            tileWidth: 512,
            tileHeight: 512,
          },
        ],
      },
      clouds: {
        type: AssetType.Texture,
        path: '/assets/sprites/Clouds.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        sprites: repeatSprite('cloud', 'Cloud', 160, 47, 5),
        width: 4 * 160,
        height: 2 * 47,
      },
      forestBackground: {
        type: AssetType.Texture,
        path: '/assets/sprites/Forest Background.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        sprites: repeatSprite(
          'forest-background',
          'Forest Background',
          1600,
          276,
          1,
        ),
        width: 1600,
        height: 276,
      },
      trees: {
        type: AssetType.Texture,
        path: '/assets/sprites/Trees.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        sprites: [
          {
            id: 'trees-1',
            name: 'Tree 1',
            x: 0,
            y: 0,
            width: 295,
            height: 319,
          },
          {
            id: 'trees-2',
            name: 'Tree 2',
            x: 295,
            y: 0,
            width: 295,
            height: 319,
          },
          {
            id: 'trees-3',
            name: 'Tree 3',
            x: 590,
            y: 0,
            width: 285,
            height: 319,
          },
          {
            id: 'trees-4',
            name: 'Tree 4',
            x: 875,
            y: 0,
            width: 202,
            height: 319,
          },
          {
            id: 'trees-5',
            name: 'Tree 5',
            x: 1077,
            y: 0,
            width: 202,
            height: 319,
          },
          {
            id: 'trees-6',
            name: 'Tree 6',
            x: 1279,
            y: 0,
            width: 202,
            height: 319,
          },
        ],
        width: 1678,
        height: 319,
      },
      ground: {
        type: AssetType.Texture,
        path: '/assets/sprites/Ground.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        width: 1652,
        height: 116,
        sprites: [
          {
            id: 'ground-1',
            name: 'Ground',
            x: 0,
            y: 0,
            width: 1652,
            height: 116,
          },
        ],
      },
      rocks: {
        type: AssetType.Texture,
        path: '/assets/sprites/Rocks.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        width: 1244,
        height: 210,
        sprites: [
          {
            id: 'rocks-1',
            name: 'Rock 1',
            x: 0,
            y: 0,
            width: 577,
            height: 222,
          },
          {
            id: 'rocks-2',
            name: 'Rock 2',
            x: 570,
            y: 0,
            width: 178,
            height: 96,
          },
        ],
      },
    },

    // Platform for file operations (Tauri native dialogs)
    platform: createTauriPlatform(save, open, readTextFile, writeTextFile),

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
