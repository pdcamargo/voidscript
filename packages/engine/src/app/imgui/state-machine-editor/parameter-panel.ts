/**
 * Parameter Panel
 *
 * Panel for managing animation state machine parameters.
 */

import { ImGui } from '@voidscript/imgui';
import type { Command } from '@voidscript/core';
import { EditorLayout } from '../editor-layout.js';
import { EDITOR_ICONS } from '../editor-icons.js';
import type {
  AnimationStateMachine,
  AnimationParameter,
  ParameterType,
} from '../../../animation/state-machine/index.js';
import {
  addParameter,
  deleteParameter,
  updateParameter,
  selectParameter,
  getSelectedParameter,
  markDirty,
} from './state-machine-editor-state.js';

// ============================================================================
// Constants
// ============================================================================

const PARAMETER_TYPES: Array<{ value: ParameterType; label: string }> = [
  { value: 'bool', label: 'Bool' },
  { value: 'int', label: 'Integer' },
  { value: 'float', label: 'Float' },
  { value: 'trigger', label: 'Trigger' },
];

const PARAMETER_TYPE_COLORS: Record<ParameterType, { x: number; y: number; z: number; w: number }> = {
  bool: { x: 0.8, y: 0.4, z: 0.4, w: 1 }, // Red
  int: { x: 0.4, y: 0.6, z: 0.8, w: 1 }, // Blue
  float: { x: 0.4, y: 0.8, z: 0.4, w: 1 }, // Green
  trigger: { x: 0.8, y: 0.6, z: 0.2, w: 1 }, // Orange
};

// ============================================================================
// Add Parameter State
// ============================================================================

interface AddParameterState {
  isOpen: boolean;
  name: string;
  type: ParameterType;
}

const addParamState: AddParameterState = {
  isOpen: false,
  name: '',
  type: 'bool',
};

// ============================================================================
// Parameter Panel
// ============================================================================

/**
 * Render the parameter panel
 */
export function renderParameterPanel(
  stateMachine: AnimationStateMachine,
  commands?: Command,
): void {
  // Add parameter button
  if (EditorLayout.iconButton(EDITOR_ICONS.ADD, {
    size: 'small',
    tooltip: 'Add Parameter',
    id: 'addParam',
  })) {
    addParamState.isOpen = true;
    addParamState.name = 'New Parameter';
    addParamState.type = 'bool';
    ImGui.OpenPopup('AddParameterPopup');
  }

  // Add parameter popup
  renderAddParameterPopup();

  EditorLayout.spacing();

  // Parameter list
  if (stateMachine.parameters.length === 0) {
    EditorLayout.textDisabled('No parameters');
  } else {
    for (const param of stateMachine.parameters) {
      renderParameterRow(param, stateMachine);
    }
  }
}

// ============================================================================
// Add Parameter Popup
// ============================================================================

function renderAddParameterPopup(): void {
  const popupFlags = ImGui.WindowFlags.AlwaysAutoResize;

  if (ImGui.BeginPopup('AddParameterPopup', popupFlags)) {
    ImGui.Text('Add Parameter');
    ImGui.Separator();
    EditorLayout.spacing();

    // Name input
    const nameBuffer: [string] = [addParamState.name];
    ImGui.Text('Name:');
    ImGui.SameLine();
    ImGui.SetNextItemWidth(150);
    ImGui.InputText('##paramName', nameBuffer, 64);
    if (nameBuffer[0] !== addParamState.name) {
      addParamState.name = nameBuffer[0];
    }

    // Type selector
    ImGui.Text('Type:');
    ImGui.SameLine();
    ImGui.SetNextItemWidth(100);
    if (ImGui.BeginCombo('##paramType', PARAMETER_TYPES.find(t => t.value === addParamState.type)?.label ?? 'Bool')) {
      for (const pt of PARAMETER_TYPES) {
        const isSelected = pt.value === addParamState.type;
        if (ImGui.Selectable(pt.label, isSelected)) {
          addParamState.type = pt.value;
        }
        if (isSelected) {
          ImGui.SetItemDefaultFocus();
        }
      }
      ImGui.EndCombo();
    }

    EditorLayout.spacing();

    // Buttons
    if (ImGui.Button('Add', { x: 60, y: 0 })) {
      if (addParamState.name.trim()) {
        addParameter(addParamState.name.trim(), addParamState.type);
        addParamState.isOpen = false;
        ImGui.CloseCurrentPopup();
      }
    }

    ImGui.SameLine();

    if (ImGui.Button('Cancel', { x: 60, y: 0 })) {
      addParamState.isOpen = false;
      ImGui.CloseCurrentPopup();
    }

    ImGui.EndPopup();
  }
}

// ============================================================================
// Parameter Row
// ============================================================================

function renderParameterRow(
  param: AnimationParameter,
  stateMachine: AnimationStateMachine,
): void {
  const selectedParam = getSelectedParameter();
  const isSelected = selectedParam?.name === param.name;

  ImGui.PushID(param.name);

  // Type indicator color
  const typeColor = PARAMETER_TYPE_COLORS[param.type];
  ImGui.PushStyleColorImVec4(ImGui.Col.Button, typeColor);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, typeColor);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, typeColor);

  // Small colored button showing type
  const typeLabel = param.type.charAt(0).toUpperCase();
  ImGui.Button(typeLabel, { x: 22, y: 22 });
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip(PARAMETER_TYPES.find(t => t.value === param.type)?.label ?? param.type);
  }

  ImGui.PopStyleColor(3);

  ImGui.SameLine();

  // Parameter name (selectable) - use fixed width to leave room for value and delete button
  const flags = isSelected ? ImGui.SelectableFlags.None : ImGui.SelectableFlags.None;
  if (ImGui.Selectable(param.name, isSelected, flags, { x: 100, y: 22 })) {
    selectParameter(param.name);
  }

  // Context menu on right-click
  if (ImGui.BeginPopupContextItem(`paramContext_${param.name}`)) {
    // Rename
    const nameBuffer: [string] = [param.name];
    ImGui.Text('Rename:');
    ImGui.SameLine();
    ImGui.SetNextItemWidth(120);
    ImGui.InputText('##rename', nameBuffer, 64, ImGui.InputTextFlags.EnterReturnsTrue);
    if (ImGui.IsItemDeactivatedAfterEdit()) {
      const newName = nameBuffer[0].trim();
      if (newName && newName !== param.name) {
        // Check if name is unique
        const exists = stateMachine.parameters.some(p => p.name === newName);
        if (!exists) {
          updateParameter(param.name, { name: newName });
          ImGui.CloseCurrentPopup();
        }
      }
    }

    ImGui.Separator();

    // Change type
    if (ImGui.BeginMenu('Change Type')) {
      for (const pt of PARAMETER_TYPES) {
        const isCurrent = pt.value === param.type;
        if (ImGui.MenuItem(pt.label, '', isCurrent)) {
          if (!isCurrent) {
            const newDefault = pt.value === 'bool' || pt.value === 'trigger' ? false : 0;
            updateParameter(param.name, { type: pt.value, defaultValue: newDefault });
          }
        }
      }
      ImGui.EndMenu();
    }

    ImGui.Separator();

    // Delete
    ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: 1, y: 0.3, z: 0.3, w: 1 });
    if (ImGui.MenuItem('Delete')) {
      deleteParameter(param.name);
    }
    ImGui.PopStyleColor();

    ImGui.EndPopup();
  }

  // Default value editor (inline)
  ImGui.SameLine();

  // Note: GetContentRegionAvail() doesn't work in jsimgui, use fixed width instead
  ImGui.SetNextItemWidth(80);

  if (param.type === 'bool') {
    const boolValue: [boolean] = [param.defaultValue === true];
    if (ImGui.Checkbox('##default', boolValue)) {
      updateParameter(param.name, { defaultValue: boolValue[0] });
    }
  } else if (param.type === 'int') {
    const intValue: [number] = [typeof param.defaultValue === 'number' ? Math.round(param.defaultValue) : 0];
    if (ImGui.DragInt('##default', intValue, 1)) {
      updateParameter(param.name, { defaultValue: intValue[0] });
    }
  } else if (param.type === 'float') {
    const floatValue: [number] = [typeof param.defaultValue === 'number' ? param.defaultValue : 0];
    if (ImGui.DragFloat('##default', floatValue, 0.1, undefined, undefined, '%.2f')) {
      updateParameter(param.name, { defaultValue: floatValue[0] });
    }
  } else if (param.type === 'trigger') {
    // Triggers don't have a meaningful default value, show label
    EditorLayout.textDisabled('(trigger)');
  }

  ImGui.SameLine();

  // Delete button
  if (EditorLayout.iconButton(EDITOR_ICONS.CLOSE, {
    size: 'small',
    tooltip: 'Delete',
    id: 'del',
    color: { r: 0.4, g: 0.2, b: 0.2 },
  })) {
    deleteParameter(param.name);
  }

  ImGui.PopID();
}
