/**
 * Animation State Machine
 *
 * A Unity Animator-style state machine for controlling animation playback.
 *
 * @example
 * ```typescript
 * import {
 *   createStateMachine,
 *   createState,
 *   createParameter,
 *   createTransition,
 *   createCondition,
 * } from './state-machine';
 *
 * // Create state machine
 * const stateMachine = createStateMachine('player-fsm', 'Player State Machine');
 *
 * // Add parameters
 * stateMachine.parameters.push(createParameter('speed', 'float', 0));
 * stateMachine.parameters.push(createParameter('isGrounded', 'bool', true));
 * stateMachine.parameters.push(createParameter('jump', 'trigger'));
 *
 * // Add states
 * const idleState = createState('idle', 'Idle', 'player-idle-anim');
 * const runState = createState('run', 'Running', 'player-run-anim');
 * const jumpState = createState('jump', 'Jumping', 'player-jump-anim');
 *
 * stateMachine.states.push(idleState, runState, jumpState);
 * stateMachine.defaultStateId = idleState.id;
 *
 * // Add transitions
 * const idleToRun = createTransition('idle-to-run', 'idle', 'run');
 * idleToRun.conditions.push(createCondition('speed', 'greater', 0.1));
 *
 * const runToIdle = createTransition('run-to-idle', 'run', 'idle');
 * runToIdle.conditions.push(createCondition('speed', 'lessOrEqual', 0.1));
 *
 * const anyToJump = createTransition('any-to-jump', '*', 'jump');
 * anyToJump.conditions.push(createCondition('jump', 'equals', true));
 *
 * stateMachine.transitions.push(idleToRun, runToIdle, anyToJump);
 * ```
 */

// Export types
export type {
  ParameterType,
  ParameterValue,
  AnimationParameter,
  ConditionOperator,
  TransitionCondition,
  AnimationState,
  AnimationTransition,
  StateNodePosition,
  AnimationStateMachine,
  StateMachineRuntimeState,
} from './state-machine-types.js';

// Export factory functions
export {
  getDefaultValueForType,
  createParameter,
  createState,
  createTransition,
  createCondition,
  createStateMachine,
  createRuntimeState,
  evaluateCondition,
  evaluateTransitionConditions,
  getValidOperatorsForType,
  isOperatorValidForValue,
  generateId,
} from './state-machine-types.js';

// Export parser
export {
  parseStateMachine,
  parseStateMachineJson,
  serializeStateMachine,
  serializeStateMachineToJson,
  validateStateMachine,
  type ValidationError,
} from './state-machine-parser.js';
