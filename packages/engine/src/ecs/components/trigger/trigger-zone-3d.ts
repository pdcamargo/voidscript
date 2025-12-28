/**
 * TriggerZone3D Component
 *
 * Fires ECS events when entities with specific components enter or leave
 * a 3D sensor collider. This eliminates duplicated logic for "player entered area",
 * "enemy left zone", etc.
 *
 * Requirements for the trigger zone entity:
 * - Must have a Collider3D with `isSensor: true`
 * - Must have ActiveCollisionEvents3D component
 *
 * Events must follow the constructor convention:
 * `new EventClass(triggeringEntity: Entity, zoneEntity: Entity)`
 *
 * @example
 * ```typescript
 * // Define a custom event
 * class PlayerEnteredRoomEvent {
 *   constructor(
 *     public triggeringEntity: Entity,
 *     public zoneEntity: Entity,
 *   ) {}
 * }
 *
 * // Register the event
 * app.addEvent(PlayerEnteredRoomEvent);
 *
 * // Spawn a trigger zone
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 0, 0) })
 *   .with(Collider3D, {
 *     shape: { type: 'cuboid', halfExtents: new Vector3(2, 2, 2) },
 *     isSensor: true,
 *   })
 *   .with(ActiveCollisionEvents3D, {
 *     events: ActiveCollisionEventsFlags3D.COLLISION_EVENTS,
 *   })
 *   .with(TriggerZone3D, {
 *     onEnterEventNames: ['TriggerZoneEnter3D', 'PlayerEnteredRoomEvent'],
 *     onLeaveEventNames: ['TriggerZoneLeave3D'],
 *     requiredComponentNames: ['Player'],
 *     filterMode: 'and',
 *     enabled: true,
 *   })
 *   .build();
 *
 * // Listen for events
 * const roomSystem = system(({ commands }) => {
 *   for (const event of commands.eventReader(PlayerEnteredRoomEvent).read()) {
 *     console.log(`Player ${event.triggeringEntity} entered room`);
 *   }
 * }).runIf(isGameplayActive());
 * ```
 */

import { component } from '../../component.js';
import { Events } from '../../events.js';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';
import type { TriggerFilterMode } from '../../systems/trigger/trigger-utils.js';

export interface TriggerZone3DData {
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


export const TriggerZone3D = component<TriggerZone3DData>(
  'TriggerZone3D',
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
    displayName: 'Trigger Zone 3D',
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
          { events, tooltip: 'Events fired when entities enter this zone', id: '3d_enter' }
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
          { events, tooltip: 'Events fired when entities leave this zone', id: '3d_leave' }
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
        { tooltip: 'Components that triggering entities must have', id: '3d_comps' }
      );
      if (compsChanged) componentData.requiredComponentNames = requiredComps;

      EditorLayout.spacing();

      EditorLayout.beginLabelsWidth(['Filter Mode']);

      // Filter Mode
      const [filterMode, filterModeChanged] = EditorLayout.filterModeField(
        'Filter Mode',
        componentData.filterMode,
        { tooltip: 'How to match required components', id: '3d_filter' }
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
