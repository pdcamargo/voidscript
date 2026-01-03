/**
 * EditorSceneManager - Centralized scene state management for the editor
 *
 * This manager is the single source of truth for scene state in the editor.
 * It controls:
 * - Current scene path (null = unsaved new scene)
 * - Dirty state tracking
 * - Scene loading and saving
 * - Integration with play mode snapshots
 *
 * The editor (not the engine) controls scene serialization and file I/O.
 */

import type { Scene, Command, SceneData } from '@voidscript/core';
import { SceneSerializer, isYamlFile } from '@voidscript/core';
import type { EngineApplication } from '@voidscript/engine';
import { SceneSnapshot, AssetDatabase } from '@voidscript/engine';
import { EditorFileSystem } from '../editor-file-system.js';
import { updateLastOpenedScene } from '../project/current-project-store.js';
import { SerializedScene, UndoRedoManager } from '../serialization/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Current state of the scene in the editor
 */
export interface EditorSceneState {
  /** Absolute path to the currently open scene file (null = unsaved new scene) */
  currentScenePath: string | null;
  /** Whether the scene has unsaved changes */
  isDirty: boolean;
  /** The scene's display name (filename or "Untitled") */
  displayName: string;
}

/**
 * Result of a scene operation
 */
export interface SceneOperationResult {
  success: boolean;
  error?: string;
}

/**
 * Configuration for EditorSceneManager
 */
export interface EditorSceneManagerConfig {
  /** Absolute path to the project root folder */
  projectPath: string;
  /** Callback when scene state changes */
  onStateChange?: (state: EditorSceneState) => void;
}

// ============================================================================
// EditorSceneManager
// ============================================================================

/**
 * EditorSceneManager - Centralized scene state management
 *
 * @example
 * ```typescript
 * const sceneManager = new EditorSceneManager(engine, {
 *   projectPath: '/path/to/project',
 *   onStateChange: (state) => console.log('Scene state:', state),
 * });
 *
 * // Open a scene
 * await sceneManager.openScene('/path/to/project/src/scenes/main.vscn');
 *
 * // Check if dirty
 * if (sceneManager.isDirty()) {
 *   await sceneManager.saveScene();
 * }
 * ```
 */
export class EditorSceneManager {
  private engine: EngineApplication;
  private config: EditorSceneManagerConfig;
  private serializer: SceneSerializer;

  private state: EditorSceneState = {
    currentScenePath: null,
    isDirty: false,
    displayName: 'Untitled',
  };

  /** SerializedScene for property-level editing and undo/redo */
  private serializedScene: SerializedScene | null = null;

  constructor(engine: EngineApplication, config: EditorSceneManagerConfig) {
    this.engine = engine;
    this.config = config;
    this.serializer = new SceneSerializer();
  }

  // ============================================================================
  // State Accessors
  // ============================================================================

  /**
   * Get the current scene path (null if unsaved)
   */
  getCurrentScenePath(): string | null {
    return this.state.currentScenePath;
  }

  /**
   * Check if the scene has unsaved changes
   *
   * Uses SerializedScene if available for accurate property-level dirty tracking.
   */
  isDirty(): boolean {
    // Use SerializedScene for accurate dirty tracking when available
    if (this.serializedScene) {
      return !this.serializedScene.isSavedToDisk;
    }
    return this.state.isDirty;
  }

  /**
   * Get the SerializedScene for property-level editing and undo/redo
   *
   * Returns null if no scene is open or the scene hasn't been wrapped yet.
   */
  getSerializedScene(): SerializedScene | null {
    return this.serializedScene;
  }

  /**
   * Get the display name for the current scene
   */
  getDisplayName(): string {
    return this.state.displayName;
  }

  /**
   * Get the full current state
   */
  getState(): Readonly<EditorSceneState> {
    return { ...this.state };
  }

  /**
   * Mark the scene as having unsaved changes
   */
  markDirty(): void {
    if (!this.state.isDirty) {
      this.state.isDirty = true;
      this.notifyStateChange();
    }
  }

  /**
   * Mark the scene as clean (no unsaved changes)
   */
  markClean(): void {
    if (this.state.isDirty) {
      this.state.isDirty = false;
      this.notifyStateChange();
    }
  }

  // ============================================================================
  // Scene Operations
  // ============================================================================

  /**
   * Create a new empty scene
   *
   * Clears the current scene and resets state to a new untitled scene.
   */
  async newScene(): Promise<void> {
    const scene = this.engine.getScene();

    // Clear all entities
    scene.clear();

    // Clear undo/redo history for the new scene
    UndoRedoManager.instance.clear();

    // Create SerializedScene from the empty runtime state
    // Serialize after clearing to get proper version and componentRegistry
    const emptySceneData = this.serialize();
    this.serializedScene = new SerializedScene({
      sceneData: emptySceneData,
      relativePath: null,
      onDirtyStateChanged: (isDirty, isSavedToDisk) => {
        this.state.isDirty = !isSavedToDisk;
        this.notifyStateChange();
      },
    });

    // Bind to runtime for live preview
    this.serializedScene.bindToRuntime({
      scene,
      createCommands: () => this.engine.createCommands(),
    });

    // Reset state
    this.state = {
      currentScenePath: null,
      isDirty: false,
      displayName: 'Untitled',
    };

    // Clear the persisted last opened scene
    await updateLastOpenedScene(null);

    this.notifyStateChange();
  }

  /**
   * Open a scene from a file path
   *
   * @param absolutePath - Absolute path to the scene file
   * @returns Result indicating success or failure
   */
  async openScene(absolutePath: string): Promise<SceneOperationResult> {
    // Check if file exists
    if (!(await EditorFileSystem.existsAtPath(absolutePath))) {
      return { success: false, error: `Scene file not found: ${absolutePath}` };
    }

    // Read the file
    const readResult = await EditorFileSystem.readTextFromPath(absolutePath);
    if (!readResult.success || !readResult.data) {
      return {
        success: false,
        error: readResult.error ?? 'Failed to read scene file',
      };
    }

    // Get scene and commands
    const scene = this.engine.getScene();
    const commands = this.engine.createCommands();

    // Deserialize based on file type
    const deserializeOptions = {
      mode: 'replace' as const,
      skipMissingComponents: true,
      continueOnError: true,
      assetMetadataResolver: (guid: string) => AssetDatabase.getMetadata(guid),
    };

    let result;
    if (isYamlFile(absolutePath)) {
      result = this.serializer.deserializeFromYaml(
        scene,
        commands,
        readResult.data,
        deserializeOptions,
      );
    } else {
      result = this.serializer.deserializeFromString(
        scene,
        commands,
        readResult.data,
        deserializeOptions,
      );
    }

    if (!result.success) {
      return { success: false, error: result.error ?? 'Failed to deserialize scene' };
    }

    // Clear undo/redo history for the new scene
    UndoRedoManager.instance.clear();

    // Serialize the current runtime state to get SceneData for SerializedScene
    // This ensures we have the canonical representation after deserialization
    const sceneData = this.serialize();

    // Compute relative path for SerializedScene
    const relativePath = await this.toRelativePath(absolutePath);

    // Create SerializedScene for property-level editing
    this.serializedScene = new SerializedScene({
      sceneData,
      relativePath,
      onDirtyStateChanged: (isDirty, isSavedToDisk) => {
        this.state.isDirty = !isSavedToDisk;
        this.notifyStateChange();
      },
    });

    // Bind to runtime for live preview
    this.serializedScene.bindToRuntime({
      scene,
      createCommands: () => this.engine.createCommands(),
    });

    // Update state
    this.state = {
      currentScenePath: absolutePath,
      isDirty: false,
      displayName: this.extractFilename(absolutePath),
    };

    // Persist the last opened scene
    await updateLastOpenedScene(relativePath);

    this.notifyStateChange();

    return { success: true };
  }

  /**
   * Save the current scene to its existing path
   *
   * @returns Result indicating success or failure
   */
  async saveScene(): Promise<SceneOperationResult> {
    if (!this.state.currentScenePath) {
      return { success: false, error: 'No scene path set. Use saveSceneAs() instead.' };
    }

    return this.saveSceneTo(this.state.currentScenePath);
  }

  /**
   * Save the current scene to a new path
   *
   * @param absolutePath - Absolute path to save the scene to
   * @returns Result indicating success or failure
   */
  async saveSceneAs(absolutePath: string): Promise<SceneOperationResult> {
    const result = await this.saveSceneTo(absolutePath);

    if (result.success) {
      // Update state with new path
      this.state.currentScenePath = absolutePath;
      this.state.displayName = this.extractFilename(absolutePath);

      // Persist the last opened scene
      const relativePath = await this.toRelativePath(absolutePath);
      await updateLastOpenedScene(relativePath);

      this.notifyStateChange();
    }

    return result;
  }

  // ============================================================================
  // Play Mode Integration
  // ============================================================================

  /**
   * Capture a snapshot of the current scene for play mode
   *
   * This should be called before entering play mode to preserve the scene state.
   */
  captureSnapshot(): SceneSnapshot {
    const scene = this.engine.getScene();
    const commands = this.engine.createCommands();
    return SceneSnapshot.capture(scene, commands);
  }

  /**
   * Restore the scene from a snapshot
   *
   * This should be called when exiting play mode to restore the original state.
   * After restoration, the scene is marked as clean (no dirty changes).
   */
  restoreSnapshot(snapshot: SceneSnapshot): void {
    const scene = this.engine.getScene();
    const commands = this.engine.createCommands();
    snapshot.restore(scene, commands);

    // Scene restored = no dirty changes
    this.markClean();
  }

  // ============================================================================
  // Serialization Helpers
  // ============================================================================

  /**
   * Serialize the current scene to a SceneData object
   */
  serialize(): SceneData {
    const scene = this.engine.getScene();
    const commands = this.engine.createCommands();
    return this.serializer.serialize(scene, commands);
  }

  /**
   * Serialize the current scene to a JSON string
   */
  serializeToJson(pretty = true): string {
    const scene = this.engine.getScene();
    const commands = this.engine.createCommands();
    return this.serializer.serializeToString(scene, commands, pretty);
  }

  /**
   * Serialize the current scene to a YAML string
   */
  serializeToYaml(): string {
    const scene = this.engine.getScene();
    const commands = this.engine.createCommands();
    return this.serializer.serializeToYaml(scene, commands);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Save scene to a specific path
   */
  private async saveSceneTo(absolutePath: string): Promise<SceneOperationResult> {
    try {
      // Serialize based on file extension
      let content: string;
      if (isYamlFile(absolutePath)) {
        content = this.serializeToYaml();
      } else {
        content = this.serializeToJson(true);
      }

      // Write to file
      const writeResult = await EditorFileSystem.writeTextToPath(absolutePath, content);
      if (!writeResult.success) {
        return {
          success: false,
          error: writeResult.error ?? 'Failed to write scene file',
        };
      }

      // Mark SerializedScene as saved (updates disk state)
      if (this.serializedScene) {
        this.serializedScene.markAsSaved();
      }

      // Mark clean
      this.state.isDirty = false;
      this.notifyStateChange();

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Extract filename from path
   */
  private extractFilename(path: string): string {
    const segments = path.split(/[/\\]/);
    return segments[segments.length - 1] ?? 'Untitled';
  }

  /**
   * Convert absolute path to relative path (from project root)
   */
  private async toRelativePath(absolutePath: string): Promise<string> {
    const projectPath = this.config.projectPath;

    // Normalize path separators
    const normalizedAbsolute = absolutePath.replace(/\\/g, '/');
    const normalizedProject = projectPath.replace(/\\/g, '/');

    if (normalizedAbsolute.startsWith(normalizedProject)) {
      let relativePath = normalizedAbsolute.slice(normalizedProject.length);
      // Remove leading slash
      if (relativePath.startsWith('/')) {
        relativePath = relativePath.slice(1);
      }
      return relativePath;
    }

    // Fallback: return the absolute path if not under project
    return absolutePath;
  }

  /**
   * Notify state change callback
   */
  private notifyStateChange(): void {
    this.config.onStateChange?.(this.getState());
  }
}
