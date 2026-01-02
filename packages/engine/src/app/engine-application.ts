/**
 * EngineApplication - Clean game runtime application
 *
 * This is the core game engine application class with NO editor coupling.
 * It provides:
 * - ECS (Scene, Command, Scheduler)
 * - Layer system for modular game logic
 * - Three.js rendering via @voidscript/renderer
 * - Resource management (Bevy-inspired)
 * - Event system
 *
 * For editor functionality, use EditorApplication from @voidscript/editor
 * which wraps this class.
 *
 * @example
 * ```ts
 * const app = new EngineApplication({
 *   window: { canvas: 'canvas' },
 *   renderer: { clearColor: 0x1a1a2e },
 * });
 *
 * app.pushLayer(new GameLayer());
 * await app.run();
 * ```
 */

import { Scene } from '@voidscript/core';
import { Command } from '@voidscript/core';
import { Scheduler, type SystemPhase } from '@voidscript/core';
import type { SystemWrapper } from '@voidscript/core';
import { Layer, LayerStack } from './layer.js';
import { Window, type WindowConfig } from './window.js';
import { Renderer, type RendererConfig } from './renderer.js';
import type { AppEvent, WindowResizeEvent } from './events.js';
import { EventType, EventDispatcher } from './events.js';
import type { Camera, WebGLRenderTarget } from 'three';

// Built-in systems and managers
import { TweenManager } from '../animation/tween.js';
import { AnimationManager } from '../animation/animation-manager.js';
import { ShaderManager } from '../shader/shader-manager.js';
import { tweenUpdateSystem } from '../ecs/systems/tween-system.js';
import { animationUpdateSystem } from '../ecs/systems/animation-system.js';
import { animationStateMachineSystem } from '../ecs/systems/animation-state-machine-system.js';
import { shaderUpdateSystem } from '../ecs/systems/shader-system.js';
import {
  SpriteRenderManager,
  spriteSyncSystem,
} from '../ecs/systems/sprite-sync-system.js';
import {
  Render3DManager,
  transformPropagationSystem,
  render3DSyncSystem,
} from '../ecs/systems/renderer-sync-system.js';
import { cameraSyncSystem } from '../ecs/systems/camera-sync-system.js';
import { virtualCameraFollowSystem } from '../ecs/systems/virtual-camera-follow-system.js';
import { virtualCameraSelectionSystem } from '../ecs/systems/virtual-camera-selection-system.js';
import { cameraBrainSystem } from '../ecs/systems/camera-brain-system.js';
import {
  SkyGradientRenderManager,
  skyGradient2DSystem,
} from '../ecs/systems/sky-gradient-system.js';
import {
  Rain2DRenderManager,
  rain2DSyncSystem,
} from '../ecs/systems/rain-2d-system.js';
import { TiledAssetRegistry } from '../tiled/tiled-asset-registry.js';
import { TilemapRenderManager } from '../tiled/tilemap-render-manager.js';
import {
  tiledMapLoaderSystem,
  tiledObjectSpawnerSystem,
  tiledTileLayerSyncSystem,
  tiledAnimationSystem,
  tiledTilesetCollisionSystem,
  tiledObjectCollisionSystem,
} from '../tiled/systems/index.js';
import { AssetDatabase, type AssetsConfig } from '../ecs/asset/asset-database.js';
import { PrefabManager } from '@voidscript/core';
import { PostProcessingManager } from '../post-processing/managers/post-processing-manager.js';
import { isInitializableResource } from '@voidscript/core';

// Physics systems (2D and 3D)
import {
  physics2DComponentSyncSystem,
  physics2DSyncSystem,
  physics2DCleanupSystem,
  Physics2DContext,
  physics2DCollisionEventSystem,
} from '../physics/2d/index.js';
import {
  physics3DComponentSyncSystem,
  physics3DSyncSystem,
  physics3DCleanupSystem,
  Physics3DContext,
  physics3DCollisionEventSystem,
} from '../physics/3d/index.js';
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
} from '../physics/collision/index.js';

// Trigger zone systems
import {
  triggerZone2DSystem,
  triggerZone3DSystem,
} from '../ecs/systems/trigger/index.js';

// UI systems
import { UIManager } from '../ui/ui-manager.js';
import { UIViewportBounds } from '../ui/ui-viewport-bounds.js';
import { UIInteractionManager } from '../ui/ui-interaction.js';
import {
  uiCanvasSyncSystem,
  uiBlockSyncSystem,
  uiTextSyncSystem,
  uiButtonSyncSystem,
  uiUpdateSystem,
  uiRenderSystem,
} from '../ui/ui-systems.js';
import {
  setupUIInteractionEvents,
  uiInteractionUpdateSystem,
} from '../ui/ui-interaction-event-system.js';
import { UIInteraction } from '../ui/components/ui-interaction.js';

// Post-processing system
import { postProcessingSystem } from '../ecs/systems/post-processing-system.js';

// Audio systems
import { AudioManager } from '../ecs/systems/audio-manager.js';
import { audioSyncSystem } from '../ecs/systems/audio-sync-system.js';

// Generator systems
import { spriteAreaGeneratorSystem } from '../ecs/systems/sprite-area-generator-system.js';

// Event system
import { Events, type EventClass } from '@voidscript/core';

// Asset preloading
import { preloadAssets } from '../ecs/asset/asset-preloader.js';

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
 * EngineApplication configuration options
 */
export interface EngineApplicationConfig {
  /** Window configuration */
  window: WindowConfig;

  /** Renderer configuration */
  renderer?: RendererConfig;

  /** Target FPS for fixed update (default: 60) */
  targetFPS?: number;

  /** Fixed timestep in seconds (default: 1/targetFPS) */
  fixedDeltaTime?: number;

  /**
   * Asset configuration (optional)
   * Maps GUID -> AssetConfig for centralized asset management
   */
  assets?: AssetsConfig;

  /**
   * Path to asset manifest JSON file (optional)
   * Assets from this file will be merged with code-based assets.
   */
  assetsManifest?: string;

  /** Physics configuration (optional) */
  physics?: PhysicsConfig;
}

/**
 * EngineApplication - Clean game runtime with no editor coupling
 *
 * This class manages the game loop, layers, ECS, rendering, and input.
 * It has NO ImGui, NO editor dependencies, and NO conditional editor logic.
 */
export class EngineApplication {
  // ============================================================================
  // ECS
  // ============================================================================

  /** ECS Scene (for advanced use - prefer using commands in systems) */
  readonly scene: Scene;

  /** System scheduler for ECS systems */
  private readonly scheduler: Scheduler;

  /** Command API for entity manipulation */
  private readonly commands: Command;

  // ============================================================================
  // Core Systems
  // ============================================================================

  private window: Window;
  private renderer: Renderer;
  private layerStack: LayerStack;

  // ============================================================================
  // Runtime State
  // ============================================================================

  private _isRunning = false;
  private _isPaused = false;
  private _isInitialized = false;
  private lastFrameTime = 0;
  private accumulator = 0;
  private targetFPS: number;
  private fixedDeltaTime: number;

  // Delta time tracking
  private _deltaTime = 0;

  // FPS tracking
  private currentFPS = 0;
  private frameCount = 0;
  private totalFrameCount = 0;
  private fpsUpdateTime = 0;
  private fpsFrameCount = 0;
  private startTime = 0;

  // ============================================================================
  // Resources (Bevy-inspired singleton storage)
  // ============================================================================

  /** Resource storage by type (Constructor → instance) */
  private readonly resources = new Map<unknown, unknown>();

  /** Stored application config */
  private readonly config: EngineApplicationConfig;

  constructor(config: EngineApplicationConfig) {
    this.config = config;

    // Initialize AssetDatabase first (before ECS/systems)
    AssetDatabase.initialize(config.assets);

    // Initialize ECS
    this.scene = new Scene();
    this.scheduler = new Scheduler();
    this.commands = new Command(
      this.scene,
      this as unknown as import('./application.js').Application,
    );
    this.layerStack = new LayerStack();

    // Initialize window
    this.window = new Window(config.window);
    this.window.setEventCallback((event) => this.onEvent(event));

    // Initialize renderer
    this.renderer = new Renderer(this.window, config.renderer);

    // Configure fixed timestep
    this.targetFPS = config.targetFPS ?? 60;
    this.fixedDeltaTime = config.fixedDeltaTime ?? 1 / this.targetFPS;

    // Register built-in systems
    this.addBuiltInSystems();
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Initialize the application without starting the game loop.
   * Loads assets, runs startup systems, etc.
   * Call this before tick() when using editor composition.
   */
  async initialize(): Promise<void> {
    if (this._isInitialized) {
      console.warn('EngineApplication already initialized');
      return;
    }

    // Load asset manifest if specified
    await this.loadAssetManifest();

    // Preload all registered assets
    const allGuids = AssetDatabase.getAllGuids();
    if (allGuids.length > 0) {
      await preloadAssets(...allGuids);
    }

    // Attach all layers
    for (const layer of this.layerStack) {
      layer._setApplication(
        this as unknown as import('./application.js').Application,
      );
      await layer.onAttach();
    }

    // Run startup systems
    this.scheduler.executeSystems('earlyStartup', { commands: this.commands });
    this.scheduler.executeSystems('startup', { commands: this.commands });
    this.scheduler.executeSystems('lateStartup', { commands: this.commands });
    this.scene.flushEvents();

    this._isInitialized = true;
  }

  /**
   * Run the application (standalone mode).
   * Initializes and starts the game loop.
   */
  async run(): Promise<void> {
    if (!this._isInitialized) {
      await this.initialize();
    }

    this._isRunning = true;
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
    this._isRunning = false;
  }

  /**
   * Pause the game loop (stops updates, continues rendering)
   */
  pause(): void {
    this._isPaused = true;
  }

  /**
   * Resume the game loop
   */
  resume(): void {
    this._isPaused = false;
    this.lastFrameTime = performance.now();
    this.accumulator = 0;
  }

  // ============================================================================
  // Editor Composition Methods
  // ============================================================================

  /**
   * Execute a single frame (update + render phases).
   * Used by EditorApplication to control timing.
   */
  tick(): void {
    const currentTime = performance.now();
    this._deltaTime = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;

    // Clamp delta time
    if (this._deltaTime > 0.25) {
      this._deltaTime = 0.25;
    }

    this.updateFrameCounters(currentTime);

    if (!this._isPaused) {
      this.runUpdatePhase();
      this.runFixedUpdatePhase();
      this.scene.flushEvents();
    }

    this.runRenderPhase();
    this.endFrame();
  }

  /**
   * Run update phases only (no render).
   * Used when editor handles rendering separately.
   */
  updateOnly(): void {
    const currentTime = performance.now();
    this._deltaTime = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;

    if (this._deltaTime > 0.25) {
      this._deltaTime = 0.25;
    }

    this.updateFrameCounters(currentTime);

    if (!this._isPaused) {
      this.runUpdatePhase();
      this.runFixedUpdatePhase();
      this.scene.flushEvents();
    }
  }

  /**
   * Render to a specific target with a specific camera.
   * Used by EditorApplication for viewport rendering.
   *
   * @param target - Render target, or null for screen
   * @param camera - Camera to use for rendering
   */
  renderTo(target: WebGLRenderTarget | null, camera: Camera): void {
    this.renderer.beginFrame();

    // Run layer render callbacks
    for (const layer of this.layerStack) {
      layer.onRender();
    }

    // Set output target and render
    this.renderer.setOutputTarget(target);
    this.renderer.renderPipeline(
      this.renderer.getScene(),
      camera,
      this._deltaTime,
    );
    this.renderer.setOutputTarget(null);
  }

  /**
   * Create a new Command instance.
   * Used by EditorApplication to create commands for EditorManager.
   */
  createCommands(): Command {
    return new Command(
      this.scene,
      this as unknown as import('./application.js').Application,
    );
  }

  // ============================================================================
  // Private Game Loop
  // ============================================================================

  private gameLoop(): void {
    if (!this._isRunning) {
      this.shutdown();
      return;
    }

    this.tick();
    requestAnimationFrame(() => this.gameLoop());
  }

  private updateFrameCounters(currentTime: number): void {
    this.frameCount++;
    this.totalFrameCount++;
    this.fpsFrameCount++;

    if (currentTime - this.fpsUpdateTime >= 1000) {
      this.currentFPS = this.fpsFrameCount;
      this.fpsFrameCount = 0;
      this.fpsUpdateTime = currentTime;
    }
  }

  private runUpdatePhase(): void {
    this.scheduler.executeSystems('earlyUpdate', { commands: this.commands });

    for (const layer of this.layerStack) {
      layer.onUpdate(this._deltaTime);
    }

    this.scheduler.executeSystems('update', { commands: this.commands });
    this.scheduler.executeSystems('lateUpdate', { commands: this.commands });
  }

  private runFixedUpdatePhase(): void {
    this.accumulator += this._deltaTime;

    while (this.accumulator >= this.fixedDeltaTime) {
      this.scheduler.executeSystems('earlyFixedUpdate', {
        commands: this.commands,
      });

      for (const layer of this.layerStack) {
        layer.onFixedUpdate(this.fixedDeltaTime);
      }

      this.scheduler.executeSystems('fixedUpdate', { commands: this.commands });
      this.scheduler.executeSystems('lateFixedUpdate', {
        commands: this.commands,
      });

      this.accumulator -= this.fixedDeltaTime;
    }
  }

  private runRenderPhase(): void {
    this.scheduler.executeSystems('earlyRender', { commands: this.commands });

    this.renderer.beginFrame();

    for (const layer of this.layerStack) {
      layer.onRender();
    }

    this.scheduler.executeSystems('render', { commands: this.commands });

    // Direct render to screen - no conditionals, no editor checks
    this.renderer.renderPipeline(
      this.renderer.getScene(),
      this.renderer.getCamera(),
      this._deltaTime,
    );

    this.scheduler.executeSystems('lateRender', { commands: this.commands });
    this.scheduler.executeSystems('afterRender', { commands: this.commands });
  }

  private endFrame(): void {
    this.window.endFrame();

    const events = this.getResource(Events);
    if (events) {
      events.onFrameEnd();
    }
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  private onEvent(event: AppEvent): void {
    const dispatcher = new EventDispatcher(event);

    dispatcher.dispatch<WindowResizeEvent>(EventType.WindowResize, (e) => {
      this.renderer.onResize(e.width, e.height);

      const uiManager = this.getResource(UIManager);
      if (uiManager) {
        uiManager.onResize(e.width, e.height);
      }

      return false;
    });

    // Propagate to layers (reverse order)
    for (const layer of this.layerStack.reverse()) {
      if (event.handled) break;
      event.handled = layer.onEvent(event);
    }
  }

  // ============================================================================
  // Shutdown
  // ============================================================================

  private shutdown(): void {
    for (const layer of this.layerStack) {
      layer.onDetach();
      layer._setApplication(null);
    }
    this.layerStack.clear();

    this.renderer.destroy();
    this.window.destroy();
    this.scene.clear();
    this.scheduler.clear();
    this.resources.clear();
  }

  // ============================================================================
  // Asset Loading
  // ============================================================================

  private async loadAssetManifest(): Promise<void> {
    const manifestPath = this.config.assetsManifest;
    if (!manifestPath) return;

    try {
      const response = await fetch(manifestPath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const jsonString = await response.text();
      const assets = AssetDatabase.parseAssetsJson(jsonString);
      AssetDatabase.registerAdditionalAssets(assets);
    } catch (error) {
      console.error(
        `[EngineApplication] Failed to load asset manifest:`,
        error,
      );
    }
  }

  // ============================================================================
  // Layer Management
  // ============================================================================

  pushLayer<T extends Layer>(layer: T): T {
    layer._setApplication(
      this as unknown as import('./application.js').Application,
    );
    this.layerStack.pushLayer(layer);

    if (this._isInitialized) {
      const result = layer.onAttach();
      if (result instanceof Promise) {
        result.catch(console.error);
      }
    }

    return layer;
  }

  pushOverlay<T extends Layer>(overlay: T): T {
    overlay._setApplication(
      this as unknown as import('./application.js').Application,
    );
    this.layerStack.pushOverlay(overlay);

    if (this._isInitialized) {
      const result = overlay.onAttach();
      if (result instanceof Promise) {
        result.catch(console.error);
      }
    }

    return overlay;
  }

  popLayer(layer: Layer): void {
    if (this.layerStack.popLayer(layer)) {
      layer.onDetach();
      layer._setApplication(null);
    }
  }

  popOverlay(overlay: Layer): void {
    if (this.layerStack.popOverlay(overlay)) {
      overlay.onDetach();
      overlay._setApplication(null);
    }
  }

  // ============================================================================
  // ECS System Management
  // ============================================================================

  addSystem(phase: SystemPhase, system: SystemWrapper): this {
    this.scheduler.addSystem(phase, system);
    return this;
  }

  removeSystem(phase: SystemPhase, system: SystemWrapper): this {
    this.scheduler.removeSystem(phase, system);
    return this;
  }

  addEarlyStartupSystem(system: SystemWrapper): this {
    return this.addSystem('earlyStartup', system);
  }

  addStartupSystem(system: SystemWrapper): this {
    return this.addSystem('startup', system);
  }

  addLateStartupSystem(system: SystemWrapper): this {
    return this.addSystem('lateStartup', system);
  }

  addEarlyUpdateSystem(system: SystemWrapper): this {
    return this.addSystem('earlyUpdate', system);
  }

  addUpdateSystem(system: SystemWrapper): this {
    return this.addSystem('update', system);
  }

  addLateUpdateSystem(system: SystemWrapper): this {
    return this.addSystem('lateUpdate', system);
  }

  addEarlyFixedUpdateSystem(system: SystemWrapper): this {
    return this.addSystem('earlyFixedUpdate', system);
  }

  addFixedUpdateSystem(system: SystemWrapper): this {
    return this.addSystem('fixedUpdate', system);
  }

  addLateFixedUpdateSystem(system: SystemWrapper): this {
    return this.addSystem('lateFixedUpdate', system);
  }

  addEarlyRenderSystem(system: SystemWrapper): this {
    return this.addSystem('earlyRender', system);
  }

  addRenderSystem(system: SystemWrapper): this {
    return this.addSystem('render', system);
  }

  addLateRenderSystem(system: SystemWrapper): this {
    return this.addSystem('lateRender', system);
  }

  addAfterRenderSystem(system: SystemWrapper): this {
    return this.addSystem('afterRender', system);
  }

  // ============================================================================
  // Built-in Systems
  // ============================================================================

  private addBuiltInSystems(): void {
    // Event system
    this.insertResource(new Events());

    // Prefab system
    PrefabManager.initialize();

    // Tween system
    this.insertResource(new TweenManager());
    this.addUpdateSystem(tweenUpdateSystem);

    // Animation system
    this.insertResource(new AnimationManager());
    this.addUpdateSystem(animationStateMachineSystem);
    this.addUpdateSystem(animationUpdateSystem);

    // Shader system
    const shaderManager = new ShaderManager();
    shaderManager.setRenderer(this.renderer);
    this.insertResource(shaderManager);
    this.addUpdateSystem(shaderUpdateSystem);

    // Sprite rendering system
    const spriteManager = new SpriteRenderManager(this.renderer);
    this.insertResource(spriteManager);
    this.addRenderSystem(spriteSyncSystem);

    // 3D rendering systems
    this.insertResource(new Render3DManager(this.renderer));

    // Virtual camera systems
    this.addUpdateSystem(virtualCameraFollowSystem);
    this.addRenderSystem(virtualCameraSelectionSystem);
    this.addRenderSystem(cameraBrainSystem);
    this.addRenderSystem(cameraSyncSystem);
    this.addRenderSystem(transformPropagationSystem);
    this.addRenderSystem(render3DSyncSystem);

    // Sky Gradient 2D system
    this.insertResource(new SkyGradientRenderManager(this.renderer));
    this.addRenderSystem(skyGradient2DSystem);

    // Rain 2D system
    this.insertResource(new Rain2DRenderManager(this.renderer));
    this.addRenderSystem(rain2DSyncSystem);

    // Tiled map systems
    this.insertResource(new TiledAssetRegistry());
    this.insertResource(new TilemapRenderManager(this.renderer));
    this.addUpdateSystem(tiledMapLoaderSystem);
    this.addUpdateSystem(tiledObjectSpawnerSystem);
    this.addUpdateSystem(tiledTilesetCollisionSystem);
    this.addUpdateSystem(tiledObjectCollisionSystem);
    this.addUpdateSystem(tiledAnimationSystem);
    this.addRenderSystem(tiledTileLayerSyncSystem);

    // Sprite area generator system
    this.addUpdateSystem(spriteAreaGeneratorSystem);

    // Physics systems
    if (this.config.physics?.enable2D) {
      const gravity = this.config.physics.gravity2D ?? { x: 0, y: -980 };
      this.insertResource(new Physics2DContext(gravity));
    }
    if (this.config.physics?.enable3D) {
      const gravity = this.config.physics.gravity3D ?? { x: 0, y: -9.81, z: 0 };
      this.insertResource(new Physics3DContext(gravity));
    }

    // Register collision events
    this.addEvent(CollisionStarted2D);
    this.addEvent(CollisionEnded2D);
    this.addEvent(ContactForce2D);
    this.addEvent(CollisionStarted3D);
    this.addEvent(CollisionEnded3D);
    this.addEvent(ContactForce3D);
    this.addEvent(TriggerZoneEnter2D);
    this.addEvent(TriggerZoneLeave2D);
    this.addEvent(TriggerZoneEnter3D);
    this.addEvent(TriggerZoneLeave3D);

    this.addUpdateSystem(physics2DComponentSyncSystem);
    this.addUpdateSystem(physics3DComponentSyncSystem);
    this.addFixedUpdateSystem(physics2DSyncSystem);
    this.addFixedUpdateSystem(physics3DSyncSystem);
    this.addFixedUpdateSystem(physics2DCollisionEventSystem);
    this.addFixedUpdateSystem(physics3DCollisionEventSystem);
    this.addFixedUpdateSystem(triggerZone2DSystem);
    this.addFixedUpdateSystem(triggerZone3DSystem);
    this.addLateUpdateSystem(physics2DCleanupSystem);
    this.addLateUpdateSystem(physics3DCleanupSystem);

    // UI system
    const uiManager = new UIManager(this.renderer);
    this.insertResource(uiManager);

    const viewportBounds = new UIViewportBounds();
    viewportBounds.setFromFullscreen(
      this.window.getWidth(),
      this.window.getHeight(),
    );
    this.insertResource(viewportBounds);

    const uiInteractionManager = new UIInteractionManager(uiManager);
    uiInteractionManager.setCanvas(this.window.getCanvas());
    uiInteractionManager.setViewportBounds(viewportBounds);
    this.insertResource(uiInteractionManager);

    const events = this.getResource(Events);
    if (events) {
      setupUIInteractionEvents(uiInteractionManager, events, (entity) => {
        return this.scene.getComponent(entity, UIInteraction);
      });
    }

    this.addUpdateSystem(uiInteractionUpdateSystem);
    this.addRenderSystem(uiCanvasSyncSystem);
    this.addRenderSystem(uiBlockSyncSystem);
    this.addRenderSystem(uiTextSyncSystem);
    this.addRenderSystem(uiButtonSyncSystem);
    this.addRenderSystem(uiUpdateSystem);
    this.addLateRenderSystem(uiRenderSystem);

    // Post-processing system
    this.insertResource(new PostProcessingManager(this.renderer));
    this.addLateRenderSystem(postProcessingSystem);

    // Audio system
    this.insertResource(new AudioManager());
    this.addUpdateSystem(audioSyncSystem);
  }

  // ============================================================================
  // Accessors
  // ============================================================================

  getWindow(): Window {
    return this.window;
  }

  getRenderer(): Renderer {
    return this.renderer;
  }

  getCommands(): Command {
    return this.commands;
  }

  getCurrentFPS(): number {
    return this.currentFPS;
  }

  getTargetFPS(): number {
    return this.targetFPS;
  }

  getFixedDeltaTime(): number {
    return this.fixedDeltaTime;
  }

  getDeltaTime(): number {
    return this._deltaTime;
  }

  getFrameCount(): number {
    return this.frameCount;
  }

  getTotalFrameCount(): number {
    return this.totalFrameCount;
  }

  getElapsedTime(): number {
    if (!this._isRunning) return 0;
    return (performance.now() - this.startTime) / 1000;
  }

  get running(): boolean {
    return this._isRunning;
  }

  get paused(): boolean {
    return this._isPaused;
  }

  get initialized(): boolean {
    return this._isInitialized;
  }

  getScene(): Scene {
    return this.scene;
  }

  // ============================================================================
  // Resource Management
  // ============================================================================

  insertResource<T extends object>(resource: T): this {
    const ctor = resource.constructor;
    this.resources.set(ctor, resource);

    if (isInitializableResource(resource)) {
      resource.onInitialize(
        this as unknown as import('./application.js').Application,
      );
    }

    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getResource<T>(ResourceType: new (...args: any[]) => T): T | undefined {
    return this.resources.get(ResourceType) as T | undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeResource<T>(ResourceType: new (...args: any[]) => T): T | undefined {
    const resource = this.resources.get(ResourceType) as T | undefined;
    this.resources.delete(ResourceType);
    return resource;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hasResource<T>(ResourceType: new (...args: any[]) => T): boolean {
    return this.resources.has(ResourceType);
  }

  getAllResources(): Map<unknown, unknown> {
    return new Map(this.resources);
  }

  // ============================================================================
  // Event System
  // ============================================================================

  addEvent<T>(EventClass: EventClass<T>): this {
    const events = this.getResource(Events);
    if (events) {
      events.addEvent(EventClass);
    }
    return this;
  }
}
