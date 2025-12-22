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

import { component } from '../../../ecs/component.js';
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
  },
);

// Re-export ActiveHooksFlags for convenience
export { ActiveHooksFlags };
