/**
 * TriggerZone2D Component
 *
 * Fires ECS events when entities with specific components enter or leave
 * a 2D sensor collider. This eliminates duplicated logic for "player entered area",
 * "enemy left zone", etc.
 *
 * Requirements for the trigger zone entity:
 * - Must have a Collider2D with `isSensor: true`
 * - Must have ActiveCollisionEvents2D component
 *
 * Events must follow the constructor convention:
 * `new EventClass(triggeringEntity: Entity, zoneEntity: Entity)`
 *
 * @example
 * ```typescript
 * // Define a custom event
 * class PlayerEnteredShopEvent {
 *   constructor(
 *     public triggeringEntity: Entity,
 *     public zoneEntity: Entity,
 *   ) {}
 * }
 *
 * // Register the event
 * app.addEvent(PlayerEnteredShopEvent);
 *
 * // Spawn a trigger zone
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 0, 0) })
 *   .with(Collider2D, {
 *     shape: { type: 'cuboid', halfWidth: 2, halfHeight: 2 },
 *     isSensor: true,
 *   })
 *   .with(ActiveCollisionEvents2D, {
 *     events: ActiveCollisionEventsFlags2D.COLLISION_EVENTS,
 *   })
 *   .with(TriggerZone2D, {
 *     onEnterEventNames: ['TriggerZoneEnter2D', 'PlayerEnteredShopEvent'],
 *     onLeaveEventNames: ['TriggerZoneLeave2D'],
 *     requiredComponentNames: ['Player2D'],
 *     filterMode: 'and',
 *     enabled: true,
 *   })
 *   .build();
 *
 * // Listen for events
 * const shopSystem = system(({ commands }) => {
 *   for (const event of commands.eventReader(PlayerEnteredShopEvent).read()) {
 *     console.log(`Player ${event.triggeringEntity} entered shop`);
 *   }
 * }).runIf(isGameplayActive());
 * ```
 */

import { ImGui, ImVec2 } from '@mori2003/jsimgui';
import { component } from '../../component.js';
import { Events } from '../../events.js';
import { renderEventNamePicker } from '../../../app/imgui/event-name-picker.js';
import { renderComponentNamePicker } from '../../../app/imgui/component-name-picker.js';
import type { TriggerFilterMode } from '../../systems/trigger/trigger-utils.js';

export interface TriggerZone2DData {
  /**
   * Event names to fire when a qualifying entity enters this zone.
   * Events must be registered via `app.addEvent()` before use.
   */
  onEnterEventNames: string[];

  /**
   * Event names to fire when a qualifying entity leaves this zone.
   * Events must be registered via `app.addEvent()` before use.
   */
  onLeaveEventNames: string[];

  /**
   * Component names that the triggering entity must have.
   * Components are looked up from the global component registry by name.
   */
  requiredComponentNames: string[];

  /**
   * Filter mode for component requirements.
   * - 'and': Entity must have ALL listed components to trigger
   * - 'or': Entity must have at least ONE of the listed components
   * @default 'and'
   */
  filterMode: TriggerFilterMode;

  /**
   * Whether this trigger zone is active.
   * @default true
   */
  enabled: boolean;
}

/**
 * Helper to render a list of names with remove buttons
 */
function renderNameList(
  names: string[],
  idPrefix: string,
  onRemove: (index: number) => void
): void {
  if (names.length === 0) {
    ImGui.TextDisabled('(None)');
    return;
  }

  for (let i = 0; i < names.length; i++) {
    const name = names[i]!;
    ImGui.Text(`  - ${name}`);
    ImGui.SameLine();
    if (ImGui.SmallButton(`X##remove_${idPrefix}_${i}`)) {
      onRemove(i);
    }
  }
}

export const TriggerZone2D = component<TriggerZone2DData>(
  'TriggerZone2D',
  {
    onEnterEventNames: {
      serializable: true,
      collectionType: 'array',
      collectionInstanceType: String,
    },
    onLeaveEventNames: {
      serializable: true,
      collectionType: 'array',
      collectionInstanceType: String,
    },
    requiredComponentNames: {
      serializable: true,
      collectionType: 'array',
      collectionInstanceType: String,
    },
    filterMode: {
      serializable: true,
      type: 'enum',
      enum: { and: 'and', or: 'or' },
    },
    enabled: {
      serializable: true,
      instanceType: Boolean,
    },
  },
  {
    path: 'trigger',
    displayName: 'Trigger Zone 2D',
    description:
      'Fires events when entities with specified components enter or leave this sensor zone',
    defaultValue: () => ({
      onEnterEventNames: [],
      onLeaveEventNames: [],
      requiredComponentNames: [],
      filterMode: 'and',
      enabled: true,
    }),
    customEditor: ({ componentData, commands }) => {
      const events = commands.tryGetResource(Events);

      // Enabled checkbox
      const enabled: [boolean] = [componentData.enabled];
      if (ImGui.Checkbox('Enabled', enabled)) {
        componentData.enabled = enabled[0];
      }

      ImGui.Separator();
      ImGui.Spacing();

      // On Enter Events section
      ImGui.Text('On Enter Events:');
      renderNameList(
        componentData.onEnterEventNames,
        'enter',
        (index) => {
          componentData.onEnterEventNames.splice(index, 1);
        }
      );
      if (ImGui.Button('Add Enter Event##enter')) {
        ImGui.OpenPopup('EventPicker##enter');
      }
      if (events) {
        renderEventNamePicker({
          popupId: 'EventPicker##enter',
          selectedNames: componentData.onEnterEventNames,
          multiSelect: true,
          onSelect: (names) => {
            componentData.onEnterEventNames = names;
          },
          events,
        });
      }

      ImGui.Spacing();
      ImGui.Separator();
      ImGui.Spacing();

      // On Leave Events section
      ImGui.Text('On Leave Events:');
      renderNameList(
        componentData.onLeaveEventNames,
        'leave',
        (index) => {
          componentData.onLeaveEventNames.splice(index, 1);
        }
      );
      if (ImGui.Button('Add Leave Event##leave')) {
        ImGui.OpenPopup('EventPicker##leave');
      }
      if (events) {
        renderEventNamePicker({
          popupId: 'EventPicker##leave',
          selectedNames: componentData.onLeaveEventNames,
          multiSelect: true,
          onSelect: (names) => {
            componentData.onLeaveEventNames = names;
          },
          events,
        });
      }

      ImGui.Spacing();
      ImGui.Separator();
      ImGui.Spacing();

      // Required Components section
      ImGui.Text('Required Components:');
      renderNameList(
        componentData.requiredComponentNames,
        'comp',
        (index) => {
          componentData.requiredComponentNames.splice(index, 1);
        }
      );
      if (ImGui.Button('Add Component Filter##filter')) {
        ImGui.OpenPopup('ComponentPicker##filter');
      }
      renderComponentNamePicker({
        popupId: 'ComponentPicker##filter',
        selectedNames: componentData.requiredComponentNames,
        multiSelect: true,
        onSelect: (names) => {
          componentData.requiredComponentNames = names;
        },
      });

      ImGui.Spacing();

      // Filter Mode
      ImGui.Text('Filter Mode:');
      ImGui.SameLine();

      const isAnd = componentData.filterMode === 'and';
      if (ImGui.RadioButton('ALL (AND)', isAnd)) {
        componentData.filterMode = 'and';
      }
      ImGui.SameLine();
      if (ImGui.RadioButton('ANY (OR)', !isAnd)) {
        componentData.filterMode = 'or';
      }

      ImGui.TextDisabled(
        isAnd
          ? 'Entity must have ALL listed components'
          : 'Entity must have at least ONE of the listed components'
      );
    },
  }
);
