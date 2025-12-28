/**
 * Transform3D Component
 *
 * Represents the position, rotation, and scale of an entity in 3D space.
 * This is the core component for all renderable objects.
 *
 * Position: World-space coordinates (x, y, z)
 * Rotation: Euler angles in radians (x, y, z)
 * Scale: Scale factors (x, y, z) - default is (1, 1, 1)
 */

import { component } from '../../component.js';
import { Vector3 } from '../../../math/index.js';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

export interface Transform3DData {
  /** Position in world space */
  position: Vector3;
  /** Rotation in radians (Euler angles) */
  rotation: Vector3;
  /** Scale factors */
  scale: Vector3;
}

// Helper to serialize Vector3 or plain object
const serializeVector3 = (val: Vector3 | { x: number; y: number; z: number }) =>
  'toJSON' in val && typeof val.toJSON === 'function'
    ? val.toJSON()
    : { x: val.x, y: val.y, z: val.z };

export const Transform3D = component<Transform3DData>(
  'Transform3D',
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
    displayName: 'Transform 3D',
    description: 'Transform in 3D space',
    customEditor: ({ componentData }) => {
      EditorLayout.beginLabelsWidth(['Position', 'Rotation', 'Scale']);

      // Position
      const [position, posChanged] = EditorLayout.vector3Field('Position', componentData.position, {
        speed: 0.1,
        tooltip: 'World-space position (x, y, z)',
      });
      if (posChanged) {
        componentData.position.x = position.x;
        componentData.position.y = position.y;
        componentData.position.z = position.z;
      }

      // Rotation
      const [rotation, rotChanged] = EditorLayout.vector3Field('Rotation', componentData.rotation, {
        speed: 0.01,
        tooltip: 'Euler rotation in radians (x, y, z)',
      });
      if (rotChanged) {
        componentData.rotation.x = rotation.x;
        componentData.rotation.y = rotation.y;
        componentData.rotation.z = rotation.z;
      }

      // Scale
      const [scale, scaleChanged] = EditorLayout.vector3Field('Scale', componentData.scale, {
        speed: 0.01,
        tooltip: 'Scale factors (x, y, z)',
      });
      if (scaleChanged) {
        componentData.scale.x = scale.x;
        componentData.scale.y = scale.y;
        componentData.scale.z = scale.z;
      }

      EditorLayout.endLabelsWidth();
    },
  },
);
