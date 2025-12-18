/**
 * Tween Update System
 *
 * ECS system that updates the TweenManager each frame.
 * Automatically processes all active tweens.
 *
 * This system is registered automatically by Application.addBuiltInSystems().
 *
 * Note: This system only runs when gameplay is active (play mode or no editor).
 * In edit mode, tweens are paused.
 */

import { system } from '../system.js';
import { TweenManager } from '../../animation/tween.js';
import { isGameplayActive } from '../../editor/system-conditions.js';

// ============================================================================
// Tween Update System
// ============================================================================

/**
 * System that updates all active tweens via TweenManager.
 *
 * Registered automatically by Application.addBuiltInSystems().
 * Runs in the 'update' phase.
 *
 * Only executes when:
 * - In play mode (EditorManager exists and is playing)
 * - Or no editor (pure game, always runs)
 *
 * @example
 * ```typescript
 * // Tweens are updated automatically, just create and start them:
 * const tweenManager = commands.getResource(TweenManager);
 *
 * Tween.to(transform.position, { x: 100, y: 50 }, 0.5, Easing.easeOutQuad)
 *   .onComplete(() => console.log('Done!'))
 *   .start(tweenManager);
 * ```
 */
export const tweenUpdateSystem = system(({ commands }) => {
  const tweenManager = commands.getResource(TweenManager);
  const deltaTime = commands.getDeltaTime();

  tweenManager.update(deltaTime);
}).runIf(isGameplayActive());
