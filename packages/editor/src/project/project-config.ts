/**
 * Project Configuration Types
 *
 * Defines the VoidScript project structure, configuration schema,
 * and folder constants.
 */

import { z } from 'zod';

// ============================================================================
// Project Configuration Schema (project.voidscript.yaml)
// ============================================================================

/**
 * Zod schema for project.voidscript.yaml validation
 */
export const ProjectConfigSchema = z.object({
  /** Project name */
  name: z.string().min(1, 'Project name is required'),

  /** Semantic version (e.g., "0.1.0") */
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must be in semver format (X.Y.Z)')
    .default('0.1.0'),

  /** Required engine version */
  engineVersion: z.string(),

  /** Path to the default scene to load (e.g., "src/scenes/main.vscn") */
  defaultScene: z.string().optional(),

  /** Project metadata */
  metadata: z
    .object({
      author: z.string().optional(),
      description: z.string().optional(),
      license: z.string().optional(),
      repository: z.string().url().optional(),
    })
    .optional(),

  /** Build configuration */
  build: z
    .object({
      outputDir: z.string().default('dist'),
      targets: z
        .array(z.enum(['web', 'desktop', 'mobile']))
        .default(['web']),
    })
    .optional(),
});

/**
 * Inferred type from ProjectConfigSchema
 */
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

// ============================================================================
// Project Folder Structure Constants
// ============================================================================

/**
 * Standard file names and folder paths for VoidScript projects
 */
export const ProjectFolders = {
  // Root files
  ProjectFile: 'project.voidscript.yaml',
  AssetManifest: 'asset-manifest.yaml',
  PackageJson: 'package.json',
  TsConfig: 'tsconfig.json',

  // Main folders
  Src: 'src',
  Settings: 'settings',
  Dist: 'dist',

  // Source subfolders
  Scenes: 'src/scenes',

  // Settings subfolders
  EngineSettings: 'settings/engine',
  EditorSettings: 'settings/editor',
} as const;

/**
 * Engine settings file names (inside settings/engine/)
 */
export const EngineSettingsFiles = {
  Physics2D: 'physics-2d.yaml',
  Physics3D: 'physics-3d.yaml',
  Audio: 'audio.yaml',
} as const;

/**
 * Editor settings file names (inside settings/editor/)
 */
export const EditorSettingsFiles = {
  Preferences: 'preferences.yaml',
} as const;

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a default project configuration
 *
 * @param name - Project name
 * @param engineVersion - Engine version to target
 * @returns Default project configuration
 */
export function createDefaultProjectConfig(
  name: string,
  engineVersion: string,
): ProjectConfig {
  return {
    name,
    version: '0.1.0',
    engineVersion,
    defaultScene: undefined,
    metadata: {
      author: undefined,
      description: undefined,
      license: undefined,
      repository: undefined,
    },
    build: {
      outputDir: 'dist',
      targets: ['web'],
    },
  };
}

/**
 * Get the full path for a project folder/file
 *
 * @param projectRoot - Root path of the project
 * @param folder - Folder key from ProjectFolders
 * @returns Full path
 */
export function getProjectFilePath(
  projectRoot: string,
  folder: keyof typeof ProjectFolders,
): string {
  const separator = projectRoot.includes('\\') ? '\\' : '/';
  return `${projectRoot}${separator}${ProjectFolders[folder]}`;
}

/**
 * Get the full path for an engine settings file
 *
 * @param projectRoot - Root path of the project
 * @param file - Settings file key from EngineSettingsFiles
 * @returns Full path
 */
export function getEngineSettingsPath(
  projectRoot: string,
  file: keyof typeof EngineSettingsFiles,
): string {
  const separator = projectRoot.includes('\\') ? '\\' : '/';
  return `${projectRoot}${separator}${ProjectFolders.EngineSettings}${separator}${EngineSettingsFiles[file]}`;
}

/**
 * Get the full path for an editor settings file
 *
 * @param projectRoot - Root path of the project
 * @param file - Settings file key from EditorSettingsFiles
 * @returns Full path
 */
export function getEditorSettingsPath(
  projectRoot: string,
  file: keyof typeof EditorSettingsFiles,
): string {
  const separator = projectRoot.includes('\\') ? '\\' : '/';
  return `${projectRoot}${separator}${ProjectFolders.EditorSettings}${separator}${EditorSettingsFiles[file]}`;
}
