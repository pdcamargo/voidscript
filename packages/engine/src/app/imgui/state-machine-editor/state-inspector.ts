/**
 * State Inspector
 *
 * Panel for editing a selected animation state's properties.
 */

import { ImGui } from '@voidscript/imgui';
import type { Command } from '../../../ecs/command.js';
import { EditorLayout } from '../editor-layout.js';
import type {
  AnimationStateMachine,
  AnimationState,
} from '../../../animation/state-machine/index.js';
import {
  updateState,
  setDefaultState,
  deleteState,
  getSelectedEntity,
} from './state-machine-editor-state.js';
import { AnimationController } from '../../../ecs/components/animation/animation-controller.js';
import type { AnimationClip } from '../../../animation/animation-clip.js';

// ============================================================================
// State Inspector
// ============================================================================

/**
 * Render the state inspector panel
 */
export function renderStateInspector(
  state: AnimationState,
  stateMachine: AnimationStateMachine,
  commands?: Command,
): void {
  EditorLayout.sectionHeader('State Properties');
  EditorLayout.spacing();

  EditorLayout.beginLabelsWidth(['Name', 'Animation', 'Speed', 'Default']);

  // State name
  const [newName, nameChanged] = EditorLayout.stringField('Name', state.name, {
    tooltip: 'Display name for this state',
  });
  if (nameChanged && newName !== state.name) {
    updateState(state.id, { name: newName });
  }

  // Animation clip picker
  renderAnimationClipPicker(state, commands);

  // Speed
  const [newSpeed, speedChanged] = EditorLayout.numberField('Speed', state.speed ?? 1, {
    min: 0.01,
    max: 10,
    speed: 0.01,
    format: '%.2f',
    tooltip: 'Animation playback speed multiplier',
  });
  if (speedChanged) {
    updateState(state.id, { speed: newSpeed });
  }

  // Default state indicator and button
  const isDefault = stateMachine.defaultStateId === state.id;
  ImGui.Text('Default:');
  ImGui.SameLine();
  if (isDefault) {
    ImGui.TextColored({ x: 0.3, y: 0.8, z: 0.3, w: 1 }, 'Yes (Entry State)');
  } else {
    if (ImGui.Button('Set as Default##setDefault')) {
      setDefaultState(state.id);
    }
  }

  EditorLayout.endLabelsWidth();

  EditorLayout.spacing();
  EditorLayout.separator();
  EditorLayout.spacing();

  // Transitions from this state
  EditorLayout.sectionHeader('Outgoing Transitions');
  EditorLayout.spacing();

  const outgoingTransitions = stateMachine.transitions.filter(t => t.fromStateId === state.id);

  if (outgoingTransitions.length === 0) {
    EditorLayout.textDisabled('No outgoing transitions');
  } else {
    for (const transition of outgoingTransitions) {
      const toState = stateMachine.states.find(s => s.id === transition.toStateId);
      const toStateName = toState?.name ?? 'Unknown';

      ImGui.Text(`-> ${toStateName}`);
      if (transition.conditions.length > 0) {
        ImGui.SameLine();
        EditorLayout.textDisabled(`(${transition.conditions.length} conditions)`);
      }
    }
  }

  EditorLayout.spacing();
  EditorLayout.separator();
  EditorLayout.spacing();

  // Delete button
  ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.6, y: 0.2, z: 0.2, w: 1 });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, { x: 0.7, y: 0.3, z: 0.3, w: 1 });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, { x: 0.8, y: 0.4, z: 0.4, w: 1 });

  if (ImGui.Button('Delete State')) {
    deleteState(state.id);
  }

  ImGui.PopStyleColor(3);
}

// ============================================================================
// Animation Clip Picker
// ============================================================================

/**
 * Get animation clips from the selected entity's AnimationController.
 * This ensures only animations available to the controller are shown.
 */
function getEntityAnimations(commands?: Command): Array<{ guid: string; name: string; clipId: string }> {
  if (!commands) return [];

  const selectedEntity = getSelectedEntity();
  if (selectedEntity === null) return [];

  const controller = commands.tryGetComponent(selectedEntity, AnimationController);
  if (!controller) return [];

  const animations: Array<{ guid: string; name: string; clipId: string }> = [];

  for (const asset of controller.animations) {
    if (!asset.isLoaded || !asset.data) continue;

    // Skip editor preview animation
    if (asset.data.id === '__editor_preview__') continue;

    const clip = asset.data as AnimationClip;
    const clipName = clip.name || clip.id || 'Unnamed';

    animations.push({
      guid: asset.guid,
      name: clipName,
      clipId: clip.id,
    });
  }

  // Sort by name
  animations.sort((a, b) => a.name.localeCompare(b.name));

  return animations;
}

/**
 * Render animation clip picker dropdown.
 * Shows only animations from the selected entity's AnimationController.
 */
function renderAnimationClipPicker(state: AnimationState, commands?: Command): void {
  const animations = getEntityAnimations(commands);

  // Find current animation name
  const currentAnim = animations.find(a => a.guid === state.animationClipId);
  const displayName = currentAnim?.name ?? (state.animationClipId ? `(Unknown: ${state.animationClipId})` : '(None)');

  ImGui.Text('Animation:');
  ImGui.SameLine();

  ImGui.SetNextItemWidth(150);
  if (ImGui.BeginCombo('##animationClip', displayName)) {
    // None option
    if (ImGui.Selectable('(None)', !state.animationClipId)) {
      updateState(state.id, { animationClipId: '' });
    }

    ImGui.Separator();

    // List animations from the entity's AnimationController
    if (animations.length === 0) {
      ImGui.TextDisabled('No animations in controller');
      ImGui.TextDisabled('Add animations to the entity\'s');
      ImGui.TextDisabled('AnimationController first');
    } else {
      for (const anim of animations) {
        const isSelected = anim.guid === state.animationClipId;
        if (ImGui.Selectable(anim.name, isSelected)) {
          updateState(state.id, { animationClipId: anim.guid });
        }
        if (isSelected) {
          ImGui.SetItemDefaultFocus();
        }
        // Show clip ID as tooltip
        if (ImGui.IsItemHovered()) {
          ImGui.SetTooltip(`Clip ID: ${anim.clipId}`);
        }
      }
    }

    ImGui.EndCombo();
  }

  // Show tooltip with clip info
  if (ImGui.IsItemHovered() && currentAnim) {
    ImGui.SetTooltip(`Clip ID: ${currentAnim.clipId}`);
  }
}
