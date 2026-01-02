import { Frustum as THREEFrustum } from 'three';
import { Plane, type PlaneMetadata } from './Plane.js';

/**
 * JSON representation of Frustum
 */
export interface FrustumMetadata {
  planes: PlaneMetadata[];
}

/**
 * Extended Frustum with serialization support
 */
export class Frustum extends THREEFrustum {
  /**
   * Serialize a Frustum to JSON-compatible object
   */
  static serialize(target: Frustum | THREEFrustum): FrustumMetadata {
    return {
      planes: target.planes.map((plane) => Plane.serialize(plane)),
    };
  }

  /**
   * Deserialize JSON data back to Frustum instance
   */
  static deserialize(data: FrustumMetadata): Frustum {
    const planes = data.planes.map((planeData) => Plane.deserialize(planeData));
    return new Frustum(
      planes[0],
      planes[1],
      planes[2],
      planes[3],
      planes[4],
      planes[5],
    );
  }

  /**
   * Type guard to check if value is FrustumMetadata
   */
  static isMetadata(value: unknown): value is FrustumMetadata {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    const planes = obj['planes'];
    return (
      Array.isArray(planes) &&
      planes.length === 6 &&
      planes.every((plane) => Plane.isMetadata(plane))
    );
  }
}
