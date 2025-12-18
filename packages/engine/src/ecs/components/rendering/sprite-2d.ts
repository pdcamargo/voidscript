/**
 * Sprite2D Component
 *
 * Represents a 2D sprite rendered in world space.
 * Uses THREE.Mesh with custom sprite materials for efficient rendering.
 *
 * Supports:
 * - Solid color or texture rendering
 * - Sprite sheet tiling (for atlases)
 * - Pixel-perfect or scaled rendering
 * - Z-ordering via sorting layers
 * - Horizontal/vertical flipping
 * - Optional THREE.js lighting support
 */

import { component } from '../../component.js';
import { RuntimeAsset } from '../../runtime-asset.js';
import { AssetDatabase } from '../../asset-database.js';
import { isTextureMetadata, type TextureMetadata } from '../../asset-metadata.js';
import { ImGui } from '@mori2003/jsimgui';

export interface Sprite2DData {
  /**
   * Reference to the texture asset (PNG, JPG, etc.)
   * null means use solid color only
   */
  texture: RuntimeAsset | null;

  /**
   * Tint/base color (RGBA, 0-1 range)
   * Applied as a multiplier to the texture
   * @default { r: 1, g: 1, b: 1, a: 1 } (white/no tint)
   */
  color: { r: number; g: number; b: number; a: number };

  /**
   * Tile index for sprite sheet tiling (0-based, left-to-right, top-to-bottom)
   * null means use entire texture (no tiling)
   * @default null
   */
  tileIndex: number | null;

  /**
   * Size of each tile in pixels (required if tileIndex is set)
   * @default null
   */
  tileSize: { x: number; y: number } | null;

  /**
   * Total size of the tileset texture in pixels (required if tileIndex is set)
   * @default null
   */
  tilesetSize: { x: number; y: number } | null;

  /**
   * Pixels per unit for world-space sizing
   * Higher values = smaller sprite in world space
   * @default 100 (100 pixels = 1 world unit)
   */
  pixelsPerUnit: number;

  /**
   * Flip sprite horizontally
   * @default false
   */
  flipX: boolean;

  /**
   * Flip sprite vertically
   * @default false
   */
  flipY: boolean;

  /**
   * Sorting layer for Z-ordering (higher = rendered later/on top)
   * @default 0
   */
  sortingLayer: number;

  /**
   * Sorting order within the layer (higher = rendered later/on top)
   * @default 0
   */
  sortingOrder: number;

  /**
   * Anchor point (0-1 range, where 0,0 is bottom-left, 1,1 is top-right)
   * @default { x: 0.5, y: 0.5 } (center)
   */
  anchor: { x: number; y: number };

  /**
   * Whether the sprite is visible
   * @default true
   */
  visible: boolean;

  /**
   * Whether this sprite receives THREE.js lighting
   * When false: Uses SpriteMeshBasicMaterial (unlit, better performance)
   * When true: Uses SpriteMeshLambertMaterial (lit, responds to lights in scene)
   * @default false
   */
  isLit?: boolean;
}

export const Sprite2D = component<Sprite2DData>(
  'Sprite2D',
  {
    texture: {
      serializable: true,
      type: 'runtimeAsset',
      whenNullish: 'keep',
    },
    color: {
      serializable: true,
    },
    tileIndex: {
      serializable: true,
      whenNullish: 'keep',
      customEditor: ({ label, value, onChange, componentData }) => {
        // Check if texture has sprites defined
        const texture = componentData.texture;
        let hasSprites = false;
        let metadata: TextureMetadata | null = null;

        if (texture && texture.guid) {
          const meta = AssetDatabase.getMetadata(texture.guid);
          if (meta && isTextureMetadata(meta)) {
            metadata = meta;
            hasSprites = (metadata.sprites?.length ?? 0) > 0;
          }
        }

        // No texture selected
        if (!texture) {
          ImGui.Text(`${label}:`);
          ImGui.SameLine();
          ImGui.TextDisabled('(No texture)');
          return;
        }

        if (hasSprites && metadata) {
          // Show sprite picker button
          ImGui.Text(`${label}:`);
          ImGui.SameLine();

          // Display current sprite name if found
          const currentSprite = metadata.sprites?.find((s) => s.tileIndex === value);
          if (currentSprite) {
            ImGui.Text(currentSprite.name);
          } else if (value !== null) {
            ImGui.Text(`Custom (Index ${value})`);
          } else {
            ImGui.Text('None');
          }

          ImGui.SameLine();

          // Sprite picker popup
          const popupId = `SpritePicker##${texture.guid}`;

          if (ImGui.Button(`Pick Sprite##tileIndex`)) {
            ImGui.OpenPopup(popupId);
          }

          // Render sprite picker modal
          ImGui.SetNextWindowSize({ x: 600, y: 400 }, ImGui.Cond.FirstUseEver);
          if (ImGui.BeginPopupModal(popupId, null, ImGui.WindowFlags.None)) {
            ImGui.Text('Select a sprite:');
            ImGui.Separator();

            const sprites = metadata.sprites || [];
            const itemsPerRow = 4;
            const buttonSize = 128;

            ImGui.BeginChild('SpriteGrid', { x: 0, y: -40 }, ImGui.WindowFlags.None);

            for (let i = 0; i < sprites.length; i++) {
              const sprite = sprites[i];
              if (!sprite) continue;

              if (i > 0 && i % itemsPerRow !== 0) {
                ImGui.SameLine();
              }

              ImGui.BeginGroup();

              const isSelected = value === sprite.tileIndex;
              if (isSelected) {
                ImGui.PushStyleColorImVec4(ImGui.Col.Button, {
                  x: 0.2,
                  y: 0.5,
                  z: 0.8,
                  w: 1.0,
                });
              }

              if (ImGui.Button(`##sprite_${sprite.id}`, { x: buttonSize, y: buttonSize })) {
                // Update all sprite properties atomically
                onChange(sprite.tileIndex);
                componentData.tileSize = { x: sprite.tileWidth, y: sprite.tileHeight };

                // Update tilesetSize from texture if loaded, or metadata
                if (texture.isLoaded && texture.data?.image) {
                  const image = texture.data.image;
                  componentData.tilesetSize = {
                    x: image.width || image.videoWidth || sprite.tileWidth,
                    y: image.height || image.videoHeight || sprite.tileHeight,
                  };
                } else {
                  componentData.tilesetSize = {
                    x: metadata.width || sprite.tileWidth,
                    y: metadata.height || sprite.tileHeight,
                  };
                }

                ImGui.CloseCurrentPopup();
              }

              if (isSelected) {
                ImGui.PopStyleColor();
              }

              ImGui.PushTextWrapPos(ImGui.GetCursorPosX() + buttonSize);
              ImGui.TextWrapped(sprite.name);
              ImGui.PopTextWrapPos();

              ImGui.EndGroup();
            }

            ImGui.EndChild();

            ImGui.Separator();
            if (ImGui.Button('Cancel', { x: 120, y: 0 })) {
              ImGui.CloseCurrentPopup();
            }

            ImGui.EndPopup();
          }
        } else {
          // No sprites defined - show default number input
          const valueArr: [number] = [value ?? 0];
          if (ImGui.InputInt(`${label}##tileIndex`, valueArr)) {
            onChange(valueArr[0]);
          }
        }
      },
    },
    tileSize: {
      serializable: true,
      whenNullish: 'keep',
      customEditor: ({ label, value, onChange, componentData }) => {
        // Check if texture has sprites defined
        const texture = componentData.texture;
        let hasSprites = false;

        if (texture && texture.guid) {
          const metadata = AssetDatabase.getMetadata(texture.guid);
          if (metadata && isTextureMetadata(metadata)) {
            hasSprites = (metadata.sprites?.length ?? 0) > 0;
          }
        }

        if (hasSprites) {
          // Hide this field - sprite picker handles it
          return;
        } else {
          // Show Vec2 input
          ImGui.Text(`${label}:`);

          if (value === null) {
            ImGui.SameLine();
            ImGui.Text('None');
            ImGui.SameLine();
            if (ImGui.Button(`Set##${label}`)) {
              onChange({ x: 32, y: 32 }); // Default tile size
            }
          } else {
            const arr: [number, number] = [value.x, value.y];
            if (ImGui.DragFloat2(`##${label}`, arr, 1.0)) {
              onChange({ x: arr[0], y: arr[1] });
            }
          }
        }
      },
    },
    tilesetSize: {
      serializable: true,
      whenNullish: 'keep',
    },
    pixelsPerUnit: {
      serializable: true,
    },
    flipX: {
      serializable: true,
    },
    flipY: {
      serializable: true,
    },
    sortingLayer: {
      serializable: true,
    },
    sortingOrder: {
      serializable: true,
    },
    anchor: {
      serializable: true,
    },
    visible: {
      serializable: true,
    },
    isLit: {
      serializable: true,
    },
  },
  {
    path: 'rendering/2d',
    defaultValue: () => ({
      texture: null,
      color: { r: 1, g: 1, b: 1, a: 1 },
      tileIndex: null,
      tileSize: null,
      tilesetSize: null,
      pixelsPerUnit: 100,
      flipX: false,
      flipY: false,
      sortingLayer: 0,
      sortingOrder: 0,
      anchor: { x: 0.5, y: 0.5 },
      visible: true,
      isLit: false,
    }),
    displayName: 'Sprite 2D',
    description: '2D sprite rendered in world space with optional tiling support',
  },
);

/**
 * Helper to calculate render order from sorting layer and order
 * Uses a formula that puts layers in 1000-unit blocks
 */
export function calculateRenderOrder(
  sortingLayer: number,
  sortingOrder: number,
): number {
  return sortingLayer * 1000 + sortingOrder;
}

/**
 * Helper to calculate sprite scale from pixels per unit
 */
export function calculateSpriteScale(
  pixelsPerUnit: number,
  textureWidth: number,
  textureHeight: number,
  tileSize?: { x: number; y: number } | null,
): { x: number; y: number } {
  const width = tileSize?.x ?? textureWidth;
  const height = tileSize?.y ?? textureHeight;

  return {
    x: width / pixelsPerUnit,
    y: height / pixelsPerUnit,
  };
}

/**
 * Calculate anchor offset for sprite positioning.
 * PlaneGeometry is centered at origin (-0.5 to 0.5 in each dimension).
 * This calculates the positional offset needed to place the anchor point at the transform position.
 *
 * @param spriteWidth Width of sprite in world units
 * @param spriteHeight Height of sprite in world units
 * @param anchor Anchor point (0-1 range, where 0.5, 0.5 is center)
 * @returns Offset vector to apply to mesh position
 */
export function calculateAnchorOffset(
  spriteWidth: number,
  spriteHeight: number,
  anchor: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: spriteWidth * (0.5 - anchor.x),
    y: spriteHeight * (0.5 - anchor.y),
  };
}
