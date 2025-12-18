import { Entity } from "../entity.js";
import { component } from "../component.js";

/**
 * SceneChild component marks entities that belong to a scene instance.
 *
 * This component is added to ALL entities that are part of a scene instance,
 * including the root entities. It enables:
 * - Fast queries for "all entities in this scene instance"
 * - Scene membership tracking for despawning
 * - Mapping back to the scene asset for editor workflows
 *
 * The localEntityId is a stable UUID assigned during scene saving that remains
 * consistent across serialization cycles. This enables:
 * - Deterministic entity references within a scene
 * - Prefab override tracking (which specific entity in scene was modified)
 * - Editor workflows that need to identify specific entities in a scene template
 */
export interface SceneChildData {
  /** Reference to the virtual container entity with SceneRoot component */
  sceneRootEntity: Entity;

  /** GUID of the scene asset (same as SceneRoot.sceneAssetGuid) */
  sceneAssetGuid: string;

  /** Stable local ID within the scene template (UUID, not runtime entity ID) */
  localEntityId: string;
}

/**
 * SceneChild component - marks entities as members of a scene instance.
 *
 * Note: This component is NOT serialized when saving a scene to disk.
 * It's instance-specific metadata created during scene instantiation.
 */
export const SceneChild = component<SceneChildData>("SceneChild", {
  sceneRootEntity: { serializable: false },
  sceneAssetGuid: { serializable: false },
  localEntityId: { serializable: false },
});
