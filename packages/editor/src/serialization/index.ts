/**
 * Serialization Module - Public API
 *
 * Provides Unity-inspired SerializedObject/SerializedProperty system for:
 * - Property-level dirty tracking
 * - Three-state change management (isDirty, isApplied, isSavedToDisk)
 * - Global undo/redo with grouping
 * - Type-safe property access for all math types
 * - Path-based property navigation
 *
 * @example
 * ```typescript
 * import {
 *   SerializedScene,
 *   UndoRedoManager,
 *   SerializedPropertyType,
 * } from '@voidscript/editor';
 *
 * // Create a serialized scene
 * const serializedScene = new SerializedScene({
 *   sceneData: mySceneData,
 *   relativePath: 'src/scenes/main.vscn',
 *   onDirtyStateChanged: (isDirty, isSaved) => {
 *     updateWindowTitle(isDirty);
 *   },
 * });
 *
 * // Access and modify properties
 * const position = serializedScene.findProperty('entities[0].components[0].data.position');
 * position.vector3Value = new Vector3(1, 2, 3);
 *
 * // Undo/redo
 * if (UndoRedoManager.instance.canUndo) {
 *   UndoRedoManager.instance.undo();
 * }
 * ```
 */

// ============================================================================
// Type Enum
// ============================================================================

export {
  SerializedPropertyType,
  isPrimitiveType,
  isMathType,
  isReferenceType,
  hasChildren,
} from './serialized-property-type.js';

// ============================================================================
// Property Snapshot
// ============================================================================

export type { PropertySnapshot, PropertyChangeRecord } from './property-snapshot.js';
export { createSnapshot, createChangeRecord } from './property-snapshot.js';

// ============================================================================
// Type Handlers
// ============================================================================

export {
  detectMathType,
  serializeMathType,
  deserializeMathType,
} from './type-handlers/index.js';

// ============================================================================
// SerializedProperty
// ============================================================================

export type { SerializedPropertyOptions } from './serialized-property.js';
export { SerializedProperty } from './serialized-property.js';

// ============================================================================
// SerializedObject
// ============================================================================

export type { SerializedObjectOptions } from './serialized-object.js';
export { SerializedObject } from './serialized-object.js';

// ============================================================================
// Undo/Redo System
// ============================================================================

export type { UndoCommand } from './undo-redo.js';
export { PropertyChangeCommand, UndoRedoManager } from './undo-redo.js';

// ============================================================================
// SerializedScene
// ============================================================================

export type { SerializedSceneOptions, RuntimeBinding } from './serialized-scene.js';
export {
  SerializedScene,
  createSerializedScene,
  createBoundSerializedScene,
} from './serialized-scene.js';
