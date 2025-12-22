/**
 * Homeless Component
 *
 * Optional visual marker component for homeless NPC entities.
 * The actual simulation data is in PopulationManager.
 * This component links a visual entity to the simulation state.
 */

import { component } from '@voidscript/engine';

/**
 * Homeless component data.
 */
export interface HomelessData {
  /**
   * ID linking to PopulationManager's homeless state.
   * If empty, this is an unlinked visual entity.
   */
  homelessId: string;

  /**
   * How far they wander from spawn point.
   */
  wanderRadius: number;

  /**
   * Cost in coins to recruit as villager.
   */
  recruitCost: number;

  /**
   * X position where they spawn/wander around.
   */
  spawnX: number;
}

/**
 * Homeless component for visual entity representation.
 */
export const Homeless = component<HomelessData>(
  'Homeless',
  {
    homelessId: {
      serializable: true,
    },
    wanderRadius: {
      serializable: true,
    },
    recruitCost: {
      serializable: true,
    },
    spawnX: {
      serializable: true,
    },
  },
  {
    path: 'kingdom/population',
    defaultValue: (): HomelessData => ({
      homelessId: '',
      wanderRadius: 50,
      recruitCost: 1,
      spawnX: 0,
    }),
  },
);
