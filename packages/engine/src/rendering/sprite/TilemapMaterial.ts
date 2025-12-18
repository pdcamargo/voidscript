import * as THREE from 'three';
import { mapShader } from './shaders.js';
import type { ITilemapTilingOptions, ITilemapUniforms } from './SpriteMaterial.js';

/**
 * Base material to render tilemaps:
 *
 * ```
 * const tilemap = new THREE.Mesh(
 *   new THREE.PlaneGeometry(10, 10),
 *   new TilemapMeshBasicMaterial({ map: myTileset }),
 * );
 * tilemap.material.tile({
 *   tiles: [1, 2, 3, 4, 5, 6, 7, 8, 9],
 *   tileSize: { x: 16, y: 16 },
 *   tilesetSize: { x: 96, y: 80 },
 *   repeat: { x: 3, y: 3 },
 * });
 * myScene.add(tilemap);
 * ```
 */
export abstract class TilemapMaterial extends THREE.Material {
  /**
   * The texture for the Tilemap.
   * https://threejs.org/docs/?q=basicmat#api/en/materials/MeshBasicMaterial.map
   */
  public map?: THREE.Texture | null;

  /**
   * Uniforms of the shader. May be set before shader
   * compilation.
   *
   * ```
   * const mat = new TilemapMaterial({ map: myTexture });
   * mat.uniforms = {
   *   myCustomUniform: { value: 10 },
   * }
   * mat.tile({
   *   // ...
   * });
   * ```
   */
  public uniforms?: ITilemapUniforms;

  /**
   * The tiling options set via `.tile()`. Manipulating them
   * directly takes no effect until `.tile()` is called again.
   */
  public tiling?: Required<ITilemapTilingOptions<THREE.Vector2>> & { tilesetGridSize: THREE.Vector2 };

  /**
   * Sets the tiling options:
   *
   * ```
   * const tilemap = new THREE.Mesh(
   *   new THREE.PlaneGeometry(10, 10),
   *   new TilemapMeshBasicMaterial({ map: myTileset }),
   * );
   * tilemap.material.tile({
   *   tiles: [1, 2, 3, 4, 5, 6, 7, 8, 9],
   *   tileSize: { x: 16, y: 16 },
   *   tilesetSize: { x: 96, y: 80 },
   *   repeat: { x: 3, y: 3 },
   * });
   * myScene.add(tilemap);
   * ```
   *
   * @param {ITilemapTilingOptions} options Tiling options to set.
   * @returns {void}
   */
  public tile(options: ITilemapTilingOptions): void {
    this.setTilingOptions(options);

    // Wait for onBeforeCompile in case options have been set
    // before the shader was compiled.
    if (!this.uniforms || !this.tiling) return;

    // Ensure tileset texture uses NEAREST filtering to prevent bleeding between tiles
    if (this.map) {
      this.map.minFilter = THREE.NearestFilter;
      this.map.magFilter = THREE.NearestFilter;
      this.map.needsUpdate = true;
    }

    // If onBeforeCompile was fired before tiling options were
    // set, then the uniforms will be empty, in which case
    // we re-calculate uniforms.
    if (!this.uniforms.tilesTexture) this.mergeUniforms();

    // Create DataTexture from tiles array to avoid uniform array size limits
    const tilesCount = this.tiling.tiles.length;
    // Calculate texture dimensions (try to make it roughly square)
    const texWidth = Math.ceil(Math.sqrt(tilesCount));
    const texHeight = Math.ceil(tilesCount / texWidth);

    // Create Float32Array with texture data
    const tilesData = new Float32Array(texWidth * texHeight);
    tilesData.set(this.tiling.tiles);

    // Create or update DataTexture
    if (!this.uniforms.tilesTexture?.value) {
      const dataTexture = new THREE.DataTexture(tilesData, texWidth, texHeight, THREE.RedFormat, THREE.FloatType);
      dataTexture.minFilter = THREE.NearestFilter;
      dataTexture.magFilter = THREE.NearestFilter;
      dataTexture.wrapS = THREE.ClampToEdgeWrapping;
      dataTexture.wrapT = THREE.ClampToEdgeWrapping;
      dataTexture.needsUpdate = true;
      this.uniforms.tilesTexture = new THREE.Uniform(dataTexture);
    } else {
      // Update existing texture
      this.uniforms.tilesTexture.value.image.data = tilesData;
      this.uniforms.tilesTexture.value.image.width = texWidth;
      this.uniforms.tilesTexture.value.image.height = texHeight;
      this.uniforms.tilesTexture.value.needsUpdate = true;
    }

    // Update texture size uniform
    if (!this.uniforms.tilesTextureSize) {
      this.uniforms.tilesTextureSize = new THREE.Uniform(new THREE.Vector2(texWidth, texHeight));
    } else {
      this.uniforms.tilesTextureSize.value.set(texWidth, texHeight);
    }

    const tileSizeUV = {
      x: this.tiling.tileSize.x / this.tiling.tilesetSize.x,
      y: this.tiling.tileSize.y / this.tiling.tilesetSize.y,
    };

    // Use provided grid size if available, otherwise calculate from dimensions
    const tileCount = {
      x: this.tiling.tilesetGridSize.x > 0
        ? this.tiling.tilesetGridSize.x
        : Math.floor(this.tiling.tilesetSize.x / this.tiling.tileSize.x),
      y: this.tiling.tilesetGridSize.y > 0
        ? this.tiling.tilesetGridSize.y
        : Math.floor(this.tiling.tilesetSize.y / this.tiling.tileSize.y),
    };
    const tileFactor = {
      x: 1 / Math.max(1, this.tiling.repeat.x),
      y: 1 / Math.max(1, this.tiling.repeat.y),
    };
    const tileRepeat = {
      x: Math.max(1, this.tiling.repeat.x),
      y: Math.max(1, this.tiling.repeat.y),
    };
    const tileSpacing = {
      x: this.tiling.spacing / this.tiling.tilesetSize.x,
      y: this.tiling.spacing / this.tiling.tilesetSize.y,
    };

    // Set pixel-based uniforms
    if (!this.uniforms.tileSizePixels) {
      this.uniforms.tileSizePixels = new THREE.Uniform(new THREE.Vector2());
    }
    this.uniforms.tileSizePixels.value.set(this.tiling.tileSize.x, this.tiling.tileSize.y);

    if (!this.uniforms.tilesetSizePixels) {
      this.uniforms.tilesetSizePixels = new THREE.Uniform(new THREE.Vector2());
    }
    this.uniforms.tilesetSizePixels.value.set(this.tiling.tilesetSize.x, this.tiling.tilesetSize.y);

    if (!this.uniforms.tileSpacingPixels) {
      this.uniforms.tileSpacingPixels = new THREE.Uniform(this.tiling.spacing);
    } else {
      this.uniforms.tileSpacingPixels.value = this.tiling.spacing;
    }

    // Set existing uniforms
    this.uniforms.tileSize?.value.set(tileSizeUV.x, tileSizeUV.y);
    this.uniforms.tileCount?.value.set(tileCount.x, tileCount.y);
    this.uniforms.tileFactor?.value.set(tileFactor.x, tileFactor.y);
    this.uniforms.tileRepeat?.value.set(tileRepeat.x, tileRepeat.y);
    this.uniforms.tileSpacing?.value.set(tileSpacing.x, tileSpacing.y);
  }

  /**
   * Overrides `THREE.Material.customProgramCacheKey()`.
   * https://threejs.org/docs/?q=Material#api/en/materials/Material.customProgramCacheKey
   *
   * Returns a custom shader cache key identifying the base
   * material and tiling type. When inheriting from this class
   * and overriding this method, ensure to adopt the original
   * key to prevent stale shaders across different configurations:
   *
   * ```
   * customProgramCacheKey() {
   *   const originalKey = super.customProgramCacheKey();
   *   return `${originalKey}-${myKey}`;
   * }
   * ```
   *
   * @returns {string}
   */
  public override customProgramCacheKey(): string {
    return `tilemap-${this.type}-${String(
      this.tiling?.tiles.length ?? 0
    )}`;
  }

  /**
   * Overrides `THREE.Material.onBeforeCompile()`.
   * https://threejs.org/docs/?q=Material#api/en/materials/Material.onBeforeCompile
   *
   * Injects tiling shader fragments into the material's original
   * shader program. When inheriting from this class and overriding
   * this method, ensure to call `super.onBeforeCompile()`
   * or `this.injectShaderFragments()` to ensure the tiling shader
   * artifacts are injected.
   *
   * ```
   * onBeforeCompile(shader) {
   *   // My shader manipulation logic here...
   *   this.injectShaderFragments(shader);
   * }
   * ```
   *
   * @param {THREE.WebGLProgramParametersWithUniforms} shader
   *   The shader provided by the renderer.
   * @returns {void}
   */
  public override onBeforeCompile(shader: THREE.WebGLProgramParametersWithUniforms): void {
    this.injectShaderFragments(shader);
  }

  /**
   * Injects tiling shader fragments into the material's original
   * shader program.
   *
   * @param {THREE.WebGLProgramParametersWithUniforms} shader
   *   The shader provided by the renderer.
   * @returns {void}
   */
  injectShaderFragments(shader: THREE.WebGLProgramParametersWithUniforms): void {
    this.mergeUniforms(shader);
    if (this.tiling) this.tile(this.tiling);

    shader.fragmentShader = `
      ${mapShader.uniforms()}
      ${shader.fragmentShader}
    `;
    shader.fragmentShader = shader.fragmentShader.replace(
      mapShader.fragReplace(),
      mapShader.frag()
    );
  }

  /**
   * Used internally to merge `ITilemapTilingOptions` from`.tile()`
   * with Required<ITilemapTilingOptions<THREE.Vector2>> on
   * `this.tiling`.
   *
   * @param {ITilemapTilingOptions} options Tiling options to set.
   * @returns {void}
   */
  public setTilingOptions(options: ITilemapTilingOptions): void {
    if (!this.tiling) {
      this.tiling = {
        tiles: [],
        tileSize: new THREE.Vector2(0, 0),
        tilesetSize: new THREE.Vector2(0, 0),
        tilesetGridSize: new THREE.Vector2(0, 0),
        repeat: new THREE.Vector2(0, 0),
        spacing: 0,
      };
    }
    if (typeof options.tiles !== 'undefined') this.tiling.tiles = Array.from(options.tiles);
    if (typeof options.tileSize !== 'undefined') this.tiling.tileSize.copy(options.tileSize);
    if (typeof options.tilesetSize !== 'undefined')
      this.tiling.tilesetSize.copy(options.tilesetSize);
    if (typeof options.tilesetGridSize !== 'undefined')
      this.tiling.tilesetGridSize.copy(options.tilesetGridSize);
    if (typeof options.repeat !== 'undefined') this.tiling.repeat.copy(options.repeat);
    if (typeof options.spacing !== 'undefined') this.tiling.spacing = options.spacing;
  }

  /**
   * Used internally to merge pre-existing uniforms after the
   * shader is (re-)compiled.
   *
   * @param {THREE.WebGLProgramParametersWithUniforms} shader
   *   The shader provided by the renderer.
   * @returns {void}
   */
  public mergeUniforms(shader?: THREE.WebGLProgramParametersWithUniforms): void {
    if (shader) {
      const existingUniforms = this.uniforms;
      this.uniforms = shader.uniforms;
      if (existingUniforms) {
        for (const key in existingUniforms) {
          if (!this.uniforms[key]) this.uniforms[key] = existingUniforms[key];
        }
      }
    }

    if (!this.uniforms) return;

    // Initialize tilesTexture and tilesTextureSize if not present
    if (!this.uniforms.tilesTexture) {
      // Will be created in tile() method when tiling data is provided
      this.uniforms.tilesTexture = new THREE.Uniform(null);
    }
    if (!this.uniforms.tilesTextureSize)
      this.uniforms.tilesTextureSize = new THREE.Uniform(new THREE.Vector2(0));
    if (!this.uniforms.tileSize)
      this.uniforms.tileSize = new THREE.Uniform(new THREE.Vector2(0));
    if (!this.uniforms.tileCount)
      this.uniforms.tileCount = new THREE.Uniform(new THREE.Vector2(0));
    if (!this.uniforms.tileFactor)
      this.uniforms.tileFactor = new THREE.Uniform(new THREE.Vector2(0));
    if (!this.uniforms.tileRepeat)
      this.uniforms.tileRepeat = new THREE.Uniform(new THREE.Vector2(1));
    if (!this.uniforms.tileSpacing)
      this.uniforms.tileSpacing = new THREE.Uniform(new THREE.Vector2(0));
  }

  /**
   * Static method to create mixins of `THREE.Material`-based
   * classes and `TilemapMaterial`. Used internally to generate
   * mixin classes. Generates a new class instead of extending
   * the original class. Hence do not use to create mixins
   * during runtime or you'll risk leaking memory.
   *
   * @param {T} ctor The class to extend.
   * @returns {new () => T & TilemapMaterial}
   */
  public static extendClass<
    TCtor extends new (args: TParam) => THREE.Material,
    TParam extends THREE.MaterialParameters,
  >(ctor: TCtor): new (args: TParam) => TCtor & TilemapMaterial {
    const newClass = class extends (ctor as new (args: TParam) => THREE.Material) {};
    for (const prop of Object.getOwnPropertyNames(TilemapMaterial.prototype)) {
      Object.defineProperty(
        newClass.prototype,
        prop,
        Object.getOwnPropertyDescriptor(TilemapMaterial.prototype, prop as keyof TilemapMaterial) ??
          Object.create(null)
      );
    }
    return newClass as unknown as new (args: TParam) => TCtor & TilemapMaterial;
  }

  /**
   * Static method to extend instanciated materials by
   * TilemapMaterial's prototype.
   *
   * @param {T} material The material to extend.
   * @returns {TilemapMaterial & T}
   */
  public static extendMaterial<T extends THREE.Material>(material: T): TilemapMaterial & T {
    for (const prop of Object.getOwnPropertyNames(TilemapMaterial.prototype)) {
      if (!(prop in material)) {
        Object.defineProperty(
          material,
          prop,
          Object.getOwnPropertyDescriptor(
            TilemapMaterial.prototype,
            prop as keyof TilemapMaterial
          ) ?? Object.create(null)
        );
      }
    }
    material.needsUpdate = true;
    return material as TilemapMaterial & T;
  }
}
