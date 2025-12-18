/**
 * EditorMode - Types and helpers for editor state management
 */

/**
 * Editor modes representing different operational states
 * - edit: Normal editing mode - gameplay systems paused, editor systems active
 * - play: Play mode - gameplay systems running, editor gizmos hidden
 * - pause: Paused during play - gameplay frozen, can step through frames
 */
export type EditorMode = 'edit' | 'play' | 'pause';

/**
 * Check if a mode allows gameplay systems to run
 */
export function isPlayMode(mode: EditorMode): boolean {
  return mode === 'play';
}

/**
 * Check if a mode is an editing state (edit or pause)
 */
export function isEditingMode(mode: EditorMode): boolean {
  return mode === 'edit' || mode === 'pause';
}

/**
 * Check if a mode allows editor gizmos/tools
 */
export function isEditorToolsActive(mode: EditorMode): boolean {
  return mode === 'edit' || mode === 'pause';
}
