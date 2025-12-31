/**
 * Animation State Machine Types
 *
 * Core types for the animation state machine system.
 * Inspired by Unity's Animator Controller.
 */

// ============================================================================
// Parameter Types
// ============================================================================

/**
 * Types of parameters that can drive transitions
 */
export type ParameterType = 'bool' | 'int' | 'float' | 'trigger';

/**
 * Parameter value union type
 */
export type ParameterValue = boolean | number;

/**
 * An animation parameter definition
 */
export interface AnimationParameter {
  /** Parameter name (must be unique within the state machine) */
  name: string;
  /** Parameter type */
  type: ParameterType;
  /** Default value when the state machine starts */
  defaultValue: ParameterValue;
}

// ============================================================================
// Condition Types
// ============================================================================

/**
 * Operators for comparing parameter values
 */
export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'greater'
  | 'less'
  | 'greaterOrEqual'
  | 'lessOrEqual';

/**
 * A condition that must be met for a transition to fire
 */
export interface TransitionCondition {
  /** Name of the parameter to check */
  parameterName: string;
  /** Comparison operator */
  operator: ConditionOperator;
  /** Value to compare against */
  value: ParameterValue;
}

// ============================================================================
// State Types
// ============================================================================

/**
 * An animation state in the state machine
 */
export interface AnimationState {
  /** Unique state ID */
  id: string;
  /** Display name */
  name: string;
  /**
   * ID of the animation clip to play in this state.
   * This should match an animation ID in the AnimationController's animations array.
   */
  animationClipId: string;
  /** Speed multiplier for this state (1.0 = normal speed) */
  speed: number;
  /** Whether this is the entry/default state */
  isDefault?: boolean;
}

// ============================================================================
// Transition Types
// ============================================================================

/**
 * A transition between two states
 */
export interface AnimationTransition {
  /** Unique transition ID */
  id: string;
  /** Source state ID (use '*' for "any state") */
  fromStateId: string;
  /** Target state ID */
  toStateId: string;
  /**
   * Conditions that must ALL be true for this transition to fire.
   * If empty, the transition fires immediately (useful with exitTime).
   */
  conditions: TransitionCondition[];
  /**
   * Exit time (0-1). If set, the transition only fires after the current
   * animation has played this percentage. For example, 0.8 means wait until
   * the animation is 80% complete before transitioning.
   */
  exitTime?: number;
  /**
   * Whether this transition can be interrupted by other transitions.
   * Default is true.
   */
  canBeInterrupted?: boolean;
  /**
   * Blend duration in seconds. If > 0, the two animations will cross-fade.
   * Default is 0 (instant transition).
   * NOTE: Blending is not implemented in the initial version.
   */
  blendDuration?: number;
  /**
   * Priority for resolving conflicts when multiple transitions are valid.
   * Higher priority transitions are checked first.
   * Default is 0.
   */
  priority?: number;
}

// ============================================================================
// State Machine Types
// ============================================================================

/**
 * Node position for the visual editor
 */
export interface StateNodePosition {
  x: number;
  y: number;
}

/**
 * The complete animation state machine definition
 */
export interface AnimationStateMachine {
  /** Unique state machine ID */
  id: string;
  /** Display name */
  name: string;
  /** All states in this state machine */
  states: AnimationState[];
  /** All transitions between states */
  transitions: AnimationTransition[];
  /** Parameters that drive transitions */
  parameters: AnimationParameter[];
  /** ID of the default/entry state */
  defaultStateId: string;
  /**
   * Node positions for the visual editor.
   * Key is state ID, value is position.
   */
  nodePositions?: Record<string, StateNodePosition>;
}

// ============================================================================
// Runtime Types
// ============================================================================

/**
 * Runtime state of the animation state machine
 */
export interface StateMachineRuntimeState {
  /** Current state ID */
  currentStateId: string;
  /** Current parameter values */
  parameterValues: Record<string, ParameterValue>;
  /** Time spent in the current state (seconds) */
  stateTime: number;
  /** Normalized time in current animation (0-1) */
  normalizedTime: number;
  /** Set of trigger parameters that have been set but not consumed */
  pendingTriggers: Set<string>;
  /** Whether we're currently in a transition */
  isTransitioning: boolean;
  /** The transition we're currently executing (if any) */
  activeTransition?: AnimationTransition;
  /** Progress through the active transition (0-1) */
  transitionProgress: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the default value for a parameter type
 */
export function getDefaultValueForType(type: ParameterType): ParameterValue {
  switch (type) {
    case 'bool':
      return false;
    case 'int':
      return 0;
    case 'float':
      return 0.0;
    case 'trigger':
      return false;
  }
}

/**
 * Create a new parameter with default values
 */
export function createParameter(
  name: string,
  type: ParameterType,
  defaultValue?: ParameterValue,
): AnimationParameter {
  return {
    name,
    type,
    defaultValue: defaultValue ?? getDefaultValueForType(type),
  };
}

/**
 * Create a new state with default values
 */
export function createState(
  id: string,
  name: string,
  animationClipId: string,
): AnimationState {
  return {
    id,
    name,
    animationClipId,
    speed: 1.0,
    isDefault: false,
  };
}

/**
 * Create a new transition with default values
 */
export function createTransition(
  id: string,
  fromStateId: string,
  toStateId: string,
): AnimationTransition {
  return {
    id,
    fromStateId,
    toStateId,
    conditions: [],
    canBeInterrupted: true,
    blendDuration: 0,
    priority: 0,
  };
}

/**
 * Create a new condition
 */
export function createCondition(
  parameterName: string,
  operator: ConditionOperator,
  value: ParameterValue,
): TransitionCondition {
  return {
    parameterName,
    operator,
    value,
  };
}

/**
 * Create an empty state machine
 */
export function createStateMachine(id: string, name: string): AnimationStateMachine {
  return {
    id,
    name,
    states: [],
    transitions: [],
    parameters: [],
    defaultStateId: '',
    nodePositions: {},
  };
}

/**
 * Create the initial runtime state for a state machine
 */
export function createRuntimeState(
  stateMachine: AnimationStateMachine,
): StateMachineRuntimeState {
  // Initialize parameter values from defaults
  const parameterValues: Record<string, ParameterValue> = {};
  for (const param of stateMachine.parameters) {
    parameterValues[param.name] = param.defaultValue;
  }

  return {
    currentStateId: stateMachine.defaultStateId,
    parameterValues,
    stateTime: 0,
    normalizedTime: 0,
    pendingTriggers: new Set(),
    isTransitioning: false,
    transitionProgress: 0,
  };
}

/**
 * Evaluate a condition against current parameter values
 */
export function evaluateCondition(
  condition: TransitionCondition,
  parameterValues: Record<string, ParameterValue>,
): boolean {
  const value = parameterValues[condition.parameterName];

  // If parameter doesn't exist, condition fails
  if (value === undefined) {
    return false;
  }

  switch (condition.operator) {
    case 'equals':
      return value === condition.value;

    case 'notEquals':
      return value !== condition.value;

    case 'greater':
      if (typeof value !== 'number' || typeof condition.value !== 'number') {
        return false;
      }
      return value > condition.value;

    case 'less':
      if (typeof value !== 'number' || typeof condition.value !== 'number') {
        return false;
      }
      return value < condition.value;

    case 'greaterOrEqual':
      if (typeof value !== 'number' || typeof condition.value !== 'number') {
        return false;
      }
      return value >= condition.value;

    case 'lessOrEqual':
      if (typeof value !== 'number' || typeof condition.value !== 'number') {
        return false;
      }
      return value <= condition.value;

    default:
      return false;
  }
}

/**
 * Evaluate all conditions for a transition
 */
export function evaluateTransitionConditions(
  transition: AnimationTransition,
  parameterValues: Record<string, ParameterValue>,
  pendingTriggers: Set<string>,
): boolean {
  // All conditions must be true
  for (const condition of transition.conditions) {
    // Check if this is a trigger parameter
    const isTrigger = pendingTriggers.has(condition.parameterName);

    if (isTrigger) {
      // For triggers, we check if it's pending
      if (condition.operator !== 'equals' || condition.value !== true) {
        return false;
      }
      // Trigger is pending, condition passes
      continue;
    }

    // Regular parameter check
    if (!evaluateCondition(condition, parameterValues)) {
      return false;
    }
  }

  return true;
}

/**
 * Get operators valid for a parameter type
 */
export function getValidOperatorsForType(type: ParameterType): ConditionOperator[] {
  switch (type) {
    case 'bool':
    case 'trigger':
      return ['equals', 'notEquals'];

    case 'int':
    case 'float':
      return ['equals', 'notEquals', 'greater', 'less', 'greaterOrEqual', 'lessOrEqual'];

    default:
      return ['equals', 'notEquals'];
  }
}

/**
 * Check if an operator is valid for a value type
 */
export function isOperatorValidForValue(
  operator: ConditionOperator,
  value: ParameterValue,
): boolean {
  if (typeof value === 'boolean') {
    return operator === 'equals' || operator === 'notEquals';
  }
  return true; // All operators valid for numbers
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}
