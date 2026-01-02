import type { Entity } from '@voidscript/core';

/**
 * Event fired when an entity enters a 2D trigger zone.
 *
 * This is a built-in event for simple trigger use cases.
 * Users can also define custom events with additional data.
 *
 * @example
 * ```ts
 * // Listen for trigger zone enter events
 * const mySystem = system(({ commands }) => {
 *   for (const event of commands.eventReader(TriggerZoneEnter2D).read()) {
 *     console.log(`Entity ${event.triggeringEntity} entered zone ${event.zoneEntity}`);
 *   }
 * }).runIf(isGameplayActive());
 * ```
 */
export class TriggerZoneEnter2D {
  constructor(
    /** The entity that entered the trigger zone */
    public readonly triggeringEntity: Entity,
    /** The trigger zone entity */
    public readonly zoneEntity: Entity
  ) {}
}

/**
 * Event fired when an entity leaves a 2D trigger zone.
 *
 * This is a built-in event for simple trigger use cases.
 * Users can also define custom events with additional data.
 *
 * @example
 * ```ts
 * // Listen for trigger zone leave events
 * const mySystem = system(({ commands }) => {
 *   for (const event of commands.eventReader(TriggerZoneLeave2D).read()) {
 *     console.log(`Entity ${event.triggeringEntity} left zone ${event.zoneEntity}`);
 *   }
 * }).runIf(isGameplayActive());
 * ```
 */
export class TriggerZoneLeave2D {
  constructor(
    /** The entity that left the trigger zone */
    public readonly triggeringEntity: Entity,
    /** The trigger zone entity */
    public readonly zoneEntity: Entity
  ) {}
}

/**
 * Event fired when an entity enters a 3D trigger zone.
 *
 * This is a built-in event for simple trigger use cases.
 * Users can also define custom events with additional data.
 *
 * @example
 * ```ts
 * // Listen for trigger zone enter events
 * const mySystem = system(({ commands }) => {
 *   for (const event of commands.eventReader(TriggerZoneEnter3D).read()) {
 *     console.log(`Entity ${event.triggeringEntity} entered zone ${event.zoneEntity}`);
 *   }
 * }).runIf(isGameplayActive());
 * ```
 */
export class TriggerZoneEnter3D {
  constructor(
    /** The entity that entered the trigger zone */
    public readonly triggeringEntity: Entity,
    /** The trigger zone entity */
    public readonly zoneEntity: Entity
  ) {}
}

/**
 * Event fired when an entity leaves a 3D trigger zone.
 *
 * This is a built-in event for simple trigger use cases.
 * Users can also define custom events with additional data.
 *
 * @example
 * ```ts
 * // Listen for trigger zone leave events
 * const mySystem = system(({ commands }) => {
 *   for (const event of commands.eventReader(TriggerZoneLeave3D).read()) {
 *     console.log(`Entity ${event.triggeringEntity} left zone ${event.zoneEntity}`);
 *   }
 * }).runIf(isGameplayActive());
 * ```
 */
export class TriggerZoneLeave3D {
  constructor(
    /** The entity that left the trigger zone */
    public readonly triggeringEntity: Entity,
    /** The trigger zone entity */
    public readonly zoneEntity: Entity
  ) {}
}
