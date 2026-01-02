import { Matrix4 as THREEMatrix4 } from 'three';

/**
 * JSON representation of Matrix4
 */
export interface Matrix4Metadata {
  elements: number[];
}

/**
 * Extended Matrix4 with serialization support
 */
export class Matrix4 extends THREEMatrix4 {
  /**
   * Serialize a Matrix4 to JSON-compatible object
   */
  static serialize(target: Matrix4 | THREEMatrix4): Matrix4Metadata {
    return {
      elements: Array.from(target.elements),
    };
  }

  /**
   * Deserialize JSON data back to Matrix4 instance
   */
  static deserialize(data: Matrix4Metadata): Matrix4 {
    const matrix = new Matrix4();
    matrix.fromArray(data.elements);
    return matrix;
  }

  /**
   * Type guard to check if value is Matrix4Metadata
   */
  static isMetadata(value: unknown): value is Matrix4Metadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    const elements = obj['elements'];
    return (
      Array.isArray(elements) &&
      elements.length === 16 &&
      elements.every((e) => typeof e === 'number')
    );
  }
}
