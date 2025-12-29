/**
 * TransformControlsManager - Manages TransformControls for selected entity
 *
 * Creates a "ghost" Object3D that mirrors the selected entity's transform.
 * TransformControls manipulate the ghost, then changes are fed back to the
 * ECS Transform3D or LocalTransform3D component.
 *
 * Only visible in Scene View via HELPER_LAYER assignment.
 *
 * This implementation directly calls TransformControls' public pointer methods
 * (pointerHover, pointerDown, pointerMove, pointerUp) with computed NDC coordinates,
 * avoiding the need for DOM event forwarding.
 */

import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { Entity } from '../ecs/entity.js';
import type { Transform3DData } from '../ecs/components/rendering/transform-3d.js';
import type { LocalTransform3DData } from '../ecs/components/rendering/local-transform-3d.js';
import { HELPER_LAYER } from '../constants/layers.js';
import type { SceneViewBounds } from './scene-view-bounds.js';
import { Vector3 } from '../math/vector3.js';

export type TransformMode = 'translate' | 'rotate' | 'scale';
export type TransformSpace = 'local' | 'world';

/**
 * Pointer data expected by TransformControls' pointer methods
 */
interface PointerData {
  x: number; // NDC x (-1 to 1)
  y: number; // NDC y (-1 to 1)
  button: number;
}

export class TransformControlsManager {
  private controls: TransformControls;
  private controlsHelper: THREE.Object3D; // The visual gizmo (TransformControlsRoot)
  private ghost: THREE.Object3D;
  private scene: THREE.Scene;
  private canvas: HTMLCanvasElement;
  private sceneViewBounds: SceneViewBounds;

  // Current state
  private selectedEntity: Entity | null = null;
  private isLocalTransform = false;
  private mode: TransformMode = 'translate';
  private space: TransformSpace = 'world';

  // Track if controls are actively dragging
  private isDragging = false;

  // Track visibility state
  private isControlsVisible = false;

  // Track if pointer is currently down (for move events during drag)
  private isPointerDown = false;
  private activePointerId: number | null = null;

  // Bound event handlers for cleanup
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    canvas: HTMLCanvasElement,
    sceneViewBounds: SceneViewBounds,
  ) {
    this.scene = scene;
    this.canvas = canvas;
    this.sceneViewBounds = sceneViewBounds;

    // Create ghost object (invisible, just for TransformControls to attach to)
    this.ghost = new THREE.Object3D();
    this.ghost.layers.set(HELPER_LAYER);
    this.scene.add(this.ghost);

    // Create TransformControls
    // We pass the canvas as domElement but won't use its event system
    // Instead, we'll call pointer methods directly
    this.controls = new TransformControls(camera, canvas);

    // Disconnect from DOM events - we'll call methods directly
    this.controls.disconnect();

    this.controls.attach(this.ghost);

    // Get the visual helper (TransformControlsRoot extends Object3D)
    this.controlsHelper = this.controls.getHelper();
    this.controlsHelper.visible = false; // Hidden until entity selected

    // Assign the root controlsHelper to HELPER_LAYER so it's only visible in Scene View
    this.controlsHelper.layers.set(HELPER_LAYER);
    this.controlsHelper.traverse((obj: THREE.Object3D) => {
      obj.layers.set(HELPER_LAYER);
    });

    // CRITICAL: Enable HELPER_LAYER on the TransformControls' internal raycaster
    // so it can hit the picker objects which are also on HELPER_LAYER
    const raycaster = this.controls.getRaycaster();
    raycaster.layers.enable(HELPER_LAYER);

    // Add controls helper to scene
    this.scene.add(this.controlsHelper);

    // Listen for drag events
    this.controls.addEventListener('dragging-changed', (event) => {
      this.isDragging = event.value as boolean;
    });

    // Bind event handlers
    this.boundPointerDown = this.onPointerDown.bind(this);
    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);

    // Setup pointer event handling
    this.setupPointerEventHandling();
  }

  /**
   * Setup pointer event listeners on the canvas
   */
  private setupPointerEventHandling(): void {
    this.canvas.addEventListener('pointerdown', this.boundPointerDown);
    this.canvas.addEventListener('pointermove', this.boundPointerMove);
    this.canvas.addEventListener('pointerup', this.boundPointerUp);
  }

  /**
   * Check if pointer is inside Scene View bounds
   */
  private isInsideSceneView(event: PointerEvent): boolean {
    if (!this.sceneViewBounds.isCalibrated()) {
      return false;
    }

    const rect = this.canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    return this.sceneViewBounds.isInsideBounds(canvasX, canvasY);
  }

  /**
   * Convert screen coordinates to NDC for the Scene View
   */
  private getPointerNDC(event: PointerEvent): PointerData | null {
    if (!this.sceneViewBounds.isCalibrated()) {
      return null;
    }

    const rect = this.canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    // Get position relative to Scene View
    const viewX = canvasX - this.sceneViewBounds.x;
    const viewY = canvasY - this.sceneViewBounds.y;

    // Convert to NDC (-1 to 1)
    const ndcX = (viewX / this.sceneViewBounds.width) * 2 - 1;
    const ndcY = -(viewY / this.sceneViewBounds.height) * 2 + 1;

    return {
      x: ndcX,
      y: ndcY,
      button: event.button,
    };
  }

  private onPointerDown(event: PointerEvent): void {
    if (!this.isControlsVisible) return;
    if (!this.isInsideSceneView(event)) return;

    const pointer = this.getPointerNDC(event);
    if (!pointer) return;

    this.isPointerDown = true;
    this.activePointerId = event.pointerId;

    // Set pointer capture on canvas to receive move/up events outside
    this.canvas.setPointerCapture(event.pointerId);

    // Call TransformControls pointer methods directly
    // First hover to set up axis, then down to start drag
    (this.controls as any).pointerHover(pointer);
    (this.controls as any).pointerDown(pointer);
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.isControlsVisible) return;

    const pointer = this.getPointerNDC(event);
    if (!pointer) return;

    if (this.isPointerDown && this.activePointerId === event.pointerId) {
      // During drag - call pointerMove
      (this.controls as any).pointerMove(pointer);
    } else if (this.isInsideSceneView(event)) {
      // Not dragging, inside scene view - call pointerHover for highlighting
      (this.controls as any).pointerHover(pointer);
    }
  }

  private onPointerUp(event: PointerEvent): void {
    if (!this.isControlsVisible) return;

    if (this.isPointerDown && this.activePointerId === event.pointerId) {
      const pointer = this.getPointerNDC(event);
      if (pointer) {
        (this.controls as any).pointerUp(pointer);
      }

      this.isPointerDown = false;
      this.activePointerId = null;

      // Release pointer capture
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
    }
  }

  /**
   * Set the selected entity and update ghost transform
   */
  setSelectedEntity(
    entity: Entity | null,
    transform: Transform3DData | LocalTransform3DData | null,
    isLocal: boolean,
  ): void {
    this.selectedEntity = entity;
    this.isLocalTransform = isLocal;

    if (entity === null || transform === null) {
      // No selection - hide controls
      this.controlsHelper.visible = false;
      this.isControlsVisible = false;
      return;
    }

    // Update ghost transform
    this.ghost.position.set(
      transform.position.x,
      transform.position.y,
      transform.position.z,
    );
    this.ghost.rotation.set(
      transform.rotation.x,
      transform.rotation.y,
      transform.rotation.z,
    );
    this.ghost.scale.set(
      transform.scale.x,
      transform.scale.y,
      transform.scale.z,
    );

    // Update space based on whether editing local or world transform
    this.space = isLocal ? 'local' : 'world';
    this.controls.setSpace(this.space);

    // Show controls
    this.controlsHelper.visible = true;
    this.isControlsVisible = true;
    this.controlsHelper.updateMatrixWorld();
  }

  /**
   * Update ghost transform from ECS (call when entity transform changes externally)
   */
  updateGhostFromTransform(
    transform: Transform3DData | LocalTransform3DData,
  ): void {
    if (!this.isControlsVisible || this.isDragging) return;

    this.ghost.position.set(
      transform.position.x,
      transform.position.y,
      transform.position.z,
    );
    this.ghost.rotation.set(
      transform.rotation.x,
      transform.rotation.y,
      transform.rotation.z,
    );
    this.ghost.scale.set(
      transform.scale.x,
      transform.scale.y,
      transform.scale.z,
    );
  }

  /**
   * Read transform changes from ghost (call every frame when entity selected)
   * Returns null if no entity is selected or controls are hidden
   */
  getTransformChanges(): Transform3DData | null {
    if (!this.selectedEntity || !this.isControlsVisible) {
      return null;
    }

    // Return current ghost transform
    return {
      position: new Vector3(
        this.ghost.position.x,
        this.ghost.position.y,
        this.ghost.position.z,
      ),
      rotation: new Vector3(
        this.ghost.rotation.x,
        this.ghost.rotation.y,
        this.ghost.rotation.z,
      ),
      scale: new Vector3(
        this.ghost.scale.x,
        this.ghost.scale.y,
        this.ghost.scale.z,
      ),
    };
  }

  /**
   * Get the currently selected entity
   */
  getSelectedEntity(): Entity | null {
    return this.selectedEntity;
  }

  /**
   * Check if editing LocalTransform3D (vs Transform3D)
   */
  getIsLocalTransform(): boolean {
    return this.isLocalTransform;
  }

  /**
   * Set the transform mode (translate, rotate, scale)
   */
  setMode(mode: TransformMode): void {
    this.mode = mode;
    this.controls.setMode(mode);
  }

  /**
   * Get current transform mode
   */
  getMode(): TransformMode {
    return this.mode;
  }

  /**
   * Set the transform space (local vs world)
   */
  setSpace(space: TransformSpace): void {
    this.space = space;
    this.controls.setSpace(space);
  }

  /**
   * Get current transform space
   */
  getSpace(): TransformSpace {
    return this.space;
  }

  /**
   * Check if controls are currently being dragged
   */
  getIsDragging(): boolean {
    return this.isDragging;
  }

  /**
   * Check if controls are visible
   */
  isVisible(): boolean {
    return this.isControlsVisible;
  }

  /**
   * Update camera reference (when editor switches between ortho/perspective)
   */
  setCamera(camera: THREE.Camera): void {
    this.controls.camera = camera;
  }

  /**
   * Get the TransformControls instance (for advanced usage)
   */
  getControls(): TransformControls {
    return this.controls;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Remove event listeners
    this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
    this.canvas.removeEventListener('pointermove', this.boundPointerMove);
    this.canvas.removeEventListener('pointerup', this.boundPointerUp);

    // Dispose TransformControls
    this.controls.detach();
    this.controls.dispose();
    this.scene.remove(this.controlsHelper);
    this.scene.remove(this.ghost);
  }
}
