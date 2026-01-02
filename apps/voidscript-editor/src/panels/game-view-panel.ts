/**
 * GameViewPanel - Game view showing the game camera perspective
 *
 * Displays the scene from the game's main camera perspective.
 * Shows what the player will see during gameplay.
 *
 * Renders all layers EXCEPT Layer 31 (no editor helpers).
 * Uses the shared scene from the engine - same scene as Scene View.
 * Uses the engine's main camera (NOT the editor camera).
 */

import { EditorPanel, ImageViewport, ImGuiImplWeb } from '@voidscript/editor';
import type { WebGLRenderTarget, Camera } from 'three';

/** Layer 31 is reserved for editor-only objects - we EXCLUDE it here */
const EDITOR_LAYER = 31;

/** Game view clear color (darker, more neutral - visually different from scene view) */
const GAME_VIEW_CLEAR_COLOR = 0x1a1a2e;

/**
 * State for the game view panel
 */
interface GameViewState {
  renderTarget: WebGLRenderTarget | null;
  textureId: bigint | null;
  initialized: boolean;
}

// Module-level state (persists across panel open/close)
const state: GameViewState = {
  renderTarget: null,
  textureId: null,
  initialized: false,
};

export class GameViewPanel extends EditorPanel {
  private viewport = new ImageViewport();

  constructor() {
    super({
      id: 'game-view',
      title: 'Game',
      initialSize: { x: 800, y: 600 },
      menuPath: 'View/Game',
      shortcut: 'CmdOrCtrl+4',
      defaultOpen: false,
    });
  }

  /**
   * Initialize the game view render target
   */
  private initGameView(): void {
    if (state.initialized) return;

    const app = this.getApplication();
    const engine = app.getEngine();
    if (!engine) {
      console.warn('GameViewPanel: No engine available (standalone mode)');
      return;
    }

    const renderer = engine.getRenderer();

    // Create render target for game view
    state.renderTarget = renderer.createRenderTarget(800, 600);

    // Disable layer 31 on the game camera so it won't see editor helpers
    const gameCamera = renderer.getCamera();
    gameCamera.layers.disable(EDITOR_LAYER);

    state.initialized = true;
    console.log('GameViewPanel: Initialized WITHOUT layer 31 (no grid)');
  }

  protected override onOpened(): void {
    console.log('GameViewPanel opened');
  }

  protected override onClosed(): void {
    console.log('GameViewPanel closed');
    // Reset texture ID when closed (will be recreated when reopened)
    state.textureId = null;
  }

  protected override onResize(width: number, height: number): void {
    const app = this.getApplication();
    const engine = app.getEngine();
    if (!engine || !state.renderTarget) return;

    const renderer = engine.getRenderer();

    // Resize render target
    renderer.resizeRenderTarget(state.renderTarget, width, height);

    // Update game camera aspect
    const gameCamera = renderer.getCamera() as Camera & { aspect?: number; updateProjectionMatrix?: () => void };
    if (gameCamera.aspect !== undefined) {
      gameCamera.aspect = width / height;
      gameCamera.updateProjectionMatrix?.();
    }

    // Reset texture ID so it gets recreated
    state.textureId = null;

    console.log(`GameViewPanel resized to ${width}x${height}`);
  }

  protected override onRender(): void {
    const app = this.getApplication();
    const engine = app.getEngine();

    if (!engine) {
      // Standalone mode - just show a message
      return;
    }

    // Initialize on first render
    if (!state.initialized) {
      this.initGameView();
    }

    const scene = app.getScene();

    if (!scene || !state.renderTarget) {
      return;
    }

    const renderer = engine.getRenderer();
    const contentWidth = Math.max(1, Math.floor(this.getContentWidth()));
    const contentHeight = Math.max(1, Math.floor(this.getContentHeight()));

    // Get the game's main camera (NOT the editor camera)
    const gameCamera = renderer.getCamera();

    // Render the scene to target using game camera
    renderer.renderToTarget(
      state.renderTarget,
      scene,
      gameCamera,
      GAME_VIEW_CLEAR_COLOR,
      1.0,
    );

    // Reset WebGL state for ImGui
    renderer.resetState();

    // Get or create texture ID for ImGui
    if (state.textureId === null && contentWidth > 0 && contentHeight > 0) {
      const threeRenderer = renderer.getThreeRenderer();
      threeRenderer.initTexture(state.renderTarget.texture);

      const textureProps = threeRenderer.properties.get(
        state.renderTarget.texture,
      ) as { __webglTexture?: WebGLTexture };
      const webglTexture = textureProps.__webglTexture;

      if (webglTexture) {
        state.textureId = ImGuiImplWeb.LoadTexture(undefined, {
          processFn: () => webglTexture,
        });
      }
    }

    // Display the rendered texture
    if (state.textureId !== null && contentWidth > 0 && contentHeight > 0) {
      this.viewport.render(state.textureId, {
        width: contentWidth,
        height: contentHeight,
        uvMin: { x: 0, y: 1 }, // Flip UV for WebGL
        uvMax: { x: 1, y: 0 },
        captureInput: true,
      });
    }
  }
}
