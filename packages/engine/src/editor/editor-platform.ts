/**
 * Editor Platform Abstraction
 *
 * Provides platform-agnostic interfaces for file dialogs and filesystem operations.
 * This allows the editor to work with Tauri, Electron, Web, or any other platform.
 */

// ============================================================================
// Dialog Types
// ============================================================================

/**
 * File filter for dialog operations
 */
export interface FileFilter {
  /** Display name for the filter (e.g., "World Files") */
  name: string;
  /** File extensions without dots (e.g., ["json", "world"]) */
  extensions: string[];
}

/**
 * Options for save dialog
 */
export interface SaveDialogOptions {
  /** Dialog title */
  title?: string;
  /** Default file name */
  defaultPath?: string;
  /** File filters */
  filters?: FileFilter[];
}

/**
 * Options for open dialog
 */
export interface OpenDialogOptions {
  /** Dialog title */
  title?: string;
  /** File filters */
  filters?: FileFilter[];
  /** Allow selecting multiple files */
  multiple?: boolean;
  /** Allow selecting directories */
  directory?: boolean;
}

// ============================================================================
// Platform Interface
// ============================================================================

/**
 * Platform abstraction for editor operations.
 * Implement this interface for your target platform (Tauri, Electron, Web, etc.)
 */
export interface EditorPlatform {
  /**
   * Show a save file dialog
   * @returns The selected file path, or null if cancelled
   */
  showSaveDialog(options?: SaveDialogOptions): Promise<string | null>;

  /**
   * Show an open file dialog
   * @returns The selected file path(s), or null if cancelled
   */
  showOpenDialog(options?: OpenDialogOptions): Promise<string | string[] | null>;

  /**
   * Read a text file
   * @param path The file path to read
   * @returns The file contents as a string
   */
  readTextFile(path: string): Promise<string>;

  /**
   * Write a text file
   * @param path The file path to write
   * @param contents The contents to write
   */
  writeTextFile(path: string, contents: string): Promise<void>;

  /**
   * Check if a file exists
   * @param path The file path to check
   */
  exists?(path: string): Promise<boolean>;

  /**
   * Get the platform name (for debugging)
   */
  readonly name: string;
}

// ============================================================================
// Web Platform (Fallback)
// ============================================================================

/**
 * Web platform implementation using browser APIs.
 * Uses file input for open and download for save.
 */
export class WebPlatform implements EditorPlatform {
  readonly name = 'web';

  async showSaveDialog(options?: SaveDialogOptions): Promise<string | null> {
    // Web doesn't have native save dialogs, we'll use download
    // Return a placeholder path - actual save happens in writeTextFile
    const defaultName = options?.defaultPath ?? 'world.json';
    return defaultName;
  }

  async showOpenDialog(options?: OpenDialogOptions): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = options?.multiple ?? false;

      if (options?.filters && options.filters.length > 0) {
        const extensions = options.filters
          .flatMap((f) => f.extensions)
          .map((ext) => `.${ext}`)
          .join(',');
        input.accept = extensions;
      }

      input.onchange = () => {
        if (input.files && input.files.length > 0) {
          // For web, we store the file in memory and return a virtual path
          const file = input.files[0]!;
          // Store the file for later reading
          (this as WebPlatformWithFiles)._pendingFile = file;
          resolve(file.name);
        } else {
          resolve(null);
        }
      };

      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  async readTextFile(path: string): Promise<string> {
    // Check for pending file from open dialog
    const pendingFile = (this as WebPlatformWithFiles)._pendingFile;
    if (pendingFile) {
      (this as WebPlatformWithFiles)._pendingFile = undefined;
      return pendingFile.text();
    }

    throw new Error(`Cannot read file on web platform: ${path}`);
  }

  async writeTextFile(path: string, contents: string): Promise<void> {
    // On web, trigger a download
    const blob = new Blob([contents], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

interface WebPlatformWithFiles extends WebPlatform {
  _pendingFile?: File;
}

// ============================================================================
// Platform Factory
// ============================================================================

/**
 * Create a platform instance based on environment detection
 */
export function detectPlatform(): EditorPlatform {
  // Default to web platform
  return new WebPlatform();
}
