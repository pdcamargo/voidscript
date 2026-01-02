import { Vector4 as THREEVector4 } from 'three';

/**
 * JSON representation of Vector4
 */
export interface Vector4Metadata {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Extended Vector4 with serialization support
 */
export class Vector4 extends THREEVector4 {
  /**
   * Serialize a Vector4 to JSON-compatible object
   */
  static serialize(target: Vector4 | THREEVector4): Vector4Metadata {
    return {
      x: target.x,
      y: target.y,
      z: target.z,
      w: target.w,
    };
  }

  /**
   * Deserialize JSON data back to Vector4 instance
   */
  static deserialize(data: Vector4Metadata): Vector4 {
    return new Vector4(data.x, data.y, data.z, data.w);
  }

  /**
   * Type guard to check if value is Vector4Metadata
   */
  static isMetadata(value: unknown): value is Vector4Metadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return (
      typeof obj['x'] === 'number' &&
      typeof obj['y'] === 'number' &&
      typeof obj['z'] === 'number' &&
      typeof obj['w'] === 'number'
    );
  }
}
