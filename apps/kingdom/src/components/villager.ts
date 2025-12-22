/**
 * Villager Component
 *
 * Optional visual marker component for villager entities.
 * The actual simulation data is in PopulationManager.
 * This component links a visual entity to the simulation state.
 */

import { component } from '@voidscript/engine';
import { JobType, VillagerState, ToolType } from '../types/enums.js';

/**
 * Villager component data.
 */
export interface VillagerData {
  /**
   * ID linking to PopulationManager's villager state.
   * If empty, this is an unlinked visual entity.
   */
  villagerId: string;

  /**
   * Current job assignment (synced from manager or standalone).
   */
  job: JobType;

  /**
   * Current health points.
   */
  hp: number;

  /**
   * Maximum health points.
   */
  maxHp: number;

  /**
   * Current state (idle, working, etc).
   */
  state: VillagerState;

  /**
   * Day when hired (for display purposes).
   */
  hireDay: number;

  /**
   * Equipped tool type.
   */
  tool: ToolType;
}

/**
 * Villager component for visual entity representation.
 */
export const Villager = component<VillagerData>(
  'Villager',
  {
    villagerId: {
      serializable: true,
    },
    job: {
      serializable: true,
      type: 'enum',
      enum: JobType,
    },
    hp: {
      serializable: true,
    },
    maxHp: {
      serializable: true,
    },
    state: {
      serializable: true,
      type: 'enum',
      enum: VillagerState,
    },
    hireDay: {
      serializable: true,
    },
    tool: {
      serializable: true,
      type: 'enum',
      enum: ToolType,
    },
  },
  {
    path: 'kingdom/population',
    defaultValue: (): VillagerData => ({
      villagerId: '',
      job: JobType.Idle,
      hp: 100,
      maxHp: 100,
      state: VillagerState.Idle,
      hireDay: 1,
      tool: ToolType.None,
    }),
  },
);
