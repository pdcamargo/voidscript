/**
 * SerializedProperty - Represents a single property path within a SerializedObject
 *
 * Provides type-safe access to property values through typed accessors,
 * supporting primitives, math types, arrays, and nested properties.
 */

import type { Entity } from '@voidscript/core';
import type { RuntimeAsset } from '@voidscript/engine';
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
} from '@voidscript/core';

import { SerializedPropertyType, isMathType } from './serialized-property-type.js';
import { detectMathType } from './type-handlers/math-types.js';
import type { SerializedObject } from './serialized-object.js';

// ============================================================================
// Types
// ============================================================================

export interface SerializedPropertyOptions {
  /** Parent SerializedObject */
  serializedObject: SerializedObject;
  /** Full property path from root (e.g., "position.x" or "entities[0].components") */
  path: string;
  /** Parent property (null for root-level properties) */
  parent: SerializedProperty | null;
  /** Property key/name within parent */
  name: string;
}

// ============================================================================
// SerializedProperty Class
// ============================================================================

/**
 * SerializedProperty - A handle to a single property within a SerializedObject
 *
 * @example
 * ```typescript
 * const prop = serializedObject.findProperty('entities[0].components[0].data.position');
 * const pos = prop.vector3Value; // Get as Vector3
 * prop.vector3Value = new Vector3(1, 2, 3); // Set (automatically marks dirty)
 *
 * // Nested access
 * const x = prop.findProperty('x').floatValue;
 * ```
 */
export class SerializedProperty {
  private readonly _serializedObject: SerializedObject;
  private readonly _path: string;
  private readonly _parent: SerializedProperty | null;
  private readonly _name: string;

  // Cached property metadata (lazily computed)
  private _type: SerializedPropertyType | null = null;

  constructor(options: SerializedPropertyOptions) {
    this._serializedObject = options.serializedObject;
    this._path = options.path;
    this._parent = options.parent;
    this._name = options.name;
  }

  // ============================================================================
  // Accessors - Identity
  // ============================================================================

  /** Full property path from root (e.g., "entities[0].components[2].data.position.x") */
  get propertyPath(): string {
    return this._path;
  }

  /** Property name (last segment of path, e.g., "x" from "position.x") */
  get name(): string {
    return this._name;
  }

  /** Parent property (null for root-level properties) */
  get parent(): SerializedProperty | null {
    return this._parent;
  }

  /** The owning SerializedObject */
  get serializedObject(): SerializedObject {
    return this._serializedObject;
  }

  // ============================================================================
  // Accessors - State
  // ============================================================================

  /** Detected property type (lazily computed and cached) */
  get propertyType(): SerializedPropertyType {
    if (this._type === null) {
      this._type = this.detectPropertyType();
    }
    return this._type;
  }

  /** Whether this property has been modified from applied state */
  get isDirty(): boolean {
    return this._serializedObject.isPropertyDirty(this._path);
  }

  // ============================================================================
  // Internal Value Access
  // ============================================================================

  /** Get the current value at this property path */
  private getCurrentValue(): unknown {
    return this._serializedObject.getValueAtPath(this._path);
  }

  /** Set the current value at this property path (marks dirty, records undo) */
  private setCurrentValue(value: unknown): void {
    this._serializedObject.setValueAtPath(this._path, value);
    // Clear cached type since value may have changed
    this._type = null;
  }

  // ============================================================================
  // Type Detection
  // ============================================================================

  private detectPropertyType(): SerializedPropertyType {
    const value = this.getCurrentValue();

    if (value === null) return SerializedPropertyType.Null;
    if (value === undefined) return SerializedPropertyType.Unknown;

    // Primitives
    if (typeof value === 'boolean') return SerializedPropertyType.Boolean;
    if (typeof value === 'string') return SerializedPropertyType.String;
    if (typeof value === 'number') {
      return Number.isInteger(value)
        ? SerializedPropertyType.Integer
        : SerializedPropertyType.Float;
    }

    // Arrays
    if (Array.isArray(value)) return SerializedPropertyType.Array;

    // Objects - check for special types
    if (typeof value === 'object') {
      // Check for math types first (most common in game engines)
      const mathType = detectMathType(value);
      if (mathType !== null) return mathType;

      // Check for RuntimeAsset (has guid and optionally metadata)
      const obj = value as Record<string, unknown>;
      if ('guid' in obj && typeof obj['guid'] === 'string') {
        return SerializedPropertyType.RuntimeAsset;
      }

      // Generic object
      return SerializedPropertyType.Object;
    }

    return SerializedPropertyType.Unknown;
  }

  // ============================================================================
  // Typed Accessors - Primitives (Read)
  // ============================================================================

  /** Get value as integer (rounds if float) */
  get intValue(): number {
    const val = this.getCurrentValue();
    if (typeof val !== 'number') {
      throw new Error(`Property ${this._path} is not a number, got ${typeof val}`);
    }
    return Math.round(val);
  }

  /** Get value as float */
  get floatValue(): number {
    const val = this.getCurrentValue();
    if (typeof val !== 'number') {
      throw new Error(`Property ${this._path} is not a number, got ${typeof val}`);
    }
    return val;
  }

  /** Get value as boolean */
  get boolValue(): boolean {
    const val = this.getCurrentValue();
    if (typeof val !== 'boolean') {
      throw new Error(`Property ${this._path} is not a boolean, got ${typeof val}`);
    }
    return val;
  }

  /** Get value as string */
  get stringValue(): string {
    const val = this.getCurrentValue();
    if (typeof val !== 'string') {
      throw new Error(`Property ${this._path} is not a string, got ${typeof val}`);
    }
    return val;
  }

  // ============================================================================
  // Typed Accessors - Primitives (Write)
  // ============================================================================

  /** Set value as integer */
  set intValue(value: number) {
    this.setCurrentValue(Math.round(value));
  }

  /** Set value as float */
  set floatValue(value: number) {
    this.setCurrentValue(value);
  }

  /** Set value as boolean */
  set boolValue(value: boolean) {
    this.setCurrentValue(value);
  }

  /** Set value as string */
  set stringValue(value: string) {
    this.setCurrentValue(value);
  }

  // ============================================================================
  // Typed Accessors - Math Types (Read)
  // ============================================================================

  /** Get value as Vector2 */
  get vector2Value(): Vector2 {
    const val = this.getCurrentValue();
    if (!Vector2.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a Vector2`);
    }
    return Vector2.deserialize(val);
  }

  /** Get value as Vector3 */
  get vector3Value(): Vector3 {
    const val = this.getCurrentValue();
    if (!Vector3.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a Vector3`);
    }
    return Vector3.deserialize(val);
  }

  /** Get value as Vector4 */
  get vector4Value(): Vector4 {
    const val = this.getCurrentValue();
    if (!Vector4.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a Vector4`);
    }
    return Vector4.deserialize(val);
  }

  /** Get value as Color */
  get colorValue(): Color {
    const val = this.getCurrentValue();
    if (!Color.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a Color`);
    }
    return Color.deserialize(val);
  }

  /** Get value as Quaternion */
  get quaternionValue(): Quaternion {
    const val = this.getCurrentValue();
    if (!Quaternion.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a Quaternion`);
    }
    return Quaternion.deserialize(val);
  }

  /** Get value as Euler */
  get eulerValue(): Euler {
    const val = this.getCurrentValue();
    if (!Euler.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not an Euler`);
    }
    return Euler.deserialize(val);
  }

  /** Get value as Matrix2 */
  get matrix2Value(): Matrix2 {
    const val = this.getCurrentValue();
    if (!Matrix2.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a Matrix2`);
    }
    return Matrix2.deserialize(val);
  }

  /** Get value as Matrix3 */
  get matrix3Value(): Matrix3 {
    const val = this.getCurrentValue();
    if (!Matrix3.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a Matrix3`);
    }
    return Matrix3.deserialize(val);
  }

  /** Get value as Matrix4 */
  get matrix4Value(): Matrix4 {
    const val = this.getCurrentValue();
    if (!Matrix4.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a Matrix4`);
    }
    return Matrix4.deserialize(val);
  }

  /** Get value as Box2 */
  get box2Value(): Box2 {
    const val = this.getCurrentValue();
    if (!Box2.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a Box2`);
    }
    return Box2.deserialize(val);
  }

  /** Get value as Box3 */
  get box3Value(): Box3 {
    const val = this.getCurrentValue();
    if (!Box3.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a Box3`);
    }
    return Box3.deserialize(val);
  }

  /** Get value as Plane */
  get planeValue(): Plane {
    const val = this.getCurrentValue();
    if (!Plane.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a Plane`);
    }
    return Plane.deserialize(val);
  }

  /** Get value as Ray */
  get rayValue(): Ray {
    const val = this.getCurrentValue();
    if (!Ray.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a Ray`);
    }
    return Ray.deserialize(val);
  }

  /** Get value as Line3 */
  get line3Value(): Line3 {
    const val = this.getCurrentValue();
    if (!Line3.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a Line3`);
    }
    return Line3.deserialize(val);
  }

  /** Get value as Triangle */
  get triangleValue(): Triangle {
    const val = this.getCurrentValue();
    if (!Triangle.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a Triangle`);
    }
    return Triangle.deserialize(val);
  }

  /** Get value as Frustum */
  get frustumValue(): Frustum {
    const val = this.getCurrentValue();
    if (!Frustum.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a Frustum`);
    }
    return Frustum.deserialize(val);
  }

  /** Get value as Cylindrical */
  get cylindricalValue(): Cylindrical {
    const val = this.getCurrentValue();
    if (!Cylindrical.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a Cylindrical`);
    }
    return Cylindrical.deserialize(val);
  }

  /** Get value as Spherical */
  get sphericalValue(): Spherical {
    const val = this.getCurrentValue();
    if (!Spherical.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a Spherical`);
    }
    return Spherical.deserialize(val);
  }

  /** Get value as Sphere */
  get sphereValue(): Sphere {
    const val = this.getCurrentValue();
    if (!Sphere.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a Sphere`);
    }
    return Sphere.deserialize(val);
  }

  /** Get value as SphericalHarmonics3 */
  get sphericalHarmonics3Value(): SphericalHarmonics3 {
    const val = this.getCurrentValue();
    if (!SphericalHarmonics3.isMetadata(val)) {
      throw new Error(`Property ${this._path} is not a SphericalHarmonics3`);
    }
    return SphericalHarmonics3.deserialize(val);
  }

  // ============================================================================
  // Typed Accessors - Math Types (Write)
  // ============================================================================

  /** Set value as Vector2 */
  set vector2Value(value: Vector2) {
    this.setCurrentValue(Vector2.serialize(value));
  }

  /** Set value as Vector3 */
  set vector3Value(value: Vector3) {
    this.setCurrentValue(Vector3.serialize(value));
  }

  /** Set value as Vector4 */
  set vector4Value(value: Vector4) {
    this.setCurrentValue(Vector4.serialize(value));
  }

  /** Set value as Color */
  set colorValue(value: Color) {
    this.setCurrentValue(Color.serialize(value));
  }

  /** Set value as Quaternion */
  set quaternionValue(value: Quaternion) {
    this.setCurrentValue(Quaternion.serialize(value));
  }

  /** Set value as Euler */
  set eulerValue(value: Euler) {
    this.setCurrentValue(Euler.serialize(value));
  }

  /** Set value as Matrix2 */
  set matrix2Value(value: Matrix2) {
    this.setCurrentValue(Matrix2.serialize(value));
  }

  /** Set value as Matrix3 */
  set matrix3Value(value: Matrix3) {
    this.setCurrentValue(Matrix3.serialize(value));
  }

  /** Set value as Matrix4 */
  set matrix4Value(value: Matrix4) {
    this.setCurrentValue(Matrix4.serialize(value));
  }

  /** Set value as Box2 */
  set box2Value(value: Box2) {
    this.setCurrentValue(Box2.serialize(value));
  }

  /** Set value as Box3 */
  set box3Value(value: Box3) {
    this.setCurrentValue(Box3.serialize(value));
  }

  /** Set value as Plane */
  set planeValue(value: Plane) {
    this.setCurrentValue(Plane.serialize(value));
  }

  /** Set value as Ray */
  set rayValue(value: Ray) {
    this.setCurrentValue(Ray.serialize(value));
  }

  /** Set value as Line3 */
  set line3Value(value: Line3) {
    this.setCurrentValue(Line3.serialize(value));
  }

  /** Set value as Triangle */
  set triangleValue(value: Triangle) {
    this.setCurrentValue(Triangle.serialize(value));
  }

  /** Set value as Frustum */
  set frustumValue(value: Frustum) {
    this.setCurrentValue(Frustum.serialize(value));
  }

  /** Set value as Cylindrical */
  set cylindricalValue(value: Cylindrical) {
    this.setCurrentValue(Cylindrical.serialize(value));
  }

  /** Set value as Spherical */
  set sphericalValue(value: Spherical) {
    this.setCurrentValue(Spherical.serialize(value));
  }

  /** Set value as Sphere */
  set sphereValue(value: Sphere) {
    this.setCurrentValue(Sphere.serialize(value));
  }

  /** Set value as SphericalHarmonics3 */
  set sphericalHarmonics3Value(value: SphericalHarmonics3) {
    this.setCurrentValue(SphericalHarmonics3.serialize(value));
  }

  // ============================================================================
  // Typed Accessors - Reference Types
  // ============================================================================

  /** Get value as Entity reference */
  get entityValue(): Entity {
    const val = this.getCurrentValue();
    if (typeof val !== 'number') {
      throw new Error(`Property ${this._path} is not an Entity reference`);
    }
    return val as Entity;
  }

  /** Set value as Entity reference */
  set entityValue(value: Entity) {
    this.setCurrentValue(value);
  }

  /**
   * Get the raw value (for RuntimeAsset or other complex types)
   * Returns the value as-is without deserialization
   */
  get rawValue(): unknown {
    return this.getCurrentValue();
  }

  /**
   * Set the raw value (for RuntimeAsset or other complex types)
   */
  set rawValue(value: unknown) {
    this.setCurrentValue(value);
  }

  // ============================================================================
  // Array Operations
  // ============================================================================

  /** Get array length (throws if not an array) */
  get arraySize(): number {
    const val = this.getCurrentValue();
    if (!Array.isArray(val)) {
      throw new Error(`Property ${this._path} is not an array`);
    }
    return val.length;
  }

  /** Set array length (extends with null or truncates) */
  set arraySize(size: number) {
    const val = this.getCurrentValue();
    if (!Array.isArray(val)) {
      throw new Error(`Property ${this._path} is not an array`);
    }
    const newArray = [...val];
    if (size > newArray.length) {
      // Extend with nulls
      while (newArray.length < size) {
        newArray.push(null);
      }
    } else {
      // Truncate
      newArray.length = size;
    }
    this.setCurrentValue(newArray);
  }

  /**
   * Get a property handle for an array element
   * @param index Zero-based array index
   */
  getArrayElementAtIndex(index: number): SerializedProperty {
    if (this.propertyType !== SerializedPropertyType.Array) {
      throw new Error(`Property ${this._path} is not an array`);
    }
    const elementPath = `${this._path}[${index}]`;
    return this._serializedObject.findProperty(elementPath);
  }

  /**
   * Insert a new element at the specified index
   * @param index Zero-based index where to insert
   */
  insertArrayElementAtIndex(index: number): void {
    const val = this.getCurrentValue();
    if (!Array.isArray(val)) {
      throw new Error(`Property ${this._path} is not an array`);
    }
    const newArray = [...val];
    newArray.splice(index, 0, null);
    this.setCurrentValue(newArray);
  }

  /**
   * Delete an element at the specified index
   * @param index Zero-based index to delete
   */
  deleteArrayElementAtIndex(index: number): void {
    const val = this.getCurrentValue();
    if (!Array.isArray(val)) {
      throw new Error(`Property ${this._path} is not an array`);
    }
    const newArray = [...val];
    newArray.splice(index, 1);
    this.setCurrentValue(newArray);
  }

  // ============================================================================
  // Child Navigation
  // ============================================================================

  /** Whether this property has child properties (objects, arrays, math types) */
  get hasChildren(): boolean {
    const type = this.propertyType;
    return (
      type === SerializedPropertyType.Array ||
      type === SerializedPropertyType.Object ||
      isMathType(type)
    );
  }

  /**
   * Iterate over child properties
   * - For arrays: yields each element
   * - For objects: yields each key-value pair
   * - For math types: yields each component (x, y, z, etc.)
   */
  *children(): IterableIterator<SerializedProperty> {
    const val = this.getCurrentValue();

    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        yield this.getArrayElementAtIndex(i);
      }
    } else if (typeof val === 'object' && val !== null) {
      for (const key of Object.keys(val)) {
        yield this.findProperty(key);
      }
    }
  }

  /**
   * Find a child property by relative path
   * @param relativePath Path relative to this property (e.g., "x" or "components[0]")
   */
  findProperty(relativePath: string): SerializedProperty {
    const fullPath = this._path ? `${this._path}.${relativePath}` : relativePath;
    return this._serializedObject.findProperty(fullPath);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if the value equals another value (deep comparison)
   */
  equals(other: unknown): boolean {
    return this._serializedObject.deepEqual(this.getCurrentValue(), other);
  }

  /**
   * Get a string representation for debugging
   */
  toString(): string {
    return `SerializedProperty(${this._path}: ${this.propertyType})`;
  }
}
