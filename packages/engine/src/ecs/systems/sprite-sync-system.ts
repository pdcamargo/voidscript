/**
 * Sprite Sync System
 *
 * Automatically synchronizes Sprite2D components to Three.js Mesh objects with sprite materials.
 * This system handles:
 * - Creating Three.js meshes for new Sprite2D entities
 * - Updating sprite transforms, textures, and tiling properties
 * - Removing sprites when entities are destroyed
 *
 * Usage:
 * ```typescript
 * // In your Application setup:
 * const spriteManager = new SpriteRenderManager(app.getRenderer());
 * app.insertResource(spriteManager);
 *
 * // Register the sync system in the render phase
 * app.scheduler.addSystem('render', spriteSyncSystem);
 * ```
 */

import * as THREE from 'three';
import { system } from '../system.js';
import type { Entity } from '../entity.js';
import type { Renderer } from '../../app/renderer.js';
import { Transform3D } from '../components/rendering/transform-3d.js';
import {
  Sprite2D,
  calculateRenderOrder,
  calculateSpriteScale,
  calculateAnchorOffset,
  type Sprite2DData,
} from '../components/rendering/sprite-2d.js';
import { RenderObject } from '../components/rendering/render-object.js';
import { loadTexture, type TextureLoadOptions } from '../../loaders/texture-loader.js';
import {
  SpriteMeshBasicMaterial,
  SpriteMeshLambertMaterial,
} from '../../rendering/sprite/index.js';

/**
 * Internal sprite entry tracking a Three.js mesh and its state
 */
interface SpriteEntry {
  mesh: THREE.Mesh;
  material: InstanceType<typeof SpriteMeshBasicMaterial> | InstanceType<typeof SpriteMeshLambertMaterial>;
  geometry: THREE.PlaneGeometry;
  texture: THREE.Texture | null;
  textureUrl: string | null;
  lastSortingLayer: number;
  lastSortingOrder: number;
  lastTileIndex: number | null;
  lastTileSize: { x: number; y: number } | null;
  lastTilesetSize: { x: number; y: number } | null;
  lastSpriteRect: { x: number; y: number; width: number; height: number } | null;
}

/**
 * Sprite Render Manager
 *
 * Manages the lifecycle of Three.js meshes for Sprite2D entities.
 * All sprites are rendered as meshes with PlaneGeometry and custom sprite materials.
 * Register as a resource with your Application.
 */
export class SpriteRenderManager {
  private renderer: Renderer;
  private sprites: Map<Entity, SpriteEntry> = new Map();
  private nextHandle: number = 1;
  private handleToEntity: Map<number, Entity> = new Map();

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  /**
   * Create a sprite for an entity
   */
  createSprite(entity: Entity, spriteData: Sprite2DData): number {
    const isLit = spriteData.isLit ?? false;

    // Create geometry (1x1 quad, will be scaled by sprite scale)
    const geometry = new THREE.PlaneGeometry(1, 1);

    // Create material based on lighting needs
    let material: InstanceType<typeof SpriteMeshBasicMaterial> | InstanceType<typeof SpriteMeshLambertMaterial>;
    if (isLit) {
      // Lit sprite - responds to THREE.js lights in the scene
      material = new SpriteMeshLambertMaterial({
        color: new THREE.Color(spriteData.color.r, spriteData.color.g, spriteData.color.b),
        transparent: true,
        opacity: spriteData.color.a,
        depthTest: false,
        depthWrite: false,
      });
    } else {
      // Unlit sprite - uses flat color
      material = new SpriteMeshBasicMaterial({
        color: new THREE.Color(spriteData.color.r, spriteData.color.g, spriteData.color.b),
        transparent: true,
        opacity: spriteData.color.a,
        depthTest: false,
        depthWrite: false,
      });
    }

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.visible = spriteData.visible;

    // Set render order
    mesh.renderOrder = calculateRenderOrder(spriteData.sortingLayer, spriteData.sortingOrder);

    // Add to scene
    this.renderer.add(mesh);

    // Track entry
    const entry: SpriteEntry = {
      mesh,
      material,
      geometry,
      texture: null,
      textureUrl: null,
      lastSortingLayer: spriteData.sortingLayer,
      lastSortingOrder: spriteData.sortingOrder,
      lastTileIndex: spriteData.tileIndex,
      lastTileSize: spriteData.tileSize ?? null,
      lastTilesetSize: spriteData.tilesetSize ?? null,
      lastSpriteRect: spriteData.spriteRect ?? null,
    };
    this.sprites.set(entity, entry);

    // Generate handle
    const handle = this.nextHandle++;
    this.handleToEntity.set(handle, entity);

    // Start texture loading if needed
    this.loadTextureIfNeeded(entity, spriteData);

    return handle;
  }

  /**
   * Update sprite properties from component data
   */
  updateSprite(
    entity: Entity,
    spriteData: Sprite2DData,
    transform: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; scale: { x: number; y: number } },
  ): void {
    const entry = this.sprites.get(entity);
    if (!entry) return;

    const { mesh, material } = entry;

    // Check if lighting mode changed - recreate material if needed
    const isLit = spriteData.isLit ?? false;
    const currentIsLit = material instanceof SpriteMeshLambertMaterial;
    if (isLit !== currentIsLit) {
      this.recreateMaterial(entity, spriteData);
      return; // Material recreated, updateSprite will be called again
    }

    // Update transform
    // Calculate sprite scale from texture and pixelsPerUnit
    if (entry.texture) {
      const image = entry.texture.image as { width?: number; height?: number } | null;

      // Determine dimensions: spriteRect > tileSize > full texture
      let textureWidth: number;
      let textureHeight: number;

      if (spriteData.spriteRect) {
        // Use rect dimensions
        textureWidth = spriteData.spriteRect.width;
        textureHeight = spriteData.spriteRect.height;
      } else if (spriteData.tileSize) {
        // Use tile dimensions
        textureWidth = spriteData.tileSize.x;
        textureHeight = spriteData.tileSize.y;
      } else {
        // Use full texture dimensions
        textureWidth = image?.width ?? 1;
        textureHeight = image?.height ?? 1;
      }

      const spriteScale = calculateSpriteScale(
        spriteData.pixelsPerUnit,
        textureWidth,
        textureHeight,
        spriteData.spriteRect
          ? { x: spriteData.spriteRect.width, y: spriteData.spriteRect.height }
          : spriteData.tileSize,
      );

      // Calculate anchor offset based on sprite dimensions
      const anchorOffset = calculateAnchorOffset(
        spriteScale.x * transform.scale.x,
        spriteScale.y * transform.scale.y,
        spriteData.anchor,
      );

      // Apply position with anchor offset
      mesh.position.set(
        transform.position.x + anchorOffset.x,
        transform.position.y + anchorOffset.y,
        transform.position.z,
      );

      mesh.scale.set(
        spriteScale.x * transform.scale.x * (spriteData.flipX ? -1 : 1),
        spriteScale.y * transform.scale.y * (spriteData.flipY ? -1 : 1),
        1,
      );
    } else {
      // No texture, use transform scale directly
      const anchorOffset = calculateAnchorOffset(
        transform.scale.x,
        transform.scale.y,
        spriteData.anchor,
      );

      mesh.position.set(
        transform.position.x + anchorOffset.x,
        transform.position.y + anchorOffset.y,
        transform.position.z,
      );

      mesh.scale.set(
        transform.scale.x * (spriteData.flipX ? -1 : 1),
        transform.scale.y * (spriteData.flipY ? -1 : 1),
        1,
      );
    }

    mesh.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);

    // Update material color and opacity
    material.color.setRGB(spriteData.color.r, spriteData.color.g, spriteData.color.b);
    material.opacity = spriteData.color.a;

    // Update visibility
    mesh.visible = spriteData.visible;

    // Update render order if changed
    if (
      spriteData.sortingLayer !== entry.lastSortingLayer ||
      spriteData.sortingOrder !== entry.lastSortingOrder
    ) {
      mesh.renderOrder = calculateRenderOrder(spriteData.sortingLayer, spriteData.sortingOrder);
      entry.lastSortingLayer = spriteData.sortingLayer;
      entry.lastSortingOrder = spriteData.sortingOrder;
    }

    // Check if spriteRect changed
    const spriteRectChanged =
      spriteData.spriteRect?.x !== entry.lastSpriteRect?.x ||
      spriteData.spriteRect?.y !== entry.lastSpriteRect?.y ||
      spriteData.spriteRect?.width !== entry.lastSpriteRect?.width ||
      spriteData.spriteRect?.height !== entry.lastSpriteRect?.height;

    // Update UV mapping based on sprite mode (rect takes precedence over tile)
    if (spriteData.spriteRect && entry.texture) {
      // Rect-based sprite
      if (spriteRectChanged) {
        const image = entry.texture.image as { width?: number; height?: number } | null;
        const textureSize = {
          x: image?.width ?? 1,
          y: image?.height ?? 1,
        };
        material.rect({
          rect: spriteData.spriteRect,
          textureSize,
        });
        entry.lastSpriteRect = { ...spriteData.spriteRect };
        // Clear tile tracking when using rect
        entry.lastTileIndex = null;
        entry.lastTileSize = null;
        entry.lastTilesetSize = null;
      }
    } else {
      // Tile-based sprite
      const tileIndexChanged = spriteData.tileIndex !== entry.lastTileIndex;
      const tileSizeChanged =
        spriteData.tileSize?.x !== entry.lastTileSize?.x ||
        spriteData.tileSize?.y !== entry.lastTileSize?.y;
      const tilesetSizeChanged =
        spriteData.tilesetSize?.x !== entry.lastTilesetSize?.x ||
        spriteData.tilesetSize?.y !== entry.lastTilesetSize?.y;

      if (tileIndexChanged || tileSizeChanged || tilesetSizeChanged) {
        if (spriteData.tileIndex !== null && spriteData.tileSize && spriteData.tilesetSize) {
          material.tile({
            tile: spriteData.tileIndex,
            tileSize: spriteData.tileSize,
            tilesetSize: spriteData.tilesetSize,
          });
        }
        entry.lastTileIndex = spriteData.tileIndex;
        entry.lastTileSize = spriteData.tileSize ?? null;
        entry.lastTilesetSize = spriteData.tilesetSize ?? null;
        // Clear rect tracking when using tile
        entry.lastSpriteRect = null;
      }
    }

    // Check if texture needs updating
    this.loadTextureIfNeeded(entity, spriteData);
  }

  /**
   * Recreate material when isLit changes (switches between BasicMaterial and LambertMaterial)
   */
  private recreateMaterial(
    entity: Entity,
    spriteData: Sprite2DData,
  ): void {
    const entry = this.sprites.get(entity);
    if (!entry) return;

    const isLit = spriteData.isLit ?? false;

    // Store current texture
    const texture = entry.texture;

    // Dispose old material
    entry.material.dispose();

    // Create new material based on lighting needs
    let newMaterial: InstanceType<typeof SpriteMeshBasicMaterial> | InstanceType<typeof SpriteMeshLambertMaterial>;
    if (isLit) {
      // Lit sprite - responds to THREE.js lights in the scene
      newMaterial = new SpriteMeshLambertMaterial({
        color: new THREE.Color(spriteData.color.r, spriteData.color.g, spriteData.color.b),
        transparent: true,
        opacity: spriteData.color.a,
        depthTest: false,
        depthWrite: false,
        map: texture,
      });
    } else {
      // Unlit sprite - uses flat color
      newMaterial = new SpriteMeshBasicMaterial({
        color: new THREE.Color(spriteData.color.r, spriteData.color.g, spriteData.color.b),
        transparent: true,
        opacity: spriteData.color.a,
        depthTest: false,
        depthWrite: false,
        map: texture,
      });
    }

    // Update mesh material
    entry.mesh.material = newMaterial;

    // Update entry
    entry.material = newMaterial;

    // Reapply UV mapping if needed (rect takes precedence over tile)
    if (spriteData.spriteRect && texture) {
      const image = texture.image as { width?: number; height?: number } | null;
      const textureSize = {
        x: image?.width ?? 1,
        y: image?.height ?? 1,
      };
      newMaterial.rect({
        rect: spriteData.spriteRect,
        textureSize,
      });
    } else if (spriteData.tileIndex !== null && spriteData.tileSize && spriteData.tilesetSize) {
      newMaterial.tile({
        tile: spriteData.tileIndex,
        tileSize: spriteData.tileSize,
        tilesetSize: spriteData.tilesetSize,
      });
    }
  }

  /**
   * Load texture for sprite if needed
   */
  private async loadTextureIfNeeded(entity: Entity, spriteData: Sprite2DData): Promise<void> {
    const entry = this.sprites.get(entity);
    if (!entry) return;

    // Determine texture URL
    let textureUrl: string | null = null;

    if (spriteData.texture) {
      // RuntimeAsset - use path from metadata
      textureUrl = spriteData.texture.getLoadableUrl();
    }

    // Check if texture changed
    if (textureUrl === entry.textureUrl) {
      return; // No change needed
    }

    // Clear old texture
    if (entry.texture) {
      entry.material.map = null;
      entry.material.needsUpdate = true;
      // Don't dispose - might be shared
    }

    entry.textureUrl = textureUrl;

    if (!textureUrl) {
      entry.texture = null;
      entry.material.map = null;
      entry.material.needsUpdate = true;
      return;
    }

    // Load new texture
    try {
      const options: TextureLoadOptions = {
        filtering: 'linear',
        sRGB: true,
      };

      const texture = await loadTexture(textureUrl, options);

      // Verify entity still exists and URL hasn't changed
      const currentEntry = this.sprites.get(entity);
      if (!currentEntry || currentEntry.textureUrl !== textureUrl) {
        return; // Entity removed or URL changed during load
      }

      // Apply texture to material
      entry.texture = texture;
      entry.material.map = texture;
      entry.material.needsUpdate = true;

      // Apply UV mapping (rect takes precedence over tile)
      if (spriteData.spriteRect) {
        const image = texture.image as { width?: number; height?: number } | null;
        const textureSize = {
          x: image?.width ?? 1,
          y: image?.height ?? 1,
        };
        entry.material.rect({
          rect: spriteData.spriteRect,
          textureSize,
        });
      } else if (spriteData.tileIndex !== null && spriteData.tileSize && spriteData.tilesetSize) {
        entry.material.tile({
          tile: spriteData.tileIndex,
          tileSize: spriteData.tileSize,
          tilesetSize: spriteData.tilesetSize,
        });
      }
    } catch (error) {
      console.warn(`Failed to load texture for sprite entity ${entity}:`, error);
    }
  }

  /**
   * Remove a sprite for an entity
   */
  removeSprite(entity: Entity): void {
    const entry = this.sprites.get(entity);
    if (!entry) return;

    // Remove from scene
    this.renderer.remove(entry.mesh);

    // Dispose material (but not shared textures)
    entry.material.dispose();

    // Dispose geometry
    entry.geometry.dispose();

    // Remove from tracking
    this.sprites.delete(entity);

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
   */
  getMesh(entity: Entity): THREE.Mesh | null {
    return this.sprites.get(entity)?.mesh ?? null;
  }

  /**
   * @deprecated Use getMesh() instead
   */
  getSprite(entity: Entity): THREE.Mesh | null {
    return this.getMesh(entity);
  }

  /**
   * Check if entity has a sprite
   */
  hasSprite(entity: Entity): boolean {
    return this.sprites.has(entity);
  }

  /**
   * Get entity from handle
   */
  getEntityFromHandle(handle: number): Entity | null {
    return this.handleToEntity.get(handle) ?? null;
  }

  /**
   * Get statistics
   */
  getStats(): { spriteCount: number } {
    return { spriteCount: this.sprites.size };
  }

  /**
   * Get all tracked entity IDs (for cleanup checks)
   */
  getTrackedEntities(): Entity[] {
    return Array.from(this.sprites.keys());
  }

  /**
   * Dispose all sprites
   */
  dispose(): void {
    for (const [entity] of this.sprites) {
      this.removeSprite(entity);
    }
  }
}

/**
 * Sprite sync system (resource-based)
 *
 * Gets SpriteRenderManager from resources automatically.
 * Registered by Application.addBuiltInSystems().
 *
 * Sprites use mesh-based rendering with custom sprite materials.
 * Lit sprites (isLit: true) automatically respond to THREE.js lights in the scene.
 *
 * @example
 * ```typescript
 * // Automatically registered, but can be manually added:
 * app.insertResource(new SpriteRenderManager(renderer));
 * app.addRenderSystem(spriteSyncSystem);
 * ```
 */
export const spriteSyncSystem = system(({ commands }) => {
  const spriteManager = commands.getResource(SpriteRenderManager);

  // 1. Create sprites for new Sprite2D entities (have Sprite2D + Transform3D but no RenderObject)
  commands
    .query()
    .all(Transform3D, Sprite2D)
    .none(RenderObject)
    .each((entity, transform, sprite) => {
      const handle = spriteManager.createSprite(entity, sprite);
      commands.entity(entity).addComponent(RenderObject, { handle });
    });

  // 2. Update existing sprites
  commands
    .query()
    .all(Transform3D, Sprite2D, RenderObject)
    .each((entity, transform, sprite) => {
      spriteManager.updateSprite(
        entity,
        sprite,
        {
          position: { x: transform.position.x, y: transform.position.y, z: transform.position.z },
          rotation: { x: transform.rotation.x, y: transform.rotation.y, z: transform.rotation.z },
          scale: { x: transform.scale.x, y: transform.scale.y },
        },
      );
    });

  // 3. Remove sprites for entities that lost their Sprite2D component
  // (have RenderObject but no Sprite2D)
  commands
    .query()
    .all(RenderObject)
    .none(Sprite2D)
    .each((entity) => {
      if (spriteManager.hasSprite(entity)) {
        spriteManager.removeSprite(entity);
        // Note: We don't remove RenderObject component here as it might be used by 3D sync
      }
    });

  // 4. Clean up sprites for entities that were destroyed
  // (entity no longer exists in world but sprite still tracked)
  for (const entity of spriteManager.getTrackedEntities()) {
    if (!commands.isAlive(entity)) {
      spriteManager.removeSprite(entity);
    }
  }
});

// Register SpriteRenderManager as a resource (internal, not serializable)
import { registerResource } from '../resource.js';
registerResource(SpriteRenderManager, false, {
  path: 'rendering',
  displayName: 'Sprite Render Manager',
  description: 'Manages 2D sprite rendering',
  builtIn: true,
});

