/**
 * Animation State Machine System
 *
 * ECS system that evaluates animation state machine controllers each frame.
 * Handles state transitions based on conditions and exit time, and synchronizes
 * with the AnimationController to play the correct animations.
 *
 * This system runs when:
 * - In play mode (EditorManager exists and is playing)
 * - Or no editor (pure game, always runs)
 */

import { system } from '../system.js';
import {
  AnimationController,
  getCurrentClip,
  playAnimation,
  type AnimationControllerData,
} from '../components/animation/animation-controller.js';
import {
  AnimationStateMachineController,
  initializeStateMachine,
  consumeTrigger,
  type AnimationStateMachineControllerData,
} from '../components/animation/animation-state-machine-controller.js';
import {
  evaluateTransitionConditions,
  type AnimationStateMachine,
  type AnimationTransition,
  type AnimationState,
} from '../../animation/state-machine/index.js';
import type { Entity } from '../entity.js';
import type { Command } from '../command.js';
import { isGameplayActive } from '../../editor/system-conditions.js';

// ============================================================================
// Animation State Machine System
// ============================================================================

/**
 * System that updates all AnimationStateMachineController components.
 *
 * Registered automatically by Application.addBuiltInSystems().
 * Runs in the 'update' phase, BEFORE the animation update system.
 *
 * For each entity with both AnimationController and AnimationStateMachineController:
 * 1. Initialize if not yet started
 * 2. Update state time
 * 3. Evaluate transitions
 * 4. If a transition fires, change state and tell AnimationController to play new animation
 * 5. Consume any triggers that were used
 */
export const animationStateMachineSystem = system(({ commands }) => {
  const deltaTime = commands.getDeltaTime();

  // Query entities with BOTH AnimationController and AnimationStateMachineController
  commands
    .query()
    .all(AnimationController, AnimationStateMachineController)
    .each((entity, animController, smController) => {
      updateStateMachineController(
        entity,
        animController,
        smController,
        deltaTime,
        commands,
      );
    });
}).runIf(isGameplayActive());

// ============================================================================
// Internal Functions
// ============================================================================

/**
 * Update a single state machine controller
 */
function updateStateMachineController(
  entity: Entity,
  animController: AnimationControllerData,
  smController: AnimationStateMachineControllerData,
  deltaTime: number,
  commands: Command,
): void {
  // Skip if disabled
  if (!smController.enabled) return;

  // Skip if no state machine asset
  if (!smController.stateMachine) {
    console.warn('[StateMachineSystem] No state machine asset assigned');
    return;
  }

  // Wait for asset to load
  if (!smController.stateMachine.isLoaded || !smController.stateMachine.data) {
    // Try to load the asset if not already loading
    if (!smController.stateMachine.isLoading) {
      console.log('[StateMachineSystem] Loading state machine asset:', smController.stateMachine.guid);
      smController.stateMachine.load().catch((err) => {
        console.error('[StateMachineSystem] Failed to load state machine:', err);
      });
    }
    return;
  }

  const stateMachine = smController.stateMachine.data;

  // Initialize if not yet started (check for null or undefined)
  if (!smController.currentStateId) {
    console.log('[StateMachineSystem] Initializing state machine:', stateMachine.name, 'defaultStateId:', stateMachine.defaultStateId);
    if (!initializeStateMachine(smController)) {
      console.error('[StateMachineSystem] Failed to initialize state machine');
      return; // Failed to initialize
    }
    console.log('[StateMachineSystem] Initialized, currentStateId:', smController.currentStateId);

    // Start playing the initial state's animation
    const initialState = findState(stateMachine, smController.currentStateId!);
    if (initialState) {
      console.log('[StateMachineSystem] Playing initial state animation:', initialState.name, 'clipId:', initialState.animationClipId);
      playStateAnimation(animController, initialState);
    } else {
      console.warn('[StateMachineSystem] Initial state not found:', smController.currentStateId);
    }
  }

  // Update state time (handle edge case where stateTime might be undefined)
  smController.stateTime = (smController.stateTime ?? 0) + deltaTime;

  // Get the current animation clip to determine normalized time
  const currentClip = getCurrentClip(animController);
  const normalizedTime = currentClip
    ? animController.currentTime / currentClip.duration
    : 0;

  // Evaluate transitions
  const firedTransition = evaluateTransitions(
    stateMachine,
    smController,
    normalizedTime,
  );

  if (firedTransition) {
    // Execute the transition
    executeTransition(
      stateMachine,
      smController,
      animController,
      firedTransition,
    );
  }
}

/**
 * Find a state by ID in the state machine
 */
function findState(
  stateMachine: AnimationStateMachine,
  stateId: string,
): AnimationState | undefined {
  return stateMachine.states.find(s => s.id === stateId);
}

/**
 * Evaluate all valid transitions from the current state.
 * Returns the first transition that should fire, or null if none.
 */
function evaluateTransitions(
  stateMachine: AnimationStateMachine,
  smController: AnimationStateMachineControllerData,
  normalizedTime: number,
): AnimationTransition | null {
  const currentStateId = smController.currentStateId;
  if (!currentStateId) return null;

  // Get transitions from current state (including "any state" transitions)
  const validTransitions = stateMachine.transitions
    .filter(t => t.fromStateId === currentStateId || t.fromStateId === '*')
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)); // Higher priority first

  for (const transition of validTransitions) {
    // Check exit time condition
    if (transition.exitTime !== undefined) {
      if (normalizedTime < transition.exitTime) {
        continue; // Animation hasn't reached exit time yet
      }
    }

    // Check parameter conditions
    const conditionsMet = evaluateTransitionConditions(
      transition,
      smController.parameterValues,
      smController.pendingTriggers,
    );

    if (conditionsMet) {
      return transition;
    }
  }

  return null;
}

/**
 * Execute a transition: change state and start new animation
 */
function executeTransition(
  stateMachine: AnimationStateMachine,
  smController: AnimationStateMachineControllerData,
  animController: AnimationControllerData,
  transition: AnimationTransition,
): void {
  const previousStateId = smController.currentStateId;
  const newStateId = transition.toStateId;

  // Find the new state
  const newState = findState(stateMachine, newStateId);
  if (!newState) {
    console.warn(`State machine transition target not found: ${newStateId}`);
    return;
  }

  // Consume any triggers used in this transition
  consumeTriggersForTransition(stateMachine, smController, transition);

  // Update state
  smController.currentStateId = newStateId;
  smController.stateTime = 0;
  smController.activeTransition = transition;
  smController.transitionProgress = 0;

  // Call state changed callback
  if (previousStateId && smController.onStateChanged) {
    smController.onStateChanged(previousStateId, newStateId);
  }

  // Start playing the new state's animation
  playStateAnimation(animController, newState);

  // Clear active transition (since we're doing instant transitions for now)
  // TODO: In the future, handle blend transitions with transitionProgress
  smController.activeTransition = null;
}

/**
 * Consume any trigger parameters that were used in a transition
 */
function consumeTriggersForTransition(
  stateMachine: AnimationStateMachine,
  smController: AnimationStateMachineControllerData,
  transition: AnimationTransition,
): void {
  for (const condition of transition.conditions) {
    // Find the parameter definition
    const param = stateMachine.parameters.find(
      p => p.name === condition.parameterName,
    );

    // If it's a trigger and was pending, consume it
    if (param?.type === 'trigger' && smController.pendingTriggers.has(condition.parameterName)) {
      consumeTrigger(smController, condition.parameterName);
    }
  }
}

/**
 * Play the animation for a state
 */
function playStateAnimation(
  animController: AnimationControllerData,
  state: AnimationState,
): void {
  // Try to play the animation by clip ID
  const success = playAnimation(animController, state.animationClipId, {
    restart: true,
    speed: state.speed,
  });

  if (!success) {
    // Animation clip not found - this might be expected if the clip hasn't loaded yet
    // or if the clip ID doesn't match any animation in the controller
    console.warn(
      `State machine: Animation clip "${state.animationClipId}" not found for state "${state.name}"`,
    );
  }
}
