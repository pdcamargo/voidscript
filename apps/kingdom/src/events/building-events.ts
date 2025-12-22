/**
 * Building-related events for the Kingdom game.
 */

import { BuildingType } from '../types/enums.js';

/**
 * Fired when a new building is constructed.
 */
export class BuildingConstructed {
  constructor(
    /** The building's unique ID */
    public readonly buildingId: string,
    /** Type of building constructed */
    public readonly type: BuildingType,
    /** X position of the building */
    public readonly position: number,
    /** Initial level of the building */
    public readonly level: number,
  ) {}
}

/**
 * Fired when a building is upgraded to a higher level.
 */
export class BuildingUpgraded {
  constructor(
    /** The building's unique ID */
    public readonly buildingId: string,
    /** Type of building upgraded */
    public readonly type: BuildingType,
    /** Previous level */
    public readonly previousLevel: number,
    /** New level */
    public readonly newLevel: number,
  ) {}
}

/**
 * Fired when a building is destroyed (HP reaches 0).
 */
export class BuildingDestroyed {
  constructor(
    /** The building's unique ID */
    public readonly buildingId: string,
    /** Type of building destroyed */
    public readonly type: BuildingType,
    /** X position of the building */
    public readonly position: number,
    /** Level at time of destruction */
    public readonly level: number,
    /** Cause of destruction */
    public readonly cause: 'combat' | 'decay' | 'demolished',
  ) {}
}

/**
 * Fired when a building takes damage.
 */
export class BuildingDamaged {
  constructor(
    /** The building's unique ID */
    public readonly buildingId: string,
    /** Type of building damaged */
    public readonly type: BuildingType,
    /** Damage amount */
    public readonly damage: number,
    /** Remaining health */
    public readonly remainingHealth: number,
    /** Max health */
    public readonly maxHealth: number,
  ) {}
}
