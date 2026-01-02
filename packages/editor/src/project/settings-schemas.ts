/**
 * Settings Schemas
 *
 * Zod schemas for VoidScript project settings files.
 * These define the structure of files in settings/engine/ and settings/editor/.
 */

import { z } from 'zod';

// ============================================================================
// Engine Settings: Physics 2D
// ============================================================================

/**
 * Schema for settings/engine/physics-2d.yaml
 */
export const Physics2DSettingsSchema = z.object({
  /** Whether 2D physics is enabled */
  enabled: z.boolean().default(true),

  /** Gravity vector */
  gravity: z
    .object({
      x: z.number().default(0),
      y: z.number().default(-9.8),
    })
    .default({ x: 0, y: -9.8 }),

  /** Fixed timestep for physics simulation (seconds) */
  fixedTimestep: z.number().positive().default(0.016),

  /** Number of velocity iterations per step */
  velocityIterations: z.number().int().positive().default(8),

  /** Number of position iterations per step */
  positionIterations: z.number().int().positive().default(3),
});

export type Physics2DSettings = z.infer<typeof Physics2DSettingsSchema>;

/**
 * Get default Physics2D settings
 */
export function getDefaultPhysics2DSettings(): Physics2DSettings {
  return Physics2DSettingsSchema.parse({});
}

// ============================================================================
// Engine Settings: Physics 3D
// ============================================================================

/**
 * Schema for settings/engine/physics-3d.yaml
 */
export const Physics3DSettingsSchema = z.object({
  /** Whether 3D physics is enabled */
  enabled: z.boolean().default(false),

  /** Gravity vector */
  gravity: z
    .object({
      x: z.number().default(0),
      y: z.number().default(-9.8),
      z: z.number().default(0),
    })
    .default({ x: 0, y: -9.8, z: 0 }),

  /** Fixed timestep for physics simulation (seconds) */
  fixedTimestep: z.number().positive().default(0.016),

  /** Number of velocity iterations per step */
  velocityIterations: z.number().int().positive().default(8),

  /** Number of position iterations per step */
  positionIterations: z.number().int().positive().default(3),
});

export type Physics3DSettings = z.infer<typeof Physics3DSettingsSchema>;

/**
 * Get default Physics3D settings
 */
export function getDefaultPhysics3DSettings(): Physics3DSettings {
  return Physics3DSettingsSchema.parse({});
}

// ============================================================================
// Engine Settings: Audio
// ============================================================================

/**
 * Schema for settings/engine/audio.yaml
 */
export const AudioSettingsSchema = z.object({
  /** Master volume (0.0 to 1.0) */
  masterVolume: z.number().min(0).max(1).default(1),

  /** Music volume (0.0 to 1.0) */
  musicVolume: z.number().min(0).max(1).default(0.8),

  /** Sound effects volume (0.0 to 1.0) */
  sfxVolume: z.number().min(0).max(1).default(1),

  /** Whether to use spatial audio for 3D sounds */
  spatialAudio: z.boolean().default(true),

  /** Maximum simultaneous audio sources */
  maxSources: z.number().int().positive().default(32),
});

export type AudioSettings = z.infer<typeof AudioSettingsSchema>;

/**
 * Get default Audio settings
 */
export function getDefaultAudioSettings(): AudioSettings {
  return AudioSettingsSchema.parse({});
}

// ============================================================================
// Editor Settings: Preferences
// ============================================================================

/**
 * Schema for settings/editor/preferences.yaml
 */
export const EditorPreferencesSchema = z.object({
  /** Editor theme */
  theme: z.enum(['dark', 'light', 'system']).default('dark'),

  /** Grid size in pixels (for snapping) */
  gridSize: z.number().int().positive().default(16),

  /** Whether to snap to grid */
  snapToGrid: z.boolean().default(true),

  /** Whether to show grid lines */
  showGrid: z.boolean().default(true),

  /** Auto-save interval in seconds (0 to disable) */
  autoSaveInterval: z.number().int().min(0).default(300),

  /** Whether to show FPS counter */
  showFps: z.boolean().default(true),

  /** Default zoom level for 2D viewport */
  defaultZoom: z.number().positive().default(1),

  /** Recent file limit */
  recentFilesLimit: z.number().int().positive().default(10),

  /** Font size for code editor */
  codeFontSize: z.number().int().positive().default(14),

  /** Font family for code editor */
  codeFontFamily: z.string().default('JetBrains Mono, monospace'),
});

export type EditorPreferences = z.infer<typeof EditorPreferencesSchema>;

/**
 * Get default Editor preferences
 */
export function getDefaultEditorPreferences(): EditorPreferences {
  return EditorPreferencesSchema.parse({});
}

// ============================================================================
// Combined Settings Types
// ============================================================================

/**
 * All engine settings combined
 */
export interface EngineSettings {
  physics2d: Physics2DSettings;
  physics3d: Physics3DSettings;
  audio: AudioSettings;
}

/**
 * Get all default engine settings
 */
export function getDefaultEngineSettings(): EngineSettings {
  return {
    physics2d: getDefaultPhysics2DSettings(),
    physics3d: getDefaultPhysics3DSettings(),
    audio: getDefaultAudioSettings(),
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate and parse Physics2D settings
 */
export function parsePhysics2DSettings(
  data: unknown,
): { success: true; data: Physics2DSettings } | { success: false; error: string } {
  try {
    return { success: true, data: Physics2DSettingsSchema.parse(data) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid physics 2D settings',
    };
  }
}

/**
 * Validate and parse Physics3D settings
 */
export function parsePhysics3DSettings(
  data: unknown,
): { success: true; data: Physics3DSettings } | { success: false; error: string } {
  try {
    return { success: true, data: Physics3DSettingsSchema.parse(data) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid physics 3D settings',
    };
  }
}

/**
 * Validate and parse Audio settings
 */
export function parseAudioSettings(
  data: unknown,
): { success: true; data: AudioSettings } | { success: false; error: string } {
  try {
    return { success: true, data: AudioSettingsSchema.parse(data) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid audio settings',
    };
  }
}

/**
 * Validate and parse Editor preferences
 */
export function parseEditorPreferences(
  data: unknown,
): { success: true; data: EditorPreferences } | { success: false; error: string } {
  try {
    return { success: true, data: EditorPreferencesSchema.parse(data) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid editor preferences',
    };
  }
}
