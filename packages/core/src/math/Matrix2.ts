import { Matrix2 as THREEMatrix2 } from 'three';

/**
 * JSON representation of Matrix2
 */
export interface Matrix2Metadata {
  elements: number[];
}

/**
 * Extended Matrix2 with serialization support
 */
export class Matrix2 extends THREEMatrix2 {
  /**
   * Serialize a Matrix2 to JSON-compatible object
   */
  static serialize(target: Matrix2 | THREEMatrix2): Matrix2Metadata {
    return {
      elements: Array.from(target.elements),
    };
  }

  /**
   * Deserialize JSON data back to Matrix2 instance
   */
  static deserialize(data: Matrix2Metadata): Matrix2 {
    const matrix = new Matrix2();
    matrix.fromArray(data.elements);
    return matrix;
  }

  /**
   * Type guard to check if value is Matrix2Metadata
   */
  static isMetadata(value: unknown): value is Matrix2Metadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    const elements = obj['elements'];
    return (
      Array.isArray(elements) &&
      elements.length === 4 &&
      elements.every((e) => typeof e === 'number')
    );
  }
}
