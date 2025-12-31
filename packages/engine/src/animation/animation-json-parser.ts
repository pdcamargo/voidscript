/**
 * Animation JSON Parser
 *
 * Parses animation clip definitions from JSON format into AnimationClip instances.
 *
 * New format (property-based):
 * ```json
 * {
 *   "id": "walk",
 *   "duration": 1.0,
 *   "loopMode": "loop",
 *   "tracks": [
 *     {
 *       "propertyPath": "Transform3D.position",
 *       "keyframes": [
 *         { "time": 0, "value": { "x": 0, "y": 0, "z": 0 } },
 *         { "time": 1, "value": { "x": 10, "y": 0, "z": 0 }, "easing": "easeInOutQuad" }
 *       ]
 *     }
 *   ]
 * }
 * ```
 */

import {
  AnimationClip,
  LoopMode,
  type SerializedAnimationClip,
  type SerializedTrack,
} from './animation-clip.js';
import { PropertyTrack, getEasingFunction, type SerializedKeyframe } from './property-track.js';
import { InterpolationMode } from './interpolation.js';
import { Easing, type EasingFunction } from './tween.js';

// ============================================================================
// JSON Schema Types (for backwards compatibility documentation)
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
  textureGuid?: string;
}

/**
 * Keyframe value union type in JSON format
 */
export type KeyframeValueJson = number | Vector3Json | ColorJson | SpriteValueJson | unknown;

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
 * An animation track in JSON format (new property-based format)
 */
export interface AnimationTrackJson {
  /** Full property path (e.g., 'Transform3D.position.x', 'Sprite2D.color') */
  propertyPath: string;
  /** Optional interpolation mode override */
  interpolationMode?: 'smooth' | 'discrete';
  /** Ordered keyframes */
  keyframes: AnimationKeyframeJson[];
}

/**
 * An animation clip in JSON format
 */
export interface AnimationClipJson {
  /** Unique identifier for this clip */
  id: string;
  /** Human-readable display name (optional, defaults to id) */
  name?: string;
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
  return getEasingFunction(name);
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
 * Convert interpolation mode string to InterpolationMode enum
 */
function interpolationModeFromString(mode: string | undefined): InterpolationMode | undefined {
  switch (mode) {
    case 'smooth':
      return InterpolationMode.Smooth;
    case 'discrete':
      return InterpolationMode.Discrete;
    default:
      return undefined; // Let the track infer from values
  }
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
      `[AnimationJsonParser] Animation clip "${json.id}" must have a positive "duration" number`,
    );
  }

  const clip = AnimationClip.create(json.id)
    .setDuration(json.duration)
    .setLoopMode(loopModeFromString(json.loopMode))
    .setSpeed(json.speed ?? 1.0);

  if (!Array.isArray(json.tracks)) {
    throw new Error(`[AnimationJsonParser] Animation clip "${json.id}" must have a "tracks" array`);
  }

  for (const trackJson of json.tracks) {
    const track = parseTrackJson(trackJson, json.id);
    clip.addTrack(track);
  }

  return clip;
}

/**
 * Parse a single track from JSON using the new PropertyTrack format
 */
function parseTrackJson(trackJson: AnimationTrackJson, clipId: string): PropertyTrack<unknown> {
  if (!trackJson.propertyPath || typeof trackJson.propertyPath !== 'string') {
    throw new Error(
      `[AnimationJsonParser] Track in clip "${clipId}" must have a "propertyPath" string`,
    );
  }

  if (!Array.isArray(trackJson.keyframes)) {
    throw new Error(
      `[AnimationJsonParser] Track "${trackJson.propertyPath}" in clip "${clipId}" must have a "keyframes" array`,
    );
  }

  // Create the track with optional interpolation mode
  const interpolationMode = interpolationModeFromString(trackJson.interpolationMode);
  const track = new PropertyTrack<unknown>(trackJson.propertyPath, interpolationMode);

  // Add keyframes
  for (const kf of trackJson.keyframes) {
    if (typeof kf.time !== 'number') {
      throw new Error(
        `[AnimationJsonParser] Keyframe in track "${trackJson.propertyPath}" of clip "${clipId}" must have a "time" number`,
      );
    }

    const easing = easingFromString(kf.easing);
    track.keyframe(kf.time, kf.value, easing);
  }

  return track;
}

/**
 * Parse animation clip from JSON using the AnimationClip.fromJSON method
 * This is the preferred method as it uses the built-in serialization format.
 */
export function parseSerializedAnimationClip(data: SerializedAnimationClip): AnimationClip {
  return AnimationClip.fromJSON(data);
}

/**
 * Serialize an AnimationClip to JSON format
 */
export function serializeAnimationClip(clip: AnimationClip): SerializedAnimationClip {
  return clip.toJSON();
}

/**
 * Convert a legacy format JSON (with propertyType) to the new format
 * For migration purposes only
 */
export function migrateLegacyFormat(legacyJson: LegacyAnimationClipJson): AnimationClipJson {
  const newTracks: AnimationTrackJson[] = [];

  for (const track of legacyJson.tracks || []) {
    // Convert legacy property paths to new format
    // Old format: "position", "color", "tileIndex"
    // New format: "ComponentName.property"

    let propertyPath = track.propertyPath;
    let interpolationMode: 'smooth' | 'discrete' | undefined;

    // Infer component name from property type and path
    switch (track.propertyType) {
      case 'vector3':
        // Likely Transform3D
        if (['position', 'rotation', 'scale'].includes(propertyPath)) {
          propertyPath = `Transform3D.${propertyPath}`;
        }
        interpolationMode = 'smooth';
        break;

      case 'color':
        // Likely Sprite2D
        if (propertyPath === 'color') {
          propertyPath = 'Sprite2D.color';
        }
        interpolationMode = 'smooth';
        break;

      case 'number':
        // Could be Transform3D sub-property or Sprite2D opacity
        if (propertyPath.startsWith('position.') || propertyPath.startsWith('rotation.') || propertyPath.startsWith('scale.')) {
          propertyPath = `Transform3D.${propertyPath}`;
        } else if (propertyPath === 'opacity' || propertyPath.startsWith('color.')) {
          propertyPath = `Sprite2D.${propertyPath}`;
        }
        interpolationMode = 'smooth';
        break;

      case 'integer':
        // Likely Sprite2D tileIndex
        if (propertyPath === 'tileIndex') {
          propertyPath = 'Sprite2D.tileIndex';
        }
        interpolationMode = 'discrete';
        break;

      case 'sprite':
        // Sprite2D sprite
        propertyPath = 'Sprite2D.sprite';
        interpolationMode = 'discrete';
        break;
    }

    newTracks.push({
      propertyPath,
      interpolationMode,
      keyframes: track.keyframes,
    });
  }

  return {
    id: legacyJson.id,
    duration: legacyJson.duration,
    loopMode: legacyJson.loopMode,
    speed: legacyJson.speed,
    tracks: newTracks,
  };
}

// ============================================================================
// Legacy Format Types (for migration)
// ============================================================================

/**
 * Legacy track format with explicit propertyType
 */
interface LegacyAnimationTrackJson {
  propertyPath: string;
  propertyType: 'number' | 'integer' | 'vector3' | 'color' | 'sprite';
  keyframes: AnimationKeyframeJson[];
}

/**
 * Legacy animation clip format
 */
interface LegacyAnimationClipJson {
  id: string;
  duration: number;
  loopMode?: 'once' | 'loop' | 'pingPong';
  speed?: number;
  tracks: LegacyAnimationTrackJson[];
}
