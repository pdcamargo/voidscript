/**
 * ThemeManager - Singleton managing editor theme state and persistence
 *
 * Handles theme preset selection, custom color overrides, and persistence to disk.
 * Colors are loaded synchronously with defaults, then async loads persisted overrides.
 */

import { ImGui, ImVec4 } from '@voidscript/imgui';
import { EditorFileSystem } from '../editor-file-system.js';
import type { Color } from '../types.js';
import type { ThemeColors, ThemeColorKey, ThemePreset, PersistedThemeData } from './theme-types.js';
import { BUILT_IN_PRESETS, getDefaultPreset, getBuiltInPreset } from './theme-presets.js';

/**
 * Convert RGBA color (0-1 range) to ImVec4
 */
function colorToImVec4(color: Color): InstanceType<typeof ImVec4> {
  return new ImVec4(color.r, color.g, color.b, color.a ?? 1);
}

const THEME_FILE = 'editor-theme.json';

/**
 * Deep clone a ThemeColors object
 */
function cloneColors(colors: ThemeColors): ThemeColors {
  const result: Partial<ThemeColors> = {};
  for (const key of Object.keys(colors) as ThemeColorKey[]) {
    const color = colors[key];
    result[key] = { r: color.r, g: color.g, b: color.b, a: color.a ?? 1 };
  }
  return result as ThemeColors;
}

/**
 * Singleton class managing the editor theme.
 *
 * Provides methods for:
 * - Getting/setting the active theme preset
 * - Customizing individual colors
 * - Persisting theme preferences to disk
 *
 * @example
 * ```typescript
 * // Initialize theme system
 * await ThemeManager.initialize();
 *
 * // Get a color
 * const textColor = ThemeManager.getColor('textPrimary');
 *
 * // Switch preset
 * ThemeManager.setActivePreset('monokai');
 *
 * // Customize a color
 * ThemeManager.setCustomColor('textPrimary', { r: 1, g: 1, b: 1, a: 1 });
 *
 * // Save changes
 * await ThemeManager.save();
 * ```
 */
export class ThemeManager {
  // ============================================================================
  // State
  // ============================================================================

  /** Current active preset */
  private static activePreset: ThemePreset = getDefaultPreset();

  /** Custom color overrides on top of the active preset */
  private static customColors: Partial<ThemeColors> = {};

  /** Computed current colors (preset + custom overrides) */
  private static currentColors: ThemeColors = cloneColors(getDefaultPreset().colors);

  /** Whether the manager has been initialized */
  private static initialized = false;

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize the theme manager.
   * Loads persisted theme preferences from disk.
   * Safe to call multiple times - subsequent calls are no-ops.
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Mark as initialized immediately to prevent double init
    this.initialized = true;

    // Try to load persisted preferences
    const result = await EditorFileSystem.readJson<PersistedThemeData>(THEME_FILE);

    if (result.success && result.data) {
      const data = result.data;

      // Find and set the active preset
      const preset = getBuiltInPreset(data.activePresetId);
      if (preset) {
        this.activePreset = preset;
      }

      // Apply custom colors if any
      if (data.customColors) {
        this.customColors = data.customColors;
      }

      // Recompute current colors
      this.recomputeColors();
    }

    console.debug('ThemeManager initialized with preset:', this.activePreset.name);
  }

  // ============================================================================
  // Color Access
  // ============================================================================

  /**
   * Get a color from the current theme.
   * Returns the custom override if set, otherwise the preset color.
   *
   * @param key - The color key (e.g., 'textPrimary')
   * @returns The color value
   */
  static getColor(key: ThemeColorKey): Color {
    return this.currentColors[key];
  }

  /**
   * Get all current colors (readonly copy).
   */
  static getAllColors(): Readonly<ThemeColors> {
    return this.currentColors;
  }

  // ============================================================================
  // Preset Management
  // ============================================================================

  /**
   * Get the currently active preset.
   */
  static getActivePreset(): ThemePreset {
    return this.activePreset;
  }

  /**
   * Get all available presets (built-in only for now).
   */
  static getPresets(): readonly ThemePreset[] {
    return BUILT_IN_PRESETS;
  }

  /**
   * Set the active preset by ID.
   * Clears any custom color overrides.
   *
   * @param presetId - The preset ID to activate
   * @returns true if preset was found and set
   */
  static setActivePreset(presetId: string): boolean {
    const preset = getBuiltInPreset(presetId);
    if (!preset) {
      console.warn(`ThemeManager: Preset '${presetId}' not found`);
      return false;
    }

    this.activePreset = preset;
    this.customColors = {};
    this.recomputeColors();
    return true;
  }

  // ============================================================================
  // Custom Color Overrides
  // ============================================================================

  /**
   * Set a custom color override for the current preset.
   *
   * @param key - The color key to override
   * @param color - The new color value
   */
  static setCustomColor(key: ThemeColorKey, color: Color): void {
    this.customColors[key] = { r: color.r, g: color.g, b: color.b, a: color.a ?? 1 };
    this.currentColors[key] = this.customColors[key]!;
  }

  /**
   * Remove a custom color override, reverting to the preset color.
   *
   * @param key - The color key to reset
   */
  static removeCustomColor(key: ThemeColorKey): void {
    delete this.customColors[key];
    const presetColor = this.activePreset.colors[key];
    this.currentColors[key] = { r: presetColor.r, g: presetColor.g, b: presetColor.b, a: presetColor.a ?? 1 };
  }

  /**
   * Reset all custom colors, reverting to the preset defaults.
   */
  static resetCustomColors(): void {
    this.customColors = {};
    this.recomputeColors();
  }

  /**
   * Check if any custom color overrides are set.
   */
  static hasCustomColors(): boolean {
    return Object.keys(this.customColors).length > 0;
  }

  /**
   * Get all custom color overrides.
   */
  static getCustomColors(): Readonly<Partial<ThemeColors>> {
    return this.customColors;
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  /**
   * Save the current theme preferences to disk.
   */
  static async save(): Promise<void> {
    const data: PersistedThemeData = {
      activePresetId: this.activePreset.id,
    };

    // Only include custom colors if there are any
    if (this.hasCustomColors()) {
      data.customColors = this.customColors;
    }

    const result = await EditorFileSystem.writeJson(THEME_FILE, data);

    if (!result.success) {
      console.error('ThemeManager: Failed to save theme:', result.error);
    }
  }

  // ============================================================================
  // Internal Helpers
  // ============================================================================

  /**
   * Recompute current colors from preset + custom overrides
   */
  private static recomputeColors(): void {
    // Start with a clone of preset colors
    this.currentColors = cloneColors(this.activePreset.colors);

    // Apply custom overrides
    for (const key of Object.keys(this.customColors) as ThemeColorKey[]) {
      const customColor = this.customColors[key];
      if (customColor) {
        this.currentColors[key] = { r: customColor.r, g: customColor.g, b: customColor.b, a: customColor.a ?? 1 };
      }
    }
  }

  // ============================================================================
  // Testing / Reset
  // ============================================================================

  /**
   * Reset the manager to default state.
   * Primarily for testing purposes.
   *
   * @internal
   */
  static reset(): void {
    this.activePreset = getDefaultPreset();
    this.customColors = {};
    this.currentColors = cloneColors(getDefaultPreset().colors);
    this.initialized = false;
  }

  // ============================================================================
  // ImGui Style Application
  // ============================================================================

  /**
   * Apply the current theme colors to ImGui's style system.
   * This should be called after ImGui is initialized and after any theme changes.
   *
   * @returns true if applied successfully, false if ImGui is not available
   */
  static applyToImGui(): boolean {
    try {
      const style = ImGui.GetStyle();
      if (!style) {
        console.debug('ThemeManager: ImGui style not available yet');
        return false;
      }

      const colors = style.Colors;
      const c = this.currentColors;

      // Text
      colors[ImGui.Col.Text] = colorToImVec4(c.imguiText);
      colors[ImGui.Col.TextDisabled] = colorToImVec4(c.imguiTextDisabled);

      // Backgrounds
      colors[ImGui.Col.WindowBg] = colorToImVec4(c.imguiWindowBg);
      colors[ImGui.Col.ChildBg] = colorToImVec4(c.imguiChildBg);
      colors[ImGui.Col.PopupBg] = colorToImVec4(c.imguiPopupBg);
      colors[ImGui.Col.Border] = colorToImVec4(c.imguiBorder);
      colors[ImGui.Col.BorderShadow] = colorToImVec4(c.imguiBorderShadow);

      // Frame (inputs, sliders)
      colors[ImGui.Col.FrameBg] = colorToImVec4(c.imguiFrameBg);
      colors[ImGui.Col.FrameBgHovered] = colorToImVec4(c.imguiFrameBgHovered);
      colors[ImGui.Col.FrameBgActive] = colorToImVec4(c.imguiFrameBgActive);

      // Title bar
      colors[ImGui.Col.TitleBg] = colorToImVec4(c.imguiTitleBg);
      colors[ImGui.Col.TitleBgActive] = colorToImVec4(c.imguiTitleBgActive);
      colors[ImGui.Col.TitleBgCollapsed] = colorToImVec4(c.imguiTitleBgCollapsed);

      // Menu bar
      colors[ImGui.Col.MenuBarBg] = colorToImVec4(c.imguiMenuBarBg);

      // Scrollbar
      colors[ImGui.Col.ScrollbarBg] = colorToImVec4(c.imguiScrollbarBg);
      colors[ImGui.Col.ScrollbarGrab] = colorToImVec4(c.imguiScrollbarGrab);
      colors[ImGui.Col.ScrollbarGrabHovered] = colorToImVec4(c.imguiScrollbarGrabHovered);
      colors[ImGui.Col.ScrollbarGrabActive] = colorToImVec4(c.imguiScrollbarGrabActive);

      // Widgets
      colors[ImGui.Col.CheckMark] = colorToImVec4(c.imguiCheckMark);
      colors[ImGui.Col.SliderGrab] = colorToImVec4(c.imguiSliderGrab);
      colors[ImGui.Col.SliderGrabActive] = colorToImVec4(c.imguiSliderGrabActive);

      // Buttons
      colors[ImGui.Col.Button] = colorToImVec4(c.imguiButton);
      colors[ImGui.Col.ButtonHovered] = colorToImVec4(c.imguiButtonHovered);
      colors[ImGui.Col.ButtonActive] = colorToImVec4(c.imguiButtonActive);

      // Headers (collapsing headers, selectables)
      colors[ImGui.Col.Header] = colorToImVec4(c.imguiHeader);
      colors[ImGui.Col.HeaderHovered] = colorToImVec4(c.imguiHeaderHovered);
      colors[ImGui.Col.HeaderActive] = colorToImVec4(c.imguiHeaderActive);

      // Separator
      colors[ImGui.Col.Separator] = colorToImVec4(c.imguiSeparator);
      colors[ImGui.Col.SeparatorHovered] = colorToImVec4(c.imguiSeparatorHovered);
      colors[ImGui.Col.SeparatorActive] = colorToImVec4(c.imguiSeparatorActive);

      // Resize grip
      colors[ImGui.Col.ResizeGrip] = colorToImVec4(c.imguiResizeGrip);
      colors[ImGui.Col.ResizeGripHovered] = colorToImVec4(c.imguiResizeGripHovered);
      colors[ImGui.Col.ResizeGripActive] = colorToImVec4(c.imguiResizeGripActive);

      // Tabs
      colors[ImGui.Col.Tab] = colorToImVec4(c.imguiTab);
      colors[ImGui.Col.TabHovered] = colorToImVec4(c.imguiTabHovered);
      colors[ImGui.Col.TabSelected] = colorToImVec4(c.imguiTabSelected);
      colors[ImGui.Col.TabDimmed] = colorToImVec4(c.imguiTabDimmed);
      colors[ImGui.Col.TabDimmedSelected] = colorToImVec4(c.imguiTabDimmedSelected);

      // Docking
      colors[ImGui.Col.DockingPreview] = colorToImVec4(c.imguiDockingPreview);
      colors[ImGui.Col.DockingEmptyBg] = colorToImVec4(c.imguiDockingEmptyBg);

      // Tables
      colors[ImGui.Col.TableHeaderBg] = colorToImVec4(c.imguiTableHeaderBg);
      colors[ImGui.Col.TableBorderStrong] = colorToImVec4(c.imguiTableBorderStrong);
      colors[ImGui.Col.TableBorderLight] = colorToImVec4(c.imguiTableBorderLight);
      colors[ImGui.Col.TableRowBg] = colorToImVec4(c.imguiTableRowBg);
      colors[ImGui.Col.TableRowBgAlt] = colorToImVec4(c.imguiTableRowBgAlt);

      // Selection
      colors[ImGui.Col.TextSelectedBg] = colorToImVec4(c.imguiTextSelectedBg);

      // Drag and drop
      colors[ImGui.Col.DragDropTarget] = colorToImVec4(c.imguiDragDropTarget);

      // Modal dim background
      colors[ImGui.Col.ModalWindowDimBg] = colorToImVec4(c.imguiModalWindowDimBg);

      // Apply the modified colors array back to the style
      style.Colors = colors;

      console.debug('ThemeManager: Applied theme to ImGui');
      return true;
    } catch (error) {
      console.debug('ThemeManager: Failed to apply theme to ImGui:', error);
      return false;
    }
  }
}
