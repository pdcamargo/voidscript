/**
 * Building Component
 *
 * Optional visual marker component for building entities.
 * The actual simulation data is in BuildingManager.
 * This component links a visual entity to the simulation state.
 */

import { component } from '@voidscript/engine';
import { BuildingType } from '../types/enums.js';

/**
 * Building component data.
 */
export interface BuildingData {
  /**
   * ID linking to BuildingManager's building state.
   * If empty, this is an unlinked visual entity.
   */
  buildingId: string;

  /**
   * Building type (for quick access without manager lookup).
   */
  type: BuildingType;

  /**
   * Current level (synced from manager).
   */
  level: number;

  /**
   * Construction progress (0-1) for build animations.
   * 1.0 means fully built.
   */
  constructionProgress: number;
}

/**
 * Building component for visual entity representation.
 */
export const Building = component<BuildingData>(
  'Building',
  {
    buildingId: {
      serializable: true,
    },
    type: {
      serializable: true,
      type: 'enum',
      enum: BuildingType,
    },
    level: {
      serializable: true,
    },
    constructionProgress: {
      serializable: true,
    },
  },
  {
    path: 'kingdom/building',
    defaultValue: (): BuildingData => ({
      buildingId: '',
      type: BuildingType.Camp,
      level: 1,
      constructionProgress: 1,
    }),
  },
);
