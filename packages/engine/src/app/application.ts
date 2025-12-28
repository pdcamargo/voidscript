/**
 * Application - Enhanced main application class with Layer system
 *
 * Integrates:
 * - ECS (World, Command, Scheduler)
 * - Layer stack for modular game logic
 * - Event system for input handling
 * - Three.js renderer
 * - ImGui support
 *
 * @example
 * ```ts
 * const app = new Application({
 *   window: { canvas: 'canvas', title: 'My Game' },
 *   renderer: { clearColor: 0x1a1a2e },
 *   imgui: { enableDocking: true },
 * });
 *
 * app.pushLayer(new GameLayer());
 * await app.run();
 * ```
 */

import { World } from "../ecs/world.js";
import { Command } from "../ecs/command.js";
import { Scheduler, type SystemPhase } from "../ecs/scheduler.js";
import type { SystemWrapper } from "../ecs/system.js";
import { Layer, LayerStack } from "./layer.js";
import { Window, type WindowConfig } from "./window.js";
import { Renderer, type RendererConfig } from "./renderer.js";
import { ImGuiLayer, type ImGuiLayerConfig } from "./layers/imgui-layer.js";
import type { AppEvent, WindowResizeEvent } from "./events.js";
import { EventType, EventDispatcher } from "./events.js";

// Built-in systems and managers
import { TweenManager } from "../animation/tween.js";
import { AnimationManager } from "../animation/animation-manager.js";
import { tweenUpdateSystem } from "../ecs/systems/tween-system.js";
import { animationUpdateSystem } from "../ecs/systems/animation-system.js";
import { SpriteRenderManager, spriteSyncSystem } from "../ecs/systems/sprite-sync-system.js";
import {
  Render3DManager,
  transformPropagationSystem,
  render3DSyncSystem,
} from "../ecs/systems/renderer-sync-system.js";
import { cameraSyncSystem } from "../ecs/systems/camera-sync-system.js";
import { virtualCameraFollowSystem } from "../ecs/systems/virtual-camera-follow-system.js";
import { virtualCameraSelectionSystem } from "../ecs/systems/virtual-camera-selection-system.js";
import { cameraBrainSystem } from "../ecs/systems/camera-brain-system.js";
import {
  Water2DRenderManager,
  water2DSyncSystem,
} from "../ecs/systems/water-2d-system.js";
import {
  SkyGradientRenderManager,
  skyGradient2DSystem,
} from "../ecs/systems/sky-gradient-system.js";
import {
  Fog2DRenderManager,
  fog2DSyncSystem,
} from "../ecs/systems/rendering/fog-2d-system.js";
import {
  Rain2DRenderManager,
  rain2DSyncSystem,
} from "../ecs/systems/rain-2d-system.js";
import {
  LightningField2DRenderManager,
  lightningField2DSyncSystem,
} from "../ecs/systems/lightning-field-2d-system.js";
import { TiledAssetRegistry } from "../tiled/tiled-asset-registry.js";
import { TilemapRenderManager } from "../tiled/tilemap-render-manager.js";
import {
  tiledMapLoaderSystem,
  tiledObjectSpawnerSystem,
  tiledTileLayerSyncSystem,
  tiledAnimationSystem,
  tiledTilesetCollisionSystem,
  tiledObjectCollisionSystem,
} from "../tiled/systems/index.js";
import { AssetDatabase, type AssetsConfig } from "../ecs/asset-database.js";
import { EditorCameraManager } from "./editor-camera-manager.js";
import { EditorManager } from "../editor/editor-manager.js";
import { ConsoleLogger } from "./console-logger.js";
import { PostProcessingManager } from "../post-processing/managers/post-processing-manager.js";

// Physics systems (2D and 3D)
import {
  physics2DComponentSyncSystem,
  physics2DSyncSystem,
  physics2DCleanupSystem,
  Physics2DContext,
  physics2DCollisionEventSystem,
} from "../physics/2d/index.js";
import {
  physics3DComponentSyncSystem,
  physics3DSyncSystem,
  physics3DCleanupSystem,
  Physics3DContext,
  physics3DCollisionEventSystem,
} from "../physics/3d/index.js";
import {
  CollisionStarted2D,
  CollisionEnded2D,
  CollisionStarted3D,
  CollisionEnded3D,
  ContactForce2D,
  ContactForce3D,
  TriggerZoneEnter2D,
  TriggerZoneLeave2D,
  TriggerZoneEnter3D,
  TriggerZoneLeave3D,
} from "../physics/collision/index.js";

// Trigger zone systems
import {
  triggerZone2DSystem,
  triggerZone3DSystem,
} from "../ecs/systems/trigger/index.js";

// UI systems
import { UIManager } from "../ui/ui-manager.js";
import { UIViewportBounds } from "../ui/ui-viewport-bounds.js";
import { UIInteractionManager } from "../ui/ui-interaction.js";
import {
  uiCanvasSyncSystem,
  uiBlockSyncSystem,
  uiTextSyncSystem,
  uiButtonSyncSystem,
  uiUpdateSystem,
  uiRenderSystem,
} from "../ui/ui-systems.js";
import {
  setupUIInteractionEvents,
  uiInteractionUpdateSystem,
} from "../ui/ui-interaction-event-system.js";
import { UIInteraction } from "../ui/components/ui-interaction.js";

// Post-processing system
import { postProcessingSystem } from "../ecs/systems/post-processing-system.js";

// Audio systems
import { AudioManager } from "../ecs/systems/audio-manager.js";
import { audioSyncSystem } from "../ecs/systems/audio-sync-system.js";

// Play mode cleanup
import { setupPlayModeCleanup } from "../ecs/systems/play-mode-cleanup-system.js";

// Generator systems
import { spriteAreaGeneratorSystem } from "../ecs/systems/sprite-area-generator-system.js";

// Event system
import { Events, type EventClass } from "../ecs/events.js";

// Editor and world loading
import type { EditorPlatform } from "../editor/editor-platform.js";
import { WebPlatform } from "../editor/editor-platform.js";
import { EditorLayer, type EditorConfig as EditorLayerConfig } from "../editor/editor-layer.js";
import type { MenuBarCallbacks } from "./imgui/menu-bar.js";
import type { WorldData } from "../ecs/serialization/schemas.js";
import { WorldLoader } from "./world-loader.js";

/**
 * Default world configuration for loading a scene on startup
 */
export interface DefaultWorldConfig {
  /**
   * Path to world JSON file (fetched at runtime) OR inline WorldData object.
   * - String path: Will be fetched using platform or native fetch
   * - WorldData object: Will be used directly
   */
  source: string | WorldData;

  /**
   * Whether to auto-load on application start
   * @default true
   */
  autoLoad?: boolean;
}

/**
 * Editor configuration for enabling the built-in editor UI.
 * Used in ApplicationConfig to configure the editor at application level.
 */
export interface AppEditorConfig {
  /**
   * Enable editor mode. When true, shows editor UI with Scene/Game views.
   * When false or undefined, renders game fullscreen without editor.
   * @default true when EditorConfig is provided
   */
  enabled?: boolean;

  /**
   * Show Scene View panel
   * @default true
   */
  showSceneView?: boolean;

  /**
   * Show Game View panel
   * @default true
   */
  showGameView?: boolean;

  /**
   * Show Debug panel
   * @default true
   */
  showDebugPanel?: boolean;

  /**
   * Show debug helpers for entities (colliders, cameras, etc.)
   * @default true
   */
  showHelpers?: boolean;

  /**
   * Callback when entering play mode
   */
  onPlay?: () => void;

  /**
   * Callback when exiting play mode (stop)
   */
  onStop?: () => void;

  /**
   * Callback when pausing
   */
  onPause?: () => void;

  /**
   * Custom menu bar callbacks
   */
  menuCallbacks?: Partial<MenuBarCallbacks>;
}

/**
 * Application configuration options
 */
export interface ApplicationConfig {
  /** Window configuration */
  window: WindowConfig;

  /** Renderer configuration */
  renderer?: RendererConfig;

  /** ImGui configuration (set to false to disable ImGui) */
  imgui?: ImGuiLayerConfig | false;

  /** Target FPS for fixed update (default: auto-detect, minimum 60) */
  targetFPS?: number;

  /** Fixed timestep in seconds (default: 1/targetFPS) */
  fixedDeltaTime?: number;

  /**
   * Asset configuration (optional)
   * Maps GUID -> AssetConfig for centralized asset management
   *
   * @example
   * ```typescript
   * assets: {
   *   "player-texture-guid": {
   *     type: AssetType.Texture,
   *     path: "/textures/player.png",
   *     magFilter: TextureFilter.Nearest,
   *   }
   * }
   * ```
   */
  assets?: AssetsConfig;

  /**
   * Path to asset manifest JSON file (optional)
   * Assets from this file will be merged with code-based assets.
   * Manifest assets take priority on GUID conflicts.
   *
   * The JSON format matches the assets config structure:
   * ```json
   * {
   *   "player-texture": {
   *     "type": "texture",
   *     "path": "/textures/player.png",
   *     "magFilter": "nearest"
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * assetsManifest: '/assets/manifest.json'
   * ```
   */
  assetsManifest?: string;

  /** Physics configuration (optional) */
  physics?: PhysicsConfig;

  /**
   * Platform abstraction for file operations.
   * Used for loading default world and editor file dialogs.
   * If not provided, falls back to WebPlatform (fetch for loading, download for saving).
   */
  platform?: EditorPlatform;

  /**
   * Default world to load on startup.
   * Can be a path string (fetched) or inline WorldData object.
   */
  defaultWorld?: DefaultWorldConfig;

  /**
   * Editor configuration.
   * Set to false to disable editor, or provide AppEditorConfig to enable.
   * When omitted, editor is disabled.
   */
  editor?: AppEditorConfig | false;
}

/**
 * Physics configuration
 */
export interface PhysicsConfig {
  /** Enable 2D physics (default: false) */
  enable2D?: boolean;

  /** Enable 3D physics (default: false) */
  enable3D?: boolean;

  /** Gravity for 2D physics in pixels/second² (default: {x: 0, y: -980}) */
  gravity2D?: { x: number; y: number };

  /** Gravity for 3D physics in meters/second² (default: {x: 0, y: -9.81, z: 0}) */
  gravity3D?: { x: number; y: number; z: number };
}

/**
 * Application - Main entry point for game applications
 *
 * Manages the game loop, layers, ECS, rendering, and input.
 */
export class Application {
  // ============================================================================
  // ECS
  // ============================================================================

  /** ECS World (for advanced use - prefer using commands in systems) */
  readonly world: World;

  /** System scheduler for ECS systems (private - use addSystem methods) */
  private readonly scheduler: Scheduler;

  /** Command API for entity manipulation (private - systems receive via args) */
  private readonly commands: Command;

  // ============================================================================
  // Core Systems
  // ============================================================================

  private window: Window;
  private renderer: Renderer;
  private layerStack: LayerStack;
  private imguiLayer: ImGuiLayer | null = null;

  // ============================================================================
  // Runtime State
  // ============================================================================

  private isRunning = false;
  private isPaused = false;
  private lastFrameTime = 0;
  private accumulator = 0;
  private targetFPS: number;
  private fixedDeltaTime: number;

  // FPS tracking
  private currentFPS = 0;
  private frameCount = 0;
  private totalFrameCount = 0;
  private fpsUpdateTime = 0;
  private fpsFrameCount = 0;
  private startTime = 0;

  // Delta time tracking
  private deltaTime = 0;

  // Singleton
  private static instance: Application | null = null;

  // ============================================================================
  // Resources (Bevy-inspired singleton storage)
  // ============================================================================

  /** Resource storage by type (Constructor → instance) */
  private readonly resources = new Map<unknown, unknown>();

  /** Stored application config (for physics system access) */
  private readonly config: ApplicationConfig;

  // ============================================================================
  // Editor and World Loading
  // ============================================================================

  /** Platform abstraction for file operations */
  private readonly platform: EditorPlatform;

  /** Editor layer instance (if editor is enabled) */
  private editorLayer: EditorLayer | null = null;

  constructor(config: ApplicationConfig) {
    // Store config for later access by physics systems
    this.config = config;

    // Initialize platform (used for file operations)
    this.platform = config.platform ?? new WebPlatform();

    // Initialize AssetDatabase first (before ECS/systems)
    // This ensures assets are available when systems initialize
    AssetDatabase.initialize(config.assets);

    // Initialize ECS
    this.world = new World();
    this.scheduler = new Scheduler();
    // Command needs to be created after this is partially initialized
    // but before addBuiltInSystems is called
    this.commands = new Command(this.world, this);
    this.layerStack = new LayerStack();

    // Initialize window
    this.window = new Window(config.window);
    this.window.setEventCallback((event) => this.onEvent(event));

    // Initialize renderer
    this.renderer = new Renderer(this.window, config.renderer);

    // Initialize ImGui (unless disabled)
    if (config.imgui !== false) {
      this.imguiLayer = new ImGuiLayer(config.imgui ?? {});
    }

    // Configure fixed timestep
    this.targetFPS = config.targetFPS ?? 60;
    this.fixedDeltaTime = config.fixedDeltaTime ?? 1 / this.targetFPS;

    // Set singleton
    Application.instance = this;

    // Register built-in systems automatically
    this.addBuiltInSystems();
  }

  /**
   * Get the singleton application instance
   * @throws Error if no application has been created
   */
  static get(): Application {
    if (!Application.instance) {
      throw new Error("Application not created");
    }
    return Application.instance;
  }

  /**
   * Check if an application instance exists
   */
  static exists(): boolean {
    return Application.instance !== null;
  }

  /**
   * Run the application
   * Initializes all systems and starts the game loop
   */
  async run(): Promise<void> {
    // Load asset manifest if specified (before other initialization)
    await this.loadAssetManifest();

    // Detect target FPS if not specified
    if (this.targetFPS === 60) {
      const detectedFPS = await this.detectTargetFPS();
      this.targetFPS = Math.max(detectedFPS, 60);
      this.fixedDeltaTime = 1 / this.targetFPS;
      console.log(
        `Target FPS: ${this.targetFPS} (detected: ${detectedFPS})`
      );
    }

    // Initialize ImGui layer (async)
    if (this.imguiLayer) {
      this.imguiLayer._setApplication(this);
      await this.imguiLayer.onAttach();
      this.layerStack.pushOverlay(this.imguiLayer);

      // Set initial display size with pixel ratio for Retina/HiDPI support
      const pixelRatio = this.window.getPixelRatio();
      this.imguiLayer.updateDisplaySize(
        this.window.getWidth(),
        this.window.getHeight(),
        pixelRatio
      );
    }

    // Setup editor if enabled (must happen before user layers are attached)
    if (this.isEditorEnabled()) {
      this.setupEditorInternal();
    }

    // Attach all existing layers (including EditorLayer if just added)
    for (const layer of this.layerStack) {
      if (layer !== this.imguiLayer) {
        layer._setApplication(this);
        await layer.onAttach();
      }
    }

    // Load default world (after layers are attached so EditorLayer can cache path)
    await this.loadDefaultWorld();

    // Run startup systems
    this.scheduler.executeSystems("earlyStartup", { commands: this.commands });
    this.scheduler.executeSystems("startup", { commands: this.commands });
    this.scheduler.executeSystems("lateStartup", { commands: this.commands });
    this.world.flushEvents();

    // Start game loop
    this.isRunning = true;
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.fpsUpdateTime = this.startTime;
    this.frameCount = 0;
    this.totalFrameCount = 0;
    this.currentFPS = 0;
    this.fpsFrameCount = 0;

    this.gameLoop();
  }

  /**
   * Stop the application
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Pause the game loop (stops updates, continues rendering)
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume the game loop
   */
  resume(): void {
    this.isPaused = false;
    this.lastFrameTime = performance.now();
    this.accumulator = 0;
  }

  /**
   * Main game loop
   */
  private gameLoop(): void {
    if (!this.isRunning) {
      this.shutdown();
      return;
    }

    const currentTime = performance.now();
    this.deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
    this.lastFrameTime = currentTime;

    // Clamp delta time to prevent spiral of death
    if (this.deltaTime > 0.25) {
      this.deltaTime = 0.25;
    }

    // Update frame counters
    this.frameCount++;
    this.totalFrameCount++;
    this.fpsFrameCount++;

    // Update FPS every second
    if (currentTime - this.fpsUpdateTime >= 1000) {
      this.currentFPS = this.fpsFrameCount;
      this.fpsFrameCount = 0;
      this.fpsUpdateTime = currentTime;
    }

    if (!this.isPaused) {
      // === UPDATE PHASE ===
      this.scheduler.executeSystems("earlyUpdate", {
        commands: this.commands,
      });

      // Layer updates
      for (const layer of this.layerStack) {
        layer.onUpdate(this.deltaTime);
      }

      this.scheduler.executeSystems("update", { commands: this.commands });
      this.scheduler.executeSystems("lateUpdate", { commands: this.commands });

      // === FIXED UPDATE PHASE ===
      this.accumulator += this.deltaTime;
      while (this.accumulator >= this.fixedDeltaTime) {
        this.scheduler.executeSystems("earlyFixedUpdate", {
          commands: this.commands,
        });

        for (const layer of this.layerStack) {
          layer.onFixedUpdate(this.fixedDeltaTime);
        }

        this.scheduler.executeSystems("fixedUpdate", {
          commands: this.commands,
        });
        this.scheduler.executeSystems("lateFixedUpdate", {
          commands: this.commands,
        });

        this.accumulator -= this.fixedDeltaTime;
      }

      // Flush ECS events
      this.world.flushEvents();
    }

    // === RENDER PHASE ===
    this.scheduler.executeSystems("earlyRender", { commands: this.commands });

    // Begin Three.js frame
    this.renderer.beginFrame();

    // Layer render callbacks
    for (const layer of this.layerStack) {
      layer.onRender();
    }

    this.scheduler.executeSystems("render", { commands: this.commands });

    // Render Three.js scene (skip if editor viewports are handling rendering)
    const editorMgr = this.getResource(EditorManager);
    if (!editorMgr?.useViewportRendering) {
      // Use the render pipeline (includes post-processing effects via EffectComposer)
      this.renderer.renderPipeline(
        this.renderer.getScene(),
        this.renderer.getCamera(),
        this.deltaTime
      );
    }

    this.scheduler.executeSystems("lateRender", { commands: this.commands });

    // Reset WebGL state after Three.js (required before ImGui)
    this.renderer.resetState();

    // Ensure viewport is reset to full canvas size before ImGui renders
    this.renderer.resetViewport();

    // === IMGUI RENDER PHASE (after Three.js, renders on top) ===
    if (this.imguiLayer?.isInitialized()) {
      this.imguiLayer.beginFrame();

      for (const layer of this.layerStack) {
        layer.onImGuiRender();
      }

      this.imguiLayer.endFrame();
    }

    // After render
    this.scheduler.executeSystems("afterRender", { commands: this.commands });

    // Clear EditorManager step request (if any) after frame completes
    const editorManager = this.getResource(EditorManager);
    if (editorManager?.isStepRequested()) {
      editorManager.clearStepRequest();
    }

    // End frame
    this.window.endFrame();

    // Advance event frame counter and clean up old events
    const events = this.getResource(Events);
    if (events) {
      events.onFrameEnd();
    }

    // Schedule next frame
    requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * Handle events from Window
   */
  private onEvent(event: AppEvent): void {
    const dispatcher = new EventDispatcher(event);

    // Handle window resize
    dispatcher.dispatch<WindowResizeEvent>(EventType.WindowResize, (e) => {
      // NOTE: We intentionally do NOT update pixel ratio on resize.
      // We keep pixelRatio at 1 to avoid conflicts between Three.js and jsimgui.
      // See renderer.ts constructor comment for details.
      this.renderer.onResize(e.width, e.height);

      // Update ImGui display size (pixelRatio=1 since we disabled Retina scaling)
      if (this.imguiLayer) {
        this.imguiLayer.updateDisplaySize(e.width, e.height, 1);
      }

      // Also resize editor camera
      const editorCameraManager = this.getResource(EditorCameraManager);
      if (editorCameraManager) {
        editorCameraManager.onResize(e.width, e.height);
      }

      // Also resize UI camera
      const uiManager = this.getResource(UIManager);
      if (uiManager) {
        uiManager.onResize(e.width, e.height);
      }

      return false; // Don't consume resize events
    });

    // Propagate to layers (reverse order - overlays first)
    for (const layer of this.layerStack.reverse()) {
      if (event.handled) break;
      event.handled = layer.onEvent(event);
    }
  }

  /**
   * Detect target FPS by measuring frame rate
   */
  private async detectTargetFPS(sampleFrames = 60): Promise<number> {
    return new Promise((resolve) => {
      const frameTimes: number[] = [];
      let frameCount = 0;
      let lastTime = performance.now();

      const measureFrame = () => {
        const currentTime = performance.now();
        frameTimes.push(currentTime - lastTime);
        lastTime = currentTime;
        frameCount++;

        if (frameCount < sampleFrames) {
          requestAnimationFrame(measureFrame);
        } else {
          const avgDelta =
            frameTimes.reduce((a, b) => a + b) / frameTimes.length;
          resolve(Math.round(1000 / avgDelta));
        }
      };

      requestAnimationFrame(measureFrame);
    });
  }

  /**
   * Shutdown and cleanup
   */
  private shutdown(): void {
    // Detach all layers
    for (const layer of this.layerStack) {
      layer.onDetach();
      layer._setApplication(null);
    }
    this.layerStack.clear();

    // Cleanup renderer and window
    this.renderer.destroy();
    this.window.destroy();

    // Clear ECS
    this.world.clear();
    this.scheduler.clear();

    // Stop console interception
    const consoleLogger = this.getResource(ConsoleLogger);
    if (consoleLogger) {
      consoleLogger.stopIntercepting();
    }

    // Clear resources
    this.resources.clear();

    // Clear singleton
    if (Application.instance === this) {
      Application.instance = null;
    }
  }

  // ============================================================================
  // Editor and World Loading (Internal)
  // ============================================================================

  /** localStorage key for caching scene path */
  private static readonly LAST_SCENE_PATH_KEY = 'voidscript-editor-last-scene-path';

  /**
   * Check if editor mode is enabled
   */
  isEditorEnabled(): boolean {
    const editorConfig = this.config.editor;
    return editorConfig !== undefined &&
           editorConfig !== false &&
           (editorConfig.enabled ?? true);
  }

  /**
   * Get the platform abstraction
   */
  getPlatform(): EditorPlatform {
    return this.platform;
  }

  /**
   * Set up the editor internally (called from run() if editor is enabled)
   */
  private setupEditorInternal(): void {
    const editorConfig = this.config.editor as AppEditorConfig;

    // Create EditorManager
    const editorManager = new EditorManager(
      this.world,
      () => this.getCommands()
    );

    // Subscribe to mode changes
    if (editorConfig.onPlay || editorConfig.onStop || editorConfig.onPause) {
      editorManager.addEventListener((event) => {
        if (event.type === 'mode-changed') {
          if (event.to === 'play' && event.from === 'edit') {
            editorConfig.onPlay?.();
          } else if (event.to === 'edit' && (event.from === 'play' || event.from === 'pause')) {
            editorConfig.onStop?.();
          } else if (event.to === 'pause' && event.from === 'play') {
            editorConfig.onPause?.();
          }
        }
      });
    }

    // Setup play mode cleanup (disposes render managers when stopping)
    // This must be registered BEFORE the resource is inserted
    setupPlayModeCleanup(editorManager, () => this.getCommands());

    // Register EditorManager resource
    this.insertResource(editorManager);

    // Create and push EditorLayer
    const layerConfig: EditorLayerConfig = {
      platform: this.platform,
      showSceneView: editorConfig.showSceneView,
      showGameView: editorConfig.showGameView,
      showDebugPanel: editorConfig.showDebugPanel,
      showHelpers: editorConfig.showHelpers,
      menuCallbacks: editorConfig.menuCallbacks,
      onPlay: editorConfig.onPlay,
      onStop: editorConfig.onStop,
      onPause: editorConfig.onPause,
    };

    this.editorLayer = new EditorLayer(layerConfig);
    this.pushLayer(this.editorLayer);

    console.log('[Application] Editor initialized');
  }

  /**
   * Load asset manifest from JSON file (called from run())
   * Assets from the manifest are merged with any code-based assets.
   */
  private async loadAssetManifest(): Promise<void> {
    const manifestPath = this.config.assetsManifest;
    if (!manifestPath) {
      return;
    }

    console.log(`[Application] Loading asset manifest from: ${manifestPath}`);

    try {
      // Try to load via fetch first (works for web and Vite dev server)
      let jsonString: string;
      try {
        const response = await fetch(manifestPath);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        jsonString = await response.text();
      } catch {
        // Fallback to platform file reading (for native apps like Tauri)
        jsonString = await this.platform.readTextFile(manifestPath);
      }

      const assets = AssetDatabase.parseAssetsJson(jsonString);
      const assetCount = Object.keys(assets).length;

      AssetDatabase.registerAdditionalAssets(assets);
      console.log(`[Application] Loaded ${assetCount} assets from manifest`);
    } catch (error) {
      console.error(`[Application] Failed to load asset manifest:`, error);
    }
  }

  /**
   * Load the default world (called from run())
   */
  private async loadDefaultWorld(): Promise<void> {
    const defaultWorldConfig = this.config.defaultWorld;
    const isEditorMode = this.isEditorEnabled();

    console.log(`[Application] loadDefaultWorld called - isEditorMode: ${isEditorMode}, hasDefaultWorld: ${!!defaultWorldConfig}`);

    // In editor mode, check localStorage for cached scene path first
    if (isEditorMode) {
      const cachedPath = this.getCachedScenePath();
      if (cachedPath) {
        try {
          const success = await this.loadWorldFromPath(cachedPath);
          if (success) {
            console.log(`[Application] Loaded cached scene: ${cachedPath}`);
            return;
          }
        } catch (e) {
          console.warn(`[Application] Failed to load cached scene, falling back to default:`, e);
          this.clearCachedScenePath();
        }
      }
    }

    // No default world config - nothing else to load
    if (!defaultWorldConfig) {
      return;
    }

    // Check if auto-load is enabled (default: true)
    if (defaultWorldConfig.autoLoad === false) {
      return;
    }

    // Load default world
    const loader = new WorldLoader({
      platform: this.platform,
      assetMetadataResolver: (guid) => AssetDatabase.getMetadata(guid),
    });

    const result = await loader.load(
      this.world,
      this.commands,
      defaultWorldConfig.source
    );

    if (result.success) {
      console.log(`[Application] Default world loaded: ${result.entitiesCreated} entities`);
    } else {
      console.error(`[Application] Failed to load default world: ${result.error}`);
    }
  }

  /**
   * Load world from a file path
   */
  private async loadWorldFromPath(path: string): Promise<boolean> {
    const loader = new WorldLoader({
      platform: this.platform,
      assetMetadataResolver: (guid) => AssetDatabase.getMetadata(guid),
    });

    const result = await loader.load(this.world, this.commands, path);
    return result.success;
  }

  /**
   * Get cached scene path from localStorage (editor mode only)
   */
  private getCachedScenePath(): string | null {
    try {
      return localStorage.getItem(Application.LAST_SCENE_PATH_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Clear cached scene path from localStorage
   */
  private clearCachedScenePath(): void {
    try {
      localStorage.removeItem(Application.LAST_SCENE_PATH_KEY);
    } catch {
      // Ignore
    }
  }

  // ============================================================================
  // Layer Management
  // ============================================================================

  /**
   * Push a layer onto the stack
   * @returns The layer for chaining
   */
  pushLayer<T extends Layer>(layer: T): T {
    layer._setApplication(this);
    this.layerStack.pushLayer(layer);

    if (this.isRunning) {
      const result = layer.onAttach();
      if (result instanceof Promise) {
        result.catch(console.error);
      }
    }

    return layer;
  }

  /**
   * Push an overlay onto the stack (renders on top, receives events first)
   * @returns The overlay for chaining
   */
  pushOverlay<T extends Layer>(overlay: T): T {
    overlay._setApplication(this);
    this.layerStack.pushOverlay(overlay);

    if (this.isRunning) {
      const result = overlay.onAttach();
      if (result instanceof Promise) {
        result.catch(console.error);
      }
    }

    return overlay;
  }

  /**
   * Pop a layer from the stack
   */
  popLayer(layer: Layer): void {
    if (this.layerStack.popLayer(layer)) {
      layer.onDetach();
      layer._setApplication(null);
    }
  }

  /**
   * Pop an overlay from the stack
   */
  popOverlay(overlay: Layer): void {
    if (this.layerStack.popOverlay(overlay)) {
      overlay.onDetach();
      overlay._setApplication(null);
    }
  }

  /**
   * Replace a layer with another
   */
  replaceLayer(oldLayer: Layer, newLayer: Layer): void {
    this.popLayer(oldLayer);
    this.pushLayer(newLayer);
  }

  /**
   * Get a layer by type
   * @returns The layer or null if not found
   */
  getLayer<T extends Layer>(
    LayerClass: new (...args: unknown[]) => T
  ): T | null {
    return this.layerStack.find(LayerClass) ?? null;
  }

  /**
   * Check if a layer of the given type exists
   */
  hasLayer<T extends Layer>(
    LayerClass: new (...args: unknown[]) => T
  ): boolean {
    return this.layerStack.has(LayerClass);
  }

  // ============================================================================
  // ECS System Management
  // ============================================================================

  /**
   * Add a system to the scheduler
   * @param phase - The execution phase
   * @param system - The system to add
   * @returns this for chaining
   */
  addSystem(phase: SystemPhase, system: SystemWrapper): this {
    this.scheduler.addSystem(phase, system);
    return this;
  }

  /**
   * Remove a system from the scheduler
   * @param phase - The execution phase
   * @param system - The system to remove
   * @returns this for chaining
   */
  removeSystem(phase: SystemPhase, system: SystemWrapper): this {
    this.scheduler.removeSystem(phase, system);
    return this;
  }

  // ============================================================================
  // Phase-Specific System Methods (Fluent API)
  // ============================================================================

  /** Add system to earlyStartup phase (runs once before startup) */
  addEarlyStartupSystem(system: SystemWrapper): this {
    return this.addSystem("earlyStartup", system);
  }

  /** Add system to startup phase (runs once at start) */
  addStartupSystem(system: SystemWrapper): this {
    return this.addSystem("startup", system);
  }

  /** Add system to lateStartup phase (runs once after startup) */
  addLateStartupSystem(system: SystemWrapper): this {
    return this.addSystem("lateStartup", system);
  }

  /** Add system to earlyUpdate phase (runs before update each frame) */
  addEarlyUpdateSystem(system: SystemWrapper): this {
    return this.addSystem("earlyUpdate", system);
  }

  /** Add system to update phase (runs each frame) */
  addUpdateSystem(system: SystemWrapper): this {
    return this.addSystem("update", system);
  }

  /** Add system to lateUpdate phase (runs after update each frame) */
  addLateUpdateSystem(system: SystemWrapper): this {
    return this.addSystem("lateUpdate", system);
  }

  /** Add system to earlyFixedUpdate phase (runs before fixedUpdate) */
  addEarlyFixedUpdateSystem(system: SystemWrapper): this {
    return this.addSystem("earlyFixedUpdate", system);
  }

  /** Add system to fixedUpdate phase (runs at fixed timestep) */
  addFixedUpdateSystem(system: SystemWrapper): this {
    return this.addSystem("fixedUpdate", system);
  }

  /** Add system to lateFixedUpdate phase (runs after fixedUpdate) */
  addLateFixedUpdateSystem(system: SystemWrapper): this {
    return this.addSystem("lateFixedUpdate", system);
  }

  /** Add system to earlyRender phase (runs before render) */
  addEarlyRenderSystem(system: SystemWrapper): this {
    return this.addSystem("earlyRender", system);
  }

  /** Add system to render phase (runs during rendering) */
  addRenderSystem(system: SystemWrapper): this {
    return this.addSystem("render", system);
  }

  /** Add system to lateRender phase (runs after render) */
  addLateRenderSystem(system: SystemWrapper): this {
    return this.addSystem("lateRender", system);
  }

  /** Add system to afterRender phase (runs after all rendering) */
  addAfterRenderSystem(system: SystemWrapper): this {
    return this.addSystem("afterRender", system);
  }

  // ============================================================================
  // Built-in Systems
  // ============================================================================

  /**
   * Register built-in engine systems and resources.
   * Called automatically in constructor.
   *
   * Registers:
   * - ConsoleLogger resource (for debug panel)
   * - TweenManager resource + tweenUpdateSystem
   * - AnimationManager resource + animationUpdateSystem
   * - SpriteRenderManager resource + spriteSyncSystem
   * - Render3DManager resource + transformPropagationSystem + render3DSyncSystem
   * - Water2DRenderManager resource + water2DSyncSystem
   * - EditorCameraManager resource
   */
  private addBuiltInSystems(): void {
    // Event system (must be registered early for other systems to use)
    this.insertResource(new Events());

    // Console logger for debug panel
    const consoleLogger = new ConsoleLogger();
    consoleLogger.startIntercepting();
    this.insertResource(consoleLogger);

    // Tween system
    this.insertResource(new TweenManager());
    this.addUpdateSystem(tweenUpdateSystem);

    // Animation system
    this.insertResource(new AnimationManager());
    this.addUpdateSystem(animationUpdateSystem);

    // Sprite rendering system (2D)
    // Uses mesh-based rendering with sprite materials
    const spriteManager = new SpriteRenderManager(this.renderer);
    this.insertResource(spriteManager);
    this.addRenderSystem(spriteSyncSystem);

    // 3D rendering systems
    this.insertResource(new Render3DManager(this.renderer));

    // Virtual camera systems (Cinemachine-like)
    // - virtualCameraFollowSystem: Updates vcam positions based on targets (update phase)
    // - virtualCameraSelectionSystem: Selects highest priority vcam (render phase)
    // - cameraBrainSystem: Blends brain to active vcam (render phase)
    // These only run during gameplay (play mode or pure game)
    this.addUpdateSystem(virtualCameraFollowSystem);
    this.addRenderSystem(virtualCameraSelectionSystem);
    this.addRenderSystem(cameraBrainSystem);

    this.addRenderSystem(cameraSyncSystem); // Must run after brain system to sync final camera state
    this.addRenderSystem(transformPropagationSystem);
    this.addRenderSystem(render3DSyncSystem);

    // Water 2D rendering system
    // Uses onBeforeRender callback for render-order-based screen capture
    // Works with both main framebuffer and editor viewports
    this.insertResource(new Water2DRenderManager(this.renderer));
    this.addUpdateSystem(water2DSyncSystem);

    // Sky Gradient 2D rendering system
    // - render: Create and update gradient backgrounds
    this.insertResource(new SkyGradientRenderManager(this.renderer));
    this.addRenderSystem(skyGradient2DSystem);

    // Fog 2D rendering system
    // - render: Create and update pixelated fog layers with gradients
    this.insertResource(new Fog2DRenderManager(this.renderer));
    this.addRenderSystem(fog2DSyncSystem);

    // Rain 2D rendering system
    // - render: Create and update pixel-art rain droplets with weather effects
    this.insertResource(new Rain2DRenderManager(this.renderer));
    this.addRenderSystem(rain2DSyncSystem);

    // Lightning Field 2D rendering system
    // - render: Create and update procedural lightning bolts with glow effects
    this.insertResource(new LightningField2DRenderManager(this.renderer));
    this.addRenderSystem(lightningField2DSyncSystem);

    // Tiled map integration
    // - startup: Load maps and spawn layers/objects/collisions
    // - update: Auto-start animations
    // - render: Sync tile layers to TilemapMaterial
    this.insertResource(new TiledAssetRegistry());
    this.insertResource(new TilemapRenderManager(this.renderer));
    this.addUpdateSystem(tiledMapLoaderSystem);
    this.addUpdateSystem(tiledObjectSpawnerSystem);
    this.addUpdateSystem(tiledTilesetCollisionSystem);
    this.addUpdateSystem(tiledObjectCollisionSystem);
    this.addUpdateSystem(tiledAnimationSystem);
    this.addRenderSystem(tiledTileLayerSyncSystem);

    // Sprite area generator system
    // - update: Regenerates sprites for SpriteAreaGenerator entities that don't have the Generated marker
    // This runs every frame but only acts on entities missing the marker (after world load/restore)
    this.addUpdateSystem(spriteAreaGeneratorSystem);

    // Editor camera resource
    const editorCameraManager = new EditorCameraManager(this.renderer);
    // When editor is disabled, deactivate editor camera so cameraSyncSystem uses game camera
    if (!this.isEditorEnabled()) {
      editorCameraManager.setEditorCameraActive(false);
    }
    this.insertResource(editorCameraManager);

    // Physics systems (2D and 3D)
    // - Initialize: Create physics world resources if enabled in config
    // - update: Sync ECS components → Rapier
    // - fixedUpdate: Step simulation and sync Rapier → ECS
    // - lateUpdate: Cleanup removed physics objects
    if (this.config.physics?.enable2D) {
      const gravity = this.config.physics.gravity2D ?? { x: 0, y: -980 };
      this.insertResource(new Physics2DContext(gravity));
    }
    if (this.config.physics?.enable3D) {
      const gravity = this.config.physics.gravity3D ?? { x: 0, y: -9.81, z: 0 };
      this.insertResource(new Physics3DContext(gravity));
    }
    // Register collision events (for ECS event readers/writers)
    this.addEvent(CollisionStarted2D);
    this.addEvent(CollisionEnded2D);
    this.addEvent(ContactForce2D);
    this.addEvent(CollisionStarted3D);
    this.addEvent(CollisionEnded3D);
    this.addEvent(ContactForce3D);

    this.addUpdateSystem(physics2DComponentSyncSystem);
    this.addUpdateSystem(physics3DComponentSyncSystem);
    this.addFixedUpdateSystem(physics2DSyncSystem);
    this.addFixedUpdateSystem(physics3DSyncSystem);
    // Collision event systems drain Rapier event queue after physics sync
    this.addFixedUpdateSystem(physics2DCollisionEventSystem);
    this.addFixedUpdateSystem(physics3DCollisionEventSystem);
    // Trigger zone systems dispatch user-configured events when entities enter/leave zones
    this.addEvent(TriggerZoneEnter2D);
    this.addEvent(TriggerZoneLeave2D);
    this.addEvent(TriggerZoneEnter3D);
    this.addEvent(TriggerZoneLeave3D);
    this.addFixedUpdateSystem(triggerZone2DSystem);
    this.addFixedUpdateSystem(triggerZone3DSystem);
    this.addLateUpdateSystem(physics2DCleanupSystem);
    this.addLateUpdateSystem(physics3DCleanupSystem);

    // UI system (three-mesh-ui based)
    // - Dedicated orthographic camera for screen-space UI
    // - Renders after main scene, before ImGui
    const uiManager = new UIManager(this.renderer);
    this.insertResource(uiManager);

    // UI viewport bounds for coordinate transformation (editor Game View support)
    const viewportBounds = new UIViewportBounds();
    viewportBounds.setFromFullscreen(this.window.getWidth(), this.window.getHeight());
    this.insertResource(viewportBounds);

    // UI interaction manager for hover/click detection
    const uiInteractionManager = new UIInteractionManager(uiManager);
    uiInteractionManager.setCanvas(this.window.getCanvas());
    uiInteractionManager.setViewportBounds(viewportBounds);
    this.insertResource(uiInteractionManager);

    // Setup UI interaction event dispatching
    // This bridges UIInteractionManager callbacks to ECS events
    const events = this.getResource(Events);
    if (events) {
      setupUIInteractionEvents(uiInteractionManager, events, (entity) => {
        return this.world.getComponent(entity, UIInteraction);
      });
    }

    // UI interaction update system (only runs during play mode)
    this.addUpdateSystem(uiInteractionUpdateSystem);

    this.addRenderSystem(uiCanvasSyncSystem);
    this.addRenderSystem(uiBlockSyncSystem);
    this.addRenderSystem(uiTextSyncSystem);
    this.addRenderSystem(uiButtonSyncSystem);
    this.addRenderSystem(uiUpdateSystem);
    this.addLateRenderSystem(uiRenderSystem);

    // Post-processing system
    // - lateRender: Renders effects after main scene, before UI
    this.insertResource(new PostProcessingManager(this.renderer));
    this.addLateRenderSystem(postProcessingSystem);

    // Audio system
    // - Creates Three.js AudioListener, Audio, and PositionalAudio objects
    // - Syncs audio positions from Transform3D
    // - audioSyncSystem: Only runs during Play Mode via isGameplayActive() condition
    // - Audio cleanup is handled by setupPlayModeCleanup (event-based)
    this.insertResource(new AudioManager());
    this.addUpdateSystem(audioSyncSystem);

    // Note: Play mode cleanup is now event-based (see setupPlayModeCleanup)
    // It's registered in setupEditorInternal() when EditorManager is created
  }

  // ============================================================================
  // Accessors
  // ============================================================================

  /**
   * Get the Window instance
   */
  getWindow(): Window {
    return this.window;
  }

  /**
   * Get the Renderer instance
   */
  getRenderer(): Renderer {
    return this.renderer;
  }

  /**
   * Get the Command API for entity manipulation
   * @returns Command instance for spawning entities and managing components
   */
  getCommands(): Command {
    return this.commands;
  }

  /**
   * Get the ImGui layer (if enabled)
   */
  getImGuiLayer(): ImGuiLayer | null {
    return this.imguiLayer;
  }

  /**
   * Get current FPS (updates once per second)
   */
  getCurrentFPS(): number {
    return this.currentFPS;
  }

  /**
   * Get target FPS
   */
  getTargetFPS(): number {
    return this.targetFPS;
  }

  /**
   * Get fixed delta time in seconds
   */
  getFixedDeltaTime(): number {
    return this.fixedDeltaTime;
  }

  /**
   * Get last frame's delta time in seconds
   */
  getDeltaTime(): number {
    return this.deltaTime;
  }

  /**
   * Get frame count since last run() call
   */
  getFrameCount(): number {
    return this.frameCount;
  }

  /**
   * Get total frame count since application creation
   */
  getTotalFrameCount(): number {
    return this.totalFrameCount;
  }

  /**
   * Get elapsed time in seconds since run() was called
   */
  getElapsedTime(): number {
    if (!this.isRunning) return 0;
    return (performance.now() - this.startTime) / 1000;
  }

  /**
   * Check if application is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Check if application is paused
   */
  get paused(): boolean {
    return this.isPaused;
  }

  // ============================================================================
  // Resource Management (Bevy-inspired)
  // ============================================================================

  /**
   * Insert or update a resource
   * Resources are singletons stored by their constructor type.
   *
   * @example
   * ```ts
   * app.insertResource(new PlayerState({ health: 100 }))
   *    .insertResource(new GameConfig({ difficulty: 'normal' }));
   * ```
   * @returns this for chaining
   */
  insertResource<T extends object>(resource: T): this {
    const ctor = resource.constructor;
    this.resources.set(ctor, resource);
    return this;
  }

  /**
   * Get a resource by its type
   *
   * @example
   * ```ts
   * const playerState = app.getResource(PlayerState);
   * if (playerState) {
   *   console.log(playerState.health);
   * }
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getResource<T>(ResourceType: new (...args: any[]) => T): T | undefined {
    return this.resources.get(ResourceType) as T | undefined;
  }

  /**
   * Remove a resource by its type
   * @returns The removed resource, or undefined if not found
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeResource<T>(ResourceType: new (...args: any[]) => T): T | undefined {
    const resource = this.resources.get(ResourceType) as T | undefined;
    this.resources.delete(ResourceType);
    return resource;
  }

  /**
   * Check if a resource exists
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hasResource<T>(ResourceType: new (...args: any[]) => T): boolean {
    return this.resources.has(ResourceType);
  }

  /**
   * Get all resources (for debugging)
   */
  getAllResources(): Map<unknown, unknown> {
    return new Map(this.resources);
  }

  // ============================================================================
  // Event System
  // ============================================================================

  /**
   * Register an event type for use in the system
   *
   * Events must be registered before they can be used with eventWriter/eventReader.
   * Registration creates the event channel that will store events of this type.
   *
   * @example
   * ```ts
   * class PlayerDamagedEvent {
   *   constructor(public damage: number, public source: string) {}
   * }
   *
   * app.addEvent(PlayerDamagedEvent);
   * ```
   *
   * @returns this for chaining
   */
  addEvent<T>(cls: EventClass<T>): this {
    const events = this.getResource(Events);
    if (events) {
      events.addEvent(cls);
    }
    return this;
  }
}
