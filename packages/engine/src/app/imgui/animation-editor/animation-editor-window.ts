/**
 * Animation Editor Window
 *
 * Main window for the animation editor, combining the toolbar, track panel,
 * timeline, and keyframe inspector into a complete editing interface.
 *
 * Requires entity selection before showing the main editor UI.
 * Only entities with AnimationController component are shown in the picker.
 */

import { ImGui } from '@mori2003/jsimgui';
import type * as THREE from 'three';
import { LoopMode } from '../../../animation/animation-clip.js';
import type { Entity } from '../../../ecs/entity.js';
import type { EditorPlatform } from '../../../editor/editor-platform.js';
import { AssetDatabase } from '../../../ecs/asset-database.js';
import { AssetType } from '../../../ecs/asset-metadata.js';
import {
  getAnimationEditorState,
  isAnimationEditorOpen,
  closeAnimationEditor,
  createNewAnimation,
  setCurrentFilePath,
  markClean,
  markDirty,
  getCachedFilePath,
  startPlayback,
  stopPlayback,
  togglePlayback,
  updatePlayback,
  goToStart,
  goToEnd,
  goToNextKeyframe,
  goToPreviousKeyframe,
  selectEntity,
  getSelectedEntity,
  addKeyframe,
  selectKeyframe,
  selectTrack,
} from './animation-editor-state.js';
import {
  loadAnimationFromJson,
  serializeCurrentState,
  jsonToEditorState,
  editorStateToJson,
  getDefaultValueForProperty,
} from './animation-serializer.js';
import { renderTrackPanel } from './track-panel.js';
import { renderTimeline } from './timeline-renderer.js';
import {
  COLORS,
  TRACK_PANEL_WIDTH,
  TOOLBAR_HEIGHT,
  PLAYBACK_CONTROLS_HEIGHT,
  LOOP_MODE_LABELS,
} from './constants.js';

// ============================================================================
// Main Window Rendering
// ============================================================================

import type { World } from '../../../ecs/world.js';
import type { Command } from '../../../ecs/command.js';

// Module-level state to pass assetsManifest to async handlers
let currentAssetsManifest: string | undefined;

/**
 * Render the animation editor window
 *
 * @param platform - Editor platform for file dialogs
 * @param renderer - Optional renderer for sprite previews
 * @param getEntitiesWithAnimationController - Callback to get entities with AnimationController.
 *        This should be filtered to only return entities that have the AnimationController component.
 * @param world - Optional world for keyframe inspector
 * @param commands - Optional ECS commands for syncing preview to AnimationController
 * @param assetsManifest - Path to the assets manifest file for auto-registration
 */
export function renderAnimationEditorWindow(
  platform: EditorPlatform,
  renderer?: { getThreeRenderer: () => THREE.WebGLRenderer },
  getEntitiesWithAnimationController?: () => Array<{ entity: Entity; name: string }>,
  world?: World,
  commands?: Command,
  assetsManifest?: string,
): void {
  // Store for async handlers
  currentAssetsManifest = assetsManifest;
  if (!isAnimationEditorOpen()) return;

  const state = getAnimationEditorState();
  if (!state) return;

  // Update playback and apply preview to entity
  updatePlayback(commands);

  // Window title with dirty indicator
  const dirtyMarker = state.isDirty ? '*' : '';
  const fileName = state.currentFilePath?.split('/').pop() ?? 'Untitled';
  const windowTitle = `Animation Editor - ${fileName}${dirtyMarker}###AnimationEditor`;

  // Window size constraints
  ImGui.SetNextWindowSize({ x: 900, y: 600 }, ImGui.Cond.FirstUseEver);

  const isOpenRef: [boolean] = [true];
  const windowFlags = ImGui.WindowFlags.MenuBar;

  if (ImGui.Begin(windowTitle, isOpenRef, windowFlags)) {
    // Menu bar
    renderMenuBar(platform, state);

    // Check if entity is selected - show entity selector first if not
    if (state.selectedEntity === null) {
      renderEntitySelector(getEntitiesWithAnimationController);
    } else {
      // Toolbar with entity info
      renderToolbar(state, getEntitiesWithAnimationController);

      // Main content area
      const contentHeight = ImGui.GetWindowHeight() - TOOLBAR_HEIGHT - PLAYBACK_CONTROLS_HEIGHT - 60;

      ImGui.BeginChild('##AnimEditorContent', { x: 0, y: contentHeight }, 0, ImGui.WindowFlags.None);

      // Split layout: Track Panel | Timeline (no preview panel - preview happens on actual entity in scene)
      renderTrackPanel(state, contentHeight, world);
      ImGui.SameLine();

      // Timeline takes remaining width
      const timelineWidth = ImGui.GetWindowWidth() - TRACK_PANEL_WIDTH - 20;
      renderTimeline(state, timelineWidth, contentHeight, renderer);

      ImGui.EndChild();

      // Playback controls at bottom
      renderPlaybackControls(state);
    }
  }
  ImGui.End();

  // Close window if X was clicked
  if (!isOpenRef[0]) {
    closeAnimationEditor();
  }
}

// ============================================================================
// Entity Selector (shown when no entity is selected)
// ============================================================================

/**
 * Render entity selector UI when no entity is selected.
 * Only shows entities with AnimationController component.
 */
function renderEntitySelector(
  getEntitiesWithAnimationController?: () => Array<{ entity: Entity; name: string }>,
): void {
  const availableHeight = ImGui.GetWindowHeight() - 40;
  const availableWidth = ImGui.GetWindowWidth();

  ImGui.BeginChild('##EntitySelector', { x: 0, y: availableHeight }, 0, ImGui.WindowFlags.None);

  // Center the content
  const contentWidth = 400;
  const offsetX = (availableWidth - contentWidth) / 2;
  ImGui.SetCursorPosX(offsetX > 0 ? offsetX : 10);
  ImGui.SetCursorPosY(50);

  // Header
  ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: 0.9, y: 0.9, z: 0.9, w: 1.0 });
  ImGui.Text('Select Entity to Animate');
  ImGui.PopStyleColor();

  ImGui.SetCursorPosX(offsetX > 0 ? offsetX : 10);
  ImGui.TextDisabled('Only entities with AnimationController are shown.');

  ImGui.Spacing();
  ImGui.Spacing();

  // Entity list
  ImGui.SetCursorPosX(offsetX > 0 ? offsetX : 10);

  if (!getEntitiesWithAnimationController) {
    ImGui.TextDisabled('No entity callback provided.');
    ImGui.EndChild();
    return;
  }

  const entities = getEntitiesWithAnimationController();

  if (entities.length === 0) {
    ImGui.TextDisabled('No entities with AnimationController found.');
    ImGui.Spacing();
    ImGui.SetCursorPosX(offsetX > 0 ? offsetX : 10);
    ImGui.TextDisabled('Add an AnimationController component to an entity first.');
  } else {
    ImGui.PushStyleColorImVec4(ImGui.Col.ChildBg, { x: 0.12, y: 0.12, z: 0.14, w: 1.0 });
    ImGui.BeginChild('##EntityList', { x: contentWidth, y: Math.min(300, entities.length * 32 + 16) }, 1, ImGui.WindowFlags.None);

    for (const { entity, name } of entities) {
      const label = name || `Entity #${entity}`;

      ImGui.PushStyleColorImVec4(ImGui.Col.Button, COLORS.trackRowEven);
      ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, COLORS.trackRowHovered);
      ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, COLORS.trackRowSelected);

      if (ImGui.Button(label, { x: contentWidth - 16, y: 28 })) {
        selectEntity(entity);
      }

      ImGui.PopStyleColor(3);
    }

    ImGui.EndChild();
    ImGui.PopStyleColor();
  }

  ImGui.EndChild();
}

// ============================================================================
// Menu Bar
// ============================================================================

function renderMenuBar(platform: EditorPlatform, state: ReturnType<typeof getAnimationEditorState>): void {
  if (!state) return;

  if (ImGui.BeginMenuBar()) {
    if (ImGui.BeginMenu('File')) {
      if (ImGui.MenuItem('New', 'Ctrl+N')) {
        handleNewAnimation();
      }

      if (ImGui.MenuItem('Open...', 'Ctrl+O')) {
        handleOpenAnimation(platform);
      }

      ImGui.Separator();

      if (ImGui.MenuItem('Save', 'Ctrl+S', false, state.currentFilePath !== null)) {
        handleSaveAnimation(platform, false);
      }

      if (ImGui.MenuItem('Save As...', 'Ctrl+Shift+S')) {
        handleSaveAnimation(platform, true);
      }

      ImGui.Separator();

      if (ImGui.MenuItem('Close')) {
        closeAnimationEditor();
      }

      ImGui.EndMenu();
    }

    if (ImGui.BeginMenu('Edit')) {
      if (ImGui.MenuItem('Add Keyframe at Playhead', 'K')) {
        handleAddKeyframeAtPlayhead(state);
      }

      ImGui.Separator();

      if (ImGui.MenuItem('Go to Start', 'Home')) {
        goToStart();
      }

      if (ImGui.MenuItem('Go to End', 'End')) {
        goToEnd();
      }

      if (ImGui.MenuItem('Previous Keyframe', ',')) {
        goToPreviousKeyframe();
      }

      if (ImGui.MenuItem('Next Keyframe', '.')) {
        goToNextKeyframe();
      }

      ImGui.EndMenu();
    }

    ImGui.EndMenuBar();
  }
}

// ============================================================================
// Toolbar
// ============================================================================

function renderToolbar(
  state: ReturnType<typeof getAnimationEditorState>,
  getEntitiesWithAnimationController?: () => Array<{ entity: Entity; name: string }>
): void {
  if (!state) return;

  ImGui.PushStyleColorImVec4(ImGui.Col.ChildBg, { x: 0.15, y: 0.15, z: 0.17, w: 1.0 });
  ImGui.BeginChild('##Toolbar', { x: 0, y: TOOLBAR_HEIGHT }, 1, ImGui.WindowFlags.None);

  // Row 1: Entity selector and animation properties
  ImGui.SetCursorPos({ x: 8, y: 8 });

  // Current entity
  ImGui.Text('Entity:');
  ImGui.SameLine();
  const selectedEntity = getSelectedEntity();
  const entityLabel = selectedEntity !== null ? getEntityLabel(selectedEntity, getEntitiesWithAnimationController) : '(None)';

  ImGui.SetNextItemWidth(130);
  if (ImGui.BeginCombo('##selectedEntity', entityLabel)) {
    // Show available entities
    if (getEntitiesWithAnimationController) {
      const entities = getEntitiesWithAnimationController();
      for (const { entity, name } of entities) {
        const isSelected = selectedEntity === entity;
        const label = name || `Entity #${entity}`;
        if (ImGui.Selectable(label, isSelected)) {
          selectEntity(entity);
        }
      }
    }
    ImGui.EndCombo();
  }

  ImGui.SameLine(180);

  // Animation Name
  ImGui.Text('Name:');
  ImGui.SameLine();
  const nameBuffer: [string] = [state.animationName];
  ImGui.SetNextItemWidth(100);
  ImGui.InputText('##animName', nameBuffer, 64);
  if (nameBuffer[0] !== state.animationName) {
    state.animationName = nameBuffer[0];
    markDirty();
  }

  ImGui.SameLine();

  // Duration
  ImGui.Text('Duration:');
  ImGui.SameLine();
  const durationRef: [number] = [state.duration];
  ImGui.SetNextItemWidth(70);
  if (ImGui.DragFloat('##duration', durationRef, 0.01, 0.1, 60.0, '%.2fs')) {
    state.duration = Math.max(0.1, durationRef[0]);
    markDirty();
  }

  ImGui.SameLine();

  // Loop Mode
  ImGui.Text('Loop:');
  ImGui.SameLine();
  const loopModeValues = [LoopMode.Once, LoopMode.Loop, LoopMode.PingPong];
  const currentLoopIndex = loopModeValues.indexOf(state.loopMode);
  const loopIndex: [number] = [currentLoopIndex >= 0 ? currentLoopIndex : 0];
  ImGui.SetNextItemWidth(90);
  if (ImGui.Combo('##loopMode', loopIndex, LOOP_MODE_LABELS.join('\0') + '\0')) {
    state.loopMode = loopModeValues[loopIndex[0]] ?? LoopMode.Once;
    markDirty();
  }

  ImGui.SameLine();

  // Speed
  ImGui.Text('Speed:');
  ImGui.SameLine();
  const speedRef: [number] = [state.speed];
  ImGui.SetNextItemWidth(55);
  if (ImGui.DragFloat('##speed', speedRef, 0.01, 0.1, 10.0, '%.2f')) {
    state.speed = Math.max(0.1, speedRef[0]);
    markDirty();
  }

  // Row 2: Info about preview mode
  ImGui.SetCursorPos({ x: 8, y: 34 });
  ImGui.TextDisabled('Animation preview is applied directly to the selected entity in the scene.');

  ImGui.EndChild();
  ImGui.PopStyleColor();
}

/**
 * Get display label for an entity
 */
function getEntityLabel(
  entity: Entity,
  getEntitiesWithAnimationController?: () => Array<{ entity: Entity; name: string }>
): string {
  if (getEntitiesWithAnimationController) {
    const entities = getEntitiesWithAnimationController();
    const found = entities.find((e) => e.entity === entity);
    if (found && found.name) {
      return found.name;
    }
  }
  return `Entity #${entity}`;
}

// ============================================================================
// Playback Controls
// ============================================================================

function renderPlaybackControls(state: ReturnType<typeof getAnimationEditorState>): void {
  if (!state) return;

  ImGui.PushStyleColorImVec4(ImGui.Col.ChildBg, { x: 0.12, y: 0.12, z: 0.14, w: 1.0 });
  ImGui.BeginChild('##PlaybackControls', { x: 0, y: PLAYBACK_CONTROLS_HEIGHT }, 1, ImGui.WindowFlags.None);

  ImGui.SetCursorPos({ x: 8, y: 6 });

  // Go to start
  if (ImGui.Button('|<##goStart', { x: 24, y: 20 })) {
    goToStart();
  }
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip('Go to Start (Home)');
  }

  ImGui.SameLine();

  // Previous keyframe
  if (ImGui.Button('<##prevKf', { x: 24, y: 20 })) {
    goToPreviousKeyframe();
  }
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip('Previous Keyframe (,)');
  }

  ImGui.SameLine();

  // Play/Pause button
  const playLabel = state.isPlaying ? 'II##play' : '>##play';
  const playColor = state.isPlaying ? COLORS.playButtonPlaying : COLORS.playButtonStopped;

  ImGui.PushStyleColorImVec4(ImGui.Col.Button, playColor);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, {
    x: playColor.x + 0.1,
    y: playColor.y + 0.1,
    z: playColor.z + 0.1,
    w: 1.0,
  });

  if (ImGui.Button(playLabel, { x: 30, y: 20 })) {
    togglePlayback();
  }
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip(state.isPlaying ? 'Pause (Space)' : 'Play (Space)');
  }

  ImGui.PopStyleColor(2);

  ImGui.SameLine();

  // Stop button
  if (ImGui.Button('[]##stop', { x: 24, y: 20 })) {
    stopPlayback();
    goToStart();
  }
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip('Stop');
  }

  ImGui.SameLine();

  // Next keyframe
  if (ImGui.Button('>##nextKf', { x: 24, y: 20 })) {
    goToNextKeyframe();
  }
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip('Next Keyframe (.)');
  }

  ImGui.SameLine();

  // Go to end
  if (ImGui.Button('>|##goEnd', { x: 24, y: 20 })) {
    goToEnd();
  }
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip('Go to End (End)');
  }

  ImGui.SameLine(200);

  // Time display
  const timeInSeconds = state.playheadTime * state.duration;
  ImGui.Text(`Time: ${timeInSeconds.toFixed(2)}s / ${state.duration.toFixed(2)}s`);

  ImGui.SameLine();

  // Time slider
  ImGui.SetNextItemWidth(200);
  const timeRef: [number] = [state.playheadTime];
  if (ImGui.SliderFloat('##timeSlider', timeRef, 0.0, 1.0, '')) {
    state.playheadTime = timeRef[0];
  }

  // Add keyframe button (right side)
  const addKfButtonX = ImGui.GetWindowWidth() - 140;
  ImGui.SameLine(addKfButtonX);

  ImGui.PushStyleColorImVec4(ImGui.Col.Button, COLORS.buttonPrimary);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, COLORS.buttonPrimaryHovered);

  if (ImGui.Button('+ Add Keyframe', { x: 120, y: 20 })) {
    handleAddKeyframeAtPlayhead(state);
  }
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip('Add keyframe at current time (K)');
  }

  ImGui.PopStyleColor(2);

  ImGui.EndChild();
  ImGui.PopStyleColor();
}

// ============================================================================
// File Operations
// ============================================================================

function handleNewAnimation(): void {
  // TODO: Check for unsaved changes and prompt
  createNewAnimation();
}

async function handleOpenAnimation(platform: EditorPlatform): Promise<void> {
  try {
    const result = await platform.showOpenDialog({
      filters: [{ name: 'Animation Files', extensions: ['anim.json', 'json'] }],
    });

    if (result) {
      const filePath = Array.isArray(result) ? result[0] : result;
      if (filePath) {
        const content = await platform.readTextFile(filePath);

        // Try to find existing GUID for this file
        let assetGuid: string | null = null;
        const webPath = convertToWebPath(filePath, platform);
        if (webPath) {
          assetGuid = AssetDatabase.findByPath(webPath) ?? null;
        }

        loadAnimationFromJson(content, filePath, assetGuid);
      }
    }
  } catch (error) {
    console.error('Failed to open animation file:', error);
  }
}

async function handleSaveAnimation(platform: EditorPlatform, saveAs: boolean): Promise<void> {
  const state = getAnimationEditorState();
  if (!state) return;

  let filePath = state.currentFilePath;
  let assetGuid = state.assetGuid;

  // If Save As or no current path, show save dialog
  if (saveAs || !filePath) {
    try {
      const defaultName = `${state.animationId}.anim.json`;
      const result = await platform.showSaveDialog({
        defaultPath: defaultName,
        filters: [{ name: 'Animation Files', extensions: ['anim.json'] }],
      });

      if (!result) return; // User cancelled

      filePath = result;

      // If saving to a new path (Save As), need a new GUID
      if (saveAs) {
        assetGuid = null;
      }
    } catch (error) {
      console.error('Failed to show save dialog:', error);
      return;
    }
  }

  // Generate UUID for new assets
  if (!assetGuid) {
    assetGuid = crypto.randomUUID();
  }

  // Serialize and save animation file
  try {
    const jsonContent = serializeCurrentState(true);
    if (!jsonContent) {
      console.error('Failed to serialize animation state');
      return;
    }

    await platform.writeTextFile(filePath, jsonContent);
    setCurrentFilePath(filePath);

    // Update state with the GUID
    state.assetGuid = assetGuid;

    // Register in AssetDatabase and save manifest
    const webPath = convertToWebPath(filePath, platform);
    if (webPath) {
      // Check for existing registration at this path
      const existingGuid = AssetDatabase.findByPath(webPath);
      if (existingGuid && existingGuid !== assetGuid) {
        // Path already registered with different GUID, use existing
        assetGuid = existingGuid;
        state.assetGuid = assetGuid;
      }

      // Register the asset
      AssetDatabase.registerAdditionalAssets({
        [assetGuid]: {
          type: AssetType.Animation,
          path: webPath,
        },
      });

      // Save manifest if available
      await saveManifestIfAvailable(platform, currentAssetsManifest);
    }

    markClean();
  } catch (error) {
    console.error('Failed to save animation file:', error);
  }
}

function handleAddKeyframeAtPlayhead(state: ReturnType<typeof getAnimationEditorState>): void {
  if (!state) return;

  // Add to selected track, or first track if none selected
  const targetTrack = state.selectedTrackId
    ? state.tracks.find((t) => t.id === state.selectedTrackId)
    : state.tracks[0];

  if (!targetTrack) {
    // No tracks to add to
    return;
  }

  const newKf = addKeyframe(
    targetTrack.id,
    state.playheadTime,
    getDefaultValueForProperty(targetTrack.fullPropertyPath)
  );

  if (newKf) {
    selectKeyframe(newKf.id);
    if (!state.selectedTrackId) {
      selectTrack(targetTrack.id);
    }
  }
}

// ============================================================================
// Keyboard Shortcuts (to be called from editor layer)
// ============================================================================

/**
 * Handle keyboard shortcuts for the animation editor
 * Returns true if the shortcut was handled
 */
export function handleAnimationEditorShortcut(key: string, ctrl: boolean, shift: boolean): boolean {
  if (!isAnimationEditorOpen()) return false;

  const state = getAnimationEditorState();
  if (!state) return false;

  // Ctrl+N - New
  if (ctrl && !shift && key === 'n') {
    handleNewAnimation();
    return true;
  }

  // Ctrl+S - Save
  if (ctrl && !shift && key === 's') {
    // Note: This would need platform access, handle in editor layer
    return false;
  }

  // Space - Play/Pause
  if (key === ' ') {
    togglePlayback();
    return true;
  }

  // Home - Go to start
  if (key === 'Home') {
    goToStart();
    return true;
  }

  // End - Go to end
  if (key === 'End') {
    goToEnd();
    return true;
  }

  // Comma - Previous keyframe
  if (key === ',') {
    goToPreviousKeyframe();
    return true;
  }

  // Period - Next keyframe
  if (key === '.') {
    goToNextKeyframe();
    return true;
  }

  // K - Add keyframe
  if (key === 'k') {
    handleAddKeyframeAtPlayhead(state);
    return true;
  }

  return false;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert an absolute file path to a web-relative path.
 * Returns null if conversion is not possible.
 */
function convertToWebPath(absolutePath: string, platform: EditorPlatform): string | null {
  if (!platform.sourceAssetsDir) return null;
  if (!absolutePath.startsWith(platform.sourceAssetsDir)) return null;

  const relative = absolutePath.slice(platform.sourceAssetsDir.length);
  return relative.startsWith('/') ? relative : '/' + relative;
}

/**
 * Save the asset manifest if platform supports it.
 */
async function saveManifestIfAvailable(
  platform: EditorPlatform,
  assetsManifest?: string,
): Promise<void> {
  if (!assetsManifest || !platform.sourceAssetsDir || !platform.joinPath || !platform.writeTextFile) {
    return;
  }

  try {
    const manifestRelative = assetsManifest.startsWith('/')
      ? assetsManifest.slice(1)
      : assetsManifest;
    const manifestPath = await platform.joinPath(platform.sourceAssetsDir, manifestRelative);
    const json = AssetDatabase.serializeToJson(true);
    await platform.writeTextFile(manifestPath, json);
  } catch (error) {
    console.error('Failed to save manifest:', error);
  }
}
