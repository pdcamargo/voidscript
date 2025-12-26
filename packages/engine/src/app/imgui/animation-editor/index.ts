/**
 * Animation Editor Module
 *
 * Exports the animation editor window and related functionality.
 * Uses the property-based animation system with full property paths.
 */

// Main window
export { renderAnimationEditorWindow, handleAnimationEditorShortcut } from './animation-editor-window.js';

// Preview panel
export { renderPreviewPanel } from './preview-panel.js';

// State management
export {
  getAnimationEditorState,
  isAnimationEditorOpen,
  openAnimationEditor,
  closeAnimationEditor,
  createNewAnimation,
  selectEntity,
  getSelectedEntity,
  setPreviewTextureGuid,
  getPreviewTextureGuid,
  autoDetectPreviewTexture,
  evaluateAnimationAtTime,
  getTracksGroupedByComponent,
  getPreviewClip,
  initializeCustomWindowsFromStorage,
  // Panel visibility API
  isPanelVisible,
  setPanelVisible,
  togglePanelVisibility,
  type PanelName,
  type AnimationEditorState,
  type EditorTrack,
  type EditorKeyframe,
  type KeyframeValue,
  type Vector3Value,
} from './animation-editor-state.js';

// Serialization
export {
  jsonToEditorState,
  editorStateToJson,
  loadAnimationFromJson,
  serializeCurrentState,
  getDefaultValueForProperty,
  cloneValue,
  interpolateValues,
  evaluateTrack,
} from './animation-serializer.js';

// Keyframe editor (for Inspector integration)
export {
  hasSelectedKeyframe,
  renderKeyframeEditor,
} from './keyframe-editor.js';

// Constants (for external customization if needed)
export {
  COLORS as ANIMATION_EDITOR_COLORS,
  TRACK_PANEL_WIDTH,
  TRACK_ROW_HEIGHT,
  TIME_RULER_HEIGHT,
  TOOLBAR_HEIGHT,
  PLAYBACK_CONTROLS_HEIGHT,
  KEYFRAME_SIZE,
  PREVIEW_PANEL_WIDTH,
  PREVIEW_SPRITE_SIZE,
  PREVIEW_PADDING,
  EASING_NAMES,
  type EasingName,
} from './constants.js';
