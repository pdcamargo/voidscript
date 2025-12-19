import {
  Application,
  AssetType,
  preloadAssets,
  TextureFilter,
  TextureWrap,
  createTauriPlatform,
  AssetDatabase,
} from '@voidscript/engine';
import { save, open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

import { PrototypeLayer } from './prototype-layer.js';
import { openCloudGeneratorWindow } from './ui/cloud-generator-panel.js';

// Import components to register them with the ECS
import './components/sprite-area-generator.js';
import './components/cloud-2d.js';

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
      characterIdle: {
        type: AssetType.Texture,
        path: '/assets/sprites/characters and mounts_Idle.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        width: 425,
        height: 84,
        sprites: repeatSpriteEveryN(
          'character-idle',
          'Character Idle',
          85,
          84,
          1,
          5,
        ),
      },
      characterWalk: {
        type: AssetType.Texture,
        path: '/assets/sprites/characters and mounts_Walk.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        width: 3400,
        height: 84,
        sprites: repeatSpriteEveryN(
          'character-walk',
          'Character Walk',
          85,
          84,
          8,
          5,
        ),
      },
      characterRun: {
        type: AssetType.Texture,
        path: '/assets/sprites/characters and mounts_Run.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        width: 5100,
        height: 84,
        sprites: repeatSpriteEveryN(
          'character-run',
          'Character Run',
          85,
          84,
          12,
          5,
        ),
      },
      fireCalmAnim: {
        type: AssetType.Animation,
        path: '/animations/fire-calm.anim.json',
      },
      fireMildAnim: {
        type: AssetType.Animation,
        path: '/animations/fire-mild.anim.json',
      },
      fireWildAnim: {
        type: AssetType.Animation,
        path: '/animations/fire-wild.anim.json',
      },
      fireInsaneAnim: {
        type: AssetType.Animation,
        path: '/animations/fire-insane.anim.json',
      },
      woods: {
        type: AssetType.Audio,
        path: '/assets/audio/woods.ogg',
      },
      fireCalm: {
        type: AssetType.Texture,
        path: '/assets/sprites/Fire Orange Calm.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        sprites: repeatSprite(
          'fire-orange-calm',
          'Fire Orange Calm',
          39,
          38,
          12,
        ),
      },
      fireMild: {
        type: AssetType.Texture,
        path: '/assets/sprites/Fire Orange Mild.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        sprites: repeatSprite(
          'fire-orange-mild',
          'Fire Orange Mild',
          39,
          38,
          12,
        ),
      },
      fireWild: {
        type: AssetType.Texture,
        path: '/assets/sprites/Fire Orange Wild.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        sprites: repeatSprite(
          'fire-orange-wild',
          'Fire Orange Wild',
          39,
          38,
          12,
        ),
      },
      fireInsane: {
        type: AssetType.Texture,
        path: '/assets/sprites/Fire Orange Insane.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        sprites: repeatSprite(
          'fire-orange-insane',
          'Fire Orange Insane',
          39,
          38,
          12,
        ),
      },
      tileset: {
        type: AssetType.Texture,
        path: '/assets/sprites/Tileset.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        width: 480,
        height: 384,
      },
      bigTree: {
        type: AssetType.Texture,
        path: '/assets/sprites/Big Tree.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        width: 144,
        height: 122,
        sprites: [
          {
            id: 'big-tree',
            name: 'Big Tree',
            tileIndex: 0,
            tileWidth: 144,
            tileHeight: 122,
          },
        ],
      },
      map: {
        type: AssetType.Texture,
        path: '/map.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
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
      'left-portal-1': {
        type: AssetType.Texture,
        path: '/assets/sprites/Left Portal 1.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        width: 3840,
        height: 1980,
        sprites: repeatSprite('left-portal', 'Left Portal', 3840, 1980, 1),
      },
      'left-portal-above-1': {
        type: AssetType.Texture,
        path: '/assets/sprites/Left Portal Above Water.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        width: 2494,
        height: 2371,
        sprites: repeatSprite(
          'left-portal-above',
          'Left Portal Above Water',
          2494,
          2371,
          1,
        ),
      },
      volcano1: {
        type: AssetType.Texture,
        path: '/assets/sprites/Volcano Background.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        width: 2048,
        height: 1560,
        sprites: repeatSprite(
          'volcano-background',
          'Volcano Background',
          2048,
          1560,
          1,
        ),
      },
      mountainsBg: {
        type: AssetType.Texture,
        path: '/assets/sprites/Mountains Background.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        width: 4096,
        height: 1000,
        sprites: repeatSprite(
          'mountains-background',
          'Mountains Background',
          4096,
          1000,
          1,
        ),
      },
      tiled: {
        type: AssetType.TiledMap,
        path: '/assets/tiled/Map.tmx.tmj',
      },
      moon: {
        type: AssetType.Texture,
        path: '/assets/sprites/Moon.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
        sprites: [
          {
            id: 'moon-1',
            name: 'Moon',
            tileIndex: 0,
            tileWidth: 48,
            tileHeight: 48,
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
      },
      treeParallaxBg: {
        type: AssetType.Texture,
        path: '/assets/sprites/tree-parallax-bg.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
      },
      treeParallaxFar: {
        type: AssetType.Texture,
        path: '/assets/sprites/tree-parallax-far.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
      },
      treeParallaxMid: {
        type: AssetType.Texture,
        path: '/assets/sprites/tree-parallax-mid.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
      },
      treeParallaxClose: {
        type: AssetType.Texture,
        path: '/assets/sprites/tree-parallax-close.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
      },
      treeParallaxClosest: {
        type: AssetType.Texture,
        path: '/assets/sprites/tree-parallax-closest.png',
        magFilter: TextureFilter.Nearest,
        minFilter: TextureFilter.Nearest,
        wrapS: TextureWrap.ClampToEdge,
        wrapT: TextureWrap.ClampToEdge,
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
        ],
      },
    },
  });

  await preloadAssets(...AssetDatabase.getAllGuids());

  // Push game-specific layer for custom gameplay systems
  app.pushLayer(new PrototypeLayer());

  console.log('Starting Reimagined...');
  await app.run();
}

main().catch(console.error);
