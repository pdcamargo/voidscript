/**
 * Animation Update System
 *
 * ECS system that updates all AnimationController components each frame.
 * Evaluates animation clips and applies values to entity components using
 * the property-based animation system.
 *
 * This system runs when:
 * - In play mode (EditorManager exists and is playing)
 * - Or no editor (pure game, always runs)
 * - Or in editor preview mode (for animation preview in the editor)
 */

import { system } from '@voidscript/core';
import {
  AnimationController,
  getCurrentClip,
  type AnimationControllerData,
} from '../components/animation/animation-controller.js';
import { AnimationManager } from '../../animation/animation-manager.js';
import { LoopMode, type TrackValue, type GroupedTrackValues } from '../../animation/animation-clip.js';
import {
  parsePropertyPath,
  resolveComponentType,
  setNestedProperty,
  buildPropertyPath,
} from '../../animation/property-path.js';
import {
  applyValueHandler,
  hasValueHandler,
  type ValueHandlerContext,
} from '../../animation/value-handlers.js';
import { isColorLike, isVector3Like } from '../../animation/interpolation.js';
import type { Entity } from '@voidscript/core';
import type { Command } from '@voidscript/core';
import {
  isGameplayActive,
  isAnimationPreviewActive,
  getAnimationPreviewEntity,
  or,
} from '../../editor/system-conditions.js';

// ============================================================================
// Animation Update System
// ============================================================================

/**
 * Condition for running the animation system.
 * Runs during gameplay OR during animation preview in editor.
 */
const isAnimationActive = or(isGameplayActive(), isAnimationPreviewActive());

/**
 * System that updates all AnimationController components.
 *
 * Registered automatically by Application.addBuiltInSystems().
 * Runs in the 'update' phase.
 *
 * Executes when:
 * - In play mode (EditorManager exists and is playing)
 * - Or no editor (pure game, always runs)
 * - Or in editor animation preview mode (only for the preview entity)
 */
export const animationUpdateSystem = system(({ commands }) => {
  const animManager = commands.getResource(AnimationManager);
  const deltaTime = animManager.getEffectiveDeltaTime(commands.getDeltaTime());

  // Check if we're in preview mode
  const previewEntity = getAnimationPreviewEntity();
  const isPreviewMode = previewEntity !== null;

  // Skip if paused (unless we're in preview mode which manages its own time)
  if (deltaTime === 0 && !isPreviewMode) return;

  // Update all entities with AnimationController
  commands
    .query()
    .all(AnimationController)
    .each((entity, controller) => {
      // In preview mode, only update the preview entity
      if (isPreviewMode && entity !== previewEntity) return;

      updateAnimationController(entity, controller, deltaTime, commands, isPreviewMode);
    });
}).runIf(isAnimationActive);

// ============================================================================
// Internal Functions
// ============================================================================

/**
 * Update a single animation controller
 */
function updateAnimationController(
  entity: Entity,
  controller: AnimationControllerData,
  deltaTime: number,
  commands: Command,
  isPreviewMode: boolean = false,
): void {
  // Skip if no animation selected
  if (!controller.currentAnimationId) return;

  // Handle playOnStart: if playOnStart is true, not playing, and time is at 0, start playing
  // This ensures animations start automatically when gameplay begins
  if (
    !isPreviewMode &&
    controller.playOnStart &&
    !controller.isPlaying &&
    controller.currentTime === 0 &&
    controller.loopCount === 0
  ) {
    controller.isPlaying = true;
  }

  // In preview mode, we always evaluate at the current time (managed by editor)
  // In normal mode, we only update if playing
  if (!isPreviewMode && !controller.isPlaying) return;

  // Get the current clip from loaded animation assets
  const clip = getCurrentClip(controller);
  if (!clip) return;

  let normalizedTime: number;
  let completed = false;
  let loopCount = 0;

  if (isPreviewMode) {
    // In preview mode, the editor manages currentTime directly
    // Just calculate normalized time without advancing
    const result = clip.calculateNormalizedTime(controller.currentTime);
    normalizedTime = result.normalizedTime;
    completed = result.completed;
    loopCount = result.loopCount;
  } else {
    // Normal playback mode - advance time by deltaTime
    controller.currentTime += deltaTime * controller.speed;

    // Calculate normalized time with loop handling
    const result = clip.calculateNormalizedTime(controller.currentTime);
    normalizedTime = result.normalizedTime;
    completed = result.completed;
    loopCount = result.loopCount;

    // Handle loop callbacks
    if (loopCount > controller.loopCount) {
      controller.loopCount = loopCount;
      controller.onLoop?.(loopCount);
    }

    // Handle completion
    if (completed && clip.loopMode === LoopMode.Once) {
      controller.isPlaying = false;
      controller.onComplete?.();
    }
  }

  // Evaluate all tracks and apply values (grouped by component)
  const groupedValues = clip.evaluateGrouped(normalizedTime);
  applyAnimationValues(entity, commands, groupedValues);
}

/**
 * Apply evaluated animation values to entity components.
 * Uses the property-based system to generically apply values to any component.
 */
function applyAnimationValues(
  entity: Entity,
  commands: Command,
  groupedValues: GroupedTrackValues,
): void {
  for (const [componentName, properties] of groupedValues) {
    // Resolve the component type from the registry
    const componentType = resolveComponentType(componentName);
    if (!componentType) {
      // Component not found in registry - skip
      continue;
    }

    // Get the component data from the entity
    const componentData = commands.tryGetComponent(entity, componentType);
    if (!componentData) {
      // Entity doesn't have this component - skip
      continue;
    }

    // Apply each property value
    for (const [propertyPath, value] of properties) {
      applyPropertyValue(entity, commands, componentName, propertyPath, componentData, value);
    }
  }
}

/**
 * Apply a single property value to a component.
 */
function applyPropertyValue(
  entity: Entity,
  commands: Command,
  componentName: string,
  propertyPath: string,
  componentData: any,
  value: TrackValue,
): void {
  // Skip undefined values (e.g., from tracks with no keyframes)
  if (value === undefined) {
    return;
  }

  const fullPropertyPath = buildPropertyPath(componentName, propertyPath);

  // Check if there's a value handler for this property
  if (hasValueHandler(fullPropertyPath)) {
    const context: ValueHandlerContext = {
      entity,
      componentData,
      commands,
      fullPropertyPath,
      componentName,
      propertyPath,
    };

    const transformedValue = applyValueHandler(value, context);

    // If handler returns undefined, it means it applied the value directly
    if (transformedValue === undefined) {
      return;
    }

    // Otherwise, use the transformed value
    value = transformedValue as TrackValue;
  }

  // Apply the value to the component using the property path
  applyValueToComponent(componentData, propertyPath, value);
}

/**
 * Apply a value to a component using a property path.
 * Handles both simple properties and nested paths (e.g., "position.x").
 */
function applyValueToComponent(componentData: any, propertyPath: string, value: TrackValue): void {
  // Check if this is a nested path
  const dotIndex = propertyPath.indexOf('.');
  if (dotIndex !== -1) {
    // Nested path like "position.x"
    setNestedProperty(componentData, propertyPath, value);
    return;
  }

  // Simple property - check if it's a complex object that needs special handling
  const existingValue = componentData[propertyPath];

  if (existingValue !== null && existingValue !== undefined && typeof existingValue === 'object') {
    // Existing value is an object - try to update its properties
    if (isVector3Like(value) && isVector3Like(existingValue)) {
      // Vector3-like: update x, y, z
      existingValue.x = value.x;
      existingValue.y = value.y;
      existingValue.z = value.z;
      return;
    }

    if (isColorLike(value) && isColorLike(existingValue)) {
      // Color-like: update r, g, b, a
      existingValue.r = value.r;
      existingValue.g = value.g;
      existingValue.b = value.b;
      existingValue.a = value.a;
      return;
    }
  }

  // For simple values or when replacing the whole object
  componentData[propertyPath] = value;
}
