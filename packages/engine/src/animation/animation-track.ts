/**
 * Animation Track System
 *
 * Provides typed animation tracks for interpolating different property types
 * over time using keyframes.
 */

import { Easing, type EasingFunction } from './tween.js';
import { Vector3 } from '../math/vector3.js';

// ============================================================================
// Types
// ============================================================================

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
 * Sprite value for animation (references a sprite by ID within a texture)
 */
export interface SpriteValue {
  /** Sprite ID to display */
  spriteId: string;
}

/**
 * Supported property types for animation tracks
 */
export type PropertyType = 'number' | 'vector3' | 'color' | 'integer' | 'sprite';

/**
 * A keyframe representing a value at a specific time
 */
export interface Keyframe<T> {
  /** Time in seconds (normalized 0-1 within clip duration) */
  time: number;
  /** Value at this keyframe */
  value: T;
  /** Easing function to use when interpolating TO this keyframe (default: linear) */
  easing: EasingFunction;
}

/**
 * Base interface for animation tracks
 */
export interface AnimationTrack<T> {
  /** Property path (e.g., "position", "scale", "color") */
  readonly propertyPath: string;
  /** Type of property being animated */
  readonly propertyType: PropertyType;
  /** Ordered keyframes */
  readonly keyframes: ReadonlyArray<Keyframe<T>>;

  /**
   * Add a keyframe to the track
   * @param time - Time in seconds (normalized 0-1)
   * @param value - Value at this time
   * @param easing - Easing function to use (default: linear)
   */
  keyframe(time: number, value: T, easing?: EasingFunction): this;

  /**
   * Evaluate the track at a given normalized time
   * @param normalizedTime - Time from 0 to 1
   * @returns Interpolated value
   */
  evaluate(normalizedTime: number): T;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find the keyframes surrounding a given time
 */
function findKeyframePair<T>(
  keyframes: ReadonlyArray<Keyframe<T>>,
  time: number
): { from: Keyframe<T>; to: Keyframe<T>; localT: number } | null {
  if (keyframes.length === 0) return null;
  if (keyframes.length === 1) {
    // Safe: we've checked length === 1
    const keyframe = keyframes[0]!;
    return { from: keyframe, to: keyframe, localT: 0 };
  }

  // Clamp time to [0, 1]
  time = Math.max(0, Math.min(1, time));

  // Find surrounding keyframes
  let fromIndex = 0;
  for (let i = 0; i < keyframes.length; i++) {
    const kf = keyframes[i]!;
    if (kf.time <= time) {
      fromIndex = i;
    } else {
      break;
    }
  }

  const toIndex = Math.min(fromIndex + 1, keyframes.length - 1);
  // Safe: indices are within bounds
  const from = keyframes[fromIndex]!;
  const to = keyframes[toIndex]!;

  // Calculate local t between keyframes
  let localT = 0;
  if (from !== to) {
    const duration = to.time - from.time;
    if (duration > 0) {
      localT = (time - from.time) / duration;
    }
  }

  return { from, to, localT };
}

// ============================================================================
// NumberTrack
// ============================================================================

/**
 * Animation track for number properties
 */
export class NumberTrack implements AnimationTrack<number> {
  readonly propertyType = 'number' as const;
  private _keyframes: Keyframe<number>[] = [];

  constructor(readonly propertyPath: string) {}

  get keyframes(): ReadonlyArray<Keyframe<number>> {
    return this._keyframes;
  }

  keyframe(time: number, value: number, easing: EasingFunction = Easing.linear): this {
    this._keyframes.push({ time, value, easing });
    // Keep sorted by time
    this._keyframes.sort((a, b) => a.time - b.time);
    return this;
  }

  evaluate(normalizedTime: number): number {
    const pair = findKeyframePair(this._keyframes, normalizedTime);
    if (!pair) return 0;

    const { from, to, localT } = pair;
    if (from === to) return from.value;

    // Apply easing to local t
    const easedT = to.easing(localT);

    // Linear interpolation
    return from.value + (to.value - from.value) * easedT;
  }
}

// ============================================================================
// IntegerTrack
// ============================================================================

/**
 * Animation track for integer properties (discrete values, no interpolation)
 *
 * Use for sprite frame indices, state values, or any property that should
 * change in discrete steps rather than smoothly interpolating.
 *
 * @example
 * ```typescript
 * // Sprite animation: frames 0, 1, 2, 3 over 0.8 seconds
 * const track = new IntegerTrack('tileIndex')
 *   .keyframe(0.0, 0)
 *   .keyframe(0.2, 1)
 *   .keyframe(0.4, 2)
 *   .keyframe(0.6, 3)
 *   .keyframe(0.8, 0); // Loop back
 * ```
 */
export class IntegerTrack implements AnimationTrack<number> {
  readonly propertyType = 'integer' as const;
  private _keyframes: Keyframe<number>[] = [];

  constructor(readonly propertyPath: string) {}

  get keyframes(): ReadonlyArray<Keyframe<number>> {
    return this._keyframes;
  }

  keyframe(time: number, value: number, easing: EasingFunction = Easing.linear): this {
    // Round to ensure integer values
    this._keyframes.push({ time, value: Math.round(value), easing });
    // Keep sorted by time
    this._keyframes.sort((a, b) => a.time - b.time);
    return this;
  }

  evaluate(normalizedTime: number): number {
    const pair = findKeyframePair(this._keyframes, normalizedTime);
    if (!pair) return 0;

    const { from, to, localT } = pair;

    // KEY DIFFERENCE: No interpolation, use "from" value until exactly at "to" keyframe
    // This creates discrete steps rather than smooth transitions
    if (from === to || localT < 1.0) {
      return from.value;
    }

    return to.value;
  }
}

// ============================================================================
// SpriteTrack
// ============================================================================

/**
 * Animation track for sprite properties (discrete sprite ID values, no interpolation)
 *
 * Use for animating sprites by their ID. When evaluated, the sprite ID is used
 * to look up the sprite definition from the texture metadata and automatically
 * update tileIndex, tileSize, and tilesetSize properties.
 *
 * @example
 * ```typescript
 * // Character animation: idle -> walk1 -> walk2 -> jump
 * const track = new SpriteTrack('sprite')
 *   .keyframe(0.0, { spriteId: 'idle' })
 *   .keyframe(0.2, { spriteId: 'walk1' })
 *   .keyframe(0.4, { spriteId: 'walk2' })
 *   .keyframe(0.6, { spriteId: 'jump' });
 * ```
 */
export class SpriteTrack implements AnimationTrack<SpriteValue> {
  readonly propertyType = 'sprite' as const;
  private _keyframes: Keyframe<SpriteValue>[] = [];

  constructor(readonly propertyPath: string) {}

  get keyframes(): ReadonlyArray<Keyframe<SpriteValue>> {
    return this._keyframes;
  }

  keyframe(time: number, value: SpriteValue, easing: EasingFunction = Easing.linear): this {
    this._keyframes.push({ time, value, easing });
    // Keep sorted by time
    this._keyframes.sort((a, b) => a.time - b.time);
    return this;
  }

  evaluate(normalizedTime: number): SpriteValue {
    const pair = findKeyframePair(this._keyframes, normalizedTime);
    if (!pair) return { spriteId: '' };

    const { from, to, localT } = pair;

    // Like IntegerTrack: No interpolation, use "from" value until exactly at "to" keyframe
    // This creates discrete steps rather than smooth transitions
    if (from === to || localT < 1.0) {
      return from.value;
    }

    return to.value;
  }
}

// ============================================================================
// Vector3Track
// ============================================================================

/**
 * Animation track for Vector3 properties (position, rotation, scale)
 */
export class Vector3Track implements AnimationTrack<Vector3> {
  readonly propertyType = 'vector3' as const;
  private _keyframes: Keyframe<Vector3>[] = [];

  constructor(readonly propertyPath: string) {}

  get keyframes(): ReadonlyArray<Keyframe<Vector3>> {
    return this._keyframes;
  }

  keyframe(time: number, value: Vector3, easing: EasingFunction = Easing.linear): this {
    // Clone the vector to avoid mutation issues
    this._keyframes.push({ time, value: value.clone(), easing });
    // Keep sorted by time
    this._keyframes.sort((a, b) => a.time - b.time);
    return this;
  }

  evaluate(normalizedTime: number): Vector3 {
    const pair = findKeyframePair(this._keyframes, normalizedTime);
    if (!pair) return new Vector3();

    const { from, to, localT } = pair;
    if (from === to) return from.value.clone();

    // Apply easing to local t
    const easedT = to.easing(localT);

    // Linear interpolation for each component
    return new Vector3(
      from.value.x + (to.value.x - from.value.x) * easedT,
      from.value.y + (to.value.y - from.value.y) * easedT,
      from.value.z + (to.value.z - from.value.z) * easedT
    );
  }
}

// ============================================================================
// ColorTrack
// ============================================================================

/**
 * Animation track for Color properties (RGBA)
 */
export class ColorTrack implements AnimationTrack<Color> {
  readonly propertyType = 'color' as const;
  private _keyframes: Keyframe<Color>[] = [];

  constructor(readonly propertyPath: string) {}

  get keyframes(): ReadonlyArray<Keyframe<Color>> {
    return this._keyframes;
  }

  keyframe(time: number, value: Color, easing: EasingFunction = Easing.linear): this {
    // Clone the color to avoid mutation issues
    this._keyframes.push({
      time,
      value: { r: value.r, g: value.g, b: value.b, a: value.a },
      easing,
    });
    // Keep sorted by time
    this._keyframes.sort((a, b) => a.time - b.time);
    return this;
  }

  evaluate(normalizedTime: number): Color {
    const pair = findKeyframePair(this._keyframes, normalizedTime);
    if (!pair) return { r: 1, g: 1, b: 1, a: 1 };

    const { from, to, localT } = pair;
    if (from === to) return { ...from.value };

    // Apply easing to local t
    const easedT = to.easing(localT);

    // Linear interpolation for each component
    return {
      r: from.value.r + (to.value.r - from.value.r) * easedT,
      g: from.value.g + (to.value.g - from.value.g) * easedT,
      b: from.value.b + (to.value.b - from.value.b) * easedT,
      a: from.value.a + (to.value.a - from.value.a) * easedT,
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a Color from RGB values (0-255)
 */
export function colorFromRGB(r: number, g: number, b: number, a = 255): Color {
  return {
    r: r / 255,
    g: g / 255,
    b: b / 255,
    a: a / 255,
  };
}

/**
 * Create a Color from hex string
 */
export function colorFromHex(hex: string): Color {
  // Remove # if present
  hex = hex.replace('#', '');

  let r = 0,
    g = 0,
    b = 0,
    a = 1;

  if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16) / 255;
    g = parseInt(hex.substring(2, 4), 16) / 255;
    b = parseInt(hex.substring(4, 6), 16) / 255;
  } else if (hex.length === 8) {
    r = parseInt(hex.substring(0, 2), 16) / 255;
    g = parseInt(hex.substring(2, 4), 16) / 255;
    b = parseInt(hex.substring(4, 6), 16) / 255;
    a = parseInt(hex.substring(6, 8), 16) / 255;
  }

  return { r, g, b, a };
}

/**
 * Create a sprite frame animation track from a sequence of frame indices.
 *
 * @param frameDuration - Duration per frame in normalized time (0-1)
 * @param frames - Array of tile indices to animate through
 * @returns IntegerTrack configured for sprite animation
 *
 * @example
 * ```typescript
 * // 4 frames, each showing for 0.25 of the clip duration
 * const track = createSpriteFrameTrack(0.25, [0, 1, 2, 3]);
 *
 * const clip = AnimationClip.create('walk')
 *   .addTrack(track)
 *   .setDuration(0.8) // 0.8s total = 0.2s per frame
 *   .setLoopMode(LoopMode.Loop);
 * ```
 */
export function createSpriteFrameTrack(frameDuration: number, frames: number[]): IntegerTrack {
  const track = new IntegerTrack('tileIndex');

  let time = 0;
  for (const frame of frames) {
    track.keyframe(time, frame);
    time += frameDuration;
  }

  return track;
}

/**
 * Create an evenly-spaced sprite frame animation from a range.
 *
 * @param startFrame - First frame index (inclusive)
 * @param endFrame - Last frame index (inclusive)
 * @param duration - Total normalized duration (usually 1.0)
 * @returns IntegerTrack with evenly-spaced frames
 *
 * @example
 * ```typescript
 * // Frames 0 through 7, evenly spaced
 * const track = createSpriteFrameSequence(0, 7, 1.0);
 * ```
 */
export function createSpriteFrameSequence(
  startFrame: number,
  endFrame: number,
  duration: number = 1.0
): IntegerTrack {
  const frameCount = Math.abs(endFrame - startFrame) + 1;
  const frameDuration = duration / frameCount;
  const step = startFrame <= endFrame ? 1 : -1;

  const track = new IntegerTrack('tileIndex');
  let currentFrame = startFrame;
  let time = 0;

  for (let i = 0; i < frameCount; i++) {
    track.keyframe(time, currentFrame);
    currentFrame += step;
    time += frameDuration;
  }

  return track;
}
