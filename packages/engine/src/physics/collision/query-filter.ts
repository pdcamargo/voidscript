/**
 * Query Filter System
 *
 * Provides filtering options for physics scene queries (raycasts, shape casts, etc.).
 * Inspired by Bevy Rapier's QueryFilter with JavaScript naming conventions.
 */

import type { Entity } from '@voidscript/core';

/**
 * Flags for filtering query results by body type
 */
export enum QueryFilterFlags {
  /** Include all body types (default) */
  ALL = 0,
  /** Exclude dynamic bodies from results */
  EXCLUDE_DYNAMIC = 1 << 0,
  /** Exclude fixed/static bodies from results */
  EXCLUDE_FIXED = 1 << 1,
  /** Exclude kinematic bodies from results */
  EXCLUDE_KINEMATIC = 1 << 2,
  /** Exclude sensor colliders from results */
  EXCLUDE_SENSORS = 1 << 3,
}

/**
 * Custom predicate function for query filtering.
 * Return true to include the entity, false to exclude.
 */
export type QueryPredicate = (entityId: Entity) => boolean;

/**
 * Query filter configuration for scene queries.
 *
 * @example
 * ```typescript
 * // Exclude sensors and a specific entity
 * const filter: QueryFilter = {
 *   flags: QueryFilterFlags.EXCLUDE_SENSORS,
 *   excludeEntity: playerEntity,
 * };
 *
 * // Custom filtering with predicate
 * const filter: QueryFilter = {
 *   predicate: (entity) => {
 *     const enemy = commands.tryGetComponent(entity, Enemy);
 *     return enemy !== undefined; // Only include enemies
 *   },
 * };
 * ```
 */
export interface QueryFilter {
  /** Flags to exclude certain body types */
  flags?: QueryFilterFlags;

  /** Collision group bitmask filter (only include colliders matching this) */
  groups?: number;

  /** Entity to exclude from results */
  excludeEntity?: Entity;

  /** Rigid body entity to exclude (all its colliders) */
  excludeRigidBody?: Entity;

  /** Custom predicate for advanced filtering */
  predicate?: QueryPredicate;
}

/**
 * Default query filter (includes everything)
 */
export const DEFAULT_QUERY_FILTER: QueryFilter = {
  flags: QueryFilterFlags.ALL,
};
