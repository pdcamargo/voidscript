/**
 * VoidScript Editor Package
 *
 * Provides base classes and utilities for building editor panels and windows.
 */

// Main application
export {
  EditorApplication,
  type EditorApplicationConfig,
  type EditorFontConfig,
} from './editor-application.js';

// Title bar
export { TitleBar } from './title-bar.js';

// Window controls
export { WindowControls } from './window-controls.js';

// Icons
export { EditorIcons } from './editor-icons.js';

// Fonts
export { EditorFonts } from './editor-fonts.js';

// Colors
export { EditorColors } from './editor-colors.js';

// OS detection
export {
  initOSInfo,
  getOSType,
  isMacOS,
  isWindows,
  isLinux,
  type OSType,
} from './os-info.js';

// Project info
export {
  getCurrentSceneFileName,
  getProjectName,
  setCurrentSceneFileName,
  setProjectName,
  getFormattedTitle,
} from './project-info.js';

// Window base classes
export { EditorWindow, type EditorWindowConfig } from './editor-window.js';
export { EditorPanel, type EditorPanelConfig } from './editor-panel.js';
export { EditorDialog, type EditorDialogConfig } from './editor-dialog.js';

// Layout utilities
export {
  EditorLayout,
  type TextOptions,
  type VerticalTab,
  type VerticalTabLayoutOptions,
  type VerticalTabLayoutResult,
} from './editor-layout.js';

// Enums and flags
export { EditorPanelFocusFlags } from './focus-flags.js';

// Managers
export { MenuManager, type MenuActionConfig } from './menu-manager.js';
export { PanelStateManager } from './panel-state-manager.js';

// Theme system
export { ThemeManager } from './theme/theme-manager.js';
export type {
  ThemeColors,
  ThemeColorKey,
  ThemePreset,
  PersistedThemeData,
} from './theme/theme-types.js';
export {
  BUILT_IN_PRESETS,
  getBuiltInPreset,
  getDefaultPreset,
} from './theme/theme-presets.js';

// File system abstraction
export { EditorFileSystem, type FileSystemResult } from './editor-file-system.js';

// Dialogs
export { EditorPreferencesDialog } from './editor-preferences-dialog.js';

// Viewport utilities
export {
  ImageViewport,
  type ImageBounds,
  type NDCPointer,
  type ImageViewportOptions,
  type ImageViewportResult,
} from './image-viewport.js';

// Types
export type { Vec2, Size, Color } from './types.js';

// Editor Camera
export {
  EditorCamera,
  EditorCameraMode,
  type EditorCameraConfig,
} from './editor-camera.js';

// Re-export ImGui utilities for direct access
export { ImGui, ImGuiImplWeb, ImTextureRef, ImVec2Helpers } from '@voidscript/imgui';

// Project utilities
export * from './project/index.js';
