/**
 * EconomyManager Resource
 *
 * Manages the kingdom's economy including coins, diamonds, and transaction history.
 */

/**
 * A recorded transaction.
 */
export interface Transaction {
  /** Unique transaction ID */
  id: string;
  /** Transaction type */
  type: 'earn' | 'spend';
  /** Currency type */
  currency: 'coins' | 'diamonds';
  /** Amount (always positive) */
  amount: number;
  /** Source/reason for transaction */
  source: string;
  /** Game time when transaction occurred */
  gameTime: number;
  /** Day when transaction occurred */
  day: number;
}

export class EconomyManager {
  // ============================================================================
  // State
  // ============================================================================

  /**
   * Current coin balance.
   */
  private _coins = 0;

  /**
   * Current diamond balance.
   */
  private _diamonds = 0;

  /**
   * Total coins earned (lifetime).
   */
  totalEarned = 0;

  /**
   * Total coins spent (lifetime).
   */
  totalSpent = 0;

  /**
   * Transaction history.
   */
  private _transactionHistory: Transaction[] = [];

  /**
   * Maximum transactions to keep in history.
   */
  maxHistorySize = 100;

  /**
   * Counter for generating transaction IDs.
   */
  private _idCounter = 0;

  /**
   * Reference to game time manager for transaction timestamps.
   */
  private _currentGameTime = 0;
  private _currentDay = 1;

  // ============================================================================
  // Getters/Setters
  // ============================================================================

  /**
   * Get/set current coin balance.
   */
  get coins(): number {
    return this._coins;
  }
  set coins(value: number) {
    this._coins = Math.max(0, value);
  }

  /**
   * Get/set current diamond balance.
   */
  get diamonds(): number {
    return this._diamonds;
  }
  set diamonds(value: number) {
    this._diamonds = Math.max(0, value);
  }

  /**
   * Get transaction history (read-only copy).
   */
  get transactionHistory(): Transaction[] {
    return [...this._transactionHistory];
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
  // Coin Operations
  // ============================================================================

  /**
   * Add coins to the balance.
   *
   * @param amount Amount to add (must be positive)
   * @param source Reason for earning (e.g., 'farming', 'tax')
   * @returns New balance
   */
  addCoins(amount: number, source: string): number {
    if (amount <= 0) return this._coins;

    this._coins += amount;
    this.totalEarned += amount;

    this.recordTransaction('earn', 'coins', amount, source);

    return this._coins;
  }

  /**
   * Spend coins from the balance.
   *
   * @param amount Amount to spend (must be positive)
   * @param source Reason for spending (e.g., 'building_wall', 'hiring')
   * @returns True if successful, false if insufficient funds
   */
  spendCoins(amount: number, source: string): boolean {
    if (amount <= 0) return true;
    if (this._coins < amount) return false;

    this._coins -= amount;
    this.totalSpent += amount;

    this.recordTransaction('spend', 'coins', amount, source);

    return true;
  }

  /**
   * Check if we can afford a coin cost.
   */
  canAffordCoins(amount: number): boolean {
    return this._coins >= amount;
  }

  /**
   * Set coins directly (for loading saves, debugging).
   */
  setCoins(amount: number): void {
    this._coins = Math.max(0, amount);
  }

  // ============================================================================
  // Diamond Operations
  // ============================================================================

  /**
   * Add diamonds to the balance.
   *
   * @param amount Amount to add (must be positive)
   * @param source Reason for earning
   * @returns New balance
   */
  addDiamonds(amount: number, source: string): number {
    if (amount <= 0) return this._diamonds;

    this._diamonds += amount;

    this.recordTransaction('earn', 'diamonds', amount, source);

    return this._diamonds;
  }

  /**
   * Spend diamonds from the balance.
   *
   * @param amount Amount to spend (must be positive)
   * @param source Reason for spending
   * @returns True if successful, false if insufficient funds
   */
  spendDiamonds(amount: number, source: string): boolean {
    if (amount <= 0) return true;
    if (this._diamonds < amount) return false;

    this._diamonds -= amount;

    this.recordTransaction('spend', 'diamonds', amount, source);

    return true;
  }

  /**
   * Check if we can afford a diamond cost.
   */
  canAffordDiamonds(amount: number): boolean {
    return this._diamonds >= amount;
  }

  /**
   * Set diamonds directly (for loading saves, debugging).
   */
  setDiamonds(amount: number): void {
    this._diamonds = Math.max(0, amount);
  }

  // ============================================================================
  // Combined Operations
  // ============================================================================

  /**
   * Check if we can afford a combined cost.
   */
  canAfford(coins: number, diamonds = 0): boolean {
    return this._coins >= coins && this._diamonds >= diamonds;
  }

  /**
   * Spend both coins and diamonds.
   *
   * @returns True if successful, false if insufficient funds for either
   */
  spend(coins: number, diamonds: number, source: string): boolean {
    if (!this.canAfford(coins, diamonds)) return false;

    if (coins > 0) {
      this.spendCoins(coins, source);
    }
    if (diamonds > 0) {
      this.spendDiamonds(diamonds, source);
    }

    return true;
  }

  // ============================================================================
  // Transaction History
  // ============================================================================

  /**
   * Record a transaction.
   */
  private recordTransaction(
    type: 'earn' | 'spend',
    currency: 'coins' | 'diamonds',
    amount: number,
    source: string,
  ): void {
    const transaction: Transaction = {
      id: `txn_${++this._idCounter}`,
      type,
      currency,
      amount,
      source,
      gameTime: this._currentGameTime,
      day: this._currentDay,
    };

    this._transactionHistory.push(transaction);

    // Trim history if needed
    if (this._transactionHistory.length > this.maxHistorySize) {
      this._transactionHistory.shift();
    }
  }

  /**
   * Get transactions from a specific day.
   */
  getTransactionsByDay(day: number): Transaction[] {
    return this._transactionHistory.filter((t) => t.day === day);
  }

  /**
   * Get transactions with a specific source.
   */
  getTransactionsBySource(source: string): Transaction[] {
    return this._transactionHistory.filter((t) => t.source === source);
  }

  /**
   * Get transactions of a specific type.
   */
  getTransactionsByType(type: 'earn' | 'spend'): Transaction[] {
    return this._transactionHistory.filter((t) => t.type === type);
  }

  /**
   * Calculate total income for a specific day.
   */
  getDailyIncome(day: number): number {
    return this.getTransactionsByDay(day)
      .filter((t) => t.type === 'earn' && t.currency === 'coins')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  /**
   * Calculate total spending for a specific day.
   */
  getDailySpending(day: number): number {
    return this.getTransactionsByDay(day)
      .filter((t) => t.type === 'spend' && t.currency === 'coins')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  /**
   * Get net income for a specific day (income - spending).
   */
  getDailyNet(day: number): number {
    return this.getDailyIncome(day) - this.getDailySpending(day);
  }

  /**
   * Clear transaction history.
   */
  clearHistory(): void {
    this._transactionHistory = [];
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Reset all economy data.
   */
  reset(): void {
    this._coins = 0;
    this._diamonds = 0;
    this.totalEarned = 0;
    this.totalSpent = 0;
    this._transactionHistory = [];
    this._idCounter = 0;
  }

  /**
   * Get a summary of the current economy state.
   */
  getSummary(): {
    coins: number;
    diamonds: number;
    totalEarned: number;
    totalSpent: number;
    transactionCount: number;
  } {
    return {
      coins: this._coins,
      diamonds: this._diamonds,
      totalEarned: this.totalEarned,
      totalSpent: this.totalSpent,
      transactionCount: this._transactionHistory.length,
    };
  }
}

// Register EconomyManager as a resource with serializable properties
import { registerResource } from '@voidscript/engine';
registerResource(EconomyManager, {
  coins: {
    serializable: true,
    instanceType: Number,
    tooltip: 'Current coin balance',
  },
  diamonds: {
    serializable: true,
    instanceType: Number,
    tooltip: 'Current diamond balance',
  },
  totalEarned: {
    serializable: true,
    instanceType: Number,
    tooltip: 'Total coins earned (lifetime)',
  },
  totalSpent: {
    serializable: true,
    instanceType: Number,
    tooltip: 'Total coins spent (lifetime)',
  },
  maxHistorySize: {
    serializable: true,
    instanceType: Number,
    tooltip: 'Maximum transactions to keep in history',
  },
}, {
  path: 'kingdom/economy',
  displayName: 'Economy Manager',
  description: 'Manages coins, diamonds, and transactions',
  builtIn: false,
  defaultValue: () => new EconomyManager(),
});
