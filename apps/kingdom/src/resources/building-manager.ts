/**
 * BuildingManager Resource
 *
 * Manages all buildings in the kingdom simulation.
 * Tracks building state, levels, health, and population contribution.
 */

import { BuildingType } from '../types/enums.js';

/**
 * Configuration for a building type.
 */
export interface BuildingTypeConfig {
  /** Base health at level 1 */
  baseHealth: number;
  /** Health bonus per level */
  healthPerLevel: number;
  /** Population contribution at level 1 */
  basePopulationContribution: number;
  /** Population bonus per level */
  populationPerLevel: number;
  /** Build cost at level 1 (coins) */
  baseBuildCost: number;
  /** Upgrade cost multiplier per level */
  upgradeCostMultiplier: number;
  /** Maximum level */
  maxLevel: number;
}

/**
 * Default configurations for each building type.
 */
export const DEFAULT_BUILDING_CONFIGS: Record<BuildingType, BuildingTypeConfig> = {
  [BuildingType.Camp]: {
    baseHealth: 500,
    healthPerLevel: 100,
    basePopulationContribution: 5,
    populationPerLevel: 2,
    baseBuildCost: 0, // Camp is free (starting building)
    upgradeCostMultiplier: 2,
    maxLevel: 5,
  },
  [BuildingType.Wall]: {
    baseHealth: 200,
    healthPerLevel: 100,
    basePopulationContribution: 0,
    populationPerLevel: 0,
    baseBuildCost: 3,
    upgradeCostMultiplier: 1.5,
    maxLevel: 4,
  },
  [BuildingType.Tower]: {
    baseHealth: 150,
    healthPerLevel: 50,
    basePopulationContribution: 1,
    populationPerLevel: 1,
    baseBuildCost: 6,
    upgradeCostMultiplier: 2,
    maxLevel: 3,
  },
  [BuildingType.Farm]: {
    baseHealth: 100,
    healthPerLevel: 30,
    basePopulationContribution: 2,
    populationPerLevel: 1,
    baseBuildCost: 5,
    upgradeCostMultiplier: 1.8,
    maxLevel: 3,
  },
  [BuildingType.Workshop]: {
    baseHealth: 120,
    healthPerLevel: 40,
    basePopulationContribution: 1,
    populationPerLevel: 1,
    baseBuildCost: 8,
    upgradeCostMultiplier: 2,
    maxLevel: 3,
  },
  [BuildingType.Stable]: {
    baseHealth: 150,
    healthPerLevel: 50,
    basePopulationContribution: 0,
    populationPerLevel: 0,
    baseBuildCost: 10,
    upgradeCostMultiplier: 2,
    maxLevel: 2,
  },
  [BuildingType.Castle]: {
    baseHealth: 1000,
    healthPerLevel: 200,
    basePopulationContribution: 10,
    populationPerLevel: 5,
    baseBuildCost: 50,
    upgradeCostMultiplier: 3,
    maxLevel: 3,
  },
};

/**
 * State of a single building in the simulation.
 */
export interface BuildingSimState {
  /** Unique identifier */
  id: string;
  /** Building type */
  type: BuildingType;
  /** Current level (1-indexed) */
  level: number;
  /** Current health */
  health: number;
  /** Maximum health at current level */
  maxHealth: number;
  /** X position in world */
  positionX: number;
  /** Population contribution at current level */
  populationContribution: number;
  /** Day when built */
  builtDay: number;
}

export class BuildingManager {
  // ============================================================================
  // State
  // ============================================================================

  /**
   * All buildings organized by type.
   */
  private _buildings: Map<BuildingType, BuildingSimState[]> = new Map();

  /**
   * Building lookup by ID.
   */
  private _buildingsById: Map<string, BuildingSimState> = new Map();

  /**
   * Total population cap from all buildings.
   */
  private _totalPopulationCap = 0;

  /**
   * Building type configurations.
   */
  configs: Record<BuildingType, BuildingTypeConfig> = {
    ...DEFAULT_BUILDING_CONFIGS,
  };

  /**
   * Counter for generating unique IDs.
   */
  private _idCounter = 0;

  // ============================================================================
  // Constructor
  // ============================================================================

  constructor() {
    // Initialize maps for each building type
    for (const type of Object.values(BuildingType)) {
      this._buildings.set(type, []);
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Get total population cap from all buildings.
   */
  get totalPopulationCap(): number {
    return this._totalPopulationCap;
  }

  /**
   * Get total number of buildings.
   */
  get totalBuildings(): number {
    return this._buildingsById.size;
  }

  /**
   * Get count of buildings by type.
   */
  getBuildingCount(type: BuildingType): number {
    return this._buildings.get(type)?.length ?? 0;
  }

  // ============================================================================
  // Building Management
  // ============================================================================

  /**
   * Construct a new building.
   *
   * @param type Building type
   * @param positionX X position in world
   * @param day Current day
   * @returns New building ID
   */
  addBuilding(type: BuildingType, positionX: number, day: number): string {
    const id = `building_${++this._idCounter}`;
    const config = this.configs[type];

    const building: BuildingSimState = {
      id,
      type,
      level: 1,
      health: config.baseHealth,
      maxHealth: config.baseHealth,
      positionX,
      populationContribution: config.basePopulationContribution,
      builtDay: day,
    };

    this._buildings.get(type)!.push(building);
    this._buildingsById.set(id, building);

    this.recalculatePopulationCap();

    return id;
  }

  /**
   * Remove a building.
   *
   * @param id Building ID
   * @returns The removed building, or null if not found
   */
  removeBuilding(id: string): BuildingSimState | null {
    const building = this._buildingsById.get(id);
    if (!building) return null;

    // Remove from type array
    const typeArray = this._buildings.get(building.type);
    if (typeArray) {
      const index = typeArray.indexOf(building);
      if (index >= 0) {
        typeArray.splice(index, 1);
      }
    }

    // Remove from ID map
    this._buildingsById.delete(id);

    this.recalculatePopulationCap();

    return building;
  }

  /**
   * Get a building by ID.
   */
  getBuilding(id: string): BuildingSimState | undefined {
    return this._buildingsById.get(id);
  }

  /**
   * Get all buildings of a specific type.
   */
  getBuildingsOfType(type: BuildingType): BuildingSimState[] {
    return [...(this._buildings.get(type) ?? [])];
  }

  /**
   * Get all buildings.
   */
  getAllBuildings(): BuildingSimState[] {
    return Array.from(this._buildingsById.values());
  }

  /**
   * Upgrade a building to the next level.
   *
   * @param id Building ID
   * @returns New level, or -1 if upgrade failed
   */
  upgradeBuilding(id: string): number {
    const building = this._buildingsById.get(id);
    if (!building) return -1;

    const config = this.configs[building.type];
    if (building.level >= config.maxLevel) return -1;

    building.level++;
    building.maxHealth = config.baseHealth + config.healthPerLevel * (building.level - 1);
    building.health = building.maxHealth; // Fully heal on upgrade
    building.populationContribution =
      config.basePopulationContribution + config.populationPerLevel * (building.level - 1);

    this.recalculatePopulationCap();

    return building.level;
  }

  /**
   * Get upgrade cost for a building.
   */
  getUpgradeCost(id: string): number {
    const building = this._buildingsById.get(id);
    if (!building) return -1;

    const config = this.configs[building.type];
    if (building.level >= config.maxLevel) return -1;

    return Math.floor(
      config.baseBuildCost * Math.pow(config.upgradeCostMultiplier, building.level),
    );
  }

  /**
   * Get build cost for a new building of a type.
   */
  getBuildCost(type: BuildingType): number {
    return this.configs[type].baseBuildCost;
  }

  /**
   * Damage a building.
   *
   * @returns Remaining health, or -1 if building not found
   */
  damageBuilding(id: string, damage: number): number {
    const building = this._buildingsById.get(id);
    if (!building) return -1;

    building.health = Math.max(0, building.health - damage);

    return building.health;
  }

  /**
   * Repair a building.
   */
  repairBuilding(id: string, amount: number): void {
    const building = this._buildingsById.get(id);
    if (building) {
      building.health = Math.min(building.maxHealth, building.health + amount);
    }
  }

  /**
   * Check if a building is at max level.
   */
  isMaxLevel(id: string): boolean {
    const building = this._buildingsById.get(id);
    if (!building) return false;

    return building.level >= this.configs[building.type].maxLevel;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Recalculate total population cap from all buildings.
   */
  recalculatePopulationCap(): void {
    let total = 0;
    for (const building of this._buildingsById.values()) {
      total += building.populationContribution;
    }
    this._totalPopulationCap = total;
  }

  /**
   * Get buildings sorted by position (left to right).
   */
  getBuildingsByPosition(): BuildingSimState[] {
    return this.getAllBuildings().sort((a, b) => a.positionX - b.positionX);
  }

  /**
   * Find buildings within a range.
   */
  getBuildingsInRange(minX: number, maxX: number): BuildingSimState[] {
    return this.getAllBuildings().filter(
      (b) => b.positionX >= minX && b.positionX <= maxX,
    );
  }

  /**
   * Reset all buildings.
   */
  reset(): void {
    for (const type of Object.values(BuildingType)) {
      this._buildings.set(type, []);
    }
    this._buildingsById.clear();
    this._totalPopulationCap = 0;
    this._idCounter = 0;
  }
}

// Register BuildingManager as a resource (internal state managed by configs)
import { registerResource } from '@voidscript/engine';
registerResource(BuildingManager, false, {
  path: 'kingdom/buildings',
  displayName: 'Building Manager',
  description: 'Manages all buildings in the kingdom',
  builtIn: false,
  defaultValue: () => new BuildingManager(),
});
