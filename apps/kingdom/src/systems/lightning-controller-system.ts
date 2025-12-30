/**
 * Lightning Controller System
 *
 * Updates lightning bolt timing and passes state to the shader via Sprite2DMaterial uniforms.
 * Runs every frame to manage strike timing, bolt lifecycle, and visual effects.
 *
 * Required components:
 * - LightningController: Timing and control properties
 * - Sprite2DMaterial: Shader uniforms (bolt_seeds, bolt_progress, etc.)
 */
import { system, Sprite2DMaterial, isGameplayActive } from '@voidscript/engine';
import {
  LightningController,
  type LightningControllerData,
  type StrikeDirection,
} from '../components/lightning-controller.js';

/** Maximum number of simultaneous bolts (must match shader) */
const MAX_BOLTS = 5;

/**
 * Get angle in radians for a given strike direction
 */
function getDirectionAngle(direction: StrikeDirection, angleVariation: number): number {
  let baseAngle: number;

  switch (direction) {
    case 'top-down':
      baseAngle = 0;
      break;
    case 'bottom-up':
      baseAngle = Math.PI;
      break;
    case 'left-right':
      baseAngle = Math.PI / 2;
      break;
    case 'right-left':
      baseAngle = -Math.PI / 2;
      break;
    case 'random':
      baseAngle = Math.random() * Math.PI * 2;
      break;
    default:
      baseAngle = 0;
  }

  // Add random variation
  const variation = (Math.random() - 0.5) * 2 * angleVariation;
  return baseAngle + variation;
}

/**
 * Initialize bolt state arrays if not present
 */
function ensureBoltArrays(controller: LightningControllerData): void {
  if (!controller._boltActive || controller._boltActive.length !== MAX_BOLTS) {
    controller._boltActive = [0, 0, 0, 0, 0];
    controller._boltSeeds = [0, 0, 0, 0, 0];
    controller._boltAngles = [0, 0, 0, 0, 0];
    controller._boltTimeRemaining = [0, 0, 0, 0, 0];
    controller._boltDuration = [0, 0, 0, 0, 0];
  }
}

/**
 * Lightning Controller System
 *
 * Updates lightning bolt timing and shader uniforms each frame.
 */
export const lightningControllerSystem = system(({ commands }) => {
  const deltaTime = commands.getDeltaTime();

  commands
    .query()
    .all(LightningController, Sprite2DMaterial)
    .each((_entity, controller, material) => {
      // Skip if material is disabled
      if (!material.enabled) return;

      // Initialize runtime state if needed
      ensureBoltArrays(controller);

      // Now the arrays are guaranteed to exist (ensureBoltArrays ensures this)
      // Use tuple type for fixed-length arrays to avoid undefined index access errors
      const boltActive = controller._boltActive as [number, number, number, number, number];
      const boltSeeds = controller._boltSeeds as [number, number, number, number, number];
      const boltAngles = controller._boltAngles as [number, number, number, number, number];
      const boltTimeRemaining = controller._boltTimeRemaining as [
        number,
        number,
        number,
        number,
        number,
      ];
      const boltDuration = controller._boltDuration as [
        number,
        number,
        number,
        number,
        number,
      ];

      // Initialize next strike time if not set
      if (controller._nextStrikeTime === 0) {
        controller._nextStrikeTime =
          controller.minInterval +
          Math.random() * (controller.maxInterval - controller.minInterval);
      }

      // Update elapsed time
      controller._elapsedTime += deltaTime;

      // === Strike timing logic ===
      controller._strikeTimer += deltaTime;

      // Check if time to spawn new bolt
      if (controller._strikeTimer >= controller._nextStrikeTime) {
        controller._strikeTimer = 0;
        controller._nextStrikeTime =
          controller.minInterval +
          Math.random() * (controller.maxInterval - controller.minInterval);

        // Count active bolts
        let activeBoltCount = 0;
        for (let i = 0; i < MAX_BOLTS; i++) {
          const active = boltActive[i as 0 | 1 | 2 | 3 | 4];
          if (active > 0.5) {
            activeBoltCount++;
          }
        }

        // Find inactive bolt slot (if we haven't hit limit)
        if (activeBoltCount < controller.simultaneousStrikes) {
          for (let i = 0; i < MAX_BOLTS; i++) {
            const idx = i as 0 | 1 | 2 | 3 | 4;
            if (boltActive[idx] < 0.5) {
              // Activate this bolt
              boltActive[idx] = 1;
              boltSeeds[idx] = Math.random() * 10000;
              boltAngles[idx] = getDirectionAngle(
                controller.strikeDirection,
                controller.angleVariation,
              );
              boltDuration[idx] = controller.strikeDuration;
              boltTimeRemaining[idx] = controller.strikeDuration;

              // Trigger screen flash if enabled
              if (controller.enableScreenFlash) {
                controller._flashRemaining = controller.strikeDuration;
              }

              break; // Only spawn one bolt per frame
            }
          }
        }
      }

      // Update active bolts
      for (let i = 0; i < MAX_BOLTS; i++) {
        const idx = i as 0 | 1 | 2 | 3 | 4;
        if (boltActive[idx] < 0.5) continue;

        boltTimeRemaining[idx] -= deltaTime;

        // Handle fade modes
        if (boltTimeRemaining[idx] <= 0) {
          boltActive[idx] = 0;
        }
      }

      // Calculate screen flash intensity
      let flashIntensity = 0;
      if (controller.enableScreenFlash && controller._flashRemaining > 0) {
        controller._flashRemaining -= deltaTime;
        if (controller._flashRemaining < 0) {
          controller._flashRemaining = 0;
        }
        // Quadratic falloff for natural flash decay
        const flashProgress = controller._flashRemaining / controller.strikeDuration;
        flashIntensity = flashProgress * flashProgress * controller.flashIntensity;
      }

      // Calculate bolt progress values for shader (handle fade modes)
      const boltProgress: number[] = [];
      for (let i = 0; i < MAX_BOLTS; i++) {
        const idx = i as 0 | 1 | 2 | 3 | 4;
        if (boltActive[idx] < 0.5) {
          boltProgress.push(0);
          continue;
        }

        const baseProgress = boltTimeRemaining[idx] / boltDuration[idx];

        if (controller.fadeMode === 'flicker') {
          // Flicker: pulse the progress value
          const flickerPhase =
            controller._elapsedTime * controller.flickerSpeed * Math.PI * 2;
          const flicker = 0.3 + 0.7 * Math.abs(Math.sin(flickerPhase + boltSeeds[idx]));
          boltProgress.push(baseProgress * flicker);
        } else if (controller.fadeMode === 'instant') {
          // Instant: full brightness until end
          boltProgress.push(1.0);
        } else {
          // Fade: linear fade based on progress
          boltProgress.push(Math.max(0, baseProgress));
        }
      }

      // Update shader uniforms
      // Note: Arrays are passed as individual indexed uniforms by the sprite sync system
      // Use type assertion since the uniform system needs to be updated to support arrays
      material.uniforms['bolt_seeds'] = boltSeeds as unknown as number;
      material.uniforms['bolt_progress'] = boltProgress as unknown as number;
      material.uniforms['bolt_active'] = boltActive as unknown as number;
      material.uniforms['bolt_angles'] = boltAngles as unknown as number;
      material.uniforms['flash_intensity'] = flashIntensity;
    });
}).runIf(isGameplayActive());
