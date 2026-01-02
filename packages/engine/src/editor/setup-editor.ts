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
    app.scene,
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
 * Path utilities for Tauri platform
 */
export interface TauriPathUtils {
  /** Get the application's resource directory (from @tauri-apps/api/path) */
  resourceDir: () => Promise<string>;
  /** Join path segments (from @tauri-apps/api/path) */
  join: (...paths: string[]) => Promise<string>;
}

/**
 * Options for creating a Tauri platform
 */
export interface TauriPlatformOptions {
  /**
   * Path utilities from @tauri-apps/api/path (resourceDir, join)
   */
  pathUtils?: TauriPathUtils;
  /**
   * The absolute path to the source assets directory (e.g., public/ folder).
   * Used by editor tools to save files directly to source during development.
   * Example: '/Users/dev/myproject/apps/game/public'
   */
  sourceAssetsDir?: string;
  /**
   * Function to create directories recursively.
   * From @tauri-apps/plugin-fs: mkdir(path, { recursive: true })
   */
  mkdir?: (path: string, options?: { recursive?: boolean }) => Promise<void>;
}

/**
 * Create a Tauri platform adapter
 *
 * @example
 * ```typescript
 * import { save, open } from '@tauri-apps/plugin-dialog';
 * import { readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';
 * import { resourceDir, join } from '@tauri-apps/api/path';
 *
 * const platform = createTauriPlatform(
 *   save, open, readTextFile, writeTextFile,
 *   {
 *     pathUtils: { resourceDir, join },
 *     sourceAssetsDir: '/absolute/path/to/public',
 *     mkdir,
 *   }
 * );
 * ```
 */
export function createTauriPlatform(
  save: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>,
  open: (options?: { filters?: { name: string; extensions: string[] }[]; multiple?: boolean }) => Promise<string | string[] | null>,
  readTextFile: (path: string) => Promise<string>,
  writeTextFile: (path: string, contents: string) => Promise<void>,
  options?: TauriPlatformOptions | TauriPathUtils
): EditorPlatform {
  // Support both old signature (TauriPathUtils) and new signature (TauriPlatformOptions)
  const isNewOptions = options && ('pathUtils' in options || 'sourceAssetsDir' in options || 'mkdir' in options);
  const pathUtils = isNewOptions ? (options as TauriPlatformOptions).pathUtils : (options as TauriPathUtils | undefined);
  const sourceAssetsDir = isNewOptions ? (options as TauriPlatformOptions).sourceAssetsDir : undefined;
  const mkdir = isNewOptions ? (options as TauriPlatformOptions).mkdir : undefined;

  return {
    name: 'tauri',
    sourceAssetsDir,

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

    async resourceDir(): Promise<string> {
      if (pathUtils?.resourceDir) {
        return pathUtils.resourceDir();
      }
      return '';
    },

    async joinPath(...paths: string[]): Promise<string> {
      if (pathUtils?.join) {
        return pathUtils.join(...paths);
      }
      // Fallback: simple join with /
      return paths.join('/');
    },

    async ensureDir(path: string): Promise<void> {
      if (mkdir) {
        await mkdir(path, { recursive: true });
      } else {
        throw new Error(`ensureDir not available: mkdir function not provided to createTauriPlatform`);
      }
    },
  };
}

/**
 * Create a web platform adapter (uses browser File API)
 */
export function createWebPlatform(): EditorPlatform {
  return new WebPlatform();
}
