/**
 * Time-related events for the Kingdom game.
 */

import { TimePhase } from '../types/enums.js';

/**
 * Fired when a new day begins (time wraps from 24 back to 0).
 */
export class DayStarted {
  constructor(
    /** The new day number (1-indexed) */
    public readonly day: number,
  ) {}
}

/**
 * Fired when the time phase changes (e.g., Morning -> Noon).
 */
export class TimePhaseChanged {
  constructor(
    /** The previous time phase */
    public readonly previousPhase: TimePhase,
    /** The new time phase */
    public readonly newPhase: TimePhase,
    /** Current day number */
    public readonly day: number,
    /** Current time (0.0 - 24.0) */
    public readonly currentTime: number,
  ) {}
}
