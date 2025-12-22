/**
 * Population-related events for the Kingdom game.
 */

import type { Entity } from '@voidscript/engine';
import { JobType } from '../types/enums.js';

/**
 * Fired when a homeless NPC is hired as a villager.
 */
export class VillagerHired {
  constructor(
    /** The entity ID of the new villager (if visual entity exists) */
    public readonly entity: Entity | null,
    /** The villager's unique ID in PopulationManager */
    public readonly villagerId: string,
    /** The job assigned to the villager */
    public readonly job: JobType,
    /** Current day when hired */
    public readonly day: number,
  ) {}
}

/**
 * Fired when a villager is assigned to a new job.
 */
export class VillagerAssigned {
  constructor(
    /** The entity ID of the villager (if visual entity exists) */
    public readonly entity: Entity | null,
    /** The villager's unique ID in PopulationManager */
    public readonly villagerId: string,
    /** The previous job */
    public readonly previousJob: JobType,
    /** The new job */
    public readonly newJob: JobType,
  ) {}
}

/**
 * Fired when a villager dies.
 */
export class VillagerDied {
  constructor(
    /** The entity ID of the villager (if visual entity exists) */
    public readonly entity: Entity | null,
    /** The villager's unique ID in PopulationManager */
    public readonly villagerId: string,
    /** The job the villager had */
    public readonly job: JobType,
    /** Cause of death */
    public readonly cause: 'combat' | 'starvation' | 'other',
  ) {}
}

/**
 * Fired when a homeless NPC spawns in the world.
 */
export class HomelessSpawned {
  constructor(
    /** The homeless person's unique ID */
    public readonly homelessId: string,
    /** X position where they spawned */
    public readonly spawnX: number,
  ) {}
}
