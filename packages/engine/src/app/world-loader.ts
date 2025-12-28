/**
 * WorldLoader - Service for loading world data from paths or inline JSON
 *
 * This service handles the async loading of world JSON files, supporting:
 * - Path-based loading (using platform or native fetch)
 * - Inline JSON object loading
 * - Asset metadata resolution
 *
 * @example
 * ```typescript
 * const loader = new WorldLoader(platform, (guid) => AssetDatabase.getMetadata(guid));
 * const result = await loader.load(world, commands, '/scenes/main.json');
 * ```
 */

import type { World } from '../ecs/world.js';
import type { Command } from '../ecs/command.js';
import type { EditorPlatform } from '../editor/editor-platform.js';
import { WorldSerializer } from '../ecs/serialization/world-serializer.js';
import { isYamlFile } from '../ecs/serialization/yaml-utils.js';
import type { WorldData } from '../ecs/serialization/schemas.js';
import type { DeserializeResult, DeserializeOptions } from '../ecs/serialization/types.js';

/**
 * Configuration for world loading
 */
export interface WorldLoaderConfig {
  /**
   * Platform abstraction for file operations.
   * If not provided, uses native fetch for path-based loading.
   */
  platform?: EditorPlatform;

  /**
   * Optional resolver for asset metadata during deserialization.
   * Used to convert GUID → RuntimeAsset with full metadata.
   */
  assetMetadataResolver?: (guid: string) => unknown | undefined;
}

/**
 * WorldLoader - Handles loading world data from various sources
 */
export class WorldLoader {
  private worldSerializer = new WorldSerializer();
  private platform?: EditorPlatform;
  private assetMetadataResolver?: (guid: string) => unknown | undefined;

  constructor(config: WorldLoaderConfig = {}) {
    this.platform = config.platform;
    this.assetMetadataResolver = config.assetMetadataResolver;
  }

  /**
   * Load world from path or inline data
   *
   * @param world - The ECS World to load into
   * @param commands - The Command API for entity manipulation
   * @param source - Path string (fetched at runtime) OR inline WorldData object
   * @param options - Optional deserialization options
   * @returns DeserializeResult with success status and entity counts
   */
  async load(
    world: World,
    commands: Command,
    source: string | WorldData,
    options: Partial<DeserializeOptions> = {}
  ): Promise<DeserializeResult> {
    if (typeof source === 'string') {
      return this.loadFromPath(world, commands, source, options);
    } else {
      return this.loadFromData(world, commands, source, options);
    }
  }

  /**
   * Load world from a file path
   *
   * Uses platform.readTextFile if available, otherwise falls back to native fetch.
   * Supports both JSON and YAML formats (detected by file extension).
   */
  private async loadFromPath(
    world: World,
    commands: Command,
    path: string,
    options: Partial<DeserializeOptions> = {}
  ): Promise<DeserializeResult> {
    let content: string;

    try {
      if (this.platform) {
        // Use platform for file operations (Tauri, Electron, etc.)
        content = await this.platform.readTextFile(path);
      } else {
        // Fall back to native fetch for web
        const response = await fetch(path);
        if (!response.ok) {
          return this.createErrorResult(
            `Failed to fetch world: ${response.status} ${response.statusText}`
          );
        }
        content = await response.text();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.createErrorResult(`Failed to load world from ${path}: ${message}`);
    }

    const deserializeOptions = {
      mode: 'replace' as const,
      assetMetadataResolver: this.assetMetadataResolver,
      ...options,
    };

    // Use YAML or JSON deserializer based on file extension
    if (isYamlFile(path)) {
      return this.worldSerializer.deserializeFromYaml(world, commands, content, deserializeOptions);
    }
    return this.worldSerializer.deserializeFromString(world, commands, content, deserializeOptions);
  }

  /**
   * Load world from inline data object
   */
  private loadFromData(
    world: World,
    commands: Command,
    data: WorldData,
    options: Partial<DeserializeOptions> = {}
  ): DeserializeResult {
    return this.worldSerializer.deserialize(world, commands, data, {
      mode: 'replace',
      assetMetadataResolver: this.assetMetadataResolver,
      ...options,
    });
  }

  /**
   * Create an error result
   */
  private createErrorResult(error: string): DeserializeResult {
    return {
      success: false,
      entitiesCreated: 0,
      entitiesSkipped: 0,
      warnings: [],
      error,
      entityMapping: new Map(),
    };
  }
}
