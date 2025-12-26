/**
 * Animation Value Handlers
 *
 * Provides a pluggable system for special value handling during animation.
 * Value handlers can transform animation values before they are applied
 * to component properties.
 *
 * This is used for cases like sprite animations where a sprite ID needs
 * to be resolved to actual texture/tile data.
 */

import type { Entity } from '../ecs/entity.js';
import type { Command } from '../ecs/command.js';
import type { SpriteValue } from './interpolation.js';
import { AssetDatabase } from '../ecs/asset-database.js';
import {
  isTextureMetadata,
  isTiledSpriteDefinition,
  isRectSpriteDefinition,
  type SpriteDefinition,
  type TextureMetadata,
} from '../ecs/asset-metadata.js';
import { RuntimeAsset } from '../ecs/runtime-asset.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Context passed to value handlers
 */
export interface ValueHandlerContext {
  /** The entity being animated */
  entity: Entity;
  /** The component data being modified */
  componentData: any;
  /** ECS commands for queries/resources */
  commands: Command;
  /** Full property path being animated */
  fullPropertyPath: string;
  /** Component name */
  componentName: string;
  /** Property path within component */
  propertyPath: string;
}

/**
 * Interface for animation value handlers
 */
export interface AnimationValueHandler<T = unknown> {
  /**
   * Transform a value before it is applied to a component.
   * Can modify the componentData directly or return a transformed value.
   *
   * @param value - The animated value to apply
   * @param context - Handler context with entity, component, etc.
   * @returns Transformed value to apply, or the same value if no transformation needed
   */
  beforeApply(value: T, context: ValueHandlerContext): unknown;
}

// ============================================================================
// Handler Registry
// ============================================================================

/**
 * Registry of value handlers keyed by full property path
 */
const valueHandlers = new Map<string, AnimationValueHandler<any>>();

/**
 * Register a value handler for a specific property path
 *
 * @param fullPropertyPath - Full property path (e.g., "Sprite2D.sprite")
 * @param handler - Handler to register
 */
export function registerValueHandler<T>(
  fullPropertyPath: string,
  handler: AnimationValueHandler<T>,
): void {
  valueHandlers.set(fullPropertyPath, handler);
}

/**
 * Unregister a value handler
 */
export function unregisterValueHandler(fullPropertyPath: string): void {
  valueHandlers.delete(fullPropertyPath);
}

/**
 * Get a value handler for a property path
 */
export function getValueHandler(fullPropertyPath: string): AnimationValueHandler<any> | null {
  return valueHandlers.get(fullPropertyPath) ?? null;
}

/**
 * Check if a property path has a registered value handler
 */
export function hasValueHandler(fullPropertyPath: string): boolean {
  return valueHandlers.has(fullPropertyPath);
}

/**
 * Apply value handler if one exists, otherwise return the value unchanged
 */
export function applyValueHandler<T>(
  value: T,
  context: ValueHandlerContext,
): unknown {
  const handler = valueHandlers.get(context.fullPropertyPath);
  if (handler) {
    return handler.beforeApply(value, context);
  }
  return value;
}

// ============================================================================
// Built-in Handlers
// ============================================================================

/**
 * Sprite value handler - resolves sprite IDs to texture/tile data
 *
 * When a sprite animation keyframe contains a SpriteValue like { spriteId: 'walk1' },
 * this handler:
 * 1. Looks up the sprite definition in the asset database
 * 2. Updates the Sprite2D component's texture if needed
 * 3. Sets tileIndex, tileSize, tilesetSize, or spriteRect based on sprite type
 */
const spriteValueHandler: AnimationValueHandler<SpriteValue> = {
  beforeApply(value: SpriteValue, context: ValueHandlerContext): unknown {
    const { componentData: sprite } = context;

    if (!value || !value.spriteId) {
      return value;
    }

    // Determine which texture contains this sprite
    let targetTextureGuid: string | null = value.textureGuid ?? null;
    let spriteDef: SpriteDefinition | undefined;
    let textureMetadata: TextureMetadata | null = null;

    // If textureGuid is explicitly set in the animation value, use it
    if (targetTextureGuid) {
      const metadata = AssetDatabase.getMetadata(targetTextureGuid);
      if (metadata && isTextureMetadata(metadata)) {
        textureMetadata = metadata;
        spriteDef = metadata.sprites?.find((s) => s.id === value.spriteId);
      }
    }

    // If no explicit texture or sprite not found, search all textures
    if (!spriteDef) {
      const found = AssetDatabase.findSpriteById(value.spriteId);
      if (found) {
        targetTextureGuid = found.textureGuid;
        spriteDef = found.sprite;
        const metadata = AssetDatabase.getMetadata(targetTextureGuid);
        if (metadata && isTextureMetadata(metadata)) {
          textureMetadata = metadata;
        }
      }
    }

    // If sprite found, apply it
    if (spriteDef && targetTextureGuid && textureMetadata) {
      // Switch texture if different from current
      if (sprite.texture?.guid !== targetTextureGuid) {
        sprite.texture = new RuntimeAsset(targetTextureGuid, textureMetadata);
      }

      // Handle based on sprite type (tile vs rect)
      if (isTiledSpriteDefinition(spriteDef)) {
        // Tile-based sprite
        sprite.tileIndex = spriteDef.tileIndex;
        sprite.tileSize = { x: spriteDef.tileWidth, y: spriteDef.tileHeight };
        sprite.spriteRect = null;

        // Update tilesetSize from texture if loaded, or metadata
        if (sprite.texture?.isLoaded && sprite.texture.data?.image) {
          const image = sprite.texture.data.image;
          sprite.tilesetSize = {
            x: image.width || image.videoWidth || spriteDef.tileWidth,
            y: image.height || image.videoHeight || spriteDef.tileHeight,
          };
        } else {
          sprite.tilesetSize = {
            x: textureMetadata.width || spriteDef.tileWidth,
            y: textureMetadata.height || spriteDef.tileHeight,
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

    // Return undefined to indicate the value was applied directly
    return undefined;
  },
};

// ============================================================================
// Handler Registration
// ============================================================================

/**
 * Initialize built-in value handlers
 * Called automatically when the module is loaded
 */
export function initializeBuiltInHandlers(): void {
  // Register sprite handler
  registerValueHandler('Sprite2D.sprite', spriteValueHandler);
}

// Auto-initialize built-in handlers
initializeBuiltInHandlers();

// ============================================================================
// Exports
// ============================================================================

export { spriteValueHandler };
