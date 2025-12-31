/**
 * Animation Editor Constants
 *
 * Colors, sizes, and configuration for the animation editor UI.
 */

// ============================================================================
// Layout Constants
// ============================================================================

/** Width of the track panel on the left side */
export const TRACK_PANEL_WIDTH = 200;

/** Height of each track row in the timeline */
export const TRACK_ROW_HEIGHT = 28;

/** Height of the time ruler at the top of timeline */
export const TIME_RULER_HEIGHT = 24;

/** Height of the toolbar area */
export const TOOLBAR_HEIGHT = 60;

/** Height of the playback controls bar at bottom */
export const PLAYBACK_CONTROLS_HEIGHT = 32;

/** Size of keyframe diamond buttons */
export const KEYFRAME_SIZE = 14;

/** Size of sprite thumbnail on keyframes */
export const SPRITE_THUMBNAIL_SIZE = 22;

/** Playhead handle size */
export const PLAYHEAD_HANDLE_SIZE = 10;

/** Playhead line width */
export const PLAYHEAD_LINE_WIDTH = 2;

/** Minimum timeline width in pixels */
export const MIN_TIMELINE_WIDTH = 400;

/** Width of the preview panel on the right side */
export const PREVIEW_PANEL_WIDTH = 220;

/** Size of the sprite preview area */
export const PREVIEW_SPRITE_SIZE = 128;

/** Padding inside the preview panel */
export const PREVIEW_PADDING = 10;

// ============================================================================
// Colors (ImVec4 format: x=r, y=g, z=b, w=a)
// ============================================================================

export const COLORS = {
  // Timeline background
  timelineBackground: { x: 0.12, y: 0.12, z: 0.14, w: 1.0 },

  // Time ruler
  timeRulerBackground: { x: 0.18, y: 0.18, z: 0.22, w: 1.0 },
  timeRulerText: { x: 0.6, y: 0.6, z: 0.6, w: 1.0 },
  timeRulerTick: { x: 0.3, y: 0.3, z: 0.35, w: 1.0 },

  // Track rows (alternating)
  trackRowEven: { x: 0.14, y: 0.14, z: 0.16, w: 1.0 },
  trackRowOdd: { x: 0.16, y: 0.16, z: 0.18, w: 1.0 },
  trackRowSelected: { x: 0.2, y: 0.35, z: 0.55, w: 1.0 },
  trackRowHovered: { x: 0.18, y: 0.18, z: 0.22, w: 1.0 },

  // Keyframe colors
  keyframeNormal: { x: 0.35, y: 0.55, z: 0.85, w: 1.0 },
  keyframeSelected: { x: 0.95, y: 0.75, z: 0.2, w: 1.0 },
  keyframeHovered: { x: 0.5, y: 0.7, z: 0.95, w: 1.0 },

  // Playhead
  playhead: { x: 0.95, y: 0.3, z: 0.3, w: 1.0 },
  playheadHandle: { x: 0.95, y: 0.3, z: 0.3, w: 1.0 },

  // Track panel
  trackPanelBackground: { x: 0.1, y: 0.1, z: 0.12, w: 1.0 },
  trackPanelText: { x: 0.8, y: 0.8, z: 0.8, w: 1.0 },
  trackPanelDivider: { x: 0.25, y: 0.25, z: 0.28, w: 1.0 },

  // Component header colors
  componentHeaderBackground: { x: 0.15, y: 0.15, z: 0.18, w: 1.0 },
  componentHeaderText: { x: 0.9, y: 0.9, z: 0.9, w: 1.0 },

  // Buttons
  buttonPrimary: { x: 0.25, y: 0.5, z: 0.7, w: 1.0 },
  buttonPrimaryHovered: { x: 0.35, y: 0.6, z: 0.8, w: 1.0 },
  buttonDanger: { x: 0.7, y: 0.25, z: 0.25, w: 1.0 },
  buttonDangerHovered: { x: 0.8, y: 0.35, z: 0.35, w: 1.0 },

  // Playback controls
  playButtonPlaying: { x: 0.2, y: 0.6, z: 0.2, w: 1.0 },
  playButtonStopped: { x: 0.4, y: 0.4, z: 0.45, w: 1.0 },

  // Grid lines
  gridLineMain: { x: 0.25, y: 0.25, z: 0.28, w: 1.0 },
  gridLineSub: { x: 0.2, y: 0.2, z: 0.22, w: 0.5 },

  // Preview panel
  previewBackground: { x: 0.1, y: 0.1, z: 0.12, w: 1.0 },
  previewBorder: { x: 0.25, y: 0.25, z: 0.28, w: 1.0 },
  previewCheckerLight: { x: 0.25, y: 0.25, z: 0.28, w: 1.0 },
  previewCheckerDark: { x: 0.15, y: 0.15, z: 0.18, w: 1.0 },
} as const;

// ============================================================================
// Easing Functions
// ============================================================================

/** All available easing function names */
export const EASING_NAMES = [
  'linear',

  // Quad
  'easeInQuad',
  'easeOutQuad',
  'easeInOutQuad',

  // Cubic
  'easeInCubic',
  'easeOutCubic',
  'easeInOutCubic',

  // Quart
  'easeInQuart',
  'easeOutQuart',
  'easeInOutQuart',

  // Quint
  'easeInQuint',
  'easeOutQuint',
  'easeInOutQuint',

  // Sine
  'easeInSine',
  'easeOutSine',
  'easeInOutSine',

  // Expo
  'easeInExpo',
  'easeOutExpo',
  'easeInOutExpo',

  // Circ
  'easeInCirc',
  'easeOutCirc',
  'easeInOutCirc',

  // Back
  'easeInBack',
  'easeOutBack',
  'easeInOutBack',

  // Elastic
  'easeInElastic',
  'easeOutElastic',
  'easeInOutElastic',

  // Bounce
  'easeInBounce',
  'easeOutBounce',
  'easeInOutBounce',
] as const;

export type EasingName = (typeof EASING_NAMES)[number];

// ============================================================================
// Loop Modes
// ============================================================================

export const LOOP_MODE_LABELS = ['Once', 'Loop', 'PingPong'] as const;
export const LOOP_MODE_VALUES = ['once', 'loop', 'pingPong'] as const;

// ============================================================================
// Session Storage Keys
// ============================================================================

export const SESSION_STORAGE_KEYS = {
  lastFilePath: 'voidscript-animation-editor-last-path',
  lastEntityId: 'voidscript-animation-editor-last-entity',
} as const;

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULTS = {
  duration: 1.0,
  speed: 1.0,
  loopMode: 'once' as const,
  zoomLevel: 1.0,
  scrollX: 0,
} as const;
