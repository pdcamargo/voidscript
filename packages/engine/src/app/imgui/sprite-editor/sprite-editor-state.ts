/**
 * Sprite Editor State Management
 *
 * Manages the state for the sprite editor panel including texture selection,
 * sprite editing, and manifest saving.
 *
 * Note: Mouse-based interaction (drawing rectangles) was removed because
 * jsimgui doesn't support GetCursorScreenPos(), GetItemRectMin(), or
 * GetWindowPos() which are needed for reliable coordinate conversion.
 * Sprite creation is now done via form inputs in the properties panel.
 */

import type { SpriteDefinition, TextureMetadata } from '../../../ecs/asset-metadata.js';
import { AssetDatabase } from '../../../ecs/asset-database.js';
import { isTextureMetadata } from '../../../ecs/asset-metadata.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Cached texture info for ImGui rendering
 */
export interface CachedTextureInfo {
  /** ImGui texture ID */
  textureId: bigint;
  /** Texture width in pixels */
  width: number;
  /** Texture height in pixels */
  height: number;
}

/**
 * Complete state for the sprite editor panel
 */
export interface SpriteEditorState {
  /** Selected texture GUID */
  selectedTextureGuid: string | null;

  /** Cached texture info for rendering */
  textureInfo: CachedTextureInfo | null;

  /** Selected sprite index in the sprites array */
  selectedSpriteIndex: number | null;

  /** Zoom level (1.0 = 100%) */
  zoom: number;

  /** Pan offset for scrolling the texture view */
  panOffset: { x: number; y: number };

  /** Whether there are unsaved changes */
  isDirty: boolean;

  /** Path to the manifest file (for saving) */
  manifestPath: string | null;

  /** Whether the sprite list is collapsed */
  spriteListCollapsed: boolean;
}

// ============================================================================
// Module State
// ============================================================================

let editorState: SpriteEditorState | null = null;
let idCounter = 0;

// ============================================================================
// State Access
// ============================================================================

/**
 * Get the current sprite editor state, creating it if needed
 */
export function getSpriteEditorState(): SpriteEditorState {
  if (!editorState) {
    editorState = createDefaultState();
  }
  return editorState;
}

/**
 * Create a fresh default state
 */
function createDefaultState(): SpriteEditorState {
  return {
    selectedTextureGuid: null,
    textureInfo: null,
    selectedSpriteIndex: null,
    zoom: 1.0,
    panOffset: { x: 0, y: 0 },
    isDirty: false,
    manifestPath: null,
    spriteListCollapsed: false,
  };
}

/**
 * Reset the sprite editor state
 */
export function resetSpriteEditorState(): void {
  editorState = createDefaultState();
}

// ============================================================================
// Texture Selection
// ============================================================================

/**
 * Select a texture by GUID
 */
export function selectTexture(guid: string | null): void {
  const state = getSpriteEditorState();

  if (guid === state.selectedTextureGuid) return;

  state.selectedTextureGuid = guid;
  state.selectedSpriteIndex = null;
  state.textureInfo = null; // Will be populated when texture is loaded for rendering
  state.zoom = 1.0;
  state.panOffset = { x: 0, y: 0 };
}

/**
 * Get the metadata for the currently selected texture
 */
export function getSelectedTextureMetadata(): TextureMetadata | null {
  const state = getSpriteEditorState();

  if (!state.selectedTextureGuid) return null;

  const metadata = AssetDatabase.getMetadata(state.selectedTextureGuid);
  if (metadata && isTextureMetadata(metadata)) {
    return metadata;
  }

  return null;
}

/**
 * Set the cached texture info for ImGui rendering
 */
export function setTextureInfo(info: CachedTextureInfo | null): void {
  const state = getSpriteEditorState();
  state.textureInfo = info;
}

// ============================================================================
// Sprite Selection & Management
// ============================================================================

/**
 * Select a sprite by index
 */
export function selectSprite(index: number | null): void {
  const state = getSpriteEditorState();
  state.selectedSpriteIndex = index;
}

/**
 * Get the currently selected sprite
 */
export function getSelectedSprite(): SpriteDefinition | null {
  const state = getSpriteEditorState();
  const metadata = getSelectedTextureMetadata();

  if (!metadata || state.selectedSpriteIndex === null) return null;

  const sprites = metadata.sprites ?? [];
  return sprites[state.selectedSpriteIndex] ?? null;
}

/**
 * Add a new sprite to the texture
 */
export function addNewSprite(
  x: number,
  y: number,
  width: number,
  height: number,
): SpriteDefinition | null {
  const state = getSpriteEditorState();
  const metadata = getSelectedTextureMetadata();

  if (!metadata) return null;

  // Ensure sprites array exists
  if (!metadata.sprites) {
    metadata.sprites = [];
  }

  // Generate unique ID
  const id = `sprite-${++idCounter}-${Date.now().toString(36)}`;
  const name = `Sprite ${metadata.sprites.length + 1}`;

  const newSprite: SpriteDefinition = {
    id,
    name,
    x,
    y,
    width,
    height,
  };

  metadata.sprites.push(newSprite);

  // Select the new sprite
  state.selectedSpriteIndex = metadata.sprites.length - 1;

  markDirty();

  return newSprite;
}

/**
 * Delete the selected sprite
 */
export function deleteSelectedSprite(): boolean {
  const state = getSpriteEditorState();
  const metadata = getSelectedTextureMetadata();

  if (!metadata || state.selectedSpriteIndex === null) return false;

  const sprites = metadata.sprites ?? [];
  if (state.selectedSpriteIndex >= sprites.length) return false;

  sprites.splice(state.selectedSpriteIndex, 1);

  // Adjust selection
  if (sprites.length === 0) {
    state.selectedSpriteIndex = null;
  } else if (state.selectedSpriteIndex >= sprites.length) {
    state.selectedSpriteIndex = sprites.length - 1;
  }

  markDirty();

  return true;
}

/**
 * Update a sprite's properties
 */
export function updateSprite(
  index: number,
  updates: Partial<SpriteDefinition>,
): boolean {
  const metadata = getSelectedTextureMetadata();

  if (!metadata || !metadata.sprites) return false;

  const sprite = metadata.sprites[index];
  if (!sprite) return false;

  // Apply updates
  Object.assign(sprite, updates);

  markDirty();

  return true;
}

// ============================================================================
// Zoom and Pan
// ============================================================================

/**
 * Set zoom level
 */
export function setZoom(zoom: number): void {
  const state = getSpriteEditorState();
  state.zoom = Math.max(0.25, Math.min(4.0, zoom));
}

/**
 * Adjust zoom by a factor
 */
export function adjustZoom(delta: number): void {
  const state = getSpriteEditorState();
  setZoom(state.zoom + delta);
}

/**
 * Set pan offset
 */
export function setPanOffset(x: number, y: number): void {
  const state = getSpriteEditorState();
  state.panOffset = { x, y };
}

// ============================================================================
// Dirty State
// ============================================================================

/**
 * Mark the state as dirty (has unsaved changes)
 */
export function markDirty(): void {
  const state = getSpriteEditorState();
  state.isDirty = true;
}

/**
 * Mark the state as clean (no unsaved changes)
 */
export function markClean(): void {
  const state = getSpriteEditorState();
  state.isDirty = false;
}

// ============================================================================
// Manifest Path
// ============================================================================

/**
 * Set the manifest path
 */
export function setManifestPath(path: string | null): void {
  const state = getSpriteEditorState();
  state.manifestPath = path;
}

/**
 * Get the manifest path
 */
export function getManifestPath(): string | null {
  const state = getSpriteEditorState();
  return state.manifestPath;
}

// ============================================================================
// Utility
// ============================================================================

/**
 * Find sprite at a given texture coordinate
 */
export function findSpriteAtPosition(
  textureX: number,
  textureY: number,
): number | null {
  const metadata = getSelectedTextureMetadata();

  if (!metadata || !metadata.sprites) return null;

  // Search in reverse order (later sprites are on top)
  for (let i = metadata.sprites.length - 1; i >= 0; i--) {
    const sprite = metadata.sprites[i]!;

    let spriteX: number, spriteY: number, spriteW: number, spriteH: number;

    if ('x' in sprite && 'y' in sprite && 'width' in sprite && 'height' in sprite) {
      // Rect-based sprite
      spriteX = sprite.x;
      spriteY = sprite.y;
      spriteW = sprite.width;
      spriteH = sprite.height;
    } else if ('tileIndex' in sprite && 'tileWidth' in sprite && 'tileHeight' in sprite) {
      // Tile-based sprite
      const tilesPerRow = metadata.width
        ? Math.floor(metadata.width / sprite.tileWidth)
        : 1;
      spriteX = (sprite.tileIndex % tilesPerRow) * sprite.tileWidth;
      spriteY = Math.floor(sprite.tileIndex / tilesPerRow) * sprite.tileHeight;
      spriteW = sprite.tileWidth;
      spriteH = sprite.tileHeight;
    } else {
      continue;
    }

    // Check if point is inside sprite bounds
    if (
      textureX >= spriteX &&
      textureX < spriteX + spriteW &&
      textureY >= spriteY &&
      textureY < spriteY + spriteH
    ) {
      return i;
    }
  }

  return null;
}

/**
 * Get sprite bounds for rendering
 */
export function getSpriteBounds(
  sprite: SpriteDefinition,
  textureWidth: number,
  textureHeight: number,
): { x: number; y: number; width: number; height: number } {
  if ('x' in sprite && 'y' in sprite && 'width' in sprite && 'height' in sprite) {
    // Rect-based sprite
    return {
      x: sprite.x,
      y: sprite.y,
      width: sprite.width,
      height: sprite.height,
    };
  } else if ('tileIndex' in sprite && 'tileWidth' in sprite && 'tileHeight' in sprite) {
    // Tile-based sprite
    const tilesPerRow = textureWidth ? Math.floor(textureWidth / sprite.tileWidth) : 1;
    return {
      x: (sprite.tileIndex % tilesPerRow) * sprite.tileWidth,
      y: Math.floor(sprite.tileIndex / tilesPerRow) * sprite.tileHeight,
      width: sprite.tileWidth,
      height: sprite.tileHeight,
    };
  }

  // Fallback
  return { x: 0, y: 0, width: textureWidth, height: textureHeight };
}
