/**
 * PostProcessingManager
 *
 * Effect configurator that syncs PostProcessing component effects to the Renderer's
 * EffectComposer. The Renderer owns the composer; this manager just adds/removes/updates
 * effect passes on it.
 */

import * as THREE from "three";
import type { Pass } from "three/examples/jsm/postprocessing/Pass.js";

import type { Renderer } from "../../app/renderer.js";
import type { EffectConfig, EffectType } from "../types.js";
import { createPass, updatePass, disposePass } from "../effect-factory.js";
import type { Entity, Command } from "@voidscript/core";
import { Render3DManager } from "../../ecs/systems/renderer-sync-system.js";

export class PostProcessingManager {
  private renderer: Renderer;

  // Track passes by effect type for updating and disposal
  private passes = new Map<EffectType, Pass>();

  // Track current effect order for detecting changes
  private currentEffectOrder: EffectType[] = [];

  // Entity to Object3D cache (for OutlinePass)
  private entityToObject3D = new Map<Entity, THREE.Object3D>();

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  /**
   * Get the underlying renderer
   */
  getRenderer(): Renderer {
    return this.renderer;
  }

  /**
   * Sync effects from the PostProcessing component to the Renderer's composer.
   *
   * This compares current effects with new effects and:
   * - Adds new effect passes to the renderer
   * - Removes old effect passes from the renderer
   * - Updates existing passes
   *
   * @param effects - Map of effect types to their configs
   * @param scene - The scene (for effects that need it)
   * @param camera - The camera (for effects that need it)
   * @param width - Viewport width
   * @param height - Viewport height
   * @param commands - Command for resource access
   */
  syncEffects(
    effects: Map<EffectType, EffectConfig>,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
    commands: Command
  ): void {
    // Get new enabled effects in order
    const newEffectOrder = Array.from(effects.entries())
      .filter(([_, config]) => config.enabled)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([type]) => type);

    // Check if effects changed
    const orderChanged = !this.arraysEqual(newEffectOrder, this.currentEffectOrder);

    if (orderChanged) {
      // Remove old passes that are no longer in the new order
      for (const oldType of this.currentEffectOrder) {
        if (!newEffectOrder.includes(oldType)) {
          const pass = this.passes.get(oldType);
          if (pass) {
            this.renderer.removeEffectPass(oldType);
            disposePass(pass);
            this.passes.delete(oldType);
          }
        }
      }

      // Add new passes that weren't in the old order
      for (const newType of newEffectOrder) {
        if (!this.currentEffectOrder.includes(newType)) {
          const config = effects.get(newType);
          if (config) {
            const pass = createPass(
              newType,
              config,
              scene,
              camera,
              width,
              height,
              commands,
              this
            );
            if (pass) {
              this.passes.set(newType, pass);
              this.renderer.addEffectPass(newType, pass, config.order);
            }
          }
        }
      }

      // Update the order tracking
      this.currentEffectOrder = newEffectOrder;
    }

    // Update all existing passes
    this.updateEffects(effects, scene, camera, width, height, commands);
  }

  /**
   * Update existing effect passes without adding/removing.
   * Call this for live uniform updates.
   */
  updateEffects(
    effects: Map<EffectType, EffectConfig>,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
    commands: Command
  ): void {
    for (const [type, config] of effects) {
      if (!config.enabled) continue;

      const pass = this.passes.get(type);
      if (pass) {
        updatePass(
          type,
          pass,
          config,
          scene,
          camera,
          width,
          height,
          commands,
          this
        );
      }
    }
  }

  /**
   * Clear all effect passes from the renderer
   */
  clearEffects(): void {
    for (const [type, pass] of this.passes) {
      this.renderer.removeEffectPass(type);
      disposePass(pass);
    }
    this.passes.clear();
    this.currentEffectOrder = [];
  }

  /**
   * Check if effects have changed (enabled state or order)
   */
  needsSync(effects: Map<EffectType, EffectConfig>): boolean {
    const newOrder = Array.from(effects.entries())
      .filter(([_, config]) => config.enabled)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([type]) => type);

    return !this.arraysEqual(newOrder, this.currentEffectOrder);
  }

  /**
   * Get Three.js Object3D for an entity (for OutlinePass)
   */
  getObject3DForEntity(entity: Entity, commands: Command): THREE.Object3D | null {
    // Check cache first
    const cached = this.entityToObject3D.get(entity);
    if (cached) {
      return cached;
    }

    // Look up in Render3DManager
    const render3DManager = commands.getResource(Render3DManager);
    if (render3DManager) {
      const obj = render3DManager.getObject(entity);
      if (obj) {
        this.entityToObject3D.set(entity, obj);
        return obj;
      }
    }

    return null;
  }

  /**
   * Clear entity cache (call when world loads/changes)
   */
  clearEntityCache(): void {
    this.entityToObject3D.clear();
  }

  /**
   * Get current pass for an effect type (for debugging)
   */
  getPass(type: EffectType): Pass | undefined {
    return this.passes.get(type);
  }

  /**
   * Get all enabled effect types in order
   */
  getEnabledEffects(): EffectType[] {
    return [...this.currentEffectOrder];
  }

  /**
   * Dispose all resources (call when manager is no longer needed)
   */
  dispose(): void {
    this.clearEffects();
    this.entityToObject3D.clear();
  }

  /**
   * Helper to compare arrays
   */
  private arraysEqual<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}
