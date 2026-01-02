import { Sphere as THREESphere } from 'three';
import { Vector3, type Vector3Metadata } from './Vector3.js';

/**
 * JSON representation of Sphere
 */
export interface SphereMetadata {
  center: Vector3Metadata;
  radius: number;
}

/**
 * Extended Sphere with serialization support
 */
export class Sphere extends THREESphere {
  /**
   * Serialize a Sphere to JSON-compatible object
   */
  static serialize(target: Sphere | THREESphere): SphereMetadata {
    return {
      center: Vector3.serialize(target.center),
      radius: target.radius,
    };
  }

  /**
   * Deserialize JSON data back to Sphere instance
   */
  static deserialize(data: SphereMetadata): Sphere {
    return new Sphere(Vector3.deserialize(data.center), data.radius);
  }

  /**
   * Type guard to check if value is SphereMetadata
   */
  static isMetadata(value: unknown): value is SphereMetadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return Vector3.isMetadata(obj['center']) && typeof obj['radius'] === 'number';
  }
}
