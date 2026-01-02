/**
 * Project Detector
 *
 * Utilities for detecting VoidScript projects and managing recent projects.
 */

import { ProjectFolders, type ProjectConfig } from './project-config.js';

// ============================================================================
// Project Detection Types
// ============================================================================

/**
 * Information about a detected VoidScript project
 */
export interface DetectedProject {
  /** Absolute path to the project root folder */
  path: string;
  /** Project name from config */
  name: string;
  /** Project version from config */
  version: string;
  /** Engine version required */
  engineVersion: string;
  /** Last opened timestamp (ISO 8601) */
  lastOpened: string;
  /** Whether the project is pinned (shown at top of recent list) */
  pinned?: boolean;
}

/**
 * Storage interface for recent projects
 * Abstraction to support different storage backends (localStorage, Tauri store, etc.)
 */
export interface ProjectStorage {
  /** Get a value by key */
  get(key: string): Promise<string | null>;
  /** Set a value by key */
  set(key: string, value: string): Promise<void>;
  /** Remove a value by key */
  remove(key: string): Promise<void>;
}

// ============================================================================
// Storage Keys
// ============================================================================

const RECENT_PROJECTS_KEY = 'voidscript.recentProjects';
const MAX_RECENT_PROJECTS = 10;

// ============================================================================
// Recent Projects Management
// ============================================================================

/**
 * Get the list of recent projects
 *
 * @param storage - Storage backend
 * @returns Array of detected projects (sorted by lastOpened, pinned first)
 */
export async function getRecentProjects(
  storage: ProjectStorage,
): Promise<DetectedProject[]> {
  try {
    const data = await storage.get(RECENT_PROJECTS_KEY);
    if (!data) return [];

    const projects: DetectedProject[] = JSON.parse(data);

    // Sort: pinned first, then by lastOpened (newest first)
    return projects.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime();
    });
  } catch {
    return [];
  }
}

/**
 * Add or update a project in the recent list
 *
 * @param storage - Storage backend
 * @param project - Project to add/update (lastOpened will be set to now)
 */
export async function addRecentProject(
  storage: ProjectStorage,
  project: Omit<DetectedProject, 'lastOpened'> & { lastOpened?: string },
): Promise<void> {
  const projects = await getRecentProjects(storage);

  // Remove existing entry for this path (if any)
  const filtered = projects.filter((p) => p.path !== project.path);

  // Add new entry at the beginning
  const newProject: DetectedProject = {
    ...project,
    lastOpened: project.lastOpened ?? new Date().toISOString(),
  };

  filtered.unshift(newProject);

  // Limit to max recent projects (but keep all pinned)
  const pinned = filtered.filter((p) => p.pinned);
  const unpinned = filtered.filter((p) => !p.pinned);
  const limited = [...pinned, ...unpinned.slice(0, MAX_RECENT_PROJECTS - pinned.length)];

  await storage.set(RECENT_PROJECTS_KEY, JSON.stringify(limited));
}

/**
 * Remove a project from the recent list
 *
 * @param storage - Storage backend
 * @param path - Path of the project to remove
 */
export async function removeRecentProject(
  storage: ProjectStorage,
  path: string,
): Promise<void> {
  const projects = await getRecentProjects(storage);
  const filtered = projects.filter((p) => p.path !== path);
  await storage.set(RECENT_PROJECTS_KEY, JSON.stringify(filtered));
}

/**
 * Toggle the pinned state of a project
 *
 * @param storage - Storage backend
 * @param path - Path of the project to toggle
 * @returns The new pinned state
 */
export async function toggleProjectPinned(
  storage: ProjectStorage,
  path: string,
): Promise<boolean> {
  const projects = await getRecentProjects(storage);
  const project = projects.find((p) => p.path === path);

  if (!project) return false;

  project.pinned = !project.pinned;
  await storage.set(RECENT_PROJECTS_KEY, JSON.stringify(projects));
  return project.pinned;
}

/**
 * Clear all recent projects
 *
 * @param storage - Storage backend
 * @param keepPinned - Whether to keep pinned projects (default: false)
 */
export async function clearRecentProjects(
  storage: ProjectStorage,
  keepPinned = false,
): Promise<void> {
  if (keepPinned) {
    const projects = await getRecentProjects(storage);
    const pinned = projects.filter((p) => p.pinned);
    await storage.set(RECENT_PROJECTS_KEY, JSON.stringify(pinned));
  } else {
    await storage.remove(RECENT_PROJECTS_KEY);
  }
}

// ============================================================================
// Project Detection from Config
// ============================================================================

/**
 * Create a DetectedProject from a path and config
 *
 * @param path - Project root path
 * @param config - Parsed project config
 * @returns DetectedProject object
 */
export function createDetectedProject(
  path: string,
  config: ProjectConfig,
): DetectedProject {
  return {
    path,
    name: config.name,
    version: config.version,
    engineVersion: config.engineVersion,
    lastOpened: new Date().toISOString(),
  };
}

// ============================================================================
// LocalStorage-based Storage Implementation
// ============================================================================

/**
 * Create a ProjectStorage backed by localStorage
 * Useful for web-based editor
 */
export function createLocalStorageProjectStorage(): ProjectStorage {
  return {
    async get(key: string): Promise<string | null> {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(key);
    },
    async set(key: string, value: string): Promise<void> {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, value);
    },
    async remove(key: string): Promise<void> {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(key);
    },
  };
}

// ============================================================================
// In-Memory Storage Implementation (for testing)
// ============================================================================

/**
 * Create an in-memory ProjectStorage
 * Useful for testing
 */
export function createInMemoryProjectStorage(): ProjectStorage {
  const store = new Map<string, string>();
  return {
    async get(key: string): Promise<string | null> {
      return store.get(key) ?? null;
    },
    async set(key: string, value: string): Promise<void> {
      store.set(key, value);
    },
    async remove(key: string): Promise<void> {
      store.delete(key);
    },
  };
}
