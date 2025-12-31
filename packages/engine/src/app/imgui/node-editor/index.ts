/**
 * Node Editor
 *
 * A generic node-based visual editor framework for ImGui.
 * Can be used for animation state machines, shader graphs, etc.
 *
 * @example
 * ```typescript
 * import { createNodeEditorState, renderNodeEditor, addNode } from './node-editor';
 *
 * // Create editor state
 * const editorState = createNodeEditorState('my-editor', {
 *   nodeWidth: 200,
 *   gridSize: 20,
 * }, {
 *   onLinkCreated: (source, sourcePin, target, targetPin) => {
 *     console.log('Link created!');
 *   },
 * });
 *
 * // Add nodes
 * addNode(editorState, {
 *   id: 'node-1',
 *   position: { x: 100, y: 100 },
 *   title: 'Start',
 *   inputs: [],
 *   outputs: [{ id: 'out', name: 'Next', kind: 'output', type: 'flow' }],
 * });
 *
 * // In your ImGui render loop:
 * renderNodeEditor(editorState, 800, 600);
 * ```
 */

// Re-export types
export type {
  Vec2,
  Size,
  Rect,
  PinKind,
  PinType,
  PinDefinition,
  PinState,
  NodeDefinition,
  NodeState,
  LinkDefinition,
  LinkState,
  InteractionMode,
  DragState,
  LinkCreationState,
  NodeLinkCreationState,
  BoxSelectState,
  NodeEditorConfig,
  NodeEditorCallbacks,
} from './node-editor-types.js';

export {
  DEFAULT_NODE_EDITOR_CONFIG,
  isPinCompatible,
  vec2,
  vec2Add,
  vec2Sub,
  vec2Scale,
  vec2Distance,
  vec2Lerp,
  rectContains,
  rectsOverlap,
  generateId,
} from './node-editor-types.js';

// Re-export state management
export type {
  NodeEditorState,
  SerializedNodeEditor,
} from './node-editor-state.js';

export {
  createNodeEditorState,
  addNode,
  removeNode,
  moveNode,
  getNode,
  getAllNodes,
  addLink,
  removeLink,
  getLink,
  getAllLinks,
  getLinksForNode,
  selectNode,
  deselectNode,
  toggleNodeSelection,
  selectLink,
  deselectLink,
  clearSelection,
  deleteSelected,
  startNodeDrag,
  updateNodeDrag,
  endNodeDrag,
  startLinkCreation,
  updateLinkCreation,
  completeLinkCreation,
  cancelLinkCreation,
  // Pin-less mode (node-to-node links)
  startNodeLinkCreation,
  updateNodeLinkCreation,
  completeNodeLinkCreation,
  addNodeLink,
  calculateNodeEdgePositions,
  startBoxSelect,
  updateBoxSelect,
  completeBoxSelect,
  serializeNodeEditor,
  deserializeNodeEditor,
  clearNodeEditor,
} from './node-editor-state.js';

// Re-export canvas
export type { CanvasContext } from './node-editor-canvas.js';

export {
  beginCanvas,
  endCanvas,
  getCanvasContext,
  canvasToScreen,
  screenToCanvas,
  canvasSizeToScreen,
  isPointVisible,
  isRectVisible,
  scrollToPosition,
  scrollToNode,
  getVisibleBounds,
} from './node-editor-canvas.js';

// Re-export renderers
export type { NodeRenderResult, NodesRenderResult } from './node-renderer.js';
export type { LinkRenderResult } from './link-renderer.js';

export {
  renderNode,
  renderAllNodes,
  renderBoxSelection,
} from './node-renderer.js';

export {
  renderLink,
  renderLinkCreation,
  renderAllLinks,
  distanceToLineSegment,
  isPointNearLink,
} from './link-renderer.js';

// Re-export interactions
export type { InteractionResult } from './node-editor-interactions.js';

export {
  handleInteractions,
  renderNodeContextMenu,
  renderLinkContextMenu,
  renderCanvasContextMenu,
  renderMinimap,
} from './node-editor-interactions.js';

// ============================================================================
// High-Level Render Function
// ============================================================================

import { ImGui } from '@voidscript/imgui';
import { type NodeEditorState, deleteSelected, clearNodeEditor } from './node-editor-state.js';
import { beginCanvas, endCanvas, type CanvasContext } from './node-editor-canvas.js';
import { renderAllNodes, renderBoxSelection } from './node-renderer.js';
import { renderAllLinks } from './link-renderer.js';
import { handleInteractions, type InteractionResult } from './node-editor-interactions.js';

export interface NodeEditorRenderResult {
  /** Canvas context for advanced usage */
  context: CanvasContext;
  /** Interaction result */
  interactions: InteractionResult;
}

/**
 * Render the complete node editor
 *
 * This is the main entry point for rendering. Call this in your ImGui loop.
 *
 * @param state - The node editor state
 * @param width - Available width for the editor
 * @param height - Available height for the editor
 * @returns Render result with context and interaction info
 */
export function renderNodeEditor(
  state: NodeEditorState,
  width: number,
  height: number,
): NodeEditorRenderResult {
  // Begin canvas
  const context = beginCanvas(state, width, height);

  // Render links first (behind nodes)
  const linksResult = renderAllLinks(state, context);

  // Render nodes
  const nodesResult = renderAllNodes(state, context);

  // Render box selection overlay
  renderBoxSelection(state, context);

  // Handle interactions
  const interactions = handleInteractions(state, context, nodesResult, linksResult);

  // End canvas
  endCanvas();

  return { context, interactions };
}

/**
 * Render a simple toolbar for the node editor
 */
export function renderNodeEditorToolbar(
  state: NodeEditorState,
  onAddNode?: () => void,
): void {
  if (ImGui.Button('Add Node')) {
    onAddNode?.();
  }

  ImGui.SameLine();

  if (ImGui.Button('Delete Selected')) {
    if (state.selectedNodeIds.size > 0 || state.selectedLinkIds.size > 0) {
      deleteSelected(state);
    }
  }

  ImGui.SameLine();

  if (ImGui.Button('Clear All')) {
    clearNodeEditor(state);
  }

  ImGui.SameLine();

  // Zoom controls
  ImGui.Text(`Zoom: ${(state.zoom * 100).toFixed(0)}%%`);

  ImGui.SameLine();

  if (ImGui.Button('-')) {
    state.zoom = Math.max(0.25, state.zoom - 0.1);
  }

  ImGui.SameLine();

  if (ImGui.Button('+')) {
    state.zoom = Math.min(2.0, state.zoom + 0.1);
  }

  ImGui.SameLine();

  if (ImGui.Button('Reset Zoom')) {
    state.zoom = 1.0;
  }
}
