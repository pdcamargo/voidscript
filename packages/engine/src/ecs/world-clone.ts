/**
 * World Cloning Utility
 *
 * Provides a clean way to clone a World instance using serialization/deserialization.
 * This ensures a fresh copy with no shared state between the original and cloned world.
 *
 * Use cases:
 * - Play mode (clone editor world for isolated testing)
 * - Scene instancing (create multiple copies of a scene)
 * - Undo/redo systems (preserve world snapshots)
 */

import { World } from "./world.js";
import { Command } from "./command.js";
import { WorldSerializer } from "./serialization/world-serializer.js";
import type { DeserializeOptions } from "./serialization/types.js";

/**
 * Clone a World instance via serialization → deserialization
 *
 * This creates a completely independent copy of the source world:
 * - All entities are recreated with new entity IDs
 * - All components are deep-copied (no shared references)
 * - Entity relationships (Parent/Children) are remapped correctly
 * - RuntimeAsset references are preserved (same singleton instances)
 *
 * @param sourceWorld - World to clone
 * @param sourceCommands - Command instance for source world
 * @param options - Optional deserialization options
 * @returns New World instance with cloned data
 *
 * @example
 * ```typescript
 * const editorWorld = sceneManager.currentWorld;
 * const editorCommands = sceneManager.currentCommands;
 *
 * // Clone for play mode
 * const playWorld = cloneWorldViaSnapshot(editorWorld, editorCommands);
 * const playApp = new Application(playWorld);
 * ```
 */
export function cloneWorldViaSnapshot(
  sourceWorld: World,
  sourceCommands: Command,
  options?: DeserializeOptions
): World {
  const serializer = new WorldSerializer();

  // Step 1: Serialize source world to WorldData
  const worldData = serializer.serialize(sourceWorld, sourceCommands);

  // Step 2: Create fresh World and Command instances
  const clonedWorld = new World();
  const clonedCommands = new Command(clonedWorld);

  // Step 3: Deserialize WorldData into cloned world
  // This handles entity ID remapping automatically
  const result = serializer.deserialize(clonedWorld, clonedCommands, worldData, {
    mode: "replace", // Replace mode clears existing entities first
    skipMissingComponents: false,
    continueOnError: false,
    ...options,
  });

  if (!result.success) {
    throw new Error(
      `Failed to clone world: ${result.error}`
    );
  }

  return clonedWorld;
}
