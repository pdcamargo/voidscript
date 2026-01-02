/**
 * Window - Canvas and browser event management
 *
 * Simplified wrapper for canvas management used by the Renderer.
 */

/**
 * Configuration for Window
 */
export interface WindowConfig {
  /** Canvas element or selector ID */
  canvas: HTMLCanvasElement | string;
  /** Initial width (optional, defaults to canvas client width) */
  width?: number;
  /** Initial height (optional, defaults to canvas client height) */
  height?: number;
}

/**
 * Window manages a canvas element and its dimensions.
 */
export class Window {
  private canvas: HTMLCanvasElement;
  private width: number;
  private height: number;

  constructor(config: WindowConfig) {
    // Resolve canvas element
    if (typeof config.canvas === 'string') {
      const element = document.getElementById(config.canvas);
      if (!element || !(element instanceof HTMLCanvasElement)) {
        throw new Error(`Canvas element not found: ${config.canvas}`);
      }
      this.canvas = element;
    } else {
      this.canvas = config.canvas;
    }

    // Set dimensions
    this.width = config.width ?? this.canvas.clientWidth;
    this.height = config.height ?? this.canvas.clientHeight;

    // Sync canvas buffer size with logical size
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Get current width
   */
  getWidth(): number {
    return this.width;
  }

  /**
   * Get current height
   */
  getHeight(): number {
    return this.height;
  }

  /**
   * Resize the window/canvas
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Get the aspect ratio
   */
  getAspectRatio(): number {
    return this.width / this.height;
  }
}
