/**
 * State Machine Parser
 *
 * Serialization and deserialization of animation state machines to/from JSON.
 */

import type {
  AnimationStateMachine,
  AnimationState,
  AnimationTransition,
  AnimationParameter,
  TransitionCondition,
  ParameterType,
  ConditionOperator,
  ParameterValue,
  StateNodePosition,
} from './state-machine-types.js';
import { generateId } from './state-machine-types.js';

// ============================================================================
// JSON Schema Types
// ============================================================================

interface StateMachineJson {
  id?: string;
  name: string;
  states: StateJson[];
  transitions: TransitionJson[];
  parameters: ParameterJson[];
  defaultStateId: string;
  nodePositions?: Record<string, { x: number; y: number }>;
}

interface StateJson {
  id?: string;
  name: string;
  animationClipId: string;
  speed?: number;
  isDefault?: boolean;
}

interface TransitionJson {
  id?: string;
  fromStateId: string;
  toStateId: string;
  conditions?: ConditionJson[];
  exitTime?: number;
  canBeInterrupted?: boolean;
  blendDuration?: number;
  priority?: number;
}

interface ConditionJson {
  parameterName: string;
  operator: string;
  value: boolean | number;
}

interface ParameterJson {
  name: string;
  type: string;
  defaultValue: boolean | number;
}

// ============================================================================
// Parsing
// ============================================================================

/**
 * Parse a state machine from JSON string
 */
export function parseStateMachine(jsonString: string): AnimationStateMachine {
  const json = JSON.parse(jsonString) as StateMachineJson;
  return parseStateMachineJson(json);
}

/**
 * Parse a state machine from a JSON object
 */
export function parseStateMachineJson(json: StateMachineJson): AnimationStateMachine {
  const parameters = (json.parameters ?? []).map(parseParameterJson);
  const states = (json.states ?? []).map(parseStateJson);
  const transitions = (json.transitions ?? []).map(parseTransitionJson);

  // Parse node positions
  const nodePositions: Record<string, StateNodePosition> = {};
  if (json.nodePositions) {
    for (const [stateId, pos] of Object.entries(json.nodePositions)) {
      nodePositions[stateId] = { x: pos.x, y: pos.y };
    }
  }

  return {
    id: json.id || generateId(),
    name: json.name || 'Untitled State Machine',
    states,
    transitions,
    parameters,
    defaultStateId: json.defaultStateId || '',
    nodePositions,
  };
}

function parseStateJson(json: StateJson): AnimationState {
  return {
    id: json.id || generateId(),
    name: json.name,
    animationClipId: json.animationClipId,
    speed: json.speed ?? 1.0,
    isDefault: json.isDefault ?? false,
  };
}

function parseTransitionJson(json: TransitionJson): AnimationTransition {
  return {
    id: json.id || generateId(),
    fromStateId: json.fromStateId,
    toStateId: json.toStateId,
    conditions: json.conditions?.map(parseConditionJson) ?? [],
    exitTime: json.exitTime,
    canBeInterrupted: json.canBeInterrupted ?? true,
    blendDuration: json.blendDuration ?? 0,
    priority: json.priority ?? 0,
  };
}

function parseConditionJson(json: ConditionJson): TransitionCondition {
  return {
    parameterName: json.parameterName,
    operator: parseOperator(json.operator),
    value: json.value,
  };
}

function parseParameterJson(json: ParameterJson): AnimationParameter {
  return {
    name: json.name,
    type: parseParameterType(json.type),
    defaultValue: json.defaultValue,
  };
}

function parseParameterType(type: string): ParameterType {
  switch (type.toLowerCase()) {
    case 'bool':
    case 'boolean':
      return 'bool';
    case 'int':
    case 'integer':
      return 'int';
    case 'float':
    case 'number':
      return 'float';
    case 'trigger':
      return 'trigger';
    default:
      console.warn(`Unknown parameter type: ${type}, defaulting to float`);
      return 'float';
  }
}

function parseOperator(operator: string): ConditionOperator {
  switch (operator.toLowerCase()) {
    case 'equals':
    case '==':
    case '=':
      return 'equals';
    case 'notequals':
    case '!=':
    case '<>':
      return 'notEquals';
    case 'greater':
    case '>':
      return 'greater';
    case 'less':
    case '<':
      return 'less';
    case 'greaterorequal':
    case '>=':
      return 'greaterOrEqual';
    case 'lessorequal':
    case '<=':
      return 'lessOrEqual';
    default:
      console.warn(`Unknown operator: ${operator}, defaulting to equals`);
      return 'equals';
  }
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize a state machine to JSON string
 */
export function serializeStateMachine(
  stateMachine: AnimationStateMachine,
  pretty = true,
): string {
  const json = serializeStateMachineToJson(stateMachine);
  return pretty ? JSON.stringify(json, null, 2) : JSON.stringify(json);
}

/**
 * Serialize a state machine to a JSON object
 */
export function serializeStateMachineToJson(
  stateMachine: AnimationStateMachine,
): StateMachineJson {
  return {
    id: stateMachine.id,
    name: stateMachine.name,
    states: stateMachine.states.map(serializeStateToJson),
    transitions: stateMachine.transitions.map(serializeTransitionToJson),
    parameters: stateMachine.parameters.map(serializeParameterToJson),
    defaultStateId: stateMachine.defaultStateId,
    nodePositions: stateMachine.nodePositions,
  };
}

function serializeStateToJson(state: AnimationState): StateJson {
  const json: StateJson = {
    id: state.id,
    name: state.name,
    animationClipId: state.animationClipId,
  };

  // Only include non-default values
  if (state.speed !== 1.0) {
    json.speed = state.speed;
  }
  if (state.isDefault) {
    json.isDefault = true;
  }

  return json;
}

function serializeTransitionToJson(transition: AnimationTransition): TransitionJson {
  const json: TransitionJson = {
    id: transition.id,
    fromStateId: transition.fromStateId,
    toStateId: transition.toStateId,
  };

  // Only include non-default values
  if (transition.conditions.length > 0) {
    json.conditions = transition.conditions.map(serializeConditionToJson);
  }
  if (transition.exitTime !== undefined) {
    json.exitTime = transition.exitTime;
  }
  if (transition.canBeInterrupted === false) {
    json.canBeInterrupted = false;
  }
  if (transition.blendDuration && transition.blendDuration > 0) {
    json.blendDuration = transition.blendDuration;
  }
  if (transition.priority && transition.priority !== 0) {
    json.priority = transition.priority;
  }

  return json;
}

function serializeConditionToJson(condition: TransitionCondition): ConditionJson {
  return {
    parameterName: condition.parameterName,
    operator: condition.operator,
    value: condition.value,
  };
}

function serializeParameterToJson(param: AnimationParameter): ParameterJson {
  return {
    name: param.name,
    type: param.type,
    defaultValue: param.defaultValue,
  };
}

// ============================================================================
// Validation
// ============================================================================

export interface ValidationError {
  type: 'error' | 'warning';
  message: string;
  path?: string;
}

/**
 * Validate a state machine for common issues
 */
export function validateStateMachine(
  stateMachine: AnimationStateMachine,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for empty state machine
  if (stateMachine.states.length === 0) {
    errors.push({
      type: 'error',
      message: 'State machine has no states',
    });
  }

  // Check for valid default state
  if (stateMachine.defaultStateId) {
    const defaultState = stateMachine.states.find(
      (s) => s.id === stateMachine.defaultStateId,
    );
    if (!defaultState) {
      errors.push({
        type: 'error',
        message: `Default state '${stateMachine.defaultStateId}' not found`,
        path: 'defaultStateId',
      });
    }
  } else if (stateMachine.states.length > 0) {
    errors.push({
      type: 'warning',
      message: 'No default state specified',
      path: 'defaultStateId',
    });
  }

  // Check for duplicate state IDs
  const stateIds = new Set<string>();
  for (const state of stateMachine.states) {
    if (stateIds.has(state.id)) {
      errors.push({
        type: 'error',
        message: `Duplicate state ID: ${state.id}`,
        path: `states.${state.id}`,
      });
    }
    stateIds.add(state.id);
  }

  // Check for duplicate parameter names
  const paramNames = new Set<string>();
  for (const param of stateMachine.parameters) {
    if (paramNames.has(param.name)) {
      errors.push({
        type: 'error',
        message: `Duplicate parameter name: ${param.name}`,
        path: `parameters.${param.name}`,
      });
    }
    paramNames.add(param.name);
  }

  // Validate transitions
  for (const transition of stateMachine.transitions) {
    // Check source state exists (or is wildcard)
    if (transition.fromStateId !== '*' && !stateIds.has(transition.fromStateId)) {
      errors.push({
        type: 'error',
        message: `Transition from unknown state: ${transition.fromStateId}`,
        path: `transitions.${transition.id}.fromStateId`,
      });
    }

    // Check target state exists
    if (!stateIds.has(transition.toStateId)) {
      errors.push({
        type: 'error',
        message: `Transition to unknown state: ${transition.toStateId}`,
        path: `transitions.${transition.id}.toStateId`,
      });
    }

    // Validate conditions
    for (const condition of transition.conditions) {
      if (!paramNames.has(condition.parameterName)) {
        errors.push({
          type: 'error',
          message: `Condition references unknown parameter: ${condition.parameterName}`,
          path: `transitions.${transition.id}.conditions`,
        });
      }
    }

    // Validate exit time
    if (transition.exitTime !== undefined) {
      if (transition.exitTime < 0 || transition.exitTime > 1) {
        errors.push({
          type: 'warning',
          message: `Exit time should be between 0 and 1, got: ${transition.exitTime}`,
          path: `transitions.${transition.id}.exitTime`,
        });
      }
    }
  }

  // Check for unreachable states
  const reachableStates = new Set<string>();
  if (stateMachine.defaultStateId) {
    reachableStates.add(stateMachine.defaultStateId);
  }

  // Add all states reachable from the default state
  let changed = true;
  while (changed) {
    changed = false;
    for (const transition of stateMachine.transitions) {
      if (
        transition.fromStateId === '*' ||
        reachableStates.has(transition.fromStateId)
      ) {
        if (!reachableStates.has(transition.toStateId)) {
          reachableStates.add(transition.toStateId);
          changed = true;
        }
      }
    }
  }

  for (const state of stateMachine.states) {
    if (!reachableStates.has(state.id)) {
      errors.push({
        type: 'warning',
        message: `State '${state.name}' may be unreachable`,
        path: `states.${state.id}`,
      });
    }
  }

  return errors;
}
