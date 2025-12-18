/**
 * Water 2D Sync System
 *
 * Manages 2D water reflection effects using the Renderer's screen texture.
 * Water materials use the PREVIOUS FRAME's rendered scene for reflections.
 * This 1-frame delay is imperceptible and avoids complex rendering order issues.
 *
 * Architecture:
 * - Renderer provides getScreenTexture() which returns composer.writeBuffer.texture
 * - writeBuffer contains the final rendered output from the previous frame (before swap)
 * - Water2DRenderManager.updateScreenTextures() sets this texture for all water materials
 * - This is called once per frame at the start of water2DSyncSystem
 *
 * Key features:
 * - Works with editor viewports (render targets)
 * - Simple texture-based approach (1-frame delayed reflections)
 * - Size controlled via Transform.scale (like Sprite2D)
 * - Simpler surfacePosition property instead of confusing level
 */

import * as THREE from 'three';
import { system } from '../system.js';
import type { Entity } from '../entity.js';
import type { Renderer } from '../../app/renderer.js';
import { Application } from '../../app/application.js';
import { Transform3D } from '../components/rendering/transform-3d.js';
import { Water2D, type Water2DData } from '../components/rendering/water-2d.js';
import { RenderObject } from '../components/rendering/render-object.js';
import { Water2DMaterial } from '../../rendering/sprite/Water2DMaterial.js';
import { LitWater2DMaterial } from '../../rendering/sprite/LitWater2DMaterial.js';
import { createWaterNoiseTextures } from '../../rendering/noise-texture.js';
import { calculateRenderOrder } from '../components/rendering/sprite-2d.js';

/**
 * Internal water entry tracking a Three.js mesh and its state
 */
interface WaterEntry {
  mesh: THREE.Mesh;
  material: Water2DMaterial | LitWater2DMaterial;
  geometry: THREE.PlaneGeometry;
  lastBaseSize: { x: number; y: number };
  lastScale: { x: number; y: number };
  lastSortingLayer: number;
  lastSortingOrder: number;
  lastIsLit: boolean;
}

/**
 * Water 2D Render Manager
 *
 * Manages the lifecycle of water effect meshes.
 * Water materials use the PREVIOUS FRAME's rendered scene for reflections.
 *
 * The manager provides updateScreenTextures() which must be called once per frame
 * to update all water materials with the latest readBuffer texture from the Renderer.
 *
 * @example
 * ```typescript
 * // Automatically registered by Application, but can be manually created:
 * const waterManager = new Water2DRenderManager(renderer);
 * app.insertResource(waterManager);
 * app.addUpdateSystem(water2DSyncSystem);
 * ```
 */
export class Water2DRenderManager {
  private renderer: Renderer;
  private waters: Map<Entity, WaterEntry> = new Map();
  private nextHandle: number = 1;
  private handleToEntity: Map<number, Entity> = new Map();

  // Shared resources
  private noiseTexture: THREE.DataTexture;
  private noiseTexture2: THREE.DataTexture;

  // Time tracking
  private elapsedTime: number = 0;

  constructor(renderer: Renderer) {
    this.renderer = renderer;

    // Generate noise textures once (shared across all water instances)
    const noises = createWaterNoiseTextures(0);
    this.noiseTexture = noises.distortionNoise;
    this.noiseTexture2 = noises.foamNoise;
  }

  /**
   * Create a water mesh for an entity
   */
  createWater(entity: Entity, waterData: Water2DData): number {
    // Create 1x1 geometry - scale is applied via mesh.scale (like sprites)
    const geometry = new THREE.PlaneGeometry(1, 1);

    // Determine if material should be lit
    const isLit = waterData.isLit ?? false;

    // Create material based on lighting needs
    const material: Water2DMaterial | LitWater2DMaterial = isLit
      ? new LitWater2DMaterial({
          waterColor: new THREE.Vector4(
            waterData.waterColor.r,
            waterData.waterColor.g,
            waterData.waterColor.b,
            waterData.waterColor.a,
          ),
          waterOpacity: waterData.waterOpacity,
          surfacePosition: waterData.surfacePosition,
          waveSpeed: waterData.waveSpeed,
          waveDistortion: waterData.waveDistortion,
          waveMultiplier: waterData.waveMultiplier,
          enableWaterTexture: waterData.enableWaterTexture,
          reflectionOffsetX: waterData.reflectionOffsetX,
          reflectionOffsetY: waterData.reflectionOffsetY,
          wetnessIntensity: waterData.wetnessIntensity,
          wetnessOpacity: waterData.wetnessOpacity,
          wetnessScale: new THREE.Vector2(waterData.wetnessScale.x, waterData.wetnessScale.y),
          wetnessSpeed: waterData.wetnessSpeed,
          wetnessDetailScale: new THREE.Vector2(waterData.wetnessDetailScale.x, waterData.wetnessDetailScale.y),
          wetnessDetailSpeed: waterData.wetnessDetailSpeed,
          wetnessContrast: waterData.wetnessContrast,
          wetnessBrightness: waterData.wetnessBrightness,
          wetnessColorTint: new THREE.Vector3(waterData.wetnessColorTint.r, waterData.wetnessColorTint.g, waterData.wetnessColorTint.b),
          foamSoftness: waterData.foamSoftness,
        })
      : new Water2DMaterial({
          waterColor: new THREE.Vector4(
            waterData.waterColor.r,
            waterData.waterColor.g,
            waterData.waterColor.b,
            waterData.waterColor.a,
          ),
          waterOpacity: waterData.waterOpacity,
          surfacePosition: waterData.surfacePosition,
          waveSpeed: waterData.waveSpeed,
          waveDistortion: waterData.waveDistortion,
          waveMultiplier: waterData.waveMultiplier,
          enableWaterTexture: waterData.enableWaterTexture,
          reflectionOffsetX: waterData.reflectionOffsetX,
          reflectionOffsetY: waterData.reflectionOffsetY,
          wetnessIntensity: waterData.wetnessIntensity,
          wetnessOpacity: waterData.wetnessOpacity,
          wetnessScale: new THREE.Vector2(waterData.wetnessScale.x, waterData.wetnessScale.y),
          wetnessSpeed: waterData.wetnessSpeed,
          wetnessDetailScale: new THREE.Vector2(waterData.wetnessDetailScale.x, waterData.wetnessDetailScale.y),
          wetnessDetailSpeed: waterData.wetnessDetailSpeed,
          wetnessContrast: waterData.wetnessContrast,
          wetnessBrightness: waterData.wetnessBrightness,
          wetnessColorTint: new THREE.Vector3(waterData.wetnessColorTint.r, waterData.wetnessColorTint.g, waterData.wetnessColorTint.b),
          foamSoftness: waterData.foamSoftness,
          foamTurbulence: waterData.foamTurbulence,
          foamAnimationSpeed: waterData.foamAnimationSpeed,
          foamLayerCount: waterData.foamLayerCount,
        });

    // Set noise textures
    material.setNoiseTextures(this.noiseTexture, this.noiseTexture2);

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = waterData.visible;
    mesh.renderOrder = calculateRenderOrder(waterData.sortingLayer, waterData.sortingOrder);

    // Set up onBeforeRender callback for screen texture and bounds calculation
    // Screen texture is obtained from renderer right before render (ensures latest frame)
    const renderer = this.renderer;
    const tempVec3 = new THREE.Vector3();
    const corners = [
      new THREE.Vector3(-0.5, -0.5, 0), // bottom-left
      new THREE.Vector3(0.5, -0.5, 0),  // bottom-right
      new THREE.Vector3(-0.5, 0.5, 0),  // top-left
      new THREE.Vector3(0.5, 0.5, 0),   // top-right
    ];

    // Set up onBeforeRender callback to calculate screen-space bounds
    // Screen texture is set once per frame via updateScreenTextures()
    mesh.onBeforeRender = (_threeRenderer: THREE.WebGLRenderer, _scene: THREE.Scene, camera: THREE.Camera) => {
      // Calculate screen-space bounds of the water mesh
      // Project all 4 corners of the mesh to screen space
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      for (const corner of corners) {
        // Transform corner from local to world space
        tempVec3.copy(corner);
        mesh.localToWorld(tempVec3);

        // Project to NDC
        tempVec3.project(camera);

        // Convert to screen UV (0-1 range)
        const screenX = (tempVec3.x + 1) * 0.5;
        const screenY = (tempVec3.y + 1) * 0.5;

        minX = Math.min(minX, screenX);
        minY = Math.min(minY, screenY);
        maxX = Math.max(maxX, screenX);
        maxY = Math.max(maxY, screenY);
      }

      // Update waterScreenBounds uniform (access material from mesh dynamically)
      const currentMaterial = mesh.material as Water2DMaterial | LitWater2DMaterial;
      currentMaterial.uniforms.waterScreenBounds.value.set(minX, minY, maxX, maxY);
    };

    // Add to scene
    this.renderer.add(mesh);

    // Track entry
    const entry: WaterEntry = {
      mesh,
      material,
      geometry,
      lastBaseSize: { x: waterData.baseSize.x, y: waterData.baseSize.y },
      lastScale: { x: 1, y: 1 },
      lastSortingLayer: waterData.sortingLayer,
      lastSortingOrder: waterData.sortingOrder,
      lastIsLit: isLit,
    };
    this.waters.set(entity, entry);

    // Generate handle
    const handle = this.nextHandle++;
    this.handleToEntity.set(handle, entity);

    return handle;
  }

  /**
   * Update water properties and transform
   */
  updateWater(
    entity: Entity,
    waterData: Water2DData,
    transform: {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      scale: { x: number; y: number };
    },
    deltaTime: number,
  ): void {
    const entry = this.waters.get(entity);
    if (!entry) return;

    const { mesh, material } = entry;

    // Check if lighting mode changed - recreate material if needed
    const isLit = waterData.isLit ?? false;
    const currentIsLit = material instanceof LitWater2DMaterial;

    if (isLit !== currentIsLit) {
      this.recreateMaterial(entity, waterData);
      return; // Material recreated, updateWater will be called again next frame
    }

    // Update elapsed time
    this.elapsedTime += deltaTime;

    // Update transform (position, rotation, scale)
    mesh.position.set(
      transform.position.x,
      transform.position.y,
      transform.position.z,
    );
    mesh.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);

    // Apply baseSize * transform.scale (like Sprite2D)
    mesh.scale.set(
      waterData.baseSize.x * transform.scale.x,
      waterData.baseSize.y * transform.scale.y,
      1,
    );

    // Update visibility
    mesh.visible = waterData.visible;

    // Update render order if changed
    if (
      waterData.sortingLayer !== entry.lastSortingLayer ||
      waterData.sortingOrder !== entry.lastSortingOrder
    ) {
      mesh.renderOrder = calculateRenderOrder(waterData.sortingLayer, waterData.sortingOrder);
      entry.lastSortingLayer = waterData.sortingLayer;
      entry.lastSortingOrder = waterData.sortingOrder;
    }

    // Update shader uniforms
    const { width, height } = this.renderer.getSize();
    material.updateFromData(waterData, this.elapsedTime, { width, height });

    // Note: Screen texture is set in onBeforeRender callback (right before render)

    // Update tracking
    entry.lastBaseSize = { x: waterData.baseSize.x, y: waterData.baseSize.y };
    entry.lastScale = { x: transform.scale.x, y: transform.scale.y };
  }

  /**
   * Recreate water material when isLit property changes
   */
  private recreateMaterial(entity: Entity, waterData: Water2DData): void {
    const entry = this.waters.get(entity);
    if (!entry) return;

    const { mesh } = entry;
    const isLit = waterData.isLit ?? false;

    // Dispose old material
    entry.material.dispose();

    // Create new material
    const newMaterial: Water2DMaterial | LitWater2DMaterial = isLit
      ? new LitWater2DMaterial({
          waterColor: new THREE.Vector4(
            waterData.waterColor.r,
            waterData.waterColor.g,
            waterData.waterColor.b,
            waterData.waterColor.a,
          ),
          waterOpacity: waterData.waterOpacity,
          surfacePosition: waterData.surfacePosition,
          waveSpeed: waterData.waveSpeed,
          waveDistortion: waterData.waveDistortion,
          waveMultiplier: waterData.waveMultiplier,
          enableWaterTexture: waterData.enableWaterTexture,
          reflectionOffsetX: waterData.reflectionOffsetX,
          reflectionOffsetY: waterData.reflectionOffsetY,
          wetnessIntensity: waterData.wetnessIntensity,
          wetnessOpacity: waterData.wetnessOpacity,
          wetnessScale: new THREE.Vector2(waterData.wetnessScale.x, waterData.wetnessScale.y),
          wetnessSpeed: waterData.wetnessSpeed,
          wetnessDetailScale: new THREE.Vector2(waterData.wetnessDetailScale.x, waterData.wetnessDetailScale.y),
          wetnessDetailSpeed: waterData.wetnessDetailSpeed,
          wetnessContrast: waterData.wetnessContrast,
          wetnessBrightness: waterData.wetnessBrightness,
          wetnessColorTint: new THREE.Vector3(waterData.wetnessColorTint.r, waterData.wetnessColorTint.g, waterData.wetnessColorTint.b),
          foamSoftness: waterData.foamSoftness,
        })
      : new Water2DMaterial({
          waterColor: new THREE.Vector4(
            waterData.waterColor.r,
            waterData.waterColor.g,
            waterData.waterColor.b,
            waterData.waterColor.a,
          ),
          waterOpacity: waterData.waterOpacity,
          surfacePosition: waterData.surfacePosition,
          waveSpeed: waterData.waveSpeed,
          waveDistortion: waterData.waveDistortion,
          waveMultiplier: waterData.waveMultiplier,
          enableWaterTexture: waterData.enableWaterTexture,
          reflectionOffsetX: waterData.reflectionOffsetX,
          reflectionOffsetY: waterData.reflectionOffsetY,
          wetnessIntensity: waterData.wetnessIntensity,
          wetnessOpacity: waterData.wetnessOpacity,
          wetnessScale: new THREE.Vector2(waterData.wetnessScale.x, waterData.wetnessScale.y),
          wetnessSpeed: waterData.wetnessSpeed,
          wetnessDetailScale: new THREE.Vector2(waterData.wetnessDetailScale.x, waterData.wetnessDetailScale.y),
          wetnessDetailSpeed: waterData.wetnessDetailSpeed,
          wetnessContrast: waterData.wetnessContrast,
          wetnessBrightness: waterData.wetnessBrightness,
          wetnessColorTint: new THREE.Vector3(waterData.wetnessColorTint.r, waterData.wetnessColorTint.g, waterData.wetnessColorTint.b),
          foamSoftness: waterData.foamSoftness,
          foamTurbulence: waterData.foamTurbulence,
          foamAnimationSpeed: waterData.foamAnimationSpeed,
          foamLayerCount: waterData.foamLayerCount,
        });

    // Set noise textures
    newMaterial.setNoiseTextures(this.noiseTexture, this.noiseTexture2);

    // The existing onBeforeRender callback will work with the new material
    // because it accesses mesh.material dynamically

    // Update mesh
    mesh.material = newMaterial;
    entry.material = newMaterial;
    entry.lastIsLit = isLit;
  }

  /**
   * Remove a water effect for an entity
   */
  removeWater(entity: Entity): void {
    const entry = this.waters.get(entity);
    if (!entry) return;

    // Clear onBeforeRender
    entry.mesh.onBeforeRender = () => {};

    // Remove from scene
    this.renderer.remove(entry.mesh);

    // Dispose resources
    entry.geometry.dispose();
    entry.material.dispose();

    // Remove from tracking
    this.waters.delete(entity);

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
    return this.waters.get(entity)?.mesh ?? null;
  }

  /**
   * Check if entity has a water effect
   */
  hasWater(entity: Entity): boolean {
    return this.waters.has(entity);
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
  getStats(): { waterCount: number } {
    return { waterCount: this.waters.size };
  }

  /**
   * Get all tracked entity IDs (for cleanup checks)
   */
  getTrackedEntities(): Entity[] {
    return Array.from(this.waters.keys());
  }

  /**
   * Update screen texture for all water meshes
   * Call this at the beginning of each frame to set the previous frame's render
   */
  updateScreenTextures(): void {
    const screenTexture = this.renderer.getScreenTexture();

    if (!screenTexture) {
      console.warn('[Water2D] Screen texture is null/undefined');
      return;
    }

    for (const entry of this.waters.values()) {
      entry.material.setScreenTexture(screenTexture);
    }
  }

  /**
   * Dispose all water effects (but NOT shared noise textures)
   *
   * Note: Noise textures are created in constructor and persist for the lifetime
   * of the manager. They should not be disposed during play mode cleanup, only
   * when the manager itself is destroyed.
   */
  dispose(): void {
    // Remove all waters (disposes individual meshes, materials, geometries)
    for (const [entity] of this.waters) {
      this.removeWater(entity);
    }

    // Reset elapsed time so animations start fresh on next play
    this.elapsedTime = 0;

    // Note: DO NOT dispose noiseTexture and noiseTexture2 here!
    // They are shared resources created in the constructor and reused
    // across play/stop cycles. Disposing them would break water on next play.
  }
}

/**
 * Water 2D sync system
 *
 * Runs in update phase to:
 * 0. Update screen textures for all water materials (previous frame's render)
 * 1. Create water meshes for new entities
 * 2. Update existing water meshes with transform and properties
 * 3. Remove water meshes for deleted entities
 *
 * Screen texture is set once per frame from Renderer.getScreenTexture()
 * which returns the previous frame's final rendered output (1-frame delay).
 */
export const water2DSyncSystem = system(({ commands }) => {
  const waterManager = commands.getResource(Water2DRenderManager);
  if (!waterManager) return;

  // Get delta time from application
  const app = Application.exists() ? Application.get() : null;
  const deltaTime = app?.getDeltaTime() ?? 0;

  // 0. Update screen textures for all water meshes (use previous frame's render)
  waterManager.updateScreenTextures();

  // 1. Create water for new Water2D entities (have Water2D + Transform3D but no RenderObject)
  commands
    .query()
    .all(Transform3D, Water2D)
    .none(RenderObject)
    .each((entity, _transform, water) => {
      const handle = waterManager.createWater(entity, water);
      commands.entity(entity).addComponent(RenderObject, { handle });
    });

  // 2. Update existing water effects (with full transform including scale and rotation)
  commands
    .query()
    .all(Transform3D, Water2D, RenderObject)
    .each((entity, transform, water) => {
      waterManager.updateWater(entity, water, {
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
      }, deltaTime);
    });

  // 3. Remove water for entities that lost their Water2D component
  // (have RenderObject but no Water2D)
  commands
    .query()
    .all(RenderObject)
    .none(Water2D)
    .each((entity) => {
      if (waterManager.hasWater(entity)) {
        waterManager.removeWater(entity);
      }
    });

  // 4. Clean up water for entities that were destroyed
  // (entity no longer exists in world but water still tracked)
  for (const entity of waterManager.getTrackedEntities()) {
    if (!commands.isAlive(entity)) {
      waterManager.removeWater(entity);
    }
  }
});
