import { SphericalHarmonics3 as THREESphericalHarmonics3 } from 'three';
import { Vector3, type Vector3Metadata } from './Vector3.js';

/**
 * JSON representation of SphericalHarmonics3
 */
export interface SphericalHarmonics3Metadata {
  coefficients: Vector3Metadata[];
}

/**
 * Extended SphericalHarmonics3 with serialization support
 */
export class SphericalHarmonics3 extends THREESphericalHarmonics3 {
  /**
   * Serialize a SphericalHarmonics3 to JSON-compatible object
   */
  static serialize(
    target: SphericalHarmonics3 | THREESphericalHarmonics3,
  ): SphericalHarmonics3Metadata {
    return {
      coefficients: target.coefficients.map((coeff) => Vector3.serialize(coeff)),
    };
  }

  /**
   * Deserialize JSON data back to SphericalHarmonics3 instance
   */
  static deserialize(data: SphericalHarmonics3Metadata): SphericalHarmonics3 {
    const sh = new SphericalHarmonics3();
    data.coefficients.forEach((coeffData, index) => {
      const coeff = sh.coefficients[index];
      if (coeff) {
        coeff.set(coeffData.x, coeffData.y, coeffData.z);
      }
    });
    return sh;
  }

  /**
   * Type guard to check if value is SphericalHarmonics3Metadata
   */
  static isMetadata(value: unknown): value is SphericalHarmonics3Metadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    const coefficients = obj['coefficients'];
    return (
      Array.isArray(coefficients) &&
      coefficients.length === 9 &&
      coefficients.every((coeff) => Vector3.isMetadata(coeff))
    );
  }
}
