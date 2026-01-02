import { Spherical as THREESpherical } from 'three';

/**
 * JSON representation of Spherical
 */
export interface SphericalMetadata {
  radius: number;
  phi: number;
  theta: number;
}

/**
 * Extended Spherical with serialization support
 */
export class Spherical extends THREESpherical {
  /**
   * Serialize a Spherical to JSON-compatible object
   */
  static serialize(target: Spherical | THREESpherical): SphericalMetadata {
    return {
      radius: target.radius,
      phi: target.phi,
      theta: target.theta,
    };
  }

  /**
   * Deserialize JSON data back to Spherical instance
   */
  static deserialize(data: SphericalMetadata): Spherical {
    return new Spherical(data.radius, data.phi, data.theta);
  }

  /**
   * Type guard to check if value is SphericalMetadata
   */
  static isMetadata(value: unknown): value is SphericalMetadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return (
      typeof obj['radius'] === 'number' &&
      typeof obj['phi'] === 'number' &&
      typeof obj['theta'] === 'number'
    );
  }
}
