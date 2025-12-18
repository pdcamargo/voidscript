/**
 * Seeded Random Number Generator
 *
 * A deterministic pseudo-random number generator using the Mulberry32 algorithm.
 * Given the same seed, it will always produce the same sequence of numbers.
 *
 * Features:
 * - Fast and lightweight
 * - Good statistical distribution
 * - Coordinate-based hashing for spatial determinism
 * - Fork support for creating independent child generators
 *
 * @example
 * ```typescript
 * const rng = new SeededRandom(12345);
 * console.log(rng.next());        // Always the same value for seed 12345
 * console.log(rng.range(0, 100)); // Random float in [0, 100)
 * console.log(rng.nextInt(10));   // Random int in [0, 10)
 *
 * // Coordinate-based (same x,y always gives same result)
 * console.log(rng.at(5, 10));     // Deterministic for position (5, 10)
 * ```
 */
export class SeededRandom {
  private state: number;
  private readonly initialSeed: number;

  /**
   * Create a new seeded random number generator
   * @param seed - Numeric seed or string (will be hashed)
   */
  constructor(seed: number | string) {
    this.initialSeed = typeof seed === 'string' ? this.hashString(seed) : seed;
    this.state = this.initialSeed;
  }

  /**
   * Generate the next random number in [0, 1)
   *
   * Uses the Mulberry32 algorithm - fast and good distribution
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate a random integer in [0, max)
   * @param max - Exclusive upper bound
   */
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  /**
   * Generate a random float in [min, max)
   * @param min - Inclusive lower bound
   * @param max - Exclusive upper bound
   */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Generate a random integer in [min, max]
   * @param min - Inclusive lower bound
   * @param max - Inclusive upper bound
   */
  rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /**
   * Generate a deterministic random value for a coordinate
   *
   * This is useful for procedural generation where you need the same
   * random value for a given (x, y) position regardless of generation order.
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns Random value in [0, 1) that is always the same for this (x, y)
   */
  at(x: number, y: number): number {
    // Hash the coordinates with the seed using prime multipliers
    const coordHash =
      this.initialSeed ^ (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263));
    // Create a temporary generator with the coordinate hash
    let t = (coordHash + 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate a deterministic random value for a 3D coordinate
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param z - Z coordinate
   * @returns Random value in [0, 1)
   */
  at3D(x: number, y: number, z: number): number {
    const coordHash =
      this.initialSeed ^
      (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1013904223));
    let t = (coordHash + 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Randomly shuffle an array in-place using Fisher-Yates algorithm
   * @param array - Array to shuffle
   * @returns The same array, shuffled
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      const temp = array[i]!;
      array[i] = array[j]!;
      array[j] = temp;
    }
    return array;
  }

  /**
   * Pick a random element from an array
   * @param array - Array to pick from
   * @returns A random element
   */
  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return array[this.nextInt(array.length)]!;
  }

  /**
   * Pick a random element from an array with weighted probabilities
   * @param items - Array of items with weights
   * @returns The picked item
   */
  pickWeighted<T>(items: Array<{ item: T; weight: number }>): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from empty array');
    }

    const totalWeight = items.reduce((sum, { weight }) => sum + weight, 0);
    let random = this.next() * totalWeight;

    for (const { item, weight } of items) {
      random -= weight;
      if (random <= 0) {
        return item;
      }
    }

    // Fallback (shouldn't happen with valid weights)
    return items[items.length - 1]!.item;
  }

  /**
   * Generate a random boolean with optional probability
   * @param probability - Probability of true (default: 0.5)
   */
  bool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Generate a random value from a Gaussian (normal) distribution
   * Uses the Box-Muller transform
   * @param mean - Mean of the distribution (default: 0)
   * @param stdDev - Standard deviation (default: 1)
   */
  gaussian(mean: number = 0, stdDev: number = 1): number {
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * Get the initial seed used to create this generator
   */
  getSeed(): number {
    return this.initialSeed;
  }

  /**
   * Reset the generator to its initial state
   */
  reset(): void {
    this.state = this.initialSeed;
  }

  /**
   * Create a new independent generator derived from this one
   *
   * The forked generator will have a different seed derived from
   * the current state, so it produces a different sequence.
   */
  fork(): SeededRandom {
    // Use current state to derive a new seed
    const newSeed = Math.floor(this.next() * 0xffffffff);
    return new SeededRandom(newSeed);
  }

  /**
   * Create a child generator for a specific purpose/namespace
   *
   * This is useful when you want deterministic sub-sequences
   * that don't interfere with the main sequence.
   *
   * @param namespace - String identifier for this child generator
   */
  child(namespace: string): SeededRandom {
    const nameHash = this.hashString(namespace);
    return new SeededRandom(this.initialSeed ^ nameHash);
  }

  /**
   * Hash a string to a 32-bit integer
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return hash;
  }
}
