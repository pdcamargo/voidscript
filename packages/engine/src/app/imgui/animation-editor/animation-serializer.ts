/**
 * Animation Serializer
 *
 * Converts between the editor's internal state and the JSON format
 * used for animation files.
 *
 * Uses the new property-based format with full property paths
 * (e.g., "Transform3D.position", "Sprite2D.color")
 */

import { LoopMode } from '../../../animation/animation-clip.js';
import type {
  AnimationClipJson,
  AnimationTrackJson,
  AnimationKeyframeJson,
  KeyframeValueJson,
} from '../../../animation/animation-json-parser.js';
import type { Color, SpriteValue } from '../../../animation/interpolation.js';
import { inferInterpolationMode, InterpolationMode } from '../../../animation/interpolation.js';
import { parsePropertyPath } from '../../../animation/property-path.js';
import { getEasingFunction, getEasingName } from '../../../animation/property-track.js';
import { Easing } from '../../../animation/tween.js';
import {
  type AnimationEditorState,
  type EditorTrack,
  type EditorKeyframe,
  type Vector3Value,
  type KeyframeValue,
  generateId,
  loadState,
  getRawState,
} from './animation-editor-state.js';
import { DEFAULTS } from './constants.js';

// ============================================================================
// JSON to Editor State
// ============================================================================

/**
 * Convert AnimationClipJson to AnimationEditorState
 */
export function jsonToEditorState(
  json: AnimationClipJson,
  filePath: string | null = null,
  assetGuid: string | null = null,
): AnimationEditorState {
  const tracks = json.tracks.map(trackJsonToEditorTrack);

  return {
    selectedEntity: null,

    animationId: json.id,
    animationName: json.name ?? '',
    duration: json.duration,
    loopMode: loopModeFromString(json.loopMode),
    speed: json.speed ?? 1.0,
    tracks,

    currentFilePath: filePath,
    isDirty: false,
    assetGuid,

    selectedTrackId: null,
    selectedKeyframeIds: new Set(),

    playheadTime: 0,
    isPlaying: false,
    zoomLevel: DEFAULTS.zoomLevel,
    scrollX: DEFAULTS.scrollX,

    lastFrameTime: 0,

    inspectorKeyframeId: null,
    previewTextureGuid: null,

    // Focus-based preview control
    previousAnimationId: null,
    isEditorFocused: false,
  };
}

/**
 * Convert a track from JSON to EditorTrack
 */
function trackJsonToEditorTrack(json: AnimationTrackJson): EditorTrack {
  const keyframes = json.keyframes.map((kf) => keyframeJsonToEditorKeyframe(kf));

  return {
    id: generateId('track'),
    fullPropertyPath: json.propertyPath,
    keyframes,
    expanded: false,
  };
}

/**
 * Convert a keyframe from JSON to EditorKeyframe
 */
function keyframeJsonToEditorKeyframe(json: AnimationKeyframeJson): EditorKeyframe {
  return {
    id: generateId('kf'),
    time: json.time,
    value: json.value as KeyframeValue,
    easingName: json.easing ?? 'linear',
  };
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

// ============================================================================
// Editor State to JSON
// ============================================================================

/**
 * Convert AnimationEditorState to AnimationClipJson
 */
export function editorStateToJson(state: AnimationEditorState): AnimationClipJson {
  const json: AnimationClipJson = {
    id: state.animationId,
    duration: state.duration,
    loopMode: loopModeToString(state.loopMode),
    speed: state.speed !== 1.0 ? state.speed : undefined,
    tracks: state.tracks.map(editorTrackToJson),
  };

  // Only include name if it differs from id
  if (state.animationName && state.animationName !== state.animationId) {
    json.name = state.animationName;
  }

  return json;
}

/**
 * Convert EditorTrack to AnimationTrackJson
 */
function editorTrackToJson(track: EditorTrack): AnimationTrackJson {
  // Infer interpolation mode from the first keyframe value
  let interpolationMode: 'smooth' | 'discrete' | undefined;
  if (track.keyframes.length > 0) {
    const mode = inferInterpolationMode(track.keyframes[0]!.value);
    // Only include if not smooth (the default)
    if (mode === InterpolationMode.Discrete) {
      interpolationMode = 'discrete';
    }
  }

  const result: AnimationTrackJson = {
    propertyPath: track.fullPropertyPath,
    keyframes: track.keyframes.map((kf) => editorKeyframeToJson(kf)),
  };

  if (interpolationMode) {
    result.interpolationMode = interpolationMode;
  }

  return result;
}

/**
 * Convert EditorKeyframe to AnimationKeyframeJson
 */
function editorKeyframeToJson(keyframe: EditorKeyframe): AnimationKeyframeJson {
  const json: AnimationKeyframeJson = {
    time: keyframe.time,
    value: keyframe.value as KeyframeValueJson,
  };

  // Only include easing if not linear (default)
  if (keyframe.easingName !== 'linear') {
    json.easing = keyframe.easingName;
  }

  return json;
}

/**
 * Convert LoopMode enum to string for JSON
 */
function loopModeToString(mode: LoopMode): 'once' | 'loop' | 'pingPong' {
  switch (mode) {
    case LoopMode.Loop:
      return 'loop';
    case LoopMode.PingPong:
      return 'pingPong';
    case LoopMode.Once:
    default:
      return 'once';
  }
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * Load animation from JSON string and set it as the current state
 *
 * @param jsonString - The JSON content of the animation file
 * @param filePath - The file path of the animation
 * @param assetGuid - Optional existing GUID from the asset database
 */
export function loadAnimationFromJson(
  jsonString: string,
  filePath: string,
  assetGuid: string | null = null,
): void {
  const json = JSON.parse(jsonString) as AnimationClipJson;
  const state = jsonToEditorState(json, filePath, assetGuid);
  loadState(state);
}

/**
 * Serialize the current state to JSON string
 */
export function serializeCurrentState(pretty: boolean = true): string | null {
  const state = getRawState();
  if (!state) return null;

  const json = editorStateToJson(state);
  return pretty ? JSON.stringify(json, null, 2) : JSON.stringify(json);
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Get the default value for a property based on its path.
 * Infers the type from the property name or uses a generic default.
 */
export function getDefaultValueForProperty(fullPropertyPath: string): KeyframeValue {
  const parsed = parsePropertyPath(fullPropertyPath);
  const propertyPath = parsed.propertyPath.toLowerCase();

  // Position, rotation, scale - Vector3
  if (
    propertyPath === 'position' ||
    propertyPath === 'rotation' ||
    propertyPath === 'scale' ||
    propertyPath.startsWith('position.') ||
    propertyPath.startsWith('rotation.') ||
    propertyPath.startsWith('scale.')
  ) {
    // Check if it's a sub-property (e.g., position.x)
    if (propertyPath.includes('.')) {
      return propertyPath.includes('scale') ? 1 : 0;
    }
    // Full vector
    return propertyPath.includes('scale')
      ? { x: 1, y: 1, z: 1 }
      : { x: 0, y: 0, z: 0 };
  }

  // Color
  if (propertyPath === 'color' || propertyPath.startsWith('color.')) {
    if (propertyPath.includes('.')) {
      return 1; // Color channel
    }
    return { r: 1, g: 1, b: 1, a: 1 };
  }

  // Sprite
  if (propertyPath === 'sprite') {
    return { spriteId: '' };
  }

  // Tile index
  if (propertyPath === 'tileindex' || propertyPath === 'frameindex') {
    return 0;
  }

  // Opacity
  if (propertyPath === 'opacity' || propertyPath === 'alpha') {
    return 1;
  }

  // Default to number
  return 0;
}

/**
 * Clone a keyframe value (deep copy for objects)
 */
export function cloneValue(value: KeyframeValue): KeyframeValue {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  // Vector3-like
  if ('x' in value && 'y' in value && 'z' in value) {
    const v = value as Vector3Value;
    return { x: v.x, y: v.y, z: v.z };
  }

  // Color-like
  if ('r' in value && 'g' in value && 'b' in value && 'a' in value) {
    const c = value as Color;
    return { r: c.r, g: c.g, b: c.b, a: c.a };
  }

  // Sprite-like
  if ('spriteId' in value) {
    const s = value as SpriteValue;
    return { spriteId: s.spriteId, textureGuid: s.textureGuid };
  }

  // Unknown object - shallow copy
  return { ...value };
}

// ============================================================================
// Value Interpolation (for preview)
// ============================================================================

/**
 * Interpolate between two keyframe values based on inferred type
 */
export function interpolateValues(
  from: KeyframeValue,
  to: KeyframeValue,
  t: number,
): KeyframeValue {
  // Numbers
  if (typeof from === 'number' && typeof to === 'number') {
    return from + (to - from) * t;
  }

  // Objects
  if (typeof from === 'object' && typeof to === 'object' && from !== null && to !== null) {
    // Vector3-like
    if ('x' in from && 'y' in from && 'z' in from && 'x' in to && 'y' in to && 'z' in to) {
      const vFrom = from as Vector3Value;
      const vTo = to as Vector3Value;
      return {
        x: vFrom.x + (vTo.x - vFrom.x) * t,
        y: vFrom.y + (vTo.y - vFrom.y) * t,
        z: vFrom.z + (vTo.z - vFrom.z) * t,
      };
    }

    // Color-like
    if (
      'r' in from &&
      'g' in from &&
      'b' in from &&
      'a' in from &&
      'r' in to &&
      'g' in to &&
      'b' in to &&
      'a' in to
    ) {
      const cFrom = from as Color;
      const cTo = to as Color;
      return {
        r: cFrom.r + (cTo.r - cFrom.r) * t,
        g: cFrom.g + (cTo.g - cFrom.g) * t,
        b: cFrom.b + (cTo.b - cFrom.b) * t,
        a: cFrom.a + (cTo.a - cFrom.a) * t,
      };
    }

    // Discrete values (sprites, etc.) - no interpolation
    return t < 1 ? from : to;
  }

  // Fallback - discrete
  return t < 1 ? from : to;
}

/**
 * Evaluate a track at a specific time
 */
export function evaluateTrack(track: EditorTrack, normalizedTime: number): KeyframeValue | null {
  if (track.keyframes.length === 0) return null;

  // Before first keyframe
  if (normalizedTime <= track.keyframes[0]!.time) {
    return cloneValue(track.keyframes[0]!.value);
  }

  // After last keyframe
  const lastKf = track.keyframes[track.keyframes.length - 1]!;
  if (normalizedTime >= lastKf.time) {
    return cloneValue(lastKf.value);
  }

  // Find surrounding keyframes
  for (let i = 0; i < track.keyframes.length - 1; i++) {
    const kfA = track.keyframes[i]!;
    const kfB = track.keyframes[i + 1]!;

    if (normalizedTime >= kfA.time && normalizedTime < kfB.time) {
      // Calculate local t (0-1 between these two keyframes)
      const localT = (normalizedTime - kfA.time) / (kfB.time - kfA.time);

      // Apply easing (kfB's easing is used for interpolation TO that keyframe)
      const easedT = applyEasing(localT, kfB.easingName);

      return interpolateValues(kfA.value, kfB.value, easedT);
    }
  }

  return null;
}

/**
 * Apply easing function to a t value
 */
export function applyEasing(t: number, easingName: string): number {
  const easingFn = getEasingFunction(easingName);
  return easingFn(t);
}
