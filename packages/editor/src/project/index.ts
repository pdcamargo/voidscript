/**
 * Project Module
 *
 * Utilities for VoidScript project management, validation, and detection.
 */

// Project configuration types and constants
export {
  ProjectConfigSchema,
  type ProjectConfig,
  ProjectFolders,
  EngineSettingsFiles,
  EditorSettingsFiles,
  createDefaultProjectConfig,
  getProjectFilePath,
  getEngineSettingsPath,
  getEditorSettingsPath,
} from './project-config.js';

// Project validation
export {
  type ProjectValidationResult,
  type ValidationError,
  type ValidationWarning,
  type ProjectStructureCheck,
  isVoidScriptProject,
  findProjectFile,
  validateProjectConfig,
  getExpectedProjectStructure,
  validateProjectStructure,
  checkSettingsFiles,
} from './project-validator.js';

// Project detection and recent projects
export {
  type DetectedProject,
  type ProjectStorage,
  getRecentProjects,
  addRecentProject,
  removeRecentProject,
  toggleProjectPinned,
  clearRecentProjects,
  createDetectedProject,
  createLocalStorageProjectStorage,
  createInMemoryProjectStorage,
} from './project-detector.js';

// Settings schemas
export {
  // Physics 2D
  Physics2DSettingsSchema,
  type Physics2DSettings,
  getDefaultPhysics2DSettings,
  parsePhysics2DSettings,
  // Physics 3D
  Physics3DSettingsSchema,
  type Physics3DSettings,
  getDefaultPhysics3DSettings,
  parsePhysics3DSettings,
  // Audio
  AudioSettingsSchema,
  type AudioSettings,
  getDefaultAudioSettings,
  parseAudioSettings,
  // Editor Preferences
  EditorPreferencesSchema,
  type EditorPreferences,
  getDefaultEditorPreferences,
  parseEditorPreferences,
  // Combined types
  type EngineSettings,
  getDefaultEngineSettings,
} from './settings-schemas.js';
