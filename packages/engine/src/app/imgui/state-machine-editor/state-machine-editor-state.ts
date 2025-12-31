/**
 * State Machine Editor State
 *
 * Manages the state for the animation state machine editor window.
 * Tracks the current state machine being edited, selection, and UI state.
 */

import type {
  AnimationStateMachine,
  AnimationState,
  AnimationTransition,
  AnimationParameter,
  ParameterType,
} from '../../../animation/state-machine/index.js';
import {
  type NodeEditorState,
  createNodeEditorState,
  addNode,
  removeNode,
  addNodeLink,
  removeLink,
  moveNode,
  type NodeEditorConfig,
} from '../node-editor/index.js';
import type { Entity } from '../../../ecs/entity.js';

// ============================================================================
// Special Node IDs
// ============================================================================

export const ENTRY_NODE_ID = '__entry__';
export const ANY_STATE_NODE_ID = '__any_state__';
export const EXIT_NODE_ID = '__exit__';

// Special node colors
const ENTRY_NODE_COLOR = { r: 0.2, g: 0.6, b: 0.2, a: 1 }; // Green
const ANY_STATE_NODE_COLOR = { r: 0.5, g: 0.7, b: 0.9, a: 1 }; // Light blue
const EXIT_NODE_COLOR = { r: 0.7, g: 0.3, b: 0.3, a: 1 }; // Red

/**
 * Check if a node ID is a special pseudo-node
 */
export function isSpecialNode(nodeId: string): boolean {
  return nodeId === ENTRY_NODE_ID || nodeId === ANY_STATE_NODE_ID || nodeId === EXIT_NODE_ID;
}

// ============================================================================
// Types
// ============================================================================

/**
 * Editor state for the state machine editor
 */
export interface StateMachineEditorState {
  /** Whether the editor window is open */
  isOpen: boolean;

  /** Selected entity with AnimationController (required before editing) */
  selectedEntity: Entity | null;

  /** Current state machine being edited */
  stateMachine: AnimationStateMachine | null;

  /** Path to the current file (for save) */
  currentFilePath: string | null;

  /** Asset GUID for manifest registration */
  assetGuid: string | null;

  /** Whether there are unsaved changes */
  isDirty: boolean;

  /** Node editor state for the graph visualization */
  nodeEditor: NodeEditorState;

  /** Currently selected state ID */
  selectedStateId: string | null;

  /** Currently selected transition ID */
  selectedTransitionId: string | null;

  /** Currently selected parameter name */
  selectedParameterName: string | null;

  /** Zoom level for the graph */
  zoom: number;

  /** Scroll offset for the graph */
  scrollOffset: { x: number; y: number };
}

// ============================================================================
// Singleton State
// ============================================================================

const DEFAULT_NODE_CONFIG: Partial<NodeEditorConfig> = {
  nodeWidth: 180,
  nodeHeaderHeight: 28,
  pinRadius: 8,
  gridSize: 20,
  canvasSize: { width: 4000, height: 3000 },
  // Enable pin-less mode for animation state machines
  // This allows bidirectional transitions (A→B and B→A)
  pinLessMode: true,
};

let editorState: StateMachineEditorState | null = null;

/**
 * Flag to prevent callback recursion during sync operations.
 * When true, onLinkCreated callbacks are ignored.
 */
let isSyncing = false;

/**
 * Get or create the editor state
 */
export function getStateMachineEditorState(): StateMachineEditorState {
  if (!editorState) {
    editorState = {
      isOpen: false,
      selectedEntity: null,
      stateMachine: null,
      currentFilePath: null,
      assetGuid: null,
      isDirty: false,
      nodeEditor: createNodeEditorState(
        'state-machine-editor',
        DEFAULT_NODE_CONFIG,
        {
          onNodeMoved: (nodeId, position) => {
            // Update state machine node positions when dragged (including special nodes)
            if (editorState?.stateMachine) {
              if (!editorState.stateMachine.nodePositions) {
                editorState.stateMachine.nodePositions = {};
              }
              editorState.stateMachine.nodePositions[nodeId] = position;
              markDirty();
            }
          },
          onLinkCreated: (sourceNodeId, sourcePinId, targetNodeId, targetPinId) => {
            // Skip if we're syncing (to prevent infinite recursion)
            if (isSyncing) return;

            // Create transition when link is created
            if (editorState?.stateMachine) {
              // Handle Entry node - set target as default state
              if (sourceNodeId === ENTRY_NODE_ID) {
                setDefaultState(targetNodeId);
                // Don't sync here - the link is already created by user action
                return;
              }
              // Handle Any State node - create transition with fromStateId = '*'
              if (sourceNodeId === ANY_STATE_NODE_ID) {
                createTransitionFromAnyStateNoSync(targetNodeId);
                return;
              }
              // Regular transition - don't call addLink again since it was just created
              createTransitionNoSync(sourceNodeId, targetNodeId);
            }
          },
          onNodesDeleted: (nodeIds) => {
            if (editorState?.stateMachine) {
              for (const nodeId of nodeIds) {
                // Skip special nodes
                if (!isSpecialNode(nodeId)) {
                  deleteState(nodeId);
                }
              }
            }
          },
          onLinkDeleted: (linkId) => {
            // Skip if we're syncing (to prevent infinite recursion)
            if (isSyncing) return;

            if (editorState?.stateMachine) {
              // Skip entry link deletion
              if (linkId === '__entry_link__') {
                return;
              }
              // Use no-sync version since the link is already deleted
              deleteTransitionNoSync(linkId);
            }
          },
        },
      ),
      selectedStateId: null,
      selectedTransitionId: null,
      selectedParameterName: null,
      zoom: 1,
      scrollOffset: { x: 0, y: 0 },
    };
  }
  return editorState;
}

/**
 * Check if the editor is open
 */
export function isStateMachineEditorOpen(): boolean {
  return editorState?.isOpen ?? false;
}

/**
 * Open the state machine editor
 */
export function openStateMachineEditor(): void {
  const state = getStateMachineEditorState();
  state.isOpen = true;
}

/**
 * Close the state machine editor
 */
export function closeStateMachineEditor(): void {
  if (editorState) {
    editorState.isOpen = false;
  }
}

/**
 * Mark the state machine as having unsaved changes
 */
export function markDirty(): void {
  if (editorState) {
    editorState.isDirty = true;
  }
}

/**
 * Mark the state machine as clean (saved)
 */
export function markClean(): void {
  if (editorState) {
    editorState.isDirty = false;
  }
}

// ============================================================================
// Entity Selection
// ============================================================================

/**
 * Select an entity for state machine editing.
 * The entity must have an AnimationController component.
 */
export function selectEntity(entity: Entity | null): void {
  const state = getStateMachineEditorState();
  state.selectedEntity = entity;
}

/**
 * Get the currently selected entity
 */
export function getSelectedEntity(): Entity | null {
  return editorState?.selectedEntity ?? null;
}

// ============================================================================
// State Machine Management
// ============================================================================

/**
 * Create a new empty state machine
 */
export function createNewStateMachine(): void {
  const state = getStateMachineEditorState();

  // Generate unique ID
  const id = `sm_${Date.now()}`;

  state.stateMachine = {
    id,
    name: 'New State Machine',
    states: [],
    transitions: [],
    parameters: [],
    defaultStateId: '',
    nodePositions: {},
  };

  state.currentFilePath = null;
  state.isDirty = false;
  state.selectedStateId = null;
  state.selectedTransitionId = null;
  state.selectedParameterName = null;

  // Clear node editor
  syncStateMachineToNodeEditor();
}

/**
 * Load a state machine from JSON data
 */
export function loadStateMachine(data: AnimationStateMachine, filePath?: string): void {
  const state = getStateMachineEditorState();

  state.stateMachine = data;
  state.currentFilePath = filePath ?? null;
  state.isDirty = false;
  state.selectedStateId = null;
  state.selectedTransitionId = null;
  state.selectedParameterName = null;

  // Sync to node editor
  syncStateMachineToNodeEditor();
}

/**
 * Get the current state machine
 */
export function getCurrentStateMachine(): AnimationStateMachine | null {
  return editorState?.stateMachine ?? null;
}

/**
 * Get the current file path
 */
export function getCurrentFilePath(): string | null {
  return editorState?.currentFilePath ?? null;
}

/**
 * Set the current file path
 */
export function setCurrentFilePath(path: string): void {
  if (editorState) {
    editorState.currentFilePath = path;
  }
}

/**
 * Get the current asset GUID
 */
export function getAssetGuid(): string | null {
  return editorState?.assetGuid ?? null;
}

/**
 * Set the current asset GUID
 */
export function setAssetGuid(guid: string | null): void {
  if (editorState) {
    editorState.assetGuid = guid;
  }
}

// ============================================================================
// State Management
// ============================================================================

/**
 * Add a new state to the state machine
 */
export function addState(name: string, position: { x: number; y: number }): AnimationState | null {
  const state = getStateMachineEditorState();
  if (!state.stateMachine) return null;

  const newState: AnimationState = {
    id: `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    animationClipId: '',
    speed: 1,
  };

  state.stateMachine.states.push(newState);

  // Store position
  if (!state.stateMachine.nodePositions) {
    state.stateMachine.nodePositions = {};
  }
  state.stateMachine.nodePositions[newState.id] = position;

  // If this is the first state, make it the default
  if (state.stateMachine.states.length === 1) {
    state.stateMachine.defaultStateId = newState.id;
  }

  // Add to node editor (pin-less mode - no visible pins)
  addNode(state.nodeEditor, {
    id: newState.id,
    position,
    title: name,
    inputs: [],
    outputs: [],
    userData: newState,
  });

  markDirty();
  return newState;
}

/**
 * Delete a state from the state machine
 */
export function deleteState(stateId: string): void {
  const state = getStateMachineEditorState();
  if (!state.stateMachine) return;

  // Remove the state
  state.stateMachine.states = state.stateMachine.states.filter(s => s.id !== stateId);

  // Remove all transitions involving this state
  state.stateMachine.transitions = state.stateMachine.transitions.filter(
    t => t.fromStateId !== stateId && t.toStateId !== stateId,
  );

  // Remove position
  if (state.stateMachine.nodePositions) {
    delete state.stateMachine.nodePositions[stateId];
  }

  // Update default state if needed
  if (state.stateMachine.defaultStateId === stateId) {
    state.stateMachine.defaultStateId = state.stateMachine.states[0]?.id ?? '';
  }

  // Clear selection if this was selected
  if (state.selectedStateId === stateId) {
    state.selectedStateId = null;
  }

  // Remove from node editor
  removeNode(state.nodeEditor, stateId);

  markDirty();
}

/**
 * Update a state's properties
 */
export function updateState(stateId: string, updates: Partial<AnimationState>): void {
  const state = getStateMachineEditorState();
  if (!state.stateMachine) return;

  const stateToUpdate = state.stateMachine.states.find(s => s.id === stateId);
  if (stateToUpdate) {
    Object.assign(stateToUpdate, updates);

    // Update node title if name changed
    if (updates.name) {
      const node = state.nodeEditor.nodes.get(stateId);
      if (node) {
        node.title = updates.name;
      }
    }

    markDirty();
  }
}

/**
 * Set the default state
 */
export function setDefaultState(stateId: string): void {
  const state = getStateMachineEditorState();
  if (!state.stateMachine) return;

  const stateExists = state.stateMachine.states.some(s => s.id === stateId);
  if (stateExists) {
    state.stateMachine.defaultStateId = stateId;
    markDirty();
  }
}

/**
 * Select a state
 */
export function selectState(stateId: string | null): void {
  const state = getStateMachineEditorState();
  state.selectedStateId = stateId;
  state.selectedTransitionId = null; // Clear transition selection
  state.selectedParameterName = null; // Clear parameter selection
}

/**
 * Get the selected state
 */
export function getSelectedState(): AnimationState | null {
  const state = getStateMachineEditorState();
  if (!state.stateMachine || !state.selectedStateId) return null;
  return state.stateMachine.states.find(s => s.id === state.selectedStateId) ?? null;
}

// ============================================================================
// Transition Management
// ============================================================================

/**
 * Create a transition between two states
 */
export function createTransition(fromStateId: string, toStateId: string): AnimationTransition | null {
  const state = getStateMachineEditorState();
  if (!state.stateMachine) return null;

  // Check if states exist
  const fromState = state.stateMachine.states.find(s => s.id === fromStateId);
  const toState = state.stateMachine.states.find(s => s.id === toStateId);
  if (!fromState || !toState) return null;

  // Check if transition already exists
  const exists = state.stateMachine.transitions.some(
    t => t.fromStateId === fromStateId && t.toStateId === toStateId,
  );
  if (exists) return null;

  const newTransition: AnimationTransition = {
    id: `transition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fromStateId,
    toStateId,
    conditions: [],
  };

  state.stateMachine.transitions.push(newTransition);

  // Add link to node editor (pin-less mode - node-to-node connection)
  addNodeLink(state.nodeEditor, fromStateId, toStateId, newTransition.id);

  markDirty();
  return newTransition;
}

/**
 * Create a transition between two states without adding to node editor.
 * Used when the link is already created by user drag action.
 */
function createTransitionNoSync(fromStateId: string, toStateId: string): AnimationTransition | null {
  const state = getStateMachineEditorState();
  if (!state.stateMachine) return null;

  // Check if states exist
  const fromState = state.stateMachine.states.find(s => s.id === fromStateId);
  const toState = state.stateMachine.states.find(s => s.id === toStateId);
  if (!fromState || !toState) return null;

  // Check if transition already exists
  const exists = state.stateMachine.transitions.some(
    t => t.fromStateId === fromStateId && t.toStateId === toStateId,
  );
  if (exists) return null;

  const newTransition: AnimationTransition = {
    id: `transition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fromStateId,
    toStateId,
    conditions: [],
  };

  state.stateMachine.transitions.push(newTransition);

  // Update the link ID that was just created to match the transition ID
  // The link was created by node-editor with a generated ID, we need to update it
  for (const [linkId, link] of state.nodeEditor.links) {
    if (
      link.sourceNodeId === fromStateId &&
      link.targetNodeId === toStateId &&
      !state.stateMachine.transitions.some(t => t.id === linkId && t.id !== newTransition.id)
    ) {
      // Found the newly created link, update its ID to match transition
      state.nodeEditor.links.delete(linkId);
      link.id = newTransition.id;
      state.nodeEditor.links.set(newTransition.id, link);

      // Update selection if this link was selected
      if (state.nodeEditor.selectedLinkIds.has(linkId)) {
        state.nodeEditor.selectedLinkIds.delete(linkId);
        state.nodeEditor.selectedLinkIds.add(newTransition.id);
      }
      break;
    }
  }

  markDirty();
  return newTransition;
}

/**
 * Delete a transition
 */
export function deleteTransition(transitionId: string): void {
  const state = getStateMachineEditorState();
  if (!state.stateMachine) return;

  state.stateMachine.transitions = state.stateMachine.transitions.filter(
    t => t.id !== transitionId,
  );

  if (state.selectedTransitionId === transitionId) {
    state.selectedTransitionId = null;
  }

  // Remove from node editor
  removeLink(state.nodeEditor, transitionId);

  markDirty();
}

/**
 * Delete a transition without removing from node editor.
 * Used when the link is already deleted by user action.
 */
function deleteTransitionNoSync(transitionId: string): void {
  const state = getStateMachineEditorState();
  if (!state.stateMachine) return;

  state.stateMachine.transitions = state.stateMachine.transitions.filter(
    t => t.id !== transitionId,
  );

  if (state.selectedTransitionId === transitionId) {
    state.selectedTransitionId = null;
  }

  // Don't remove from node editor - it's already deleted

  markDirty();
}

/**
 * Update a transition's properties
 */
export function updateTransition(transitionId: string, updates: Partial<AnimationTransition>): void {
  const state = getStateMachineEditorState();
  if (!state.stateMachine) return;

  const transition = state.stateMachine.transitions.find(t => t.id === transitionId);
  if (transition) {
    Object.assign(transition, updates);
    markDirty();
  }
}

/**
 * Select a transition
 */
export function selectTransition(transitionId: string | null): void {
  const state = getStateMachineEditorState();
  state.selectedTransitionId = transitionId;
  state.selectedStateId = null; // Clear state selection
  state.selectedParameterName = null; // Clear parameter selection
}

/**
 * Get the selected transition
 */
export function getSelectedTransition(): AnimationTransition | null {
  const state = getStateMachineEditorState();
  if (!state.stateMachine || !state.selectedTransitionId) return null;
  return state.stateMachine.transitions.find(t => t.id === state.selectedTransitionId) ?? null;
}

// ============================================================================
// Parameter Management
// ============================================================================

/**
 * Add a new parameter
 */
export function addParameter(name: string, type: ParameterType): AnimationParameter | null {
  const state = getStateMachineEditorState();
  if (!state.stateMachine) return null;

  // Check if parameter name already exists
  const exists = state.stateMachine.parameters.some(p => p.name === name);
  if (exists) return null;

  const defaultValue = type === 'bool' ? false : type === 'trigger' ? false : 0;

  const newParam: AnimationParameter = {
    name,
    type,
    defaultValue,
  };

  state.stateMachine.parameters.push(newParam);
  markDirty();
  return newParam;
}

/**
 * Delete a parameter
 */
export function deleteParameter(name: string): void {
  const state = getStateMachineEditorState();
  if (!state.stateMachine) return;

  state.stateMachine.parameters = state.stateMachine.parameters.filter(p => p.name !== name);

  // Also remove any conditions using this parameter
  for (const transition of state.stateMachine.transitions) {
    transition.conditions = transition.conditions.filter(c => c.parameterName !== name);
  }

  if (state.selectedParameterName === name) {
    state.selectedParameterName = null;
  }

  markDirty();
}

/**
 * Update a parameter
 */
export function updateParameter(name: string, updates: Partial<AnimationParameter>): void {
  const state = getStateMachineEditorState();
  if (!state.stateMachine) return;

  const param = state.stateMachine.parameters.find(p => p.name === name);
  if (param) {
    // If name is changing, update conditions too
    if (updates.name && updates.name !== name) {
      for (const transition of state.stateMachine.transitions) {
        for (const condition of transition.conditions) {
          if (condition.parameterName === name) {
            condition.parameterName = updates.name;
          }
        }
      }
    }

    Object.assign(param, updates);
    markDirty();
  }
}

/**
 * Select a parameter
 */
export function selectParameter(name: string | null): void {
  const state = getStateMachineEditorState();
  state.selectedParameterName = name;
  state.selectedStateId = null;
  state.selectedTransitionId = null;
}

/**
 * Get the selected parameter
 */
export function getSelectedParameter(): AnimationParameter | null {
  const state = getStateMachineEditorState();
  if (!state.stateMachine || !state.selectedParameterName) return null;
  return state.stateMachine.parameters.find(p => p.name === state.selectedParameterName) ?? null;
}

// ============================================================================
// Any State Transitions
// ============================================================================

/**
 * Create a transition from "Any State" to a target state
 */
export function createTransitionFromAnyState(toStateId: string): AnimationTransition | null {
  const state = getStateMachineEditorState();
  if (!state.stateMachine) return null;

  // Check if target state exists
  const toState = state.stateMachine.states.find(s => s.id === toStateId);
  if (!toState) return null;

  // Check if transition already exists
  const exists = state.stateMachine.transitions.some(
    t => t.fromStateId === '*' && t.toStateId === toStateId,
  );
  if (exists) return null;

  const newTransition: AnimationTransition = {
    id: `transition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fromStateId: '*', // Special "any state" marker
    toStateId,
    conditions: [],
  };

  state.stateMachine.transitions.push(newTransition);

  // Sync to node editor to show the new link
  syncStateMachineToNodeEditor();

  markDirty();
  return newTransition;
}

/**
 * Create a transition from "Any State" without syncing.
 * Used when the link is already created by user drag action.
 */
function createTransitionFromAnyStateNoSync(toStateId: string): AnimationTransition | null {
  const state = getStateMachineEditorState();
  if (!state.stateMachine) return null;

  // Check if target state exists
  const toState = state.stateMachine.states.find(s => s.id === toStateId);
  if (!toState) return null;

  // Check if transition already exists
  const exists = state.stateMachine.transitions.some(
    t => t.fromStateId === '*' && t.toStateId === toStateId,
  );
  if (exists) return null;

  const newTransition: AnimationTransition = {
    id: `transition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fromStateId: '*', // Special "any state" marker
    toStateId,
    conditions: [],
  };

  state.stateMachine.transitions.push(newTransition);

  // Update the link ID that was just created to match the transition ID
  for (const [linkId, link] of state.nodeEditor.links) {
    if (
      link.sourceNodeId === ANY_STATE_NODE_ID &&
      link.targetNodeId === toStateId &&
      !state.stateMachine.transitions.some(t => t.id === linkId && t.id !== newTransition.id)
    ) {
      // Found the newly created link, update its ID and color
      state.nodeEditor.links.delete(linkId);
      link.id = newTransition.id;
      link.color = ANY_STATE_NODE_COLOR;
      state.nodeEditor.links.set(newTransition.id, link);

      // Update selection if this link was selected
      if (state.nodeEditor.selectedLinkIds.has(linkId)) {
        state.nodeEditor.selectedLinkIds.delete(linkId);
        state.nodeEditor.selectedLinkIds.add(newTransition.id);
      }
      break;
    }
  }

  markDirty();
  return newTransition;
}

// ============================================================================
// Node Editor Synchronization
// ============================================================================

/**
 * Sync the state machine data to the node editor
 */
export function syncStateMachineToNodeEditor(): void {
  const state = getStateMachineEditorState();
  if (!state.stateMachine) return;

  // Set syncing flag to prevent callback recursion
  isSyncing = true;

  try {
    // Clear existing nodes and links
    state.nodeEditor.nodes.clear();
    state.nodeEditor.links.clear();
    state.nodeEditor.selectedNodeIds.clear();
    state.nodeEditor.selectedLinkIds.clear();

  // ===== Add Entry Node =====
  // Entry node is always at the top-left, represents the state machine entry point
  const entryPosition = state.stateMachine.nodePositions?.[ENTRY_NODE_ID] ?? { x: 50, y: 50 };
  addNode(state.nodeEditor, {
    id: ENTRY_NODE_ID,
    position: entryPosition,
    title: 'Entry',
    color: ENTRY_NODE_COLOR,
    inputs: [],
    outputs: [],
    userData: { isSpecial: true, type: 'entry' },
  });

  // ===== Add Any State Node =====
  // Any State can transition to any other state
  const anyStatePosition = state.stateMachine.nodePositions?.[ANY_STATE_NODE_ID] ?? { x: 50, y: 150 };
  addNode(state.nodeEditor, {
    id: ANY_STATE_NODE_ID,
    position: anyStatePosition,
    title: 'Any State',
    color: ANY_STATE_NODE_COLOR,
    inputs: [],
    outputs: [],
    userData: { isSpecial: true, type: 'anyState' },
  });

  // ===== Add Exit Node =====
  // Exit node represents leaving the state machine
  const exitPosition = state.stateMachine.nodePositions?.[EXIT_NODE_ID] ?? { x: 50, y: 250 };
  addNode(state.nodeEditor, {
    id: EXIT_NODE_ID,
    position: exitPosition,
    title: 'Exit',
    color: EXIT_NODE_COLOR,
    inputs: [],
    outputs: [],
    userData: { isSpecial: true, type: 'exit' },
  });

  // ===== Add State Nodes =====
  for (const animState of state.stateMachine.states) {
    const position = state.stateMachine.nodePositions?.[animState.id] ?? { x: 300, y: 100 };

    addNode(state.nodeEditor, {
      id: animState.id,
      position,
      title: animState.name,
      inputs: [],
      outputs: [],
      userData: animState,
    });

    // Mark default state with different color (orange tint)
    const node = state.nodeEditor.nodes.get(animState.id);
    if (node && animState.id === state.stateMachine.defaultStateId) {
      node.color = { r: 0.8, g: 0.5, b: 0.2, a: 1 }; // Orange for default state
    }
  }

  // ===== Add Entry -> Default State Link =====
  if (state.stateMachine.defaultStateId) {
    const entryLink = addNodeLink(
      state.nodeEditor,
      ENTRY_NODE_ID,
      state.stateMachine.defaultStateId,
      '__entry_link__',
    );
    // Color the entry link green
    if (entryLink) {
      entryLink.color = ENTRY_NODE_COLOR;
    }
  }

  // ===== Add Transition Links =====
  for (const transition of state.stateMachine.transitions) {
    // Handle "Any State" transitions (fromStateId === '*')
    if (transition.fromStateId === '*') {
      const link = addNodeLink(
        state.nodeEditor,
        ANY_STATE_NODE_ID,
        transition.toStateId,
        transition.id,
      );
      // Color any state transitions light blue
      if (link) {
        link.color = ANY_STATE_NODE_COLOR;
      }
    } else {
      addNodeLink(
        state.nodeEditor,
        transition.fromStateId,
        transition.toStateId,
        transition.id,
      );
    }
  }
  } finally {
    // Always reset syncing flag
    isSyncing = false;
  }
}

/**
 * Update node position in state machine when dragged
 */
export function updateStatePosition(stateId: string, position: { x: number; y: number }): void {
  const state = getStateMachineEditorState();
  if (!state.stateMachine) return;

  if (!state.stateMachine.nodePositions) {
    state.stateMachine.nodePositions = {};
  }

  state.stateMachine.nodePositions[stateId] = position;

  // Update node editor
  moveNode(state.nodeEditor, stateId, position);

  markDirty();
}
