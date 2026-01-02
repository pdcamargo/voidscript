/**
 * PanelStateManager - Manages persistence of panel open/close state
 *
 * Saves and loads panel visibility state to/from Tauri app data directory.
 * Falls back gracefully when running outside Tauri (e.g., in browser dev mode).
 */

import type { EditorPanel } from './editor-panel.js';

/** Panel state data structure stored to disk */
interface PanelStates {
  [panelId: string]: boolean;
}

/**
 * Manages persistence of panel open/close state using Tauri filesystem APIs.
 *
 * @example
 * ```typescript
 * const stateManager = new PanelStateManager();
 * await stateManager.load();
 *
 * // Apply saved state to panel
 * const isOpen = stateManager.getOpenState('hierarchy', panel.defaultOpen);
 * panel.isOpen = isOpen;
 *
 * // Save current states
 * await stateManager.save(panels);
 * ```
 */
export class PanelStateManager {
  private states: PanelStates = {};
  private loaded = false;
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly SAVE_DEBOUNCE_MS = 500;
  private readonly STATE_FILE = 'panel-states.json';

  /**
   * Load panel states from Tauri app data directory.
   * Safe to call multiple times - subsequent calls are no-ops.
   *
   * @returns Map of panel ID to open state
   */
  async load(): Promise<Map<string, boolean>> {
    if (this.loaded) {
      return new Map(Object.entries(this.states));
    }

    try {
      // Dynamic import to avoid errors when not in Tauri environment
      const { appDataDir, join } = await import('@tauri-apps/api/path');
      const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');

      const appData = await appDataDir();
      const filePath = await join(appData, this.STATE_FILE);

      if (await exists(filePath)) {
        const content = await readTextFile(filePath);
        this.states = JSON.parse(content);
      }
    } catch (error) {
      // Not in Tauri environment or file doesn't exist
      console.debug('PanelStateManager: Could not load panel states:', error);
    }

    this.loaded = true;
    return new Map(Object.entries(this.states));
  }

  /**
   * Save panel states to Tauri app data directory.
   * Uses debouncing to avoid excessive writes.
   *
   * @param panels - Array of panels to save state for
   */
  async save(panels: EditorPanel[]): Promise<void> {
    // Clear existing debounce timer
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    // Debounce save operation
    this.saveDebounceTimer = setTimeout(async () => {
      await this.saveImmediate(panels);
    }, this.SAVE_DEBOUNCE_MS);
  }

  /**
   * Save panel states immediately without debouncing.
   *
   * @param panels - Array of panels to save state for
   */
  async saveImmediate(panels: EditorPanel[]): Promise<void> {
    // Update states from panels
    for (const panel of panels) {
      this.states[panel.getId()] = panel.isOpen;
    }

    try {
      // Dynamic import to avoid errors when not in Tauri environment
      const { appDataDir, join } = await import('@tauri-apps/api/path');
      const { writeTextFile, mkdir, exists } = await import(
        '@tauri-apps/plugin-fs'
      );

      const appData = await appDataDir();

      // Ensure directory exists
      if (!(await exists(appData))) {
        await mkdir(appData, { recursive: true });
      }

      const filePath = await join(appData, this.STATE_FILE);
      await writeTextFile(filePath, JSON.stringify(this.states, null, 2));
    } catch (error) {
      // Not in Tauri environment
      console.debug('PanelStateManager: Could not save panel states:', error);
    }
  }

  /**
   * Get the stored open state for a panel, or its default if not stored.
   *
   * @param panelId - The panel's unique identifier
   * @param defaultOpen - Default value if no stored state exists
   * @returns Whether the panel should be open
   */
  getOpenState(panelId: string, defaultOpen: boolean): boolean {
    if (panelId in this.states) {
      return this.states[panelId] ?? defaultOpen;
    }
    return defaultOpen;
  }

  /**
   * Update the state for a single panel.
   * Does not trigger a save - call save() or saveImmediate() separately.
   *
   * @param panelId - The panel's unique identifier
   * @param isOpen - Whether the panel is open
   */
  setState(panelId: string, isOpen: boolean): void {
    this.states[panelId] = isOpen;
  }

  /**
   * Check if states have been loaded.
   */
  isLoaded(): boolean {
    return this.loaded;
  }
}
