/**
 * SceneViewPanel - Scene view for editing with editor camera
 *
 * Displays the scene from the editor camera's perspective.
 * Used for scene editing, object manipulation, and level design.
 *
 * Renders ALL layers including Layer 31 (editor-only helpers like grid).
 * Uses the shared scene from the engine - same scene as Game View.
 */

import { EditorPanel, ImageViewport, ImGuiImplWeb } from '@voidscript/editor';
import { GridHelper, AmbientLight, DirectionalLight } from '@voidscript/renderer';
import type { WebGLRenderTarget } from 'three';

/** Layer 31 is reserved for editor-only objects (grid, gizmos, etc.) */
const EDITOR_LAYER = 31;

/** Scene view clear color (dark blue-gray) - different from game view */
const SCENE_VIEW_CLEAR_COLOR = 0x3a4556;

/**
 * State for the scene view panel
 */
interface SceneViewState {
  renderTarget: WebGLRenderTarget | null;
  textureId: bigint | null;
  gridHelper: GridHelper | null;
  initialized: boolean;
}

// Module-level state (persists across panel open/close)
const state: SceneViewState = {
  renderTarget: null,
  textureId: null,
  gridHelper: null,
  initialized: false,
};

export class SceneViewPanel extends EditorPanel {
  private viewport = new ImageViewport();

  constructor() {
    super({
      id: 'scene-view',
      title: 'Scene',
      initialSize: { x: 800, y: 600 },
      menuPath: 'View/Scene',
      shortcut: 'CmdOrCtrl+3',
      defaultOpen: true,
    });
  }

  /**
   * Initialize the scene view with a grid helper on layer 31
   */
  private initSceneView(): void {
    if (state.initialized) return;

    const app = this.getApplication();
    const engine = app.getEngine();
    if (!engine) {
      console.warn('SceneViewPanel: No engine available (standalone mode)');
      return;
    }

    const renderer = engine.getRenderer();
    const scene = app.getScene();
    const editorCamera = app.getEditorCamera();

    if (!scene || !editorCamera) {
      console.warn('SceneViewPanel: Scene or EditorCamera not available');
      return;
    }

    // Create grid helper on layer 31 (editor-only)
    // Use brighter colors so it's visible against dark background
    state.gridHelper = new GridHelper(20, 20, 0x666666, 0x444444);
    state.gridHelper.layers.set(EDITOR_LAYER); // ONLY visible on layer 31
    scene.add(state.gridHelper);

    // Add lighting to the scene so objects are visible
    // These are on the default layer so both views can use them
    const ambientLight = new AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    // Create initial render target
    state.renderTarget = renderer.createRenderTarget(800, 600);

    state.initialized = true;
    console.log('SceneViewPanel: Initialized with grid on layer 31');
  }

  protected override onOpened(): void {
    console.log('SceneViewPanel opened');
  }

  protected override onClosed(): void {
    console.log('SceneViewPanel closed');
    // Reset texture ID when closed (will be recreated when reopened)
    state.textureId = null;
  }

  protected override onResize(width: number, height: number): void {
    const app = this.getApplication();
    const engine = app.getEngine();
    const editorCamera = app.getEditorCamera();

    if (!engine || !state.renderTarget || !editorCamera) return;

    const renderer = engine.getRenderer();

    // Resize render target
    renderer.resizeRenderTarget(state.renderTarget, width, height);

    // Update editor camera aspect
    editorCamera.updateAspect(width, height);

    // Reset texture ID so it gets recreated
    state.textureId = null;

    console.log(`SceneViewPanel resized to ${width}x${height}`);
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
      this.initSceneView();
    }

    const scene = app.getScene();
    const editorCamera = app.getEditorCamera();

    if (!scene || !editorCamera || !state.renderTarget) {
      return;
    }

    const renderer = engine.getRenderer();
    const contentWidth = Math.max(1, Math.floor(this.getContentWidth()));
    const contentHeight = Math.max(1, Math.floor(this.getContentHeight()));

    // Get the active camera (perspective or orthographic based on mode)
    const camera = editorCamera.getActiveCamera();

    // Render the scene to target using editor camera
    renderer.renderToTarget(
      state.renderTarget,
      scene,
      camera,
      SCENE_VIEW_CLEAR_COLOR,
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
