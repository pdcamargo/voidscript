/**
 * Timeline Renderer
 *
 * Renders the timeline grid, keyframes, and playhead for the animation editor.
 */

import { ImGui, ImGuiImplWeb, ImTextureRef } from '@mori2003/jsimgui';
import type * as THREE from 'three';
import {
  type AnimationEditorState,
  type EditorTrack,
  type EditorKeyframe,
  selectKeyframe,
  toggleKeyframeSelection,
  clearKeyframeSelection,
  isKeyframeSelected,
  setPlayheadTime,
  addKeyframe,
  updateKeyframeTime,
  removeKeyframe,
} from './animation-editor-state.js';
import {
  COLORS,
  TRACK_ROW_HEIGHT,
  TIME_RULER_HEIGHT,
  KEYFRAME_SIZE,
  SPRITE_THUMBNAIL_SIZE,
  PLAYHEAD_LINE_WIDTH,
  MIN_TIMELINE_WIDTH,
} from './constants.js';
import { getDefaultValueForProperty } from './animation-serializer.js';
import type { SpriteValue } from '../../../animation/interpolation.js';
import { parsePropertyPath } from '../../../animation/property-path.js';
import type { KeyframeValue } from './animation-editor-state.js';

// ============================================================================
// Property Type Inference
// ============================================================================

type InferredPropertyType = 'number' | 'integer' | 'vector3' | 'color' | 'sprite';

/**
 * Infer the property type from a track's keyframe values or property path
 */
function inferPropertyType(track: { fullPropertyPath: string; keyframes: { value: KeyframeValue }[] }): InferredPropertyType {
  // First, try to infer from keyframe values
  if (track.keyframes.length > 0) {
    const value = track.keyframes[0]!.value;
    const inferred = inferTypeFromValue(value);
    if (inferred) return inferred;
  }

  // Fall back to inferring from property path
  const parsed = parsePropertyPath(track.fullPropertyPath);
  const propertyPath = parsed.propertyPath.toLowerCase();

  if (propertyPath === 'position' || propertyPath === 'rotation' || propertyPath === 'scale') {
    return 'vector3';
  }
  if (propertyPath === 'color') {
    return 'color';
  }
  if (propertyPath === 'sprite') {
    return 'sprite';
  }
  if (propertyPath === 'tileindex' || propertyPath === 'frameindex') {
    return 'integer';
  }

  return 'number';
}

/**
 * Infer property type from a keyframe value
 */
function inferTypeFromValue(value: KeyframeValue): InferredPropertyType | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return 'number';
  }

  if (typeof value === 'object') {
    if ('x' in value && 'y' in value && 'z' in value) {
      return 'vector3';
    }
    if ('r' in value && 'g' in value && 'b' in value && 'a' in value) {
      return 'color';
    }
    if ('spriteId' in value) {
      return 'sprite';
    }
  }

  return null;
}

// ============================================================================
// Texture Cache for Sprite Thumbnails
// ============================================================================

interface TextureCacheEntry {
  textureId: bigint;
  lastAccessed: number;
}

const textureCache = new Map<string, TextureCacheEntry>();
const CACHE_CLEANUP_INTERVAL = 60000; // 1 minute
let lastCacheCleanup = 0;

function cleanupTextureCache(): void {
  const now = Date.now();
  if (now - lastCacheCleanup < CACHE_CLEANUP_INTERVAL) return;

  lastCacheCleanup = now;
  const expireTime = now - CACHE_CLEANUP_INTERVAL * 2;

  for (const [key, entry] of textureCache.entries()) {
    if (entry.lastAccessed < expireTime) {
      textureCache.delete(key);
    }
  }
}

// ============================================================================
// Drag State
// ============================================================================

interface DragState {
  isDragging: boolean;
  draggedKeyframeIds: Set<string>;
  dragStartX: number;
  dragStartTime: number;
}

const dragState: DragState = {
  isDragging: false,
  draggedKeyframeIds: new Set(),
  dragStartX: 0,
  dragStartTime: 0,
};

// ============================================================================
// Main Timeline Rendering
// ============================================================================

/**
 * Render the timeline (right side of animation editor)
 */
export function renderTimeline(
  state: AnimationEditorState,
  availableWidth: number,
  availableHeight: number,
  renderer?: { getThreeRenderer: () => THREE.WebGLRenderer }
): void {
  const timelineWidth = Math.max(MIN_TIMELINE_WIDTH, availableWidth);

  // Use the passed width instead of 0 (which would take all remaining space)
  // This leaves room for the preview panel on the right
  ImGui.BeginChild('##Timeline', { x: availableWidth, y: availableHeight }, 0, ImGui.WindowFlags.HorizontalScrollbar);

  // Get content region for calculations
  const contentWidth = timelineWidth * state.zoomLevel;

  // Time ruler at top
  renderTimeRuler(state, contentWidth);

  // Track rows with keyframes
  const trackAreaHeight = availableHeight - TIME_RULER_HEIGHT;
  renderTrackRows(state, contentWidth, trackAreaHeight, renderer);

  // Playhead (render on top)
  renderPlayhead(state, contentWidth, availableHeight);

  // Handle drag state
  handleKeyframeDrag(state, contentWidth);

  // Cleanup old texture cache entries
  cleanupTextureCache();

  ImGui.EndChild();
}

// ============================================================================
// Time Ruler
// ============================================================================

function renderTimeRuler(state: AnimationEditorState, width: number): void {
  const height = TIME_RULER_HEIGHT;

  // Background
  ImGui.PushStyleColorImVec4(ImGui.Col.Button, COLORS.timeRulerBackground);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, COLORS.timeRulerBackground);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, COLORS.timeRulerBackground);

  // Invisible button for click-to-seek
  ImGui.SetCursorPos({ x: 0, y: 0 });
  if (ImGui.InvisibleButton('##timeRulerClick', { x: width, y: height })) {
    // Click to move playhead
    const io = ImGui.GetIO();
    const cursorX = ImGui.GetCursorPosX();
    // Approximate click position (this is relative to the scroll position)
    const clickX = io.MousePos.x - cursorX + ImGui.GetScrollX();
    const newTime = clickX / width;
    setPlayheadTime(Math.max(0, Math.min(1, newTime)));
  }

  // Draw background
  ImGui.SetCursorPos({ x: 0, y: 0 });
  ImGui.Button('##timeRulerBg', { x: width, y: height });

  ImGui.PopStyleColor(3);

  // Time markers
  const divisions = Math.ceil(10 * state.zoomLevel);
  for (let i = 0; i <= divisions; i++) {
    const t = i / divisions;
    const x = t * width;
    const timeText = (t * state.duration).toFixed(2);

    ImGui.SetCursorPos({ x: x + 2, y: 4 });
    ImGui.TextDisabled(timeText);
  }

  // Separator line
  ImGui.SetCursorPos({ x: 0, y: height - 1 });
  ImGui.PushStyleColorImVec4(ImGui.Col.Button, COLORS.trackPanelDivider);
  ImGui.Button('##rulerSeparator', { x: width, y: 1 });
  ImGui.PopStyleColor();
}

// ============================================================================
// Track Rows
// ============================================================================

function renderTrackRows(
  state: AnimationEditorState,
  width: number,
  availableHeight: number,
  renderer?: { getThreeRenderer: () => THREE.WebGLRenderer }
): void {
  const startY = TIME_RULER_HEIGHT;

  for (let i = 0; i < state.tracks.length; i++) {
    const track = state.tracks[i]!;
    const y = startY + i * TRACK_ROW_HEIGHT;

    // Track row background (alternating)
    const bgColor = i % 2 === 0 ? COLORS.trackRowEven : COLORS.trackRowOdd;
    ImGui.SetCursorPos({ x: 0, y });
    ImGui.PushStyleColorImVec4(ImGui.Col.Button, bgColor);
    ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, bgColor);
    ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, bgColor);
    ImGui.Button(`##trackRowBg_${track.id}`, { x: width, y: TRACK_ROW_HEIGHT });
    ImGui.PopStyleColor(3);

    // Click on empty area to add keyframe at that time
    if (ImGui.IsItemClicked() && !ImGui.GetIO().KeyShift) {
      const io = ImGui.GetIO();
      const clickX = io.MousePos.x - ImGui.GetCursorPosX() + width * state.scrollX;
      const clickTime = clickX / width;
      // Only add if not clicking on an existing keyframe
      const clickedOnKeyframe = track.keyframes.some(kf => {
        const kfX = kf.time * width;
        return Math.abs(clickX - kfX) < KEYFRAME_SIZE;
      });
      if (!clickedOnKeyframe) {
        clearKeyframeSelection();
        // Double-click to add keyframe
        if (ImGui.IsMouseDoubleClicked(0)) {
          const newKf = addKeyframe(track.id, clickTime, getDefaultValueForProperty(track.fullPropertyPath));
          if (newKf) {
            selectKeyframe(newKf.id);
          }
        }
      }
    }

    // Render keyframes for this track
    renderTrackKeyframes(state, track, y, width, renderer);
  }
}

// ============================================================================
// Keyframes
// ============================================================================

function renderTrackKeyframes(
  state: AnimationEditorState,
  track: EditorTrack,
  y: number,
  width: number,
  renderer?: { getThreeRenderer: () => THREE.WebGLRenderer }
): void {
  const centerY = y + TRACK_ROW_HEIGHT / 2;

  // Infer property type once for the track
  const propertyType = inferPropertyType(track);

  for (const keyframe of track.keyframes) {
    const x = keyframe.time * width;
    const isSelected = isKeyframeSelected(keyframe.id);

    // Determine if this is a sprite-type keyframe that should show thumbnail
    const showThumbnail = (propertyType === 'sprite' || propertyType === 'integer') && renderer;

    if (showThumbnail && propertyType === 'sprite') {
      renderSpriteThumbnailKeyframe(state, track, keyframe, x, centerY, isSelected, renderer);
    } else {
      renderDiamondKeyframe(state, track, keyframe, x, centerY, isSelected);
    }
  }
}

function renderDiamondKeyframe(
  state: AnimationEditorState,
  track: EditorTrack,
  keyframe: EditorKeyframe,
  x: number,
  centerY: number,
  isSelected: boolean
): void {
  const size = KEYFRAME_SIZE;
  const halfSize = size / 2;

  // Position the keyframe
  ImGui.SetCursorPos({ x: x - halfSize, y: centerY - halfSize });

  // Choose color based on selection
  let color = isSelected ? COLORS.keyframeSelected : COLORS.keyframeNormal;

  ImGui.PushStyleColorImVec4(ImGui.Col.Button, color);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, COLORS.keyframeHovered);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, COLORS.keyframeSelected);

  // Diamond shape via rotated button (approximation using small square)
  ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 2);

  const buttonId = `##kf_${keyframe.id}`;
  const clicked = ImGui.Button(buttonId, { x: size, y: size });

  ImGui.PopStyleVar();
  ImGui.PopStyleColor(3);

  // Handle interactions
  handleKeyframeInteraction(state, track, keyframe, clicked);
}

function renderSpriteThumbnailKeyframe(
  state: AnimationEditorState,
  track: EditorTrack,
  keyframe: EditorKeyframe,
  x: number,
  centerY: number,
  isSelected: boolean,
  renderer?: { getThreeRenderer: () => THREE.WebGLRenderer }
): void {
  const size = SPRITE_THUMBNAIL_SIZE;
  const halfSize = size / 2;

  // Position the keyframe
  ImGui.SetCursorPos({ x: x - halfSize, y: centerY - halfSize });

  // Background/border based on selection
  const borderColor = isSelected ? COLORS.keyframeSelected : COLORS.keyframeNormal;

  ImGui.PushStyleColorImVec4(ImGui.Col.Button, borderColor);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, COLORS.keyframeHovered);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, COLORS.keyframeSelected);

  const buttonId = `##kfSprite_${keyframe.id}`;
  const clicked = ImGui.Button(buttonId, { x: size, y: size });

  ImGui.PopStyleColor(3);

  // TODO: Render actual sprite thumbnail on top
  // For now, we show the sprite ID as text
  const spriteValue = keyframe.value as SpriteValue;
  if (spriteValue.spriteId) {
    ImGui.SetCursorPos({ x: x - halfSize + 2, y: centerY - halfSize + 2 });
    ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: 1, y: 1, z: 1, w: 0.8 });
    ImGui.Text(spriteValue.spriteId.substring(0, 3));
    ImGui.PopStyleColor();
  }

  // Handle interactions
  handleKeyframeInteraction(state, track, keyframe, clicked);
}

function handleKeyframeInteraction(
  state: AnimationEditorState,
  track: EditorTrack,
  keyframe: EditorKeyframe,
  clicked: boolean
): void {
  const io = ImGui.GetIO();

  // Single click behavior
  if (clicked) {
    if (io.KeyShift) {
      // Shift+click: Add to selection
      selectKeyframe(keyframe.id, true);
    } else if (io.KeyCtrl || io.KeySuper) {
      // Ctrl/Cmd+click: Toggle selection
      toggleKeyframeSelection(keyframe.id);
    } else {
      // Plain click: Select keyframe
      clearKeyframeSelection();
      selectKeyframe(keyframe.id);
    }
  }

  // Start drag on mouse down
  if (ImGui.IsItemActive() && ImGui.IsMouseDragging(0, 2.0)) {
    if (!dragState.isDragging) {
      startKeyframeDrag(state, keyframe);
    }
  }

  // Context menu
  if (ImGui.BeginPopupContextItem(`##kfContext_${keyframe.id}`)) {
    renderKeyframeContextMenu(state, track, keyframe);
    ImGui.EndPopup();
  }
}

// ============================================================================
// Keyframe Drag
// ============================================================================

function startKeyframeDrag(state: AnimationEditorState, keyframe: EditorKeyframe): void {
  dragState.isDragging = true;
  dragState.dragStartX = ImGui.GetIO().MousePos.x;
  dragState.dragStartTime = keyframe.time;

  // If dragged keyframe is not selected, select only it
  if (!isKeyframeSelected(keyframe.id)) {
    clearKeyframeSelection();
    selectKeyframe(keyframe.id);
  }

  // Drag all selected keyframes
  dragState.draggedKeyframeIds = new Set(state.selectedKeyframeIds);
}

function handleKeyframeDrag(state: AnimationEditorState, timelineWidth: number): void {
  if (!dragState.isDragging) return;

  const io = ImGui.GetIO();

  if (ImGui.IsMouseDown(0)) {
    // Calculate delta
    const deltaX = io.MousePos.x - dragState.dragStartX;
    const deltaTime = deltaX / timelineWidth;

    // Update all dragged keyframes
    for (const kfId of dragState.draggedKeyframeIds) {
      // Find original time for this keyframe (stored when drag started)
      // For simplicity, we'll just apply delta from current position
      // A more robust solution would store original times
      const kf = state.tracks.flatMap(t => t.keyframes).find(k => k.id === kfId);
      if (kf) {
        const originalTime = dragState.dragStartTime;
        const newTime = Math.max(0, Math.min(1, originalTime + deltaTime));
        kf.time = newTime;
      }
    }
  } else {
    // End drag
    endKeyframeDrag(state);
  }
}

function endKeyframeDrag(state: AnimationEditorState): void {
  if (!dragState.isDragging) return;

  dragState.isDragging = false;
  dragState.draggedKeyframeIds.clear();

  // Sort all keyframes after drag
  const { sortAllKeyframes, markDirty } = require('./animation-editor-state.js');
  sortAllKeyframes();
  markDirty();
}

// ============================================================================
// Keyframe Context Menu
// ============================================================================

function renderKeyframeContextMenu(
  state: AnimationEditorState,
  track: EditorTrack,
  keyframe: EditorKeyframe
): void {
  ImGui.TextDisabled(`Time: ${(keyframe.time * state.duration).toFixed(3)}s`);
  ImGui.Separator();

  if (ImGui.MenuItem('Edit Value...')) {
    // Select the keyframe - Inspector will show keyframe editor when keyframe is selected
    clearKeyframeSelection();
    selectKeyframe(keyframe.id);
  }

  if (ImGui.MenuItem('Duplicate')) {
    const newKf = addKeyframe(track.id, keyframe.time + 0.05, structuredClone(keyframe.value), keyframe.easingName);
    if (newKf) {
      clearKeyframeSelection();
      selectKeyframe(newKf.id);
    }
  }

  ImGui.Separator();

  ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: 0.9, y: 0.3, z: 0.3, w: 1.0 });
  if (ImGui.MenuItem('Delete')) {
    removeKeyframe(keyframe.id);
  }
  ImGui.PopStyleColor();
}

// ============================================================================
// Playhead
// ============================================================================

function renderPlayhead(state: AnimationEditorState, width: number, height: number): void {
  const x = state.playheadTime * width;

  // Playhead line (vertical bar)
  ImGui.SetCursorPos({ x: x - PLAYHEAD_LINE_WIDTH / 2, y: 0 });
  ImGui.PushStyleColorImVec4(ImGui.Col.Button, COLORS.playhead);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, COLORS.playhead);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, COLORS.playhead);
  ImGui.Button('##playheadLine', { x: PLAYHEAD_LINE_WIDTH, y: height });
  ImGui.PopStyleColor(3);

  // Playhead handle at top (draggable)
  const handleSize = 10;
  ImGui.SetCursorPos({ x: x - handleSize / 2, y: 2 });

  ImGui.PushStyleColorImVec4(ImGui.Col.Button, COLORS.playheadHandle);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, { x: 1.0, y: 0.4, z: 0.4, w: 1.0 });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, { x: 1.0, y: 0.5, z: 0.5, w: 1.0 });

  ImGui.Button('##playheadHandle', { x: handleSize, y: handleSize });

  if (ImGui.IsItemActive()) {
    const io = ImGui.GetIO();
    const newX = io.MousePos.x - ImGui.GetCursorPosX() + ImGui.GetScrollX();
    const newTime = newX / width;
    setPlayheadTime(Math.max(0, Math.min(1, newTime)));
  }

  ImGui.PopStyleColor(3);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert pixel position to normalized time
 */
export function pixelToTime(pixel: number, width: number): number {
  return pixel / width;
}

/**
 * Convert normalized time to pixel position
 */
export function timeToPixel(time: number, width: number): number {
  return time * width;
}
