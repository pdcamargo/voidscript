/**
 * AnimationStateMachineController Component
 *
 * ECS component that orchestrates an AnimationController using a state machine.
 * Evaluates conditions and transitions to control which animation plays.
 *
 * This component DEPENDS on AnimationController being present on the same entity.
 * It doesn't handle animation playback directly - it tells AnimationController what to play.
 */

import { component } from '@voidscript/core';
import type { RuntimeAsset } from '@voidscript/core';
import type {
  AnimationStateMachine,
  ParameterValue,
  AnimationTransition,
} from '../../../animation/state-machine/state-machine-types.js';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';
import { openAssetPicker, renderAssetPickerModal } from '../../../app/imgui/asset-picker.js';
import { tryGetEditorLayoutContext } from '../../../app/imgui/editor-layout-context.js';
import { ImGui } from '@voidscript/imgui';
import { EDITOR_ICONS } from '../../../app/imgui/editor-icons.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Animation state machine controller component data
 */
export interface AnimationStateMachineControllerData {
  /**
   * Reference to the state machine asset.
   * This contains the states, transitions, and parameters.
   */
  stateMachine: RuntimeAsset<AnimationStateMachine> | null;

  /**
   * Current state ID (runtime-only).
   * Set to defaultStateId when gameplay starts.
   */
  currentStateId: string | null;

  /**
   * Current parameter values (runtime-only).
   * Initialized from state machine parameter defaults.
   */
  parameterValues: Record<string, ParameterValue>;

  /**
   * Set of trigger parameters that have been set but not consumed.
   */
  pendingTriggers: Set<string>;

  /**
   * Time spent in the current state in seconds (runtime-only).
   */
  stateTime: number;

  /**
   * Whether the state machine is enabled.
   */
  enabled: boolean;

  /**
   * The currently active transition (if any).
   */
  activeTransition: AnimationTransition | null;

  /**
   * Progress through the active transition (0-1).
   * Used for blending (future feature).
   */
  transitionProgress: number;

  /**
   * Callback when state changes.
   */
  onStateChanged?: (fromStateId: string, toStateId: string) => void;
}

// ============================================================================
// Asset Picker State
// ============================================================================

const pendingStateMachinePicker = new Map<
  string,
  { result: RuntimeAsset<AnimationStateMachine> | null | undefined }
>();

// ============================================================================
// Component Definition
// ============================================================================

/**
 * AnimationStateMachineController component.
 *
 * Works alongside AnimationController to provide state machine-driven animation.
 *
 * @example
 * ```typescript
 * // Entity must have both AnimationController and AnimationStateMachineController
 * commands.spawn()
 *   .with(Transform3D, { ... })
 *   .with(AnimationController, {
 *     animations: [walkAnim, idleAnim, jumpAnim],
 *     playOnStart: false, // Let state machine control this
 *   })
 *   .with(AnimationStateMachineController, {
 *     stateMachine: playerStateMachine, // RuntimeAsset pointing to .sm.json
 *     enabled: true,
 *   })
 *   .build();
 *
 * // In game code, control via parameters:
 * const smController = commands.getComponent(entity, AnimationStateMachineController);
 * setStateMachineParameter(smController, 'speed', playerVelocity.length());
 * setStateMachineParameter(smController, 'isGrounded', isOnGround);
 * triggerStateMachine(smController, 'jump'); // One-shot trigger
 * ```
 */
export const AnimationStateMachineController =
  component<AnimationStateMachineControllerData>(
    'AnimationStateMachineController',
    {
      // Serialized fields
      stateMachine: {
        serializable: true,
        type: 'runtimeAsset',
        assetTypes: ['statemachine'],
        whenNullish: 'keep',
      },
      enabled: {
        serializable: true,
      },

      // Runtime-only fields
      currentStateId: { serializable: false },
      parameterValues: { serializable: false },
      pendingTriggers: { serializable: false },
      stateTime: { serializable: false },
      activeTransition: { serializable: false },
      transitionProgress: { serializable: false },
      onStateChanged: { serializable: false },
    },
    {
      path: 'animation',
      displayName: 'Animation State Machine',
      description: 'State machine-driven animation control',
      defaultValue: () => ({
        stateMachine: null,
        currentStateId: null,
        parameterValues: {},
        pendingTriggers: new Set(),
        stateTime: 0,
        enabled: true,
        activeTransition: null,
        transitionProgress: 0,
      }),

      customEditor: ({ componentData }) => {
        const data = componentData;
        const popupId = 'SelectStateMachine##smController';

        const context = tryGetEditorLayoutContext();
        const renderer = context?.renderer ?? null;

        // ========================================
        // State Machine Asset Field
        // ========================================

        EditorLayout.beginLabelsWidth(['State Machine', 'Enabled']);

        // Check for pending selection
        const pending = pendingStateMachinePicker.get(popupId);
        if (pending && pending.result !== undefined) {
          data.stateMachine = pending.result;
          pendingStateMachinePicker.delete(popupId);

          // Reset runtime state when state machine changes
          data.currentStateId = null;
          data.parameterValues = {};
          data.pendingTriggers = new Set();
          data.stateTime = 0;
        }

        // Display current state machine
        ImGui.Text('State Machine:');
        ImGui.SameLine();

        const smName = data.stateMachine?.isLoaded && data.stateMachine.data
          ? data.stateMachine.data.name || data.stateMachine.data.id
          : data.stateMachine
            ? '(Loading...)'
            : '(None)';

        ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.2, y: 0.2, z: 0.25, w: 1 });
        ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, { x: 0.25, y: 0.25, z: 0.3, w: 1 });

        if (ImGui.Button(`${smName}##smButton`, { x: 150, y: 0 })) {
          openAssetPicker(popupId);
          pendingStateMachinePicker.set(popupId, { result: undefined });
        }

        ImGui.PopStyleColor(2);

        if (data.stateMachine) {
          ImGui.SameLine();
          if (EditorLayout.iconButton(EDITOR_ICONS.CLOSE, {
            size: 'small',
            tooltip: 'Clear',
            id: 'clearSm',
          })) {
            data.stateMachine = null;
            data.currentStateId = null;
            data.parameterValues = {};
            data.pendingTriggers = new Set();
          }
        }

        // Render asset picker modal
        if (renderer) {
          renderAssetPickerModal({
            popupId,
            title: 'Select State Machine',
            assetTypes: ['statemachine'],
            selectedGuid: data.stateMachine?.guid || null,
            renderer,
            onSelect: (runtimeAsset) => {
              pendingStateMachinePicker.set(popupId, {
                result: runtimeAsset as RuntimeAsset<AnimationStateMachine> | null,
              });
            },
            onCancel: () => {
              pendingStateMachinePicker.delete(popupId);
            },
          });
        }

        // ========================================
        // Enabled Checkbox
        // ========================================

        const [enabledValue, enabledChanged] = EditorLayout.checkboxField(
          'Enabled',
          data.enabled,
          { tooltip: 'Enable/disable the state machine' }
        );

        if (enabledChanged) {
          data.enabled = enabledValue;
        }

        EditorLayout.endLabelsWidth();

        // ========================================
        // Runtime Info (if state machine loaded)
        // ========================================

        if (data.stateMachine?.isLoaded && data.stateMachine.data) {
          const sm = data.stateMachine.data;

          EditorLayout.spacing();
          EditorLayout.sectionHeader('Runtime State');

          // Current state
          const currentState = sm.states.find(s => s.id === data.currentStateId);
          ImGui.Text('Current State:');
          ImGui.SameLine();
          ImGui.TextDisabled(currentState?.name || data.currentStateId || '(Not started)');

          // State time
          ImGui.Text('State Time:');
          ImGui.SameLine();
          ImGui.TextDisabled(`${(data.stateTime ?? 0).toFixed(2)}s`);

          // ========================================
          // Parameters (for debugging)
          // ========================================

          if (sm.parameters.length > 0) {
            EditorLayout.spacing();
            EditorLayout.sectionHeader('Parameters');

            for (const param of sm.parameters) {
              const value = data.parameterValues?.[param.name];
              const isPending = data.pendingTriggers?.has(param.name) ?? false;

              ImGui.Text(`${param.name}:`);
              ImGui.SameLine();

              if (param.type === 'trigger') {
                if (isPending) {
                  ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: 0.3, y: 0.8, z: 0.3, w: 1 });
                  ImGui.Text('(pending)');
                  ImGui.PopStyleColor();
                } else {
                  ImGui.TextDisabled('(ready)');
                }
              } else {
                ImGui.TextDisabled(String(value ?? param.defaultValue));
              }
            }
          }
        }
      },
    }
  );

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Set a parameter value on the state machine controller
 */
export function setStateMachineParameter(
  controller: AnimationStateMachineControllerData,
  name: string,
  value: ParameterValue,
): void {
  controller.parameterValues[name] = value;
}

/**
 * Get a parameter value from the state machine controller
 */
export function getStateMachineParameter(
  controller: AnimationStateMachineControllerData,
  name: string,
): ParameterValue | undefined {
  return controller.parameterValues[name];
}

/**
 * Trigger a one-shot trigger parameter.
 * The trigger will be consumed after a transition uses it.
 */
export function triggerStateMachine(
  controller: AnimationStateMachineControllerData,
  triggerName: string,
): void {
  controller.pendingTriggers.add(triggerName);
}

/**
 * Reset a trigger (mark it as consumed)
 */
export function consumeTrigger(
  controller: AnimationStateMachineControllerData,
  triggerName: string,
): void {
  controller.pendingTriggers.delete(triggerName);
}

/**
 * Get the current state name
 */
export function getCurrentStateName(
  controller: AnimationStateMachineControllerData,
): string | null {
  if (!controller.stateMachine?.isLoaded || !controller.stateMachine.data) {
    return null;
  }

  const state = controller.stateMachine.data.states.find(
    s => s.id === controller.currentStateId
  );

  return state?.name || null;
}

/**
 * Get the current state's animation clip ID
 */
export function getCurrentAnimationClipId(
  controller: AnimationStateMachineControllerData,
): string | null {
  if (!controller.stateMachine?.isLoaded || !controller.stateMachine.data) {
    return null;
  }

  const state = controller.stateMachine.data.states.find(
    s => s.id === controller.currentStateId
  );

  return state?.animationClipId || null;
}

/**
 * Force transition to a specific state (bypasses conditions)
 */
export function forceStateTransition(
  controller: AnimationStateMachineControllerData,
  stateId: string,
): boolean {
  if (!controller.stateMachine?.isLoaded || !controller.stateMachine.data) {
    return false;
  }

  const state = controller.stateMachine.data.states.find(s => s.id === stateId);
  if (!state) return false;

  const previousStateId = controller.currentStateId;
  controller.currentStateId = stateId;
  controller.stateTime = 0;
  controller.activeTransition = null;
  controller.transitionProgress = 0;

  if (previousStateId && controller.onStateChanged) {
    controller.onStateChanged(previousStateId, stateId);
  }

  return true;
}

/**
 * Initialize the state machine runtime state.
 * Called when gameplay starts.
 */
export function initializeStateMachine(
  controller: AnimationStateMachineControllerData,
): boolean {
  if (!controller.stateMachine?.isLoaded || !controller.stateMachine.data) {
    return false;
  }

  const sm = controller.stateMachine.data;

  // Set initial state
  controller.currentStateId = sm.defaultStateId;
  controller.stateTime = 0;
  controller.activeTransition = null;
  controller.transitionProgress = 0;
  controller.pendingTriggers = new Set();

  // Initialize parameter values from defaults
  controller.parameterValues = {};
  for (const param of sm.parameters) {
    controller.parameterValues[param.name] = param.defaultValue;
  }

  return true;
}

/**
 * Reset the state machine to its initial state
 */
export function resetStateMachine(
  controller: AnimationStateMachineControllerData,
): void {
  initializeStateMachine(controller);
}
