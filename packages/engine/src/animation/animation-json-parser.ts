/**
 * Animation JSON Parser
 *
 * Parses animation clip definitions from JSON format into AnimationClip instances.
 */

import { AnimationClip, LoopMode, type TrackValue } from './animation-clip.js';
import {
  NumberTrack,
  IntegerTrack,
  Vector3Track,
  ColorTrack,
  SpriteTrack,
  type AnimationTrack,
  type Color,
  type SpriteValue,
} from './animation-track.js';
import { Vector3 } from '../math/vector3.js';
import { Easing, type EasingFunction } from './tween.js';

// ============================================================================
// JSON Schema Types
// ============================================================================

/**
 * Vector3 value in JSON format
 */
export interface Vector3Json {
  x: number;
  y: number;
  z: number;
}

/**
 * Color value in JSON format (RGBA 0-1)
 */
export interface ColorJson {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Sprite value in JSON format
 */
export interface SpriteValueJson {
  spriteId: string;
}

/**
 * Keyframe value union type in JSON format
 */
export type KeyframeValueJson =
  | number
  | Vector3Json
  | ColorJson
  | SpriteValueJson;

/**
 * A keyframe in JSON format
 */
export interface AnimationKeyframeJson {
  /** Time in normalized range (0-1) */
  time: number;
  /** Value at this keyframe */
  value: KeyframeValueJson;
  /** Easing function name (default: 'linear') */
  easing?: string;
}

/**
 * An animation track in JSON format
 */
export interface AnimationTrackJson {
  /** Property path (e.g., 'tileIndex', 'position', 'color') */
  propertyPath: string;
  /** Type of property being animated */
  propertyType: 'number' | 'integer' | 'vector3' | 'color' | 'sprite';
  /** Ordered keyframes */
  keyframes: AnimationKeyframeJson[];
}

/**
 * An animation clip in JSON format
 */
export interface AnimationClipJson {
  /** Unique identifier for this clip */
  id: string;
  /** Duration in seconds */
  duration: number;
  /** Loop mode (default: 'once') */
  loopMode?: 'once' | 'loop' | 'pingPong';
  /** Playback speed multiplier (default: 1.0) */
  speed?: number;
  /** Animation tracks */
  tracks: AnimationTrackJson[];
}

// ============================================================================
// Easing Name Mapping
// ============================================================================

/**
 * Map of easing function names to EasingFunction implementations
 */
const EASING_MAP: Record<string, EasingFunction> = {
  linear: Easing.linear,

  // Quad
  easeInQuad: Easing.easeInQuad,
  easeOutQuad: Easing.easeOutQuad,
  easeInOutQuad: Easing.easeInOutQuad,

  // Cubic
  easeInCubic: Easing.easeInCubic,
  easeOutCubic: Easing.easeOutCubic,
  easeInOutCubic: Easing.easeInOutCubic,

  // Quart
  easeInQuart: Easing.easeInQuart,
  easeOutQuart: Easing.easeOutQuart,
  easeInOutQuart: Easing.easeInOutQuart,

  // Quint
  easeInQuint: Easing.easeInQuint,
  easeOutQuint: Easing.easeOutQuint,
  easeInOutQuint: Easing.easeInOutQuint,

  // Sine
  easeInSine: Easing.easeInSine,
  easeOutSine: Easing.easeOutSine,
  easeInOutSine: Easing.easeInOutSine,

  // Expo
  easeInExpo: Easing.easeInExpo,
  easeOutExpo: Easing.easeOutExpo,
  easeInOutExpo: Easing.easeInOutExpo,

  // Circ
  easeInCirc: Easing.easeInCirc,
  easeOutCirc: Easing.easeOutCirc,
  easeInOutCirc: Easing.easeInOutCirc,

  // Back
  easeInBack: Easing.easeInBack,
  easeOutBack: Easing.easeOutBack,
  easeInOutBack: Easing.easeInOutBack,

  // Elastic
  easeInElastic: Easing.easeInElastic,
  easeOutElastic: Easing.easeOutElastic,
  easeInOutElastic: Easing.easeInOutElastic,

  // Bounce
  easeInBounce: Easing.easeInBounce,
  easeOutBounce: Easing.easeOutBounce,
  easeInOutBounce: Easing.easeInOutBounce,
};

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Convert easing name string to EasingFunction
 *
 * @param name - Easing function name (e.g., 'linear', 'easeInQuad')
 * @returns The corresponding EasingFunction, or Easing.linear if not found
 */
export function easingFromString(name: string | undefined): EasingFunction {
  if (!name) return Easing.linear;
  return EASING_MAP[name] ?? Easing.linear;
}

/**
 * Convert loop mode string to LoopMode enum
 */
function loopModeFromString(mode: string | undefined): LoopMode {
  switch (mode) {
    case 'loop':
      return LoopMode.Loop;
    case 'pingPong':
      return LoopMode.PingPong;
    case 'once':
    default:
      return LoopMode.Once;
  }
}

/**
 * Type guard for Vector3Json
 */
function isVector3Json(value: KeyframeValueJson): value is Vector3Json {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    'y' in value &&
    'z' in value
  );
}

/**
 * Type guard for ColorJson
 */
function isColorJson(value: KeyframeValueJson): value is ColorJson {
  return (
    typeof value === 'object' &&
    value !== null &&
    'r' in value &&
    'g' in value &&
    'b' in value &&
    'a' in value
  );
}

/**
 * Type guard for SpriteValueJson
 */
function isSpriteValueJson(value: KeyframeValueJson): value is SpriteValueJson {
  return (
    typeof value === 'object' && value !== null && 'spriteId' in value
  );
}

/**
 * Parse an AnimationClipJson into an AnimationClip instance
 *
 * @param json - The animation clip JSON data
 * @returns A new AnimationClip instance
 * @throws Error if the JSON is invalid
 */
export function parseAnimationClipJson(json: AnimationClipJson): AnimationClip {
  if (!json.id || typeof json.id !== 'string') {
    throw new Error('[AnimationJsonParser] Animation clip must have an "id" string');
  }

  if (typeof json.duration !== 'number' || json.duration <= 0) {
    throw new Error(
      `[AnimationJsonParser] Animation clip "${json.id}" must have a positive "duration" number`
    );
  }

  const clip = AnimationClip.create(json.id)
    .setDuration(json.duration)
    .setLoopMode(loopModeFromString(json.loopMode))
    .setSpeed(json.speed ?? 1.0);

  if (!Array.isArray(json.tracks)) {
    throw new Error(
      `[AnimationJsonParser] Animation clip "${json.id}" must have a "tracks" array`
    );
  }

  for (const trackJson of json.tracks) {
    const track = parseTrackJson(trackJson, json.id);
    clip.addTrack(track as AnimationTrack<TrackValue>);
  }

  return clip;
}

/**
 * Parse a single track from JSON
 */
function parseTrackJson(
  trackJson: AnimationTrackJson,
  clipId: string
): NumberTrack | IntegerTrack | Vector3Track | ColorTrack | SpriteTrack {
  if (!trackJson.propertyPath || typeof trackJson.propertyPath !== 'string') {
    throw new Error(
      `[AnimationJsonParser] Track in clip "${clipId}" must have a "propertyPath" string`
    );
  }

  if (!Array.isArray(trackJson.keyframes)) {
    throw new Error(
      `[AnimationJsonParser] Track "${trackJson.propertyPath}" in clip "${clipId}" must have a "keyframes" array`
    );
  }

  switch (trackJson.propertyType) {
    case 'number':
      return parseNumberTrack(trackJson, clipId);
    case 'integer':
      return parseIntegerTrack(trackJson, clipId);
    case 'vector3':
      return parseVector3Track(trackJson, clipId);
    case 'color':
      return parseColorTrack(trackJson, clipId);
    case 'sprite':
      return parseSpriteTrack(trackJson, clipId);
    default:
      throw new Error(
        `[AnimationJsonParser] Unknown property type "${trackJson.propertyType}" in track "${trackJson.propertyPath}" of clip "${clipId}"`
      );
  }
}

/**
 * Parse a NumberTrack from JSON
 */
function parseNumberTrack(
  trackJson: AnimationTrackJson,
  clipId: string
): NumberTrack {
  const track = new NumberTrack(trackJson.propertyPath);

  for (const kf of trackJson.keyframes) {
    if (typeof kf.value !== 'number') {
      throw new Error(
        `[AnimationJsonParser] NumberTrack "${trackJson.propertyPath}" in clip "${clipId}" has non-number keyframe value`
      );
    }
    track.keyframe(kf.time, kf.value, easingFromString(kf.easing));
  }

  return track;
}

/**
 * Parse an IntegerTrack from JSON
 */
function parseIntegerTrack(
  trackJson: AnimationTrackJson,
  clipId: string
): IntegerTrack {
  const track = new IntegerTrack(trackJson.propertyPath);

  for (const kf of trackJson.keyframes) {
    if (typeof kf.value !== 'number') {
      throw new Error(
        `[AnimationJsonParser] IntegerTrack "${trackJson.propertyPath}" in clip "${clipId}" has non-number keyframe value`
      );
    }
    track.keyframe(kf.time, kf.value, easingFromString(kf.easing));
  }

  return track;
}

/**
 * Parse a Vector3Track from JSON
 */
function parseVector3Track(
  trackJson: AnimationTrackJson,
  clipId: string
): Vector3Track {
  const track = new Vector3Track(trackJson.propertyPath);

  for (const kf of trackJson.keyframes) {
    if (!isVector3Json(kf.value)) {
      throw new Error(
        `[AnimationJsonParser] Vector3Track "${trackJson.propertyPath}" in clip "${clipId}" has invalid keyframe value (expected {x, y, z})`
      );
    }
    track.keyframe(
      kf.time,
      new Vector3(kf.value.x, kf.value.y, kf.value.z),
      easingFromString(kf.easing)
    );
  }

  return track;
}

/**
 * Parse a ColorTrack from JSON
 */
function parseColorTrack(
  trackJson: AnimationTrackJson,
  clipId: string
): ColorTrack {
  const track = new ColorTrack(trackJson.propertyPath);

  for (const kf of trackJson.keyframes) {
    if (!isColorJson(kf.value)) {
      throw new Error(
        `[AnimationJsonParser] ColorTrack "${trackJson.propertyPath}" in clip "${clipId}" has invalid keyframe value (expected {r, g, b, a})`
      );
    }
    const color: Color = {
      r: kf.value.r,
      g: kf.value.g,
      b: kf.value.b,
      a: kf.value.a,
    };
    track.keyframe(kf.time, color, easingFromString(kf.easing));
  }

  return track;
}

/**
 * Parse a SpriteTrack from JSON
 */
function parseSpriteTrack(
  trackJson: AnimationTrackJson,
  clipId: string
): SpriteTrack {
  const track = new SpriteTrack(trackJson.propertyPath);

  for (const kf of trackJson.keyframes) {
    if (!isSpriteValueJson(kf.value)) {
      throw new Error(
        `[AnimationJsonParser] SpriteTrack "${trackJson.propertyPath}" in clip "${clipId}" has invalid keyframe value (expected {spriteId})`
      );
    }
    const spriteValue: SpriteValue = { spriteId: kf.value.spriteId };
    track.keyframe(kf.time, spriteValue, easingFromString(kf.easing));
  }

  return track;
}
