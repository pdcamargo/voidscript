import { ImGui, ImVec2 } from '@mori2003/jsimgui';
import { globalComponentRegistry } from '../../ecs/component.js';
import type { ComponentType } from '../../ecs/component.js';

export interface ComponentNamePickerOptions {
  /** Popup ID (must be unique) */
  popupId: string;

  /** Current selected component names */
  selectedNames: string[];

  /** Allow multiple selection */
  multiSelect: boolean;

  /** Callback when selection changes */
  onSelect: (componentNames: string[]) => void;

  /** Filter function (optional) */
  filter?: (componentType: ComponentType) => boolean;

  /** Popup width */
  width?: number;

  /** Popup height */
  height?: number;
}

interface ComponentPickerState {
  searchText: string;
  selectedIndices: Set<number>;
}

// State management for component pickers (keyed by popupId)
const pickerStates = new Map<string, ComponentPickerState>();

function getOrCreateState(popupId: string): ComponentPickerState {
  if (!pickerStates.has(popupId)) {
    pickerStates.set(popupId, {
      searchText: '',
      selectedIndices: new Set(),
    });
  }
  return pickerStates.get(popupId)!;
}

/**
 * Fuzzy match algorithm - checks if search term matches component name
 */
function fuzzyMatch(search: string, text: string): boolean {
  if (!search) return true;

  const searchLower = search.toLowerCase();
  const textLower = text.toLowerCase();

  // Simple contains check
  if (textLower.includes(searchLower)) return true;

  // Fuzzy match: all characters in search must appear in order in text
  let searchIndex = 0;
  for (let i = 0; i < textLower.length && searchIndex < searchLower.length; i++) {
    if (textLower[i] === searchLower[searchIndex]) {
      searchIndex++;
    }
  }
  return searchIndex === searchLower.length;
}

/**
 * Render a component name picker popup
 * Call ImGui.OpenPopup(options.popupId) before calling this to show the popup
 *
 * @example
 * ```ts
 * if (ImGui.Button('Pick Component')) {
 *   ImGui.OpenPopup('MyComponentPicker');
 * }
 *
 * renderComponentNamePicker({
 *   popupId: 'MyComponentPicker',
 *   selectedNames: selectedComponents,
 *   multiSelect: true,
 *   onSelect: (names) => {
 *     selectedComponents = names;
 *   },
 * });
 * ```
 */
export function renderComponentNamePicker(options: ComponentNamePickerOptions): void {
  const {
    popupId,
    selectedNames,
    multiSelect,
    onSelect,
    filter,
    width = 400,
    height = 300,
  } = options;

  const state = getOrCreateState(popupId);
  const popupOpen: [boolean] = [true];

  const isOpen = ImGui.BeginPopupModal(popupId, popupOpen, ImGui.WindowFlags.AlwaysAutoResize);
  if (!isOpen) {
    return;
  }

  // Title
  ImGui.Text(multiSelect ? 'Select Components' : 'Select Component');
  ImGui.Separator();
  ImGui.Spacing();

  // Search box
  const searchBuffer: [string] = [state.searchText];
  ImGui.SetNextItemWidth(width - 20);
  ImGui.InputText('##search', searchBuffer, 256);
  state.searchText = searchBuffer[0];
  ImGui.SameLine();
  if (ImGui.Button('Clear##search')) {
    state.searchText = '';
  }

  ImGui.Spacing();

  // Get all components with metadata
  const allComponents = globalComponentRegistry
    .getAllComponentsWithMetadata()
    .filter(comp => !filter || filter(comp));

  // Filter by search text
  const filteredComponents = allComponents.filter(comp =>
    fuzzyMatch(state.searchText, comp.name) ||
    (comp.metadata?.displayName && fuzzyMatch(state.searchText, comp.metadata.displayName)) ||
    (comp.metadata?.path && fuzzyMatch(state.searchText, comp.metadata.path))
  );

  // Component list
  ImGui.BeginChild('ComponentList', new ImVec2(width, height), ImGui.ChildFlags.Borders);

  if (filteredComponents.length === 0) {
    ImGui.TextDisabled('No components found');
  } else {
    for (let i = 0; i < filteredComponents.length; i++) {
      const comp = filteredComponents[i]!; // Safe because we're iterating a known array
      const displayName = comp.metadata?.displayName || comp.name;
      const path = comp.metadata?.path || '';
      const isSelected = selectedNames.includes(comp.name);

      // Render component item
      const label = path ? `${displayName} (${path})` : displayName;

      if (multiSelect) {
        // Checkbox for multi-select
        const checked: [boolean] = [isSelected];
        if (ImGui.Checkbox(`##checkbox_${i}`, checked)) {
          const newSelection = new Set(selectedNames);
          if (checked[0]) {
            newSelection.add(comp.name);
          } else {
            newSelection.delete(comp.name);
          }
          onSelect(Array.from(newSelection));
        }
        ImGui.SameLine();
        ImGui.Text(label);
      } else {
        // Selectable for single-select
        if (ImGui.Selectable(label, isSelected)) {
          onSelect([comp.name]);
          ImGui.CloseCurrentPopup();
        }
      }

      // Tooltip with description
      if (ImGui.IsItemHovered() && comp.metadata?.description) {
        ImGui.SetTooltip(comp.metadata.description);
      }
    }
  }

  ImGui.EndChild();

  ImGui.Spacing();
  ImGui.Separator();
  ImGui.Spacing();

  // Selected count
  if (multiSelect && selectedNames.length > 0) {
    ImGui.Text(`Selected: ${selectedNames.length}`);
    ImGui.SameLine();
  }

  // Buttons
  if (multiSelect) {
    if (ImGui.Button('Done', new ImVec2(100, 0))) {
      ImGui.CloseCurrentPopup();
    }
    ImGui.SameLine();
  }

  if (ImGui.Button('Cancel', new ImVec2(100, 0))) {
    ImGui.CloseCurrentPopup();
  }

  ImGui.EndPopup();
}

/**
 * Clear the state for a component picker (useful when unmounting)
 */
export function clearComponentPickerState(popupId: string): void {
  pickerStates.delete(popupId);
}
