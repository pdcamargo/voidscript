/**
 * Kingdom Game - Shared Enums
 *
 * All shared enumerations used across managers, components, and systems.
 */

// ============================================================================
// Time System
// ============================================================================

/**
 * Time phases representing different parts of the day.
 * Used by GameTimeManager to track the current period.
 */
export enum TimePhase {
  Dawn = 'dawn', // 5:00 - 7:00
  Morning = 'morning', // 7:00 - 12:00
  Noon = 'noon', // 12:00 - 14:00
  Afternoon = 'afternoon', // 14:00 - 17:00
  Dusk = 'dusk', // 17:00 - 20:00
  Night = 'night', // 20:00 - 5:00
}

// ============================================================================
// Weather System
// ============================================================================

/**
 * Weather conditions as bit flags for combining multiple effects.
 * Use bitwise OR to combine: `WeatherCondition.Rainy | WeatherCondition.Windy`
 */
export enum WeatherCondition {
  Clear = 1 << 0, // Sunny/clear sky
  Cloudy = 1 << 1, // Overcast
  Foggy = 1 << 2, // Fog/mist
  Rainy = 1 << 3, // Rain
  Stormy = 1 << 4, // Thunder/lightning
  Windy = 1 << 5, // Strong wind
  Snowy = 1 << 6, // Snow (future)
}

// ============================================================================
// Population System
// ============================================================================

/**
 * Job types that villagers can be assigned to.
 */
export enum JobType {
  Idle = 'idle', // No job assigned
  Builder = 'builder', // Constructs and repairs buildings/walls
  Farmer = 'farmer', // Works fields, produces food
  Archer = 'archer', // Defends the kingdom from enemies
  Knight = 'knight', // Elite defender, can push back enemies
}

/**
 * States a villager can be in.
 */
export enum VillagerState {
  Idle = 'idle', // Waiting for assignment
  Working = 'working', // Actively performing job
  Walking = 'walking', // Moving to destination
  Fleeing = 'fleeing', // Running from danger
  Dead = 'dead', // No longer alive
}

/**
 * Tool types that villagers can equip.
 */
export enum ToolType {
  None = 'none',
  Hammer = 'hammer', // For builders
  Scythe = 'scythe', // For farmers
  Bow = 'bow', // For archers
  Sword = 'sword', // For knights
}

// ============================================================================
// Building System
// ============================================================================

/**
 * Types of buildings that can be constructed.
 */
export enum BuildingType {
  Camp = 'camp', // Starting base
  Wall = 'wall', // Defense walls (multiple levels)
  Tower = 'tower', // Archer towers
  Farm = 'farm', // Food production
  Workshop = 'workshop', // Tool crafting
  Stable = 'stable', // Mount storage
  Castle = 'castle', // End-game upgrade
}

// ============================================================================
// Progress System
// ============================================================================

/**
 * Progress flags for tracking player achievements and unlocks.
 */
export enum ProgressFlag {
  // Tutorial/Early Game
  FirstVillagerHired = 'first_villager_hired',
  FirstBuildingBuilt = 'first_building_built',
  FirstWallBuilt = 'first_wall_built',

  // Milestones
  ReachedDay5 = 'reached_day_5',
  ReachedDay10 = 'reached_day_10',
  ReachedDay25 = 'reached_day_25',
  ReachedDay50 = 'reached_day_50',
  Population10 = 'population_10',
  Population25 = 'population_25',

  // Unlocks
  UnlockedKnights = 'unlocked_knights',
  UnlockedFarms = 'unlocked_farms',
  UnlockedCatapult = 'unlocked_catapult',
  UnlockedStable = 'unlocked_stable',

  // Story/Areas
  DiscoveredPortal = 'discovered_portal',
  DestroyedFirstPortal = 'destroyed_first_portal',
  ReachedSecondIsland = 'reached_second_island',
}
