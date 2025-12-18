/**
 * Animation Clip System
 *
 * Defines reusable animation clips that contain multiple tracks
 * and can be played by AnimationController.
 */

import type { AnimationTrack, Color, SpriteValue } from './animation-track.js';
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
export type TrackValue = number | Vector3 | Color | SpriteValue;

// ============================================================================
// AnimationClip
// ============================================================================

/**
 * An animation clip containing multiple property tracks.
 *
 * Use the builder pattern to create clips:
 * ```typescript
 * const clip = AnimationClip.create('walk')
 *   .addTrack(new Vector3Track('position')
 *     .keyframe(0, new Vector3(0, 0, 0))
 *     .keyframe(1, new Vector3(1, 0, 0))
 *   )
 *   .setDuration(1.0)
 *   .setLoopMode(LoopMode.Loop);
 * ```
 */
export class AnimationClip {
  /** Unique identifier for this clip */
  readonly id: string;

  private _tracks: AnimationTrack<TrackValue>[] = [];
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
  addTrack<T extends TrackValue>(track: AnimationTrack<T>): this {
    this._tracks.push(track as AnimationTrack<TrackValue>);
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
  getTracks(): ReadonlyArray<AnimationTrack<TrackValue>> {
    return this._tracks;
  }

  /**
   * Get a track by property path
   */
  getTrack(propertyPath: string): AnimationTrack<TrackValue> | undefined {
    return this._tracks.find((t) => t.propertyPath === propertyPath);
  }

  // ============================================================================
  // Evaluation
  // ============================================================================

  /**
   * Evaluate all tracks at a given normalized time.
   *
   * @param normalizedTime - Time from 0 to 1 (within clip duration)
   * @returns Map of property path to evaluated value
   */
  evaluate(normalizedTime: number): Map<string, TrackValue> {
    const result = new Map<string, TrackValue>();

    for (const track of this._tracks) {
      const value = track.evaluate(normalizedTime);
      result.set(track.propertyPath, value);
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
}
