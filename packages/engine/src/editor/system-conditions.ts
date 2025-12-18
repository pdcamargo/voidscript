/**
 * System Conditions - Helper functions for runIf() system conditions
 *
 * These functions return SystemRunCondition functions that can be used
 * with system().runIf() to conditionally execute systems based on
 * editor state.
 */

import type { SystemRunCondition } from '../ecs/system.js';
import { EditorManager } from './editor-manager.js';

/**
 * System runs only in Play mode
 *
 * Use for gameplay systems that should only execute when the game is running.
 * If no EditorManager exists (pure game, no editor), systems always run.
 *
 * @example
 * ```ts
 * const enemyAISystem = system(({ commands }) => {
 *   // Enemy AI logic
 * }).runIf(isGameplayActive());
 * ```
 */
export function isGameplayActive(): SystemRunCondition {
  return ({ commands }) => {
    const editor = commands.tryGetResource(EditorManager);
    // If no editor, always run (pure game mode)
    if (!editor) {
      return true;
    }
    // Run in play mode, or when step is requested (for frame-by-frame debugging)
    return editor.isPlayMode() || editor.isStepRequested();
  };
}

/**
 * System runs only in Edit or Pause mode (not Play)
 *
 * Use for editor-specific systems that should be disabled during gameplay.
 * If no EditorManager exists, the system won't run (editor systems require editor).
 *
 * @example
 * ```ts
 * const gizmoSystem = system(({ commands }) => {
 *   // Editor gizmo logic
 * }).runIf(isEditorActive());
 * ```
 */
export function isEditorActive(): SystemRunCondition {
  return ({ commands }) => {
    const editor = commands.tryGetResource(EditorManager);
    // Editor systems require editor to exist
    if (!editor) {
      return false;
    }
    return editor.isEditorToolsActive();
  };
}

/**
 * System runs only in Edit mode (not Play or Pause)
 *
 * Use for systems that should only run during normal editing,
 * not during play or pause.
 *
 * @example
 * ```ts
 * const autoSaveSystem = system(({ commands }) => {
 *   // Auto-save logic
 * }).runIf(isEditModeOnly());
 * ```
 */
export function isEditModeOnly(): SystemRunCondition {
  return ({ commands }) => {
    const editor = commands.tryGetResource(EditorManager);
    if (!editor) {
      return false;
    }
    return editor.mode === 'edit';
  };
}

/**
 * System runs only in Pause mode
 *
 * Use for systems that should only run when paused (e.g., debug overlays).
 *
 * @example
 * ```ts
 * const pauseDebugSystem = system(({ commands }) => {
 *   // Show debug info only when paused
 * }).runIf(isPausedMode());
 * ```
 */
export function isPausedMode(): SystemRunCondition {
  return ({ commands }) => {
    const editor = commands.tryGetResource(EditorManager);
    if (!editor) {
      return false;
    }
    return editor.mode === 'pause';
  };
}

/**
 * Combine multiple conditions with AND logic
 *
 * @example
 * ```ts
 * const system = system(fn).runIf(and(isGameplayActive(), customCondition()));
 * ```
 */
export function and(...conditions: SystemRunCondition[]): SystemRunCondition {
  return (args) => {
    for (const condition of conditions) {
      if (!condition(args)) {
        return false;
      }
    }
    return true;
  };
}

/**
 * Combine multiple conditions with OR logic
 *
 * @example
 * ```ts
 * const system = system(fn).runIf(or(isEditModeOnly(), isPausedMode()));
 * ```
 */
export function or(...conditions: SystemRunCondition[]): SystemRunCondition {
  return (args) => {
    for (const condition of conditions) {
      if (condition(args)) {
        return true;
      }
    }
    return false;
  };
}

/**
 * Negate a condition
 *
 * @example
 * ```ts
 * const system = system(fn).runIf(not(isGameplayActive()));
 * ```
 */
export function not(condition: SystemRunCondition): SystemRunCondition {
  return (args) => !condition(args);
}
