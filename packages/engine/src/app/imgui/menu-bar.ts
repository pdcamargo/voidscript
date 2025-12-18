/**
 * ImGui Menu Bar - Generic main menu bar component
 *
 * Provides a reusable menu bar with callbacks for file operations.
 * Platform-specific implementations (Tauri, Electron, etc.) provide the callbacks.
 */

import { ImGui } from '@mori2003/jsimgui';

/**
 * Custom menu item definition
 */
export interface CustomMenuItem {
  /** Label to display */
  label: string;
  /** Optional keyboard shortcut hint (e.g., "Ctrl+T") */
  shortcut?: string;
  /** Called when the menu item is clicked */
  onClick: () => void;
  /** Whether the item is enabled (default: true) */
  enabled?: boolean;
  /** Whether to show a separator before this item */
  separatorBefore?: boolean;
}

/**
 * Custom menu definition
 */
export interface CustomMenu {
  /** Menu label (e.g., "Tools") */
  label: string;
  /** Menu items */
  items: CustomMenuItem[];
}

/**
 * Callbacks for main menu bar actions.
 * Each callback is invoked synchronously when the menu item is clicked.
 */
export interface MenuBarCallbacks {
  /** Called when Save World menu item is clicked (saves to current path if available) */
  onSaveWorld?: () => void;
  /** Called when Save World As menu item is clicked (always shows dialog) */
  onSaveWorldAs?: () => void;
  /** Called when Load World menu item is clicked */
  onLoadWorld?: () => void;
  /** Whether there's a current scene path (enables Save vs only Save As) */
  hasCurrentPath?: boolean;
  /** Whether the game is currently playing (disables save operations) */
  isPlaying?: boolean;
  /** Called when Reload menu item is clicked */
  onReload?: () => void;
  /** Custom items to append to the File menu */
  fileMenuItems?: CustomMenuItem[];
  /** Custom items to append to the Window menu */
  windowMenuItems?: CustomMenuItem[];
  /** Additional custom menus to add after Window menu */
  customMenus?: CustomMenu[];
}

/**
 * Helper function to render custom menu items
 */
function renderCustomMenuItems(items: CustomMenuItem[]): void {
  for (const item of items) {
    if (item.separatorBefore) {
      ImGui.Separator();
    }

    const enabled = item.enabled !== false;
    if (!enabled) {
      ImGui.BeginDisabled();
    }

    if (ImGui.MenuItem(item.label, item.shortcut || '')) {
      item.onClick();
    }

    if (!enabled) {
      ImGui.EndDisabled();
    }
  }
}

/**
 * Render the main menu bar at the top of the window.
 * @param callbacks - Callbacks for menu actions
 */
export function renderMainMenuBar(callbacks: MenuBarCallbacks): void {
  if (ImGui.BeginMainMenuBar()) {
    if (ImGui.BeginMenu('File')) {
      // Save - only enabled if we have a current path AND not playing
      const canSave = callbacks.hasCurrentPath && !callbacks.isPlaying;
      if (canSave) {
        if (ImGui.MenuItem('Save', 'Ctrl+S')) {
          callbacks.onSaveWorld?.();
        }
      } else {
        // Show disabled Save when no path or playing
        ImGui.BeginDisabled();
        ImGui.MenuItem('Save', 'Ctrl+S');
        ImGui.EndDisabled();
      }

      // Save As - only enabled if not playing
      if (!callbacks.isPlaying) {
        if (ImGui.MenuItem('Save As...', 'Ctrl+Shift+S')) {
          callbacks.onSaveWorldAs?.();
        }
      } else {
        // Show disabled Save As when playing
        ImGui.BeginDisabled();
        ImGui.MenuItem('Save As...', 'Ctrl+Shift+S');
        ImGui.EndDisabled();
      }

      ImGui.Separator();

      if (ImGui.MenuItem('Load...', 'Ctrl+O')) {
        callbacks.onLoadWorld?.();
      }

      // Render custom file menu items
      if (callbacks.fileMenuItems && callbacks.fileMenuItems.length > 0) {
        renderCustomMenuItems(callbacks.fileMenuItems);
      }

      ImGui.EndMenu();
    }

    if (ImGui.BeginMenu('Window')) {
      if (ImGui.MenuItem('Reload', 'Ctrl+R')) {
        callbacks.onReload?.();
      }

      if (ImGui.MenuItem('Open Dev Tools', 'F12')) {
        console.log('Opening DevTools - if not open, press F12');
        // eslint-disable-next-line no-debugger
        debugger;
      }

      // Render custom window menu items
      if (callbacks.windowMenuItems && callbacks.windowMenuItems.length > 0) {
        renderCustomMenuItems(callbacks.windowMenuItems);
      }

      ImGui.EndMenu();
    }

    // Render custom menus
    if (callbacks.customMenus) {
      for (const menu of callbacks.customMenus) {
        if (ImGui.BeginMenu(menu.label)) {
          renderCustomMenuItems(menu.items);
          ImGui.EndMenu();
        }
      }
    }

    ImGui.EndMainMenuBar();
  }
}
