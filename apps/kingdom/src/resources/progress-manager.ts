/**
 * ProgressManager Resource
 *
 * Manages player progress flags and statistics tracking.
 * Used for achievements, unlocks, and milestone tracking.
 */

import { ProgressFlag } from '../types/enums.js';

/**
 * Record of when a flag was unlocked.
 */
export interface UnlockRecord {
  /** The flag that was unlocked */
  flag: ProgressFlag;
  /** Game time when unlocked */
  gameTime: number;
  /** Day when unlocked */
  day: number;
}

export class ProgressManager {
  // ============================================================================
  // State
  // ============================================================================

  /**
   * Set of all unlocked progress flags.
   */
  private _unlockedFlags: Set<ProgressFlag> = new Set();

  /**
   * Records of when each flag was unlocked.
   */
  private _unlockRecords: Map<ProgressFlag, UnlockRecord> = new Map();

  /**
   * Generic statistics tracking.
   */
  private _statistics: Map<string, number> = new Map();

  /**
   * Flags unlocked this frame (for event firing).
   */
  private _flagsUnlockedThisFrame: ProgressFlag[] = [];

  /**
   * Reference to game time for unlock records.
   */
  private _currentGameTime = 0;
  private _currentDay = 1;

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Get all unlocked flags.
   */
  get unlockedFlags(): ProgressFlag[] {
    return Array.from(this._unlockedFlags);
  }

  /**
   * Get number of unlocked flags.
   */
  get unlockedCount(): number {
    return this._unlockedFlags.size;
  }

  /**
   * Get total number of possible flags.
   */
  get totalFlags(): number {
    return Object.values(ProgressFlag).length;
  }

  /**
   * Get unlock progress as a percentage (0-100).
   */
  get progressPercentage(): number {
    return (this.unlockedCount / this.totalFlags) * 100;
  }

  /**
   * Get flags unlocked this frame.
   */
  get flagsUnlockedThisFrame(): ProgressFlag[] {
    return [...this._flagsUnlockedThisFrame];
  }

  // ============================================================================
  // Time Sync
  // ============================================================================

  /**
   * Update time reference (called by systems).
   */
  updateTimeReference(gameTime: number, day: number): void {
    this._currentGameTime = gameTime;
    this._currentDay = day;
  }

  // ============================================================================
  // Flag Operations
  // ============================================================================

  /**
   * Unlock a progress flag.
   *
   * @param flag Flag to unlock
   * @returns True if newly unlocked, false if already unlocked
   */
  unlock(flag: ProgressFlag): boolean {
    if (this._unlockedFlags.has(flag)) {
      return false;
    }

    this._unlockedFlags.add(flag);
    this._flagsUnlockedThisFrame.push(flag);

    // Record when unlocked
    this._unlockRecords.set(flag, {
      flag,
      gameTime: this._currentGameTime,
      day: this._currentDay,
    });

    return true;
  }

  /**
   * Check if a flag is unlocked.
   */
  isUnlocked(flag: ProgressFlag): boolean {
    return this._unlockedFlags.has(flag);
  }

  /**
   * Check if multiple flags are all unlocked.
   */
  areAllUnlocked(...flags: ProgressFlag[]): boolean {
    return flags.every((f) => this._unlockedFlags.has(f));
  }

  /**
   * Check if any of the given flags are unlocked.
   */
  isAnyUnlocked(...flags: ProgressFlag[]): boolean {
    return flags.some((f) => this._unlockedFlags.has(f));
  }

  /**
   * Get the unlock record for a flag.
   */
  getUnlockRecord(flag: ProgressFlag): UnlockRecord | undefined {
    return this._unlockRecords.get(flag);
  }

  /**
   * Get all unlock records.
   */
  getAllUnlockRecords(): UnlockRecord[] {
    return Array.from(this._unlockRecords.values());
  }

  /**
   * Get unlock records sorted by day/time.
   */
  getUnlockRecordsByDate(): UnlockRecord[] {
    return this.getAllUnlockRecords().sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.gameTime - b.gameTime;
    });
  }

  // ============================================================================
  // Statistics Operations
  // ============================================================================

  /**
   * Set a statistic value.
   */
  setStat(key: string, value: number): void {
    this._statistics.set(key, value);
  }

  /**
   * Get a statistic value.
   */
  getStat(key: string): number {
    return this._statistics.get(key) ?? 0;
  }

  /**
   * Increment a statistic.
   *
   * @param key Statistic key
   * @param amount Amount to add (default: 1)
   * @returns New value
   */
  incrementStat(key: string, amount = 1): number {
    const current = this.getStat(key);
    const newValue = current + amount;
    this._statistics.set(key, newValue);
    return newValue;
  }

  /**
   * Decrement a statistic.
   *
   * @param key Statistic key
   * @param amount Amount to subtract (default: 1)
   * @returns New value
   */
  decrementStat(key: string, amount = 1): number {
    return this.incrementStat(key, -amount);
  }

  /**
   * Check if a statistic meets a threshold.
   */
  statMeetsThreshold(key: string, threshold: number): boolean {
    return this.getStat(key) >= threshold;
  }

  /**
   * Get all statistics.
   */
  getAllStats(): Map<string, number> {
    return new Map(this._statistics);
  }

  // ============================================================================
  // Common Statistics Keys
  // ============================================================================

  static readonly STAT_KEYS = {
    // Combat
    ENEMIES_KILLED: 'enemies_killed',
    PORTALS_DESTROYED: 'portals_destroyed',

    // Economy
    TOTAL_COINS_COLLECTED: 'total_coins_collected',
    TOTAL_DIAMONDS_COLLECTED: 'total_diamonds_collected',

    // Population
    TOTAL_VILLAGERS_HIRED: 'total_villagers_hired',
    TOTAL_VILLAGERS_LOST: 'total_villagers_lost',

    // Building
    TOTAL_BUILDINGS_BUILT: 'total_buildings_built',
    TOTAL_BUILDINGS_DESTROYED: 'total_buildings_destroyed',

    // Time
    TOTAL_DAYS_SURVIVED: 'total_days_survived',
    TOTAL_NIGHTS_SURVIVED: 'total_nights_survived',

    // Exploration
    ISLANDS_DISCOVERED: 'islands_discovered',
  } as const;

  // ============================================================================
  // Frame Management
  // ============================================================================

  /**
   * Reset per-frame data (called at end of frame).
   */
  resetFrameFlags(): void {
    this._flagsUnlockedThisFrame = [];
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Reset all progress data.
   */
  reset(): void {
    this._unlockedFlags.clear();
    this._unlockRecords.clear();
    this._statistics.clear();
    this._flagsUnlockedThisFrame = [];
  }

  /**
   * Get a summary of progress.
   */
  getSummary(): {
    unlockedCount: number;
    totalFlags: number;
    progressPercentage: number;
    statisticCount: number;
  } {
    return {
      unlockedCount: this.unlockedCount,
      totalFlags: this.totalFlags,
      progressPercentage: this.progressPercentage,
      statisticCount: this._statistics.size,
    };
  }

  /**
   * Check and potentially unlock milestone flags based on current stats.
   * Call this after major events to auto-unlock relevant flags.
   */
  checkMilestones(day: number, population: number): void {
    // Day milestones
    if (day >= 5) this.unlock(ProgressFlag.ReachedDay5);
    if (day >= 10) this.unlock(ProgressFlag.ReachedDay10);
    if (day >= 25) this.unlock(ProgressFlag.ReachedDay25);
    if (day >= 50) this.unlock(ProgressFlag.ReachedDay50);

    // Population milestones
    if (population >= 10) this.unlock(ProgressFlag.Population10);
    if (population >= 25) this.unlock(ProgressFlag.Population25);
  }
}

// Register ProgressManager as a resource (internal state, not directly serializable via simple properties)
import { registerResource } from '@voidscript/engine';
registerResource(ProgressManager, false, {
  path: 'kingdom/progress',
  displayName: 'Progress Manager',
  description: 'Manages player progress flags and statistics',
  builtIn: false,
  defaultValue: () => new ProgressManager(),
});
