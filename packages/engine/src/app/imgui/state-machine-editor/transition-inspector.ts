/**
 * Transition Inspector
 *
 * Panel for editing a selected transition's properties and conditions.
 */

import { ImGui } from '@voidscript/imgui';
import { EditorLayout } from '../editor-layout.js';
import { EDITOR_ICONS } from '../editor-icons.js';
import type {
  AnimationStateMachine,
  AnimationTransition,
  TransitionCondition,
  ConditionOperator,
} from '../../../animation/state-machine/index.js';
import {
  updateTransition,
  deleteTransition,
  markDirty,
} from './state-machine-editor-state.js';

// ============================================================================
// Constants
// ============================================================================

const OPERATORS: Array<{ value: ConditionOperator; label: string }> = [
  { value: 'equals', label: '==' },
  { value: 'notEquals', label: '!=' },
  { value: 'greater', label: '>' },
  { value: 'less', label: '<' },
  { value: 'greaterOrEqual', label: '>=' },
  { value: 'lessOrEqual', label: '<=' },
];

// ============================================================================
// Transition Inspector
// ============================================================================

/**
 * Render the transition inspector panel
 */
export function renderTransitionInspector(
  transition: AnimationTransition,
  stateMachine: AnimationStateMachine,
): void {
  const fromState = stateMachine.states.find(s => s.id === transition.fromStateId);
  const toState = stateMachine.states.find(s => s.id === transition.toStateId);

  EditorLayout.sectionHeader('Transition Properties');
  EditorLayout.spacing();

  EditorLayout.beginLabelsWidth(['From', 'To', 'Exit Time', 'Blend', 'Priority']);

  // Display from/to states (read-only)
  ImGui.Text('From:');
  ImGui.SameLine();
  EditorLayout.textDisabled(fromState?.name ?? 'Unknown');

  ImGui.Text('To:');
  ImGui.SameLine();
  EditorLayout.textDisabled(toState?.name ?? 'Unknown');

  EditorLayout.spacing();

  // Exit time (optional with enable checkbox)
  const hasExitTime = transition.exitTime !== undefined;
  const [exitEnabled, exitEnabledChanged] = EditorLayout.checkboxField('Exit Time', hasExitTime, {
    tooltip: 'Wait for animation to reach exit time before transitioning',
  });
  if (exitEnabledChanged) {
    if (exitEnabled) {
      updateTransition(transition.id, { exitTime: 0.8 });
    } else {
      updateTransition(transition.id, { exitTime: undefined });
    }
  }

  if (hasExitTime) {
    const [exitTime, exitTimeChanged] = EditorLayout.numberField('  ', transition.exitTime ?? 0.8, {
      min: 0,
      max: 1,
      useSlider: true,
      format: '%.2f',
      tooltip: 'Animation progress (0-1) at which to exit',
    });
    if (exitTimeChanged) {
      updateTransition(transition.id, { exitTime: exitTime });
    }
  }

  // Blend duration
  const [blendDuration, blendChanged] = EditorLayout.numberField('Blend', transition.blendDuration ?? 0, {
    min: 0,
    max: 2,
    speed: 0.01,
    format: '%.2f',
    tooltip: 'Blend duration in seconds (0 = instant)',
  });
  if (blendChanged) {
    updateTransition(transition.id, { blendDuration: blendDuration });
  }

  // Priority
  const [priority, priorityChanged] = EditorLayout.integerField('Priority', transition.priority ?? 0, {
    min: 0,
    max: 100,
    tooltip: 'Higher priority transitions are evaluated first',
  });
  if (priorityChanged) {
    updateTransition(transition.id, { priority: priority });
  }

  EditorLayout.endLabelsWidth();

  EditorLayout.spacing();
  EditorLayout.separator();
  EditorLayout.spacing();

  // Conditions section
  EditorLayout.sectionHeader('Conditions');
  EditorLayout.spacing();

  if (transition.conditions.length === 0 && transition.exitTime === undefined) {
    EditorLayout.warning('No conditions! Transition will fire immediately.');
  }

  // Render each condition
  for (let i = 0; i < transition.conditions.length; i++) {
    const condition = transition.conditions[i]!;
    renderConditionEditor(transition, condition, i, stateMachine);
  }

  // Add condition button
  EditorLayout.spacing();
  if (EditorLayout.iconButton(EDITOR_ICONS.ADD, {
    size: 'small',
    tooltip: 'Add Condition',
    id: 'addCondition',
  })) {
    // Add new condition with first parameter
    const firstParam = stateMachine.parameters[0];
    if (firstParam) {
      const newCondition: TransitionCondition = {
        parameterName: firstParam.name,
        operator: firstParam.type === 'bool' || firstParam.type === 'trigger' ? 'equals' : 'greater',
        value: firstParam.type === 'bool' || firstParam.type === 'trigger' ? true : 0,
      };
      const newConditions = [...transition.conditions, newCondition];
      updateTransition(transition.id, { conditions: newConditions });
    } else {
      EditorLayout.warning('Add a parameter first');
    }
  }

  EditorLayout.spacing();
  EditorLayout.separator();
  EditorLayout.spacing();

  // Delete button
  ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.6, y: 0.2, z: 0.2, w: 1 });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, { x: 0.7, y: 0.3, z: 0.3, w: 1 });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, { x: 0.8, y: 0.4, z: 0.4, w: 1 });

  if (ImGui.Button('Delete Transition')) {
    deleteTransition(transition.id);
  }

  ImGui.PopStyleColor(3);
}

// ============================================================================
// Condition Editor
// ============================================================================

function renderConditionEditor(
  transition: AnimationTransition,
  condition: TransitionCondition,
  index: number,
  stateMachine: AnimationStateMachine,
): void {
  const param = stateMachine.parameters.find(p => p.name === condition.parameterName);
  if (!param) {
    EditorLayout.warning(`Unknown parameter: ${condition.parameterName}`);
    return;
  }

  ImGui.PushID(`condition_${index}`);

  // Row with parameter, operator, value, delete button
  // Parameter dropdown
  ImGui.SetNextItemWidth(100);
  if (ImGui.BeginCombo('##param', condition.parameterName)) {
    for (const p of stateMachine.parameters) {
      const isSelected = p.name === condition.parameterName;
      if (ImGui.Selectable(p.name, isSelected)) {
        // Update condition for new parameter type
        const newConditions = [...transition.conditions];
        const newValue = p.type === 'bool' || p.type === 'trigger' ? true : 0;
        const newOperator: ConditionOperator = p.type === 'bool' || p.type === 'trigger' ? 'equals' : 'greater';
        newConditions[index] = {
          ...condition,
          parameterName: p.name,
          operator: newOperator,
          value: newValue,
        };
        updateTransition(transition.id, { conditions: newConditions });
      }
      if (isSelected) {
        ImGui.SetItemDefaultFocus();
      }
    }
    ImGui.EndCombo();
  }

  ImGui.SameLine();

  // Operator dropdown (for triggers, only show if trigger is used)
  if (param.type === 'trigger') {
    // Triggers just check if they're pending
    EditorLayout.textDisabled('is set');
  } else {
    // Get valid operators for this parameter type
    const validOperators = param.type === 'bool'
      ? OPERATORS.filter(o => o.value === 'equals' || o.value === 'notEquals')
      : OPERATORS;

    const currentOp = validOperators.find(o => o.value === condition.operator) ?? validOperators[0]!;

    ImGui.SetNextItemWidth(50);
    if (ImGui.BeginCombo('##op', currentOp.label)) {
      for (const op of validOperators) {
        const isSelected = op.value === condition.operator;
        if (ImGui.Selectable(op.label, isSelected)) {
          const newConditions = [...transition.conditions];
          newConditions[index] = { ...condition, operator: op.value };
          updateTransition(transition.id, { conditions: newConditions });
        }
        if (isSelected) {
          ImGui.SetItemDefaultFocus();
        }
      }
      ImGui.EndCombo();
    }

    ImGui.SameLine();

    // Value input based on parameter type
    if (param.type === 'bool') {
      const boolValue: [boolean] = [condition.value === true];
      if (ImGui.Checkbox('##value', boolValue)) {
        const newConditions = [...transition.conditions];
        newConditions[index] = { ...condition, value: boolValue[0] };
        updateTransition(transition.id, { conditions: newConditions });
      }
    } else if (param.type === 'int') {
      const intValue: [number] = [typeof condition.value === 'number' ? Math.round(condition.value) : 0];
      ImGui.SetNextItemWidth(60);
      if (ImGui.DragInt('##value', intValue, 1)) {
        const newConditions = [...transition.conditions];
        newConditions[index] = { ...condition, value: intValue[0] };
        updateTransition(transition.id, { conditions: newConditions });
      }
    } else {
      // Float
      const floatValue: [number] = [typeof condition.value === 'number' ? condition.value : 0];
      ImGui.SetNextItemWidth(60);
      if (ImGui.DragFloat('##value', floatValue, 0.1)) {
        const newConditions = [...transition.conditions];
        newConditions[index] = { ...condition, value: floatValue[0] };
        updateTransition(transition.id, { conditions: newConditions });
      }
    }
  }

  ImGui.SameLine();

  // Delete condition button
  if (EditorLayout.iconButton(EDITOR_ICONS.CLOSE, {
    size: 'small',
    tooltip: 'Remove Condition',
    id: `removeCondition${index}`,
    color: { r: 0.5, g: 0.2, b: 0.2 },
  })) {
    const newConditions = transition.conditions.filter((_, i) => i !== index);
    updateTransition(transition.id, { conditions: newConditions });
  }

  ImGui.PopID();
}
