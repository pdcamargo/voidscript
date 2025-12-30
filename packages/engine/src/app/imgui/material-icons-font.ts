/**
 * Material Icons Font - Bundled font data for editor
 *
 * Uses Vite's ?inline suffix to embed the font as base64 at build time
 */

// Import font as base64 (Vite handles this with ?inline suffix)
// @ts-expect-error - Vite handles this import
import materialIconsBase64 from '../../editor/fonts/material-icons.ttf?inline';

/**
 * Decode base64 font data to Uint8Array for ImGui
 */
export function getMaterialIconsFontData(): Uint8Array {
  // Remove data URL prefix if present
  const base64 = (materialIconsBase64 as string).replace(/^data:[^,]+,/, '');
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
