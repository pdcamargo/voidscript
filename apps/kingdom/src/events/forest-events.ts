import type { Entity } from '@voidscript/engine';

/**
 * Event emitted when an entity enters a forest zone.
 */
export class EnteredForest {
  constructor(
    /** The entity that entered the forest (e.g., player) */
    public readonly entity: Entity,
    /** The forest zone entity (sensor) */
    public readonly forestZone: Entity,
  ) {}
}

/**
 * Event emitted when an entity exits a forest zone.
 */
export class ExitedForest {
  constructor(
    /** The entity that exited the forest (e.g., player) */
    public readonly entity: Entity,
    /** The forest zone entity (sensor) */
    public readonly forestZone: Entity,
  ) {}
}
