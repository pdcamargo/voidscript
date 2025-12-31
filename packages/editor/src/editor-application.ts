/**
 * EditorApplication - Main application class for VoidScript Editor
 *
 * Handles ImGui initialization, WebGL context management, and the render loop.
 * Panels are registered and rendered automatically each frame.
 */

import { ImGui, ImGuiImplWeb, ImVec2Helpers } from '@voidscript/imgui';
import type { EditorPanel } from './editor-panel.js';
import { MenuManager } from './menu-manager.js';
import { PanelStateManager } from './panel-state-manager.js';

/**
 * Configuration options for EditorApplication
 */
export interface EditorApplicationConfig {
  /** Canvas element ID or HTMLCanvasElement */
  canvas: string | HTMLCanvasElement;
  /** Background clear color (default: dark gray) */
  clearColor?: { r: number; g: number; b: number; a: number };
}

/**
 * Main application class that manages ImGui and editor panels.
 *
 * @example
 * ```typescript
 * const app = new EditorApplication({
 *   canvas: 'render-canvas',
 * });
 *
 * app.registerPanel(new MyPanel());
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

  /**
   * Create a new EditorApplication
   *
   * @param config - Application configuration
   * @throws Error if canvas element not found or WebGL2 not supported
   */
  constructor(config: EditorApplicationConfig) {
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

    // Create WebGL2 context
    const gl = this.canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) {
      throw new Error('WebGL2 not supported');
    }
    this.gl = gl;

    // Set clear color
    this.clearColor = config.clearColor ?? { r: 0.1, g: 0.1, b: 0.1, a: 1.0 };
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

    // Initialize ImGui
    await this.initializeImGui();

    // Start the render loop
    this.isRunning = true;

    return new Promise<void>((resolve) => {
      const loop = (time: number) => {
        if (!this.isRunning) {
          resolve();
          return;
        }

        this.renderFrame(time);
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
   * Render a single frame
   */
  private renderFrame(_time: number): void {
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
   * Render the root dockspace that fills the entire viewport
   */
  private renderDockspace(): void {
    // Use ImVec2Helpers instead of viewport.Pos/Size which are broken in jsimgui
    const dockspacePos = ImVec2Helpers.GetMainViewportPos();
    const dockspaceSize = ImVec2Helpers.GetMainViewportSize();
    const viewportID = ImVec2Helpers.GetMainViewportID();

    // Create fullscreen dockspace window
    ImGui.SetNextWindowPos(dockspacePos, ImGui.Cond.Always);
    ImGui.SetNextWindowSize(dockspaceSize, ImGui.Cond.Always);
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
