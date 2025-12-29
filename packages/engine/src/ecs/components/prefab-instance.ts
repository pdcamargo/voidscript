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
 * NOT serialized when saving world (instance-specific runtime data).
 * When saving a world to disk, PrefabInstance components should be stripped
 * and the prefab reference stored differently if persistence is needed.
 */
export const PrefabInstance = component<PrefabInstanceData>(
  'PrefabInstance',
  {
    prefabAssetGuid: { serializable: false },
    instanceId: { serializable: false },
    entityMapping: { serializable: false },
    overrides: { serializable: false },
  },
  {
    path: 'prefab',
    description: 'Marks an entity as the root of an instantiated prefab',
  },
);
