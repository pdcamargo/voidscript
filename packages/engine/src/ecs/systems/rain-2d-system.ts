/**
 * Rain 2D Sync System
 *
 * Manages 2D rain effect rendering with pixel-art droplets.
 *
 * Architecture:
 * - Rain2DRenderManager tracks mesh lifecycle (create, update, remove)
 * - rain2DSyncSystem queries entities and delegates to manager
 * - Lightning timing is managed per-entity in the manager
 *
 * Key features:
 * - World-space tiling to prevent stretching on large areas
 * - Multi-layer depth rendering
 * - Procedural lightning flash with random intervals
 * - Editor boundary helper visualization (handled by EditorLayer)
 */

import * as THREE from 'three';
import { system } from '@voidscript/core';
import type { Entity } from '@voidscript/core';
import type { Renderer } from '../../app/renderer.js';
import { Application } from '../../app/application.js';
import { Transform3D } from '../components/rendering/transform-3d.js';
import { Rain2D, type Rain2DData } from '../components/rendering/rain-2d.js';
import { RenderObject } from '../components/rendering/render-object.js';
import { Rain2DMaterial } from '../../rendering/rain/Rain2DMaterial.js';
import { calculateRenderOrder } from '../components/rendering/sprite-2d.js';

/**
 * Internal rain entry tracking a Three.js mesh and its state
 */
interface RainEntry {
  mesh: THREE.Mesh;
  material: Rain2DMaterial;
  geometry: THREE.PlaneGeometry;
  lastBaseSize: { x: number; y: number };
  lastScale: { x: number; y: number };
  lastSortingLayer: number;
  lastSortingOrder: number;
  // Lightning state
  lightningTimer: number;
  nextLightningTime: number;
  lightningFlashRemaining: number;
}

/**
 * Rain 2D Render Manager
 *
 * Manages the lifecycle of rain effect meshes.
 *
 * @example
 * ```typescript
 * // Automatically registered by Application, but can be manually created:
 * const rainManager = new Rain2DRenderManager(renderer);
 * app.insertResource(rainManager);
 * app.addRenderSystem(rain2DSyncSystem);
 * ```
 */
export class Rain2DRenderManager {
  private renderer: Renderer;
  private rains: Map<Entity, RainEntry> = new Map();
  private nextHandle: number = 1;
  private handleToEntity: Map<number, Entity> = new Map();

  // Time tracking
  private elapsedTime: number = 0;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  /**
   * Create a rain mesh for an entity
   */
  createRain(entity: Entity, rainData: Rain2DData): number {
    // Create 1x1 geometry - scale is applied via mesh.scale (like sprites)
    const geometry = new THREE.PlaneGeometry(1, 1);

    // Create material
    const material = new Rain2DMaterial({
      density: rainData.density,
      fallSpeed: rainData.fallSpeed,
      speedVariation: rainData.speedVariation,
      angle: rainData.angle,
      windStrength: rainData.windStrength,
      windSpeed: rainData.windSpeed,
      dropletMinLength: rainData.dropletMinLength,
      dropletMaxLength: rainData.dropletMaxLength,
      dropletWidth: rainData.dropletWidth,
      seed: rainData.seed,
      dropletColor: new THREE.Vector3(
        rainData.dropletColor.r,
        rainData.dropletColor.g,
        rainData.dropletColor.b,
      ),
      dropletOpacity: rainData.dropletOpacity,
      enableLayers: rainData.enableLayers,
      nearLayerSpeed: rainData.nearLayerSpeed,
      nearLayerOpacity: rainData.nearLayerOpacity,
      nearLayerScale: rainData.nearLayerScale,
      midLayerSpeed: rainData.midLayerSpeed,
      midLayerOpacity: rainData.midLayerOpacity,
      midLayerScale: rainData.midLayerScale,
      farLayerSpeed: rainData.farLayerSpeed,
      farLayerOpacity: rainData.farLayerOpacity,
      farLayerScale: rainData.farLayerScale,
      enableWetnessTint: rainData.enableWetnessTint,
      wetnessTintColor: new THREE.Vector3(
        rainData.wetnessTintColor.r,
        rainData.wetnessTintColor.g,
        rainData.wetnessTintColor.b,
      ),
      wetnessTintIntensity: rainData.wetnessTintIntensity,
      enableLightning: rainData.enableLightning,
      lightningColor: new THREE.Vector3(
        rainData.lightningColor.r,
        rainData.lightningColor.g,
        rainData.lightningColor.b,
      ),
      lightningIntensity: rainData.lightningIntensity,
      stormIntensity: rainData.stormIntensity,
    });

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = rainData.visible;
    mesh.renderOrder = calculateRenderOrder(
      rainData.sortingLayer,
      rainData.sortingOrder,
    );

    // Add to scene
    this.renderer.add(mesh);

    // Calculate initial next lightning time
    const nextLightningTime = rainData.enableLightning
      ? rainData.lightningMinInterval +
        Math.random() *
          (rainData.lightningMaxInterval - rainData.lightningMinInterval)
      : Infinity;

    // Track entry
    const entry: RainEntry = {
      mesh,
      material,
      geometry,
      lastBaseSize: { x: rainData.baseSize.x, y: rainData.baseSize.y },
      lastScale: { x: 1, y: 1 },
      lastSortingLayer: rainData.sortingLayer,
      lastSortingOrder: rainData.sortingOrder,
      lightningTimer: 0,
      nextLightningTime,
      lightningFlashRemaining: 0,
    };
    this.rains.set(entity, entry);

    // Generate handle
    const handle = this.nextHandle++;
    this.handleToEntity.set(handle, entity);

    return handle;
  }

  /**
   * Update rain properties and transform
   */
  updateRain(
    entity: Entity,
    rainData: Rain2DData,
    transform: {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      scale: { x: number; y: number };
    },
    deltaTime: number,
  ): void {
    const entry = this.rains.get(entity);
    if (!entry) return;

    const { mesh, material } = entry;

    // Update elapsed time
    this.elapsedTime += deltaTime;

    // Update transform (position, rotation, scale)
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

    // Apply baseSize * transform.scale (like Sprite2D)
    mesh.scale.set(
      rainData.baseSize.x * transform.scale.x,
      rainData.baseSize.y * transform.scale.y,
      1,
    );

    // Update visibility
    mesh.visible = rainData.visible;

    // Update render order if changed
    if (
      rainData.sortingLayer !== entry.lastSortingLayer ||
      rainData.sortingOrder !== entry.lastSortingOrder
    ) {
      mesh.renderOrder = calculateRenderOrder(
        rainData.sortingLayer,
        rainData.sortingOrder,
      );
      entry.lastSortingLayer = rainData.sortingLayer;
      entry.lastSortingOrder = rainData.sortingOrder;
    }

    // === Lightning timing logic ===
    if (rainData.enableLightning) {
      entry.lightningTimer += deltaTime;

      // Trigger new lightning
      if (entry.lightningTimer >= entry.nextLightningTime) {
        entry.lightningFlashRemaining = rainData.lightningDuration;
        entry.lightningTimer = 0;
        // Schedule next strike with random interval
        entry.nextLightningTime =
          rainData.lightningMinInterval +
          Math.random() *
            (rainData.lightningMaxInterval - rainData.lightningMinInterval);
      }

      // Update flash decay
      if (entry.lightningFlashRemaining > 0) {
        entry.lightningFlashRemaining -= deltaTime;
        if (entry.lightningFlashRemaining < 0) {
          entry.lightningFlashRemaining = 0;
        }
      }

      // Calculate flash intensity with quadratic falloff for natural flash decay
      const flashProgress =
        entry.lightningFlashRemaining / rainData.lightningDuration;
      const flashIntensity = Math.max(0, flashProgress * flashProgress);
      material.setLightningFlash(flashIntensity);
    } else {
      material.setLightningFlash(0);
      entry.lightningTimer = 0;
      entry.lightningFlashRemaining = 0;
    }

    // Calculate world scale for texture tiling (baseSize * transform.scale)
    const worldScale = {
      x: rainData.baseSize.x * transform.scale.x,
      y: rainData.baseSize.y * transform.scale.y,
    };

    // Update shader uniforms
    material.updateFromData(rainData, this.elapsedTime, worldScale);

    // Update tracking
    entry.lastBaseSize = { x: rainData.baseSize.x, y: rainData.baseSize.y };
    entry.lastScale = { x: transform.scale.x, y: transform.scale.y };
  }

  /**
   * Remove a rain effect for an entity
   */
  removeRain(entity: Entity): void {
    const entry = this.rains.get(entity);
    if (!entry) return;

    // Remove from scene
    this.renderer.remove(entry.mesh);

    // Dispose resources
    entry.geometry.dispose();
    entry.material.dispose();

    // Remove from tracking
    this.rains.delete(entity);

    // Clean up handle mapping
    for (const [handle, ent] of this.handleToEntity.entries()) {
      if (ent === entity) {
        this.handleToEntity.delete(handle);
        break;
      }
    }
  }

  /**
   * Get the Three.js mesh for an entity
   */
  getMesh(entity: Entity): THREE.Mesh | null {
    return this.rains.get(entity)?.mesh ?? null;
  }

  /**
   * Check if entity has a rain effect
   */
  hasRain(entity: Entity): boolean {
    return this.rains.has(entity);
  }

  /**
   * Get entity from handle
   */
  getEntityFromHandle(handle: number): Entity | null {
    return this.handleToEntity.get(handle) ?? null;
  }

  /**
   * Get statistics
   */
  getStats(): { rainCount: number } {
    return { rainCount: this.rains.size };
  }

  /**
   * Get all tracked entity IDs (for cleanup checks)
   */
  getTrackedEntities(): Entity[] {
    return Array.from(this.rains.keys());
  }

  /**
   * Dispose all rain effects
   *
   * Called during play mode cleanup.
   */
  dispose(): void {
    // Remove all rains (disposes individual meshes, materials, geometries)
    for (const [entity] of this.rains) {
      this.removeRain(entity);
    }

    // Reset elapsed time so animations start fresh on next play
    this.elapsedTime = 0;
  }
}

/**
 * Rain 2D sync system
 *
 * Runs in render phase to:
 * 1. Create rain meshes for new entities
 * 2. Update existing rain meshes with transform and properties
 * 3. Remove rain meshes for deleted entities
 */
export const rain2DSyncSystem = system(({ commands }) => {
  const rainManager = commands.getResource(Rain2DRenderManager);
  if (!rainManager) return;

  // Get delta time from application
  const app = Application.exists() ? Application.get() : null;
  const deltaTime = app?.getDeltaTime() ?? 0;

  // 1. Create rain for new Rain2D entities (have Rain2D + Transform3D but no RenderObject)
  commands
    .query()
    .all(Transform3D, Rain2D)
    .none(RenderObject)
    .each((entity, _transform, rain) => {
      const handle = rainManager.createRain(entity, rain);
      commands.entity(entity).addComponent(RenderObject, { handle });
    });

  // 2. Update existing rain effects (with full transform including scale and rotation)
  commands
    .query()
    .all(Transform3D, Rain2D, RenderObject)
    .each((entity, transform, rain) => {
      rainManager.updateRain(
        entity,
        rain,
        {
          position: {
            x: transform.position.x,
            y: transform.position.y,
            z: transform.position.z,
          },
          rotation: {
            x: transform.rotation.x,
            y: transform.rotation.y,
            z: transform.rotation.z,
          },
          scale: {
            x: transform.scale.x,
            y: transform.scale.y,
          },
        },
        deltaTime,
      );
    });

  // 3. Remove rain for entities that lost their Rain2D component
  // (have RenderObject but no Rain2D)
  commands
    .query()
    .all(RenderObject)
    .none(Rain2D)
    .each((entity) => {
      if (rainManager.hasRain(entity)) {
        rainManager.removeRain(entity);
      }
    });

  // 4. Clean up rain for entities that were destroyed
  // (entity no longer exists in world but rain still tracked)
  for (const entity of rainManager.getTrackedEntities()) {
    if (!commands.isAlive(entity)) {
      rainManager.removeRain(entity);
    }
  }
});
