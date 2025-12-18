/**
 * Collider2DHelper
 *
 * A helper class for visualizing 2D collider shapes in the editor.
 * Follows the THREE.CameraHelper pattern - self-contained with geometry, material, and update logic.
 *
 * Renders collider shapes as wireframes on layer 31 (HELPER_LAYER) so they're
 * only visible in the editor scene view.
 */

import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { Color } from 'three';

import type { ColliderShape2D } from '../../physics/types.js';
import type { Collider2DData } from '../../physics/2d/components/collider-2d.js';
import type { Transform3DData } from '../../ecs/components/rendering/transform-3d.js';
import { HELPER_LAYER } from '../../constants/layers.js';
import {
  createCuboid2DWireframe,
  createCircleWireframe,
  createCapsule2DWireframe,
} from './collider-geometries.js';

const DEFAULT_COLOR = 0x00ff00;
const DEFAULT_LINEWIDTH = 2;
const HELPER_RENDER_ORDER = 999999999;

/**
 * Collider2DHelper visualizes 2D collider shapes in the editor.
 *
 * @example
 * ```typescript
 * const helper = new Collider2DHelper(
 *   { type: 'cuboid', halfWidth: 1, halfHeight: 0.5 },
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
export class Collider2DHelper extends LineSegments2 {
  override type = 'Collider2DHelper';

  private _shape: ColliderShape2D;
  private _material: LineMaterial;
  private _shapeType: string;

  /**
   * Creates a new Collider2DHelper.
   *
   * @param shape - The collider shape to visualize
   * @param resolution - Viewport resolution for LineMaterial (required for thick lines)
   * @param color - Line color (default: green 0x00ff00)
   */
  constructor(
    shape: ColliderShape2D,
    resolution: { width: number; height: number },
    color: number = DEFAULT_COLOR,
  ) {
    const geometry = Collider2DHelper.createGeometry(shape);
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
   * The current shape type ('cuboid', 'ball', 'capsule').
   */
  get shapeType(): string {
    return this._shapeType;
  }

  /**
   * Creates geometry for a 2D collider shape.
   */
  private static createGeometry(shape: ColliderShape2D): LineSegmentsGeometry {
    switch (shape.type) {
      case 'cuboid':
        return createCuboid2DWireframe(shape.halfWidth, shape.halfHeight);
      case 'ball':
        return createCircleWireframe(shape.radius);
      case 'capsule':
        return createCapsule2DWireframe(shape.halfHeight, shape.radius);
    }
  }

  /**
   * Updates the helper's transform to match the collider and entity transform.
   *
   * @param collider - The collider data (for offset and rotation offset)
   * @param transform - The entity's transform data
   */
  update(collider: Collider2DData, transform: Transform3DData): void {
    // Apply entity transform (2D uses only XY position and Z rotation)
    this.position.set(
      transform.position.x,
      transform.position.y,
      transform.position.z,
    );
    this.rotation.set(0, 0, transform.rotation.z);
    this.scale.set(transform.scale.x, transform.scale.y, 1);

    // Apply 2D offset (rotate by Z rotation)
    const angle = transform.rotation.z;
    const rotatedOffsetX =
      collider.offset.x * Math.cos(angle) - collider.offset.y * Math.sin(angle);
    const rotatedOffsetY =
      collider.offset.x * Math.sin(angle) + collider.offset.y * Math.cos(angle);

    this.position.x += rotatedOffsetX * transform.scale.x;
    this.position.y += rotatedOffsetY * transform.scale.y;

    // Apply rotation offset
    this.rotation.z += collider.rotationOffset;
  }

  /**
   * Updates the shape and rebuilds geometry if needed.
   *
   * @param shape - The new shape definition
   */
  setShape(shape: ColliderShape2D): void {
    // Always rebuild geometry when shape changes
    this.geometry.dispose();
    this.geometry = Collider2DHelper.createGeometry(shape);
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
