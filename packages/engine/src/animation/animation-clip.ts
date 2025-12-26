/**
 * Animation Clip System
 *
 * Defines reusable animation clips that contain multiple tracks
 * and can be played by AnimationController.
 */

import { PropertyTrack, type AnimationTrack, type SerializedKeyframe } from './property-track.js';
import type { Color, SpriteValue } from './interpolation.js';
import type { Vector3 } from '../math/vector3.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Loop mode for animation clips
 */
export enum LoopMode {
  /** Play once and stop */
  Once = 'once',
  /** Loop indefinitely */
  Loop = 'loop',
  /** Alternate forward/backward */
  PingPong = 'pingPong',
}

/**
 * Union type for all possible track value types
 */
export type TrackValue = number | Vector3 | Color | SpriteValue | unknown;

/**
 * Grouped evaluation result - values organized by component name
 */
export type GroupedTrackValues = Map<string, Map<string, TrackValue>>;

// ============================================================================
// AnimationClip
// ============================================================================

/**
 * An animation clip containing multiple property tracks.
 *
 * Use the builder pattern to create clips:
 * ```typescript
 * const clip = AnimationClip.create('walk')
 *   .setDuration(1.0)
 *   .setLoopMode(LoopMode.Loop);
 *
 * // Add tracks using PropertyTrack with full property paths
 * clip.addTrack(
 *   new PropertyTrack('Transform3D.position')
 *     .keyframe(0, { x: 0, y: 0, z: 0 })
 *     .keyframe(1, { x: 10, y: 0, z: 0 })
 * );
 *
 * // Or create tracks directly on the clip
 * clip.createTrack('Sprite2D.color')
 *   .keyframe(0, { r: 1, g: 0, b: 0, a: 1 })
 *   .keyframe(1, { r: 0, g: 0, b: 1, a: 1 });
 * ```
 */
export class AnimationClip {
  /** Unique identifier for this clip */
  readonly id: string;

  private _tracks: PropertyTrack<TrackValue>[] = [];
  private _duration: number = 1.0;
  private _loopMode: LoopMode = LoopMode.Once;
  private _speed: number = 1.0;

  private constructor(id: string) {
    this.id = id;
  }

  // ============================================================================
  // Static Factory
  // ============================================================================

  /**
   * Create a new animation clip with the given ID
   */
  static create(id: string): AnimationClip {
    return new AnimationClip(id);
  }

  // ============================================================================
  // Builder Methods
  // ============================================================================

  /**
   * Add a track to the clip
   */
  addTrack<T extends TrackValue>(track: PropertyTrack<T>): this {
    this._tracks.push(track as PropertyTrack<TrackValue>);
    return this;
  }

  /**
   * Create and add a track for a property path
   *
   * @param fullPropertyPath - Full property path (e.g., "Transform3D.position.x")
   * @returns The created track for chaining keyframe additions
   */
  createTrack<T = unknown>(fullPropertyPath: string): PropertyTrack<T> {
    const track = new PropertyTrack<T>(fullPropertyPath);
    this._tracks.push(track as PropertyTrack<TrackValue>);
    return track;
  }

  /**
   * Remove a track by its property path
   */
  removeTrack(fullPropertyPath: string): this {
    const index = this._tracks.findIndex((t) => t.fullPropertyPath === fullPropertyPath);
    if (index !== -1) {
      this._tracks.splice(index, 1);
    }
    return this;
  }

  /**
   * Set the duration of the clip in seconds
   */
  setDuration(seconds: number): this {
    this._duration = Math.max(0.001, seconds);
    return this;
  }

  /**
   * Set the loop mode
   */
  setLoopMode(mode: LoopMode): this {
    this._loopMode = mode;
    return this;
  }

  /**
   * Set the default playback speed multiplier
   */
  setSpeed(speed: number): this {
    this._speed = speed;
    return this;
  }

  // ============================================================================
  // Accessors
  // ============================================================================

  /**
   * Get the duration in seconds
   */
  get duration(): number {
    return this._duration;
  }

  /**
   * Get the loop mode
   */
  get loopMode(): LoopMode {
    return this._loopMode;
  }

  /**
   * Get the default playback speed
   */
  get speed(): number {
    return this._speed;
  }

  /**
   * Get all tracks
   */
  getTracks(): ReadonlyArray<PropertyTrack<TrackValue>> {
    return this._tracks;
  }

  /**
   * Get a track by its full property path
   */
  getTrack(fullPropertyPath: string): PropertyTrack<TrackValue> | undefined {
    return this._tracks.find((t) => t.fullPropertyPath === fullPropertyPath);
  }

  /**
   * Get all unique component names used by tracks in this clip
   */
  getComponentNames(): string[] {
    const names = new Set<string>();
    for (const track of this._tracks) {
      names.add(track.componentName);
    }
    return Array.from(names);
  }

  /**
   * Get all tracks for a specific component
   */
  getTracksForComponent(componentName: string): PropertyTrack<TrackValue>[] {
    return this._tracks.filter((t) => t.componentName === componentName);
  }

  // ============================================================================
  // Evaluation
  // ============================================================================

  /**
   * Evaluate all tracks at a given normalized time.
   *
   * @param normalizedTime - Time from 0 to 1 (within clip duration)
   * @returns Map of full property path to evaluated value
   */
  evaluate(normalizedTime: number): Map<string, TrackValue> {
    const result = new Map<string, TrackValue>();

    for (const track of this._tracks) {
      const value = track.evaluate(normalizedTime);
      result.set(track.fullPropertyPath, value);
    }

    return result;
  }

  /**
   * Evaluate all tracks and return values grouped by component name.
   *
   * @param normalizedTime - Time from 0 to 1 (within clip duration)
   * @returns Nested map: componentName -> propertyPath -> value
   */
  evaluateGrouped(normalizedTime: number): GroupedTrackValues {
    const result: GroupedTrackValues = new Map();

    for (const track of this._tracks) {
      const value = track.evaluate(normalizedTime);
      const componentName = track.componentName;
      const propertyPath = track.propertyPath;

      if (!result.has(componentName)) {
        result.set(componentName, new Map());
      }

      result.get(componentName)!.set(propertyPath, value);
    }

    return result;
  }

  /**
   * Calculate normalized time from absolute time, handling loop modes.
   *
   * @param absoluteTime - Current playback time in seconds
   * @returns Object containing normalized time (0-1), whether clip completed, and loop count
   */
  calculateNormalizedTime(absoluteTime: number): {
    normalizedTime: number;
    completed: boolean;
    loopCount: number;
  } {
    const loopCount = Math.floor(absoluteTime / this._duration);
    let normalizedTime = (absoluteTime % this._duration) / this._duration;

    // Handle edge case when time exactly equals duration
    if (absoluteTime > 0 && normalizedTime === 0) {
      normalizedTime = 1;
    }

    let completed = false;

    switch (this._loopMode) {
      case LoopMode.Once:
        if (absoluteTime >= this._duration) {
          normalizedTime = 1;
          completed = true;
        }
        break;

      case LoopMode.Loop:
        // normalizedTime already wraps correctly
        break;

      case LoopMode.PingPong:
        // Alternate direction on odd loops
        if (loopCount % 2 === 1) {
          normalizedTime = 1 - normalizedTime;
        }
        break;
    }

    return { normalizedTime, completed, loopCount };
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  /**
   * Serialized animation clip format
   */
  toJSON(): SerializedAnimationClip {
    return {
      id: this.id,
      duration: this._duration,
      loopMode: this._loopMode,
      speed: this._speed,
      tracks: this._tracks.map((track) => track.toJSON()),
    };
  }

  /**
   * Create an AnimationClip from serialized data
   */
  static fromJSON(data: SerializedAnimationClip): AnimationClip {
    const clip = new AnimationClip(data.id);
    clip._duration = data.duration ?? 1.0;
    clip._loopMode = (data.loopMode as LoopMode) ?? LoopMode.Once;
    clip._speed = data.speed ?? 1.0;

    if (data.tracks) {
      for (const trackData of data.tracks) {
        const track = PropertyTrack.fromJSON(trackData);
        clip._tracks.push(track);
      }
    }

    return clip;
  }

  /**
   * Clone this clip
   */
  clone(): AnimationClip {
    const cloned = new AnimationClip(this.id);
    cloned._duration = this._duration;
    cloned._loopMode = this._loopMode;
    cloned._speed = this._speed;

    for (const track of this._tracks) {
      cloned._tracks.push(track.clone());
    }

    return cloned;
  }
}

// ============================================================================
// Serialization Types
// ============================================================================

/**
 * Serialized track format
 */
export interface SerializedTrack {
  propertyPath: string;
  interpolationMode?: string;
  keyframes: SerializedKeyframe[];
}

/**
 * Serialized animation clip format for JSON
 */
export interface SerializedAnimationClip {
  id: string;
  duration?: number;
  loopMode?: string;
  speed?: number;
  tracks?: SerializedTrack[];
}
