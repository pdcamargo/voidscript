/**
 * EditorFileSystem - File I/O for editor persistence (Tauri-only)
 *
 * Provides a unified API for reading/writing files using Tauri filesystem APIs.
 * Files are stored in the Tauri app data directory.
 *
 * Note: This is a desktop-only editor, browser support is not needed.
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
 * Static class providing file I/O for the editor using Tauri filesystem.
 *
 * All operations are async and use Tauri's plugin-fs for file operations.
 * Files are stored in the platform-specific app data directory:
 * - macOS: ~/Library/Application Support/VoidScript
 * - Windows: C:\Users\<User>\AppData\Local\VoidScript
 * - Linux: ~/.local/share/voidscript
 *
 * @example
 * ```typescript
 * // Read a JSON file from app data
 * const result = await EditorFileSystem.readJson<MySettings>('my-settings.json');
 * if (result.success) {
 *   console.log('Settings:', result.data);
 * }
 *
 * // Write a JSON file to app data
 * await EditorFileSystem.writeJson('my-settings.json', { theme: 'dark' });
 *
 * // Write text to an arbitrary path (for project files)
 * await EditorFileSystem.writeTextToPath('/path/to/project/file.txt', 'content');
 * ```
 */
export class EditorFileSystem {
  // ============================================================================
  // App Data Directory Operations
  // ============================================================================

  /**
   * Read a JSON file from the app data directory.
   *
   * @param filename - Name of the file (e.g., 'editor-theme.json')
   * @returns Result with parsed data or error
   */
  static async readJson<T>(filename: string): Promise<FileSystemResult<T>> {
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

  /**
   * Write a JSON file to the app data directory.
   *
   * @param filename - Name of the file (e.g., 'editor-theme.json')
   * @param data - Data to serialize and write
   * @returns Result indicating success or error
   */
  static async writeJson<T>(
    filename: string,
    data: T,
  ): Promise<FileSystemResult<void>> {
    try {
      const { appDataDir, join } = await import('@tauri-apps/api/path');
      const { writeTextFile, mkdir, exists } = await import(
        '@tauri-apps/plugin-fs'
      );

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

  /**
   * Check if a file exists in the app data directory.
   *
   * @param filename - Name of the file to check
   * @returns true if the file exists
   */
  static async exists(filename: string): Promise<boolean> {
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

  /**
   * Delete a file from the app data directory.
   *
   * @param filename - Name of the file to delete
   * @returns Result indicating success or error
   */
  static async delete(filename: string): Promise<FileSystemResult<void>> {
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
  // Arbitrary Path Operations (for project files)
  // ============================================================================

  /**
   * Create a directory at an arbitrary path.
   *
   * @param path - Absolute path to the directory to create
   * @param recursive - Whether to create parent directories (default: true)
   * @returns Result indicating success or error
   */
  static async mkdir(
    path: string,
    recursive = true,
  ): Promise<FileSystemResult<void>> {
    try {
      const { mkdir, exists } = await import('@tauri-apps/plugin-fs');

      if (await exists(path)) {
        return { success: true }; // Directory already exists
      }

      await mkdir(path, { recursive });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Write text content to a file at an arbitrary path.
   *
   * @param path - Absolute path to the file
   * @param content - Text content to write
   * @returns Result indicating success or error
   */
  static async writeTextToPath(
    path: string,
    content: string,
  ): Promise<FileSystemResult<void>> {
    try {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');

      await writeTextFile(path, content);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Read text content from a file at an arbitrary path.
   *
   * @param path - Absolute path to the file
   * @returns Result with file content or error
   */
  static async readTextFromPath(
    path: string,
  ): Promise<FileSystemResult<string>> {
    try {
      const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');

      if (!(await exists(path))) {
        return { success: false, error: 'File not found' };
      }

      const content = await readTextFile(path);
      return { success: true, data: content };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Check if a file or directory exists at an arbitrary path.
   *
   * @param path - Absolute path to check
   * @returns true if the path exists
   */
  static async existsAtPath(path: string): Promise<boolean> {
    try {
      const { exists } = await import('@tauri-apps/plugin-fs');
      return await exists(path);
    } catch {
      return false;
    }
  }

  /**
   * Read a JSON file from an arbitrary path.
   *
   * @param path - Absolute path to the JSON file
   * @returns Result with parsed data or error
   */
  static async readJsonFromPath<T>(path: string): Promise<FileSystemResult<T>> {
    const result = await this.readTextFromPath(path);

    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    try {
      const data = JSON.parse(result.data) as T;
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Failed to parse JSON: ${message}` };
    }
  }

  /**
   * Write a JSON file to an arbitrary path.
   *
   * @param path - Absolute path to the file
   * @param data - Data to serialize and write
   * @returns Result indicating success or error
   */
  static async writeJsonToPath<T>(
    path: string,
    data: T,
  ): Promise<FileSystemResult<void>> {
    try {
      const content = JSON.stringify(data, null, 2);
      return await this.writeTextToPath(path, content);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Get the app data directory path.
   *
   * @returns The absolute path to the app data directory
   */
  static async getAppDataDir(): Promise<string> {
    const { appDataDir } = await import('@tauri-apps/api/path');
    return await appDataDir();
  }

  /**
   * Join path segments using the platform-appropriate separator.
   *
   * @param segments - Path segments to join
   * @returns The joined path
   */
  static async joinPath(...segments: string[]): Promise<string> {
    const { join } = await import('@tauri-apps/api/path');
    return await join(...segments);
  }

  /**
   * Remove a directory and all its contents recursively.
   *
   * @param path - Absolute path to the directory to remove
   * @returns Result indicating success or error
   */
  static async removeDir(path: string): Promise<FileSystemResult<void>> {
    try {
      const { remove, exists } = await import('@tauri-apps/plugin-fs');

      if (!(await exists(path))) {
        return { success: true }; // Directory doesn't exist, nothing to remove
      }

      await remove(path, { recursive: true });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
