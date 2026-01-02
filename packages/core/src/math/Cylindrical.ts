import { Cylindrical as THREECylindrical } from 'three';

/**
 * JSON representation of Cylindrical
 */
export interface CylindricalMetadata {
  radius: number;
  theta: number;
  y: number;
}

/**
 * Extended Cylindrical with serialization support
 */
export class Cylindrical extends THREECylindrical {
  /**
   * Serialize a Cylindrical to JSON-compatible object
   */
  static serialize(target: Cylindrical | THREECylindrical): CylindricalMetadata {
    return {
      radius: target.radius,
      theta: target.theta,
      y: target.y,
    };
  }

  /**
   * Deserialize JSON data back to Cylindrical instance
   */
  static deserialize(data: CylindricalMetadata): Cylindrical {
    return new Cylindrical(data.radius, data.theta, data.y);
  }

  /**
   * Type guard to check if value is CylindricalMetadata
   */
  static isMetadata(value: unknown): value is CylindricalMetadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return (
      typeof obj['radius'] === 'number' &&
      typeof obj['theta'] === 'number' &&
      typeof obj['y'] === 'number'
    );
  }
}
