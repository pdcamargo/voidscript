import { Triangle as THREETriangle } from 'three';
import { Vector3, type Vector3Metadata } from './Vector3.js';

/**
 * JSON representation of Triangle
 */
export interface TriangleMetadata {
  a: Vector3Metadata;
  b: Vector3Metadata;
  c: Vector3Metadata;
}

/**
 * Extended Triangle with serialization support
 */
export class Triangle extends THREETriangle {
  /**
   * Serialize a Triangle to JSON-compatible object
   */
  static serialize(target: Triangle | THREETriangle): TriangleMetadata {
    return {
      a: Vector3.serialize(target.a),
      b: Vector3.serialize(target.b),
      c: Vector3.serialize(target.c),
    };
  }

  /**
   * Deserialize JSON data back to Triangle instance
   */
  static deserialize(data: TriangleMetadata): Triangle {
    return new Triangle(
      Vector3.deserialize(data.a),
      Vector3.deserialize(data.b),
      Vector3.deserialize(data.c),
    );
  }

  /**
   * Type guard to check if value is TriangleMetadata
   */
  static isMetadata(value: unknown): value is TriangleMetadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return (
      Vector3.isMetadata(obj['a']) &&
      Vector3.isMetadata(obj['b']) &&
      Vector3.isMetadata(obj['c'])
    );
  }
}
