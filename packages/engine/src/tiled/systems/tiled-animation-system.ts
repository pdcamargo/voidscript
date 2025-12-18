/**
 * Tiled Animation System
 *
 * Update phase system that auto-starts animations on TiledObject entities
 * that have AnimationController components.
 *
 * Runs in the update phase (every frame).
 *
 * Note: This system only runs when gameplay is active (play mode or no editor).
 * In edit mode, tiled animations are paused.
 */

import { system } from '../../ecs/system.js';
import { TiledObject } from '../../ecs/components/tiled/tiled-object.js';
import {
  AnimationController,
  playAnimation,
  getAvailableAnimationIds,
} from '../../ecs/components/animation/animation-controller.js';
import { isGameplayActive } from '../../editor/system-conditions.js';

/**
 * Tiled Animation System
 *
 * Auto-starts animations on TiledObject entities with AnimationController.
 *
 * Only executes when:
 * - In play mode (EditorManager exists and is playing)
 * - Or no editor (pure game, always runs)
 */
export const tiledAnimationSystem = system(({ commands }) => {
  // Query for TiledObject entities with AnimationController
  commands
    .query()
    .all(TiledObject, AnimationController)
    .each((entity, tiledObj, animController) => {
      // Auto-start animation if not playing
      if (!animController.isPlaying && animController.animations.length > 0) {
        // Get available animation IDs from loaded assets
        const availableIds = getAvailableAnimationIds(animController);
        const firstId = availableIds[0];
        if (firstId) {
          playAnimation(animController, firstId, { restart: false });
        }
      }
    });
}).runIf(isGameplayActive());
