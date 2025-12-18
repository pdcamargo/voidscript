/**
 * Virtual Camera Selection System
 *
 * Selects the active virtual camera based on priority.
 * Handles camera switching with blend tracking for smooth transitions.
 *
 * This system runs in the render phase, before cameraBrainSystem.
 */

import { system } from "../system.js";
import type { Entity } from "../entity.js";
import { Transform3D } from "../components/rendering/transform-3d.js";
import { Camera } from "../components/rendering/camera.js";
import { MainCamera } from "../components/rendering/main-camera.js";
import {
  CameraBrain,
  type CameraBrainData,
} from "../components/rendering/camera-brain.js";
import { VirtualCamera } from "../components/rendering/virtual-camera.js";
import { virtualCameraFollowSystem } from "./virtual-camera-follow-system.js";

/**
 * System that selects the active virtual camera based on priority.
 *
 * Runs in the render phase after virtualCameraFollowSystem.
 * Handles:
 * - Finding highest priority enabled VirtualCamera
 * - Detecting camera switches
 * - Initiating blend transitions
 * - Updating blend progress
 */
export const virtualCameraSelectionSystem = system(({ commands }) => {
  const deltaTime = commands.getDeltaTime();

  // Find entities with CameraBrain (should be attached to MainCamera)
  commands
    .query()
    .all(CameraBrain, MainCamera, Camera, Transform3D)
    .each((brainEntity, brain) => {
      // Find highest priority enabled virtual camera
      let highestPriority = -Infinity;
      let activeVCamEntity: Entity | null = null;

      commands
        .query()
        .all(VirtualCamera, Transform3D)
        .each((vcamEntity, vcam) => {
          if (vcam.enabled && vcam.priority > highestPriority) {
            highestPriority = vcam.priority;
            activeVCamEntity = vcamEntity;
          }
        });

      // Handle camera changes
      if (activeVCamEntity !== brain._activeVCam) {
        // Start blend to new camera
        brain._previousVCam = brain._activeVCam;
        brain._activeVCam = activeVCamEntity;
        brain._blendProgress = 0;

        // Only blend if we had a previous camera and blend time is > 0
        brain._isBlending =
          brain._previousVCam !== null && brain.blendTime > 0;
      }

      // Update blend progress
      if (brain._isBlending && brain.blendTime > 0) {
        brain._blendProgress += deltaTime / brain.blendTime;
        if (brain._blendProgress >= 1) {
          brain._blendProgress = 1;
          brain._isBlending = false;
          brain._previousVCam = null;
        }
      }
    });
}).runAfter(virtualCameraFollowSystem);
