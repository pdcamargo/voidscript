/**
 * PrefabInstance Component
 *
 * Marks the root entity of an instantiated prefab.
 * Child entities do NOT receive this component - they use the standard
 * Parent/Children components for hierarchy.
 *
 * Design decisions:
 * - Only the root entity has PrefabInstance
 * - Children are tracked via Parent/Children components
 * - Destroying the root recursively destroys children (existing behavior)
 * - Hierarchy viewer detects PrefabInstance to render collapsed view
 */

import type { Entity } from '../entity.js';
import { component } from '../component.js';

/**
 * PrefabInstance component data
 */
export interface PrefabInstanceData {
  /** GUID of the prefab asset this instance was created from */
  prefabAssetGuid: string;

  /** Unique identifier for this instance (allows multiple instances of same prefab) */
  instanceId: string;

  /**
   * Maps local entity UUID -> runtime entity ID for all entities in this prefab.
   * Used for:
   * - Looking up entities within the prefab by their stable IDs
   * - Applying overrides to specific entities
   * - Editor workflows that need to identify specific entities
   */
  entityMapping: Map<string, Entity>;

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
}

/**
 * PrefabInstance component - marks the root of an instantiated prefab.
 *
 * Serialization behavior (Phase 1 - No Overrides):
 * - prefabAssetGuid: Serialized to know which prefab to instantiate on load
 * - instanceId: Not serialized (generated fresh on instantiation)
 * - entityMapping: Not serialized (rebuilt on instantiation)
 * - overrides: Not serialized yet (Phase 2 feature)
 *
 * When loading a world with PrefabInstance:
 * 1. WorldSerializer detects PrefabInstance component
 * 2. Loads/instantiates the prefab from prefabAssetGuid
 * 3. Applies stored Transform3D/LocalTransform3D/Parent to the root
 * 4. Prefab children come from the prefab asset, not the world file
 */
export const PrefabInstance = component<PrefabInstanceData>(
  'PrefabInstance',
  {
    prefabAssetGuid: { serializable: true },
    instanceId: { serializable: false },
    entityMapping: { serializable: false },
    overrides: { serializable: false },
  },
  {
    path: 'prefab',
    description: 'Marks an entity as the root of an instantiated prefab',
    // Skip serializing children of this entity - they come from the prefab asset
    skipChildrenSerialization: true,
  },
);
