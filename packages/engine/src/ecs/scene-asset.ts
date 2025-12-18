/**
 * Scene Asset System
 *
 * Defines the file format for scene assets (.scene.json files).
 * Scenes are reusable collections of entities that can be instantiated multiple times.
 *
 * Key Design:
 * - Scenes wrap WorldSerializer format (reuses proven serialization)
 * - Multiple root entities supported (Godot-style)
 * - Stable local entity IDs (UUIDs) for deterministic serialization
 * - Nested scenes store GUID references only (no embedded data)
 */

import type { SceneMetadata } from "./asset-metadata.js";
import type { WorldData } from "./serialization/schemas.js";

/**
 * Scene file format (.scene.json)
 *
 * A scene is a template that can be instantiated into a world multiple times.
 * Each instance gets fresh entity IDs (remapped during instantiation).
 */
export interface SceneAsset {
  /** Format version for backward compatibility */
  version: "1.0.0";

  /** Scene asset metadata (GUID, path, entity count, nested scenes, etc.) */
  metadata: SceneMetadata;

  /** World serialization data (entities, components, component registry) */
  world: WorldData;

  /** Scene-specific data not in WorldSerializer format */
  sceneData: SceneData;
}

/**
 * Scene-specific data that supplements WorldSerializer format
 */
export interface SceneData {
  /**
   * Stable local entity IDs (UUIDs) for entities in this scene template.
   * Maps runtime entity ID (during scene saving) to stable local ID.
   *
   * These IDs:
   * - Remain consistent across serialization cycles
   * - Enable deterministic entity references within scene
   * - Support prefab overrides (identify which entity was modified)
   * - Used for editor workflows
   */
  entityIdMap: Record<number, string>; // Runtime ID -> stable UUID

  /**
   * Local IDs of root entities in this scene.
   * Scenes can have multiple roots (Godot-style).
   *
   * During instantiation:
   * - Position offsets applied to all roots
   * - If parent specified, all roots become children of that parent
   * - Each root's children maintain relative positions via hierarchy
   */
  rootEntityLocalIds: string[];
}

/**
 * Options for scene instantiation
 */
export interface InstantiateSceneOptions {
  /**
   * Position offset applied to ALL root entities
   * Child entities maintain relative positions via Parent/Children hierarchy
   */
  positionOffset?: { x: number; y: number; z: number };

  /**
   * Optional parent entity for all root entities
   * If specified, all roots become children of this entity
   */
  parentEntity?: number; // Entity ID

  /**
   * Component value overrides from prefab defaults
   * Format: "ComponentName.propertyName": value
   *
   * Example:
   * {
   *   "Health.maxHealth": 200,
   *   "Sprite.tint": 0xff0000
   * }
   */
  overrides?: Record<string, unknown>;
}

/**
 * Result of scene instantiation
 */
export interface InstantiateSceneResult {
  /** Root entity IDs of the instantiated scene */
  rootEntities: number[];

  /** Virtual container entity with SceneRoot component */
  sceneRootEntity: number;

  /** All entity IDs created (roots + children) */
  allEntities: number[];

  /** Mapping from template local ID to new runtime entity ID */
  entityMapping: Map<string, number>;
}
