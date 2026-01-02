/**
 * EditorPreferencesDialog - Modal dialog for editing editor preferences
 *
 * Provides a Godot-style preferences dialog with vertical tabs.
 * Currently supports theme selection and color customization.
 */

import { ImGui } from '@voidscript/imgui';
import { EditorDialog, type EditorDialogConfig } from './editor-dialog.js';
import { EditorLayout, type VerticalTab } from './editor-layout.js';
import { ThemeManager } from './theme/theme-manager.js';
import type { ThemeColors, ThemeColorKey, ThemePreset } from './theme/theme-types.js';
import type { Color } from './types.js';

/**
 * Deep clone a partial ThemeColors object
 */
function clonePartialColors(colors: Partial<ThemeColors>): Partial<ThemeColors> {
  const result: Partial<ThemeColors> = {};
  for (const key of Object.keys(colors) as ThemeColorKey[]) {
    const color = colors[key];
    if (color) {
      result[key] = { r: color.r, g: color.g, b: color.b, a: color.a ?? 1 };
    }
  }
  return result;
}

/**
 * Deep clone full ThemeColors
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
 * Color category for organizing the color editor
 */
interface ColorCategory {
  name: string;
  colors: Array<{ key: ThemeColorKey; label: string }>;
}

/**
 * All color categories for the UI
 */
const COLOR_CATEGORIES: ColorCategory[] = [
  // ============================================================================
  // Editor UI Colors (Title bar, buttons, icons)
  // ============================================================================
  {
    name: 'Editor Text',
    colors: [
      { key: 'textPrimary', label: 'Primary' },
      { key: 'textSecondary', label: 'Secondary' },
      { key: 'textDisabled', label: 'Disabled' },
      { key: 'textAccent', label: 'Accent' },
    ],
  },
  {
    name: 'Editor Backgrounds',
    colors: [
      { key: 'titleBarBg', label: 'Title Bar' },
      { key: 'panelBg', label: 'Panel' },
      { key: 'windowBg', label: 'Window' },
    ],
  },
  {
    name: 'Editor Buttons',
    colors: [
      { key: 'buttonTransparent', label: 'Transparent' },
      { key: 'buttonHover', label: 'Hover' },
      { key: 'buttonPlayHover', label: 'Play Hover' },
      { key: 'buttonStopHover', label: 'Stop Hover' },
      { key: 'buttonStepHover', label: 'Step Hover' },
    ],
  },
  {
    name: 'Traffic Lights (macOS)',
    colors: [
      { key: 'trafficLightRed', label: 'Close' },
      { key: 'trafficLightYellow', label: 'Minimize' },
      { key: 'trafficLightGreen', label: 'Maximize' },
      { key: 'trafficLightDimmed', label: 'Dimmed' },
      { key: 'trafficLightIcon', label: 'Icon' },
    ],
  },
  {
    name: 'Window Controls (Windows/Linux)',
    colors: [
      { key: 'windowsButtonHover', label: 'Button Hover' },
      { key: 'windowsCloseHover', label: 'Close Hover' },
    ],
  },
  {
    name: 'Icons',
    colors: [
      { key: 'iconDefault', label: 'Default' },
      { key: 'iconHover', label: 'Hover' },
      { key: 'iconActive', label: 'Active' },
    ],
  },
  // ============================================================================
  // ImGui Style Colors (Panels, dialogs, widgets)
  // ============================================================================
  {
    name: 'Panel Text',
    colors: [
      { key: 'imguiText', label: 'Text' },
      { key: 'imguiTextDisabled', label: 'Disabled' },
      { key: 'imguiTextSelectedBg', label: 'Selection' },
    ],
  },
  {
    name: 'Panel Backgrounds',
    colors: [
      { key: 'imguiWindowBg', label: 'Window' },
      { key: 'imguiChildBg', label: 'Child Panel' },
      { key: 'imguiPopupBg', label: 'Popup' },
      { key: 'imguiMenuBarBg', label: 'Menu Bar' },
    ],
  },
  {
    name: 'Panel Title Bar',
    colors: [
      { key: 'imguiTitleBg', label: 'Background' },
      { key: 'imguiTitleBgActive', label: 'Active' },
      { key: 'imguiTitleBgCollapsed', label: 'Collapsed' },
    ],
  },
  {
    name: 'Panel Borders',
    colors: [
      { key: 'imguiBorder', label: 'Border' },
      { key: 'imguiBorderShadow', label: 'Shadow' },
      { key: 'imguiSeparator', label: 'Separator' },
      { key: 'imguiSeparatorHovered', label: 'Separator Hover' },
      { key: 'imguiSeparatorActive', label: 'Separator Active' },
    ],
  },
  {
    name: 'Inputs & Frames',
    colors: [
      { key: 'imguiFrameBg', label: 'Background' },
      { key: 'imguiFrameBgHovered', label: 'Hover' },
      { key: 'imguiFrameBgActive', label: 'Active' },
    ],
  },
  {
    name: 'Buttons',
    colors: [
      { key: 'imguiButton', label: 'Background' },
      { key: 'imguiButtonHovered', label: 'Hover' },
      { key: 'imguiButtonActive', label: 'Active' },
    ],
  },
  {
    name: 'Headers & Selectables',
    colors: [
      { key: 'imguiHeader', label: 'Background' },
      { key: 'imguiHeaderHovered', label: 'Hover' },
      { key: 'imguiHeaderActive', label: 'Active' },
    ],
  },
  {
    name: 'Scrollbar',
    colors: [
      { key: 'imguiScrollbarBg', label: 'Background' },
      { key: 'imguiScrollbarGrab', label: 'Grab' },
      { key: 'imguiScrollbarGrabHovered', label: 'Grab Hover' },
      { key: 'imguiScrollbarGrabActive', label: 'Grab Active' },
    ],
  },
  {
    name: 'Widgets',
    colors: [
      { key: 'imguiCheckMark', label: 'Checkmark' },
      { key: 'imguiSliderGrab', label: 'Slider Grab' },
      { key: 'imguiSliderGrabActive', label: 'Slider Active' },
    ],
  },
  {
    name: 'Resize Grip',
    colors: [
      { key: 'imguiResizeGrip', label: 'Background' },
      { key: 'imguiResizeGripHovered', label: 'Hover' },
      { key: 'imguiResizeGripActive', label: 'Active' },
    ],
  },
  {
    name: 'Tabs',
    colors: [
      { key: 'imguiTab', label: 'Background' },
      { key: 'imguiTabHovered', label: 'Hover' },
      { key: 'imguiTabSelected', label: 'Selected' },
      { key: 'imguiTabDimmed', label: 'Dimmed' },
      { key: 'imguiTabDimmedSelected', label: 'Dimmed Selected' },
    ],
  },
  {
    name: 'Docking',
    colors: [
      { key: 'imguiDockingPreview', label: 'Preview' },
      { key: 'imguiDockingEmptyBg', label: 'Empty Background' },
    ],
  },
  {
    name: 'Tables',
    colors: [
      { key: 'imguiTableHeaderBg', label: 'Header' },
      { key: 'imguiTableBorderStrong', label: 'Strong Border' },
      { key: 'imguiTableBorderLight', label: 'Light Border' },
      { key: 'imguiTableRowBg', label: 'Row' },
      { key: 'imguiTableRowBgAlt', label: 'Row Alt' },
    ],
  },
  {
    name: 'Misc',
    colors: [
      { key: 'imguiDragDropTarget', label: 'Drag & Drop Target' },
      { key: 'imguiModalWindowDimBg', label: 'Modal Dim' },
    ],
  },
];

/**
 * Preferences dialog tabs
 */
const PREFERENCE_TABS: VerticalTab[] = [
  { id: 'appearance', label: 'Appearance' },
];

/**
 * Editor Preferences Dialog
 *
 * Modal dialog for editing editor preferences including theme selection
 * and color customization. Changes are previewed live but require
 * explicit save or cancel actions.
 */
export class EditorPreferencesDialog extends EditorDialog {
  /** Currently active tab */
  private activeTab = 'appearance';

  /** Editing state - the preset we're currently editing */
  private editingPresetId: string = 'default';

  /** Editing colors - live preview colors that may not be saved */
  private editingColors: ThemeColors | null = null;

  /** Original colors when dialog opened - for cancel/restore */
  private originalPresetId: string = 'default';
  private originalCustomColors: Partial<ThemeColors> = {};

  /** Track if changes have been made */
  private hasChanges = false;

  constructor(config?: Partial<EditorDialogConfig>) {
    super({
      id: 'editor-preferences',
      title: 'Editor Preferences',
      width: 700,
      height: 500,
      menuPath: 'Editor/Editor Preferences',
      shortcut: 'CmdOrCtrl+,',
      ...config,
    });
  }

  /**
   * Called when dialog opens - snapshot current theme state
   */
  protected override onOpened(): void {
    // Store original state for cancel
    this.originalPresetId = ThemeManager.getActivePreset().id;
    this.originalCustomColors = clonePartialColors(ThemeManager.getCustomColors());

    // Initialize editing state
    this.editingPresetId = this.originalPresetId;
    this.editingColors = cloneColors(ThemeManager.getAllColors());
    this.hasChanges = false;
    this.activeTab = 'appearance';
  }

  /**
   * Called when dialog closes
   */
  protected override onClosed(): void {
    // Clear editing state
    this.editingColors = null;
  }

  /**
   * Render the dialog content
   */
  protected override onRender(): void {
    // Reserve space for bottom buttons
    const buttonAreaHeight = 40;
    const contentHeight = ImGui.GetContentRegionAvail().y - buttonAreaHeight;

    // Create a child region for the main content (tabs + content)
    ImGui.BeginChild('prefs_main_content', { x: 0, y: contentHeight }, 0);

    // Vertical tab layout
    const result = EditorLayout.verticalTabLayout(
      'prefs',
      PREFERENCE_TABS,
      this.activeTab,
      { tabWidth: 160 },
    );
    this.activeTab = result.selectedTabId;

    if (result.beginContent()) {
      if (this.activeTab === 'appearance') {
        this.renderAppearanceTab();
      }
      result.endContent();
    }

    ImGui.EndChild();

    // Bottom button bar
    this.renderButtonBar();
  }

  /**
   * Render the Appearance tab content
   */
  private renderAppearanceTab(): void {
    if (!this.editingColors) return;

    // Theme preset selector
    EditorLayout.sectionHeader('Theme Preset');
    EditorLayout.spacing();

    const presets = ThemeManager.getPresets();
    const currentPreset = presets.find(p => p.id === this.editingPresetId);

    // Preset dropdown
    if (ImGui.BeginCombo('##preset', currentPreset?.name ?? 'Unknown')) {
      for (const preset of presets) {
        const isSelected = preset.id === this.editingPresetId;
        if (ImGui.Selectable(preset.name, isSelected)) {
          this.selectPreset(preset);
        }
        if (isSelected) {
          ImGui.SetItemDefaultFocus();
        }
      }
      ImGui.EndCombo();
    }

    EditorLayout.spacing();

    // Reset button (only show if colors are customized)
    if (this.hasCustomizedColors()) {
      if (EditorLayout.button('Reset to Default', { tooltip: 'Reset all colors to preset defaults' })) {
        this.resetToPresetDefaults();
      }
      EditorLayout.spacing();
    }

    EditorLayout.separator();
    EditorLayout.spacing();

    // Color editors in collapsible sections
    EditorLayout.sectionHeader('Colors');

    for (const category of COLOR_CATEGORIES) {
      if (EditorLayout.collapsingHeader(category.name)) {
        ImGui.Indent(10);

        for (const colorDef of category.colors) {
          const color = this.editingColors[colorDef.key];
          if (this.renderColorEditor(colorDef.label, colorDef.key, color)) {
            this.hasChanges = true;
            // Apply to ThemeManager for live preview
            ThemeManager.setCustomColor(colorDef.key, color);
            ThemeManager.applyToImGui();
          }
        }

        ImGui.Unindent(10);
        EditorLayout.spacing();
      }
    }
  }

  /**
   * Render a single color editor row
   */
  private renderColorEditor(label: string, key: ThemeColorKey, color: Color): boolean {
    // Check if this color is customized (different from preset)
    const preset = ThemeManager.getPresets().find(p => p.id === this.editingPresetId);
    const presetColor = preset?.colors[key];
    const isCustomized = presetColor && !this.colorsEqual(color, presetColor);

    // Show indicator if customized
    if (isCustomized) {
      ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: 0.4, y: 0.7, z: 1.0, w: 1.0 });
      ImGui.Text('*');
      ImGui.PopStyleColor();
      EditorLayout.sameLine();
    }

    return EditorLayout.colorField(label, color);
  }

  /**
   * Render the bottom button bar
   */
  private renderButtonBar(): void {
    EditorLayout.separator();
    EditorLayout.spacing();

    // Right-align buttons
    const buttonWidth = 80;
    const spacing = 8;
    const totalWidth = buttonWidth * 2 + spacing;
    const availableWidth = ImGui.GetContentRegionAvail().x;

    EditorLayout.setCursorPosX(availableWidth - totalWidth);

    if (EditorLayout.button('Cancel', { width: buttonWidth })) {
      this.cancel();
    }

    EditorLayout.sameLine(spacing);

    if (EditorLayout.button('Save', { width: buttonWidth })) {
      this.save();
    }
  }

  /**
   * Select a new preset
   */
  private selectPreset(preset: ThemePreset): void {
    this.editingPresetId = preset.id;
    this.editingColors = cloneColors(preset.colors);
    this.hasChanges = true;

    // Apply to ThemeManager for live preview
    ThemeManager.setActivePreset(preset.id);
    ThemeManager.applyToImGui();
  }

  /**
   * Reset colors to preset defaults
   */
  private resetToPresetDefaults(): void {
    const preset = ThemeManager.getPresets().find(p => p.id === this.editingPresetId);
    if (preset) {
      this.editingColors = cloneColors(preset.colors);
      this.hasChanges = true;

      // Apply to ThemeManager for live preview
      ThemeManager.resetCustomColors();
      ThemeManager.applyToImGui();
    }
  }

  /**
   * Check if any colors are customized from the preset
   */
  private hasCustomizedColors(): boolean {
    if (!this.editingColors) return false;

    const preset = ThemeManager.getPresets().find(p => p.id === this.editingPresetId);
    if (!preset) return false;

    for (const key of Object.keys(preset.colors) as ThemeColorKey[]) {
      if (!this.colorsEqual(this.editingColors[key], preset.colors[key])) {
        return true;
      }
    }

    return false;
  }

  /**
   * Compare two colors for equality
   */
  private colorsEqual(a: Color, b: Color): boolean {
    const epsilon = 0.001;
    return (
      Math.abs(a.r - b.r) < epsilon &&
      Math.abs(a.g - b.g) < epsilon &&
      Math.abs(a.b - b.b) < epsilon &&
      Math.abs((a.a ?? 1) - (b.a ?? 1)) < epsilon
    );
  }

  /**
   * Save changes and close dialog
   */
  private async save(): Promise<void> {
    // Theme is already applied via live preview, just persist
    await ThemeManager.save();
    this.close();
  }

  /**
   * Cancel changes and restore original state
   */
  private cancel(): void {
    // Restore original preset
    ThemeManager.setActivePreset(this.originalPresetId);

    // Restore original custom colors
    ThemeManager.resetCustomColors();
    for (const key of Object.keys(this.originalCustomColors) as ThemeColorKey[]) {
      const color = this.originalCustomColors[key];
      if (color) {
        ThemeManager.setCustomColor(key, color);
      }
    }

    // Apply restored theme to ImGui
    ThemeManager.applyToImGui();

    this.close();
  }
}
