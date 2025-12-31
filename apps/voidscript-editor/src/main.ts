/**
 * VoidScript Editor - Main Entry Point
 *
 * Initializes the EditorApplication and registers panels.
 */

import { EditorApplication } from '@voidscript/editor';
import { MouseDemoPanel } from './panels/mouse-demo-panel.js';

async function main() {
  const app = new EditorApplication({
    canvas: 'render-canvas',
  });

  // Register demo panel
  app.registerPanel(new MouseDemoPanel());

  // Start the editor
  await app.run();
}

main().catch((error) => {
  console.error('Failed to start VoidScript Editor:', error);
});
