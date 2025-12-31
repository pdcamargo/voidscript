/**
 * EditorApplication - Main application class for VoidScript Editor
 *
 * Handles ImGui initialization, WebGL context management, and the render loop.
 * Panels are registered and rendered automatically each frame.
 */

import { ImGui, ImGuiImplWeb, ImVec2Helpers } from '@voidscript/imgui';
import type { EditorPanel } from './editor-panel.js';

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
   * Register a panel to be rendered each frame
   *
   * @param panel - The panel instance to register
   */
  registerPanel(panel: EditorPanel): void {
    this.panels.push(panel);
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
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      console.warn('EditorApplication is already running');
      return;
    }

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
   * Stop the render loop
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
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
}
