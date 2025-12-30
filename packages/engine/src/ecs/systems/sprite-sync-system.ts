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
import {
  Sprite2DMaterial,
  type Sprite2DMaterialData,
  type UniformValue,
} from '../components/rendering/sprite-2d-material.js';
import { RenderObject } from '../components/rendering/render-object.js';
import { loadTexture, type TextureLoadOptions } from '../../loaders/texture-loader.js';
import {
  SpriteMeshBasicMaterial,
  SpriteMeshLambertMaterial,
} from '../../rendering/sprite/index.js';
import type { ShaderAsset } from '../../shader/shader-asset.js';
import { ShaderManager } from '../../shader/shader-manager.js';
import { DefaultTextureGenerator } from '../../shader/default-texture-generator.js';
import type { NoiseTextureParams } from '../../shader/vsl/ast.js';

/** Standard sprite material type */
type StandardSpriteMaterial =
  | InstanceType<typeof SpriteMeshBasicMaterial>
  | InstanceType<typeof SpriteMeshLambertMaterial>;

/** Any sprite material (standard or custom shader) */
type AnySpriteMaterial = StandardSpriteMaterial | THREE.ShaderMaterial;

/**
 * Type guard to check if a material is a standard sprite material
 * (has color, map, rect, tile properties)
 */
function isStandardSpriteMaterial(material: AnySpriteMaterial): material is StandardSpriteMaterial {
  return (
    material instanceof SpriteMeshBasicMaterial ||
    material instanceof SpriteMeshLambertMaterial
  );
}

/**
 * Internal sprite entry tracking a Three.js mesh and its state
 */
interface SpriteEntry {
  mesh: THREE.Mesh;
  material: AnySpriteMaterial;
  geometry: THREE.PlaneGeometry;
  texture: THREE.Texture | null;
  textureUrl: string | null;
  lastSortingLayer: number;
  lastSortingOrder: number;
  lastTileIndex: number | null;
  lastTileSize: { x: number; y: number } | null;
  lastTilesetSize: { x: number; y: number } | null;
  lastSpriteRect: { x: number; y: number; width: number; height: number } | null;
  /** Custom shader state tracking */
  customShader: {
    /** GUID of the current shader asset */
    shaderGuid: string | null;
    /** Whether custom shader is enabled */
    enabled: boolean;
    /** Last uniform values (for change detection) */
    lastUniforms: Record<string, unknown>;
  };
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
      customShader: {
        shaderGuid: null,
        enabled: false,
        lastUniforms: {},
      },
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
    const isCustomShader = material instanceof THREE.ShaderMaterial && !(material instanceof SpriteMeshBasicMaterial) && !(material instanceof SpriteMeshLambertMaterial);

    // Don't recreate material if using custom shader - custom shaders handle their own lighting
    if (isLit !== currentIsLit && !isCustomShader) {
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

    // Only update standard material properties if using standard material
    // Custom shader materials handle these through uniforms in updateCustomShader
    if (isStandardSpriteMaterial(material)) {
      // Update material color and opacity
      material.color.setRGB(spriteData.color.r, spriteData.color.g, spriteData.color.b);
      material.opacity = spriteData.color.a;

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
      if (isStandardSpriteMaterial(entry.material)) {
        entry.material.map = null;
      } else {
        // For shader materials, clear texture uniforms (map is the actual uniform name)
        const shaderMaterial = entry.material as THREE.ShaderMaterial;
        if (shaderMaterial.uniforms['map']) {
          shaderMaterial.uniforms['map'].value = null;
        }
      }
      entry.material.needsUpdate = true;
      // Don't dispose - might be shared
    }

    entry.textureUrl = textureUrl;

    if (!textureUrl) {
      entry.texture = null;
      if (isStandardSpriteMaterial(entry.material)) {
        entry.material.map = null;
      } else {
        // For shader materials, clear texture uniforms (map is the actual uniform name)
        const shaderMaterial = entry.material as THREE.ShaderMaterial;
        if (shaderMaterial.uniforms['map']) {
          shaderMaterial.uniforms['map'].value = null;
        }
      }
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

      if (isStandardSpriteMaterial(entry.material)) {
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
      } else {
        // For shader materials, update texture uniforms (map is the actual uniform name)
        const shaderMaterial = entry.material as THREE.ShaderMaterial;
        if (shaderMaterial.uniforms['map']) {
          shaderMaterial.uniforms['map'].value = texture;
        }
        // Update texture size uniform
        const image = texture.image as { width?: number; height?: number } | null;
        if (image) {
          const textureSize = new THREE.Vector2(image.width ?? 1, image.height ?? 1);
          if (shaderMaterial.uniforms['vsl_textureSize']) {
            shaderMaterial.uniforms['vsl_textureSize'].value = textureSize;
          }
        }
        entry.material.needsUpdate = true;
      }
    } catch (error) {
      console.warn(`Failed to load texture for sprite entity ${entity}:`, error);
    }
  }

  /**
   * Update custom shader material for a sprite
   *
   * @param entity - Entity to update
   * @param spriteData - Sprite2D component data
   * @param materialData - Sprite2DMaterial component data (or null if not present)
   * @param shaderManager - ShaderManager resource (optional, for time uniforms)
   */
  updateCustomShader(
    entity: Entity,
    spriteData: Sprite2DData,
    materialData: Sprite2DMaterialData | null,
    shaderManager?: ShaderManager | null,
  ): void {
    const entry = this.sprites.get(entity);
    if (!entry) return;

    // Trigger shader loading if not already loaded
    if (
      materialData !== null &&
      materialData.enabled &&
      materialData.shader !== null &&
      !materialData.shader.isLoaded &&
      !materialData.shader.isLoading
    ) {
      // Start loading the shader asset asynchronously
      materialData.shader.load().catch((error) => {
        console.error(`[SpriteRenderManager] Failed to load shader: ${error}`);
      });
    }

    // Determine if we should use custom shader
    const shouldUseCustomShader =
      materialData !== null &&
      materialData.enabled &&
      materialData.shader !== null &&
      materialData.shader.isLoaded;

    const currentShaderGuid = shouldUseCustomShader ? materialData!.shader!.guid : null;
    const shaderChanged = currentShaderGuid !== entry.customShader.shaderGuid;
    const enabledChanged = shouldUseCustomShader !== entry.customShader.enabled;

    // Handle shader switching
    if (shaderChanged || enabledChanged) {
      if (shouldUseCustomShader && materialData!.shader!.data) {
        // Switch to custom shader material
        const shaderAsset = materialData!.shader!.data as ShaderAsset;
        this.switchToCustomShader(entity, spriteData, shaderAsset, materialData!, shaderManager);
      } else {
        // Switch back to standard material
        this.switchToStandardMaterial(entity, spriteData);
      }

      entry.customShader.shaderGuid = currentShaderGuid;
      entry.customShader.enabled = shouldUseCustomShader;
    }

    // Update custom shader uniforms if using custom shader
    if (shouldUseCustomShader && entry.material instanceof THREE.ShaderMaterial) {
      this.updateShaderUniforms(entry, spriteData, materialData!);
    }
  }

  /**
   * Switch sprite to use a custom shader material
   */
  private switchToCustomShader(
    entity: Entity,
    spriteData: Sprite2DData,
    shaderAsset: ShaderAsset,
    materialData: Sprite2DMaterialData,
    shaderManager?: ShaderManager | null,
  ): void {
    const entry = this.sprites.get(entity);
    if (!entry) return;

    // Dispose old material
    entry.material.dispose();

    // Build uniform overrides from component data
    const uniformOverrides: Record<string, unknown> = {};

    // Auto-generate textures for uniforms with hint_default_texture
    for (const uniform of shaderAsset.uniforms) {
      if (uniform.noiseParams && uniform.type === 'sampler2D') {
        // Check if user has custom noise params in materialData.uniforms
        const userParams = materialData.uniforms[uniform.name];
        const noiseParams = this.isNoiseTextureParams(userParams)
          ? userParams
          : uniform.noiseParams;

        // Generate noise texture based on params (cached by DefaultTextureGenerator)
        const generatedTexture = DefaultTextureGenerator.generate(noiseParams);
        uniformOverrides[uniform.name] = generatedTexture;
      }
    }

    // Add texture if available
    // Note: TEXTURE is a #define alias to 'map' in the transpiled GLSL
    if (entry.texture) {
      uniformOverrides['map'] = entry.texture;

      const image = entry.texture.image as { width?: number; height?: number } | null;
      if (image) {
        uniformOverrides['vsl_textureSize'] = new THREE.Vector2(
          image.width ?? 1,
          image.height ?? 1,
        );
      }
    }

    // Add color
    uniformOverrides['COLOR'] = new THREE.Vector4(
      spriteData.color.r,
      spriteData.color.g,
      spriteData.color.b,
      spriteData.color.a,
    );
    uniformOverrides['vsl_color'] = uniformOverrides['COLOR'];

    // Add sprite sheet uniforms
    if (spriteData.tileIndex !== null && spriteData.tileSize && spriteData.tilesetSize) {
      uniformOverrides['tileIndex'] = spriteData.tileIndex;
      uniformOverrides['tileSize'] = new THREE.Vector2(spriteData.tileSize.x, spriteData.tileSize.y);
      uniformOverrides['tilesetSize'] = new THREE.Vector2(spriteData.tilesetSize.x, spriteData.tilesetSize.y);
    }

    // Add custom uniforms from component
    for (const [name, value] of Object.entries(materialData.uniforms)) {
      uniformOverrides[name] = this.convertUniformValue(value);
    }

    // Create new shader material
    const newMaterial = shaderAsset.createMaterial(uniformOverrides);

    // Apply standard sprite material settings
    newMaterial.transparent = true;
    newMaterial.depthTest = false;
    newMaterial.depthWrite = false;
    newMaterial.side = THREE.DoubleSide;

    // Track material for TIME updates if shader manager available
    if (shaderManager) {
      shaderManager.trackMaterial(newMaterial);
    }

    // Set up onBeforeRender for MESH_SCREEN_BOUNDS and MESH_WORLD_SCALE if shader uses them
    const usesMeshScreenBounds = !!newMaterial.uniforms['vsl_meshScreenBounds'];
    const usesMeshWorldScale = !!newMaterial.uniforms['vsl_meshWorldScale'];

    if (usesMeshScreenBounds || usesMeshWorldScale) {
      // Initialize uniforms with default values
      if (usesMeshScreenBounds) {
        newMaterial.uniforms['vsl_meshScreenBounds']!.value = new THREE.Vector4(0, 0, 1, 1);
      }
      if (usesMeshWorldScale) {
        newMaterial.uniforms['vsl_meshWorldScale']!.value = new THREE.Vector2(1, 1);
      }

      // Store mesh reference for the callback
      const mesh = entry.mesh;

      // Corners of a 1x1 quad (PlaneGeometry centered at origin)
      const corners = [
        new THREE.Vector3(-0.5, -0.5, 0),  // bottom-left
        new THREE.Vector3(0.5, -0.5, 0),   // bottom-right
        new THREE.Vector3(-0.5, 0.5, 0),   // top-left
        new THREE.Vector3(0.5, 0.5, 0),    // top-right
      ];
      const tempVec3 = new THREE.Vector3();

      // Set up onBeforeRender to calculate screen-space bounds and world scale each frame
      mesh.onBeforeRender = (_renderer: THREE.WebGLRenderer, _scene: THREE.Scene, camera: THREE.Camera) => {
        const currentMaterial = mesh.material as THREE.ShaderMaterial;

        // Update MESH_WORLD_SCALE - the actual world-space size of the mesh
        // For sprites, mesh.scale represents the rendered size in world units
        const worldScaleUniform = currentMaterial.uniforms?.['vsl_meshWorldScale'];
        if (worldScaleUniform) {
          // Get the absolute world scale (accounting for negative scale from flipX/flipY)
          (worldScaleUniform.value as THREE.Vector2).set(
            Math.abs(mesh.scale.x),
            Math.abs(mesh.scale.y),
          );
        }

        // Update MESH_SCREEN_BOUNDS
        const boundsUniform = currentMaterial.uniforms?.['vsl_meshScreenBounds'];
        if (boundsUniform) {
          // Calculate screen-space bounds by projecting all 4 corners
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

          for (const corner of corners) {
            // Transform corner from local to world space
            tempVec3.copy(corner);
            mesh.localToWorld(tempVec3);

            // Project to NDC (-1 to 1)
            tempVec3.project(camera);

            // Convert to screen UV (0-1 range)
            const screenX = (tempVec3.x + 1) * 0.5;
            const screenY = (tempVec3.y + 1) * 0.5;

            minX = Math.min(minX, screenX);
            minY = Math.min(minY, screenY);
            maxX = Math.max(maxX, screenX);
            maxY = Math.max(maxY, screenY);
          }

          // Update the uniform (minX, minY, maxX, maxY)
          (boundsUniform.value as THREE.Vector4).set(minX, minY, maxX, maxY);
        }
      };
    }

    // Update mesh and entry
    entry.mesh.material = newMaterial;
    entry.material = newMaterial;
    entry.customShader.lastUniforms = { ...materialData.uniforms };
  }

  /**
   * Switch sprite back to standard material
   */
  private switchToStandardMaterial(entity: Entity, spriteData: Sprite2DData): void {
    const entry = this.sprites.get(entity);
    if (!entry) return;

    // Dispose old material
    entry.material.dispose();

    const isLit = spriteData.isLit ?? false;

    // Create new standard material
    let newMaterial: StandardSpriteMaterial;
    if (isLit) {
      newMaterial = new SpriteMeshLambertMaterial({
        color: new THREE.Color(spriteData.color.r, spriteData.color.g, spriteData.color.b),
        transparent: true,
        opacity: spriteData.color.a,
        depthTest: false,
        depthWrite: false,
        map: entry.texture,
      });
    } else {
      newMaterial = new SpriteMeshBasicMaterial({
        color: new THREE.Color(spriteData.color.r, spriteData.color.g, spriteData.color.b),
        transparent: true,
        opacity: spriteData.color.a,
        depthTest: false,
        depthWrite: false,
        map: entry.texture,
      });
    }

    // Reapply UV mapping
    if (spriteData.spriteRect && entry.texture) {
      const image = entry.texture.image as { width?: number; height?: number } | null;
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

    // Update mesh and entry
    entry.mesh.material = newMaterial;
    entry.material = newMaterial;
    entry.customShader.lastUniforms = {};
  }

  /**
   * Update shader uniforms from component data
   */
  private updateShaderUniforms(
    entry: SpriteEntry,
    spriteData: Sprite2DData,
    materialData: Sprite2DMaterialData,
  ): void {
    const material = entry.material as THREE.ShaderMaterial;

    // Update color
    const colorUniform = material.uniforms['COLOR'] || material.uniforms['vsl_color'];
    if (colorUniform) {
      (colorUniform.value as THREE.Vector4).set(
        spriteData.color.r,
        spriteData.color.g,
        spriteData.color.b,
        spriteData.color.a,
      );
    }

    // Update texture if changed (map is the actual uniform name)
    if (entry.texture && material.uniforms['map']) {
      material.uniforms['map'].value = entry.texture;
    }

    // Update custom uniforms
    for (const [name, value] of Object.entries(materialData.uniforms)) {
      if (material.uniforms[name]) {
        const convertedValue = this.convertUniformValue(value);
        material.uniforms[name].value = convertedValue;
      }
    }
  }

  /**
   * Convert component uniform value to THREE.js type
   */
  private convertUniformValue(value: UniformValue): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    // Check for NoiseTextureParams - generate texture from params
    if (this.isNoiseTextureParams(value)) {
      return DefaultTextureGenerator.generate(value);
    }

    // Check for RuntimeAsset (texture reference)
    if (typeof value === 'object' && 'guid' in value && 'isLoaded' in value) {
      // RuntimeAsset - return loaded texture or null
      return value.isLoaded ? value.data : null;
    }

    // Type check using plain object property checks to avoid TypeScript narrowing issues
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;

      // Check for color types first (has 'r' property)
      if ('r' in obj && 'g' in obj && 'b' in obj) {
        const r = obj['r'] as number;
        const g = obj['g'] as number;
        const b = obj['b'] as number;
        if ('a' in obj) {
          // Color4 (as Vector4)
          const a = obj['a'] as number;
          return new THREE.Vector4(r, g, b, a);
        }
        // Color3
        return new THREE.Color(r, g, b);
      }

      // Check for vector types (has 'x' property)
      if ('x' in obj && 'y' in obj) {
        const x = obj['x'] as number;
        const y = obj['y'] as number;
        if ('z' in obj) {
          const z = obj['z'] as number;
          if ('w' in obj) {
            // Vector4
            const w = obj['w'] as number;
            return new THREE.Vector4(x, y, z, w);
          }
          // Vector3
          return new THREE.Vector3(x, y, z);
        }
        // Vector2
        return new THREE.Vector2(x, y);
      }
    }

    return value;
  }

  // Type guards for uniform values
  private isVec2(v: unknown): v is { x: number; y: number } {
    return typeof v === 'object' && v !== null && 'x' in v && 'y' in v && !('z' in v) && !('r' in v);
  }

  private isVec3(v: unknown): v is { x: number; y: number; z: number } {
    return typeof v === 'object' && v !== null && 'x' in v && 'y' in v && 'z' in v && !('w' in v);
  }

  private isVec4(v: unknown): v is { x: number; y: number; z: number; w: number } {
    return typeof v === 'object' && v !== null && 'x' in v && 'y' in v && 'z' in v && 'w' in v;
  }

  private isColor3(v: unknown): v is { r: number; g: number; b: number } {
    return typeof v === 'object' && v !== null && 'r' in v && 'g' in v && 'b' in v && !('a' in v);
  }

  private isColor4(v: unknown): v is { r: number; g: number; b: number; a: number } {
    return typeof v === 'object' && v !== null && 'r' in v && 'g' in v && 'b' in v && 'a' in v;
  }

  private isNoiseTextureParams(v: unknown): v is NoiseTextureParams {
    return (
      v !== null &&
      typeof v === 'object' &&
      'type' in v &&
      (v.type === 'simplex' || v.type === 'perlin' || v.type === 'white' || v.type === 'fbm')
    );
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
 * Custom shaders can be applied via the Sprite2DMaterial component.
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
  const shaderManager = commands.tryGetResource(ShaderManager);

  // 1. Create sprites for new Sprite2D entities (have Sprite2D + Transform3D but no RenderObject)
  commands
    .query()
    .all(Transform3D, Sprite2D)
    .none(RenderObject)
    .each((entity, transform, sprite) => {
      const handle = spriteManager.createSprite(entity, sprite);
      commands.entity(entity).addComponent(RenderObject, { handle });
    });

  // 2. Update existing sprites (without custom material)
  commands
    .query()
    .all(Transform3D, Sprite2D, RenderObject)
    .none(Sprite2DMaterial)
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
      // Ensure any previous custom shader is disabled
      spriteManager.updateCustomShader(entity, sprite, null, shaderManager);
    });

  // 3. Update existing sprites with custom material
  commands
    .query()
    .all(Transform3D, Sprite2D, RenderObject, Sprite2DMaterial)
    .each((entity, transform, sprite, _renderObj, spriteMaterial) => {
      spriteManager.updateSprite(
        entity,
        sprite,
        {
          position: { x: transform.position.x, y: transform.position.y, z: transform.position.z },
          rotation: { x: transform.rotation.x, y: transform.rotation.y, z: transform.rotation.z },
          scale: { x: transform.scale.x, y: transform.scale.y },
        },
      );
      // Update custom shader material
      spriteManager.updateCustomShader(entity, sprite, spriteMaterial, shaderManager);
    });

  // 4. Remove sprites for entities that lost their Sprite2D component
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

  // 5. Clean up sprites for entities that were destroyed
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

