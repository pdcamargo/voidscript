/**
 * Renderer - Three.js scene management with SCREEN_TEXTURE support
 *
 * Based on packages/engine/src/app/renderer.ts
 * Provides:
 * - SCREEN_TEXTURE via getScreenTexture() (previous frame's render)
 * - Render target support via createRenderTarget(), renderToTarget()
 * - ImGui compatibility (pixelRatio=1, resetState())
 * - Effect pass pipeline via EffectComposer
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import type { Pass } from 'three/examples/jsm/postprocessing/Pass.js';

// Import math from @voidscript/core (not directly from THREE)
import { Vector2 } from '@voidscript/core';

import type { Window } from './window.js';

/**
 * Renderer configuration options
 */
export interface RendererConfig {
  /** Antialiasing (default: true) */
  antialias?: boolean;

  /** Alpha/transparency (default: false) */
  alpha?: boolean;

  /** Power preference (default: 'high-performance') */
  powerPreference?: 'high-performance' | 'low-power' | 'default';

  /** Clear color (default: 0x000000) */
  clearColor?: number;

  /** Clear alpha (default: 1.0) */
  clearAlpha?: number;

  /** Enable shadow mapping (default: false) */
  shadows?: boolean;

  /** Shadow map type (default: PCFSoftShadowMap) */
  shadowMapType?: THREE.ShadowMapType;

  /** Tone mapping (default: NoToneMapping) */
  toneMapping?: THREE.ToneMapping;

  /** Tone mapping exposure (default: 1.0) */
  toneMappingExposure?: number;

  /** Output color space (default: SRGBColorSpace) */
  outputColorSpace?: THREE.ColorSpace;

  /** Logarithmic depth buffer for large scenes (default: false) */
  logarithmicDepthBuffer?: boolean;
}

/**
 * Tracked effect pass with order information
 */
interface EffectPassEntry {
  pass: Pass;
  order: number;
}

/**
 * Renderer class - Three.js WebGL rendering with SCREEN_TEXTURE support
 *
 * ALWAYS owns an EffectComposer with baseline passes.
 * This ensures getScreenTexture() returns a valid texture from frame 1.
 */
export class Renderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private window: Window;

  // ============================================================================
  // Effect Composer (ALWAYS exists for SCREEN_TEXTURE support)
  // ============================================================================
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private copyPass: ShaderPass;
  private effectPasses: Map<string, EffectPassEntry> = new Map();

  // External output target (for editor viewport rendering)
  private outputTarget: THREE.WebGLRenderTarget | null = null;

  // Blit resources for copying to external render targets
  private blitMaterial: THREE.ShaderMaterial | null = null;
  private blitQuad: THREE.Mesh | null = null;
  private blitScene: THREE.Scene | null = null;
  private blitCamera: THREE.OrthographicCamera | null = null;

  constructor(window: Window, config: RendererConfig = {}) {
    this.window = window;
    const canvas = window.getCanvas();

    // Create WebGL renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: config.antialias ?? true,
      alpha: config.alpha ?? false,
      powerPreference: config.powerPreference ?? 'high-performance',
      logarithmicDepthBuffer: config.logarithmicDepthBuffer ?? false,
    });

    // CRITICAL: pixelRatio=1 for ImGui compatibility
    // jsimgui reads canvas.clientWidth/clientHeight for DisplaySize, but Three.js
    // with setPixelRatio(2) sets canvas.width/height to 2x the CSS size.
    // This mismatch causes ImGui to render to only 1/4 of the screen on Retina.
    this.renderer.setSize(window.getWidth(), window.getHeight());
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(
      config.clearColor ?? 0x000000,
      config.clearAlpha ?? 1.0,
    );

    // Shadow configuration
    if (config.shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type =
        config.shadowMapType ?? THREE.PCFSoftShadowMap;
    }

    // Tone mapping
    if (config.toneMapping !== undefined) {
      this.renderer.toneMapping = config.toneMapping;
    }
    if (config.toneMappingExposure !== undefined) {
      this.renderer.toneMappingExposure = config.toneMappingExposure;
    }

    // Color space
    this.renderer.outputColorSpace =
      config.outputColorSpace ?? THREE.SRGBColorSpace;

    // Create default scene
    this.scene = new THREE.Scene();

    // Create default camera
    const aspect = window.getWidth() / window.getHeight();
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.z = 10;
    // Enable helper layer (31) so debug helpers are visible
    this.camera.layers.enable(31);

    // Initialize the EffectComposer with baseline passes
    this.composer = new EffectComposer(this.renderer);

    // RenderPass - renders the scene to the composer's internal buffer
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    // CopyPass - outputs the result (no tone mapping to preserve colors)
    this.copyPass = new ShaderPass(CopyShader);
    this.composer.addPass(this.copyPass);

    // Set initial size
    this.composer.setSize(window.getWidth(), window.getHeight());

    // Don't render to screen by default - we'll blit to output target or screen
    this.composer.renderToScreen = false;
  }

  // ============================================================================
  // SCREEN_TEXTURE Support
  // ============================================================================

  /**
   * Get the screen texture from the last render.
   * This is the composer's writeBuffer texture - contains the final rendered scene
   * from the previous frame (before buffers swap).
   *
   * Use this for effects that need the current screen content (water reflections,
   * screen-space effects, etc). This texture is always valid after the first
   * renderPipeline() call.
   *
   * Note: This is a 1-frame delayed texture (contains what was rendered last frame).
   */
  getScreenTexture(): THREE.Texture {
    return this.composer.writeBuffer.texture;
  }

  /**
   * Get the internal render target where the scene is rendered.
   * This is the composer's writeBuffer - always valid from frame 1.
   */
  getSceneRenderTarget(): THREE.WebGLRenderTarget {
    return this.composer.writeBuffer;
  }

  /**
   * Get the EffectComposer instance (for advanced use)
   */
  getComposer(): EffectComposer {
    return this.composer;
  }

  // ============================================================================
  // Render Target Support
  // ============================================================================

  /**
   * Create a render target for off-screen rendering
   *
   * @param width - Target width in pixels
   * @param height - Target height in pixels
   * @param options - Additional WebGLRenderTarget options
   * @returns WebGLRenderTarget that can be used for rendering
   */
  createRenderTarget(
    width: number,
    height: number,
    options?: THREE.RenderTargetOptions,
  ): THREE.WebGLRenderTarget {
    return new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      ...options,
    });
  }

  /**
   * Render to a render target (off-screen texture)
   *
   * @param renderTarget - Target to render to
   * @param scene - Scene to render
   * @param camera - Camera to use
   * @param clearColor - Optional clear color
   * @param clearAlpha - Optional clear alpha
   */
  renderToTarget(
    renderTarget: THREE.WebGLRenderTarget,
    scene: THREE.Scene,
    camera: THREE.Camera,
    clearColor?: THREE.ColorRepresentation,
    clearAlpha: number = 1.0,
  ): void {
    // Save current render target
    const previousTarget = this.renderer.getRenderTarget();

    // Set render target
    this.renderer.setRenderTarget(renderTarget);

    // Update camera aspect for target dimensions
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = renderTarget.width / renderTarget.height;
      camera.updateProjectionMatrix();
    } else if (camera instanceof THREE.OrthographicCamera) {
      const size = (camera.top - camera.bottom) / 2;
      const halfWidth = size * (renderTarget.width / renderTarget.height);
      camera.left = -halfWidth;
      camera.right = halfWidth;
      camera.updateProjectionMatrix();
    }

    // Clear if color provided
    if (clearColor !== undefined) {
      this.renderer.setClearColor(clearColor, clearAlpha);
    }
    this.renderer.clear();

    // Render
    this.renderer.render(scene, camera);

    // Restore previous render target
    this.renderer.setRenderTarget(previousTarget);
  }

  /**
   * Get the WebGL texture from a render target
   * Useful for passing to ImGui.Image()
   *
   * @param renderTarget - The render target
   * @returns The WebGLTexture handle
   */
  getRenderTargetTexture(
    renderTarget: THREE.WebGLRenderTarget,
  ): WebGLTexture | null {
    const properties = this.renderer.properties.get(renderTarget.texture) as
      | { __webglTexture?: WebGLTexture }
      | undefined;
    return properties?.__webglTexture ?? null;
  }

  /**
   * Resize a render target
   *
   * @param renderTarget - Target to resize
   * @param width - New width
   * @param height - New height
   */
  resizeRenderTarget(
    renderTarget: THREE.WebGLRenderTarget,
    width: number,
    height: number,
  ): void {
    if (renderTarget.width !== width || renderTarget.height !== height) {
      renderTarget.setSize(width, height);
    }
  }

  /**
   * Dispose a render target
   *
   * @param renderTarget - Target to dispose
   */
  disposeRenderTarget(renderTarget: THREE.WebGLRenderTarget): void {
    renderTarget.dispose();
  }

  // ============================================================================
  // Effect Composer Pipeline API
  // ============================================================================

  /**
   * Set an external render target for the final output.
   * The pipeline will blit the final result to this target.
   *
   * @param target - The target to render to, or null for screen
   */
  setOutputTarget(target: THREE.WebGLRenderTarget | null): void {
    this.outputTarget = target;
  }

  /**
   * Get the current output target
   */
  getOutputTarget(): THREE.WebGLRenderTarget | null {
    return this.outputTarget;
  }

  /**
   * Add an effect pass to the pipeline.
   * Passes are inserted before the CopyPass in order of their order value.
   *
   * @param id - Unique identifier for this pass
   * @param pass - The pass to add
   * @param order - Order value (lower = earlier in pipeline)
   */
  addEffectPass(id: string, pass: Pass, order: number): void {
    // Remove if already exists
    if (this.effectPasses.has(id)) {
      this.removeEffectPass(id);
    }

    // Store the pass
    this.effectPasses.set(id, { pass, order });

    // Rebuild the pass order
    this.rebuildPassOrder();
  }

  /**
   * Remove an effect pass from the pipeline
   *
   * @param id - The identifier of the pass to remove
   */
  removeEffectPass(id: string): void {
    const entry = this.effectPasses.get(id);
    if (!entry) return;

    // Remove from composer
    const index = this.composer.passes.indexOf(entry.pass);
    if (index !== -1) {
      this.composer.passes.splice(index, 1);
    }

    // Remove from tracking
    this.effectPasses.delete(id);
  }

  /**
   * Check if a pass exists
   */
  hasEffectPass(id: string): boolean {
    return this.effectPasses.has(id);
  }

  /**
   * Get an effect pass by id
   */
  getEffectPass(id: string): Pass | null {
    return this.effectPasses.get(id)?.pass ?? null;
  }

  /**
   * Get all effect pass IDs
   */
  getEffectPassIds(): string[] {
    return Array.from(this.effectPasses.keys());
  }

  /**
   * Clear all effect passes (keeps RenderPass and CopyPass)
   */
  clearEffectPasses(): void {
    for (const id of this.effectPasses.keys()) {
      this.removeEffectPass(id);
    }
  }

  /**
   * Rebuild the pass order in the composer.
   * Called after adding/removing passes.
   */
  private rebuildPassOrder(): void {
    // Clear all passes
    this.composer.passes.length = 0;

    // Add RenderPass first (always)
    this.composer.addPass(this.renderPass);

    // Sort effect passes by order
    const sortedPasses = Array.from(this.effectPasses.values()).sort(
      (a, b) => a.order - b.order,
    );

    // Add effect passes
    for (const { pass } of sortedPasses) {
      this.composer.addPass(pass);
    }

    // Add CopyPass last (always)
    this.composer.addPass(this.copyPass);
  }

  // ============================================================================
  // Main Render Methods
  // ============================================================================

  /**
   * Initialize blit resources for copying to external render targets
   */
  private initBlitResources(): void {
    if (this.blitMaterial) return;

    this.blitMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(tDiffuse, vUv);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.blitQuad = new THREE.Mesh(geometry, this.blitMaterial);
    this.blitScene = new THREE.Scene();
    this.blitScene.add(this.blitQuad);
    this.blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /**
   * Dispose blit resources
   */
  private disposeBlitResources(): void {
    if (this.blitMaterial) {
      this.blitMaterial.dispose();
      this.blitMaterial = null;
    }
    if (this.blitQuad) {
      this.blitQuad.geometry.dispose();
      this.blitQuad = null;
    }
    this.blitScene = null;
    this.blitCamera = null;
  }

  /**
   * Execute the full render pipeline.
   *
   * This is the main render method that:
   * 1. Updates the RenderPass with the provided scene/camera
   * 2. Renders through the EffectComposer (all passes)
   * 3. Blits the result to the output target (or screen)
   *
   * @param scene - Scene to render
   * @param camera - Camera to use
   * @param deltaTime - Delta time in seconds (for time-based effects)
   */
  renderPipeline(
    scene: THREE.Scene,
    camera: THREE.Camera,
    deltaTime: number,
  ): void {
    // Update the RenderPass with current scene/camera
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;

    // Execute the composer pipeline
    this.composer.render(deltaTime);

    // Blit result to output target or screen
    if (this.outputTarget) {
      this.initBlitResources();

      if (this.blitMaterial && this.blitScene && this.blitCamera) {
        const previousTarget = this.renderer.getRenderTarget();

        // The composer's readBuffer has the final output after render()
        const sourceTexture = this.composer.readBuffer.texture;
        const tDiffuseUniform = this.blitMaterial.uniforms['tDiffuse'];
        if (tDiffuseUniform) {
          tDiffuseUniform.value = sourceTexture;
        }

        // Render the fullscreen quad to our external target
        this.renderer.setRenderTarget(this.outputTarget);
        this.renderer.render(this.blitScene, this.blitCamera);

        // Restore previous target
        this.renderer.setRenderTarget(previousTarget);
      }
    } else {
      // Render to screen
      this.initBlitResources();

      if (this.blitMaterial && this.blitScene && this.blitCamera) {
        const sourceTexture = this.composer.readBuffer.texture;
        const tDiffuseUniform = this.blitMaterial.uniforms['tDiffuse'];
        if (tDiffuseUniform) {
          tDiffuseUniform.value = sourceTexture;
        }

        // Render to screen (null target)
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.blitScene, this.blitCamera);
      }
    }
  }

  /**
   * Resize the composer's internal render targets.
   * Call this when the viewport size changes.
   */
  resizeComposer(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  /**
   * Begin frame rendering (clear buffers)
   */
  beginFrame(): void {
    // Clear is handled by render() when autoClear is true (default)
    // This method exists for explicit control if needed
  }

  /**
   * Render the current scene with current camera (simple render, no post-processing)
   */
  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Render a specific scene with a specific camera (simple render, no post-processing)
   */
  renderScene(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera);
  }

  /**
   * Clear the render buffers manually
   */
  clear(color = true, depth = true, stencil = true): void {
    this.renderer.clear(color, depth, stencil);
  }

  // ============================================================================
  // ImGui Integration
  // ============================================================================

  /**
   * Reset WebGL state after rendering
   * REQUIRED when sharing WebGL context with other libraries (e.g., ImGui)
   */
  resetState(): void {
    this.renderer.resetState();
  }

  /**
   * Reset viewport to full canvas
   * Call after renderToViewport() to restore normal rendering
   */
  resetViewport(): void {
    const { width, height } = this.getSize();
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, width, height);
  }

  // ============================================================================
  // Three.js Object Access
  // ============================================================================

  /**
   * Get Three.js WebGLRenderer
   */
  getThreeRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * Get the default scene
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Set the active scene
   */
  setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  /**
   * Get the default camera
   */
  getCamera(): THREE.Camera {
    return this.camera;
  }

  /**
   * Set the active camera
   */
  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  /**
   * Get the window wrapper
   */
  getWindow(): Window {
    return this.window;
  }

  // ============================================================================
  // Scene Manipulation
  // ============================================================================

  /**
   * Add object to scene
   */
  add(...objects: THREE.Object3D[]): void {
    for (const object of objects) {
      this.scene.add(object);
    }
  }

  /**
   * Remove object from scene
   */
  remove(...objects: THREE.Object3D[]): void {
    for (const object of objects) {
      this.scene.remove(object);
    }
  }

  /**
   * Clear all objects from scene
   */
  clearScene(): void {
    while (this.scene.children.length > 0) {
      const child = this.scene.children[0];
      if (child) {
        this.scene.remove(child);
      }
    }
  }

  /**
   * Set scene background color
   */
  setBackgroundColor(color: THREE.ColorRepresentation): void {
    this.scene.background = new THREE.Color(color);
  }

  /**
   * Set scene background to environment map
   */
  setBackgroundTexture(texture: THREE.Texture | null): void {
    this.scene.background = texture;
  }

  /**
   * Set scene environment map (for PBR reflections)
   */
  setEnvironment(texture: THREE.Texture | null): void {
    this.scene.environment = texture;
  }

  /**
   * Set scene fog
   */
  setFog(fog: THREE.Fog | THREE.FogExp2 | null): void {
    this.scene.fog = fog;
  }

  // ============================================================================
  // Renderer Settings
  // ============================================================================

  /**
   * Set clear color
   */
  setClearColor(color: THREE.ColorRepresentation, alpha = 1.0): void {
    this.renderer.setClearColor(color, alpha);
  }

  /**
   * Enable/disable shadows
   */
  setShadowsEnabled(enabled: boolean): void {
    this.renderer.shadowMap.enabled = enabled;
  }

  /**
   * Set shadow map type
   */
  setShadowMapType(type: THREE.ShadowMapType): void {
    this.renderer.shadowMap.type = type;
    this.renderer.shadowMap.needsUpdate = true;
  }

  /**
   * Set tone mapping
   */
  setToneMapping(toneMapping: THREE.ToneMapping, exposure: number = 1.0): void {
    this.renderer.toneMapping = toneMapping;
    this.renderer.toneMappingExposure = exposure;
  }

  /**
   * Set pixel ratio
   */
  setPixelRatio(ratio: number): void {
    this.renderer.setPixelRatio(ratio);
  }

  // ============================================================================
  // Window/Resize Handling
  // ============================================================================

  /**
   * Handle window resize
   */
  onResize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);

    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    } else if (this.camera instanceof THREE.OrthographicCamera) {
      this.camera.left = -width / 2;
      this.camera.right = width / 2;
      this.camera.top = height / 2;
      this.camera.bottom = -height / 2;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Get current viewport size
   */
  getSize(): { width: number; height: number } {
    const size = new Vector2();
    this.renderer.getSize(size);
    return { width: size.x, height: size.y };
  }

  // ============================================================================
  // Debug & Info
  // ============================================================================

  /**
   * Get render info for debugging
   */
  getRenderInfo(): THREE.WebGLInfo {
    return this.renderer.info;
  }

  /**
   * Get WebGL capabilities
   */
  getCapabilities(): THREE.WebGLCapabilities {
    return this.renderer.capabilities;
  }

  /**
   * Take a screenshot (returns data URL)
   */
  screenshot(mimeType = 'image/png', quality = 1.0): string {
    // Render first to ensure buffer is up to date
    this.render();
    return this.renderer.domElement.toDataURL(mimeType, quality);
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Cleanup and dispose resources
   */
  destroy(): void {
    // Dispose effect passes
    for (const { pass } of this.effectPasses.values()) {
      if ('dispose' in pass && typeof pass.dispose === 'function') {
        pass.dispose();
      }
    }
    this.effectPasses.clear();

    // Dispose composer (disposes its internal render targets)
    this.composer.dispose();

    // Dispose blit resources
    this.disposeBlitResources();

    // Dispose renderer and scene
    this.renderer.dispose();
    this.scene.clear();
  }
}
