/**
 * Property Track System
 *
 * Provides a unified animation track that can animate any component property
 * based on the property path format: `ComponentName.property.nested`
 */

import { Easing, type EasingFunction } from './tween.js';
import {
  InterpolationMode,
  interpolateValue,
  inferInterpolationMode,
  cloneValue,
} from './interpolation.js';
import { parsePropertyPath, type ResolvedPropertyPath } from './property-path.js';

// ============================================================================
// Types
// ============================================================================

/**
 * A keyframe representing a value at a specific time
 */
export interface PropertyKeyframe<T = unknown> {
  /** Time in normalized units (0-1 within clip duration) */
  time: number;
  /** Value at this keyframe */
  value: T;
  /** Easing function to use when interpolating TO this keyframe (default: linear) */
  easing: EasingFunction;
}

/**
 * Serializable keyframe format (for JSON)
 */
export interface SerializedKeyframe {
  time: number;
  value: unknown;
  easing?: string;
}

/**
 * Base interface for animation tracks (preserved for compatibility)
 */
export interface AnimationTrack<T = unknown> {
  /** Full property path (e.g., "Transform3D.position.x") */
  readonly fullPropertyPath: string;
  /** Ordered keyframes */
  readonly keyframes: ReadonlyArray<PropertyKeyframe<T>>;

  /**
   * Add a keyframe to the track
   * @param time - Time in normalized units (0-1)
   * @param value - Value at this time
   * @param easing - Easing function (default: linear)
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
  keyframes: ReadonlyArray<PropertyKeyframe<T>>,
  time: number,
): { from: PropertyKeyframe<T>; to: PropertyKeyframe<T>; localT: number } | null {
  if (keyframes.length === 0) return null;
  if (keyframes.length === 1) {
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
// PropertyTrack
// ============================================================================

/**
 * Unified animation track for any component property.
 *
 * Uses the property path format `ComponentName.property.nested` to identify
 * which component and property to animate.
 *
 * Interpolation mode is inferred from the value type or can be explicitly set.
 *
 * @example
 * ```typescript
 * // Create a track for Transform3D position.x
 * const track = new PropertyTrack('Transform3D.position.x')
 *   .keyframe(0, 0)
 *   .keyframe(0.5, 100, Easing.easeInOutQuad)
 *   .keyframe(1, 200);
 *
 * // Create a track for Sprite2D color
 * const colorTrack = new PropertyTrack('Sprite2D.color')
 *   .keyframe(0, { r: 1, g: 0, b: 0, a: 1 })
 *   .keyframe(1, { r: 0, g: 0, b: 1, a: 1 });
 *
 * // Create a track for sprite animation (discrete)
 * const spriteTrack = new PropertyTrack('Sprite2D.sprite')
 *   .keyframe(0, { spriteId: 'idle' })
 *   .keyframe(0.25, { spriteId: 'walk1' })
 *   .keyframe(0.5, { spriteId: 'walk2' });
 * ```
 */
export class PropertyTrack<T = unknown> implements AnimationTrack<T> {
  /** Full property path including component name */
  readonly fullPropertyPath: string;

  /** Parsed property path information */
  private readonly _parsed: ResolvedPropertyPath;

  /** Interpolation mode (inferred or explicit) */
  private _interpolationMode: InterpolationMode | null = null;

  /** Internal keyframe storage */
  private _keyframes: PropertyKeyframe<T>[] = [];

  /**
   * Create a new property track
   *
   * @param fullPropertyPath - Full property path (e.g., "Transform3D.position.x")
   * @param interpolationMode - Optional explicit interpolation mode
   */
  constructor(fullPropertyPath: string, interpolationMode?: InterpolationMode) {
    this.fullPropertyPath = fullPropertyPath;
    this._parsed = parsePropertyPath(fullPropertyPath);
    this._interpolationMode = interpolationMode ?? null;
  }

  // ============================================================================
  // Accessors
  // ============================================================================

  /**
   * Get the component name from the property path
   */
  get componentName(): string {
    return this._parsed.componentName;
  }

  /**
   * Get the property path within the component
   */
  get propertyPath(): string {
    return this._parsed.propertyPath;
  }

  /**
   * Get all keyframes (read-only)
   */
  get keyframes(): ReadonlyArray<PropertyKeyframe<T>> {
    return this._keyframes;
  }

  /**
   * Get the interpolation mode for this track.
   * If not explicitly set, infers from the first keyframe value.
   */
  get interpolationMode(): InterpolationMode {
    if (this._interpolationMode !== null) {
      return this._interpolationMode;
    }

    // Infer from first keyframe
    if (this._keyframes.length > 0) {
      return inferInterpolationMode(this._keyframes[0]!.value);
    }

    // Default to discrete
    return InterpolationMode.Discrete;
  }

  /**
   * Explicitly set the interpolation mode
   */
  setInterpolationMode(mode: InterpolationMode): this {
    this._interpolationMode = mode;
    return this;
  }

  // ============================================================================
  // Keyframe Methods
  // ============================================================================

  /**
   * Add a keyframe to the track
   *
   * @param time - Time in normalized units (0-1)
   * @param value - Value at this time (will be cloned)
   * @param easing - Easing function to use when interpolating TO this keyframe
   */
  keyframe(time: number, value: T, easing: EasingFunction = Easing.linear): this {
    this._keyframes.push({
      time,
      value: cloneValue(value),
      easing,
    });
    // Keep sorted by time
    this._keyframes.sort((a, b) => a.time - b.time);
    return this;
  }

  /**
   * Remove a keyframe by index
   */
  removeKeyframe(index: number): this {
    if (index >= 0 && index < this._keyframes.length) {
      this._keyframes.splice(index, 1);
    }
    return this;
  }

  /**
   * Remove a keyframe at a specific time (with tolerance)
   */
  removeKeyframeAtTime(time: number, tolerance: number = 0.001): this {
    const index = this._keyframes.findIndex((kf) => Math.abs(kf.time - time) < tolerance);
    if (index !== -1) {
      this._keyframes.splice(index, 1);
    }
    return this;
  }

  /**
   * Update a keyframe's value
   */
  updateKeyframeValue(index: number, value: T): this {
    if (index >= 0 && index < this._keyframes.length) {
      this._keyframes[index]!.value = cloneValue(value);
    }
    return this;
  }

  /**
   * Update a keyframe's time
   */
  updateKeyframeTime(index: number, time: number): this {
    if (index >= 0 && index < this._keyframes.length) {
      this._keyframes[index]!.time = time;
      // Re-sort after time change
      this._keyframes.sort((a, b) => a.time - b.time);
    }
    return this;
  }

  /**
   * Update a keyframe's easing function
   */
  updateKeyframeEasing(index: number, easing: EasingFunction): this {
    if (index >= 0 && index < this._keyframes.length) {
      this._keyframes[index]!.easing = easing;
    }
    return this;
  }

  /**
   * Clear all keyframes
   */
  clearKeyframes(): this {
    this._keyframes = [];
    return this;
  }

  // ============================================================================
  // Evaluation
  // ============================================================================

  /**
   * Evaluate the track at a given normalized time
   *
   * @param normalizedTime - Time from 0 to 1
   * @returns Interpolated value
   */
  evaluate(normalizedTime: number): T {
    const pair = findKeyframePair(this._keyframes, normalizedTime);
    if (!pair) {
      // No keyframes - return a sensible default
      return undefined as T;
    }

    const { from, to, localT } = pair;

    // Same keyframe or no interpolation needed
    if (from === to) {
      return cloneValue(from.value);
    }

    // Apply easing to local t
    const easedT = to.easing(localT);

    // Interpolate based on mode
    return interpolateValue(from.value, to.value, easedT, this.interpolationMode);
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  /**
   * Serialize the track to a plain object for JSON
   */
  toJSON(): {
    propertyPath: string;
    interpolationMode?: string;
    keyframes: SerializedKeyframe[];
  } {
    const result: {
      propertyPath: string;
      interpolationMode?: string;
      keyframes: SerializedKeyframe[];
    } = {
      propertyPath: this.fullPropertyPath,
      keyframes: this._keyframes.map((kf) => {
        const serialized: SerializedKeyframe = {
          time: kf.time,
          value: kf.value,
        };

        // Only include easing if not linear
        if (kf.easing !== Easing.linear) {
          serialized.easing = getEasingName(kf.easing);
        }

        return serialized;
      }),
    };

    // Only include interpolation mode if explicitly set
    if (this._interpolationMode !== null) {
      result.interpolationMode = this._interpolationMode;
    }

    return result;
  }

  /**
   * Create a PropertyTrack from serialized data
   */
  static fromJSON<T = unknown>(
    data: {
      propertyPath: string;
      interpolationMode?: string;
      keyframes: SerializedKeyframe[];
    },
  ): PropertyTrack<T> {
    const mode = data.interpolationMode
      ? (data.interpolationMode as InterpolationMode)
      : undefined;

    const track = new PropertyTrack<T>(data.propertyPath, mode);

    for (const kf of data.keyframes) {
      const easing = kf.easing ? getEasingFunction(kf.easing) : Easing.linear;
      track.keyframe(kf.time, kf.value as T, easing);
    }

    return track;
  }

  /**
   * Clone this track
   */
  clone(): PropertyTrack<T> {
    const cloned = new PropertyTrack<T>(
      this.fullPropertyPath,
      this._interpolationMode ?? undefined,
    );

    for (const kf of this._keyframes) {
      cloned.keyframe(kf.time, kf.value, kf.easing);
    }

    return cloned;
  }
}

// ============================================================================
// Easing Name Utilities
// ============================================================================

/**
 * Map of easing function names to functions
 */
const easingByName: Record<string, EasingFunction> = {
  linear: Easing.linear,
  easeInQuad: Easing.easeInQuad,
  easeOutQuad: Easing.easeOutQuad,
  easeInOutQuad: Easing.easeInOutQuad,
  easeInCubic: Easing.easeInCubic,
  easeOutCubic: Easing.easeOutCubic,
  easeInOutCubic: Easing.easeInOutCubic,
  easeInQuart: Easing.easeInQuart,
  easeOutQuart: Easing.easeOutQuart,
  easeInOutQuart: Easing.easeInOutQuart,
  easeInQuint: Easing.easeInQuint,
  easeOutQuint: Easing.easeOutQuint,
  easeInOutQuint: Easing.easeInOutQuint,
  easeInSine: Easing.easeInSine,
  easeOutSine: Easing.easeOutSine,
  easeInOutSine: Easing.easeInOutSine,
  easeInExpo: Easing.easeInExpo,
  easeOutExpo: Easing.easeOutExpo,
  easeInOutExpo: Easing.easeInOutExpo,
  easeInCirc: Easing.easeInCirc,
  easeOutCirc: Easing.easeOutCirc,
  easeInOutCirc: Easing.easeInOutCirc,
  easeInBack: Easing.easeInBack,
  easeOutBack: Easing.easeOutBack,
  easeInOutBack: Easing.easeInOutBack,
  easeInElastic: Easing.easeInElastic,
  easeOutElastic: Easing.easeOutElastic,
  easeInOutElastic: Easing.easeInOutElastic,
  easeInBounce: Easing.easeInBounce,
  easeOutBounce: Easing.easeOutBounce,
  easeInOutBounce: Easing.easeInOutBounce,
};

/**
 * Map of easing functions to their names
 */
const nameByEasing = new Map<EasingFunction, string>();
for (const [name, fn] of Object.entries(easingByName)) {
  nameByEasing.set(fn, name);
}

/**
 * Get an easing function by name
 */
export function getEasingFunction(name: string): EasingFunction {
  return easingByName[name] ?? Easing.linear;
}

/**
 * Get the name of an easing function
 */
export function getEasingName(fn: EasingFunction): string {
  return nameByEasing.get(fn) ?? 'linear';
}

/**
 * Get all available easing function names
 */
export function getAvailableEasingNames(): string[] {
  return Object.keys(easingByName);
}
