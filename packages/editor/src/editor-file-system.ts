/**
 * EditorFileSystem - Abstracted file I/O for editor persistence
 *
 * Provides a unified API for reading/writing files that works in both:
 * - Tauri (desktop): Uses @tauri-apps/api/path and @tauri-apps/plugin-fs
 * - Browser (dev): Uses localStorage fallback
 */

/**
 * Result of a file system operation
 */
export interface FileSystemResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Static class providing abstracted file I/O for the editor.
 *
 * All operations are async and handle both Tauri and browser environments.
 * Files are stored in the Tauri app data directory when running as a desktop app,
 * or in localStorage when running in the browser.
 *
 * @example
 * ```typescript
 * // Read a JSON file
 * const result = await EditorFileSystem.readJson<MySettings>('my-settings.json');
 * if (result.success) {
 *   console.log('Settings:', result.data);
 * }
 *
 * // Write a JSON file
 * await EditorFileSystem.writeJson('my-settings.json', { theme: 'dark' });
 * ```
 */
export class EditorFileSystem {
  private static isTauri: boolean | null = null;
  private static readonly STORAGE_PREFIX = 'voidscript-editor:';

  /**
   * Check if running in Tauri environment.
   * Result is cached after first check.
   */
  static async checkTauriEnvironment(): Promise<boolean> {
    if (this.isTauri !== null) {
      return this.isTauri;
    }

    try {
      // Try to import Tauri API - if it fails, we're in browser
      await import('@tauri-apps/api/path');
      this.isTauri = true;
    } catch {
      this.isTauri = false;
    }

    return this.isTauri;
  }

  /**
   * Read a JSON file from the app data directory.
   *
   * @param filename - Name of the file (e.g., 'editor-theme.json')
   * @returns Result with parsed data or error
   */
  static async readJson<T>(filename: string): Promise<FileSystemResult<T>> {
    const isTauri = await this.checkTauriEnvironment();

    if (isTauri) {
      return this.readJsonTauri<T>(filename);
    } else {
      return this.readJsonBrowser<T>(filename);
    }
  }

  /**
   * Write a JSON file to the app data directory.
   *
   * @param filename - Name of the file (e.g., 'editor-theme.json')
   * @param data - Data to serialize and write
   * @returns Result indicating success or error
   */
  static async writeJson<T>(filename: string, data: T): Promise<FileSystemResult<void>> {
    const isTauri = await this.checkTauriEnvironment();

    if (isTauri) {
      return this.writeJsonTauri(filename, data);
    } else {
      return this.writeJsonBrowser(filename, data);
    }
  }

  /**
   * Check if a file exists in the app data directory.
   *
   * @param filename - Name of the file to check
   * @returns true if the file exists
   */
  static async exists(filename: string): Promise<boolean> {
    const isTauri = await this.checkTauriEnvironment();

    if (isTauri) {
      return this.existsTauri(filename);
    } else {
      return this.existsBrowser(filename);
    }
  }

  /**
   * Delete a file from the app data directory.
   *
   * @param filename - Name of the file to delete
   * @returns Result indicating success or error
   */
  static async delete(filename: string): Promise<FileSystemResult<void>> {
    const isTauri = await this.checkTauriEnvironment();

    if (isTauri) {
      return this.deleteTauri(filename);
    } else {
      return this.deleteBrowser(filename);
    }
  }

  // ============================================================================
  // Tauri implementations
  // ============================================================================

  private static async readJsonTauri<T>(filename: string): Promise<FileSystemResult<T>> {
    try {
      const { appDataDir, join } = await import('@tauri-apps/api/path');
      const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');

      const appData = await appDataDir();
      const filePath = await join(appData, filename);

      if (!(await exists(filePath))) {
        return { success: false, error: 'File not found' };
      }

      const content = await readTextFile(filePath);
      const data = JSON.parse(content) as T;
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  private static async writeJsonTauri<T>(filename: string, data: T): Promise<FileSystemResult<void>> {
    try {
      const { appDataDir, join } = await import('@tauri-apps/api/path');
      const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');

      const appData = await appDataDir();

      // Ensure directory exists
      if (!(await exists(appData))) {
        await mkdir(appData, { recursive: true });
      }

      const filePath = await join(appData, filename);
      await writeTextFile(filePath, JSON.stringify(data, null, 2));

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  private static async existsTauri(filename: string): Promise<boolean> {
    try {
      const { appDataDir, join } = await import('@tauri-apps/api/path');
      const { exists } = await import('@tauri-apps/plugin-fs');

      const appData = await appDataDir();
      const filePath = await join(appData, filename);

      return await exists(filePath);
    } catch {
      return false;
    }
  }

  private static async deleteTauri(filename: string): Promise<FileSystemResult<void>> {
    try {
      const { appDataDir, join } = await import('@tauri-apps/api/path');
      const { remove, exists } = await import('@tauri-apps/plugin-fs');

      const appData = await appDataDir();
      const filePath = await join(appData, filename);

      if (await exists(filePath)) {
        await remove(filePath);
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  // ============================================================================
  // Browser implementations (localStorage fallback)
  // ============================================================================

  private static async readJsonBrowser<T>(filename: string): Promise<FileSystemResult<T>> {
    try {
      const key = this.STORAGE_PREFIX + filename;
      const content = localStorage.getItem(key);

      if (content === null) {
        return { success: false, error: 'File not found' };
      }

      const data = JSON.parse(content) as T;
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  private static async writeJsonBrowser<T>(filename: string, data: T): Promise<FileSystemResult<void>> {
    try {
      const key = this.STORAGE_PREFIX + filename;
      localStorage.setItem(key, JSON.stringify(data, null, 2));
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  private static async existsBrowser(filename: string): Promise<boolean> {
    const key = this.STORAGE_PREFIX + filename;
    return localStorage.getItem(key) !== null;
  }

  private static async deleteBrowser(filename: string): Promise<FileSystemResult<void>> {
    try {
      const key = this.STORAGE_PREFIX + filename;
      localStorage.removeItem(key);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
