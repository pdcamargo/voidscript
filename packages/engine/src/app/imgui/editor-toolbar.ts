/**
 * Editor Toolbar - Horizontal strip below menu bar with editor controls
 *
 * Provides controls for:
 * - Play Controls: Play/Pause/Stop buttons
 * - Helpers: Toggle debug helper visibility
 */

import { ImGui } from '@mori2003/jsimgui';
import type { EditorCameraManager } from '../editor-camera-manager.js';
import type { EditorManager } from '../../editor/editor-manager.js';
import type { HelperManager } from '../helper-manager.js';
import type { TransformControlsManager } from '../../editor/transform-controls-manager.js';
import { EDITOR_ICONS } from './editor-icons.js';
import { EditorLayout } from './editor-layout.js';

/**
 * Editor toolbar state (passed from layer)
 */
export interface EditorToolbarState {
  editorCameraManager: EditorCameraManager;
  editorManager?: EditorManager;
  helperManager?: HelperManager;
  transformControlsManager?: TransformControlsManager;
  currentFPS?: number;
}

// Toolbar height constant
const TOOLBAR_HEIGHT = 40;

/**
 * Render the editor toolbar as a horizontal strip below the menu bar
 */
export function renderEditorToolbar(state: EditorToolbarState): void {
  const { editorManager } = state;

  // Get viewport dimensions
  const viewportPos = ImGui.GetMainViewport().Pos;
  const viewportSize = ImGui.GetMainViewport().Size;

  // Position below menu bar (menu bar is typically ~19px)
  const menuBarHeight = ImGui.GetFrameHeight();
  const toolbarY = viewportPos.y + menuBarHeight;

  // Setup toolbar window
  ImGui.SetNextWindowPos({ x: viewportPos.x, y: toolbarY }, ImGui.Cond.Always);
  ImGui.SetNextWindowSize({ x: viewportSize.x, y: TOOLBAR_HEIGHT }, ImGui.Cond.Always);

  const windowFlags =
    ImGui.WindowFlags.NoTitleBar |
    ImGui.WindowFlags.NoResize |
    ImGui.WindowFlags.NoMove |
    ImGui.WindowFlags.NoScrollbar |
    ImGui.WindowFlags.NoScrollWithMouse |
    ImGui.WindowFlags.NoCollapse |
    ImGui.WindowFlags.NoDocking;

  if (ImGui.Begin('##EditorToolbar', null, windowFlags)) {
    // === Play Controls Section ===
    if (editorManager) {
      renderPlayControlsSection(editorManager);
      ImGui.SameLine();
      ImGui.Text('|');
      ImGui.SameLine();
    }

    // === Helpers Section ===
    renderHelpersSection(state);

    // === Transform Mode Section ===
    if (state.transformControlsManager) {
      ImGui.SameLine();
      ImGui.Text('|');
      ImGui.SameLine();
      renderTransformModeSection(state.transformControlsManager);
    }

    // === FPS Counter (Right-aligned) ===
    if (state.currentFPS !== undefined) {
      // Calculate position for right-aligned FPS
      const fpsText = `FPS: ${Math.round(state.currentFPS)}`;
      const windowWidth = ImGui.GetWindowWidth();
      // Approximate text width (each character is roughly 7 pixels in default font)
      const approxTextWidth = fpsText.length * 7;
      const padding = 10;

      // Set cursor to right side
      ImGui.SameLine(windowWidth - approxTextWidth - padding);
      ImGui.TextColored({ x: 0.7, y: 0.7, z: 0.7, w: 1.0 }, fpsText);
    }

  }
  ImGui.End();
}

/**
 * Render play controls section (Play/Pause/Stop)
 */
function renderPlayControlsSection(manager: EditorManager): void {
  const mode = manager.mode;
  const isPlaying = mode === 'play';
  const isPaused = mode === 'pause';
  const isEditing = mode === 'edit';

  // Common button options for consistent sizing
  // Uses GetFrameHeight() by default to match standard ImGui buttons
  const buttonOpts = {
    size: 'medium' as const,
    iconOffsetY: 0,
  };

  // Play/Resume/Pause toggle button
  if (isEditing) {
    // Show Play button
    if (EditorLayout.iconButton(EDITOR_ICONS.PLAY, {
      ...buttonOpts,
      tooltip: 'Play',
      color: { r: 0.2, g: 0.6, b: 0.2 },
      hoverColor: { r: 0.3, g: 0.7, b: 0.3 },
      id: 'play',
    })) {
      manager.play();
    }
  } else if (isPaused) {
    // Show Resume button
    if (EditorLayout.iconButton(EDITOR_ICONS.PLAY, {
      ...buttonOpts,
      tooltip: 'Resume',
      color: { r: 0.2, g: 0.6, b: 0.2 },
      hoverColor: { r: 0.3, g: 0.7, b: 0.3 },
      id: 'resume',
    })) {
      manager.resume();
    }
  } else {
    // Show Pause button
    if (EditorLayout.iconButton(EDITOR_ICONS.PAUSE, {
      ...buttonOpts,
      tooltip: 'Pause',
      color: { r: 0.8, g: 0.6, b: 0.2 },
      hoverColor: { r: 0.9, g: 0.7, b: 0.3 },
      id: 'pause',
    })) {
      manager.pause();
    }
  }

  ImGui.SameLine();

  // Stop button (red when playing/paused, disabled otherwise)
  if (isPlaying || isPaused) {
    if (EditorLayout.iconButton(EDITOR_ICONS.STOP, {
      ...buttonOpts,
      tooltip: 'Stop',
      color: { r: 0.8, g: 0.2, b: 0.2 },
      hoverColor: { r: 0.9, g: 0.3, b: 0.3 },
      id: 'stop',
    })) {
      manager.stop();
    }
  } else {
    EditorLayout.iconButtonDisabled(EDITOR_ICONS.STOP, {
      ...buttonOpts,
      tooltip: 'Stop',
      id: 'stop-disabled',
    });
  }

  // Step button (only in pause mode)
  if (isPaused) {
    ImGui.SameLine();
    if (EditorLayout.iconButton(EDITOR_ICONS.SKIP_NEXT, {
      ...buttonOpts,
      tooltip: 'Step',
      color: { r: 0.4, g: 0.4, b: 0.7 },
      hoverColor: { r: 0.5, g: 0.5, b: 0.8 },
      id: 'step',
    })) {
      manager.step();
    }
  }
}


/**
 * Render helpers toggle section
 */
function renderHelpersSection(state: EditorToolbarState): void {
  // Helpers toggle (if helperManager is available)
  if (state.helperManager) {
    ImGui.Text('Helpers:');
    ImGui.SameLine();

    const helpersEnabled = state.helperManager.showHelpers;

    // Highlight when enabled
    if (helpersEnabled) {
      ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.4, y: 0.6, z: 0.4, w: 1.0 });
    }

    if (ImGui.Button(helpersEnabled ? 'On' : 'Off')) {
      state.helperManager.setShowHelpers(!helpersEnabled);
    }

    if (helpersEnabled) {
      ImGui.PopStyleColor();
    }
  }
}

/**
 * Render transform mode section (Move/Rotate/Scale)
 */
function renderTransformModeSection(manager: TransformControlsManager): void {
  const currentMode = manager.getMode();

  // Active button color
  const activeColor = { r: 0.4, g: 0.6, b: 0.7 };
  const activeHoverColor = { r: 0.5, g: 0.7, b: 0.8 };

  // Move button (W)
  const isTranslate = currentMode === 'translate';
  if (EditorLayout.iconButton(EDITOR_ICONS.MOVE, {
    size: 'medium',
    tooltip: 'Move (W)',
    id: 'transform-move',
    ...(isTranslate ? { color: activeColor, hoverColor: activeHoverColor } : {}),
  })) {
    manager.setMode('translate');
  }

  ImGui.SameLine();

  // Rotate button (E)
  const isRotate = currentMode === 'rotate';
  if (EditorLayout.iconButton(EDITOR_ICONS.ROTATE, {
    size: 'medium',
    tooltip: 'Rotate (E)',
    id: 'transform-rotate',
    ...(isRotate ? { color: activeColor, hoverColor: activeHoverColor } : {}),
  })) {
    manager.setMode('rotate');
  }

  ImGui.SameLine();

  // Scale button (R)
  const isScale = currentMode === 'scale';
  if (EditorLayout.iconButton(EDITOR_ICONS.SCALE, {
    size: 'medium',
    tooltip: 'Scale (R)',
    id: 'transform-scale',
    ...(isScale ? { color: activeColor, hoverColor: activeHoverColor } : {}),
  })) {
    manager.setMode('scale');
  }
}

/**
 * Get the toolbar height (for positioning other windows below it)
 */
export function getEditorToolbarHeight(): number {
  return TOOLBAR_HEIGHT + ImGui.GetFrameHeight(); // Toolbar + menu bar
}
