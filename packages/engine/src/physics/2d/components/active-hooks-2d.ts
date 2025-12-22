/**
 * ActiveHooks2D Component
 *
 * Enables physics hooks for custom collision filtering on this entity's collider(s).
 * Without this component, PhysicsHooks callbacks won't be called for this entity.
 *
 * Physics hooks allow runtime filtering and modification of collisions,
 * useful for one-way platforms, conditional collisions, etc.
 *
 * @example
 * ```typescript
 * // One-way platform setup
 * // 1. Create the platform with hooks enabled
 * commands.spawn()
 *   .with(Transform3D, { position: new THREE.Vector3(0, 0, 0) })
 *   .with(RigidBody2D, { bodyType: 'static' })
 *   .with(Collider2D, { shape: { type: 'cuboid', halfWidth: 2, halfHeight: 0.1 } })
 *   .with(ActiveHooks2D, { hooks: ActiveHooksFlags.FILTER_CONTACT_PAIRS })
 *   .with(OneWayPlatform, {}) // Custom marker component
 *   .build();
 *
 * // 2. Set up the physics hooks
 * const physics = commands.getResource(Physics2DContext);
 * physics.setPhysicsHooks({
 *   filterContactPair: (ctx) => {
 *     // Check if this is a one-way platform
 *     const platform = commands.tryGetComponent(ctx.entityB, OneWayPlatform);
 *     if (platform) {
 *       // Only collide when player is above and falling
 *       const playerPos = getPosition(ctx.entityA);
 *       const platPos = getPosition(ctx.entityB);
 *       const playerVel = getVelocity(ctx.entityA);
 *
 *       if (playerPos.y < platPos.y || playerVel.y > 0) {
 *         return null; // Skip collision (allow pass-through)
 *       }
 *     }
 *     return SolverFlags.COMPUTE_IMPULSES; // Normal collision
 *   },
 * });
 * ```
 */

import { component } from '../../../ecs/component.js';
import { ActiveHooksFlags } from '../../collision/physics-hooks.js';

export interface ActiveHooks2DData {
  /**
   * Which hooks are enabled for this collider (bitmask of ActiveHooksFlags).
   *
   * - FILTER_CONTACT_PAIRS: Enable filterContactPair callback
   * - FILTER_INTERSECTION_PAIRS: Enable filterIntersectionPair callback
   * - MODIFY_SOLVER_CONTACTS: Enable modifySolverContacts callback
   */
  hooks: ActiveHooksFlags;
}

export const ActiveHooks2D = component<ActiveHooks2DData>(
  'ActiveHooks2D',
  {
    hooks: {
      serializable: true,
      instanceType: Number,
      type: 'enum',
      enum: ActiveHooksFlags,
    },
  },
  {
    path: 'physics/2d',
    defaultValue: () => ({
      hooks: ActiveHooksFlags.FILTER_CONTACT_PAIRS,
    }),
    displayName: 'Active Hooks 2D',
    description: 'Enable physics hooks for custom collision filtering',
  },
);

// Re-export ActiveHooksFlags for convenience
export { ActiveHooksFlags };
