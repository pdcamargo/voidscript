/**
 * Shared types for the VoidScript Editor
 */

/**
 * 2D vector with x and y components
 */
export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Size with width and height
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * RGBA color with values from 0 to 1
 */
export interface Color {
  r: number;
  g: number;
  b: number;
  /** Alpha value (0-1), defaults to 1 if omitted */
  a?: number;
}
