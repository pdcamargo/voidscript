/**
 * Physics Hooks System
 *
 * Provides interfaces for custom collision filtering and contact modification.
 * Inspired by Bevy Rapier's BevyPhysicsHooks with JavaScript naming conventions.
 *
 * Physics hooks allow you to:
 * - Filter contact pairs before collision detection
 * - Filter intersection pairs for sensors
 * - Modify solver contacts before constraint resolution
 *
 * @example
 * ```typescript
 * // Custom one-way platform
 * const hooks: PhysicsHooks = {
 *   filterContactPair: (context) => {
 *     // Allow contact only if player is falling onto platform
 *     if (isPlatform(context.entityB) && isPlayerFalling(context.entityA)) {
 *       return SolverFlags.COMPUTE_IMPULSES;
 *     }
 *     return null; // Skip this contact
 *   },
 * };
 *
 * physics.setPhysicsHooks(hooks);
 * ```
 */

import type { Entity } from '../../ecs/entity.js';
import * as THREE from 'three';

/**
 * Context provided to contact filter callbacks
 */
export interface ContactFilterContext {
  /** First entity in the contact pair */
  entityA: Entity;
  /** Second entity in the contact pair */
  entityB: Entity;
  /** Rapier handle for first collider */
  colliderHandleA: number;
  /** Rapier handle for second collider */
  colliderHandleB: number;
}

/**
 * Context provided to contact modification callbacks (2D)
 */
export interface ContactModificationContext2D extends ContactFilterContext {
  /** Contact normal (points from A to B) */
  normal: THREE.Vector2;
  /** Solver flags to modify */
  solverFlags: SolverFlags;
}

/**
 * Context provided to contact modification callbacks (3D)
 */
export interface ContactModificationContext3D extends ContactFilterContext {
  /** Contact normal (points from A to B) */
  normal: THREE.Vector3;
  /** Solver flags to modify */
  solverFlags: SolverFlags;
}

/**
 * Solver flags control how contacts are processed
 */
export enum SolverFlags {
  /** No flags - contact exists but no impulse computation */
  EMPTY = 0,
  /** Compute impulses for this contact (standard physics response) */
  COMPUTE_IMPULSES = 1 << 0,
}

/**
 * Flags to enable specific physics hooks on a collider.
 *
 * Note: MODIFY_SOLVER_CONTACTS is not available in Rapier JavaScript bindings.
 */
export enum ActiveHooksFlags {
  /** No hooks enabled */
  NONE = 0,
  /** Enable filterContactPair callback */
  FILTER_CONTACT_PAIRS = 1 << 0,
  /** Enable filterIntersectionPair callback */
  FILTER_INTERSECTION_PAIRS = 1 << 1,
  /** All hooks enabled */
  ALL = FILTER_CONTACT_PAIRS | FILTER_INTERSECTION_PAIRS,
}

/**
 * Physics hooks interface for 2D physics
 *
 * Implement this interface to customize physics behavior.
 * Set on Physics2DContext via setPhysicsHooks().
 *
 * Note: modifySolverContacts is not available in Rapier JavaScript bindings.
 */
export interface PhysicsHooks2D {
  /**
   * Called to filter contact pairs before collision detection.
   *
   * @param context - Information about the contact pair
   * @returns SolverFlags to process the contact, or null to skip it entirely
   *
   * @example
   * ```typescript
   * filterContactPair: (ctx) => {
   *   // One-way platform: only collide when player is above
   *   if (isPlatform(ctx.entityB)) {
   *     const playerPos = getPosition(ctx.entityA);
   *     const platPos = getPosition(ctx.entityB);
   *     if (playerPos.y < platPos.y) return null; // Skip
   *   }
   *   return SolverFlags.COMPUTE_IMPULSES;
   * }
   * ```
   */
  filterContactPair?(context: ContactFilterContext): SolverFlags | null;

  /**
   * Called to filter intersection pairs for sensors.
   *
   * @param context - Information about the intersection pair
   * @returns true to allow the intersection, false to skip it
   */
  filterIntersectionPair?(context: ContactFilterContext): boolean;
}

/**
 * Physics hooks interface for 3D physics
 *
 * Note: modifySolverContacts is not available in Rapier JavaScript bindings.
 */
export interface PhysicsHooks3D {
  /**
   * Called to filter contact pairs before collision detection.
   */
  filterContactPair?(context: ContactFilterContext): SolverFlags | null;

  /**
   * Called to filter intersection pairs for sensors.
   */
  filterIntersectionPair?(context: ContactFilterContext): boolean;
}
