/**
 * Editor Setup Utility
 *
 * Provides a single function to set up the complete editor environment.
 * This handles all the boilerplate of creating and registering editor resources.
 *
 * @example
 * ```typescript
 * import { setupEditor, createTauriPlatform } from '@voidscript/engine';
 *
 * // Create application
 * const app = new Application({ ... });
 *
 * // Setup editor with Tauri platform
 * const editor = setupEditor(app, {
 *   platform: createTauriPlatform(save, open, readTextFile, writeTextFile),
 *   onPlay: () => console.log('Play started'),
 *   onStop: () => console.log('Play stopped'),
 * });
 *
 * // Start the app
 * await app.run();
 * ```
 */

import type { Application } from '../app/application.js';
import { EditorManager } from './editor-manager.js';
import { EditorCameraManager } from '../app/editor-camera-manager.js';
import { EditorLayer, type EditorConfig } from './editor-layer.js';
import type { EditorPlatform, SaveDialogOptions, OpenDialogOptions } from './editor-platform.js';
import { WebPlatform } from './editor-platform.js';
import { setupPlayModeCleanup } from '../ecs/systems/play-mode-cleanup-system.js';

// ============================================================================
// Setup Options
// ============================================================================

/**
 * Options for setting up the editor
 */
export interface SetupEditorOptions extends EditorConfig {
  /**
   * Whether to automatically push the EditorLayer (default: true)
   * Set to false if you want to manage the layer yourself
   */
  autoAddLayer?: boolean;

  /**
   * Whether to use the default EditorLayer (default: true)
   * Set to false if you want to use a custom layer
   */
  useDefaultLayer?: boolean;

  /**
   * Whether to show debug helpers for all entities with applicable components
   * (Collider2D, Camera, etc.) by default. (default: true)
   */
  showHelpers?: boolean;
}

// ============================================================================
// Editor Context
// ============================================================================

/**
 * Context returned by setupEditor containing all editor resources
 */
export interface EditorContext {
  /** The EditorManager resource (play/pause/stop control) */
  editorManager: EditorManager;

  /** The EditorCameraManager resource (editor camera control) */
  editorCameraManager: EditorCameraManager;

  /** The EditorLayer instance (if autoAddLayer is true) */
  editorLayer?: EditorLayer;

  /** The platform abstraction */
  platform: EditorPlatform;
}

// ============================================================================
// Setup Function
// ============================================================================

/**
 * Set up the complete editor environment
 *
 * This function:
 * 1. Creates and registers EditorManager
 * 2. Creates and registers EditorCameraManager
 * 3. Creates and pushes EditorLayer (optional)
 *
 * @deprecated Use `ApplicationConfig.editor` instead. Configure editor settings
 * directly in the Application constructor for a cleaner setup:
 *
 * ```typescript
 * const app = new Application({
 *   window: { canvas: '#canvas' },
 *   platform: createTauriPlatform(...),
 *   editor: {
 *     showHelpers: true,
 *     onPlay: () => console.log('Play started'),
 *   },
 * });
 * ```
 *
 * @param app - The Application instance
 * @param options - Editor configuration options
 * @returns EditorContext with all created resources
 */
export function setupEditor(
  app: Application,
  options: SetupEditorOptions = {}
): EditorContext {
  console.warn(
    '[setupEditor] Deprecated: Use ApplicationConfig.editor instead. ' +
    'See documentation for the new configuration pattern.'
  );
  const {
    platform = new WebPlatform(),
    autoAddLayer = true,
    useDefaultLayer = true,
    showHelpers = true,
    onPlay,
    onStop,
    onPause,
    ...layerConfig
  } = options;

  // Create EditorManager
  const editorManager = new EditorManager(
    app.world,
    () => app.getCommands()
  );

  // Subscribe to mode changes
  if (onPlay || onStop || onPause) {
    editorManager.addEventListener((event) => {
      if (event.type === 'mode-changed') {
        if (event.to === 'play' && event.from === 'edit') {
          onPlay?.();
        } else if (event.to === 'edit' && (event.from === 'play' || event.from === 'pause')) {
          onStop?.();
        } else if (event.to === 'pause' && event.from === 'play') {
          onPause?.();
        }
      }
    });
  }

  // Setup play mode cleanup (disposes render managers when stopping)
  setupPlayModeCleanup(editorManager, () => app.getCommands());

  // Register EditorManager resource
  app.insertResource(editorManager);

  // Create and register EditorCameraManager
  const renderer = app.getRenderer();
  const editorCameraManager = new EditorCameraManager(renderer);
  app.insertResource(editorCameraManager);

  // Create editor context
  const context: EditorContext = {
    editorManager,
    editorCameraManager,
    platform,
  };

  // Create and push EditorLayer if requested
  if (autoAddLayer && useDefaultLayer) {
    const editorLayer = new EditorLayer({
      platform,
      showHelpers,
      onPlay,
      onStop,
      onPause,
      ...layerConfig,
    });

    app.pushLayer(editorLayer);
    context.editorLayer = editorLayer;
  }

  console.log('[setupEditor] Editor initialized');
  return context;
}

// ============================================================================
// Platform Helpers
// ============================================================================

/**
 * Create a Tauri platform adapter
 *
 * @example
 * ```typescript
 * import { save, open } from '@tauri-apps/plugin-dialog';
 * import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
 *
 * const platform = createTauriPlatform(save, open, readTextFile, writeTextFile);
 * ```
 */
export function createTauriPlatform(
  save: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>,
  open: (options?: { filters?: { name: string; extensions: string[] }[]; multiple?: boolean }) => Promise<string | string[] | null>,
  readTextFile: (path: string) => Promise<string>,
  writeTextFile: (path: string, contents: string) => Promise<void>
): EditorPlatform {
  return {
    name: 'tauri',

    async showSaveDialog(options?: SaveDialogOptions): Promise<string | null> {
      return save({
        filters: options?.filters,
      });
    },

    async showOpenDialog(options?: OpenDialogOptions): Promise<string | string[] | null> {
      return open({
        filters: options?.filters,
        multiple: options?.multiple,
      });
    },

    async readTextFile(path: string): Promise<string> {
      return readTextFile(path);
    },

    async writeTextFile(path: string, contents: string): Promise<void> {
      return writeTextFile(path, contents);
    },
  };
}

/**
 * Create a web platform adapter (uses browser File API)
 */
export function createWebPlatform(): EditorPlatform {
  return new WebPlatform();
}
