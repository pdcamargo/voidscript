/**
 * MaterialFactory - Factory functions for creating materials from shaders
 *
 * Provides specialized material creation functions for different use cases,
 * particularly sprite materials with tiling support.
 *
 * @example
 * ```typescript
 * import { MaterialFactory } from '@voidscript/engine';
 *
 * // Create a sprite material with custom shader
 * const material = MaterialFactory.createSpriteMaterial(shaderAsset, {
 *   texture: myTexture,
 *   color: new THREE.Color(1, 1, 1),
 *   tileIndex: 0,
 *   tileSize: new THREE.Vector2(32, 32),
 *   tilesetSize: new THREE.Vector2(256, 256),
 * });
 * ```
 */

import * as THREE from 'three';
import { ShaderAsset } from './shader-asset.js';

/**
 * Sprite material options
 */
export interface SpriteMaterialOptions {
  /** Sprite texture */
  texture?: THREE.Texture;

  /** Tint color (multiplied with texture) */
  color?: THREE.Color;

  /** Opacity (0-1) */
  opacity?: number;

  /** Tile index for sprite sheets */
  tileIndex?: number;

  /** Size of each tile in pixels */
  tileSize?: THREE.Vector2;

  /** Size of the tileset/texture in pixels */
  tilesetSize?: THREE.Vector2;

  /** UV offset (for manual UV control) */
  uvOffset?: THREE.Vector2;

  /** UV scale (for manual UV control) */
  uvScale?: THREE.Vector2;

  /** Additional custom uniforms */
  customUniforms?: Record<string, unknown>;

  /** Enable depth testing */
  depthTest?: boolean;

  /** Enable depth writing */
  depthWrite?: boolean;

  /** Render side (front, back, double) */
  side?: THREE.Side;

  /** Enable transparency */
  transparent?: boolean;
}

/**
 * MaterialFactory - Static factory for creating materials
 */
export class MaterialFactory {
  /**
   * Create a sprite material from a ShaderAsset
   *
   * Automatically sets up sprite-specific uniforms like TEXTURE, COLOR,
   * tileIndex, tileSize, and tilesetSize.
   *
   * @param shader - ShaderAsset to use
   * @param options - Sprite material options
   * @returns THREE.ShaderMaterial configured for sprites
   */
  static createSpriteMaterial(
    shader: ShaderAsset,
    options: SpriteMaterialOptions = {},
  ): THREE.ShaderMaterial {
    const {
      texture,
      color = new THREE.Color(1, 1, 1),
      opacity = 1.0,
      tileIndex = 0,
      tileSize = new THREE.Vector2(1, 1),
      tilesetSize = new THREE.Vector2(1, 1),
      uvOffset = new THREE.Vector2(0, 0),
      uvScale = new THREE.Vector2(1, 1),
      customUniforms = {},
      depthTest = false,
      depthWrite = false,
      side = THREE.DoubleSide,
      transparent = true,
    } = options;

    // Build uniforms object with sprite-specific values
    const uniforms: Record<string, unknown> = {
      ...customUniforms,
    };

    // Map texture to TEXTURE uniform (VSL built-in)
    if (texture) {
      uniforms['TEXTURE'] = texture;
      uniforms['vsl_texture'] = texture; // Internal name used by transpiler

      // Calculate texture size for TEXTURE_SIZE
      const img = texture.image as { width?: number; height?: number } | undefined;
      if (img) {
        uniforms['TEXTURE_SIZE'] = new THREE.Vector2(img.width || 1, img.height || 1);
        uniforms['vsl_texture_size'] = uniforms['TEXTURE_SIZE'];
      }
    }

    // Color uniform
    uniforms['COLOR'] = new THREE.Vector4(color.r, color.g, color.b, opacity);
    uniforms['vsl_color'] = uniforms['COLOR'];

    // Sprite sheet uniforms
    uniforms['tileIndex'] = tileIndex;
    uniforms['tileSize'] = tileSize;
    uniforms['tilesetSize'] = tilesetSize;
    uniforms['uvOffset'] = uvOffset;
    uniforms['uvScale'] = uvScale;

    // Create material
    const material = shader.createMaterial(uniforms);

    // Apply material settings
    material.depthTest = depthTest;
    material.depthWrite = depthWrite;
    material.side = side;
    material.transparent = transparent;

    return material;
  }

  /**
   * Update sprite material uniforms
   *
   * @param material - THREE.ShaderMaterial to update
   * @param options - Partial sprite options to update
   */
  static updateSpriteMaterial(
    material: THREE.ShaderMaterial,
    options: Partial<SpriteMaterialOptions>,
  ): void {
    if (options.texture !== undefined) {
      if (material.uniforms['TEXTURE']) {
        material.uniforms['TEXTURE'].value = options.texture;
      }
      if (material.uniforms['vsl_texture']) {
        material.uniforms['vsl_texture'].value = options.texture;
      }

      const img = options.texture?.image as { width?: number; height?: number } | undefined;
      if (img) {
        const size = new THREE.Vector2(img.width || 1, img.height || 1);
        if (material.uniforms['TEXTURE_SIZE']) {
          material.uniforms['TEXTURE_SIZE'].value = size;
        }
        if (material.uniforms['vsl_texture_size']) {
          material.uniforms['vsl_texture_size'].value = size;
        }
      }
    }

    if (options.color !== undefined || options.opacity !== undefined) {
      const existingColor = material.uniforms['COLOR']?.value as THREE.Vector4 | undefined;
      const color = options.color || existingColor;
      const opacity = options.opacity ?? (existingColor?.w ?? 1);

      if (options.color) {
        const newColor = new THREE.Vector4(
          options.color.r,
          options.color.g,
          options.color.b,
          opacity,
        );
        if (material.uniforms['COLOR']) {
          material.uniforms['COLOR'].value = newColor;
        }
        if (material.uniforms['vsl_color']) {
          material.uniforms['vsl_color'].value = newColor;
        }
      } else if (options.opacity !== undefined && color) {
        if (material.uniforms['COLOR']?.value) {
          (material.uniforms['COLOR'].value as THREE.Vector4).w = opacity;
        }
        if (material.uniforms['vsl_color']?.value) {
          (material.uniforms['vsl_color'].value as THREE.Vector4).w = opacity;
        }
      }
    }

    if (options.tileIndex !== undefined && material.uniforms['tileIndex']) {
      material.uniforms['tileIndex'].value = options.tileIndex;
    }

    if (options.tileSize !== undefined && material.uniforms['tileSize']) {
      material.uniforms['tileSize'].value = options.tileSize;
    }

    if (options.tilesetSize !== undefined && material.uniforms['tilesetSize']) {
      material.uniforms['tilesetSize'].value = options.tilesetSize;
    }

    if (options.uvOffset !== undefined && material.uniforms['uvOffset']) {
      material.uniforms['uvOffset'].value = options.uvOffset;
    }

    if (options.uvScale !== undefined && material.uniforms['uvScale']) {
      material.uniforms['uvScale'].value = options.uvScale;
    }

    // Update additional custom uniforms
    if (options.customUniforms) {
      for (const [name, value] of Object.entries(options.customUniforms)) {
        if (material.uniforms[name]) {
          material.uniforms[name].value = value;
        }
      }
    }
  }

  /**
   * Create a basic unlit material from shader
   *
   * @param shader - ShaderAsset to use
   * @param options - Basic material options
   * @returns THREE.ShaderMaterial
   */
  static createBasicMaterial(
    shader: ShaderAsset,
    options: {
      color?: THREE.Color;
      opacity?: number;
      texture?: THREE.Texture;
      customUniforms?: Record<string, unknown>;
      transparent?: boolean;
      side?: THREE.Side;
    } = {},
  ): THREE.ShaderMaterial {
    const {
      color = new THREE.Color(1, 1, 1),
      opacity = 1.0,
      texture,
      customUniforms = {},
      transparent = false,
      side = THREE.FrontSide,
    } = options;

    const uniforms: Record<string, unknown> = {
      ...customUniforms,
      COLOR: new THREE.Vector4(color.r, color.g, color.b, opacity),
    };

    if (texture) {
      uniforms['TEXTURE'] = texture;
    }

    const material = shader.createMaterial(uniforms);
    material.transparent = transparent;
    material.side = side;

    return material;
  }

  /**
   * Clone a shader material with new uniform values
   *
   * @param source - Source material to clone
   * @param uniformOverrides - Uniform values to override
   * @returns New THREE.ShaderMaterial
   */
  static cloneMaterial(
    source: THREE.ShaderMaterial,
    uniformOverrides: Record<string, unknown> = {},
  ): THREE.ShaderMaterial {
    const cloned = source.clone();

    // Clone uniform values
    for (const [key, uniform] of Object.entries(source.uniforms)) {
      if (uniformOverrides[key] !== undefined) {
        cloned.uniforms[key] = { value: uniformOverrides[key] };
      } else if (uniform.value !== undefined) {
        // Deep clone certain types
        if (uniform.value instanceof THREE.Vector2) {
          cloned.uniforms[key] = { value: uniform.value.clone() };
        } else if (uniform.value instanceof THREE.Vector3) {
          cloned.uniforms[key] = { value: uniform.value.clone() };
        } else if (uniform.value instanceof THREE.Vector4) {
          cloned.uniforms[key] = { value: uniform.value.clone() };
        } else if (uniform.value instanceof THREE.Color) {
          cloned.uniforms[key] = { value: uniform.value.clone() };
        } else if (uniform.value instanceof THREE.Matrix3) {
          cloned.uniforms[key] = { value: uniform.value.clone() };
        } else if (uniform.value instanceof THREE.Matrix4) {
          cloned.uniforms[key] = { value: uniform.value.clone() };
        } else {
          // Primitive values or textures (shared reference is fine)
          cloned.uniforms[key] = { value: uniform.value };
        }
      }
    }

    return cloned;
  }

  /**
   * Set a uniform value on a material, creating it if it doesn't exist
   *
   * @param material - Target material
   * @param name - Uniform name
   * @param value - Uniform value
   */
  static setUniform(
    material: THREE.ShaderMaterial,
    name: string,
    value: unknown,
  ): void {
    if (material.uniforms[name]) {
      material.uniforms[name].value = value;
    } else {
      material.uniforms[name] = { value };
    }
  }

  /**
   * Get a uniform value from a material
   *
   * @param material - Source material
   * @param name - Uniform name
   * @returns Uniform value or undefined
   */
  static getUniform<T = unknown>(
    material: THREE.ShaderMaterial,
    name: string,
  ): T | undefined {
    return material.uniforms[name]?.value as T | undefined;
  }
}
