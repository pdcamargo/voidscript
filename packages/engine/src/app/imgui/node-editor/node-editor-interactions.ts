/**
 * Node Editor Interactions
 *
 * Handles all user interactions: node dragging, link creation,
 * selection, deletion, and context menus.
 */

import { ImGui } from '@voidscript/imgui';
import {
  type NodeEditorState,
  selectNode,
  selectLink,
  clearSelection,
  toggleNodeSelection,
  deleteSelected,
  startNodeDrag,
  updateNodeDrag,
  endNodeDrag,
  startLinkCreation,
  updateLinkCreation,
  completeLinkCreation,
  cancelLinkCreation,
  // Pin-less mode
  startNodeLinkCreation,
  updateNodeLinkCreation,
  completeNodeLinkCreation,
  startBoxSelect,
  updateBoxSelect,
  completeBoxSelect,
} from './node-editor-state.js';
import type { NodeState, PinState, LinkState, Vec2 } from './node-editor-types.js';
import type { CanvasContext } from './node-editor-canvas.js';
import type { NodesRenderResult } from './node-renderer.js';
import type { LinkRenderResult } from './link-renderer.js';

// ============================================================================
// Main Interaction Handler
// ============================================================================

export interface InteractionResult {
  /** Node that should show context menu */
  contextMenuNode: NodeState | null;
  /** Link that should show context menu */
  contextMenuLink: LinkState | null;
  /** Position for canvas context menu */
  canvasContextMenuPos: Vec2 | null;
}

/**
 * Process all user interactions for the node editor
 */
export function handleInteractions(
  state: NodeEditorState,
  context: CanvasContext,
  nodesResult: NodesRenderResult,
  linksResult: LinkRenderResult,
): InteractionResult {
  const result: InteractionResult = {
    contextMenuNode: null,
    contextMenuLink: null,
    canvasContextMenuPos: null,
  };

  const io = ImGui.GetIO();

  // Update hovered states
  // In pin-less mode, use nodeHovered which tracks the entire node (header + body)
  const isPinLessMode = state.config.pinLessMode;
  if (isPinLessMode) {
    state.hoveredNodeId = nodesResult.nodeHovered?.id || nodesResult.nodeActive?.id || null;
  } else {
    state.hoveredNodeId = nodesResult.activeNode?.id || nodesResult.clickedNode?.id || null;
  }
  state.hoveredLinkId = linksResult.hoveredLink?.id || null;
  state.hoveredPin = nodesResult.hoveredPin || null;

  // Handle different interaction modes
  switch (state.mode) {
    case 'idle':
      handleIdleMode(state, context, nodesResult, linksResult, result);
      break;

    case 'dragging-node':
      handleDraggingNodeMode(state, context);
      break;

    case 'creating-link':
      handleCreatingLinkMode(state, context, nodesResult);
      break;

    case 'box-selecting':
      handleBoxSelectingMode(state, context);
      break;
  }

  // Handle keyboard input
  handleKeyboardInput(state);

  // Handle context menu for node
  if (nodesResult.contextMenuNode) {
    result.contextMenuNode = nodesResult.contextMenuNode;
  }

  return result;
}

// ============================================================================
// Idle Mode Handling
// ============================================================================

function handleIdleMode(
  state: NodeEditorState,
  context: CanvasContext,
  nodesResult: NodesRenderResult,
  linksResult: LinkRenderResult,
  result: InteractionResult,
): void {
  const io = ImGui.GetIO();
  const isPinLessMode = state.config.pinLessMode;

  // Pin becomes active (mouse down) - start link creation (standard mode only)
  // We use activePin + IsMouseClicked to detect the moment the mouse is pressed on a pin
  if (!isPinLessMode && nodesResult.activePin && ImGui.IsMouseClicked(0)) {
    startLinkCreation(state, nodesResult.activePin, context.mouseCanvasPos);
    return;
  }

  // Node header became active (mouse down) - select immediately
  // This ensures selection happens on mouse down, not just on click release
  if (nodesResult.activeNode && ImGui.IsMouseClicked(0)) {
    const node = nodesResult.activeNode;

    // In pin-less mode, right-click on node starts link creation
    // (we handle this below for right-click)

    if (io.KeyShift) {
      // Shift+click: Add to selection
      selectNode(state, node.id, true);
    } else if (io.KeyCtrl || io.KeySuper) {
      // Ctrl/Cmd+click: Toggle selection
      toggleNodeSelection(state, node.id);
    } else {
      // Plain click: Select only this node
      if (!node.isSelected) {
        clearSelection(state);
        selectNode(state, node.id);
      }
    }
  }

  // Pin-less mode: Right-click on node (header or body) starts link creation
  const nodeForLinkCreation = nodesResult.nodeActive || nodesResult.nodeHovered;
  if (isPinLessMode && nodeForLinkCreation && ImGui.IsMouseClicked(1)) {
    startNodeLinkCreation(state, nodeForLinkCreation.id, context.mouseCanvasPos);
    return;
  }

  // Node header being dragged
  if (nodesResult.draggingNode) {
    startNodeDrag(state, nodesResult.draggingNode.id, context.mouseCanvasPos);
    return;
  }

  // Link clicked
  if (linksResult.clickedLink) {
    const link = linksResult.clickedLink;

    if (io.KeyShift) {
      selectLink(state, link.id, true);
    } else if (io.KeyCtrl || io.KeySuper) {
      // Toggle link selection
      if (link.isSelected) {
        link.isSelected = false;
        state.selectedLinkIds.delete(link.id);
      } else {
        selectLink(state, link.id, true);
      }
    } else {
      clearSelection(state);
      selectLink(state, link.id);
    }
  }

  // Right-click on link for context menu
  if (linksResult.hoveredLink && ImGui.IsMouseClicked(1)) {
    result.contextMenuLink = linksResult.hoveredLink;
  }

  // Background interactions (only if no node/link was clicked)
  if (!nodesResult.clickedNode && !nodesResult.clickedPin && !linksResult.clickedLink) {
    // Left click on background
    if (context.isMouseOverCanvas && ImGui.IsMouseClicked(0)) {
      // Clear selection on background click
      if (!io.KeyShift && !io.KeyCtrl && !io.KeySuper) {
        clearSelection(state);
      }
    }

    // Start box selection on background drag
    if (context.isMouseOverCanvas && ImGui.IsMouseDragging(0, 5.0)) {
      startBoxSelect(state, context.mouseCanvasPos);
      return;
    }

    // Double-click on background to create new node
    if (context.isMouseOverCanvas && ImGui.IsMouseDoubleClicked(0)) {
      state.callbacks.onCanvasDoubleClick?.(context.mouseCanvasPos);
    }

    // Right-click on background for context menu
    if (context.isMouseOverCanvas && ImGui.IsMouseClicked(1)) {
      result.canvasContextMenuPos = context.mouseCanvasPos;
      state.callbacks.onCanvasContextMenu?.(context.mouseCanvasPos);
    }
  }
}

// ============================================================================
// Dragging Node Mode
// ============================================================================

function handleDraggingNodeMode(
  state: NodeEditorState,
  context: CanvasContext,
): void {
  if (ImGui.IsMouseDown(0)) {
    // Continue dragging
    updateNodeDrag(state, context.mouseCanvasPos);
  } else {
    // End drag
    endNodeDrag(state);
  }
}

// ============================================================================
// Creating Link Mode
// ============================================================================

function handleCreatingLinkMode(
  state: NodeEditorState,
  context: CanvasContext,
  nodesResult: NodesRenderResult,
): void {
  const isPinLessMode = state.config.pinLessMode;

  if (isPinLessMode) {
    // Pin-less mode: node-to-node connections
    // Get hovered node ID (from anywhere on the node - header or body)
    const hoveredNodeId = nodesResult.nodeHovered?.id || nodesResult.nodeActive?.id || state.hoveredNodeId;
    updateNodeLinkCreation(state, context.mouseCanvasPos, hoveredNodeId || undefined);

    // Left-click completes the link in pin-less mode
    if (ImGui.IsMouseClicked(0)) {
      if (hoveredNodeId && state.nodeLinkCreationState?.canConnect) {
        completeNodeLinkCreation(state);
      } else {
        // Clicked on empty space or invalid target - cancel
        cancelLinkCreation(state);
      }
    }

    // Right-click again or Escape to cancel
    if (ImGui.IsMouseClicked(1) || ImGui.IsKeyPressed(ImGui.Key._Escape)) {
      cancelLinkCreation(state);
    }
  } else {
    // Standard pin mode
    // Update link preview position, tracking the hovered pin as potential target
    updateLinkCreation(state, context.mouseCanvasPos, nodesResult.hoveredPin || undefined);

    // Mouse released - complete or cancel the link
    // This enables drag-and-drop style: press on source pin, drag to target pin, release
    if (ImGui.IsMouseReleased(0)) {
      // Check if we're over a valid target pin
      if (nodesResult.hoveredPin && state.linkCreationState?.canConnect) {
        completeLinkCreation(state);
      } else {
        // Released on empty space or invalid target - cancel
        cancelLinkCreation(state);
      }
    }

    // Right-click or Escape to cancel
    if (ImGui.IsMouseClicked(1) || ImGui.IsKeyPressed(ImGui.Key._Escape)) {
      cancelLinkCreation(state);
    }
  }
}

// ============================================================================
// Box Selecting Mode
// ============================================================================

function handleBoxSelectingMode(
  state: NodeEditorState,
  context: CanvasContext,
): void {
  const io = ImGui.GetIO();

  if (ImGui.IsMouseDown(0)) {
    // Continue box selection
    updateBoxSelect(state, context.mouseCanvasPos);
  } else {
    // Complete box selection
    completeBoxSelect(state, io.KeyShift);
  }
}

// ============================================================================
// Keyboard Input
// ============================================================================

function handleKeyboardInput(state: NodeEditorState): void {
  // Delete key - delete selected items
  if (ImGui.IsKeyPressed(ImGui.Key._Delete) || ImGui.IsKeyPressed(ImGui.Key._Backspace)) {
    if (state.selectedNodeIds.size > 0 || state.selectedLinkIds.size > 0) {
      deleteSelected(state);
    }
  }

  // Escape - cancel current operation or clear selection
  if (ImGui.IsKeyPressed(ImGui.Key._Escape)) {
    if (state.mode === 'creating-link') {
      cancelLinkCreation(state);
    } else if (state.mode === 'box-selecting') {
      state.mode = 'idle';
      state.boxSelectState = null;
    } else {
      clearSelection(state);
    }
  }

  // Ctrl+A - select all nodes
  const io = ImGui.GetIO();
  if ((io.KeyCtrl || io.KeySuper) && ImGui.IsKeyPressed(ImGui.Key._A)) {
    for (const node of state.nodes.values()) {
      selectNode(state, node.id, true);
    }
  }
}

// ============================================================================
// Context Menu Helpers
// ============================================================================

/**
 * Render a context menu for a node
 */
export function renderNodeContextMenu(
  state: NodeEditorState,
  node: NodeState,
  popupId: string,
): void {
  if (ImGui.BeginPopup(popupId)) {
    ImGui.TextDisabled(node.title);
    ImGui.Separator();

    if (ImGui.MenuItem('Delete')) {
      selectNode(state, node.id);
      deleteSelected(state);
    }

    if (ImGui.MenuItem('Duplicate')) {
      // Duplicate functionality would be implemented by the user
      // through callbacks
    }

    ImGui.EndPopup();
  }
}

/**
 * Render a context menu for a link
 */
export function renderLinkContextMenu(
  state: NodeEditorState,
  link: LinkState,
  popupId: string,
): void {
  if (ImGui.BeginPopup(popupId)) {
    ImGui.TextDisabled('Link');
    ImGui.Separator();

    if (ImGui.MenuItem('Delete')) {
      selectLink(state, link.id);
      deleteSelected(state);
    }

    ImGui.EndPopup();
  }
}

/**
 * Render a context menu for the canvas background
 */
export function renderCanvasContextMenu(
  state: NodeEditorState,
  position: Vec2,
  popupId: string,
  onAddNode?: (position: Vec2) => void,
): void {
  if (ImGui.BeginPopup(popupId)) {
    if (ImGui.MenuItem('Add State')) {
      onAddNode?.(position);
      ImGui.CloseCurrentPopup();
    }

    ImGui.Separator();

    if (ImGui.MenuItem('Select All')) {
      for (const node of state.nodes.values()) {
        selectNode(state, node.id, true);
      }
    }

    if (state.selectedNodeIds.size > 0 || state.selectedLinkIds.size > 0) {
      if (ImGui.MenuItem('Delete Selected')) {
        deleteSelected(state);
      }
    }

    ImGui.EndPopup();
  }
}

// ============================================================================
// Minimap (Optional Feature)
// ============================================================================

/**
 * Render a minimap showing the entire graph
 * This is an optional feature for large graphs
 */
export function renderMinimap(
  state: NodeEditorState,
  context: CanvasContext,
  position: Vec2,
  size: { width: number; height: number },
): void {
  const config = state.config;

  // Calculate scale to fit entire canvas in minimap
  const scaleX = size.width / config.canvasSize.width;
  const scaleY = size.height / config.canvasSize.height;
  const scale = Math.min(scaleX, scaleY);

  // Minimap background
  ImGui.SetCursorPos({ x: position.x, y: position.y });
  ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.1, y: 0.1, z: 0.12, w: 0.9 });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, { x: 0.1, y: 0.1, z: 0.12, w: 0.9 });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, { x: 0.1, y: 0.1, z: 0.12, w: 0.9 });
  ImGui.Button('##minimapBg', { x: size.width, y: size.height });
  ImGui.PopStyleColor(3);

  // Render nodes as small rectangles
  for (const node of state.nodes.values()) {
    const nodeX = position.x + node.position.x * scale;
    const nodeY = position.y + node.position.y * scale;
    const nodeW = node.size.width * scale;
    const nodeH = node.size.height * scale;

    const color = node.isSelected ? config.selectionColor : (node.color || config.defaultNodeColor);

    ImGui.SetCursorPos({ x: nodeX, y: nodeY });
    ImGui.PushStyleColorImVec4(ImGui.Col.Button, {
      x: color.r,
      y: color.g,
      z: color.b,
      w: color.a,
    });
    ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, {
      x: color.r,
      y: color.g,
      z: color.b,
      w: color.a,
    });
    ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, {
      x: color.r,
      y: color.g,
      z: color.b,
      w: color.a,
    });
    ImGui.Button(`##mmNode_${node.id}`, { x: Math.max(2, nodeW), y: Math.max(2, nodeH) });
    ImGui.PopStyleColor(3);
  }

  // Render viewport indicator
  const viewX = position.x + context.scrollOffset.x * scale;
  const viewY = position.y + context.scrollOffset.y * scale;
  const viewW = context.visibleSize.width / context.zoom * scale;
  const viewH = context.visibleSize.height / context.zoom * scale;

  // Viewport border
  ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 1, y: 1, z: 1, w: 0.3 });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, { x: 1, y: 1, z: 1, w: 0.3 });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, { x: 1, y: 1, z: 1, w: 0.3 });

  ImGui.SetCursorPos({ x: viewX, y: viewY });
  ImGui.Button('##mmViewport', { x: viewW, y: viewH });

  ImGui.PopStyleColor(3);
}
