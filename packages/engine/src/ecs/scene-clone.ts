/**
 * Scene Cloning Utility
 *
 * Provides a clean way to clone a Scene instance using serialization/deserialization.
 * This ensures a fresh copy with no shared state between the original and cloned scene.
 *
 * Use cases:
 * - Play mode (clone editor scene for isolated testing)
 * - Scene instancing (create multiple copies of a scene)
 * - Undo/redo systems (preserve scene snapshots)
 */

import { Scene } from "./scene.js";
import { Command } from "./command.js";
import { SceneSerializer } from "./serialization/scene-serializer.js";
import type { DeserializeOptions } from "./serialization/types.js";

/**
 * Clone a Scene instance via serialization → deserialization
 *
 * This creates a completely independent copy of the source scene:
 * - All entities are recreated with new entity IDs
 * - All components are deep-copied (no shared references)
 * - Entity relationships (Parent/Children) are remapped correctly
 * - RuntimeAsset references are preserved (same singleton instances)
 *
 * @param sourceScene - Scene to clone
 * @param sourceCommands - Command instance for source scene
 * @param options - Optional deserialization options
 * @returns New Scene instance with cloned data
 *
 * @example
 * ```typescript
 * const editorScene = sceneManager.currentScene;
 * const editorCommands = sceneManager.currentCommands;
 *
 * // Clone for play mode
 * const playScene = cloneSceneViaSnapshot(editorScene, editorCommands);
 * const playApp = new Application(playScene);
 * ```
 */
export function cloneSceneViaSnapshot(
  sourceScene: Scene,
  sourceCommands: Command,
  options?: DeserializeOptions
): Scene {
  const serializer = new SceneSerializer();

  // Step 1: Serialize source scene to SceneData
  const sceneData = serializer.serialize(sourceScene, sourceCommands);

  // Step 2: Create fresh Scene and Command instances
  const clonedScene = new Scene();
  const clonedCommands = new Command(clonedScene);

  // Step 3: Deserialize SceneData into cloned scene
  // This handles entity ID remapping automatically
  const result = serializer.deserialize(clonedScene, clonedCommands, sceneData, {
    mode: "replace", // Replace mode clears existing entities first
    skipMissingComponents: false,
    continueOnError: false,
    ...options,
  });

  if (!result.success) {
    throw new Error(
      `Failed to clone scene: ${result.error}`
    );
  }

  return clonedScene;
}

// ============================================================================
// Backward Compatibility Aliases (Deprecated)
// ============================================================================

/**
 * @deprecated Use `cloneSceneViaSnapshot` instead. Will be removed in a future version.
 */
export const cloneWorldViaSnapshot = cloneSceneViaSnapshot;
