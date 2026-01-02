/**
 * SceneLoader - Service for loading scene data from paths or inline JSON
 *
 * This service handles the async loading of scene JSON files, supporting:
 * - Path-based loading (using platform or native fetch)
 * - Inline JSON object loading
 * - Asset metadata resolution
 *
 * @example
 * ```typescript
 * const loader = new SceneLoader(platform, (guid) => AssetDatabase.getMetadata(guid));
 * const result = await loader.load(scene, commands, '/scenes/main.json');
 * ```
 */

import type { Scene } from '@voidscript/core';
import type { Command } from '@voidscript/core';
import type { EditorPlatform } from '../editor/editor-platform.js';
import { SceneSerializer } from '@voidscript/core';
import { isYamlFile } from '@voidscript/core';
import type { SceneData } from '@voidscript/core';
import type { DeserializeResult, DeserializeOptions } from '@voidscript/core';

/**
 * Configuration for scene loading
 */
export interface SceneLoaderConfig {
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
 * SceneLoader - Handles loading scene data from various sources
 */
export class SceneLoader {
  private sceneSerializer = new SceneSerializer();
  private platform?: EditorPlatform;
  private assetMetadataResolver?: (guid: string) => unknown | undefined;

  constructor(config: SceneLoaderConfig = {}) {
    this.platform = config.platform;
    this.assetMetadataResolver = config.assetMetadataResolver;
  }

  /**
   * Load scene from path or inline data
   *
   * @param scene - The ECS Scene to load into
   * @param commands - The Command API for entity manipulation
   * @param source - Path string (fetched at runtime) OR inline SceneData object
   * @param options - Optional deserialization options
   * @returns DeserializeResult with success status and entity counts
   */
  async load(
    scene: Scene,
    commands: Command,
    source: string | SceneData,
    options: Partial<DeserializeOptions> = {}
  ): Promise<DeserializeResult> {
    if (typeof source === 'string') {
      return this.loadFromPath(scene, commands, source, options);
    } else {
      return this.loadFromData(scene, commands, source, options);
    }
  }

  /**
   * Load scene from a file path
   *
   * Uses platform.readTextFile if available, otherwise falls back to native fetch.
   * Supports both JSON and YAML formats (detected by file extension).
   */
  private async loadFromPath(
    scene: Scene,
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
            `Failed to fetch scene: ${response.status} ${response.statusText}`
          );
        }
        content = await response.text();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.createErrorResult(`Failed to load scene from ${path}: ${message}`);
    }

    const deserializeOptions = {
      mode: 'replace' as const,
      assetMetadataResolver: this.assetMetadataResolver,
      ...options,
    };

    // Use YAML or JSON deserializer based on file extension
    if (isYamlFile(path)) {
      return this.sceneSerializer.deserializeFromYaml(scene, commands, content, deserializeOptions);
    }
    return this.sceneSerializer.deserializeFromString(scene, commands, content, deserializeOptions);
  }

  /**
   * Load scene from inline data object
   */
  private loadFromData(
    scene: Scene,
    commands: Command,
    data: SceneData,
    options: Partial<DeserializeOptions> = {}
  ): DeserializeResult {
    return this.sceneSerializer.deserialize(scene, commands, data, {
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
