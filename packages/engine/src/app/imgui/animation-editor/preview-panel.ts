/**
 * Animation Editor Preview Panel
 *
 * Displays an integrated preview of the animated sprite at the current playhead position.
 * Shows sprites from any texture using the self-contained sprite system.
 */

import { ImGui, ImGuiImplWeb, ImTextureRef } from '@voidscript/imgui';
import * as THREE from 'three';
import {
  type AnimationEditorState,
  evaluateAnimationAtTime,
  getPreviewTextureGuid,
  setPreviewTextureGuid,
  autoDetectPreviewTexture,
} from './animation-editor-state.js';
import {
  PREVIEW_PANEL_WIDTH,
  PREVIEW_SPRITE_SIZE,
  PREVIEW_PADDING,
  COLORS,
} from './constants.js';
import { AssetDatabase } from '../../../ecs/asset/asset-database.js';
import { RuntimeAssetManager } from '@voidscript/core';
import {
  AssetType,
  isTextureMetadata,
  isTiledSpriteDefinition,
  type TextureMetadata,
  type SpriteDefinition,
} from '../../../ecs/asset/asset-metadata.js';
import type { Color, SpriteValue } from '../../../animation/interpolation.js';
import type { Vector3Value } from './animation-editor-state.js';

// ============================================================================
// Texture Cache
// ============================================================================

interface CachedPreviewTexture {
  textureId: bigint;
  width: number;
  height: number;
  lastAccessed: number;
}

const previewTextureCache = new Map<string, CachedPreviewTexture>();
const pendingPreviewLoads = new Set<string>();

/**
 * Get or load a texture for preview rendering
 */
function getOrLoadPreviewTexture(
  guid: string,
  renderer: THREE.WebGLRenderer | null,
): CachedPreviewTexture | null {
  if (!renderer) return null;

  // Check cache first
  const cached = previewTextureCache.get(guid);
  if (cached) {
    cached.lastAccessed = Date.now();
    return cached;
  }

  // Check if already loading
  if (pendingPreviewLoads.has(guid)) {
    return null;
  }

  // Start loading
  pendingPreviewLoads.add(guid);

  const metadata = AssetDatabase.getMetadata(guid);
  if (!metadata || metadata.type !== AssetType.Texture) {
    pendingPreviewLoads.delete(guid);
    return null;
  }

  const runtimeAsset = RuntimeAssetManager.get().getOrCreate(guid, metadata);

  // Start async load
  runtimeAsset
    .load()
    .then(() => {
      pendingPreviewLoads.delete(guid);

      if (!runtimeAsset.data || !runtimeAsset.isLoaded) {
        return;
      }

      const threeTexture = runtimeAsset.data as THREE.Texture;
      if (!threeTexture || !threeTexture.image) {
        return;
      }

      // Initialize the texture in Three.js
      renderer.initTexture(threeTexture);

      // Get WebGL texture
      const textureProps = renderer.properties.get(threeTexture) as {
        __webglTexture?: WebGLTexture;
      };
      const webglTexture = textureProps.__webglTexture;

      if (!webglTexture) {
        return;
      }

      // Create ImGui texture ID
      const textureId = ImGuiImplWeb.LoadTexture(undefined, {
        processFn: () => webglTexture,
      });

      // Get dimensions
      const image = threeTexture.image as {
        width?: number;
        height?: number;
        videoWidth?: number;
        videoHeight?: number;
      };
      const width = image.width || image.videoWidth || 64;
      const height = image.height || image.videoHeight || 64;

      // Cache it
      previewTextureCache.set(guid, {
        textureId,
        width,
        height,
        lastAccessed: Date.now(),
      });
    })
    .catch((err) => {
      pendingPreviewLoads.delete(guid);
      console.warn(`Failed to load texture for preview panel: ${guid}`, err);
    });

  return null;
}

// ============================================================================
// Preview Panel Rendering
// ============================================================================

/**
 * Render the preview panel on the right side of the animation editor
 */
export function renderPreviewPanel(
  state: AnimationEditorState,
  height: number,
  renderer: THREE.WebGLRenderer | null,
): void {
  // BeginChild for the panel
  ImGui.PushStyleColorImVec4(ImGui.Col.ChildBg, COLORS.previewBackground);
  ImGui.BeginChild('##PreviewPanel', { x: PREVIEW_PANEL_WIDTH, y: height }, 1, ImGui.WindowFlags.None);

  // Header
  ImGui.Text('Preview');
  ImGui.Separator();
  ImGui.Spacing();

  // Auto-detect texture if not set
  let currentTextureGuid = getPreviewTextureGuid();
  if (!currentTextureGuid) {
    currentTextureGuid = autoDetectPreviewTexture();
    if (currentTextureGuid) {
      setPreviewTextureGuid(currentTextureGuid);
    }
  }

  // Texture selector
  renderTextureSelector(currentTextureGuid);

  ImGui.Spacing();
  ImGui.Separator();
  ImGui.Spacing();

  // Sprite preview area
  renderSpritePreview(state, currentTextureGuid, renderer);

  ImGui.Spacing();
  ImGui.Separator();
  ImGui.Spacing();

  // Current values display
  renderCurrentValues(state);

  ImGui.EndChild();
  ImGui.PopStyleColor();
}

/**
 * Render the texture selector dropdown
 */
function renderTextureSelector(currentGuid: string | null): void {
  ImGui.Text('Texture:');

  // Get all textures with sprites
  const texturesWithSprites: { guid: string; name: string }[] = [];
  const allAssets = AssetDatabase.getAllAssets();

  for (const [guid, metadata] of allAssets) {
    if (isTextureMetadata(metadata) && metadata.sprites && metadata.sprites.length > 0) {
      const name = metadata.path.split('/').pop() || metadata.path;
      texturesWithSprites.push({ guid, name });
    }
  }

  // Sort by name
  texturesWithSprites.sort((a, b) => a.name.localeCompare(b.name));

  if (texturesWithSprites.length === 0) {
    ImGui.TextDisabled('No textures with sprites');
    return;
  }

  // Find current index
  let currentIndex = texturesWithSprites.findIndex((t) => t.guid === currentGuid);
  if (currentIndex < 0) currentIndex = 0;

  // Build combo items
  const comboItems = texturesWithSprites.map((t) => t.name).join('\0') + '\0';
  const indexRef: [number] = [currentIndex];

  ImGui.SetNextItemWidth(PREVIEW_PANEL_WIDTH - PREVIEW_PADDING * 2);
  if (ImGui.Combo('##previewTexture', indexRef, comboItems)) {
    const selectedTexture = texturesWithSprites[indexRef[0]];
    if (selectedTexture) {
      setPreviewTextureGuid(selectedTexture.guid);
    }
  }
}

/**
 * Render the sprite preview
 */
function renderSpritePreview(
  state: AnimationEditorState,
  textureGuid: string | null,
  renderer: THREE.WebGLRenderer | null,
): void {
  // Get current animation values at the current playhead time
  // Re-evaluate each frame to ensure we get fresh values during playback
  const currentTime = state.playheadTime;
  const values = evaluateAnimationAtTime(currentTime);

  // Determine what to show
  let spriteId: string | null = null;
  let tileIndex: number | null = null;
  let spriteTextureGuid: string | null = textureGuid;

  // Check for sprite track value
  const spriteValue = values.get('sprite') as SpriteValue | undefined;
  if (spriteValue && spriteValue.spriteId) {
    spriteId = spriteValue.spriteId;
    // Use textureGuid from sprite value if available (for cross-texture sprites)
    if (spriteValue.textureGuid) {
      spriteTextureGuid = spriteValue.textureGuid;
    } else {
      // Try to find the texture that contains this sprite
      const found = AssetDatabase.findSpriteById(spriteValue.spriteId);
      if (found) {
        spriteTextureGuid = found.textureGuid;
      }
    }
  }

  // Check for tileIndex track value
  const tileValue = values.get('tileIndex') as number | undefined;
  if (tileValue !== undefined) {
    tileIndex = Math.round(tileValue);
  }

  // Center the preview area
  const availableWidth = PREVIEW_PANEL_WIDTH - PREVIEW_PADDING * 2;
  const centerOffset = (availableWidth - PREVIEW_SPRITE_SIZE) / 2 + PREVIEW_PADDING;

  // Store the position where we'll draw the background and sprite
  const bgPosX = centerOffset;
  const bgPosY = ImGui.GetCursorPosY();

  // Draw checkerboard background for transparency
  ImGui.SetCursorPosX(bgPosX);
  ImGui.PushStyleColorImVec4(ImGui.Col.Button, COLORS.previewCheckerDark);
  ImGui.Button('##previewBg', { x: PREVIEW_SPRITE_SIZE, y: PREVIEW_SPRITE_SIZE });
  ImGui.PopStyleColor();

  // Get texture for rendering
  if (!spriteTextureGuid) {
    ImGui.TextDisabled('No texture');
    return;
  }

  const textureInfo = getOrLoadPreviewTexture(spriteTextureGuid, renderer);
  if (!textureInfo) {
    // Still loading
    ImGui.TextDisabled('Loading...');
    return;
  }

  // Calculate sprite UV coordinates
  let uv0: { x: number; y: number } = { x: 0, y: 0 };
  let uv1: { x: number; y: number } = { x: 1, y: 1 };

  // Get metadata to find sprite definition
  const metadata = AssetDatabase.getMetadata(spriteTextureGuid);
  if (metadata && isTextureMetadata(metadata)) {
    const textureData = metadata;

    if (spriteId && textureData.sprites) {
      // Find sprite by ID
      const spriteDef = textureData.sprites.find((s) => s.id === spriteId);
      if (spriteDef) {
        const uvs = calculateSpriteUVs(spriteDef, textureInfo.width, textureInfo.height);
        uv0 = uvs.uv0;
        uv1 = uvs.uv1;
      }
    } else if (tileIndex !== null && textureData.sprites && textureData.sprites.length > 0) {
      // Use tile index with first sprite definition for tile size
      const firstSprite = textureData.sprites[0];
      if (firstSprite && isTiledSpriteDefinition(firstSprite)) {
        const uvs = calculateTileUVs(
          tileIndex,
          firstSprite.tileWidth,
          firstSprite.tileHeight,
          textureInfo.width,
          textureInfo.height,
        );
        uv0 = uvs.uv0;
        uv1 = uvs.uv1;
      }
    }
  }

  // Draw the sprite on top of the background at the exact same position
  ImGui.SetCursorPos({ x: bgPosX, y: bgPosY });

  ImGui.Image(
    new ImTextureRef(textureInfo.textureId),
    { x: PREVIEW_SPRITE_SIZE, y: PREVIEW_SPRITE_SIZE },
    uv0,
    uv1,
  );

  // Move cursor past the preview area
  ImGui.SetCursorPosY(bgPosY + PREVIEW_SPRITE_SIZE + 4);
}

/**
 * Calculate UV coordinates for a sprite definition
 */
function calculateSpriteUVs(
  sprite: SpriteDefinition,
  texWidth: number,
  texHeight: number,
): { uv0: { x: number; y: number }; uv1: { x: number; y: number } } {
  if (isTiledSpriteDefinition(sprite)) {
    return calculateTileUVs(sprite.tileIndex, sprite.tileWidth, sprite.tileHeight, texWidth, texHeight);
  } else {
    // Rect sprite
    const u0 = sprite.x / texWidth;
    const v0 = sprite.y / texHeight;
    const u1 = (sprite.x + sprite.width) / texWidth;
    const v1 = (sprite.y + sprite.height) / texHeight;

    // Flip Y for correct orientation
    return {
      uv0: { x: u0, y: 1 - v0 },
      uv1: { x: u1, y: 1 - v1 },
    };
  }
}

/**
 * Calculate UV coordinates for a tile index
 */
function calculateTileUVs(
  tileIndex: number,
  tileWidth: number,
  tileHeight: number,
  texWidth: number,
  texHeight: number,
): { uv0: { x: number; y: number }; uv1: { x: number; y: number } } {
  const tilesPerRow = Math.floor(texWidth / tileWidth);
  const tileX = tileIndex % tilesPerRow;
  const tileY = Math.floor(tileIndex / tilesPerRow);

  const u0 = (tileX * tileWidth) / texWidth;
  const v0 = (tileY * tileHeight) / texHeight;
  const u1 = ((tileX + 1) * tileWidth) / texWidth;
  const v1 = ((tileY + 1) * tileHeight) / texHeight;

  // Flip Y for correct orientation
  return {
    uv0: { x: u0, y: 1 - v0 },
    uv1: { x: u1, y: 1 - v1 },
  };
}

/**
 * Render current evaluated values
 */
function renderCurrentValues(state: AnimationEditorState): void {
  ImGui.Text('Current Values:');
  ImGui.Spacing();

  // Show current playhead time for debugging
  ImGui.TextDisabled(`Time: ${(state.playheadTime * 100).toFixed(1)}%`);

  const values = evaluateAnimationAtTime(state.playheadTime);

  if (values.size === 0) {
    ImGui.TextDisabled('No tracks');
    return;
  }

  for (const [path, value] of values) {
    renderValueDisplay(path, value);
  }
}

/**
 * Render a single value display
 */
function renderValueDisplay(path: string, value: unknown): void {
  if (typeof value === 'number') {
    const isInteger = path === 'tileIndex' || Number.isInteger(value);
    if (isInteger) {
      ImGui.Text(`${path}: ${Math.round(value)}`);
    } else {
      ImGui.Text(`${path}: ${value.toFixed(3)}`);
    }
  } else if (isVector3Like(value)) {
    ImGui.Text(`${path}:`);
    ImGui.SameLine();
    ImGui.TextDisabled(`(${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)})`);
  } else if (isColorLike(value)) {
    // Show color swatch
    ImGui.Text(`${path}:`);
    ImGui.SameLine();

    const colorVec = {
      x: value.r,
      y: value.g,
      z: value.b,
      w: value.a,
    };
    ImGui.ColorButton(`##color_${path}`, colorVec, 0, { x: 20, y: 14 });
  } else if (isSpriteValueLike(value)) {
    ImGui.Text(`${path}: ${value.spriteId || '(none)'}`);
  }
}

/**
 * Type guard for Vector3-like values
 */
function isVector3Like(value: unknown): value is Vector3Value {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    'y' in value &&
    'z' in value &&
    !('r' in value)
  );
}

/**
 * Type guard for Color-like values
 */
function isColorLike(value: unknown): value is Color {
  return (
    typeof value === 'object' && value !== null && 'r' in value && 'g' in value && 'b' in value && 'a' in value
  );
}

/**
 * Type guard for SpriteValue-like values
 */
function isSpriteValueLike(value: unknown): value is SpriteValue {
  return typeof value === 'object' && value !== null && 'spriteId' in value;
}
