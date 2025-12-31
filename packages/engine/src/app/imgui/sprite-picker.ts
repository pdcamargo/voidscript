/**
 * Sprite Picker Modal - Enhanced UI for selecting sprites from a texture
 *
 * Features:
 * - Search bar for filtering sprites by name
 * - Sprite preview thumbnails with checkered background
 * - Grid layout with proper aspect ratio preservation
 * - Type indicators (Tile vs Rect sprites)
 */

import { ImGui, ImGuiImplWeb, ImTextureRef } from '@voidscript/imgui';
import { AssetDatabase } from '../../ecs/asset-database.js';
import {
  isTextureMetadata,
  isTiledSpriteDefinition,
  isRectSpriteDefinition,
  type TextureMetadata,
  type SpriteDefinition,
  type TiledSpriteDefinition,
  type RectSpriteDefinition,
} from '../../ecs/asset-metadata.js';
import type { RuntimeAsset } from '../../ecs/runtime-asset.js';
import * as THREE from 'three';

// ============================================================================
// Types
// ============================================================================

export interface SpritePickerState {
  searchQuery: string;
  previewSize: number; // 100-300, default 100
}

interface TexturePreviewInfo {
  textureId: bigint;
  width: number;
  height: number;
}

// ============================================================================
// Texture Cache Management
// ============================================================================

// Cache for texture IDs (maps texture GUID to texture info)
const texturePreviewCache = new Map<string, TexturePreviewInfo>();
const pendingTextureLoads = new Set<string>();

// Checkered background texture for transparency
let spriteCheckeredTextureId: bigint | null = null;
let spriteCheckeredTexture: THREE.DataTexture | null = null;

/**
 * Create a checkered background pattern for transparency preview
 */
function createCheckeredTexture(): THREE.DataTexture {
  const size = 16;
  const data = new Uint8Array(size * size * 4);

  const dark = 40;  // Dark gray
  const light = 60; // Light gray

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const isDark = ((x >> 2) + (y >> 2)) % 2 === 0;
      const value = isDark ? dark : light;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;

  return texture;
}

/**
 * Get or load texture preview info
 */
function getOrLoadTexturePreview(
  textureAsset: RuntimeAsset<THREE.Texture>,
  renderer: THREE.WebGLRenderer,
): TexturePreviewInfo | null {
  const guid = textureAsset.guid;
  if (!guid) return null;

  // Check cache first
  const cached = texturePreviewCache.get(guid);
  if (cached) {
    return cached;
  }

  // Check if already loading
  if (pendingTextureLoads.has(guid)) {
    return null;
  }

  // Check if already loaded
  if (!textureAsset.isLoaded) {
    pendingTextureLoads.add(guid);
    textureAsset.load().then(() => {
      pendingTextureLoads.delete(guid);

      if (!textureAsset.data || !textureAsset.data.image) {
        return;
      }

      initializeTextureCache(guid, textureAsset.data, renderer);
    }).catch(() => {
      pendingTextureLoads.delete(guid);
    });
    return null;
  }

  // Already loaded, initialize cache
  if (textureAsset.data) {
    initializeTextureCache(guid, textureAsset.data, renderer);
    return texturePreviewCache.get(guid) ?? null;
  }

  return null;
}

function initializeTextureCache(
  guid: string,
  threeTexture: THREE.Texture,
  renderer: THREE.WebGLRenderer,
): void {
  if (texturePreviewCache.has(guid)) return;

  if (!threeTexture.image) return;

  // Initialize the texture in Three.js
  renderer.initTexture(threeTexture);

  // Get WebGL texture
  const textureProps = renderer.properties.get(threeTexture) as { __webglTexture?: WebGLTexture };
  const webglTexture = textureProps.__webglTexture;

  if (!webglTexture) return;

  // Create ImGui texture ID
  const textureId = ImGuiImplWeb.LoadTexture(undefined, {
    processFn: () => webglTexture,
  });

  // Get dimensions
  const image = threeTexture.image as { width?: number; height?: number; videoWidth?: number; videoHeight?: number };
  const width = image.width || image.videoWidth || 64;
  const height = image.height || image.videoHeight || 64;

  texturePreviewCache.set(guid, { textureId, width, height });
}

/**
 * Get checkered background texture ID
 */
function getCheckeredTextureId(renderer: THREE.WebGLRenderer): bigint | null {
  if (spriteCheckeredTextureId !== null) {
    return spriteCheckeredTextureId;
  }

  if (!spriteCheckeredTexture) {
    spriteCheckeredTexture = createCheckeredTexture();
  }

  renderer.initTexture(spriteCheckeredTexture);

  const textureProps = renderer.properties.get(spriteCheckeredTexture) as { __webglTexture?: WebGLTexture };
  const webglTexture = textureProps.__webglTexture;

  if (!webglTexture) return null;

  spriteCheckeredTextureId = ImGuiImplWeb.LoadTexture(undefined, {
    processFn: () => webglTexture,
  });

  return spriteCheckeredTextureId;
}

// ============================================================================
// Sprite Picker State Management
// ============================================================================

const pickerStates = new Map<string, SpritePickerState>();

function getOrCreatePickerState(popupId: string): SpritePickerState {
  let state = pickerStates.get(popupId);
  if (!state) {
    state = { searchQuery: '', previewSize: 100 };
    pickerStates.set(popupId, state);
  }
  return state;
}

// ============================================================================
// Sprite Filtering
// ============================================================================

function filterSprites(
  sprites: SpriteDefinition[],
  searchQuery: string,
): SpriteDefinition[] {
  if (!searchQuery) return sprites;

  const searchLower = searchQuery.toLowerCase();
  return sprites.filter(sprite =>
    sprite.name.toLowerCase().includes(searchLower) ||
    sprite.id.toLowerCase().includes(searchLower)
  );
}

// ============================================================================
// Render Functions
// ============================================================================

/**
 * Render a single sprite item with texture preview
 */
function renderSpriteItem(
  sprite: SpriteDefinition,
  buttonSize: number,
  isSelected: boolean,
  textureInfo: TexturePreviewInfo | null,
  renderer: THREE.WebGLRenderer | null,
): boolean {
  let clicked = false;

  ImGui.BeginGroup();

  // Selection highlight
  if (isSelected) {
    ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.2, y: 0.5, z: 0.8, w: 1.0 });
  }

  // Get sprite bounds for UV calculation
  let spriteX = 0;
  let spriteY = 0;
  let spriteWidth = 32;
  let spriteHeight = 32;

  if (isTiledSpriteDefinition(sprite)) {
    const tilesPerRow = textureInfo ? Math.floor(textureInfo.width / sprite.tileWidth) : 1;
    spriteX = (sprite.tileIndex % tilesPerRow) * sprite.tileWidth;
    spriteY = Math.floor(sprite.tileIndex / tilesPerRow) * sprite.tileHeight;
    spriteWidth = sprite.tileWidth;
    spriteHeight = sprite.tileHeight;
  } else if (isRectSpriteDefinition(sprite)) {
    spriteX = sprite.x;
    spriteY = sprite.y;
    spriteWidth = sprite.width;
    spriteHeight = sprite.height;
  }

  if (textureInfo && renderer) {
    // Calculate display size maintaining aspect ratio
    const aspectRatio = spriteWidth / spriteHeight;
    let displayWidth = buttonSize - 8;
    let displayHeight = displayWidth / aspectRatio;

    if (displayHeight > buttonSize - 8) {
      displayHeight = buttonSize - 8;
      displayWidth = displayHeight * aspectRatio;
    }

    // Center the image
    const offsetX = (buttonSize - displayWidth) / 2;
    const offsetY = (buttonSize - displayHeight) / 2;

    const startPosX = ImGui.GetCursorPosX();
    const startPosY = ImGui.GetCursorPosY();

    // Invisible button for click detection
    if (ImGui.InvisibleButton(`##sprite_${sprite.id}`, { x: buttonSize, y: buttonSize })) {
      clicked = true;
    }

    // Draw button background
    ImGui.SetCursorPos({ x: startPosX, y: startPosY });
    ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.15, y: 0.15, z: 0.15, w: 1.0 });
    ImGui.Button(`##bg_${sprite.id}`, { x: buttonSize, y: buttonSize });
    ImGui.PopStyleColor();

    // Calculate UVs for the sprite region
    // In sprite coordinates: Y=0 is top, spriteY is top edge
    // In WebGL texture: Y=0 is bottom
    // ImGui.Image takes uv0 (top-left corner) and uv1 (bottom-right corner)
    const u0 = spriteX / textureInfo.width;
    const u1 = (spriteX + spriteWidth) / textureInfo.width;
    // Flip Y: sprite's top edge (spriteY) becomes bottom in WebGL coords
    // uv0.y should be the TOP of the sprite in screen space = BOTTOM in WebGL = 1 - spriteY/height
    // uv1.y should be the BOTTOM of the sprite in screen space = TOP in WebGL = 1 - (spriteY+height)/height
    const v0 = 1 - (spriteY / textureInfo.height);
    const v1 = 1 - ((spriteY + spriteHeight) / textureInfo.height);

    // Draw checkered background first
    const checkeredId = getCheckeredTextureId(renderer);
    if (checkeredId !== null) {
      ImGui.SetCursorPos({ x: startPosX + offsetX, y: startPosY + offsetY });
      ImGui.Image(
        new ImTextureRef(checkeredId),
        { x: displayWidth, y: displayHeight },
        { x: 0, y: 0 },
        { x: displayWidth / 16, y: displayHeight / 16 },
      );
    }

    // Overlay the sprite (v0 > v1 causes vertical flip to correct orientation)
    ImGui.SetCursorPos({ x: startPosX + offsetX, y: startPosY + offsetY });
    ImGui.Image(
      new ImTextureRef(textureInfo.textureId),
      { x: displayWidth, y: displayHeight },
      { x: u0, y: v0 },
      { x: u1, y: v1 },
    );

    // Reset cursor
    ImGui.SetCursorPos({ x: startPosX, y: startPosY + buttonSize });

  } else {
    // No texture preview - standard button
    if (ImGui.Button(`##sprite_${sprite.id}`, { x: buttonSize, y: buttonSize })) {
      clicked = true;
    }

    // Show loading indicator
    if (!textureInfo) {
      ImGui.SetCursorPosY(ImGui.GetCursorPosY() - buttonSize / 2 - 8);
      ImGui.TextDisabled('Loading...');
    }
  }

  if (isSelected) {
    ImGui.PopStyleColor();
  }

  // Sprite name with type indicator
  const typeLabel = isTiledSpriteDefinition(sprite) ? '[T]' : '[R]';
  ImGui.PushTextWrapPos(ImGui.GetCursorPosX() + buttonSize);
  ImGui.TextWrapped(`${typeLabel} ${sprite.name}`);
  ImGui.PopTextWrapPos();

  ImGui.EndGroup();

  return clicked;
}

// ============================================================================
// Main Sprite Picker Modal
// ============================================================================

export interface SpritePickerOptions {
  /** Popup ID (must be unique) */
  popupId: string;
  /** The texture asset containing sprites */
  textureAsset: RuntimeAsset<THREE.Texture>;
  /** Texture metadata with sprite definitions */
  metadata: TextureMetadata;
  /** Currently selected sprite (for highlighting) */
  currentSprite?: SpriteDefinition | null;
  /** Current tile index (for tile-based selection) */
  currentTileIndex?: number | null;
  /** Current sprite rect (for rect-based selection) */
  currentSpriteRect?: { x: number; y: number; width: number; height: number } | null;
  /** Three.js renderer for texture previews */
  renderer?: THREE.WebGLRenderer | null;
  /** Callback when a sprite is selected */
  onSelect: (sprite: SpriteDefinition) => void;
  /** Callback when cancelled */
  onCancel?: () => void;
}

/**
 * Render the sprite picker modal
 *
 * @returns true if the modal is still open, false if closed
 */
export function renderSpritePickerModal(options: SpritePickerOptions): boolean {
  const {
    popupId,
    textureAsset,
    metadata,
    currentSprite,
    currentTileIndex,
    currentSpriteRect,
    renderer = null,
    onSelect,
    onCancel,
  } = options;

  const state = getOrCreatePickerState(popupId);
  const sprites = metadata.sprites || [];

  // Get texture preview info
  const textureInfo = renderer ? getOrLoadTexturePreview(textureAsset, renderer) : null;

  ImGui.SetNextWindowSize({ x: 700, y: 500 }, ImGui.Cond.FirstUseEver);

  let isOpen = true;

  if (ImGui.BeginPopupModal(popupId, null, ImGui.WindowFlags.None)) {
    // Title and texture info
    ImGui.Text('Select Sprite');
    ImGui.SameLine();
    ImGui.TextDisabled(`(${sprites.length} sprites)`);
    ImGui.Separator();

    // Search bar
    ImGui.SetNextItemWidth(200);
    const searchBuffer: [string] = [state.searchQuery];
    ImGui.InputTextWithHint('##spriteSearch', 'Search sprites...', searchBuffer, 256);
    state.searchQuery = searchBuffer[0];

    // Preview size slider
    ImGui.SameLine();
    ImGui.Text('Size:');
    ImGui.SameLine();
    ImGui.SetNextItemWidth(100);
    const sizeArr: [number] = [state.previewSize];
    if (ImGui.SliderInt('##spritePreviewSize', sizeArr, 100, 300)) {
      state.previewSize = sizeArr[0];
    }

    ImGui.Separator();

    // Filter sprites
    const filteredSprites = filterSprites(sprites, state.searchQuery);

    // Sprite grid with dynamic sizing
    const buttonSize = state.previewSize;
    const windowWidth = ImGui.GetWindowWidth();
    const itemSpacing = 8;
    const itemsPerRow = Math.max(1, Math.floor((windowWidth - 20) / (buttonSize + itemSpacing)));

    ImGui.BeginChild('SpriteGrid', { x: 0, y: -40 }, ImGui.WindowFlags.None);

    if (filteredSprites.length === 0) {
      ImGui.TextDisabled('No sprites found');
      if (state.searchQuery) {
        ImGui.TextDisabled('Try a different search term');
      }
    } else {
      for (let i = 0; i < filteredSprites.length; i++) {
        const sprite = filteredSprites[i];
        if (!sprite) continue;

        if (i > 0 && i % itemsPerRow !== 0) {
          ImGui.SameLine();
        }

        // Determine if this sprite is selected
        let isSelected = currentSprite?.id === sprite.id;

        // Also check by tile index or rect match
        if (!isSelected && isTiledSpriteDefinition(sprite)) {
          isSelected = currentTileIndex === sprite.tileIndex;
        } else if (!isSelected && isRectSpriteDefinition(sprite) && currentSpriteRect) {
          isSelected =
            sprite.x === currentSpriteRect.x &&
            sprite.y === currentSpriteRect.y &&
            sprite.width === currentSpriteRect.width &&
            sprite.height === currentSpriteRect.height;
        }

        if (renderSpriteItem(sprite, buttonSize, isSelected, textureInfo, renderer)) {
          onSelect(sprite);
          ImGui.CloseCurrentPopup();
          isOpen = false;
        }
      }
    }

    ImGui.EndChild();

    // Footer
    ImGui.Separator();

    ImGui.TextDisabled(`${filteredSprites.length} sprites`);
    ImGui.SameLine();

    const cancelButtonWidth = 80;
    ImGui.SetCursorPosX(ImGui.GetWindowWidth() - cancelButtonWidth - 10);

    if (ImGui.Button('Cancel', { x: cancelButtonWidth, y: 0 })) {
      onCancel?.();
      ImGui.CloseCurrentPopup();
      isOpen = false;
    }

    ImGui.EndPopup();
  } else {
    isOpen = false;
  }

  return isOpen;
}

/**
 * Open the sprite picker popup
 */
export function openSpritePicker(popupId: string): void {
  const state = getOrCreatePickerState(popupId);
  state.searchQuery = '';
  ImGui.OpenPopup(popupId);
}
