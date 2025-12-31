/**
 * VoidScript Editor - Main Entry Point
 *
 * Initializes the EditorApplication and registers panels.
 */

import { invoke } from '@tauri-apps/api/core';
import { exit } from '@tauri-apps/plugin-process';
import { EditorApplication } from '@voidscript/editor';
import { MouseDemoPanel } from './panels/mouse-demo-panel.js';

async function main() {
  const app = new EditorApplication({
    canvas: 'render-canvas',
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

  // Register demo panel
  app.registerPanel(new MouseDemoPanel());

  // Start the editor
  await app.run();
}

main().catch((error) => {
  console.error('Failed to start VoidScript Editor:', error);
});
