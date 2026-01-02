/**
 * EditorLayout - Static utility class for rendering UI elements
 *
 * Provides a consistent API for rendering ImGui elements with proper styling.
 * All methods follow the pattern: first param is the value, second is an options object.
 */

import { ImGui, ImVec2Helpers } from '@voidscript/imgui';
import type { Color } from './types.js';
import { EditorColors } from './editor-colors.js';
import { ThemeManager } from './theme/theme-manager.js';

/**
 * Tab definition for verticalTabLayout
 */
export interface VerticalTab {
  /** Unique identifier for the tab */
  id: string;
  /** Display label for the tab */
  label: string;
  /** Optional icon to show before label */
  icon?: string;
}

/**
 * Options for verticalTabLayout
 */
export interface VerticalTabLayoutOptions {
  /** Width of the tab column in pixels (default: 150) */
  tabWidth?: number;
  /** Height of each tab button in pixels (default: 32) */
  tabHeight?: number;
  /** Tab background color */
  tabBgColor?: Color;
  /** Selected tab background color */
  selectedTabBgColor?: Color;
  /** Hovered tab background color */
  hoveredTabBgColor?: Color;
}

/**
 * Result from verticalTabLayout
 */
export interface VerticalTabLayoutResult {
  /** The currently selected tab ID (may have changed if user clicked a new tab) */
  selectedTabId: string;
  /** Call this to begin the content area - returns true if content should be rendered */
  beginContent: () => boolean;
  /** Call this to end the content area */
  endContent: () => void;
}

/**
 * Options for icon buttons
 */
export interface IconButtonOptions {
  /** Button size in pixels (both width and height) */
  size?: number;
  /** Tooltip shown on hover */
  tooltip?: string;
  /** Button background color when not hovered */
  bgColor?: Color;
  /** Button background color when hovered */
  hoverColor?: Color;
  /** Icon color */
  iconColor?: Color;
}

/**
 * Options for the text() method
 */
export interface TextOptions {
  /** Text color (RGB values 0-1) */
  color?: Color;
  /** Tooltip shown on hover */
  tooltip?: string;
  /** Render as disabled (gray) text */
  disabled?: boolean;
}

/**
 * Options for the divider() method
 */
export interface DividerOptions {
  /** Margin above the separator in pixels (default: 8) */
  marginTop?: number;
  /** Margin below the separator in pixels (default: 8) */
  marginBottom?: number;
  /** Custom separator color (default: theme's imguiSeparator) */
  color?: Color;
  /** Thickness of the separator line in pixels (default: 1) */
  thickness?: number;
}

/**
 * Static utility class for rendering editor UI elements
 */
export class EditorLayout {
  /**
   * Render text with optional styling
   *
   * @param content - The text content to display
   * @param options - Optional styling options
   *
   * @example
   * ```typescript
   * EditorLayout.text('Hello World');
   * EditorLayout.text('Error!', { color: { r: 1, g: 0, b: 0 } });
   * EditorLayout.text('Disabled', { disabled: true });
   * ```
   */
  static text(content: string, options?: TextOptions): void {
    if (options?.disabled) {
      ImGui.TextDisabled(content);
    } else if (options?.color) {
      const { r, g, b, a = 1 } = options.color;
      ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: r, y: g, z: b, w: a });
      ImGui.Text(content);
      ImGui.PopStyleColor();
    } else {
      ImGui.Text(content);
    }

    if (options?.tooltip && ImGui.IsItemHovered()) {
      ImGui.SetTooltip(options.tooltip);
    }
  }

  /**
   * Add vertical spacing
   */
  static spacing(): void {
    ImGui.Spacing();
  }

  /**
   * Add a horizontal separator line
   */
  static separator(): void {
    ImGui.Separator();
  }

  /**
   * Add a horizontal divider line with configurable spacing.
   * Uses the theme's separator color by default.
   *
   * @param options - Optional configuration for margins, color, and thickness
   *
   * @example
   * ```typescript
   * // Default spacing (8px top and bottom)
   * EditorLayout.divider();
   *
   * // Custom margins
   * EditorLayout.divider({ marginTop: 12, marginBottom: 4 });
   *
   * // No top margin (touching content above)
   * EditorLayout.divider({ marginTop: 0 });
   * ```
   */
  static divider(options?: DividerOptions): void {
    const marginTop = options?.marginTop ?? 16;
    const marginBottom = options?.marginBottom ?? 16;
    const color = options?.color ?? ThemeManager.getColor('imguiSeparator');
    const thickness = options?.thickness ?? 1;

    // Add top margin
    if (marginTop > 0) {
      ImGui.Dummy({ x: 0, y: marginTop });
    }

    // Draw the separator line using the draw list for precise control
    const drawList = ImGui.GetWindowDrawList();
    const cursorPos = ImVec2Helpers.GetCursorScreenPos();
    const contentRegionAvail = ImGui.GetContentRegionAvail();

    const startX = cursorPos.x;
    const endX = cursorPos.x + contentRegionAvail.x;
    const y = cursorPos.y + thickness / 2;

    const colorU32 = ImGui.ColorConvertFloat4ToU32({
      x: color.r,
      y: color.g,
      z: color.b,
      w: color.a ?? 1.0,
    });

    drawList.AddLine({ x: startX, y }, { x: endX, y }, colorU32, thickness);

    // Advance cursor past the line
    ImGui.Dummy({ x: 0, y: thickness });

    // Add bottom margin
    if (marginBottom > 0) {
      ImGui.Dummy({ x: 0, y: marginBottom });
    }
  }

  /**
   * Render wrapped text that automatically wraps at window edge
   *
   * @param content - The text content to display
   * @param options - Optional styling options (color only, tooltip not supported for wrapped text)
   */
  static textWrapped(content: string, options?: Pick<TextOptions, 'color'>): void {
    if (options?.color) {
      const { r, g, b, a = 1 } = options.color;
      ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: r, y: g, z: b, w: a });
      ImGui.TextWrapped(content);
      ImGui.PopStyleColor();
    } else {
      ImGui.TextWrapped(content);
    }
  }

  /**
   * Render a section header (bold text style)
   *
   * @param content - Header text
   */
  static sectionHeader(content: string): void {
    // Use a slightly brighter color for headers
    ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: 1, y: 1, z: 1, w: 1 });
    ImGui.Text(content);
    ImGui.PopStyleColor();
    ImGui.Separator();
  }

  /**
   * Render hint/help text (dimmed)
   *
   * @param content - Hint text
   */
  static hint(content: string): void {
    ImGui.TextDisabled(content);
  }

  /**
   * Render a filled rectangle with the specified color.
   * Useful for viewport backgrounds or color indicators.
   *
   * @param width - Width of the rectangle in pixels
   * @param height - Height of the rectangle in pixels
   * @param color - Fill color (RGBA values 0-1)
   *
   * @example
   * ```typescript
   * // Draw a blue viewport background
   * EditorLayout.fillRect(800, 600, { r: 0.1, g: 0.2, b: 0.4, a: 1 });
   * ```
   */
  static fillRect(
    width: number,
    height: number,
    color: { r: number; g: number; b: number; a?: number },
  ): void {
    const drawList = ImGui.GetWindowDrawList();
    const cursorPos = ImVec2Helpers.GetCursorScreenPos();

    const pMin = { x: cursorPos.x, y: cursorPos.y };
    const pMax = { x: cursorPos.x + width, y: cursorPos.y + height };

    const colorU32 = ImGui.ColorConvertFloat4ToU32({
      x: color.r,
      y: color.g,
      z: color.b,
      w: color.a ?? 1.0,
    });

    drawList.AddRectFilled(pMin, pMax, colorU32);

    // Advance cursor
    ImGui.Dummy({ x: width, y: height });
  }

  /**
   * Render a button with the specified label.
   *
   * @param label - Button label
   * @param options - Optional button configuration
   * @returns true if the button was clicked
   *
   * @example
   * ```typescript
   * if (EditorLayout.button('Click Me')) {
   *   console.log('Button clicked!');
   * }
   * ```
   */
  static button(
    label: string,
    options?: {
      /** Button width (0 = auto) */
      width?: number;
      /** Button height (0 = auto) */
      height?: number;
      /** Tooltip shown on hover */
      tooltip?: string;
    },
  ): boolean {
    const size = { x: options?.width ?? 0, y: options?.height ?? 0 };
    const clicked = ImGui.Button(label, size);

    if (options?.tooltip && ImGui.IsItemHovered()) {
      ImGui.SetTooltip(options.tooltip);
    }

    return clicked;
  }

  /**
   * Render items on the same line.
   *
   * @param spacing - Optional spacing between items
   */
  static sameLine(spacing?: number): void {
    if (spacing !== undefined) {
      ImGui.SameLine(0, spacing);
    } else {
      ImGui.SameLine();
    }
  }

  /**
   * Draw a filled circle at the current cursor position.
   *
   * @param radius - Circle radius in pixels
   * @param color - Fill color (RGBA values 0-1)
   *
   * @example
   * ```typescript
   * // Draw a red circle
   * EditorLayout.drawCircle(6, { r: 1, g: 0.3, b: 0.3, a: 1 });
   * ```
   */
  static drawCircle(
    radius: number,
    color: { r: number; g: number; b: number; a?: number },
  ): void {
    const drawList = ImGui.GetWindowDrawList();
    const cursorPos = ImVec2Helpers.GetCursorScreenPos();

    // Center of the circle
    const centerX = cursorPos.x + radius;
    const centerY = cursorPos.y + radius;

    const colorU32 = ImGui.ColorConvertFloat4ToU32({
      x: color.r,
      y: color.g,
      z: color.b,
      w: color.a ?? 1.0,
    });

    // Draw filled circle (32 segments for smoothness)
    drawList.AddCircleFilled({ x: centerX, y: centerY }, radius, colorU32, 32);

    // Advance cursor past the circle
    ImGui.Dummy({ x: radius * 2, y: radius * 2 });
  }

  /**
   * Create an invisible button for hit detection.
   * Useful for creating custom clickable areas.
   *
   * @param id - Unique button ID
   * @param width - Button width in pixels
   * @param height - Button height in pixels
   * @returns true if the button was clicked
   *
   * @example
   * ```typescript
   * // Create a clickable area
   * if (EditorLayout.invisibleButton('drag-region', 100, 32)) {
   *   console.log('Clicked!');
   * }
   * ```
   */
  static invisibleButton(id: string, width: number, height: number): boolean {
    return ImGui.InvisibleButton(id, { x: width, y: height });
  }

  /**
   * Check if the last item is hovered
   */
  static isItemHovered(): boolean {
    return ImGui.IsItemHovered();
  }

  /**
   * Check if the last item is active (being clicked/dragged)
   */
  static isItemActive(): boolean {
    return ImGui.IsItemActive();
  }

  /**
   * Get the screen position of the last item's min corner (top-left)
   */
  static getItemRectMin(): { x: number; y: number } {
    // Use workaround since GetItemRectMin returns ImVec2 which is broken
    const cursorPos = ImVec2Helpers.GetCursorScreenPos();
    const itemSpacing = ImGui.GetStyle().ItemSpacing;
    // This is an approximation - in practice we track positions ourselves
    return {
      x: cursorPos.x,
      y: cursorPos.y - itemSpacing.y,
    };
  }

  /**
   * Set cursor position within the window
   *
   * @param x - X position in window coordinates
   * @param y - Y position in window coordinates
   */
  static setCursorPos(x: number, y: number): void {
    ImGui.SetCursorPos({ x, y });
  }

  /**
   * Set cursor X position within the window
   *
   * @param x - X position in window coordinates
   */
  static setCursorPosX(x: number): void {
    ImGui.SetCursorPosX(x);
  }

  /**
   * Set cursor Y position within the window
   *
   * @param y - Y position in window coordinates
   */
  static setCursorPosY(y: number): void {
    ImGui.SetCursorPosY(y);
  }

  /**
   * Get current cursor X position in window coordinates
   */
  static getCursorPosX(): number {
    return ImGui.GetCursorPosX();
  }

  /**
   * Get current cursor Y position in window coordinates
   */
  static getCursorPosY(): number {
    return ImGui.GetCursorPosY();
  }

  /**
   * Get current window width
   */
  static getWindowWidth(): number {
    return ImGui.GetWindowWidth();
  }

  /**
   * Get current window height
   */
  static getWindowHeight(): number {
    return ImGui.GetWindowHeight();
  }

  /**
   * Push a style color
   *
   * @param idx - ImGui color index
   * @param color - Color to push
   */
  static pushStyleColor(
    idx: number,
    color: { r: number; g: number; b: number; a?: number },
  ): void {
    ImGui.PushStyleColorImVec4(idx, {
      x: color.r,
      y: color.g,
      z: color.b,
      w: color.a ?? 1.0,
    });
  }

  /**
   * Pop style colors
   *
   * @param count - Number of colors to pop (default: 1)
   */
  static popStyleColor(count: number = 1): void {
    ImGui.PopStyleColor(count);
  }

  /**
   * Render an icon button (square button with centered icon)
   *
   * @param icon - The icon character to render
   * @param options - Button options
   * @returns true if the button was clicked
   */
  static iconButton(icon: string, options?: IconButtonOptions): boolean {
    const size = options?.size ?? 24;
    const bgColor = options?.bgColor ?? { r: 0, g: 0, b: 0, a: 0 };
    const hoverColor = options?.hoverColor ?? { r: 0.3, g: 0.3, b: 0.3, a: 1 };

    // Push transparent button colors
    this.pushStyleColor(ImGui.Col.Button, bgColor);
    this.pushStyleColor(ImGui.Col.ButtonHovered, hoverColor);
    this.pushStyleColor(ImGui.Col.ButtonActive, {
      ...hoverColor,
      a: (hoverColor.a ?? 1) * 0.8,
    });

    if (options?.iconColor) {
      this.pushStyleColor(ImGui.Col.Text, options.iconColor);
    }

    const clicked = ImGui.Button(icon, { x: size, y: size });

    if (options?.iconColor) {
      this.popStyleColor();
    }
    this.popStyleColor(3);

    if (options?.tooltip && ImGui.IsItemHovered()) {
      ImGui.SetTooltip(options.tooltip);
    }

    return clicked;
  }

  /**
   * Begin a group (for layout purposes)
   */
  static beginGroup(): void {
    ImGui.BeginGroup();
  }

  /**
   * End a group
   */
  static endGroup(): void {
    ImGui.EndGroup();
  }

  /**
   * Add a dummy item for spacing
   *
   * @param width - Width in pixels
   * @param height - Height in pixels
   */
  static dummy(width: number, height: number): void {
    ImGui.Dummy({ x: width, y: height });
  }

  /**
   * Create a vertical tab layout (tabs on left, content on right).
   * Godot-style layout for dialogs and settings panels.
   *
   * @param id - Unique identifier for this tab layout
   * @param tabs - Array of tab definitions
   * @param activeTabId - Currently active tab ID
   * @param options - Optional layout configuration
   * @returns Object with selectedTabId and content rendering functions
   *
   * @example
   * ```typescript
   * const tabs = [
   *   { id: 'appearance', label: 'Appearance' },
   *   { id: 'shortcuts', label: 'Keyboard Shortcuts' },
   * ];
   *
   * const result = EditorLayout.verticalTabLayout('prefs', tabs, this.activeTab);
   * this.activeTab = result.selectedTabId;
   *
   * if (result.beginContent()) {
   *   if (this.activeTab === 'appearance') {
   *     // Render appearance settings
   *   }
   *   result.endContent();
   * }
   * ```
   */
  static verticalTabLayout(
    id: string,
    tabs: VerticalTab[],
    activeTabId: string,
    options?: VerticalTabLayoutOptions,
  ): VerticalTabLayoutResult {
    const tabWidth = options?.tabWidth ?? 150;
    const tabHeight = options?.tabHeight ?? 32;

    // Colors with defaults from theme
    const tabBgColor = options?.tabBgColor ?? { r: 0, g: 0, b: 0, a: 0 };
    const selectedTabBgColor = options?.selectedTabBgColor ?? EditorColors.BUTTON_HOVER;
    const hoveredTabBgColor = options?.hoveredTabBgColor ?? {
      r: selectedTabBgColor.r * 0.7,
      g: selectedTabBgColor.g * 0.7,
      b: selectedTabBgColor.b * 0.7,
      a: selectedTabBgColor.a ?? 1,
    };

    let newSelectedTabId = activeTabId;
    const contentChildId = `${id}_content`;

    // Get available content region
    const availableHeight = ImGui.GetContentRegionAvail().y;

    // Left side: Tab column (no border, no flags)
    ImGui.BeginChild(`${id}_tabs`, { x: tabWidth, y: availableHeight }, 0);

    for (const tab of tabs) {
      const isSelected = tab.id === activeTabId;
      const buttonLabel = tab.icon ? `${tab.icon}  ${tab.label}` : tab.label;

      // Style for tab button
      if (isSelected) {
        this.pushStyleColor(ImGui.Col.Button, selectedTabBgColor);
        this.pushStyleColor(ImGui.Col.ButtonHovered, selectedTabBgColor);
        this.pushStyleColor(ImGui.Col.ButtonActive, selectedTabBgColor);
      } else {
        this.pushStyleColor(ImGui.Col.Button, tabBgColor);
        this.pushStyleColor(ImGui.Col.ButtonHovered, hoveredTabBgColor);
        this.pushStyleColor(ImGui.Col.ButtonActive, selectedTabBgColor);
      }

      // Full-width button
      if (ImGui.Button(`${buttonLabel}###${id}_tab_${tab.id}`, { x: tabWidth - 16, y: tabHeight })) {
        newSelectedTabId = tab.id;
      }

      this.popStyleColor(3);
    }

    ImGui.EndChild();

    // Same line to put content to the right
    ImGui.SameLine();

    // Return functions for content rendering
    return {
      selectedTabId: newSelectedTabId,
      beginContent: () => {
        // Right side: Content area
        // Use remaining width and full height
        const contentWidth = ImGui.GetContentRegionAvail().x;
        // Use ChildFlags.Borders (1) for a bordered child window
        return ImGui.BeginChild(contentChildId, { x: contentWidth, y: availableHeight }, 1);
      },
      endContent: () => {
        ImGui.EndChild();
      },
    };
  }

  /**
   * Render a color picker field with label
   *
   * @param label - Label to display
   * @param color - Current color value (will be mutated if changed)
   * @param options - Optional configuration
   * @returns true if the color was changed
   *
   * @example
   * ```typescript
   * if (EditorLayout.colorField('Background', this.bgColor)) {
   *   console.log('Color changed!');
   * }
   * ```
   */
  static colorField(
    label: string,
    color: Color,
    options?: { tooltip?: string },
  ): boolean {
    // Create a mutable array for ImGui
    const colorArray: [number, number, number, number] = [
      color.r,
      color.g,
      color.b,
      color.a ?? 1,
    ];

    const changed = ImGui.ColorEdit4(label, colorArray, ImGui.ColorEditFlags.AlphaBar);

    if (changed) {
      color.r = colorArray[0];
      color.g = colorArray[1];
      color.b = colorArray[2];
      color.a = colorArray[3];
    }

    if (options?.tooltip && ImGui.IsItemHovered()) {
      ImGui.SetTooltip(options.tooltip);
    }

    return changed;
  }

  /**
   * Render a collapsing header section
   *
   * @param label - Header label
   * @param defaultOpen - Whether to start open (default: false)
   * @returns true if the section is expanded
   *
   * @example
   * ```typescript
   * if (EditorLayout.collapsingHeader('Advanced Settings')) {
   *   // Render advanced settings content
   * }
   * ```
   */
  static collapsingHeader(label: string, defaultOpen: boolean = false): boolean {
    const flags = defaultOpen ? ImGui.TreeNodeFlags.DefaultOpen : 0;
    return ImGui.CollapsingHeader(label, flags);
  }
}
