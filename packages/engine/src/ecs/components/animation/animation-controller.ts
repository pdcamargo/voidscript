/**
 * AnimationController Component
 *
 * ECS component for controlling animation playback on entities.
 * Stores animation asset references and manages playback state.
 */

import { component } from '../../component.js';
import type { AnimationClip } from '../../../animation/animation-clip.js';
import { isRuntimeAsset, type RuntimeAsset } from '../../runtime-asset.js';
import { ImGui } from '@mori2003/jsimgui';

// ============================================================================
// Types
// ============================================================================

/**
 * Animation controller component data
 */
export interface AnimationControllerData {
  /** Array of animation asset references */
  animations: RuntimeAsset<AnimationClip>[];

  /** Currently playing animation ID (matches AnimationClip.id) */
  currentAnimationId: string | null;

  /** Whether animation is currently playing */
  isPlaying: boolean;

  /** Current playback time in seconds */
  currentTime: number;

  /** Playback speed multiplier (1.0 = normal) */
  speed: number;

  /** Number of times the current clip has looped */
  loopCount: number;

  /** Callback when animation completes (for LoopMode.Once) */
  onComplete?: () => void;

  /** Callback when animation loops */
  onLoop?: (loopCount: number) => void;
}

// ============================================================================
// Component Definition
// ============================================================================

/**
 * AnimationController component for entity animation playback.
 *
 * @example
 * ```typescript
 * // Get animation assets
 * const walkAnim = RuntimeAssetManager.get().get('player-walk');
 * const idleAnim = RuntimeAssetManager.get().get('player-idle');
 *
 * commands.spawn()
 *   .with(Transform3D, { ... })
 *   .with(AnimationController, {
 *     animations: [walkAnim, idleAnim],
 *     currentAnimationId: 'player-idle',
 *     isPlaying: true,
 *     currentTime: 0,
 *     speed: 1.0,
 *     loopCount: 0,
 *   })
 *   .build();
 * ```
 */
export const AnimationController = component<AnimationControllerData>(
  'AnimationController',
  {
    animations: {
      serializable: true,
      type: 'runtimeAsset',
      collectionType: 'array',
      assetTypes: ['animation'],
    },
    currentAnimationId: {
      serializable: true,
      whenNullish: 'keep',
      customEditor: ({ label, value, onChange, componentData }) => {
        // Get available animation IDs from the animations array
        const animations = componentData?.animations as unknown[] | undefined;
        const availableIds: string[] = [];

        if (animations && Array.isArray(animations)) {
          for (const item of animations) {
            // Check if item is a RuntimeAsset instance with loaded data
            if (isRuntimeAsset(item)) {
              const asset = item as RuntimeAsset<AnimationClip>;
              if (asset.isLoaded && asset.data) {
                availableIds.push(asset.data.id);
              }
            }
          }
        }

        // Current selection display
        const currentDisplay = value || '(None)';

        ImGui.Text(`${label}:`);
        ImGui.SameLine();

        // Combo box for selecting animation
        if (ImGui.BeginCombo(`##${label}`, currentDisplay)) {
          // None option
          if (ImGui.Selectable('(None)', value === null)) {
            onChange(null);
          }

          // Available animations
          for (const animId of availableIds) {
            const isSelected = value === animId;
            if (ImGui.Selectable(animId, isSelected)) {
              onChange(animId);
            }
            if (isSelected) {
              ImGui.SetItemDefaultFocus();
            }
          }

          ImGui.EndCombo();
        }

        // Show warning if no animations available
        if (availableIds.length === 0) {
          ImGui.SameLine();
          ImGui.TextColored(
            { x: 1, y: 0.5, z: 0, w: 1 },
            animations && animations.length > 0
              ? '(Not loaded)'
              : '(No animations)'
          );
        }
      },
    },
    isPlaying: { serializable: true },
    currentTime: { serializable: true },
    speed: { serializable: true },
    loopCount: { serializable: true },
    // Callbacks are not serializable
    onComplete: { serializable: false },
    onLoop: { serializable: false },
  },
  {
    path: 'animation',
    displayName: 'Animation Controller',
    description: 'Controls animation clip playback for an entity',
    defaultValue: () => ({
      animations: [],
      currentAnimationId: null,
      isPlaying: false,
      currentTime: 0,
      speed: 1.0,
      loopCount: 0,
    }),
  }
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a new AnimationControllerData with default values
 */
export function createAnimationController(
  animations?: RuntimeAsset<AnimationClip>[]
): AnimationControllerData {
  return {
    animations: animations ?? [],
    currentAnimationId: null,
    isPlaying: false,
    currentTime: 0,
    speed: 1.0,
    loopCount: 0,
  };
}

/**
 * Add an animation asset to the controller
 */
export function addAnimationAsset(
  controller: AnimationControllerData,
  animation: RuntimeAsset<AnimationClip>
): void {
  // Avoid duplicates
  if (!controller.animations.some((a) => a.guid === animation.guid)) {
    controller.animations.push(animation);
  }
}

/**
 * Remove an animation asset from the controller by GUID
 */
export function removeAnimationAsset(
  controller: AnimationControllerData,
  guid: string
): boolean {
  const index = controller.animations.findIndex((a) => a.guid === guid);
  if (index === -1) return false;

  // Check if this animation is currently playing
  const asset = controller.animations[index];
  if (asset?.isLoaded && asset.data?.id === controller.currentAnimationId) {
    stopAnimation(controller);
  }

  controller.animations.splice(index, 1);
  return true;
}

/**
 * Get the currently active AnimationClip from loaded assets
 */
export function getCurrentClip(
  controller: AnimationControllerData
): AnimationClip | null {
  if (!controller.currentAnimationId) return null;

  for (const asset of controller.animations) {
    if (
      asset.isLoaded &&
      asset.data &&
      asset.data.id === controller.currentAnimationId
    ) {
      return asset.data;
    }
  }
  return null;
}

/**
 * Get all available animation IDs from loaded assets
 */
export function getAvailableAnimationIds(
  controller: AnimationControllerData
): string[] {
  return controller.animations
    .filter((asset) => asset.isLoaded && asset.data)
    .map((asset) => asset.data!.id);
}

/**
 * Play an animation by ID
 *
 * @param controller - The animation controller
 * @param animationId - ID of the animation clip to play (from AnimationClip.id)
 * @param options - Playback options
 * @returns true if the clip was found and started, false otherwise
 */
export function playAnimation(
  controller: AnimationControllerData,
  animationId: string,
  options?: {
    /** Restart from beginning even if already playing */
    restart?: boolean;
    /** Override playback speed for this play */
    speed?: number;
  }
): boolean {
  // Find the animation by clip ID
  const clip = controller.animations.find(
    (asset) => asset.isLoaded && asset.data?.id === animationId
  );
  if (!clip) return false;

  // If already playing this clip and not restarting, do nothing
  if (
    controller.currentAnimationId === animationId &&
    controller.isPlaying &&
    !options?.restart
  ) {
    return true;
  }

  controller.currentAnimationId = animationId;
  controller.isPlaying = true;
  controller.currentTime = 0;
  controller.loopCount = 0;

  if (options?.speed !== undefined) {
    controller.speed = options.speed;
  }

  return true;
}

/**
 * Stop the currently playing animation
 */
export function stopAnimation(controller: AnimationControllerData): void {
  controller.isPlaying = false;
  controller.currentTime = 0;
  controller.loopCount = 0;
}

/**
 * Pause the currently playing animation
 */
export function pauseAnimation(controller: AnimationControllerData): void {
  controller.isPlaying = false;
}

/**
 * Resume a paused animation
 */
export function resumeAnimation(controller: AnimationControllerData): void {
  if (controller.currentAnimationId) {
    controller.isPlaying = true;
  }
}

/**
 * Check if a specific clip is currently playing
 */
export function isPlayingClip(
  controller: AnimationControllerData,
  animationId: string
): boolean {
  return controller.isPlaying && controller.currentAnimationId === animationId;
}

/**
 * Set playback speed
 */
export function setAnimationSpeed(
  controller: AnimationControllerData,
  speed: number
): void {
  controller.speed = speed;
}
