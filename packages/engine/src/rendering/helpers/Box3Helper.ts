/**
 * Box3Helper
 *
 * A helper class for visualizing 3D bounding boxes in the editor.
 * Follows the Collider3DHelper pattern - self-contained with geometry, material, and update logic.
 *
 * Renders box bounds as wireframes on layer 31 (HELPER_LAYER) so they're
 * only visible in the editor scene view.
 */

import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { Color } from 'three';

import { HELPER_LAYER } from '../../constants/layers.js';
import { createCuboidWireframe } from './collider-geometries.js';
import type { Vector3 } from '../../math/vector3.js';

const DEFAULT_COLOR = 0x0080ff; // Blue to distinguish from colliders (green)
const DEFAULT_LINEWIDTH = 2;
const HELPER_RENDER_ORDER = 999999999;

/**
 * Box3Helper visualizes 3D bounding boxes in the editor.
 *
 * @example
 * ```typescript
 * const box = new THREE.Box3(
 *   new THREE.Vector3(-10, 0, -5),
 *   new THREE.Vector3(10, 20, 5)
 * );
 * const helper = new Box3Helper(box, { width: 1920, height: 1080 });
 * scene.add(helper);
 *
 * // Update on each frame
 * helper.update(componentData, transformData);
 *
 * // When bounds change
 * helper.setBox3(newBox);
 *
 * // Cleanup
 * helper.dispose();
 * ```
 */
export class Box3Helper extends LineSegments2 {
  override type = 'Box3Helper';

  private _box: THREE.Box3;
  private _material: LineMaterial;

  /**
   * Creates a new Box3Helper.
   *
   * @param box - The Box3 to visualize
   * @param resolution - Viewport resolution for LineMaterial (required for thick lines)
   * @param color - Line color (default: blue 0x0080ff)
   */
  constructor(
    box: THREE.Box3,
    resolution: { width: number; height: number },
    color: number = DEFAULT_COLOR,
  ) {
    const geometry = Box3Helper.createGeometry(box);
    const material = new LineMaterial({
      color,
      linewidth: DEFAULT_LINEWIDTH,
      depthTest: false,
      depthWrite: false,
    });
    material.resolution.set(resolution.width, resolution.height);

    super(geometry, material);

    this._box = box.clone();
    this._material = material;

    // Set helper layer and render order
    this.layers.set(HELPER_LAYER);
    this.renderOrder = HELPER_RENDER_ORDER;

    // Required for LineSegments2 rendering
    this.computeLineDistances();
  }

  /**
   * Get the current Box3.
   */
  get box(): THREE.Box3 {
    return this._box;
  }

  /**
   * Creates geometry for a Box3 bounding box.
   */
  private static createGeometry(box: THREE.Box3) {
    const size = new THREE.Vector3();
    box.getSize(size);

    // Box3 geometry is centered at (min + max) / 2
    // createCuboidWireframe expects half-extents from center
    const halfWidth = size.x / 2;
    const halfHeight = size.y / 2;
    const halfDepth = size.z / 2;

    return createCuboidWireframe(halfWidth, halfHeight, halfDepth);
  }

  /**
   * Updates the box and rebuilds geometry.
   *
   * @param box - The new Box3 definition
   */
  setBox3(box: THREE.Box3): void {
    // Normalize the box (ensure min <= max)
    const normalizedBox = new THREE.Box3(
      new THREE.Vector3(
        Math.min(box.min.x, box.max.x),
        Math.min(box.min.y, box.max.y),
        Math.min(box.min.z, box.max.z)
      ),
      new THREE.Vector3(
        Math.max(box.min.x, box.max.x),
        Math.max(box.min.y, box.max.y),
        Math.max(box.min.z, box.max.z)
      )
    );

    // Rebuild geometry if bounds changed
    this.geometry.dispose();
    this.geometry = Box3Helper.createGeometry(normalizedBox);
    this.computeLineDistances();

    this._box = normalizedBox;
  }

  /**
   * Updates the helper's transform to match the component data and entity transform.
   *
   * @param componentData - Component data with boundsMin and boundsMax properties
   * @param transform - The entity's transform data (position, rotation, scale)
   */
  update(
    componentData: { boundsMin: { x: number; y: number; z: number }; boundsMax: { x: number; y: number; z: number } },
    transform: { position: Vector3; rotation: Vector3; scale: Vector3 }
  ): void {
    // Apply entity transform
    this.position.copy(transform.position);
    this.rotation.set(
      transform.rotation.x,
      transform.rotation.y,
      transform.rotation.z,
      'YXZ'
    );
    this.scale.copy(transform.scale);

    // Position the helper at the center of the box in world space
    // The box geometry is already centered, so we just need to offset by the box center
    const boxCenter = this._box.getCenter(new THREE.Vector3());

    // Apply the box center offset (rotated by entity rotation and scaled)
    const offsetWorld = boxCenter
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
