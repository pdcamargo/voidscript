/**
 * Project Validator
 *
 * Utilities for validating VoidScript project structure and configuration.
 */

import { z } from 'zod';
import {
  ProjectConfigSchema,
  ProjectFolders,
  type ProjectConfig,
} from './project-config.js';

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Result of project validation
 */
export interface ProjectValidationResult {
  /** Whether the project is valid */
  valid: boolean;
  /** Parsed and validated config (if valid) */
  config?: ProjectConfig;
  /** Validation errors (if invalid) */
  errors: ValidationError[];
  /** Validation warnings (non-blocking issues) */
  warnings: ValidationWarning[];
}

/**
 * A validation error (blocks project loading)
 */
export interface ValidationError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Path to the problematic file/field (if applicable) */
  path?: string;
}

/**
 * A validation warning (non-blocking)
 */
export interface ValidationWarning {
  /** Warning code for programmatic handling */
  code: string;
  /** Human-readable warning message */
  message: string;
  /** Path to the problematic file/field (if applicable) */
  path?: string;
}

// ============================================================================
// Project Detection
// ============================================================================

/**
 * Check if a list of files contains a VoidScript project file
 *
 * @param files - Array of file paths or names
 * @returns true if project.voidscript.yaml is found
 */
export function isVoidScriptProject(files: string[]): boolean {
  return files.some(
    (file) =>
      file === ProjectFolders.ProjectFile ||
      file.endsWith(`/${ProjectFolders.ProjectFile}`) ||
      file.endsWith(`\\${ProjectFolders.ProjectFile}`),
  );
}

/**
 * Find the project file in a list of files
 *
 * @param files - Array of file paths
 * @returns Path to project file, or null if not found
 */
export function findProjectFile(files: string[]): string | null {
  return (
    files.find(
      (file) =>
        file === ProjectFolders.ProjectFile ||
        file.endsWith(`/${ProjectFolders.ProjectFile}`) ||
        file.endsWith(`\\${ProjectFolders.ProjectFile}`),
    ) ?? null
  );
}

// ============================================================================
// Configuration Validation
// ============================================================================

/**
 * Validate project configuration against the schema
 *
 * @param data - Raw configuration data (parsed YAML/JSON)
 * @returns Validation result with parsed config or errors
 */
export function validateProjectConfig(
  data: unknown,
): ProjectValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    const config = ProjectConfigSchema.parse(data);

    // Additional semantic validations
    if (config.defaultScene && !config.defaultScene.endsWith('.vscn')) {
      warnings.push({
        code: 'INVALID_SCENE_EXTENSION',
        message: `Default scene "${config.defaultScene}" should have .vscn extension`,
        path: 'defaultScene',
      });
    }

    return {
      valid: true,
      config,
      errors,
      warnings,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      for (const issue of error.issues) {
        errors.push({
          code: `SCHEMA_${issue.code.toUpperCase()}`,
          message: issue.message,
          path: issue.path.join('.'),
        });
      }
    } else {
      errors.push({
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return {
      valid: false,
      errors,
      warnings,
    };
  }
}

// ============================================================================
// Structure Validation
// ============================================================================

/**
 * Expected files/folders for a VoidScript project
 */
export interface ProjectStructureCheck {
  /** Files that must exist */
  required: string[];
  /** Files that should exist (warnings if missing) */
  recommended: string[];
  /** Files that are optional */
  optional: string[];
}

/**
 * Get the expected project structure
 */
export function getExpectedProjectStructure(): ProjectStructureCheck {
  return {
    required: [ProjectFolders.ProjectFile],
    recommended: [
      ProjectFolders.PackageJson,
      ProjectFolders.TsConfig,
      ProjectFolders.Src,
    ],
    optional: [
      ProjectFolders.AssetManifest,
      ProjectFolders.Settings,
      ProjectFolders.EngineSettings,
      ProjectFolders.EditorSettings,
    ],
  };
}

/**
 * Validate project folder structure
 *
 * @param files - List of files/folders in the project
 * @param projectRoot - Root path of the project (for path resolution)
 * @returns Validation result
 */
export function validateProjectStructure(
  files: string[],
  projectRoot: string,
): ProjectValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const structure = getExpectedProjectStructure();

  // Normalize paths for comparison
  const normalizedFiles = new Set(
    files.map((f) => {
      // Remove project root prefix if present
      if (f.startsWith(projectRoot)) {
        f = f.slice(projectRoot.length);
      }
      // Normalize separators
      return f.replace(/\\/g, '/').replace(/^\//, '');
    }),
  );

  // Check required files
  for (const required of structure.required) {
    if (!normalizedFiles.has(required)) {
      errors.push({
        code: 'MISSING_REQUIRED_FILE',
        message: `Required file "${required}" not found`,
        path: required,
      });
    }
  }

  // Check recommended files
  for (const recommended of structure.recommended) {
    if (!normalizedFiles.has(recommended)) {
      warnings.push({
        code: 'MISSING_RECOMMENDED_FILE',
        message: `Recommended file/folder "${recommended}" not found`,
        path: recommended,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Settings Validation
// ============================================================================

/**
 * Check if engine settings files exist
 *
 * @param files - List of files in the project
 * @returns Object indicating which settings files exist
 */
export function checkSettingsFiles(files: string[]): {
  physics2d: boolean;
  physics3d: boolean;
  audio: boolean;
  editorPreferences: boolean;
} {
  const normalizedFiles = new Set(
    files.map((f) => f.replace(/\\/g, '/').toLowerCase()),
  );

  const checkPath = (path: string) =>
    normalizedFiles.has(path.toLowerCase()) ||
    [...normalizedFiles].some((f) => f.endsWith(path.toLowerCase()));

  return {
    physics2d: checkPath('settings/engine/physics-2d.yaml'),
    physics3d: checkPath('settings/engine/physics-3d.yaml'),
    audio: checkPath('settings/engine/audio.yaml'),
    editorPreferences: checkPath('settings/editor/preferences.yaml'),
  };
}
