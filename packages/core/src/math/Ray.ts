import { Ray as THREERay } from 'three';
import { Vector3, type Vector3Metadata } from './Vector3.js';

/**
 * JSON representation of Ray
 */
export interface RayMetadata {
  origin: Vector3Metadata;
  direction: Vector3Metadata;
}

/**
 * Extended Ray with serialization support
 */
export class Ray extends THREERay {
  /**
   * Serialize a Ray to JSON-compatible object
   */
  static serialize(target: Ray | THREERay): RayMetadata {
    return {
      origin: Vector3.serialize(target.origin),
      direction: Vector3.serialize(target.direction),
    };
  }

  /**
   * Deserialize JSON data back to Ray instance
   */
  static deserialize(data: RayMetadata): Ray {
    return new Ray(
      Vector3.deserialize(data.origin),
      Vector3.deserialize(data.direction),
    );
  }

  /**
   * Type guard to check if value is RayMetadata
   */
  static isMetadata(value: unknown): value is RayMetadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return Vector3.isMetadata(obj['origin']) && Vector3.isMetadata(obj['direction']);
  }
}
