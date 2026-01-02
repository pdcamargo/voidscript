import { Quaternion as THREEQuaternion } from 'three';

/**
 * JSON representation of Quaternion
 */
export interface QuaternionMetadata {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Extended Quaternion with serialization support
 */
export class Quaternion extends THREEQuaternion {
  /**
   * Serialize a Quaternion to JSON-compatible object
   */
  static serialize(target: Quaternion | THREEQuaternion): QuaternionMetadata {
    return {
      x: target.x,
      y: target.y,
      z: target.z,
      w: target.w,
    };
  }

  /**
   * Deserialize JSON data back to Quaternion instance
   */
  static deserialize(data: QuaternionMetadata): Quaternion {
    return new Quaternion(data.x, data.y, data.z, data.w);
  }

  /**
   * Type guard to check if value is QuaternionMetadata
   */
  static isMetadata(value: unknown): value is QuaternionMetadata {
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
