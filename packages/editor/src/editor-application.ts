/**
 * EditorApplication - Main application class for VoidScript Editor
 *
 * Supports two modes:
 * 1. Standalone (ImGui-only): Just panels and UI, no game engine
 * 2. Integrated: Wraps EngineApplication for full game editor with 30fps throttled UI
 *
 * In integrated mode, game logic runs at full fps while editor UI renders at 30fps.
 */

import { ImGui, ImGuiImplWeb, ImVec2Helpers } from '@voidscript/imgui';
import {
  EngineApplication,
  type EngineApplicationConfig,
  EditorManager,
  EditorCameraManager,
} from '@voidscript/engine';
import type { Scene } from '@voidscript/renderer';
import type { EditorPanel } from './editor-panel.js';
import { MenuManager } from './menu-manager.js';
import { PanelStateManager } from './panel-state-manager.js';
import { EditorCamera } from './editor-camera.js';
import { EditorFonts } from './editor-fonts.js';
import { TitleBar } from './title-bar.js';
import { initOSInfo } from './os-info.js';

/**
 * Font configuration for the editor
 */
export interface EditorFontConfig {
  /** URL to the main font file (TTF) */
  mainFontUrl: string;
  /** URL to the icon font file (OTF/TTF) */
  iconFontUrl: string;
}

/**
 * Configuration options for EditorApplication
 */
export interface EditorApplicationConfig {
  /** Canvas element ID or HTMLCanvasElement */
  canvas: string | HTMLCanvasElement;
  /** Background clear color (default: dark gray) */
  clearColor?: { r: number; g: number; b: number; a: number };
  /** Target FPS for editor UI rendering (default: 30) */
  editorFPS?: number;
  /**
   * Font configuration for the editor.
   * Required for proper icon and text rendering.
   */
  fonts?: EditorFontConfig;
  /**
   * Engine configuration for integrated mode.
   * If provided, EditorApplication wraps EngineApplication.
   * If omitted, runs in standalone mode (ImGui only).
   */
  engine?: Omit<EngineApplicationConfig, 'window'>;
}

/**
 * Main application class that manages ImGui and editor panels.
 *
 * @example Standalone mode (ImGui only)
 * ```typescript
 * const app = new EditorApplication({
 *   canvas: 'render-canvas',
 * });
 *
 * app.registerPanel(new MyPanel());
 * await app.run();
 * ```
 *
 * @example Integrated mode (with game engine)
 * ```typescript
 * const app = new EditorApplication({
 *   canvas: 'render-canvas',
 *   editorFPS: 30,
 *   engine: {
 *     renderer: { clearColor: 0x1a1a2e },
 *   },
 * });
 *
 * app.registerPanel(new SceneViewPanel());
 * await app.run();
 * ```
 */
export class EditorApplication {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private panels: EditorPanel[] = [];
  private isRunning = false;
  private clearColor: { r: number; g: number; b: number; a: number };
  private animationFrameId: number | null = null;

  /** Manager for native Tauri menu bar */
  private readonly menuManager = new MenuManager();

  /** Manager for panel state persistence */
  private readonly panelStateManager = new PanelStateManager();

  /** Track panel open states to detect changes */
  private lastPanelStates = new Map<string, boolean>();

  /** Custom title bar component */
  private readonly titleBar = new TitleBar();

  /** Font configuration (optional, for custom fonts) */
  private fontConfig: EditorFontConfig | undefined;

  // ============================================================================
  // Integrated Mode (Engine)
  // ============================================================================

  /** Wrapped engine application (null in standalone mode) */
  private engine: EngineApplication | null = null;

  /** Editor state manager (null in standalone mode) */
  private editorManager: EditorManager | null = null;

  /** Editor camera manager (null in standalone mode) */
  private editorCameraManager: EditorCameraManager | null = null;

  /** Editor camera for scene view (null in standalone mode) */
  private editorCamera: EditorCamera | null = null;

  /** Target interval between editor renders in ms */
  private editorRenderInterval: number;

  /** Last time editor UI was rendered */
  private lastEditorRenderTime = 0;

  /** Whether we're in integrated mode (have an engine) */
  private readonly isIntegratedMode: boolean;

  /**
   * Create a new EditorApplication
   *
   * @param config - Application configuration
   * @throws Error if canvas element not found or WebGL2 not supported
   */
  constructor(config: EditorApplicationConfig) {
    this.isIntegratedMode = config.engine !== undefined;
    this.editorRenderInterval = 1000 / (config.editorFPS ?? 30);

    // Get canvas element
    if (typeof config.canvas === 'string') {
      const element = document.getElementById(config.canvas);
      if (!element || !(element instanceof HTMLCanvasElement)) {
        throw new Error(`Canvas element not found: ${config.canvas}`);
      }
      this.canvas = element;
    } else {
      this.canvas = config.canvas;
    }

    // Set clear color
    this.clearColor = config.clearColor ?? { r: 0.1, g: 0.1, b: 0.1, a: 1.0 };

    // Store font configuration
    this.fontConfig = config.fonts;

    if (this.isIntegratedMode) {
      // Integrated mode: create engine, share WebGL context
      this.engine = new EngineApplication({
        window: { canvas: this.canvas },
        ...config.engine,
      });

      // Get GL context from engine's renderer
      this.gl = this.engine.getRenderer().getThreeRenderer().getContext() as WebGL2RenderingContext;
    } else {
      // Standalone mode: create our own WebGL context
      const gl = this.canvas.getContext('webgl2', {
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });
      if (!gl) {
        throw new Error('WebGL2 not supported');
      }
      this.gl = gl;
    }
  }

  /**
   * Register a panel to be rendered each frame.
   * If panel states have been loaded, applies the saved open state.
   * Also registers the panel with the menu manager.
   *
   * @param panel - The panel instance to register
   */
  registerPanel(panel: EditorPanel): void {
    this.panels.push(panel);

    // Set application reference so panel can access engine, renderer, etc.
    panel.setApplication(this);

    // Register with menu manager for native menu integration
    this.menuManager.registerPanel(panel);

    // Apply saved state if available
    if (this.panelStateManager.isLoaded()) {
      panel.isOpen = this.panelStateManager.getOpenState(
        panel.getId(),
        panel.defaultOpen,
      );
    }
  }

  /**
   * Unregister a panel
   *
   * @param panel - The panel instance to remove
   * @returns true if the panel was found and removed
   */
  unregisterPanel(panel: EditorPanel): boolean {
    const index = this.panels.indexOf(panel);
    if (index !== -1) {
      this.panels.splice(index, 1);
      this.menuManager.unregisterPanel(panel);
      return true;
    }
    return false;
  }

  /**
   * Get all registered panels
   */
  getPanels(): readonly EditorPanel[] {
    return this.panels;
  }

  /**
   * Initialize ImGui and start the render loop.
   * This method returns a promise that resolves when the application stops.
   *
   * Also loads panel states from storage, builds the native menu bar,
   * and registers global keyboard shortcuts.
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      console.warn('EditorApplication is already running');
      return;
    }

    // Initialize engine first (if integrated mode)
    if (this.engine) {
      await this.engine.initialize();

      // Create editor managers
      this.editorManager = new EditorManager(
        this.engine.getWorld(),
        () => this.engine!.createCommands(),
      );
      this.engine.insertResource(this.editorManager);

      this.editorCameraManager = new EditorCameraManager(this.engine.getRenderer());
      this.engine.insertResource(this.editorCameraManager);

      // Create editor camera for scene view
      this.editorCamera = new EditorCamera({
        position: { x: 5, y: 5, z: 5 },
        lookAt: { x: 0, y: 0, z: 0 },
      });
    }

    // Load panel states from storage
    await this.panelStateManager.load();

    // Apply saved states to already-registered panels
    for (const panel of this.panels) {
      panel.isOpen = this.panelStateManager.getOpenState(
        panel.getId(),
        panel.defaultOpen,
      );
    }

    // Build and set native Tauri menu bar
    await this.menuManager.buildAndSetMenu();

    // Register global keyboard shortcuts
    await this.menuManager.registerShortcuts();

    // Initialize OS detection
    await initOSInfo();

    // Initialize ImGui
    await this.initializeImGui();

    // Load fonts if configured
    if (this.fontConfig) {
      await EditorFonts.loadFonts(
        this.fontConfig.mainFontUrl,
        this.fontConfig.iconFontUrl,
      );
    }

    // Initialize title bar (sets up Tauri window controls)
    await this.titleBar.initialize();

    // Start the render loop
    this.isRunning = true;
    this.lastEditorRenderTime = performance.now();

    return new Promise<void>((resolve) => {
      const loop = (time: number) => {
        if (!this.isRunning) {
          resolve();
          return;
        }

        if (this.isIntegratedMode) {
          this.combinedLoop(time);
        } else {
          this.standaloneLoop(time);
        }

        this.animationFrameId = requestAnimationFrame(loop);
      };

      this.animationFrameId = requestAnimationFrame(loop);
    });
  }

  /**
   * Stop the render loop.
   * Also saves panel states and unregisters keyboard shortcuts.
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop engine if running
    if (this.engine) {
      this.engine.stop();
    }

    // Save panel states
    await this.panelStateManager.saveImmediate(this.panels);

    // Unregister keyboard shortcuts
    await this.menuManager.unregisterShortcuts();
  }

  /**
   * Check if the application is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get the WebGL2 rendering context
   */
  getGL(): WebGL2RenderingContext {
    return this.gl;
  }

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Get the menu manager for advanced menu customization.
   */
  getMenuManager(): MenuManager {
    return this.menuManager;
  }

  /**
   * Get the panel state manager for advanced state control.
   */
  getPanelStateManager(): PanelStateManager {
    return this.panelStateManager;
  }

  /**
   * Save all panel states to storage.
   * Uses debouncing to avoid excessive writes.
   */
  async savePanelStates(): Promise<void> {
    await this.panelStateManager.save(this.panels);
  }

  // ============================================================================
  // Integrated Mode Accessors
  // ============================================================================

  /**
   * Get the wrapped EngineApplication.
   * Only available in integrated mode.
   */
  getEngine(): EngineApplication | null {
    return this.engine;
  }

  /**
   * Get the EditorManager.
   * Only available in integrated mode.
   */
  getEditorManager(): EditorManager | null {
    return this.editorManager;
  }

  /**
   * Get the EditorCameraManager.
   * Only available in integrated mode.
   */
  getEditorCameraManager(): EditorCameraManager | null {
    return this.editorCameraManager;
  }

  /**
   * Get the EditorCamera for scene view rendering.
   * Only available in integrated mode.
   */
  getEditorCamera(): EditorCamera | null {
    return this.editorCamera;
  }

  /**
   * Get the shared scene from the engine's renderer.
   * Both Scene View and Game View render this same scene.
   * Only available in integrated mode.
   */
  getScene(): Scene | null {
    return this.engine?.getRenderer().getScene() ?? null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Initialize ImGui with the WebGL context
   */
  private async initializeImGui(): Promise<void> {
    // Initialize ImGui implementation (takes options object)
    await ImGuiImplWeb.Init({
      canvas: this.canvas,
    });

    // Enable docking
    const io = ImGui.GetIO();
    io.ConfigFlags |= ImGui.ConfigFlags.DockingEnable;

    // Configure ImGui style
    const style = ImGui.GetStyle();
    style.WindowRounding = 4.0;
    style.FrameRounding = 2.0;
    style.ScrollbarRounding = 2.0;
    style.GrabRounding = 2.0;

    // Set dark theme colors
    ImGui.StyleColorsDark();
  }

  /**
   * Standalone loop - just ImGui rendering
   */
  private standaloneLoop(_time: number): void {
    // Handle canvas resize
    this.handleResize();

    // Clear the canvas
    const { r, g, b, a } = this.clearColor;
    this.gl.clearColor(r, g, b, a);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // Start ImGui frame (BeginRender handles NewFrame internally)
    ImGuiImplWeb.BeginRender();

    // Render dockspace and panels
    this.renderDockspace();

    // Finalize ImGui rendering (EndRender handles Render + RenderDrawData)
    ImGuiImplWeb.EndRender();
  }

  /**
   * Combined loop - game at full fps, editor at 30fps
   */
  private combinedLoop(time: number): void {
    if (!this.engine) return;

    // Handle canvas resize
    this.handleResize();

    const shouldRenderEditor = time - this.lastEditorRenderTime >= this.editorRenderInterval;

    // Game logic runs at full FPS
    this.engine.updateOnly();

    // Editor UI at throttled fps
    if (shouldRenderEditor) {
      this.lastEditorRenderTime = time;
      this.renderEditorUI();
    }
  }

  /**
   * Render the editor UI (ImGui + panels)
   */
  private renderEditorUI(): void {
    if (!this.engine) return;

    // Reset WebGL state after Three.js
    this.engine.getRenderer().resetState();

    // Clear screen for editor
    const { r, g, b, a } = this.clearColor;
    this.gl.clearColor(r, g, b, a);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // ImGui frame
    ImGuiImplWeb.BeginRender();
    this.renderDockspace();
    ImGuiImplWeb.EndRender();
  }

  /**
   * Render the root dockspace that fills the entire viewport
   */
  private renderDockspace(): void {
    // Render title bar first (at top of screen)
    this.titleBar.render();

    // Use ImVec2Helpers instead of viewport.Pos/Size which are broken in jsimgui
    const dockspacePos = ImVec2Helpers.GetMainViewportPos();
    const dockspaceSize = ImVec2Helpers.GetMainViewportSize();
    const viewportID = ImVec2Helpers.GetMainViewportID();

    // Offset dockspace to account for title bar height
    const titleBarHeight = this.titleBar.getHeight();
    const adjustedPos = { x: dockspacePos.x, y: dockspacePos.y + titleBarHeight };
    const adjustedSize = { x: dockspaceSize.x, y: dockspaceSize.y - titleBarHeight };

    // Create fullscreen dockspace window (below title bar)
    ImGui.SetNextWindowPos(adjustedPos, ImGui.Cond.Always);
    ImGui.SetNextWindowSize(adjustedSize, ImGui.Cond.Always);
    ImGui.SetNextWindowViewport(viewportID);

    const windowFlags =
      ImGui.WindowFlags.NoTitleBar |
      ImGui.WindowFlags.NoCollapse |
      ImGui.WindowFlags.NoResize |
      ImGui.WindowFlags.NoMove |
      ImGui.WindowFlags.NoBringToFrontOnFocus |
      ImGui.WindowFlags.NoNavFocus |
      ImGui.WindowFlags.NoBackground;

    ImGui.PushStyleVar(ImGui.StyleVar.WindowRounding, 0.0);
    ImGui.PushStyleVar(ImGui.StyleVar.WindowBorderSize, 0.0);
    ImGui.PushStyleVarImVec2(ImGui.StyleVar.WindowPadding, { x: 0.0, y: 0.0 });

    if (ImGui.Begin('##EditorDockspace', null, windowFlags)) {
      ImGui.PopStyleVar(3);

      // Create the dockspace
      const dockspaceId = ImGui.GetID('EditorDockspace');
      ImGui.DockSpace(
        dockspaceId,
        { x: 0, y: 0 },
        ImGui.DockNodeFlags.PassthruCentralNode,
      );

      // Render all registered panels inside the dockspace
      for (const panel of this.panels) {
        panel.render();
      }

      // Check for panel state changes and auto-save
      this.checkAndSavePanelStates();
    } else {
      ImGui.PopStyleVar(3);
    }
    ImGui.End();
  }

  /**
   * Handle canvas resize to match display size
   */
  private handleResize(): void {
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;

    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
      this.gl.viewport(0, 0, displayWidth, displayHeight);

      // Notify engine of resize if in integrated mode
      if (this.engine) {
        this.engine.getRenderer().onResize(displayWidth, displayHeight);
      }
    }
  }

  /**
   * Check if any panel states have changed and trigger save if needed.
   */
  private checkAndSavePanelStates(): void {
    let hasChanges = false;

    for (const panel of this.panels) {
      const panelId = panel.getId();
      const currentState = panel.isOpen;
      const lastState = this.lastPanelStates.get(panelId);

      if (lastState !== currentState) {
        hasChanges = true;
        this.lastPanelStates.set(panelId, currentState);
      }
    }

    if (hasChanges) {
      // Trigger debounced save
      void this.panelStateManager.save(this.panels);
    }
  }
}
