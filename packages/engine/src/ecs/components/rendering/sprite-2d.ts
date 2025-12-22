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
import {
  isTextureMetadata,
  isTiledSpriteDefinition,
  isRectSpriteDefinition,
  type TextureMetadata,
  type SpriteDefinition,
} from '../../asset-metadata.js';
import { ImGui } from '@mori2003/jsimgui';
import {
  renderSpritePickerModal,
  openSpritePicker,
} from '../../../app/imgui/sprite-picker.js';
import type * as THREE from 'three';

// Track pending sprite selections
const pendingSpriteSelections = new Map<string, SpriteDefinition | null>();

// Current renderer reference (set by inspector)
let spritePickerRenderer: THREE.WebGLRenderer | null = null;

/**
 * Set the renderer for sprite picker previews
 * Called by the inspector when rendering
 */
export function setSpritePickerRenderer(renderer: THREE.WebGLRenderer | null): void {
  spritePickerRenderer = renderer;
}

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

  /**
   * Direct rect coordinates for sprite region (alternative to tileIndex)
   * If set, this takes precedence over tileIndex/tileSize/tilesetSize
   * Uses pixel coordinates where x,y is the top-left corner
   * @default null
   */
  spriteRect: { x: number; y: number; width: number; height: number } | null;
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
          const popupId = `SpritePicker##${texture.guid}`;

          // Check for pending sprite selection from callback
          const pendingSprite = pendingSpriteSelections.get(popupId);
          if (pendingSprite) {
            pendingSpriteSelections.delete(popupId);

            // Handle sprite selection based on type
            if (isTiledSpriteDefinition(pendingSprite)) {
              // Tile-based sprite: set tile properties, clear rect
              onChange(pendingSprite.tileIndex);
              componentData.tileSize = {
                x: pendingSprite.tileWidth,
                y: pendingSprite.tileHeight,
              };

              // Update tilesetSize from texture if loaded, or metadata
              if (texture.isLoaded && texture.data?.image) {
                const image = texture.data.image;
                componentData.tilesetSize = {
                  x: image.width || image.videoWidth || pendingSprite.tileWidth,
                  y: image.height || image.videoHeight || pendingSprite.tileHeight,
                };
              } else {
                componentData.tilesetSize = {
                  x: metadata.width || pendingSprite.tileWidth,
                  y: metadata.height || pendingSprite.tileHeight,
                };
              }

              // Clear spriteRect when using tile-based
              componentData.spriteRect = null;
            } else if (isRectSpriteDefinition(pendingSprite)) {
              // Rect-based sprite: set rect, clear tile properties
              componentData.spriteRect = {
                x: pendingSprite.x,
                y: pendingSprite.y,
                width: pendingSprite.width,
                height: pendingSprite.height,
              };

              // Clear tile-based properties
              onChange(null);
              componentData.tileSize = null;
              componentData.tilesetSize = null;
            }
          }

          // Show sprite picker button
          ImGui.Text('Sprite:');
          ImGui.SameLine();

          // Find current sprite - check both tile-based and rect-based
          const sprites = metadata.sprites || [];
          let currentSprite: SpriteDefinition | undefined;

          // Check if using spriteRect (rect-based)
          if (componentData.spriteRect) {
            currentSprite = sprites.find(
              (s) =>
                isRectSpriteDefinition(s) &&
                s.x === componentData.spriteRect!.x &&
                s.y === componentData.spriteRect!.y &&
                s.width === componentData.spriteRect!.width &&
                s.height === componentData.spriteRect!.height,
            );
          }

          // Check if using tileIndex (tile-based)
          if (!currentSprite && value !== null) {
            currentSprite = sprites.find(
              (s) => isTiledSpriteDefinition(s) && s.tileIndex === value,
            );
          }

          if (currentSprite) {
            const typeLabel = isTiledSpriteDefinition(currentSprite)
              ? ' (Tile)'
              : ' (Rect)';
            ImGui.Text(currentSprite.name + typeLabel);
          } else if (value !== null) {
            ImGui.Text(`Custom (Index ${value})`);
          } else if (componentData.spriteRect) {
            ImGui.Text(
              `Custom Rect (${componentData.spriteRect.x}, ${componentData.spriteRect.y})`,
            );
          } else {
            ImGui.TextDisabled('None');
          }

          ImGui.SameLine();

          if (ImGui.Button(`Pick Sprite##tileIndex`)) {
            openSpritePicker(popupId);
          }

          // Render sprite picker modal with previews
          renderSpritePickerModal({
            popupId,
            textureAsset: texture,
            metadata,
            currentSprite: currentSprite ?? null,
            currentTileIndex: value,
            currentSpriteRect: componentData.spriteRect,
            renderer: spritePickerRenderer,
            onSelect: (sprite) => {
              // Store for next frame
              pendingSpriteSelections.set(popupId, sprite);
            },
            onCancel: () => {
              pendingSpriteSelections.delete(popupId);
            },
          });

          // Don't show the default number input when sprites are defined
          return;
        }

        // No sprites defined - show default number input
        const valueArr: [number] = [value ?? 0];
        ImGui.Text(`${label}:`);
        ImGui.SameLine();
        let valueChanged = false;
        valueChanged = ImGui.DragFloat(`##${label}-slider`, valueArr, 0.01);
        ImGui.SameLine();
        valueChanged =
          ImGui.InputFloat(`##${label}-input`, valueArr) || valueChanged;
        if (valueChanged) {
          onChange(valueArr[0]);
        }
      },
    },
    tileSize: {
      serializable: true,
      whenNullish: 'keep',
      customEditor: ({ label, value, onChange, componentData }) => {
        // Hide if using spriteRect (rect-based doesn't use tileSize)
        if (componentData.spriteRect) {
          return;
        }

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
      customEditor: ({ label, value, onChange, componentData }) => {
        // Hide if using spriteRect (rect-based doesn't use tilesetSize)
        if (componentData.spriteRect) {
          return;
        }

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
        }

        // Show Vec2 input for manual mode
        ImGui.Text(`${label}:`);

        if (value === null) {
          ImGui.SameLine();
          ImGui.Text('None');
          ImGui.SameLine();
          if (ImGui.Button(`Set##${label}`)) {
            onChange({ x: 256, y: 256 }); // Default tileset size
          }
        } else {
          const arr: [number, number] = [value.x, value.y];
          if (ImGui.DragFloat2(`##${label}`, arr, 1.0)) {
            onChange({ x: arr[0], y: arr[1] });
          }
        }
      },
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
    spriteRect: {
      serializable: true,
      whenNullish: 'keep',
      customEditor: ({ label, value, onChange, componentData }) => {
        // Hide if using tile-based approach
        if (componentData.tileIndex !== null) {
          return;
        }

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
        }

        // Show rect input for manual mode
        ImGui.Text(`${label}:`);

        if (value === null) {
          ImGui.SameLine();
          ImGui.Text('None');
          ImGui.SameLine();
          if (ImGui.Button(`Set##${label}`)) {
            onChange({ x: 0, y: 0, width: 32, height: 32 });
          }
        } else {
          const posArr: [number, number] = [value.x, value.y];
          const sizeArr: [number, number] = [value.width, value.height];

          ImGui.Text('Position:');
          ImGui.SameLine();
          if (ImGui.DragFloat2(`##${label}-pos`, posArr, 1.0)) {
            onChange({ ...value, x: posArr[0], y: posArr[1] });
          }

          ImGui.Text('Size:');
          ImGui.SameLine();
          if (ImGui.DragFloat2(`##${label}-size`, sizeArr, 1.0)) {
            onChange({ ...value, width: sizeArr[0], height: sizeArr[1] });
          }

          ImGui.SameLine();
          if (ImGui.Button(`Clear##${label}`)) {
            onChange(null);
          }
        }
      },
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
      spriteRect: null,
    }),
    displayName: 'Sprite 2D',
    description:
      '2D sprite rendered in world space with optional tiling support',
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
