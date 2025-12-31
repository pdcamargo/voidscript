/**
 * EditorLayout - Static utility class for rendering UI elements
 *
 * Provides a consistent API for rendering ImGui elements with proper styling.
 * All methods follow the pattern: first param is the value, second is an options object.
 */

import { ImGui } from '@voidscript/imgui';
import type { Color } from './types.js';

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
}
