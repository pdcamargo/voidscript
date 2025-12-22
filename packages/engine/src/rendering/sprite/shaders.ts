import * as THREE from 'three';
import type { ISpriteUniforms, ISpriteTilingOptions } from './SpriteMaterial.js';

/**
 * UV result type for sprite tiling/rect calculations
 */
export interface SpriteUVResult {
  offset: { x: number; y: number };
  repeat: { x: number; y: number };
}

/**
 * Calculate tile UVs for a sprite texture.
 *
 * @param tile - Tile index (0-based, left-to-right, top-to-bottom)
 * @param tileSize - Size of each tile in pixels
 * @param tilesetSize - Total size of the tileset texture in pixels
 * @returns UV coordinates for the tile
 */
export function calculateTileUVs(
  tile: number,
  tileSize: { x: number; y: number },
  tilesetSize: { x: number; y: number }
): SpriteUVResult {
  const tilesPerRow = Math.floor(tilesetSize.x / tileSize.x);
  const tilesPerColumn = Math.floor(tilesetSize.y / tileSize.y);
  const tileX = tile % tilesPerRow;
  const tileY = Math.floor(tile / tilesPerRow);

  const offsetX = (tileX * tileSize.x) / tilesetSize.x;
  // Flip Y so tileY=0 samples from top of texture (UV Y=1 region)
  // UV coords: Y=0 is bottom, Y=1 is top
  // Tile coords: tileY=0 should be top row, so we invert it
  const offsetY = ((tilesPerColumn - 1 - tileY) * tileSize.y) / tilesetSize.y;

  const repeatX = tileSize.x / tilesetSize.x;
  const repeatY = tileSize.y / tilesetSize.y;

  return {
    offset: { x: offsetX, y: offsetY },
    repeat: { x: repeatX, y: repeatY },
  };
}

/**
 * Calculate UVs for a sprite defined by pixel rect coordinates.
 *
 * @param rect - Pixel rectangle in the texture (x, y from top-left, width, height in pixels)
 * @param textureSize - Total size of the texture in pixels
 * @returns UV coordinates for the rect region
 */
export function calculateRectUVs(
  rect: { x: number; y: number; width: number; height: number },
  textureSize: { x: number; y: number }
): SpriteUVResult {
  // Convert pixel coords to UV coords
  // Note: Y is flipped (UV 0 = bottom, pixel 0 = top)
  const offsetX = rect.x / textureSize.x;
  const offsetY = (textureSize.y - rect.y - rect.height) / textureSize.y;

  const repeatX = rect.width / textureSize.x;
  const repeatY = rect.height / textureSize.y;

  return {
    offset: { x: offsetX, y: offsetY },
    repeat: { x: repeatX, y: repeatY },
  };
}

/**
 * Sprite shader artifacts for single sprite with optional tiling
 */
export const spriteShader = {
  /**
   * Uniforms for sprite tiling
   */
  uniforms(): ISpriteUniforms {
    return {
      tileOffset: { value: new THREE.Vector2(0, 0) },
      tileRepeat: { value: new THREE.Vector2(1, 1) },
    };
  },

  /**
   * Fragment shader code for sprite tiling
   */
  frag(): string {
    return `
      #ifdef USE_MAP
        // Sprite tiling
        vec2 spriteUV = vMapUv * tileRepeat + tileOffset;
        vec4 sampledDiffuseColor = texture2D(map, spriteUV);
        diffuseColor *= sampledDiffuseColor;
      #endif
    `;
  },

  /**
   * Fragment shader replacement target
   */
  fragReplace(): string {
    return '#include <map_fragment>';
  },
};

/**
 * Tilemap shader artifacts for rendering tile arrays
 */
export const mapShader = {
  /**
   * Uniform declarations for tilemap rendering
   */
  uniforms(): string {
    return `
      uniform sampler2D tilesTexture;
      uniform vec2 tilesTextureSize;
      uniform vec2 tileSizePixels;
      uniform vec2 tilesetSizePixels;
      uniform float tileSpacingPixels;
      uniform vec2 tileSize;
      uniform vec2 tileCount;
      uniform vec2 tileFactor;
      uniform vec2 tileRepeat;
      uniform vec2 tileSpacing;
    `;
  },

  /**
   * Fragment shader code for tilemap rendering
   */
  frag(): string {
    return `
      #ifdef USE_MAP
        // Calculate which tile we're in
        vec2 tileCoord = floor(vMapUv * tileRepeat);

        // Flip map Y: Tiled uses Y=0 at top, but PlaneGeometry UV has Y=0 at bottom
        // This ensures tile row 0 (Tiled's top) renders at top of geometry
        tileCoord.y = tileRepeat.y - 1.0 - tileCoord.y;

        float tileIndex = tileCoord.y * tileRepeat.x + tileCoord.x;

        // Sample tile ID from texture
        // Convert 1D index to 2D texture coordinates
        float texX = mod(tileIndex, tilesTextureSize.x);
        float texY = floor(tileIndex / tilesTextureSize.x);
        vec2 tileTexUV = (vec2(texX, texY) + 0.5) / tilesTextureSize;
        float tileId = texture2D(tilesTexture, tileTexUV).r;

        // Handle empty tiles (tileId == 0 means no tile)
        if (tileId < 0.5) {
          // Empty tile - make it fully transparent
          diffuseColor.a = 0.0;
        } else {
          // Calculate tile position in tileset (in tile coordinates)
          float tileX = mod(tileId, tileCount.x);
          float tileY = floor(tileId / tileCount.x);

          // Calculate UV within the tile (0-1 range within this specific tile)
          vec2 localUV = fract(vMapUv * tileRepeat);

          // Flip localUV.y: screen bottom should sample source bottom, screen top should sample source top
          localUV.y = 1.0 - localUV.y;

          // Calculate tile position in tileset (in pixels, measured from top of image)
          vec2 tileStartPixel = vec2(tileX, tileY) * (tileSizePixels + vec2(tileSpacingPixels));

          // Half-pixel inset to prevent texture bleeding at tile edges
          vec2 inset = vec2(0.5);
          vec2 pixelWithinTile = inset + localUV * (tileSizePixels - 2.0 * inset);

          // Final pixel position in tileset (from top-left of image)
          vec2 pixelPos = tileStartPixel + pixelWithinTile;

          // Convert to UV coordinates
          // X: straightforward pixel-to-UV
          // Y: flip because Three.js flipY=true means UV y=1 is source top, y=0 is source bottom
          vec2 tileUV = vec2(
            pixelPos.x / tilesetSizePixels.x,
            1.0 - pixelPos.y / tilesetSizePixels.y
          );

          // Sample from tileset
          vec4 sampledDiffuseColor = texture2D(map, tileUV);
          diffuseColor *= sampledDiffuseColor;
        }
      #endif
    `;
  },

  /**
   * Fragment shader replacement target
   */
  fragReplace(): string {
    return '#include <map_fragment>';
  },
};
