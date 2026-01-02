/**
 * ImageViewport - Reusable component for rendering textures with mouse interaction
 *
 * Handles:
 * - Rendering a texture (WebGL/THREE.js render target) in ImGui
 * - Tracking image bounds in canvas coordinates
 * - Converting mouse coordinates to NDC for 3D interaction
 * - Preventing panel drag when interacting with the viewport (via InvisibleButton overlay)
 */

import { ImGui, ImVec2Helpers, ImTextureRef } from '@voidscript/imgui';
import type { Vec2 } from './types.js';

/**
 * Bounds of the rendered image in canvas coordinates
 */
export interface ImageBounds {
  /** X position in canvas coordinates */
  x: number;
  /** Y position in canvas coordinates */
  y: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/**
 * NDC (Normalized Device Coordinates) pointer data for 3D interaction
 */
export interface NDCPointer {
  /** X in NDC space (-1 to 1) */
  x: number;
  /** Y in NDC space (-1 to 1) */
  y: number;
  /** Mouse button (0=left, 1=middle, 2=right) */
  button: number;
}

/**
 * Options for rendering an image viewport
 */
export interface ImageViewportOptions {
  /** Width of the image in pixels */
  width: number;
  /** Height of the image in pixels */
  height: number;
  /** UV min for texture sampling (default: {x: 0, y: 0}) */
  uvMin?: Vec2;
  /** UV max for texture sampling (default: {x: 1, y: 1}) */
  uvMax?: Vec2;
  /** Tint color (default: white) */
  tintColor?: { r: number; g: number; b: number; a: number };
  /** Border color (default: none) */
  borderColor?: { r: number; g: number; b: number; a: number };
  /**
   * Whether to capture mouse input (prevents panel dragging).
   * Uses an InvisibleButton overlay to capture clicks.
   * @default true
   */
  captureInput?: boolean;
}

/**
 * Result of rendering an image viewport
 */
export interface ImageViewportResult {
  /** Whether the image is hovered */
  isHovered: boolean;
  /** Whether interaction is active (mouse down on viewport) */
  isActive: boolean;
  /** Whether mouse was just clicked on the viewport this frame */
  isClicked: boolean;
  /** Whether mouse was just released on the viewport this frame */
  isReleased: boolean;
  /** Image bounds in canvas coordinates */
  bounds: ImageBounds;
  /** Mouse position in canvas coordinates (relative to viewport top-left) */
  localMouse: Vec2;
  /** Mouse position in NDC (-1 to 1), null if outside bounds */
  ndcMouse: NDCPointer | null;
}

/**
 * ImageViewport provides reusable functionality for rendering textures
 * with proper mouse coordinate mapping for 3D/2D interaction.
 *
 * Key features:
 * - Renders texture with proper UV flipping for WebGL
 * - Tracks image bounds in canvas coordinates
 * - Converts mouse to NDC for TransformControls, raycasting, etc.
 * - Prevents panel dragging when interacting with viewport
 *
 * @example
 * ```typescript
 * class ScenePanel extends EditorPanel {
 *   private viewport = new ImageViewport();
 *
 *   protected onRender(): void {
 *     const result = this.viewport.render(textureId, {
 *       width: 800,
 *       height: 600,
 *       uvMin: { x: 0, y: 1 },  // Flip for WebGL
 *       uvMax: { x: 1, y: 0 },
 *     });
 *
 *     if (result.isActive && result.ndcMouse) {
 *       // Handle 3D interaction
 *       transformControls.pointerMove(result.ndcMouse);
 *     }
 *   }
 * }
 * ```
 */
// Static counter for unique instance IDs
let instanceCounter = 0;

export class ImageViewport {
  /** Unique instance ID for ImGui widget IDs */
  private readonly _instanceId: number;

  /** Current image bounds in canvas coordinates */
  private _bounds: ImageBounds = { x: 0, y: 0, width: 0, height: 0 };

  /** Whether interaction is currently active */
  private _isActive = false;

  /** Cached viewport position for coordinate conversion */
  private _viewportPos: Vec2 = { x: 0, y: 0 };

  constructor() {
    this._instanceId = instanceCounter++;
  }

  /**
   * Get the current image bounds in canvas coordinates
   */
  public get bounds(): ImageBounds {
    return { ...this._bounds };
  }

  /**
   * Check if interaction is currently active (mouse down on viewport)
   */
  public get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Render the image viewport and return interaction state
   *
   * @param textureId - ImGui texture ID (from ImGuiImplWeb.LoadTexture)
   * @param options - Rendering options
   * @returns Interaction result with bounds, hover state, and mouse coordinates
   */
  public render(
    textureId: bigint,
    options: ImageViewportOptions,
  ): ImageViewportResult {
    const {
      width,
      height,
      uvMin = { x: 0, y: 0 },
      uvMax = { x: 1, y: 1 },
      tintColor,
      borderColor,
      captureInput = true,
    } = options;

    // Get the draw list for rendering the image manually (so we can overlay InvisibleButton)
    const drawList = ImGui.GetWindowDrawList();

    // Get cursor position before we start
    const cursorPos = ImVec2Helpers.GetCursorScreenPos();

    // Convert colors to ImGui format (ImVec4 requires x,y,z,w object)
    const tint = tintColor
      ? ImGui.ColorConvertFloat4ToU32({
          x: tintColor.r,
          y: tintColor.g,
          z: tintColor.b,
          w: tintColor.a,
        })
      : 0xffffffff;

    const border = borderColor
      ? ImGui.ColorConvertFloat4ToU32({
          x: borderColor.r,
          y: borderColor.g,
          z: borderColor.b,
          w: borderColor.a,
        })
      : 0;

    // Calculate image rectangle
    const pMin = { x: cursorPos.x, y: cursorPos.y };
    const pMax = { x: cursorPos.x + width, y: cursorPos.y + height };

    // Draw the image using draw list
    drawList.AddImage(new ImTextureRef(textureId), pMin, pMax, uvMin, uvMax, tint);

    // Draw border if specified
    if (border !== 0) {
      drawList.AddRect(pMin, pMax, border);
    }

    // Variables for interaction state
    let isHovered = false;
    let isClicked = false;
    let isReleased = false;

    if (captureInput) {
      // Use InvisibleButton to capture input and prevent panel dragging
      // This is the key to preventing the window from being dragged when clicking in the viewport
      const buttonFlags =
        ImGui.ButtonFlags.MouseButtonLeft |
        ImGui.ButtonFlags.MouseButtonRight |
        ImGui.ButtonFlags.MouseButtonMiddle;

      const clicked = ImGui.InvisibleButton(
        `##viewport_${this._instanceId}`,
        { x: width, y: height },
        buttonFlags,
      );

      isHovered = ImGui.IsItemHovered();
      isClicked = clicked;
      isReleased = ImGui.IsItemDeactivated();

      // Track active state
      if (ImGui.IsItemActive()) {
        this._isActive = true;
      } else if (this._isActive && !ImGui.IsMouseDown(ImGui.MouseButton.Left)) {
        this._isActive = false;
      }
    } else {
      // Just advance the cursor without capturing input
      ImGui.Dummy({ x: width, y: height });
      isHovered = ImGui.IsItemHovered();
    }

    // Get bounds from the item we just created
    const itemMin = ImVec2Helpers.GetItemRectMin();
    const itemMax = ImVec2Helpers.GetItemRectMax();
    this._viewportPos = ImVec2Helpers.GetMainViewportPos();

    // Convert to canvas coordinates
    this._bounds = {
      x: itemMin.x - this._viewportPos.x,
      y: itemMin.y - this._viewportPos.y,
      width: itemMax.x - itemMin.x,
      height: itemMax.y - itemMin.y,
    };

    // Get mouse position
    const mousePos = ImVec2Helpers.GetMousePos();
    const canvasMouseX = mousePos.x - this._viewportPos.x;
    const canvasMouseY = mousePos.y - this._viewportPos.y;

    // Calculate local mouse position (relative to image top-left)
    const localMouse: Vec2 = {
      x: canvasMouseX - this._bounds.x,
      y: canvasMouseY - this._bounds.y,
    };

    // Calculate NDC if inside bounds
    let ndcMouse: NDCPointer | null = null;
    if (this.isInsideBounds(canvasMouseX, canvasMouseY)) {
      ndcMouse = this.canvasToNDC(canvasMouseX, canvasMouseY);
    }

    return {
      isHovered,
      isActive: this._isActive,
      isClicked,
      isReleased,
      bounds: { ...this._bounds },
      localMouse,
      ndcMouse,
    };
  }

  /**
   * Check if canvas coordinates are inside the image bounds
   */
  public isInsideBounds(canvasX: number, canvasY: number): boolean {
    const { x, y, width, height } = this._bounds;
    return (
      canvasX >= x &&
      canvasX <= x + width &&
      canvasY >= y &&
      canvasY <= y + height
    );
  }

  /**
   * Convert canvas coordinates to NDC (-1 to 1)
   *
   * @param canvasX - X position in canvas coordinates
   * @param canvasY - Y position in canvas coordinates
   * @param button - Mouse button (default: 0)
   * @returns NDC pointer data, or null if outside bounds
   */
  public canvasToNDC(
    canvasX: number,
    canvasY: number,
    button = 0,
  ): NDCPointer | null {
    const { x, y, width, height } = this._bounds;
    if (width <= 0 || height <= 0) return null;

    // Convert to NDC (-1 to 1)
    const ndcX = ((canvasX - x) / width) * 2 - 1;
    const ndcY = -((canvasY - y) / height) * 2 + 1; // Flip Y for 3D

    return { x: ndcX, y: ndcY, button };
  }

  /**
   * Convert screen coordinates to canvas coordinates
   */
  public screenToCanvas(screenX: number, screenY: number): Vec2 {
    return {
      x: screenX - this._viewportPos.x,
      y: screenY - this._viewportPos.y,
    };
  }

  /**
   * Get NDC coordinates for the current mouse position
   * Useful for continuous tracking during drag operations
   *
   * @param button - Mouse button (default: 0)
   * @returns NDC pointer data (may be outside -1 to 1 range during drag)
   */
  public getCurrentNDC(button = 0): NDCPointer {
    const mousePos = ImVec2Helpers.GetMousePos();
    const canvasX = mousePos.x - this._viewportPos.x;
    const canvasY = mousePos.y - this._viewportPos.y;

    const { x, y, width, height } = this._bounds;

    // Allow values outside -1 to 1 for drag operations
    const ndcX = width > 0 ? ((canvasX - x) / width) * 2 - 1 : 0;
    const ndcY = height > 0 ? -((canvasY - y) / height) * 2 + 1 : 0;

    return { x: ndcX, y: ndcY, button };
  }
}
