/**
 * Camera Brain System
 *
 * Interpolates the MainCamera's Transform3D and Camera components
 * to match the active VirtualCamera state, with smooth blending
 * during camera transitions.
 *
 * This system runs in the render phase, after virtualCameraSelectionSystem
 * and before cameraSyncSystem.
 */

import { system } from "../system.js";
import { Transform3D } from "../components/rendering/transform-3d.js";
import { Camera, type CameraData } from "../components/rendering/camera.js";
import { MainCamera } from "../components/rendering/main-camera.js";
import {
  CameraBrain,
  type BlendCurve,
} from "../components/rendering/camera-brain.js";
import {
  VirtualCamera,
  type VirtualCameraData,
} from "../components/rendering/virtual-camera.js";
import { virtualCameraSelectionSystem } from "./virtual-camera-selection-system.js";

// Easing functions for blend curves
const easingFunctions: Record<BlendCurve, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
};

/**
 * Lerp helper
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Shortest angle lerp for rotations (handles wrapping)
 */
function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  // Normalize to [-PI, PI]
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

/**
 * System that interpolates MainCamera to active VirtualCamera state.
 *
 * Runs in the render phase after virtualCameraSelectionSystem.
 * Handles:
 * - Position interpolation with easing
 * - Rotation interpolation (slerp-like via angle lerp)
 * - Camera property interpolation (fov, size, zoom, near, far)
 * - Camera type switching at blend midpoint
 * - Dutch angle application
 */
export const cameraBrainSystem = system(({ commands }) => {
  commands
    .query()
    .all(CameraBrain, MainCamera, Camera, Transform3D)
    .each((brainEntity, brain, mainCamera, camera, brainTransform) => {
      // No active virtual camera - nothing to do
      if (!brain._activeVCam) {
        return;
      }

      // Get active vcam data
      const activeVCam = commands.tryGetComponent(
        brain._activeVCam,
        VirtualCamera
      );
      const activeTransform = commands.tryGetComponent(
        brain._activeVCam,
        Transform3D
      );

      if (!activeVCam || !activeTransform) {
        return;
      }

      // Calculate target values
      let targetPos = {
        x: activeTransform.position.x,
        y: activeTransform.position.y,
        z: activeTransform.position.z,
      };

      let targetRot = {
        x: activeTransform.rotation.x,
        y: activeTransform.rotation.y,
        z: activeTransform.rotation.z + (activeVCam.dutch * Math.PI) / 180, // Apply dutch angle
      };

      let targetCameraProps = {
        type: activeVCam.type,
        fov: activeVCam.fov,
        size: activeVCam.size,
        zoom: activeVCam.zoom,
        near: activeVCam.near,
        far: activeVCam.far,
      };

      // If blending, interpolate between previous and active
      if (brain._isBlending && brain._previousVCam) {
        const prevVCam = commands.tryGetComponent(
          brain._previousVCam,
          VirtualCamera
        );
        const prevTransform = commands.tryGetComponent(
          brain._previousVCam,
          Transform3D
        );

        if (prevVCam && prevTransform) {
          // Apply easing curve to blend progress
          const t = easingFunctions[brain.blendCurve](brain._blendProgress);

          // Lerp position
          targetPos = {
            x: lerp(prevTransform.position.x, activeTransform.position.x, t),
            y: lerp(prevTransform.position.y, activeTransform.position.y, t),
            z: lerp(prevTransform.position.z, activeTransform.position.z, t),
          };

          // Lerp rotation with angle wrapping
          const prevDutchRad = (prevVCam.dutch * Math.PI) / 180;
          const activeDutchRad = (activeVCam.dutch * Math.PI) / 180;

          targetRot = {
            x: lerpAngle(prevTransform.rotation.x, activeTransform.rotation.x, t),
            y: lerpAngle(prevTransform.rotation.y, activeTransform.rotation.y, t),
            z: lerpAngle(
              prevTransform.rotation.z + prevDutchRad,
              activeTransform.rotation.z + activeDutchRad,
              t
            ),
          };

          // Lerp camera properties
          // Camera type snaps at midpoint to avoid weird in-between states
          targetCameraProps = {
            type: t >= 0.5 ? activeVCam.type : prevVCam.type,
            fov: lerp(prevVCam.fov, activeVCam.fov, t),
            size: lerp(prevVCam.size, activeVCam.size, t),
            zoom: lerp(prevVCam.zoom, activeVCam.zoom, t),
            near: lerp(prevVCam.near, activeVCam.near, t),
            far: lerp(prevVCam.far, activeVCam.far, t),
          };
        }
      }

      // Apply to brain's Transform3D
      brainTransform.position.x = targetPos.x;
      brainTransform.position.y = targetPos.y;
      brainTransform.position.z = targetPos.z;
      brainTransform.rotation.x = targetRot.x;
      brainTransform.rotation.y = targetRot.y;
      brainTransform.rotation.z = targetRot.z;

      // Apply to brain's Camera component
      camera.type = targetCameraProps.type;
      camera.fov = targetCameraProps.fov;
      camera.size = targetCameraProps.size;
      camera.zoom = targetCameraProps.zoom;
      camera.near = targetCameraProps.near;
      camera.far = targetCameraProps.far;
    });
}).runAfter(virtualCameraSelectionSystem);
