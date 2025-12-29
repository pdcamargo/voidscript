/**
 * CampFire Position Sync System
 *
 * Syncs the BuildingManager's camp position to the campfire entity's Transform3D.
 * The manager is the source of truth for the camp position.
 * Runs in both editor and play mode.
 */

import { system, Transform3D } from '@voidscript/engine';
import { CampFire } from '../components/camp-fire.js';
import { BuildingManager } from '../resources/building-manager.js';

export const campFireSyncSystem = system(({ commands }) => {
  const buildingManager = commands.tryGetResource(BuildingManager);
  if (!buildingManager) return;

  commands
    .query()
    .all(CampFire, Transform3D)
    .each((_entity, _campFire, transform) => {
      // Sync manager position → Transform3D (manager is source of truth)
      transform.position.x = buildingManager.campPositionX;
    });
});
