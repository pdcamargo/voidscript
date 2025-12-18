/**
 * Renderer - Three.js scene management
 *
 * Direct Three.js integration without abstraction layers.
 * Provides convenience methods while allowing full access to Three.js objects.
 *
 * The Renderer ALWAYS owns an EffectComposer with baseline passes (RenderPass + CopyPass).
 * This ensures a consistent render target exists from frame 1, eliminating timing issues
 * for systems like water that need to capture the framebuffer.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import type { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
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
 * Renderer class - Three.js WebGL rendering
 *
 * ALWAYS owns an EffectComposer with baseline passes.
 * This ensures getSceneRenderTarget() returns a valid target from frame 1.
 */
export class Renderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private window: Window;

  // ============================================================================
  // Effect Composer (ALWAYS exists)
  // ============================================================================
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private copyPass: ShaderPass;
  private effectPasses: Map<string, EffectPassEntry> = new Map();

  // External output target (for editor viewport rendering)
  private outputTarget: THREE.WebGLRenderTarget | null = null;

  // Blit resources for copying to external render target
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

    // Configure renderer
    this.renderer.setSize(window.getWidth(), window.getHeight());
    this.renderer.setPixelRatio(window.getPixelRatio());
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
    } else {
      throw new Error('Camera is not a perspective or orthographic camera');
    }
  }

  // ============================================================================
  // Effect Composer Pipeline API
  // ============================================================================

  /**
   * Get the internal render target where the scene is rendered.
   * This is the composer's writeBuffer - always valid from frame 1.
   *
   * Use this for systems like water that need to capture the framebuffer
   * during the scene render phase.
   */
  getSceneRenderTarget(): THREE.WebGLRenderTarget {
    return this.composer.writeBuffer;
  }

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
   * For most effects like water reflections, this is acceptable and even desirable.
   *
   * We use writeBuffer instead of readBuffer because:
   * - writeBuffer holds the previous frame's final output (before swap)
   * - readBuffer is what we're currently rendering TO this frame
   * - Using writeBuffer avoids sampling from the buffer we're writing to
   */
  getScreenTexture(): THREE.Texture {
    return this.composer.writeBuffer.texture;
  }

  /**
   * Get the EffectComposer instance (for advanced use)
   */
  getComposer(): EffectComposer {
    return this.composer;
  }

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
    const sortedPasses = Array.from(this.effectPasses.values())
      .sort((a, b) => a.order - b.order);

    // Add effect passes
    for (const { pass } of sortedPasses) {
      this.composer.addPass(pass);
    }

    // Add CopyPass last (always)
    this.composer.addPass(this.copyPass);
  }

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
  renderPipeline(scene: THREE.Scene, camera: THREE.Camera, deltaTime: number): void {
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
   * Render the current scene with current camera
   */
  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Render a specific scene with a specific camera
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

  /**
   * Reset WebGL state after rendering
   * Required when sharing WebGL context with other libraries (e.g., ImGui)
   */
  resetState(): void {
    this.renderer.resetState();
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
  // Camera Manipulation
  // ============================================================================

  /**
   * Set camera position
   */
  setCameraPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z);
  }

  /**
   * Set camera look-at target
   */
  setCameraLookAt(x: number, y: number, z: number): void {
    this.camera.lookAt(x, y, z);
  }

  /**
   * Set camera field of view
   */
  setCameraFOV(fov: number): void {
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    } else {
      throw new Error('Camera is not a perspective camera');
    }
  }

  /**
   * Set camera near/far planes
   */
  setCameraClipping(near: number, far: number): void {
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.near = near;
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    } else {
      throw new Error('Camera is not a perspective camera');
    }
  }

  // ============================================================================
  // Coordinate Conversion Utilities
  // ============================================================================

  /**
   * Convert screen coordinates (pixels) to world coordinates
   * Works with both perspective and orthographic cameras
   *
   * @param screenX - X position in pixels (0 = left edge)
   * @param screenY - Y position in pixels (0 = top edge)
   * @param targetZ - Z depth in world space (default: 0, only used for perspective cameras)
   * @returns World position as THREE.Vector3
   */
  screenToWorld(screenX: number, screenY: number, targetZ: number = 0): THREE.Vector3 {
    const { width, height } = this.getSize();

    // Convert to normalized device coordinates (-1 to +1)
    const ndcX = (screenX / width) * 2 - 1;
    const ndcY = -(screenY / height) * 2 + 1;

    if (this.camera instanceof THREE.OrthographicCamera) {
      // For orthographic cameras, we can directly compute world position
      const worldX = this.camera.position.x + ndcX * ((this.camera.right - this.camera.left) / 2);
      const worldY = this.camera.position.y + ndcY * ((this.camera.top - this.camera.bottom) / 2);
      return new THREE.Vector3(worldX, worldY, targetZ);
    } else if (this.camera instanceof THREE.PerspectiveCamera) {
      // For perspective cameras, we need to raycast to a plane at targetZ
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);

      // Create a plane at targetZ facing the camera
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -targetZ);
      const worldPos = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, worldPos);

      return worldPos || new THREE.Vector3(0, 0, targetZ);
    }

    throw new Error('Camera type not supported for coordinate conversion');
  }

  /**
   * Convert world coordinates to screen coordinates (pixels)
   * Works with both perspective and orthographic cameras
   *
   * @param worldPos - Position in world space (Vector3 or {x, y, z})
   * @returns Screen position as {x, y} in pixels, and whether it's in front of camera
   */
  worldToScreen(worldPos: THREE.Vector3 | { x: number; y: number; z: number }): {
    x: number;
    y: number;
    visible: boolean;
  } {
    const { width, height } = this.getSize();

    // Convert to THREE.Vector3 if needed
    const pos = worldPos instanceof THREE.Vector3
      ? worldPos.clone()
      : new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);

    // Project to normalized device coordinates
    pos.project(this.camera);

    // Check if behind camera
    const visible = pos.z >= -1 && pos.z <= 1;

    // Convert to screen coordinates
    const screenX = ((pos.x + 1) / 2) * width;
    const screenY = ((-pos.y + 1) / 2) * height;

    return { x: screenX, y: screenY, visible };
  }

  /**
   * Create an orthographic camera with the given size
   *
   * @param size - Half-height in world units (full height = size * 2)
   * @param near - Near clipping plane (default: 0.1)
   * @param far - Far clipping plane (default: 1000)
   * @returns Configured OrthographicCamera
   */
  createOrthographicCamera(
    size: number,
    near: number = 0.1,
    far: number = 1000,
  ): THREE.OrthographicCamera {
    const { width, height } = this.getSize();
    const aspect = width / height;
    const halfWidth = size * aspect;

    const camera = new THREE.OrthographicCamera(
      -halfWidth,  // left
      halfWidth,   // right
      size,        // top
      -size,       // bottom
      near,
      far,
    );

    return camera;
  }

  /**
   * Update an orthographic camera's bounds based on size and current aspect ratio
   * Useful for zoom changes or when the viewport size changes
   *
   * @param camera - The orthographic camera to update
   * @param size - Half-height in world units
   * @param zoom - Zoom level (default: 1)
   */
  updateOrthographicCamera(
    camera: THREE.OrthographicCamera,
    size: number,
    zoom: number = 1,
  ): void {
    const { width, height } = this.getSize();
    const aspect = width / height;
    const effectiveSize = size / zoom;
    const halfWidth = effectiveSize * aspect;

    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = effectiveSize;
    camera.bottom = -effectiveSize;
    camera.updateProjectionMatrix();
  }

  /**
   * Get the visible world bounds for the current camera
   * Useful for culling, spawning objects within view, etc.
   *
   * @param z - Z depth to measure at (default: 0, only affects perspective cameras)
   * @returns Object with min/max world coordinates
   */
  getVisibleBounds(z: number = 0): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  } {
    const topLeft = this.screenToWorld(0, 0, z);
    const bottomRight = this.screenToWorld(this.getSize().width, this.getSize().height, z);

    return {
      minX: Math.min(topLeft.x, bottomRight.x),
      maxX: Math.max(topLeft.x, bottomRight.x),
      minY: Math.min(topLeft.y, bottomRight.y),
      maxY: Math.max(topLeft.y, bottomRight.y),
      width: Math.abs(bottomRight.x - topLeft.x),
      height: Math.abs(bottomRight.y - topLeft.y),
    };
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
   * Get current viewport size
   */
  getSize(): { width: number; height: number } {
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    return { width: size.x, height: size.y };
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

  // ============================================================================
  // Multi-Viewport Rendering
  // ============================================================================

  /**
   * Render to a specific viewport region
   *
   * Uses Three.js setViewport/setScissor for split-view rendering.
   * Note: Three.js uses bottom-left origin, so Y coordinates are flipped.
   *
   * @param scene - Scene to render
   * @param camera - Camera to use
   * @param viewport - Viewport bounds { x, y, width, height } in pixels (top-left origin)
   * @param clearColor - Optional clear color for this viewport
   * @param clearAlpha - Optional clear alpha (default: 1.0)
   */
  renderToViewport(
    scene: THREE.Scene,
    camera: THREE.Camera,
    viewport: { x: number; y: number; width: number; height: number },
    clearColor?: THREE.ColorRepresentation,
    clearAlpha: number = 1.0,
  ): void {
    const { width: canvasWidth, height: canvasHeight } = this.getSize();

    // Convert top-left origin to bottom-left origin for Three.js
    const y = canvasHeight - viewport.y - viewport.height;

    // Enable scissor test for viewport clipping
    this.renderer.setScissorTest(true);
    this.renderer.setViewport(viewport.x, y, viewport.width, viewport.height);
    this.renderer.setScissor(viewport.x, y, viewport.width, viewport.height);

    // Set clear color if provided
    if (clearColor !== undefined) {
      this.renderer.setClearColor(clearColor, clearAlpha);
    }

    // Update camera aspect ratio
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = viewport.width / viewport.height;
      camera.updateProjectionMatrix();
    } else if (camera instanceof THREE.OrthographicCamera) {
      // Maintain aspect ratio for orthographic camera
      const size = (camera.top - camera.bottom) / 2;
      const halfWidth = size * (viewport.width / viewport.height);
      camera.left = -halfWidth;
      camera.right = halfWidth;
      camera.updateProjectionMatrix();
    }

    // Render
    this.renderer.render(scene, camera);
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

  /**
   * Clear a specific viewport region
   *
   * @param viewport - Viewport bounds { x, y, width, height } in pixels (top-left origin)
   * @param clearColor - Clear color
   * @param clearAlpha - Clear alpha (default: 1.0)
   */
  clearViewport(
    viewport: { x: number; y: number; width: number; height: number },
    clearColor: THREE.ColorRepresentation = 0x000000,
    clearAlpha: number = 1.0,
  ): void {
    const { width: canvasWidth, height: canvasHeight } = this.getSize();

    // Convert top-left origin to bottom-left origin for Three.js
    const y = canvasHeight - viewport.y - viewport.height;

    this.renderer.setScissorTest(true);
    this.renderer.setViewport(viewport.x, y, viewport.width, viewport.height);
    this.renderer.setScissor(viewport.x, y, viewport.width, viewport.height);
    this.renderer.setClearColor(clearColor, clearAlpha);
    this.renderer.clear();
  }

  // ============================================================================
  // Render Target Support (for ImGui panels)
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
  getRenderTargetTexture(renderTarget: THREE.WebGLRenderTarget): WebGLTexture | null {
    const properties = this.renderer.properties.get(renderTarget.texture) as { __webglTexture?: WebGLTexture } | undefined;
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
}
