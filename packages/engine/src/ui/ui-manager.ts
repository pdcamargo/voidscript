/**
 * UIManager - Manages the UI rendering layer
 *
 * Handles:
 * - Dedicated orthographic camera for UI rendering
 * - Dedicated scene for UI elements
 * - three-mesh-ui integration and updates
 * - UI element lifecycle management
 */

import * as THREE from 'three';
import ThreeMeshUI from 'three-mesh-ui';
import type { Renderer } from '../app/renderer.js';
import type { Entity } from '../ecs/entity.js';

/**
 * UI coordinate origin options
 */
export type UIOrigin = 'center' | 'top-left';

/**
 * UIManager configuration
 */
export interface UIManagerConfig {
  /**
   * Reference resolution for UI scaling
   * UI elements are designed at this resolution and scaled to fit actual screen
   * @default { width: 1920, height: 1080 }
   */
  referenceResolution?: { width: number; height: number };

  /**
   * Coordinate origin for UI positioning
   * - 'center': (0,0) is at screen center
   * - 'top-left': (0,0) is at top-left corner
   * @default 'center'
   */
  origin?: UIOrigin;

  /**
   * Pixels per unit for three-mesh-ui
   * Higher values = more detail but smaller elements
   * @default 1
   */
  pixelsPerUnit?: number;
}

/**
 * UIManager resource class
 *
 * Manages UI rendering with a dedicated orthographic camera
 * that renders on top of the main game scene.
 */
export class UIManager {
  // Renderer reference
  private readonly renderer: Renderer;

  // Dedicated UI camera (orthographic)
  private readonly uiCamera: THREE.OrthographicCamera;

  // Dedicated UI scene
  private readonly uiScene: THREE.Scene;

  // Configuration
  private readonly config: Required<UIManagerConfig>;

  // Current screen dimensions
  private screenWidth: number;
  private screenHeight: number;

  // Map of entity -> three-mesh-ui root Block
  private readonly entityToUIRoot = new Map<Entity, ThreeMeshUI.Block>();

  // Track all UI blocks for updates
  private readonly allBlocks = new Set<ThreeMeshUI.Block>();

  constructor(renderer: Renderer, config: UIManagerConfig = {}) {
    this.renderer = renderer;
    this.config = {
      referenceResolution: config.referenceResolution ?? { width: 1920, height: 1080 },
      origin: config.origin ?? 'center',
      pixelsPerUnit: config.pixelsPerUnit ?? 1,
    };

    // Get initial screen size
    const size = renderer.getSize();
    this.screenWidth = size.width;
    this.screenHeight = size.height;

    // Create orthographic camera for UI
    // Using screen-space coordinates
    this.uiCamera = this.createUICamera(this.screenWidth, this.screenHeight);

    // Create dedicated scene for UI
    this.uiScene = new THREE.Scene();
    this.uiScene.name = 'UIScene';
  }

  /**
   * Create orthographic camera configured for UI rendering
   */
  private createUICamera(width: number, height: number): THREE.OrthographicCamera {
    let left: number, right: number, top: number, bottom: number;

    if (this.config.origin === 'center') {
      // Center origin: (-width/2, -height/2) to (width/2, height/2)
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      left = -halfWidth;
      right = halfWidth;
      top = halfHeight;
      bottom = -halfHeight;
    } else {
      // Top-left origin: (0, -height) to (width, 0)
      // Y is inverted so positive Y goes down
      left = 0;
      right = width;
      top = 0;
      bottom = -height;
    }

    const camera = new THREE.OrthographicCamera(
      left,
      right,
      top,
      bottom,
      0.1,
      1000
    );

    // Position camera to look at UI plane
    camera.position.z = 100;
    camera.lookAt(0, 0, 0);

    return camera;
  }

  /**
   * Handle window resize
   */
  onResize(width: number, height: number): void {
    this.setViewportSize(width, height);
  }

  /**
   * Set the viewport size for UI rendering
   * This should be called when the game viewport size changes (e.g., in editor mode)
   * The UI camera and root blocks will be updated to match the new size
   */
  setViewportSize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    if (width === this.screenWidth && height === this.screenHeight) return;

    this.screenWidth = width;
    this.screenHeight = height;

    // Update camera bounds
    if (this.config.origin === 'center') {
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      this.uiCamera.left = -halfWidth;
      this.uiCamera.right = halfWidth;
      this.uiCamera.top = halfHeight;
      this.uiCamera.bottom = -halfHeight;
    } else {
      this.uiCamera.left = 0;
      this.uiCamera.right = width;
      this.uiCamera.top = 0;
      this.uiCamera.bottom = -height;
    }

    this.uiCamera.updateProjectionMatrix();

    // Update all root blocks to match new screen size
    for (const block of this.entityToUIRoot.values()) {
      (block as any).set({
        width: width,
        height: height,
      });
    }
  }

  /**
   * Get the UI scene
   */
  getUIScene(): THREE.Scene {
    return this.uiScene;
  }

  /**
   * Get the UI camera
   */
  getUICamera(): THREE.OrthographicCamera {
    return this.uiCamera;
  }

  /**
   * Get current screen dimensions
   */
  getScreenSize(): { width: number; height: number } {
    return { width: this.screenWidth, height: this.screenHeight };
  }

  /**
   * Get the coordinate origin mode
   */
  getOrigin(): UIOrigin {
    return this.config.origin;
  }

  /**
   * Create a UI root block for an entity (UICanvas)
   */
  createUIRoot(entity: Entity): ThreeMeshUI.Block {
    // Remove existing if present
    if (this.entityToUIRoot.has(entity)) {
      this.removeUIRoot(entity);
    }

    // Create root block that fills the screen
    // Configure as a transparent container that can hold children
    const block = new ThreeMeshUI.Block({
      width: this.screenWidth,
      height: this.screenHeight,
      backgroundOpacity: 0, // Transparent by default
      contentDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    } as ThreeMeshUI.BlockOptions);

    // Store reference
    this.entityToUIRoot.set(entity, block);
    this.allBlocks.add(block);

    // Add to UI scene
    this.uiScene.add(block);

    return block;
  }

  /**
   * Get the UI root block for an entity
   */
  getUIRoot(entity: Entity): ThreeMeshUI.Block | undefined {
    return this.entityToUIRoot.get(entity);
  }

  /**
   * Remove UI root block for an entity
   */
  removeUIRoot(entity: Entity): void {
    const block = this.entityToUIRoot.get(entity);
    if (block) {
      this.uiScene.remove(block);
      this.allBlocks.delete(block);
      this.entityToUIRoot.delete(entity);

      // Dispose block
      if (typeof (block as unknown as { dispose?: () => void }).dispose === 'function') {
        (block as unknown as { dispose: () => void }).dispose();
      }
    }
  }

  /**
   * Add a block to tracking (for non-entity blocks)
   */
  trackBlock(block: ThreeMeshUI.Block): void {
    this.allBlocks.add(block);
  }

  /**
   * Remove a block from tracking
   */
  untrackBlock(block: ThreeMeshUI.Block): void {
    this.allBlocks.delete(block);
  }

  /**
   * Update all UI elements
   * Must be called each frame before rendering
   */
  update(): void {
    // Update three-mesh-ui
    ThreeMeshUI.update();
  }

  /**
   * Render the UI layer
   * Should be called after the main scene render, before ImGui
   *
   * @param skipStateReset - If true, skip resetState calls (useful when called from editor viewport rendering)
   */
  render(skipStateReset = false): void {
    // Skip if no UI elements
    if (this.uiScene.children.length === 0) {
      return;
    }

    // Don't clear - render on top of existing content
    const threeRenderer = this.renderer.getThreeRenderer();

    // Reset WebGL state to ensure clean rendering (skip if called from editor)
    if (!skipStateReset) {
      threeRenderer.resetState();
    }

    // Disable auto clear for additive rendering
    const autoClear = threeRenderer.autoClear;
    threeRenderer.autoClear = false;

    // Clear only depth buffer so UI renders on top
    threeRenderer.clearDepth();

    // Render UI scene
    threeRenderer.render(this.uiScene, this.uiCamera);

    // Restore auto clear
    threeRenderer.autoClear = autoClear;

    // Reset state again for any subsequent rendering (ImGui)
    if (!skipStateReset) {
      threeRenderer.resetState();
    }
  }

  /**
   * Convert screen coordinates to UI coordinates
   * Accounts for the coordinate origin setting
   */
  screenToUI(screenX: number, screenY: number): { x: number; y: number } {
    if (this.config.origin === 'center') {
      return {
        x: screenX - this.screenWidth / 2,
        y: this.screenHeight / 2 - screenY,
      };
    } else {
      // Top-left origin
      return {
        x: screenX,
        y: -screenY,
      };
    }
  }

  /**
   * Convert UI coordinates to screen coordinates
   */
  uiToScreen(uiX: number, uiY: number): { x: number; y: number } {
    if (this.config.origin === 'center') {
      return {
        x: uiX + this.screenWidth / 2,
        y: this.screenHeight / 2 - uiY,
      };
    } else {
      return {
        x: uiX,
        y: -uiY,
      };
    }
  }

  /**
   * Cleanup all resources
   */
  dispose(): void {
    // Remove all roots
    for (const entity of this.entityToUIRoot.keys()) {
      this.removeUIRoot(entity);
    }

    // Clear scene
    while (this.uiScene.children.length > 0) {
      const child = this.uiScene.children[0];
      if (child) {
        this.uiScene.remove(child);
      }
    }

    this.allBlocks.clear();
  }
}
