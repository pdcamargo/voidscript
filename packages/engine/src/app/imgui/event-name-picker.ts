import { ImGui, ImVec2 } from '@voidscript/imgui';
import type { Events } from '../../ecs/events.js';

export interface EventNamePickerOptions {
  /** Popup ID (must be unique) */
  popupId: string;

  /** Current selected event names */
  selectedNames: string[];

  /** Allow multiple selection */
  multiSelect: boolean;

  /** Callback when selection changes */
  onSelect: (eventNames: string[]) => void;

  /** Events resource for looking up registered events */
  events: Events;

  /** Popup width */
  width?: number;

  /** Popup height */
  height?: number;
}

interface EventPickerState {
  searchText: string;
  selectedIndices: Set<number>;
}

// State management for event pickers (keyed by popupId)
const pickerStates = new Map<string, EventPickerState>();

function getOrCreateState(popupId: string): EventPickerState {
  if (!pickerStates.has(popupId)) {
    pickerStates.set(popupId, {
      searchText: '',
      selectedIndices: new Set(),
    });
  }
  return pickerStates.get(popupId)!;
}

/**
 * Fuzzy match algorithm - checks if search term matches event name
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
 * Render an event name picker popup
 * Call ImGui.OpenPopup(options.popupId) before calling this to show the popup
 *
 * @example
 * ```ts
 * const events = commands.getResource(Events);
 *
 * if (ImGui.Button('Pick Event')) {
 *   ImGui.OpenPopup('MyEventPicker');
 * }
 *
 * renderEventNamePicker({
 *   popupId: 'MyEventPicker',
 *   selectedNames: selectedEvents,
 *   multiSelect: true,
 *   onSelect: (names) => {
 *     selectedEvents = names;
 *   },
 *   events,
 * });
 * ```
 */
export function renderEventNamePicker(options: EventNamePickerOptions): void {
  const {
    popupId,
    selectedNames,
    multiSelect,
    onSelect,
    events,
    width = 400,
    height = 300,
  } = options;

  const state = getOrCreateState(popupId);
  const popupOpen: [boolean] = [true];

  const isOpen = ImGui.BeginPopupModal(
    popupId,
    popupOpen,
    ImGui.WindowFlags.AlwaysAutoResize
  );
  if (!isOpen) {
    return;
  }

  // Title
  ImGui.Text(multiSelect ? 'Select Events' : 'Select Event');
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

  // Get all registered event names
  const allEventNames = events.getRegisteredEventNames();

  // Filter by search text
  const filteredEventNames = allEventNames.filter((name) =>
    fuzzyMatch(state.searchText, name)
  );

  // Event list
  ImGui.BeginChild('EventList', new ImVec2(width, height), ImGui.ChildFlags.Borders);

  if (filteredEventNames.length === 0) {
    ImGui.TextDisabled('No events found');
  } else {
    for (let i = 0; i < filteredEventNames.length; i++) {
      const eventName = filteredEventNames[i]!;
      const isSelected = selectedNames.includes(eventName);

      if (multiSelect) {
        // Checkbox for multi-select
        const checked: [boolean] = [isSelected];
        if (ImGui.Checkbox(`##checkbox_${i}`, checked)) {
          const newSelection = new Set(selectedNames);
          if (checked[0]) {
            newSelection.add(eventName);
          } else {
            newSelection.delete(eventName);
          }
          onSelect(Array.from(newSelection));
        }
        ImGui.SameLine();
        ImGui.Text(eventName);
      } else {
        // Selectable for single-select
        if (ImGui.Selectable(eventName, isSelected)) {
          onSelect([eventName]);
          ImGui.CloseCurrentPopup();
        }
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
 * Clear the state for an event picker (useful when unmounting)
 */
export function clearEventPickerState(popupId: string): void {
  pickerStates.delete(popupId);
}
