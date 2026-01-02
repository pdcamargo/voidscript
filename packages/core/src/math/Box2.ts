import { Box2 as THREEBox2 } from 'three';
import { Vector2, type Vector2Metadata } from './Vector2.js';

/**
 * JSON representation of Box2
 */
export interface Box2Metadata {
  min: Vector2Metadata;
  max: Vector2Metadata;
}

/**
 * Extended Box2 with serialization support
 */
export class Box2 extends THREEBox2 {
  /**
   * Serialize a Box2 to JSON-compatible object
   */
  static serialize(target: Box2 | THREEBox2): Box2Metadata {
    return {
      min: Vector2.serialize(target.min),
      max: Vector2.serialize(target.max),
    };
  }

  /**
   * Deserialize JSON data back to Box2 instance
   */
  static deserialize(data: Box2Metadata): Box2 {
    return new Box2(
      Vector2.deserialize(data.min),
      Vector2.deserialize(data.max),
    );
  }

  /**
   * Type guard to check if value is Box2Metadata
   */
  static isMetadata(value: unknown): value is Box2Metadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return Vector2.isMetadata(obj['min']) && Vector2.isMetadata(obj['max']);
  }
}
