/**
 * UIInteraction Component
 *
 * Enables UI elements to fire ECS events on user interactions.
 * This component works with UIInteractionManager to dispatch events
 * when the user clicks, hovers, presses, or releases UI elements.
 *
 * Events must follow the constructor convention:
 * `new EventClass(entity: Entity)`
 *
 * @example
 * ```typescript
 * // Define custom events
 * class StartGameClicked {
 *   constructor(public entity: Entity) {}
 * }
 *
 * class ButtonHovered {
 *   constructor(public entity: Entity) {}
 * }
 *
 * // Register events
 * app.addEvent(StartGameClicked);
 * app.addEvent(ButtonHovered);
 *
 * // Spawn a button with interactions
 * commands.spawn()
 *   .with(Parent, { id: canvasEntity })
 *   .with(UIButton, {
 *     label: 'Start Game',
 *     width: 200,
 *     height: 50,
 *   })
 *   .with(UIInteraction, {
 *     onClickEventNames: ['StartGameClicked'],
 *     onHoverEnterEventNames: ['ButtonHovered'],
 *     enabled: true,
 *   })
 *   .build();
 *
 * // Listen for events in a system
 * const menuSystem = system(({ commands }) => {
 *   for (const event of commands.eventReader(StartGameClicked).read()) {
 *     console.log(`Start button clicked: ${event.entity}`);
 *     startGame();
 *   }
 * }).runIf(isGameplayActive());
 * ```
 */

import { ImGui } from '@voidscript/imgui';
import { component } from '@voidscript/core';
import { Events } from '@voidscript/core';
import { renderEventNamePicker } from '../../app/imgui/event-name-picker.js';

export interface UIInteractionData {
  /**
   * Event names to fire when the user clicks this element.
   * A click is a complete press + release on the same element.
   * Events must be registered via `app.addEvent()` before use.
   */
  onClickEventNames: string[];

  /**
   * Event names to fire when the user presses down on this element.
   * Fires immediately when the mouse button is pressed.
   * Events must be registered via `app.addEvent()` before use.
   */
  onPressEventNames: string[];

  /**
   * Event names to fire when the user releases this element.
   * Fires when the mouse button is released after pressing this element.
   * Events must be registered via `app.addEvent()` before use.
   */
  onReleaseEventNames: string[];

  /**
   * Event names to fire when the cursor enters this element.
   * Events must be registered via `app.addEvent()` before use.
   */
  onHoverEnterEventNames: string[];

  /**
   * Event names to fire when the cursor leaves this element.
   * Events must be registered via `app.addEvent()` before use.
   */
  onHoverExitEventNames: string[];

  /**
   * Whether this interaction component is active.
   * When disabled, no events will be fired.
   * @default true
   */
  enabled: boolean;
}

// ============================================================================
// Custom Editor - Helper Functions
// ============================================================================

/**
 * Render a list of event names with remove buttons
 */
function renderEventList(
  names: string[],
  idPrefix: string,
  onRemove: (index: number) => void,
): void {
  if (names.length === 0) {
    ImGui.TextDisabled('(None)');
    return;
  }

  for (let i = 0; i < names.length; i++) {
    const name = names[i]!;
    ImGui.Text(`  ${name}`);
    ImGui.SameLine();
    if (ImGui.SmallButton(`X##remove_${idPrefix}_${i}`)) {
      onRemove(i);
    }
  }
}

/**
 * Render a collapsible event section with add/remove functionality
 */
function renderEventSection(
  sectionTitle: string,
  sectionId: string,
  eventNames: string[],
  events: Events | undefined,
  isDefaultOpen: boolean = false,
): void {
  const flags = isDefaultOpen ? ImGui.TreeNodeFlags.DefaultOpen : 0;
  if (ImGui.CollapsingHeader(`${sectionTitle}##${sectionId}`, flags)) {
    ImGui.Indent();

    renderEventList(eventNames, sectionId, (index) => {
      eventNames.splice(index, 1);
    });

    ImGui.Spacing();

    if (ImGui.Button(`Add Event##${sectionId}`)) {
      ImGui.OpenPopup(`EventPicker##${sectionId}`);
    }

    if (events) {
      renderEventNamePicker({
        popupId: `EventPicker##${sectionId}`,
        selectedNames: eventNames,
        multiSelect: true,
        onSelect: (names) => {
          // Clear and push new names to maintain array reference
          eventNames.length = 0;
          eventNames.push(...names);
        },
        events,
      });
    }

    ImGui.Unindent();
  }
}

// ============================================================================
// Component Definition
// ============================================================================

export const UIInteraction = component<UIInteractionData>(
  'UIInteraction',
  {
    onClickEventNames: {
      serializable: true,
      collectionType: 'array',
      collectionInstanceType: String,
    },
    onPressEventNames: {
      serializable: true,
      collectionType: 'array',
      collectionInstanceType: String,
    },
    onReleaseEventNames: {
      serializable: true,
      collectionType: 'array',
      collectionInstanceType: String,
    },
    onHoverEnterEventNames: {
      serializable: true,
      collectionType: 'array',
      collectionInstanceType: String,
    },
    onHoverExitEventNames: {
      serializable: true,
      collectionType: 'array',
      collectionInstanceType: String,
    },
    enabled: {
      serializable: true,
      instanceType: Boolean,
    },
  },
  {
    path: 'ui',
    displayName: 'UI Interaction',
    description: 'Fires ECS events on UI element interactions (click, hover, press, release)',
    defaultValue: () => ({
      onClickEventNames: [],
      onPressEventNames: [],
      onReleaseEventNames: [],
      onHoverEnterEventNames: [],
      onHoverExitEventNames: [],
      enabled: true,
    }),
    customEditor: ({ componentData, commands }) => {
      const events = commands.tryGetResource(Events);

      // Enabled checkbox at top
      const enabled: [boolean] = [componentData.enabled];
      if (ImGui.Checkbox('Enabled', enabled)) {
        componentData.enabled = enabled[0];
      }
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('When disabled, no events will be fired from this element');
      }

      ImGui.Separator();
      ImGui.Spacing();

      // Click Events (default open - most common use case)
      renderEventSection(
        'Click Events',
        'click',
        componentData.onClickEventNames,
        events,
        true,
      );

      ImGui.Spacing();

      // Hover Events
      if (ImGui.CollapsingHeader('Hover Events##hover')) {
        ImGui.Indent();

        ImGui.TextColored({ x: 0.7, y: 0.7, z: 0.7, w: 1.0 }, 'On Enter:');
        renderEventList(componentData.onHoverEnterEventNames, 'hoverEnter', (index) => {
          componentData.onHoverEnterEventNames.splice(index, 1);
        });
        ImGui.Spacing();
        if (ImGui.Button('Add Event##hoverEnter')) {
          ImGui.OpenPopup('EventPicker##hoverEnter');
        }
        if (events) {
          renderEventNamePicker({
            popupId: 'EventPicker##hoverEnter',
            selectedNames: componentData.onHoverEnterEventNames,
            multiSelect: true,
            onSelect: (names) => {
              componentData.onHoverEnterEventNames.length = 0;
              componentData.onHoverEnterEventNames.push(...names);
            },
            events,
          });
        }

        ImGui.Spacing();
        ImGui.Separator();
        ImGui.Spacing();

        ImGui.TextColored({ x: 0.7, y: 0.7, z: 0.7, w: 1.0 }, 'On Exit:');
        renderEventList(componentData.onHoverExitEventNames, 'hoverExit', (index) => {
          componentData.onHoverExitEventNames.splice(index, 1);
        });
        ImGui.Spacing();
        if (ImGui.Button('Add Event##hoverExit')) {
          ImGui.OpenPopup('EventPicker##hoverExit');
        }
        if (events) {
          renderEventNamePicker({
            popupId: 'EventPicker##hoverExit',
            selectedNames: componentData.onHoverExitEventNames,
            multiSelect: true,
            onSelect: (names) => {
              componentData.onHoverExitEventNames.length = 0;
              componentData.onHoverExitEventNames.push(...names);
            },
            events,
          });
        }

        ImGui.Unindent();
      }

      ImGui.Spacing();

      // Press Events
      renderEventSection(
        'Press Events',
        'press',
        componentData.onPressEventNames,
        events,
        false,
      );

      ImGui.Spacing();

      // Release Events
      renderEventSection(
        'Release Events',
        'release',
        componentData.onReleaseEventNames,
        events,
        false,
      );
    },
  },
);
