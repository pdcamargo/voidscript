import { component } from "../component.js";

/**
 * SceneRoot component marks entities as scene root containers.
 *
 * Scenes can have multiple root entities (Godot-style), and this component
 * tracks the scene instance metadata. Each scene instance has a unique instanceId,
 * and references the scene asset GUID.
 *
 * When instantiating a scene:
 * - One "virtual container" entity receives the SceneRoot component
 * - Multiple actual root entities (with their hierarchies) are created
 * - All entities in the scene receive SceneChild components
 *
 * This enables:
 * - Position offset applied to all root entities
 * - Single despawn command destroys entire scene instance
 * - Prefab overrides per instance
 * - Nested scene tracking
 */
export interface SceneRootData {
  /** GUID of the scene asset this instance was created from */
  sceneAssetGuid: string;

  /** Unique identifier for this scene instance (allows multiple instances of same scene) */
  instanceId: string;

  /** True if instantiated from asset, false if in-editor scene being edited */
  isPrefabRoot: boolean;

  /** Component value overrides from prefab defaults (format: "ComponentName.propertyName": value) */
  overrides?: Record<string, unknown>;

  /** Local entity IDs of the root entities in this scene (multiple roots supported) */
  rootEntityLocalIds: string[];
}

/**
 * SceneRoot component - marks the virtual container for a scene instance.
 *
 * Note: This component itself is NOT serialized when saving a scene to disk.
 * It's instance-specific metadata created during scene instantiation.
 */
export const SceneRoot = component<SceneRootData>("SceneRoot", {
  sceneAssetGuid: { serializable: false },
  instanceId: { serializable: false },
  isPrefabRoot: { serializable: false },
  overrides: { serializable: false },
  rootEntityLocalIds: { serializable: false },
});
