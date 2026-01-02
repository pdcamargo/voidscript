/**
 * Animation Editor State Management
 *
 * Manages the state for the animation editor including animation data,
 * selection, playback, and entity preview binding.
 *
 * Uses the new property-based animation system with full property paths
 * like "Transform3D.position" or "Sprite2D.color".
 */

import { LoopMode } from '../../../animation/animation-clip.js';
import type { Entity } from '@voidscript/core';
import type { Color, SpriteValue } from '../../../animation/interpolation.js';
import { InterpolationMode, inferInterpolationMode } from '../../../animation/interpolation.js';
import { parsePropertyPath } from '../../../animation/property-path.js';
import { DEFAULTS, SESSION_STORAGE_KEYS } from './constants.js';
import {
  setAnimationPreviewEntity,
  getAnimationPreviewEntity,
} from '../../../editor/system-conditions.js';
import { AnimationController, playAnimation, stopAnimation } from '../../../ecs/components/animation/animation-controller.js';
import { AnimationClip, type TrackValue, type GroupedTrackValues } from '../../../animation/animation-clip.js';
import { PropertyTrack } from '../../../animation/property-track.js';
import { getEasingFunction } from '../../../animation/property-track.js';
import type { Command } from '@voidscript/core';

// ============================================================================
// Types
// ============================================================================

/**
 * Vector3-like value for keyframes
 */
export interface Vector3Value {
  x: number;
  y: number;
  z: number;
}

/**
 * Union of all possible keyframe values
 */
export type KeyframeValue = number | Vector3Value | Color | SpriteValue | unknown;

/**
 * A keyframe in the editor with a unique ID for selection
 */
export interface EditorKeyframe {
  /** Unique ID for selection and tracking */
  id: string;
  /** Normalized time within clip (0-1) */
  time: number;
  /** Value at this keyframe */
  value: KeyframeValue;
  /** Easing function name */
  easingName: string;
}

/**
 * A track in the editor with a unique ID
 *
 * Uses full property paths like "Transform3D.position" or "Sprite2D.color"
 */
export interface EditorTrack {
  /** Unique ID for selection */
  id: string;
  /** Full property path including component (e.g., 'Transform3D.position', 'Sprite2D.color') */
  fullPropertyPath: string;
  /** Keyframes in this track (sorted by time) */
  keyframes: EditorKeyframe[];
  /** Whether track details are expanded in the panel */
  expanded: boolean;
}

/**
 * Complete state for the animation editor
 */
export interface AnimationEditorState {
  // Entity selection (required before editing)
  selectedEntity: Entity | null;

  // Animation data
  animationId: string;
  /** Human-readable display name (optional, defaults to animationId) */
  animationName: string;
  duration: number;
  loopMode: LoopMode;
  speed: number;
  tracks: EditorTrack[];

  // File state
  currentFilePath: string | null;
  isDirty: boolean;
  /** Asset GUID for manifest registration (null = new animation, not yet registered) */
  assetGuid: string | null;

  // Selection
  selectedTrackId: string | null;
  selectedKeyframeIds: Set<string>;

  // Timeline view
  playheadTime: number;
  isPlaying: boolean;
  zoomLevel: number;
  scrollX: number;

  // Playback timing
  lastFrameTime: number;

  // Keyframe inspector (for auto-switch in Inspector panel)
  inspectorKeyframeId: string | null;

  // Preview panel texture (for sprite preview)
  previewTextureGuid: string | null;

  // Focus-based preview control
  /** Previous animation ID before preview started (for restoration on unfocus) */
  previousAnimationId: string | null;
  /** Whether the editor window is currently focused */
  isEditorFocused: boolean;
}

// ============================================================================
// Module State
// ============================================================================

let editorState: AnimationEditorState | null = null;
let isWindowOpen = false;
let idCounter = 0;

// ============================================================================
// Custom Window Persistence
// ============================================================================

const CUSTOM_WINDOWS_STORAGE_KEY = 'voidscript-editor-custom-windows';

/**
 * State for tracking which windows/panels are visible.
 * This is persisted to localStorage so windows reopen on page refresh.
 *
 * Built-in panels default to `true` (visible) when undefined.
 * Custom windows like Animation Editor default to `false` (hidden).
 *
 * ## Adding a new window
 *
 * 1. Add a boolean property here (e.g., `myWindow: boolean`)
 * 2. In your window's open function, save state:
 *    ```ts
 *    const state = loadCustomWindowsState();
 *    state.myWindow = true;
 *    saveCustomWindowsState(state);
 *    ```
 * 3. In your window's close function, save state:
 *    ```ts
 *    const state = loadCustomWindowsState();
 *    state.myWindow = false;
 *    saveCustomWindowsState(state);
 *    ```
 * 4. In `initializeCustomWindowsFromStorage()`, add:
 *    ```ts
 *    if (state.myWindow) {
 *      openMyWindow();
 *    }
 *    ```
 */
interface CustomWindowsState {
  // Built-in panels (default to true when undefined)
  sceneView?: boolean;
  gameView?: boolean;
  hierarchy?: boolean;
  inspector?: boolean;
  debugPanel?: boolean;
  // Custom windows (default to false when undefined)
  animationEditor: boolean;
  spriteEditor?: boolean;
  resources?: boolean;
  assetBrowser?: boolean;
}

// In-memory state for built-in panels (initialized from localStorage)
let panelVisibility = {
  sceneView: true,
  gameView: true,
  hierarchy: true,
  inspector: true,
  debugPanel: true,
  spriteEditor: false,
  resources: false,
  assetBrowser: false,
};

/**
 * Load custom windows state from localStorage
 */
function loadCustomWindowsState(): CustomWindowsState {
  try {
    const stored = localStorage.getItem(CUSTOM_WINDOWS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<CustomWindowsState>;
      // Merge with defaults (built-in panels default to true, custom windows to false)
      return {
        sceneView: parsed.sceneView ?? true,
        gameView: parsed.gameView ?? true,
        hierarchy: parsed.hierarchy ?? true,
        inspector: parsed.inspector ?? true,
        debugPanel: parsed.debugPanel ?? true,
        animationEditor: parsed.animationEditor ?? false,
        spriteEditor: parsed.spriteEditor ?? false,
        resources: parsed.resources ?? false,
        assetBrowser: parsed.assetBrowser ?? false,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return {
    sceneView: true,
    gameView: true,
    hierarchy: true,
    inspector: true,
    debugPanel: true,
    animationEditor: false,
    spriteEditor: false,
    resources: false,
    assetBrowser: false,
  };
}

/**
 * Save custom windows state to localStorage
 */
function saveCustomWindowsState(state: CustomWindowsState): void {
  try {
    localStorage.setItem(CUSTOM_WINDOWS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Initialize custom windows from persisted state.
 * Should be called once when the editor starts.
 */
export function initializeCustomWindowsFromStorage(): void {
  const state = loadCustomWindowsState();

  // Initialize built-in panel visibility
  panelVisibility.sceneView = state.sceneView ?? true;
  panelVisibility.gameView = state.gameView ?? true;
  panelVisibility.hierarchy = state.hierarchy ?? true;
  panelVisibility.inspector = state.inspector ?? true;
  panelVisibility.debugPanel = state.debugPanel ?? true;
  panelVisibility.spriteEditor = state.spriteEditor ?? false;
  panelVisibility.resources = state.resources ?? false;
  panelVisibility.assetBrowser = state.assetBrowser ?? false;

  // Initialize custom windows
  if (state.animationEditor) {
    openAnimationEditor();
  }
}

// ============================================================================
// Panel Visibility API
// ============================================================================

export type PanelName =
  | 'sceneView'
  | 'gameView'
  | 'hierarchy'
  | 'inspector'
  | 'debugPanel'
  | 'spriteEditor'
  | 'resources'
  | 'assetBrowser';

/**
 * Check if a built-in panel is visible
 */
export function isPanelVisible(panel: PanelName): boolean {
  return panelVisibility[panel];
}

/**
 * Set visibility for a built-in panel
 */
export function setPanelVisible(panel: PanelName, visible: boolean): void {
  panelVisibility[panel] = visible;
  // Persist to localStorage
  const state = loadCustomWindowsState();
  state[panel] = visible;
  saveCustomWindowsState(state);
}

/**
 * Toggle visibility for a built-in panel
 */
export function togglePanelVisibility(panel: PanelName): void {
  setPanelVisible(panel, !panelVisibility[panel]);
}

// Temporary clip used for preview (built from editor state)
let previewClip: AnimationClip | null = null;

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique ID for keyframes and tracks
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${++idCounter}_${Date.now().toString(36)}`;
}

// ============================================================================
// State Access
// ============================================================================

/**
 * Get the current animation editor state
 */
export function getAnimationEditorState(): AnimationEditorState | null {
  return editorState;
}

/**
 * Check if the animation editor window is open
 */
export function isAnimationEditorOpen(): boolean {
  return isWindowOpen;
}

// ============================================================================
// Window Control
// ============================================================================

/**
 * Open the animation editor window
 */
export function openAnimationEditor(): void {
  isWindowOpen = true;
  if (!editorState) {
    createNewAnimation();
  }
  // Persist window state
  const state = loadCustomWindowsState();
  state.animationEditor = true;
  saveCustomWindowsState(state);
}

/**
 * Close the animation editor window
 */
export function closeAnimationEditor(): void {
  isWindowOpen = false;
  // Stop playback when closing
  if (editorState) {
    editorState.isPlaying = false;
    // Clear preview entity
    setAnimationPreviewEntity(null);
  }
  // Persist window state
  const state = loadCustomWindowsState();
  state.animationEditor = false;
  saveCustomWindowsState(state);
}

// ============================================================================
// Animation Management
// ============================================================================

/**
 * Create a new empty animation.
 * Preserves the currently selected entity so users don't have to re-select it.
 */
export function createNewAnimation(): void {
  // Preserve the selected entity and focus state
  const previousSelectedEntity = editorState?.selectedEntity ?? null;
  const previousIsEditorFocused = editorState?.isEditorFocused ?? false;
  const previousPreviousAnimationId = editorState?.previousAnimationId ?? null;

  // Clear any existing preview temporarily
  setAnimationPreviewEntity(null);

  editorState = {
    selectedEntity: previousSelectedEntity,

    animationId: crypto.randomUUID(),
    animationName: '',
    duration: DEFAULTS.duration,
    loopMode: LoopMode.Once,
    speed: DEFAULTS.speed,
    tracks: [],

    currentFilePath: null,
    isDirty: false,
    assetGuid: null,

    selectedTrackId: null,
    selectedKeyframeIds: new Set(),

    playheadTime: 0,
    isPlaying: false,
    zoomLevel: DEFAULTS.zoomLevel,
    scrollX: DEFAULTS.scrollX,

    lastFrameTime: 0,

    inspectorKeyframeId: null,
    previewTextureGuid: null,

    // Focus-based preview control - preserve these
    previousAnimationId: previousPreviousAnimationId,
    isEditorFocused: previousIsEditorFocused,
  };

  // Re-establish preview if entity was selected
  if (previousSelectedEntity !== null) {
    setAnimationPreviewEntity(previousSelectedEntity);
    rebuildPreviewClip();
  }
}

/**
 * Mark the animation as dirty (has unsaved changes)
 */
export function markDirty(): void {
  if (editorState) {
    editorState.isDirty = true;
    // Rebuild preview clip when state changes
    rebuildPreviewClip();
  }
}

/**
 * Mark the animation as clean (no unsaved changes)
 */
export function markClean(): void {
  if (editorState) {
    editorState.isDirty = false;
  }
}

/**
 * Set the current file path and cache it in session storage
 */
export function setCurrentFilePath(path: string | null): void {
  if (editorState) {
    editorState.currentFilePath = path;
    if (path) {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEYS.lastFilePath, path);
      } catch {
        // Ignore storage errors
      }
    }
  }
}

/**
 * Get the cached file path from session storage
 */
export function getCachedFilePath(): string | null {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEYS.lastFilePath);
  } catch {
    return null;
  }
}

// ============================================================================
// Entity Selection
// ============================================================================

/**
 * Select an entity for animation editing.
 * The entity must have an AnimationController component.
 *
 * @param entity - The entity to select, or null to clear selection
 * @param commands - Optional ECS commands to capture the entity's current animation state
 */
export function selectEntity(entity: Entity | null, commands?: Command): void {
  if (!editorState) return;

  // Clear previous preview
  if (editorState.selectedEntity !== null) {
    setAnimationPreviewEntity(null);
  }

  editorState.selectedEntity = entity;
  // Reset previousAnimationId when selecting a new entity
  editorState.previousAnimationId = null;

  // Set up preview for the new entity
  if (entity !== null) {
    // Capture the entity's current animation ID before we start previewing
    if (commands) {
      const controller = commands.tryGetComponent(entity, AnimationController);
      if (controller && controller.currentAnimationId !== '__editor_preview__') {
        editorState.previousAnimationId = controller.currentAnimationId;
      }
    }

    setAnimationPreviewEntity(entity);
    rebuildPreviewClip();
  }
}

/**
 * Get the currently selected entity
 */
export function getSelectedEntity(): Entity | null {
  return editorState?.selectedEntity ?? null;
}

/**
 * Cache entity selection in session storage
 */
export function cacheSelectedEntity(entityId: number | null): void {
  try {
    if (entityId !== null) {
      sessionStorage.setItem(SESSION_STORAGE_KEYS.lastFilePath + '_entity', entityId.toString());
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEYS.lastFilePath + '_entity');
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get cached entity ID from session storage
 */
export function getCachedEntityId(): number | null {
  try {
    const id = sessionStorage.getItem(SESSION_STORAGE_KEYS.lastFilePath + '_entity');
    return id ? parseInt(id, 10) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// Track Management
// ============================================================================

/**
 * Add a new track to the animation
 *
 * @param fullPropertyPath - Full property path (e.g., "Transform3D.position", "Sprite2D.color")
 * @param defaultValue - Default value for the first keyframe
 */
export function addTrack(fullPropertyPath: string, defaultValue: KeyframeValue): EditorTrack {
  if (!editorState) {
    throw new Error('Animation editor state not initialized');
  }

  const track: EditorTrack = {
    id: generateId('track'),
    fullPropertyPath,
    keyframes: [],
    expanded: false,
  };

  editorState.tracks.push(track);
  markDirty();

  return track;
}

/**
 * Remove a track by ID
 */
export function removeTrack(trackId: string): void {
  if (!editorState) return;

  const index = editorState.tracks.findIndex((t) => t.id === trackId);
  if (index >= 0) {
    const track = editorState.tracks[index]!;

    // Remove keyframe selections for this track
    for (const kf of track.keyframes) {
      editorState.selectedKeyframeIds.delete(kf.id);
    }

    editorState.tracks.splice(index, 1);

    // Clear selection if removed track was selected
    if (editorState.selectedTrackId === trackId) {
      editorState.selectedTrackId = null;
    }

    markDirty();
  }
}

/**
 * Get a track by ID
 */
export function getTrack(trackId: string): EditorTrack | undefined {
  return editorState?.tracks.find((t) => t.id === trackId);
}

/**
 * Get a track by full property path
 */
export function getTrackByPath(fullPropertyPath: string): EditorTrack | undefined {
  return editorState?.tracks.find((t) => t.fullPropertyPath === fullPropertyPath);
}

/**
 * Select a track
 */
export function selectTrack(trackId: string | null): void {
  if (editorState) {
    editorState.selectedTrackId = trackId;
  }
}

/**
 * Get all tracks grouped by component name
 */
export function getTracksGroupedByComponent(): Map<string, EditorTrack[]> {
  const groups = new Map<string, EditorTrack[]>();

  if (!editorState) return groups;

  for (const track of editorState.tracks) {
    const parsed = parsePropertyPath(track.fullPropertyPath);
    const componentName = parsed.componentName;

    if (!groups.has(componentName)) {
      groups.set(componentName, []);
    }
    groups.get(componentName)!.push(track);
  }

  return groups;
}

// ============================================================================
// Keyframe Management
// ============================================================================

/**
 * Add a keyframe to a track
 */
export function addKeyframe(
  trackId: string,
  time: number,
  value: KeyframeValue,
  easingName: string = 'linear',
): EditorKeyframe | null {
  if (!editorState) return null;

  const track = editorState.tracks.find((t) => t.id === trackId);
  if (!track) return null;

  const keyframe: EditorKeyframe = {
    id: generateId('kf'),
    time: Math.max(0, Math.min(1, time)),
    value,
    easingName,
  };

  track.keyframes.push(keyframe);
  sortKeyframes(track);
  markDirty();

  return keyframe;
}

/**
 * Remove a keyframe by ID
 */
export function removeKeyframe(keyframeId: string): void {
  if (!editorState) return;

  for (const track of editorState.tracks) {
    const index = track.keyframes.findIndex((kf) => kf.id === keyframeId);
    if (index >= 0) {
      track.keyframes.splice(index, 1);
      editorState.selectedKeyframeIds.delete(keyframeId);
      if (editorState.inspectorKeyframeId === keyframeId) {
        editorState.inspectorKeyframeId = null;
      }
      markDirty();
      return;
    }
  }
}

/**
 * Get a keyframe by ID
 */
export function getKeyframe(keyframeId: string): EditorKeyframe | undefined {
  if (!editorState) return undefined;

  for (const track of editorState.tracks) {
    const kf = track.keyframes.find((k) => k.id === keyframeId);
    if (kf) return kf;
  }
  return undefined;
}

/**
 * Find the track that contains a keyframe
 */
export function getTrackForKeyframe(keyframeId: string): EditorTrack | undefined {
  if (!editorState) return undefined;

  for (const track of editorState.tracks) {
    if (track.keyframes.some((kf) => kf.id === keyframeId)) {
      return track;
    }
  }
  return undefined;
}

/**
 * Update a keyframe's time (and re-sort)
 */
export function updateKeyframeTime(keyframeId: string, newTime: number): void {
  if (!editorState) return;

  for (const track of editorState.tracks) {
    const kf = track.keyframes.find((k) => k.id === keyframeId);
    if (kf) {
      kf.time = Math.max(0, Math.min(1, newTime));
      sortKeyframes(track);
      markDirty();
      return;
    }
  }
}

/**
 * Update a keyframe's value
 */
export function updateKeyframeValue(keyframeId: string, newValue: KeyframeValue): void {
  const kf = getKeyframe(keyframeId);
  if (kf) {
    kf.value = newValue;
    markDirty();
  }
}

/**
 * Update a keyframe's easing
 */
export function updateKeyframeEasing(keyframeId: string, easingName: string): void {
  const kf = getKeyframe(keyframeId);
  if (kf) {
    kf.easingName = easingName;
    markDirty();
  }
}

/**
 * Sort keyframes by time
 */
function sortKeyframes(track: EditorTrack): void {
  track.keyframes.sort((a, b) => a.time - b.time);
}

/**
 * Sort all keyframes in all tracks
 */
export function sortAllKeyframes(): void {
  if (!editorState) return;
  for (const track of editorState.tracks) {
    sortKeyframes(track);
  }
}

// ============================================================================
// Selection Management
// ============================================================================

/**
 * Select a keyframe
 */
export function selectKeyframe(keyframeId: string, addToSelection: boolean = false): void {
  if (!editorState) return;

  if (!addToSelection) {
    editorState.selectedKeyframeIds.clear();
  }
  editorState.selectedKeyframeIds.add(keyframeId);
}

/**
 * Deselect a keyframe
 */
export function deselectKeyframe(keyframeId: string): void {
  editorState?.selectedKeyframeIds.delete(keyframeId);
}

/**
 * Toggle keyframe selection
 */
export function toggleKeyframeSelection(keyframeId: string): void {
  if (!editorState) return;

  if (editorState.selectedKeyframeIds.has(keyframeId)) {
    editorState.selectedKeyframeIds.delete(keyframeId);
  } else {
    editorState.selectedKeyframeIds.add(keyframeId);
  }
}

/**
 * Clear all keyframe selections
 */
export function clearKeyframeSelection(): void {
  editorState?.selectedKeyframeIds.clear();
}

/**
 * Check if a keyframe is selected
 */
export function isKeyframeSelected(keyframeId: string): boolean {
  return editorState?.selectedKeyframeIds.has(keyframeId) ?? false;
}

/**
 * Get all selected keyframe IDs
 */
export function getSelectedKeyframeIds(): Set<string> {
  return editorState?.selectedKeyframeIds ?? new Set();
}

/**
 * Delete all selected keyframes
 */
export function deleteSelectedKeyframes(): void {
  if (!editorState) return;

  const idsToDelete = [...editorState.selectedKeyframeIds];
  for (const id of idsToDelete) {
    removeKeyframe(id);
  }
}

// ============================================================================
// Playback Control
// ============================================================================

/**
 * Start playback
 */
export function startPlayback(): void {
  if (editorState) {
    editorState.isPlaying = true;
    editorState.lastFrameTime = performance.now();

    // Enable preview mode for the selected entity
    if (editorState.selectedEntity !== null) {
      setAnimationPreviewEntity(editorState.selectedEntity);
    }
  }
}

/**
 * Stop playback
 */
export function stopPlayback(): void {
  if (editorState) {
    editorState.isPlaying = false;
  }
}

/**
 * Toggle playback
 */
export function togglePlayback(): void {
  if (editorState) {
    if (editorState.isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }
}

/**
 * Set playhead time
 */
export function setPlayheadTime(time: number): void {
  if (editorState) {
    editorState.playheadTime = Math.max(0, Math.min(1, time));
  }
}

/**
 * Go to start of animation
 */
export function goToStart(): void {
  setPlayheadTime(0);
  stopPlayback();
}

/**
 * Go to end of animation
 */
export function goToEnd(): void {
  setPlayheadTime(1);
  stopPlayback();
}

/**
 * Go to next keyframe from current position
 */
export function goToNextKeyframe(): void {
  if (!editorState) return;

  const currentTime = editorState.playheadTime;
  let nextTime = 1;

  for (const track of editorState.tracks) {
    for (const kf of track.keyframes) {
      if (kf.time > currentTime + 0.0001 && kf.time < nextTime) {
        nextTime = kf.time;
      }
    }
  }

  setPlayheadTime(nextTime);
}

/**
 * Go to previous keyframe from current position
 */
export function goToPreviousKeyframe(): void {
  if (!editorState) return;

  const currentTime = editorState.playheadTime;
  let prevTime = 0;

  for (const track of editorState.tracks) {
    for (const kf of track.keyframes) {
      if (kf.time < currentTime - 0.0001 && kf.time > prevTime) {
        prevTime = kf.time;
      }
    }
  }

  setPlayheadTime(prevTime);
}

/**
 * Update playback (call each frame)
 *
 * This updates the playhead time and syncs with the AnimationController
 * for preview mode. The actual animation application is handled by
 * the animation system running in preview mode.
 *
 * IMPORTANT: Only syncs preview to controller when the editor is focused.
 * When unfocused, the entity's normal animation should play instead.
 */
export function updatePlayback(commands?: Command): void {
  if (!editorState) return;

  // Only sync preview clip when the editor is focused
  // This prevents the editor from stealing control of the AnimationController when unfocused
  if (commands && editorState.selectedEntity !== null && previewClip && editorState.isEditorFocused) {
    syncPreviewToController(commands);
  }

  if (!editorState.isPlaying) return;

  const now = performance.now();
  const deltaMs = now - editorState.lastFrameTime;
  editorState.lastFrameTime = now;

  const deltaSeconds = deltaMs / 1000;
  const normalizedDelta = (deltaSeconds / editorState.duration) * editorState.speed;

  editorState.playheadTime += normalizedDelta;

  // Handle loop modes
  if (editorState.playheadTime >= 1) {
    switch (editorState.loopMode) {
      case LoopMode.Once:
        editorState.playheadTime = 1;
        editorState.isPlaying = false;
        break;
      case LoopMode.Loop:
        editorState.playheadTime = editorState.playheadTime % 1;
        break;
      case LoopMode.PingPong:
        editorState.playheadTime = 1 - (editorState.playheadTime - 1);
        break;
    }
  }
}

// ============================================================================
// Preview Clip Management
// ============================================================================

/**
 * Rebuild the preview AnimationClip from the current editor state.
 * This is called whenever the editor state changes.
 */
function rebuildPreviewClip(): void {
  if (!editorState) {
    previewClip = null;
    return;
  }

  const clip = AnimationClip.create('__editor_preview__')
    .setDuration(editorState.duration)
    .setLoopMode(editorState.loopMode)
    .setSpeed(editorState.speed);

  for (const editorTrack of editorState.tracks) {
    const track = new PropertyTrack<unknown>(editorTrack.fullPropertyPath);

    for (const kf of editorTrack.keyframes) {
      const easing = getEasingFunction(kf.easingName);
      track.keyframe(kf.time, kf.value, easing);
    }

    clip.addTrack(track);
  }

  previewClip = clip;
}

/**
 * Sync the preview clip state to the entity's AnimationController.
 * This allows the animation system to apply the animation during preview.
 */
function syncPreviewToController(commands: Command): void {
  if (!editorState || !editorState.selectedEntity || !previewClip) return;

  const controller = commands.tryGetComponent(editorState.selectedEntity, AnimationController);
  if (!controller) return;

  // Set the preview clip's time based on playhead
  // The animation system will evaluate at this time
  controller.currentTime = editorState.playheadTime * editorState.duration;
  controller.isPlaying = editorState.isPlaying;
  controller.speed = editorState.speed;

  // Store the preview clip for the animation system to use
  // We use a special approach: set currentAnimationId and provide the clip via loadedClips
  controller.currentAnimationId = '__editor_preview__';

  // The animation system will look for this clip in loadedClips
  if (!controller.loadedClips) {
    controller.loadedClips = new Map();
  }
  controller.loadedClips.set('__editor_preview__', previewClip);
}

/**
 * Get the current preview clip (for external use)
 */
export function getPreviewClip(): AnimationClip | null {
  return previewClip;
}

// ============================================================================
// Focus-Based Preview Control
// ============================================================================

/**
 * Called when the animation editor window gains focus.
 * Stores the current animation ID and enables preview mode.
 */
export function onEditorFocus(commands: Command): void {
  if (!editorState) return;

  editorState.isEditorFocused = true;

  // If we have a selected entity, store its current animation and switch to preview
  if (editorState.selectedEntity !== null) {
    const controller = commands.tryGetComponent(editorState.selectedEntity, AnimationController);
    if (controller) {
      // Only store if it's not already the preview animation AND we don't already have a stored value
      // This prevents overwriting the original animation ID when rapidly focusing/unfocusing
      if (controller.currentAnimationId !== '__editor_preview__' && editorState.previousAnimationId === null) {
        editorState.previousAnimationId = controller.currentAnimationId;
      }
      // Enable preview mode
      setAnimationPreviewEntity(editorState.selectedEntity);
      rebuildPreviewClip();
    }
  }
}

/**
 * Called when the animation editor window loses focus.
 * Restores the previous animation state.
 */
export function onEditorUnfocus(commands: Command): void {
  if (!editorState) return;

  editorState.isEditorFocused = false;

  // Stop playback when losing focus
  editorState.isPlaying = false;

  // Restore the previous animation state
  if (editorState.selectedEntity !== null) {
    const controller = commands.tryGetComponent(editorState.selectedEntity, AnimationController);
    if (controller) {
      // Remove the preview clip from loadedClips
      if (controller.loadedClips) {
        controller.loadedClips.delete('__editor_preview__');
      }

      // Only restore if we have a previous animation ID to restore to
      // If previousAnimationId is null, we need to figure out the correct animation:
      // 1. If controller already has a non-preview animation set, keep it
      // 2. Otherwise, leave it as null (no animation)
      if (editorState.previousAnimationId !== null) {
        controller.currentAnimationId = editorState.previousAnimationId;

        // If there was a previous animation and playOnStart is true, resume playback
        if (controller.playOnStart) {
          controller.isPlaying = true;
          controller.currentTime = 0;
        } else {
          controller.isPlaying = false;
        }
      } else if (controller.currentAnimationId === '__editor_preview__') {
        // Was previewing but no previous animation stored - clear the preview
        controller.currentAnimationId = null;
        controller.isPlaying = false;
      }
      // Else: controller has a non-preview animation ID, keep it as-is

      // Clear the stored previous animation ID so next focus stores fresh
      editorState.previousAnimationId = null;
    }

    // Clear the preview entity
    setAnimationPreviewEntity(null);
  }
}

/**
 * Update focus state - call each frame with the current focus state.
 * Handles transitions between focused and unfocused states.
 */
export function updateFocusState(isFocused: boolean, commands: Command): void {
  if (!editorState) return;

  const wasFocused = editorState.isEditorFocused;

  if (isFocused && !wasFocused) {
    // Transitioning from unfocused to focused
    onEditorFocus(commands);
  } else if (!isFocused && wasFocused) {
    // Transitioning from focused to unfocused
    onEditorUnfocus(commands);
  }
}

/**
 * Check if the editor is currently focused
 */
export function isEditorFocused(): boolean {
  return editorState?.isEditorFocused ?? false;
}

/**
 * Get the previous animation ID (before preview started)
 */
export function getPreviousAnimationId(): string | null {
  return editorState?.previousAnimationId ?? null;
}

// ============================================================================
// Keyframe Inspector
// ============================================================================

/**
 * Open the keyframe inspector for a specific keyframe
 */
export function openKeyframeInspector(keyframeId: string): void {
  if (editorState) {
    editorState.inspectorKeyframeId = keyframeId;
  }
}

/**
 * Close the keyframe inspector
 */
export function closeKeyframeInspector(): void {
  if (editorState) {
    editorState.inspectorKeyframeId = null;
  }
}

/**
 * Alias for closeKeyframeInspector
 */
export function clearInspectorKeyframe(): void {
  closeKeyframeInspector();
}

/**
 * Get the currently inspected keyframe ID
 */
export function getInspectorKeyframeId(): string | null {
  return editorState?.inspectorKeyframeId ?? null;
}

// ============================================================================
// Zoom and Scroll
// ============================================================================

/**
 * Set timeline zoom level
 */
export function setZoomLevel(zoom: number): void {
  if (editorState) {
    editorState.zoomLevel = Math.max(0.5, Math.min(4, zoom));
  }
}

/**
 * Set timeline scroll position
 */
export function setScrollX(scroll: number): void {
  if (editorState) {
    editorState.scrollX = Math.max(0, scroll);
  }
}

// ============================================================================
// State Loading
// ============================================================================

/**
 * Load a new animation state.
 * Preserves the currently selected entity so users don't have to re-select it.
 */
export function loadState(state: AnimationEditorState): void {
  // Preserve the selected entity and focus state from the current state
  const previousSelectedEntity = editorState?.selectedEntity ?? null;
  const previousIsEditorFocused = editorState?.isEditorFocused ?? false;
  const previousPreviousAnimationId = editorState?.previousAnimationId ?? null;

  // Clear any existing preview temporarily
  if (previousSelectedEntity !== null) {
    setAnimationPreviewEntity(null);
  }

  // Load the new state but preserve entity selection
  editorState = {
    ...state,
    selectedEntity: previousSelectedEntity,
    isEditorFocused: previousIsEditorFocused,
    previousAnimationId: previousPreviousAnimationId,
  };

  // Re-establish preview if entity was selected
  if (previousSelectedEntity !== null) {
    setAnimationPreviewEntity(previousSelectedEntity);
  }

  rebuildPreviewClip();
}

/**
 * Get raw state for serialization
 */
export function getRawState(): AnimationEditorState | null {
  return editorState;
}

// ============================================================================
// Preview Panel
// ============================================================================

/**
 * Set the texture GUID for the preview panel
 */
export function setPreviewTextureGuid(guid: string | null): void {
  if (editorState) {
    editorState.previewTextureGuid = guid;
  }
}

/**
 * Get the current preview texture GUID
 */
export function getPreviewTextureGuid(): string | null {
  return editorState?.previewTextureGuid ?? null;
}

/**
 * Evaluate the animation at a specific time and return all track values.
 * Uses the preview clip for evaluation.
 */
export function evaluateAnimationAtTime(time: number): Map<string, TrackValue> {
  if (!previewClip) return new Map();
  return previewClip.evaluate(time);
}

/**
 * Auto-detect the best texture to use for preview based on current tracks.
 * Looks for sprite tracks and tries to find associated textures.
 */
export function autoDetectPreviewTexture(): string | null {
  if (!editorState) return null;

  // Check if we have sprite tracks
  for (const track of editorState.tracks) {
    if (track.fullPropertyPath.includes('sprite') || track.fullPropertyPath.endsWith('.sprite')) {
      // Look for textureGuid in sprite keyframes
      for (const kf of track.keyframes) {
        const spriteValue = kf.value as SpriteValue;
        if (spriteValue && spriteValue.textureGuid) {
          return spriteValue.textureGuid;
        }
      }
    }
  }

  return null;
}

// ============================================================================
// Deprecated/Removed Functions (kept for compatibility)
// ============================================================================

/**
 * @deprecated Use selectEntity() instead. Preview is now handled by the animation system.
 */
export function bindPreviewEntity(entity: Entity): void {
  selectEntity(entity);
}

/**
 * @deprecated Use selectEntity(null) instead. Preview is now handled by the animation system.
 */
export function unbindPreviewEntity(): void {
  selectEntity(null);
}

/**
 * @deprecated Use getSelectedEntity() instead.
 */
export function getPreviewEntity(): Entity | null {
  return getSelectedEntity();
}

/**
 * @deprecated Preview state is no longer used. Animation system handles preview.
 */
export function getPreviewState(): null {
  return null;
}
