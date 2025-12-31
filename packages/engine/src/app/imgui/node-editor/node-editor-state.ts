/**
 * Node Editor State
 *
 * Manages the state of a node editor instance including nodes, links,
 * selection, and interaction state.
 */

import {
  type NodeDefinition,
  type NodeState,
  type LinkDefinition,
  type LinkState,
  type PinState,
  type Vec2,
  type Size,
  type InteractionMode,
  type DragState,
  type LinkCreationState,
  type NodeLinkCreationState,
  type BoxSelectState,
  type NodeEditorConfig,
  type NodeEditorCallbacks,
  DEFAULT_NODE_EDITOR_CONFIG,
  vec2,
  vec2Sub,
  generateId,
} from './node-editor-types.js';

// ============================================================================
// State Interface
// ============================================================================

export interface NodeEditorState {
  /** Unique editor instance ID */
  id: string;
  /** Configuration */
  config: NodeEditorConfig;
  /** Callbacks */
  callbacks: NodeEditorCallbacks;
  /** All nodes (runtime state) */
  nodes: Map<string, NodeState>;
  /** All links (runtime state) */
  links: Map<string, LinkState>;
  /** Selected node IDs */
  selectedNodeIds: Set<string>;
  /** Selected link IDs */
  selectedLinkIds: Set<string>;
  /** Current interaction mode */
  mode: InteractionMode;
  /** Canvas scroll offset */
  scrollOffset: Vec2;
  /** Canvas zoom level (1.0 = 100%) */
  zoom: number;
  /** Drag state when dragging nodes */
  dragState: DragState | null;
  /** Link creation state (pin mode) */
  linkCreationState: LinkCreationState | null;
  /** Node-to-node link creation state (pin-less mode) */
  nodeLinkCreationState: NodeLinkCreationState | null;
  /** Box select state */
  boxSelectState: BoxSelectState | null;
  /** Currently hovered node ID */
  hoveredNodeId: string | null;
  /** Currently hovered link ID */
  hoveredLinkId: string | null;
  /** Currently hovered pin */
  hoveredPin: PinState | null;
  /** Whether the editor is dirty (has unsaved changes) */
  isDirty: boolean;
}

// ============================================================================
// State Factory
// ============================================================================

export function createNodeEditorState(
  id: string,
  config?: Partial<NodeEditorConfig>,
  callbacks?: NodeEditorCallbacks,
): NodeEditorState {
  return {
    id,
    config: { ...DEFAULT_NODE_EDITOR_CONFIG, ...config },
    callbacks: callbacks || {},
    nodes: new Map(),
    links: new Map(),
    selectedNodeIds: new Set(),
    selectedLinkIds: new Set(),
    mode: 'idle',
    scrollOffset: vec2(0, 0),
    zoom: 1.0,
    dragState: null,
    linkCreationState: null,
    nodeLinkCreationState: null,
    boxSelectState: null,
    hoveredNodeId: null,
    hoveredLinkId: null,
    hoveredPin: null,
    isDirty: false,
  };
}

// ============================================================================
// Node Management
// ============================================================================

/**
 * Compute pin positions based on node position and size
 */
function computePinPositions(
  node: NodeState,
  config: NodeEditorConfig,
): void {
  const { nodeWidth, nodeHeaderHeight, pinRowHeight, pinRadius } = config;

  // Input pins on left side
  node.inputPins.forEach((pin, index) => {
    pin.position = {
      x: node.position.x,
      y: node.position.y + nodeHeaderHeight + pinRowHeight * (index + 0.5),
    };
  });

  // Output pins on right side
  node.outputPins.forEach((pin, index) => {
    pin.position = {
      x: node.position.x + nodeWidth,
      y: node.position.y + nodeHeaderHeight + pinRowHeight * (index + 0.5),
    };
  });
}

/**
 * Compute node size based on pins
 */
function computeNodeSize(
  node: NodeState,
  config: NodeEditorConfig,
): void {
  const { nodeWidth, nodeHeaderHeight, pinRowHeight } = config;
  const pinCount = Math.max(node.inputPins.length, node.outputPins.length, 1);

  node.size = {
    width: nodeWidth,
    height: nodeHeaderHeight + pinRowHeight * pinCount,
  };
}

/**
 * Add a node to the editor
 */
export function addNode(
  state: NodeEditorState,
  definition: NodeDefinition,
): NodeState {
  const nodeState: NodeState = {
    ...definition,
    size: { width: 0, height: 0 },
    inputPins: definition.inputs.map((pin) => ({
      ...pin,
      nodeId: definition.id,
      position: vec2(0, 0),
      isHovered: false,
    })),
    outputPins: definition.outputs.map((pin) => ({
      ...pin,
      nodeId: definition.id,
      position: vec2(0, 0),
      isHovered: false,
    })),
    isSelected: false,
    isDragging: false,
  };

  computeNodeSize(nodeState, state.config);
  computePinPositions(nodeState, state.config);

  state.nodes.set(definition.id, nodeState);
  state.isDirty = true;

  return nodeState;
}

/**
 * Remove a node and all its connected links
 */
export function removeNode(state: NodeEditorState, nodeId: string): void {
  // Remove all links connected to this node
  const linksToRemove: string[] = [];
  for (const [linkId, link] of state.links) {
    if (link.sourceNodeId === nodeId || link.targetNodeId === nodeId) {
      linksToRemove.push(linkId);
    }
  }
  linksToRemove.forEach((linkId) => state.links.delete(linkId));

  // Remove the node
  state.nodes.delete(nodeId);
  state.selectedNodeIds.delete(nodeId);
  state.isDirty = true;
}

/**
 * Update node position
 */
export function moveNode(
  state: NodeEditorState,
  nodeId: string,
  newPosition: Vec2,
): void {
  const node = state.nodes.get(nodeId);
  if (!node) return;

  // Snap to grid if enabled
  if (state.config.gridSize > 0) {
    newPosition = {
      x: Math.round(newPosition.x / state.config.gridSize) * state.config.gridSize,
      y: Math.round(newPosition.y / state.config.gridSize) * state.config.gridSize,
    };
  }

  node.position = newPosition;
  computePinPositions(node, state.config);
  updateLinkPositions(state);
  state.isDirty = true;

  state.callbacks.onNodeMoved?.(nodeId, newPosition);
}

/**
 * Get a node by ID
 */
export function getNode(state: NodeEditorState, nodeId: string): NodeState | undefined {
  return state.nodes.get(nodeId);
}

/**
 * Get all nodes as array
 */
export function getAllNodes(state: NodeEditorState): NodeState[] {
  return Array.from(state.nodes.values());
}

// ============================================================================
// Link Management
// ============================================================================

/**
 * Update link positions based on node positions
 */
function updateLinkPositions(state: NodeEditorState): void {
  const isPinLessMode = state.config.pinLessMode;

  for (const link of state.links.values()) {
    const sourceNode = state.nodes.get(link.sourceNodeId);
    const targetNode = state.nodes.get(link.targetNodeId);

    if (sourceNode && targetNode) {
      if (isPinLessMode) {
        // In pin-less mode, calculate edge positions dynamically
        const positions = calculateNodeEdgePositions(sourceNode, targetNode);
        link.sourcePosition = positions.source;
        link.targetPosition = positions.target;
      } else {
        // Standard pin mode - use pin positions
        const sourcePin = sourceNode.outputPins.find(
          (p) => p.id === link.sourcePinId,
        );
        const targetPin = targetNode.inputPins.find(
          (p) => p.id === link.targetPinId,
        );

        if (sourcePin && targetPin) {
          link.sourcePosition = { ...sourcePin.position };
          link.targetPosition = { ...targetPin.position };
        }
      }
    }
  }
}

/**
 * Add a link between two pins
 */
export function addLink(
  state: NodeEditorState,
  sourceNodeId: string,
  sourcePinId: string,
  targetNodeId: string,
  targetPinId: string,
  id?: string,
): LinkState | null {
  const sourceNode = state.nodes.get(sourceNodeId);
  const targetNode = state.nodes.get(targetNodeId);

  if (!sourceNode || !targetNode) return null;

  const sourcePin = sourceNode.outputPins.find((p) => p.id === sourcePinId);
  const targetPin = targetNode.inputPins.find((p) => p.id === targetPinId);

  if (!sourcePin || !targetPin) return null;

  // Check if link already exists
  for (const link of state.links.values()) {
    if (
      link.sourceNodeId === sourceNodeId &&
      link.sourcePinId === sourcePinId &&
      link.targetNodeId === targetNodeId &&
      link.targetPinId === targetPinId
    ) {
      return null; // Link already exists
    }
  }

  // Check if target pin already has a connection (unless it allows multiple)
  if (!targetPin.allowMultiple) {
    for (const link of state.links.values()) {
      if (link.targetNodeId === targetNodeId && link.targetPinId === targetPinId) {
        // Remove existing link
        state.links.delete(link.id);
        break;
      }
    }
  }

  const linkId = id || generateId();
  const linkState: LinkState = {
    id: linkId,
    sourceNodeId,
    sourcePinId,
    targetNodeId,
    targetPinId,
    sourcePosition: { ...sourcePin.position },
    targetPosition: { ...targetPin.position },
    isSelected: false,
    isHovered: false,
  };

  state.links.set(linkId, linkState);
  state.isDirty = true;

  state.callbacks.onLinkCreated?.(sourceNodeId, sourcePinId, targetNodeId, targetPinId);

  return linkState;
}

/**
 * Remove a link
 */
export function removeLink(state: NodeEditorState, linkId: string): void {
  state.links.delete(linkId);
  state.selectedLinkIds.delete(linkId);
  state.isDirty = true;

  state.callbacks.onLinkDeleted?.(linkId);
}

/**
 * Get a link by ID
 */
export function getLink(state: NodeEditorState, linkId: string): LinkState | undefined {
  return state.links.get(linkId);
}

/**
 * Get all links as array
 */
export function getAllLinks(state: NodeEditorState): LinkState[] {
  return Array.from(state.links.values());
}

/**
 * Get links connected to a node
 */
export function getLinksForNode(state: NodeEditorState, nodeId: string): LinkState[] {
  const result: LinkState[] = [];
  for (const link of state.links.values()) {
    if (link.sourceNodeId === nodeId || link.targetNodeId === nodeId) {
      result.push(link);
    }
  }
  return result;
}

// ============================================================================
// Selection Management
// ============================================================================

/**
 * Select a node
 */
export function selectNode(
  state: NodeEditorState,
  nodeId: string,
  addToSelection = false,
): void {
  if (!addToSelection) {
    clearSelection(state);
  }

  const node = state.nodes.get(nodeId);
  if (node) {
    node.isSelected = true;
    state.selectedNodeIds.add(nodeId);
    state.callbacks.onNodeSelectionChanged?.(Array.from(state.selectedNodeIds));
  }
}

/**
 * Deselect a node
 */
export function deselectNode(state: NodeEditorState, nodeId: string): void {
  const node = state.nodes.get(nodeId);
  if (node) {
    node.isSelected = false;
    state.selectedNodeIds.delete(nodeId);
    state.callbacks.onNodeSelectionChanged?.(Array.from(state.selectedNodeIds));
  }
}

/**
 * Toggle node selection
 */
export function toggleNodeSelection(state: NodeEditorState, nodeId: string): void {
  const node = state.nodes.get(nodeId);
  if (node) {
    if (node.isSelected) {
      deselectNode(state, nodeId);
    } else {
      selectNode(state, nodeId, true);
    }
  }
}

/**
 * Select a link
 */
export function selectLink(
  state: NodeEditorState,
  linkId: string,
  addToSelection = false,
): void {
  if (!addToSelection) {
    clearSelection(state);
  }

  const link = state.links.get(linkId);
  if (link) {
    link.isSelected = true;
    state.selectedLinkIds.add(linkId);
    state.callbacks.onLinkSelectionChanged?.(Array.from(state.selectedLinkIds));
  }
}

/**
 * Deselect a link
 */
export function deselectLink(state: NodeEditorState, linkId: string): void {
  const link = state.links.get(linkId);
  if (link) {
    link.isSelected = false;
    state.selectedLinkIds.delete(linkId);
    state.callbacks.onLinkSelectionChanged?.(Array.from(state.selectedLinkIds));
  }
}

/**
 * Clear all selection
 */
export function clearSelection(state: NodeEditorState): void {
  for (const node of state.nodes.values()) {
    node.isSelected = false;
  }
  for (const link of state.links.values()) {
    link.isSelected = false;
  }

  const hadNodeSelection = state.selectedNodeIds.size > 0;
  const hadLinkSelection = state.selectedLinkIds.size > 0;

  state.selectedNodeIds.clear();
  state.selectedLinkIds.clear();

  if (hadNodeSelection) {
    state.callbacks.onNodeSelectionChanged?.([]);
  }
  if (hadLinkSelection) {
    state.callbacks.onLinkSelectionChanged?.([]);
  }
}

/**
 * Delete selected items
 */
export function deleteSelected(state: NodeEditorState): void {
  // Delete selected links first
  const linksToDelete = Array.from(state.selectedLinkIds);
  linksToDelete.forEach((linkId) => removeLink(state, linkId));

  // Delete selected nodes
  const nodesToDelete = Array.from(state.selectedNodeIds);
  nodesToDelete.forEach((nodeId) => removeNode(state, nodeId));

  if (nodesToDelete.length > 0) {
    state.callbacks.onNodesDeleted?.(nodesToDelete);
  }
}

// ============================================================================
// Interaction State
// ============================================================================

/**
 * Start dragging a node
 */
export function startNodeDrag(
  state: NodeEditorState,
  nodeId: string,
  mousePosition: Vec2,
): void {
  const node = state.nodes.get(nodeId);
  if (!node) return;

  // If the node isn't selected, select only it
  if (!node.isSelected) {
    clearSelection(state);
    selectNode(state, nodeId);
  }

  // Mark all selected nodes as dragging
  for (const selectedId of state.selectedNodeIds) {
    const selectedNode = state.nodes.get(selectedId);
    if (selectedNode) {
      selectedNode.isDragging = true;
    }
  }

  state.mode = 'dragging-node';
  state.dragState = {
    nodeId,
    startPosition: { ...node.position },
    offset: vec2Sub(mousePosition, node.position),
  };
}

/**
 * Update node drag position
 */
export function updateNodeDrag(state: NodeEditorState, mousePosition: Vec2): void {
  if (state.mode !== 'dragging-node' || !state.dragState) return;

  const primaryNode = state.nodes.get(state.dragState.nodeId);
  if (!primaryNode) return;

  // Calculate delta from the primary node's drag
  const newPrimaryPos = vec2Sub(mousePosition, state.dragState.offset);
  const delta = vec2Sub(newPrimaryPos, primaryNode.position);

  // Move all selected nodes by the same delta
  for (const selectedId of state.selectedNodeIds) {
    const node = state.nodes.get(selectedId);
    if (node) {
      const newPos = {
        x: node.position.x + delta.x,
        y: node.position.y + delta.y,
      };
      node.position = newPos;
      computePinPositions(node, state.config);
    }
  }

  updateLinkPositions(state);
}

/**
 * End node drag
 */
export function endNodeDrag(state: NodeEditorState): void {
  if (state.mode !== 'dragging-node') return;

  // Snap all dragged nodes to grid and fire callbacks
  for (const selectedId of state.selectedNodeIds) {
    const node = state.nodes.get(selectedId);
    if (node) {
      node.isDragging = false;

      // Snap to grid
      if (state.config.gridSize > 0) {
        node.position = {
          x: Math.round(node.position.x / state.config.gridSize) * state.config.gridSize,
          y: Math.round(node.position.y / state.config.gridSize) * state.config.gridSize,
        };
        computePinPositions(node, state.config);
      }

      state.callbacks.onNodeMoved?.(selectedId, node.position);
    }
  }

  updateLinkPositions(state);
  state.mode = 'idle';
  state.dragState = null;
  state.isDirty = true;
}

/**
 * Start creating a link from a pin
 */
export function startLinkCreation(
  state: NodeEditorState,
  sourcePin: PinState,
  mousePosition: Vec2,
): void {
  state.mode = 'creating-link';
  state.linkCreationState = {
    sourcePin,
    currentPosition: mousePosition,
    canConnect: false,
  };
}

/**
 * Update link creation mouse position
 */
export function updateLinkCreation(
  state: NodeEditorState,
  mousePosition: Vec2,
  targetPin?: PinState,
): void {
  if (state.mode !== 'creating-link' || !state.linkCreationState) return;

  state.linkCreationState.currentPosition = mousePosition;
  state.linkCreationState.targetPin = targetPin;

  if (targetPin) {
    // Use callback for custom validation, or default pin compatibility
    const canConnect = state.callbacks.canCreateLink
      ? state.callbacks.canCreateLink(state.linkCreationState.sourcePin, targetPin)
      : isPinCompatibleForLink(state.linkCreationState.sourcePin, targetPin);
    state.linkCreationState.canConnect = canConnect;
  } else {
    state.linkCreationState.canConnect = false;
  }
}

/**
 * Complete link creation
 */
export function completeLinkCreation(state: NodeEditorState): boolean {
  if (
    state.mode !== 'creating-link' ||
    !state.linkCreationState ||
    !state.linkCreationState.targetPin ||
    !state.linkCreationState.canConnect
  ) {
    cancelLinkCreation(state);
    return false;
  }

  const { sourcePin, targetPin } = state.linkCreationState;

  // Determine source and target based on pin kinds
  let actualSource: PinState;
  let actualTarget: PinState;

  if (sourcePin.kind === 'output') {
    actualSource = sourcePin;
    actualTarget = targetPin;
  } else {
    actualSource = targetPin;
    actualTarget = sourcePin;
  }

  addLink(
    state,
    actualSource.nodeId,
    actualSource.id,
    actualTarget.nodeId,
    actualTarget.id,
  );

  state.mode = 'idle';
  state.linkCreationState = null;
  return true;
}

/**
 * Cancel link creation
 */
export function cancelLinkCreation(state: NodeEditorState): void {
  state.mode = 'idle';
  state.linkCreationState = null;
  state.nodeLinkCreationState = null;
}

// ============================================================================
// Node-to-Node Link Creation (Pin-less Mode)
// ============================================================================

/**
 * Start creating a node-to-node link (pin-less mode)
 */
export function startNodeLinkCreation(
  state: NodeEditorState,
  sourceNodeId: string,
  mousePosition: Vec2,
): void {
  state.mode = 'creating-link';
  state.nodeLinkCreationState = {
    sourceNodeId,
    currentPosition: mousePosition,
    canConnect: false,
  };
}

/**
 * Update node-to-node link creation
 */
export function updateNodeLinkCreation(
  state: NodeEditorState,
  mousePosition: Vec2,
  targetNodeId?: string,
): void {
  if (state.mode !== 'creating-link' || !state.nodeLinkCreationState) return;

  state.nodeLinkCreationState.currentPosition = mousePosition;
  state.nodeLinkCreationState.targetNodeId = targetNodeId;

  if (targetNodeId && targetNodeId !== state.nodeLinkCreationState.sourceNodeId) {
    // In pin-less mode, we allow any connection except self-loops
    state.nodeLinkCreationState.canConnect = true;
  } else {
    state.nodeLinkCreationState.canConnect = false;
  }
}

/**
 * Complete node-to-node link creation
 */
export function completeNodeLinkCreation(state: NodeEditorState): boolean {
  if (
    state.mode !== 'creating-link' ||
    !state.nodeLinkCreationState ||
    !state.nodeLinkCreationState.targetNodeId ||
    !state.nodeLinkCreationState.canConnect
  ) {
    cancelLinkCreation(state);
    return false;
  }

  const { sourceNodeId, targetNodeId } = state.nodeLinkCreationState;

  addNodeLink(state, sourceNodeId, targetNodeId);

  state.mode = 'idle';
  state.nodeLinkCreationState = null;
  return true;
}

/**
 * Add a link between two nodes directly (pin-less mode).
 * Uses virtual pins with node IDs.
 */
export function addNodeLink(
  state: NodeEditorState,
  sourceNodeId: string,
  targetNodeId: string,
  id?: string,
): LinkState | null {
  const sourceNode = state.nodes.get(sourceNodeId);
  const targetNode = state.nodes.get(targetNodeId);

  if (!sourceNode || !targetNode) return null;

  // In pin-less mode, we don't check for duplicates in the same direction
  // but we do allow A→B and B→A (bidirectional)
  // Check if this exact directional link already exists
  for (const link of state.links.values()) {
    if (
      link.sourceNodeId === sourceNodeId &&
      link.targetNodeId === targetNodeId
    ) {
      return null; // This direction already exists
    }
  }

  const linkId = id || generateId();

  // Calculate edge positions
  const positions = calculateNodeEdgePositions(sourceNode, targetNode);

  const linkState: LinkState = {
    id: linkId,
    sourceNodeId,
    sourcePinId: `${sourceNodeId}_out`, // Virtual pin ID
    targetNodeId,
    targetPinId: `${targetNodeId}_in`, // Virtual pin ID
    sourcePosition: positions.source,
    targetPosition: positions.target,
    isSelected: false,
    isHovered: false,
  };

  state.links.set(linkId, linkState);
  state.isDirty = true;

  state.callbacks.onLinkCreated?.(sourceNodeId, `${sourceNodeId}_out`, targetNodeId, `${targetNodeId}_in`);

  return linkState;
}

/**
 * Calculate the edge positions for a link between two nodes.
 * Finds the best connection points on the node edges.
 */
export function calculateNodeEdgePositions(
  sourceNode: NodeState,
  targetNode: NodeState,
): { source: Vec2; target: Vec2 } {
  // Get node centers
  const sourceCenter: Vec2 = {
    x: sourceNode.position.x + sourceNode.size.width / 2,
    y: sourceNode.position.y + sourceNode.size.height / 2,
  };
  const targetCenter: Vec2 = {
    x: targetNode.position.x + targetNode.size.width / 2,
    y: targetNode.position.y + targetNode.size.height / 2,
  };

  // Calculate direction from source to target
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  // Determine which edges to use based on relative position
  let sourceEdge: Vec2;
  let targetEdge: Vec2;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal connection
    if (dx > 0) {
      // Target is to the right
      sourceEdge = {
        x: sourceNode.position.x + sourceNode.size.width,
        y: sourceCenter.y,
      };
      targetEdge = {
        x: targetNode.position.x,
        y: targetCenter.y,
      };
    } else {
      // Target is to the left
      sourceEdge = {
        x: sourceNode.position.x,
        y: sourceCenter.y,
      };
      targetEdge = {
        x: targetNode.position.x + targetNode.size.width,
        y: targetCenter.y,
      };
    }
  } else {
    // Vertical connection
    if (dy > 0) {
      // Target is below
      sourceEdge = {
        x: sourceCenter.x,
        y: sourceNode.position.y + sourceNode.size.height,
      };
      targetEdge = {
        x: targetCenter.x,
        y: targetNode.position.y,
      };
    } else {
      // Target is above
      sourceEdge = {
        x: sourceCenter.x,
        y: sourceNode.position.y,
      };
      targetEdge = {
        x: targetCenter.x,
        y: targetNode.position.y + targetNode.size.height,
      };
    }
  }

  return { source: sourceEdge, target: targetEdge };
}

/**
 * Check if two pins can be connected
 */
function isPinCompatibleForLink(source: PinState, target: PinState): boolean {
  // Can't connect to same node
  if (source.nodeId === target.nodeId) return false;

  // Must be different kinds (output -> input or input <- output)
  if (source.kind === target.kind) return false;

  // Type compatibility
  const outputPin = source.kind === 'output' ? source : target;
  const inputPin = source.kind === 'input' ? source : target;

  if (outputPin.type === 'any' || inputPin.type === 'any') return true;
  if (outputPin.type === inputPin.type) return true;

  // Number compatibility
  if (
    (outputPin.type === 'int' || outputPin.type === 'float') &&
    (inputPin.type === 'int' || inputPin.type === 'float')
  ) {
    return true;
  }

  return false;
}

/**
 * Start box selection
 */
export function startBoxSelect(state: NodeEditorState, position: Vec2): void {
  state.mode = 'box-selecting';
  state.boxSelectState = {
    startPosition: position,
    currentPosition: position,
  };
}

/**
 * Update box selection
 */
export function updateBoxSelect(state: NodeEditorState, position: Vec2): void {
  if (state.mode !== 'box-selecting' || !state.boxSelectState) return;
  state.boxSelectState.currentPosition = position;
}

/**
 * Complete box selection
 */
export function completeBoxSelect(state: NodeEditorState, addToSelection = false): void {
  if (state.mode !== 'box-selecting' || !state.boxSelectState) return;

  const box = state.boxSelectState;
  const minX = Math.min(box.startPosition.x, box.currentPosition.x);
  const maxX = Math.max(box.startPosition.x, box.currentPosition.x);
  const minY = Math.min(box.startPosition.y, box.currentPosition.y);
  const maxY = Math.max(box.startPosition.y, box.currentPosition.y);

  if (!addToSelection) {
    clearSelection(state);
  }

  // Select nodes that overlap with the box
  for (const node of state.nodes.values()) {
    const nodeRight = node.position.x + node.size.width;
    const nodeBottom = node.position.y + node.size.height;

    if (
      node.position.x < maxX &&
      nodeRight > minX &&
      node.position.y < maxY &&
      nodeBottom > minY
    ) {
      selectNode(state, node.id, true);
    }
  }

  state.mode = 'idle';
  state.boxSelectState = null;
}

// ============================================================================
// Serialization
// ============================================================================

export interface SerializedNodeEditor {
  nodes: NodeDefinition[];
  links: LinkDefinition[];
}

/**
 * Serialize editor state to a plain object
 */
export function serializeNodeEditor(state: NodeEditorState): SerializedNodeEditor {
  const nodes: NodeDefinition[] = [];
  const links: LinkDefinition[] = [];

  for (const node of state.nodes.values()) {
    nodes.push({
      id: node.id,
      position: { ...node.position },
      title: node.title,
      color: node.color ? { ...node.color } : undefined,
      inputs: node.inputPins.map((p) => ({
        id: p.id,
        name: p.name,
        kind: p.kind,
        type: p.type,
        allowMultiple: p.allowMultiple,
      })),
      outputs: node.outputPins.map((p) => ({
        id: p.id,
        name: p.name,
        kind: p.kind,
        type: p.type,
        allowMultiple: p.allowMultiple,
      })),
      userData: node.userData,
    });
  }

  for (const link of state.links.values()) {
    links.push({
      id: link.id,
      sourceNodeId: link.sourceNodeId,
      sourcePinId: link.sourcePinId,
      targetNodeId: link.targetNodeId,
      targetPinId: link.targetPinId,
      color: link.color ? { ...link.color } : undefined,
    });
  }

  return { nodes, links };
}

/**
 * Deserialize editor state from a plain object
 */
export function deserializeNodeEditor(
  state: NodeEditorState,
  data: SerializedNodeEditor,
): void {
  // Clear existing state
  state.nodes.clear();
  state.links.clear();
  state.selectedNodeIds.clear();
  state.selectedLinkIds.clear();

  // Add nodes
  for (const nodeDef of data.nodes) {
    addNode(state, nodeDef);
  }

  // Add links
  for (const linkDef of data.links) {
    addLink(
      state,
      linkDef.sourceNodeId,
      linkDef.sourcePinId,
      linkDef.targetNodeId,
      linkDef.targetPinId,
      linkDef.id,
    );
  }

  state.isDirty = false;
}

/**
 * Clear all editor state
 */
export function clearNodeEditor(state: NodeEditorState): void {
  state.nodes.clear();
  state.links.clear();
  state.selectedNodeIds.clear();
  state.selectedLinkIds.clear();
  state.mode = 'idle';
  state.dragState = null;
  state.linkCreationState = null;
  state.nodeLinkCreationState = null;
  state.boxSelectState = null;
  state.hoveredNodeId = null;
  state.hoveredLinkId = null;
  state.hoveredPin = null;
  state.isDirty = false;
}
