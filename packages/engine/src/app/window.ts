/**
 * Window - Canvas and browser event management
 *
 * Handles canvas sizing, browser event listeners, and converts
 * browser events to typed AppEvents.
 */

import { Input } from "./input.js";
import {
  type AppEvent,
  createWindowResizeEvent,
  createWindowFocusEvent,
  createWindowLostFocusEvent,
  createKeyPressedEvent,
  createKeyReleasedEvent,
  createMouseMovedEvent,
  createMouseButtonPressedEvent,
  createMouseButtonReleasedEvent,
  createMouseScrolledEvent,
  createGamepadConnectedEvent,
  createGamepadDisconnectedEvent,
} from "./events.js";

/**
 * Window configuration options
 */
export interface WindowConfig {
  /** Canvas element or CSS selector */
  canvas: HTMLCanvasElement | string;

  /** Window title (sets document.title) */
  title?: string;

  /** Initial width (default: canvas width or window.innerWidth if fullscreen) */
  width?: number;

  /** Initial height (default: canvas height or window.innerHeight if fullscreen) */
  height?: number;

  /** Whether to auto-resize canvas to window size (default: true) */
  fullscreen?: boolean;

  /** Device pixel ratio for high-DPI displays (default: window.devicePixelRatio) */
  pixelRatio?: number;

  /** Whether to prevent default browser behavior for keyboard events (default: true) */
  preventDefaultKeys?: boolean;

  /** Keys that should NOT have their default behavior prevented */
  allowDefaultKeys?: string[];
}

/**
 * Window class - Manages canvas and browser events
 */
export class Window {
  private canvas: HTMLCanvasElement;
  private width: number;
  private height: number;
  private pixelRatio: number;
  private fullscreen: boolean;
  private preventDefaultKeys: boolean;
  private allowDefaultKeys: Set<string>;

  private input: Input;
  private lastMouseX = 0;
  private lastMouseY = 0;

  private eventCallback: ((event: AppEvent) => void) | null = null;
  private cleanupFunctions: (() => void)[] = [];

  constructor(config: WindowConfig) {
    // Resolve canvas element
    if (typeof config.canvas === "string") {
      const element = document.querySelector(config.canvas);
      if (!(element instanceof HTMLCanvasElement)) {
        throw new Error(`Canvas not found: ${config.canvas}`);
      }
      this.canvas = element;
    } else {
      this.canvas = config.canvas;
    }

    // Set title
    if (config.title) {
      document.title = config.title;
    }

    // Configure dimensions
    this.fullscreen = config.fullscreen ?? true;
    this.pixelRatio = config.pixelRatio ?? window.devicePixelRatio ?? 1;
    this.preventDefaultKeys = config.preventDefaultKeys ?? true;
    this.allowDefaultKeys = new Set(config.allowDefaultKeys ?? ["F5", "F12"]);

    if (this.fullscreen) {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
    } else {
      this.width = config.width ?? this.canvas.width ?? 800;
      this.height = config.height ?? this.canvas.height ?? 600;
    }

    // Apply dimensions to canvas
    this.updateCanvasSize();

    // Initialize input system
    this.input = Input.initialize();

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Update canvas size based on current dimensions
   */
  private updateCanvasSize(): void {
    this.canvas.width = this.width * this.pixelRatio;
    this.canvas.height = this.height * this.pixelRatio;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
  }

  /**
   * Setup all browser event listeners
   */
  private setupEventListeners(): void {
    this.setupWindowEvents();
    this.setupKeyboardEvents();
    this.setupMouseEvents();
    this.setupGamepadEvents();
  }

  /**
   * Setup window-level events (resize, focus, blur)
   */
  private setupWindowEvents(): void {
    // Window resize
    const onResize = () => {
      if (this.fullscreen) {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.updateCanvasSize();
        this.dispatchEvent(createWindowResizeEvent(this.width, this.height));
      }
    };
    window.addEventListener("resize", onResize);
    this.cleanupFunctions.push(() =>
      window.removeEventListener("resize", onResize)
    );

    // Focus/blur events
    const onFocus = () => {
      this.dispatchEvent(createWindowFocusEvent());
    };

    const onBlur = () => {
      // Clear all input state when window loses focus
      this.input._reset();
      this.dispatchEvent(createWindowLostFocusEvent());
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    this.cleanupFunctions.push(() => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    });

    // Visibility change (for tab switching)
    const onVisibilityChange = () => {
      if (document.hidden) {
        this.input._reset();
        this.dispatchEvent(createWindowLostFocusEvent());
      } else {
        this.dispatchEvent(createWindowFocusEvent());
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    this.cleanupFunctions.push(() =>
      document.removeEventListener("visibilitychange", onVisibilityChange)
    );
  }

  /**
   * Setup keyboard events
   */
  private setupKeyboardEvents(): void {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't capture events when typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Prevent default for game keys (but allow F5 refresh, F12 devtools, etc.)
      if (this.preventDefaultKeys && !this.allowDefaultKeys.has(e.code)) {
        e.preventDefault();
      }

      this.input._onKeyDown(e.code);
      this.dispatchEvent(createKeyPressedEvent(e));
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (this.preventDefaultKeys && !this.allowDefaultKeys.has(e.code)) {
        e.preventDefault();
      }

      this.input._onKeyUp(e.code);
      this.dispatchEvent(createKeyReleasedEvent(e));
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    this.cleanupFunctions.push(() => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    });
  }

  /**
   * Setup mouse events
   */
  private setupMouseEvents(): void {
    const getCanvasRect = () => this.canvas.getBoundingClientRect();

    const onMouseMove = (e: MouseEvent) => {
      const rect = getCanvasRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this.input._onMouseMove(x, y);
      this.dispatchEvent(
        createMouseMovedEvent(e, this.lastMouseX, this.lastMouseY, rect)
      );

      this.lastMouseX = x;
      this.lastMouseY = y;
    };

    const onMouseDown = (e: MouseEvent) => {
      const rect = getCanvasRect();
      this.input._onMouseDown(e.button);
      this.dispatchEvent(createMouseButtonPressedEvent(e, rect));
    };

    const onMouseUp = (e: MouseEvent) => {
      const rect = getCanvasRect();
      this.input._onMouseUp(e.button);
      this.dispatchEvent(createMouseButtonReleasedEvent(e, rect));
    };

    const onWheel = (e: WheelEvent) => {
      const rect = getCanvasRect();
      this.input._onScroll(e.deltaX, e.deltaY);
      this.dispatchEvent(createMouseScrolledEvent(e, rect));
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // Prevent right-click context menu
    };

    // Mouse leave - track when mouse leaves canvas
    const onMouseLeave = () => {
      // Optionally dispatch event or reset mouse state
    };

    this.canvas.addEventListener("mousemove", onMouseMove);
    this.canvas.addEventListener("mousedown", onMouseDown);
    this.canvas.addEventListener("mouseup", onMouseUp);
    this.canvas.addEventListener("wheel", onWheel, { passive: true });
    this.canvas.addEventListener("contextmenu", onContextMenu);
    this.canvas.addEventListener("mouseleave", onMouseLeave);

    // Also listen for mouseup on window to catch releases outside canvas
    window.addEventListener("mouseup", onMouseUp);

    this.cleanupFunctions.push(() => {
      this.canvas.removeEventListener("mousemove", onMouseMove);
      this.canvas.removeEventListener("mousedown", onMouseDown);
      this.canvas.removeEventListener("mouseup", onMouseUp);
      this.canvas.removeEventListener("wheel", onWheel);
      this.canvas.removeEventListener("contextmenu", onContextMenu);
      this.canvas.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("mouseup", onMouseUp);
    });
  }

  /**
   * Setup gamepad events
   */
  private setupGamepadEvents(): void {
    const onGamepadConnected = (e: GamepadEvent) => {
      this.dispatchEvent(createGamepadConnectedEvent(e.gamepad));
    };

    const onGamepadDisconnected = (e: GamepadEvent) => {
      this.dispatchEvent(createGamepadDisconnectedEvent(e.gamepad.index));
    };

    window.addEventListener("gamepadconnected", onGamepadConnected);
    window.addEventListener("gamepaddisconnected", onGamepadDisconnected);

    this.cleanupFunctions.push(() => {
      window.removeEventListener("gamepadconnected", onGamepadConnected);
      window.removeEventListener("gamepaddisconnected", onGamepadDisconnected);
    });
  }

  /**
   * Dispatch event to callback
   */
  private dispatchEvent(event: AppEvent): void {
    if (this.eventCallback) {
      this.eventCallback(event);
    }
  }

  /**
   * Set the event callback (called by Application)
   */
  setEventCallback(callback: (event: AppEvent) => void): void {
    this.eventCallback = callback;
  }

  /**
   * End frame processing (clear per-frame input state)
   */
  endFrame(): void {
    this.input._endFrame();
  }

  /**
   * Manually resize the window (for non-fullscreen mode)
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.updateCanvasSize();
    this.dispatchEvent(createWindowResizeEvent(width, height));
  }

  /**
   * Set fullscreen mode
   */
  setFullscreen(fullscreen: boolean): void {
    this.fullscreen = fullscreen;
    if (fullscreen) {
      this.resize(window.innerWidth, window.innerHeight);
    }
  }

  /**
   * Request pointer lock (for FPS-style mouse control)
   */
  requestPointerLock(): void {
    this.canvas.requestPointerLock();
  }

  /**
   * Exit pointer lock
   */
  exitPointerLock(): void {
    document.exitPointerLock();
  }

  /**
   * Check if pointer is locked
   */
  isPointerLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  /**
   * Request fullscreen mode (browser fullscreen API)
   */
  async requestFullscreenMode(): Promise<void> {
    await this.canvas.requestFullscreen();
  }

  /**
   * Exit browser fullscreen mode
   */
  async exitFullscreenMode(): Promise<void> {
    await document.exitFullscreen();
  }

  /**
   * Check if in browser fullscreen mode
   */
  isFullscreenMode(): boolean {
    return document.fullscreenElement === this.canvas;
  }

  // ============================================================================
  // Accessors
  // ============================================================================

  /**
   * Get canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Get window width (CSS pixels)
   */
  getWidth(): number {
    return this.width;
  }

  /**
   * Get window height (CSS pixels)
   */
  getHeight(): number {
    return this.height;
  }

  /**
   * Get aspect ratio
   */
  getAspectRatio(): number {
    return this.width / this.height;
  }

  /**
   * Get device pixel ratio
   */
  getPixelRatio(): number {
    return this.pixelRatio;
  }

  /**
   * Get canvas width in actual pixels
   */
  getCanvasWidth(): number {
    return this.canvas.width;
  }

  /**
   * Get canvas height in actual pixels
   */
  getCanvasHeight(): number {
    return this.canvas.height;
  }

  /**
   * Check if in fullscreen auto-resize mode
   */
  isFullscreen(): boolean {
    return this.fullscreen;
  }

  /**
   * Cleanup all event listeners
   */
  destroy(): void {
    for (const cleanup of this.cleanupFunctions) {
      cleanup();
    }
    this.cleanupFunctions = [];
    this.eventCallback = null;
  }
}
