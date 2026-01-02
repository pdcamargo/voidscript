/**
 * ActiveHooks3D Component
 *
 * Enables physics hooks for custom collision filtering on this entity's collider(s).
 * Without this component, PhysicsHooks callbacks won't be called for this entity.
 *
 * Physics hooks allow runtime filtering and modification of collisions,
 * useful for one-way platforms, conditional collisions, etc.
 *
 * @example
 * ```typescript
 * // Enable hooks for custom collision filtering
 * commands.spawn()
 *   .with(Transform3D, { position: new THREE.Vector3(0, 0, 0) })
 *   .with(RigidBody3D, { bodyType: 'static' })
 *   .with(Collider3D, { shape: { type: 'cuboid', halfWidth: 2, halfHeight: 0.1, halfDepth: 2 } })
 *   .with(ActiveHooks3D, { hooks: ActiveHooksFlags.FILTER_CONTACT_PAIRS })
 *   .build();
 * ```
 */

import { component } from '@voidscript/core';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';
import { ActiveHooksFlags } from '../../collision/physics-hooks.js';

export interface ActiveHooks3DData {
  /**
   * Which hooks are enabled for this collider (bitmask of ActiveHooksFlags).
   *
   * - FILTER_CONTACT_PAIRS: Enable filterContactPair callback
   * - FILTER_INTERSECTION_PAIRS: Enable filterIntersectionPair callback
   * - MODIFY_SOLVER_CONTACTS: Enable modifySolverContacts callback
   */
  hooks: ActiveHooksFlags;
}

export const ActiveHooks3D = component<ActiveHooks3DData>(
  'ActiveHooks3D',
  {
    hooks: {
      serializable: true,
      instanceType: Number,
      type: 'enum',
      enum: ActiveHooksFlags,
    },
  },
  {
    path: 'physics/3d',
    defaultValue: () => ({
      hooks: ActiveHooksFlags.FILTER_CONTACT_PAIRS,
    }),
    displayName: 'Active Hooks 3D',
    description: 'Enable physics hooks for custom collision filtering',
    customEditor: ({ componentData }) => {
      EditorLayout.beginLabelsWidth(['Filter Contact Pairs', 'Filter Intersection Pairs']);

      const hasContactPairs = (componentData.hooks & ActiveHooksFlags.FILTER_CONTACT_PAIRS) !== 0;
      const hasIntersectionPairs = (componentData.hooks & ActiveHooksFlags.FILTER_INTERSECTION_PAIRS) !== 0;

      const [contactPairs, contactChanged] = EditorLayout.checkboxField(
        'Filter Contact Pairs',
        hasContactPairs,
        { tooltip: 'Enable filterContactPair callback for custom collision filtering' }
      );

      const [intersectionPairs, intersectionChanged] = EditorLayout.checkboxField(
        'Filter Intersection Pairs',
        hasIntersectionPairs,
        { tooltip: 'Enable filterIntersectionPair callback for sensor filtering' }
      );

      if (contactChanged || intersectionChanged) {
        let newFlags = ActiveHooksFlags.NONE;
        if (contactChanged ? contactPairs : hasContactPairs) {
          newFlags |= ActiveHooksFlags.FILTER_CONTACT_PAIRS;
        }
        if (intersectionChanged ? intersectionPairs : hasIntersectionPairs) {
          newFlags |= ActiveHooksFlags.FILTER_INTERSECTION_PAIRS;
        }
        componentData.hooks = newFlags;
      }

      EditorLayout.endLabelsWidth();
    },
  },
);

// Re-export ActiveHooksFlags for convenience
export { ActiveHooksFlags };
