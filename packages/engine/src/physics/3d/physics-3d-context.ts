/**
 * Physics3DContext Resource
 *
 * Resource that manages the Rapier 3D physics world and provides query APIs.
 * Only inserted if physics.enable3D is true in Application config.
 *
 * Public API:
 * - raycast(): Cast a ray and get first hit
 * - raycastAll(): Cast a ray and get all hits
 * - pointCast(): Check if point intersects any collider
 * - setTranslation(): Teleport a rigid body (use sparingly!)
 *
 * Internal API (for physics systems):
 * - getWorld(): Access Rapier world
 * - registerBody/registerCollider: Track entity<->handle mappings
 * - cleanup(): Remove Rapier objects for removed entities
 */

import RAPIER from '@dimforge/rapier3d';
import * as THREE from 'three';

export interface RaycastHit3D {
  /** Entity ID that was hit */
  entityId: number;

  /** Hit point in world space */
  hitPoint: THREE.Vector3;

  /** Hit normal (perpendicular to surface) */
  hitNormal: THREE.Vector3;

  /** Time of impact (0-1 along ray, distance = toi * maxDistance) */
  toi: number;
}

export class Physics3DContext {
  private world: RAPIER.World;
  private entityToBody = new Map<number, number>(); // entity ID → body handle
  private bodyToEntity = new Map<number, number>(); // body handle → entity ID
  private colliderToEntity = new Map<number, number>(); // collider handle → entity ID

  // Character controller tracking
  private entityToController = new Map<number, number>(); // entity ID → controller handle
  private controllerToEntity = new Map<number, number>(); // controller handle → entity ID
  private controllers: RAPIER.KinematicCharacterController[] = []; // controller instances by handle
  private nextControllerHandle = 0; // Auto-incrementing pseudo-handle

  constructor(gravity: { x: number; y: number; z: number }) {
    this.world = new RAPIER.World(gravity);
  }

  // ============================================================================
  // Public Query API
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
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    solidOnly = true,
  ): RaycastHit3D | null {
    const ray = new RAPIER.Ray(origin, direction.clone().normalize());
    const hit = this.world.castRayAndGetNormal(ray, maxDistance, solidOnly);

    if (!hit) return null;

    const colliderHandle = hit.collider.handle;
    const entityId = this.colliderToEntity.get(colliderHandle);

    if (entityId === undefined) return null;

    const hitPoint = ray.pointAt(hit.timeOfImpact);

    return {
      entityId,
      hitPoint: new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z),
      hitNormal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
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
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    solidOnly = true,
  ): RaycastHit3D[] {
    const ray = new RAPIER.Ray(origin, direction.clone().normalize());
    const hits: RaycastHit3D[] = [];

    this.world.intersectionsWithRay(ray, maxDistance, solidOnly, (hit) => {
      const colliderHandle = hit.collider.handle;
      const entityId = this.colliderToEntity.get(colliderHandle);

      if (entityId !== undefined) {
        const hitPoint = ray.pointAt(hit.timeOfImpact);

        hits.push({
          entityId,
          hitPoint: new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z),
          hitNormal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
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
   * Check if a point intersects any collider.
   *
   * @param point - Point in world space
   * @param solidOnly - If true, ignore sensor colliders
   * @returns Entity ID of first collider at point, or null if none
   */
  pointCast(point: THREE.Vector3, solidOnly = true): number | null {
    let result: number | null = null;

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
   * Directly set the translation (position) of a rigid body.
   *
   * WARNING: Directly changing the position of a rigid-body is equivalent to teleporting it:
   * this is not a physically realistic action! Teleporting a dynamic or kinematic body may
   * result in odd behaviors especially if it teleports into a space occupied by other objects.
   * For dynamic bodies, forces, impulses, or velocity modification should be preferred.
   *
   * @param entityId - Entity with RigidBody3D component
   * @param position - New position in world space
   */
  setTranslation(entityId: number, position: THREE.Vector3): void {
    const bodyHandle = this.entityToBody.get(entityId);
    if (bodyHandle === undefined) {
      console.warn(
        `[Physics3D] Cannot set translation: entity ${entityId} has no physics body`,
      );
      return;
    }

    const body = this.world.getRigidBody(bodyHandle);
    if (!body) {
      console.warn(
        `[Physics3D] Cannot set translation: body handle ${bodyHandle} is invalid`,
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
   * Internal use only - called by physics systems.
   */
  getWorld(): RAPIER.World {
    return this.world;
  }

  /**
   * Register a rigid body handle for an entity.
   * Internal use only - called by component sync system.
   */
  registerBody(entityId: number, bodyHandle: number): void {
    this.entityToBody.set(entityId, bodyHandle);
    this.bodyToEntity.set(bodyHandle, entityId);
  }

  /**
   * Register a collider handle for an entity.
   * Internal use only - called by component sync system.
   */
  registerCollider(entityId: number, colliderHandle: number): void {
    this.colliderToEntity.set(colliderHandle, entityId);
  }

  /**
   * Unregister a rigid body for an entity.
   * Internal use only - called by cleanup system.
   */
  unregisterBody(entityId: number): void {
    const bodyHandle = this.entityToBody.get(entityId);
    if (bodyHandle !== undefined) {
      this.bodyToEntity.delete(bodyHandle);
      this.entityToBody.delete(entityId);
    }
  }

  /**
   * Unregister a collider.
   * Internal use only - called by cleanup system.
   */
  unregisterCollider(colliderHandle: number): void {
    this.colliderToEntity.delete(colliderHandle);
  }

  /**
   * Get body handle for an entity.
   * Internal use only - called by physics systems.
   */
  getBodyHandle(entityId: number): number | undefined {
    return this.entityToBody.get(entityId);
  }

  // ============================================================================
  // Character Controller API (Internal)
  // ============================================================================

  /**
   * Register a character controller for an entity.
   * Internal use only - called by component sync system.
   */
  registerController(
    entityId: number,
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
   * Internal use only - called by cleanup system.
   */
  unregisterController(entityId: number): void {
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
   * Internal use only - called by physics systems.
   */
  getControllerHandle(entityId: number): number | undefined {
    return this.entityToController.get(entityId);
  }

  /**
   * Get character controller by handle.
   * Internal use only - called by physics systems.
   */
  getController(handle: number): RAPIER.KinematicCharacterController | undefined {
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

    console.log('[Physics3D] Disposed all physics resources');
  }
}
