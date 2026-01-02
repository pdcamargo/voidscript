/**
 * VoidScript Editor - Main Entry Point
 *
 * Initializes the EditorApplication and registers panels.
 */

import { invoke } from '@tauri-apps/api/core';
import { exit } from '@tauri-apps/plugin-process';
import { EditorApplication } from '@voidscript/editor';
import { MouseDemoPanel } from './panels/mouse-demo-panel.js';
import { RendererDemoPanel } from './panels/renderer-demo-panel.js';
import { SceneViewPanel } from './panels/scene-view-panel.js';
import { GameViewPanel } from './panels/game-view-panel.js';

// Font asset paths (relative to public directory)
const MAIN_FONT_URL = '/assets/Roboto-Medium.ttf';
const ICON_FONT_URL = '/assets/Font Awesome 7 Free-Solid-900.otf';

async function main() {
  const app = new EditorApplication({
    canvas: 'render-canvas',
    editorFPS: 45,
    fonts: {
      mainFontUrl: MAIN_FONT_URL,
      iconFontUrl: ICON_FONT_URL,
    },
    engine: {
      // Minimal engine config - renderer will use defaults
      renderer: {
        clearColor: 0x1a1a2e,
      },
    },
  });

  const menuManager = app.getMenuManager();

  // Register Window menu actions
  menuManager.registerMenuAction({
    path: 'Window/Reload',
    shortcut: 'CmdOrCtrl+R',
    action: async () => {
      try {
        await invoke('reload_webview');
      } catch {
        // Fallback for non-Tauri environment
        window.location.reload();
      }
    },
  });

  menuManager.registerMenuAction({
    path: 'Window/Toggle DevTools',
    shortcut: 'CmdOrCtrl+Shift+I',
    action: async () => {
      try {
        await invoke('toggle_devtools');
      } catch (error) {
        console.debug('Toggle DevTools not available:', error);
      }
    },
  });

  // Register app menu actions (appears under VoidScript menu on macOS)
  menuManager.registerAppMenuAction({
    label: 'Quit',
    shortcut: 'CmdOrCtrl+Q',
    action: async () => {
      try {
        await exit(0);
      } catch {
        // Fallback for non-Tauri environment
        window.close();
      }
    },
  });

  // Register view panels
  app.registerPanel(new SceneViewPanel());
  app.registerPanel(new GameViewPanel());

  // Register demo panels
  app.registerPanel(new MouseDemoPanel());
  app.registerPanel(new RendererDemoPanel());

  // Start the editor
  await app.run();
}

main().catch((error) => {
  console.error('Failed to start VoidScript Editor:', error);
});
