/**
 * Math Type Handlers
 *
 * Provides type detection and serialization/deserialization for all math types
 * from packages/core/src/math/. Uses the existing static methods on each type.
 */

import {
  Vector2,
  Vector3,
  Vector4,
  Color,
  Quaternion,
  Euler,
  Matrix2,
  Matrix3,
  Matrix4,
  Box2,
  Box3,
  Plane,
  Ray,
  Line3,
  Triangle,
  Frustum,
  Cylindrical,
  Spherical,
  Sphere,
  SphericalHarmonics3,
  type Vector2Metadata,
  type Vector3Metadata,
  type Vector4Metadata,
  type ColorMetadata,
  type QuaternionMetadata,
  type EulerMetadata,
  type Matrix2Metadata,
  type Matrix3Metadata,
  type Matrix4Metadata,
  type Box2Metadata,
  type Box3Metadata,
  type PlaneMetadata,
  type RayMetadata,
  type Line3Metadata,
  type TriangleMetadata,
  type FrustumMetadata,
  type CylindricalMetadata,
  type SphericalMetadata,
  type SphereMetadata,
  type SphericalHarmonics3Metadata,
} from '@voidscript/core';

import { SerializedPropertyType } from '../serialized-property-type.js';

// ============================================================================
// Type Exports for convenience
// ============================================================================

export type {
  Vector2Metadata,
  Vector3Metadata,
  Vector4Metadata,
  ColorMetadata,
  QuaternionMetadata,
  EulerMetadata,
  Matrix2Metadata,
  Matrix3Metadata,
  Matrix4Metadata,
  Box2Metadata,
  Box3Metadata,
  PlaneMetadata,
  RayMetadata,
  Line3Metadata,
  TriangleMetadata,
  FrustumMetadata,
  CylindricalMetadata,
  SphericalMetadata,
  SphereMetadata,
  SphericalHarmonics3Metadata,
};

// ============================================================================
// Type Detection
// ============================================================================

/**
 * Detect the SerializedPropertyType for a math value
 * Returns null if the value is not a recognized math type
 */
export function detectMathType(value: unknown): SerializedPropertyType | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  // Order matters here - more specific types should be checked first
  // to avoid false positives (e.g., Box3 contains two Vector3s)

  // Bounding volumes (composite types - check first)
  if (Box2.isMetadata(value)) return SerializedPropertyType.Box2;
  if (Box3.isMetadata(value)) return SerializedPropertyType.Box3;
  if (Sphere.isMetadata(value)) return SerializedPropertyType.Sphere;
  if (Frustum.isMetadata(value)) return SerializedPropertyType.Frustum;

  // Geometric primitives (composite types)
  if (Triangle.isMetadata(value)) return SerializedPropertyType.Triangle;
  if (Line3.isMetadata(value)) return SerializedPropertyType.Line3;
  if (Ray.isMetadata(value)) return SerializedPropertyType.Ray;
  if (Plane.isMetadata(value)) return SerializedPropertyType.Plane;

  // SphericalHarmonics3 (array of Vector3s)
  if (SphericalHarmonics3.isMetadata(value)) return SerializedPropertyType.SphericalHarmonics3;

  // Rotation types
  if (Euler.isMetadata(value)) return SerializedPropertyType.Euler;
  if (Quaternion.isMetadata(value)) return SerializedPropertyType.Quaternion;

  // Matrix types (check by elements array length)
  if (Matrix4.isMetadata(value)) return SerializedPropertyType.Matrix4;
  if (Matrix3.isMetadata(value)) return SerializedPropertyType.Matrix3;
  if (Matrix2.isMetadata(value)) return SerializedPropertyType.Matrix2;

  // Coordinate systems
  if (Cylindrical.isMetadata(value)) return SerializedPropertyType.Cylindrical;
  if (Spherical.isMetadata(value)) return SerializedPropertyType.Spherical;

  // Vector types (check in order of specificity)
  // Vector4 has w, Quaternion also has w but was already checked
  if (Vector4.isMetadata(value)) return SerializedPropertyType.Vector4;
  if (Vector3.isMetadata(value)) return SerializedPropertyType.Vector3;
  if (Vector2.isMetadata(value)) return SerializedPropertyType.Vector2;

  // Color (has r, g, b - similar to Vector3 x, y, z)
  if (Color.isMetadata(value)) return SerializedPropertyType.Color;

  return null;
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Union type of all math type instances
 */
export type MathTypeInstance =
  | Vector2
  | Vector3
  | Vector4
  | Color
  | Quaternion
  | Euler
  | Matrix2
  | Matrix3
  | Matrix4
  | Box2
  | Box3
  | Plane
  | Ray
  | Line3
  | Triangle
  | Frustum
  | Cylindrical
  | Spherical
  | Sphere
  | SphericalHarmonics3;

/**
 * Union type of all math type metadata
 */
export type MathTypeMetadata =
  | Vector2Metadata
  | Vector3Metadata
  | Vector4Metadata
  | ColorMetadata
  | QuaternionMetadata
  | EulerMetadata
  | Matrix2Metadata
  | Matrix3Metadata
  | Matrix4Metadata
  | Box2Metadata
  | Box3Metadata
  | PlaneMetadata
  | RayMetadata
  | Line3Metadata
  | TriangleMetadata
  | FrustumMetadata
  | CylindricalMetadata
  | SphericalMetadata
  | SphereMetadata
  | SphericalHarmonics3Metadata;

/**
 * Serialize a math type instance to its metadata representation
 * @throws Error if the instance is not a recognized math type
 */
export function serializeMathType(instance: MathTypeInstance): MathTypeMetadata {
  if (instance instanceof Vector2) return Vector2.serialize(instance);
  if (instance instanceof Vector3) return Vector3.serialize(instance);
  if (instance instanceof Vector4) return Vector4.serialize(instance);
  if (instance instanceof Color) return Color.serialize(instance);
  if (instance instanceof Quaternion) return Quaternion.serialize(instance);
  if (instance instanceof Euler) return Euler.serialize(instance);
  if (instance instanceof Matrix2) return Matrix2.serialize(instance);
  if (instance instanceof Matrix3) return Matrix3.serialize(instance);
  if (instance instanceof Matrix4) return Matrix4.serialize(instance);
  if (instance instanceof Box2) return Box2.serialize(instance);
  if (instance instanceof Box3) return Box3.serialize(instance);
  if (instance instanceof Plane) return Plane.serialize(instance);
  if (instance instanceof Ray) return Ray.serialize(instance);
  if (instance instanceof Line3) return Line3.serialize(instance);
  if (instance instanceof Triangle) return Triangle.serialize(instance);
  if (instance instanceof Frustum) return Frustum.serialize(instance);
  if (instance instanceof Cylindrical) return Cylindrical.serialize(instance);
  if (instance instanceof Spherical) return Spherical.serialize(instance);
  if (instance instanceof Sphere) return Sphere.serialize(instance);
  if (instance instanceof SphericalHarmonics3) return SphericalHarmonics3.serialize(instance);

  throw new Error(`Unknown math type instance: ${instance}`);
}

// ============================================================================
// Deserialization
// ============================================================================

/**
 * Deserialize math type metadata to its instance representation
 * @param type The SerializedPropertyType identifying the math type
 * @param metadata The metadata to deserialize
 * @throws Error if the type is not a recognized math type
 */
export function deserializeMathType(
  type: SerializedPropertyType,
  metadata: unknown,
): MathTypeInstance {
  switch (type) {
    case SerializedPropertyType.Vector2:
      return Vector2.deserialize(metadata as Vector2Metadata);
    case SerializedPropertyType.Vector3:
      return Vector3.deserialize(metadata as Vector3Metadata);
    case SerializedPropertyType.Vector4:
      return Vector4.deserialize(metadata as Vector4Metadata);
    case SerializedPropertyType.Color:
      return Color.deserialize(metadata as ColorMetadata);
    case SerializedPropertyType.Quaternion:
      return Quaternion.deserialize(metadata as QuaternionMetadata);
    case SerializedPropertyType.Euler:
      return Euler.deserialize(metadata as EulerMetadata);
    case SerializedPropertyType.Matrix2:
      return Matrix2.deserialize(metadata as Matrix2Metadata);
    case SerializedPropertyType.Matrix3:
      return Matrix3.deserialize(metadata as Matrix3Metadata);
    case SerializedPropertyType.Matrix4:
      return Matrix4.deserialize(metadata as Matrix4Metadata);
    case SerializedPropertyType.Box2:
      return Box2.deserialize(metadata as Box2Metadata);
    case SerializedPropertyType.Box3:
      return Box3.deserialize(metadata as Box3Metadata);
    case SerializedPropertyType.Plane:
      return Plane.deserialize(metadata as PlaneMetadata);
    case SerializedPropertyType.Ray:
      return Ray.deserialize(metadata as RayMetadata);
    case SerializedPropertyType.Line3:
      return Line3.deserialize(metadata as Line3Metadata);
    case SerializedPropertyType.Triangle:
      return Triangle.deserialize(metadata as TriangleMetadata);
    case SerializedPropertyType.Frustum:
      return Frustum.deserialize(metadata as FrustumMetadata);
    case SerializedPropertyType.Cylindrical:
      return Cylindrical.deserialize(metadata as CylindricalMetadata);
    case SerializedPropertyType.Spherical:
      return Spherical.deserialize(metadata as SphericalMetadata);
    case SerializedPropertyType.Sphere:
      return Sphere.deserialize(metadata as SphereMetadata);
    case SerializedPropertyType.SphericalHarmonics3:
      return SphericalHarmonics3.deserialize(metadata as SphericalHarmonics3Metadata);
    default:
      throw new Error(`Not a math type: ${type}`);
  }
}

// ============================================================================
// Type-Specific Deserializers (for typed accessors)
// ============================================================================

export function deserializeVector2(metadata: unknown): Vector2 {
  if (!Vector2.isMetadata(metadata)) {
    throw new Error('Invalid Vector2 metadata');
  }
  return Vector2.deserialize(metadata);
}

export function deserializeVector3(metadata: unknown): Vector3 {
  if (!Vector3.isMetadata(metadata)) {
    throw new Error('Invalid Vector3 metadata');
  }
  return Vector3.deserialize(metadata);
}

export function deserializeVector4(metadata: unknown): Vector4 {
  if (!Vector4.isMetadata(metadata)) {
    throw new Error('Invalid Vector4 metadata');
  }
  return Vector4.deserialize(metadata);
}

export function deserializeColor(metadata: unknown): Color {
  if (!Color.isMetadata(metadata)) {
    throw new Error('Invalid Color metadata');
  }
  return Color.deserialize(metadata);
}

export function deserializeQuaternion(metadata: unknown): Quaternion {
  if (!Quaternion.isMetadata(metadata)) {
    throw new Error('Invalid Quaternion metadata');
  }
  return Quaternion.deserialize(metadata);
}

export function deserializeEuler(metadata: unknown): Euler {
  if (!Euler.isMetadata(metadata)) {
    throw new Error('Invalid Euler metadata');
  }
  return Euler.deserialize(metadata);
}

export function deserializeMatrix2(metadata: unknown): Matrix2 {
  if (!Matrix2.isMetadata(metadata)) {
    throw new Error('Invalid Matrix2 metadata');
  }
  return Matrix2.deserialize(metadata);
}

export function deserializeMatrix3(metadata: unknown): Matrix3 {
  if (!Matrix3.isMetadata(metadata)) {
    throw new Error('Invalid Matrix3 metadata');
  }
  return Matrix3.deserialize(metadata);
}

export function deserializeMatrix4(metadata: unknown): Matrix4 {
  if (!Matrix4.isMetadata(metadata)) {
    throw new Error('Invalid Matrix4 metadata');
  }
  return Matrix4.deserialize(metadata);
}

export function deserializeBox2(metadata: unknown): Box2 {
  if (!Box2.isMetadata(metadata)) {
    throw new Error('Invalid Box2 metadata');
  }
  return Box2.deserialize(metadata);
}

export function deserializeBox3(metadata: unknown): Box3 {
  if (!Box3.isMetadata(metadata)) {
    throw new Error('Invalid Box3 metadata');
  }
  return Box3.deserialize(metadata);
}

export function deserializePlane(metadata: unknown): Plane {
  if (!Plane.isMetadata(metadata)) {
    throw new Error('Invalid Plane metadata');
  }
  return Plane.deserialize(metadata);
}

export function deserializeRay(metadata: unknown): Ray {
  if (!Ray.isMetadata(metadata)) {
    throw new Error('Invalid Ray metadata');
  }
  return Ray.deserialize(metadata);
}

export function deserializeLine3(metadata: unknown): Line3 {
  if (!Line3.isMetadata(metadata)) {
    throw new Error('Invalid Line3 metadata');
  }
  return Line3.deserialize(metadata);
}

export function deserializeTriangle(metadata: unknown): Triangle {
  if (!Triangle.isMetadata(metadata)) {
    throw new Error('Invalid Triangle metadata');
  }
  return Triangle.deserialize(metadata);
}

export function deserializeFrustum(metadata: unknown): Frustum {
  if (!Frustum.isMetadata(metadata)) {
    throw new Error('Invalid Frustum metadata');
  }
  return Frustum.deserialize(metadata);
}

export function deserializeCylindrical(metadata: unknown): Cylindrical {
  if (!Cylindrical.isMetadata(metadata)) {
    throw new Error('Invalid Cylindrical metadata');
  }
  return Cylindrical.deserialize(metadata);
}

export function deserializeSpherical(metadata: unknown): Spherical {
  if (!Spherical.isMetadata(metadata)) {
    throw new Error('Invalid Spherical metadata');
  }
  return Spherical.deserialize(metadata);
}

export function deserializeSphere(metadata: unknown): Sphere {
  if (!Sphere.isMetadata(metadata)) {
    throw new Error('Invalid Sphere metadata');
  }
  return Sphere.deserialize(metadata);
}

export function deserializeSphericalHarmonics3(metadata: unknown): SphericalHarmonics3 {
  if (!SphericalHarmonics3.isMetadata(metadata)) {
    throw new Error('Invalid SphericalHarmonics3 metadata');
  }
  return SphericalHarmonics3.deserialize(metadata);
}
