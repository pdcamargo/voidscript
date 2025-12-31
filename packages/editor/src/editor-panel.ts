/**
 * EditorPanel - Base class for creating editor panels/windows
 *
 * Provides automatic ImGui window management, mouse position tracking,
 * and focus detection. Subclasses only need to implement onRender().
 */

import { ImGui, ImVec2Helpers } from '@voidscript/imgui';
import { EditorPanelFocusFlags } from './focus-flags.js';
import type { Vec2 } from './types.js';

/**
 * Configuration options for EditorPanel
 */
export interface EditorPanelConfig {
  /** Unique identifier for ImGui (used in window ID) */
  id: string;
  /** Window title displayed in the title bar */
  title: string;
  /** Initial window size (optional, only applied on first render) */
  initialSize?: Vec2;
  /** ImGui window flags (optional) */
  flags?: number;
  /**
   * Menu path for native Tauri menu bar integration.
   * Uses "/" as separator for nested menus.
   * @example "Window/Hierarchy" - Creates Window menu with Hierarchy item
   * @example "Window/Debug/Profiler" - Creates Window > Debug > Profiler
   */
  menuPath?: string;
  /**
   * Keyboard shortcut to open/focus this panel.
   * Uses Tauri accelerator format.
   * @example "CmdOrCtrl+Shift+H"
   * @example "Alt+1"
   */
  shortcut?: string;
  /**
   * Whether the panel should be open by default.
   * @default true
   */
  defaultOpen?: boolean;
}

/**
 * Abstract base class for editor panels.
 *
 * Handles ImGui window creation, mouse position tracking, and lifecycle events.
 * Subclasses should implement `onRender()` to draw their content.
 *
 * @example
 * ```typescript
 * class MyPanel extends EditorPanel {
 *   constructor() {
 *     super({ id: 'my-panel', title: 'My Panel' });
 *   }
 *
 *   protected onRender(): void {
 *     EditorLayout.text('Hello from my panel!');
 *   }
 * }
 * ```
 */
export abstract class EditorPanel {
  /** Unique identifier for this panel */
  protected readonly id: string;

  /** Window title */
  protected readonly title: string;

  /** Initial window size (applied once on first render) */
  protected readonly initialSize?: Vec2;

  /** ImGui window flags */
  protected readonly windowFlags: number;

  /** Menu path for Tauri menu bar integration */
  public readonly menuPath?: string;

  /** Keyboard shortcut for opening this panel */
  public readonly shortcut?: string;

  /** Default open state (used when no persisted state exists) */
  public readonly defaultOpen: boolean;

  /** Current open state of the panel */
  private _isOpen: boolean;

  /** Whether to request focus on next render */
  private shouldFocus = false;

  /** Tracks if the window was open in the previous frame */
  private wasOpen = false;

  /** Current mouse position relative to window content */
  private currentMousePosition: Vec2 = { x: 0, y: 0 };

  /** Current content width (updated each frame) */
  private currentContentWidth = 0;

  /** Current content height (updated each frame) */
  private currentContentHeight = 0;

  /** Current window position in screen coordinates */
  private currentWindowPos: Vec2 = { x: 0, y: 0 };

  /** Current cursor screen position (content origin) */
  private currentCursorScreenPos: Vec2 = { x: 0, y: 0 };

  /**
   * Create a new EditorPanel
   *
   * @param config - Panel configuration
   */
  constructor(config: EditorPanelConfig) {
    this.id = config.id;
    this.title = config.title;
    this.initialSize = config.initialSize;
    this.windowFlags = config.flags ?? 0;
    this.menuPath = config.menuPath;
    this.shortcut = config.shortcut;
    this.defaultOpen = config.defaultOpen ?? true;
    this._isOpen = this.defaultOpen;
  }

  /**
   * Called when the panel is first opened.
   * Override to perform initialization logic.
   */
  protected onOpened(): void {}

  /**
   * Called when the panel is closed.
   * Override to perform cleanup logic.
   */
  protected onClosed(): void {}

  /**
   * Render the panel content.
   * Must be implemented by subclasses.
   * The ImGui window is already open when this is called.
   */
  protected abstract onRender(): void;

  /**
   * Get the current mouse position relative to the panel content area.
   * (0, 0) represents the top-left corner of the content area.
   *
   * @returns Mouse position in panel-local coordinates
   */
  public getMousePosition(): Vec2 {
    return { ...this.currentMousePosition };
  }

  /**
   * Get the panel window position in screen coordinates.
   *
   * @returns Window position in screen coordinates
   */
  public getWindowPos(): Vec2 {
    return { ...this.currentWindowPos };
  }

  /**
   * Get the panel content origin in screen coordinates.
   * This is where the content area starts (after title bar and padding).
   *
   * @returns Content origin in screen coordinates
   */
  public getContentOrigin(): Vec2 {
    return { ...this.currentCursorScreenPos };
  }

  /**
   * Get the current content width of the panel.
   * This is the available width inside the content area (after padding).
   */
  public getContentWidth(): number {
    return this.currentContentWidth;
  }

  /**
   * Get the current content height of the panel.
   * This is the available height inside the content area (after title bar and padding).
   */
  public getContentHeight(): number {
    return this.currentContentHeight;
  }

  /**
   * Check if the panel window is focused.
   *
   * @param flags - Focus detection mode (default: Window only)
   * @returns true if the panel is focused according to the specified flags
   */
  public isFocused(
    flags: EditorPanelFocusFlags = EditorPanelFocusFlags.Window,
  ): boolean {
    let imguiFlags = 0;
    switch (flags) {
      case EditorPanelFocusFlags.RootAndChildWindows:
        imguiFlags = ImGui.FocusedFlags.RootAndChildWindows;
        break;
      case EditorPanelFocusFlags.AnyWindow:
        imguiFlags = ImGui.FocusedFlags.AnyWindow;
        break;
      case EditorPanelFocusFlags.Window:
      default:
        imguiFlags = 0;
        break;
    }
    return ImGui.IsWindowFocused(imguiFlags);
  }

  /**
   * Check if the panel content area is hovered.
   *
   * @returns true if the mouse is over the panel content area
   */
  public isHovered(): boolean {
    return ImGui.IsWindowHovered();
  }

  /**
   * Get the unique identifier for this panel.
   */
  public getId(): string {
    return this.id;
  }

  /**
   * Get whether the panel is currently open.
   */
  public get isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * Set the open state of the panel.
   * Use open() or close() methods for programmatic control with focus handling.
   */
  public set isOpen(value: boolean) {
    this._isOpen = value;
  }

  /**
   * Open the panel and bring it to focus.
   * Called when user clicks the menu item or uses keyboard shortcut.
   */
  public open(): void {
    this._isOpen = true;
    // Request focus on next frame - ImGui will handle this when render() is called
    this.shouldFocus = true;
  }

  /**
   * Close the panel.
   * Usually triggered by clicking the X button in the title bar.
   */
  public close(): void {
    this._isOpen = false;
  }

  /**
   * Render the panel. Called by EditorApplication each frame.
   * Handles window creation, lifecycle events, and delegates to onRender().
   *
   * @internal
   */
  render(): void {
    // Skip rendering if panel is closed
    if (!this._isOpen) {
      // Reset lifecycle tracking when closed
      if (this.wasOpen) {
        this.wasOpen = false;
        this.onClosed();
      }
      return;
    }

    // Set initial size if specified (only applies on first render)
    if (this.initialSize) {
      ImGui.SetNextWindowSize(
        { x: this.initialSize.x, y: this.initialSize.y },
        ImGui.Cond.FirstUseEver,
      );
    }

    // Handle focus request
    if (this.shouldFocus) {
      ImGui.SetNextWindowFocus();
      this.shouldFocus = false;
    }

    // Window title with unique ID (### separates visible title from ID)
    const windowTitle = `${this.title}###${this.id}`;
    const isOpenRef: [boolean] = [true];

    if (ImGui.Begin(windowTitle, isOpenRef, this.windowFlags)) {
      // Handle opened lifecycle
      if (!this.wasOpen) {
        this.wasOpen = true;
        this.onOpened();
      }

      // Update window and mouse position using new ImVec2Helpers
      this.updatePositions();

      // Render panel content
      this.onRender();
    }
    ImGui.End();

    // Handle close button click (X in title bar)
    if (!isOpenRef[0]) {
      this._isOpen = false;
      if (this.wasOpen) {
        this.wasOpen = false;
        this.onClosed();
      }
    }
  }

  /**
   * Update window positions and mouse position.
   * Uses ImVec2Helpers wrapper functions to bypass broken jsimgui ImVec2 returns.
   */
  private updatePositions(): void {
    // Use ImVec2Helpers for all position data (bypasses broken ImVec2 accessors)
    const mousePos = ImVec2Helpers.GetMousePos();
    const windowPos = ImVec2Helpers.GetWindowPos();
    const cursorScreenPos = ImVec2Helpers.GetCursorScreenPos();
    const contentRegion = ImVec2Helpers.GetContentRegionAvail();

    // Get actual content dimensions (excluding padding, title bar, etc.)
    this.currentContentWidth = contentRegion.x;
    this.currentContentHeight = contentRegion.y;

    // Store actual window position
    this.currentWindowPos = {
      x: windowPos.x,
      y: windowPos.y,
    };

    // Store content origin in screen coordinates
    this.currentCursorScreenPos = {
      x: cursorScreenPos.x,
      y: cursorScreenPos.y,
    };

    // Calculate mouse position relative to content origin
    // (0,0) is top-left of the content area
    this.currentMousePosition = {
      x: mousePos.x - cursorScreenPos.x,
      y: mousePos.y - cursorScreenPos.y,
    };
  }
}
