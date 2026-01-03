/**
 * ProjectEditorLayer - Full editor with engine integration
 *
 * This layer contains the main editor functionality including:
 * - Panel system (dockable windows)
 * - Dialog system (modal popups)
 * - Engine integration (play/pause/stop)
 * - Editor camera
 * - Native menu bar
 * - Title bar
 */

import { ImGui, ImVec2Helpers } from '@voidscript/imgui';
import {
  EngineApplication,
  type EngineApplicationConfig,
  EditorManager,
  EditorCameraManager,
} from '@voidscript/engine';
import type { Scene } from '@voidscript/renderer';
import { EditorApplicationLayer } from './editor-application-layer.js';
import type { EditorPanel } from '../editor-panel.js';
import type { EditorDialog } from '../editor-dialog.js';
import { MenuManager } from '../menu-manager.js';
import { PanelStateManager } from '../panel-state-manager.js';
import { EditorCamera } from '../editor-camera.js';
import { TitleBar } from '../title-bar.js';
import { EditorPreferencesDialog } from '../editor-preferences-dialog.js';
import {
  clearCurrentProject,
  loadCurrentProject,
  type CurrentProjectData,
} from '../project/current-project-store.js';
import { EditorFileSystem } from '../editor-file-system.js';
import {
  EditorSceneManager,
  type EditorSceneState,
} from '../scene/editor-scene-manager.js';
import { setProjectName, setCurrentSceneFileName } from '../project-info.js';
import { UndoRedoManager } from '../serialization/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the ProjectEditorLayer.
 */
export interface ProjectEditorLayerConfig {
  /** Absolute path to the project root folder */
  projectPath: string;
  /** Parsed project configuration */
  projectConfig: {
    name: string;
    version: string;
    engineVersion: string;
    /** Path to the default scene to load (relative to project root) */
    defaultScene?: string;
  };
  /** Engine configuration (renderer, assets, etc.) */
  engineConfig?: Omit<EngineApplicationConfig, 'window'>;
}

// ============================================================================
// Project Editor Layer
// ============================================================================

/**
 * Project Editor Layer - Main editor UI with full engine integration.
 *
 * This layer is active when a project is open. It manages:
 * - The dockable panel system
 * - Modal dialogs
 * - Engine lifecycle (play/pause/stop)
 * - Editor camera for scene view
 * - Native Tauri menu bar
 * - Title bar with window controls
 */
export class ProjectEditorLayer extends EditorApplicationLayer {
  private config: ProjectEditorLayerConfig;

  // Panels and dialogs
  private panels: EditorPanel[] = [];
  private dialogs: EditorDialog[] = [];

  // Managers
  private readonly menuManager = new MenuManager();
  private readonly panelStateManager = new PanelStateManager();
  private readonly titleBar = new TitleBar();

  // Engine integration
  private engine: EngineApplication | null = null;
  private editorManager: EditorManager | null = null;
  private editorCameraManager: EditorCameraManager | null = null;
  private editorCamera: EditorCamera | null = null;

  // Scene management
  private sceneManager: EditorSceneManager | null = null;

  // Editor state
  private lastPanelStates = new Map<string, boolean>();

  constructor(
    app: import('../editor-application.js').EditorApplication,
    config: ProjectEditorLayerConfig,
  ) {
    super(app);
    this.config = config;
  }

  // ============================================================================
  // Layer Lifecycle
  // ============================================================================

  override async onAttach(): Promise<void> {
    const canvas = this.app.getCanvas();
    const gl = this.app.getGL();

    // Set project name for title bar
    setProjectName(this.config.projectConfig.name);

    // Create engine if config provided
    if (this.config.engineConfig) {
      this.engine = new EngineApplication({
        window: { canvas },
        ...this.config.engineConfig,
      });

      await this.engine.initialize();

      // Create editor managers
      this.editorManager = new EditorManager(this.engine.getScene(), () =>
        this.engine!.createCommands(),
      );
      this.engine.insertResource(this.editorManager);

      this.editorCameraManager = new EditorCameraManager(
        this.engine.getRenderer(),
      );
      this.engine.insertResource(this.editorCameraManager);

      // Create editor camera for scene view
      this.editorCamera = new EditorCamera({
        position: { x: 5, y: 5, z: 5 },
        lookAt: { x: 0, y: 0, z: 0 },
      });

      // Initialize scene manager
      this.sceneManager = new EditorSceneManager(this.engine, {
        projectPath: this.config.projectPath,
        onStateChange: (state) => this.onSceneStateChange(state),
      });

      // Load initial scene with priority:
      // 1. lastOpenedScene from project cache
      // 2. defaultScene from project config
      // 3. New empty scene
      const initialScenePath = await this.determineInitialScene();
      if (initialScenePath) {
        const result = await this.sceneManager.openScene(initialScenePath);
        if (!result.success) {
          // Fallback to new scene
          await this.sceneManager.newScene();
        }
      } else {
        await this.sceneManager.newScene();
      }
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

    // Register built-in dialogs
    this.registerDialog(new EditorPreferencesDialog());

    // Register built-in menu actions
    this.menuManager.registerMenuAction({
      path: 'File/New Project...',
      shortcut: 'CmdOrCtrl+Shift+N',
      action: () => {
        // Clear current project and switch to hub with create modal open
        void clearCurrentProject().then(() => {
          this.app.switchToHubWithCreateModal();
        });
      },
    });

    // Edit menu - Undo/Redo
    this.menuManager.registerMenuAction({
      path: 'Edit/Undo',
      shortcut: 'CmdOrCtrl+Z',
      action: () => {
        const undoRedo = UndoRedoManager.instance;
        if (undoRedo.canUndo) {
          undoRedo.undo();
        }
      },
    });

    this.menuManager.registerMenuAction({
      path: 'Edit/Redo',
      shortcut: 'CmdOrCtrl+Shift+Z',
      action: () => {
        const undoRedo = UndoRedoManager.instance;
        if (undoRedo.canRedo) {
          undoRedo.redo();
        }
      },
    });

    // Scene menu - Debug options
    this.menuManager.registerMenuAction({
      path: 'Scene/Log Current Serialized Scene',
      action: () => {
        const serializedScene = this.sceneManager?.getSerializedScene();
        if (serializedScene) {
          console.log('SerializedScene:', serializedScene);
          console.log('SceneData:', JSON.stringify(serializedScene.getSceneData(), null, 2));
          console.log('isDirty:', serializedScene.isDirty);
          console.log('isSavedToDisk:', serializedScene.isSavedToDisk);
          console.log('relativePath:', serializedScene.relativePath);
        } else {
          console.log('No SerializedScene available');
        }
      },
    });

    // Build and set native Tauri menu bar
    await this.menuManager.buildAndSetMenu();

    // Register global keyboard shortcuts
    await this.menuManager.registerShortcuts();

    // Initialize title bar (sets up Tauri window controls)
    await this.titleBar.initialize();
  }

  override async onDetach(): Promise<void> {
    // Save panel states
    await this.panelStateManager.saveImmediate(this.panels);

    // Unregister keyboard shortcuts
    await this.menuManager.unregisterShortcuts();

    // Stop engine if running
    if (this.engine) {
      this.engine.stop();
      this.engine = null;
    }

    // Clear references
    this.editorManager = null;
    this.editorCameraManager = null;
    this.editorCamera = null;
    this.sceneManager = null;
    this.panels = [];
    this.dialogs = [];
  }

  override onUpdate(deltaTime: number): void {
    if (this.engine) {
      // Game logic runs at full FPS
      this.engine.updateOnly();
    }
  }

  override onRender(): void {
    // Always render the editor UI - ImGui needs consistent frame content
    // Throttling should happen at the application level if needed, not here
    this.renderEditorUI();
  }

  // ============================================================================
  // Panel Management
  // ============================================================================

  /**
   * Register a panel to be rendered each frame.
   */
  registerPanel(panel: EditorPanel): void {
    this.panels.push(panel);

    // Set application reference so panel can access engine, renderer, etc.
    panel.setApplication(this.app);

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
   * Unregister a panel.
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
   * Get all registered panels.
   */
  getPanels(): readonly EditorPanel[] {
    return this.panels;
  }

  // ============================================================================
  // Dialog Management
  // ============================================================================

  /**
   * Register a dialog to be rendered each frame.
   */
  registerDialog(dialog: EditorDialog): void {
    this.dialogs.push(dialog);

    // Set application reference
    dialog.setApplication(this.app);

    // Register with menu manager if it has a menuPath
    if (dialog.menuPath) {
      this.menuManager.registerMenuAction({
        path: dialog.menuPath,
        shortcut: dialog.shortcut,
        action: () => dialog.open(),
      });
    }
  }

  /**
   * Unregister a dialog.
   */
  unregisterDialog(dialog: EditorDialog): boolean {
    const index = this.dialogs.indexOf(dialog);
    if (index !== -1) {
      this.dialogs.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all registered dialogs.
   */
  getDialogs(): readonly EditorDialog[] {
    return this.dialogs;
  }

  // ============================================================================
  // Engine Accessors
  // ============================================================================

  /**
   * Get the wrapped EngineApplication.
   */
  getEngine(): EngineApplication | null {
    return this.engine;
  }

  /**
   * Get the EditorManager.
   */
  getEditorManager(): EditorManager | null {
    return this.editorManager;
  }

  /**
   * Get the EditorCameraManager.
   */
  getEditorCameraManager(): EditorCameraManager | null {
    return this.editorCameraManager;
  }

  /**
   * Get the EditorCamera for scene view rendering.
   */
  getEditorCamera(): EditorCamera | null {
    return this.editorCamera;
  }

  /**
   * Get the shared scene from the engine's renderer.
   */
  getScene(): Scene | null {
    return this.engine?.getRenderer().getScene() ?? null;
  }

  // ============================================================================
  // Project Info
  // ============================================================================

  /**
   * Get the project path.
   */
  getProjectPath(): string {
    return this.config.projectPath;
  }

  /**
   * Get the project configuration.
   */
  getProjectConfig(): ProjectEditorLayerConfig['projectConfig'] {
    return this.config.projectConfig;
  }

  /**
   * Close the current project and return to the hub.
   */
  async closeProject(): Promise<void> {
    // Clear the current project from persistence
    await clearCurrentProject();

    // Switch to hub layer
    this.app.switchToHub();
  }

  // ============================================================================
  // Managers
  // ============================================================================

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
   */
  async savePanelStates(): Promise<void> {
    await this.panelStateManager.save(this.panels);
  }

  /**
   * Get the scene manager for scene state control.
   */
  getSceneManager(): EditorSceneManager | null {
    return this.sceneManager;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Determine the initial scene to load based on priority:
   * 1. lastOpenedScene from project cache (if exists and valid)
   * 2. defaultScene from project config (if exists and valid)
   * 3. null (create empty scene)
   */
  private async determineInitialScene(): Promise<string | null> {
    const { projectPath, projectConfig } = this.config;

    // 1. Check lastOpenedScene from project cache
    const currentProject = await loadCurrentProject();
    if (currentProject?.lastOpenedScene) {
      const absolutePath = await EditorFileSystem.joinPath(
        projectPath,
        currentProject.lastOpenedScene,
      );
      if (await EditorFileSystem.existsAtPath(absolutePath)) {
        return absolutePath;
      }
    }

    // 2. Check defaultScene from project config
    if (projectConfig.defaultScene) {
      const absolutePath = await EditorFileSystem.joinPath(
        projectPath,
        projectConfig.defaultScene,
      );
      if (await EditorFileSystem.existsAtPath(absolutePath)) {
        return absolutePath;
      }
    }

    // 3. No scene to load - will create empty scene
    return null;
  }

  /**
   * Called when scene state changes (dirty, path, etc.)
   */
  private onSceneStateChange(state: EditorSceneState): void {
    // Update title bar with scene name and dirty indicator
    const { displayName, isDirty } = state;
    const sceneIndicator = isDirty ? `${displayName}*` : displayName;
    setCurrentSceneFileName(sceneIndicator);
  }

  /**
   * Render the editor UI (ImGui + panels)
   * Note: BeginRender()/EndRender() is handled by the parent EditorApplication
   */
  private renderEditorUI(): void {
    // Reset WebGL state after Three.js (if engine is running)
    if (this.engine) {
      this.engine.getRenderer().resetState();
    }

    // Render dockspace and panels (ImGui frame already begun by EditorApplication)
    this.renderDockspace();
  }

  /**
   * Render the root dockspace that fills the entire viewport
   */
  private renderDockspace(): void {
    // Render title bar first (at top of screen)
    this.titleBar.render();

    // Get viewport info
    const dockspacePos = ImVec2Helpers.GetMainViewportPos();
    const dockspaceSize = ImVec2Helpers.GetMainViewportSize();
    const viewportID = ImVec2Helpers.GetMainViewportID();

    // Offset dockspace to account for title bar height
    const titleBarHeight = this.titleBar.getHeight();
    const adjustedPos = {
      x: dockspacePos.x,
      y: dockspacePos.y + titleBarHeight,
    };
    const adjustedSize = {
      x: dockspaceSize.x,
      y: dockspaceSize.y - titleBarHeight,
    };

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

      // Render all registered panels
      for (const panel of this.panels) {
        panel.render();
      }

      // Render all registered dialogs
      for (const dialog of this.dialogs) {
        dialog.render();
      }

      // Check for panel state changes and auto-save
      this.checkAndSavePanelStates();
    } else {
      ImGui.PopStyleVar(3);
    }
    ImGui.End();
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
      void this.panelStateManager.save(this.panels);
    }
  }
}
