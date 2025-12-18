/**
 * Camera Sync System
 *
 * Automatically synchronizes camera ECS components to the renderer's active camera.
 * This system handles:
 * - Selecting the active camera (MainCamera → first Camera → default)
 * - Syncing Transform3D position/rotation to camera
 * - Updating camera properties (fov, near, far, size, zoom) based on camera type
 * - Runtime camera type switching (perspective ↔ orthographic)
 * - Applying clear color from CameraClearColor component
 * - Handling window resize for aspect ratio
 *
 * Usage:
 * Just spawn a camera entity - the system handles everything automatically:
 * ```typescript
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 0, 10) })
 *   .with(Camera, { type: 'orthographic', size: 5 })
 *   .with(MainCamera, {})
 *   .build();
 * ```
 */

import * as THREE from 'three';
import { system } from '../system.js';
import type { Entity } from '../entity.js';
import { Transform3D, type Transform3DData } from '../components/rendering/transform-3d.js';
import { Camera, type CameraData } from '../components/rendering/camera.js';
import { CameraClearColor, type CameraClearColorData } from '../components/rendering/camera-clear-color.js';
import { MainCamera } from '../components/rendering/main-camera.js';
import { Render3DManager } from './renderer-sync-system.js';
import { EditorCameraManager } from '../../app/editor-camera-manager.js';

// Track if we've already warned about multiple MainCamera components
let hasWarnedMultipleMainCameras = false;

// Track camera instances per entity to detect type changes
const cameraInstanceMap = new Map<Entity, {
  threeCamera: THREE.Camera;
  lastType: 'perspective' | 'orthographic';
}>();

/**
 * Camera sync system - runs in the render phase before render3DSyncSystem
 */
export const cameraSyncSystem = system(({ commands }) => {
  // Skip if editor camera is active - editor camera takes priority
  const editorCameraManager = commands.getResource(EditorCameraManager);
  if (editorCameraManager?.isEditorCameraActive) {
    return;
  }

  const renderManager = commands.getResource(Render3DManager);
  const renderer = renderManager.getRenderer();
  const threeCamera = renderer.getCamera();

  // -------------------------------------------------------------------------
  // 1. Find the active camera entity
  // -------------------------------------------------------------------------
  let activeCameraEntity: Entity | null = null;

  // Priority 1: MainCamera component
  let mainCameraCount = 0;
  commands.query().all(MainCamera, Camera).each((entity) => {
    if (mainCameraCount === 0) {
      activeCameraEntity = entity;
    }
    mainCameraCount++;
  });

  // Warn if multiple MainCamera components exist
  if (mainCameraCount > 1 && !hasWarnedMultipleMainCameras) {
    console.warn(
      `[CameraSyncSystem] Found ${mainCameraCount} entities with MainCamera component. Using first one. ` +
      `Only one entity should have the MainCamera component at a time.`
    );
    hasWarnedMultipleMainCameras = true;
  } else if (mainCameraCount <= 1) {
    hasWarnedMultipleMainCameras = false;
  }

  // Priority 2: First Camera (if no MainCamera)
  if (!activeCameraEntity) {
    commands.query().all(Camera).each((entity) => {
      if (!activeCameraEntity) {
        activeCameraEntity = entity;
      }
    });
  }

  // Priority 3: Use renderer's default camera (if no camera entities exist)
  if (!activeCameraEntity) {
    // No camera entities - use default camera (already set in renderer)
    return;
  }

  // -------------------------------------------------------------------------
  // 2. Get Transform3D and camera data
  // -------------------------------------------------------------------------
  const transform = commands.tryGetComponent(activeCameraEntity, Transform3D);
  if (!transform) {
    console.warn(
      `[CameraSyncSystem] Active camera entity ${activeCameraEntity} is missing Transform3D component. ` +
      `Cameras require Transform3D for positioning. Using default camera.`
    );
    return;
  }

  const cameraData = commands.getComponent(activeCameraEntity, Camera);
  const cameraType = cameraData.type || 'perspective';

  // -------------------------------------------------------------------------
  // 3. Handle camera type switching
  // -------------------------------------------------------------------------
  const { width, height } = renderer.getSize();
  const aspect = width / height;

  // Check if we have a cached camera for this entity
  const cached = cameraInstanceMap.get(activeCameraEntity);
  const typeChanged = !cached || cached.lastType !== cameraType;

  let camera: THREE.Camera;

  if (typeChanged) {
    // Need to create/recreate the Three.js camera
    if (cameraType === 'perspective') {
      const newCamera = new THREE.PerspectiveCamera(
        cameraData.fov,
        aspect,
        cameraData.near,
        cameraData.far
      );
      newCamera.layers.enable(31); // Enable helper layer
      camera = newCamera;
    } else {
      // orthographic
      const effectiveSize = cameraData.size / cameraData.zoom;
      const halfWidth = effectiveSize * aspect;
      const newCamera = new THREE.OrthographicCamera(
        -halfWidth,
        halfWidth,
        effectiveSize,
        -effectiveSize,
        cameraData.near,
        cameraData.far
      );
      newCamera.layers.enable(31); // Enable helper layer
      camera = newCamera;
    }

    // Update cache
    cameraInstanceMap.set(activeCameraEntity, {
      threeCamera: camera,
      lastType: cameraType,
    });

    // Set as renderer's active camera
    renderer.setCamera(camera);
  } else {
    // Use cached camera
    camera = cached.threeCamera;
  }

  // -------------------------------------------------------------------------
  // 4. Update camera properties
  // -------------------------------------------------------------------------
  if (cameraType === 'perspective' && camera instanceof THREE.PerspectiveCamera) {
    camera.fov = cameraData.fov;
    camera.near = cameraData.near;
    camera.far = cameraData.far;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  } else if (cameraType === 'orthographic' && camera instanceof THREE.OrthographicCamera) {
    // Calculate bounds from size, zoom, and aspect ratio
    const effectiveSize = cameraData.size / cameraData.zoom;
    const halfWidth = effectiveSize * aspect;

    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = effectiveSize;
    camera.bottom = -effectiveSize;
    camera.near = cameraData.near;
    camera.far = cameraData.far;
    camera.updateProjectionMatrix();
  }

  // -------------------------------------------------------------------------
  // 5. Sync Transform3D to camera
  // -------------------------------------------------------------------------
  camera.position.set(
    transform.position.x,
    transform.position.y,
    transform.position.z
  );

  camera.rotation.set(
    transform.rotation.x,
    transform.rotation.y,
    transform.rotation.z,
    'YXZ' // Use YXZ order for camera rotation (yaw-pitch-roll)
  );

  // -------------------------------------------------------------------------
  // 6. Apply clear color if CameraClearColor component exists
  // -------------------------------------------------------------------------
  const clearColor = commands.tryGetComponent(activeCameraEntity, CameraClearColor);
  if (clearColor) {
    renderer.setClearColor(clearColor.color, clearColor.alpha);
  }
  // Note: If no CameraClearColor, the renderer keeps its current clear color
  // (we don't reset it to avoid flickering between cameras)
});
