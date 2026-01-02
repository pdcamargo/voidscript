/**
 * EditorApplicationLayer - Abstract base class for editor layers
 *
 * The editor uses a layer system where different "screens" are represented
 * as layers that can be switched between. This provides clean separation
 * between the Project Hub and the main Editor.
 *
 * Layer Lifecycle:
 * - onAttach(): Called when layer becomes active (initialize resources)
 * - onDetach(): Called when layer is removed (cleanup resources)
 * - onUpdate(dt): Per-frame logic before rendering
 * - onRender(): ImGui rendering
 */

import type { EditorApplication } from '../editor-application.js';

/**
 * Abstract base class for editor application layers.
 *
 * Layers represent distinct "screens" or modes of the editor:
 * - ProjectHubLayer: Project selection and creation UI
 * - ProjectEditorLayer: Full editor with engine integration
 *
 * Only one layer is active at a time. Switching layers involves:
 * 1. Calling onDetach() on the current layer
 * 2. Creating the new layer
 * 3. Calling onAttach() on the new layer
 */
export abstract class EditorApplicationLayer {
  protected app: EditorApplication;

  constructor(app: EditorApplication) {
    this.app = app;
  }

  /**
   * Called when the layer becomes active.
   * Initialize resources, load data, set up UI state.
   */
  abstract onAttach(): Promise<void>;

  /**
   * Called when the layer is being removed.
   * Cleanup resources, save state, dispose of objects.
   */
  abstract onDetach(): Promise<void>;

  /**
   * Per-frame update called before rendering.
   * Handle input, update state, process async operations.
   *
   * @param deltaTime - Time since last frame in seconds
   */
  onUpdate(deltaTime: number): void {
    // Default implementation does nothing
    // Subclasses can override if needed
  }

  /**
   * Render the layer's UI using ImGui.
   * This is called every frame while the layer is active.
   */
  abstract onRender(): void;

  /**
   * Get the EditorApplication instance.
   * Useful for accessing shared resources like the canvas or GL context.
   */
  protected getApp(): EditorApplication {
    return this.app;
  }
}
