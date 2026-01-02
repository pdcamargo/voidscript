/**
 * Collider2D Component
 *
 * Collision shape for 2D physics.
 * Can be used with RigidBody2D or standalone (creates implicit static body).
 *
 * Shapes:
 * - cuboid: Rectangle (defined by half-width and half-height)
 * - ball: Circle (defined by radius)
 * - capsule: Rounded rectangle (defined by half-height and radius)
 *
 * Properties:
 * - offset: Position offset from body origin
 * - rotationOffset: Rotation offset in radians
 * - isSensor: If true, detects collisions but doesn't respond (trigger)
 * - friction: Surface friction (0 = ice, 1 = rubber)
 * - restitution: Bounciness (0 = no bounce, 1 = perfect bounce)
 * - density: Mass per unit area (mass = density × area)
 */

import { component } from '@voidscript/core';
import type { ColliderShape2D } from '../../types.js';
import * as THREE from 'three';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

export interface Collider2DData {
  /** Collision shape definition */
  shape: ColliderShape2D;

  /** Position offset from body origin */
  offset: THREE.Vector2;

  /** Rotation offset in radians */
  rotationOffset: number;

  /** If true, collider is a sensor (trigger only, no collision response) */
  isSensor: boolean;

  /** Surface friction coefficient (0-1+, typical range 0-1) */
  friction: number;

  /** Restitution/bounciness (0 = no bounce, 1 = perfect bounce) */
  restitution: number;

  /** Density for mass calculation (mass = density × area) */
  density: number;
}

const serializeVector2 = {
  serialize: (val: THREE.Vector2) => ({ x: val.x, y: val.y }),
  deserialize: (val: any) => new THREE.Vector2(val.x, val.y),
};

// ============================================================================
// Custom Editor Helper Functions
// ============================================================================

function renderShapeSection2D(data: Collider2DData): void {
  if (EditorLayout.beginGroup('Shape', true)) {
    const shapeTypes = ['cuboid', 'ball', 'capsule'] as const;

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
        data.shape = { type: 'cuboid', halfWidth: 0.5, halfHeight: 0.5 };
      } else if (shapeType === 'ball') {
        data.shape = { type: 'ball', radius: 0.5 };
      } else if (shapeType === 'capsule') {
        data.shape = { type: 'capsule', halfHeight: 0.5, radius: 0.25 };
      }
    }

    // Shape-specific fields
    EditorLayout.beginIndent();

    if (data.shape.type === 'cuboid') {
      EditorLayout.beginLabelsWidth(['Half Width', 'Half Height']);

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

      EditorLayout.endLabelsWidth();
    } else if (data.shape.type === 'ball') {
      EditorLayout.beginLabelsWidth(['Radius']);

      const [radius, rChanged] = EditorLayout.numberField('Radius', data.shape.radius, {
        speed: 0.01, min: 0.01, max: 100,
        tooltip: 'Circle radius',
      });
      if (rChanged) data.shape.radius = radius;

      EditorLayout.endLabelsWidth();
    } else if (data.shape.type === 'capsule') {
      EditorLayout.beginLabelsWidth(['Half Height', 'Radius']);

      const [halfHeight, hhChanged] = EditorLayout.numberField('Half Height', data.shape.halfHeight, {
        speed: 0.01, min: 0.01, max: 100,
        tooltip: 'Half height of capsule (excluding end caps)',
      });
      if (hhChanged) data.shape.halfHeight = halfHeight;

      const [radius, rChanged] = EditorLayout.numberField('Radius', data.shape.radius, {
        speed: 0.01, min: 0.01, max: 100,
        tooltip: 'Radius of end caps',
      });
      if (rChanged) data.shape.radius = radius;

      EditorLayout.endLabelsWidth();
    }

    EditorLayout.endIndent();
    EditorLayout.endGroup();
  }
}

function renderTransformSection2D(data: Collider2DData): void {
  if (EditorLayout.beginGroup('Transform', false)) {
    EditorLayout.beginLabelsWidth(['Offset', 'Rotation Offset']);

    const [offset, offsetChanged] = EditorLayout.vector2Field('Offset', data.offset, {
      speed: 0.01,
      tooltip: 'Position offset from body origin',
    });
    if (offsetChanged) {
      data.offset.x = offset.x;
      data.offset.y = offset.y;
    }

    const [rotOffset, rotChanged] = EditorLayout.numberField('Rotation Offset', data.rotationOffset, {
      speed: 0.01,
      tooltip: 'Rotation offset in radians',
    });
    if (rotChanged) data.rotationOffset = rotOffset;

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderPhysicsPropertiesSection2D(data: Collider2DData): void {
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
      tooltip: 'Mass per unit area (mass = density × area)',
    });
    if (densityChanged) data.density = density;

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

// ============================================================================
// Component Definition
// ============================================================================

export const Collider2D = component<Collider2DData>(
  'Collider2D',
  {
    shape: {
      serializable: true,
    },
    offset: {
      serializable: true,
      customSerializer: serializeVector2,
    },
    rotationOffset: {
      serializable: true,
      instanceType: Number,
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
    path: 'physics/2d',
    defaultValue: () => ({
      shape: { type: 'cuboid', halfWidth: 0.5, halfHeight: 0.5 },
      offset: new THREE.Vector2(0, 0),
      rotationOffset: 0,
      isSensor: false,
      friction: 0.5,
      restitution: 0.0,
      density: 1.0,
    }),
    displayName: 'Collider 2D',
    description: 'Collision shape for 2D physics',
    showHelper: true,
    customEditor: ({ componentData }) => {
      renderShapeSection2D(componentData);
      renderTransformSection2D(componentData);
      renderPhysicsPropertiesSection2D(componentData);
    },
  },
);
