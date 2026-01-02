import { Box3 as THREEBox3 } from 'three';
import { Vector3, type Vector3Metadata } from './Vector3.js';

/**
 * JSON representation of Box3
 */
export interface Box3Metadata {
  min: Vector3Metadata;
  max: Vector3Metadata;
}

/**
 * Extended Box3 with serialization support
 */
export class Box3 extends THREEBox3 {
  /**
   * Serialize a Box3 to JSON-compatible object
   */
  static serialize(target: Box3 | THREEBox3): Box3Metadata {
    return {
      min: Vector3.serialize(target.min),
      max: Vector3.serialize(target.max),
    };
  }

  /**
   * Deserialize JSON data back to Box3 instance
   */
  static deserialize(data: Box3Metadata): Box3 {
    return new Box3(
      Vector3.deserialize(data.min),
      Vector3.deserialize(data.max),
    );
  }

  /**
   * Type guard to check if value is Box3Metadata
   */
  static isMetadata(value: unknown): value is Box3Metadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return Vector3.isMetadata(obj['min']) && Vector3.isMetadata(obj['max']);
  }
}
