import { Color as THREEColor } from 'three';

/**
 * JSON representation of Color
 */
export interface ColorMetadata {
  r: number;
  g: number;
  b: number;
}

/**
 * Extended Color with serialization support
 */
export class Color extends THREEColor {
  /**
   * Serialize a Color to JSON-compatible object
   */
  static serialize(target: Color | THREEColor): ColorMetadata {
    return {
      r: target.r,
      g: target.g,
      b: target.b,
    };
  }

  /**
   * Deserialize JSON data back to Color instance
   */
  static deserialize(data: ColorMetadata): Color {
    return new Color(data.r, data.g, data.b);
  }

  /**
   * Type guard to check if value is ColorMetadata
   */
  static isMetadata(value: unknown): value is ColorMetadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return (
      typeof obj['r'] === 'number' &&
      typeof obj['g'] === 'number' &&
      typeof obj['b'] === 'number'
    );
  }
}
