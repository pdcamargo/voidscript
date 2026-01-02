/**
 * EditorDialog - Abstract base class for modal dialogs
 *
 * Provides modal popup behavior with centered positioning.
 * Subclasses implement onRender() to draw dialog content.
 */

import { ImGui, ImVec2Helpers } from '@voidscript/imgui';
import { EditorWindow, type EditorWindowConfig } from './editor-window.js';

/**
 * Configuration options for EditorDialog
 */
export interface EditorDialogConfig extends EditorWindowConfig {
  /** Dialog width in pixels (default: 600) */
  width?: number;
  /** Dialog height in pixels (default: 400) */
  height?: number;
  /**
   * Menu path for native Tauri menu bar integration.
   * Uses "/" as separator for nested menus.
   * @example "Editor/Editor Preferences"
   */
  menuPath?: string;
  /**
   * Keyboard shortcut to open this dialog.
   * Uses Tauri accelerator format.
   * @example "CmdOrCtrl+,"
   */
  shortcut?: string;
}

/**
 * Abstract base class for modal dialogs.
 *
 * Handles ImGui popup modal creation, centered positioning, and lifecycle events.
 * Subclasses should implement `onRender()` to draw their content.
 *
 * @example
 * ```typescript
 * class MyDialog extends EditorDialog {
 *   constructor() {
 *     super({
 *       id: 'my-dialog',
 *       title: 'My Dialog',
 *       menuPath: 'Window/My Dialog',
 *       shortcut: 'CmdOrCtrl+D',
 *     });
 *   }
 *
 *   protected onRender(): void {
 *     EditorLayout.text('Hello from my dialog!');
 *     if (EditorLayout.button('Close')) {
 *       this.close();
 *     }
 *   }
 * }
 * ```
 */
export abstract class EditorDialog extends EditorWindow {
  /** Dialog width in pixels */
  private readonly width: number;

  /** Dialog height in pixels */
  private readonly height: number;

  /** Whether to open the popup on the next frame */
  private shouldOpen: boolean = false;

  /** Menu path for Tauri menu bar integration */
  public readonly menuPath?: string;

  /** Keyboard shortcut for opening this dialog */
  public readonly shortcut?: string;

  /**
   * Create a new EditorDialog
   *
   * @param config - Dialog configuration
   */
  constructor(config: EditorDialogConfig) {
    super(config);
    this.width = config.width ?? 600;
    this.height = config.height ?? 400;
    this.menuPath = config.menuPath;
    this.shortcut = config.shortcut;
  }

  /**
   * Open the dialog and center it on screen.
   * Overrides base class to trigger ImGui.OpenPopup() on next frame.
   */
  public override open(): void {
    this._isOpen = true;
    this.shouldOpen = true;
  }

  /**
   * Render the dialog. Called by EditorApplication each frame.
   * Handles popup modal creation, centering, and lifecycle events.
   *
   * @internal
   */
  render(): void {
    // Window title with unique ID - must be consistent for OpenPopup and BeginPopupModal
    const windowTitle = `${this.title}###${this.id}`;

    // Trigger popup opening if requested
    if (this.shouldOpen) {
      ImGui.OpenPopup(windowTitle);
      this.shouldOpen = false;
    }

    // Skip if not trying to show
    if (!this._isOpen && !ImGui.IsPopupOpen(windowTitle)) {
      return;
    }

    // Center on screen using ImVec2Helpers (direct viewport.Pos access crashes)
    const viewportPos = ImVec2Helpers.GetMainViewportPos();
    const viewportSize = ImVec2Helpers.GetMainViewportSize();
    ImGui.SetNextWindowPos(
      {
        x: viewportPos.x + viewportSize.x * 0.5,
        y: viewportPos.y + viewportSize.y * 0.5,
      },
      ImGui.Cond.Appearing,
      { x: 0.5, y: 0.5 },
    );

    // Set initial size
    ImGui.SetNextWindowSize(
      { x: this.width, y: this.height },
      ImGui.Cond.FirstUseEver,
    );

    const openRef: [boolean] = [true];

    if (ImGui.BeginPopupModal(windowTitle, openRef)) {
      // Handle opened lifecycle
      if (!this.wasOpen) {
        this.wasOpen = true;
        this.onOpened();
      }

      // Render dialog content
      this.onRender();

      ImGui.EndPopup();
    }

    // Handle close button click (X in title bar)
    if (!openRef[0]) {
      this._isOpen = false;
      if (this.wasOpen) {
        this.wasOpen = false;
        this.onClosed();
      }
    }
  }
}
