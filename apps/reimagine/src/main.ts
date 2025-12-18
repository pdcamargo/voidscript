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
