/**
 * Collider3DHelper
 *
 * A helper class for visualizing 3D collider shapes in the editor.
 * Follows the THREE.CameraHelper pattern - self-contained with geometry, material, and update logic.
 *
 * Renders collider shapes as wireframes on layer 31 (HELPER_LAYER) so they're
 * only visible in the editor scene view.
 */

import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { Color } from 'three';

import type { ColliderShape3D } from '../../physics/types.js';
import type { Collider3DData } from '../../physics/3d/components/collider-3d.js';
import type { Transform3DData } from '../../ecs/components/rendering/transform-3d.js';
import { HELPER_LAYER } from '../../constants/layers.js';
import {
  createCuboidWireframe,
  createSphereWireframe,
  createCapsuleWireframe,
  createCylinderWireframe,
  createConeWireframe,
} from './collider-geometries.js';

const DEFAULT_COLOR = 0x00ff00;
const DEFAULT_LINEWIDTH = 2;
const HELPER_RENDER_ORDER = 999999999;

/**
 * Collider3DHelper visualizes 3D collider shapes in the editor.
 *
 * @example
 * ```typescript
 * const helper = new Collider3DHelper(
 *   { type: 'cuboid', halfWidth: 1, halfHeight: 0.5, halfDepth: 0.5 },
 *   { width: 1920, height: 1080 }
 * );
 * scene.add(helper);
 *
 * // Update on each frame
 * helper.update(colliderData, transformData);
 *
 * // When shape changes
 * helper.setShape({ type: 'ball', radius: 1 });
 *
 * // Cleanup
 * helper.dispose();
 * ```
 */
export class Collider3DHelper extends LineSegments2 {
  override type = 'Collider3DHelper';

  private _shape: ColliderShape3D;
  private _material: LineMaterial;
  private _shapeType: string;

  /**
   * Creates a new Collider3DHelper.
   *
   * @param shape - The collider shape to visualize
   * @param resolution - Viewport resolution for LineMaterial (required for thick lines)
   * @param color - Line color (default: green 0x00ff00)
   */
  constructor(
    shape: ColliderShape3D,
    resolution: { width: number; height: number },
    color: number = DEFAULT_COLOR,
  ) {
    const geometry = Collider3DHelper.createGeometry(shape);
    const material = new LineMaterial({
      color,
      linewidth: DEFAULT_LINEWIDTH,
      depthTest: false,
      depthWrite: false,
    });
    material.resolution.set(resolution.width, resolution.height);

    super(geometry, material);

    this._shape = shape;
    this._shapeType = shape.type;
    this._material = material;

    // Set helper layer and render order
    this.layers.set(HELPER_LAYER);
    this.renderOrder = HELPER_RENDER_ORDER;

    // Required for LineSegments2 rendering
    this.computeLineDistances();
  }

  /**
   * The current shape type ('cuboid', 'ball', 'capsule', 'cylinder', 'cone').
   */
  get shapeType(): string {
    return this._shapeType;
  }

  /**
   * Creates geometry for a 3D collider shape.
   */
  private static createGeometry(shape: ColliderShape3D): LineSegmentsGeometry {
    switch (shape.type) {
      case 'cuboid':
        return createCuboidWireframe(shape.halfWidth, shape.halfHeight, shape.halfDepth);
      case 'ball':
        return createSphereWireframe(shape.radius);
      case 'capsule':
        return createCapsuleWireframe(shape.halfHeight, shape.radius);
      case 'cylinder':
        return createCylinderWireframe(shape.halfHeight, shape.radius);
      case 'cone':
        return createConeWireframe(shape.halfHeight, shape.radius);
    }
  }

  /**
   * Updates the helper's transform to match the collider and entity transform.
   *
   * @param collider - The collider data (for offset and rotation offset)
   * @param transform - The entity's transform data
   */
  update(collider: Collider3DData, transform: Transform3DData): void {
    // Apply entity transform
    this.position.copy(transform.position);
    this.rotation.set(
      transform.rotation.x,
      transform.rotation.y,
      transform.rotation.z,
      'YXZ'
    );
    this.scale.copy(transform.scale);

    // Apply collider offset (rotate by entity rotation, scale, then add to position)
    const offsetWorld = collider.offset
      .clone()
      .applyEuler(
        new THREE.Euler(
          transform.rotation.x,
          transform.rotation.y,
          transform.rotation.z,
          'YXZ'
        )
      )
      .multiply(transform.scale);
    this.position.add(offsetWorld);

    // Apply rotation offset
    this.rotation.x += collider.rotationOffset.x;
    this.rotation.y += collider.rotationOffset.y;
    this.rotation.z += collider.rotationOffset.z;
  }

  /**
   * Updates the shape and rebuilds geometry if needed.
   *
   * @param shape - The new shape definition
   */
  setShape(shape: ColliderShape3D): void {
    // Always rebuild geometry when shape changes
    this.geometry.dispose();
    this.geometry = Collider3DHelper.createGeometry(shape);
    this.computeLineDistances();

    this._shape = shape;
    this._shapeType = shape.type;
  }

  /**
   * Updates the viewport resolution for the line material.
   * Must be called when the viewport resizes.
   *
   * @param width - Viewport width in pixels
   * @param height - Viewport height in pixels
   */
  setResolution(width: number, height: number): void {
    this._material.resolution.set(width, height);
  }

  /**
   * Sets the line color.
   *
   * @param color - The color (hex number or THREE.Color)
   */
  setColor(color: number | Color): void {
    if (typeof color === 'number') {
      this._material.color.setHex(color);
    } else {
      this._material.color.copy(color);
    }
  }

  /**
   * Sets the line width.
   *
   * @param width - Line width in pixels
   */
  setLineWidth(width: number): void {
    this._material.linewidth = width;
  }

  /**
   * Cleans up geometry and material resources.
   */
  dispose(): void {
    this.geometry.dispose();
    this._material.dispose();
  }
}
