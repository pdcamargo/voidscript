/**
 * State Machine Editor
 *
 * Visual editor for animation state machines.
 * Uses the generic node editor framework for graph visualization.
 */

// Re-export main window
export { renderStateMachineEditorWindow } from './state-machine-editor-window.js';

// Re-export state management
export {
  getStateMachineEditorState,
  isStateMachineEditorOpen,
  openStateMachineEditor,
  closeStateMachineEditor,
  createNewStateMachine,
  loadStateMachine,
  getCurrentStateMachine,
  getCurrentFilePath,
  setCurrentFilePath,
  markDirty,
  markClean,
  addState,
  deleteState,
  updateState,
  setDefaultState,
  selectState,
  getSelectedState,
  createTransition,
  deleteTransition,
  updateTransition,
  selectTransition,
  getSelectedTransition,
  addParameter,
  deleteParameter,
  updateParameter,
  selectParameter,
  getSelectedParameter,
  syncStateMachineToNodeEditor,
} from './state-machine-editor-state.js';

// Re-export types
export type {
  StateMachineEditorState,
} from './state-machine-editor-state.js';
