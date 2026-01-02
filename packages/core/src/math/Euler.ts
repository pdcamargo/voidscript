import { Euler as THREEEuler, type EulerOrder } from 'three';

/**
 * JSON representation of Euler
 */
export interface EulerMetadata {
  x: number;
  y: number;
  z: number;
  order: EulerOrder;
}

/**
 * Extended Euler with serialization support
 */
export class Euler extends THREEEuler {
  /**
   * Serialize an Euler to JSON-compatible object
   */
  static serialize(target: Euler | THREEEuler): EulerMetadata {
    return {
      x: target.x,
      y: target.y,
      z: target.z,
      order: target.order,
    };
  }

  /**
   * Deserialize JSON data back to Euler instance
   */
  static deserialize(data: EulerMetadata): Euler {
    return new Euler(data.x, data.y, data.z, data.order);
  }

  /**
   * Type guard to check if value is EulerMetadata
   */
  static isMetadata(value: unknown): value is EulerMetadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return (
      typeof obj['x'] === 'number' &&
      typeof obj['y'] === 'number' &&
      typeof obj['z'] === 'number' &&
      typeof obj['order'] === 'string'
    );
  }
}

// Re-export EulerOrder type for convenience
export type { EulerOrder };
