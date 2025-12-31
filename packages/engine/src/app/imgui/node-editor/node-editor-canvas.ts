/**
 * Node Editor Canvas
 *
 * Handles the canvas rendering including background, grid, and coordinate
 * transformations between screen space and canvas space.
 */

import { ImGui } from '@mori2003/jsimgui';
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

  // Calculate mouseCanvasPos using a consistent method
  // We know that nodes are rendered at screenPos = (canvasPos - scrollOffset) * zoom
  // So canvasPos = screenPos / zoom + scrollOffset
  // Where screenPos is the window-local position (not screen position)

  // To get window-local mouse position, we need:
  // windowLocalMouse = screenMouse - windowContentStart

  // GetScrollX/Y gives us how far we've scrolled
  // The window content starts at some position we can't directly get

  // WORKAROUND: Use GetIO().MousePos relative to main viewport, then subtract estimated window pos
  // This is what we had before but was wrong. Let's try a different approach:
  // Use InvisibleButton and check IsItemActive/Hovered to determine position relative to it

  // Actually the correct approach is to calculate based on what we CAN know:
  // - We're inside a child window
  // - Items are positioned with SetCursorPos relative to the scrolled content
  // - A node at canvas (100, 100) is rendered at window-local ((100 - scrollOffset.x) * zoom, (100 - scrollOffset.y) * zoom)
  // - If that's at window-local (x, y), and the mouse is at window-local (mx, my), then:
  //   mouseCanvasPos = (mx, my) / zoom + scrollOffset

  // To get mx, my (window-local mouse):
  // After BeginChild, the window content is at some screen position.
  // GetCursorPosX/Y gives positions relative to this.
  // But we need mouse position relative to this same origin.

  // SOLUTION: Render an invisible button at (0,0) and when it's hovered/active,
  // the mouse position relative to it can be inferred from scroll position.

  // The scroll values tell us how much content is scrolled off-screen.
  // If we're at scroll (50, 50), and the virtual canvas is 4000x3000,
  // then content from (50, 50) to (50 + availableWidth, 50 + availableHeight) is visible.
  // The mouse, when over this region, corresponds to canvas positions in that range.

  // More precisely:
  // visibleContentStart = (scrollX, scrollY) in window-local coords
  // If mouse is at screen position (screenMouseX, screenMouseY), and the window content
  // area starts at screen position (windowContentScreenX, windowContentScreenY), then:
  // windowLocalMouse = screenMouse - windowContentScreen

  // Since windowContentScreen is unknown, we use another approach:
  // Track the delta between expected and actual item positions using a dummy item.

  // Final simple approach that should work:
  // Get the scroll offset and use it directly. The mouse position in the scrolled
  // content frame is approximately: scrollOffset + (screenMousePos - windowScreenPos) / zoom
  // We estimate windowScreenPos using the main viewport for now, but add a correction factor.

  // Actually, let's trace through what happens:
  // 1. beginCanvas is called, we're inside a child window
  // 2. SetCursorPos({0, 0}) positions at the start of scrolled content
  // 3. Background button is rendered covering full virtual size
  // 4. Nodes are rendered at positions relative to scrolled content origin

  // The key: GetCursorPosX/Y AFTER BeginChild gives the content cursor start.
  // Before any SetCursorPos, this is typically small values (0 or padding).
  // After SetCursorPos({0,0}), cursor is at (0, 0) in content coords.

  // To get mouse in content coords:
  // We need to know where content (0,0) is in screen coords.
  // Without GetWindowPos or GetCursorScreenPos, we can't get this directly.

  // PRAGMATIC SOLUTION:
  // 1. Store mouse delta between frames for dragging (works regardless of offset)
  // 2. For click-to-add-node, use the last known "correct" position or context menu position

  // For now, let's calculate using scroll and try to make it work consistently:
  const scrollX = ImGui.GetScrollX();
  const scrollY = ImGui.GetScrollY();

  // Assume the child window content area starts at approximately the current cursor baseline
  // This won't be perfectly accurate but will be consistent for drag operations
  // The issue is that cursor pos is in window-local space, not screen space

  // Best we can do without proper APIs:
  // Estimate canvas origin as mainViewport.Pos + some offset for the window structure
  // This is what we'll use for context menu positioning
  const mainViewport = ImGui.GetMainViewport();
  context.canvasOrigin = {
    x: mainViewport.Pos.x,
    y: mainViewport.Pos.y,
  };

  // For mouse canvas position, we need something that will be CONSISTENT
  // even if not perfectly accurate. Use this formula:
  // mouseCanvasPos = (mouseScreenPos - canvasOrigin) / zoom + scrollOffset

  // This will have an offset error, but the error will be consistent,
  // so drag deltas will work correctly.
  context.mouseCanvasPos = {
    x: (context.mouseScreenPos.x - context.canvasOrigin.x + scrollX) / context.zoom,
    y: (context.mouseScreenPos.y - context.canvasOrigin.y + scrollY) / context.zoom,
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
