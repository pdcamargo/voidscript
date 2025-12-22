/**
 * PopulationManager Resource
 *
 * Manages the kingdom's population including villagers and homeless NPCs.
 * Tracks job assignments, population counts, and capacity.
 */

import { JobType, VillagerState, ToolType } from '../types/enums.js';

/**
 * State of a single villager in the simulation.
 */
export interface VillagerSimState {
  /** Unique identifier for this villager */
  id: string;
  /** Current job assignment */
  job: JobType;
  /** Current health points */
  hp: number;
  /** Maximum health points */
  maxHp: number;
  /** Current state (idle, working, etc) */
  state: VillagerState;
  /** Day when hired */
  hireDay: number;
  /** Equipped tool */
  tool: ToolType;
  /** X position in world (for simulation) */
  positionX: number;
}

/**
 * State of a homeless NPC in the simulation.
 */
export interface HomelessSimState {
  /** Unique identifier */
  id: string;
  /** X position where they spawn/wander */
  spawnX: number;
  /** Wander radius */
  wanderRadius: number;
  /** Cost to recruit (coins) */
  recruitCost: number;
}

export class PopulationManager {
  // ============================================================================
  // State
  // ============================================================================

  /**
   * All villagers in the kingdom.
   */
  private _villagers: Map<string, VillagerSimState> = new Map();

  /**
   * All homeless NPCs in the world.
   */
  private _homeless: Map<string, HomelessSimState> = new Map();

  /**
   * Cached count of villagers per job type.
   */
  private _jobCounts: Map<JobType, number> = new Map();

  /**
   * Maximum population allowed (based on buildings).
   */
  maxPopulation = 10;

  /**
   * Base HP for new villagers.
   */
  baseVillagerHp = 100;

  /**
   * Counter for generating unique IDs.
   */
  private _idCounter = 0;

  // ============================================================================
  // Constructor
  // ============================================================================

  constructor() {
    // Initialize job counts
    for (const job of Object.values(JobType)) {
      this._jobCounts.set(job, 0);
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Get total number of villagers.
   */
  get totalVillagers(): number {
    return this._villagers.size;
  }

  /**
   * Get total number of homeless NPCs.
   */
  get totalHomeless(): number {
    return this._homeless.size;
  }

  /**
   * Get number of villagers with a specific job.
   */
  getJobCount(job: JobType): number {
    return this._jobCounts.get(job) ?? 0;
  }

  /**
   * Get all job counts.
   */
  get jobCounts(): Map<JobType, number> {
    return new Map(this._jobCounts);
  }

  /**
   * Get number of idle (unassigned) villagers.
   */
  get availableWorkers(): number {
    return this._jobCounts.get(JobType.Idle) ?? 0;
  }

  /**
   * Check if we can hire more villagers.
   */
  canHireMore(): boolean {
    return this.totalVillagers < this.maxPopulation;
  }

  /**
   * Get remaining population capacity.
   */
  get remainingCapacity(): number {
    return Math.max(0, this.maxPopulation - this.totalVillagers);
  }

  // ============================================================================
  // Villager Management
  // ============================================================================

  /**
   * Create a new villager (e.g., from hiring homeless).
   *
   * @param job Initial job assignment
   * @param day Current day
   * @param positionX X position in world
   * @returns The new villager's ID, or null if at capacity
   */
  createVillager(
    job: JobType = JobType.Idle,
    day: number,
    positionX: number,
  ): string | null {
    if (!this.canHireMore()) {
      return null;
    }

    const id = `villager_${++this._idCounter}`;
    const villager: VillagerSimState = {
      id,
      job,
      hp: this.baseVillagerHp,
      maxHp: this.baseVillagerHp,
      state: VillagerState.Idle,
      hireDay: day,
      tool: this.getToolForJob(job),
      positionX,
    };

    this._villagers.set(id, villager);
    this.incrementJobCount(job);

    return id;
  }

  /**
   * Remove a villager (death, etc).
   *
   * @param id Villager ID
   * @returns The removed villager state, or null if not found
   */
  removeVillager(id: string): VillagerSimState | null {
    const villager = this._villagers.get(id);
    if (!villager) return null;

    this._villagers.delete(id);
    this.decrementJobCount(villager.job);

    return villager;
  }

  /**
   * Get a villager by ID.
   */
  getVillager(id: string): VillagerSimState | undefined {
    return this._villagers.get(id);
  }

  /**
   * Get all villagers.
   */
  getAllVillagers(): VillagerSimState[] {
    return Array.from(this._villagers.values());
  }

  /**
   * Get villagers with a specific job.
   */
  getVillagersWithJob(job: JobType): VillagerSimState[] {
    return this.getAllVillagers().filter((v) => v.job === job);
  }

  /**
   * Assign a villager to a new job.
   *
   * @param id Villager ID
   * @param newJob New job assignment
   * @returns Previous job, or null if villager not found
   */
  assignJob(id: string, newJob: JobType): JobType | null {
    const villager = this._villagers.get(id);
    if (!villager) return null;

    const previousJob = villager.job;
    if (previousJob === newJob) return previousJob;

    // Update job counts
    this.decrementJobCount(previousJob);
    this.incrementJobCount(newJob);

    // Update villager
    villager.job = newJob;
    villager.tool = this.getToolForJob(newJob);
    villager.state = VillagerState.Idle; // Reset state when reassigned

    return previousJob;
  }

  /**
   * Update villager state.
   */
  setVillagerState(id: string, state: VillagerState): void {
    const villager = this._villagers.get(id);
    if (villager) {
      villager.state = state;
    }
  }

  /**
   * Damage a villager.
   *
   * @returns Remaining HP, or -1 if villager not found
   */
  damageVillager(id: string, damage: number): number {
    const villager = this._villagers.get(id);
    if (!villager) return -1;

    villager.hp = Math.max(0, villager.hp - damage);
    if (villager.hp <= 0) {
      villager.state = VillagerState.Dead;
    }

    return villager.hp;
  }

  /**
   * Heal a villager.
   */
  healVillager(id: string, amount: number): void {
    const villager = this._villagers.get(id);
    if (villager && villager.state !== VillagerState.Dead) {
      villager.hp = Math.min(villager.maxHp, villager.hp + amount);
    }
  }

  // ============================================================================
  // Homeless Management
  // ============================================================================

  /**
   * Spawn a new homeless NPC.
   *
   * @param spawnX X position to spawn at
   * @param wanderRadius How far they roam
   * @param recruitCost Cost to hire (coins)
   * @returns The homeless NPC's ID
   */
  spawnHomeless(
    spawnX: number,
    wanderRadius = 50,
    recruitCost = 1,
  ): string {
    const id = `homeless_${++this._idCounter}`;
    const homeless: HomelessSimState = {
      id,
      spawnX,
      wanderRadius,
      recruitCost,
    };

    this._homeless.set(id, homeless);
    return id;
  }

  /**
   * Remove a homeless NPC (hired or despawned).
   */
  removeHomeless(id: string): HomelessSimState | null {
    const homeless = this._homeless.get(id);
    if (!homeless) return null;

    this._homeless.delete(id);
    return homeless;
  }

  /**
   * Get a homeless NPC by ID.
   */
  getHomeless(id: string): HomelessSimState | undefined {
    return this._homeless.get(id);
  }

  /**
   * Get all homeless NPCs.
   */
  getAllHomeless(): HomelessSimState[] {
    return Array.from(this._homeless.values());
  }

  /**
   * Hire a homeless NPC as a villager.
   *
   * @param homelessId ID of homeless NPC to hire
   * @param day Current day
   * @returns New villager ID, or null if failed
   */
  hireHomeless(homelessId: string, day: number): string | null {
    const homeless = this.removeHomeless(homelessId);
    if (!homeless) return null;

    return this.createVillager(JobType.Idle, day, homeless.spawnX);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get the appropriate tool for a job.
   */
  private getToolForJob(job: JobType): ToolType {
    switch (job) {
      case JobType.Builder:
        return ToolType.Hammer;
      case JobType.Farmer:
        return ToolType.Scythe;
      case JobType.Archer:
        return ToolType.Bow;
      case JobType.Knight:
        return ToolType.Sword;
      default:
        return ToolType.None;
    }
  }

  /**
   * Increment job count.
   */
  private incrementJobCount(job: JobType): void {
    const current = this._jobCounts.get(job) ?? 0;
    this._jobCounts.set(job, current + 1);
  }

  /**
   * Decrement job count.
   */
  private decrementJobCount(job: JobType): void {
    const current = this._jobCounts.get(job) ?? 0;
    this._jobCounts.set(job, Math.max(0, current - 1));
  }

  /**
   * Update max population (called by BuildingManager).
   */
  setMaxPopulation(max: number): void {
    this.maxPopulation = max;
  }

  /**
   * Reset all population data.
   */
  reset(): void {
    this._villagers.clear();
    this._homeless.clear();
    for (const job of Object.values(JobType)) {
      this._jobCounts.set(job, 0);
    }
    this._idCounter = 0;
  }
}
