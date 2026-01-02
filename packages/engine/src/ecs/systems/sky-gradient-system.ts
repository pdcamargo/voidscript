/**
 * Sky Gradient System
 *
 * Manages vertical gradient backgrounds for 2D scenes.
 * Creates and updates mesh-based sky gradients with automatic texture generation.
 *
 * Features:
 * - Dynamic gradient generation from color stops
 * - Pixel-art friendly (nearest-neighbor filtering)
 * - Efficient texture updates (only when dirty flag is true)
 * - Full ECS integration
 */

import * as THREE from 'three';
import { system } from '@voidscript/core';
import type { Entity } from '@voidscript/core';
import type { Renderer } from '../../app/renderer.js';
import { Transform3D } from '../components/rendering/transform-3d.js';
import { SkyGradient2D, type SkyGradient2DData, type GradientStop } from '../components/rendering/sky-gradient.js';
import { RenderObject } from '../components/rendering/render-object.js';
import { calculateRenderOrder } from '../components/rendering/sprite-2d.js';
import { SkyGradientMaterial } from '../../rendering/sky/SkyGradientMaterial.js';
import { LitSkyGradientMaterial } from '../../rendering/sky/LitSkyGradientMaterial.js';
import { updateSkyGradientUniforms } from '../../rendering/sky/sky-gradient-shader-utils.js';

/**
 * Internal sky entry tracking a Three.js mesh and its state
 */
interface SkyEntry {
  mesh: THREE.Mesh;
  material: SkyGradientMaterial | LitSkyGradientMaterial;
  geometry: THREE.PlaneGeometry;
  texture: THREE.DataTexture;
  lastSortingLayer: number;
  lastSortingOrder: number;
  lastIsLit: boolean;
}

/**
 * Sky Gradient Render Manager
 *
 * Manages the lifecycle of sky gradient meshes.
 * Register as a resource with your Application.
 *
 * @example
 * ```typescript
 * // Automatically registered by Application, but can be manually created:
 * const skyManager = new SkyGradientRenderManager(renderer);
 * app.insertResource(skyManager);
 * app.addRenderSystem(skyGradientSystem);
 * ```
 */
export class SkyGradientRenderManager {
  private renderer: Renderer;
  private skies: Map<Entity, SkyEntry> = new Map();
  private nextHandle: number = 1;
  private handleToEntity: Map<number, Entity> = new Map();

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  /**
   * Interpolate between gradient stops at position t (0-1)
   */
  private interpolateGradient(
    stops: GradientStop[],
    t: number,
  ): { r: number; g: number; b: number; a: number } {
    if (stops.length === 0) {
      return { r: 0, g: 0, b: 0, a: 1 };
    }
    if (stops.length === 1) {
      return { ...stops[0]!.color };
    }

    // Clamp t to 0-1
    t = Math.max(0, Math.min(1, t));

    // Sort stops by position
    const sortedStops = [...stops].sort((a, b) => a.position - b.position);

    // Find the two stops to interpolate between
    let lowerStop = sortedStops[0]!;
    let upperStop = sortedStops[sortedStops.length - 1]!;

    for (let i = 0; i < sortedStops.length - 1; i++) {
      if (t >= sortedStops[i]!.position && t <= sortedStops[i + 1]!.position) {
        lowerStop = sortedStops[i]!;
        upperStop = sortedStops[i + 1]!;
        break;
      }
    }

    // Calculate interpolation factor between the two stops
    const range = upperStop.position - lowerStop.position;
    const factor = range === 0 ? 0 : (t - lowerStop.position) / range;

    // Linear interpolation between colors
    return {
      r: lowerStop.color.r + (upperStop.color.r - lowerStop.color.r) * factor,
      g: lowerStop.color.g + (upperStop.color.g - lowerStop.color.g) * factor,
      b: lowerStop.color.b + (upperStop.color.b - lowerStop.color.b) * factor,
      a: lowerStop.color.a + (upperStop.color.a - lowerStop.color.a) * factor,
    };
  }

  /**
   * Generate a gradient texture for the sky
   */
  private generateSkyGradientTexture(
    width: number,
    height: number,
    stops: GradientStop[],
  ): THREE.DataTexture {
    const data = new Uint8Array(width * height * 4);

    // For each row (y), interpolate between gradient stops
    for (let y = 0; y < height; y++) {
      const t = y / (height - 1); // 0 at bottom, 1 at top
      const color = this.interpolateGradient(stops, t);

      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        data[index] = Math.floor(color.r * 255);
        data[index + 1] = Math.floor(color.g * 255);
        data[index + 2] = Math.floor(color.b * 255);
        data[index + 3] = Math.floor(color.a * 255);
      }
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.magFilter = THREE.NearestFilter; // Pixel art - no smoothing
    texture.minFilter = THREE.NearestFilter;
    texture.flipY = false; // DataTexture - don't flip Y axis
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Create a sky gradient for an entity
   */
  createSky(
    entity: Entity,
    skyData: SkyGradient2DData,
    transform: { scale: { x: number; y: number } }
  ): number {
    // Generate initial gradient texture
    const texture = this.generateSkyGradientTexture(1, skyData.height, skyData.stops);

    // Create custom shader material with star support
    const materialOptions = {
      enableStars: skyData.enableStars,
      starCount: skyData.starCount,
      starMinSize: skyData.starMinSize,
      starMaxSize: skyData.starMaxSize,
      starHeightRange: skyData.starHeightRange,
      starSeed: skyData.starSeed,
      flickerSpeed: skyData.flickerSpeed,
      flickerIntensity: skyData.flickerIntensity,
      skyResolution: new THREE.Vector2(transform.scale.x, transform.scale.y),
    };

    const material = skyData.isLit
      ? new LitSkyGradientMaterial(texture, materialOptions)
      : new SkyGradientMaterial(texture, materialOptions);

    // Create geometry (1x1 quad, will be scaled by transform)
    const geometry = new THREE.PlaneGeometry(1, 1);

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = skyData.visible;
    mesh.renderOrder = calculateRenderOrder(skyData.sortingLayer, skyData.sortingOrder);

    // Add to scene
    this.renderer.add(mesh);

    // Track entry
    const entry: SkyEntry = {
      mesh,
      material,
      geometry,
      texture,
      lastSortingLayer: skyData.sortingLayer,
      lastSortingOrder: skyData.sortingOrder,
      lastIsLit: skyData.isLit,
    };
    this.skies.set(entity, entry);

    // Generate handle
    const handle = this.nextHandle++;
    this.handleToEntity.set(handle, entity);

    return handle;
  }

  /**
   * Update sky properties and transform
   */
  updateSky(
    entity: Entity,
    skyData: SkyGradient2DData,
    transform: { position: { x: number; y: number; z: number }; scale: { x: number; y: number } },
    time: number,
  ): void {
    const entry = this.skies.get(entity);
    if (!entry) return;

    let { mesh, material, texture } = entry;

    // Update transform
    mesh.position.set(transform.position.x, transform.position.y, transform.position.z);
    mesh.scale.set(transform.scale.x, transform.scale.y, 1);

    // Update visibility
    mesh.visible = skyData.visible;

    // Update render order if changed
    if (
      skyData.sortingLayer !== entry.lastSortingLayer ||
      skyData.sortingOrder !== entry.lastSortingOrder
    ) {
      mesh.renderOrder = calculateRenderOrder(skyData.sortingLayer, skyData.sortingOrder);
      entry.lastSortingLayer = skyData.sortingLayer;
      entry.lastSortingOrder = skyData.sortingOrder;
    }

    // Check if material type needs to change (isLit changed)
    if (skyData.isLit !== entry.lastIsLit) {
      // Dispose old material
      material.dispose();

      // Create new material with star parameters
      const materialOptions = {
        enableStars: skyData.enableStars,
        starCount: skyData.starCount,
        starMinSize: skyData.starMinSize,
        starMaxSize: skyData.starMaxSize,
        starHeightRange: skyData.starHeightRange,
        starSeed: skyData.starSeed,
        flickerSpeed: skyData.flickerSpeed,
        flickerIntensity: skyData.flickerIntensity,
        skyResolution: new THREE.Vector2(transform.scale.x, transform.scale.y),
      };

      const newMaterial = skyData.isLit
        ? new LitSkyGradientMaterial(texture, materialOptions)
        : new SkyGradientMaterial(texture, materialOptions);

      // Update mesh with new material
      mesh.material = newMaterial;
      entry.material = newMaterial;
      entry.lastIsLit = skyData.isLit;
      material = newMaterial;
    }

    // Update shader uniforms (for star animation and parameters)
    // Use actual world-space dimensions for proper star distribution
    const resolution = new THREE.Vector2(
      transform.scale.x,
      transform.scale.y
    );
    updateSkyGradientUniforms(
      material.uniforms,
      {
        enableStars: skyData.enableStars,
        starCount: skyData.starCount,
        starMinSize: skyData.starMinSize,
        starMaxSize: skyData.starMaxSize,
        starHeightRange: skyData.starHeightRange,
        starSeed: skyData.starSeed,
        flickerSpeed: skyData.flickerSpeed,
        flickerIntensity: skyData.flickerIntensity,
      },
      time,
      resolution
    );

    // Regenerate texture if dirty (gradient changed, not stars)
    if (skyData.dirty) {
      // Dispose old texture
      texture.dispose();

      // Generate new texture
      const newTexture = this.generateSkyGradientTexture(1, skyData.height, skyData.stops);
      entry.texture = newTexture;
      material.uniforms['gradientTexture']!.value = newTexture;

      // Clear dirty flag (will be modified in the component)
      // Note: We can't directly modify the component here, system will clear it
    }
  }

  /**
   * Remove a sky gradient for an entity
   */
  removeSky(entity: Entity): void {
    const entry = this.skies.get(entity);
    if (!entry) return;

    // Remove from scene
    this.renderer.remove(entry.mesh);

    // Dispose resources
    entry.geometry.dispose();
    entry.material.dispose();
    entry.texture.dispose();

    // Remove from tracking
    this.skies.delete(entity);

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
    return this.skies.get(entity)?.mesh ?? null;
  }

  /**
   * Check if entity has a sky gradient
   */
  hasSky(entity: Entity): boolean {
    return this.skies.has(entity);
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
  getStats(): { skyCount: number } {
    return { skyCount: this.skies.size };
  }

  /**
   * Get all tracked entity IDs (for cleanup checks)
   */
  getTrackedEntities(): Entity[] {
    return Array.from(this.skies.keys());
  }

  /**
   * Dispose all sky gradients
   */
  dispose(): void {
    for (const [entity] of this.skies) {
      this.removeSky(entity);
    }
  }
}

/**
 * Sky Gradient 2D System
 *
 * Gets SkyGradientRenderManager from resources automatically.
 * Registered by Application.addBuiltInSystems().
 *
 * Creates and updates mesh-based sky gradients from SkyGradient2D components.
 *
 * @example
 * ```typescript
 * // Automatically registered, but can be manually added:
 * app.insertResource(new SkyGradientRenderManager(renderer));
 * app.addRenderSystem(skyGradient2DSystem);
 * ```
 */
export const skyGradient2DSystem = system(({ commands }) => {
  const skyManager = commands.getResource(SkyGradientRenderManager);
  const time = commands.getElapsedTime();

  // 1. Create sky for new SkyGradient2D entities (have SkyGradient2D + Transform3D but no RenderObject)
  commands
    .query()
    .all(Transform3D, SkyGradient2D)
    .none(RenderObject)
    .each((entity, transform, sky) => {
      const handle = skyManager.createSky(entity, sky, transform);
      commands.entity(entity).addComponent(RenderObject, { handle });
    });

  // 2. Update existing skies
  commands
    .query()
    .all(Transform3D, SkyGradient2D, RenderObject)
    .each((entity, transform, sky) => {
      skyManager.updateSky(entity, sky, {
        position: {
          x: transform.position.x,
          y: transform.position.y,
          z: transform.position.z,
        },
        scale: { x: transform.scale.x, y: transform.scale.y },
      }, time);

      // Clear dirty flag after update
      if (sky.dirty) {
        commands.entity(entity).addComponent(SkyGradient2D, { ...sky, dirty: false });
      }
    });

  // 3. Remove skies for entities that lost their SkyGradient2D component
  // (have RenderObject but no SkyGradient2D)
  commands
    .query()
    .all(RenderObject)
    .none(SkyGradient2D)
    .each((entity) => {
      if (skyManager.hasSky(entity)) {
        skyManager.removeSky(entity);
      }
    });

  // 4. Clean up skies for entities that were destroyed
  // (entity no longer exists in world but sky still tracked)
  for (const entity of skyManager.getTrackedEntities()) {
    if (!commands.isAlive(entity)) {
      skyManager.removeSky(entity);
    }
  }
});
