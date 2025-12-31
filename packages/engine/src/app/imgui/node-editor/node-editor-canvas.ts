/**
 * Node Editor Canvas
 *
 * Handles the canvas rendering including background, grid, and coordinate
 * transformations between screen space and canvas space.
 */

import { ImGui } from '@voidscript/imgui';
import type { NodeEditorState } from './node-editor-state.js';
import type { Vec2, Size } from './node-editor-types.js';

// ============================================================================
// Canvas Context
// ============================================================================

export interface CanvasContext {
  /** Canvas origin in screen space (top-left of the canvas child window) */
  canvasOrigin: Vec2;
  /** Visible canvas size in screen pixels */
  visibleSize: Size;
  /** Scroll offset in canvas space */
  scrollOffset: Vec2;
  /** Current zoom level */
  zoom: number;
  /** Mouse position in screen space */
  mouseScreenPos: Vec2;
  /** Mouse position in canvas space */
  mouseCanvasPos: Vec2;
  /** Whether mouse is over the canvas */
  isMouseOverCanvas: boolean;
}

let currentCanvasContext: CanvasContext | null = null;

/**
 * Get the current canvas context (only valid during renderCanvas)
 */
export function getCanvasContext(): CanvasContext | null {
  return currentCanvasContext;
}

// ============================================================================
// Coordinate Transformations
// ============================================================================

/**
 * Convert canvas coordinates to screen coordinates
 */
export function canvasToScreen(
  canvasPos: Vec2,
  context: CanvasContext,
): Vec2 {
  return {
    x: (canvasPos.x - context.scrollOffset.x) * context.zoom + context.canvasOrigin.x,
    y: (canvasPos.y - context.scrollOffset.y) * context.zoom + context.canvasOrigin.y,
  };
}

/**
 * Convert screen coordinates to canvas coordinates
 */
export function screenToCanvas(
  screenPos: Vec2,
  context: CanvasContext,
): Vec2 {
  return {
    x: (screenPos.x - context.canvasOrigin.x) / context.zoom + context.scrollOffset.x,
    y: (screenPos.y - context.canvasOrigin.y) / context.zoom + context.scrollOffset.y,
  };
}

/**
 * Convert a size from canvas space to screen space
 */
export function canvasSizeToScreen(
  size: Size,
  context: CanvasContext,
): Size {
  return {
    width: size.width * context.zoom,
    height: size.height * context.zoom,
  };
}

// ============================================================================
// Canvas Rendering
// ============================================================================

/**
 * Begin rendering the node editor canvas.
 * Returns the canvas context for use in rendering nodes and links.
 */
export function beginCanvas(
  state: NodeEditorState,
  availableWidth: number,
  availableHeight: number,
): CanvasContext {
  const config = state.config;

  // Calculate virtual canvas size (content size for scrolling)
  const virtualWidth = config.canvasSize.width * state.zoom;
  const virtualHeight = config.canvasSize.height * state.zoom;

  // Set background color for the child window BEFORE BeginChild
  ImGui.PushStyleColorImVec4(ImGui.Col.ChildBg, {
    x: config.backgroundColor.r,
    y: config.backgroundColor.g,
    z: config.backgroundColor.b,
    w: config.backgroundColor.a,
  });

  // Begin scrollable child region
  ImGui.BeginChild(
    `##NodeEditorCanvas_${state.id}`,
    { x: availableWidth, y: availableHeight },
    0,
    ImGui.WindowFlags.HorizontalScrollbar | ImGui.WindowFlags.NoMove,
  );

  // Pop the ChildBg style (must be after BeginChild but the style was applied to the window)
  ImGui.PopStyleColor(1);

  // Get scroll offset
  const scrollX = ImGui.GetScrollX();
  const scrollY = ImGui.GetScrollY();

  // Store scroll offset in canvas space
  state.scrollOffset = {
    x: scrollX / state.zoom,
    y: scrollY / state.zoom,
  };

  // Get mouse position
  const io = ImGui.GetIO();
  const mouseScreenPos: Vec2 = {
    x: io.MousePos.x,
    y: io.MousePos.y,
  };

  // For mouse-to-canvas conversion, we use the window-local cursor position
  // The key insight is that SetCursorPos works in window-local coordinates,
  // so nodes rendered at (100, 100) in canvas space are at (100*zoom - scrollX, 100*zoom - scrollY) in window-local space
  // To convert mouse to canvas space, we need to reverse this:
  // canvasX = (windowLocalMouseX + scrollX) / zoom
  // canvasY = (windowLocalMouseY + scrollY) / zoom
  //
  // To get window-local mouse position:
  // windowLocalMouseX = mouseScreenPos.x - windowScreenPos.x
  // Since we can't get windowScreenPos directly, we use a trick:
  // After calling BeginChild, GetCursorPosX/Y gives us (0,0) or similar
  // The mouse position relative to the window content area can be computed
  // by checking if the mouse is over the window and using GetScrollX/Y

  // We'll compute mouse canvas position based on window content coordinates
  // GetCursorStartPosX/Y would give us the top-left of the content area
  // For now, use a simpler approach: track mouse delta from where we render content

  // The canvas origin is effectively at (0,0) in window-local space (after accounting for scroll)
  // So mouseCanvasPos.x = (mouseWindowLocalX + scrollX) / zoom

  // Since we can't easily get the window position, we use a workaround:
  // We'll use ImGui.GetCursorScreenPosX/Y if available, otherwise estimate
  // Actually, looking at the render code, nodes are positioned with SetCursorPos at:
  // screenX = (node.position.x - scrollOffset.x) * zoom
  // So to go from mouse to canvas:
  // canvas.x = mouse.windowLocal / zoom + scrollOffset.x

  // To get windowLocal mouse position, we need the window's screen position.
  // Without GetWindowPos, we can still detect hover and use relative motion.

  // Alternative approach: Don't compute canvasOrigin for mouse conversion.
  // Instead, compute mouseCanvasPos directly using item positions.
  // When we render the background button, we can check if it's hovered and use that.

  // For now, we'll estimate based on the main viewport, but this only works for full-screen editors
  // A better fix: store where we actually start rendering and use that

  // Create canvas context with placeholder values (will be refined after background render)
  const canvasOrigin: Vec2 = { x: 0, y: 0 }; // Will be calculated differently

  const context: CanvasContext = {
    canvasOrigin,
    visibleSize: { width: availableWidth, height: availableHeight },
    scrollOffset: state.scrollOffset,
    zoom: state.zoom,
    mouseScreenPos,
    // Initially set to a placeholder, will be refined
    mouseCanvasPos: { x: 0, y: 0 },
    isMouseOverCanvas: ImGui.IsWindowHovered(),
  };

  currentCanvasContext = context;

  // Render background and grid - this also sets up proper mouse coordinate tracking
  renderBackground(state, virtualWidth, virtualHeight, context);

  return context;
}

/**
 * End the canvas region
 */
export function endCanvas(): void {
  currentCanvasContext = null;
  ImGui.EndChild();
}

/**
 * Render the canvas background and grid
 */
function renderBackground(
  state: NodeEditorState,
  virtualWidth: number,
  virtualHeight: number,
  context: CanvasContext,
): void {
  const config = state.config;

  // Use a Dummy to establish the content size for scrolling
  // Dummy doesn't consume mouse events, so nodes can receive input
  // The background color is set via ChildBg in beginCanvas
  ImGui.SetCursorPos({ x: 0, y: 0 });
  ImGui.Dummy({ x: virtualWidth, y: virtualHeight });

  const scrollX = ImGui.GetScrollX();
  const scrollY = ImGui.GetScrollY();

  // CALIBRATION SOLUTION for calculating canvas origin:
  //
  // The challenge: jsimgui doesn't expose GetWindowPos() or GetCursorScreenPos().
  // We need to determine where the child window content starts in screen coords.
  //
  // Solution: Use edge-detection calibration.
  // 1. Render 4 thin invisible buttons along each edge of the visible area
  // 2. When the mouse enters from an edge (hover detected on edge button),
  //    we know the exact window-local coordinate at that edge position
  // 3. From this, we can calculate the window screen origin

  const io = ImGui.GetIO();
  const visibleWidth = context.visibleSize.width;
  const visibleHeight = context.visibleSize.height;
  const edgeThickness = 8; // Thin edge detection zones

  // Left edge button - when hovered, mouse is at window-local x ≈ 0
  ImGui.SetCursorPos({ x: 0, y: 0 });
  ImGui.InvisibleButton('##edgeLeft', { x: edgeThickness, y: visibleHeight });
  if (ImGui.IsItemHovered()) {
    // Mouse is near left edge, so mouseWindowLocal.x ≈ io.MousePos.x - mouse position within button
    // Since button starts at x=0, the window origin x is approximately mouseScreen.x minus a small offset
    const estimatedLocalX = (io.MousePos.x - (state.calibratedWindowOrigin?.x ?? io.MousePos.x)) ;
    if (estimatedLocalX < 0 || estimatedLocalX > edgeThickness || !state.calibratedWindowOrigin) {
      // Mouse is at the left edge, so windowOrigin.x = mouseScreen.x - (small offset within button)
      // We approximate: mouse is at windowLocal.x ≈ edgeThickness/2
      state.calibratedWindowOrigin = {
        x: io.MousePos.x - edgeThickness / 2,
        y: state.calibratedWindowOrigin?.y ?? (io.MousePos.y - visibleHeight / 2),
      };
    }
  }

  // Top edge button - when hovered, mouse is at window-local y ≈ 0
  ImGui.SetCursorPos({ x: 0, y: 0 });
  ImGui.InvisibleButton('##edgeTop', { x: visibleWidth, y: edgeThickness });
  if (ImGui.IsItemHovered()) {
    state.calibratedWindowOrigin = {
      x: state.calibratedWindowOrigin?.x ?? (io.MousePos.x - visibleWidth / 2),
      y: io.MousePos.y - edgeThickness / 2,
    };
  }

  // Right edge button - when hovered, mouse is at window-local x ≈ visibleWidth
  ImGui.SetCursorPos({ x: visibleWidth - edgeThickness, y: 0 });
  ImGui.InvisibleButton('##edgeRight', { x: edgeThickness, y: visibleHeight });
  if (ImGui.IsItemHovered()) {
    state.calibratedWindowOrigin = {
      x: io.MousePos.x - visibleWidth + edgeThickness / 2,
      y: state.calibratedWindowOrigin?.y ?? (io.MousePos.y - visibleHeight / 2),
    };
  }

  // Bottom edge button - when hovered, mouse is at window-local y ≈ visibleHeight
  ImGui.SetCursorPos({ x: 0, y: visibleHeight - edgeThickness });
  ImGui.InvisibleButton('##edgeBottom', { x: visibleWidth, y: edgeThickness });
  if (ImGui.IsItemHovered()) {
    state.calibratedWindowOrigin = {
      x: state.calibratedWindowOrigin?.x ?? (io.MousePos.x - visibleWidth / 2),
      y: io.MousePos.y - visibleHeight + edgeThickness / 2,
    };
  }

  // Use calibrated origin if available, otherwise fall back to initial estimate
  const windowOrigin = state.calibratedWindowOrigin || {
    // Initial estimate based on main viewport - will be refined when edges are hovered
    x: ImGui.GetMainViewport().Pos.x,
    y: ImGui.GetMainViewport().Pos.y,
  };

  context.canvasOrigin = windowOrigin;

  // Compute mouse canvas position using the calibrated window origin
  // Formula: canvasPos = (mouseWindowLocal + scrollPixels) / zoom
  // Where mouseWindowLocal = mouseScreen - windowOrigin
  const mouseWindowLocalX = context.mouseScreenPos.x - windowOrigin.x;
  const mouseWindowLocalY = context.mouseScreenPos.y - windowOrigin.y;

  context.mouseCanvasPos = {
    x: (mouseWindowLocalX + scrollX) / context.zoom,
    y: (mouseWindowLocalY + scrollY) / context.zoom,
  };

  // Grid rendering (if enabled)
  if (config.showGrid && config.gridSize > 0) {
    renderGrid(state, virtualWidth, virtualHeight);
  }
}

/**
 * Render the grid lines
 *
 * NOTE: Grid rendering is disabled because using Button widgets for grid lines
 * can interfere with node interactions in some edge cases. The node editor
 * works correctly without the grid. In the future, this could be re-enabled
 * if we find a way to render non-interactive visual elements.
 */
function renderGrid(
  _state: NodeEditorState,
  _virtualWidth: number,
  _virtualHeight: number,
): void {
  // Grid rendering disabled to avoid potential interaction issues
  // The grid was rendered using thin Button widgets, which could
  // occasionally intercept mouse clicks intended for nodes
}

// ============================================================================
// Canvas Interaction Helpers
// ============================================================================

/**
 * Check if a point in canvas space is visible in the current view
 */
export function isPointVisible(
  canvasPos: Vec2,
  context: CanvasContext,
): boolean {
  const screenPos = canvasToScreen(canvasPos, context);
  return (
    screenPos.x >= context.canvasOrigin.x &&
    screenPos.x <= context.canvasOrigin.x + context.visibleSize.width &&
    screenPos.y >= context.canvasOrigin.y &&
    screenPos.y <= context.canvasOrigin.y + context.visibleSize.height
  );
}

/**
 * Check if a rectangle in canvas space is visible in the current view
 */
export function isRectVisible(
  canvasPos: Vec2,
  size: Size,
  context: CanvasContext,
): boolean {
  const topLeft = canvasToScreen(canvasPos, context);
  const bottomRight = canvasToScreen(
    { x: canvasPos.x + size.width, y: canvasPos.y + size.height },
    context,
  );

  // Check if the rect overlaps with the visible area
  return (
    bottomRight.x >= context.canvasOrigin.x &&
    topLeft.x <= context.canvasOrigin.x + context.visibleSize.width &&
    bottomRight.y >= context.canvasOrigin.y &&
    topLeft.y <= context.canvasOrigin.y + context.visibleSize.height
  );
}

/**
 * Scroll the canvas to center on a position
 */
export function scrollToPosition(
  state: NodeEditorState,
  canvasPos: Vec2,
  context: CanvasContext,
): void {
  const targetScrollX =
    canvasPos.x * state.zoom - context.visibleSize.width / 2;
  const targetScrollY =
    canvasPos.y * state.zoom - context.visibleSize.height / 2;

  ImGui.SetScrollX(Math.max(0, targetScrollX));
  ImGui.SetScrollY(Math.max(0, targetScrollY));
}

/**
 * Scroll the canvas to make a node visible
 */
export function scrollToNode(
  state: NodeEditorState,
  nodeId: string,
  context: CanvasContext,
): void {
  const node = state.nodes.get(nodeId);
  if (!node) return;

  const centerX = node.position.x + node.size.width / 2;
  const centerY = node.position.y + node.size.height / 2;

  scrollToPosition(state, { x: centerX, y: centerY }, context);
}

/**
 * Get the visible canvas bounds in canvas coordinates
 */
export function getVisibleBounds(context: CanvasContext): {
  min: Vec2;
  max: Vec2;
} {
  const min = screenToCanvas(context.canvasOrigin, context);
  const max = screenToCanvas(
    {
      x: context.canvasOrigin.x + context.visibleSize.width,
      y: context.canvasOrigin.y + context.visibleSize.height,
    },
    context,
  );
  return { min, max };
}
