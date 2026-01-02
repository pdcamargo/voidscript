/**
 * Interpolation System
 *
 * Provides interpolation mode detection and value interpolation
 * based on PropertySerializerConfig metadata.
 */

import type { PropertySerializerConfig } from '@voidscript/core';
import { Vector3 } from '../math/vector3.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Interpolation mode for animation tracks
 */
export enum InterpolationMode {
  /** Smooth interpolation (linear, eased) - for numbers, vectors, colors */
  Smooth = 'smooth',
  /** Discrete stepping (no interpolation) - for integers, enums, booleans, assets */
  Discrete = 'discrete',
}

/**
 * RGBA Color for animation
 */
export interface Color {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
  a: number; // 0-1
}

/**
 * Sprite value for animation (references a sprite by ID)
 */
export interface SpriteValue {
  /** Sprite ID to display */
  spriteId: string;
  /** Optional texture GUID */
  textureGuid?: string;
}

// ============================================================================
// Interpolation Mode Detection
// ============================================================================

/**
 * Determine the interpolation mode for a property based on its serializer config.
 *
 * Rules:
 * - Numbers without integer constraint → Smooth
 * - Vector3 → Smooth (component-wise)
 * - Color objects ({r,g,b,a}) → Smooth (RGBA)
 * - `type === 'enum'` → Discrete
 * - `type === 'runtimeAsset'` → Discrete
 * - Boolean → Discrete
 * - Integer constraint → Discrete
 * - Unknown/default → Discrete (safe default)
 *
 * @param config - Property serializer configuration
 * @returns Interpolation mode to use for this property
 */
export function getInterpolationMode(config: PropertySerializerConfig | null): InterpolationMode {
  if (!config) {
    return InterpolationMode.Discrete;
  }

  // Check for explicit discrete types first
  if (config.type === 'enum' || config.type === 'runtimeAsset' || config.type === 'entity') {
    return InterpolationMode.Discrete;
  }

  // Check instance type
  if (config.instanceType) {
    // Boolean is always discrete
    if (config.instanceType === Boolean) {
      return InterpolationMode.Discrete;
    }

    // Number is smooth (unless we add integer constraint support)
    if (config.instanceType === Number) {
      return InterpolationMode.Smooth;
    }

    // Vector3 is smooth (component-wise interpolation)
    if (config.instanceType === Vector3) {
      return InterpolationMode.Smooth;
    }
  }

  // Default to discrete for safety
  return InterpolationMode.Discrete;
}

/**
 * Determine interpolation mode from a value's runtime type.
 * Used when PropertySerializerConfig is not available.
 *
 * @param value - Value to analyze
 * @returns Inferred interpolation mode
 */
export function inferInterpolationMode(value: unknown): InterpolationMode {
  if (value === null || value === undefined) {
    return InterpolationMode.Discrete;
  }

  // Numbers are smooth
  if (typeof value === 'number') {
    return InterpolationMode.Smooth;
  }

  // Booleans are discrete
  if (typeof value === 'boolean') {
    return InterpolationMode.Discrete;
  }

  // Strings are discrete
  if (typeof value === 'string') {
    return InterpolationMode.Discrete;
  }

  // Objects need deeper inspection
  if (typeof value === 'object') {
    // Vector3 check (has x, y, z but not r)
    if (isVector3Like(value)) {
      return InterpolationMode.Smooth;
    }

    // Color check (has r, g, b, a)
    if (isColorLike(value)) {
      return InterpolationMode.Smooth;
    }

    // SpriteValue check (has spriteId)
    if (isSpriteValueLike(value)) {
      return InterpolationMode.Discrete;
    }
  }

  // Default to discrete
  return InterpolationMode.Discrete;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value looks like a Vector3 (has x, y, z properties)
 */
export function isVector3Like(value: unknown): value is { x: number; y: number; z: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    'y' in value &&
    'z' in value &&
    typeof (value as any).x === 'number' &&
    typeof (value as any).y === 'number' &&
    typeof (value as any).z === 'number' &&
    !('r' in value) // Distinguish from Color
  );
}

/**
 * Check if a value looks like a Color (has r, g, b, a properties)
 */
export function isColorLike(value: unknown): value is Color {
  return (
    typeof value === 'object' &&
    value !== null &&
    'r' in value &&
    'g' in value &&
    'b' in value &&
    'a' in value &&
    typeof (value as any).r === 'number' &&
    typeof (value as any).g === 'number' &&
    typeof (value as any).b === 'number' &&
    typeof (value as any).a === 'number'
  );
}

/**
 * Check if a value looks like a SpriteValue
 */
export function isSpriteValueLike(value: unknown): value is SpriteValue {
  return typeof value === 'object' && value !== null && 'spriteId' in value && typeof (value as any).spriteId === 'string';
}

// ============================================================================
// Value Interpolation
// ============================================================================

/**
 * Interpolate between two values based on interpolation mode.
 *
 * @param from - Start value
 * @param to - End value
 * @param t - Interpolation factor (0-1, already eased)
 * @param mode - Interpolation mode to use
 * @returns Interpolated value
 */
export function interpolateValue<T>(from: T, to: T, t: number, mode: InterpolationMode): T {
  // Discrete mode: snap at end
  if (mode === InterpolationMode.Discrete) {
    return t < 1.0 ? from : to;
  }

  // Smooth mode: interpolate based on type
  return interpolateSmooth(from, to, t);
}

/**
 * Perform smooth interpolation between two values.
 * Handles numbers, Vector3, and Color types.
 */
function interpolateSmooth<T>(from: T, to: T, t: number): T {
  // Number interpolation
  if (typeof from === 'number' && typeof to === 'number') {
    return (from + (to - from) * t) as T;
  }

  // Vector3 interpolation
  if (isVector3Like(from) && isVector3Like(to)) {
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      z: from.z + (to.z - from.z) * t,
    } as T;
  }

  // Color interpolation
  if (isColorLike(from) && isColorLike(to)) {
    return {
      r: from.r + (to.r - from.r) * t,
      g: from.g + (to.g - from.g) * t,
      b: from.b + (to.b - from.b) * t,
      a: from.a + (to.a - from.a) * t,
    } as T;
  }

  // Fallback: snap (shouldn't happen with correct mode detection)
  return t < 0.5 ? from : to;
}

/**
 * Interpolate a single number value
 */
export function lerpNumber(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Interpolate Vector3-like objects
 */
export function lerpVector3(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  t: number,
): { x: number; y: number; z: number } {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z: from.z + (to.z - from.z) * t,
  };
}

/**
 * Interpolate Color objects
 */
export function lerpColor(from: Color, to: Color, t: number): Color {
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
    a: from.a + (to.a - from.a) * t,
  };
}

// ============================================================================
// Value Cloning
// ============================================================================

/**
 * Clone a value for safe storage in keyframes.
 * Handles primitives, Vector3, Color, and SpriteValue.
 */
export function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'object') {
    return value; // Primitives are already copies
  }

  // Vector3 clone
  if (isVector3Like(value)) {
    return { x: value.x, y: value.y, z: value.z } as T;
  }

  // Color clone
  if (isColorLike(value)) {
    return { r: value.r, g: value.g, b: value.b, a: value.a } as T;
  }

  // SpriteValue clone
  if (isSpriteValueLike(value)) {
    const result: SpriteValue = { spriteId: value.spriteId };
    if (value.textureGuid) {
      result.textureGuid = value.textureGuid;
    }
    return result as T;
  }

  // Fallback: shallow clone
  return { ...value };
}

// ============================================================================
// Display Utilities
// ============================================================================

/**
 * Get a human-readable display name for an interpolation mode
 */
export function getInterpolationModeDisplayName(mode: InterpolationMode): string {
  switch (mode) {
    case InterpolationMode.Smooth:
      return 'Smooth';
    case InterpolationMode.Discrete:
      return 'Discrete';
    default:
      return 'Unknown';
  }
}

/**
 * Get a human-readable type name for a value
 */
export function getValueTypeName(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') return 'string';

  if (typeof value === 'object') {
    if (isVector3Like(value)) return 'Vector3';
    if (isColorLike(value)) return 'Color';
    if (isSpriteValueLike(value)) return 'Sprite';
  }

  return 'object';
}
