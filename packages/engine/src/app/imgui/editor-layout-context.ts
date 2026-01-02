/**
 * Editor Layout Context
 *
 * Manages global context for EditorLayout operations that need access to
 * external resources like the renderer, commands, or unique ID generation.
 */

import type { Command } from '@voidscript/core';
import type { Scene } from '@voidscript/core';
import type * as THREE from 'three';

/**
 * Context object for EditorLayout operations
 */
export interface EditorLayoutContext {
  /** ECS commands for entity/component queries */
  commands: Command;
  /** ECS scene for direct entity/component access */
  scene: Scene;
  /** Three.js renderer for texture previews in pickers */
  renderer: THREE.WebGLRenderer | null;
  /** Unique ID prefix for ImGui controls (prevents ID conflicts) */
  idPrefix: string;
}

/**
 * Global context storage (set by inspector before rendering)
 */
let currentContext: EditorLayoutContext | null = null;

/**
 * ID counter for generating unique field IDs within a frame
 * Reset each frame when context is set
 */
let idCounter = 0;

/**
 * Stack of label widths for nested beginLabelsWidth/endLabelsWidth calls
 * Each entry is the calculated width in pixels for that scope
 */
const labelWidthStack: number[] = [];

/**
 * Set the editor layout context before rendering components
 * Called by inspector.ts at the start of component rendering
 */
export function setEditorLayoutContext(ctx: EditorLayoutContext | null): void {
  currentContext = ctx;
  // Reset ID counter and label width stack when context is set (start of new frame/component)
  if (ctx) {
    idCounter = 0;
    labelWidthStack.length = 0;
  }
}

/**
 * Get the current editor layout context
 * Throws if context is not set
 */
export function getEditorLayoutContext(): EditorLayoutContext {
  if (!currentContext) {
    throw new Error(
      'EditorLayout context not set. Ensure setEditorLayoutContext is called before using EditorLayout methods.',
    );
  }
  return currentContext;
}

/**
 * Try to get the current editor layout context
 * Returns null if context is not set (doesn't throw)
 */
export function tryGetEditorLayoutContext(): EditorLayoutContext | null {
  return currentContext;
}

/**
 * Generate a unique ID for an ImGui control
 * Uses the context prefix + label + counter to ensure uniqueness
 */
export function generateUniqueId(label: string, customId?: string): string {
  if (customId) {
    return `##${customId}`;
  }
  const ctx = tryGetEditorLayoutContext();
  const prefix = ctx?.idPrefix ?? 'editor';
  return `##${prefix}_${label}_${idCounter++}`;
}

/**
 * Get the current renderer from context
 * Returns null if not available
 */
export function getContextRenderer(): THREE.WebGLRenderer | null {
  return currentContext?.renderer ?? null;
}

/**
 * Get the current commands from context
 * Throws if context is not set
 */
export function getContextCommands(): Command {
  const ctx = getEditorLayoutContext();
  return ctx.commands;
}

/**
 * Push a label width onto the stack
 * Called by EditorLayout.beginLabelsWidth()
 */
export function pushLabelWidth(width: number): void {
  labelWidthStack.push(width);
}

/**
 * Pop a label width from the stack
 * Called by EditorLayout.endLabelsWidth()
 */
export function popLabelWidth(): void {
  labelWidthStack.pop();
}

/**
 * Get the current label width from the stack
 * Returns null if no width is set (use default behavior)
 */
export function getCurrentLabelWidth(): number | null {
  if (labelWidthStack.length === 0) {
    return null;
  }
  return labelWidthStack[labelWidthStack.length - 1] ?? null;
}

/**
 * Reset the label width stack
 * Called when context is set to ensure clean state
 */
export function resetLabelWidthStack(): void {
  labelWidthStack.length = 0;
}
