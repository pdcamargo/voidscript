/**
 * MouseDemoPanel - Demo panel showing mouse position and focus state
 *
 * Demonstrates the EditorPanel base class features including:
 * - Mouse position tracking (window-local coordinates)
 * - Focus detection with different flag modes
 * - Window position and content origin tracking
 * - Lifecycle methods (onOpened/onClosed)
 */

import {
  EditorPanel,
  EditorLayout,
  EditorPanelFocusFlags,
} from '@voidscript/editor';

export class MouseDemoPanel extends EditorPanel {
  constructor() {
    super({
      id: 'mouse-demo',
      title: 'Mouse Demo',
      initialSize: { x: 320, y: 280 },
    });
  }

  protected onOpened(): void {
    console.log('MouseDemoPanel opened');
  }

  protected onClosed(): void {
    console.log('MouseDemoPanel closed');
  }

  protected onRender(): void {
    const mousePos = this.getMousePosition();
    const contentWidth = this.getContentWidth();
    const contentHeight = this.getContentHeight();

    // Section: Content Size & Position
    EditorLayout.sectionHeader('Content Size & Position');
    EditorLayout.text(`Width: ${contentWidth.toFixed(0)}`);
    EditorLayout.text(`Height: ${contentHeight.toFixed(0)}`);

    const windowPos = this.getWindowPos();
    EditorLayout.text(`Window X: ${windowPos.x.toFixed(0)}`);
    EditorLayout.text(`Window Y: ${windowPos.y.toFixed(0)}`);

    const contentOrigin = this.getContentOrigin();
    EditorLayout.text(`Content X: ${contentOrigin.x.toFixed(0)}`);
    EditorLayout.text(`Content Y: ${contentOrigin.y.toFixed(0)}`);

    EditorLayout.spacing();

    // Section: Mouse Position
    EditorLayout.sectionHeader('Mouse Position (Local)');
    EditorLayout.text(`X: ${mousePos.x.toFixed(2)}`);
    EditorLayout.text(`Y: ${mousePos.y.toFixed(2)}`);

    const isHovered = this.isHovered();
    EditorLayout.text(`Hovered: ${isHovered ? 'Yes' : 'No'}`, {
      color: isHovered
        ? { r: 0.2, g: 0.8, b: 0.2 }
        : { r: 0.5, g: 0.5, b: 0.5 },
    });

    EditorLayout.spacing();

    // Section: Focus State
    EditorLayout.sectionHeader('Focus State');

    const isFocusedWindow = this.isFocused(EditorPanelFocusFlags.Window);
    const isFocusedRoot = this.isFocused(
      EditorPanelFocusFlags.RootAndChildWindows,
    );
    const isFocusedAny = this.isFocused(EditorPanelFocusFlags.AnyWindow);

    EditorLayout.text(`Window: ${isFocusedWindow ? 'Yes' : 'No'}`, {
      color: isFocusedWindow
        ? { r: 0.2, g: 0.8, b: 0.2 }
        : { r: 0.5, g: 0.5, b: 0.5 },
    });

    EditorLayout.text(`Root + Children: ${isFocusedRoot ? 'Yes' : 'No'}`, {
      color: isFocusedRoot
        ? { r: 0.2, g: 0.8, b: 0.2 }
        : { r: 0.5, g: 0.5, b: 0.5 },
    });

    EditorLayout.text(`Any Window: ${isFocusedAny ? 'Yes' : 'No'}`, {
      color: isFocusedAny
        ? { r: 0.2, g: 0.8, b: 0.2 }
        : { r: 0.5, g: 0.5, b: 0.5 },
    });

    EditorLayout.spacing();
    EditorLayout.separator();
    EditorLayout.spacing();

    // Hint text
    EditorLayout.hint('Mouse position (0,0) is at the top-left corner of the content area.');
    EditorLayout.hint('Position tracking now uses direct ImGui API calls - no calibration needed!');
  }
}
