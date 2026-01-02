/**
 * HelperManager - Manages debug helpers for editor visualization
 *
 * Centralized management of debug helpers (CameraHelper, Collider2DHelper, etc.)
 * that are visible only in the editor's scene view via layer-based rendering.
 *
 * All helpers are assigned to HELPER_LAYER (31) so they only render when the
 * editor camera enables that layer.
 */

import * as THREE from 'three';
import type { Entity } from '@voidscript/core';
import { HELPER_LAYER } from '../constants/layers.js';
import { Collider2DHelper } from '../rendering/helpers/Collider2DHelper.js';
import { Collider3DHelper } from '../rendering/helpers/Collider3DHelper.js';
import { Box3Helper } from '../rendering/helpers/Box3Helper.js';
import type { ColliderShape2D, ColliderShape3D } from '../physics/types.js';
import type { Transform3DData } from '../ecs/components/rendering/transform-3d.js';

const HELPER_RENDER_ORDER = 999999999;

interface CameraHelperEntry {
  type: 'camera';
  helper: THREE.CameraHelper;
  camera: THREE.Camera;
}

interface Collider2DHelperEntry {
  type: 'collider2d';
  helper: Collider2DHelper;
  shapeType: string;
}

interface Collider3DHelperEntry {
  type: 'collider3d';
  helper: Collider3DHelper;
  shapeType: string;
}

interface Box3HelperEntry {
  type: 'box3';
  helper: Box3Helper;
}

type HelperEntry = CameraHelperEntry | Collider2DHelperEntry | Collider3DHelperEntry | Box3HelperEntry;

export interface HelperManagerConfig {
  scene: THREE.Scene;
  showHelpers?: boolean;
}

/**
 * HelperManager Resource
 *
 * Manages debug helper objects in the scene. Helpers are visual aids for
 * cameras, colliders, and other objects that are only visible in the editor.
 */
export class HelperManager {
  private helpers: Map<Entity, HelperEntry> = new Map();
  private scene: THREE.Scene;
  private _showHelpers: boolean;

  constructor(config: HelperManagerConfig) {
    this.scene = config.scene;
    this._showHelpers = config.showHelpers ?? true;
  }

  /**
   * Whether helpers are globally enabled.
   */
  get showHelpers(): boolean {
    return this._showHelpers;
  }

  /**
   * Enable or disable all helpers globally.
   * When disabled, all helpers are removed from the scene.
   * When enabled, helpers will be recreated on the next system update.
   */
  setShowHelpers(value: boolean): void {
    if (this._showHelpers === value) return;
    this._showHelpers = value;

    if (!value) {
      this.removeAllHelpers();
    }
  }

  /**
   * Apply common helper properties (layer, render order, depth settings)
   */
  private applyHelperProperties(helper: THREE.Object3D): void {
    helper.layers.set(HELPER_LAYER);
    helper.renderOrder = HELPER_RENDER_ORDER;

    // Apply material properties
    if ('material' in helper) {
      const obj = helper as THREE.Object3D & {
        material: THREE.Material | THREE.Material[];
      };
      const materials = Array.isArray(obj.material)
        ? obj.material
        : [obj.material];
      for (const mat of materials) {
        if (mat) {
          mat.depthTest = false;
          mat.depthWrite = false;
          mat.transparent = true;
          mat.needsUpdate = true;
        }
      }
    }

    // Also apply to all children (for complex helpers like CameraHelper)
    helper.traverse((child) => {
      child.renderOrder = HELPER_RENDER_ORDER;
      if ('material' in child) {
        const obj = child as THREE.Object3D & {
          material: THREE.Material | THREE.Material[];
        };
        const materials = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        for (const mat of materials) {
          if (mat) {
            mat.depthTest = false;
            mat.depthWrite = false;
            mat.transparent = true;
            mat.needsUpdate = true;
          }
        }
      }
    });
  }

  /**
   * Create a camera helper for the given entity.
   */
  createCameraHelper(
    entity: Entity,
    camera: THREE.Camera,
  ): THREE.CameraHelper | null {
    if (!this._showHelpers) return null;

    this.removeHelper(entity);

    const helper = new THREE.CameraHelper(camera);
    this.applyHelperProperties(helper);

    this.scene.add(helper);
    this.helpers.set(entity, { type: 'camera', helper, camera });

    return helper;
  }

  /**
   * Create a 2D collider helper for the given entity.
   */
  createCollider2DHelper(
    entity: Entity,
    shape: ColliderShape2D,
    resolution: { width: number; height: number },
  ): Collider2DHelper | null {
    if (!this._showHelpers) return null;

    this.removeHelper(entity);

    const helper = new Collider2DHelper(shape, resolution);
    this.applyHelperProperties(helper);
    this.scene.add(helper);
    this.helpers.set(entity, {
      type: 'collider2d',
      helper,
      shapeType: shape.type,
    });

    return helper;
  }

  /**
   * Create a 3D collider helper for the given entity.
   */
  createCollider3DHelper(
    entity: Entity,
    shape: ColliderShape3D,
    resolution: { width: number; height: number },
  ): Collider3DHelper | null {
    if (!this._showHelpers) return null;

    this.removeHelper(entity);

    const helper = new Collider3DHelper(shape, resolution);
    this.applyHelperProperties(helper);
    this.scene.add(helper);
    this.helpers.set(entity, {
      type: 'collider3d',
      helper,
      shapeType: shape.type,
    });

    return helper;
  }

  /**
   * Create a Box3 helper for the given entity.
   */
  createBox3Helper(
    entity: Entity,
    box: THREE.Box3,
    resolution: { width: number; height: number },
  ): Box3Helper | null {
    if (!this._showHelpers) return null;

    this.removeHelper(entity);

    const helper = new Box3Helper(box, resolution);
    this.applyHelperProperties(helper);
    this.scene.add(helper);
    this.helpers.set(entity, {
      type: 'box3',
      helper,
    });

    return helper;
  }

  /**
   * Update a camera helper's transform.
   */
  updateCameraHelper(
    entity: Entity,
    transform?: { position: THREE.Vector3; rotation: THREE.Euler },
  ): void {
    const entry = this.helpers.get(entity);
    if (entry && entry.type === 'camera') {
      if (transform) {
        entry.camera.position.copy(transform.position);
        entry.camera.rotation.copy(transform.rotation);
        entry.camera.updateMatrixWorld();
      }
      entry.helper.update();
    }
  }

  /**
   * Update resolution for all collider helpers (call on viewport resize).
   */
  updateResolution(width: number, height: number): void {
    for (const entry of this.helpers.values()) {
      if (entry.type === 'collider2d' || entry.type === 'collider3d' || entry.type === 'box3') {
        entry.helper.setResolution(width, height);
      }
    }
  }

  /**
   * Show or hide the cone/up/target lines on camera helpers.
   * In 2D editor mode, these lines look confusing from a top-down view.
   *
   * @param show - Whether to show the cone lines (true) or hide them (false)
   */
  setCameraHelperConeVisible(show: boolean): void {
    const coneColor = show ? new THREE.Color(0xff0000) : new THREE.Color(0, 0, 0);
    const upColor = show ? new THREE.Color(0x00aaff) : new THREE.Color(0, 0, 0);
    const targetColor = show ? new THREE.Color(0xffffff) : new THREE.Color(0, 0, 0);

    for (const entry of this.helpers.values()) {
      if (entry.type === 'camera') {
        const geometry = entry.helper.geometry;
        const colorAttribute = geometry.getAttribute('color');

        // Cone lines: indices 24-31 (p->n1, p->n2, p->n3, p->n4)
        for (let i = 24; i <= 31; i++) {
          colorAttribute.setXYZ(i, coneColor.r, coneColor.g, coneColor.b);
        }

        // Up lines: indices 32-37 (u1->u2, u2->u3, u3->u1)
        for (let i = 32; i <= 37; i++) {
          colorAttribute.setXYZ(i, upColor.r, upColor.g, upColor.b);
        }

        // Target lines: indices 38-41 (c->t, p->c)
        for (let i = 38; i <= 41; i++) {
          colorAttribute.setXYZ(i, targetColor.r, targetColor.g, targetColor.b);
        }

        colorAttribute.needsUpdate = true;
      }
    }
  }

  /**
   * Remove helper for the given entity.
   */
  removeHelper(entity: Entity): void {
    const entry = this.helpers.get(entity);
    if (!entry) return;

    this.scene.remove(entry.helper);

    if (entry.type === 'camera') {
      entry.helper.dispose();
    } else if (entry.type === 'collider2d' || entry.type === 'collider3d') {
      entry.helper.dispose();
    }

    this.helpers.delete(entity);
  }

  /**
   * Remove all helpers from the scene.
   */
  removeAllHelpers(): void {
    for (const entity of [...this.helpers.keys()]) {
      this.removeHelper(entity);
    }
  }

  /**
   * Check if entity has a helper.
   */
  hasHelper(entity: Entity): boolean {
    return this.helpers.has(entity);
  }

  /**
   * Get helper entry for entity.
   */
  getHelperEntry(entity: Entity): HelperEntry | undefined {
    return this.helpers.get(entity);
  }

  /**
   * Get helper object for entity.
   */
  getHelper(entity: Entity): THREE.Object3D | undefined {
    return this.helpers.get(entity)?.helper;
  }

  /**
   * Get all entities that have helpers.
   */
  getAllHelperEntities(): IterableIterator<Entity> {
    return this.helpers.keys();
  }

  /**
   * Get the scene that helpers are added to.
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Clean up all helpers.
   */
  dispose(): void {
    this.removeAllHelpers();
  }
}
