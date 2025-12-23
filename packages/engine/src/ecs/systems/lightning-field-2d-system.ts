/**
 * Lightning Field 2D Sync System
 *
 * Manages 2D lightning field rendering with procedural bolt generation.
 *
 * Architecture:
 * - LightningField2DRenderManager tracks mesh lifecycle (create, update, remove)
 * - lightningField2DSyncSystem queries entities and delegates to manager
 * - Strike timing and bolt state is managed per-entity in the manager
 *
 * Key features:
 * - Procedural bolt generation with midpoint displacement
 * - Multiple simultaneous bolts support
 * - Screen flash and ground glow effects
 * - Fade, flicker, and instant bolt disappearance modes
 */

import * as THREE from 'three';
import { system } from '../system.js';
import type { Entity } from '../entity.js';
import type { Renderer } from '../../app/renderer.js';
import { Application } from '../../app/application.js';
import { Transform3D } from '../components/rendering/transform-3d.js';
import {
  LightningField2D,
  type LightningField2DData,
} from '../components/rendering/lightning-field-2d.js';
import { RenderObject } from '../components/rendering/render-object.js';
import { Lightning2DMaterial } from '../../rendering/lightning/Lightning2DMaterial.js';
import { calculateRenderOrder } from '../components/rendering/sprite-2d.js';
import { MAX_BOLTS, type BoltState } from '../../rendering/lightning/lightning-shader-utils.js';

/**
 * Get angle in radians for a given strike direction
 */
function getDirectionAngle(
  direction: LightningField2DData['strikeDirection'],
  angleVariation: number,
): number {
  let baseAngle: number;

  switch (direction) {
    case 'top-down':
      baseAngle = 0;
      break;
    case 'bottom-up':
      baseAngle = Math.PI;
      break;
    case 'left-right':
      baseAngle = Math.PI / 2;
      break;
    case 'right-left':
      baseAngle = -Math.PI / 2;
      break;
    case 'random':
      baseAngle = Math.random() * Math.PI * 2;
      break;
    default:
      baseAngle = 0;
  }

  // Add random variation
  const variation = (Math.random() - 0.5) * 2 * angleVariation;
  return baseAngle + variation;
}

/**
 * Internal lightning entry tracking a Three.js mesh and its state
 */
interface LightningEntry {
  mesh: THREE.Mesh;
  material: Lightning2DMaterial;
  geometry: THREE.PlaneGeometry;
  lastBaseSize: { x: number; y: number };
  lastScale: { x: number; y: number };
  lastSortingLayer: number;
  lastSortingOrder: number;

  // Strike timing state
  strikeTimer: number;
  nextStrikeTime: number;

  // Per-bolt state
  bolts: BoltState[];

  // Screen flash state
  flashRemaining: number;
}

/**
 * Lightning Field 2D Render Manager
 *
 * Manages the lifecycle of lightning field meshes and bolt timing.
 *
 * @example
 * ```typescript
 * // Automatically registered by Application, but can be manually created:
 * const lightningManager = new LightningField2DRenderManager(renderer);
 * app.insertResource(lightningManager);
 * app.addRenderSystem(lightningField2DSyncSystem);
 * ```
 */
export class LightningField2DRenderManager {
  private renderer: Renderer;
  private entries: Map<Entity, LightningEntry> = new Map();
  private nextHandle: number = 1;
  private handleToEntity: Map<number, Entity> = new Map();

  // Time tracking
  private elapsedTime: number = 0;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  /**
   * Create a lightning field mesh for an entity
   */
  createLightning(entity: Entity, data: LightningField2DData): number {
    // Create 1x1 geometry - scale is applied via mesh.scale (like sprites)
    const geometry = new THREE.PlaneGeometry(1, 1);

    // Create material
    const material = new Lightning2DMaterial({
      boltColor: new THREE.Vector3(
        data.boltColor.r,
        data.boltColor.g,
        data.boltColor.b,
      ),
      glowColor: new THREE.Vector3(
        data.glowColor.r,
        data.glowColor.g,
        data.glowColor.b,
      ),
      boltWidth: data.boltWidth,
      glowRadius: data.glowRadius,
      glowIntensity: data.glowIntensity,
      pixelSize: data.pixelSize,
      segments: data.segments,
      displacement: data.displacement,
      noiseStrength: data.noiseStrength,
      branchProbability: data.branchProbability,
      branchLengthFactor: data.branchLengthFactor,
      enableGroundGlow: data.enableGroundGlow,
      groundGlowRadius: data.groundGlowRadius,
    });

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = data.visible;
    mesh.renderOrder = calculateRenderOrder(
      data.sortingLayer,
      data.sortingOrder,
    );

    // Add to scene
    this.renderer.add(mesh);

    // Calculate initial next strike time
    const nextStrikeTime =
      data.minInterval +
      Math.random() * (data.maxInterval - data.minInterval);

    // Initialize bolt states
    const bolts: BoltState[] = [];
    for (let i = 0; i < MAX_BOLTS; i++) {
      bolts.push({
        active: false,
        seed: 0,
        angle: 0,
        timeRemaining: 0,
        duration: data.strikeDuration,
      });
    }

    // Track entry
    const entry: LightningEntry = {
      mesh,
      material,
      geometry,
      lastBaseSize: { x: data.baseSize.x, y: data.baseSize.y },
      lastScale: { x: 1, y: 1 },
      lastSortingLayer: data.sortingLayer,
      lastSortingOrder: data.sortingOrder,
      strikeTimer: 0,
      nextStrikeTime,
      bolts,
      flashRemaining: 0,
    };
    this.entries.set(entity, entry);

    // Generate handle
    const handle = this.nextHandle++;
    this.handleToEntity.set(handle, entity);

    return handle;
  }

  /**
   * Update lightning field properties and transform
   */
  updateLightning(
    entity: Entity,
    data: LightningField2DData,
    transform: {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      scale: { x: number; y: number };
    },
    deltaTime: number,
  ): void {
    const entry = this.entries.get(entity);
    if (!entry) return;

    const { mesh, material, bolts } = entry;

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
      data.baseSize.x * transform.scale.x,
      data.baseSize.y * transform.scale.y,
      1,
    );

    // Update visibility
    mesh.visible = data.visible;

    // Update render order if changed
    if (
      data.sortingLayer !== entry.lastSortingLayer ||
      data.sortingOrder !== entry.lastSortingOrder
    ) {
      mesh.renderOrder = calculateRenderOrder(
        data.sortingLayer,
        data.sortingOrder,
      );
      entry.lastSortingLayer = data.sortingLayer;
      entry.lastSortingOrder = data.sortingOrder;
    }

    // === Strike timing logic ===
    entry.strikeTimer += deltaTime;

    // Check if time to spawn new bolt
    if (entry.strikeTimer >= entry.nextStrikeTime) {
      entry.strikeTimer = 0;
      entry.nextStrikeTime =
        data.minInterval + Math.random() * (data.maxInterval - data.minInterval);

      // Count active bolts
      const activeBoltCount = bolts.filter((b) => b.active).length;

      // Find inactive bolt slot (if we haven't hit limit)
      if (activeBoltCount < data.simultaneousStrikes) {
        const inactiveSlot = bolts.findIndex((b) => !b.active);
        if (inactiveSlot !== -1) {
          const bolt = bolts[inactiveSlot]!;
          bolt.active = true;
          bolt.seed = Math.random() * 10000;
          bolt.angle = getDirectionAngle(data.strikeDirection, data.angleVariation);
          bolt.duration = data.strikeDuration;
          bolt.timeRemaining = data.strikeDuration;

          // Trigger screen flash if enabled
          if (data.enableScreenFlash) {
            entry.flashRemaining = data.strikeDuration;
          }
        }
      }
    }

    // Update active bolts
    for (const bolt of bolts) {
      if (!bolt.active) continue;

      bolt.timeRemaining -= deltaTime;

      // Handle fade modes
      switch (data.fadeMode) {
        case 'instant':
          // No fade, just cut off at end
          if (bolt.timeRemaining <= 0) {
            bolt.active = false;
          }
          break;

        case 'fade':
          // Linear fade is handled by shader (progress = timeRemaining / duration)
          if (bolt.timeRemaining <= 0) {
            bolt.active = false;
          }
          break;

        case 'flicker':
          // Apply flicker effect by modulating timeRemaining perception
          // The shader uses progress, so we can make it flicker by pulsing
          if (bolt.timeRemaining <= 0) {
            bolt.active = false;
          }
          break;
      }
    }

    // Calculate screen flash intensity
    let flashIntensity = 0;
    if (data.enableScreenFlash && entry.flashRemaining > 0) {
      entry.flashRemaining -= deltaTime;
      if (entry.flashRemaining < 0) {
        entry.flashRemaining = 0;
      }
      // Quadratic falloff for natural flash decay
      const flashProgress = entry.flashRemaining / data.strikeDuration;
      flashIntensity = flashProgress * flashProgress * data.flashIntensity;
    }

    // Calculate world scale for rendering
    const worldScale = {
      x: data.baseSize.x * transform.scale.x,
      y: data.baseSize.y * transform.scale.y,
    };

    // Apply flicker effect by modulating bolt progress if in flicker mode
    if (data.fadeMode === 'flicker') {
      for (const bolt of bolts) {
        if (bolt.active) {
          // Create flicker by using sine wave
          const flickerPhase = this.elapsedTime * data.flickerSpeed * Math.PI * 2;
          const flicker = 0.5 + 0.5 * Math.sin(flickerPhase + bolt.seed);
          // Modulate the effective time remaining for visual effect
          // We store original timeRemaining but adjust what we pass to shader
          // by creating a temporary modified bolt state
        }
      }
    }

    // Prepare bolt states for shader (handle flicker mode)
    const shaderBolts: BoltState[] = bolts.map((bolt) => {
      if (!bolt.active) return bolt;

      if (data.fadeMode === 'flicker') {
        // Flicker: pulse the progress value
        const flickerPhase =
          this.elapsedTime * data.flickerSpeed * Math.PI * 2;
        const flicker = 0.3 + 0.7 * Math.abs(Math.sin(flickerPhase + bolt.seed));
        const baseProgress = bolt.timeRemaining / bolt.duration;
        return {
          ...bolt,
          // Simulate flicker by adjusting how we present timeRemaining
          timeRemaining: baseProgress * flicker * bolt.duration,
        };
      }

      return bolt;
    });

    // Update shader uniforms
    material.updateFromData(
      data,
      this.elapsedTime,
      worldScale,
      shaderBolts,
      flashIntensity,
    );

    // Update tracking
    entry.lastBaseSize = { x: data.baseSize.x, y: data.baseSize.y };
    entry.lastScale = { x: transform.scale.x, y: transform.scale.y };
  }

  /**
   * Manually trigger a lightning strike (for editor preview)
   */
  triggerStrike(entity: Entity): void {
    const entry = this.entries.get(entity);
    if (!entry) return;

    // Find inactive bolt slot
    const inactiveSlot = entry.bolts.findIndex((b) => !b.active);
    if (inactiveSlot !== -1) {
      const bolt = entry.bolts[inactiveSlot]!;
      bolt.active = true;
      bolt.seed = Math.random() * 10000;
      bolt.angle = 0; // Default top-down for preview
      bolt.duration = 0.15;
      bolt.timeRemaining = 0.15;
    }
  }

  /**
   * Remove a lightning field for an entity
   */
  removeLightning(entity: Entity): void {
    const entry = this.entries.get(entity);
    if (!entry) return;

    // Remove from scene
    this.renderer.remove(entry.mesh);

    // Dispose resources
    entry.geometry.dispose();
    entry.material.dispose();

    // Remove from tracking
    this.entries.delete(entity);

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
    return this.entries.get(entity)?.mesh ?? null;
  }

  /**
   * Check if entity has a lightning field
   */
  hasLightning(entity: Entity): boolean {
    return this.entries.has(entity);
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
  getStats(): { lightningCount: number; activeBolts: number } {
    let activeBolts = 0;
    for (const entry of this.entries.values()) {
      activeBolts += entry.bolts.filter((b) => b.active).length;
    }
    return { lightningCount: this.entries.size, activeBolts };
  }

  /**
   * Get all tracked entity IDs (for cleanup checks)
   */
  getTrackedEntities(): Entity[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Dispose all lightning fields
   *
   * Called during play mode cleanup.
   */
  dispose(): void {
    // Remove all lightning fields (disposes individual meshes, materials, geometries)
    for (const [entity] of this.entries) {
      this.removeLightning(entity);
    }

    // Reset elapsed time so animations start fresh on next play
    this.elapsedTime = 0;
  }
}

/**
 * Lightning Field 2D sync system
 *
 * Runs in render phase to:
 * 1. Create lightning field meshes for new entities
 * 2. Update existing meshes with transform and properties
 * 3. Remove meshes for deleted entities
 */
export const lightningField2DSyncSystem = system(({ commands }) => {
  const lightningManager = commands.getResource(LightningField2DRenderManager);
  if (!lightningManager) return;

  // Get delta time from application
  const app = Application.exists() ? Application.get() : null;
  const deltaTime = app?.getDeltaTime() ?? 0;

  // 1. Create lightning for new LightningField2D entities
  // (have LightningField2D + Transform3D but no RenderObject)
  commands
    .query()
    .all(Transform3D, LightningField2D)
    .none(RenderObject)
    .each((entity, _transform, lightning) => {
      const handle = lightningManager.createLightning(entity, lightning);
      commands.entity(entity).addComponent(RenderObject, { handle });
    });

  // 2. Update existing lightning fields
  commands
    .query()
    .all(Transform3D, LightningField2D, RenderObject)
    .each((entity, transform, lightning) => {
      lightningManager.updateLightning(
        entity,
        lightning,
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

  // 3. Remove lightning for entities that lost their LightningField2D component
  // (have RenderObject but no LightningField2D)
  commands
    .query()
    .all(RenderObject)
    .none(LightningField2D)
    .each((entity) => {
      if (lightningManager.hasLightning(entity)) {
        lightningManager.removeLightning(entity);
      }
    });

  // 4. Clean up lightning for entities that were destroyed
  // (entity no longer exists in world but lightning still tracked)
  for (const entity of lightningManager.getTrackedEntities()) {
    if (!commands.isAlive(entity)) {
      lightningManager.removeLightning(entity);
    }
  }
});
