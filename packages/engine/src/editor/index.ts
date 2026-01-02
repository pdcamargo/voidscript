/**
 * Editor Module - Tools for building game editors
 *
 * Provides:
 * - EditorManager: State machine for edit/play/pause modes
 * - System conditions: Helper functions for conditional system execution
 * - SceneSnapshot: Scene state capture/restore for play mode
 * - EditorPlatform: Platform abstraction for file dialogs and filesystem
 * - EditorLayer: Built-in layer that provides complete editor UI
 * - setupEditor: Utility function to set up complete editor environment
 */

// Types and helpers
export type { EditorMode } from './editor-mode.js';
export { isPlayMode, isEditingMode, isEditorToolsActive } from './editor-mode.js';

// Editor state management
export { EditorManager } from './editor-manager.js';
export type { EditorManagerEvent, EditorManagerEventListener } from './editor-manager.js';

// System conditions for runIf()
export {
  isGameplayActive,
  isEditorActive,
  isEditModeOnly,
  isPausedMode,
  and,
  or,
  not,
} from './system-conditions.js';

// Scene state snapshots
export { SceneSnapshot } from './scene-snapshot.js';

// Platform abstraction
export { WebPlatform, detectPlatform } from './editor-platform.js';
export type {
  EditorPlatform,
  FileFilter,
  SaveDialogOptions,
  OpenDialogOptions,
} from './editor-platform.js';

// Editor layer
export { EditorLayer } from './editor-layer.js';
export type { EditorConfig } from './editor-layer.js';

// Setup utility
export {
  setupEditor,
  createTauriPlatform,
  createWebPlatform,
} from './setup-editor.js';
export type { SetupEditorOptions, EditorContext, TauriPathUtils, TauriPlatformOptions } from './setup-editor.js';

// Transform controls
export { TransformControlsManager } from './transform-controls-manager.js';
export type { TransformMode, TransformSpace } from './transform-controls-manager.js';
export { SceneViewBounds } from './scene-view-bounds.js';
export { TRANSFORM_MODE_SHORTCUTS } from './transform-mode-constants.js';
