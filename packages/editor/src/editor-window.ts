/**
 * EditorWindow - Abstract base class for editor windows (panels and dialogs)
 *
 * Provides shared functionality for all editor window types including
 * lifecycle management, open/close state, and rendering hooks.
 */

import type { EditorApplication } from './editor-application.js';

/**
 * Base configuration options for editor windows
 */
export interface EditorWindowConfig {
  /** Unique identifier for ImGui (used in window ID) */
  id: string;
  /** Window title displayed in the title bar */
  title: string;
}

/**
 * Abstract base class for editor panels and dialogs.
 *
 * Provides shared lifecycle management and state tracking.
 * Subclasses implement specific window behaviors (dockable panels vs modal dialogs).
 */
export abstract class EditorWindow {
  /** Unique identifier for this window */
  protected readonly id: string;

  /** Window title */
  protected readonly title: string;

  /** Current open state of the window */
  protected _isOpen: boolean = false;

  /** Tracks if the window was open in the previous frame */
  protected wasOpen: boolean = false;

  /** Reference to the parent EditorApplication (set when registered) */
  protected _application: EditorApplication | null = null;

  /**
   * Create a new EditorWindow
   *
   * @param config - Window configuration
   */
  constructor(config: EditorWindowConfig) {
    this.id = config.id;
    this.title = config.title;
  }

  /**
   * Called when the window is first opened.
   * Override to perform initialization logic.
   */
  protected onOpened(): void {}

  /**
   * Called when the window is closed.
   * Override to perform cleanup logic.
   */
  protected onClosed(): void {}

  /**
   * Render the window content.
   * Must be implemented by subclasses.
   * The ImGui window/popup is already open when this is called.
   */
  protected abstract onRender(): void;

  /**
   * Internal render method called by EditorApplication each frame.
   * Handles window creation and lifecycle events.
   * Must be implemented by subclasses (Panel vs Dialog have different behaviors).
   *
   * @internal
   */
  abstract render(): void;

  /**
   * Get the unique identifier for this window.
   */
  public getId(): string {
    return this.id;
  }

  /**
   * Get the window title.
   */
  public getTitle(): string {
    return this.title;
  }

  /**
   * Get whether the window is currently open.
   */
  public get isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * Set the open state of the window.
   */
  public set isOpen(value: boolean) {
    this._isOpen = value;
  }

  /**
   * Open the window.
   * Override in subclasses for specific open behavior.
   */
  public open(): void {
    this._isOpen = true;
  }

  /**
   * Close the window.
   */
  public close(): void {
    this._isOpen = false;
  }

  /**
   * Get the parent EditorApplication.
   * Only available after the window has been registered with an application.
   *
   * @throws Error if the window has not been registered with an application
   * @returns The parent EditorApplication
   */
  protected getApplication(): EditorApplication {
    if (!this._application) {
      throw new Error(
        `Window "${this.id}" has not been registered with an EditorApplication. ` +
          `Call app.registerPanel() or app.registerDialog() before accessing getApplication().`,
      );
    }
    return this._application;
  }

  /**
   * Set the parent application reference.
   * Called internally by EditorApplication when registering the window.
   *
   * @internal
   */
  public setApplication(app: EditorApplication): void {
    this._application = app;
  }
}
