/**
 * MenuManager - Builds native Tauri menus from registered panels
 *
 * Parses panel menu paths (e.g., "Window/Debug/Profiler") into a tree structure
 * and creates corresponding Tauri Menu/Submenu/MenuItem hierarchy.
 * Also manages global keyboard shortcuts for panels.
 */

import type { EditorPanel } from './editor-panel.js';
import type { Menu as TauriMenu } from '@tauri-apps/api/menu/menu';
import type { Submenu as TauriSubmenu } from '@tauri-apps/api/menu/submenu';
import type { MenuItem as TauriMenuItem } from '@tauri-apps/api/menu/menuItem';
import type { PredefinedMenuItem as TauriPredefinedMenuItem } from '@tauri-apps/api/menu/predefinedMenuItem';

/**
 * Configuration for a custom menu action
 */
export interface MenuActionConfig {
  /** Menu path using "/" separator (e.g., "Window/Reload") */
  path: string;
  /** Keyboard shortcut in Tauri accelerator format (e.g., "CmdOrCtrl+R") */
  shortcut?: string;
  /** Callback function when menu item is clicked */
  action: () => void | Promise<void>;
  /** Whether the menu item is enabled (default: true) */
  enabled?: boolean;
}

/** Internal representation of a menu action */
interface MenuAction {
  id: string;
  label: string;
  path: string;
  shortcut?: string;
  action: () => void | Promise<void>;
  enabled: boolean;
}

/** Internal tree node for building menu hierarchy */
interface MenuTreeNode {
  /** Child submenus (non-leaf nodes) */
  children: Map<string, MenuTreeNode>;
  /** Panels at this level (leaf nodes) */
  panels: EditorPanel[];
  /** Custom menu actions at this level */
  actions: MenuAction[];
}

/**
 * Manages native Tauri menu bar integration for editor panels.
 *
 * @example
 * ```typescript
 * const menuManager = new MenuManager();
 *
 * // Register panels with menu paths
 * menuManager.registerPanel(hierarchyPanel);  // menuPath: "Window/Hierarchy"
 * menuManager.registerPanel(profilerPanel);   // menuPath: "Window/Debug/Profiler"
 *
 * // Build and set the native menu
 * await menuManager.buildAndSetMenu();
 *
 * // Register keyboard shortcuts
 * await menuManager.registerShortcuts();
 * ```
 */
export class MenuManager {
  private panels: Map<string, EditorPanel> = new Map();
  private menuActions: Map<string, MenuAction> = new Map();
  private registeredShortcuts: Set<string> = new Set();
  private appMenuActions: MenuAction[] = [];

  /**
   * Register a panel for menu integration.
   * Only panels with a menuPath will be added to the menu.
   *
   * @param panel - The panel to register
   */
  registerPanel(panel: EditorPanel): void {
    this.panels.set(panel.getId(), panel);
  }

  /**
   * Unregister a panel from menu integration.
   *
   * @param panel - The panel to unregister
   */
  unregisterPanel(panel: EditorPanel): void {
    this.panels.delete(panel.getId());
  }

  /**
   * Get all registered panels.
   */
  getPanels(): EditorPanel[] {
    return Array.from(this.panels.values());
  }

  /**
   * Register a custom menu action.
   * Use this to add non-panel menu items like Reload, Toggle DevTools, etc.
   *
   * @param config - Menu action configuration
   * @returns The action ID for later reference
   *
   * @example
   * ```typescript
   * menuManager.registerMenuAction({
   *   path: 'Window/Reload',
   *   shortcut: 'CmdOrCtrl+R',
   *   action: () => window.location.reload(),
   * });
   * ```
   */
  registerMenuAction(config: MenuActionConfig): string {
    const parts = config.path.split('/').filter((p) => p.length > 0);
    if (parts.length === 0) {
      throw new Error('Menu action path cannot be empty');
    }

    const label = parts[parts.length - 1]!;
    const id = `action-${config.path.replace(/\//g, '-').toLowerCase()}`;

    const action: MenuAction = {
      id,
      label,
      path: config.path,
      shortcut: config.shortcut,
      action: config.action,
      enabled: config.enabled ?? true,
    };

    this.menuActions.set(id, action);
    return id;
  }

  /**
   * Unregister a custom menu action.
   *
   * @param id - The action ID returned from registerMenuAction
   */
  unregisterMenuAction(id: string): void {
    this.menuActions.delete(id);
  }

  /**
   * Register a menu action under the app name menu (e.g., VoidScript > Quit).
   * These appear in the first submenu on macOS.
   *
   * @param config - Menu action configuration (path is ignored, only label matters)
   */
  registerAppMenuAction(config: Omit<MenuActionConfig, 'path'> & { label: string }): string {
    const id = `app-action-${config.label.replace(/\s+/g, '-').toLowerCase()}`;

    const action: MenuAction = {
      id,
      label: config.label,
      path: `VoidScript/${config.label}`,
      shortcut: config.shortcut,
      action: config.action,
      enabled: config.enabled ?? true,
    };

    this.appMenuActions.push(action);
    return id;
  }

  /**
   * Build the menu tree from panel menu paths and custom actions.
   * Parses paths like "Window/Debug/Profiler" into a nested structure.
   */
  private buildMenuTree(): MenuTreeNode {
    const root: MenuTreeNode = {
      children: new Map(),
      panels: [],
      actions: [],
    };

    // Add panels to tree
    for (const panel of this.panels.values()) {
      if (!panel.menuPath) continue;

      const parts = panel.menuPath.split('/').filter((p) => p.length > 0);
      if (parts.length === 0) continue;

      // Navigate/create the tree path
      let current = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]!;
        if (!current.children.has(part)) {
          current.children.set(part, {
            children: new Map(),
            panels: [],
            actions: [],
          });
        }
        current = current.children.get(part)!;
      }

      // Add panel at the leaf level
      current.panels.push(panel);
    }

    // Add custom menu actions to tree
    for (const action of this.menuActions.values()) {
      const parts = action.path.split('/').filter((p) => p.length > 0);
      if (parts.length === 0) continue;

      // Navigate/create the tree path
      let current = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]!;
        if (!current.children.has(part)) {
          current.children.set(part, {
            children: new Map(),
            panels: [],
            actions: [],
          });
        }
        current = current.children.get(part)!;
      }

      // Add action at the leaf level
      current.actions.push(action);
    }

    return root;
  }

  /**
   * Build and set the native Tauri menu bar.
   * Creates menu structure from all registered panels with menu paths.
   */
  async buildAndSetMenu(): Promise<void> {
    try {
      const [
        { Menu },
        { Submenu },
        { MenuItem },
        { PredefinedMenuItem },
      ] = await Promise.all([
        import('@tauri-apps/api/menu/menu'),
        import('@tauri-apps/api/menu/submenu'),
        import('@tauri-apps/api/menu/menuItem'),
        import('@tauri-apps/api/menu/predefinedMenuItem'),
      ]);

      const tree = this.buildMenuTree();
      const topLevelItems: Awaited<ReturnType<typeof Submenu.new>>[] = [];

      // On macOS, the first submenu becomes the app menu
      // Build the app submenu with About and custom app actions
      const appSubmenuItems: (
        | Awaited<ReturnType<typeof MenuItem.new>>
        | Awaited<ReturnType<typeof PredefinedMenuItem.new>>
      )[] = [
        await MenuItem.new({
          id: 'about',
          text: 'About VoidScript Editor',
          enabled: true,
        }),
      ];

      // Add custom app menu actions (e.g., Quit)
      if (this.appMenuActions.length > 0) {
        appSubmenuItems.push(await PredefinedMenuItem.new({ item: 'Separator' }));
        for (const action of this.appMenuActions) {
          appSubmenuItems.push(
            await MenuItem.new({
              id: action.id,
              text: action.label,
              accelerator: action.shortcut,
              enabled: action.enabled,
              action: () => {
                void action.action();
              },
            }),
          );
        }
      }

      const appSubmenu = await Submenu.new({
        text: 'VoidScript',
        items: appSubmenuItems,
      });
      topLevelItems.push(appSubmenu);

      // Build submenus recursively
      const buildSubmenu = async (
        name: string,
        node: MenuTreeNode,
      ): Promise<Awaited<ReturnType<typeof Submenu.new>>> => {
        const items: (
          | Awaited<ReturnType<typeof MenuItem.new>>
          | Awaited<ReturnType<typeof Submenu.new>>
          | Awaited<ReturnType<typeof PredefinedMenuItem.new>>
        )[] = [];

        // Add custom actions first
        for (const action of node.actions) {
          items.push(
            await MenuItem.new({
              id: action.id,
              text: action.label,
              accelerator: action.shortcut,
              enabled: action.enabled,
              action: () => {
                void action.action();
              },
            }),
          );
        }

        // Add separator if we have both actions and panels/children
        if (node.actions.length > 0 && (node.panels.length > 0 || node.children.size > 0)) {
          items.push(await PredefinedMenuItem.new({ item: 'Separator' }));
        }

        // Add child submenus
        for (const [childName, childNode] of node.children) {
          items.push(await buildSubmenu(childName, childNode));
        }

        // Add panel menu items
        for (const panel of node.panels) {
          items.push(
            await MenuItem.new({
              id: `panel-${panel.getId()}`,
              text: panel.getTitle(),
              accelerator: panel.shortcut,
              action: () => {
                panel.open();
              },
            }),
          );
        }

        return await Submenu.new({
          text: name,
          items,
        });
      };

      // Build top-level submenus from the root's children
      for (const [name, node] of tree.children) {
        topLevelItems.push(await buildSubmenu(name, node));
      }

      // Create and set the menu
      const menu = await Menu.new({
        items: topLevelItems,
      });

      await menu.setAsAppMenu();
    } catch (error) {
      // Not in Tauri environment
      console.debug('MenuManager: Could not build Tauri menu:', error);
    }
  }

  /**
   * Register global keyboard shortcuts for all panels and custom actions.
   *
   * Note: When running in Tauri with native menus, menu accelerators already
   * handle shortcuts. Global shortcuts are only needed when the app is not focused
   * or when running outside Tauri. For now, we skip global shortcut registration
   * since the menu accelerators work when the app is focused.
   */
  async registerShortcuts(): Promise<void> {
    // Menu accelerators (set in buildAndSetMenu) already handle shortcuts
    // when the app window is focused. Global shortcuts would cause double-firing.
    // Only use global shortcuts if you need them to work when the app is NOT focused.
    //
    // For now, we rely on menu accelerators only.
    console.debug('MenuManager: Shortcuts handled by menu accelerators');
  }

  /**
   * Unregister all global keyboard shortcuts.
   */
  async unregisterShortcuts(): Promise<void> {
    try {
      const { unregister } = await import(
        '@tauri-apps/plugin-global-shortcut'
      );

      for (const shortcut of this.registeredShortcuts) {
        await unregister(shortcut);
      }
      this.registeredShortcuts.clear();
    } catch (error) {
      // Not in Tauri environment
      console.debug('MenuManager: Could not unregister shortcuts:', error);
    }
  }

  /**
   * Rebuild the menu. Call after registering/unregistering panels.
   */
  async rebuildMenu(): Promise<void> {
    await this.buildAndSetMenu();
  }
}
