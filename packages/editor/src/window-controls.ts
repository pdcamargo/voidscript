/**
 * WindowControls - OS-specific window control buttons
 *
 * Renders minimize/maximize/close buttons with appropriate styling:
 * - macOS: Traffic light buttons (red/yellow/green circles) on the left
 * - Windows/Linux: Font Awesome icon buttons on the right
 *
 * @example
 * ```typescript
 * if (isMacOS()) {
 *   WindowControls.renderMacOS(isHovered, handleClose, handleMinimize, handleMaximize);
 * } else {
 *   WindowControls.renderWindowsLinux(isMaximized, handleClose, handleMinimize, handleMaximize);
 * }
 * ```
 */

import { ImVec2Helpers } from '@voidscript/imgui';
import { EditorLayout } from './editor-layout.js';
import { EditorColors } from './editor-colors.js';
import { EditorFonts } from './editor-fonts.js';
import { EditorIcons } from './editor-icons.js';
import type { Color } from './types.js';

// Button sizing
const TRAFFIC_LIGHT_RADIUS = 6;
const TRAFFIC_LIGHT_SPACING = 8;
const WINDOWS_BUTTON_SIZE = 32;

/**
 * Static class for rendering window control buttons
 */
export class WindowControls {
  // Track hover state for traffic lights
  private static _trafficLightHovered = false;

  /**
   * Render macOS traffic light buttons (close, minimize, maximize)
   *
   * @param windowFocused - Whether the window is currently focused
   * @param onClose - Callback when close button clicked
   * @param onMinimize - Callback when minimize button clicked
   * @param onMaximize - Callback when maximize button clicked
   * @returns The width consumed by the traffic lights
   */
  static renderMacOS(
    windowFocused: boolean,
    onClose: () => void,
    onMinimize: () => void,
    onMaximize: () => void,
  ): number {
    const startX = EditorLayout.getCursorPosX();
    const startY = EditorLayout.getCursorPosY();

    // Calculate total width of traffic lights
    const totalWidth = TRAFFIC_LIGHT_RADIUS * 2 * 3 + TRAFFIC_LIGHT_SPACING * 2;
    const buttonHeight = TRAFFIC_LIGHT_RADIUS * 2;

    // Check hover by comparing mouse position to traffic light region
    // Don't use an invisible button here as it consumes clicks
    const mousePos = ImVec2Helpers.GetMousePos();
    const windowPos = ImVec2Helpers.GetWindowPos();
    const regionX = windowPos.x + startX;
    const regionY = windowPos.y + startY;
    const isHovered =
      mousePos.x >= regionX &&
      mousePos.x <= regionX + totalWidth &&
      mousePos.y >= regionY &&
      mousePos.y <= regionY + buttonHeight;
    this._trafficLightHovered = isHovered;

    // Determine colors based on focus and hover state
    const redColor = windowFocused ? EditorColors.TRAFFIC_LIGHT_RED : EditorColors.TRAFFIC_LIGHT_DIMMED;
    const yellowColor = windowFocused ? EditorColors.TRAFFIC_LIGHT_YELLOW : EditorColors.TRAFFIC_LIGHT_DIMMED;
    const greenColor = windowFocused ? EditorColors.TRAFFIC_LIGHT_GREEN : EditorColors.TRAFFIC_LIGHT_DIMMED;

    // Close button (red)
    EditorLayout.beginGroup();
    this.renderTrafficLightButton(
      'close',
      redColor,
      isHovered && windowFocused,
      EditorIcons.CLOSE,
      onClose,
    );
    EditorLayout.endGroup();

    EditorLayout.sameLine(TRAFFIC_LIGHT_SPACING);

    // Minimize button (yellow)
    EditorLayout.beginGroup();
    this.renderTrafficLightButton(
      'minimize',
      yellowColor,
      isHovered && windowFocused,
      EditorIcons.MINUS,
      onMinimize,
    );
    EditorLayout.endGroup();

    EditorLayout.sameLine(TRAFFIC_LIGHT_SPACING);

    // Maximize button (green)
    EditorLayout.beginGroup();
    this.renderTrafficLightButton(
      'maximize',
      greenColor,
      isHovered && windowFocused,
      EditorIcons.EXPAND,
      onMaximize,
    );
    EditorLayout.endGroup();

    return totalWidth;
  }

  /**
   * Render a single traffic light button
   */
  private static renderTrafficLightButton(
    id: string,
    color: Color,
    showIcon: boolean,
    icon: string,
    onClick: () => void,
  ): void {
    const diameter = TRAFFIC_LIGHT_RADIUS * 2;

    // Save start position before drawing
    const startX = EditorLayout.getCursorPosX();
    const startY = EditorLayout.getCursorPosY();

    // Draw the circle
    EditorLayout.drawCircle(TRAFFIC_LIGHT_RADIUS, color);

    // Position invisible button over the circle
    EditorLayout.setCursorPos(startX, startY);
    if (EditorLayout.invisibleButton(`##traffic-${id}`, diameter, diameter)) {
      onClick();
    }

    // Draw icon if hovered - center the icon within the circle
    if (showIcon) {
      // Push small icon font for traffic lights (10px fits in 12px circle)
      EditorFonts.pushIconSmall();

      // Icon dimensions - Font Awesome icons at small size are roughly square
      // Use fixed size since CalcTextSize has WASM binding issues
      const iconWidth = 10; // Small icon font is 10px
      const iconHeight = 10;

      // Center the icon within the circle
      const iconOffsetX = (diameter - iconWidth) / 2;
      const iconOffsetY = (diameter - iconHeight) / 2;
      EditorLayout.setCursorPos(startX + iconOffsetX, startY + iconOffsetY);

      EditorLayout.text(icon, { color: EditorColors.TRAFFIC_LIGHT_ICON });
      EditorFonts.pop();
    }

    // Restore cursor position to end of circle
    EditorLayout.setCursorPos(startX + diameter, startY);
  }

  /**
   * Render Windows/Linux window control buttons (minimize, maximize, close)
   *
   * @param isMaximized - Whether the window is currently maximized
   * @param onClose - Callback when close button clicked
   * @param onMinimize - Callback when minimize button clicked
   * @param onMaximize - Callback when maximize button clicked
   * @returns The width consumed by the buttons
   */
  static renderWindowsLinux(
    isMaximized: boolean,
    onClose: () => void,
    onMinimize: () => void,
    onMaximize: () => void,
  ): number {
    const totalWidth = WINDOWS_BUTTON_SIZE * 3;

    // Minimize button
    if (
      EditorLayout.iconButton(EditorIcons.WINDOW_MINIMIZE, {
        size: WINDOWS_BUTTON_SIZE,
        tooltip: 'Minimize',
        bgColor: EditorColors.BUTTON_TRANSPARENT,
        hoverColor: EditorColors.WINDOWS_BUTTON_HOVER,
        iconColor: EditorColors.ICON_DEFAULT,
      })
    ) {
      onMinimize();
    }

    EditorLayout.sameLine(0);

    // Maximize/Restore button
    const maxIcon = isMaximized
      ? EditorIcons.WINDOW_RESTORE
      : EditorIcons.WINDOW_MAXIMIZE;
    const maxTooltip = isMaximized ? 'Restore' : 'Maximize';

    if (
      EditorLayout.iconButton(maxIcon, {
        size: WINDOWS_BUTTON_SIZE,
        tooltip: maxTooltip,
        bgColor: EditorColors.BUTTON_TRANSPARENT,
        hoverColor: EditorColors.WINDOWS_BUTTON_HOVER,
        iconColor: EditorColors.ICON_DEFAULT,
      })
    ) {
      onMaximize();
    }

    EditorLayout.sameLine(0);

    // Close button (red hover)
    if (
      EditorLayout.iconButton(EditorIcons.CLOSE, {
        size: WINDOWS_BUTTON_SIZE,
        tooltip: 'Close',
        bgColor: EditorColors.BUTTON_TRANSPARENT,
        hoverColor: EditorColors.WINDOWS_CLOSE_HOVER,
        iconColor: EditorColors.ICON_DEFAULT,
      })
    ) {
      onClose();
    }

    return totalWidth;
  }

  /**
   * Check if the traffic light area is currently hovered
   * (Used to prevent window dragging when hovering over buttons)
   */
  static isTrafficLightHovered(): boolean {
    return this._trafficLightHovered;
  }
}
