/**
 * TilemapRenderManager
 *
 * Resource for managing Three.js meshes for Tiled tile layers.
 * Similar pattern to SpriteRenderManager but for tilemaps.
 *
 * Responsibilities:
 * - Creating tilemap meshes with TilemapMeshBasicMaterial
 * - Converting Tiled layer data to TilemapMaterial format
 * - Updating mesh transforms and properties
 * - Disposing meshes when layers are removed
 *
 * Usage:
 * ```typescript
 * // In Application setup:
 * app.insertResource(new TilemapRenderManager(app.getRenderer()));
 *
 * // In a system:
 * const tilemapManager = commands.getResource(TilemapRenderManager);
 * const handle = tilemapManager.createTilemap(entity, layerData, tilesetInfo, options);
 * ```
 */

import * as THREE from 'three';
import type { Entity } from '@voidscript/core';
import type { Renderer } from '../app/renderer.js';
import type * as tiled from '@kayahr/tiled';
import { TilemapMeshBasicMaterial, TilemapMeshLambertMaterial } from '../rendering/sprite/index.js';
import type { TilesetInfo } from '../ecs/components/tiled/tiled-map.js';
import type { TiledTileLayerData } from '../ecs/components/tiled/tiled-tile-layer.js';
import { decodeTileLayerData, extractGidAndFlips } from './tiled-utils.js';
import type { RuntimeAsset } from '@voidscript/core';

/**
 * Internal tilemap entry tracking a Three.js mesh and its state
 */
interface TilemapEntry {
  mesh: THREE.Mesh;
  material: InstanceType<typeof TilemapMeshBasicMaterial> | InstanceType<typeof TilemapMeshLambertMaterial>;
  geometry: THREE.PlaneGeometry;
  textureAsset: RuntimeAsset<THREE.Texture>;
  lastZOrder: number;
  lastIsLit: boolean;
  /** Cached tile data for material recreation */
  tileData: {
    tiles: number[];
    repeat: { x: number; y: number };
    tileSize: { x: number; y: number };
    tilesetSize: { x: number; y: number };
    tilesetGridSize: { x: number; y: number };
    spacing: number;
  };
}

/**
 * Options for creating a tilemap
 */
export interface TilemapCreateOptions {
  /** World-space offset */
  worldOffset: { x: number; y: number; z: number };

  /** Pixels per unit for sizing */
  pixelsPerUnit: number;

  /** Z-order for rendering (deprecated, use sortingLayer/sortingOrder instead) */
  zOrder: number;

  /** Opacity (0-1) */
  opacity: number;

  /** Sorting layer for render order (default: 0) */
  sortingLayer?: number;

  /** Sorting order within layer (default: 0) */
  sortingOrder?: number;

  /** Whether this tilemap responds to scene lighting (default: false) */
  isLit?: boolean;
}

/**
 * Tilemap Render Manager
 *
 * Manages the lifecycle of Three.js meshes for Tiled tile layers.
 * Register as a resource with your Application.
 */
export class TilemapRenderManager {
  private renderer: Renderer;
  private tilemaps: Map<Entity, TilemapEntry> = new Map();
  private nextHandle: number = 1;
  private handleToEntity: Map<number, Entity> = new Map();

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  /**
   * Create a tilemap mesh for a tile layer
   *
   * @param entity - Entity ID
   * @param layerData - Tiled tile layer data
   * @param tilesetInfo - Tileset information
   * @param options - Creation options
   * @returns Handle to the tilemap
   */
  createTilemap(
    entity: Entity,
    layerData: tiled.TileLayer,
    tilesetInfo: TilesetInfo,
    options: TilemapCreateOptions
  ): number {
    // Decode tile data
    const tileGids = decodeTileLayerData(layerData);

    // Convert GIDs to local tile indices
    const tiles: number[] = [];
    let hasFlippedTiles = false;

    for (const gid of tileGids) {
      if (gid === 0) {
        // Empty tile
        tiles.push(0);
        continue;
      }

      const { gid: cleanGid, flipX, flipY, flipD } = extractGidAndFlips(gid);

      // Check for flip flags
      if (flipX || flipY || flipD) {
        hasFlippedTiles = true;
      }

      // Convert to local tile index
      const localTileId = cleanGid - tilesetInfo.firstGid;
      tiles.push(localTileId);
    }

    // Log warning if tiles have flip flags
    if (hasFlippedTiles) {
      console.warn(
        `[TilemapRenderManager] Layer "${layerData.name}" contains flipped tiles. ` +
          'Tile flipping in tile layers is not yet supported and will be ignored. ' +
          'Flip flags will be supported in a future update.'
      );
    }

    // Extract texture from RuntimeAsset
    const textureAsset = tilesetInfo.texture;

    // Ensure texture is loaded
    if (!textureAsset.isLoaded || !textureAsset.data) {
      console.warn(
        `[TilemapRenderManager] Tileset texture not loaded for layer "${layerData.name}". ` +
        'Tilemap creation will be skipped. Ensure textures are loaded before creating tilemaps.'
      );
      // Return invalid handle to signal failure
      return -1;
    }

    const texture = textureAsset.data;

    // Calculate map dimensions in world units
    const mapWidthInPixels = layerData.width * tilesetInfo.tileWidth;
    const mapHeightInPixels = layerData.height * tilesetInfo.tileHeight;
    const mapWidthInWorld = mapWidthInPixels / options.pixelsPerUnit;
    const mapHeightInWorld = mapHeightInPixels / options.pixelsPerUnit;

    // Create geometry (sized to map dimensions)
    const geometry = new THREE.PlaneGeometry(mapWidthInWorld, mapHeightInWorld);

    // Determine if lit material should be used
    const isLit = options.isLit ?? false;

    // Create material based on lighting needs
    let material: InstanceType<typeof TilemapMeshBasicMaterial> | InstanceType<typeof TilemapMeshLambertMaterial>;
    if (isLit) {
      // Lit tilemap - responds to THREE.js lights in the scene
      material = new TilemapMeshLambertMaterial({
        map: texture,
        transparent: true,
        opacity: options.opacity,
        depthTest: false,
        depthWrite: false,
      });
    } else {
      // Unlit tilemap - uses flat color
      material = new TilemapMeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: options.opacity,
        depthTest: false,
        depthWrite: false,
      });
    }

    // Calculate tileset grid dimensions
    const tilesetRows = Math.ceil(tilesetInfo.tileCount / tilesetInfo.columns);

    // Prepare tile data for material and caching
    const tileData = {
      tiles,
      repeat: { x: layerData.width, y: layerData.height },
      tileSize: { x: tilesetInfo.tileWidth, y: tilesetInfo.tileHeight },
      tilesetSize: { x: tilesetInfo.imageWidth, y: tilesetInfo.imageHeight },
      tilesetGridSize: { x: tilesetInfo.columns, y: tilesetRows },
      spacing: tilesetInfo.tilesetData.spacing ?? 0,
    };

    // Set tilemap data
    material.tile(tileData);

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;

    // Position mesh (center of map in world space)
    const centerX = mapWidthInWorld / 2 + options.worldOffset.x;
    const centerY = mapHeightInWorld / 2 + options.worldOffset.y;
    mesh.position.set(centerX, centerY, options.worldOffset.z);

    // Set render order
    // Use sortingLayer/sortingOrder if provided, otherwise fall back to zOrder
    const renderOrder = options.sortingLayer !== undefined || options.sortingOrder !== undefined
      ? (options.sortingLayer ?? 0) * 1000 + (options.sortingOrder ?? 0)
      : options.zOrder;
    mesh.renderOrder = renderOrder;

    // Add to scene
    this.renderer.add(mesh);

    // Track entry
    const entry: TilemapEntry = {
      mesh,
      material,
      geometry,
      textureAsset,
      lastZOrder: options.zOrder,
      lastIsLit: isLit,
      tileData,
    };
    this.tilemaps.set(entity, entry);

    // Generate handle
    const handle = this.nextHandle++;
    this.handleToEntity.set(handle, entity);

    return handle;
  }

  /**
   * Update tilemap properties
   *
   * @param entity - Entity ID
   * @param transform - Transform data (position, rotation, scale)
   * @param layerData - Tile layer component data
   */
  updateTilemap(
    entity: Entity,
    transform: { position: { x: number; y: number; z: number }; rotation: { z: number }; scale: { x: number; y: number } },
    layerData: TiledTileLayerData
  ): void {
    const entry = this.tilemaps.get(entity);
    if (!entry) return;

    const { mesh, material } = entry;

    // Check if lighting mode changed - recreate material if needed
    const isLit = layerData.isLit ?? false;
    if (isLit !== entry.lastIsLit) {
      this.recreateMaterial(entity, layerData);
      return; // Material recreated, updateTilemap will be called again
    }

    // Update transform
    mesh.position.set(transform.position.x, transform.position.y, transform.position.z);
    mesh.rotation.z = transform.rotation.z;
    mesh.scale.set(transform.scale.x, transform.scale.y, 1);

    // Update opacity
    material.opacity = layerData.opacity;

    // Update visibility
    mesh.visible = layerData.visible;

    // Update render order if changed
    if (layerData.zOrder !== entry.lastZOrder) {
      mesh.renderOrder = layerData.zOrder;
      entry.lastZOrder = layerData.zOrder;
    }
  }

  /**
   * Recreate material when isLit changes (switches between BasicMaterial and LambertMaterial)
   *
   * @param entity - Entity ID
   * @param layerData - Tile layer component data
   */
  private recreateMaterial(entity: Entity, layerData: TiledTileLayerData): void {
    const entry = this.tilemaps.get(entity);
    if (!entry) return;

    const isLit = layerData.isLit ?? false;

    // Get current texture
    const texture = entry.textureAsset.data;
    if (!texture) return;

    // Dispose old material
    entry.material.dispose();

    // Create new material based on lighting needs
    let newMaterial: InstanceType<typeof TilemapMeshBasicMaterial> | InstanceType<typeof TilemapMeshLambertMaterial>;
    if (isLit) {
      // Lit tilemap - responds to THREE.js lights in the scene
      newMaterial = new TilemapMeshLambertMaterial({
        map: texture,
        transparent: true,
        opacity: layerData.opacity,
        depthTest: false,
        depthWrite: false,
      });
    } else {
      // Unlit tilemap - uses flat color
      newMaterial = new TilemapMeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: layerData.opacity,
        depthTest: false,
        depthWrite: false,
      });
    }

    // Reapply tile data
    newMaterial.tile(entry.tileData);

    // Update mesh material
    entry.mesh.material = newMaterial;

    // Update entry
    entry.material = newMaterial;
    entry.lastIsLit = isLit;
  }

  /**
   * Remove a tilemap mesh
   *
   * @param entity - Entity ID
   */
  removeTilemap(entity: Entity): void {
    const entry = this.tilemaps.get(entity);
    if (!entry) return;

    // Remove from scene
    this.renderer.remove(entry.mesh);

    // Dispose material (but not shared texture)
    entry.material.dispose();

    // Dispose geometry
    entry.geometry.dispose();

    // Remove from tracking
    this.tilemaps.delete(entity);

    // Clean up handle mapping
    for (const [handle, ent] of this.handleToEntity.entries()) {
      if (ent === entity) {
        this.handleToEntity.delete(handle);
        break;
      }
    }
  }

  /**
   * Get the Three.js mesh for an entity
   *
   * @param entity - Entity ID
   * @returns Mesh or null
   */
  getMesh(entity: Entity): THREE.Mesh | null {
    return this.tilemaps.get(entity)?.mesh ?? null;
  }

  /**
   * Check if entity has a tilemap
   *
   * @param entity - Entity ID
   * @returns True if tilemap exists
   */
  hasTilemap(entity: Entity): boolean {
    return this.tilemaps.has(entity);
  }

  /**
   * Get entity from handle
   *
   * @param handle - Handle number
   * @returns Entity or null
   */
  getEntityFromHandle(handle: number): Entity | null {
    return this.handleToEntity.get(handle) ?? null;
  }

  /**
   * Get statistics
   *
   * @returns Stats
   */
  getStats(): { tilemapCount: number } {
    return { tilemapCount: this.tilemaps.size };
  }

  /**
   * Dispose all tilemaps
   */
  dispose(): void {
    for (const [entity] of this.tilemaps) {
      this.removeTilemap(entity);
    }
  }
}
