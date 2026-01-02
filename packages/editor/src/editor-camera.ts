/**
 * EditorCamera - Camera controller for the editor's scene view
 *
 * Provides both orthographic (2D mode) and perspective (3D mode) cameras.
 * Allows switching between modes while preserving view direction.
 */

import {
  OrthographicCamera,
  PerspectiveCamera,
  Vector3,
} from '@voidscript/renderer';

/**
 * Camera mode for the editor
 */
export enum EditorCameraMode {
  /** 2D editing mode with orthographic projection */
  Orthographic = 'orthographic',
  /** 3D editing mode with perspective projection */
  Perspective = 'perspective',
}

/**
 * Configuration for EditorCamera
 */
export interface EditorCameraConfig {
  /** Initial camera mode */
  initialMode?: EditorCameraMode;
  /** Initial position */
  position?: { x: number; y: number; z: number };
  /** Point to look at */
  lookAt?: { x: number; y: number; z: number };
  /** Field of view for perspective camera (degrees) */
  fov?: number;
  /** Near clipping plane */
  near?: number;
  /** Far clipping plane */
  far?: number;
  /** Initial orthographic zoom (higher = zoomed out more) */
  orthoZoom?: number;
}

/** Layer 31 is reserved for editor-only objects */
const EDITOR_LAYER = 31;

/**
 * EditorCamera manages both orthographic and perspective cameras
 * for the editor's scene view. Only one is active at a time.
 */
export class EditorCamera {
  private perspectiveCamera: PerspectiveCamera;
  private orthographicCamera: OrthographicCamera;
  private currentMode: EditorCameraMode;

  // Shared state
  private _position: Vector3;
  private _target: Vector3;
  private _orthoZoom: number;

  constructor(config: EditorCameraConfig = {}) {
    const {
      initialMode = EditorCameraMode.Perspective,
      position = { x: 5, y: 5, z: 5 },
      lookAt = { x: 0, y: 0, z: 0 },
      fov = 60,
      near = 0.1,
      far = 1000,
      orthoZoom = 5,
    } = config;

    this._position = new Vector3(position.x, position.y, position.z);
    this._target = new Vector3(lookAt.x, lookAt.y, lookAt.z);
    this._orthoZoom = orthoZoom;
    this.currentMode = initialMode;

    // Create perspective camera
    this.perspectiveCamera = new PerspectiveCamera(fov, 1, near, far);
    this.perspectiveCamera.position.copy(this._position);
    this.perspectiveCamera.lookAt(this._target);
    // Enable layer 31 to see editor helpers
    this.perspectiveCamera.layers.enable(EDITOR_LAYER);

    // Create orthographic camera (will be sized in updateAspect)
    this.orthographicCamera = new OrthographicCamera(
      -orthoZoom,
      orthoZoom,
      orthoZoom,
      -orthoZoom,
      near,
      far,
    );
    this.orthographicCamera.position.copy(this._position);
    this.orthographicCamera.lookAt(this._target);
    // Enable layer 31 to see editor helpers
    this.orthographicCamera.layers.enable(EDITOR_LAYER);
  }

  /**
   * Get the currently active camera (based on mode)
   */
  getActiveCamera(): PerspectiveCamera | OrthographicCamera {
    return this.currentMode === EditorCameraMode.Perspective
      ? this.perspectiveCamera
      : this.orthographicCamera;
  }

  /**
   * Get the perspective camera directly
   */
  getPerspectiveCamera(): PerspectiveCamera {
    return this.perspectiveCamera;
  }

  /**
   * Get the orthographic camera directly
   */
  getOrthographicCamera(): OrthographicCamera {
    return this.orthographicCamera;
  }

  /**
   * Get the current camera mode
   */
  getMode(): EditorCameraMode {
    return this.currentMode;
  }

  /**
   * Set the camera mode
   */
  setMode(mode: EditorCameraMode): void {
    if (mode === this.currentMode) return;

    this.currentMode = mode;

    // Sync position and target when switching modes
    const newCamera = this.getActiveCamera();
    newCamera.position.copy(this._position);
    newCamera.lookAt(this._target);
    newCamera.updateProjectionMatrix();
  }

  /**
   * Toggle between perspective and orthographic modes
   */
  toggleMode(): void {
    this.setMode(
      this.currentMode === EditorCameraMode.Perspective
        ? EditorCameraMode.Orthographic
        : EditorCameraMode.Perspective,
    );
  }

  /**
   * Update the camera aspect ratio (call on resize)
   */
  updateAspect(width: number, height: number): void {
    const aspect = width / height;

    // Update perspective camera
    this.perspectiveCamera.aspect = aspect;
    this.perspectiveCamera.updateProjectionMatrix();

    // Update orthographic camera bounds based on aspect and zoom
    const halfHeight = this._orthoZoom;
    const halfWidth = halfHeight * aspect;
    this.orthographicCamera.left = -halfWidth;
    this.orthographicCamera.right = halfWidth;
    this.orthographicCamera.top = halfHeight;
    this.orthographicCamera.bottom = -halfHeight;
    this.orthographicCamera.updateProjectionMatrix();
  }

  /**
   * Set the camera position
   */
  setPosition(x: number, y: number, z: number): void {
    this._position.set(x, y, z);
    this.perspectiveCamera.position.copy(this._position);
    this.orthographicCamera.position.copy(this._position);
  }

  /**
   * Get the current camera position
   */
  getPosition(): Vector3 {
    return this._position.clone();
  }

  /**
   * Set the look-at target
   */
  setTarget(x: number, y: number, z: number): void {
    this._target.set(x, y, z);
    this.perspectiveCamera.lookAt(this._target);
    this.orthographicCamera.lookAt(this._target);
  }

  /**
   * Get the current look-at target
   */
  getTarget(): Vector3 {
    return this._target.clone();
  }

  /**
   * Set orthographic zoom level
   * @param zoom - Higher values = more zoomed out
   */
  setOrthoZoom(zoom: number): void {
    this._orthoZoom = zoom;
    // Will be properly applied on next updateAspect call
  }

  /**
   * Get current orthographic zoom level
   */
  getOrthoZoom(): number {
    return this._orthoZoom;
  }

  /**
   * Check if the camera is in 2D (orthographic) mode
   */
  is2DMode(): boolean {
    return this.currentMode === EditorCameraMode.Orthographic;
  }

  /**
   * Check if the camera is in 3D (perspective) mode
   */
  is3DMode(): boolean {
    return this.currentMode === EditorCameraMode.Perspective;
  }
}
