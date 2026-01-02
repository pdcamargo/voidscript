// Basic vector types
export { Vector2, type Vector2Metadata } from './Vector2.js';
export { Vector3, type Vector3Metadata } from './Vector3.js';
export { Vector4, type Vector4Metadata } from './Vector4.js';

// Matrix types
export { Matrix2, type Matrix2Metadata } from './Matrix2.js';
export { Matrix3, type Matrix3Metadata } from './Matrix3.js';
export { Matrix4, type Matrix4Metadata } from './Matrix4.js';

// Rotation types
export { Euler, type EulerMetadata, type EulerOrder } from './Euler.js';
export { Quaternion, type QuaternionMetadata } from './Quaternion.js';

// Color
export { Color, type ColorMetadata } from './Color.js';

// Bounding volumes
export { Box2, type Box2Metadata } from './Box2.js';
export { Box3, type Box3Metadata } from './Box3.js';
export { Sphere, type SphereMetadata } from './Sphere.js';

// Geometric primitives
export { Plane, type PlaneMetadata } from './Plane.js';
export { Ray, type RayMetadata } from './Ray.js';
export { Line3, type Line3Metadata } from './Line3.js';
export { Triangle, type TriangleMetadata } from './Triangle.js';
export { Frustum, type FrustumMetadata } from './Frustum.js';

// Coordinate systems
export { Cylindrical, type CylindricalMetadata } from './Cylindrical.js';
export { Spherical, type SphericalMetadata } from './Spherical.js';
export {
  SphericalHarmonics3,
  type SphericalHarmonics3Metadata,
} from './SphericalHarmonics3.js';

// Re-export MathUtils directly from THREE (static utility, no serialization needed)
export { MathUtils } from 'three';
