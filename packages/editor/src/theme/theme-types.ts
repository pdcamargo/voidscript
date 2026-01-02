/**
 * Theme type definitions for the VoidScript Editor theming system
 */

import type { Color } from '../types.js';

/**
 * Complete theme color palette.
 * All colors use RGBA values from 0-1.
 */
export interface ThemeColors {
  // ============================================================================
  // Text Colors
  // ============================================================================

  /** Primary text color - main readable text */
  textPrimary: Color;

  /** Secondary text color - dimmed for less important info */
  textSecondary: Color;

  /** Disabled/hint text color */
  textDisabled: Color;

  /** Accent text color - for highlights and links */
  textAccent: Color;

  // ============================================================================
  // Background Colors
  // ============================================================================

  /** Title bar background */
  titleBarBg: Color;

  /** Panel background */
  panelBg: Color;

  /** Window background */
  windowBg: Color;

  // ============================================================================
  // Button Colors
  // ============================================================================

  /** Transparent button background */
  buttonTransparent: Color;

  /** Default button hover color */
  buttonHover: Color;

  /** Play button hover color (green tint) */
  buttonPlayHover: Color;

  /** Stop button hover color (red tint) */
  buttonStopHover: Color;

  /** Step button hover color (blue tint) */
  buttonStepHover: Color;

  // ============================================================================
  // macOS Traffic Light Colors
  // ============================================================================

  /** Traffic light red (close button) */
  trafficLightRed: Color;

  /** Traffic light yellow (minimize button) */
  trafficLightYellow: Color;

  /** Traffic light green (maximize button) */
  trafficLightGreen: Color;

  /** Traffic light dimmed (unfocused window) */
  trafficLightDimmed: Color;

  /** Traffic light icon color (dark) */
  trafficLightIcon: Color;

  // ============================================================================
  // Windows/Linux Window Control Colors
  // ============================================================================

  /** Windows button hover color */
  windowsButtonHover: Color;

  /** Windows close button hover color */
  windowsCloseHover: Color;

  // ============================================================================
  // Icon Colors
  // ============================================================================

  /** Default icon color */
  iconDefault: Color;

  /** Icon color on hover */
  iconHover: Color;

  /** Icon color when active/pressed */
  iconActive: Color;

  // ============================================================================
  // ImGui Style Colors (applied to ImGui.GetStyle().Colors)
  // ============================================================================

  /** ImGui text color */
  imguiText: Color;

  /** ImGui disabled text color */
  imguiTextDisabled: Color;

  /** ImGui window background */
  imguiWindowBg: Color;

  /** ImGui child window background */
  imguiChildBg: Color;

  /** ImGui popup background */
  imguiPopupBg: Color;

  /** ImGui border color */
  imguiBorder: Color;

  /** ImGui border shadow */
  imguiBorderShadow: Color;

  /** ImGui frame background (inputs, sliders) */
  imguiFrameBg: Color;

  /** ImGui frame background on hover */
  imguiFrameBgHovered: Color;

  /** ImGui frame background when active */
  imguiFrameBgActive: Color;

  /** ImGui title bar background */
  imguiTitleBg: Color;

  /** ImGui title bar background when active */
  imguiTitleBgActive: Color;

  /** ImGui title bar background when collapsed */
  imguiTitleBgCollapsed: Color;

  /** ImGui menu bar background */
  imguiMenuBarBg: Color;

  /** ImGui scrollbar background */
  imguiScrollbarBg: Color;

  /** ImGui scrollbar grab */
  imguiScrollbarGrab: Color;

  /** ImGui scrollbar grab on hover */
  imguiScrollbarGrabHovered: Color;

  /** ImGui scrollbar grab when active */
  imguiScrollbarGrabActive: Color;

  /** ImGui checkmark color */
  imguiCheckMark: Color;

  /** ImGui slider grab */
  imguiSliderGrab: Color;

  /** ImGui slider grab when active */
  imguiSliderGrabActive: Color;

  /** ImGui button background */
  imguiButton: Color;

  /** ImGui button background on hover */
  imguiButtonHovered: Color;

  /** ImGui button background when active */
  imguiButtonActive: Color;

  /** ImGui header (collapsing headers, selectable) */
  imguiHeader: Color;

  /** ImGui header on hover */
  imguiHeaderHovered: Color;

  /** ImGui header when active */
  imguiHeaderActive: Color;

  /** ImGui separator color */
  imguiSeparator: Color;

  /** ImGui separator on hover */
  imguiSeparatorHovered: Color;

  /** ImGui separator when active */
  imguiSeparatorActive: Color;

  /** ImGui resize grip */
  imguiResizeGrip: Color;

  /** ImGui resize grip on hover */
  imguiResizeGripHovered: Color;

  /** ImGui resize grip when active */
  imguiResizeGripActive: Color;

  /** ImGui tab */
  imguiTab: Color;

  /** ImGui tab on hover */
  imguiTabHovered: Color;

  /** ImGui tab when selected */
  imguiTabSelected: Color;

  /** ImGui dimmed tab */
  imguiTabDimmed: Color;

  /** ImGui dimmed tab when selected */
  imguiTabDimmedSelected: Color;

  /** ImGui docking preview */
  imguiDockingPreview: Color;

  /** ImGui docking empty background */
  imguiDockingEmptyBg: Color;

  /** ImGui table header background */
  imguiTableHeaderBg: Color;

  /** ImGui table strong border */
  imguiTableBorderStrong: Color;

  /** ImGui table light border */
  imguiTableBorderLight: Color;

  /** ImGui table row background */
  imguiTableRowBg: Color;

  /** ImGui table alternate row background */
  imguiTableRowBgAlt: Color;

  /** ImGui text selected background */
  imguiTextSelectedBg: Color;

  /** ImGui drag drop target */
  imguiDragDropTarget: Color;

  /** ImGui modal window dim background */
  imguiModalWindowDimBg: Color;
}

/**
 * All color keys in ThemeColors
 */
export type ThemeColorKey = keyof ThemeColors;

/**
 * Theme preset definition
 */
export interface ThemePreset {
  /** Unique identifier (e.g., 'default', 'monokai') */
  id: string;

  /** Display name shown in UI (e.g., 'Default', 'Monokai') */
  name: string;

  /** Whether this is a built-in preset (cannot be deleted) */
  builtIn: boolean;

  /** Complete color palette for this theme */
  colors: ThemeColors;
}

/**
 * Persisted theme data structure stored to disk
 */
export interface PersistedThemeData {
  /** Currently active preset ID */
  activePresetId: string;

  /** Custom modifications to the active preset (if any) */
  customColors?: Partial<ThemeColors>;
}
