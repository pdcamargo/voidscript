/**
 * VoidScript File Extensions
 *
 * Centralized definition of all VoidScript-specific file extensions.
 * Used by asset loaders for validation and type detection.
 */

import { AssetType } from '../ecs/asset-metadata.js';

/**
 * VoidScript file extensions for assets and scenes.
 */
export const FileExtensions = {
  /** Scene files (.vscn) */
  Scene: '.vscn',

  /** VoidShader Language files (.vsl) */
  Shader: '.vsl',

  /** Prefab files (.vprefab) */
  Prefab: '.vprefab',

  /** Animation clip files (.vanim) */
  AnimationClip: '.vanim',

  /** Animation State Machine files (.vanimsm) */
  AnimationStateMachine: '.vanimsm',
} as const;

export type FileExtension = (typeof FileExtensions)[keyof typeof FileExtensions];

/**
 * Mapping from file extension to AssetType.
 */
export const ExtensionToAssetType: Record<string, AssetType> = {
  [FileExtensions.Scene]: AssetType.Scene,
  [FileExtensions.Shader]: AssetType.Shader,
  [FileExtensions.Prefab]: AssetType.Prefab,
  [FileExtensions.AnimationClip]: AssetType.Animation,
  [FileExtensions.AnimationStateMachine]: AssetType.StateMachine,
};

/**
 * Mapping from AssetType to expected file extension.
 */
export const AssetTypeToExtension: Partial<Record<AssetType, string>> = {
  [AssetType.Scene]: FileExtensions.Scene,
  [AssetType.Shader]: FileExtensions.Shader,
  [AssetType.Prefab]: FileExtensions.Prefab,
  [AssetType.Animation]: FileExtensions.AnimationClip,
  [AssetType.StateMachine]: FileExtensions.AnimationStateMachine,
};

/**
 * All VoidScript file extensions (for detection).
 */
export const AllVoidScriptExtensions: readonly string[] =
  Object.values(FileExtensions);

/**
 * Get the file extension from a path (including the dot).
 * Handles compound extensions like .vanim and .vanimsm correctly.
 */
export function getFileExtension(path: string): string {
  const lowerPath = path.toLowerCase();

  // Check for compound VoidScript extensions first
  for (const ext of AllVoidScriptExtensions) {
    if (lowerPath.endsWith(ext)) {
      return ext;
    }
  }

  // Fall back to simple extension extraction
  const lastDot = path.lastIndexOf('.');
  if (lastDot === -1) return '';
  return path.substring(lastDot).toLowerCase();
}

/**
 * Check if a file path has a VoidScript extension.
 */
export function isVoidScriptFile(path: string): boolean {
  const ext = getFileExtension(path);
  return AllVoidScriptExtensions.includes(ext);
}

/**
 * Validation result for file extension checks.
 */
export interface FileExtensionValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that a file has the expected extension.
 */
export function validateFileExtension(
  path: string,
  expectedExtension: FileExtension,
): FileExtensionValidationResult {
  const ext = getFileExtension(path);
  if (ext !== expectedExtension) {
    return {
      valid: false,
      error: `Expected file with extension "${expectedExtension}" but got "${ext || '(none)'}". Path: ${path}`,
    };
  }
  return { valid: true };
}

/**
 * Enforce correct file extension (throws on mismatch).
 * @param path - The file path to validate
 * @param expectedExtension - The expected file extension
 * @param context - Optional context for the error message (e.g., "loading prefab")
 * @throws Error if the file extension doesn't match
 */
export function enforceFileExtension(
  path: string,
  expectedExtension: FileExtension,
  context?: string,
): void {
  const result = validateFileExtension(path, expectedExtension);
  if (!result.valid) {
    const ctx = context ? ` (${context})` : '';
    throw new Error(`${result.error}${ctx}`);
  }
}

/**
 * Get the AssetType for a file based on its extension.
 * Returns undefined for non-VoidScript files or Scene files.
 */
export function getAssetTypeFromPath(path: string): AssetType | undefined {
  const ext = getFileExtension(path);
  return ExtensionToAssetType[ext];
}

/**
 * Check if a file path is a scene file (.vscn).
 */
export function isSceneFile(path: string): boolean {
  return getFileExtension(path) === FileExtensions.Scene;
}

/**
 * Check if a file path is a shader file (.vsl).
 */
export function isShaderFile(path: string): boolean {
  return getFileExtension(path) === FileExtensions.Shader;
}

/**
 * Check if a file path is a prefab file (.vprefab).
 */
export function isPrefabFile(path: string): boolean {
  return getFileExtension(path) === FileExtensions.Prefab;
}

/**
 * Check if a file path is an animation clip file (.vanim).
 */
export function isAnimationClipFile(path: string): boolean {
  return getFileExtension(path) === FileExtensions.AnimationClip;
}

/**
 * Check if a file path is an animation state machine file (.vanimsm).
 */
export function isAnimationStateMachineFile(path: string): boolean {
  return getFileExtension(path) === FileExtensions.AnimationStateMachine;
}
