/**
 * EditorColors - Centralized color palette for VoidScript Editor
 *
 * Provides consistent colors across the editor UI.
 * All colors use RGBA values from 0-1.
 *
 * Colors are now dynamically provided by ThemeManager to support theming.
 */

import type { Color } from './types.js';
import { ThemeManager } from './theme/theme-manager.js';

/**
 * Static class providing all editor colors.
 *
 * Colors are dynamically retrieved from ThemeManager, allowing
 * theme presets and custom color overrides.
 */
export class EditorColors {
  // ============================================================================
  // Text Colors
  // ============================================================================

  /** Primary text color - slightly muted white */
  static get TEXT_PRIMARY(): Color {
    return ThemeManager.getColor('textPrimary');
  }

  /** Secondary text color - dimmed for less important info */
  static get TEXT_SECONDARY(): Color {
    return ThemeManager.getColor('textSecondary');
  }

  /** Disabled/hint text color */
  static get TEXT_DISABLED(): Color {
    return ThemeManager.getColor('textDisabled');
  }

  /** Accent text color - for highlights */
  static get TEXT_ACCENT(): Color {
    return ThemeManager.getColor('textAccent');
  }

  // ============================================================================
  // Background Colors
  // ============================================================================

  /** Title bar background */
  static get TITLE_BAR_BG(): Color {
    return ThemeManager.getColor('titleBarBg');
  }

  /** Panel background */
  static get PANEL_BG(): Color {
    return ThemeManager.getColor('panelBg');
  }

  /** Window background */
  static get WINDOW_BG(): Color {
    return ThemeManager.getColor('windowBg');
  }

  // ============================================================================
  // Button Colors
  // ============================================================================

  /** Transparent button background */
  static get BUTTON_TRANSPARENT(): Color {
    return ThemeManager.getColor('buttonTransparent');
  }

  /** Default button hover color */
  static get BUTTON_HOVER(): Color {
    return ThemeManager.getColor('buttonHover');
  }

  /** Play button hover color (green tint) */
  static get BUTTON_PLAY_HOVER(): Color {
    return ThemeManager.getColor('buttonPlayHover');
  }

  /** Stop button hover color (red tint) */
  static get BUTTON_STOP_HOVER(): Color {
    return ThemeManager.getColor('buttonStopHover');
  }

  /** Step button hover color (blue tint) */
  static get BUTTON_STEP_HOVER(): Color {
    return ThemeManager.getColor('buttonStepHover');
  }

  // ============================================================================
  // macOS Traffic Light Colors
  // ============================================================================

  /** Traffic light red (close button) */
  static get TRAFFIC_LIGHT_RED(): Color {
    return ThemeManager.getColor('trafficLightRed');
  }

  /** Traffic light yellow (minimize button) */
  static get TRAFFIC_LIGHT_YELLOW(): Color {
    return ThemeManager.getColor('trafficLightYellow');
  }

  /** Traffic light green (maximize button) */
  static get TRAFFIC_LIGHT_GREEN(): Color {
    return ThemeManager.getColor('trafficLightGreen');
  }

  /** Traffic light dimmed (unfocused window) */
  static get TRAFFIC_LIGHT_DIMMED(): Color {
    return ThemeManager.getColor('trafficLightDimmed');
  }

  /** Traffic light icon color (dark) */
  static get TRAFFIC_LIGHT_ICON(): Color {
    return ThemeManager.getColor('trafficLightIcon');
  }

  // ============================================================================
  // Windows/Linux Window Control Colors
  // ============================================================================

  /** Windows button hover color */
  static get WINDOWS_BUTTON_HOVER(): Color {
    return ThemeManager.getColor('windowsButtonHover');
  }

  /** Windows close button hover color */
  static get WINDOWS_CLOSE_HOVER(): Color {
    return ThemeManager.getColor('windowsCloseHover');
  }

  // ============================================================================
  // Icon Colors
  // ============================================================================

  /** Default icon color */
  static get ICON_DEFAULT(): Color {
    return ThemeManager.getColor('iconDefault');
  }

  /** Icon color on hover */
  static get ICON_HOVER(): Color {
    return ThemeManager.getColor('iconHover');
  }

  /** Icon color when active/pressed */
  static get ICON_ACTIVE(): Color {
    return ThemeManager.getColor('iconActive');
  }
}
