/**
 * System Conditions - Helper functions for runIf() system conditions
 *
 * These functions return SystemRunCondition functions that can be used
 * with system().runIf() to conditionally execute systems based on
 * editor state.
 */

import type { SystemRunCondition } from '@voidscript/core';
import { EditorManager } from './editor-manager.js';
import type { Entity } from '@voidscript/core';

// ============================================================================
// Animation Preview State
// ============================================================================

/**
 * Entity currently being previewed in the animation editor.
 * When set, the animation system will run for this entity even in edit mode.
 */
let animationPreviewEntity: Entity | null = null;

/**
 * Set the entity to preview animations on.
 * When set, the animation system will update this entity even in edit mode.
 *
 * @param entity - Entity to preview, or null to disable preview
 */
export function setAnimationPreviewEntity(entity: Entity | null): void {
  animationPreviewEntity = entity;
}

/**
 * Get the entity currently being previewed in the animation editor.
 *
 * @returns The preview entity, or null if no preview is active
 */
export function getAnimationPreviewEntity(): Entity | null {
  return animationPreviewEntity;
}

/**
 * Check if animation preview mode is currently active.
 *
 * @returns True if an entity is being previewed
 */
export function isAnimationPreviewMode(): boolean {
  return animationPreviewEntity !== null;
}

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
 * System runs when animation preview is active.
 *
 * Use for systems that should run during animation preview in the editor.
 * Animation preview runs in edit mode for a specific entity.
 *
 * @example
 * ```ts
 * const animationSystem = system(({ commands }) => {
 *   // Animation logic
 * }).runIf(or(isGameplayActive(), isAnimationPreviewActive()));
 * ```
 */
export function isAnimationPreviewActive(): SystemRunCondition {
  return ({ commands }) => {
    // Only active when we have a preview entity set
    if (!animationPreviewEntity) {
      return false;
    }

    // In edit mode (not play mode), allow animation preview
    const editor = commands.tryGetResource(EditorManager);
    if (!editor) {
      return false;
    }

    // Preview should work in edit mode
    return editor.mode === 'edit';
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
