/**
 * Node Editor Types
 *
 * Core interfaces for the generic node editor framework.
 * This framework can be used for animation state machines, shader editors, etc.
 */

// ============================================================================
// Position and Size Types
// ============================================================================

export interface Vec2 {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================================
// Pin Types
// ============================================================================

export type PinKind = 'input' | 'output';

/**
 * Pin type for connection validation.
 * Pins can only connect if their types are compatible.
 */
export type PinType = 'flow' | 'bool' | 'int' | 'float' | 'string' | 'any';

export interface PinDefinition {
  /** Unique pin ID within the node */
  id: string;
  /** Display name */
  name: string;
  /** Input or output */
  kind: PinKind;
  /** Type for connection validation */
  type: PinType;
  /** Whether multiple connections are allowed (for inputs) */
  allowMultiple?: boolean;
}

/**
 * Runtime pin state with computed position
 */
export interface PinState extends PinDefinition {
  /** Parent node ID */
  nodeId: string;
  /** Computed center position in canvas space */
  position: Vec2;
  /** Whether this pin is currently hovered */
  isHovered: boolean;
}

// ============================================================================
// Node Types
// ============================================================================

export interface NodeDefinition {
  /** Unique node ID */
  id: string;
  /** Position in canvas space */
  position: Vec2;
  /** Display title */
  title: string;
  /** Node color (header) */
  color?: { r: number; g: number; b: number; a: number };
  /** Input pins */
  inputs: PinDefinition[];
  /** Output pins */
  outputs: PinDefinition[];
  /** Node-specific data (state machine state, shader node params, etc.) */
  userData?: unknown;
}

/**
 * Runtime node state with computed size and pin positions
 */
export interface NodeState extends Omit<NodeDefinition, 'inputs' | 'outputs'> {
  /** Computed size based on content */
  size: Size;
  /** Runtime pin states with positions */
  inputPins: PinState[];
  /** Runtime pin states with positions */
  outputPins: PinState[];
  /** Whether this node is selected */
  isSelected: boolean;
  /** Whether this node is being dragged */
  isDragging: boolean;
}

// ============================================================================
// Link Types
// ============================================================================

export interface LinkDefinition {
  /** Unique link ID */
  id: string;
  /** Source node ID */
  sourceNodeId: string;
  /** Source pin ID */
  sourcePinId: string;
  /** Target node ID */
  targetNodeId: string;
  /** Target pin ID */
  targetPinId: string;
  /** Link color override */
  color?: { r: number; g: number; b: number; a: number };
}

/**
 * Runtime link state with computed positions
 */
export interface LinkState extends LinkDefinition {
  /** Source pin position in canvas space */
  sourcePosition: Vec2;
  /** Target pin position in canvas space */
  targetPosition: Vec2;
  /** Whether this link is selected */
  isSelected: boolean;
  /** Whether this link is being hovered */
  isHovered: boolean;
}

// ============================================================================
// Interaction Types
// ============================================================================

export type InteractionMode =
  | 'idle'
  | 'dragging-node'
  | 'creating-link'
  | 'box-selecting'
  | 'panning';

export interface DragState {
  /** Node ID being dragged */
  nodeId: string;
  /** Starting position of the drag */
  startPosition: Vec2;
  /** Offset from node position to mouse position */
  offset: Vec2;
}

export interface LinkCreationState {
  /** Source pin being dragged from (pin mode) */
  sourcePin: PinState;
  /** Current mouse position in canvas space */
  currentPosition: Vec2;
  /** Whether the link can connect (valid target hovered) */
  canConnect: boolean;
  /** Target pin if hovering over a valid target (pin mode) */
  targetPin?: PinState;
}

/**
 * State for creating a link in pin-less mode.
 * In this mode, links connect from node to node directly.
 */
export interface NodeLinkCreationState {
  /** Source node ID */
  sourceNodeId: string;
  /** Current mouse position in canvas space */
  currentPosition: Vec2;
  /** Whether the link can connect (valid target node hovered) */
  canConnect: boolean;
  /** Target node ID if hovering over a valid target */
  targetNodeId?: string;
}

export interface BoxSelectState {
  /** Starting corner of selection box */
  startPosition: Vec2;
  /** Current corner of selection box */
  currentPosition: Vec2;
}

// ============================================================================
// Editor Configuration
// ============================================================================

export interface NodeEditorConfig {
  /** Fixed node width */
  nodeWidth: number;
  /** Node header height */
  nodeHeaderHeight: number;
  /** Height per pin row */
  pinRowHeight: number;
  /** Pin circle radius */
  pinRadius: number;
  /** Grid cell size for snapping (0 = no snapping) */
  gridSize: number;
  /** Canvas virtual size */
  canvasSize: Size;
  /** Whether to show grid */
  showGrid: boolean;
  /** Grid line color */
  gridColor: { r: number; g: number; b: number; a: number };
  /** Background color */
  backgroundColor: { r: number; g: number; b: number; a: number };
  /** Default node color */
  defaultNodeColor: { r: number; g: number; b: number; a: number };
  /** Selected node highlight color */
  selectionColor: { r: number; g: number; b: number; a: number };
  /** Link color */
  linkColor: { r: number; g: number; b: number; a: number };
  /** Link color when creating */
  linkCreationColor: { r: number; g: number; b: number; a: number };
  /** Pin colors by type */
  pinColors: Record<PinType, { r: number; g: number; b: number; a: number }>;
  /**
   * Pin-less mode: hide pins and allow node-to-node connections.
   * Used for animation state machines where transitions go from node to node,
   * not from specific pins. When enabled:
   * - Pins are not rendered
   * - Clicking/dragging on node body initiates link creation
   * - Links connect to node edges (computed dynamically)
   * - Multiple links between same two nodes are allowed (bidirectional)
   */
  pinLessMode: boolean;
}

export const DEFAULT_NODE_EDITOR_CONFIG: NodeEditorConfig = {
  nodeWidth: 180,
  nodeHeaderHeight: 28,
  pinRowHeight: 24,
  pinRadius: 6,
  gridSize: 20,
  canvasSize: { width: 4000, height: 3000 },
  showGrid: true,
  gridColor: { r: 0.2, g: 0.2, b: 0.2, a: 1.0 },
  backgroundColor: { r: 0.12, g: 0.12, b: 0.14, a: 1.0 },
  defaultNodeColor: { r: 0.25, g: 0.45, b: 0.65, a: 1.0 },
  selectionColor: { r: 0.9, g: 0.6, b: 0.2, a: 1.0 },
  linkColor: { r: 0.7, g: 0.7, b: 0.7, a: 1.0 },
  linkCreationColor: { r: 0.5, g: 0.8, b: 0.5, a: 1.0 },
  pinColors: {
    flow: { r: 0.9, g: 0.9, b: 0.9, a: 1.0 },
    bool: { r: 0.8, g: 0.2, b: 0.2, a: 1.0 },
    int: { r: 0.2, g: 0.6, b: 0.8, a: 1.0 },
    float: { r: 0.2, g: 0.8, b: 0.4, a: 1.0 },
    string: { r: 0.8, g: 0.5, b: 0.8, a: 1.0 },
    any: { r: 0.6, g: 0.6, b: 0.6, a: 1.0 },
  },
  pinLessMode: false,
};

// ============================================================================
// Editor Callbacks
// ============================================================================

export interface NodeEditorCallbacks {
  /** Called when a node is selected/deselected */
  onNodeSelectionChanged?: (nodeIds: string[]) => void;
  /** Called when a link is selected/deselected */
  onLinkSelectionChanged?: (linkIds: string[]) => void;
  /** Called when a node is moved */
  onNodeMoved?: (nodeId: string, newPosition: Vec2) => void;
  /** Called when a link is created */
  onLinkCreated?: (
    sourceNodeId: string,
    sourcePinId: string,
    targetNodeId: string,
    targetPinId: string,
  ) => void;
  /** Called when a link is deleted */
  onLinkDeleted?: (linkId: string) => void;
  /** Called when nodes are deleted */
  onNodesDeleted?: (nodeIds: string[]) => void;
  /** Called to validate if a connection can be made */
  canCreateLink?: (
    sourcePin: PinState,
    targetPin: PinState,
  ) => boolean;
  /** Called when user double-clicks on canvas (for creating new nodes) */
  onCanvasDoubleClick?: (position: Vec2) => void;
  /** Called when user right-clicks on canvas */
  onCanvasContextMenu?: (position: Vec2) => void;
  /** Called when user right-clicks on a node */
  onNodeContextMenu?: (nodeId: string, position: Vec2) => void;
  /** Called when user right-clicks on a link */
  onLinkContextMenu?: (linkId: string, position: Vec2) => void;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isPinCompatible(source: PinState, target: PinState): boolean {
  // Can't connect to self
  if (source.nodeId === target.nodeId) return false;

  // Must be output -> input
  if (source.kind !== 'output' || target.kind !== 'input') return false;

  // Check type compatibility
  if (source.type === 'any' || target.type === 'any') return true;
  if (source.type === target.type) return true;

  // Number type compatibility
  if (
    (source.type === 'int' || source.type === 'float') &&
    (target.type === 'int' || target.type === 'float')
  ) {
    return true;
  }

  return false;
}

// ============================================================================
// Utility Functions
// ============================================================================

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function vec2Add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vec2Sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vec2Scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function vec2Distance(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function vec2Lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

export function rectContains(rect: Rect, point: Vec2): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}
