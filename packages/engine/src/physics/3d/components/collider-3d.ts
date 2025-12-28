/**
 * Collider3D Component
 *
 * Collision shape for 3D physics.
 * Can be used with RigidBody3D or standalone (creates implicit static body).
 *
 * Shapes:
 * - cuboid: Box (defined by half-extents on each axis)
 * - ball: Sphere (defined by radius)
 * - capsule: Rounded cylinder (defined by half-height and radius)
 * - cylinder: Cylinder (defined by half-height and radius)
 * - cone: Cone (defined by half-height and base radius)
 *
 * Properties:
 * - offset: Position offset from body origin
 * - rotationOffset: Rotation offset as Euler angles
 * - isSensor: If true, detects collisions but doesn't respond (trigger)
 * - friction: Surface friction (0 = ice, 1 = rubber)
 * - restitution: Bounciness (0 = no bounce, 1 = perfect bounce)
 * - density: Mass per unit volume (mass = density × volume)
 */

import { component } from '../../../ecs/component.js';
import type { ColliderShape3D } from '../../types.js';
import * as THREE from 'three';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

export interface Collider3DData {
  /** Collision shape definition */
  shape: ColliderShape3D;

  /** Position offset from body origin */
  offset: THREE.Vector3;

  /** Rotation offset as Euler angles (radians) */
  rotationOffset: THREE.Vector3;

  /** If true, collider is a sensor (trigger only, no collision response) */
  isSensor: boolean;

  /** Surface friction coefficient (0-1+, typical range 0-1) */
  friction: number;

  /** Restitution/bounciness (0 = no bounce, 1 = perfect bounce) */
  restitution: number;

  /** Density for mass calculation (mass = density × volume) */
  density: number;
}

const serializeVector3 = {
  serialize: (val: THREE.Vector3) => ({ x: val.x, y: val.y, z: val.z }),
  deserialize: (val: any) => new THREE.Vector3(val.x, val.y, val.z),
};

// ============================================================================
// Custom Editor Helper Functions
// ============================================================================

function renderShapeSection3D(data: Collider3DData): void {
  if (EditorLayout.beginGroup('Shape', true)) {
    const shapeTypes = ['cuboid', 'ball', 'capsule', 'cylinder', 'cone'] as const;

    EditorLayout.beginLabelsWidth(['Shape Type']);
    const [shapeType, typeChanged] = EditorLayout.comboField(
      'Shape Type',
      data.shape.type,
      [...shapeTypes],
      { tooltip: 'Collision shape type' }
    );
    EditorLayout.endLabelsWidth();

    if (typeChanged && shapeType !== data.shape.type) {
      // Create new shape with default values
      if (shapeType === 'cuboid') {
        data.shape = { type: 'cuboid', halfWidth: 0.5, halfHeight: 0.5, halfDepth: 0.5 };
      } else if (shapeType === 'ball') {
        data.shape = { type: 'ball', radius: 0.5 };
      } else if (shapeType === 'capsule') {
        data.shape = { type: 'capsule', halfHeight: 0.5, radius: 0.25 };
      } else if (shapeType === 'cylinder') {
        data.shape = { type: 'cylinder', halfHeight: 0.5, radius: 0.5 };
      } else if (shapeType === 'cone') {
        data.shape = { type: 'cone', halfHeight: 0.5, radius: 0.5 };
      }
    }

    // Shape-specific fields
    EditorLayout.beginIndent();

    if (data.shape.type === 'cuboid') {
      EditorLayout.beginLabelsWidth(['Half Width', 'Half Height', 'Half Depth']);

      const [halfWidth, hwChanged] = EditorLayout.numberField('Half Width', data.shape.halfWidth, {
        speed: 0.01, min: 0.01, max: 100,
        tooltip: 'Distance from center to edge on X axis',
      });
      if (hwChanged) data.shape.halfWidth = halfWidth;

      const [halfHeight, hhChanged] = EditorLayout.numberField('Half Height', data.shape.halfHeight, {
        speed: 0.01, min: 0.01, max: 100,
        tooltip: 'Distance from center to edge on Y axis',
      });
      if (hhChanged) data.shape.halfHeight = halfHeight;

      const [halfDepth, hdChanged] = EditorLayout.numberField('Half Depth', data.shape.halfDepth, {
        speed: 0.01, min: 0.01, max: 100,
        tooltip: 'Distance from center to edge on Z axis',
      });
      if (hdChanged) data.shape.halfDepth = halfDepth;

      EditorLayout.endLabelsWidth();
    } else if (data.shape.type === 'ball') {
      EditorLayout.beginLabelsWidth(['Radius']);

      const [radius, rChanged] = EditorLayout.numberField('Radius', data.shape.radius, {
        speed: 0.01, min: 0.01, max: 100,
        tooltip: 'Sphere radius',
      });
      if (rChanged) data.shape.radius = radius;

      EditorLayout.endLabelsWidth();
    } else if (data.shape.type === 'capsule' || data.shape.type === 'cylinder' || data.shape.type === 'cone') {
      EditorLayout.beginLabelsWidth(['Half Height', 'Radius']);

      const [halfHeight, hhChanged] = EditorLayout.numberField('Half Height', data.shape.halfHeight, {
        speed: 0.01, min: 0.01, max: 100,
        tooltip: data.shape.type === 'capsule' ? 'Half height (excluding end caps)' : 'Half height of shape',
      });
      if (hhChanged) data.shape.halfHeight = halfHeight;

      const [radius, rChanged] = EditorLayout.numberField('Radius', data.shape.radius, {
        speed: 0.01, min: 0.01, max: 100,
        tooltip: data.shape.type === 'cone' ? 'Radius of cone base' : 'Radius of shape',
      });
      if (rChanged) data.shape.radius = radius;

      EditorLayout.endLabelsWidth();
    }

    EditorLayout.endIndent();
    EditorLayout.endGroup();
  }
}

function renderTransformSection3D(data: Collider3DData): void {
  if (EditorLayout.beginGroup('Transform', false)) {
    EditorLayout.beginLabelsWidth(['Offset', 'Rotation Offset']);

    const [offset, offsetChanged] = EditorLayout.vector3Field('Offset', data.offset, {
      speed: 0.01,
      tooltip: 'Position offset from body origin',
    });
    if (offsetChanged) {
      data.offset.x = offset.x;
      data.offset.y = offset.y;
      data.offset.z = offset.z;
    }

    const [rotOffset, rotChanged] = EditorLayout.vector3Field('Rotation Offset', data.rotationOffset, {
      speed: 0.01,
      tooltip: 'Rotation offset as Euler angles (radians)',
    });
    if (rotChanged) {
      data.rotationOffset.x = rotOffset.x;
      data.rotationOffset.y = rotOffset.y;
      data.rotationOffset.z = rotOffset.z;
    }

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderPhysicsPropertiesSection3D(data: Collider3DData): void {
  if (EditorLayout.beginGroup('Physics Properties', false)) {
    EditorLayout.beginLabelsWidth(['Is Sensor', 'Friction', 'Restitution', 'Density']);

    const [isSensor, sensorChanged] = EditorLayout.checkboxField('Is Sensor', data.isSensor, {
      tooltip: 'Sensors detect collisions but do not respond physically (triggers)',
    });
    if (sensorChanged) data.isSensor = isSensor;

    const [friction, frictionChanged] = EditorLayout.numberField('Friction', data.friction, {
      speed: 0.01, min: 0, max: 2, useSlider: true,
      tooltip: 'Surface friction (0 = ice, 1 = rubber)',
    });
    if (frictionChanged) data.friction = friction;

    const [restitution, restChanged] = EditorLayout.numberField('Restitution', data.restitution, {
      speed: 0.01, min: 0, max: 1, useSlider: true,
      tooltip: 'Bounciness (0 = no bounce, 1 = perfect bounce)',
    });
    if (restChanged) data.restitution = restitution;

    const [density, densityChanged] = EditorLayout.numberField('Density', data.density, {
      speed: 0.01, min: 0.01, max: 100,
      tooltip: 'Mass per unit volume (mass = density × volume)',
    });
    if (densityChanged) data.density = density;

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

// ============================================================================
// Component Definition
// ============================================================================

export const Collider3D = component<Collider3DData>(
  'Collider3D',
  {
    shape: {
      serializable: true,
    },
    offset: {
      serializable: true,
      customSerializer: serializeVector3,
    },
    rotationOffset: {
      serializable: true,
      customSerializer: serializeVector3,
    },
    isSensor: {
      serializable: true,
      instanceType: Boolean,
    },
    friction: {
      serializable: true,
      instanceType: Number,
    },
    restitution: {
      serializable: true,
      instanceType: Number,
    },
    density: {
      serializable: true,
      instanceType: Number,
    },
  },
  {
    path: 'physics/3d',
    defaultValue: () => ({
      shape: { type: 'cuboid', halfWidth: 0.5, halfHeight: 0.5, halfDepth: 0.5 },
      offset: new THREE.Vector3(0, 0, 0),
      rotationOffset: new THREE.Vector3(0, 0, 0),
      isSensor: false,
      friction: 0.5,
      restitution: 0.0,
      density: 1.0,
    }),
    displayName: 'Collider 3D',
    description: 'Collision shape for 3D physics',
    showHelper: false,
    customEditor: ({ componentData }) => {
      renderShapeSection3D(componentData);
      renderTransformSection3D(componentData);
      renderPhysicsPropertiesSection3D(componentData);
    },
  },
);
