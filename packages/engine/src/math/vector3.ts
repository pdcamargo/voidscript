/**
 * Vector3 - 3D vector class for positions, rotations, and scales
 *
 * A simple vector class that provides serialization support.
 * For complex math operations, consider using Three.js Vector3 directly.
 */

export interface Vector3JSON {
  x: number;
  y: number;
  z: number;
}

export class Vector3 {
  x: number;
  y: number;
  z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  /**
   * Set the vector components
   */
  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  /**
   * Copy values from another vector
   */
  copy(v: Vector3): this {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  /**
   * Clone this vector
   */
  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  /**
   * Add another vector
   */
  add(v: Vector3): this {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  /**
   * Subtract another vector
   */
  sub(v: Vector3): this {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  /**
   * Multiply by scalar
   */
  multiplyScalar(s: number): this {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  /**
   * Divide by scalar
   */
  divideScalar(s: number): this {
    return this.multiplyScalar(1 / s);
  }

  /**
   * Get the length (magnitude) of the vector
   */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  /**
   * Get the squared length (faster than length())
   */
  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  /**
   * Normalize the vector (make it unit length)
   */
  normalize(): this {
    const len = this.length();
    if (len > 0) {
      this.divideScalar(len);
    }
    return this;
  }

  /**
   * Dot product with another vector
   */
  dot(v: Vector3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  /**
   * Cross product with another vector
   */
  cross(v: Vector3): this {
    const ax = this.x,
      ay = this.y,
      az = this.z;
    const bx = v.x,
      by = v.y,
      bz = v.z;
    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }

  /**
   * Linear interpolation to another vector
   */
  lerp(v: Vector3, t: number): this {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    this.z += (v.z - this.z) * t;
    return this;
  }

  /**
   * Check equality with another vector
   */
  equals(v: Vector3): boolean {
    return this.x === v.x && this.y === v.y && this.z === v.z;
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): Vector3JSON {
    return { x: this.x, y: this.y, z: this.z };
  }

  /**
   * Convert to array
   */
  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  /**
   * Create from plain object (deserialization)
   */
  static fromJSON(json: Vector3JSON): Vector3 {
    return new Vector3(json.x, json.y, json.z);
  }

  /**
   * Create from array
   */
  static fromArray(arr: [number, number, number] | number[]): Vector3 {
    return new Vector3(arr[0] ?? 0, arr[1] ?? 0, arr[2] ?? 0);
  }

  /**
   * Create zero vector
   */
  static zero(): Vector3 {
    return new Vector3(0, 0, 0);
  }

  /**
   * Create one vector (1, 1, 1)
   */
  static one(): Vector3 {
    return new Vector3(1, 1, 1);
  }

  /**
   * Create unit X vector
   */
  static unitX(): Vector3 {
    return new Vector3(1, 0, 0);
  }

  /**
   * Create unit Y vector
   */
  static unitY(): Vector3 {
    return new Vector3(0, 1, 0);
  }

  /**
   * Create unit Z vector
   */
  static unitZ(): Vector3 {
    return new Vector3(0, 0, 1);
  }
}
