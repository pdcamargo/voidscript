/**
 * RendererDemoPanel - Demo panel showing 3D box rendering inside ImGui
 *
 * Demonstrates @voidscript/renderer integration with the editor:
 * - Creating a renderer with a shared WebGL context
 * - Rendering to a render target
 * - Displaying THREE.js texture in ImGui using ImageViewport
 * - TransformControls with proper mouse coordinate mapping
 */

import {
  EditorPanel,
  EditorLayout,
  ImGui,
  ImGuiImplWeb,
  ImageViewport,
} from '@voidscript/editor';
import {
  Renderer,
  Window,
  Scene,
  PerspectiveCamera,
  BoxGeometry,
  MeshStandardMaterial,
  Mesh,
  AmbientLight,
  DirectionalLight,
} from '@voidscript/renderer';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { WebGLRenderTarget } from 'three';

/**
 * State for the renderer demo
 */
interface DemoState {
  renderer: Renderer | null;
  renderTarget: WebGLRenderTarget | null;
  textureId: bigint | null;
  scene: Scene | null;
  camera: PerspectiveCamera | null;
  cube: Mesh | null;
  transformControls: TransformControls | null;
  rotation: number;
  initialized: boolean;
  autoRotate: boolean;
}

// Module-level state (persists across panel open/close)
const state: DemoState = {
  renderer: null,
  renderTarget: null,
  textureId: null,
  scene: null,
  camera: null,
  cube: null,
  transformControls: null,
  rotation: 0,
  initialized: false,
  autoRotate: false,
};

// Track pointer state for TransformControls
let isPointerDown = false;

export class RendererDemoPanel extends EditorPanel {
  private editorCanvas: HTMLCanvasElement | null = null;
  private viewport = new ImageViewport();
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private boundPointerMove: ((e: PointerEvent) => void) | null = null;
  private boundPointerUp: ((e: PointerEvent) => void) | null = null;

  constructor() {
    super({
      id: 'renderer-demo',
      title: 'Renderer Demo',
      initialSize: { x: 500, y: 450 },
      menuPath: 'Window/Renderer Demo',
      shortcut: 'CmdOrCtrl+Shift+R',
      defaultOpen: true,
    });
  }

  /**
   * Setup pointer event handling for TransformControls
   */
  private setupPointerEvents(canvas: HTMLCanvasElement): void {
    this.boundPointerDown = (e: PointerEvent) => {
      if (!state.transformControls || !this.isOpen) return;

      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;

      // Use viewport to convert to NDC
      const pointer = this.viewport.canvasToNDC(canvasX, canvasY, e.button);
      if (!pointer) return;

      isPointerDown = true;
      canvas.setPointerCapture(e.pointerId);

      // Call TransformControls pointer methods directly
      (state.transformControls as any).pointerHover(pointer);
      (state.transformControls as any).pointerDown(pointer);
    };

    this.boundPointerMove = (e: PointerEvent) => {
      if (!state.transformControls || !this.isOpen) return;

      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;

      if (isPointerDown) {
        // During drag, always send move even if outside bounds
        const ndc = this.viewport.getCurrentNDC(e.button);
        (state.transformControls as any).pointerMove(ndc);
      } else {
        // Hover only when inside bounds
        const pointer = this.viewport.canvasToNDC(canvasX, canvasY, e.button);
        if (pointer) {
          (state.transformControls as any).pointerHover(pointer);
        }
      }
    };

    this.boundPointerUp = (e: PointerEvent) => {
      if (!state.transformControls) return;

      if (isPointerDown) {
        const ndc = this.viewport.getCurrentNDC(e.button);
        (state.transformControls as any).pointerUp(ndc);
        isPointerDown = false;

        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      }
    };

    canvas.addEventListener('pointerdown', this.boundPointerDown);
    canvas.addEventListener('pointermove', this.boundPointerMove);
    canvas.addEventListener('pointerup', this.boundPointerUp);
  }

  /**
   * Initialize the renderer using the editor's canvas
   */
  private initRenderer(canvas: HTMLCanvasElement): void {
    if (state.initialized) return;

    // Create a Window wrapper around the existing canvas
    const window = new Window({ canvas });

    // Create the renderer
    state.renderer = new Renderer(window, {
      antialias: true,
      alpha: true,
      clearColor: 0x1a1a2e,
    });

    // Create a dedicated scene for the demo
    state.scene = new Scene();

    // Create camera
    state.camera = new PerspectiveCamera(75, 1, 0.1, 1000);
    state.camera.position.z = 3;

    // Create a simple cube
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshStandardMaterial({
      color: 0x6366f1, // Indigo
      roughness: 0.5,
      metalness: 0.5,
    });
    state.cube = new Mesh(geometry, material);
    state.scene.add(state.cube);

    // Add lighting
    const ambientLight = new AmbientLight(0xffffff, 0.5);
    state.scene.add(ambientLight);

    const directionalLight = new DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    state.scene.add(directionalLight);

    // Create TransformControls
    state.transformControls = new TransformControls(state.camera, canvas);
    state.transformControls.disconnect(); // We'll call pointer methods directly
    state.transformControls.attach(state.cube);
    state.transformControls.setMode('translate');

    // Add the helper to the scene
    const helper = state.transformControls.getHelper();
    state.scene.add(helper);

    // Listen for drag events to pause auto-rotate
    state.transformControls.addEventListener('dragging-changed', (event) => {
      // Could use this to disable camera controls if we had OrbitControls
      console.log('TransformControls dragging:', event.value);
    });

    // Create initial render target
    state.renderTarget = state.renderer.createRenderTarget(400, 300);

    // Setup pointer events
    this.setupPointerEvents(canvas);

    state.initialized = true;
    console.log('RendererDemoPanel: Renderer initialized with TransformControls');
  }

  protected onOpened(): void {
    console.log('RendererDemoPanel opened');
  }

  protected onClosed(): void {
    console.log('RendererDemoPanel closed');
    // Reset texture ID when closed (will be recreated when reopened)
    state.textureId = null;
  }

  protected onResize(width: number, height: number): void {
    // Reserve space for info section (same calculation as in onRender)
    const viewportHeight = Math.max(1, Math.floor(height - 140));
    const viewportWidth = Math.max(1, Math.floor(width));

    if (!state.renderer || !state.renderTarget || !state.camera) return;

    // Resize the render target to match the new viewport size
    state.renderer.resizeRenderTarget(state.renderTarget, viewportWidth, viewportHeight);

    // Update camera aspect ratio
    state.camera.aspect = viewportWidth / viewportHeight;
    state.camera.updateProjectionMatrix();

    // Reset texture ID so it gets recreated with new dimensions
    state.textureId = null;

    console.log(`RendererDemoPanel resized to ${viewportWidth}x${viewportHeight}`);
  }

  protected onRender(): void {
    // Get the canvas from the document
    if (!this.editorCanvas) {
      this.editorCanvas = document.getElementById(
        'render-canvas',
      ) as HTMLCanvasElement | null;
    }

    if (!this.editorCanvas) {
      EditorLayout.text('Canvas not found', { color: { r: 1, g: 0.3, b: 0.3 } });
      return;
    }

    // Initialize renderer if needed
    if (!state.initialized) {
      this.initRenderer(this.editorCanvas);
    }

    if (
      !state.renderer ||
      !state.scene ||
      !state.camera ||
      !state.cube ||
      !state.renderTarget
    ) {
      EditorLayout.text('Renderer initialization failed', {
        color: { r: 1, g: 0.3, b: 0.3 },
      });
      return;
    }

    // Get content dimensions (reserve space for info section)
    const contentWidth = Math.max(1, Math.floor(this.getContentWidth()));
    const contentHeight = Math.max(1, Math.floor(this.getContentHeight() - 140));

    // Auto-rotate the cube if enabled
    if (state.autoRotate) {
      state.rotation += 0.016;
      state.cube.rotation.x = state.rotation;
      state.cube.rotation.y = state.rotation * 0.7;
    }

    // Render scene to target
    state.renderer.renderToTarget(
      state.renderTarget,
      state.scene,
      state.camera,
      0x1a1a2e,
      1.0,
    );

    // Reset WebGL state for ImGui
    state.renderer.resetState();

    // Get or create texture ID for ImGui
    if (state.textureId === null && contentWidth > 0 && contentHeight > 0) {
      const threeRenderer = state.renderer.getThreeRenderer();
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

    // Display the rendered texture using ImageViewport
    if (state.textureId !== null && contentWidth > 0 && contentHeight > 0) {
      const result = this.viewport.render(state.textureId, {
        width: contentWidth,
        height: contentHeight,
        uvMin: { x: 0, y: 1 }, // Flip UV for WebGL
        uvMax: { x: 1, y: 0 },
        captureInput: true, // Prevents panel dragging when interacting with viewport
      });

      // Show tooltip when hovered
      if (result.isHovered) {
        ImGui.SetTooltip('Click and drag gizmo to transform cube');
      }
    } else {
      // Placeholder while loading
      EditorLayout.text('Initializing renderer...');
    }

    EditorLayout.spacing();
    EditorLayout.separator();
    EditorLayout.spacing();

    // Controls section
    EditorLayout.sectionHeader('Transform Controls');

    // Mode buttons
    ImGui.Text('Mode:');
    ImGui.SameLine();
    if (ImGui.Button('Translate')) {
      state.transformControls?.setMode('translate');
    }
    ImGui.SameLine();
    if (ImGui.Button('Rotate')) {
      state.transformControls?.setMode('rotate');
    }
    ImGui.SameLine();
    if (ImGui.Button('Scale')) {
      state.transformControls?.setMode('scale');
    }

    // Space toggle
    ImGui.Text('Space:');
    ImGui.SameLine();
    if (ImGui.Button('World')) {
      state.transformControls?.setSpace('world');
    }
    ImGui.SameLine();
    if (ImGui.Button('Local')) {
      state.transformControls?.setSpace('local');
    }

    // Auto-rotate toggle
    const autoRotateRef: [boolean] = [state.autoRotate];
    if (ImGui.Checkbox('Auto Rotate', autoRotateRef)) {
      state.autoRotate = autoRotateRef[0];
    }

    EditorLayout.spacing();

    // Info section
    EditorLayout.sectionHeader('Info');
    EditorLayout.text(`Viewport: ${contentWidth} x ${contentHeight}`);
    if (state.cube) {
      EditorLayout.text(
        `Cube Position: (${state.cube.position.x.toFixed(2)}, ${state.cube.position.y.toFixed(2)}, ${state.cube.position.z.toFixed(2)})`,
      );
    }

    const bounds = this.viewport.bounds;
    EditorLayout.text(
      `Image Bounds: (${bounds.x.toFixed(0)}, ${bounds.y.toFixed(0)}) ${bounds.width}x${bounds.height}`,
    );

    EditorLayout.spacing();
    EditorLayout.hint('Drag the gizmo arrows/rings/boxes to transform the cube');
  }
}
