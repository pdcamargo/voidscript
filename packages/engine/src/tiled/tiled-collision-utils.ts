/**
 * Tiled Collision Utilities
 *
 * Utilities for parsing Tiled collision shapes and converting them to Collider2D components.
 */

import type * as tiled from '@kayahr/tiled';
import type { ColliderShape2D } from '../physics/types.js';
import { Vector2 } from 'three';

/**
 * Parse a Tiled MapObject into a Collider2D shape
 *
 * Supports:
 * - Rectangles → cuboid
 * - Ellipses → ball (if circular)
 *
 * @param obj - Tiled MapObject from collision objectgroup
 * @returns ColliderShape2D or null if unsupported
 */
export function parseTiledCollisionShape(obj: tiled.MapObject): ColliderShape2D | null {
  const width = obj.width ?? 0;
  const height = obj.height ?? 0;

  // Check if ellipse
  if ((obj as any).ellipse === true) {
    // Tiled ellipses can be circles or ovals
    // For physics, we only support perfect circles (width === height)
    if (Math.abs(width - height) < 0.01) {
      // Circle - use ball collider
      return {
        type: 'ball',
        radius: width / 2,
      };
    } else {
      console.warn(
        `[parseTiledCollisionShape] Ellipse collision shape with non-equal dimensions (${width}x${height}) ` +
          `is not supported. Only circular ellipses (width === height) can be converted to ball colliders. Skipping.`
      );
      return null;
    }
  }

  // Check if polygon or polyline
  if ((obj as any).polygon || (obj as any).polyline) {
    console.warn(
      `[parseTiledCollisionShape] Polygon/polyline collision shapes are not yet supported. ` +
        `Use rectangles or circles for now. Skipping object at (${obj.x}, ${obj.y}).`
    );
    return null;
  }

  // Default to rectangle (cuboid)
  if (width > 0 && height > 0) {
    return {
      type: 'cuboid',
      halfWidth: width / 2,
      halfHeight: height / 2,
    };
  }

  // No valid shape
  console.warn(
    `[parseTiledCollisionShape] MapObject at (${obj.x}, ${obj.y}) has no valid collision shape. Skipping.`
  );
  return null;
}

/**
 * Convert a Tiled MapObject to a Collider2D shape with offset
 *
 * Handles coordinate conversion from Tiled (top-left origin, Y+ down, pixels)
 * to Collider2D (center origin, Y+ up, world units).
 *
 * @param obj - Tiled MapObject
 * @param tileWidth - Tile width in pixels
 * @param tileHeight - Tile height in pixels
 * @returns Shape and offset in world units, or null if unsupported
 */
export function tiledObjectToColliderShape(
  obj: tiled.MapObject,
  tileWidth: number,
  tileHeight: number
): { shape: ColliderShape2D; offset: Vector2 } | null {
  const shape = parseTiledCollisionShape(obj);
  if (!shape) return null;

  const width = obj.width ?? 0;
  const height = obj.height ?? 0;

  // Tiled objects have origin at top-left corner (x, y)
  // We need to calculate offset from object origin to shape center

  let offsetX = 0;
  let offsetY = 0;

  if (shape.type === 'cuboid') {
    // Rectangle center is at (width/2, height/2) from top-left
    // Convert to world units
    offsetX = (obj.x + width / 2) / tileWidth;
    offsetY = -(obj.y + height / 2) / tileHeight; // Flip Y
  } else if (shape.type === 'ball') {
    // Circle center is at (width/2, height/2) from top-left
    offsetX = (obj.x + width / 2) / tileWidth;
    offsetY = -(obj.y + height / 2) / tileHeight; // Flip Y
  }

  // Convert shape dimensions to world units
  const worldShape = convertShapeToWorldUnits(shape, tileWidth, tileHeight);

  return {
    shape: worldShape,
    offset: new Vector2(offsetX, offsetY),
  };
}

/**
 * Convert a collision shape from pixel units to world units
 *
 * @param shape - Shape in pixel units
 * @param tileWidth - Tile width in pixels
 * @param tileHeight - Tile height in pixels
 * @returns Shape in world units
 */
function convertShapeToWorldUnits(
  shape: ColliderShape2D,
  tileWidth: number,
  tileHeight: number
): ColliderShape2D {
  if (shape.type === 'cuboid') {
    return {
      type: 'cuboid',
      halfWidth: shape.halfWidth / tileWidth,
      halfHeight: shape.halfHeight / tileHeight,
    };
  } else if (shape.type === 'ball') {
    // Use average of tileWidth and tileHeight for uniform scaling
    const scale = (tileWidth + tileHeight) / 2;
    return {
      type: 'ball',
      radius: shape.radius / scale,
    };
  } else if (shape.type === 'capsule') {
    const scale = (tileWidth + tileHeight) / 2;
    return {
      type: 'capsule',
      halfHeight: shape.halfHeight / scale,
      radius: shape.radius / scale,
    };
  }

  return shape;
}
