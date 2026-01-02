/**
 * Built-in theme presets for the VoidScript Editor
 *
 * Each preset provides a complete color palette based on popular color schemes.
 */

import type { ThemePreset, ThemeColors } from './theme-types.js';

/**
 * Helper to convert hex color to RGBA (0-1 range)
 */
function hex(hexColor: string, alpha: number = 1): { r: number; g: number; b: number; a: number } {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  return { r, g, b, a: alpha };
}

/**
 * Dracula Theme Colors
 * https://draculatheme.com/spec
 *
 * | Color      | Hex     |
 * |------------|---------|
 * | Background | #282A36 |
 * | Current    | #44475A |
 * | Foreground | #F8F8F2 |
 * | Comment    | #6272A4 |
 * | Cyan       | #8BE9FD |
 * | Green      | #50FA7B |
 * | Orange     | #FFB86C |
 * | Pink       | #FF79C6 |
 * | Purple     | #BD93F9 |
 * | Red        | #FF5555 |
 * | Yellow     | #F1FA8C |
 */
const DRACULA_COLORS: ThemeColors = {
  // Text colors
  textPrimary: hex('#F8F8F2'),      // Foreground
  textSecondary: hex('#6272A4'),    // Comment
  textDisabled: hex('#44475A'),     // Current/Selection
  textAccent: hex('#BD93F9'),       // Purple

  // Background colors
  titleBarBg: hex('#282A36'),       // Background
  panelBg: hex('#21222C'),          // Slightly darker than background
  windowBg: hex('#1E1F29'),         // Even darker for window bg

  // Button colors
  buttonTransparent: { r: 0, g: 0, b: 0, a: 0 },
  buttonHover: hex('#44475A'),      // Current/Selection
  buttonPlayHover: hex('#50FA7B', 0.3),  // Green with transparency
  buttonStopHover: hex('#FF5555', 0.3),  // Red with transparency
  buttonStepHover: hex('#8BE9FD', 0.3),  // Cyan with transparency

  // macOS traffic light colors (use Dracula's colors)
  trafficLightRed: hex('#FF5555'),      // Red
  trafficLightYellow: hex('#F1FA8C'),   // Yellow
  trafficLightGreen: hex('#50FA7B'),    // Green
  trafficLightDimmed: hex('#44475A'),   // Current/Selection
  trafficLightIcon: hex('#282A36', 0.8), // Background with transparency

  // Windows/Linux window controls
  windowsButtonHover: hex('#44475A'),   // Current/Selection
  windowsCloseHover: hex('#FF5555'),    // Red

  // Icon colors
  iconDefault: hex('#F8F8F2', 0.75),    // Foreground dimmed
  iconHover: hex('#F8F8F2', 0.9),       // Foreground almost full
  iconActive: hex('#FFFFFF'),           // Full white

  // ============================================================================
  // ImGui Style Colors (based on Dracula theme)
  // ============================================================================

  // Text
  imguiText: hex('#F8F8F2'),                 // Foreground
  imguiTextDisabled: hex('#6272A4'),         // Comment

  // Backgrounds
  imguiWindowBg: hex('#282A36'),             // Background
  imguiChildBg: hex('#21222C'),              // Slightly darker
  imguiPopupBg: hex('#21222C'),              // Same as child
  imguiBorder: hex('#44475A'),               // Current/Selection
  imguiBorderShadow: hex('#21222C'),         // Darker

  // Frame (inputs, sliders)
  imguiFrameBg: hex('#44475A'),              // Current/Selection
  imguiFrameBgHovered: hex('#6272A4'),       // Comment (lighter)
  imguiFrameBgActive: hex('#BD93F9'),        // Purple

  // Title bar
  imguiTitleBg: hex('#21222C'),              // Slightly darker
  imguiTitleBgActive: hex('#282A36'),        // Background
  imguiTitleBgCollapsed: hex('#21222C'),     // Slightly darker

  // Menu bar
  imguiMenuBarBg: hex('#21222C'),            // Slightly darker

  // Scrollbar
  imguiScrollbarBg: hex('#21222C'),          // Slightly darker
  imguiScrollbarGrab: hex('#44475A'),        // Current/Selection
  imguiScrollbarGrabHovered: hex('#6272A4'), // Comment
  imguiScrollbarGrabActive: hex('#BD93F9'),  // Purple

  // Widgets
  imguiCheckMark: hex('#8BE9FD'),            // Cyan
  imguiSliderGrab: hex('#BD93F9'),           // Purple
  imguiSliderGrabActive: hex('#FF79C6'),     // Pink

  // Buttons
  imguiButton: hex('#44475A'),               // Current/Selection
  imguiButtonHovered: hex('#6272A4'),        // Comment (lighter)
  imguiButtonActive: hex('#BD93F9'),         // Purple

  // Headers (collapsing headers, selectables)
  imguiHeader: hex('#44475A'),               // Current/Selection
  imguiHeaderHovered: hex('#6272A4'),        // Comment
  imguiHeaderActive: hex('#BD93F9'),         // Purple

  // Separator
  imguiSeparator: hex('#44475A'),            // Current/Selection
  imguiSeparatorHovered: hex('#BD93F9'),     // Purple
  imguiSeparatorActive: hex('#FF79C6'),      // Pink

  // Resize grip
  imguiResizeGrip: hex('#44475A'),           // Current/Selection
  imguiResizeGripHovered: hex('#BD93F9'),    // Purple
  imguiResizeGripActive: hex('#FF79C6'),     // Pink

  // Tabs
  imguiTab: hex('#21222C'),                  // Slightly darker
  imguiTabHovered: hex('#44475A'),           // Current/Selection
  imguiTabSelected: hex('#44475A'),          // Current/Selection
  imguiTabDimmed: hex('#21222C'),            // Slightly darker
  imguiTabDimmedSelected: hex('#44475A', 0.5), // Current with transparency

  // Docking
  imguiDockingPreview: hex('#BD93F9', 0.7),  // Purple with transparency
  imguiDockingEmptyBg: hex('#1E1F29'),       // Even darker

  // Tables
  imguiTableHeaderBg: hex('#21222C'),        // Slightly darker
  imguiTableBorderStrong: hex('#44475A'),    // Current/Selection
  imguiTableBorderLight: hex('#44475A', 0.5), // Lighter
  imguiTableRowBg: hex('#282A36'),           // Background
  imguiTableRowBgAlt: hex('#21222C'),        // Slightly darker

  // Selection
  imguiTextSelectedBg: hex('#44475A'),       // Current/Selection

  // Drag and drop
  imguiDragDropTarget: hex('#8BE9FD'),       // Cyan

  // Modal dim background
  imguiModalWindowDimBg: hex('#1E1F29', 0.7), // Very dark with transparency
};

/**
 * Default theme preset (Dracula-based)
 */
export const DEFAULT_PRESET: ThemePreset = {
  id: 'default',
  name: 'Default',
  builtIn: true,
  colors: DRACULA_COLORS,
};

/**
 * All built-in theme presets
 */
export const BUILT_IN_PRESETS: ThemePreset[] = [
  DEFAULT_PRESET,
];

/**
 * Get a built-in preset by ID
 */
export function getBuiltInPreset(id: string): ThemePreset | undefined {
  return BUILT_IN_PRESETS.find(preset => preset.id === id);
}

/**
 * Get the default preset
 */
export function getDefaultPreset(): ThemePreset {
  return DEFAULT_PRESET;
}
