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
  VirtualCameraBounds,
  type VirtualCameraBoundsData,
} from "../components/rendering/virtual-camera-bounds.js";
import {
  VirtualCameraFollow,
  type VirtualCameraFollowData,
} from "../components/rendering/virtual-camera-follow.js";
import { Render3DManager } from "./renderer-sync-system.js";

/**
 * Resolved world-space bounds (min/max) from a VirtualCameraBounds entity
 */
interface ResolvedBounds {
  min: { x: number; y: number };
  max: { x: number; y: number };
}

/**
 * System that updates virtual camera positions based on follow settings.
 *
 * Runs in the 'update' phase before virtualCameraSelectionSystem.
 * Only executes during gameplay (play mode or pure game).
 */
export const virtualCameraFollowSystem = system(({ commands }) => {
  const deltaTime = commands.getDeltaTime();

  // Get aspect ratio from Render3DManager for bounds calculation
  const render3DManager = commands.tryGetResource(Render3DManager);
  let aspect = 16 / 9; // Fallback aspect ratio
  if (render3DManager) {
    const size = render3DManager.getRenderer().getSize();
    if (size.width > 0 && size.height > 0) {
      aspect = size.width / size.height;
    }
  }

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

        // Apply camera bounds after first frame snap
        if (vcam.enableCameraBounds && vcam.boundsEntity != null) {
          const resolvedBounds = resolveBoundsFromEntity(
            vcam.boundsEntity,
            commands
          );
          if (resolvedBounds) {
            clampToBounds(transform.position, resolvedBounds, vcam, aspect);
          }
        }
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

      // Get camera visible dimensions for dead zone calculations
      let cameraVisibleDimensions: { width: number; height: number } | undefined;
      if (follow.mode === 'transposer' && follow.enableDeadZone) {
        const viewportSize = render3DManager?.getRenderer().getSize();
        if (viewportSize) {
          const aspect = viewportSize.width / viewportSize.height;

          if (vcam.type === 'perspective') {
            // For perspective, calculate visible dimensions at camera's Z distance
            const approximateDistance = Math.abs(transform.position.z);
            const fovRadians = (vcam.fov * Math.PI) / 180;
            const visibleHeight = 2 * Math.tan(fovRadians / 2) * approximateDistance;
            const visibleWidth = visibleHeight * aspect;
            cameraVisibleDimensions = { width: visibleWidth, height: visibleHeight };
          } else {
            // For orthographic, use camera size
            const orthoHeight = vcam.size / vcam.zoom;
            const orthoWidth = orthoHeight * aspect;
            cameraVisibleDimensions = { width: orthoWidth, height: orthoHeight };
          }
        }
      }

      // Apply mode-specific behavior
      switch (follow.mode) {
        case "hardLock":
          applyHardLock(transform, targetTransform, follow, lookahead);
          break;

        case "transposer":
          if (follow.enableDeadZone && cameraVisibleDimensions) {
            applyTransposerWithDeadZone(
              transform,
              targetTransform,
              follow,
              cameraVisibleDimensions,
              deltaTime
            );
          } else {
            applyTransposer(
              transform,
              targetTransform,
              follow,
              lookahead,
              deltaTime
            );
          }
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
      }

      // Apply camera bounds AFTER follow mode calculation
      if (vcam.enableCameraBounds && vcam.boundsEntity != null) {
        const resolvedBounds = resolveBoundsFromEntity(
          vcam.boundsEntity,
          commands
        );
        if (resolvedBounds) {
          clampToBounds(transform.position, resolvedBounds, vcam, aspect);
        }
      }
    });
});

/**
 * Resolves world-space bounds from a VirtualCameraBounds entity.
 * The bounds are centered on the entity's Transform3D position with the specified size.
 *
 * @param boundsEntity - Entity with VirtualCameraBounds and Transform3D components
 * @param commands - Commands instance for querying components
 * @returns Resolved bounds in world space, or null if entity is invalid
 */
function resolveBoundsFromEntity(
  boundsEntity: number,
  commands: {
    tryGetComponent: <T>(
      entity: number,
      type: import("../component.js").ComponentType<T>
    ) => T | undefined;
  }
): ResolvedBounds | null {
  const boundsComp = commands.tryGetComponent(boundsEntity, VirtualCameraBounds);
  const boundsTransform = commands.tryGetComponent(boundsEntity, Transform3D);

  if (!boundsComp || !boundsTransform) {
    return null;
  }

  // Calculate world-space bounds from entity position and size
  const halfWidth = boundsComp.size.x / 2;
  const halfHeight = boundsComp.size.y / 2;

  return {
    min: {
      x: boundsTransform.position.x - halfWidth,
      y: boundsTransform.position.y - halfHeight,
    },
    max: {
      x: boundsTransform.position.x + halfWidth,
      y: boundsTransform.position.y + halfHeight,
    },
  };
}

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

/**
 * Clamp camera position to bounds, accounting for visible area
 *
 * For orthographic cameras, the visible area is calculated from size/zoom and aspect ratio.
 * For perspective cameras, only position clamping is applied (visible area varies with distance).
 *
 * @param position - Camera position to clamp (modified in place)
 * @param bounds - 2D bounds in world space (resolved from VirtualCameraBounds entity)
 * @param vcamData - VirtualCamera data for projection info
 * @param aspect - Viewport aspect ratio (width/height)
 */
function clampToBounds(
  position: { x: number; y: number; z: number },
  bounds: ResolvedBounds,
  vcamData: VirtualCameraData,
  aspect: number
): void {
  // Calculate visible half-extents for orthographic cameras
  let halfWidth = 0;
  let halfHeight = 0;

  if (vcamData.type === "orthographic") {
    halfHeight = vcamData.size / vcamData.zoom;
    halfWidth = halfHeight * aspect;
  }
  // For perspective, halfWidth/halfHeight remain 0 (position-only clamping)

  // Calculate effective bounds (shrunk by visible area)
  const effectiveMinX = bounds.min.x + halfWidth;
  const effectiveMaxX = bounds.max.x - halfWidth;
  const effectiveMinY = bounds.min.y + halfHeight;
  const effectiveMaxY = bounds.max.y - halfHeight;

  // Handle case where visible area is larger than bounds (center the camera)
  if (effectiveMinX >= effectiveMaxX) {
    // Visible width >= bounds width, center on X
    position.x = (bounds.min.x + bounds.max.x) / 2;
  } else {
    position.x = Math.max(effectiveMinX, Math.min(effectiveMaxX, position.x));
  }

  if (effectiveMinY >= effectiveMaxY) {
    // Visible height >= bounds height, center on Y
    position.y = (bounds.min.y + bounds.max.y) / 2;
  } else {
    position.y = Math.max(effectiveMinY, Math.min(effectiveMaxY, position.y));
  }
}

/**
 * Computes axis correction based on dead zone and soft zone.
 * Based on user's DeadZoneCamera2D implementation.
 *
 * @param value - Relative position on this axis
 * @param deadHalf - Half-width of dead zone
 * @param softHalf - Half-width of soft zone
 * @returns Correction amount to apply
 */
function computeAxisCorrection(value: number, deadHalf: number, softHalf: number): number {
  const abs = Math.abs(value);
  const sign = Math.sign(value);

  // Dead zone → no movement
  if (abs <= deadHalf) return 0;

  // Outside soft zone → hard correction
  if (abs >= softHalf) {
    return value - sign * softHalf;
  }

  // Inside soft zone → damped correction with quadratic easing
  const softRange = softHalf - deadHalf;
  const excess = abs - deadHalf;
  const t = excess / softRange;

  // Quadratic ease (Cinemachine-like)
  const eased = t * t;

  return sign * eased * softRange;
}

/**
 * Transposer with dead zone - world-space dead zone follow.
 * The target can move within the dead zone without the camera moving.
 * When outside the dead zone, the camera smoothly moves to keep the target
 * within the soft zone, with interpolation based on distance from dead zone edge.
 *
 * @param transform - Camera transform (modified in place)
 * @param targetTransform - Target entity's transform
 * @param follow - VirtualCameraFollow component data
 * @param cameraVisibleDimensions - Camera's visible width/height in world units
 * @param deltaTime - Time since last frame
 */
function applyTransposerWithDeadZone(
  transform: { position: { x: number; y: number; z: number } },
  targetTransform: { position: { x: number; y: number; z: number } },
  follow: VirtualCameraFollowData,
  cameraVisibleDimensions: { width: number; height: number },
  deltaTime: number
): void {
  // Initialize missing properties for backward compatibility
  if (!follow.deadZone || follow.deadZone.width === undefined || follow.deadZone.height === undefined) {
    follow.deadZone = { width: 0.1, height: 0.1 };
  }
  if (!follow.softZone || follow.softZone.width === undefined || follow.softZone.height === undefined) {
    follow.softZone = { width: 0.3, height: 0.3 };
  }

  // Convert viewport units (0-1) to world units
  // Dead zone and soft zone are defined as viewport percentages
  const deadZoneWorldWidth = follow.deadZone.width * cameraVisibleDimensions.width;
  const deadZoneWorldHeight = follow.deadZone.height * cameraVisibleDimensions.height;
  const softZoneWorldWidth = follow.softZone.width * cameraVisibleDimensions.width;
  const softZoneWorldHeight = follow.softZone.height * cameraVisibleDimensions.height;

  // Calculate relative position (target - dead zone center)
  // The dead zone center is at camera position + offset
  const deadZoneCenter = {
    x: transform.position.x + follow.offset.x,
    y: transform.position.y + follow.offset.y,
  };
  const relative = {
    x: targetTransform.position.x - deadZoneCenter.x,
    y: targetTransform.position.y - deadZoneCenter.y,
  };

  // Compute correction for each axis using dead zone logic
  const correctionX = computeAxisCorrection(
    relative.x,
    deadZoneWorldWidth * 0.5,
    softZoneWorldWidth * 0.5
  );
  const correctionY = computeAxisCorrection(
    relative.y,
    deadZoneWorldHeight * 0.5,
    softZoneWorldHeight * 0.5
  );

  // Get damping values
  const dampX = follow.dampingPerAxis?.x ?? follow.damping;
  const dampY = follow.dampingPerAxis?.y ?? follow.damping;

  // Apply correction with damping
  const followStrength = 5;
  transform.position.x += correctionX * followStrength * dampX * deltaTime;
  transform.position.y += correctionY * followStrength * dampY * deltaTime;

  // Handle Z axis
  if (!follow.ignoreZ) {
    const dampZ = follow.dampingPerAxis?.z ?? follow.damping;
    const targetZ = targetTransform.position.z + follow.offset.z;
    const tZ = dampZ > 0 ? 1 - Math.exp(-dampZ * deltaTime) : 1;
    transform.position.z += (targetZ - transform.position.z) * tZ;
  }
}
