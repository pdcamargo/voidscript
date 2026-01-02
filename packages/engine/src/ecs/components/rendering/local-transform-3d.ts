/**
 * LocalTransform3D Component
 *
 * Represents the position, rotation, and scale of an entity relative to its parent.
 * When an entity has a Parent component, LocalTransform3D defines the offset from
 * the parent's transform. The TransformPropagationSystem computes the final
 * world-space Transform3D from the hierarchy.
 *
 * Usage:
 * - Entities with Parent + LocalTransform3D: Position is relative to parent
 * - Entities with only Transform3D (no Parent): Position is world-space
 * - Both can coexist: LocalTransform3D is the "source", Transform3D is computed
 *
 * Position: Offset from parent position (x, y, z)
 * Rotation: Additional rotation in radians (Euler angles, applied after parent rotation)
 * Scale: Scale multiplier (multiplied with parent scale)
 */

import { component } from '@voidscript/core';
import { Vector3 } from '../../../math/index.js';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

export interface LocalTransform3DData {
  /** Position relative to parent */
  position: Vector3;
  /** Rotation relative to parent in radians (Euler angles) */
  rotation: Vector3;
  /** Scale relative to parent (multiplied) */
  scale: Vector3;
}

// Helper to serialize Vector3 or plain object (handles deep-copied data)
const serializeVector3 = (val: Vector3 | { x: number; y: number; z: number }) =>
  'toJSON' in val && typeof val.toJSON === 'function'
    ? val.toJSON()
    : { x: val.x, y: val.y, z: val.z };

export const LocalTransform3D = component<LocalTransform3DData>(
  'LocalTransform3D',
  {
    position: {
      serializable: true,
      customSerializer: {
        serialize: serializeVector3,
        deserialize: (val) =>
          Vector3.fromJSON(val as { x: number; y: number; z: number }),
      },
    },
    rotation: {
      serializable: true,
      customSerializer: {
        serialize: serializeVector3,
        deserialize: (val) =>
          Vector3.fromJSON(val as { x: number; y: number; z: number }),
      },
    },
    scale: {
      serializable: true,
      customSerializer: {
        serialize: serializeVector3,
        deserialize: (val) =>
          Vector3.fromJSON(val as { x: number; y: number; z: number }),
      },
    },
  },
  {
    path: 'transform/3d',
    defaultValue: () => ({
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
    }),
    displayName: 'Local Transform 3D',
    description: 'Transform relative to parent entity',
    customEditor: ({ componentData }) => {
      EditorLayout.beginLabelsWidth(['Position', 'Rotation', 'Scale']);

      const [position, posChanged] = EditorLayout.vector3Field(
        'Position',
        componentData.position,
        { speed: 0.1, tooltip: 'Position offset relative to parent' }
      );
      if (posChanged) {
        componentData.position.x = position.x;
        componentData.position.y = position.y;
        componentData.position.z = position.z;
      }

      const [rotation, rotChanged] = EditorLayout.vector3Field(
        'Rotation',
        componentData.rotation,
        { speed: 0.01, tooltip: 'Rotation offset in radians (Euler angles)' }
      );
      if (rotChanged) {
        componentData.rotation.x = rotation.x;
        componentData.rotation.y = rotation.y;
        componentData.rotation.z = rotation.z;
      }

      const [scale, scaleChanged] = EditorLayout.vector3Field(
        'Scale',
        componentData.scale,
        { speed: 0.01, tooltip: 'Scale multiplier relative to parent' }
      );
      if (scaleChanged) {
        componentData.scale.x = scale.x;
        componentData.scale.y = scale.y;
        componentData.scale.z = scale.z;
      }

      EditorLayout.endLabelsWidth();
    },
  },
);

// ============================================================================
// Transform Hierarchy Utilities
// ============================================================================

/**
 * Compute world transform from local transform and parent world transform
 *
 * For position: worldPos = parentPos + parentRotation * (localPos * parentScale)
 * For rotation: worldRot = parentRot + localRot (simplified Euler addition)
 * For scale: worldScale = parentScale * localScale
 *
 * Note: This is a simplified computation using Euler angles. For production
 * use with complex rotations, consider using quaternions.
 */
export function computeWorldTransform(
  local: LocalTransform3DData,
  parentWorld: { position: Vector3; rotation: Vector3; scale: Vector3 },
): { position: Vector3; rotation: Vector3; scale: Vector3 } {
  // Scale: multiply
  const worldScale = new Vector3(
    parentWorld.scale.x * local.scale.x,
    parentWorld.scale.y * local.scale.y,
    parentWorld.scale.z * local.scale.z,
  );

  // Rotation: add Euler angles (simplified, works for small/axis-aligned rotations)
  // For complex rotations, quaternion math would be needed
  const worldRotation = new Vector3(
    parentWorld.rotation.x + local.rotation.x,
    parentWorld.rotation.y + local.rotation.y,
    parentWorld.rotation.z + local.rotation.z,
  );

  // Position: apply parent rotation to local offset, then add parent position
  // This uses simplified rotation (Y-axis only for common 2.5D/3D cases)
  const scaledLocal = new Vector3(
    local.position.x * parentWorld.scale.x,
    local.position.y * parentWorld.scale.y,
    local.position.z * parentWorld.scale.z,
  );

  // Apply parent rotation (using Y rotation for horizontal plane rotation)
  const cosY = Math.cos(parentWorld.rotation.y);
  const sinY = Math.sin(parentWorld.rotation.y);
  const rotatedX = scaledLocal.x * cosY - scaledLocal.z * sinY;
  const rotatedZ = scaledLocal.x * sinY + scaledLocal.z * cosY;

  // Apply X rotation (pitch)
  const cosX = Math.cos(parentWorld.rotation.x);
  const sinX = Math.sin(parentWorld.rotation.x);
  const rotatedY = scaledLocal.y * cosX - rotatedZ * sinX;
  const rotatedZ2 = scaledLocal.y * sinX + rotatedZ * cosX;

  const worldPosition = new Vector3(
    parentWorld.position.x + rotatedX,
    parentWorld.position.y + rotatedY,
    parentWorld.position.z + rotatedZ2,
  );

  return {
    position: worldPosition,
    rotation: worldRotation,
    scale: worldScale,
  };
}

/**
 * Compute local transform from world transform and parent world transform
 * (inverse of computeWorldTransform)
 *
 * Useful for converting world-space positions to local-space.
 */
export function computeLocalTransform(
  world: { position: Vector3; rotation: Vector3; scale: Vector3 },
  parentWorld: { position: Vector3; rotation: Vector3; scale: Vector3 },
): LocalTransform3DData {
  // Scale: divide
  const localScale = new Vector3(
    parentWorld.scale.x !== 0 ? world.scale.x / parentWorld.scale.x : world.scale.x,
    parentWorld.scale.y !== 0 ? world.scale.y / parentWorld.scale.y : world.scale.y,
    parentWorld.scale.z !== 0 ? world.scale.z / parentWorld.scale.z : world.scale.z,
  );

  // Rotation: subtract Euler angles
  const localRotation = new Vector3(
    world.rotation.x - parentWorld.rotation.x,
    world.rotation.y - parentWorld.rotation.y,
    world.rotation.z - parentWorld.rotation.z,
  );

  // Position: subtract parent position, then unapply parent rotation and scale
  const offsetX = world.position.x - parentWorld.position.x;
  const offsetY = world.position.y - parentWorld.position.y;
  const offsetZ = world.position.z - parentWorld.position.z;

  // Unapply X rotation (inverse = negate angle)
  const cosX = Math.cos(-parentWorld.rotation.x);
  const sinX = Math.sin(-parentWorld.rotation.x);
  const unrotatedY1 = offsetY * cosX - offsetZ * sinX;
  const unrotatedZ1 = offsetY * sinX + offsetZ * cosX;

  // Unapply Y rotation
  const cosY = Math.cos(-parentWorld.rotation.y);
  const sinY = Math.sin(-parentWorld.rotation.y);
  const unrotatedX = offsetX * cosY - unrotatedZ1 * sinY;
  const unrotatedZ = offsetX * sinY + unrotatedZ1 * cosY;

  // Unapply parent scale
  const localPosition = new Vector3(
    parentWorld.scale.x !== 0 ? unrotatedX / parentWorld.scale.x : unrotatedX,
    parentWorld.scale.y !== 0 ? unrotatedY1 / parentWorld.scale.y : unrotatedY1,
    parentWorld.scale.z !== 0 ? unrotatedZ / parentWorld.scale.z : unrotatedZ,
  );

  return {
    position: localPosition,
    rotation: localRotation,
    scale: localScale,
  };
}

/**
 * Identity transform (no offset from parent)
 */
export const IDENTITY_LOCAL_TRANSFORM: LocalTransform3DData = {
  position: new Vector3(0, 0, 0),
  rotation: new Vector3(0, 0, 0),
  scale: new Vector3(1, 1, 1),
};
