import type { Entity } from '../../entity.js';
import type { Command } from '../../command.js';
import { globalComponentRegistry } from '../../component.js';
import { Events } from '../../events.js';

/**
 * Filter mode for component requirements on trigger zones.
 */
export type TriggerFilterMode = 'and' | 'or';

/**
 * Check if an entity passes the trigger zone's component filter.
 *
 * @param commands - ECS commands for component lookup
 * @param entity - Entity to check
 * @param requiredComponentNames - Component names that the entity must have
 * @param filterMode - 'and' = entity must have ALL components, 'or' = entity must have ANY
 * @returns true if the entity passes the filter
 */
export function passesTriggerFilter(
  commands: Command,
  entity: Entity,
  requiredComponentNames: string[],
  filterMode: TriggerFilterMode,
): boolean {
  // Empty requirements = any entity can trigger
  if (requiredComponentNames.length === 0) {
    return true;
  }

  if (filterMode === 'and') {
    // Entity must have ALL components
    return requiredComponentNames.every((name) => {
      const componentType = globalComponentRegistry.getByName(name);
      return componentType && commands.hasComponent(entity, componentType);
    });
  } else {
    // Entity must have at least ONE component
    return requiredComponentNames.some((name) => {
      const componentType = globalComponentRegistry.getByName(name);
      return componentType && commands.hasComponent(entity, componentType);
    });
  }
}

/**
 * Dispatch trigger events dynamically by name.
 *
 * Events must follow the constructor convention:
 * `new EventClass(triggeringEntity: Entity, zoneEntity: Entity)`
 *
 * @param commands - ECS commands for event dispatch
 * @param eventNames - Names of events to dispatch
 * @param zoneEntity - The trigger zone entity
 * @param triggeringEntity - The entity that entered/left the zone
 */
export function dispatchTriggerEvents(
  commands: Command,
  eventNames: string[],
  zoneEntity: Entity,
  triggeringEntity: Entity,
): void {
  const events = commands.tryGetResource(Events);
  if (!events) {
    console.warn('[TriggerZone] Events resource not found');
    return;
  }

  for (const eventName of eventNames) {
    const EventClass = events.getEventClass(eventName);
    if (!EventClass) {
      console.warn(`[TriggerZone] Event "${eventName}" not registered`);
      continue;
    }

    try {
      // Create event instance with triggering entity ID
      // All trigger events must accept (triggeringEntity, zoneEntity) in constructor
      const writer = commands.eventWriter(EventClass);
      writer.send(new EventClass(triggeringEntity, zoneEntity));
    } catch (error) {
      console.error(
        `[TriggerZone] Failed to dispatch event "${eventName}":`,
        error,
      );
    }
  }
}
