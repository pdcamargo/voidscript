/**
 * Layer System - Base class and stack for organizing game logic
 *
 * Layers are the primary building blocks for organizing game logic.
 * Each layer receives lifecycle events and can handle input events.
 *
 * @example
 * ```ts
 * class GameLayer extends Layer {
 *   constructor() {
 *     super('GameLayer');
 *   }
 *
 *   override onAttach(): void {
 *     console.log('Game started!');
 *   }
 *
 *   override onUpdate(deltaTime: number): void {
 *     // Game logic
 *   }
 *
 *   override onImGuiRender(): void {
 *     ImGui.Begin('Debug');
 *     ImGui.Text('Hello World!');
 *     ImGui.End();
 *   }
 * }
 * ```
 */

import type { AppEvent } from "./events.js";
import type { Application } from "./application.js";

/**
 * Layer - Base class for application layers
 *
 * Inherit from this class to create custom layers with specific functionality.
 * Override the lifecycle methods to implement your game logic.
 */
export abstract class Layer {
  /** Layer name for debugging */
  readonly name: string;

  /** Reference to the parent application */
  protected app: Application | null = null;

  constructor(name: string = "Layer") {
    this.name = name;
  }

  /**
   * Called when layer is attached to the application
   * Override to initialize resources, register ECS systems, etc.
   *
   * Can be async to support loading resources.
   */
  onAttach(): void | Promise<void> {}

  /**
   * Called when layer is detached from the application
   * Override to cleanup resources, unregister systems, etc.
   */
  onDetach(): void {}

  /**
   * Called every frame during update phase
   * @param deltaTime - Time since last frame in seconds
   */
  onUpdate(deltaTime: number): void {}

  /**
   * Called during fixed update phase (physics timestep)
   * @param fixedDeltaTime - Fixed timestep duration in seconds
   */
  onFixedUpdate(fixedDeltaTime: number): void {}

  /**
   * Called every frame during render phase (before Three.js render)
   * Override for custom rendering logic (e.g., updating Three.js objects)
   */
  onRender(): void {}

  /**
   * Called for ImGui rendering (after Three.js render)
   * Override to draw ImGui windows/widgets for game UI
   */
  onImGuiRender(): void {}

  /**
   * Called when an event is dispatched to the layer stack
   * Events propagate from top to bottom (overlay layers first)
   *
   * @param event - The event to handle
   * @returns true if event was handled and should stop propagating
   *
   * @example
   * ```ts
   * override onEvent(event: AppEvent): boolean {
   *   const dispatcher = new EventDispatcher(event);
   *   dispatcher.dispatch<KeyPressedEvent>(EventType.KeyPressed, (e) => {
   *     if (e.keyCode === KeyCode.Escape) {
   *       this.getApplication().stop();
   *       return true;
   *     }
   *     return false;
   *   });
   *   return event.handled;
   * }
   * ```
   */
  onEvent(event: AppEvent): boolean {
    return false;
  }

  /**
   * Set the application reference (called by Application)
   * @internal
   */
  _setApplication(app: Application | null): void {
    this.app = app;
  }

  /**
   * Get the application this layer is attached to
   * @throws Error if layer is not attached to an application
   */
  protected getApplication(): Application {
    if (!this.app) {
      throw new Error(
        `Layer "${this.name}" is not attached to an application`
      );
    }
    return this.app;
  }

  /**
   * Check if layer is attached to an application
   */
  isAttached(): boolean {
    return this.app !== null;
  }

  /**
   * Request transition to another layer type
   * The new layer will replace this layer in the stack
   *
   * @example
   * ```ts
   * // In a menu layer, transition to game layer
   * if (ImGui.Button('Start Game')) {
   *   this.transitionTo(GameLayer);
   * }
   * ```
   */
  protected transitionTo<T extends Layer>(
    LayerClass: new (...args: unknown[]) => T,
    ...args: unknown[]
  ): void {
    if (!this.app) {
      throw new Error("Cannot transition: layer not attached to application");
    }
    this.app.replaceLayer(this, new LayerClass(...args));
  }
}

/**
 * LayerStack - Manages ordered collection of layers
 *
 * Layers are divided into two groups:
 * 1. Regular layers (rendered first, receive events last)
 * 2. Overlay layers (rendered on top, receive events first)
 *
 * This allows overlays (like ImGui debug panels) to capture input
 * before it reaches game layers.
 */
export class LayerStack {
  private layers: Layer[] = [];
  private overlays: Layer[] = [];
  private layerInsertIndex = 0;

  /**
   * Push a layer onto the stack (inserted before overlays)
   */
  pushLayer(layer: Layer): void {
    this.layers.splice(this.layerInsertIndex, 0, layer);
    this.layerInsertIndex++;
  }

  /**
   * Push an overlay onto the stack (renders on top, receives events first)
   */
  pushOverlay(overlay: Layer): void {
    this.overlays.push(overlay);
  }

  /**
   * Pop a layer from the stack
   * @returns true if layer was found and removed
   */
  popLayer(layer: Layer): boolean {
    const index = this.layers.indexOf(layer);
    if (index !== -1) {
      this.layers.splice(index, 1);
      this.layerInsertIndex--;
      return true;
    }
    return false;
  }

  /**
   * Pop an overlay from the stack
   * @returns true if overlay was found and removed
   */
  popOverlay(overlay: Layer): boolean {
    const index = this.overlays.indexOf(overlay);
    if (index !== -1) {
      this.overlays.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all layers (regular + overlays) for iteration
   * Order: regular layers first, then overlays (for rendering)
   */
  *[Symbol.iterator](): Iterator<Layer> {
    for (const layer of this.layers) {
      yield layer;
    }
    for (const overlay of this.overlays) {
      yield overlay;
    }
  }

  /**
   * Iterate layers in reverse order (for event propagation)
   * Order: overlays first (reverse), then regular layers (reverse)
   * This ensures overlays receive events before game layers
   */
  *reverse(): Generator<Layer> {
    for (let i = this.overlays.length - 1; i >= 0; i--) {
      const overlay = this.overlays[i];
      if (overlay) yield overlay;
    }
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      if (layer) yield layer;
    }
  }

  /**
   * Get only regular layers
   */
  getLayers(): readonly Layer[] {
    return this.layers;
  }

  /**
   * Get only overlay layers
   */
  getOverlays(): readonly Layer[] {
    return this.overlays;
  }

  /**
   * Get total layer count (regular + overlays)
   */
  get count(): number {
    return this.layers.length + this.overlays.length;
  }

  /**
   * Get regular layer count
   */
  get layerCount(): number {
    return this.layers.length;
  }

  /**
   * Get overlay count
   */
  get overlayCount(): number {
    return this.overlays.length;
  }

  /**
   * Check if stack is empty
   */
  isEmpty(): boolean {
    return this.layers.length === 0 && this.overlays.length === 0;
  }

  /**
   * Find a layer by type
   */
  find<T extends Layer>(
    LayerClass: new (...args: unknown[]) => T
  ): T | null {
    for (const layer of this.layers) {
      if (layer instanceof LayerClass) {
        return layer;
      }
    }
    for (const overlay of this.overlays) {
      if (overlay instanceof LayerClass) {
        return overlay;
      }
    }
    return null;
  }

  /**
   * Check if stack contains a layer of the given type
   */
  has<T extends Layer>(LayerClass: new (...args: unknown[]) => T): boolean {
    return this.find(LayerClass) !== undefined;
  }

  /**
   * Clear all layers (does not call onDetach)
   */
  clear(): void {
    this.layers = [];
    this.overlays = [];
    this.layerInsertIndex = 0;
  }
}
