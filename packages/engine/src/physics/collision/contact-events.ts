/**
 * Contact Force Events
 *
 * ECS events for significant contact forces between colliders.
 * Useful for impact effects, damage systems, breakable objects, etc.
 *
 * To receive contact force events, entities must have:
 * 1. A Collider2D/3D component
 * 2. An ActiveCollisionEvents2D/3D component with CONTACT_FORCE_EVENTS flag enabled
 * 3. Optionally, a ContactForceEventThreshold2D/3D to filter weak impacts
 *
 * @example
 * ```typescript
 * // Impact damage system
 * const impactSystem = system(({ commands }) => {
 *   const reader = commands.eventReader(ContactForce2D);
 *
 *   for (const event of reader.read()) {
 *     // High-force impact
 *     if (event.totalForceMagnitude > 1000) {
 *       const health = commands.tryGetComponent(event.entityA, Health);
 *       if (health) {
 *         health.current -= event.totalForceMagnitude * 0.01;
 *       }
 *     }
 *   }
 * });
 * ```
 */

import type { Entity } from '@voidscript/core';
import * as THREE from 'three';

// ============================================================================
// 2D Contact Force Events
// ============================================================================

/**
 * Event emitted when contact force exceeds the configured threshold.
 *
 * Contact forces are computed by the physics solver and represent the
 * impulse needed to prevent penetration. Higher forces indicate harder impacts.
 */
export class ContactForce2D {
  constructor(
    /** First entity in the contact pair */
    public readonly entityA: Entity,
    /** Second entity in the contact pair */
    public readonly entityB: Entity,
    /** Sum of all contact force magnitudes */
    public readonly totalForceMagnitude: number,
    /** Maximum single contact force magnitude */
    public readonly maxForceMagnitude: number,
    /** Direction of the maximum force (normalized, points from A to B) */
    public readonly maxForceDirection: THREE.Vector2,
  ) {}
}

// ============================================================================
// 3D Contact Force Events
// ============================================================================

/**
 * Event emitted when contact force exceeds the configured threshold (3D).
 */
export class ContactForce3D {
  constructor(
    /** First entity in the contact pair */
    public readonly entityA: Entity,
    /** Second entity in the contact pair */
    public readonly entityB: Entity,
    /** Sum of all contact force magnitudes */
    public readonly totalForceMagnitude: number,
    /** Maximum single contact force magnitude */
    public readonly maxForceMagnitude: number,
    /** Direction of the maximum force (normalized, points from A to B) */
    public readonly maxForceDirection: THREE.Vector3,
  ) {}
}
