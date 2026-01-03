/**
 * SerializedPropertyType - Enum representing the type of a serialized property
 *
 * Used by SerializedProperty to detect and validate property types,
 * enabling type-safe access through typed accessors.
 */

export enum SerializedPropertyType {
  // ============================================================================
  // Primitives
  // ============================================================================

  /** Integer number (whole numbers) */
  Integer = 'integer',

  /** Floating-point number */
  Float = 'float',

  /** Boolean value */
  Boolean = 'boolean',

  /** String value */
  String = 'string',

  // ============================================================================
  // Math Types (from packages/core/src/math/)
  // ============================================================================

  /** 2D vector {x, y} */
  Vector2 = 'vector2',

  /** 3D vector {x, y, z} */
  Vector3 = 'vector3',

  /** 4D vector {x, y, z, w} */
  Vector4 = 'vector4',

  /** RGB color {r, g, b} */
  Color = 'color',

  /** Quaternion rotation {x, y, z, w} */
  Quaternion = 'quaternion',

  /** Euler angles {x, y, z, order} */
  Euler = 'euler',

  /** 2x2 matrix {elements: number[4]} */
  Matrix2 = 'matrix2',

  /** 3x3 matrix {elements: number[9]} */
  Matrix3 = 'matrix3',

  /** 4x4 matrix {elements: number[16]} */
  Matrix4 = 'matrix4',

  /** 2D axis-aligned bounding box {min: Vector2, max: Vector2} */
  Box2 = 'box2',

  /** 3D axis-aligned bounding box {min: Vector3, max: Vector3} */
  Box3 = 'box3',

  /** Plane {normal: Vector3, constant: number} */
  Plane = 'plane',

  /** Ray {origin: Vector3, direction: Vector3} */
  Ray = 'ray',

  /** 3D line segment {start: Vector3, end: Vector3} */
  Line3 = 'line3',

  /** Triangle {a: Vector3, b: Vector3, c: Vector3} */
  Triangle = 'triangle',

  /** View frustum {planes: Plane[6]} */
  Frustum = 'frustum',

  /** Cylindrical coordinates {radius, theta, y} */
  Cylindrical = 'cylindrical',

  /** Spherical coordinates {radius, phi, theta} */
  Spherical = 'spherical',

  /** Bounding sphere {center: Vector3, radius: number} */
  Sphere = 'sphere',

  /** Spherical harmonics (9 Vector3 coefficients) */
  SphericalHarmonics3 = 'sphericalHarmonics3',

  // ============================================================================
  // Reference Types
  // ============================================================================

  /** Entity ID reference */
  Entity = 'entity',

  /** RuntimeAsset reference (lazy-loaded asset with GUID) */
  RuntimeAsset = 'runtimeAsset',

  // ============================================================================
  // Complex Types
  // ============================================================================

  /** Array of values */
  Array = 'array',

  /** Object (generic key-value pairs) */
  Object = 'object',

  // ============================================================================
  // Special Types
  // ============================================================================

  /** Null value */
  Null = 'null',

  /** Unknown or undetectable type */
  Unknown = 'unknown',
}

/**
 * Check if a property type is a primitive type
 */
export function isPrimitiveType(type: SerializedPropertyType): boolean {
  return (
    type === SerializedPropertyType.Integer ||
    type === SerializedPropertyType.Float ||
    type === SerializedPropertyType.Boolean ||
    type === SerializedPropertyType.String
  );
}

/**
 * Check if a property type is a math type from packages/core/src/math/
 */
export function isMathType(type: SerializedPropertyType): boolean {
  return (
    type === SerializedPropertyType.Vector2 ||
    type === SerializedPropertyType.Vector3 ||
    type === SerializedPropertyType.Vector4 ||
    type === SerializedPropertyType.Color ||
    type === SerializedPropertyType.Quaternion ||
    type === SerializedPropertyType.Euler ||
    type === SerializedPropertyType.Matrix2 ||
    type === SerializedPropertyType.Matrix3 ||
    type === SerializedPropertyType.Matrix4 ||
    type === SerializedPropertyType.Box2 ||
    type === SerializedPropertyType.Box3 ||
    type === SerializedPropertyType.Plane ||
    type === SerializedPropertyType.Ray ||
    type === SerializedPropertyType.Line3 ||
    type === SerializedPropertyType.Triangle ||
    type === SerializedPropertyType.Frustum ||
    type === SerializedPropertyType.Cylindrical ||
    type === SerializedPropertyType.Spherical ||
    type === SerializedPropertyType.Sphere ||
    type === SerializedPropertyType.SphericalHarmonics3
  );
}

/**
 * Check if a property type is a reference type (entity or asset)
 */
export function isReferenceType(type: SerializedPropertyType): boolean {
  return type === SerializedPropertyType.Entity || type === SerializedPropertyType.RuntimeAsset;
}

/**
 * Check if a property type can have children (is iterable)
 */
export function hasChildren(type: SerializedPropertyType): boolean {
  return (
    type === SerializedPropertyType.Array ||
    type === SerializedPropertyType.Object ||
    isMathType(type) // Math types have named children (x, y, z, etc.)
  );
}
