/**
 * Renderer Sync System for 3D
 *
 * Automatically synchronizes 3D ECS components to Three.js objects.
 * This system handles:
 * - Creating Three.js meshes for Mesh3D, GLTFModel, FBXModel entities
 * - Updating transforms from Transform3D/LocalTransform3D
 * - Creating/updating materials from Material3D
 * - Creating lights from Light3D
 * - Managing active camera from Camera3D
 * - Propagating transform hierarchy (Parent/Children with LocalTransform3D)
 *
 * Usage:
 * ```typescript
 * const renderManager = new Render3DManager(app.getRenderer());
 * app.insertResource(renderManager);
 *
 * // Register systems in order
 * app.scheduler.addSystem('render', createTransformPropagationSystem());
 * app.scheduler.addSystem('render', createRender3DSyncSystem(renderManager));
 * ```
 */

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

import { system } from '../system.js';
import type { Entity } from '../entity.js';
import type { Renderer } from '../../app/renderer.js';

import { Transform3D, type Transform3DData } from '../components/rendering/transform-3d.js';
import { LocalTransform3D, computeWorldTransform } from '../components/rendering/local-transform-3d.js';
import {
  Light3D,
  type Light3DData,
  isDirectionalLight,
  isPointLight,
  isSpotLight,
  isAmbientLight,
} from '../components/rendering/light-3d.js';
import { Mesh3D, type Mesh3DData, type GeometryData } from '../components/rendering/mesh-3d.js';
import { GLTFModel, type GLTFModelData } from '../components/rendering/gltf-model.js';
import { FBXModel, type FBXModelData } from '../components/rendering/fbx-model.js';
import { Material3D, type Material3DData } from '../components/rendering/material-3d.js';
import { RenderObject, type RenderObjectData } from '../components/rendering/render-object.js';
import { Parent } from '../components/parent.js';
import { Children } from '../components/children.js';
import { Vector3 } from '../../math/index.js';
import { loadTexture } from '../../loaders/texture-loader.js';

// ============================================================================
// Types
// ============================================================================

type RenderableType = 'mesh' | 'gltf' | 'fbx' | 'light';

interface RenderEntry {
  type: RenderableType;
  object: THREE.Object3D;
  entity: Entity;
  // For model loading
  assetUrl: string | null;
  isLoading: boolean;
  // For geometry tracking (mesh only)
  geometryHash?: string;
}

interface LightEntry {
  light: THREE.Light;
  entity: Entity;
  type: string;
  helper?: THREE.Object3D;
}

// ============================================================================
// Geometry Creation
// ============================================================================

function createGeometry(data: GeometryData): THREE.BufferGeometry {
  switch (data.type) {
    case 'box':
      return new THREE.BoxGeometry(
        data.width,
        data.height,
        data.depth,
        data.widthSegments,
        data.heightSegments,
        data.depthSegments,
      );

    case 'sphere':
      return new THREE.SphereGeometry(
        data.radius,
        data.widthSegments,
        data.heightSegments,
        data.phiStart,
        data.phiLength,
        data.thetaStart,
        data.thetaLength,
      );

    case 'plane':
      return new THREE.PlaneGeometry(data.width, data.height, data.widthSegments, data.heightSegments);

    case 'cylinder':
      return new THREE.CylinderGeometry(
        data.radiusTop,
        data.radiusBottom,
        data.height,
        data.radialSegments,
        data.heightSegments,
        data.openEnded,
        data.thetaStart,
        data.thetaLength,
      );

    case 'capsule':
      return new THREE.CapsuleGeometry(data.radius, data.length, data.capSegments, data.radialSegments);

    case 'cone':
      return new THREE.ConeGeometry(
        data.radius,
        data.height,
        data.radialSegments,
        data.heightSegments,
        data.openEnded,
        data.thetaStart,
        data.thetaLength,
      );

    case 'torus':
      return new THREE.TorusGeometry(data.radius, data.tube, data.radialSegments, data.tubularSegments, data.arc);

    case 'torusKnot':
      return new THREE.TorusKnotGeometry(
        data.radius,
        data.tube,
        data.tubularSegments,
        data.radialSegments,
        data.p,
        data.q,
      );

    case 'circle':
      return new THREE.CircleGeometry(data.radius, data.segments, data.thetaStart, data.thetaLength);

    case 'ring':
      return new THREE.RingGeometry(
        data.innerRadius,
        data.outerRadius,
        data.thetaSegments,
        data.phiSegments,
        data.thetaStart,
        data.thetaLength,
      );

    case 'dodecahedron':
      return new THREE.DodecahedronGeometry(data.radius, data.detail);

    case 'icosahedron':
      return new THREE.IcosahedronGeometry(data.radius, data.detail);

    case 'octahedron':
      return new THREE.OctahedronGeometry(data.radius, data.detail);

    case 'tetrahedron':
      return new THREE.TetrahedronGeometry(data.radius, data.detail);

    case 'lathe':
      const points = data.points.map((p) => new THREE.Vector2(p.x, p.y));
      return new THREE.LatheGeometry(points, data.segments, data.phiStart, data.phiLength);

    default:
      // Fallback to box
      return new THREE.BoxGeometry(1, 1, 1);
  }
}

function hashGeometry(data: GeometryData): string {
  return JSON.stringify(data);
}

// ============================================================================
// Material Creation
// ============================================================================

function createDefaultMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x00ff00, // Green placeholder
    metalness: 0,
    roughness: 1,
  });
}

async function createMaterialFromData(
  data: Material3DData | null,
  existingMaterial?: THREE.MeshStandardMaterial,
): Promise<THREE.MeshStandardMaterial> {
  const material = existingMaterial ?? new THREE.MeshStandardMaterial();

  if (!data) {
    material.color.setRGB(0, 1, 0); // Green placeholder
    material.metalness = 0;
    material.roughness = 1;
    return material;
  }

  material.color.setRGB(data.color.r, data.color.g, data.color.b);
  material.opacity = data.opacity;
  material.transparent = data.opacity < 1;
  material.metalness = data.metalness;
  material.roughness = data.roughness;

  // Load texture if present
  if (data.texture) {
    const url = data.texture.getLoadableUrl();
    if (url) {
      try {
        const texture = await loadTexture(url);
        material.map = texture;
        material.needsUpdate = true;
      } catch (err) {
        console.warn('Failed to load texture:', err);
      }
    }
  } else {
    material.map = null;
  }

  return material;
}

// ============================================================================
// Light Creation
// ============================================================================

function createLightFromData(data: Light3DData): THREE.Light {
  if (isDirectionalLight(data)) {
    const light = new THREE.DirectionalLight(
      new THREE.Color(data.color.r, data.color.g, data.color.b),
      data.intensity,
    );
    light.castShadow = data.shadow.enabled;
    if (data.shadow.enabled) {
      light.shadow.mapSize.set(data.shadow.mapSize, data.shadow.mapSize);
      light.shadow.camera.near = data.shadow.cameraNear;
      light.shadow.camera.far = data.shadow.cameraFar;
      light.shadow.bias = data.shadow.bias;
      light.shadow.normalBias = data.shadow.normalBias;
      // Orthographic camera bounds
      const size = data.shadowCameraSize;
      (light.shadow.camera as THREE.OrthographicCamera).left = -size;
      (light.shadow.camera as THREE.OrthographicCamera).right = size;
      (light.shadow.camera as THREE.OrthographicCamera).top = size;
      (light.shadow.camera as THREE.OrthographicCamera).bottom = -size;
    }
    return light;
  }

  if (isPointLight(data)) {
    const light = new THREE.PointLight(
      new THREE.Color(data.color.r, data.color.g, data.color.b),
      data.intensity,
      data.distance,
      data.decay,
    );
    light.castShadow = data.shadow.enabled;
    if (data.shadow.enabled) {
      light.shadow.mapSize.set(data.shadow.mapSize, data.shadow.mapSize);
      light.shadow.camera.near = data.shadow.cameraNear;
      light.shadow.camera.far = data.shadow.cameraFar;
      light.shadow.bias = data.shadow.bias;
      light.shadow.normalBias = data.shadow.normalBias;
    }
    return light;
  }

  if (isSpotLight(data)) {
    const light = new THREE.SpotLight(
      new THREE.Color(data.color.r, data.color.g, data.color.b),
      data.intensity,
      data.distance,
      data.angle,
      data.penumbra,
      data.decay,
    );
    light.castShadow = data.shadow.enabled;
    if (data.shadow.enabled) {
      light.shadow.mapSize.set(data.shadow.mapSize, data.shadow.mapSize);
      light.shadow.camera.near = data.shadow.cameraNear;
      light.shadow.camera.far = data.shadow.cameraFar;
      light.shadow.bias = data.shadow.bias;
      light.shadow.normalBias = data.shadow.normalBias;
    }
    return light;
  }

  if (isAmbientLight(data)) {
    return new THREE.AmbientLight(new THREE.Color(data.color.r, data.color.g, data.color.b), data.intensity);
  }

  // Fallback
  return new THREE.AmbientLight(0xffffff, 0.5);
}

function updateLightFromData(light: THREE.Light, data: Light3DData): void {
  light.color.setRGB(data.color.r, data.color.g, data.color.b);
  light.intensity = data.intensity;

  if (light instanceof THREE.DirectionalLight && isDirectionalLight(data)) {
    light.castShadow = data.shadow.enabled;
  } else if (light instanceof THREE.PointLight && isPointLight(data)) {
    light.distance = data.distance;
    light.decay = data.decay;
    light.castShadow = data.shadow.enabled;
  } else if (light instanceof THREE.SpotLight && isSpotLight(data)) {
    light.distance = data.distance;
    light.decay = data.decay;
    light.angle = data.angle;
    light.penumbra = data.penumbra;
    light.castShadow = data.shadow.enabled;
  }
}

// ============================================================================
// Render3DManager
// ============================================================================

/**
 * Render3DManager
 *
 * Manages the lifecycle of Three.js objects for 3D ECS entities.
 * Register as a resource with your Application.
 */
export class Render3DManager {
  private renderer: Renderer;
  private entries: Map<Entity, RenderEntry> = new Map();
  private lights: Map<Entity, LightEntry> = new Map();
  private nextHandle: number = 1;
  private handleToEntity: Map<number, Entity> = new Map();

  // Loaders
  private gltfLoader: GLTFLoader;
  private fbxLoader: FBXLoader;


  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.gltfLoader = new GLTFLoader();
    this.fbxLoader = new FBXLoader();
  }

  // --------------------------------------------------------------------------
  // Mesh Creation
  // --------------------------------------------------------------------------

  createMesh(entity: Entity, meshData: Mesh3DData, materialData: Material3DData | null): number {
    const geometry = createGeometry(meshData.geometry);
    const material = createDefaultMaterial();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = meshData.castShadow;
    mesh.receiveShadow = meshData.receiveShadow;

    this.renderer.add(mesh);

    const entry: RenderEntry = {
      type: 'mesh',
      object: mesh,
      entity,
      assetUrl: null,
      isLoading: false,
      geometryHash: hashGeometry(meshData.geometry),
    };
    this.entries.set(entity, entry);

    const handle = this.nextHandle++;
    this.handleToEntity.set(handle, entity);

    // Apply material async
    this.updateMeshMaterial(entity, materialData);

    return handle;
  }

  async updateMeshMaterial(entity: Entity, materialData: Material3DData | null): Promise<void> {
    const entry = this.entries.get(entity);
    if (!entry || entry.type !== 'mesh') return;

    const mesh = entry.object as THREE.Mesh;
    const material = await createMaterialFromData(materialData, mesh.material as THREE.MeshStandardMaterial);
    mesh.material = material;
  }

  updateMesh(
    entity: Entity,
    meshData: Mesh3DData,
    materialData: Material3DData | null,
    transform: Transform3DData,
  ): void {
    const entry = this.entries.get(entity);
    if (!entry || entry.type !== 'mesh') return;

    const mesh = entry.object as THREE.Mesh;

    // Check if geometry changed
    const newHash = hashGeometry(meshData.geometry);
    if (newHash !== entry.geometryHash) {
      mesh.geometry.dispose();
      mesh.geometry = createGeometry(meshData.geometry);
      entry.geometryHash = newHash;
    }

    // Update shadows
    mesh.castShadow = meshData.castShadow;
    mesh.receiveShadow = meshData.receiveShadow;

    // Update transform
    this.applyTransform(mesh, transform);
  }

  // --------------------------------------------------------------------------
  // GLTF Model
  // --------------------------------------------------------------------------

  createGLTFModel(entity: Entity, modelData: GLTFModelData): number {
    // Create placeholder group
    const group = new THREE.Group();
    this.renderer.add(group);

    const assetUrl = modelData.asset?.getLoadableUrl() ?? null;

    const entry: RenderEntry = {
      type: 'gltf',
      object: group,
      entity,
      assetUrl,
      isLoading: false,
    };
    this.entries.set(entity, entry);

    const handle = this.nextHandle++;
    this.handleToEntity.set(handle, entity);

    // Start loading if asset is set
    if (assetUrl) {
      this.loadGLTFModel(entity, assetUrl, modelData);
    }

    return handle;
  }

  private async loadGLTFModel(entity: Entity, url: string, modelData: GLTFModelData): Promise<void> {
    const entry = this.entries.get(entity);
    if (!entry || entry.type !== 'gltf') return;

    entry.isLoading = true;

    try {
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        this.gltfLoader.load(url, resolve, undefined, reject);
      });

      // Check entity still exists and URL matches
      const currentEntry = this.entries.get(entity);
      if (!currentEntry || currentEntry.assetUrl !== url) return;

      // Clear placeholder and add loaded model
      const group = entry.object as THREE.Group;
      while (group.children.length > 0) {
        group.remove(group.children[0]!);
      }

      // Add the loaded scene to our group
      group.add(gltf.scene);

      // Apply shadow settings recursively
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = modelData.castShadow;
          child.receiveShadow = modelData.receiveShadow;
        }
      });

      entry.isLoading = false;
    } catch (error) {
      console.warn(`Failed to load GLTF model for entity ${entity}:`, error);
      entry.isLoading = false;
    }
  }

  updateGLTFModel(entity: Entity, modelData: GLTFModelData, transform: Transform3DData): void {
    const entry = this.entries.get(entity);
    if (!entry || entry.type !== 'gltf') return;

    // Check if asset changed
    const newUrl = modelData.asset?.getLoadableUrl() ?? null;
    if (newUrl !== entry.assetUrl) {
      entry.assetUrl = newUrl;
      // Clear current model
      const group = entry.object as THREE.Group;
      while (group.children.length > 0) {
        const child = group.children[0]!;
        group.remove(child);
      }
      // Load new model
      if (newUrl) {
        this.loadGLTFModel(entity, newUrl, modelData);
      }
    }

    // Update transform
    this.applyTransform(entry.object, transform);
  }

  // --------------------------------------------------------------------------
  // FBX Model
  // --------------------------------------------------------------------------

  createFBXModel(entity: Entity, modelData: FBXModelData): number {
    const group = new THREE.Group();
    this.renderer.add(group);

    const assetUrl = modelData.asset?.getLoadableUrl() ?? null;

    const entry: RenderEntry = {
      type: 'fbx',
      object: group,
      entity,
      assetUrl,
      isLoading: false,
    };
    this.entries.set(entity, entry);

    const handle = this.nextHandle++;
    this.handleToEntity.set(handle, entity);

    if (assetUrl) {
      this.loadFBXModel(entity, assetUrl, modelData);
    }

    return handle;
  }

  private async loadFBXModel(entity: Entity, url: string, modelData: FBXModelData): Promise<void> {
    const entry = this.entries.get(entity);
    if (!entry || entry.type !== 'fbx') return;

    entry.isLoading = true;

    try {
      const fbx = await new Promise<THREE.Group>((resolve, reject) => {
        this.fbxLoader.load(url, resolve, undefined, reject);
      });

      const currentEntry = this.entries.get(entity);
      if (!currentEntry || currentEntry.assetUrl !== url) return;

      const group = entry.object as THREE.Group;
      while (group.children.length > 0) {
        group.remove(group.children[0]!);
      }

      group.add(fbx);

      fbx.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = modelData.castShadow;
          child.receiveShadow = modelData.receiveShadow;
        }
      });

      entry.isLoading = false;
    } catch (error) {
      console.warn(`Failed to load FBX model for entity ${entity}:`, error);
      entry.isLoading = false;
    }
  }

  updateFBXModel(entity: Entity, modelData: FBXModelData, transform: Transform3DData): void {
    const entry = this.entries.get(entity);
    if (!entry || entry.type !== 'fbx') return;

    const newUrl = modelData.asset?.getLoadableUrl() ?? null;
    if (newUrl !== entry.assetUrl) {
      entry.assetUrl = newUrl;
      const group = entry.object as THREE.Group;
      while (group.children.length > 0) {
        group.remove(group.children[0]!);
      }
      if (newUrl) {
        this.loadFBXModel(entity, newUrl, modelData);
      }
    }

    this.applyTransform(entry.object, transform);
  }

  // --------------------------------------------------------------------------
  // Lights
  // --------------------------------------------------------------------------

  createLight(entity: Entity, lightData: Light3DData): number {
    const light = createLightFromData(lightData);
    this.renderer.add(light);

    // For directional/spot lights, add target to scene
    if (light instanceof THREE.DirectionalLight || light instanceof THREE.SpotLight) {
      this.renderer.add(light.target);
    }

    const entry: LightEntry = {
      light,
      entity,
      type: lightData.type,
    };
    this.lights.set(entity, entry);

    const handle = this.nextHandle++;
    this.handleToEntity.set(handle, entity);

    return handle;
  }

  updateLight(entity: Entity, lightData: Light3DData, transform: Transform3DData): void {
    const entry = this.lights.get(entity);
    if (!entry) return;

    // Check if light type changed (need to recreate)
    if (entry.type !== lightData.type) {
      this.removeLight(entity);
      this.createLight(entity, lightData);
      return;
    }

    updateLightFromData(entry.light, lightData);

    // Apply position
    entry.light.position.set(transform.position.x, transform.position.y, transform.position.z);

    // For directional/spot lights, set target based on rotation
    if (entry.light instanceof THREE.DirectionalLight || entry.light instanceof THREE.SpotLight) {
      // Calculate forward direction from rotation (pointing -Z)
      const euler = new THREE.Euler(transform.rotation.x, transform.rotation.y, transform.rotation.z, 'YXZ');
      const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler);
      entry.light.target.position
        .copy(entry.light.position)
        .add(forward.multiplyScalar(10));
    }
  }

  removeLight(entity: Entity): void {
    const entry = this.lights.get(entity);
    if (!entry) return;

    this.renderer.remove(entry.light);

    if (entry.light instanceof THREE.DirectionalLight || entry.light instanceof THREE.SpotLight) {
      this.renderer.remove(entry.light.target);
    }

    if (entry.helper) {
      this.renderer.remove(entry.helper);
    }

    entry.light.dispose();
    this.lights.delete(entity);
  }

  // --------------------------------------------------------------------------
  // Camera
  // --------------------------------------------------------------------------

  getRenderer(): Renderer {
    return this.renderer;
  }

  // --------------------------------------------------------------------------
  // Common
  // --------------------------------------------------------------------------

  private applyTransform(object: THREE.Object3D, transform: Transform3DData): void {
    object.position.set(transform.position.x, transform.position.y, transform.position.z);
    object.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z, 'YXZ');
    object.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
  }

  removeRenderable(entity: Entity): void {
    const entry = this.entries.get(entity);
    if (!entry) return;

    this.renderer.remove(entry.object);

    // Dispose resources
    if (entry.type === 'mesh') {
      const mesh = entry.object as THREE.Mesh;
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
    }

    this.entries.delete(entity);

    // Clean up handle mapping
    for (const [handle, ent] of this.handleToEntity.entries()) {
      if (ent === entity) {
        this.handleToEntity.delete(handle);
        break;
      }
    }
  }

  hasRenderable(entity: Entity): boolean {
    return this.entries.has(entity);
  }

  hasLight(entity: Entity): boolean {
    return this.lights.has(entity);
  }

  getObject(entity: Entity): THREE.Object3D | null {
    return this.entries.get(entity)?.object ?? null;
  }

  getLight(entity: Entity): THREE.Light | null {
    return this.lights.get(entity)?.light ?? null;
  }

  getStats(): { meshCount: number; lightCount: number } {
    return {
      meshCount: this.entries.size,
      lightCount: this.lights.size,
    };
  }

  /**
   * Get all tracked entity IDs for renderables (for cleanup checks)
   */
  getTrackedEntities(): Entity[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Get all tracked entity IDs for lights (for cleanup checks)
   */
  getTrackedLightEntities(): Entity[] {
    return Array.from(this.lights.keys());
  }

  dispose(): void {
    for (const entity of this.entries.keys()) {
      this.removeRenderable(entity);
    }
    for (const entity of this.lights.keys()) {
      this.removeLight(entity);
    }
  }
}

// ============================================================================
// Transform Propagation System
// ============================================================================

/**
 * Transform propagation system (resource-based)
 *
 * This system computes world-space Transform3D from LocalTransform3D + Parent hierarchy.
 * Run this BEFORE the render sync system.
 *
 * Registered by Application.addBuiltInSystems().
 */
export const transformPropagationSystem = system(({ commands }) => {
  // Process entities with LocalTransform3D and Parent
  // We need to process in hierarchy order (parents before children)
  // For simplicity, we iterate and rely on parent transforms being already computed

  commands
    .query()
    .all(LocalTransform3D, Parent, Transform3D)
    .each((entity, local, parent, worldTransform) => {
      // Get parent's world transform
      const parentTransform = commands.tryGetComponent(parent.id, Transform3D);
      if (!parentTransform) return;

      // Compute world transform from local + parent
      const computed = computeWorldTransform(local, parentTransform);

      // Update world transform
      worldTransform.position.x = computed.position.x;
      worldTransform.position.y = computed.position.y;
      worldTransform.position.z = computed.position.z;
      worldTransform.rotation.x = computed.rotation.x;
      worldTransform.rotation.y = computed.rotation.y;
      worldTransform.rotation.z = computed.rotation.z;
      worldTransform.scale.x = computed.scale.x;
      worldTransform.scale.y = computed.scale.y;
      worldTransform.scale.z = computed.scale.z;
    });
});

// ============================================================================
// Render3D Sync System
// ============================================================================

/**
 * 3D render sync system (resource-based)
 *
 * Gets Render3DManager from resources automatically.
 * Registered by Application.addBuiltInSystems().
 *
 * @example
 * ```typescript
 * // Automatically registered, but can be manually added:
 * app.insertResource(new Render3DManager(renderer));
 * app.addRenderSystem(render3DSyncSystem);
 * ```
 */
export const render3DSyncSystem = system(({ commands }) => {
  const renderManager = commands.getResource(Render3DManager);

  // -------------------------------------------------------------------------
  // 1. Create meshes for new Mesh3D entities
  // -------------------------------------------------------------------------
  commands
    .query()
    .all(Transform3D, Mesh3D)
    .none(RenderObject)
    .each((entity, transform, mesh) => {
      const material = commands.tryGetComponent(entity, Material3D) ?? null;
      const handle = renderManager.createMesh(entity, mesh, material);
      commands.entity(entity).addComponent(RenderObject, { handle });
    });

  // -------------------------------------------------------------------------
  // 2. Create GLTF models for new GLTFModel entities
  // -------------------------------------------------------------------------
  commands
    .query()
    .all(Transform3D, GLTFModel)
    .none(RenderObject, Mesh3D, FBXModel)
    .each((entity, transform, model) => {
      const handle = renderManager.createGLTFModel(entity, model);
      commands.entity(entity).addComponent(RenderObject, { handle });
    });

  // -------------------------------------------------------------------------
  // 3. Create FBX models for new FBXModel entities
  // -------------------------------------------------------------------------
  commands
    .query()
    .all(Transform3D, FBXModel)
    .none(RenderObject, Mesh3D, GLTFModel)
    .each((entity, transform, model) => {
      const handle = renderManager.createFBXModel(entity, model);
      commands.entity(entity).addComponent(RenderObject, { handle });
    });

  // -------------------------------------------------------------------------
  // 4. Create lights for new Light3D entities
  // -------------------------------------------------------------------------
  commands
    .query()
    .all(Transform3D, Light3D)
    .none(RenderObject)
    .each((entity, transform, light) => {
      const handle = renderManager.createLight(entity, light);
      commands.entity(entity).addComponent(RenderObject, { handle });
    });

  // -------------------------------------------------------------------------
  // 5. Update existing meshes
  // -------------------------------------------------------------------------
  commands
    .query()
    .all(Transform3D, Mesh3D, RenderObject)
    .each((entity, transform, mesh) => {
      const material = commands.tryGetComponent(entity, Material3D) ?? null;
      renderManager.updateMesh(entity, mesh, material, transform);
    });

  // -------------------------------------------------------------------------
  // 6. Update existing GLTF models
  // -------------------------------------------------------------------------
  commands
    .query()
    .all(Transform3D, GLTFModel, RenderObject)
    .none(Mesh3D, FBXModel)
    .each((entity, transform, model) => {
      renderManager.updateGLTFModel(entity, model, transform);
    });

  // -------------------------------------------------------------------------
  // 7. Update existing FBX models
  // -------------------------------------------------------------------------
  commands
    .query()
    .all(Transform3D, FBXModel, RenderObject)
    .none(Mesh3D, GLTFModel)
    .each((entity, transform, model) => {
      renderManager.updateFBXModel(entity, model, transform);
    });

  // -------------------------------------------------------------------------
  // 8. Update existing lights
  // -------------------------------------------------------------------------
  commands
    .query()
    .all(Transform3D, Light3D, RenderObject)
    .each((entity, transform, light) => {
      renderManager.updateLight(entity, light, transform);
    });

  // -------------------------------------------------------------------------
  // 9. Camera handling moved to camera-sync-system
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // 10. Remove renderables for entities that lost their renderable component
  // -------------------------------------------------------------------------
  commands
    .query()
    .all(RenderObject)
    .none(Mesh3D, GLTFModel, FBXModel)
    .each((entity) => {
      if (renderManager.hasRenderable(entity)) {
        renderManager.removeRenderable(entity);
      }
    });

  // Remove lights for entities that lost Light3D
  commands
    .query()
    .all(RenderObject)
    .none(Light3D)
    .each((entity) => {
      if (renderManager.hasLight(entity)) {
        renderManager.removeLight(entity);
      }
    });

  // -------------------------------------------------------------------------
  // 11. Clean up renderables/lights for entities that were destroyed
  // -------------------------------------------------------------------------
  for (const entity of renderManager.getTrackedEntities()) {
    if (!commands.isAlive(entity)) {
      renderManager.removeRenderable(entity);
    }
  }
  for (const entity of renderManager.getTrackedLightEntities()) {
    if (!commands.isAlive(entity)) {
      renderManager.removeLight(entity);
    }
  }
});

// Register Render3DManager as a resource (internal, not serializable)
import { registerResource } from '../resource.js';
registerResource(Render3DManager, false, {
  path: 'rendering',
  displayName: '3D Render Manager',
  description: 'Manages 3D mesh and light synchronization',
  builtIn: true,
});

