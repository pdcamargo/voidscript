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

import { component } from '@voidscript/core';
import { Events } from '@voidscript/core';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';
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

      EditorLayout.beginLabelsWidth(['Enabled', 'Filter Mode']);

      // Enabled checkbox
      const [enabled, enabledChanged] = EditorLayout.checkboxField('Enabled', componentData.enabled, {
        tooltip: 'Whether this trigger zone is active'
      });
      if (enabledChanged) componentData.enabled = enabled;

      EditorLayout.endLabelsWidth();

      EditorLayout.separator();
      EditorLayout.spacing();

      // On Enter Events section
      if (events) {
        const [enterEvents, enterChanged] = EditorLayout.eventNamesField(
          'On Enter Events',
          componentData.onEnterEventNames,
          { events, tooltip: 'Events fired when entities enter this zone', id: '2d_enter' }
        );
        if (enterChanged) componentData.onEnterEventNames = enterEvents;
      } else {
        EditorLayout.text('On Enter Events:');
        EditorLayout.textDisabled('(Events resource not available)');
      }

      EditorLayout.spacing();
      EditorLayout.separator();
      EditorLayout.spacing();

      // On Leave Events section
      if (events) {
        const [leaveEvents, leaveChanged] = EditorLayout.eventNamesField(
          'On Leave Events',
          componentData.onLeaveEventNames,
          { events, tooltip: 'Events fired when entities leave this zone', id: '2d_leave' }
        );
        if (leaveChanged) componentData.onLeaveEventNames = leaveEvents;
      } else {
        EditorLayout.text('On Leave Events:');
        EditorLayout.textDisabled('(Events resource not available)');
      }

      EditorLayout.spacing();
      EditorLayout.separator();
      EditorLayout.spacing();

      // Required Components section
      const [requiredComps, compsChanged] = EditorLayout.componentNamesField(
        'Required Components',
        componentData.requiredComponentNames,
        { tooltip: 'Components that triggering entities must have', id: '2d_comps' }
      );
      if (compsChanged) componentData.requiredComponentNames = requiredComps;

      EditorLayout.spacing();

      EditorLayout.beginLabelsWidth(['Filter Mode']);

      // Filter Mode
      const [filterMode, filterModeChanged] = EditorLayout.filterModeField(
        'Filter Mode',
        componentData.filterMode,
        { tooltip: 'How to match required components', id: '2d_filter' }
      );
      if (filterModeChanged) componentData.filterMode = filterMode;

      EditorLayout.endLabelsWidth();

      EditorLayout.textDisabled(
        filterMode === 'and'
          ? 'Entity must have ALL listed components'
          : 'Entity must have at least ONE of the listed components'
      );
    },
  }
);
