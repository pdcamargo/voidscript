/**
 * SerializedScene - Scene-specific wrapper for SerializedObject
 *
 * Provides convenience methods for working with scenes, including:
 * - Live updates to runtime scene
 * - Integration with EditorSceneManager
 * - Dirty indicator support (title bar asterisk)
 */

import type { Scene, Command, SceneData } from '@voidscript/core';
import { SceneSerializer } from '@voidscript/core';
import { AssetDatabase } from '@voidscript/engine';

import { SerializedObject } from './serialized-object.js';
import { SerializedProperty } from './serialized-property.js';
import { UndoRedoManager } from './undo-redo.js';

// ============================================================================
// Types
// ============================================================================

export interface SerializedSceneOptions {
  /** Initial scene data */
  sceneData: SceneData;
  /** Relative path from project root (null for unsaved) */
  relativePath: string | null;
  /** Callback when dirty state changes (for UI updates) */
  onDirtyStateChanged?: (isDirty: boolean, isSavedToDisk: boolean) => void;
}

export interface RuntimeBinding {
  /** Runtime scene instance */
  scene: Scene;
  /** Factory function to create commands */
  createCommands: () => Command;
}

// ============================================================================
// SerializedScene Class
// ============================================================================

/**
 * SerializedScene - Wrapper for scene editing with live preview and undo/redo
 *
 * @example
 * ```typescript
 * const serializedScene = new SerializedScene({
 *   sceneData: await loadScene(path),
 *   relativePath: 'src/scenes/main.vscn',
 *   onDirtyStateChanged: (dirty, saved) => updateTitleBar(dirty),
 * });
 *
 * // Bind to runtime for live preview
 * serializedScene.bindToRuntime({
 *   scene: engineApp.getScene(),
 *   createCommands: () => engineApp.createCommands(),
 * });
 *
 * // Edit properties
 * const pos = serializedScene.findProperty('entities[0].components[0].data.position');
 * pos.vector3Value = new Vector3(1, 2, 3); // Automatically updates runtime scene
 *
 * // Save
 * const yamlContent = serializedScene.serializeToYaml();
 * await writeFile(path, yamlContent);
 * serializedScene.markAsSaved();
 * ```
 */
export class SerializedScene {
  private readonly serializedObject: SerializedObject;
  private readonly serializer: SceneSerializer;
  private runtimeBinding: RuntimeBinding | null = null;
  private onDirtyStateChanged: ((isDirty: boolean, isSavedToDisk: boolean) => void) | null;
  private lastDirtyState = false;
  private lastSavedState = true;

  constructor(options: SerializedSceneOptions) {
    this.serializer = new SceneSerializer();
    this.onDirtyStateChanged = options.onDirtyStateChanged ?? null;

    // Create SerializedObject with undo/redo integration
    this.serializedObject = new SerializedObject({
      relativePath: options.relativePath,
      data: options.sceneData,
      onPropertyChanged: (record) => {
        // Record change for undo/redo
        UndoRedoManager.instance.recordChange(record);

        // Apply to runtime scene immediately (live preview)
        this.applyToRuntime();

        // Notify dirty state change
        this.checkDirtyStateChanged();
      },
    });
  }

  // ============================================================================
  // Runtime Binding
  // ============================================================================

  /**
   * Bind to a runtime scene for live preview
   *
   * When bound, property changes are immediately applied to the runtime scene.
   *
   * @param binding Runtime scene and command factory
   */
  bindToRuntime(binding: RuntimeBinding): void {
    this.runtimeBinding = binding;
  }

  /**
   * Unbind from the runtime scene
   */
  unbindFromRuntime(): void {
    this.runtimeBinding = null;
  }

  /**
   * Check if bound to a runtime scene
   */
  get isBound(): boolean {
    return this.runtimeBinding !== null;
  }

  // ============================================================================
  // State Accessors
  // ============================================================================

  /** Relative path from project root (null for unsaved) */
  get relativePath(): string | null {
    return this.serializedObject.relativePath;
  }

  /** Whether any property has been modified */
  get isDirty(): boolean {
    return this.serializedObject.isDirty;
  }

  /** Whether current state matches disk state */
  get isSavedToDisk(): boolean {
    return this.serializedObject.isSavedToDisk;
  }

  /** Whether applied state differs from disk state */
  get hasUnappliedChanges(): boolean {
    return this.serializedObject.hasUnappliedChanges;
  }

  /** Get all dirty property paths */
  get dirtyPaths(): ReadonlySet<string> {
    return this.serializedObject.dirtyPaths;
  }

  // ============================================================================
  // Property Access
  // ============================================================================

  /**
   * Find a property by path
   *
   * @param path Property path (e.g., "entities[0].components[0].data.position")
   */
  findProperty(path: string): SerializedProperty {
    return this.serializedObject.findProperty(path);
  }

  /**
   * Get the underlying SerializedObject
   */
  getSerializedObject(): SerializedObject {
    return this.serializedObject;
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  /**
   * Get the current scene data
   */
  getSceneData(): SceneData {
    return this.serializedObject.getSerializedData() as SceneData;
  }

  /**
   * Serialize to JSON string
   *
   * @param pretty Whether to format with indentation
   */
  serializeToJson(pretty = true): string {
    const data = this.getSceneData();
    return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  }

  /**
   * Serialize to YAML string
   */
  serializeToYaml(): string {
    const data = this.getSceneData();
    // Use the scene serializer's YAML conversion
    // Note: This requires the serializer to have a direct YAML method
    // For now, we'll use the SceneSerializer from runtime binding
    if (this.runtimeBinding) {
      const commands = this.runtimeBinding.createCommands();
      return this.serializer.serializeToYaml(this.runtimeBinding.scene, commands);
    }
    // Fallback to JSON if not bound
    return this.serializeToJson(true);
  }

  // ============================================================================
  // Apply/Revert
  // ============================================================================

  /**
   * Apply all modified properties
   *
   * In live preview mode, this is called automatically on each change.
   * This method can be called explicitly to batch changes.
   */
  applyModifiedProperties(): boolean {
    const applied = this.serializedObject.applyModifiedProperties();
    if (applied) {
      this.applyToRuntime();
      this.checkDirtyStateChanged();
    }
    return applied;
  }

  /**
   * Revert all properties to the last applied state
   */
  revertAllProperties(): void {
    this.serializedObject.revertAllProperties();
    this.applyToRuntime();
    this.checkDirtyStateChanged();
  }

  /**
   * Revert a specific property
   *
   * @param path Property path to revert
   */
  revertProperty(path: string): void {
    this.serializedObject.revertProperty(path);
    this.applyToRuntime();
    this.checkDirtyStateChanged();
  }

  /**
   * Mark the current state as saved to disk
   *
   * Call this after successfully writing to the file system.
   */
  markAsSaved(): void {
    this.serializedObject.markAsSaved();
    this.checkDirtyStateChanged();
  }

  /**
   * Update from fresh disk data
   *
   * @param sceneData Fresh scene data from disk
   */
  updateFromDisk(sceneData: SceneData): void {
    this.serializedObject.updateFromDisk(sceneData);
    this.applyToRuntime();
    this.checkDirtyStateChanged();
  }

  // ============================================================================
  // Undo Groups
  // ============================================================================

  /**
   * Begin an undo group
   *
   * All changes until endUndoGroup() will be grouped into a single undo operation.
   *
   * @param name Human-readable name (e.g., "Move Entity")
   */
  beginUndoGroup(name: string): void {
    const groupId = `scene-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.serializedObject.beginUndoGroup(groupId);
    UndoRedoManager.instance.beginGroup(name);
  }

  /**
   * End the current undo group
   */
  endUndoGroup(): void {
    this.serializedObject.endUndoGroup();
    UndoRedoManager.instance.endGroup();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Apply current data to the runtime scene
   */
  private applyToRuntime(): void {
    if (!this.runtimeBinding) return;

    const { scene, createCommands } = this.runtimeBinding;
    const commands = createCommands();
    const sceneData = this.getSceneData();

    // Clear and reload the scene
    // This is a simple approach - a more sophisticated implementation
    // would only update changed entities/components
    this.serializer.deserialize(scene, commands, sceneData, {
      mode: 'replace',
      skipMissingComponents: true,
      continueOnError: true,
      assetMetadataResolver: (guid: string) => AssetDatabase.getMetadata(guid),
    });
  }

  /**
   * Check if dirty state changed and notify listeners
   */
  private checkDirtyStateChanged(): void {
    const currentDirty = this.isDirty;
    const currentSaved = this.isSavedToDisk;

    if (currentDirty !== this.lastDirtyState || currentSaved !== this.lastSavedState) {
      this.lastDirtyState = currentDirty;
      this.lastSavedState = currentSaved;
      this.onDirtyStateChanged?.(currentDirty, currentSaved);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a SerializedScene from scene data
 */
export function createSerializedScene(
  sceneData: SceneData,
  relativePath: string | null,
  onDirtyStateChanged?: (isDirty: boolean, isSavedToDisk: boolean) => void,
): SerializedScene {
  return new SerializedScene({
    sceneData,
    relativePath,
    onDirtyStateChanged,
  });
}

/**
 * Create a SerializedScene bound to a runtime scene
 */
export function createBoundSerializedScene(
  sceneData: SceneData,
  relativePath: string | null,
  binding: RuntimeBinding,
  onDirtyStateChanged?: (isDirty: boolean, isSavedToDisk: boolean) => void,
): SerializedScene {
  const serializedScene = createSerializedScene(sceneData, relativePath, onDirtyStateChanged);
  serializedScene.bindToRuntime(binding);
  return serializedScene;
}
