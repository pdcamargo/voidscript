/**
 * Project Info - Scene and project information provider
 *
 * Provides functions to get current scene file name and project name.
 * Currently returns placeholder values - will be wired up to real
 * file system / project management in the future.
 *
 * @example
 * ```typescript
 * const sceneFile = getCurrentSceneFileName();  // "world.vscn"
 * const project = getProjectName();              // "Kingdom"
 * ```
 */

// Placeholder values - will be replaced with actual state management
let currentSceneFileName = 'world.vscn';
let projectName = 'Kingdom';

/**
 * Get the current scene file name.
 *
 * @returns The current scene file name (e.g., "world.vscn")
 */
export function getCurrentSceneFileName(): string {
  return currentSceneFileName;
}

/**
 * Get the current project name.
 *
 * @returns The project name (e.g., "Kingdom")
 */
export function getProjectName(): string {
  return projectName;
}

/**
 * Set the current scene file name.
 * Used when loading a new scene.
 *
 * @param fileName - The new scene file name
 */
export function setCurrentSceneFileName(fileName: string): void {
  currentSceneFileName = fileName;
}

/**
 * Set the current project name.
 * Used when opening a project.
 *
 * @param name - The project name
 */
export function setProjectName(name: string): void {
  projectName = name;
}

/**
 * Get the formatted title string for the title bar.
 * Format: "scene.vscn - ProjectName"
 *
 * @returns Formatted title string
 */
export function getFormattedTitle(): string {
  return `${currentSceneFileName} - ${projectName}`;
}
