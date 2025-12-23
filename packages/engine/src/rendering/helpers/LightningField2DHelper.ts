/**
 * LightningField2DHelper
 *
 * A helper class for visualizing 2D lightning field boundaries in the editor.
 * Follows the Collider2DHelper pattern - self-contained with geometry, material, and update logic.
 *
 * Renders a dashed yellow rectangle outline on layer 31 (HELPER_LAYER) so it's
 * only visible in the editor scene view.
 */

import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

import type { Transform3DData } from '../../ecs/components/rendering/transform-3d.js';
import { HELPER_LAYER } from '../../constants/layers.js';

const LIGHTNING_HELPER_COLOR = 0xffff00; // Yellow for lightning fields
const DEFAULT_LINEWIDTH = 2;
const HELPER_RENDER_ORDER = 999999999;

/**
 * LightningField2DHelper visualizes 2D lightning field boundaries in the editor.
 *
 * @example
 * ```typescript
 * const helper = new LightningField2DHelper(
 *   { x: 100, y: 100 },
 *   { width: 1920, height: 1080 }
 * );
 * scene.add(helper);
 *
 * // Update on each frame
 * helper.update({ x: 100, y: 100 }, transformData);
 *
 * // Cleanup
 * helper.dispose();
 * ```
 */
export class LightningField2DHelper extends LineSegments2 {
  override type = 'LightningField2DHelper';

  private _material: LineMaterial;
  private _lastSizeX: number;
  private _lastSizeY: number;

  /**
   * Creates a new LightningField2DHelper.
   *
   * @param baseSize - The base size of the lightning field
   * @param resolution - Viewport resolution for LineMaterial (required for thick lines)
   * @param color - Line color (default: yellow 0xffff00)
   */
  constructor(
    baseSize: { x: number; y: number },
    resolution: { width: number; height: number },
    color: number = LIGHTNING_HELPER_COLOR,
  ) {
    // Create unit geometry (-0.5 to 0.5) - scaling is handled in update()
    const geometry = LightningField2DHelper.createRectGeometry(0.5, 0.5);
    // Use larger dash size for visibility at world scale
    const material = new LineMaterial({
      color,
      linewidth: DEFAULT_LINEWIDTH,
      depthTest: false,
      depthWrite: false,
      dashed: true,
      dashSize: 5.0,
      gapSize: 3.0,
    });
    material.resolution.set(resolution.width, resolution.height);

    super(geometry, material);

    this._material = material;
    this._lastSizeX = baseSize.x;
    this._lastSizeY = baseSize.y;

    // Set helper layer and render order
    this.layers.set(HELPER_LAYER);
    this.renderOrder = HELPER_RENDER_ORDER;

    // Required for dashed LineSegments2 rendering
    this.computeLineDistances();
  }

  /**
   * Creates geometry for a 2D rectangle outline
   */
  private static createRectGeometry(
    halfWidth: number,
    halfHeight: number,
  ): LineSegmentsGeometry {
    // Rectangle outline (8 vertices for 4 line segments)
    const positions = [
      // Bottom edge
      -halfWidth,
      -halfHeight,
      0,
      halfWidth,
      -halfHeight,
      0,
      // Right edge
      halfWidth,
      -halfHeight,
      0,
      halfWidth,
      halfHeight,
      0,
      // Top edge
      halfWidth,
      halfHeight,
      0,
      -halfWidth,
      halfHeight,
      0,
      // Left edge
      -halfWidth,
      halfHeight,
      0,
      -halfWidth,
      -halfHeight,
      0,
    ];

    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);
    return geometry;
  }

  /**
   * Updates the helper's transform to match the lightning field and entity transform.
   *
   * @param baseSize - The base size of the lightning field
   * @param transform - The entity's transform data
   */
  update(
    baseSize: { x: number; y: number },
    transform: Transform3DData,
  ): void {
    // Apply entity transform (2D uses only XY position and Z rotation)
    this.position.set(
      transform.position.x,
      transform.position.y,
      transform.position.z,
    );
    this.rotation.set(0, 0, transform.rotation.z);

    // Apply baseSize * transform.scale
    this.scale.set(
      baseSize.x * transform.scale.x,
      baseSize.y * transform.scale.y,
      1,
    );

    // Check if size changed and needs geometry rebuild
    if (baseSize.x !== this._lastSizeX || baseSize.y !== this._lastSizeY) {
      this._lastSizeX = baseSize.x;
      this._lastSizeY = baseSize.y;
      // Note: We don't need to rebuild geometry since we're using scale
      // The geometry is always a unit square (-0.5 to 0.5) and scale handles sizing
    }
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
   * @param color - The color (hex number)
   */
  setColor(color: number): void {
    this._material.color.setHex(color);
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
