/**
 * Collision Events
 *
 * ECS events for collision detection, inspired by Bevy Rapier.
 * These events are emitted by the collision event drain system after each physics step.
 *
 * To receive collision events, entities must have:
 * 1. A Collider2D/3D component
 * 2. An ActiveCollisionEvents2D/3D component with COLLISION_EVENTS flag enabled
 *
 * @example
 * ```typescript
 * // Reading collision events in a system
 * const damageSystem = system(({ commands }) => {
 *   const reader = commands.eventReader(CollisionStarted2D);
 *
 *   for (const event of reader.read()) {
 *     if (event.isSensor()) {
 *       // Trigger entered
 *       handleTriggerEnter(event.entityA, event.entityB);
 *     } else {
 *       // Solid collision
 *       handleCollision(event.entityA, event.entityB);
 *     }
 *   }
 * });
 * ```
 */

import type { Entity } from '@voidscript/core';

/**
 * Flags describing the collision event type
 */
export enum CollisionEventFlags {
  /** Normal collision between solid colliders */
  NONE = 0,
  /** At least one collider involved is a sensor */
  SENSOR = 1 << 0,
  /** Collision ended because one or both entities were removed */
  REMOVED = 1 << 1,
}

// ============================================================================
// 2D Collision Events
// ============================================================================

/**
 * Event emitted when two 2D colliders start touching.
 *
 * This event is emitted once when collision begins, not every frame during contact.
 * For continuous contact information, use contactPairsWith() on Physics2DContext.
 */
export class CollisionStarted2D {
  constructor(
    /** First entity in the collision pair */
    public readonly entityA: Entity,
    /** Second entity in the collision pair */
    public readonly entityB: Entity,
    /** Collision flags (sensor, etc.) */
    public readonly flags: CollisionEventFlags = CollisionEventFlags.NONE,
  ) {}

  /**
   * Check if either collider is a sensor (trigger).
   * Sensor collisions don't generate physics responses.
   */
  isSensor(): boolean {
    return (this.flags & CollisionEventFlags.SENSOR) !== 0;
  }
}

/**
 * Event emitted when two 2D colliders stop touching.
 *
 * This can happen when:
 * - Colliders physically separate
 * - One or both entities are removed (check isRemoved())
 * - Components are modified to prevent collision
 */
export class CollisionEnded2D {
  constructor(
    /** First entity in the collision pair */
    public readonly entityA: Entity,
    /** Second entity in the collision pair */
    public readonly entityB: Entity,
    /** Collision flags (sensor, removed, etc.) */
    public readonly flags: CollisionEventFlags = CollisionEventFlags.NONE,
  ) {}

  /**
   * Check if either collider is a sensor (trigger).
   */
  isSensor(): boolean {
    return (this.flags & CollisionEventFlags.SENSOR) !== 0;
  }

  /**
   * Check if collision ended due to entity removal.
   * If true, one or both entities may no longer exist.
   */
  isRemoved(): boolean {
    return (this.flags & CollisionEventFlags.REMOVED) !== 0;
  }
}

// ============================================================================
// 3D Collision Events
// ============================================================================

/**
 * Event emitted when two 3D colliders start touching.
 */
export class CollisionStarted3D {
  constructor(
    /** First entity in the collision pair */
    public readonly entityA: Entity,
    /** Second entity in the collision pair */
    public readonly entityB: Entity,
    /** Collision flags (sensor, etc.) */
    public readonly flags: CollisionEventFlags = CollisionEventFlags.NONE,
  ) {}

  /**
   * Check if either collider is a sensor (trigger).
   */
  isSensor(): boolean {
    return (this.flags & CollisionEventFlags.SENSOR) !== 0;
  }
}

/**
 * Event emitted when two 3D colliders stop touching.
 */
export class CollisionEnded3D {
  constructor(
    /** First entity in the collision pair */
    public readonly entityA: Entity,
    /** Second entity in the collision pair */
    public readonly entityB: Entity,
    /** Collision flags (sensor, removed, etc.) */
    public readonly flags: CollisionEventFlags = CollisionEventFlags.NONE,
  ) {}

  /**
   * Check if either collider is a sensor (trigger).
   */
  isSensor(): boolean {
    return (this.flags & CollisionEventFlags.SENSOR) !== 0;
  }

  /**
   * Check if collision ended due to entity removal.
   */
  isRemoved(): boolean {
    return (this.flags & CollisionEventFlags.REMOVED) !== 0;
  }
}
