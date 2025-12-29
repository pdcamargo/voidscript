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

/**
 * Editor toolbar state (passed from layer)
 */
export interface EditorToolbarState {
  editorCameraManager: EditorCameraManager;
  editorManager?: EditorManager;
  helperManager?: HelperManager;
  currentFPS?: number;
}

// Toolbar height constant
const TOOLBAR_HEIGHT = 32;

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

    // === Camera Type Section (2D mode only) ===
    if (state.editorCameraManager.mode === '2d') {
      ImGui.SameLine();
      ImGui.Text('|');
      ImGui.SameLine();
      renderCameraTypeSection(state.editorCameraManager);
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

  // Single Play/Pause/Resume toggle button
  if (isEditing) {
    // Show Play button
    ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.2, y: 0.6, z: 0.2, w: 1.0 });
    ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, { x: 0.3, y: 0.7, z: 0.3, w: 1.0 });
    if (ImGui.Button('Play')) {
      manager.play();
    }
    ImGui.PopStyleColor(2);
  } else if (isPaused) {
    // Show Resume button
    ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.2, y: 0.6, z: 0.2, w: 1.0 });
    ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, { x: 0.3, y: 0.7, z: 0.3, w: 1.0 });
    if (ImGui.Button('Resume')) {
      manager.resume();
    }
    ImGui.PopStyleColor(2);
  } else {
    // Show Pause button
    ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.8, y: 0.6, z: 0.2, w: 1.0 });
    ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, { x: 0.9, y: 0.7, z: 0.3, w: 1.0 });
    if (ImGui.Button('Pause')) {
      manager.pause();
    }
    ImGui.PopStyleColor(2);
  }

  ImGui.SameLine();

  // Stop button (red when playing/paused)
  if (isPlaying || isPaused) {
    ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.8, y: 0.2, z: 0.2, w: 1.0 });
    ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, { x: 0.9, y: 0.3, z: 0.3, w: 1.0 });
    if (ImGui.Button('Stop')) {
      manager.stop();
    }
    ImGui.PopStyleColor(2);
  } else {
    // Not playing - disabled
    ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.3, y: 0.3, z: 0.3, w: 1.0 });
    ImGui.Button('Stop');
    ImGui.PopStyleColor();
  }

  // Step button (only in pause mode)
  if (isPaused) {
    ImGui.SameLine();
    ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.4, y: 0.4, z: 0.7, w: 1.0 });
    ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, { x: 0.5, y: 0.5, z: 0.8, w: 1.0 });
    if (ImGui.Button('Step')) {
      manager.step();
    }
    ImGui.PopStyleColor(2);
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
 * Render camera type toggle section (2D mode only)
 */
function renderCameraTypeSection(cameraManager: EditorCameraManager): void {
  ImGui.Text('Camera:');
  ImGui.SameLine();

  const isPerspective = cameraManager.cameraType2D === 'perspective';

  // Orthographic button
  if (!isPerspective) {
    ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.4, y: 0.6, z: 0.7, w: 1.0 });
  }
  if (ImGui.Button('Ortho')) {
    cameraManager.setCameraType2D('orthographic');
  }
  if (!isPerspective) {
    ImGui.PopStyleColor();
  }

  ImGui.SameLine();

  // Perspective button
  if (isPerspective) {
    ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.4, y: 0.6, z: 0.7, w: 1.0 });
  }
  if (ImGui.Button('Persp')) {
    cameraManager.setCameraType2D('perspective');
  }
  if (isPerspective) {
    ImGui.PopStyleColor();
  }
}

/**
 * Get the toolbar height (for positioning other windows below it)
 */
export function getEditorToolbarHeight(): number {
  return TOOLBAR_HEIGHT + ImGui.GetFrameHeight(); // Toolbar + menu bar
}
