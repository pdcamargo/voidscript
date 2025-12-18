/**
 * Virtual Camera Follow System
 *
 * Updates VirtualCamera positions based on their follow targets.
 * Handles different follow modes (transposer, hardLock, 2dFollow, orbital, etc.)
 * with configurable damping and look-ahead.
 *
 * This system runs in the update phase before camera selection.
 */

import { system } from "../system.js";
import { Transform3D } from "../components/rendering/transform-3d.js";
import {
  VirtualCamera,
  type VirtualCameraData,
} from "../components/rendering/virtual-camera.js";
import {
  VirtualCameraFollow,
  type VirtualCameraFollowData,
} from "../components/rendering/virtual-camera-follow.js";

/**
 * System that updates virtual camera positions based on follow settings.
 *
 * Runs in the 'update' phase before virtualCameraSelectionSystem.
 * Only executes during gameplay (play mode or pure game).
 */
export const virtualCameraFollowSystem = system(({ commands }) => {
  const deltaTime = commands.getDeltaTime();

  // Process all virtual cameras with follow components
  commands
    .query()
    .all(VirtualCamera, VirtualCameraFollow, Transform3D)
    .each((entity, vcam, follow, transform) => {
      // Initialize runtime fields if they don't exist (e.g., after deserialization)
      // Track if this is the first frame (for snapping)
      const isFirstFrame = !follow._targetVelocity;
      if (!follow._targetVelocity) {
        follow._targetVelocity = { x: 0, y: 0, z: 0 };
      }
      if (!follow._lookaheadPosition) {
        follow._lookaheadPosition = { x: 0, y: 0, z: 0 };
      }

      // Skip disabled vcams or no-follow mode
      if (!vcam.enabled || follow.mode === "none" || !follow.target) {
        return;
      }

      // Get target transform
      const targetTransform = commands.tryGetComponent(
        follow.target,
        Transform3D
      );
      if (!targetTransform) {
        return;
      }

      // On first frame, snap to target position immediately (no lerping)
      if (isFirstFrame || !follow._lastTargetPosition) {
        snapToTarget(transform, targetTransform, follow);
        follow._lastTargetPosition = {
          x: targetTransform.position.x,
          y: targetTransform.position.y,
          z: targetTransform.position.z,
        };
        return;
      }

      // Calculate target velocity for look-ahead
      updateTargetVelocity(follow, targetTransform, deltaTime);

      // Calculate base target position with look-ahead
      const lookahead = {
        x: follow._targetVelocity.x * follow.lookaheadTime,
        y: follow._targetVelocity.y * follow.lookaheadTime,
        z: follow._targetVelocity.z * follow.lookaheadTime,
      };

      // Apply mode-specific behavior
      switch (follow.mode) {
        case "hardLock":
          applyHardLock(transform, targetTransform, follow, lookahead);
          break;

        case "transposer":
          applyTransposer(
            transform,
            targetTransform,
            follow,
            lookahead,
            deltaTime
          );
          break;

        case "2dFollow":
          apply2DFollow(
            transform,
            targetTransform,
            follow,
            lookahead,
            deltaTime
          );
          break;

        case "orbitalTransposer":
          applyOrbitalTransposer(
            transform,
            targetTransform,
            follow,
            deltaTime
          );
          break;

        case "framedTransposer":
          // TODO: Implement screen-space framing
          applyTransposer(
            transform,
            targetTransform,
            follow,
            lookahead,
            deltaTime
          );
          break;
      }
    });
});

/**
 * Snap camera to target position immediately (no interpolation)
 * Used on first frame to avoid jump from initial camera position
 */
function snapToTarget(
  transform: { position: { x: number; y: number; z: number } },
  targetTransform: { position: { x: number; y: number; z: number } },
  follow: VirtualCameraFollowData
): void {
  transform.position.x = targetTransform.position.x + follow.offset.x;
  transform.position.y = targetTransform.position.y + follow.offset.y;

  // For 2D modes or ignoreZ, keep the current Z
  if (follow.mode === "2dFollow" || follow.ignoreZ) {
    // Keep existing Z
  } else {
    transform.position.z = targetTransform.position.z + follow.offset.z;
  }
}

/**
 * Updates the target velocity tracking for look-ahead calculations.
 */
function updateTargetVelocity(
  follow: VirtualCameraFollowData,
  targetTransform: { position: { x: number; y: number; z: number } },
  deltaTime: number
): void {
  if (follow._lastTargetPosition && deltaTime > 0) {
    const dx = targetTransform.position.x - follow._lastTargetPosition.x;
    const dy = targetTransform.position.y - follow._lastTargetPosition.y;
    const dz = targetTransform.position.z - follow._lastTargetPosition.z;

    // Smooth velocity changes
    const smoothing = 1 - Math.exp(-follow.lookaheadSmoothing * deltaTime);
    follow._targetVelocity.x +=
      (dx / deltaTime - follow._targetVelocity.x) * smoothing;
    follow._targetVelocity.y +=
      (dy / deltaTime - follow._targetVelocity.y) * smoothing;
    follow._targetVelocity.z +=
      (dz / deltaTime - follow._targetVelocity.z) * smoothing;
  }

  // Store current position for next frame
  follow._lastTargetPosition = {
    x: targetTransform.position.x,
    y: targetTransform.position.y,
    z: targetTransform.position.z,
  };
}

/**
 * Hard lock - instant position sync with offset
 */
function applyHardLock(
  transform: { position: { x: number; y: number; z: number } },
  targetTransform: { position: { x: number; y: number; z: number } },
  follow: VirtualCameraFollowData,
  lookahead: { x: number; y: number; z: number }
): void {
  transform.position.x =
    targetTransform.position.x + lookahead.x + follow.offset.x;
  transform.position.y =
    targetTransform.position.y + lookahead.y + follow.offset.y;
  transform.position.z =
    targetTransform.position.z + lookahead.z + follow.offset.z;
}

/**
 * Transposer - smooth follow with damping
 */
function applyTransposer(
  transform: { position: { x: number; y: number; z: number } },
  targetTransform: { position: { x: number; y: number; z: number } },
  follow: VirtualCameraFollowData,
  lookahead: { x: number; y: number; z: number },
  deltaTime: number
): void {
  const targetPos = {
    x: targetTransform.position.x + lookahead.x + follow.offset.x,
    y: targetTransform.position.y + lookahead.y + follow.offset.y,
    z: follow.ignoreZ
      ? transform.position.z
      : targetTransform.position.z + lookahead.z + follow.offset.z,
  };

  // Get damping values (per-axis or uniform)
  const dampX = follow.dampingPerAxis?.x ?? follow.damping;
  const dampY = follow.dampingPerAxis?.y ?? follow.damping;
  const dampZ = follow.dampingPerAxis?.z ?? follow.damping;

  // Exponential damping for smooth interpolation
  // Higher damping = slower/smoother movement
  const tX = dampX > 0 ? 1 - Math.exp(-dampX * deltaTime) : 1;
  const tY = dampY > 0 ? 1 - Math.exp(-dampY * deltaTime) : 1;
  const tZ = dampZ > 0 ? 1 - Math.exp(-dampZ * deltaTime) : 1;

  transform.position.x += (targetPos.x - transform.position.x) * tX;
  transform.position.y += (targetPos.y - transform.position.y) * tY;
  if (!follow.ignoreZ) {
    transform.position.z += (targetPos.z - transform.position.z) * tZ;
  }
}

/**
 * 2D Follow - optimized for side-scrollers/top-down
 */
function apply2DFollow(
  transform: { position: { x: number; y: number; z: number } },
  targetTransform: { position: { x: number; y: number; z: number } },
  follow: VirtualCameraFollowData,
  lookahead: { x: number; y: number; z: number },
  deltaTime: number
): void {
  // 2D follow is essentially transposer with ignoreZ forced
  const targetPos = {
    x: targetTransform.position.x + lookahead.x + follow.offset.x,
    y: targetTransform.position.y + lookahead.y + follow.offset.y,
  };

  // Get damping values (per-axis or uniform)
  const dampX = follow.dampingPerAxis?.x ?? follow.damping;
  const dampY = follow.dampingPerAxis?.y ?? follow.damping;

  // Exponential damping
  const tX = dampX > 0 ? 1 - Math.exp(-dampX * deltaTime) : 1;
  const tY = dampY > 0 ? 1 - Math.exp(-dampY * deltaTime) : 1;

  transform.position.x += (targetPos.x - transform.position.x) * tX;
  transform.position.y += (targetPos.y - transform.position.y) * tY;
  // Z stays constant for 2D
}

/**
 * Orbital Transposer - orbit around target
 */
function applyOrbitalTransposer(
  transform: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  },
  targetTransform: { position: { x: number; y: number; z: number } },
  follow: VirtualCameraFollowData,
  deltaTime: number
): void {
  // Convert angles to radians
  const angleX = (follow.orbitalAngleX * Math.PI) / 180;
  const angleY = (follow.orbitalAngleY * Math.PI) / 180;
  const radius = follow.orbitalRadius;

  // Calculate orbital position offset
  const orbitalOffset = {
    x: Math.sin(angleX) * Math.cos(angleY) * radius,
    y: Math.sin(angleY) * radius,
    z: Math.cos(angleX) * Math.cos(angleY) * radius,
  };

  const targetPos = {
    x: targetTransform.position.x + orbitalOffset.x,
    y: targetTransform.position.y + orbitalOffset.y,
    z: targetTransform.position.z + orbitalOffset.z,
  };

  // Damped movement to orbital position
  const damp = follow.damping;
  const t = damp > 0 ? 1 - Math.exp(-damp * deltaTime) : 1;

  transform.position.x += (targetPos.x - transform.position.x) * t;
  transform.position.y += (targetPos.y - transform.position.y) * t;
  transform.position.z += (targetPos.z - transform.position.z) * t;

  // Calculate look-at rotation
  const dx = targetTransform.position.x - transform.position.x;
  const dy = targetTransform.position.y - transform.position.y;
  const dz = targetTransform.position.z - transform.position.z;

  // Calculate yaw (Y rotation) and pitch (X rotation)
  const yaw = Math.atan2(dx, dz);
  const horizontalDist = Math.sqrt(dx * dx + dz * dz);
  const pitch = -Math.atan2(dy, horizontalDist);

  // Apply rotation with damping
  const rotT = damp > 0 ? 1 - Math.exp(-damp * 2 * deltaTime) : 1;
  transform.rotation.x += (pitch - transform.rotation.x) * rotT;
  transform.rotation.y += (yaw - transform.rotation.y) * rotT;
  transform.rotation.z = 0; // No roll for orbital
}
