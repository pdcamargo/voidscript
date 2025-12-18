/**
 * Three.js Layer Constants
 *
 * Three.js supports 32 layers (0-31) for selective rendering.
 * Objects and cameras can enable/disable layers to control visibility.
 */

/**
 * Layer 31: Debug Helpers
 *
 * Used for editor-only debug visualizations (CameraHelper, LightHelper, etc.)
 * - Editor cameras enable this layer to see helpers
 * - Game cameras do NOT enable this layer (helpers invisible in game view)
 */
export const HELPER_LAYER = 31;
