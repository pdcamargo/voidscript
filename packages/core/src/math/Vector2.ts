import { Vector2 as THREEVector2 } from 'three';

/**
 * JSON representation of Vector2
 */
export interface Vector2Metadata {
  x: number;
  y: number;
}

/**
 * Extended Vector2 with serialization support
 */
export class Vector2 extends THREEVector2 {
  /**
   * Serialize a Vector2 to JSON-compatible object
   */
  static serialize(target: Vector2 | THREEVector2): Vector2Metadata {
    return {
      x: target.x,
      y: target.y,
    };
  }

  /**
   * Deserialize JSON data back to Vector2 instance
   */
  static deserialize(data: Vector2Metadata): Vector2 {
    return new Vector2(data.x, data.y);
  }

  /**
   * Type guard to check if value is Vector2Metadata
   */
  static isMetadata(value: unknown): value is Vector2Metadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return typeof obj['x'] === 'number' && typeof obj['y'] === 'number';
  }
}
