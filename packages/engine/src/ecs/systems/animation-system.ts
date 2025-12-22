/**
 * Animation Update System
 *
 * ECS system that updates all AnimationController components each frame.
 * Evaluates animation clips and applies values to entity components.
 *
 * Note: This system only runs when gameplay is active (play mode or no editor).
 * In edit mode, animations are paused.
 */

import { system } from '../system.js';
import {
  AnimationController,
  getCurrentClip,
  type AnimationControllerData,
} from '../components/animation/animation-controller.js';
import { Transform3D } from '../components/rendering/transform-3d.js';
import { Sprite2D, type Sprite2DData } from '../components/rendering/sprite-2d.js';
import { AnimationManager } from '../../animation/animation-manager.js';
import { LoopMode, type TrackValue } from '../../animation/animation-clip.js';
import type { Color, SpriteValue } from '../../animation/animation-track.js';
import type { Vector3 } from '../../math/vector3.js';
import type { Entity } from '../entity.js';
import type { Command } from '../command.js';
import { isGameplayActive } from '../../editor/system-conditions.js';
import { AssetDatabase } from '../asset-database.js';
import {
  isTextureMetadata,
  isTiledSpriteDefinition,
  isRectSpriteDefinition,
} from '../asset-metadata.js';

// ============================================================================
// Animation Update System
// ============================================================================

/**
 * System that updates all AnimationController components.
 *
 * Registered automatically by Application.addBuiltInSystems().
 * Runs in the 'update' phase.
 *
 * Only executes when:
 * - In play mode (EditorManager exists and is playing)
 * - Or no editor (pure game, always runs)
 */
export const animationUpdateSystem = system(({ commands }) => {
  const animManager = commands.getResource(AnimationManager);
  const deltaTime = animManager.getEffectiveDeltaTime(commands.getDeltaTime());

  // Skip if paused
  if (deltaTime === 0) return;

  // Update all entities with AnimationController
  commands
    .query()
    .all(AnimationController)
    .each((entity, controller) => {
      updateAnimationController(entity, controller, deltaTime, commands);
    });
}).runIf(isGameplayActive());

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
  commands: Command
): void {
  // Skip if not playing or no animation selected
  if (!controller.isPlaying || !controller.currentAnimationId) return;

  // Get the current clip from loaded animation assets
  const clip = getCurrentClip(controller);
  if (!clip) return;

  // Update time
  controller.currentTime += deltaTime * controller.speed;

  // Calculate normalized time with loop handling
  const { normalizedTime, completed, loopCount } = clip.calculateNormalizedTime(
    controller.currentTime
  );

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

  // Evaluate all tracks and apply values
  const values = clip.evaluate(normalizedTime);
  applyAnimationValues(entity, commands, values);
}

/**
 * Apply evaluated animation values to entity components
 */
function applyAnimationValues(
  entity: Entity,
  commands: Command,
  values: Map<string, TrackValue>
): void {
  // Get Transform3D if it exists
  const transform = commands.tryGetComponent(entity, Transform3D);

  // Get Sprite2D if it exists (for color animations)
  const sprite = commands.tryGetComponent(entity, Sprite2D);

  for (const [propertyPath, value] of values) {
    applyPropertyValue(propertyPath, value, transform, sprite);
  }
}

/**
 * Apply a single property value based on property path
 */
function applyPropertyValue(
  propertyPath: string,
  value: TrackValue,
  transform: { position: Vector3; rotation: Vector3; scale: Vector3 } | undefined,
  sprite: Sprite2DData | undefined
): void {
  // Handle Transform3D properties
  if (transform) {
    switch (propertyPath) {
      case 'position':
        if (isVector3(value)) {
          transform.position.x = value.x;
          transform.position.y = value.y;
          transform.position.z = value.z;
        }
        break;

      case 'rotation':
        if (isVector3(value)) {
          transform.rotation.x = value.x;
          transform.rotation.y = value.y;
          transform.rotation.z = value.z;
        }
        break;

      case 'scale':
        if (isVector3(value)) {
          transform.scale.x = value.x;
          transform.scale.y = value.y;
          transform.scale.z = value.z;
        }
        break;

      case 'position.x':
        if (typeof value === 'number') transform.position.x = value;
        break;
      case 'position.y':
        if (typeof value === 'number') transform.position.y = value;
        break;
      case 'position.z':
        if (typeof value === 'number') transform.position.z = value;
        break;

      case 'rotation.x':
        if (typeof value === 'number') transform.rotation.x = value;
        break;
      case 'rotation.y':
        if (typeof value === 'number') transform.rotation.y = value;
        break;
      case 'rotation.z':
        if (typeof value === 'number') transform.rotation.z = value;
        break;

      case 'scale.x':
        if (typeof value === 'number') transform.scale.x = value;
        break;
      case 'scale.y':
        if (typeof value === 'number') transform.scale.y = value;
        break;
      case 'scale.z':
        if (typeof value === 'number') transform.scale.z = value;
        break;
    }
  }

  // Handle Sprite2D color property
  if (sprite) {
    switch (propertyPath) {
      case 'color':
        if (isColor(value)) {
          sprite.color.r = value.r;
          sprite.color.g = value.g;
          sprite.color.b = value.b;
          sprite.color.a = value.a;
        }
        break;

      case 'color.r':
        if (typeof value === 'number') sprite.color.r = value;
        break;
      case 'color.g':
        if (typeof value === 'number') sprite.color.g = value;
        break;
      case 'color.b':
        if (typeof value === 'number') sprite.color.b = value;
        break;
      case 'color.a':
      case 'opacity':
        if (typeof value === 'number') sprite.color.a = value;
        break;

      case 'tileIndex':
        if (typeof value === 'number') {
          sprite.tileIndex = Math.round(value); // Ensure integer
        }
        break;

      case 'sprite':
        if (isSpriteValue(value) && sprite.texture && sprite.texture.guid) {
          // Look up sprite definition from texture metadata
          const metadata = AssetDatabase.getMetadata(sprite.texture.guid);
          if (metadata && isTextureMetadata(metadata)) {
            const spriteDef = metadata.sprites?.find((s) => s.id === value.spriteId);
            if (spriteDef) {
              // Handle based on sprite type (tile vs rect)
              if (isTiledSpriteDefinition(spriteDef)) {
                // Tile-based sprite
                sprite.tileIndex = spriteDef.tileIndex;
                sprite.tileSize = { x: spriteDef.tileWidth, y: spriteDef.tileHeight };
                sprite.spriteRect = null;

                // Update tilesetSize from texture if loaded, or metadata
                if (sprite.texture.isLoaded && sprite.texture.data?.image) {
                  const image = sprite.texture.data.image;
                  sprite.tilesetSize = {
                    x: image.width || image.videoWidth || spriteDef.tileWidth,
                    y: image.height || image.videoHeight || spriteDef.tileHeight,
                  };
                } else {
                  sprite.tilesetSize = {
                    x: metadata.width || spriteDef.tileWidth,
                    y: metadata.height || spriteDef.tileHeight,
                  };
                }
              } else if (isRectSpriteDefinition(spriteDef)) {
                // Rect-based sprite
                sprite.spriteRect = {
                  x: spriteDef.x,
                  y: spriteDef.y,
                  width: spriteDef.width,
                  height: spriteDef.height,
                };
                sprite.tileIndex = null;
                sprite.tileSize = null;
                sprite.tilesetSize = null;
              }
            }
          }
        }
        break;
    }
  }
}

/**
 * Type guard for Vector3
 */
function isVector3(value: TrackValue): value is Vector3 {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    'y' in value &&
    'z' in value &&
    !('r' in value)
  );
}

/**
 * Type guard for Color
 */
function isColor(value: TrackValue): value is Color {
  return (
    typeof value === 'object' &&
    value !== null &&
    'r' in value &&
    'g' in value &&
    'b' in value &&
    'a' in value
  );
}

/**
 * Type guard for SpriteValue
 */
function isSpriteValue(value: TrackValue): value is SpriteValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'spriteId' in value
  );
}
