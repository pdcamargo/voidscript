/**
 * Animation Module
 *
 * Utilities for animating properties over time.
 * Includes tweening, keyframe animation clips, and animation controllers.
 */

export * from './tween.js';
export * from './animation-clip.js';
export * from './animation-manager.js';
export * from './animation-json-parser.js';

// Legacy track types (deprecated, use PropertyTrack instead)
export {
  NumberTrack,
  Vector3Track,
  ColorTrack,
  IntegerTrack,
  SpriteTrack,
  colorFromRGB,
  colorFromHex,
  createSpriteFrameTrack,
  createSpriteFrameSequence,
} from './animation-track.js';
export type { Keyframe, PropertyType } from './animation-track.js';

// Property-based animation system (preferred)
export * from './property-path.js';
export * from './property-track.js';
export * from './interpolation.js';
export * from './value-handlers.js';
