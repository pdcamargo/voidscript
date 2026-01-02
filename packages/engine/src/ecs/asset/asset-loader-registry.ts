/**
 * AssetLoaderRegistry - Central registry for asset loaders
 *
 * Maps AssetType to loader functions that know how to load that asset type.
 * This allows RuntimeAsset.load() to automatically select the correct loader
 * based on the asset's metadata type.
 *
 * @example
 * ```typescript
 * // Register a custom loader
 * AssetLoaderRegistry.register(AssetType.Texture, async (asset) => {
 *   const loader = getTextureLoader();
 *   return await loader.loadFromMetadata(asset.metadata as TextureMetadata);
 * });
 *
 * // RuntimeAsset will automatically use the registered loader
 * const textureAsset: RuntimeAsset<THREE.Texture> = ...;
 * await textureAsset.load(); // Uses registered Texture loader
 * ```
 */

import type { RuntimeAsset } from '@voidscript/core';
import type { TextureMetadata, Model3DMetadata, TiledMapMetadata } from './asset-metadata.js';
import { AssetType } from './asset-metadata.js';
import { getTextureLoader } from '../../loaders/texture-loader.js';
import {
  FileExtensions,
  enforceFileExtension,
} from '../../constants/file-extensions.js';
import * as THREE from 'three';
import type * as tiled from '@kayahr/tiled';

/**
 * Loader function type
 * Takes a RuntimeAsset and returns a Promise of the loaded data
 */
export type AssetLoaderFunction<T = any> = (asset: RuntimeAsset<T>) => Promise<T>;

/**
 * AssetLoaderRegistry - Manages asset loaders by type
 */
export class AssetLoaderRegistry {
  private static loaders = new Map<AssetType, AssetLoaderFunction>();

  /**
   * Register a loader for a specific asset type
   *
   * @param assetType - The asset type this loader handles
   * @param loader - Loader function that takes RuntimeAsset and returns loaded data
   *
   * @example
   * ```typescript
   * AssetLoaderRegistry.register(AssetType.Texture, async (asset) => {
   *   const loader = getTextureLoader();
   *   return await loader.loadFromMetadata(asset.metadata as TextureMetadata);
   * });
   * ```
   */
  static register<T>(
    assetType: AssetType,
    loader: AssetLoaderFunction<T>
  ): void {
    AssetLoaderRegistry.loaders.set(assetType, loader as AssetLoaderFunction);
  }

  /**
   * Get the registered loader for an asset type
   *
   * @param assetType - The asset type to get loader for
   * @returns Loader function or undefined if not registered
   */
  static get(assetType: AssetType): AssetLoaderFunction | undefined {
    return AssetLoaderRegistry.loaders.get(assetType);
  }

  /**
   * Check if a loader is registered for an asset type
   *
   * @param assetType - The asset type to check
   * @returns true if loader is registered
   */
  static has(assetType: AssetType): boolean {
    return AssetLoaderRegistry.loaders.has(assetType);
  }

  /**
   * Clear all registered loaders (for testing)
   */
  static clear(): void {
    AssetLoaderRegistry.loaders.clear();
  }

  /**
   * Get all registered asset types
   */
  static getRegisteredTypes(): AssetType[] {
    return Array.from(AssetLoaderRegistry.loaders.keys());
  }
}

// ============================================================================
// Register Default Loaders
// ============================================================================

/**
 * Default loader for Texture assets
 * Uses TextureLoader to load Three.js Texture from metadata
 */
AssetLoaderRegistry.register(AssetType.Texture, async (asset) => {
  const loader = getTextureLoader();
  return await loader.loadFromMetadata(asset.metadata as TextureMetadata);
});

/**
 * Default loader for Model3D assets (GLTF/GLB)
 * Uses GLTFLoader to load Three.js Group from file
 */
AssetLoaderRegistry.register(AssetType.Model3D, async (asset) => {
  const metadata = asset.metadata as Model3DMetadata;
  const url = asset.getLoadableUrl();

  // Dynamically import GLTFLoader to avoid bundling if not used
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);

  // Apply scale from metadata if specified
  if (metadata.scale !== undefined) {
    gltf.scene.scale.setScalar(metadata.scale);
  }

  // Apply rotation from metadata if specified
  if (metadata.rotation) {
    gltf.scene.rotation.set(
      metadata.rotation.x,
      metadata.rotation.y,
      metadata.rotation.z
    );
  }

  return gltf.scene;
});

/**
 * Default loader for TiledMap assets
 * Fetches and parses .tmj or .json Tiled map files
 */
AssetLoaderRegistry.register(AssetType.TiledMap, async (asset) => {
  const url = asset.getLoadableUrl();

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`[TiledMapLoader] Failed to load Tiled map from "${url}": ${response.statusText}`);
  }

  const mapData: tiled.Map = await response.json();
  return mapData;
});

/**
 * Default loader for Animation assets
 * Fetches JSON and parses into AnimationClip
 * Requires .vanim file extension
 */
AssetLoaderRegistry.register(AssetType.Animation, async (asset) => {
  const url = asset.getLoadableUrl();

  // Enforce correct file extension
  enforceFileExtension(
    asset.metadata.path,
    FileExtensions.AnimationClip,
    'loading animation',
  );

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`[AnimationLoader] Failed to load animation from "${url}": ${response.statusText}`);
  }

  // Get text first to provide better error messages
  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch (parseError) {
    // Provide helpful error message with preview of what was received
    const preview = text.slice(0, 200);
    throw new Error(
      `[AnimationLoader] Failed to parse animation JSON from "${url}". ` +
        `Expected JSON but received: ${preview}${text.length > 200 ? '...' : ''}`
    );
  }

  // Dynamically import to avoid circular dependencies
  const { parseAnimationClipJson } = await import('../../animation/animation-json-parser.js');
  return parseAnimationClipJson(json);
});

/**
 * Default loader for Audio assets
 * Uses Three.js AudioLoader to load audio files (.mp3, .wav, .ogg)
 * Returns AudioBuffer for use with THREE.Audio and THREE.PositionalAudio
 */
AssetLoaderRegistry.register(AssetType.Audio, async (asset) => {
  const url = asset.getLoadableUrl();

  const audioLoader = new THREE.AudioLoader();
  return await audioLoader.loadAsync(url);
});

/**
 * Default loader for Prefab assets
 * Fetches YAML/JSON and parses into PrefabAsset
 * Also caches the prefab in PrefabManager for instantiation
 * Requires .vprefab file extension
 */
AssetLoaderRegistry.register(AssetType.Prefab, async (asset) => {
  const url = asset.getLoadableUrl();

  // Enforce correct file extension
  enforceFileExtension(
    asset.metadata.path,
    FileExtensions.Prefab,
    'loading prefab',
  );

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`[PrefabLoader] Failed to load prefab from "${url}": ${response.statusText}`);
  }

  const text = await response.text();

  // Dynamically import to avoid circular dependencies
  const { yamlToJson, isYamlFile } = await import('@voidscript/core');
  const { PrefabManager } = await import('@voidscript/core');

  let prefabData;

  // Try YAML first if file extension suggests it, otherwise try JSON
  try {
    if (isYamlFile(url)) {
      const json = yamlToJson(text);
      prefabData = JSON.parse(json);
    } else {
      prefabData = JSON.parse(text);
    }
  } catch {
    // If JSON parse failed, try YAML as fallback
    try {
      const json = yamlToJson(text);
      prefabData = JSON.parse(json);
    } catch {
      // Provide helpful error message
      const preview = text.slice(0, 200);
      throw new Error(
        `[PrefabLoader] Failed to parse prefab from "${url}". ` +
          `Expected YAML/JSON but received: ${preview}${text.length > 200 ? '...' : ''}`,
      );
    }
  }

  // Cache the prefab in PrefabManager for instantiation
  if (PrefabManager.has()) {
    PrefabManager.get().loadPrefabFromData(asset.guid, prefabData);
  } else {
    console.warn(`[PrefabLoader] PrefabManager not initialized, cannot cache prefab ${asset.guid}`);
  }

  return prefabData;
});

/**
 * Default loader for Shader assets (.vsl files)
 * Fetches VSL source and compiles into ShaderAsset
 * Also updates asset metadata with shader information (uniforms, functions, etc.)
 * Requires .vsl file extension
 */
AssetLoaderRegistry.register(AssetType.Shader, async (asset) => {
  const url = asset.getLoadableUrl();

  // Enforce correct file extension
  enforceFileExtension(
    asset.metadata.path,
    FileExtensions.Shader,
    'loading shader',
  );

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`[ShaderLoader] Failed to load shader from "${url}": ${response.statusText}`);
  }

  const source = await response.text();

  // Dynamically import to avoid circular dependencies
  const { ShaderAsset } = await import('../../shader/shader-asset.js');
  const { isShaderMetadata } = await import('./asset-metadata.js');

  const shaderAsset = ShaderAsset.fromSource(source);

  // Update the asset metadata with shader information from the compiled result
  // This enables the editor to show uniform editors and other shader-specific UI
  if (isShaderMetadata(asset.metadata)) {
    const metadata = asset.metadata;

    // Update shader type from the actual compiled shader
    metadata.shaderType = shaderAsset.shaderType as 'canvas_item' | 'spatial' | 'particles';

    // Extract user-defined uniform names (exclude built-ins)
    metadata.uniformNames = shaderAsset.userUniformNames;

    // Update function presence flags
    metadata.hasVertexFunction = shaderAsset.hasVertexFunction;
    metadata.hasFragmentFunction = shaderAsset.hasFragmentFunction;

    // Update render modes
    metadata.renderModes = shaderAsset.renderModes;
  }

  return shaderAsset;
});

/**
 * Default loader for StateMachine assets (.vanimsm files)
 * Fetches JSON and parses into AnimationStateMachine
 * Also updates asset metadata with state machine information
 * Requires .vanimsm file extension
 */
AssetLoaderRegistry.register(AssetType.StateMachine, async (asset) => {
  const url = asset.getLoadableUrl();

  // Enforce correct file extension
  enforceFileExtension(
    asset.metadata.path,
    FileExtensions.AnimationStateMachine,
    'loading state machine',
  );

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`[StateMachineLoader] Failed to load state machine from "${url}": ${response.statusText}`);
  }

  // Get text first to provide better error messages
  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch (parseError) {
    // Provide helpful error message with preview of what was received
    const preview = text.slice(0, 200);
    throw new Error(
      `[StateMachineLoader] Failed to parse state machine JSON from "${url}". ` +
        `Expected JSON but received: ${preview}${text.length > 200 ? '...' : ''}`
    );
  }

  // Dynamically import to avoid circular dependencies
  const { parseStateMachineJson } = await import('../../animation/state-machine/state-machine-parser.js');
  const { isStateMachineMetadata } = await import('./asset-metadata.js');

  const stateMachine = parseStateMachineJson(json);

  // Update the asset metadata with state machine information
  if (isStateMachineMetadata(asset.metadata)) {
    const metadata = asset.metadata;
    metadata.stateCount = stateMachine.states.length;
    metadata.transitionCount = stateMachine.transitions.length;
    metadata.parameterCount = stateMachine.parameters.length;
    metadata.defaultStateId = stateMachine.defaultStateId;
  }

  return stateMachine;
});
