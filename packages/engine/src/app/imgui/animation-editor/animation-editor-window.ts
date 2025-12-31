/**
 * Animation Editor Window
 *
 * Main window for the animation editor, combining the toolbar, track panel,
 * timeline, and keyframe inspector into a complete editing interface.
 *
 * Requires entity selection before showing the main editor UI.
 * Only entities with AnimationController component are shown in the picker.
 */

import { ImGui } from '@voidscript/imgui';
import type * as THREE from 'three';
import { AnimationClip, LoopMode } from '../../../animation/animation-clip.js';
import { PropertyTrack } from '../../../animation/property-track.js';
import { getEasingFunction } from '../../../animation/property-track.js';
import type { Entity } from '../../../ecs/entity.js';
import type { EditorPlatform } from '../../../editor/editor-platform.js';
import { AssetDatabase } from '../../../ecs/asset-database.js';
import { AssetType } from '../../../ecs/asset-metadata.js';
import { RuntimeAsset } from '../../../ecs/runtime-asset.js';
import { RuntimeAssetManager } from '../../../ecs/runtime-asset-manager.js';
import { AnimationController } from '../../../ecs/components/animation/animation-controller.js';
import { EditorLayout } from '../editor-layout.js';
import { EDITOR_ICONS } from '../editor-icons.js';
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
  updateFocusState,
  isEditorFocused as isEditorFocusedState,
  loadState,
  getRawState,
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

// Module-level state to pass context to async handlers
let currentAssetsManifest: string | undefined;
let currentCommands: Command | undefined;
let currentPlatform: EditorPlatform | undefined;

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
  currentCommands = commands;
  currentPlatform = platform;
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
    // Track window focus state for preview control
    if (commands) {
      const windowFocused = ImGui.IsWindowFocused(ImGui.FocusedFlags.RootAndChildWindows);
      updateFocusState(windowFocused, commands);
    }

    // Menu bar
    renderMenuBar(platform, state);

    // Check if entity is selected - show entity selector first if not
    if (state.selectedEntity === null) {
      renderEntitySelector(getEntitiesWithAnimationController, commands);
    } else {
      // Toolbar with entity info and animation selector
      renderToolbar(state, getEntitiesWithAnimationController, commands, platform);

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
  commands?: Command,
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
        selectEntity(entity, commands);
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

// Track pending save confirmation state
let pendingSaveConfirmPopupId: string | null = null;
let pendingAnimationToLoad: { asset: RuntimeAsset<AnimationClip>; filePath: string | null } | null = null;

function renderToolbar(
  state: ReturnType<typeof getAnimationEditorState>,
  getEntitiesWithAnimationController?: () => Array<{ entity: Entity; name: string }>,
  commands?: Command,
  platform?: EditorPlatform,
): void {
  if (!state) return;

  ImGui.PushStyleColorImVec4(ImGui.Col.ChildBg, { x: 0.15, y: 0.15, z: 0.17, w: 1.0 });
  ImGui.BeginChild('##Toolbar', { x: 0, y: TOOLBAR_HEIGHT }, 1, ImGui.WindowFlags.None);

  // Row 1: Entity selector and Animation selector
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
          selectEntity(entity, commands);
        }
      }
    }
    ImGui.EndCombo();
  }

  ImGui.SameLine(180);

  // Animation selector dropdown (from entity's AnimationController)
  ImGui.Text('Animation:');
  ImGui.SameLine();

  // Get animations from selected entity's AnimationController
  const animationOptions = getEntityAnimationOptions(selectedEntity, commands);
  const currentAnimId = state.animationId;

  // Find current animation label
  const currentAnimOption = animationOptions.find((opt) => opt.value === currentAnimId);
  const currentAnimLabel = currentAnimOption?.label ?? '(New Animation)';

  // Track if we need to open a popup after the combo closes
  // (ImGui.OpenPopup() doesn't work inside BeginCombo/EndCombo)
  let shouldOpenNewAnimPopup = false;
  let shouldOpenSwitchPopup = false;
  let switchToAsset: { asset: RuntimeAsset<AnimationClip>; filePath: string | null } | null = null;

  ImGui.SetNextItemWidth(150);
  if (ImGui.BeginCombo('##animationSelector', currentAnimLabel)) {
    // Option to create new animation
    if (ImGui.Selectable('+ New Animation', false)) {
      // Check if dirty and prompt save
      if (state.isDirty && platform) {
        shouldOpenNewAnimPopup = true;
      } else {
        handleNewAnimation();
      }
    }

    ImGui.Separator();

    // List existing animations
    for (const opt of animationOptions) {
      // Skip __editor_preview__
      if (opt.value === '__editor_preview__') continue;

      const isSelected = currentAnimId === opt.value;
      if (ImGui.Selectable(opt.label, isSelected)) {
        // Check if dirty and prompt save before switching
        if (state.isDirty && platform && opt.asset) {
          shouldOpenSwitchPopup = true;
          switchToAsset = { asset: opt.asset, filePath: opt.filePath ?? null };
        } else if (opt.asset) {
          loadAnimationFromAsset(opt.asset, opt.filePath ?? null, platform);
        }
      }
    }
    ImGui.EndCombo();
  }

  // Open popup after combo is closed (if needed)
  if (shouldOpenNewAnimPopup) {
    pendingSaveConfirmPopupId = 'SaveBeforeNew##animEditor';
    pendingAnimationToLoad = null;
    ImGui.OpenPopup(pendingSaveConfirmPopupId);
  } else if (shouldOpenSwitchPopup && switchToAsset) {
    pendingSaveConfirmPopupId = 'SaveBeforeSwitch##animEditor';
    pendingAnimationToLoad = switchToAsset;
    ImGui.OpenPopup(pendingSaveConfirmPopupId);
  }

  ImGui.SameLine();

  // New animation button (icon)
  if (EditorLayout.iconButton(EDITOR_ICONS.ADD, {
    size: 'small',
    tooltip: 'Create new animation',
    id: 'newAnim',
  })) {
    if (state.isDirty && platform) {
      pendingSaveConfirmPopupId = 'SaveBeforeNew##animEditor';
      pendingAnimationToLoad = null;
      ImGui.OpenPopup(pendingSaveConfirmPopupId);
    } else {
      handleNewAnimation();
    }
  }

  ImGui.SameLine(420);

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

  // Row 2: Loop mode, speed, and info
  ImGui.SetCursorPos({ x: 8, y: 34 });

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

  ImGui.SameLine(300);
  ImGui.TextDisabled('Preview is applied to the selected entity in the scene.');

  ImGui.EndChild();
  ImGui.PopStyleColor();

  // Render save confirmation modal if pending
  if (pendingSaveConfirmPopupId && platform) {
    renderSaveConfirmModal(platform, state);
  }
}

/**
 * Get animation options from an entity's AnimationController
 */
function getEntityAnimationOptions(
  entity: Entity | null,
  commands?: Command,
): Array<{ value: string; label: string; asset?: RuntimeAsset<AnimationClip>; filePath?: string }> {
  if (!entity || !commands) return [];

  const controller = commands.getComponent(entity, AnimationController);
  if (!controller) return [];

  const options: Array<{ value: string; label: string; asset?: RuntimeAsset<AnimationClip>; filePath?: string }> = [];

  for (const asset of controller.animations) {
    if (!asset.isLoaded || !asset.data) continue;

    // Skip editor preview animation
    if (asset.data.id === '__editor_preview__') continue;

    const clipName = asset.data.name || asset.data.id || 'Unnamed';
    options.push({
      value: asset.data.id,
      label: clipName,
      asset,
      filePath: asset.path ?? undefined,
    });
  }

  return options;
}

/**
 * Load an animation from a RuntimeAsset into the editor
 *
 * @param asset - The RuntimeAsset containing the AnimationClip
 * @param webPath - The web-relative path (e.g., /assets/animations/file.anim.json)
 * @param platform - Optional platform for converting web path to absolute path
 */
function loadAnimationFromAsset(
  asset: RuntimeAsset<AnimationClip>,
  webPath: string | null,
  platform?: EditorPlatform,
): void {
  if (!asset.isLoaded || !asset.data) {
    console.warn('[AnimationEditor] Cannot load animation - asset not loaded');
    return;
  }

  const clip = asset.data;

  // Convert to editor state using the serializer
  // Use the AnimationClipJson format expected by loadAnimationFromJson
  const jsonStr = JSON.stringify({
    id: clip.id,
    name: clip.name,
    duration: clip.duration,
    loopMode: clip.loopMode === LoopMode.Once ? 'once' : clip.loopMode === LoopMode.Loop ? 'loop' : 'pingpong',
    speed: clip.speed,
    tracks: clip.getTracks().map((track) => ({
      propertyPath: track.fullPropertyPath, // Use fullPropertyPath, not propertyPath
      interpolationMode: track.interpolationMode === 'discrete' ? 'discrete' : 'smooth',
      keyframes: track.keyframes.map((kf) => ({
        time: kf.time,
        value: kf.value,
        // kf.easing is a function, we need to get the name - but the JSON parser doesn't need it for loading
        // The serializer will re-infer from the easing function when saving
      })),
    })),
  });

  // Convert web path to absolute path for saving
  // The web path is like /assets/animations/file.anim.json
  // The absolute path is like /Users/.../public/assets/animations/file.anim.json
  let absolutePath: string | null = null;
  const effectiveWebPath = webPath ?? asset.path ?? '';
  if (effectiveWebPath && platform) {
    absolutePath = convertToAbsolutePath(effectiveWebPath, platform);
  }

  // Use the absolute path if available, otherwise fall back to the web path
  // (web path won't work for saving but at least the animation can be edited)
  const effectivePath = absolutePath ?? effectiveWebPath;
  loadAnimationFromJson(jsonStr, effectivePath, asset.guid);
}

/**
 * Render save confirmation modal
 */
function renderSaveConfirmModal(
  platform: EditorPlatform,
  state: ReturnType<typeof getAnimationEditorState>,
): void {
  if (!pendingSaveConfirmPopupId || !state) return;

  const result = EditorLayout.confirmModal(
    pendingSaveConfirmPopupId,
    'Unsaved Changes',
    'You have unsaved changes. Would you like to save before continuing?',
    {
      confirmLabel: 'Save',
      cancelLabel: 'Cancel',
      showDiscard: true,
      discardLabel: 'Discard',
    },
  );

  if (result === 'confirm') {
    // Save and then proceed
    handleSaveAnimation(platform, false).then(() => {
      if (pendingAnimationToLoad) {
        loadAnimationFromAsset(pendingAnimationToLoad.asset, pendingAnimationToLoad.filePath, currentPlatform);
      } else {
        handleNewAnimation();
      }
      pendingSaveConfirmPopupId = null;
      pendingAnimationToLoad = null;
    });
  } else if (result === 'discard') {
    // Discard changes and proceed
    if (pendingAnimationToLoad) {
      loadAnimationFromAsset(pendingAnimationToLoad.asset, pendingAnimationToLoad.filePath, currentPlatform);
    } else {
      handleNewAnimation();
    }
    pendingSaveConfirmPopupId = null;
    pendingAnimationToLoad = null;
  } else if (result === 'cancel') {
    // Cancel - do nothing
    pendingSaveConfirmPopupId = null;
    pendingAnimationToLoad = null;
  }
  // 'none' means modal is still open, keep waiting
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

  ImGui.SetCursorPos({ x: 8, y: 4 });

  // Go to start
  if (EditorLayout.iconButton(EDITOR_ICONS.FIRST_PAGE, {
    size: 'small',
    tooltip: 'Go to Start (Home)',
    id: 'goStart',
  })) {
    goToStart();
  }

  ImGui.SameLine();

  // Previous keyframe
  if (EditorLayout.iconButton(EDITOR_ICONS.NAVIGATE_BEFORE, {
    size: 'small',
    tooltip: 'Previous Keyframe (,)',
    id: 'prevKf',
  })) {
    goToPreviousKeyframe();
  }

  ImGui.SameLine();

  // Play/Pause button
  const playIcon = state.isPlaying ? EDITOR_ICONS.PAUSE : EDITOR_ICONS.PLAY;
  const playTooltip = state.isPlaying ? 'Pause (Space)' : 'Play (Space)';
  const playColor = state.isPlaying
    ? { r: COLORS.playButtonPlaying.x, g: COLORS.playButtonPlaying.y, b: COLORS.playButtonPlaying.z }
    : { r: COLORS.playButtonStopped.x, g: COLORS.playButtonStopped.y, b: COLORS.playButtonStopped.z };

  if (EditorLayout.iconButton(playIcon, {
    size: 'small',
    tooltip: playTooltip,
    id: 'playPause',
    color: playColor,
    hoverColor: { r: playColor.r + 0.1, g: playColor.g + 0.1, b: playColor.b + 0.1 },
  })) {
    togglePlayback();
  }

  ImGui.SameLine();

  // Stop button
  if (EditorLayout.iconButton(EDITOR_ICONS.STOP, {
    size: 'small',
    tooltip: 'Stop',
    id: 'stop',
  })) {
    stopPlayback();
    goToStart();
  }

  ImGui.SameLine();

  // Next keyframe
  if (EditorLayout.iconButton(EDITOR_ICONS.NAVIGATE_NEXT, {
    size: 'small',
    tooltip: 'Next Keyframe (.)',
    id: 'nextKf',
  })) {
    goToNextKeyframe();
  }

  ImGui.SameLine();

  // Go to end
  if (EditorLayout.iconButton(EDITOR_ICONS.LAST_PAGE, {
    size: 'small',
    tooltip: 'Go to End (End)',
    id: 'goEnd',
  })) {
    goToEnd();
  }

  ImGui.SameLine(180);

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
  const isNewAnimation = !assetGuid; // Track if this is a new animation

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

      // If this was a new animation and we have a selected entity, add it to the AnimationController
      if (isNewAnimation && state.selectedEntity !== null && currentCommands) {
        addAnimationToController(assetGuid, state.selectedEntity, currentCommands);
      } else if (!isNewAnimation && state.selectedEntity !== null && currentCommands) {
        // Update the existing animation in the controller with the new data
        updateAnimationInController(assetGuid, state.selectedEntity, currentCommands);
      }
    }

    markClean();
  } catch (error) {
    console.error('Failed to save animation file:', error);
  }
}

/**
 * Add a newly saved animation to the selected entity's AnimationController.
 *
 * This builds the AnimationClip directly from the current editor state rather than
 * loading from disk, which ensures the animation is immediately available without
 * any fetch/cache delays.
 */
function addAnimationToController(
  assetGuid: string,
  entity: Entity,
  commands: Command,
): void {
  const controller = commands.tryGetComponent(entity, AnimationController);
  if (!controller) {
    console.warn('[AnimationEditor] Cannot add animation - entity has no AnimationController');
    return;
  }

  // Check if animation is already in the controller
  const alreadyExists = controller.animations.some((a) => a.guid === assetGuid);
  if (alreadyExists) {
    return; // Already added
  }

  // Get the current editor state to build the AnimationClip
  const state = getAnimationEditorState();
  if (!state) {
    console.warn('[AnimationEditor] Cannot add animation - no editor state');
    return;
  }

  // Build the AnimationClip from the current editor state
  const clip = AnimationClip.create(state.animationId)
    .setName(state.animationName)
    .setDuration(state.duration)
    .setLoopMode(state.loopMode)
    .setSpeed(state.speed);

  for (const editorTrack of state.tracks) {
    const track = new PropertyTrack<unknown>(editorTrack.fullPropertyPath);

    for (const kf of editorTrack.keyframes) {
      const easing = getEasingFunction(kf.easingName);
      track.keyframe(kf.time, kf.value, easing);
    }

    clip.addTrack(track);
  }

  // Create a pre-loaded RuntimeAsset with the in-memory clip
  // This avoids needing to fetch from disk (which may have caching issues)
  const runtimeAsset = RuntimeAsset.createLoaded<AnimationClip>(
    assetGuid,
    AssetType.Animation,
    clip,
  );

  // Register with RuntimeAssetManager so lookups work correctly
  // Note: We use a workaround since getOrCreate would return an unloaded asset
  // We check if it's already registered first
  if (!RuntimeAssetManager.get().has(assetGuid)) {
    // Register our pre-loaded asset
    // RuntimeAssetManager doesn't have a direct "set" method for existing assets,
    // but we can use the internal map via getOrCreate then overwrite
    // Actually, let's just add to the controller directly - the asset manager
    // will get the metadata-based version if needed later
  }

  // Add to the controller's animations array
  controller.animations.push(runtimeAsset);
}

/**
 * Update an existing animation in the controller with new data from the editor.
 *
 * This is called when saving changes to an existing animation, so the in-memory
 * RuntimeAsset reflects the saved data without needing to reload from disk.
 */
function updateAnimationInController(
  assetGuid: string,
  entity: Entity,
  commands: Command,
): void {
  const controller = commands.tryGetComponent(entity, AnimationController);
  if (!controller) {
    return;
  }

  // Find the existing animation asset
  const existingAsset = controller.animations.find((a) => a.guid === assetGuid);
  if (!existingAsset) {
    return; // Not in this controller
  }

  // Get the current editor state to build the updated AnimationClip
  const state = getAnimationEditorState();
  if (!state) {
    return;
  }

  // Build the updated AnimationClip from the current editor state
  const clip = AnimationClip.create(state.animationId)
    .setName(state.animationName)
    .setDuration(state.duration)
    .setLoopMode(state.loopMode)
    .setSpeed(state.speed);

  for (const editorTrack of state.tracks) {
    const track = new PropertyTrack<unknown>(editorTrack.fullPropertyPath);

    for (const kf of editorTrack.keyframes) {
      const easing = getEasingFunction(kf.easingName);
      track.keyframe(kf.time, kf.value, easing);
    }

    clip.addTrack(track);
  }

  // Update the in-memory data of the existing RuntimeAsset
  // We access the private _data field to update it
  (existingAsset as unknown as { _data: AnimationClip })._data = clip;
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
 * Convert a web-relative path to an absolute file path.
 * Returns null if conversion is not possible.
 */
function convertToAbsolutePath(webPath: string, platform: EditorPlatform): string | null {
  if (!platform.sourceAssetsDir) return null;
  if (!webPath) return null;

  // Remove leading slash if present for joining
  const relativePath = webPath.startsWith('/') ? webPath.slice(1) : webPath;
  return `${platform.sourceAssetsDir}/${relativePath}`;
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
