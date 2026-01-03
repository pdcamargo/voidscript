/**
 * Current Project Store
 *
 * Persistence layer for tracking the currently opened project.
 * Stores the project path in the Tauri app data directory so
 * the editor can automatically reopen the last project on startup.
 */

import { EditorFileSystem } from '../editor-file-system.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Data structure for the current project persistence file
 */
export interface CurrentProjectData {
  /** Absolute path to the project root folder */
  projectPath: string;
  /** ISO 8601 timestamp of when this was last modified */
  lastModified: string;
  /** Relative path to the last opened scene file (null = new/unsaved scene) */
  lastOpenedScene?: string | null;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Filename for the current project persistence file.
 * Stored in the Tauri app data directory.
 */
export const CURRENT_PROJECT_FILE = 'current-project.json';

// ============================================================================
// Functions
// ============================================================================

/**
 * Load the currently persisted project data.
 *
 * @returns The current project data, or null if no project is persisted
 *          or if the file doesn't exist.
 */
export async function loadCurrentProject(): Promise<CurrentProjectData | null> {
  const result = await EditorFileSystem.readJson<CurrentProjectData>(
    CURRENT_PROJECT_FILE,
  );

  if (!result.success || !result.data) {
    return null;
  }

  // Validate the data structure
  if (
    typeof result.data.projectPath !== 'string' ||
    typeof result.data.lastModified !== 'string'
  ) {
    console.warn('Invalid current project data structure, ignoring');
    return null;
  }

  return result.data;
}

/**
 * Save the current project path to persistent storage.
 *
 * @param projectPath - Absolute path to the project root folder
 */
export async function saveCurrentProject(projectPath: string): Promise<void> {
  const data: CurrentProjectData = {
    projectPath,
    lastModified: new Date().toISOString(),
  };

  const result = await EditorFileSystem.writeJson(CURRENT_PROJECT_FILE, data);

  if (!result.success) {
    console.error('Failed to save current project:', result.error);
  }
}

/**
 * Clear the current project from persistent storage.
 * Called when closing a project to return to the hub.
 */
export async function clearCurrentProject(): Promise<void> {
  const result = await EditorFileSystem.delete(CURRENT_PROJECT_FILE);

  if (!result.success) {
    // It's okay if the file doesn't exist
    console.warn('Could not clear current project file:', result.error);
  }
}

/**
 * Check if a project path exists and is valid.
 * This verifies the directory exists and contains a project.voidscript.yaml file.
 *
 * @param projectPath - Path to check
 * @returns true if the path is a valid VoidScript project
 */
export async function isValidProjectPath(projectPath: string): Promise<boolean> {
  try {
    const { exists } = await import('@tauri-apps/plugin-fs');
    const { join } = await import('@tauri-apps/api/path');

    // Check if the directory exists
    if (!(await exists(projectPath))) {
      return false;
    }

    // Check if project.voidscript.yaml exists
    const projectFilePath = await join(projectPath, 'project.voidscript.yaml');
    return await exists(projectFilePath);
  } catch (error) {
    console.error('Error checking project path validity:', error);
    return false;
  }
}

/**
 * Update the last opened scene for the current project.
 * This persists the scene path so it can be restored when reopening the project.
 *
 * @param scenePath - Relative path to the scene file (from project root), or null for unsaved scene
 */
export async function updateLastOpenedScene(
  scenePath: string | null,
): Promise<void> {
  const current = await loadCurrentProject();
  if (!current) {
    console.warn('Cannot update last opened scene: no current project');
    return;
  }

  const data: CurrentProjectData = {
    ...current,
    lastOpenedScene: scenePath,
    lastModified: new Date().toISOString(),
  };

  const result = await EditorFileSystem.writeJson(CURRENT_PROJECT_FILE, data);

  if (!result.success) {
    console.error('Failed to update last opened scene:', result.error);
  }
}

/**
 * Get the last opened scene path for the current project.
 *
 * @returns Relative path to the last opened scene, or null if none
 */
export async function getLastOpenedScene(): Promise<string | null> {
  const current = await loadCurrentProject();
  return current?.lastOpenedScene ?? null;
}
