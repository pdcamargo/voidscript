import { Matrix3 as THREEMatrix3 } from 'three';

/**
 * JSON representation of Matrix3
 */
export interface Matrix3Metadata {
  elements: number[];
}

/**
 * Extended Matrix3 with serialization support
 */
export class Matrix3 extends THREEMatrix3 {
  /**
   * Serialize a Matrix3 to JSON-compatible object
   */
  static serialize(target: Matrix3 | THREEMatrix3): Matrix3Metadata {
    return {
      elements: Array.from(target.elements),
    };
  }

  /**
   * Deserialize JSON data back to Matrix3 instance
   */
  static deserialize(data: Matrix3Metadata): Matrix3 {
    const matrix = new Matrix3();
    matrix.fromArray(data.elements);
    return matrix;
  }

  /**
   * Type guard to check if value is Matrix3Metadata
   */
  static isMetadata(value: unknown): value is Matrix3Metadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    const elements = obj['elements'];
    return (
      Array.isArray(elements) &&
      elements.length === 9 &&
      elements.every((e) => typeof e === 'number')
    );
  }
}
