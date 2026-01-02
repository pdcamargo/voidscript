/**
 * EditorColors - Centralized color palette for VoidScript Editor
 *
 * Provides consistent colors across the editor UI.
 * All colors use RGBA values from 0-1.
 */

import type { Color } from './types.js';

/**
 * Static class containing all editor color constants
 */
export class EditorColors {
  // ============================================================================
  // Text Colors
  // ============================================================================

  /** Primary text color - slightly muted white */
  static readonly TEXT_PRIMARY: Color = { r: 0.85, g: 0.85, b: 0.85, a: 1.0 };

  /** Secondary text color - dimmed for less important info */
  static readonly TEXT_SECONDARY: Color = { r: 0.6, g: 0.6, b: 0.6, a: 1.0 };

  /** Disabled/hint text color */
  static readonly TEXT_DISABLED: Color = { r: 0.4, g: 0.4, b: 0.4, a: 1.0 };

  /** Accent text color - for highlights */
  static readonly TEXT_ACCENT: Color = { r: 0.4, g: 0.7, b: 1.0, a: 1.0 };

  // ============================================================================
  // Background Colors
  // ============================================================================

  /** Title bar background */
  static readonly TITLE_BAR_BG: Color = { r: 0.15, g: 0.15, b: 0.15, a: 1.0 };

  /** Panel background */
  static readonly PANEL_BG: Color = { r: 0.18, g: 0.18, b: 0.18, a: 1.0 };

  /** Window background */
  static readonly WINDOW_BG: Color = { r: 0.12, g: 0.12, b: 0.12, a: 1.0 };

  // ============================================================================
  // Button Colors
  // ============================================================================

  /** Transparent button background */
  static readonly BUTTON_TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };

  /** Default button hover color */
  static readonly BUTTON_HOVER: Color = { r: 0.3, g: 0.3, b: 0.3, a: 1.0 };

  /** Play button hover color (green tint) */
  static readonly BUTTON_PLAY_HOVER: Color = { r: 0.3, g: 0.6, b: 0.3, a: 1.0 };

  /** Stop button hover color (red tint) */
  static readonly BUTTON_STOP_HOVER: Color = { r: 0.6, g: 0.3, b: 0.3, a: 1.0 };

  /** Step button hover color (blue tint) */
  static readonly BUTTON_STEP_HOVER: Color = { r: 0.4, g: 0.4, b: 0.6, a: 1.0 };

  // ============================================================================
  // macOS Traffic Light Colors
  // ============================================================================

  /** Traffic light red (close button) */
  static readonly TRAFFIC_LIGHT_RED: Color = { r: 1.0, g: 0.38, b: 0.36, a: 1.0 };

  /** Traffic light yellow (minimize button) */
  static readonly TRAFFIC_LIGHT_YELLOW: Color = { r: 1.0, g: 0.78, b: 0.25, a: 1.0 };

  /** Traffic light green (maximize button) */
  static readonly TRAFFIC_LIGHT_GREEN: Color = { r: 0.35, g: 0.78, b: 0.36, a: 1.0 };

  /** Traffic light dimmed (unfocused window) */
  static readonly TRAFFIC_LIGHT_DIMMED: Color = { r: 0.4, g: 0.4, b: 0.4, a: 1.0 };

  /** Traffic light icon color (dark) */
  static readonly TRAFFIC_LIGHT_ICON: Color = { r: 0.2, g: 0.2, b: 0.2, a: 0.8 };

  // ============================================================================
  // Windows/Linux Window Control Colors
  // ============================================================================

  /** Windows button hover color */
  static readonly WINDOWS_BUTTON_HOVER: Color = { r: 0.3, g: 0.3, b: 0.3, a: 1.0 };

  /** Windows close button hover color */
  static readonly WINDOWS_CLOSE_HOVER: Color = { r: 0.9, g: 0.2, b: 0.2, a: 1.0 };

  // ============================================================================
  // Icon Colors
  // ============================================================================

  /** Default icon color */
  static readonly ICON_DEFAULT: Color = { r: 0.75, g: 0.75, b: 0.75, a: 1.0 };

  /** Icon color on hover */
  static readonly ICON_HOVER: Color = { r: 0.9, g: 0.9, b: 0.9, a: 1.0 };

  /** Icon color when active/pressed */
  static readonly ICON_ACTIVE: Color = { r: 1.0, g: 1.0, b: 1.0, a: 1.0 };
}
