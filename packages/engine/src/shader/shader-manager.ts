/**
 * ShaderManager - Runtime management of shaders
 *
 * A resource class that manages shader compilation, caching, and global uniform updates.
 * Registered as a resource in Application for access across all systems.
 *
 * @example
 * ```typescript
 * // In a system:
 * const shaderManager = commands.getResource(ShaderManager);
 *
 * // Compile a shader from source
 * const shader = shaderManager.compileFromSource(vslSource);
 *
 * // Create a material instance
 * const material = shaderManager.createMaterial(shader);
 *
 * // Get/register named shaders
 * shaderManager.registerShader('water-effect', shader);
 * const waterShader = shaderManager.getShader('water-effect');
 * ```
 */

import * as THREE from 'three';
import { ShaderAsset } from './shader-asset.js';
import type { TranspiledUniform } from './vsl/transpiler.js';
import type { Renderer } from '../app/renderer.js';

/**
 * Tracked material with TIME uniform for automatic updates
 */
interface TrackedMaterial {
  material: THREE.ShaderMaterial;
  uniforms: Set<string>;
}

/**
 * ShaderManager - Central shader management resource
 */
export class ShaderManager {
  /** Named shader registry */
  private shaders = new Map<string, ShaderAsset>();

  /** Materials with TIME uniform that need per-frame updates */
  private trackedMaterials = new Set<TrackedMaterial>();

  /** Materials with vsl_screenTexture uniform that need per-frame screen texture updates */
  private screenTextureMaterials = new Set<THREE.ShaderMaterial>();

  /** Current elapsed time for TIME uniform */
  private elapsedTime = 0;

  /** Renderer reference for screen texture access */
  private renderer: Renderer | null = null;

  /** Singleton check */
  private static instance: ShaderManager | null = null;

  constructor() {
    if (ShaderManager.instance) {
      console.warn(
        '[ShaderManager] Multiple instances created. Consider using the singleton pattern.',
      );
    }
    ShaderManager.instance = this;
  }

  /**
   * Get singleton instance (if exists)
   */
  static getInstance(): ShaderManager | null {
    return ShaderManager.instance;
  }

  /**
   * Set the renderer reference for screen texture access.
   * Must be called after both ShaderManager and Renderer are created.
   *
   * @param renderer - The application renderer
   */
  setRenderer(renderer: Renderer): void {
    this.renderer = renderer;
  }

  /**
   * Get the renderer reference
   */
  getRenderer(): Renderer | null {
    return this.renderer;
  }

  // ===========================================================================
  // Shader Compilation
  // ===========================================================================

  /**
   * Compile a shader from VSL source code
   *
   * @param source - VSL source code
   * @returns Compiled ShaderAsset
   * @throws Error if compilation fails
   */
  compileFromSource(source: string): ShaderAsset {
    return ShaderAsset.fromSource(source);
  }

  /**
   * Compile a shader and register it with a name
   *
   * @param name - Unique name for the shader
   * @param source - VSL source code
   * @returns Compiled ShaderAsset
   */
  compileAndRegister(name: string, source: string): ShaderAsset {
    const shader = this.compileFromSource(source);
    this.registerShader(name, shader);
    return shader;
  }

  // ===========================================================================
  // Shader Registry
  // ===========================================================================

  /**
   * Register a shader with a name
   *
   * @param name - Unique name for the shader
   * @param shader - ShaderAsset to register
   */
  registerShader(name: string, shader: ShaderAsset): void {
    if (this.shaders.has(name)) {
      console.warn(`[ShaderManager] Overwriting existing shader: ${name}`);
    }
    this.shaders.set(name, shader);
  }

  /**
   * Get a registered shader by name
   *
   * @param name - Shader name
   * @returns ShaderAsset or undefined if not found
   */
  getShader(name: string): ShaderAsset | undefined {
    return this.shaders.get(name);
  }

  /**
   * Check if a shader is registered
   *
   * @param name - Shader name
   */
  hasShader(name: string): boolean {
    return this.shaders.has(name);
  }

  /**
   * Unregister a shader
   *
   * @param name - Shader name
   * @returns true if shader was removed
   */
  unregisterShader(name: string): boolean {
    return this.shaders.delete(name);
  }

  /**
   * Get all registered shader names
   */
  getRegisteredShaderNames(): string[] {
    return Array.from(this.shaders.keys());
  }

  // ===========================================================================
  // Material Creation
  // ===========================================================================

  /**
   * Create a material from a ShaderAsset
   *
   * @param shader - ShaderAsset to create material from
   * @param customUniforms - Optional custom uniform values
   * @returns THREE.ShaderMaterial
   */
  createMaterial(
    shader: ShaderAsset,
    customUniforms?: Record<string, unknown>,
  ): THREE.ShaderMaterial {
    const material = shader.createMaterial(customUniforms);

    // Track materials with TIME uniform for automatic updates
    const timeUniformNames = this.findTimeUniforms(shader.uniforms);
    if (timeUniformNames.size > 0) {
      this.trackedMaterials.add({
        material,
        uniforms: timeUniformNames,
      });
    }

    return material;
  }

  /**
   * Create a material from a registered shader name
   *
   * @param name - Registered shader name
   * @param customUniforms - Optional custom uniform values
   * @returns THREE.ShaderMaterial or null if shader not found
   */
  createMaterialFromName(
    name: string,
    customUniforms?: Record<string, unknown>,
  ): THREE.ShaderMaterial | null {
    const shader = this.getShader(name);
    if (!shader) {
      console.warn(`[ShaderManager] Shader not found: ${name}`);
      return null;
    }
    return this.createMaterial(shader, customUniforms);
  }

  /**
   * Find uniform names that require TIME updates
   */
  private findTimeUniforms(uniforms: TranspiledUniform[]): Set<string> {
    const timeUniforms = new Set<string>();

    for (const uniform of uniforms) {
      // Built-in TIME uniform
      if (uniform.name === 'vsl_time' || uniform.name === 'time') {
        timeUniforms.add(uniform.name);
      }
    }

    return timeUniforms;
  }

  // ===========================================================================
  // Material Tracking & Updates
  // ===========================================================================

  /**
   * Track a material for TIME uniform updates
   * Call this if you create materials manually that need time updates
   *
   * @param material - THREE.ShaderMaterial to track
   * @param uniformNames - Names of time-based uniforms (defaults to ['vsl_time', 'time'])
   */
  trackMaterial(
    material: THREE.ShaderMaterial,
    uniformNames: string[] = ['vsl_time', 'time'],
  ): void {
    const validUniforms = new Set<string>();

    for (const name of uniformNames) {
      if (material.uniforms[name]) {
        validUniforms.add(name);
      }
    }

    if (validUniforms.size > 0) {
      this.trackedMaterials.add({
        material,
        uniforms: validUniforms,
      });
    }

    // Also track materials that use screen texture
    if (material.uniforms['vsl_screenTexture']) {
      this.screenTextureMaterials.add(material);
    }
  }

  /**
   * Stop tracking a material
   *
   * @param material - THREE.ShaderMaterial to untrack
   */
  untrackMaterial(material: THREE.ShaderMaterial): void {
    for (const tracked of this.trackedMaterials) {
      if (tracked.material === material) {
        this.trackedMaterials.delete(tracked);
        break;
      }
    }

    // Also remove from screen texture tracking
    this.screenTextureMaterials.delete(material);
  }

  /**
   * Update all tracked materials (called each frame)
   *
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    this.elapsedTime += deltaTime;

    // Update TIME uniform on all tracked materials
    for (const tracked of this.trackedMaterials) {
      // Check if material is still valid (not disposed)
      // ShaderMaterial doesn't have a direct 'program' property, check via uniforms or disposed state
      if (!tracked.material.uniforms || Object.keys(tracked.material.uniforms).length === 0) {
        // Material was likely disposed, remove from tracking
        this.trackedMaterials.delete(tracked);
        continue;
      }

      for (const uniformName of tracked.uniforms) {
        const uniform = tracked.material.uniforms[uniformName];
        if (uniform) {
          uniform.value = this.elapsedTime;
        }
      }
    }

    // Update SCREEN_TEXTURE and SCREEN_SIZE uniforms on materials that use them
    if (this.renderer && this.screenTextureMaterials.size > 0) {
      const screenTexture = this.renderer.getScreenTexture();
      const threeRenderer = this.renderer.getThreeRenderer();
      const size = threeRenderer.getSize(new THREE.Vector2());

      for (const material of this.screenTextureMaterials) {
        // Check if material is still valid
        if (!material.uniforms || Object.keys(material.uniforms).length === 0) {
          this.screenTextureMaterials.delete(material);
          continue;
        }

        // Update screen texture
        const screenTextureUniform = material.uniforms['vsl_screenTexture'];
        if (screenTextureUniform) {
          screenTextureUniform.value = screenTexture;
        }

        // Update screen size (needed for SCREEN_UV calculation)
        const screenSizeUniform = material.uniforms['vsl_screenSize'];
        if (screenSizeUniform) {
          screenSizeUniform.value = size;
        }
      }
    }
  }

  /**
   * Get current elapsed time
   */
  getElapsedTime(): number {
    return this.elapsedTime;
  }

  /**
   * Reset elapsed time to zero
   */
  resetTime(): void {
    this.elapsedTime = 0;
  }

  /**
   * Set elapsed time to a specific value
   *
   * @param time - Time in seconds
   */
  setTime(time: number): void {
    this.elapsedTime = time;
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Clear all tracked materials without resetting time or shader registry.
   * Use this when materials have been disposed externally (e.g., play mode cleanup)
   * but you want to keep the elapsed time running.
   */
  clearTrackedMaterials(): void {
    this.trackedMaterials.clear();
    this.screenTextureMaterials.clear();
  }

  /**
   * Dispose all tracked materials and clear registry
   */
  dispose(): void {
    // Clear tracked materials (don't dispose them, they might be shared)
    this.trackedMaterials.clear();
    this.screenTextureMaterials.clear();

    // Clear shader registry
    this.shaders.clear();

    // Reset time
    this.elapsedTime = 0;
  }

  /**
   * Get count of tracked materials (for debugging)
   */
  getTrackedMaterialCount(): number {
    return this.trackedMaterials.size;
  }

  /**
   * Get count of materials tracking screen texture (for debugging)
   */
  getScreenTextureMaterialCount(): number {
    return this.screenTextureMaterials.size;
  }

  /**
   * Get count of registered shaders (for debugging)
   */
  getRegisteredShaderCount(): number {
    return this.shaders.size;
  }
}
