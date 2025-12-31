/**
 * VoidScript Editor Package
 *
 * Provides base classes and utilities for building editor panels and windows.
 */

// Main application
export {
  EditorApplication,
  type EditorApplicationConfig,
} from './editor-application.js';

// Panel base class
export { EditorPanel, type EditorPanelConfig } from './editor-panel.js';

// Layout utilities
export { EditorLayout, type TextOptions } from './editor-layout.js';

// Enums and flags
export { EditorPanelFocusFlags } from './focus-flags.js';

// Managers
export { MenuManager, type MenuActionConfig } from './menu-manager.js';
export { PanelStateManager } from './panel-state-manager.js';

// Types
export type { Vec2, Size, Color } from './types.js';

// Re-export ImGui utilities for direct access
export { ImGui, ImGuiImplWeb } from '@voidscript/imgui';
