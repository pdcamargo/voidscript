/**
 * WorldSnapshot - Captures and restores ECS world state for play mode
 *
 * Used to snapshot the world before entering play mode and restore
 * it when stopping playback.
 */

import type { World } from '../ecs/world.js';
import type { Command } from '../ecs/command.js';
import { WorldSerializer } from '../ecs/serialization/world-serializer.js';
import type { WorldData } from '../ecs/serialization/schemas.js';
import { AssetDatabase } from '../ecs/asset-database.js';

/**
 * WorldSnapshot - Serialized world state that can be restored
 */
export class WorldSnapshot {
  private worldData: WorldData;
  private serializer: WorldSerializer;

  private constructor(worldData: WorldData) {
    this.worldData = worldData;
    this.serializer = new WorldSerializer();
  }

  /**
   * Capture current world state
   */
  static capture(world: World, commands: Command): WorldSnapshot {
    const serializer = new WorldSerializer();
    const worldData = serializer.serialize(world, commands);
    return new WorldSnapshot(worldData);
  }

  /**
   * Restore world to captured state
   * @param world - World to restore into (will be cleared first)
   * @param commands - Command instance for world operations
   */
  restore(world: World, commands: Command): void {
    const result = this.serializer.deserialize(world, commands, this.worldData, {
      mode: 'replace',
      skipMissingComponents: true,
      continueOnError: true,
      assetMetadataResolver: (guid) => AssetDatabase.getMetadata(guid),
    });

    if (!result.success) {
      console.error('[WorldSnapshot] Failed to restore world state:', result.error);
    }

    if (result.warnings.length > 0) {
      console.warn('[WorldSnapshot] Restore warnings:', result.warnings);
    }
  }

  /**
   * Get entity count in snapshot
   */
  get entityCount(): number {
    return this.worldData.entities.length;
  }

  /**
   * Get serialized world data (for debugging/inspection)
   */
  getData(): WorldData {
    return this.worldData;
  }
}
