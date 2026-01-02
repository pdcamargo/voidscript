/**
 * AnimationController Component
 *
 * ECS component for controlling animation playback on entities.
 * Stores animation asset references and manages playback state.
 */

import { component } from '@voidscript/core';
import type { AnimationClip } from '../../../animation/animation-clip.js';
import { isRuntimeAsset, type RuntimeAsset } from '@voidscript/core';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';
import { openAssetPicker, renderAssetPickerModal } from '../../../app/imgui/asset-picker.js';
import { tryGetEditorLayoutContext } from '../../../app/imgui/editor-layout-context.js';

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

  /** Whether to start playing the current animation when gameplay starts */
  playOnStart: boolean;

  /** Playback speed multiplier (1.0 = normal) */
  speed: number;

  /** Whether animation is currently playing (runtime-only) */
  isPlaying: boolean;

  /** Current playback time in seconds (runtime-only) */
  currentTime: number;

  /** Number of times the current clip has looped (runtime-only) */
  loopCount: number;

  /** Callback when animation completes (for LoopMode.Once) */
  onComplete?: () => void;

  /** Callback when animation loops */
  onLoop?: (loopCount: number) => void;

  /**
   * Runtime-loaded clips that aren't from asset references.
   * Used by the animation editor for preview mode.
   * Key is the clip ID.
   */
  loadedClips?: Map<string, AnimationClip>;
}

// ============================================================================
// Asset Picker State (for animation adding)
// ============================================================================

/** Track pending animation asset picker selections */
const pendingAnimationAssetPicker = new Map<
  string,
  { result: RuntimeAsset<AnimationClip> | null | undefined }
>();

/**
 * Get the display name for an animation asset.
 * Prefers clip.name, then falls back to clip.id, then asset path.
 */
function getAnimationDisplayName(asset: RuntimeAsset<AnimationClip>): string {
  if (asset.isLoaded && asset.data) {
    // Prefer name, fallback to id
    return asset.data.name || asset.data.id || 'Unnamed';
  }
  // Not loaded yet - show path or guid
  return asset.path?.split('/').pop() || asset.guid;
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
 *     playOnStart: true,
 *     speed: 1.0,
 *   })
 *   .build();
 * ```
 */
export const AnimationController = component<AnimationControllerData>(
  'AnimationController',
  {
    // Serialized fields
    animations: {
      serializable: true,
      type: 'runtimeAsset',
      collectionType: 'array',
      assetTypes: ['animation'],
    },
    currentAnimationId: {
      serializable: true,
      whenNullish: 'keep',
    },
    playOnStart: {
      serializable: true,
    },
    speed: {
      serializable: true,
    },

    // Runtime-only fields (not saved to YAML)
    isPlaying: { serializable: false },
    currentTime: { serializable: false },
    loopCount: { serializable: false },

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
      playOnStart: true,
      speed: 1.0,
      isPlaying: false,
      currentTime: 0,
      loopCount: 0,
    }),

    // Component-level custom editor for full control over the inspector UI
    customEditor: ({ componentData }) => {
      const data = componentData;
      const popupId = 'AddAnimationAsset##animController';

      // Get context for renderer (needed for asset picker)
      const context = tryGetEditorLayoutContext();
      const renderer = context?.renderer ?? null;

      // ========================================
      // Animations List Section
      // ========================================

      // Build list items for EditorLayout.listSection
      const listItems = data.animations.map((asset) => ({
        id: asset.guid,
        displayName: getAnimationDisplayName(asset),
        data: asset,
      }));

      // Check for pending animation asset selection
      const pending = pendingAnimationAssetPicker.get(popupId);
      if (pending && pending.result !== undefined) {
        const newAsset = pending.result;
        pendingAnimationAssetPicker.delete(popupId);
        if (newAsset) {
          // Add to animations array if not already present
          if (!data.animations.some((a) => a.guid === newAsset.guid)) {
            data.animations.push(newAsset);
          }
        }
      }

      // Handle add animation - open asset picker
      const handleAddAnimation = () => {
        openAssetPicker(popupId);
        pendingAnimationAssetPicker.set(popupId, { result: undefined });
      };

      // Handle remove animation
      const handleRemoveAnimation = (guid: string) => {
        const index = data.animations.findIndex((a) => a.guid === guid);
        if (index !== -1) {
          // If this was the current animation, clear it
          const asset = data.animations[index];
          if (asset?.isLoaded && asset.data?.id === data.currentAnimationId) {
            data.currentAnimationId = null;
          }
          data.animations.splice(index, 1);
        }
      };

      // Render animations list section using EditorLayout
      EditorLayout.listSection(
        'Animations',
        listItems,
        handleAddAnimation,
        handleRemoveAnimation,
        {
          defaultOpen: true,
          emptyMessage: 'No animations added',
          addTooltip: 'Add Animation',
        }
      );

      // Render asset picker modal
      if (renderer) {
        renderAssetPickerModal({
          popupId,
          title: 'Select Animation',
          assetTypes: ['animation'],
          selectedGuid: null,
          renderer,
          onSelect: (runtimeAsset) => {
            pendingAnimationAssetPicker.set(popupId, {
              result: runtimeAsset as RuntimeAsset<AnimationClip> | null,
            });
          },
          onCancel: () => {
            pendingAnimationAssetPicker.delete(popupId);
          },
        });
      }

      EditorLayout.spacing();

      // ========================================
      // Fields with aligned labels
      // ========================================

      EditorLayout.beginLabelsWidth(['Current Animation', 'Play On Start', 'Speed']);

      // ========================================
      // Current Animation Dropdown
      // ========================================

      // Build options for current animation selector
      // Filter out __editor_preview__ from the display
      const animationOptions: Array<{ value: string | null; label: string }> = [];

      for (const asset of data.animations) {
        if (asset.isLoaded && asset.data) {
          // Skip the editor preview animation
          if (asset.data.id === '__editor_preview__') continue;

          animationOptions.push({
            value: asset.data.id,
            label: getAnimationDisplayName(asset),
          });
        }
      }

      // Don't show __editor_preview__ as current selection either
      const displayCurrentId =
        data.currentAnimationId === '__editor_preview__' ? null : data.currentAnimationId;

      const [selectedAnimId, animChanged] = EditorLayout.selectField(
        'Current Animation',
        displayCurrentId,
        animationOptions,
        {
          allowNone: true,
          noneLabel: '(None)',
          tooltip: 'The animation to play',
        }
      );

      if (animChanged) {
        data.currentAnimationId = selectedAnimId;
      }

      // Show warning if no animations loaded
      if (animationOptions.length === 0 && data.animations.length > 0) {
        EditorLayout.hint('  (Loading animations...)');
      }

      // ========================================
      // Play On Start Checkbox
      // ========================================

      const [playOnStartValue, playOnStartChanged] = EditorLayout.checkboxField(
        'Play On Start',
        data.playOnStart,
        { tooltip: 'Start playing the current animation when gameplay begins' }
      );

      if (playOnStartChanged) {
        data.playOnStart = playOnStartValue;
      }

      // ========================================
      // Speed Field
      // ========================================

      const [speedValue, speedChanged] = EditorLayout.numberField(
        'Speed',
        data.speed,
        {
          min: 0.1,
          max: 10.0,
          speed: 0.01,
          tooltip: 'Playback speed multiplier (1.0 = normal)',
        }
      );

      if (speedChanged) {
        data.speed = speedValue;
      }

      EditorLayout.endLabelsWidth();
    },
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
    playOnStart: true,
    speed: 1.0,
    isPlaying: false,
    currentTime: 0,
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
 * Get the currently active AnimationClip from loaded assets or loadedClips map
 */
export function getCurrentClip(
  controller: AnimationControllerData
): AnimationClip | null {
  if (!controller.currentAnimationId) return null;

  // First check loadedClips (used for editor preview)
  if (controller.loadedClips) {
    const clip = controller.loadedClips.get(controller.currentAnimationId);
    if (clip) {
      return clip;
    }
  }

  // Then check animation assets
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
  // Find the animation by clip ID or asset GUID
  const asset = controller.animations.find(
    (a) => a.isLoaded && (a.data?.id === animationId || a.guid === animationId)
  );
  if (!asset || !asset.data) return false;

  // Always use the clip's internal ID for currentAnimationId
  // This ensures getCurrentClip can find it consistently
  const clipId = asset.data.id;

  // If already playing this clip and not restarting, do nothing
  if (
    controller.currentAnimationId === clipId &&
    controller.isPlaying &&
    !options?.restart
  ) {
    return true;
  }

  controller.currentAnimationId = clipId;
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
