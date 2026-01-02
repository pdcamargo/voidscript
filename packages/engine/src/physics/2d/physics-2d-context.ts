/**
 * Physics2DContext Resource
 *
 * Resource that manages the Rapier 2D physics world and provides query APIs.
 * Only inserted if physics.enable2D is true in Application config.
 *
 * Public API:
 * - raycast(): Cast a ray and get first hit
 * - raycastAll(): Cast a ray and get all hits
 * - raycastFiltered(): Cast a ray with advanced filtering
 * - shapeCast(): Cast a shape and get first hit
 * - shapeCastAll(): Cast a shape and get all hits
 * - pointCast(): Check if point intersects any collider
 * - pointCastAll(): Get all colliders at a point
 * - projectPoint(): Find closest collider to a point
 * - intersectionsWithShape(): Get all colliders intersecting a shape
 * - collidersInAabb(): Fast broad-phase AABB check
 * - contactPair(): Get contact info between two entities
 * - contactPairsWith(): Get all entities in contact with an entity
 * - intersectionPair(): Check if two sensors are intersecting
 * - intersectionPairsWith(): Get all sensors intersecting with an entity
 * - setTranslation(): Teleport a rigid body (use sparingly!)
 * - setPhysicsHooks(): Set custom collision filtering hooks
 *
 * Internal API (for physics systems):
 * - getWorld(): Access Rapier world
 * - getEventQueue(): Access event queue for collision events
 * - registerBody/registerCollider: Track entity<->handle mappings
 * - cleanup(): Remove Rapier objects for removed entities
 */

import RAPIER from '@dimforge/rapier2d';
import * as THREE from 'three';
import type { Entity } from '@voidscript/core';
import type { ColliderShape2D } from '../types.js';
import type { QueryFilter, PhysicsHooks2D } from '../collision/index.js';
import { QueryFilterFlags, DEFAULT_QUERY_FILTER } from '../collision/index.js';

// ============================================================================
// Public Result Types
// ============================================================================

export interface RaycastHit2D {
  /** Entity ID that was hit */
  entityId: Entity;

  /** Hit point in world space */
  hitPoint: THREE.Vector2;

  /** Hit normal (perpendicular to surface) */
  hitNormal: THREE.Vector2;

  /** Time of impact (0-1 along ray, distance = toi * maxDistance) */
  toi: number;
}

export interface ShapeCastHit2D {
  /** Entity ID that was hit */
  entityId: Entity;

  /** Hit point in world space (on the hit collider) */
  hitPoint: THREE.Vector2;

  /** Hit normal (points from hit collider toward cast shape) */
  hitNormal: THREE.Vector2;

  /** Time of impact (0-1 along cast path) */
  toi: number;
}

export interface PointProjection2D {
  /** Closest entity */
  entityId: Entity;

  /** Closest point on the collider surface */
  point: THREE.Vector2;

  /** True if the query point is inside the collider */
  isInside: boolean;
}

export interface ContactPair2D {
  /** Contact points between the two colliders */
  points: Array<{
    /** Contact point in first collider's local space */
    localPointA: THREE.Vector2;
    /** Contact point in second collider's local space */
    localPointB: THREE.Vector2;
    /** Distance between contact points (negative = penetration) */
    distance: number;
    /** Impulse applied at this contact point */
    impulse: number;
  }>;

  /** Contact normal (points from collider A to collider B) */
  normal: THREE.Vector2;
}

// ============================================================================
// Physics2DContext Class
// ============================================================================

export class Physics2DContext {
  private world: RAPIER.World;
  private eventQueue: RAPIER.EventQueue;
  private physicsHooks: PhysicsHooks2D | null = null;

  private entityToBody = new Map<number, number>(); // entity ID → body handle
  private bodyToEntity = new Map<number, number>(); // body handle → entity ID
  private colliderToEntity = new Map<number, number>(); // collider handle → entity ID
  private entityToCollider = new Map<number, number>(); // entity ID → collider handle

  // Character controller tracking
  private entityToController = new Map<number, number>(); // entity ID → controller handle
  private controllerToEntity = new Map<number, number>(); // controller handle → entity ID
  private controllers: RAPIER.KinematicCharacterController[] = []; // controller instances by handle
  private nextControllerHandle = 0; // Auto-incrementing pseudo-handle

  constructor(gravity: { x: number; y: number }) {
    this.world = new RAPIER.World(gravity);
    this.eventQueue = new RAPIER.EventQueue(true);
  }

  // ============================================================================
  // Physics Hooks API
  // ============================================================================

  /**
   * Set custom physics hooks for collision filtering and modification.
   *
   * @param hooks - PhysicsHooks2D implementation, or null to disable
   *
   * @example
   * ```typescript
   * // One-way platform
   * physics.setPhysicsHooks({
   *   filterContactPair: (ctx) => {
   *     if (isPlatform(ctx.entityB)) {
   *       const playerY = getPosition(ctx.entityA).y;
   *       const platY = getPosition(ctx.entityB).y;
   *       if (playerY < platY) return null; // Pass through from below
   *     }
   *     return SolverFlags.COMPUTE_IMPULSES;
   *   },
   * });
   * ```
   */
  setPhysicsHooks(hooks: PhysicsHooks2D | null): void {
    this.physicsHooks = hooks;
  }

  /**
   * Get the current physics hooks.
   */
  getPhysicsHooks(): PhysicsHooks2D | null {
    return this.physicsHooks;
  }

  // ============================================================================
  // Public Query API - Raycasting
  // ============================================================================

  /**
   * Cast a ray and return the first hit.
   *
   * @param origin - Ray origin in world space
   * @param direction - Ray direction (will be normalized)
   * @param maxDistance - Maximum ray distance
   * @param solidOnly - If true, ignore sensor colliders
   * @returns Hit information or null if no hit
   */
  raycast(
    origin: THREE.Vector2,
    direction: THREE.Vector2,
    maxDistance: number,
    solidOnly = true,
  ): RaycastHit2D | null {
    const ray = new RAPIER.Ray(origin, direction.clone().normalize());
    const hit = this.world.castRayAndGetNormal(ray, maxDistance, solidOnly);

    if (!hit) return null;

    const colliderHandle = hit.collider.handle;
    const entityId = this.colliderToEntity.get(colliderHandle);

    if (entityId === undefined) return null;

    const hitPoint = ray.pointAt(hit.timeOfImpact);

    return {
      entityId,
      hitPoint: new THREE.Vector2(hitPoint.x, hitPoint.y),
      hitNormal: new THREE.Vector2(hit.normal.x, hit.normal.y),
      toi: hit.timeOfImpact,
    };
  }

  /**
   * Cast a ray and return all hits along the ray.
   *
   * @param origin - Ray origin in world space
   * @param direction - Ray direction (will be normalized)
   * @param maxDistance - Maximum ray distance
   * @param solidOnly - If true, ignore sensor colliders
   * @returns Array of hits sorted by distance (closest first)
   */
  raycastAll(
    origin: THREE.Vector2,
    direction: THREE.Vector2,
    maxDistance: number,
    solidOnly = true,
  ): RaycastHit2D[] {
    const ray = new RAPIER.Ray(origin, direction.clone().normalize());
    const hits: RaycastHit2D[] = [];

    this.world.intersectionsWithRay(ray, maxDistance, solidOnly, (hit) => {
      const colliderHandle = hit.collider.handle;
      const entityId = this.colliderToEntity.get(colliderHandle);

      if (entityId !== undefined) {
        const hitPoint = ray.pointAt(hit.timeOfImpact);

        hits.push({
          entityId,
          hitPoint: new THREE.Vector2(hitPoint.x, hitPoint.y),
          hitNormal: new THREE.Vector2(hit.normal.x, hit.normal.y),
          toi: hit.timeOfImpact,
        });
      }

      return true; // Continue iteration
    });

    // Sort by distance (closest first)
    hits.sort((a, b) => a.toi - b.toi);

    return hits;
  }

  /**
   * Cast a ray with advanced filtering options.
   *
   * @param origin - Ray origin in world space
   * @param direction - Ray direction (will be normalized)
   * @param maxDistance - Maximum ray distance
   * @param filter - Query filter options
   * @returns Hit information or null if no hit
   */
  raycastFiltered(
    origin: THREE.Vector2,
    direction: THREE.Vector2,
    maxDistance: number,
    filter: QueryFilter = DEFAULT_QUERY_FILTER,
  ): RaycastHit2D | null {
    const ray = new RAPIER.Ray(origin, direction.clone().normalize());

    let bestHit: RaycastHit2D | null = null;

    this.world.intersectionsWithRay(ray, maxDistance, true, (hit) => {
      const collider = hit.collider;
      const colliderHandle = collider.handle;
      const entityId = this.colliderToEntity.get(colliderHandle);

      if (entityId === undefined) return true;

      // Apply filter
      if (!this.passesFilter(collider, entityId, filter)) {
        return true; // Continue, didn't pass filter
      }

      // This is the closest valid hit (raycast iterates in order)
      const hitPoint = ray.pointAt(hit.timeOfImpact);
      bestHit = {
        entityId,
        hitPoint: new THREE.Vector2(hitPoint.x, hitPoint.y),
        hitNormal: new THREE.Vector2(hit.normal.x, hit.normal.y),
        toi: hit.timeOfImpact,
      };

      return false; // Stop iteration - found first valid hit
    });

    return bestHit;
  }

  // ============================================================================
  // Public Query API - Shape Casting
  // ============================================================================

  /**
   * Cast a shape along a path and return the first hit.
   *
   * Shape casting (sweep testing) moves a complete shape along a straight line,
   * useful for character controllers, projectiles, etc.
   *
   * @param shapePosition - Initial position of the shape center
   * @param shapeRotation - Shape rotation in radians
   * @param velocity - Direction and distance to cast (magnitude = distance)
   * @param shape - Shape to cast
   * @param filter - Query filter options
   * @returns Hit information or null if no hit
   */
  shapeCast(
    shapePosition: THREE.Vector2,
    shapeRotation: number,
    velocity: THREE.Vector2,
    shape: ColliderShape2D,
    filter: QueryFilter = DEFAULT_QUERY_FILTER,
  ): ShapeCastHit2D | null {
    const rapierShape = this.createRapierShape(shape);
    if (!rapierShape) return null;

    const maxToi = velocity.length();
    if (maxToi === 0) return null;

    const normalizedVel = velocity.clone().normalize();

    const hit = this.world.castShape(
      shapePosition,
      shapeRotation,
      normalizedVel,
      rapierShape,
      0, // targetDistance (minimum separation)
      maxToi,
      true, // stopAtPenetration
      this.buildQueryFilterFlags(filter),
    );

    if (!hit) return null;

    const entityId = this.colliderToEntity.get(hit.collider.handle);
    if (entityId === undefined) return null;

    // Apply predicate filter
    if (filter.predicate && !filter.predicate(entityId)) {
      return null;
    }

    // Apply excludeEntity filter
    if (filter.excludeEntity === entityId) {
      return null;
    }

    return {
      entityId,
      hitPoint: new THREE.Vector2(hit.witness1.x, hit.witness1.y),
      hitNormal: new THREE.Vector2(hit.normal1.x, hit.normal1.y),
      toi: hit.time_of_impact,
    };
  }

  /**
   * Cast a shape and return all hits along the path.
   *
   * @param shapePosition - Initial position of the shape center
   * @param shapeRotation - Shape rotation in radians
   * @param velocity - Direction and distance to cast
   * @param shape - Shape to cast
   * @param filter - Query filter options
   * @returns Array of hits sorted by distance (closest first)
   */
  shapeCastAll(
    shapePosition: THREE.Vector2,
    shapeRotation: number,
    velocity: THREE.Vector2,
    shape: ColliderShape2D,
    filter: QueryFilter = DEFAULT_QUERY_FILTER,
  ): ShapeCastHit2D[] {
    const hits: ShapeCastHit2D[] = [];
    const excludedEntities = new Set<Entity>();

    // Iteratively find hits, excluding already-found entities
    let currentFilter = { ...filter };

    while (true) {
      const originalPredicate = filter.predicate;
      currentFilter = {
        ...filter,
        predicate: (entityId) => {
          if (excludedEntities.has(entityId)) return false;
          return originalPredicate ? originalPredicate(entityId) : true;
        },
      };

      const hit = this.shapeCast(
        shapePosition,
        shapeRotation,
        velocity,
        shape,
        currentFilter,
      );

      if (!hit) break;

      hits.push(hit);
      excludedEntities.add(hit.entityId);
    }

    return hits.sort((a, b) => a.toi - b.toi);
  }

  // ============================================================================
  // Public Query API - Point Queries
  // ============================================================================

  /**
   * Check if a point intersects any collider.
   *
   * @param point - Point in world space
   * @param solidOnly - If true, ignore sensor colliders
   * @returns Entity ID of first collider at point, or null if none
   */
  pointCast(point: THREE.Vector2, solidOnly = true): Entity | null {
    let result: Entity | null = null;

    this.world.intersectionsWithPoint(point, (collider) => {
      if (solidOnly && collider.isSensor()) {
        return true; // Skip sensors, continue iteration
      }

      const entityId = this.colliderToEntity.get(collider.handle);
      if (entityId !== undefined) {
        result = entityId;
        return false; // Stop iteration
      }

      return true; // Continue iteration
    });

    return result;
  }

  /**
   * Get all entities whose colliders contain the given point.
   *
   * @param point - Point in world space
   * @param filter - Query filter options
   * @returns Array of entity IDs
   */
  pointCastAll(
    point: THREE.Vector2,
    filter: QueryFilter = DEFAULT_QUERY_FILTER,
  ): Entity[] {
    const results: Entity[] = [];

    this.world.intersectionsWithPoint(point, (collider) => {
      const entityId = this.colliderToEntity.get(collider.handle);
      if (entityId === undefined) return true;

      if (!this.passesFilter(collider, entityId, filter)) {
        return true;
      }

      results.push(entityId);
      return true; // Continue iteration
    });

    return results;
  }

  /**
   * Find the closest collider to a point.
   *
   * @param point - Point in world space
   * @param solid - If true, points inside return the surface point
   * @param filter - Query filter options
   * @returns Projection result or null if no collider found
   */
  projectPoint(
    point: THREE.Vector2,
    solid = true,
    filter: QueryFilter = DEFAULT_QUERY_FILTER,
  ): PointProjection2D | null {
    const projection = this.world.projectPoint(
      point,
      solid,
      this.buildQueryFilterFlags(filter),
    );

    if (!projection) return null;

    const entityId = this.colliderToEntity.get(projection.collider.handle);
    if (entityId === undefined) return null;

    if (filter.predicate && !filter.predicate(entityId)) {
      return null;
    }

    if (filter.excludeEntity === entityId) {
      return null;
    }

    return {
      entityId,
      point: new THREE.Vector2(projection.point.x, projection.point.y),
      isInside: projection.isInside,
    };
  }

  // ============================================================================
  // Public Query API - Intersection Tests
  // ============================================================================

  /**
   * Get all entities whose colliders intersect with a shape.
   *
   * @param shapePosition - Position of the shape center
   * @param shapeRotation - Shape rotation in radians
   * @param shape - Shape to test
   * @param filter - Query filter options
   * @returns Array of entity IDs whose colliders intersect the shape
   */
  intersectionsWithShape(
    shapePosition: THREE.Vector2,
    shapeRotation: number,
    shape: ColliderShape2D,
    filter: QueryFilter = DEFAULT_QUERY_FILTER,
  ): Entity[] {
    const rapierShape = this.createRapierShape(shape);
    if (!rapierShape) return [];

    const results: Entity[] = [];

    this.world.intersectionsWithShape(
      shapePosition,
      shapeRotation,
      rapierShape,
      (collider) => {
        const entityId = this.colliderToEntity.get(collider.handle);
        if (entityId === undefined) return true;

        if (!this.passesFilter(collider, entityId, filter)) {
          return true;
        }

        results.push(entityId);
        return true; // Continue iteration
      },
      this.buildQueryFilterFlags(filter),
    );

    return results;
  }

  /**
   * Get all entities whose collider AABBs intersect with an AABB.
   *
   * This is a fast broad-phase check that doesn't do precise shape testing.
   * Useful for spatial queries before detailed intersection tests.
   *
   * @param center - AABB center in world space
   * @param halfExtents - Half-width and half-height of the AABB
   * @param filter - Query filter options
   * @returns Array of entity IDs whose AABBs intersect
   */
  collidersInAabb(
    center: THREE.Vector2,
    halfExtents: THREE.Vector2,
    filter: QueryFilter = DEFAULT_QUERY_FILTER,
  ): Entity[] {
    const results: Entity[] = [];

    this.world.collidersWithAabbIntersectingAabb(
      { x: center.x - halfExtents.x, y: center.y - halfExtents.y },
      { x: center.x + halfExtents.x, y: center.y + halfExtents.y },
      (collider) => {
        const entityId = this.colliderToEntity.get(collider.handle);
        if (entityId === undefined) return true;

        if (!this.passesFilter(collider, entityId, filter)) {
          return true;
        }

        results.push(entityId);
        return true; // Continue iteration
      },
    );

    return results;
  }

  // ============================================================================
  // Public Query API - Contact Graph
  // ============================================================================

  /**
   * Get contact information between two specific entities.
   *
   * @param entityA - First entity
   * @param entityB - Second entity
   * @returns Contact pair info or null if not in contact
   */
  contactPair(entityA: Entity, entityB: Entity): ContactPair2D | null {
    const handleA = this.entityToCollider.get(entityA);
    const handleB = this.entityToCollider.get(entityB);

    if (handleA === undefined || handleB === undefined) return null;

    const colliderA = this.world.getCollider(handleA);
    const colliderB = this.world.getCollider(handleB);

    if (!colliderA || !colliderB) return null;

    let result: ContactPair2D | null = null;

    this.world.contactPair(colliderA, colliderB, (manifold, flipped) => {
      const points: ContactPair2D['points'] = [];

      const numContacts = manifold.numSolverContacts();
      for (let i = 0; i < numContacts; i++) {
        const localPointA = manifold.localContactPoint1(i);
        const localPointB = manifold.localContactPoint2(i);

        if (localPointA && localPointB) {
          points.push({
            localPointA: new THREE.Vector2(localPointA.x, localPointA.y),
            localPointB: new THREE.Vector2(localPointB.x, localPointB.y),
            distance: manifold.contactDist(i) ?? 0,
            impulse: manifold.contactImpulse(i) ?? 0,
          });
        }
      }

      const normal = manifold.localNormal1();
      result = {
        points,
        normal: new THREE.Vector2(
          normal ? (flipped ? -normal.x : normal.x) : 0,
          normal ? (flipped ? -normal.y : normal.y) : 0,
        ),
      };
    });

    return result;
  }

  /**
   * Get all entities currently in contact with the given entity.
   *
   * @param entityId - Entity to query contacts for
   * @returns Array of entity IDs in contact
   */
  contactPairsWith(entityId: Entity): Entity[] {
    const handle = this.entityToCollider.get(entityId);
    if (handle === undefined) return [];

    const collider = this.world.getCollider(handle);
    if (!collider) return [];

    const results: Entity[] = [];

    this.world.contactPairsWith(collider, (otherCollider) => {
      const otherEntityId = this.colliderToEntity.get(otherCollider.handle);
      if (otherEntityId !== undefined) {
        results.push(otherEntityId);
      }
    });

    return results;
  }

  /**
   * Check if two sensor colliders are intersecting.
   *
   * At least one of the colliders must be a sensor for this to work.
   *
   * @param entityA - First entity
   * @param entityB - Second entity
   * @returns True if intersecting
   */
  intersectionPair(entityA: Entity, entityB: Entity): boolean {
    const handleA = this.entityToCollider.get(entityA);
    const handleB = this.entityToCollider.get(entityB);

    if (handleA === undefined || handleB === undefined) return false;

    const colliderA = this.world.getCollider(handleA);
    const colliderB = this.world.getCollider(handleB);

    if (!colliderA || !colliderB) return false;

    return this.world.intersectionPair(colliderA, colliderB);
  }

  /**
   * Get all entities whose sensors are intersecting with the given entity's sensor.
   *
   * @param entityId - Entity to query intersections for
   * @returns Array of entity IDs intersecting
   */
  intersectionPairsWith(entityId: Entity): Entity[] {
    const handle = this.entityToCollider.get(entityId);
    if (handle === undefined) return [];

    const collider = this.world.getCollider(handle);
    if (!collider) return [];

    const results: Entity[] = [];

    this.world.intersectionPairsWith(collider, (otherCollider) => {
      const otherEntityId = this.colliderToEntity.get(otherCollider.handle);
      if (otherEntityId !== undefined) {
        results.push(otherEntityId);
      }
    });

    return results;
  }

  // ============================================================================
  // Public Mutation API
  // ============================================================================

  /**
   * Directly set the translation (position) of a rigid body.
   *
   * WARNING: Directly changing the position of a rigid-body is equivalent to teleporting it:
   * this is not a physically realistic action! Teleporting a dynamic or kinematic body may
   * result in odd behaviors especially if it teleports into a space occupied by other objects.
   * For dynamic bodies, forces, impulses, or velocity modification should be preferred.
   *
   * @param entityId - Entity with RigidBody2D component
   * @param position - New position in world space
   */
  setTranslation(entityId: Entity, position: THREE.Vector2): void {
    const bodyHandle = this.entityToBody.get(entityId);
    if (bodyHandle === undefined) {
      console.warn(
        `[Physics2D] Cannot set translation: entity ${entityId} has no physics body`,
      );
      return;
    }

    const body = this.world.getRigidBody(bodyHandle);
    if (!body) {
      console.warn(
        `[Physics2D] Cannot set translation: body handle ${bodyHandle} is invalid`,
      );
      return;
    }

    body.setTranslation(position, true);
  }

  // ============================================================================
  // Internal API (for physics systems)
  // ============================================================================

  /**
   * Get the Rapier world instance.
   * @internal Used by physics systems.
   */
  getWorld(): RAPIER.World {
    return this.world;
  }

  /**
   * Get the Rapier event queue for draining collision events.
   * @internal Used by physics2DCollisionEventSystem.
   */
  getEventQueue(): RAPIER.EventQueue {
    return this.eventQueue;
  }

  /**
   * Get entity ID from collider handle.
   * @internal Used by collision event system.
   */
  getEntityFromColliderHandle(handle: number): Entity | undefined {
    return this.colliderToEntity.get(handle);
  }

  /**
   * Get collider handle from entity ID.
   * @internal Used by various systems.
   */
  getColliderHandle(entityId: Entity): number | undefined {
    return this.entityToCollider.get(entityId);
  }

  /**
   * Register a rigid body handle for an entity.
   * @internal Used by component sync system.
   */
  registerBody(entityId: Entity, bodyHandle: number): void {
    this.entityToBody.set(entityId, bodyHandle);
    this.bodyToEntity.set(bodyHandle, entityId);
  }

  /**
   * Register a collider handle for an entity.
   * @internal Used by component sync system.
   */
  registerCollider(entityId: Entity, colliderHandle: number): void {
    this.colliderToEntity.set(colliderHandle, entityId);
    this.entityToCollider.set(entityId, colliderHandle);
  }

  /**
   * Unregister a rigid body for an entity.
   * @internal Used by cleanup system.
   */
  unregisterBody(entityId: Entity): void {
    const bodyHandle = this.entityToBody.get(entityId);
    if (bodyHandle !== undefined) {
      this.bodyToEntity.delete(bodyHandle);
      this.entityToBody.delete(entityId);
    }
  }

  /**
   * Unregister a collider.
   * @internal Used by cleanup system.
   */
  unregisterCollider(colliderHandle: number): void {
    const entityId = this.colliderToEntity.get(colliderHandle);
    if (entityId !== undefined) {
      this.entityToCollider.delete(entityId);
    }
    this.colliderToEntity.delete(colliderHandle);
  }

  /**
   * Get body handle for an entity.
   * @internal Used by physics systems.
   */
  getBodyHandle(entityId: Entity): number | undefined {
    return this.entityToBody.get(entityId);
  }

  // ============================================================================
  // Character Controller API (Internal)
  // ============================================================================

  /**
   * Register a character controller for an entity.
   * @internal Used by component sync system.
   */
  registerController(
    entityId: Entity,
    controller: RAPIER.KinematicCharacterController,
  ): number {
    const handle = this.nextControllerHandle++;
    this.entityToController.set(entityId, handle);
    this.controllerToEntity.set(handle, entityId);
    this.controllers[handle] = controller;
    return handle;
  }

  /**
   * Unregister a character controller for an entity.
   * @internal Used by cleanup system.
   */
  unregisterController(entityId: Entity): void {
    const handle = this.entityToController.get(entityId);
    if (handle !== undefined) {
      const controller = this.controllers[handle];
      if (controller) {
        controller.free(); // Free WASM resources
        delete this.controllers[handle];
      }
      this.controllerToEntity.delete(handle);
      this.entityToController.delete(entityId);
    }
  }

  /**
   * Get controller handle for an entity.
   * @internal Used by physics systems.
   */
  getControllerHandle(entityId: Entity): number | undefined {
    return this.entityToController.get(entityId);
  }

  /**
   * Get character controller by handle.
   * @internal Used by physics systems.
   */
  getController(
    handle: number,
  ): RAPIER.KinematicCharacterController | undefined {
    return this.controllers[handle];
  }

  // ============================================================================
  // Disposal API
  // ============================================================================

  /**
   * Dispose all physics resources.
   * Called when exiting play mode to prevent "invisible obstacles" on replay.
   *
   * This removes all rigid bodies, colliders, and character controllers from
   * the Rapier world and clears all entity mappings.
   */
  dispose(): void {
    // Free all character controllers first
    for (const controller of this.controllers) {
      if (controller) {
        controller.free();
      }
    }
    this.controllers = [];
    this.entityToController.clear();
    this.controllerToEntity.clear();
    this.nextControllerHandle = 0;

    // Remove all rigid bodies from the world (this also removes attached colliders)
    for (const bodyHandle of this.bodyToEntity.keys()) {
      const body = this.world.getRigidBody(bodyHandle);
      if (body) {
        this.world.removeRigidBody(body);
      }
    }

    // Clear all mappings
    this.entityToBody.clear();
    this.bodyToEntity.clear();
    this.colliderToEntity.clear();
    this.entityToCollider.clear();

    // Clear physics hooks
    this.physicsHooks = null;

    console.log('[Physics2D] Disposed all physics resources');
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Create a Rapier shape from ColliderShape2D definition.
   */
  private createRapierShape(shape: ColliderShape2D): RAPIER.Shape | null {
    switch (shape.type) {
      case 'cuboid':
        return new RAPIER.Cuboid(shape.halfWidth, shape.halfHeight);
      case 'ball':
        return new RAPIER.Ball(shape.radius);
      case 'capsule':
        return new RAPIER.Capsule(shape.halfHeight, shape.radius);
      default:
        return null;
    }
  }

  /**
   * Convert QueryFilter flags to Rapier QueryFilterFlags.
   */
  private buildQueryFilterFlags(filter: QueryFilter): number {
    let flags = 0;

    if (filter.flags) {
      if (filter.flags & QueryFilterFlags.EXCLUDE_DYNAMIC) {
        flags |= RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC;
      }
      if (filter.flags & QueryFilterFlags.EXCLUDE_FIXED) {
        flags |= RAPIER.QueryFilterFlags.EXCLUDE_FIXED;
      }
      if (filter.flags & QueryFilterFlags.EXCLUDE_KINEMATIC) {
        flags |= RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC;
      }
      if (filter.flags & QueryFilterFlags.EXCLUDE_SENSORS) {
        flags |= RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;
      }
    }

    return flags;
  }

  /**
   * Check if a collider passes the query filter.
   */
  private passesFilter(
    collider: RAPIER.Collider,
    entityId: Entity,
    filter: QueryFilter,
  ): boolean {
    // Check exclude flags
    if (filter.flags) {
      if (filter.flags & QueryFilterFlags.EXCLUDE_SENSORS) {
        if (collider.isSensor()) return false;
      }

      const parent = collider.parent();
      if (parent) {
        const bodyType = parent.bodyType();
        if (filter.flags & QueryFilterFlags.EXCLUDE_DYNAMIC) {
          if (bodyType === RAPIER.RigidBodyType.Dynamic) return false;
        }
        if (filter.flags & QueryFilterFlags.EXCLUDE_FIXED) {
          if (bodyType === RAPIER.RigidBodyType.Fixed) return false;
        }
        if (filter.flags & QueryFilterFlags.EXCLUDE_KINEMATIC) {
          if (
            bodyType === RAPIER.RigidBodyType.KinematicPositionBased ||
            bodyType === RAPIER.RigidBodyType.KinematicVelocityBased
          ) {
            return false;
          }
        }
      }
    }

    // Check excludeEntity
    if (filter.excludeEntity === entityId) {
      return false;
    }

    // Check excludeRigidBody
    if (filter.excludeRigidBody !== undefined) {
      const bodyHandle = this.entityToBody.get(entityId);
      const excludeBodyHandle = this.entityToBody.get(filter.excludeRigidBody);
      if (bodyHandle !== undefined && bodyHandle === excludeBodyHandle) {
        return false;
      }
    }

    // Check collision groups
    if (filter.groups !== undefined) {
      const colliderGroups = collider.collisionGroups();
      // Rapier packs memberships in high 16 bits
      const memberships = (colliderGroups >> 16) & 0xffff;
      if ((memberships & filter.groups) === 0) {
        return false;
      }
    }

    // Check custom predicate
    if (filter.predicate && !filter.predicate(entityId)) {
      return false;
    }

    return true;
  }
}

// Register Physics2DContext as a resource (internal, not serializable)
import { registerResource } from '@voidscript/core';
registerResource(Physics2DContext, false, {
  path: 'physics',
  displayName: '2D Physics Context',
  description: 'Manages 2D physics simulation (Rapier)',
  builtIn: true,
});
