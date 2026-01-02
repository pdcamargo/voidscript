/**
 * TitleBar - Custom title bar for VoidScript Editor
 *
 * Renders a Godot-inspired title bar with:
 * - OS-specific window controls (macOS traffic lights or Windows/Linux icons)
 * - Scene filename and project name
 * - Play/Stop/Step buttons (visual only for now)
 * - Window dragging support via Tauri
 *
 * @example
 * ```typescript
 * const titleBar = new TitleBar();
 * await titleBar.initialize();
 *
 * // In render loop
 * titleBar.render();
 * ```
 */

import { ImGui, ImVec2Helpers } from '@voidscript/imgui';
import { EditorLayout } from './editor-layout.js';
import { EditorColors } from './editor-colors.js';
import { EditorIcons } from './editor-icons.js';
import { WindowControls } from './window-controls.js';
import { getOSType, isMacOS } from './os-info.js';
import { getFormattedTitle } from './project-info.js';

// Title bar configuration
const TITLE_BAR_HEIGHT = 32;
const TITLE_BAR_PADDING = 8;
const PLAY_BUTTON_SIZE = 24;
const PLAY_BUTTON_SPACING = 4;
const TRAFFIC_LIGHT_RADIUS = 6;

/**
 * Title bar component for the editor
 */
export class TitleBar {
  private _isMaximized = false;
  private _windowFocused = true;
  private _isDragging = false;

  // Callbacks for window controls (to be wired up to Tauri)
  private _onClose: () => void = () => {};
  private _onMinimize: () => void = () => {};
  private _onMaximize: () => void = () => {};

  // Cached Tauri window reference (to avoid dynamic imports every frame)
  private _tauriWindow: { startDragging: () => Promise<void> } | null = null;

  /**
   * Initialize the title bar
   * Sets up Tauri window control callbacks
   *
   * NOTE: We intentionally do NOT use Tauri event listeners (onResized, onFocusChanged)
   * as they interfere with the WebGL/WASM event loop and cause the app to freeze.
   * Instead, we poll window state only when needed (on button clicks).
   */
  async initialize(): Promise<void> {
    try {
      // Try to import Tauri window API
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();

      // Cache window reference for dragging and state queries
      this._tauriWindow = appWindow;

      // Set up window control callbacks
      this._onClose = () => appWindow.close();
      this._onMinimize = () => appWindow.minimize();
      this._onMaximize = async () => {
        const maximized = await appWindow.isMaximized();
        if (maximized) {
          await appWindow.unmaximize();
        } else {
          await appWindow.maximize();
        }
        this._isMaximized = !maximized;
      };

      // Get initial maximized state
      this._isMaximized = await appWindow.isMaximized();
      // Always treat window as focused - we're a desktop app and focus detection
      // at initialization time is unreliable
      this._windowFocused = true;

      console.log('[TitleBar] Initialized with Tauri window controls');
    } catch {
      // Tauri not available, use fallback
      console.log('[TitleBar] Tauri not available, using fallback controls');

      this._onClose = () => window.close();
      this._onMinimize = () =>
        console.log('[TitleBar] Minimize not available in browser');
      this._onMaximize = () => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
          this._isMaximized = false;
        } else {
          document.documentElement.requestFullscreen();
          this._isMaximized = true;
        }
      };
    }
  }

  /**
   * Get the height of the title bar in pixels
   */
  getHeight(): number {
    return TITLE_BAR_HEIGHT;
  }

  /**
   * Render the title bar
   * Should be called at the start of each frame, before the dockspace
   */
  render(): void {
    // Use ImVec2Helpers instead of io.DisplaySize which is broken in jsimgui
    const viewportSize = ImVec2Helpers.GetMainViewportSize();
    const displayWidth = viewportSize.x;

    // Set up window flags for borderless title bar
    // NoBringToFrontOnFocus prevents title bar from stealing focus from panels
    const windowFlags =
      ImGui.WindowFlags.NoTitleBar |
      ImGui.WindowFlags.NoResize |
      ImGui.WindowFlags.NoMove |
      ImGui.WindowFlags.NoScrollbar |
      ImGui.WindowFlags.NoScrollWithMouse |
      ImGui.WindowFlags.NoCollapse |
      ImGui.WindowFlags.NoDocking |
      ImGui.WindowFlags.NoSavedSettings |
      ImGui.WindowFlags.NoBringToFrontOnFocus |
      ImGui.WindowFlags.NoFocusOnAppearing;

    // Position at top of screen
    ImGui.SetNextWindowPos({ x: 0, y: 0 });
    ImGui.SetNextWindowSize({ x: displayWidth, y: TITLE_BAR_HEIGHT });

    // Style the window
    ImGui.PushStyleVarImVec2(ImGui.StyleVar.WindowPadding, { x: 0, y: 0 });
    ImGui.PushStyleVar(ImGui.StyleVar.WindowRounding, 0);
    ImGui.PushStyleVar(ImGui.StyleVar.WindowBorderSize, 0);
    EditorLayout.pushStyleColor(ImGui.Col.WindowBg, EditorColors.TITLE_BAR_BG);

    if (ImGui.Begin('##TitleBar', null, windowFlags)) {
      this.renderContent(displayWidth);
      EditorLayout.divider({ marginTop: 6, marginBottom: 6 });
    }
    ImGui.End();

    EditorLayout.popStyleColor();
    ImGui.PopStyleVar(3);
  }

  /**
   * Render the title bar content
   */
  private renderContent(displayWidth: number): void {
    const osType = getOSType();

    // Vertical centering for play buttons
    const buttonVerticalPadding = (TITLE_BAR_HEIGHT - PLAY_BUTTON_SIZE) / 2;

    // Vertical centering for traffic lights (they're 12px diameter)
    const trafficLightVerticalPadding = (TITLE_BAR_HEIGHT - TRAFFIC_LIGHT_RADIUS * 2) / 2;

    // Vertical centering for text (use font size as approximate height)
    const fontSize = ImGui.GetFontSize();
    const textVerticalPadding = (TITLE_BAR_HEIGHT - fontSize) / 2;

    if (osType === 'macos') {
      this.renderMacOSLayout(displayWidth, buttonVerticalPadding, trafficLightVerticalPadding, textVerticalPadding);
    } else {
      this.renderWindowsLinuxLayout(displayWidth, buttonVerticalPadding, textVerticalPadding);
    }

    // Handle window dragging after rendering content
    // so we can check if any buttons were clicked
    this.handleDragging();
  }

  /**
   * Render macOS layout: [Traffic Lights] [Title] --- [Play Controls] --- [Placeholder] [FPS]
   */
  private renderMacOSLayout(
    displayWidth: number,
    buttonVerticalPadding: number,
    trafficLightVerticalPadding: number,
    textVerticalPadding: number,
  ): void {
    // Traffic lights on the left - vertically centered
    EditorLayout.setCursorPos(TITLE_BAR_PADDING, trafficLightVerticalPadding);
    WindowControls.renderMacOS(
      this._windowFocused,
      this._onClose,
      this._onMinimize,
      this._onMaximize,
    );

    EditorLayout.sameLine(TITLE_BAR_PADDING);

    // Title text - vertically centered
    EditorLayout.setCursorPosY(textVerticalPadding);
    EditorLayout.text(getFormattedTitle(), { color: EditorColors.TEXT_PRIMARY });

    // Center play controls
    this.renderPlayControls(displayWidth, buttonVerticalPadding);

    // Right side placeholder icon and FPS
    this.renderRightSection(displayWidth, buttonVerticalPadding, textVerticalPadding);
  }

  /**
   * Render Windows/Linux layout: [Title] --- [Play Controls] --- [Placeholder] [FPS] [Window Controls]
   */
  private renderWindowsLinuxLayout(
    displayWidth: number,
    buttonVerticalPadding: number,
    textVerticalPadding: number,
  ): void {
    // Title text on the left - vertically centered
    EditorLayout.setCursorPos(TITLE_BAR_PADDING, textVerticalPadding);
    EditorLayout.text(getFormattedTitle(), { color: EditorColors.TEXT_PRIMARY });

    // Center play controls
    this.renderPlayControls(displayWidth, buttonVerticalPadding);

    // Right side: placeholder icon, FPS, then window controls
    const windowControlsWidth = 32 * 3; // 3 buttons
    const fpsWidth = 60; // Approximate width for FPS text
    const placeholderX =
      displayWidth - windowControlsWidth - fpsWidth - PLAY_BUTTON_SIZE - TITLE_BAR_PADDING * 2;

    EditorLayout.setCursorPos(placeholderX, buttonVerticalPadding);
    EditorLayout.iconButton(EditorIcons.SQUARE, {
      size: PLAY_BUTTON_SIZE,
      tooltip: 'Placeholder',
      bgColor: EditorColors.BUTTON_TRANSPARENT,
      hoverColor: EditorColors.BUTTON_HOVER,
      iconColor: EditorColors.ICON_DEFAULT,
    });

    // FPS display - use absolute positioning to ensure proper vertical centering
    const fpsX = placeholderX + PLAY_BUTTON_SIZE + TITLE_BAR_PADDING;
    EditorLayout.setCursorPos(fpsX, textVerticalPadding);
    const fps = ImGui.GetIO().Framerate;
    EditorLayout.text(`${fps.toFixed(0)} FPS`, { color: EditorColors.TEXT_SECONDARY });

    // Window controls on far right
    EditorLayout.setCursorPos(displayWidth - windowControlsWidth, 0);
    WindowControls.renderWindowsLinux(
      this._isMaximized,
      this._onClose,
      this._onMinimize,
      this._onMaximize,
    );
  }

  /**
   * Render play/stop/step controls in the center
   */
  private renderPlayControls(displayWidth: number, buttonVerticalPadding: number): void {
    const playControlsWidth = PLAY_BUTTON_SIZE * 3 + PLAY_BUTTON_SPACING * 2;
    const centerX = (displayWidth - playControlsWidth) / 2;

    EditorLayout.setCursorPos(centerX, buttonVerticalPadding);

    // Play button
    if (
      EditorLayout.iconButton(EditorIcons.PLAY, {
        size: PLAY_BUTTON_SIZE,
        tooltip: 'Play',
        bgColor: EditorColors.BUTTON_TRANSPARENT,
        hoverColor: EditorColors.BUTTON_PLAY_HOVER,
        iconColor: EditorColors.ICON_DEFAULT,
      })
    ) {
      console.log('[TitleBar] Play clicked (visual only)');
    }

    EditorLayout.sameLine(PLAY_BUTTON_SPACING);

    // Stop button
    if (
      EditorLayout.iconButton(EditorIcons.STOP, {
        size: PLAY_BUTTON_SIZE,
        tooltip: 'Stop',
        bgColor: EditorColors.BUTTON_TRANSPARENT,
        hoverColor: EditorColors.BUTTON_STOP_HOVER,
        iconColor: EditorColors.ICON_DEFAULT,
      })
    ) {
      console.log('[TitleBar] Stop clicked (visual only)');
    }

    EditorLayout.sameLine(PLAY_BUTTON_SPACING);

    // Step button
    if (
      EditorLayout.iconButton(EditorIcons.STEP_FORWARD, {
        size: PLAY_BUTTON_SIZE,
        tooltip: 'Step Forward',
        bgColor: EditorColors.BUTTON_TRANSPARENT,
        hoverColor: EditorColors.BUTTON_STEP_HOVER,
        iconColor: EditorColors.ICON_DEFAULT,
      })
    ) {
      console.log('[TitleBar] Step clicked (visual only)');
    }
  }

  /**
   * Render right-side placeholder icon and FPS (macOS layout)
   */
  private renderRightSection(
    displayWidth: number,
    buttonVerticalPadding: number,
    textVerticalPadding: number,
  ): void {
    const fpsWidth = 60; // Approximate width for FPS text
    const placeholderX = displayWidth - fpsWidth - PLAY_BUTTON_SIZE - TITLE_BAR_PADDING * 2;

    EditorLayout.setCursorPos(placeholderX, buttonVerticalPadding);
    EditorLayout.iconButton(EditorIcons.SQUARE, {
      size: PLAY_BUTTON_SIZE,
      tooltip: 'Placeholder',
      bgColor: EditorColors.BUTTON_TRANSPARENT,
      hoverColor: EditorColors.BUTTON_HOVER,
      iconColor: EditorColors.ICON_DEFAULT,
    });

    // FPS display - use absolute positioning to ensure proper vertical centering
    const fpsX = placeholderX + PLAY_BUTTON_SIZE + TITLE_BAR_PADDING;
    EditorLayout.setCursorPos(fpsX, textVerticalPadding);
    const fps = ImGui.GetIO().Framerate;
    EditorLayout.text(`${fps.toFixed(0)} FPS`, { color: EditorColors.TEXT_SECONDARY });
  }

  /**
   * Handle window dragging and double-click to maximize via Tauri
   * Called at the END of renderContent so all buttons are already rendered
   */
  private handleDragging(): void {
    // Check if mouse is within title bar bounds
    const mousePos = ImVec2Helpers.GetMousePos();
    const isInTitleBar = mousePos.y >= 0 && mousePos.y <= TITLE_BAR_HEIGHT;

    // Reset dragging state on mouse release
    if (ImGui.IsMouseReleased(0)) {
      this._isDragging = false;
    }

    if (!isInTitleBar) {
      return;
    }

    // Don't drag if hovering over traffic lights on macOS
    if (isMacOS() && WindowControls.isTrafficLightHovered()) {
      return;
    }

    // Check if the title bar window itself is hovered (not child items)
    const isWindowHovered = ImGui.IsWindowHovered(ImGui.HoveredFlags.None);
    const isAnyItemHovered = ImGui.IsAnyItemHovered();

    // Only allow dragging if window is hovered but no specific item is hovered
    if (!isWindowHovered || isAnyItemHovered) {
      return;
    }

    // Handle double-click to maximize/restore
    if (ImGui.IsMouseDoubleClicked(0)) {
      this._onMaximize();
      return;
    }

    // Start dragging on mouse click (single click, not double)
    if (ImGui.IsMouseClicked(0) && this._tauriWindow) {
      this._tauriWindow.startDragging();
      this._isDragging = true;
    }
  }

  /**
   * Check if the title bar is currently being dragged
   */
  isDragging(): boolean {
    return this._isDragging;
  }

  /**
   * Set the maximized state (for external updates)
   */
  setMaximized(maximized: boolean): void {
    this._isMaximized = maximized;
  }

  /**
   * Set the window focused state (for external updates)
   */
  setWindowFocused(focused: boolean): void {
    this._windowFocused = focused;
  }
}
