/**
 * Prefab Asset Types
 *
 * Defines the file format and interfaces for prefab assets (.prefab.yaml).
 * Prefabs are reusable entity templates that can be instantiated multiple times.
 */

import type { SceneData } from '../serialization/schemas.js';
import type { BaseAssetMetadata } from '../ecs/asset-types.js';

/**
 * Prefab-specific metadata (extends BaseAssetMetadata)
 * Full PrefabMetadata with AssetType enum is defined in engine
 */
export interface PrefabMetadata extends BaseAssetMetadata {
  /** Number of entities in the prefab */
  entityCount: number;
  /** Component types used in the prefab (for dependency tracking) */
  componentTypes: string[];
  /** GUIDs of nested prefabs referenced within this prefab */
  nestedPrefabs: string[];
}

/**
 * Prefab file format (.prefab.yaml)
 *
 * A prefab is a reusable template that can be instantiated multiple times.
 * Each instance gets fresh entity IDs (remapped during instantiation).
 */
export interface PrefabAsset {
  /** Format version for backward compatibility */
  version: '1.0.0';

  /** Prefab asset metadata */
  metadata: PrefabMetadata;

  /** Scene serialization data (entities, components, component registry) */
  scene: SceneData;

  /** Prefab-specific data */
  prefabData: PrefabData;
}

/**
 * Prefab-specific data that supplements WorldSerializer format
 */
export interface PrefabData {
  /**
   * Stable local entity IDs (UUIDs) for entities in this prefab template.
   * Maps serialized entity ID (sequential, from WorldSerializer) to stable UUID.
   *
   * These UUIDs:
   * - Remain consistent across save/load cycles
   * - Enable deterministic entity references within prefab
   * - Support overrides (identify which entity to modify)
   * - Used for editor workflows
   */
  entityIdMap: Record<number, string>;

  /**
   * Local UUID of the root entity.
   * During instantiation, this entity receives the PrefabInstance component.
   * All other entities become children/descendants of this root.
   */
  rootEntityId: string;
}

/**
 * Options for prefab instantiation
 */
export interface InstantiatePrefabOptions {
  /** Position applied to the root entity's Transform3D */
  position?: { x: number; y: number; z: number };

  /** Rotation applied to the root entity's Transform3D (Euler angles) */
  rotation?: { x: number; y: number; z: number };

  /** Scale applied to the root entity's Transform3D */
  scale?: { x: number; y: number; z: number };

  /** Optional parent entity for the prefab root */
  parentEntity?: number;

  /**
   * Component value overrides from prefab defaults.
   * Format: "localEntityId.ComponentName.propertyName": value
   *
   * Example:
   * {
   *   "abc-123.Health.maxHealth": 200,
   *   "def-456.Sprite2D.tint": 0xff0000
   * }
   */
  overrides?: Record<string, unknown>;

  /** Optional resolver for asset metadata during deserialization */
  assetMetadataResolver?: (guid: string) => unknown | null;
}

/**
 * Result of prefab instantiation
 */
export interface InstantiatePrefabResult {
  /** The root entity (has PrefabInstance component) */
  rootEntity: number;

  /** All entity IDs created (root + children) */
  allEntities: number[];

  /** Mapping from template local UUID to new runtime entity ID */
  entityMapping: Map<string, number>;

  /** The unique instance ID generated for this instantiation */
  instanceId: string;
}

/**
 * Options for saving a prefab
 */
export interface SavePrefabOptions {
  /** GUID for the prefab asset (generated if not provided) */
  guid?: string;

  /** Relative path from project root (e.g., "/prefabs/player.prefab.yaml") */
  path: string;

  /** Optional preview image path */
  thumbnailPath?: string;
}
