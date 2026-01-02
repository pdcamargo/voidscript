/**
 * SceneSnapshot - Captures and restores ECS scene state for play mode
 *
 * Used to snapshot the scene before entering play mode and restore
 * it when stopping playback.
 */

import type { Scene } from '../ecs/scene.js';
import type { Command } from '../ecs/command.js';
import { SceneSerializer } from '../ecs/serialization/scene-serializer.js';
import type { SceneData } from '../ecs/serialization/schemas.js';
import { AssetDatabase } from '../ecs/asset-database.js';

/**
 * SceneSnapshot - Serialized scene state that can be restored
 */
export class SceneSnapshot {
  private sceneData: SceneData;
  private serializer: SceneSerializer;

  private constructor(sceneData: SceneData) {
    this.sceneData = sceneData;
    this.serializer = new SceneSerializer();
  }

  /**
   * Capture current scene state
   */
  static capture(scene: Scene, commands: Command): SceneSnapshot {
    const serializer = new SceneSerializer();
    const sceneData = serializer.serialize(scene, commands);
    return new SceneSnapshot(sceneData);
  }

  /**
   * Restore scene to captured state
   * @param scene - Scene to restore into (will be cleared first)
   * @param commands - Command instance for scene operations
   */
  restore(scene: Scene, commands: Command): void {
    const result = this.serializer.deserialize(scene, commands, this.sceneData, {
      mode: 'replace',
      skipMissingComponents: true,
      continueOnError: true,
      assetMetadataResolver: (guid) => AssetDatabase.getMetadata(guid),
    });

    if (!result.success) {
      console.error('[SceneSnapshot] Failed to restore scene state:', result.error);
    }

    if (result.warnings.length > 0) {
      console.warn('[SceneSnapshot] Restore warnings:', result.warnings);
    }
  }

  /**
   * Get entity count in snapshot
   */
  get entityCount(): number {
    return this.sceneData.entities.length;
  }

  /**
   * Get serialized scene data (for debugging/inspection)
   */
  getData(): SceneData {
    return this.sceneData;
  }
}
