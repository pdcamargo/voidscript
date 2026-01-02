import { Plane as THREEPlane } from 'three';
import { Vector3, type Vector3Metadata } from './Vector3.js';

/**
 * JSON representation of Plane
 */
export interface PlaneMetadata {
  normal: Vector3Metadata;
  constant: number;
}

/**
 * Extended Plane with serialization support
 */
export class Plane extends THREEPlane {
  /**
   * Serialize a Plane to JSON-compatible object
   */
  static serialize(target: Plane | THREEPlane): PlaneMetadata {
    return {
      normal: Vector3.serialize(target.normal),
      constant: target.constant,
    };
  }

  /**
   * Deserialize JSON data back to Plane instance
   */
  static deserialize(data: PlaneMetadata): Plane {
    return new Plane(Vector3.deserialize(data.normal), data.constant);
  }

  /**
   * Type guard to check if value is PlaneMetadata
   */
  static isMetadata(value: unknown): value is PlaneMetadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return Vector3.isMetadata(obj['normal']) && typeof obj['constant'] === 'number';
  }
}
