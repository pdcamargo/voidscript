# Kingdom Game - LLM Documentation

A Kingdom: Two Crowns-style game built on VoidScript engine. This document describes the game's architecture for AI assistants working on the codebase.

## Game Overview

- **Genre**: Side-scrolling kingdom builder/management
- **Core Loop**: Manage villagers, build structures, defend against enemies, expand territory
- **Movement**: Left/Right only (2D horizontal scrolling)

---

## Architecture Philosophy

### Simulation vs Visual Layer Separation

The game uses a **manager-first architecture** where:

1. **Resource Managers** hold all simulation truth (counts, states, timers)
2. **ECS Components** are optional visual markers linked to manager state
3. **Systems** update managers and optionally sync visual entities

This allows running game logic without spawning entities, making it easier to:
- Save/load game state (just serialize managers)
- Run simulation ahead for predictions
- Unit test game logic without rendering

### Event-Driven Communication

Systems communicate via typed events rather than direct coupling:
- `DayStarted` triggers weather regeneration, homeless spawning, etc.
- `VillagerHired` updates UI, plays sound, triggers achievements
- `WeatherChanged` updates visuals, affects gameplay modifiers

---

## Core Systems

### Time System

**Files:**
- `src/resources/game-time-manager.ts`
- `src/systems/game-time-system.ts`
- `src/events/time-events.ts`

**Time Flow:**
- 24-hour cycle (0.0 to 24.0)
- Default: 2 real minutes = 1 game hour (`timeSpeed: 0.5`)
- Day counter increments when time wraps

**Time Phases:**
| Phase | Hours |
|-------|-------|
| Dawn | 5:00 - 7:00 |
| Morning | 7:00 - 12:00 |
| Noon | 12:00 - 14:00 |
| Afternoon | 14:00 - 17:00 |
| Dusk | 17:00 - 20:00 |
| Night | 20:00 - 5:00 |

**Events:**
- `DayStarted(day: number)` - Fired when new day begins
- `TimePhaseChanged(previousPhase, currentPhase, day, time)` - Fired on phase transitions

**Usage:**
```typescript
const timeManager = commands.getResource(GameTimeManager);
timeManager.setTimeSpeed(1.0); // 1 minute = 1 game hour
timeManager.skipToNextPhase(); // Jump to next phase
```

### Weather System

**Files:**
- `src/resources/weather-manager.ts`
- `src/systems/weather-schedule-system.ts`
- `src/events/weather-events.ts`

**Weather Conditions (combinable via bitfield):**
```typescript
enum WeatherCondition {
  Clear = 1 << 0,   // Sunny
  Cloudy = 1 << 1,  // Overcast
  Foggy = 1 << 2,   // Mist/fog
  Rainy = 1 << 3,   // Rain
  Stormy = 1 << 4,  // Thunder/lightning
  Windy = 1 << 5,   // Strong wind
  Snowy = 1 << 6,   // Snow (future)
}
```

**Daily Schedule:**
Weather follows a configurable daily schedule:
```typescript
weatherManager.setDailySchedule([
  { startHour: 6, conditions: WeatherCondition.Clear },
  { startHour: 14, conditions: WeatherCondition.Cloudy },
  { startHour: 20, conditions: WeatherCondition.Rainy | WeatherCondition.Cloudy },
]);
```

**Presets Available:**
- `sunny` - Clear all day
- `partlyCloudy` - Clear morning, cloudy afternoon
- `overcast` - Cloudy all day
- `rainyDay` - Rain with clouds
- `eveningRain` - Clear until 18:00, then rain
- `stormyNight` - Clear until 20:00, then storm

**Events:**
- `WeatherChanged(previousConditions, currentConditions, intensity)` - Fired when weather changes

**Usage:**
```typescript
const weather = commands.getResource(WeatherManager);
weather.applyPreset('eveningRain');
if (weather.hasCondition(WeatherCondition.Rainy)) {
  // Slow down villagers, affect farming, etc.
}
```

### Population System

**Files:**
- `src/resources/population-manager.ts`
- `src/components/villager.ts`
- `src/components/homeless.ts`
- `src/events/population-events.ts`

**Simulation State:**
The manager tracks all population without requiring entities:
```typescript
interface VillagerSimState {
  id: string;
  job: JobType;
  hp: number;
  maxHp: number;
  state: VillagerState;
  hireDay: number;
  tool: ToolType;
}
```

**Job Types:**
- `Idle` - No assignment
- `Builder` - Constructs/repairs buildings
- `Farmer` - Works farms, produces food
- `Archer` - Mans towers, defends walls
- `Knight` - Patrols, fights enemies

**Events:**
- `VillagerHired(villagerId)` - Homeless became villager
- `VillagerAssigned(villagerId, previousJob, newJob)` - Job changed
- `VillagerDied(villagerId, cause)` - Villager died
- `HomelessSpawned(homelessId)` - New homeless appeared

**Usage:**
```typescript
const pop = commands.getResource(PopulationManager);

// Create homeless and hire them
const homelessId = pop.spawnHomeless(100); // at x=100
const villagerId = pop.hireHomeless(homelessId);
pop.assignJob(villagerId, JobType.Archer);

// Query counts
const archerCount = pop.jobCounts.get(JobType.Archer);
const availableWorkers = pop.getAvailableWorkers();
```

### Building System

**Files:**
- `src/resources/building-manager.ts`
- `src/components/building.ts`
- `src/events/building-events.ts`

**Building Types:**
- `Camp` - Starting base (population cap: 5)
- `Wall` - Defense walls (upgradeable levels)
- `Tower` - Archer towers (requires Archers)
- `Farm` - Food production (requires Farmers)
- `Workshop` - Tool crafting
- `Stable` - Mount storage
- `Castle` - End-game upgrade (population cap: 50)

**Simulation State:**
```typescript
interface BuildingSimState {
  id: string;
  type: BuildingType;
  level: number;
  health: number;
  maxHealth: number;
  position: number;           // X position
  populationContribution: number;
}
```

**Events:**
- `BuildingConstructed(buildingId, type, position)` - New building placed
- `BuildingUpgraded(buildingId, previousLevel, newLevel)` - Building leveled up
- `BuildingDestroyed(buildingId, cause)` - Building destroyed
- `BuildingDamaged(buildingId, damage, remainingHealth)` - Building took damage

**Usage:**
```typescript
const buildings = commands.getResource(BuildingManager);

const id = buildings.addBuilding(BuildingType.Wall, 150);
buildings.upgradeBuilding(id); // Level 1 -> 2
buildings.damageBuilding(id, 25);

// Population cap auto-updates
console.log(buildings.totalPopulationCap); // Sum of all building contributions
```

### Economy System

**Files:**
- `src/resources/economy-manager.ts`
- `src/events/economy-events.ts`

**Currencies:**
- `coins` - Standard currency (earned from taxes, farming)
- `diamonds` - Premium/rare currency (gems, special rewards)

**Transaction History:**
All transactions are logged for debugging and stats:
```typescript
interface Transaction {
  id: string;
  type: 'earn' | 'spend';
  currency: 'coins' | 'diamonds';
  amount: number;
  source: string;       // e.g., 'farming', 'building_wall'
  timestamp: number;    // Game time
  day: number;
}
```

**Events:**
- `CurrencyChanged(currency, previousAmount, newAmount, source)` - Currency changed
- `TransactionRecorded(transaction)` - New transaction logged

**Usage:**
```typescript
const economy = commands.getResource(EconomyManager);

economy.addCoins(10, 'farming');
if (economy.canAfford(50)) {
  economy.spendCoins(50, 'building_wall');
}

// Query history
const todayIncome = economy.getDailyIncome(timeManager.currentDay);
const farmingTransactions = economy.getTransactionsBySource('farming');
```

### Progress System

**Files:**
- `src/resources/progress-manager.ts`
- `src/events/progress-events.ts`

**Progress Flags (unlockables):**
```typescript
enum ProgressFlag {
  // Tutorial/Early Game
  FirstVillagerHired = 'first_villager_hired',
  FirstBuildingBuilt = 'first_building_built',
  FirstWallBuilt = 'first_wall_built',

  // Milestones
  ReachedDay5 = 'reached_day_5',
  ReachedDay10 = 'reached_day_10',
  Population10 = 'population_10',

  // Unlocks
  UnlockedKnights = 'unlocked_knights',
  UnlockedFarms = 'unlocked_farms',
  UnlockedCatapult = 'unlocked_catapult',

  // Story/Areas
  DiscoveredPortal = 'discovered_portal',
  DestroyedFirstPortal = 'destroyed_first_portal',
  ReachedSecondIsland = 'reached_second_island',
}
```

**Statistics (generic counters):**
- `total_coins_earned`
- `total_coins_spent`
- `villagers_lost`
- `buildings_destroyed`
- `enemies_killed`

**Events:**
- `ProgressUnlocked(flag)` - Flag achieved
- `StatisticUpdated(key, previousValue, newValue)` - Stat changed

**Usage:**
```typescript
const progress = commands.getResource(ProgressManager);

progress.unlock(ProgressFlag.FirstVillagerHired);
progress.incrementStat('enemies_killed', 1);

if (!progress.isUnlocked(ProgressFlag.UnlockedKnights)) {
  // Hide knight-related UI
}
```

---

## File Structure

```
apps/kingdom/src/
├── components/
│   ├── building.ts          # Building visual marker
│   ├── cloud-2d.ts          # Cloud movement
│   ├── fog-sky-sync.ts      # Fog/sky synchronization
│   ├── homeless.ts          # Homeless NPC marker
│   ├── sprite-area-generator.ts
│   ├── sun-light.ts         # Sun lighting
│   └── villager.ts          # Villager visual marker
├── events/
│   ├── building-events.ts   # BuildingConstructed, etc.
│   ├── economy-events.ts    # CurrencyChanged, etc.
│   ├── forest-events.ts     # EnteredForest, ExitedForest
│   ├── population-events.ts # VillagerHired, etc.
│   ├── progress-events.ts   # ProgressUnlocked, etc.
│   ├── time-events.ts       # DayStarted, TimePhaseChanged
│   └── weather-events.ts    # WeatherChanged
├── resources/
│   ├── building-manager.ts  # Building simulation
│   ├── economy-manager.ts   # Currency/transactions
│   ├── game-time-manager.ts # Time cycle management
│   ├── population-manager.ts# Villager/homeless tracking
│   ├── progress-manager.ts  # Flags/statistics
│   └── weather-manager.ts   # Weather state/schedule
├── systems/
│   ├── cloud-movement-system.ts
│   ├── fog-sky-sync-system.ts
│   ├── forest-light-system.ts
│   ├── game-time-system.ts      # Time advancement
│   ├── player-movement-system.ts
│   ├── weather-schedule-system.ts # Weather updates
│   └── game/
│       └── camera-movement-system.ts
├── types/
│   └── enums.ts             # Shared enums
├── ui/
│   ├── cloud-generator-panel.ts
│   ├── moon-generator-panel.ts
│   └── sun-generator-panel.ts
├── game-layer.ts            # Main game layer
└── main.ts                  # Application entry point
```

---

## Adding New Features

### Adding a New Job Type

1. Add to `JobType` enum in `types/enums.ts`
2. Add tool mapping in `ToolType` if needed
3. Update `PopulationManager.assignJob()` if special logic needed
4. Create job-specific behavior system

### Adding a New Building Type

1. Add to `BuildingType` enum in `types/enums.ts`
2. Add config to `DEFAULT_BUILDING_CONFIGS` in `building-manager.ts`
3. Create visual prefab/entity in world
4. Add building-specific systems if needed

### Adding a New Progress Flag

1. Add to `ProgressFlag` enum in `types/enums.ts`
2. Find appropriate trigger point and call `progressManager.unlock(flag)`
3. Listen to `ProgressUnlocked` event for UI/gameplay reactions

### Creating a New Event Listener

```typescript
const mySystem = system(({ commands }) => {
  const reader = commands.eventReader(DayStarted);
  for (const event of reader.read()) {
    console.log(`Day ${event.day} started!`);
    // React to new day...
  }
});
```

---

## Future Roadmap (Not Implemented)

These features are planned but not yet built:

- **Greed Enemy Waves**: Night-time attacks from portals
- **Defense Mechanics**: Archers on towers, walls blocking enemies
- **Mount System**: Horses, deer, lizards with special abilities
- **Island Progression**: Multiple islands with different themes
- **Seasons**: Spring/Summer/Fall/Winter affecting weather and crops
- **Boat/Ship**: Travel between islands
- **Crown Mechanics**: Crown = life, drop crown = game over

---

## Tips for AI Assistants

1. **Managers before components**: Always update manager state first, components sync later
2. **Events for side effects**: Don't directly modify other systems; fire events instead
3. **Time-based logic**: Use `TimePhase` for day/night behaviors, not raw hour values
4. **Play mode only**: Systems that affect gameplay should use `.runIf(isGameplayActive())`
5. **Query counts from managers**: Don't iterate entities to count things; managers cache counts
