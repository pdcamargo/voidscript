/**
 * Economy-related events for the Kingdom game.
 */

/**
 * Fired when the player's currency changes.
 */
export class CurrencyChanged {
  constructor(
    /** Which currency changed */
    public readonly currency: 'coins' | 'diamonds',
    /** Previous amount */
    public readonly previousAmount: number,
    /** New amount */
    public readonly newAmount: number,
    /** Change amount (positive = earned, negative = spent) */
    public readonly delta: number,
    /** Source of the change (e.g., 'farming', 'tax', 'building_wall') */
    public readonly source: string,
  ) {}

  /**
   * Check if this was an earning (positive change).
   */
  get isEarning(): boolean {
    return this.delta > 0;
  }

  /**
   * Check if this was a spending (negative change).
   */
  get isSpending(): boolean {
    return this.delta < 0;
  }
}

/**
 * Fired when a transaction is recorded (for history tracking).
 */
export class TransactionRecorded {
  constructor(
    /** Transaction ID */
    public readonly transactionId: string,
    /** Transaction type */
    public readonly type: 'earn' | 'spend',
    /** Currency type */
    public readonly currency: 'coins' | 'diamonds',
    /** Amount */
    public readonly amount: number,
    /** Source description */
    public readonly source: string,
    /** Game time when recorded */
    public readonly gameTime: number,
    /** Day when recorded */
    public readonly day: number,
  ) {}
}
