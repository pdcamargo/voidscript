/**
 * Progress-related events for the Kingdom game.
 */

import { ProgressFlag } from '../types/enums.js';

/**
 * Fired when a progress flag is unlocked for the first time.
 */
export class ProgressUnlocked {
  constructor(
    /** The flag that was unlocked */
    public readonly flag: ProgressFlag,
    /** Current day when unlocked */
    public readonly day: number,
    /** Game time when unlocked */
    public readonly gameTime: number,
  ) {}
}

/**
 * Fired when a statistic is updated.
 */
export class StatisticUpdated {
  constructor(
    /** The statistic key */
    public readonly key: string,
    /** Previous value */
    public readonly previousValue: number,
    /** New value */
    public readonly newValue: number,
  ) {}
}
