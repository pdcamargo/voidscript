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

import { component } from '@voidscript/core';
import { RuntimeAsset } from '@voidscript/core';
import { AssetDatabase } from '../../asset/asset-database.js';
import {
  isTextureMetadata,
  isTiledSpriteDefinition,
  isRectSpriteDefinition,
  type TextureMetadata,
  type SpriteDefinition,
} from '../../asset/asset-metadata.js';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';
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
          EditorLayout.text(`${label}:`);
          EditorLayout.sameLine();
          EditorLayout.textDisabled('(No texture)');
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

            // Apply pivot as anchor if defined on the sprite
            if (pendingSprite.pivot) {
              componentData.anchor = {
                x: pendingSprite.pivot.x,
                y: pendingSprite.pivot.y,
              };
            }
          }

          // Show sprite picker button
          EditorLayout.text('Sprite:');
          EditorLayout.sameLine();

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
            EditorLayout.text(currentSprite.name + typeLabel);
          } else if (value !== null) {
            EditorLayout.text(`Custom (Index ${value})`);
          } else if (componentData.spriteRect) {
            EditorLayout.text(
              `Custom Rect (${componentData.spriteRect.x}, ${componentData.spriteRect.y})`,
            );
          } else {
            EditorLayout.textDisabled('None');
          }

          EditorLayout.sameLine();

          if (EditorLayout.button('Pick Sprite##tileIndex')) {
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
            onSelect: (sprite: SpriteDefinition) => {
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
        const [newVal, changed] = EditorLayout.numberField(label, value ?? 0, {
          speed: 0.01,
          tooltip: 'Tile index for sprite sheet (0-based)',
        });
        if (changed) {
          onChange(newVal);
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
          if (value === null) {
            EditorLayout.text(`${label}:`);
            EditorLayout.sameLine();
            EditorLayout.text('None');
            EditorLayout.sameLine();
            if (EditorLayout.button(`Set##${label}`)) {
              onChange({ x: 32, y: 32 }); // Default tile size
            }
          } else {
            const [newVal, changed] = EditorLayout.vector2Field(label, value, {
              speed: 1,
              tooltip: 'Size of each tile in pixels',
            });
            if (changed) {
              onChange({ x: newVal.x, y: newVal.y });
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
        if (value === null) {
          EditorLayout.text(`${label}:`);
          EditorLayout.sameLine();
          EditorLayout.text('None');
          EditorLayout.sameLine();
          if (EditorLayout.button(`Set##${label}`)) {
            onChange({ x: 256, y: 256 }); // Default tileset size
          }
        } else {
          const [newVal, changed] = EditorLayout.vector2Field(label, value, {
            speed: 1,
            tooltip: 'Total size of the tileset texture in pixels',
          });
          if (changed) {
            onChange({ x: newVal.x, y: newVal.y });
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
        if (value === null) {
          EditorLayout.text(`${label}:`);
          EditorLayout.sameLine();
          EditorLayout.text('None');
          EditorLayout.sameLine();
          if (EditorLayout.button(`Set##${label}`)) {
            onChange({ x: 0, y: 0, width: 32, height: 32 });
          }
        } else {
          const [newPos, posChanged] = EditorLayout.vector2Field('Position', { x: value.x, y: value.y }, {
            speed: 1,
            tooltip: 'Top-left corner of the sprite rect in pixels',
            id: `${label}-pos`,
          });
          if (posChanged) {
            onChange({ ...value, x: newPos.x, y: newPos.y });
          }

          const [newSize, sizeChanged] = EditorLayout.vector2Field('Size', { x: value.width, y: value.height }, {
            speed: 1,
            tooltip: 'Width and height of the sprite rect in pixels',
            id: `${label}-size`,
          });
          if (sizeChanged) {
            onChange({ ...value, width: newSize.x, height: newSize.y });
          }

          EditorLayout.sameLine();
          if (EditorLayout.button(`Clear##${label}`)) {
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
    customEditor: ({ componentData }) => {
      // === Texture Section ===
      if (EditorLayout.beginGroup('Texture', true)) {
        EditorLayout.beginLabelsWidth(['Texture', 'Sprite']);

        // Texture asset picker
        const [texture, textureChanged] = EditorLayout.runtimeAssetField(
          'Texture',
          componentData.texture,
          { assetTypes: ['texture'], tooltip: 'Source texture for the sprite' }
        );
        if (textureChanged) {
          componentData.texture = texture;
          // Clear sprite-related data when texture changes
          if (!texture) {
            componentData.tileIndex = null;
            componentData.tileSize = null;
            componentData.tilesetSize = null;
            componentData.spriteRect = null;
          }
        }

        // Sprite picker (only if texture is selected)
        if (componentData.texture && componentData.texture.guid) {
          const metadata = AssetDatabase.getMetadata(componentData.texture.guid);
          if (metadata && isTextureMetadata(metadata)) {
            const hasSprites = (metadata.sprites?.length ?? 0) > 0;

            if (hasSprites) {
              const popupId = `SpritePicker##${componentData.texture.guid}`;

              // Check for pending sprite selection
              const pendingSprite = pendingSpriteSelections.get(popupId);
              if (pendingSprite) {
                pendingSpriteSelections.delete(popupId);

                if (isTiledSpriteDefinition(pendingSprite)) {
                  componentData.tileIndex = pendingSprite.tileIndex;
                  componentData.tileSize = {
                    x: pendingSprite.tileWidth,
                    y: pendingSprite.tileHeight,
                  };
                  if (componentData.texture.isLoaded && componentData.texture.data?.image) {
                    const image = componentData.texture.data.image;
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
                  componentData.spriteRect = null;
                } else if (isRectSpriteDefinition(pendingSprite)) {
                  componentData.spriteRect = {
                    x: pendingSprite.x,
                    y: pendingSprite.y,
                    width: pendingSprite.width,
                    height: pendingSprite.height,
                  };
                  componentData.tileIndex = null;
                  componentData.tileSize = null;
                  componentData.tilesetSize = null;
                }

                if (pendingSprite.pivot) {
                  componentData.anchor = {
                    x: pendingSprite.pivot.x,
                    y: pendingSprite.pivot.y,
                  };
                }
              }

              // Find current sprite
              const sprites = metadata.sprites || [];
              let currentSprite: SpriteDefinition | undefined;

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

              if (!currentSprite && componentData.tileIndex !== null) {
                currentSprite = sprites.find(
                  (s) => isTiledSpriteDefinition(s) && s.tileIndex === componentData.tileIndex,
                );
              }

              // Display current sprite
              EditorLayout.text('Sprite:');
              EditorLayout.sameLine();

              if (currentSprite) {
                const typeLabel = isTiledSpriteDefinition(currentSprite) ? ' (Tile)' : ' (Rect)';
                EditorLayout.text(currentSprite.name + typeLabel);
              } else if (componentData.tileIndex !== null) {
                EditorLayout.text(`Custom (Index ${componentData.tileIndex})`);
              } else if (componentData.spriteRect) {
                EditorLayout.text(
                  `Custom Rect (${componentData.spriteRect.x}, ${componentData.spriteRect.y})`,
                );
              } else {
                EditorLayout.textDisabled('None');
              }

              EditorLayout.sameLine();

              if (EditorLayout.button('Pick##sprite')) {
                openSpritePicker(popupId);
              }

              renderSpritePickerModal({
                popupId,
                textureAsset: componentData.texture,
                metadata,
                currentSprite: currentSprite ?? null,
                currentTileIndex: componentData.tileIndex,
                currentSpriteRect: componentData.spriteRect,
                renderer: spritePickerRenderer,
                onSelect: (sprite: SpriteDefinition) => {
                  pendingSpriteSelections.set(popupId, sprite);
                },
                onCancel: () => {
                  pendingSpriteSelections.delete(popupId);
                },
              });
            } else {
              // No sprites defined - show manual tile controls
              if (componentData.tileIndex !== null) {
                const [tileIndex, tileChanged] = EditorLayout.integerField(
                  'Tile Index',
                  componentData.tileIndex,
                  { speed: 1, tooltip: 'Tile index for sprite sheet (0-based)' }
                );
                if (tileChanged) {
                  componentData.tileIndex = tileIndex;
                }
              }
            }
          }
        }

        EditorLayout.endLabelsWidth();
        EditorLayout.endGroup();
      }

      // === Appearance Section ===
      if (EditorLayout.beginGroup('Appearance', true)) {
        EditorLayout.beginLabelsWidth(['Color', 'Alpha', 'Pixels Per Unit', 'Flip X', 'Flip Y', 'Is Lit', 'Visible']);

        const [color, colorChanged] = EditorLayout.colorField(
          'Color',
          componentData.color,
          { tooltip: 'Tint color (multiplied with texture)' }
        );
        if (colorChanged) {
          componentData.color.r = color.r;
          componentData.color.g = color.g;
          componentData.color.b = color.b;
        }

        const [alpha, alphaChanged] = EditorLayout.numberField(
          'Alpha',
          componentData.color.a,
          { speed: 0.01, min: 0, max: 1, tooltip: 'Sprite opacity (0 = transparent, 1 = opaque)' }
        );
        if (alphaChanged) {
          componentData.color.a = alpha;
        }

        const [ppu, ppuChanged] = EditorLayout.numberField(
          'Pixels Per Unit',
          componentData.pixelsPerUnit,
          { speed: 1, min: 1, tooltip: 'Pixels per world unit (higher = smaller sprite)' }
        );
        if (ppuChanged) {
          componentData.pixelsPerUnit = Math.max(1, ppu);
        }

        const [flipX, flipXChanged] = EditorLayout.checkboxField(
          'Flip X',
          componentData.flipX,
          { tooltip: 'Flip sprite horizontally' }
        );
        if (flipXChanged) {
          componentData.flipX = flipX;
        }

        const [flipY, flipYChanged] = EditorLayout.checkboxField(
          'Flip Y',
          componentData.flipY,
          { tooltip: 'Flip sprite vertically' }
        );
        if (flipYChanged) {
          componentData.flipY = flipY;
        }

        const [isLit, litChanged] = EditorLayout.checkboxField(
          'Is Lit',
          componentData.isLit ?? false,
          { tooltip: 'Whether sprite receives THREE.js lighting' }
        );
        if (litChanged) {
          componentData.isLit = isLit;
        }

        const [visible, visibleChanged] = EditorLayout.checkboxField(
          'Visible',
          componentData.visible,
          { tooltip: 'Whether sprite is rendered' }
        );
        if (visibleChanged) {
          componentData.visible = visible;
        }

        EditorLayout.endLabelsWidth();
        EditorLayout.endGroup();
      }

      // === Sorting Section ===
      if (EditorLayout.beginGroup('Sorting', false)) {
        EditorLayout.beginLabelsWidth(['Sorting Layer', 'Sorting Order']);

        const [sortingLayer, layerChanged] = EditorLayout.integerField(
          'Sorting Layer',
          componentData.sortingLayer,
          { speed: 1, tooltip: 'Render layer (higher = rendered later)' }
        );
        if (layerChanged) {
          componentData.sortingLayer = sortingLayer;
        }

        const [sortingOrder, orderChanged] = EditorLayout.integerField(
          'Sorting Order',
          componentData.sortingOrder,
          { speed: 1, tooltip: 'Order within layer (higher = rendered later)' }
        );
        if (orderChanged) {
          componentData.sortingOrder = sortingOrder;
        }

        EditorLayout.endLabelsWidth();
        EditorLayout.endGroup();
      }

      // === Transform Section ===
      if (EditorLayout.beginGroup('Transform', false)) {
        EditorLayout.beginLabelsWidth(['Anchor']);

        const [anchor, anchorChanged] = EditorLayout.vector2Field(
          'Anchor',
          componentData.anchor,
          { speed: 0.01, tooltip: 'Pivot point (0,0 = bottom-left, 0.5,0.5 = center, 1,1 = top-right)' }
        );
        if (anchorChanged) {
          componentData.anchor.x = anchor.x;
          componentData.anchor.y = anchor.y;
        }

        EditorLayout.endLabelsWidth();
        EditorLayout.endGroup();
      }

      // === Manual Tiling Section (only shown when no sprites defined) ===
      const texture = componentData.texture;
      let hasSprites = false;
      if (texture && texture.guid) {
        const metadata = AssetDatabase.getMetadata(texture.guid);
        if (metadata && isTextureMetadata(metadata)) {
          hasSprites = (metadata.sprites?.length ?? 0) > 0;
        }
      }

      if (!hasSprites && texture) {
        if (EditorLayout.beginGroup('Manual Tiling', false)) {
          EditorLayout.beginLabelsWidth(['Tile Index', 'Tile Size', 'Tileset Size', 'Sprite Rect']);

          // Tile Index
          if (componentData.tileIndex === null && componentData.spriteRect === null) {
            EditorLayout.text('Tile Index:');
            EditorLayout.sameLine();
            EditorLayout.textDisabled('None');
            EditorLayout.sameLine();
            if (EditorLayout.button('Set Tile##tileIndex')) {
              componentData.tileIndex = 0;
              componentData.tileSize = { x: 32, y: 32 };
              componentData.tilesetSize = { x: 256, y: 256 };
            }
          } else if (componentData.tileIndex !== null) {
            const [tileIndex, tileChanged] = EditorLayout.integerField(
              'Tile Index',
              componentData.tileIndex,
              { speed: 1, tooltip: 'Tile index (0-based, left-to-right, top-to-bottom)' }
            );
            if (tileChanged) {
              componentData.tileIndex = Math.max(0, tileIndex);
            }

            // Tile Size
            if (componentData.tileSize) {
              const [tileSize, tileSizeChanged] = EditorLayout.vector2Field(
                'Tile Size',
                componentData.tileSize,
                { speed: 1, tooltip: 'Size of each tile in pixels' }
              );
              if (tileSizeChanged) {
                componentData.tileSize.x = tileSize.x;
                componentData.tileSize.y = tileSize.y;
              }
            }

            // Tileset Size
            if (componentData.tilesetSize) {
              const [tilesetSize, tilesetSizeChanged] = EditorLayout.vector2Field(
                'Tileset Size',
                componentData.tilesetSize,
                { speed: 1, tooltip: 'Total tileset texture size in pixels' }
              );
              if (tilesetSizeChanged) {
                componentData.tilesetSize.x = tilesetSize.x;
                componentData.tilesetSize.y = tilesetSize.y;
              }
            }

            EditorLayout.sameLine();
            if (EditorLayout.button('Clear Tile##clearTile')) {
              componentData.tileIndex = null;
              componentData.tileSize = null;
              componentData.tilesetSize = null;
            }
          }

          // Sprite Rect (alternative to tile-based)
          if (componentData.tileIndex === null) {
            if (componentData.spriteRect === null) {
              EditorLayout.text('Sprite Rect:');
              EditorLayout.sameLine();
              EditorLayout.textDisabled('None');
              EditorLayout.sameLine();
              if (EditorLayout.button('Set Rect##spriteRect')) {
                componentData.spriteRect = { x: 0, y: 0, width: 32, height: 32 };
              }
            } else {
              const [rectPos, rectPosChanged] = EditorLayout.vector2Field(
                'Rect Position',
                { x: componentData.spriteRect.x, y: componentData.spriteRect.y },
                { speed: 1, tooltip: 'Top-left corner of sprite rect in pixels' }
              );
              if (rectPosChanged) {
                componentData.spriteRect.x = rectPos.x;
                componentData.spriteRect.y = rectPos.y;
              }

              const [rectSize, rectSizeChanged] = EditorLayout.vector2Field(
                'Rect Size',
                { x: componentData.spriteRect.width, y: componentData.spriteRect.height },
                { speed: 1, tooltip: 'Width and height of sprite rect in pixels' }
              );
              if (rectSizeChanged) {
                componentData.spriteRect.width = rectSize.x;
                componentData.spriteRect.height = rectSize.y;
              }

              EditorLayout.sameLine();
              if (EditorLayout.button('Clear Rect##clearRect')) {
                componentData.spriteRect = null;
              }
            }
          }

          EditorLayout.endLabelsWidth();
          EditorLayout.endGroup();
        }
      }
    },
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
