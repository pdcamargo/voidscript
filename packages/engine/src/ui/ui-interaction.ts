/**
 * UIInteractionManager
 *
 * Handles mouse/touch interaction with UI elements.
 * Uses raycasting against the UI scene to detect hover and click events.
 */

import * as THREE from 'three';
import type { Entity } from '../ecs/entity.js';
import type { UIManager } from './ui-manager.js';
import type { UIButtonData, UIButtonState } from './components/ui-button.js';
import type { UIViewportBounds } from './ui-viewport-bounds.js';

/**
 * UI interaction event types
 */
export type UIInteractionEventType = 'hover-enter' | 'hover-exit' | 'click' | 'press' | 'release';

/**
 * UI interaction event
 */
export interface UIInteractionEvent {
  type: UIInteractionEventType;
  entity: Entity;
  screenX: number;
  screenY: number;
}

/**
 * Callback for UI interaction events
 */
export type UIInteractionCallback = (event: UIInteractionEvent) => void;

/**
 * UIInteractionManager
 *
 * Manages mouse/touch interactions with UI elements.
 */
export class UIInteractionManager {
  private readonly uiManager: UIManager;
  private readonly raycaster: THREE.Raycaster;

  // Canvas element for coordinate transformation
  private canvas: HTMLCanvasElement | null = null;

  // Current mouse position in viewport-relative coordinates
  private mouseX = 0;
  private mouseY = 0;

  // Track mouse button state
  private isMouseDown = false;

  // Currently hovered entity
  private hoveredEntity: Entity | null = null;

  // Currently pressed entity
  private pressedEntity: Entity | null = null;

  // Entity -> Block mapping (set by sync systems)
  private entityToBlock = new Map<Entity, THREE.Object3D>();

  // Block -> Entity reverse mapping
  private blockToEntity = new Map<THREE.Object3D, Entity>();

  // Event callbacks
  private callbacks: UIInteractionCallback[] = [];

  // Click events consumed this frame
  private clickedEntities: Entity[] = [];

  // Viewport bounds for coordinate transformation (set by EditorLayer in editor mode)
  private viewportBounds: UIViewportBounds | null = null;

  constructor(uiManager: UIManager) {
    this.uiManager = uiManager;
    this.raycaster = new THREE.Raycaster();

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Set the canvas element for coordinate transformation.
   * Must be called before mouse events will work correctly.
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  /**
   * Set the viewport bounds for coordinate transformation.
   * Called by EditorLayer when in editor mode, or by Application for fullscreen mode.
   */
  setViewportBounds(bounds: UIViewportBounds): void {
    this.viewportBounds = bounds;
  }

  /**
   * Transform browser viewport coordinates to canvas-relative coordinates.
   * This is necessary because DOM events use browser viewport coordinates,
   * but ImGui and UIViewportBounds use canvas-relative coordinates.
   */
  private toCanvasCoordinates(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } {
    if (!this.canvas) {
      // No canvas set - assume coordinates are already correct
      return { x: clientX, y: clientY };
    }
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  /**
   * Transform browser viewport coordinates to game viewport-relative coordinates.
   * First transforms to canvas-relative, then applies viewport bounds offset.
   * Returns the transformed coordinates and whether the point is inside the viewport.
   */
  private getViewportCoordinates(
    clientX: number,
    clientY: number,
  ): { x: number; y: number; isInside: boolean } {
    // First transform from browser viewport to canvas-relative coordinates
    const canvasCoords = this.toCanvasCoordinates(clientX, clientY);

    if (!this.viewportBounds) {
      // No viewport bounds set - assume fullscreen, canvas coords are the viewport coords
      return { x: canvasCoords.x, y: canvasCoords.y, isInside: true };
    }

    // Check if the point is inside the viewport bounds (in canvas coordinates)
    const isInside = this.viewportBounds.isInsideBounds(canvasCoords.x, canvasCoords.y);

    // Transform from canvas coordinates to viewport-relative coordinates
    const viewportCoords = this.viewportBounds.toViewportCoordinates(canvasCoords.x, canvasCoords.y);

    return { x: viewportCoords.x, y: viewportCoords.y, isInside };
  }

  /**
   * Setup DOM event listeners for mouse/touch
   */
  private setupEventListeners(): void {
    // These should be attached to the canvas
    // For now, we'll use document-level listeners
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mousedown', this.onMouseDown.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
    document.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
  }

  /**
   * Register an entity's UI block for interaction
   */
  registerBlock(entity: Entity, block: THREE.Object3D): void {
    this.entityToBlock.set(entity, block);
    this.blockToEntity.set(block, entity);
  }

  /**
   * Unregister an entity's UI block
   */
  unregisterBlock(entity: Entity): void {
    const block = this.entityToBlock.get(entity);
    if (block) {
      this.blockToEntity.delete(block);
    }
    this.entityToBlock.delete(entity);
  }

  /**
   * Add an interaction callback
   */
  addCallback(callback: UIInteractionCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Remove an interaction callback
   */
  removeCallback(callback: UIInteractionCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index >= 0) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Get the currently hovered entity
   */
  getHoveredEntity(): Entity | null {
    return this.hoveredEntity;
  }

  /**
   * Get entities that were clicked this frame (consumed on read)
   */
  getClickedEntities(): Entity[] {
    const entities = [...this.clickedEntities];
    this.clickedEntities = [];
    return entities;
  }

  /**
   * Check if an entity was clicked this frame
   */
  wasClicked(entity: Entity): boolean {
    return this.clickedEntities.includes(entity);
  }

  /**
   * Update interaction state
   * Should be called each frame before UI sync systems
   */
  update(): void {
    // Perform raycast
    const hitEntity = this.raycastUI();

    // Handle hover state changes
    if (hitEntity !== this.hoveredEntity) {
      // Exit previous hover
      if (this.hoveredEntity !== null) {
        this.emitEvent({
          type: 'hover-exit',
          entity: this.hoveredEntity,
          screenX: this.mouseX,
          screenY: this.mouseY,
        });
      }

      // Enter new hover
      if (hitEntity !== null) {
        this.emitEvent({
          type: 'hover-enter',
          entity: hitEntity,
          screenX: this.mouseX,
          screenY: this.mouseY,
        });
      }

      this.hoveredEntity = hitEntity;
    }
  }

  /**
   * Update button component state based on interactions
   */
  updateButtonState(entity: Entity, button: UIButtonData): void {
    if (button.isDisabled) {
      button._state = 'disabled';
      return;
    }

    const isHovered = this.hoveredEntity === entity;
    const isPressed = this.pressedEntity === entity;

    let newState: UIButtonState = 'idle';

    if (isPressed && isHovered) {
      newState = 'active';
    } else if (isHovered) {
      newState = 'hovered';
    }

    button._state = newState;
  }

  /**
   * Raycast against UI scene and return hit entity
   */
  private raycastUI(): Entity | null {
    const { width, height } = this.uiManager.getScreenSize();

    // Convert screen coordinates to normalized device coordinates
    const ndcX = (this.mouseX / width) * 2 - 1;
    const ndcY = -(this.mouseY / height) * 2 + 1;

    // Setup raycaster
    this.raycaster.setFromCamera(
      new THREE.Vector2(ndcX, ndcY),
      this.uiManager.getUICamera()
    );

    // Raycast against UI scene
    const intersects = this.raycaster.intersectObjects(
      this.uiManager.getUIScene().children,
      true
    );

    // Find first interactive object
    for (const intersect of intersects) {
      // Walk up parent chain to find registered entity
      let object: THREE.Object3D | null = intersect.object;
      while (object) {
        const entity = this.blockToEntity.get(object);
        if (entity !== undefined) {
          return entity;
        }
        object = object.parent;
      }
    }

    return null;
  }

  /**
   * Emit an interaction event to all callbacks
   */
  private emitEvent(event: UIInteractionEvent): void {
    for (const callback of this.callbacks) {
      callback(event);
    }
  }

  /**
   * Mouse move handler
   */
  private onMouseMove(event: MouseEvent): void {
    const { x, y, isInside } = this.getViewportCoordinates(
      event.clientX,
      event.clientY,
    );
    if (isInside) {
      this.mouseX = x;
      this.mouseY = y;
    }
  }

  /**
   * Mouse down handler
   */
  private onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return; // Only left click

    this.isMouseDown = true;
    this.pressedEntity = this.hoveredEntity;

    if (this.pressedEntity !== null) {
      this.emitEvent({
        type: 'press',
        entity: this.pressedEntity,
        screenX: this.mouseX,
        screenY: this.mouseY,
      });
    }
  }

  /**
   * Mouse up handler
   */
  private onMouseUp(event: MouseEvent): void {
    if (event.button !== 0) return; // Only left click

    this.isMouseDown = false;

    // Emit release on pressed entity
    if (this.pressedEntity !== null) {
      this.emitEvent({
        type: 'release',
        entity: this.pressedEntity,
        screenX: this.mouseX,
        screenY: this.mouseY,
      });

      // Click if released on same entity we pressed
      if (this.pressedEntity === this.hoveredEntity) {
        this.emitEvent({
          type: 'click',
          entity: this.pressedEntity,
          screenX: this.mouseX,
          screenY: this.mouseY,
        });
        this.clickedEntities.push(this.pressedEntity);
      }
    }

    this.pressedEntity = null;
  }

  /**
   * Touch start handler
   */
  private onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 0) return;

    const touch = event.touches[0];
    if (!touch) return;

    const { x, y, isInside } = this.getViewportCoordinates(
      touch.clientX,
      touch.clientY,
    );
    if (!isInside) return;

    this.mouseX = x;
    this.mouseY = y;

    // Update hover first
    this.update();

    // Then handle press
    this.isMouseDown = true;
    this.pressedEntity = this.hoveredEntity;

    if (this.pressedEntity !== null) {
      this.emitEvent({
        type: 'press',
        entity: this.pressedEntity,
        screenX: this.mouseX,
        screenY: this.mouseY,
      });
    }
  }

  /**
   * Touch move handler
   */
  private onTouchMove(event: TouchEvent): void {
    if (event.touches.length === 0) return;

    const touch = event.touches[0];
    if (!touch) return;

    const { x, y, isInside } = this.getViewportCoordinates(
      touch.clientX,
      touch.clientY,
    );
    if (isInside) {
      this.mouseX = x;
      this.mouseY = y;
    }
  }

  /**
   * Touch end handler
   */
  private onTouchEnd(event: TouchEvent): void {
    this.isMouseDown = false;

    // Emit release
    if (this.pressedEntity !== null) {
      this.emitEvent({
        type: 'release',
        entity: this.pressedEntity,
        screenX: this.mouseX,
        screenY: this.mouseY,
      });

      // Click if still hovering same element
      if (this.pressedEntity === this.hoveredEntity) {
        this.emitEvent({
          type: 'click',
          entity: this.pressedEntity,
          screenX: this.mouseX,
          screenY: this.mouseY,
        });
        this.clickedEntities.push(this.pressedEntity);
      }
    }

    this.pressedEntity = null;
    this.hoveredEntity = null;
  }

  /**
   * Cleanup event listeners
   */
  dispose(): void {
    document.removeEventListener('mousemove', this.onMouseMove.bind(this));
    document.removeEventListener('mousedown', this.onMouseDown.bind(this));
    document.removeEventListener('mouseup', this.onMouseUp.bind(this));
    document.removeEventListener('touchstart', this.onTouchStart.bind(this));
    document.removeEventListener('touchmove', this.onTouchMove.bind(this));
    document.removeEventListener('touchend', this.onTouchEnd.bind(this));

    this.entityToBlock.clear();
    this.blockToEntity.clear();
    this.callbacks = [];
  }
}
