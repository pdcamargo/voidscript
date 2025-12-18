/**
 * EditorCameraManager - Manages editor camera for scene editing
 *
 * Provides a separate camera from the game's main camera, allowing users to
 * freely navigate the scene while editing. Supports both 2D (orthographic)
 * and 3D (perspective) modes.
 */

import * as THREE from 'three';
import type { Renderer } from './renderer.js';
import { Input, KeyCode, MouseButton } from './input.js';
import { HELPER_LAYER } from '../constants/layers.js';

export type EditorCameraMode = '2d' | '3d';

/**
 * EditorCameraManager - Handles editor camera separate from game cameras
 */
export class EditorCameraManager {
  private renderer: Renderer;

  // Editor cameras (we keep both to preserve state when switching)
  private orthoCamera: THREE.OrthographicCamera;
  private perspectiveCamera: THREE.PerspectiveCamera;

  // State
  private _isEditorCameraActive = true;
  private _mode: EditorCameraMode = '2d';

  // Camera movement settings
  private moveSpeed2D = 300;
  private moveSpeed3D = 10;
  private zoomSpeed = 0.1;
  private rotationSpeed = 0.002;

  // Zoom bounds
  private readonly MIN_ZOOM = 5;
  private readonly MAX_ZOOM = 50;

  // 2D camera state
  private zoom2D = 5;
  private orthoSize = 300;

  // 3D camera state (for mouse look)
  private yaw = 0;
  private pitch = 0;
  private isDragging3D = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  // 2D camera state (for panning)
  private isPanning2D = false;
  private panStartX = 0;
  private panStartY = 0;
  private panStartCamX = 0;
  private panStartCamY = 0;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    const { width, height } = renderer.getSize();
    const aspect = width / height;

    // Create orthographic camera (for 2D mode)
    const halfWidth = this.orthoSize * aspect;
    this.orthoCamera = new THREE.OrthographicCamera(
      -halfWidth,
      halfWidth,
      this.orthoSize,
      -this.orthoSize,
      0.1,
      10000,
    );
    this.orthoCamera.position.set(0, 0, 500);

    // Create perspective camera (for 3D mode)
    this.perspectiveCamera = new THREE.PerspectiveCamera(60, aspect, 0.1, 10000);
    this.perspectiveCamera.position.set(0, 5, 10);
    this.perspectiveCamera.lookAt(0, 0, 0);

    // Enable helper layer (31) for both editor cameras
    // This allows debug helpers (CameraHelper, LightHelper, etc.) to be visible
    // only in the editor scene view, not in the game view
    this.orthoCamera.layers.enable(HELPER_LAYER);
    this.perspectiveCamera.layers.enable(HELPER_LAYER);

    // Apply initial zoom level
    this.updateOrthoZoom();
  }

  /**
   * Whether the editor camera is currently active (vs game camera)
   */
  get isEditorCameraActive(): boolean {
    return this._isEditorCameraActive;
  }

  /**
   * Current editor camera mode (2d or 3d)
   */
  get mode(): EditorCameraMode {
    return this._mode;
  }

  /**
   * Toggle between editor camera and game camera
   */
  toggleEditorCamera(): void {
    this._isEditorCameraActive = !this._isEditorCameraActive;
  }

  /**
   * Set whether editor camera is active
   */
  setEditorCameraActive(active: boolean): void {
    this._isEditorCameraActive = active;
  }

  /**
   * Toggle between 2D (ortho) and 3D (perspective) modes
   */
  toggle2D3D(): void {
    this._mode = this._mode === '2d' ? '3d' : '2d';
  }

  /**
   * Set the camera mode
   */
  setMode(mode: EditorCameraMode): void {
    this._mode = mode;
  }

  /**
   * Get the current editor camera (based on mode)
   */
  getEditorCamera(): THREE.Camera {
    return this._mode === '2d' ? this.orthoCamera : this.perspectiveCamera;
  }

  /**
   * Handle window resize
   */
  onResize(width: number, height: number): void {
    const aspect = width / height;

    // Update orthographic camera
    const halfWidth = (this.orthoSize / this.zoom2D) * aspect;
    const halfHeight = this.orthoSize / this.zoom2D;
    this.orthoCamera.left = -halfWidth;
    this.orthoCamera.right = halfWidth;
    this.orthoCamera.top = halfHeight;
    this.orthoCamera.bottom = -halfHeight;
    this.orthoCamera.updateProjectionMatrix();

    // Update perspective camera
    this.perspectiveCamera.aspect = aspect;
    this.perspectiveCamera.updateProjectionMatrix();
  }

  /**
   * Update editor camera based on input
   * Call this in onUpdate if editor camera is active
   */
  update(deltaTime: number, blockInput: boolean = false): void {
    if (!this._isEditorCameraActive || blockInput) return;

    if (this._mode === '2d') {
      this.update2DCamera(deltaTime);
    } else {
      this.update3DCamera(deltaTime);
    }
  }

  /**
   * Update 2D orthographic camera
   * - Middle mouse drag OR right click drag to pan
   * - Scroll wheel to zoom
   * - Arrow keys for fine movement
   */
  private update2DCamera(deltaTime: number): void {
    const mousePos = Input.getMousePosition();

    // Middle mouse or right click drag to pan
    const isPanningInput = Input.isMouseButtonPressed(MouseButton.Middle) || Input.isMouseButtonPressed(MouseButton.Right);

    if (isPanningInput) {
      if (!this.isPanning2D) {
        // Start panning - capture start position
        this.isPanning2D = true;
        this.panStartX = mousePos.x;
        this.panStartY = mousePos.y;
        this.panStartCamX = this.orthoCamera.position.x;
        this.panStartCamY = this.orthoCamera.position.y;
      } else {
        // Continue panning - calculate delta and move camera
        const deltaX = mousePos.x - this.panStartX;
        const deltaY = mousePos.y - this.panStartY;

        // Convert screen delta to world delta (accounting for zoom)
        const { width, height } = this.renderer.getSize();
        const worldWidth = (this.orthoSize * 2) / this.zoom2D * (width / height);
        const worldHeight = (this.orthoSize * 2) / this.zoom2D;

        const worldDeltaX = (deltaX / width) * worldWidth;
        const worldDeltaY = (deltaY / height) * worldHeight;

        // Move camera (inverted so dragging moves the view, not the camera position in world)
        this.orthoCamera.position.x = this.panStartCamX - worldDeltaX;
        this.orthoCamera.position.y = this.panStartCamY + worldDeltaY;
      }
    } else {
      this.isPanning2D = false;
    }

    // Arrow keys for fine movement (optional, useful for precise positioning)
    let moveX = 0;
    let moveY = 0;
    if (Input.isKeyPressed(KeyCode.ArrowUp)) moveY += 1;
    if (Input.isKeyPressed(KeyCode.ArrowDown)) moveY -= 1;
    if (Input.isKeyPressed(KeyCode.ArrowLeft)) moveX -= 1;
    if (Input.isKeyPressed(KeyCode.ArrowRight)) moveX += 1;

    if (moveX !== 0 || moveY !== 0) {
      const speed = this.moveSpeed2D / this.zoom2D;
      this.orthoCamera.position.x += moveX * speed * deltaTime;
      this.orthoCamera.position.y += moveY * speed * deltaTime;
    }

    // Scroll zoom
    const scrollDelta = Input.getScrollDeltaY();
    if (scrollDelta !== 0) {
      // Scroll up (negative deltaY) = zoom in, scroll down (positive deltaY) = zoom out
      this.zoom2D *= 1 - scrollDelta * this.zoomSpeed * 0.01;
      this.zoom2D = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, this.zoom2D));
      this.updateOrthoZoom();
    }
  }

  /**
   * Update orthographic camera bounds based on zoom
   */
  private updateOrthoZoom(): void {
    const { width, height } = this.renderer.getSize();
    const aspect = width / height;
    const halfWidth = (this.orthoSize / this.zoom2D) * aspect;
    const halfHeight = this.orthoSize / this.zoom2D;

    this.orthoCamera.left = -halfWidth;
    this.orthoCamera.right = halfWidth;
    this.orthoCamera.top = halfHeight;
    this.orthoCamera.bottom = -halfHeight;
    this.orthoCamera.updateProjectionMatrix();
  }

  /**
   * Update 3D perspective camera (WASD + QE movement, right-click mouse look)
   */
  private update3DCamera(deltaTime: number): void {
    // Get forward and right vectors from camera
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3(0, 1, 0);

    forward.applyQuaternion(this.perspectiveCamera.quaternion);
    right.applyQuaternion(this.perspectiveCamera.quaternion);

    // For fly mode, zero out Y to stay level (optional, can remove for free-fly)
    forward.y = 0;
    forward.normalize();
    right.y = 0;
    right.normalize();

    let moveX = 0;
    let moveY = 0;
    let moveZ = 0;

    // WASD movement
    if (Input.isKeyPressed(KeyCode.KeyW)) moveZ -= 1;
    if (Input.isKeyPressed(KeyCode.KeyS)) moveZ += 1;
    if (Input.isKeyPressed(KeyCode.KeyA)) moveX -= 1;
    if (Input.isKeyPressed(KeyCode.KeyD)) moveX += 1;
    if (Input.isKeyPressed(KeyCode.KeyQ)) moveY -= 1;
    if (Input.isKeyPressed(KeyCode.KeyE)) moveY += 1;

    if (moveX !== 0 || moveY !== 0 || moveZ !== 0) {
      const speed = this.moveSpeed3D * deltaTime;
      this.perspectiveCamera.position.addScaledVector(forward, -moveZ * speed);
      this.perspectiveCamera.position.addScaledVector(right, moveX * speed);
      this.perspectiveCamera.position.addScaledVector(up, moveY * speed);
    }

    // Right-click mouse look
    const rightMouseDown = Input.isMouseButtonPressed(MouseButton.Right);
    const mousePos = Input.getMousePosition();

    if (rightMouseDown) {
      if (!this.isDragging3D) {
        this.isDragging3D = true;
        this.lastMouseX = mousePos.x;
        this.lastMouseY = mousePos.y;
      } else {
        const deltaX = mousePos.x - this.lastMouseX;
        const deltaY = mousePos.y - this.lastMouseY;

        this.yaw -= deltaX * this.rotationSpeed;
        this.pitch -= deltaY * this.rotationSpeed;

        // Clamp pitch to prevent gimbal lock
        this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));

        // Apply rotation using Euler angles
        this.perspectiveCamera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

        this.lastMouseX = mousePos.x;
        this.lastMouseY = mousePos.y;
      }
    } else {
      this.isDragging3D = false;
    }
  }

  /**
   * Apply editor camera to renderer before rendering
   * This should be called in early render phase if editor camera is active
   */
  applyToRenderer(): void {
    if (this._isEditorCameraActive) {
      this.renderer.setCamera(this.getEditorCamera());
    }
  }

  /**
   * Get editor camera position
   */
  getPosition(): THREE.Vector3 {
    return this.getEditorCamera().position.clone();
  }

  /**
   * Set editor camera position
   */
  setPosition(x: number, y: number, z: number): void {
    this.orthoCamera.position.set(x, y, z);
    this.perspectiveCamera.position.set(x, y, z);
  }

  /**
   * Get current 2D zoom level
   */
  getZoom2D(): number {
    return this.zoom2D;
  }

  /**
   * Set 2D zoom level
   */
  setZoom2D(zoom: number): void {
    this.zoom2D = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, zoom));
    this.updateOrthoZoom();
  }
}
