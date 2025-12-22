import * as THREE from 'three';
import { calculateTileUVs, calculateRectUVs, spriteShader } from './shaders.js';

// THREE.js shader types
type Shader = {
  uniforms: { [uniform: string]: THREE.IUniform };
  vertexShader: string;
  fragmentShader: string;
};

/**
 * Options for SpriteMaterial.tile()
 */
export interface ISpriteTilingOptions {
  /**
   * Tile index (0-based, left-to-right, top-to-bottom)
   */
  tile: number;

  /**
   * Size of each tile in pixels
   */
  tileSize: { x: number; y: number };

  /**
   * Total size of the tileset texture in pixels
   */
  tilesetSize: { x: number; y: number };
}

/**
 * Options for SpriteMaterial.rect()
 */
export interface ISpriteRectOptions {
  /**
   * Pixel rectangle in the texture (x, y from top-left corner)
   */
  rect: { x: number; y: number; width: number; height: number };

  /**
   * Total size of the texture in pixels
   */
  textureSize: { x: number; y: number };
}

/**
 * Uniforms for SpriteMaterial
 */
export interface ISpriteUniforms {
  [key: string]: THREE.IUniform<unknown>;
  tileOffset: THREE.IUniform<THREE.Vector2>;
  tileRepeat: THREE.IUniform<THREE.Vector2>;
}

/**
 * Options for TilemapMaterial.tile()
 */
export interface ITilemapTilingOptions<TVec extends THREE.Vector2Like = THREE.Vector2Like> {
  /**
   * An array of indices for tiles from the tileset to be
   * displayed on the tilemap in order:
   *
   * ```
   * [
   *   0, 1, 5, 2, 5, 3, 1,
   *   0, 1, 5, 2, 5, 3, 1,
   *   0, 1, 5, 2, 5, 3, 1,
   *   0, 1, 5, 2, 5, 3, 1,
   * ]
   * ```
   */
  tiles?: number[];

  /**
   * Size of the tiles in the tileset in px:
   * `{ x: 16, y: 16 }`
   */
  tileSize?: TVec;

  /**
   * Size of the tileset in px:
   * `{ x: 128, y: 128 }`
   */
  tilesetSize?: TVec;

  /**
   * Number of tile columns in the tileset:
   * `{ x: 8, y: 8 }`
   * If not provided, will be calculated from tilesetSize / tileSize
   */
  tilesetGridSize?: TVec;

  /**
   * Describes the amount of rows/columns in the tilemap:
   * `{ x: 10, y: 5 }`
   */
  repeat?: TVec;

  /**
   * Spacing between tiles in the tileset in px:
   * `spacing: 2`
   *
   * Default: `0`
   */
  spacing?: number;
}

/**
 * Uniforms for TilemapMaterial
 */
export interface ITilemapUniforms {
  /**
   * Texture containing tile indices (stored as DataTexture internally)
   */
  tilesTexture?: THREE.Uniform<THREE.DataTexture | null>;

  /**
   * Size of the tiles texture (width, height in pixels)
   */
  tilesTextureSize?: THREE.Uniform<THREE.Vector2>;

  /**
   * Size of the tile in pixels:
   * `{ x: 32, y: 32 }`
   */
  tileSizePixels?: THREE.Uniform<THREE.Vector2>;

  /**
   * Size of the tileset texture in pixels:
   * `{ x: 4956, y: 496 }`
   */
  tilesetSizePixels?: THREE.Uniform<THREE.Vector2>;

  /**
   * Size of the tile as UVs:
   * `{ x: 0.1, y: 0.1 }`
   */
  tileSize?: THREE.Uniform<THREE.Vector2>;

  /**
   * Number of columns/rows in the tileset:
   * `{ x: 5, y: 5 }`
   */
  tileCount?: THREE.Uniform<THREE.Vector2>;

  /**
   * Factor of tileset dimensions vs UVs
   * `{ x: 2, y: 1 }`
   */
  tileFactor?: THREE.Uniform<THREE.Vector2>;

  /**
   * Number of columns/rows in the tilemap:
   * `{ x: 10, y: 5 }`
   */
  tileRepeat?: THREE.Uniform<THREE.Vector2>;

  /**
   * Spacing between tiles in pixels:
   * `2`
   */
  tileSpacingPixels?: THREE.Uniform<number>;

  /**
   * Spacing between tiles in UVs:
   * `{ x: 0.01, y: 0.01 }`
   */
  tileSpacing?: THREE.Uniform<THREE.Vector2>;

  [key: string]: THREE.IUniform | undefined;
}

/**
 * Abstract base class for sprite materials with tiling support.
 *
 * Extends THREE.js materials to support sprite sheet tiling by injecting
 * shader fragments via onBeforeCompile.
 *
 * @template TMaterial - The THREE.js material type to extend
 * @template TParameters - The parameter type for the material constructor
 */
export abstract class SpriteMaterial<
  TMaterial extends THREE.Material = THREE.Material,
  TParameters = any
> extends THREE.Material {
  /**
   * Custom uniforms for sprite tiling
   */
  uniforms: ISpriteUniforms;

  /**
   * Extend a THREE.js material class with sprite tiling support.
   *
   * @param materialClass - The THREE.js material class to extend
   * @returns Extended material class with tiling support
   *
   * @example
   * ```typescript
   * export class SpriteMeshBasicMaterial extends SpriteMaterial.extendClass<
   *   typeof THREE.MeshBasicMaterial,
   *   THREE.MeshBasicMaterialParameters
   * >(THREE.MeshBasicMaterial) {}
   * ```
   */
  static extendClass<TMaterialClass extends new (...args: any[]) => THREE.Material, TParams>(
    materialClass: TMaterialClass
  ): new (parameters?: TParams) => SpriteMaterial<InstanceType<TMaterialClass>, TParams> & InstanceType<TMaterialClass> {
    return class extends (materialClass as any) {
      uniforms: ISpriteUniforms;

      constructor(parameters?: TParams) {
        super(parameters);

        // Initialize sprite uniforms
        this.uniforms = spriteShader.uniforms();

        // Hook into shader compilation
        (this as any).onBeforeCompile = (shader: Shader) => {
          // Merge custom uniforms
          shader.uniforms = {
            ...shader.uniforms,
            ...this.uniforms,
          };

          // Inject shader fragments
          this.injectShaderFragments(shader);
        };

        // Ensure shader recompilation when material changes
        (this as any).needsUpdate = true;
      }

      /**
       * Set tile coordinates for sprite sheet rendering.
       *
       * @param options - Tiling options
       *
       * @example
       * ```typescript
       * material.tile({
       *   tile: 3,
       *   tileSize: { x: 16, y: 16 },
       *   tilesetSize: { x: 128, y: 128 },
       * });
       * ```
       */
      tile(options: ISpriteTilingOptions): void {
        const { offset, repeat } = calculateTileUVs(
          options.tile,
          options.tileSize,
          options.tilesetSize
        );

        this.uniforms.tileOffset.value.set(offset.x, offset.y);
        this.uniforms.tileRepeat.value.set(repeat.x, repeat.y);
      }

      /**
       * Set rect coordinates for arbitrary sprite region rendering.
       *
       * @param options - Rect options
       *
       * @example
       * ```typescript
       * material.rect({
       *   rect: { x: 128, y: 64, width: 32, height: 48 },
       *   textureSize: { x: 512, y: 512 },
       * });
       * ```
       */
      rect(options: ISpriteRectOptions): void {
        const { offset, repeat } = calculateRectUVs(
          options.rect,
          options.textureSize
        );

        this.uniforms.tileOffset.value.set(offset.x, offset.y);
        this.uniforms.tileRepeat.value.set(repeat.x, repeat.y);
      }

      /**
       * Inject shader fragments for sprite tiling.
       * Override this method to customize shader injection.
       *
       * @param shader - The shader being compiled
       */
      protected injectShaderFragments(shader: Shader): void {
        // Add only uniforms to fragment shader before main()
        // Note: vMapUv is already declared by THREE.js when USE_MAP is defined
        const uniformDecl = `uniform vec2 tileOffset;
uniform vec2 tileRepeat;
`;
        shader.fragmentShader = shader.fragmentShader.replace(
          'void main() {',
          uniformDecl + 'void main() {'
        );

        // Replace map_fragment with sprite tiling code
        // Uses vMapUv which is already set by THREE.js's map_vertex include
        shader.fragmentShader = shader.fragmentShader.replace(
          spriteShader.fragReplace(),
          spriteShader.frag()
        );
      }

      /**
       * Generate a cache key for shader compilation.
       * This ensures shaders are recompiled when material properties change.
       */
      customProgramCacheKey(): string {
        return 'sprite';
      }
    } as any;
  }

  /**
   * Extend an existing material instance with sprite tiling support.
   *
   * @param material - The material instance to extend
   * @returns Extended material with tiling support
   *
   * @example
   * ```typescript
   * const baseMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
   * const spriteMaterial = SpriteMaterial.extendMaterial(baseMaterial);
   * ```
   */
  static extendMaterial<TMaterial extends THREE.Material>(
    material: TMaterial
  ): TMaterial & { tile(options: ISpriteTilingOptions): void; rect(options: ISpriteRectOptions): void; uniforms: ISpriteUniforms } {
    const extended = material as any;

    // Initialize sprite uniforms
    extended.uniforms = spriteShader.uniforms();

    // Add tile method
    extended.tile = function(options: ISpriteTilingOptions) {
      const { offset, repeat } = calculateTileUVs(
        options.tile,
        options.tileSize,
        options.tilesetSize
      );

      this.uniforms.tileOffset.value.set(offset.x, offset.y);
      this.uniforms.tileRepeat.value.set(repeat.x, repeat.y);
    };

    // Add rect method
    extended.rect = function(options: ISpriteRectOptions) {
      const { offset, repeat } = calculateRectUVs(
        options.rect,
        options.textureSize
      );

      this.uniforms.tileOffset.value.set(offset.x, offset.y);
      this.uniforms.tileRepeat.value.set(repeat.x, repeat.y);
    };

    // Hook into shader compilation
    const originalOnBeforeCompile = (material as any).onBeforeCompile;
    (extended as any).onBeforeCompile = function(shader: Shader) {
      // Merge custom uniforms
      shader.uniforms = {
        ...shader.uniforms,
        ...this.uniforms,
      };

      // Inject shader fragments
      shader.fragmentShader = shader.fragmentShader.replace(
        spriteShader.fragReplace(),
        spriteShader.frag()
      );

      // Call original onBeforeCompile if it exists
      if (originalOnBeforeCompile) {
        originalOnBeforeCompile.call(this, shader);
      }
    };

    // Override cache key
    (extended as any).customProgramCacheKey = function() {
      return 'sprite';
    };

    // Ensure shader recompilation
    (material as any).needsUpdate = true;

    return extended;
  }

  /**
   * Constructor (abstract - use extendClass or extendMaterial)
   */
  constructor(parameters?: TParameters) {
    super();
    throw new Error(
      'SpriteMaterial is abstract. Use SpriteMaterial.extendClass() or SpriteMaterial.extendMaterial()'
    );
  }

  /**
   * Set tile coordinates for sprite sheet rendering.
   */
  abstract tile(options: ISpriteTilingOptions): void;

  /**
   * Set rect coordinates for arbitrary sprite region rendering.
   */
  abstract rect(options: ISpriteRectOptions): void;

  /**
   * Inject shader fragments (implemented by subclasses)
   */
  protected abstract injectShaderFragments(shader: Shader): void;
}
