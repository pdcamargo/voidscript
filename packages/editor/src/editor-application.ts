/**
 * EditorApplication - Main application class for VoidScript Editor
 *
 * Uses a layer-based architecture where different "screens" are layers:
 * - ProjectHubLayer: Project selection and creation (when no project is open)
 * - ProjectEditorLayer: Full editor with panels and engine integration
 *
 * Only one layer is active at a time. The application handles:
 * - WebGL context initialization
 * - ImGui initialization
 * - Layer switching
 * - Render loop management
 */

import { ImGui, ImGuiImplWeb } from '@voidscript/imgui';
import type { EngineApplicationConfig } from '@voidscript/engine';
import type { EditorApplicationLayer } from './layers/editor-application-layer.js';
import { ProjectHubLayer } from './layers/project-hub-layer.js';
import {
  ProjectEditorLayer,
  type ProjectEditorLayerConfig,
} from './layers/project-editor-layer.js';
import { EditorFonts } from './editor-fonts.js';
import { initOSInfo } from './os-info.js';
import { ThemeManager } from './theme/theme-manager.js';
import {
  loadCurrentProject,
  isValidProjectPath,
} from './project/current-project-store.js';
import { EditorFileSystem } from './editor-file-system.js';
import { ProjectFolders } from './project/project-config.js';
import type { EditorPanel } from './editor-panel.js';
import type { MenuActionConfig } from './menu-manager.js';

// ============================================================================
// Types
// ============================================================================

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
  /**
   * Font configuration for the editor.
   * Required for proper icon and text rendering.
   */
  fonts?: EditorFontConfig;
  /**
   * Default engine configuration for new projects.
   * Used when opening a project to configure the game engine.
   * @deprecated Use `engine` instead
   */
  defaultEngineConfig?: Omit<EngineApplicationConfig, 'window'>;
  /**
   * Engine configuration for the game engine.
   * Alias for defaultEngineConfig with a shorter name.
   */
  engine?: Omit<EngineApplicationConfig, 'window'>;
  /**
   * Target FPS for editor UI rendering.
   * @default 30
   */
  editorFPS?: number;
}

/**
 * Pending layer switch request.
 */
type PendingLayerSwitch =
  | { type: 'hub'; openCreateModal?: boolean }
  | {
      type: 'editor';
      path: string;
      config: { name: string; version: string; engineVersion: string };
    };

// ============================================================================
// EditorApplication
// ============================================================================

/**
 * Main application class that manages layers and the render loop.
 *
 * @example
 * ```typescript
 * const app = new EditorApplication({
 *   canvas: 'render-canvas',
 *   fonts: {
 *     mainFontUrl: '/fonts/main.ttf',
 *     iconFontUrl: '/fonts/icons.otf',
 *   },
 * });
 *
 * await app.run();
 * ```
 */
export class EditorApplication {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private isRunning = false;
  // Note: clearColor is stored for future use but currently handled by layers
  private _clearColor: { r: number; g: number; b: number; a: number };
  private animationFrameId: number | null = null;

  /** Font configuration (optional, for custom fonts) */
  private fontConfig: EditorFontConfig | undefined;

  /** Default engine configuration */
  private defaultEngineConfig: Omit<EngineApplicationConfig, 'window'> | undefined;

  /** Current active layer */
  private currentLayer: EditorApplicationLayer | null = null;

  /** Pending layer switch (processed at start of next frame) */
  private pendingLayerSwitch: PendingLayerSwitch | null = null;

  /** Pending panel registrations (applied when editor layer is created) */
  private pendingPanels: EditorPanel[] = [];

  /** Pending menu action registrations */
  private pendingMenuActions: MenuActionConfig[] = [];

  /** Pending app menu action registrations */
  private pendingAppMenuActions: Array<Omit<MenuActionConfig, 'path'> & { label: string }> = [];

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

    // Set clear color (stored for potential future use)
    this._clearColor = config.clearColor ?? { r: 0.1, g: 0.1, b: 0.1, a: 1.0 };

    // Store font configuration
    this.fontConfig = config.fonts;

    // Store default engine configuration (support both 'engine' and deprecated 'defaultEngineConfig')
    this.defaultEngineConfig = config.engine ?? config.defaultEngineConfig;

    // Create WebGL context
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

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Initialize and start the application.
   *
   * This method:
   * 1. Initializes ImGui
   * 2. Loads fonts and theme
   * 3. Checks for a cached project
   * 4. Starts the appropriate layer (hub or editor)
   * 5. Runs the render loop
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      console.warn('EditorApplication is already running');
      return;
    }

    // Initialize OS detection
    await initOSInfo();

    // Initialize ImGui
    await this.initializeImGui();

    // Initialize theme manager (load persisted theme)
    await ThemeManager.initialize();

    // Apply theme to ImGui
    ThemeManager.applyToImGui();

    // Load fonts if configured
    if (this.fontConfig) {
      await EditorFonts.loadFonts(
        this.fontConfig.mainFontUrl,
        this.fontConfig.iconFontUrl,
      );
    }

    // Determine initial layer based on cached project
    await this.determineInitialLayer();

    // Start the render loop
    this.isRunning = true;

    return new Promise<void>((resolve) => {
      const loop = async (time: number) => {
        if (!this.isRunning) {
          resolve();
          return;
        }

        // Process any pending layer switch
        await this.processPendingLayerSwitch();

        // Handle canvas resize
        this.handleResize();

        // Clear the canvas
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clearColor(
          this._clearColor.r,
          this._clearColor.g,
          this._clearColor.b,
          this._clearColor.a,
        );
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        // Begin ImGui frame
        ImGuiImplWeb.BeginRender();

        // Update and render current layer
        if (this.currentLayer) {
          this.currentLayer.onUpdate(time / 1000);
          this.currentLayer.onRender();
        }

        // End ImGui frame and render
        ImGuiImplWeb.EndRender();

        this.animationFrameId = requestAnimationFrame(loop);
      };

      this.animationFrameId = requestAnimationFrame(loop);
    });
  }

  /**
   * Stop the application and cleanup resources.
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Detach current layer
    if (this.currentLayer) {
      await this.currentLayer.onDetach();
      this.currentLayer = null;
    }
  }

  /**
   * Check if the application is currently running.
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get the WebGL2 rendering context.
   */
  getGL(): WebGL2RenderingContext {
    return this.gl;
  }

  /**
   * Get the canvas element.
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Get the configured clear color.
   */
  getClearColor(): { r: number; g: number; b: number; a: number } {
    return this._clearColor;
  }

  // ============================================================================
  // Layer Switching
  // ============================================================================

  /**
   * Request a switch to the Project Hub layer.
   * The switch happens at the start of the next frame.
   */
  switchToHub(): void {
    this.pendingLayerSwitch = { type: 'hub' };
  }

  /**
   * Request a switch to the Project Hub layer with the "Create New Project" modal open.
   * The switch happens at the start of the next frame.
   */
  switchToHubWithCreateModal(): void {
    this.pendingLayerSwitch = { type: 'hub', openCreateModal: true };
  }

  /**
   * Request a switch to the Project Editor layer.
   * The switch happens at the start of the next frame.
   *
   * @param path - Absolute path to the project folder
   * @param config - Project configuration
   */
  switchToEditor(
    path: string,
    config: { name: string; version: string; engineVersion: string },
  ): void {
    this.pendingLayerSwitch = { type: 'editor', path, config };
  }

  /**
   * Get the currently active layer.
   */
  getCurrentLayer(): EditorApplicationLayer | null {
    return this.currentLayer;
  }

  /**
   * Get the current layer as ProjectEditorLayer (if active).
   */
  getEditorLayer(): ProjectEditorLayer | null {
    if (this.currentLayer instanceof ProjectEditorLayer) {
      return this.currentLayer;
    }
    return null;
  }

  /**
   * Get the current layer as ProjectHubLayer (if active).
   */
  getHubLayer(): ProjectHubLayer | null {
    if (this.currentLayer instanceof ProjectHubLayer) {
      return this.currentLayer;
    }
    return null;
  }

  // ============================================================================
  // Engine Accessors (Convenience API)
  // ============================================================================

  /**
   * Get the game engine from the editor layer.
   * Returns null if the editor layer is not active.
   */
  getEngine(): ReturnType<ProjectEditorLayer['getEngine']> {
    return this.getEditorLayer()?.getEngine() ?? null;
  }

  /**
   * Get the Three.js scene from the editor layer.
   * Returns null if the editor layer is not active.
   */
  getScene(): ReturnType<ProjectEditorLayer['getScene']> {
    return this.getEditorLayer()?.getScene() ?? null;
  }

  /**
   * Get the editor camera from the editor layer.
   * Returns null if the editor layer is not active.
   */
  getEditorCamera(): ReturnType<ProjectEditorLayer['getEditorCamera']> {
    return this.getEditorLayer()?.getEditorCamera() ?? null;
  }

  /**
   * Get the editor manager from the editor layer.
   * Returns null if the editor layer is not active.
   */
  getEditorManager(): ReturnType<ProjectEditorLayer['getEditorManager']> {
    return this.getEditorLayer()?.getEditorManager() ?? null;
  }

  /**
   * Get the editor camera manager from the editor layer.
   * Returns null if the editor layer is not active.
   */
  getEditorCameraManager(): ReturnType<ProjectEditorLayer['getEditorCameraManager']> {
    return this.getEditorLayer()?.getEditorCameraManager() ?? null;
  }

  // ============================================================================
  // Panel & Menu Registration (Convenience API)
  // ============================================================================

  /**
   * Register a panel to be displayed in the editor.
   * If called before the editor layer is active, the panel will be queued
   * and registered when the editor layer becomes active.
   *
   * @param panel - The panel to register
   */
  registerPanel(panel: EditorPanel): void {
    const editorLayer = this.getEditorLayer();
    if (editorLayer) {
      editorLayer.registerPanel(panel);
    } else {
      this.pendingPanels.push(panel);
    }
  }

  /**
   * Get a proxy menu manager for registering menu actions.
   * Actions registered before the editor layer is active will be queued
   * and applied when the editor layer becomes active.
   *
   * @returns A menu manager proxy object
   */
  getMenuManager(): {
    registerMenuAction: (config: MenuActionConfig) => void;
    registerAppMenuAction: (config: Omit<MenuActionConfig, 'path'> & { label: string }) => void;
  } {
    return {
      registerMenuAction: (config: MenuActionConfig) => {
        const editorLayer = this.getEditorLayer();
        if (editorLayer) {
          editorLayer.getMenuManager().registerMenuAction(config);
        } else {
          this.pendingMenuActions.push(config);
        }
      },
      registerAppMenuAction: (config: Omit<MenuActionConfig, 'path'> & { label: string }) => {
        const editorLayer = this.getEditorLayer();
        if (editorLayer) {
          editorLayer.getMenuManager().registerAppMenuAction(config);
        } else {
          this.pendingAppMenuActions.push(config);
        }
      },
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Initialize ImGui with the WebGL context.
   */
  private async initializeImGui(): Promise<void> {
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
   * Determine and set the initial layer based on cached project state.
   */
  private async determineInitialLayer(): Promise<void> {
    try {
      // Check for cached project
      const currentProject = await loadCurrentProject();

      if (currentProject && (await isValidProjectPath(currentProject.projectPath))) {
        // Load project config
        const config = await this.loadProjectConfig(currentProject.projectPath);

        if (config) {
          // Valid cached project - go directly to editor
          this.pendingLayerSwitch = {
            type: 'editor',
            path: currentProject.projectPath,
            config,
          };
          await this.processPendingLayerSwitch();
          return;
        }
      }
    } catch (error) {
      console.warn('Failed to load cached project:', error);
    }

    // No valid cached project - show hub
    this.pendingLayerSwitch = { type: 'hub' };
    await this.processPendingLayerSwitch();
  }

  /**
   * Load and parse a project's configuration file.
   */
  private async loadProjectConfig(
    projectPath: string,
  ): Promise<{ name: string; version: string; engineVersion: string } | null> {
    try {
      const configPath = await EditorFileSystem.joinPath(
        projectPath,
        ProjectFolders.ProjectFile,
      );
      const result = await EditorFileSystem.readTextFromPath(configPath);

      if (!result.success || !result.data) {
        return null;
      }

      // Simple YAML parsing (in production, use a proper YAML parser)
      const lines = result.data.split('\n');
      const data = new Map<string, string>();

      for (const line of lines) {
        const match = line.match(/^(\w+):\s*"?([^"]+)"?\s*$/);
        if (match && match[1] && match[2]) {
          data.set(match[1], match[2]);
        }
      }

      const name = data.get('name');
      const version = data.get('version');
      const engineVersion = data.get('engineVersion');

      if (!name || !version || !engineVersion) {
        return null;
      }

      return { name, version, engineVersion };
    } catch {
      return null;
    }
  }

  /**
   * Process any pending layer switch.
   */
  private async processPendingLayerSwitch(): Promise<void> {
    if (!this.pendingLayerSwitch) return;

    const switchRequest = this.pendingLayerSwitch;
    this.pendingLayerSwitch = null;

    // Detach current layer
    if (this.currentLayer) {
      await this.currentLayer.onDetach();
      this.currentLayer = null;
    }

    // Create and attach new layer
    if (switchRequest.type === 'hub') {
      const hubLayer = new ProjectHubLayer(this);
      this.currentLayer = hubLayer;

      // If requested, open the create modal after attach
      if (switchRequest.openCreateModal) {
        // Schedule modal open for after onAttach completes
        queueMicrotask(() => hubLayer.openCreateModal());
      }
    } else {
      const layerConfig: ProjectEditorLayerConfig = {
        projectPath: switchRequest.path,
        projectConfig: switchRequest.config,
        engineConfig: this.defaultEngineConfig,
      };
      const editorLayer = new ProjectEditorLayer(this, layerConfig);
      this.currentLayer = editorLayer;

      // Apply pending registrations to the editor layer
      this.applyPendingRegistrations(editorLayer);
    }

    await this.currentLayer.onAttach();
  }

  /**
   * Apply any pending panel and menu registrations to the editor layer.
   */
  private applyPendingRegistrations(editorLayer: ProjectEditorLayer): void {
    // Register pending panels
    for (const panel of this.pendingPanels) {
      editorLayer.registerPanel(panel);
    }
    this.pendingPanels = [];

    // Register pending menu actions
    const menuManager = editorLayer.getMenuManager();
    for (const action of this.pendingMenuActions) {
      menuManager.registerMenuAction(action);
    }
    this.pendingMenuActions = [];

    // Register pending app menu actions
    for (const action of this.pendingAppMenuActions) {
      menuManager.registerAppMenuAction(action);
    }
    this.pendingAppMenuActions = [];
  }

  /**
   * Handle canvas resize to match display size.
   */
  private handleResize(): void {
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;

    if (
      this.canvas.width !== displayWidth ||
      this.canvas.height !== displayHeight
    ) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
      this.gl.viewport(0, 0, displayWidth, displayHeight);
    }
  }
}
