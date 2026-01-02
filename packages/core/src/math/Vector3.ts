import { Vector3 as THREEVector3 } from 'three';

/**
 * JSON representation of Vector3
 */
export interface Vector3Metadata {
  x: number;
  y: number;
  z: number;
}

/**
 * Extended Vector3 with serialization support
 */
export class Vector3 extends THREEVector3 {
  /**
   * Serialize a Vector3 to JSON-compatible object
   */
  static serialize(target: Vector3 | THREEVector3): Vector3Metadata {
    return {
      x: target.x,
      y: target.y,
      z: target.z,
    };
  }

  /**
   * Deserialize JSON data back to Vector3 instance
   */
  static deserialize(data: Vector3Metadata): Vector3 {
    return new Vector3(data.x, data.y, data.z);
  }

  /**
   * Type guard to check if value is Vector3Metadata
   */
  static isMetadata(value: unknown): value is Vector3Metadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return (
      typeof obj['x'] === 'number' &&
      typeof obj['y'] === 'number' &&
      typeof obj['z'] === 'number'
    );
  }
}
