import { Line3 as THREELine3 } from 'three';
import { Vector3, type Vector3Metadata } from './Vector3.js';

/**
 * JSON representation of Line3
 */
export interface Line3Metadata {
  start: Vector3Metadata;
  end: Vector3Metadata;
}

/**
 * Extended Line3 with serialization support
 */
export class Line3 extends THREELine3 {
  /**
   * Serialize a Line3 to JSON-compatible object
   */
  static serialize(target: Line3 | THREELine3): Line3Metadata {
    return {
      start: Vector3.serialize(target.start),
      end: Vector3.serialize(target.end),
    };
  }

  /**
   * Deserialize JSON data back to Line3 instance
   */
  static deserialize(data: Line3Metadata): Line3 {
    return new Line3(
      Vector3.deserialize(data.start),
      Vector3.deserialize(data.end),
    );
  }

  /**
   * Type guard to check if value is Line3Metadata
   */
  static isMetadata(value: unknown): value is Line3Metadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return Vector3.isMetadata(obj['start']) && Vector3.isMetadata(obj['end']);
  }
}
