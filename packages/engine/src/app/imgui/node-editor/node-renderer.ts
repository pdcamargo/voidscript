/**
 * Node Renderer
 *
 * Renders nodes using ImGui widgets. Uses colored buttons for the header,
 * body, and pins since we don't have access to ImDrawList primitives.
 */

import { ImGui } from '@voidscript/imgui';
import type { NodeEditorState } from './node-editor-state.js';
import type { NodeState, PinState, Vec2 } from './node-editor-types.js';
import type { CanvasContext } from './node-editor-canvas.js';

// ============================================================================
// Node Rendering
// ============================================================================

export interface NodeRenderResult {
  /** Whether the node header was clicked (mouse released on it) */
  headerClicked: boolean;
  /** Whether the node header is active (mouse down on it) */
  headerActive: boolean;
  /** Whether the node header is being dragged */
  headerDragging: boolean;
  /** Whether any part of the node (header or body) is active - for pin-less mode */
  nodeActive: boolean;
  /** Whether any part of the node (header or body) is hovered - for pin-less mode */
  nodeHovered: boolean;
  /** Pin that was clicked (if any) */
  clickedPin: PinState | null;
  /** Pin that is active (mouse down on it) */
  activePin: PinState | null;
  /** Pin that is being hovered (if any) */
  hoveredPin: PinState | null;
  /** Whether a context menu should open for this node */
  contextMenu: boolean;
}

/**
 * Render a single node
 */
export function renderNode(
  state: NodeEditorState,
  node: NodeState,
  context: CanvasContext,
): NodeRenderResult {
  const config = state.config;
  const result: NodeRenderResult = {
    headerClicked: false,
    headerActive: false,
    headerDragging: false,
    nodeActive: false,
    nodeHovered: false,
    clickedPin: null,
    activePin: null,
    hoveredPin: null,
    contextMenu: false,
  };

  // Calculate screen position
  const screenX = (node.position.x - context.scrollOffset.x) * context.zoom;
  const screenY = (node.position.y - context.scrollOffset.y) * context.zoom;
  const screenWidth = node.size.width * context.zoom;
  const screenHeight = node.size.height * context.zoom;
  const headerHeight = config.nodeHeaderHeight * context.zoom;
  const pinRowHeight = config.pinRowHeight * context.zoom;
  const pinRadius = config.pinRadius * context.zoom;

  // Node colors
  const nodeColor = node.color || config.defaultNodeColor;
  const bodyColor = { r: 0.18, g: 0.18, b: 0.2, a: 0.95 };

  // Selection border color
  const borderColor = node.isSelected ? config.selectionColor : nodeColor;

  // ===== Node Border (selection indicator) =====
  if (node.isSelected) {
    const borderPadding = 2;
    ImGui.SetCursorPos({
      x: screenX - borderPadding,
      y: screenY - borderPadding,
    });
    ImGui.PushStyleColorImVec4(ImGui.Col.Button, {
      x: borderColor.r,
      y: borderColor.g,
      z: borderColor.b,
      w: borderColor.a,
    });
    ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, {
      x: borderColor.r,
      y: borderColor.g,
      z: borderColor.b,
      w: borderColor.a,
    });
    ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, {
      x: borderColor.r,
      y: borderColor.g,
      z: borderColor.b,
      w: borderColor.a,
    });
    ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 6);

    ImGui.Button(`##nodeBorder_${node.id}`, {
      x: screenWidth + borderPadding * 2,
      y: screenHeight + borderPadding * 2,
    });

    ImGui.PopStyleVar();
    ImGui.PopStyleColor(3);
  }

  // ===== Node Header =====
  ImGui.SetCursorPos({ x: screenX, y: screenY });
  ImGui.PushStyleColorImVec4(ImGui.Col.Button, {
    x: nodeColor.r,
    y: nodeColor.g,
    z: nodeColor.b,
    w: nodeColor.a,
  });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, {
    x: nodeColor.r * 1.1,
    y: nodeColor.g * 1.1,
    z: nodeColor.b * 1.1,
    w: nodeColor.a,
  });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, {
    x: nodeColor.r * 0.9,
    y: nodeColor.g * 0.9,
    z: nodeColor.b * 0.9,
    w: nodeColor.a,
  });
  ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 4);

  const headerClicked = ImGui.Button(`##nodeHeader_${node.id}`, {
    x: screenWidth,
    y: headerHeight,
  });

  const headerActive = ImGui.IsItemActive();
  const headerHovered = ImGui.IsItemHovered();

  ImGui.PopStyleVar();
  ImGui.PopStyleColor(3);

  result.headerClicked = headerClicked;
  result.headerActive = headerActive;
  result.headerDragging = headerActive && ImGui.IsMouseDragging(0, 2.0);

  // Track header for node-level state
  if (headerActive) result.nodeActive = true;
  if (headerHovered) result.nodeHovered = true;

  // Context menu on header
  if (ImGui.IsItemClicked(1)) {
    result.contextMenu = true;
  }

  // Node title text
  ImGui.SetCursorPos({ x: screenX + 8, y: screenY + 6 });
  ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: 1, y: 1, z: 1, w: 1 });
  ImGui.Text(node.title);
  ImGui.PopStyleColor();

  // ===== Node Body =====
  const bodyY = screenY + headerHeight;
  const bodyHeight = screenHeight - headerHeight;

  ImGui.SetCursorPos({ x: screenX, y: bodyY });
  ImGui.PushStyleColorImVec4(ImGui.Col.Button, {
    x: bodyColor.r,
    y: bodyColor.g,
    z: bodyColor.b,
    w: bodyColor.a,
  });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, {
    x: bodyColor.r,
    y: bodyColor.g,
    z: bodyColor.b,
    w: bodyColor.a,
  });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, {
    x: bodyColor.r,
    y: bodyColor.g,
    z: bodyColor.b,
    w: bodyColor.a,
  });
  ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 0);

  ImGui.Button(`##nodeBody_${node.id}`, {
    x: screenWidth,
    y: bodyHeight,
  });

  const bodyActive = ImGui.IsItemActive();
  const bodyHovered = ImGui.IsItemHovered();

  // Track body for node-level state
  if (bodyActive) result.nodeActive = true;
  if (bodyHovered) result.nodeHovered = true;

  // Context menu on body (for pin-less mode)
  if (ImGui.IsItemClicked(1)) {
    result.contextMenu = true;
  }

  ImGui.PopStyleVar();
  ImGui.PopStyleColor(3);

  // ===== Render Pins (only in standard mode) =====
  if (!config.pinLessMode) {
    // Input pins (left side)
    for (let i = 0; i < node.inputPins.length; i++) {
      const pin = node.inputPins[i]!;
      const pinY = bodyY + pinRowHeight * (i + 0.5);
      const pinX = screenX;

      const pinResult = renderPin(state, pin, pinX, pinY, pinRadius, true, context);
      if (pinResult.clicked) result.clickedPin = pin;
      if (pinResult.active) result.activePin = pin;
      if (pinResult.hovered) result.hoveredPin = pin;
    }

    // Output pins (right side)
    for (let i = 0; i < node.outputPins.length; i++) {
      const pin = node.outputPins[i]!;
      const pinY = bodyY + pinRowHeight * (i + 0.5);
      const pinX = screenX + screenWidth;

      const pinResult = renderPin(state, pin, pinX, pinY, pinRadius, false, context);
      if (pinResult.clicked) result.clickedPin = pin;
      if (pinResult.active) result.activePin = pin;
      if (pinResult.hovered) result.hoveredPin = pin;
    }

    // ===== Pin Labels =====
    // Input pin labels (left side, text on right of pin)
    for (let i = 0; i < node.inputPins.length; i++) {
      const pin = node.inputPins[i]!;
      const pinY = bodyY + pinRowHeight * (i + 0.5);

      ImGui.SetCursorPos({ x: screenX + pinRadius * 2 + 4, y: pinY - 6 });
      ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: 0.8, y: 0.8, z: 0.8, w: 1 });
      ImGui.Text(pin.name);
      ImGui.PopStyleColor();
    }

    // Output pin labels (right side, text on left of pin)
    for (let i = 0; i < node.outputPins.length; i++) {
      const pin = node.outputPins[i]!;
      const pinY = bodyY + pinRowHeight * (i + 0.5);

      // Calculate text width (approximate)
      const textWidth = pin.name.length * 7;
      ImGui.SetCursorPos({
        x: screenX + screenWidth - pinRadius * 2 - textWidth - 4,
        y: pinY - 6,
      });
      ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: 0.8, y: 0.8, z: 0.8, w: 1 });
      ImGui.Text(pin.name);
      ImGui.PopStyleColor();
    }
  }

  return result;
}

// ============================================================================
// Pin Rendering
// ============================================================================

interface PinRenderResult {
  clicked: boolean;
  hovered: boolean;
  active: boolean;
}

/**
 * Render a single pin as a small circle button
 */
function renderPin(
  state: NodeEditorState,
  pin: PinState,
  screenX: number,
  screenY: number,
  radius: number,
  isInput: boolean,
  context: CanvasContext,
): PinRenderResult {
  const config = state.config;

  // Pin color based on type
  const pinColor = config.pinColors[pin.type] || config.pinColors.any;

  // Offset for input/output
  const pinCenterX = isInput ? screenX : screenX;
  const buttonX = pinCenterX - radius;
  const buttonY = screenY - radius;
  const buttonSize = radius * 2;

  ImGui.SetCursorPos({ x: buttonX, y: buttonY });

  // Determine if this pin is being used for link creation
  const isLinkSource =
    state.linkCreationState?.sourcePin.id === pin.id &&
    state.linkCreationState?.sourcePin.nodeId === pin.nodeId;

  const isValidTarget =
    state.linkCreationState &&
    state.linkCreationState.targetPin?.id === pin.id &&
    state.linkCreationState.targetPin?.nodeId === pin.nodeId &&
    state.linkCreationState.canConnect;

  // Highlight color for link creation
  let displayColor = pinColor;
  if (isLinkSource || isValidTarget) {
    displayColor = config.linkCreationColor;
  }

  ImGui.PushStyleColorImVec4(ImGui.Col.Button, {
    x: displayColor.r,
    y: displayColor.g,
    z: displayColor.b,
    w: displayColor.a,
  });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, {
    x: displayColor.r * 1.2,
    y: displayColor.g * 1.2,
    z: displayColor.b * 1.2,
    w: displayColor.a,
  });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, {
    x: displayColor.r * 0.8,
    y: displayColor.g * 0.8,
    z: displayColor.b * 0.8,
    w: displayColor.a,
  });

  // Make it circular
  ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, radius);

  const clicked = ImGui.Button(`##pin_${pin.nodeId}_${pin.id}`, {
    x: buttonSize,
    y: buttonSize,
  });
  const hovered = ImGui.IsItemHovered();
  const active = ImGui.IsItemActive();

  ImGui.PopStyleVar();
  ImGui.PopStyleColor(3);

  // Update pin hover state
  pin.isHovered = hovered;

  return { clicked, hovered, active };
}

// ============================================================================
// Batch Node Rendering
// ============================================================================

export interface NodesRenderResult {
  /** Node that was clicked (header, mouse released) */
  clickedNode: NodeState | null;
  /** Node that is active (header, mouse down) */
  activeNode: NodeState | null;
  /** Node being dragged */
  draggingNode: NodeState | null;
  /** Node that is active anywhere (header or body) - for pin-less mode */
  nodeActive: NodeState | null;
  /** Node that is hovered anywhere (header or body) - for pin-less mode */
  nodeHovered: NodeState | null;
  /** Pin that was clicked */
  clickedPin: PinState | null;
  /** Pin that is active (mouse down on it) */
  activePin: PinState | null;
  /** Pin that is being hovered */
  hoveredPin: PinState | null;
  /** Node for which context menu should open */
  contextMenuNode: NodeState | null;
}

/**
 * Render all nodes in the editor
 * Renders in order: non-selected nodes first, then selected nodes on top
 */
export function renderAllNodes(
  state: NodeEditorState,
  context: CanvasContext,
): NodesRenderResult {
  const result: NodesRenderResult = {
    clickedNode: null,
    activeNode: null,
    draggingNode: null,
    nodeActive: null,
    nodeHovered: null,
    clickedPin: null,
    activePin: null,
    hoveredPin: null,
    contextMenuNode: null,
  };

  // Sort nodes: non-selected first, selected last (so they render on top)
  const sortedNodes = Array.from(state.nodes.values()).sort((a, b) => {
    if (a.isSelected && !b.isSelected) return 1;
    if (!a.isSelected && b.isSelected) return -1;
    return 0;
  });

  for (const node of sortedNodes) {
    // Skip nodes that are completely outside the visible area
    // (optimization for large graphs)
    const screenX = (node.position.x - context.scrollOffset.x) * context.zoom;
    const screenY = (node.position.y - context.scrollOffset.y) * context.zoom;
    const screenWidth = node.size.width * context.zoom;
    const screenHeight = node.size.height * context.zoom;

    if (
      screenX + screenWidth < 0 ||
      screenX > context.visibleSize.width ||
      screenY + screenHeight < 0 ||
      screenY > context.visibleSize.height
    ) {
      continue; // Skip off-screen nodes
    }

    const nodeResult = renderNode(state, node, context);

    if (nodeResult.headerClicked) {
      result.clickedNode = node;
    }
    if (nodeResult.headerActive) {
      result.activeNode = node;
    }
    if (nodeResult.headerDragging) {
      result.draggingNode = node;
    }
    // Track node-level active/hovered for pin-less mode
    if (nodeResult.nodeActive) {
      result.nodeActive = node;
    }
    if (nodeResult.nodeHovered) {
      result.nodeHovered = node;
    }
    if (nodeResult.clickedPin) {
      result.clickedPin = nodeResult.clickedPin;
    }
    if (nodeResult.activePin) {
      result.activePin = nodeResult.activePin;
    }
    if (nodeResult.hoveredPin) {
      result.hoveredPin = nodeResult.hoveredPin;
    }
    if (nodeResult.contextMenu) {
      result.contextMenuNode = node;
    }
  }

  return result;
}

// ============================================================================
// Box Selection Rendering
// ============================================================================

/**
 * Render the box selection rectangle
 */
export function renderBoxSelection(
  state: NodeEditorState,
  context: CanvasContext,
): void {
  if (!state.boxSelectState) return;

  const box = state.boxSelectState;

  // Convert to screen space
  const startScreen = {
    x: (box.startPosition.x - context.scrollOffset.x) * context.zoom,
    y: (box.startPosition.y - context.scrollOffset.y) * context.zoom,
  };
  const currentScreen = {
    x: (box.currentPosition.x - context.scrollOffset.x) * context.zoom,
    y: (box.currentPosition.y - context.scrollOffset.y) * context.zoom,
  };

  const minX = Math.min(startScreen.x, currentScreen.x);
  const minY = Math.min(startScreen.y, currentScreen.y);
  const width = Math.abs(currentScreen.x - startScreen.x);
  const height = Math.abs(currentScreen.y - startScreen.y);

  // Semi-transparent selection box
  ImGui.SetCursorPos({ x: minX, y: minY });
  ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.3, y: 0.5, z: 0.8, w: 0.3 });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, { x: 0.3, y: 0.5, z: 0.8, w: 0.3 });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, { x: 0.3, y: 0.5, z: 0.8, w: 0.3 });

  ImGui.Button('##boxSelect', { x: width, y: height });

  ImGui.PopStyleColor(3);

  // Border
  const borderThickness = 1;
  const borderColor = { x: 0.5, y: 0.7, z: 1.0, w: 0.8 };

  ImGui.PushStyleColorImVec4(ImGui.Col.Button, borderColor);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, borderColor);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, borderColor);

  // Top border
  ImGui.SetCursorPos({ x: minX, y: minY });
  ImGui.Button('##boxSelectTop', { x: width, y: borderThickness });

  // Bottom border
  ImGui.SetCursorPos({ x: minX, y: minY + height - borderThickness });
  ImGui.Button('##boxSelectBottom', { x: width, y: borderThickness });

  // Left border
  ImGui.SetCursorPos({ x: minX, y: minY });
  ImGui.Button('##boxSelectLeft', { x: borderThickness, y: height });

  // Right border
  ImGui.SetCursorPos({ x: minX + width - borderThickness, y: minY });
  ImGui.Button('##boxSelectRight', { x: borderThickness, y: height });

  ImGui.PopStyleColor(3);
}
