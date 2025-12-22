/**
 * CollisionGroups2D Component
 *
 * Defines which collision groups this entity belongs to and which groups it
 * can interact with. Uses 32-bit bitmasks for efficient collision filtering.
 *
 * This is separate from Collider2D for flexibility - you can add/remove
 * collision groups without modifying the collider configuration.
 *
 * @example
 * ```typescript
 * // Player only collides with environment and enemies
 * commands.spawn()
 *   .with(RigidBody2D, { bodyType: 'dynamic' })
 *   .with(Collider2D, { shape: { type: 'capsule', halfHeight: 0.5, radius: 0.3 } })
 *   .with(CollisionGroups2D, {
 *     memberships: CollisionGroup.PLAYER,
 *     filter: CollisionGroup.ENVIRONMENT | CollisionGroup.ENEMY,
 *   })
 *   .build();
 *
 * // Projectile collides with everything except other projectiles
 * commands.spawn()
 *   .with(RigidBody2D, { bodyType: 'dynamic' })
 *   .with(Collider2D, { shape: { type: 'ball', radius: 0.1 } })
 *   .with(CollisionGroups2D, {
 *     memberships: CollisionGroup.PROJECTILE,
 *     filter: CollisionGroup.ALL & ~CollisionGroup.PROJECTILE,
 *   })
 *   .build();
 * ```
 */

import { component } from '../../../ecs/component.js';

/**
 * Predefined collision group constants.
 *
 * Use these as building blocks for collision filtering.
 * You can define your own groups using bit shifts: `const MY_GROUP = 1 << 5;`
 */
export const CollisionGroup = {
  /** Group 1 (bit 0) */
  GROUP_1: 1 << 0,
  /** Group 2 (bit 1) */
  GROUP_2: 1 << 1,
  /** Group 3 (bit 2) */
  GROUP_3: 1 << 2,
  /** Group 4 (bit 3) */
  GROUP_4: 1 << 3,
  /** Group 5 (bit 4) */
  GROUP_5: 1 << 4,
  /** Group 6 (bit 5) */
  GROUP_6: 1 << 5,
  /** Group 7 (bit 6) */
  GROUP_7: 1 << 6,
  /** Group 8 (bit 7) */
  GROUP_8: 1 << 7,
  /** Group 9 (bit 8) */
  GROUP_9: 1 << 8,
  /** Group 10 (bit 9) */
  GROUP_10: 1 << 9,
  /** Group 11 (bit 10) */
  GROUP_11: 1 << 10,
  /** Group 12 (bit 11) */
  GROUP_12: 1 << 11,
  /** Group 13 (bit 12) */
  GROUP_13: 1 << 12,
  /** Group 14 (bit 13) */
  GROUP_14: 1 << 13,
  /** Group 15 (bit 14) */
  GROUP_15: 1 << 14,
  /** Group 16 (bit 15) */
  GROUP_16: 1 << 15,

  /** All groups (all bits set) */
  ALL: 0xffff,
  /** No groups (no bits set) */
  NONE: 0,

  // Common semantic names (aliases for GROUP_1-4)
  /** Player group (alias for GROUP_1) */
  PLAYER: 1 << 0,
  /** Enemy group (alias for GROUP_2) */
  ENEMY: 1 << 1,
  /** Environment/static group (alias for GROUP_3) */
  ENVIRONMENT: 1 << 2,
  /** Projectile group (alias for GROUP_4) */
  PROJECTILE: 1 << 3,
  /** Trigger/sensor group (alias for GROUP_5) */
  TRIGGER: 1 << 4,
} as const;

export interface CollisionGroups2DData {
  /**
   * Which collision groups this entity belongs to (16-bit bitmask).
   * Default: 0xFFFF (all groups)
   *
   * A collision can only happen if:
   * `(A.memberships & B.filter) !== 0 && (B.memberships & A.filter) !== 0`
   */
  memberships: number;

  /**
   * Which collision groups this entity can interact with (16-bit bitmask).
   * Default: 0xFFFF (interacts with all groups)
   *
   * Set specific bits to allow interaction with those groups.
   * Use `CollisionGroup.ALL & ~CollisionGroup.PROJECTILE` to exclude specific groups.
   */
  filter: number;
}

export const CollisionGroups2D = component<CollisionGroups2DData>(
  'CollisionGroups2D',
  {
    memberships: {
      serializable: true,
      instanceType: Number,
    },
    filter: {
      serializable: true,
      instanceType: Number,
    },
  },
  {
    path: 'physics/2d',
    defaultValue: () => ({
      memberships: CollisionGroup.ALL,
      filter: CollisionGroup.ALL,
    }),
    displayName: 'Collision Groups 2D',
    description: 'Collision layer membership and filtering',
  },
);
