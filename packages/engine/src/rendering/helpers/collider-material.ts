/**
 * Collider Helper Material Factory
 *
 * Creates LineMaterial for rendering collider wireframes in the editor.
 */

import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

/**
 * Create material for collider helper visualization
 * @param width - Renderer width for resolution setting
 * @param height - Renderer height for resolution setting
 * @param color - Hex color for the wireframe (default: green 0x00ff00)
 * @returns LineMaterial configured for helper rendering
 */
export function createColliderHelperMaterial(
  width: number,
  height: number,
  color: number = 0x00ff00
): LineMaterial {
  const material = new LineMaterial({
    color,
    linewidth: 3, // in pixels (increased for visibility)
  });

  // Set resolution - REQUIRED for LineMaterial to render properly
  material.resolution.set(width, height);
  material.needsUpdate = true;

  return material;
}
