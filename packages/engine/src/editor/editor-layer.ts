/**
 * EditorLayer - Built-in layer that provides a complete editor UI
 *
 * This layer handles:
 * - Main menu bar with File menu (Save/Load World)
 * - Editor toolbar with play controls, camera controls, transform tools
 * - Hierarchy panel (entity tree)
 * - Inspector panel (component editor)
 * - Scene/Game view panels with render-to-texture
 *
 * Usage:
 * ```typescript
 * const editor = setupEditor(app, {
 *   platform: tauriPlatform, // or webPlatform
 * });
 * ```
 */

import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { Layer } from '../app/layer.js';
import { ImGui, ImGuiImplWeb, ImTextureRef } from '@mori2003/jsimgui';
import type { Application } from '../app/application.js';
import type { EditorPlatform } from './editor-platform.js';
import { EditorManager } from './editor-manager.js';
import { EditorCameraManager } from '../app/editor-camera-manager.js';
import { HelperManager } from '../app/helper-manager.js';
import { WorldSerializer } from '../ecs/serialization/world-serializer.js';
import { AssetDatabase } from '../ecs/asset-database.js';
import { renderImGuiHierarchy } from '../app/imgui/hierarchy-viewer.js';
import { renderImGuiInspector, setSelectedEntity, getSelectedEntity } from '../app/imgui/inspector.js';
import { renderMainMenuBar, type MenuBarCallbacks } from '../app/imgui/menu-bar.js';
import { renderEditorToolbar, getEditorToolbarHeight } from '../app/imgui/editor-toolbar.js';
import { renderDebugPanel } from '../app/imgui/debug-panel.js';
import { MainCamera } from '../ecs/components/rendering/main-camera.js';
import { Camera } from '../ecs/components/rendering/camera.js';
import { CameraClearColor } from '../ecs/components/rendering/camera-clear-color.js';
import { Transform3D } from '../ecs/components/rendering/transform-3d.js';
import { Collider2D } from '../physics/2d/components/collider-2d.js';
import { Collider3D } from '../physics/3d/components/collider-3d.js';
import { SpriteAreaGenerator } from '../ecs/components/generators/sprite-area-generator.js';
import { VirtualCamera } from '../ecs/components/rendering/virtual-camera.js';
import { VirtualCameraBounds } from '../ecs/components/rendering/virtual-camera-bounds.js';
import { VirtualCameraFollow } from '../ecs/components/rendering/virtual-camera-follow.js';
import type { Entity } from '../ecs/entity.js';
import { Render3DManager } from '../ecs/systems/renderer-sync-system.js';
import { UIManager } from '../ui/ui-manager.js';
import { PostProcessingManager } from '../post-processing/managers/post-processing-manager.js';
import { PostProcessing, type PostProcessingData } from '../ecs/components/rendering/post-processing.js';

// ============================================================================
// Editor Configuration
// ============================================================================

/**
 * Configuration options for the editor
 */
export interface EditorConfig {
  /**
   * Platform abstraction for file dialogs and filesystem
   * If not provided, uses web fallback (file input/download)
   */
  platform?: EditorPlatform;

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
   * Custom menu bar callbacks (in addition to built-in Save/Load)
   */
  menuCallbacks?: Partial<MenuBarCallbacks>;

  /**
   * Whether to show the Scene View panel (default: true)
   */
  showSceneView?: boolean;

  /**
   * Whether to show the Game View panel (default: true)
   */
  showGameView?: boolean;

  /**
   * Whether to show the Debug panel (default: true)
   */
  showDebugPanel?: boolean;

  /**
   * Whether to show debug helpers for all entities with applicable components
   * (Collider2D, Camera, etc.) by default. (default: true)
   */
  showHelpers?: boolean;
}

// ============================================================================
// Viewport Render State
// ============================================================================

interface ViewportRenderState {
  renderTarget: THREE.WebGLRenderTarget;
  textureId: bigint | null;
  width: number;
  height: number;
  needsResize: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const LAST_SCENE_PATH_KEY = 'voidscript-editor-last-scene-path';

// ============================================================================
// Editor Layer
// ============================================================================

/**
 * Built-in editor layer that provides complete editor UI
 */
export class EditorLayer extends Layer {
  private config: EditorConfig;
  private worldSerializer = new WorldSerializer();
  private saveInProgress = false;
  private loadInProgress = false;

  // Current scene path (set after save/load)
  private currentScenePath: string | null = null;

  // Viewport render states
  private sceneViewport: ViewportRenderState | null = null;
  private gameViewport: ViewportRenderState | null = null;

  // Track panel sizes for resize detection
  private lastSceneViewSize = { x: 0, y: 0 };
  private lastGameViewSize = { x: 0, y: 0 };

  // Track if Scene View panel is hovered (to allow camera input)
  private isSceneViewHovered = false;

  // Cached game camera for Game View rendering (separate from editor camera)
  private gameCamera: THREE.Camera | null = null;
  private gameCameraEntity: Entity | null = null;

  // Helper management (internal, not ECS)
  private helperManager: HelperManager | null = null;

  constructor(config: EditorConfig = {}) {
    super('EditorLayer');
    this.config = config;
  }

  override async onAttach(): Promise<void> {
    console.log('[EditorLayer] Editor attached');

    // Initialize viewport render targets with default size
    // They will be resized to match panel size on first render
    const defaultSize = 512;

    this.sceneViewport = this.createViewportState(defaultSize, defaultSize);
    this.gameViewport = this.createViewportState(defaultSize, defaultSize);

    // Tell EditorManager that we're handling viewport rendering
    // This prevents the main renderer.render() from being called
    const app = this.getApplication();
    const editorManager = app.getResource(EditorManager);
    if (editorManager) {
      editorManager.setUseViewportRendering(true);
    }

    // Initialize HelperManager for debug visualization (internal, not ECS)
    const renderer = app.getRenderer();
    this.helperManager = new HelperManager({
      scene: renderer.getScene(),
      showHelpers: this.config.showHelpers ?? true,
    });

    // NOTE: Auto-loading of last scene is now handled by Application.loadDefaultWorld()
    // The Application checks localStorage first (in editor mode) before falling back to defaultWorld.
    // This ensures consistent loading behavior across editor and game modes.

    // Restore currentScenePath from localStorage so Save button is enabled
    // if a scene was previously saved and auto-loaded by Application
    this.currentScenePath = this.getCachedScenePath();
  }

  /**
   * Get cached scene path from localStorage
   */
  private getCachedScenePath(): string | null {
    try {
      return localStorage.getItem(LAST_SCENE_PATH_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Load a scene from a specific path (used for auto-load and direct load)
   */
  private async loadSceneFromPath(filePath: string): Promise<boolean> {
    const platform = this.config.platform;
    if (!platform) {
      console.warn('[EditorLayer] No platform configured for file operations');
      return false;
    }

    try {
      const json = await platform.readTextFile(filePath);
      const app = this.getApplication();

      // Clear selected entity before loading (it will become invalid)
      setSelectedEntity(undefined);

      // Clear cached game camera (entities will change)
      this.gameCamera = null;
      this.gameCameraEntity = null;

      // Clear post-processing entity tracking (scene is being replaced)
      this.lastPostProcessingEntity = null;

      const loadResult = this.worldSerializer.deserializeFromString(
        app.world,
        app.getCommands(),
        json,
        {
          mode: 'replace',
          assetMetadataResolver: (guid) => AssetDatabase.getMetadata(guid),
        }
      );

      if (loadResult.success) {
        // Update current path and cache it
        this.currentScenePath = filePath;
        this.cacheScenePath(filePath);

        console.log(`[EditorLayer] World loaded from: ${filePath}`);
        console.log(`[EditorLayer] Created ${loadResult.entitiesCreated} entities`);
        if (loadResult.warnings.length > 0) {
          console.warn('[EditorLayer] Warnings:', loadResult.warnings);
        }
        return true;
      } else {
        console.error('[EditorLayer] Load failed:', loadResult.error);
        return false;
      }
    } catch (err) {
      console.error(`[EditorLayer] Failed to load scene from ${filePath}:`, err);
      // Clear cached path if file doesn't exist anymore
      this.clearCachedScenePath();
      return false;
    }
  }

  /**
   * Cache the scene path to localStorage
   */
  private cacheScenePath(path: string): void {
    try {
      localStorage.setItem(LAST_SCENE_PATH_KEY, path);
    } catch (e) {
      console.warn('[EditorLayer] Failed to cache scene path:', e);
    }
  }

  /**
   * Clear the cached scene path
   */
  private clearCachedScenePath(): void {
    try {
      localStorage.removeItem(LAST_SCENE_PATH_KEY);
    } catch (e) {
      // Ignore
    }
  }

  override onDetach(): void {
    console.log('[EditorLayer] Editor detached');

    // Dispose render targets
    this.sceneViewport?.renderTarget.dispose();
    this.gameViewport?.renderTarget.dispose();

    // Dispose HelperManager (removes all helpers from scene)
    this.helperManager?.dispose();
    this.helperManager = null;

    // Tell EditorManager we're no longer handling viewport rendering
    const app = this.getApplication();
    const editorManager = app.getResource(EditorManager);
    if (editorManager) {
      editorManager.setUseViewportRendering(false);
    }
  }

  private createViewportState(width: number, height: number): ViewportRenderState {
    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    return {
      renderTarget,
      textureId: null,
      width,
      height,
      needsResize: false,
    };
  }

  private resizeViewport(viewport: ViewportRenderState, width: number, height: number): void {
    if (width <= 0 || height <= 0) return;

    viewport.renderTarget.setSize(width, height);
    viewport.width = width;
    viewport.height = height;
    viewport.needsResize = false;
    // Invalidate texture ID - setSize() creates a new WebGL texture internally
    viewport.textureId = null;
  }

  override onUpdate(deltaTime: number): void {
    const app = this.getApplication();
    const editorCameraManager = app.getResource(EditorCameraManager);

    if (editorCameraManager) {
      // Allow camera input when Scene View is hovered, even though ImGui wants mouse
      // Block input only if ImGui wants it AND we're not hovering Scene View
      const io = ImGui.GetIO();
      const blockInput = (io.WantCaptureKeyboard || io.WantCaptureMouse) && !this.isSceneViewHovered;
      editorCameraManager.update(deltaTime, blockInput);
    }

    // Sync debug helpers for entities with Collider2D/Camera
    this.syncHelpers(app);
  }

  // ============================================================================
  // Helper Management (Internal)
  // ============================================================================

  /**
   * Track which entities currently have helpers to detect removals
   */
  private helperEntities = new Set<Entity>();

  /**
   * Sync debug helpers for all entities with Collider2D or Camera components.
   * Called every frame from onUpdate.
   */
  private syncHelpers(app: Application): void {
    if (!this.helperManager) return;

    const commands = app.getCommands();
    const selectedEntity = getSelectedEntity();
    const showAll = this.helperManager.showHelpers;

    // Get viewport resolution for LineMaterial
    const viewport = this.sceneViewport ?? this.gameViewport;
    const resolution = viewport
      ? { width: viewport.width, height: viewport.height }
      : { width: 512, height: 512 };

    // Track entities we've seen this frame
    const seenEntities = new Set<Entity>();

    // Sync Collider2D helpers
    commands.query().all(Collider2D, Transform3D).each((entity, collider, transform) => {
      seenEntities.add(entity);
      const shouldShow = showAll || entity === selectedEntity;

      if (shouldShow) {
        // Create helper if doesn't exist
        if (!this.helperManager!.hasHelper(entity)) {
          this.helperManager!.createCollider2DHelper(entity, collider.shape, resolution);
          this.helperEntities.add(entity);
        }

        // Update helper transform and shape
        const entry = this.helperManager!.getHelperEntry(entity);
        if (entry && entry.type === 'collider2d') {
          // Check if shape type changed
          if (entry.shapeType !== collider.shape.type) {
            entry.helper.setShape(collider.shape);
          }
          entry.helper.update(collider, transform);
        }
      } else {
        // Remove helper if shouldn't show
        if (this.helperManager!.hasHelper(entity)) {
          this.helperManager!.removeHelper(entity);
          this.helperEntities.delete(entity);
        }
      }
    });

    // Sync Collider3D helpers
    commands.query().all(Collider3D, Transform3D).each((entity, collider, transform) => {
      seenEntities.add(entity);
      const shouldShow = showAll || entity === selectedEntity;

      if (shouldShow) {
        // Create helper if doesn't exist
        if (!this.helperManager!.hasHelper(entity)) {
          this.helperManager!.createCollider3DHelper(entity, collider.shape, resolution);
          this.helperEntities.add(entity);
        }

        // Update helper transform and shape
        const entry = this.helperManager!.getHelperEntry(entity);
        if (entry && entry.type === 'collider3d') {
          // Check if shape type changed
          if (entry.shapeType !== collider.shape.type) {
            entry.helper.setShape(collider.shape);
          }
          entry.helper.update(collider, transform);
        }
      } else {
        // Remove helper if shouldn't show
        if (this.helperManager!.hasHelper(entity)) {
          this.helperManager!.removeHelper(entity);
          this.helperEntities.delete(entity);
        }
      }
    });

    // Sync SpriteAreaGenerator helpers
    commands.query().all(SpriteAreaGenerator, Transform3D).each((entity, spriteGen, transform) => {
      seenEntities.add(entity);
      const shouldShow = showAll || entity === selectedEntity;

      if (shouldShow) {
        // Create helper if doesn't exist
        if (!this.helperManager!.hasHelper(entity)) {
          const box3 = new THREE.Box3(
            new THREE.Vector3(
              Math.min(spriteGen.boundsMin.x, spriteGen.boundsMax.x),
              Math.min(spriteGen.boundsMin.y, spriteGen.boundsMax.y),
              Math.min(spriteGen.boundsMin.z, spriteGen.boundsMax.z)
            ),
            new THREE.Vector3(
              Math.max(spriteGen.boundsMin.x, spriteGen.boundsMax.x),
              Math.max(spriteGen.boundsMin.y, spriteGen.boundsMax.y),
              Math.max(spriteGen.boundsMin.z, spriteGen.boundsMax.z)
            )
          );
          this.helperManager!.createBox3Helper(entity, box3, resolution);
          this.helperEntities.add(entity);
        }

        // Update helper (recreate box if bounds changed)
        const entry = this.helperManager!.getHelperEntry(entity);
        if (entry && entry.type === 'box3') {
          const box3 = new THREE.Box3(
            new THREE.Vector3(
              Math.min(spriteGen.boundsMin.x, spriteGen.boundsMax.x),
              Math.min(spriteGen.boundsMin.y, spriteGen.boundsMax.y),
              Math.min(spriteGen.boundsMin.z, spriteGen.boundsMax.z)
            ),
            new THREE.Vector3(
              Math.max(spriteGen.boundsMin.x, spriteGen.boundsMax.x),
              Math.max(spriteGen.boundsMin.y, spriteGen.boundsMax.y),
              Math.max(spriteGen.boundsMin.z, spriteGen.boundsMax.z)
            )
          );
          entry.helper.setBox3(box3);
          entry.helper.update(spriteGen, transform);
        }
      } else {
        // Remove helper if shouldn't show
        if (this.helperManager!.hasHelper(entity)) {
          this.helperManager!.removeHelper(entity);
          this.helperEntities.delete(entity);
        }
      }
    });

    // Sync Camera helpers
    // In 2D mode, hide the cone/target lines since they look confusing from top-down view
    const editorCameraManager = app.getResource(EditorCameraManager);
    const isEditor2DMode = editorCameraManager?.mode === '2d';

    commands.query().all(Transform3D, Camera).each((entity, transform, cameraComp) => {
      seenEntities.add(entity);
      const shouldShow = showAll || entity === selectedEntity;

      if (shouldShow) {
        // Get aspect ratio from renderer size (same source as camera-sync-system)
        // This ensures the helper matches what the actual camera will render
        const renderManager = app.getResource(Render3DManager);
        if (!renderManager) return;
        const renderer = renderManager.getRenderer();
        const { width, height } = renderer.getSize();
        const aspect = width / height;

        const cameraType = cameraComp.type || 'perspective';

        // Create helper if doesn't exist
        if (!this.helperManager!.hasHelper(entity)) {
          // Create a temporary THREE camera for the helper
          let camera: THREE.Camera;
          if (cameraType === 'perspective') {
            // Cap the helper's far plane to a reasonable visual distance
            // This makes the frustum helper more manageable in the editor
            // while the actual camera still uses the full far plane
            const helperFar = Math.min(cameraComp.far, 50);
            camera = new THREE.PerspectiveCamera(
              cameraComp.fov,
              aspect,
              cameraComp.near,
              helperFar
            );
          } else {
            const effectiveSize = cameraComp.size / cameraComp.zoom;
            camera = new THREE.OrthographicCamera(
              -effectiveSize * aspect,
              effectiveSize * aspect,
              effectiveSize,
              -effectiveSize,
              cameraComp.near,
              cameraComp.far
            );
          }
          this.helperManager!.createCameraHelper(entity, camera);
          this.helperEntities.add(entity);
        } else {
          // Check if camera type has changed - if so, recreate the helper
          const entry = this.helperManager!.getHelperEntry(entity);
          if (entry && entry.type === 'camera') {
            const helperIsPersp = entry.camera instanceof THREE.PerspectiveCamera;
            const helperIsOrtho = entry.camera instanceof THREE.OrthographicCamera;
            const needsRecreate =
              (cameraType === 'perspective' && !helperIsPersp) ||
              (cameraType === 'orthographic' && !helperIsOrtho);

            if (needsRecreate) {
              // Camera type changed - recreate the helper
              this.helperManager!.removeHelper(entity);

              // Create new helper with correct camera type
              let camera: THREE.Camera;
              if (cameraType === 'perspective') {
                // Cap the helper's far plane to a reasonable visual distance
                const helperFar = Math.min(cameraComp.far, 50);
                camera = new THREE.PerspectiveCamera(
                  cameraComp.fov,
                  aspect,
                  cameraComp.near,
                  helperFar
                );
              } else {
                const effectiveSize = cameraComp.size / cameraComp.zoom;
                camera = new THREE.OrthographicCamera(
                  -effectiveSize * aspect,
                  effectiveSize * aspect,
                  effectiveSize,
                  -effectiveSize,
                  cameraComp.near,
                  cameraComp.far
                );
              }
              this.helperManager!.createCameraHelper(entity, camera);
            } else {
              // Same type - just update properties
              if (cameraType === 'perspective' && entry.camera instanceof THREE.PerspectiveCamera) {
                // Cap the helper's far plane to a reasonable visual distance
                const helperFar = Math.min(cameraComp.far, 50);
                entry.camera.fov = cameraComp.fov;
                entry.camera.aspect = aspect;
                entry.camera.near = cameraComp.near;
                entry.camera.far = helperFar;
                entry.camera.updateProjectionMatrix();
                // Update the helper after changing projection
                entry.helper.update();
              } else if (cameraType === 'orthographic' && entry.camera instanceof THREE.OrthographicCamera) {
                const effectiveSize = cameraComp.size / cameraComp.zoom;
                entry.camera.left = -effectiveSize * aspect;
                entry.camera.right = effectiveSize * aspect;
                entry.camera.top = effectiveSize;
                entry.camera.bottom = -effectiveSize;
                entry.camera.near = cameraComp.near;
                entry.camera.far = cameraComp.far;
                entry.camera.updateProjectionMatrix();
                // Update the helper after changing projection
                entry.helper.update();
              }
            }
          }
        }

        // Update helper transform
        this.helperManager!.updateCameraHelper(entity, {
          position: new THREE.Vector3(
            transform.position.x,
            transform.position.y,
            transform.position.z
          ),
          rotation: new THREE.Euler(
            transform.rotation.x,
            transform.rotation.y,
            transform.rotation.z
          ),
        });
      } else {
        // Remove helper if shouldn't show
        if (this.helperManager!.hasHelper(entity)) {
          this.helperManager!.removeHelper(entity);
          this.helperEntities.delete(entity);
        }
      }
    });

    // Sync VirtualCameraBounds helpers (entity-based bounds system)
    commands.query().all(VirtualCameraBounds, Transform3D).each((entity, bounds, boundsTransform) => {
      seenEntities.add(entity);

      // Show bounds helper if showAll or if selected, or if any VirtualCamera references this entity
      let isReferenced = false;
      commands.query().all(VirtualCamera).each((vcamEntity, vcam) => {
        if (vcam.enableCameraBounds && vcam.boundsEntity === entity) {
          isReferenced = true;
        }
      });

      const shouldShow = showAll || entity === selectedEntity || isReferenced;

      if (shouldShow) {
        // Calculate world-space bounds from entity position and size
        const halfWidth = bounds.size.x / 2;
        const halfHeight = bounds.size.y / 2;
        const minX = boundsTransform.position.x - halfWidth;
        const minY = boundsTransform.position.y - halfHeight;
        const maxX = boundsTransform.position.x + halfWidth;
        const maxY = boundsTransform.position.y + halfHeight;

        // Create helper if doesn't exist
        if (!this.helperManager!.hasHelper(entity)) {
          const box3 = new THREE.Box3(
            new THREE.Vector3(minX, minY, -100),
            new THREE.Vector3(maxX, maxY, 100)
          );
          this.helperManager!.createBox3Helper(entity, box3, resolution);
          this.helperEntities.add(entity);

          // Set orange color to distinguish from other helpers
          const entry = this.helperManager!.getHelperEntry(entity);
          if (entry && entry.type === 'box3') {
            entry.helper.setColor(0xffaa00);
          }
        }

        // Update helper bounds (in case they changed)
        const entry = this.helperManager!.getHelperEntry(entity);
        if (entry && entry.type === 'box3') {
          const box3 = new THREE.Box3(
            new THREE.Vector3(minX, minY, -100),
            new THREE.Vector3(maxX, maxY, 100)
          );
          entry.helper.setBox3(box3);
          // Position the helper at the center of the box (geometry is centered at origin)
          const center = box3.getCenter(new THREE.Vector3());
          entry.helper.position.copy(center);
          entry.helper.rotation.set(0, 0, 0);
          entry.helper.scale.set(1, 1, 1);
        }
      } else {
        // Remove helper if shouldn't show
        if (this.helperManager!.hasHelper(entity)) {
          this.helperManager!.removeHelper(entity);
          this.helperEntities.delete(entity);
        }
      }
    });

    // Sync VirtualCameraFollow dead zone helpers
    commands.query().all(VirtualCameraFollow, VirtualCamera, Transform3D).each((entity, follow, vcam, transform) => {
      seenEntities.add(entity);

      // Create pseudo-entities for dead zone and soft zone helpers
      // We use negative entity IDs to avoid conflicts with real entities
      const deadZoneHelperEntity = -(entity * 2 + 1) as Entity; // Odd negative
      const softZoneHelperEntity = -(entity * 2 + 2) as Entity; // Even negative

      seenEntities.add(deadZoneHelperEntity);
      seenEntities.add(softZoneHelperEntity);

      // Only show dead zone helper when:
      // 1. Mode is transposer
      // 2. Dead zone is enabled
      // 3. Entity is selected or showAll is true
      const shouldShow =
        follow.mode === 'transposer' &&
        follow.enableDeadZone &&
        (showAll || entity === selectedEntity);

      if (shouldShow) {
        // Get the render manager for viewport calculations
        const renderManager = app.getResource(Render3DManager);
        if (!renderManager) return;

        const threeCamera = renderManager.getRenderer().getCamera();
        if (!threeCamera) return;

        // Get viewport dimensions from render manager
        const viewportSize = renderManager.getRenderer().getSize();

        // Initialize missing properties for backward compatibility
        if (!follow.deadZone || follow.deadZone.width === undefined || follow.deadZone.height === undefined) {
          follow.deadZone = { width: 0.1, height: 0.1 };
        }
        if (!follow.softZone || follow.softZone.width === undefined || follow.softZone.height === undefined) {
          follow.softZone = { width: 0.3, height: 0.3 };
        }

        // Calculate world-space dimensions for both camera types
        let cameraWorldDimensions: { width: number; height: number };

        if (vcam.type === 'orthographic') {
          const orthoSize = vcam.size / vcam.zoom;
          const aspect = viewportSize.width / viewportSize.height;
          cameraWorldDimensions = {
            width: orthoSize * aspect,
            height: orthoSize
          };
        } else if (vcam.type === 'perspective') {
          const approximateDistance = Math.abs(transform.position.z);
          const fovRadians = (vcam.fov * Math.PI) / 180;
          const visibleHeight = 2 * Math.tan(fovRadians / 2) * approximateDistance;
          const aspect = viewportSize.width / viewportSize.height;
          cameraWorldDimensions = {
            width: visibleHeight * aspect,
            height: visibleHeight
          };
        } else {
          return; // Unknown camera type
        }

        // Convert viewport percentages to world units
        const deadZoneWorldWidth = follow.deadZone.width * cameraWorldDimensions.width;
        const deadZoneWorldHeight = follow.deadZone.height * cameraWorldDimensions.height;
        const softZoneWorldWidth = follow.softZone.width * cameraWorldDimensions.width;
        const softZoneWorldHeight = follow.softZone.height * cameraWorldDimensions.height;

        // Camera is centered at transform.position + offset
        const centerX = transform.position.x + follow.offset.x;
        const centerY = transform.position.y + follow.offset.y;

        // Create dead zone box (centered at origin, will be positioned via helper.position)
        const deadZoneBox = new THREE.Box3(
          new THREE.Vector3(
            -deadZoneWorldWidth / 2,
            -deadZoneWorldHeight / 2,
            -100
          ),
          new THREE.Vector3(
            deadZoneWorldWidth / 2,
            deadZoneWorldHeight / 2,
            100
          )
        );

        // Create soft zone box (centered at origin, will be positioned via helper.position)
        const softZoneBox = new THREE.Box3(
          new THREE.Vector3(
            -softZoneWorldWidth / 2,
            -softZoneWorldHeight / 2,
            -100
          ),
          new THREE.Vector3(
            softZoneWorldWidth / 2,
            softZoneWorldHeight / 2,
            100
          )
        );

        // Create/update soft zone helper first (semi-transparent yellow, renders behind)
        if (!this.helperManager!.hasHelper(softZoneHelperEntity)) {
          this.helperManager!.createBox3Helper(softZoneHelperEntity, softZoneBox, resolution);
          this.helperEntities.add(softZoneHelperEntity);

          const entry = this.helperManager!.getHelperEntry(softZoneHelperEntity);
          if (entry && entry.type === 'box3') {
            entry.helper.setColor(0xffff00); // Yellow
            entry.helper.setOpacity(0.3); // Lower opacity
            entry.helper.renderOrder = 999999998; // Render behind dead zone
          }
        } else {
          const entry = this.helperManager!.getHelperEntry(softZoneHelperEntity);
          if (entry && entry.type === 'box3') {
            entry.helper.setBox3(softZoneBox);
            entry.helper.setColor(0xffff00); // Yellow
            entry.helper.setOpacity(0.3); // Lower opacity
            entry.helper.renderOrder = 999999998; // Render behind dead zone
            // Position at camera center (box is already centered at origin)
            entry.helper.position.set(centerX, centerY, 0);
            entry.helper.rotation.set(0, 0, 0);
            entry.helper.scale.set(1, 1, 1);
          }
        }

        // Create/update dead zone helper second (cyan, renders on top)
        if (!this.helperManager!.hasHelper(deadZoneHelperEntity)) {
          this.helperManager!.createBox3Helper(deadZoneHelperEntity, deadZoneBox, resolution);
          this.helperEntities.add(deadZoneHelperEntity);

          const entry = this.helperManager!.getHelperEntry(deadZoneHelperEntity);
          if (entry && entry.type === 'box3') {
            entry.helper.setColor(0x00ffff); // Cyan (to distinguish from soft zone)
            entry.helper.setOpacity(1.0); // Full opacity
            entry.helper.renderOrder = 999999999; // Render on top of soft zone
            // Position at camera center (box is already centered at origin)
            entry.helper.position.set(centerX, centerY, 0);
            entry.helper.rotation.set(0, 0, 0);
            entry.helper.scale.set(1, 1, 1);
          }
        } else {
          const entry = this.helperManager!.getHelperEntry(deadZoneHelperEntity);
          if (entry && entry.type === 'box3') {
            entry.helper.setBox3(deadZoneBox);
            entry.helper.setColor(0x00ffff); // Cyan (to distinguish from soft zone)
            entry.helper.setOpacity(1.0); // Full opacity
            entry.helper.renderOrder = 999999999; // Render on top of soft zone
            // Position at camera center (box is already centered at origin)
            entry.helper.position.set(centerX, centerY, 0);
            entry.helper.rotation.set(0, 0, 0);
            entry.helper.scale.set(1, 1, 1);
          }
        }
      } else {
        // Remove both dead zone and soft zone helpers if shouldn't show
        const deadZoneHelperEntity = -(entity * 2 + 1) as Entity;
        const softZoneHelperEntity = -(entity * 2 + 2) as Entity;

        if (this.helperManager!.hasHelper(deadZoneHelperEntity)) {
          this.helperManager!.removeHelper(deadZoneHelperEntity);
          this.helperEntities.delete(deadZoneHelperEntity);
        }
        if (this.helperManager!.hasHelper(softZoneHelperEntity)) {
          this.helperManager!.removeHelper(softZoneHelperEntity);
          this.helperEntities.delete(softZoneHelperEntity);
        }
      }
    });

    // Remove helpers for entities that no longer exist
    for (const entity of this.helperEntities) {
      if (!seenEntities.has(entity)) {
        this.helperManager!.removeHelper(entity);
        this.helperEntities.delete(entity);
      }
    }

    // Hide camera helper cone/up/target lines in 2D mode (they look confusing from top-down)
    this.helperManager.setCameraHelperConeVisible(!isEditor2DMode);
  }

  override onRender(): void {
    // Clear the canvas since we're skipping the main renderer.render()
    // This ensures a clean background for ImGui
    const app = this.getApplication();
    const renderer = app.getRenderer();
    const threeRenderer = renderer.getThreeRenderer();

    // Clear to a dark color matching ImGui's dark theme
    threeRenderer.setClearColor(0x1a1a2e, 1);
    threeRenderer.clear();
  }

  override onImGuiRender(): void {
    const app = this.getApplication();
    const editorCameraManager = app.getResource(EditorCameraManager);
    const editorManager = app.getResource(EditorManager);

    // Render main menu bar
    const menuCallbacks: MenuBarCallbacks = {
      onSaveWorld: this.config.menuCallbacks?.onSaveWorld ?? (() => this.handleSaveWorld()),
      onSaveWorldAs: this.config.menuCallbacks?.onSaveWorldAs ?? (() => this.handleSaveWorldAs()),
      onLoadWorld: this.config.menuCallbacks?.onLoadWorld ?? (() => this.handleLoadWorld()),
      onReload: this.config.menuCallbacks?.onReload ?? (() => window.location.reload()),
      hasCurrentPath: this.config.menuCallbacks?.hasCurrentPath ?? (this.currentScenePath !== null),
      isPlaying: this.config.menuCallbacks?.isPlaying ?? (editorManager?.mode === 'play'),
      fileMenuItems: this.config.menuCallbacks?.fileMenuItems,
      windowMenuItems: this.config.menuCallbacks?.windowMenuItems,
      customMenus: this.config.menuCallbacks?.customMenus,
    };
    renderMainMenuBar(menuCallbacks);

    // Render editor toolbar
    if (editorCameraManager) {
      renderEditorToolbar({
        editorCameraManager,
        editorManager,
        helperManager: this.helperManager ?? undefined,
        currentFPS: app.getCurrentFPS(),
      });
    }

    // Render panels with dockspace
    this.renderDockspace(app);
  }

  // ============================================================================
  // Game Camera Management
  // ============================================================================

  /**
   * Get or create the game camera from ECS MainCamera entity.
   * This is separate from the editor camera and represents what the player would see.
   */
  private getGameCamera(app: Application, viewportWidth: number, viewportHeight: number): THREE.Camera {
    const commands = app.getCommands();
    const aspect = viewportWidth / viewportHeight;

    // Find the MainCamera entity
    let mainCameraEntity: Entity | null = null;
    let cameraType: 'perspective' | 'orthographic' | null = null;

    commands.query().all(MainCamera, Camera).each((entity, _, cameraComp) => {
      if (!mainCameraEntity) {
        mainCameraEntity = entity;
        cameraType = cameraComp.type || 'perspective';
      }
    });

    // Fallback: look for any camera entity
    if (!mainCameraEntity) {
      commands.query().all(Camera).each((entity, cameraComp) => {
        if (!mainCameraEntity) {
          mainCameraEntity = entity;
          cameraType = cameraComp.type || 'perspective';
        }
      });
    }

    // If no camera entity found, return renderer's default camera
    if (!mainCameraEntity || !cameraType) {
      return app.getRenderer().getCamera();
    }

    const cameraData = commands.getComponent(mainCameraEntity, Camera);

    // Check if we need to create/recreate the camera
    const needsNewCamera =
      !this.gameCamera ||
      this.gameCameraEntity !== mainCameraEntity ||
      (cameraType === 'perspective' && !(this.gameCamera instanceof THREE.PerspectiveCamera)) ||
      (cameraType === 'orthographic' && !(this.gameCamera instanceof THREE.OrthographicCamera));

    if (needsNewCamera) {
      if (cameraType === 'perspective') {
        this.gameCamera = new THREE.PerspectiveCamera(
          cameraData.fov,
          aspect,
          cameraData.near,
          cameraData.far
        );
      } else {
        const effectiveSize = cameraData.size / cameraData.zoom;
        const halfWidth = effectiveSize * aspect;
        this.gameCamera = new THREE.OrthographicCamera(
          -halfWidth,
          halfWidth,
          effectiveSize,
          -effectiveSize,
          cameraData.near,
          cameraData.far
        );
      }
      this.gameCameraEntity = mainCameraEntity;
    }

    // Update camera properties from ECS components
    const transform = commands.tryGetComponent(mainCameraEntity, Transform3D);
    if (transform) {
      this.gameCamera!.position.set(
        transform.position.x,
        transform.position.y,
        transform.position.z
      );
      this.gameCamera!.rotation.set(
        transform.rotation.x,
        transform.rotation.y,
        transform.rotation.z,
        'YXZ'
      );
    }

    // Update camera-specific properties
    if (cameraType === 'perspective' && this.gameCamera instanceof THREE.PerspectiveCamera) {
      this.gameCamera.fov = cameraData.fov;
      this.gameCamera.near = cameraData.near;
      this.gameCamera.far = cameraData.far;
      this.gameCamera.aspect = aspect;
      this.gameCamera.updateProjectionMatrix();
    } else if (cameraType === 'orthographic' && this.gameCamera instanceof THREE.OrthographicCamera) {
      const effectiveSize = cameraData.size / cameraData.zoom;
      const halfWidth = effectiveSize * aspect;
      this.gameCamera.left = -halfWidth;
      this.gameCamera.right = halfWidth;
      this.gameCamera.top = effectiveSize;
      this.gameCamera.bottom = -effectiveSize;
      this.gameCamera.near = cameraData.near;
      this.gameCamera.far = cameraData.far;
      this.gameCamera.updateProjectionMatrix();
    }

    return this.gameCamera!;
  }

  // ============================================================================
  // Viewport Rendering
  // ============================================================================

  // Editor-specific clear color (distinct from game's CameraClearColor)
  private static readonly SCENE_VIEW_CLEAR_COLOR = new THREE.Color(0x2a2a3e);
  private static readonly SCENE_VIEW_CLEAR_ALPHA = 1;

  /**
   * Get post-processing data from the first entity with PostProcessing component
   */
  private getPostProcessingData(commands: import('../ecs/command.js').Command): {
    entity: Entity | null;
    data: PostProcessingData | null;
  } {
    let postProcessingEntity: Entity | null = null;
    let postProcessingData: PostProcessingData | null = null;

    commands
      .query()
      .all(PostProcessing)
      .each((entity, pp) => {
        if (!postProcessingEntity) {
          postProcessingEntity = entity;
          postProcessingData = pp;
        }
      });

    return { entity: postProcessingEntity, data: postProcessingData };
  }

  /**
   * Check if post-processing should be applied
   */
  private shouldApplyPostProcessing(ppData: PostProcessingData | null): boolean {
    if (!ppData || !ppData.globalEnabled) {
      return false;
    }

    // Check if any effects are enabled
    for (const config of ppData.effects.values()) {
      if (config.enabled) {
        return true;
      }
    }

    return false;
  }

  // Track the last post-processing entity for detecting changes
  private lastPostProcessingEntity: Entity | null = null;

  private renderViewportToTarget(
    app: Application,
    viewport: ViewportRenderState,
    useEditorCamera: boolean
  ): void {
    const renderer = app.getRenderer();
    const threeRenderer = renderer.getThreeRenderer();
    const scene = renderer.getScene();
    const editorCameraManager = app.getResource(EditorCameraManager);
    const commands = app.getCommands();

    // Check if we should apply post-processing (Game View only)
    const postProcessingManager = app.getResource(PostProcessingManager);
    const { entity: ppEntity, data: ppData } = this.getPostProcessingData(commands);
    const shouldPostProcess = !useEditorCamera && postProcessingManager && this.shouldApplyPostProcessing(ppData);

    // Determine which camera to use
    let camera: THREE.Camera;
    if (useEditorCamera && editorCameraManager) {
      camera = editorCameraManager.getEditorCamera();
    } else {
      // For Game View, use the game camera from ECS (not the renderer's camera)
      camera = this.getGameCamera(app, viewport.width, viewport.height);
    }

    // Determine clear color based on view type
    let clearColor: THREE.Color;
    let clearAlpha: number;

    if (useEditorCamera) {
      // Scene View uses editor-specific clear color
      clearColor = EditorLayer.SCENE_VIEW_CLEAR_COLOR;
      clearAlpha = EditorLayer.SCENE_VIEW_CLEAR_ALPHA;
    } else {
      // Game View uses CameraClearColor from the game camera entity
      clearColor = new THREE.Color(0x1a1a2e); // Default
      clearAlpha = 1;

      if (this.gameCameraEntity) {
        const cameraClearColor = commands.tryGetComponent(this.gameCameraEntity, CameraClearColor);
        if (cameraClearColor) {
          clearColor = cameraClearColor.color;
          clearAlpha = cameraClearColor.alpha;
        }
      }
    }

    // Update LineMaterial resolution for all LineSegments2 helpers before rendering
    // CRITICAL: LineMaterial requires resolution to be set to viewport size for proper rendering
    scene.traverse((obj) => {
      if ('isLineSegments2' in obj && obj.isLineSegments2) {
        const lineSegments = obj as LineSegments2;
        const material = lineSegments.material as LineMaterial;
        if (material && material.resolution) {
          material.resolution.set(viewport.width, viewport.height);
        }
      }
    });

    // Store current render target
    const previousTarget = threeRenderer.getRenderTarget();

    // Set output target for the render pipeline
    renderer.setOutputTarget(viewport.renderTarget);

    // Resize composer to match viewport
    renderer.resizeComposer(viewport.width, viewport.height);

    // Sync post-processing effects (Game View only)
    if (shouldPostProcess && ppData && postProcessingManager) {
      // Sync effects to renderer's composer
      postProcessingManager.syncEffects(
        ppData.effects,
        scene,
        camera,
        viewport.width,
        viewport.height,
        commands
      );

      // Clear dirty flag
      if (ppData._dirty) {
        ppData._dirty = false;
      }
      this.lastPostProcessingEntity = ppEntity;
    } else if (postProcessingManager) {
      // Clear effects when not using post-processing
      postProcessingManager.clearEffects();
    }

    // Set clear color
    threeRenderer.setClearColor(clearColor, clearAlpha);

    // Render through the pipeline (scene + effects + blit to output target)
    renderer.renderPipeline(scene, camera, app.getDeltaTime());

    // Render UI layer on top of the game scene (only for Game View, not Scene View)
    if (!useEditorCamera) {
      const uiManager = app.getResource(UIManager);
      if (uiManager) {
        // Ensure render target is set to viewport
        threeRenderer.setRenderTarget(viewport.renderTarget);
        // Update UI viewport size to match game viewport
        uiManager.setViewportSize(viewport.width, viewport.height);
        // Render UI (skip state reset since we're managing render target)
        uiManager.render(true);
      }
    }

    // Reset output target
    renderer.setOutputTarget(null);

    // Restore previous target
    threeRenderer.setRenderTarget(previousTarget);
  }

  private getOrCreateTextureId(viewport: ViewportRenderState): bigint | null {
    const app = this.getApplication();
    const renderer = app.getRenderer();
    const threeRenderer = renderer.getThreeRenderer();

    // Force Three.js to initialize the texture if not already done
    threeRenderer.initTexture(viewport.renderTarget.texture);

    // Get the WebGL texture from Three.js render target
    const textureProps = threeRenderer.properties.get(viewport.renderTarget.texture) as { __webglTexture?: WebGLTexture };
    const webglTexture = textureProps.__webglTexture;

    if (!webglTexture) {
      // Texture not yet created by Three.js
      return null;
    }

    // Always create a fresh texture ID when we don't have one
    if (viewport.textureId === null) {
      viewport.textureId = ImGuiImplWeb.LoadTexture(undefined, {
        processFn: () => webglTexture,
      });
    }

    return viewport.textureId;
  }

  // ============================================================================
  // Dockspace Layout
  // ============================================================================

  private renderDockspace(app: Application): void {
    const viewport = ImGui.GetMainViewport();
    const toolbarHeight = getEditorToolbarHeight();

    // Position below menu bar and toolbar
    const dockspacePos = {
      x: viewport.Pos.x,
      y: viewport.Pos.y + toolbarHeight,
    };
    const dockspaceSize = {
      x: viewport.Size.x,
      y: viewport.Size.y - toolbarHeight,
    };

    // Create dockspace window
    ImGui.SetNextWindowPos(dockspacePos, ImGui.Cond.Always);
    ImGui.SetNextWindowSize(dockspaceSize, ImGui.Cond.Always);
    ImGui.SetNextWindowViewport(viewport.ID);

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
      ImGui.DockSpace(dockspaceId, { x: 0, y: 0 }, ImGui.DockNodeFlags.PassthruCentralNode);

      // Render individual panels
      this.renderHierarchyPanel(app);
      this.renderInspectorPanel(app);

      if (this.config.showSceneView !== false) {
        this.renderSceneViewPanel(app);
      }
      if (this.config.showGameView !== false) {
        this.renderGameViewPanel(app);
      }
      if (this.config.showDebugPanel !== false) {
        renderDebugPanel(app);
      }
    } else {
      ImGui.PopStyleVar(3);
    }

    ImGui.End();
  }

  // ============================================================================
  // Panels
  // ============================================================================

  private renderHierarchyPanel(app: Application): void {
    renderImGuiHierarchy(app);
  }

  private renderInspectorPanel(app: Application): void {
    renderImGuiInspector(app);
  }

  private renderSceneViewPanel(app: Application): void {
    // Remove padding for image display
    ImGui.PushStyleVarImVec2(ImGui.StyleVar.WindowPadding, { x: 0, y: 0 });

    if (ImGui.Begin('Scene View')) {
      // Track if Scene View is hovered (to allow camera input even when ImGui wants mouse)
      this.isSceneViewHovered = ImGui.IsWindowHovered();

      // Get window size using individual dimension functions (GetWindowSize returns ImVec2 which has binding issues)
      const windowWidth = ImGui.GetWindowWidth();
      const windowHeight = ImGui.GetWindowHeight();
      const titleBarHeight = ImGui.GetFrameHeight();

      // Calculate content area (window size minus title bar)
      const contentWidth = Math.max(1, Math.floor(windowWidth));
      const contentHeight = Math.max(1, Math.floor(windowHeight - titleBarHeight));

      // Check if we need to resize the viewport
      if (
        this.sceneViewport &&
        (contentWidth !== this.lastSceneViewSize.x || contentHeight !== this.lastSceneViewSize.y)
      ) {
        this.lastSceneViewSize = { x: contentWidth, y: contentHeight };
        this.resizeViewport(this.sceneViewport, contentWidth, contentHeight);
      }

      // Render scene to viewport texture (using editor camera)
      if (this.sceneViewport && contentWidth > 0 && contentHeight > 0) {
        this.renderViewportToTarget(app, this.sceneViewport, true);

        // Get or create texture ID
        const textureId = this.getOrCreateTextureId(this.sceneViewport);

        // Display the rendered texture (only if texture is ready)
        if (textureId !== null) {
          // UV coordinates flipped vertically because WebGL textures are upside down
          ImGui.Image(
            new ImTextureRef(textureId),
            { x: contentWidth, y: contentHeight },
            { x: 0, y: 1 }, // UV min (flipped)
            { x: 1, y: 0 }  // UV max (flipped)
          );
        }
      }

    } else {
      // Window is collapsed - not hovered
      this.isSceneViewHovered = false;
    }

    ImGui.End();
    ImGui.PopStyleVar();
  }

  private renderGameViewPanel(app: Application): void {
    const editorManager = app.getResource(EditorManager);

    // Remove padding for image display
    ImGui.PushStyleVarImVec2(ImGui.StyleVar.WindowPadding, { x: 0, y: 0 });

    if (ImGui.Begin('Game View')) {
      // Get window size using individual dimension functions (GetWindowSize returns ImVec2 which has binding issues)
      const windowWidth = ImGui.GetWindowWidth();
      const windowHeight = ImGui.GetWindowHeight();
      const titleBarHeight = ImGui.GetFrameHeight();

      // Calculate content area (window size minus title bar)
      const contentWidth = Math.max(1, Math.floor(windowWidth));
      const contentHeight = Math.max(1, Math.floor(windowHeight - titleBarHeight));

      // Check if we need to resize the viewport
      if (
        this.gameViewport &&
        (contentWidth !== this.lastGameViewSize.x || contentHeight !== this.lastGameViewSize.y)
      ) {
        this.lastGameViewSize = { x: contentWidth, y: contentHeight };
        this.resizeViewport(this.gameViewport, contentWidth, contentHeight);
      }

      // Render scene to viewport texture (using game camera)
      if (this.gameViewport && contentWidth > 0 && contentHeight > 0) {
        this.renderViewportToTarget(app, this.gameViewport, false);

        // Get or create texture ID
        const textureId = this.getOrCreateTextureId(this.gameViewport);

        // Display the rendered texture (only if texture is ready)
        if (textureId !== null) {
          // UV coordinates flipped vertically because WebGL textures are upside down
          ImGui.Image(
            new ImTextureRef(textureId),
            { x: contentWidth, y: contentHeight },
            { x: 0, y: 1 }, // UV min (flipped)
            { x: 1, y: 0 }  // UV max (flipped)
          );
        }
      }

    }

    ImGui.End();
    ImGui.PopStyleVar();
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  /**
   * Handle Save (uses current path if available, otherwise falls back to Save As)
   */
  private handleSaveWorld(): void {
    if (this.saveInProgress) return;

    // Prevent saving while the game is playing
    const editorManager = this.getApplication().getResource(EditorManager);
    if (editorManager?.mode === 'play') {
      console.warn('[EditorLayer] Cannot save while game is playing');
      return;
    }

    if (this.currentScenePath) {
      // We have a current path - save directly
      this.saveInProgress = true;
      this.performSaveWorld(this.currentScenePath)
        .catch((err) => {
          console.error('[EditorLayer] Save failed:', err);
        })
        .finally(() => {
          this.saveInProgress = false;
        });
    } else {
      // No current path - fall back to Save As
      this.handleSaveWorldAs();
    }
  }

  /**
   * Handle Save As (always shows dialog)
   */
  private handleSaveWorldAs(): void {
    if (this.saveInProgress) return;

    // Prevent saving while the game is playing
    const editorManager = this.getApplication().getResource(EditorManager);
    if (editorManager?.mode === 'play') {
      console.warn('[EditorLayer] Cannot save while game is playing');
      return;
    }

    this.saveInProgress = true;

    this.performSaveWorldAs()
      .catch((err) => {
        console.error('[EditorLayer] Save As failed:', err);
      })
      .finally(() => {
        this.saveInProgress = false;
      });
  }

  private handleLoadWorld(): void {
    if (this.loadInProgress) return;
    this.loadInProgress = true;

    this.performLoadWorld()
      .catch((err) => {
        console.error('[EditorLayer] Load failed:', err);
      })
      .finally(() => {
        this.loadInProgress = false;
      });
  }

  /**
   * Save world to a specific path (used by Save when path is known)
   */
  private async performSaveWorld(filePath: string): Promise<void> {
    const platform = this.config.platform;
    if (!platform) {
      console.warn('[EditorLayer] No platform configured for file operations');
      return;
    }

    const app = this.getApplication();
    const json = this.worldSerializer.serializeToString(
      app.world,
      app.getCommands(),
      true
    );

    await platform.writeTextFile(filePath, json);

    // Update current path and cache
    this.currentScenePath = filePath;
    this.cacheScenePath(filePath);

    console.log(`[EditorLayer] World saved to: ${filePath}`);
  }

  /**
   * Save world with dialog (used by Save As)
   */
  private async performSaveWorldAs(): Promise<void> {
    const platform = this.config.platform;
    if (!platform) {
      console.warn('[EditorLayer] No platform configured for file operations');
      return;
    }

    const filePath = await platform.showSaveDialog({
      title: 'Save World As',
      filters: [{ name: 'World Files', extensions: ['json'] }],
    });

    if (!filePath) {
      console.log('[EditorLayer] Save As cancelled');
      return;
    }

    // Use performSaveWorld to save and update path
    await this.performSaveWorld(filePath);
  }

  private async performLoadWorld(): Promise<void> {
    const platform = this.config.platform;
    if (!platform) {
      console.warn('[EditorLayer] No platform configured for file operations');
      return;
    }

    const result = await platform.showOpenDialog({
      title: 'Load World',
      filters: [{ name: 'World Files', extensions: ['json'] }],
    });

    if (!result) {
      console.log('[EditorLayer] Load cancelled');
      return;
    }

    const filePath = Array.isArray(result) ? result[0] : result;
    if (!filePath) {
      console.log('[EditorLayer] Load cancelled');
      return;
    }

    // Use loadSceneFromPath which handles caching and error handling
    const success = await this.loadSceneFromPath(filePath);
    if (!success) {
      throw new Error('Failed to load world');
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get the editor configuration
   */
  getConfig(): EditorConfig {
    return this.config;
  }

  /**
   * Update editor configuration
   */
  updateConfig(config: Partial<EditorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
