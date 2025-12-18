/**
 * Fog 2D Sync System
 *
 * Manages 2D fog layers with pixelated appearance and vertical gradients.
 * Supports three fog types: smooth, hard, and limited (banded).
 *
 * Architecture:
 * - Each fog is a 1x1 PlaneGeometry scaled via Transform3D
 * - Pixelation and gradient are calculated in fragment shader
 * - Supports both lit and unlit materials
 */

import * as THREE from 'three';
import { system } from '../../system.js';
import type { Entity } from '../../entity.js';
import type { Renderer } from '../../../app/renderer.js';
import { Transform3D } from '../../components/rendering/transform-3d.js';
import { Fog2D, type Fog2DData } from '../../components/rendering/fog-2d.js';
import { RenderObject } from '../../components/rendering/render-object.js';
import { Fog2DMaterial } from '../../../rendering/fog/Fog2DMaterial.js';
import { LitFog2DMaterial } from '../../../rendering/fog/LitFog2DMaterial.js';
import { calculateRenderOrder } from '../../components/rendering/sprite-2d.js';

/**
 * Internal fog entry tracking a Three.js mesh and its state
 */
interface FogEntry {
  mesh: THREE.Mesh;
  material: Fog2DMaterial | LitFog2DMaterial;
  geometry: THREE.PlaneGeometry;
  lastBaseSize: { x: number; y: number };
  lastScale: { x: number; y: number };
  lastPixelResolution: { x: number; y: number };
  lastSortingLayer: number;
  lastSortingOrder: number;
  lastIsLit: boolean;
}

/**
 * Fog 2D Render Manager
 *
 * Manages the lifecycle of fog effect meshes.
 * Creates pixelated fog layers with vertical gradients.
 *
 * @example
 * ```typescript
 * // Automatically registered by Application, but can be manually created:
 * const fogManager = new Fog2DRenderManager(renderer);
 * app.insertResource(fogManager);
 * app.addRenderSystem(fog2DSyncSystem);
 * ```
 */
export class Fog2DRenderManager {
  private renderer: Renderer;
  private fogs: Map<Entity, FogEntry> = new Map();
  private nextHandle: number = 1;
  private handleToEntity: Map<number, Entity> = new Map();
  private elapsedTime: number = 0;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  /**
   * Create a fog mesh for an entity
   */
  createFog(
    entity: Entity,
    fogData: Fog2DData,
    transform: {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      scale: { x: number; y: number };
    },
  ): number {
    // Create 1x1 geometry - scale is applied via mesh.scale (like sprites)
    const geometry = new THREE.PlaneGeometry(1, 1);

    // Determine if material should be lit
    const isLit = fogData.isLit ?? false;

    // Create material based on lighting needs
    const material: Fog2DMaterial | LitFog2DMaterial = isLit
      ? new LitFog2DMaterial()
      : new Fog2DMaterial();

    // Update material with initial data
    material.updateFromData(fogData, this.elapsedTime);

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = fogData.visible;
    mesh.renderOrder = calculateRenderOrder(
      fogData.sortingLayer,
      fogData.sortingOrder,
    );

    // Set initial transform
    mesh.position.set(
      transform.position.x,
      transform.position.y,
      transform.position.z,
    );
    mesh.rotation.set(
      transform.rotation.x,
      transform.rotation.y,
      transform.rotation.z,
    );
    mesh.scale.set(
      fogData.baseSize.x * transform.scale.x,
      fogData.baseSize.y * transform.scale.y,
      1,
    );

    // Add to scene
    this.renderer.add(mesh);

    // Track entry
    const entry: FogEntry = {
      mesh,
      material,
      geometry,
      lastBaseSize: { x: fogData.baseSize.x, y: fogData.baseSize.y },
      lastScale: { x: 1, y: 1 },
      lastPixelResolution: {
        x: fogData.pixelResolution.x,
        y: fogData.pixelResolution.y,
      },
      lastSortingLayer: fogData.sortingLayer,
      lastSortingOrder: fogData.sortingOrder,
      lastIsLit: isLit,
    };
    this.fogs.set(entity, entry);

    // Generate handle
    const handle = this.nextHandle++;
    this.handleToEntity.set(handle, entity);

    return handle;
  }

  /**
   * Update fog properties and transform
   */
  updateFog(
    entity: Entity,
    fogData: Fog2DData,
    transform: {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      scale: { x: number; y: number };
    },
  ): void {
    const entry = this.fogs.get(entity);
    if (!entry) return;

    const { mesh, material } = entry;

    // Check if lighting mode changed - recreate material if needed
    const isLit = fogData.isLit ?? false;
    const currentIsLit = material instanceof LitFog2DMaterial;

    if (isLit !== currentIsLit) {
      // Dispose old material
      material.dispose();

      // Create new material with correct lighting
      const newMaterial: Fog2DMaterial | LitFog2DMaterial = isLit
        ? new LitFog2DMaterial()
        : new Fog2DMaterial();

      // Update with current data
      newMaterial.updateFromData(fogData, this.elapsedTime);

      // Update mesh material
      mesh.material = newMaterial;
      entry.material = newMaterial;
      entry.lastIsLit = isLit;
    }

    // Update transform
    mesh.position.set(
      transform.position.x,
      transform.position.y,
      transform.position.z,
    );
    mesh.rotation.set(
      transform.rotation.x,
      transform.rotation.y,
      transform.rotation.z,
    );

    // Update visibility
    mesh.visible = fogData.visible;

    // Update scale if baseSize or transform scale changed
    const scaleChanged =
      entry.lastBaseSize.x !== fogData.baseSize.x ||
      entry.lastBaseSize.y !== fogData.baseSize.y ||
      entry.lastScale.x !== transform.scale.x ||
      entry.lastScale.y !== transform.scale.y;

    if (scaleChanged) {
      mesh.scale.set(
        fogData.baseSize.x * transform.scale.x,
        fogData.baseSize.y * transform.scale.y,
        1,
      );
      entry.lastBaseSize = { x: fogData.baseSize.x, y: fogData.baseSize.y };
      entry.lastScale = { x: transform.scale.x, y: transform.scale.y };
    }

    // Update pixel resolution if changed
    if (
      entry.lastPixelResolution.x !== fogData.pixelResolution.x ||
      entry.lastPixelResolution.y !== fogData.pixelResolution.y
    ) {
      entry.lastPixelResolution = {
        x: fogData.pixelResolution.x,
        y: fogData.pixelResolution.y,
      };
    }

    // Update render order if sorting changed
    if (
      entry.lastSortingLayer !== fogData.sortingLayer ||
      entry.lastSortingOrder !== fogData.sortingOrder
    ) {
      mesh.renderOrder = calculateRenderOrder(
        fogData.sortingLayer,
        fogData.sortingOrder,
      );
      entry.lastSortingLayer = fogData.sortingLayer;
      entry.lastSortingOrder = fogData.sortingOrder;
    }

    // Update material uniforms
    entry.material.updateFromData(fogData, this.elapsedTime);
  }

  /**
   * Remove a fog mesh
   */
  removeFog(entity: Entity): void {
    const entry = this.fogs.get(entity);
    if (!entry) return;

    // Remove from scene
    this.renderer.remove(entry.mesh);

    // Dispose resources
    entry.geometry.dispose();
    entry.material.dispose();

    // Remove from tracking
    this.fogs.delete(entity);

    // Remove handle mapping
    for (const [handle, ent] of this.handleToEntity) {
      if (ent === entity) {
        this.handleToEntity.delete(handle);
        break;
      }
    }
  }

  /**
   * Check if an entity has a fog
   */
  hasFog(entity: Entity): boolean {
    return this.fogs.has(entity);
  }

  /**
   * Get all tracked entities
   */
  *entries(): IterableIterator<[Entity, FogEntry]> {
    yield* this.fogs.entries();
  }

  /**
   * Update elapsed time (called each frame)
   */
  updateTime(deltaTime: number): void {
    this.elapsedTime += deltaTime;
  }

  /**
   * Dispose all fogs (called during play mode cleanup)
   */
  dispose(): void {
    // Remove all fogs
    for (const [entity] of this.entries()) {
      this.removeFog(entity);
    }

    // Reset elapsed time
    this.elapsedTime = 0;
  }
}

/**
 * Fog 2D Sync System
 *
 * Synchronizes Fog2D components with Three.js fog meshes.
 * Runs in the render phase (after update systems).
 */
export const fog2DSyncSystem = system(({ commands }) => {
  const fogManager = commands.getResource(Fog2DRenderManager);
  const deltaTime = commands.getDeltaTime();

  // Update elapsed time
  fogManager.updateTime(deltaTime);

  // Step 1: Create new fogs
  commands
    .query()
    .all(Transform3D, Fog2D)
    .none(RenderObject)
    .each((entity, transform, fog) => {
      const handle = fogManager.createFog(entity, fog, transform);
      commands.entity(entity).addComponent(RenderObject, { handle });
    });

  // Step 2: Update existing fogs
  commands
    .query()
    .all(Transform3D, Fog2D, RenderObject)
    .each((entity, transform, fog) => {
      fogManager.updateFog(entity, fog, transform);
    });

  // Step 3: Remove fogs that lost their Fog2D component
  commands
    .query()
    .all(RenderObject)
    .none(Fog2D)
    .each((entity) => {
      if (fogManager.hasFog(entity)) {
        fogManager.removeFog(entity);
      }
    });

  // Step 4: Cleanup orphaned fogs
  const trackedEntities = new Set<number>();
  for (const [entity] of fogManager.entries()) {
    trackedEntities.add(entity);
  }

  for (const entity of trackedEntities) {
    const hasFog2D = commands.hasComponent(entity, Fog2D);
    if (!hasFog2D) {
      fogManager.removeFog(entity);
    }
  }
});
