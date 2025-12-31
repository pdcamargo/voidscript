/**
 * Sprite Editor Panel - Unity-style visual sprite region editor
 *
 * Features:
 * - Visual texture display with zoom control
 * - Form-based sprite creation (X, Y, Width, Height inputs)
 * - Property editing for sprite bounds, ID, name, and pivot
 * - Save changes back to asset manifest
 *
 * Note: Mouse-based interaction was removed because jsimgui doesn't support
 * GetCursorScreenPos(), GetItemRectMin(), or GetWindowPos() which are needed
 * to convert mouse coordinates to texture coordinates reliably.
 */

import { ImGui, ImGuiImplWeb, ImTextureRef } from '@mori2003/jsimgui';
import { AssetDatabase } from '../../../ecs/asset-database.js';
import {
  isTextureMetadata,
  isTiledSpriteDefinition,
  isRectSpriteDefinition,
  type RectSpriteDefinition,
  type SpriteDefinition,
} from '../../../ecs/asset-metadata.js';
import { RuntimeAssetManager } from '../../../ecs/runtime-asset-manager.js';
import * as THREE from 'three';

import {
  getSpriteEditorState,
  selectTexture,
  selectSprite,
  setTextureInfo,
  getSelectedTextureMetadata,
  getSelectedSprite,
  setZoom,
  markDirty,
  markClean,
  deleteSelectedSprite,
  updateSprite,
  type CachedTextureInfo,
} from './sprite-editor-state.js';

import type { EditorPlatform } from '../../../editor/editor-platform.js';
import { EditorLayout } from '../editor-layout.js';

// ============================================================================
// Texture Cache
// ============================================================================

const textureCache = new Map<string, CachedTextureInfo>();
const pendingLoads = new Set<string>();

// Checkered background texture for transparency
let checkeredTextureId: bigint | null = null;
let checkeredTexture: THREE.DataTexture | null = null;

/**
 * Create a checkered background pattern for transparency preview
 */
function createCheckeredTexture(): THREE.DataTexture {
  const size = 16;
  const data = new Uint8Array(size * size * 4);

  const dark = 40;
  const light = 60;

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
 * Get checkered background texture ID
 */
function getCheckeredTextureId(renderer: THREE.WebGLRenderer): bigint | null {
  if (checkeredTextureId !== null) {
    return checkeredTextureId;
  }

  if (!checkeredTexture) {
    checkeredTexture = createCheckeredTexture();
  }

  renderer.initTexture(checkeredTexture);

  const textureProps = renderer.properties.get(checkeredTexture) as {
    __webglTexture?: WebGLTexture;
  };
  const webglTexture = textureProps.__webglTexture;

  if (!webglTexture) return null;

  checkeredTextureId = ImGuiImplWeb.LoadTexture(undefined, {
    processFn: () => webglTexture,
  });

  return checkeredTextureId;
}

/**
 * Load and cache texture for ImGui rendering
 */
function loadTextureForDisplay(
  guid: string,
  renderer: THREE.WebGLRenderer,
): CachedTextureInfo | null {
  // Check cache
  const cached = textureCache.get(guid);
  if (cached) return cached;

  // Check if loading
  if (pendingLoads.has(guid)) return null;

  // Get metadata
  const metadata = AssetDatabase.getMetadata(guid);
  if (!metadata || !isTextureMetadata(metadata)) return null;

  // Get RuntimeAsset to load
  const runtimeAsset = RuntimeAssetManager.get().getOrCreate(
    guid,
    metadata,
  ) as import('../../../ecs/runtime-asset.js').RuntimeAsset<THREE.Texture>;

  if (!runtimeAsset.isLoaded) {
    pendingLoads.add(guid);
    runtimeAsset
      .load()
      .then(() => {
        pendingLoads.delete(guid);

        if (!runtimeAsset.data || !runtimeAsset.data.image) {
          console.warn(
            `[SpriteEditor] Texture ${guid} loaded but has no image data`,
          );
          return;
        }

        initTextureCache(guid, runtimeAsset.data, renderer);
      })
      .catch((error) => {
        pendingLoads.delete(guid);
        console.error(`[SpriteEditor] Failed to load texture ${guid}:`, error);
      });
    return null;
  }

  // Already loaded
  if (runtimeAsset.data) {
    initTextureCache(guid, runtimeAsset.data, renderer);
    return textureCache.get(guid) ?? null;
  }

  return null;
}

function initTextureCache(
  guid: string,
  threeTexture: THREE.Texture,
  renderer: THREE.WebGLRenderer,
): void {
  try {
    if (textureCache.has(guid)) return;
    if (!threeTexture.image) return;

    renderer.initTexture(threeTexture);

    const textureProps = renderer.properties.get(threeTexture) as {
      __webglTexture?: WebGLTexture;
    };
    const webglTexture = textureProps.__webglTexture;

    if (!webglTexture) {
      console.warn(`[SpriteEditor] No WebGL texture for ${guid}`);
      return;
    }

    const textureId = ImGuiImplWeb.LoadTexture(undefined, {
      processFn: () => webglTexture,
    });

    const image = threeTexture.image as { width?: number; height?: number };
    const width = image.width || 64;
    const height = image.height || 64;

    textureCache.set(guid, { textureId, width, height });
  } catch (error) {
    console.error(
      `[SpriteEditor] Error initializing texture cache for ${guid}:`,
      error,
    );
  }
}

// ============================================================================
// Panel Visibility
// ============================================================================

// Panel visibility is managed by animation-editor-state.ts via isPanelVisible('spriteEditor')
// These functions are kept for API compatibility but delegate to the central system
import {
  isPanelVisible,
  setPanelVisible,
} from '../animation-editor/animation-editor-state.js';

export function isSpriteEditorOpen(): boolean {
  return isPanelVisible('spriteEditor');
}

export function openSpriteEditor(): void {
  setPanelVisible('spriteEditor', true);
}

export function closeSpriteEditor(): void {
  setPanelVisible('spriteEditor', false);
}

export function toggleSpriteEditor(): void {
  setPanelVisible('spriteEditor', !isPanelVisible('spriteEditor'));
}

// ============================================================================
// Main Panel Render
// ============================================================================

/**
 * Options for the sprite editor panel
 */
export interface SpriteEditorPanelOptions {
  /** Platform for file operations */
  platform: EditorPlatform | null;
  /** Three.js renderer */
  renderer: THREE.WebGLRenderer;
  /** Path to asset manifest (from ApplicationConfig.assetsManifest) */
  assetsManifest?: string;
}

/**
 * Render the Sprite Editor panel
 * Note: Visibility is controlled by the calling code (editor-layer.ts) via isPanelVisible('spriteEditor')
 */
export function renderSpriteEditorPanel(options: SpriteEditorPanelOptions): void {
  const { platform, renderer, assetsManifest } = options;
  const state = getSpriteEditorState();

  ImGui.SetNextWindowSize({ x: 900, y: 600 }, ImGui.Cond.FirstUseEver);
  ImGui.SetNextWindowSizeConstraints(
    { x: 400, y: 300 },
    { x: 10000, y: 10000 },
  );

  const windowFlags = ImGui.WindowFlags.MenuBar;

  const open: [boolean] = [true];
  if (ImGui.Begin('Sprite Editor###SpriteEditor', open, windowFlags)) {
    // Menu bar
    renderMenuBar(state, platform, assetsManifest);

    // Toolbar
    renderToolbar(state, renderer);

    ImGui.Separator();

    // Main content area - split horizontally
    // Note: GetContentRegionAvail() doesn't work in jsimgui, so we calculate manually
    const windowHeight = ImGui.GetWindowHeight();
    const cursorY = ImGui.GetCursorPosY();
    const availableHeight = Math.max(100, windowHeight - cursorY - 8); // 8px padding

    // Left: Texture viewer
    ImGui.BeginChild(
      'TextureViewerArea',
      { x: -280, y: availableHeight },
      ImGui.ChildFlags.Borders,
    );
    renderTextureViewer(state, renderer);
    ImGui.EndChild();

    ImGui.SameLine();

    // Right: Sprite properties
    ImGui.BeginChild(
      'SpritePropertiesArea',
      { x: 0, y: availableHeight },
      ImGui.ChildFlags.Borders,
    );
    renderSpriteProperties(state);
    ImGui.EndChild();

    // Render popups (must be inside the window)
    renderGridCreationPopup();
  }
  ImGui.End();

  if (!open[0]) {
    closeSpriteEditor();
  }
}

// ============================================================================
// Menu Bar
// ============================================================================

function renderMenuBar(
  state: ReturnType<typeof getSpriteEditorState>,
  platform: EditorPlatform | null,
  assetsManifest?: string,
): void {
  if (ImGui.BeginMenuBar()) {
    if (ImGui.BeginMenu('File')) {
      if (
        ImGui.MenuItem(
          'Save to Manifest',
          'Ctrl+S',
          false,
          state.isDirty && !!platform,
        )
      ) {
        saveManifest(state, platform!, assetsManifest);
      }
      ImGui.EndMenu();
    }

    if (ImGui.BeginMenu('Edit')) {
      if (
        ImGui.MenuItem(
          'Delete Sprite',
          'Delete',
          false,
          state.selectedSpriteIndex !== null,
        )
      ) {
        deleteSelectedSprite();
      }
      ImGui.EndMenu();
    }

    if (ImGui.BeginMenu('Utilities')) {
      if (ImGui.MenuItem('Create Sprites by Grid...', '', false, !!state.selectedTextureGuid)) {
        showGridCreationPopup = true;
      }
      ImGui.EndMenu();
    }

    ImGui.EndMenuBar();
  }
}

// ============================================================================
// Toolbar
// ============================================================================

function renderToolbar(
  state: ReturnType<typeof getSpriteEditorState>,
  renderer: THREE.WebGLRenderer,
): void {
  // Texture selector
  ImGui.Text('Texture:');
  ImGui.SameLine();

  // Get all texture GUIDs
  const textureGuids = AssetDatabase.getAllGuids().filter((guid) => {
    const meta = AssetDatabase.getMetadata(guid);
    return meta && isTextureMetadata(meta);
  });

  const currentTextureName = state.selectedTextureGuid
    ? (AssetDatabase.getMetadata(state.selectedTextureGuid)
        ?.path.split('/')
        .pop() ?? 'Unknown')
    : '(Select Texture)';

  ImGui.SetNextItemWidth(200);
  if (ImGui.BeginCombo('##TextureSelect', currentTextureName)) {
    for (const guid of textureGuids) {
      const meta = AssetDatabase.getMetadata(guid);
      if (meta) {
        const name = meta.path.split('/').pop() ?? guid;
        if (ImGui.Selectable(name, guid === state.selectedTextureGuid)) {
          selectTexture(guid);

          // Load texture info
          const info = loadTextureForDisplay(guid, renderer);
          if (info) {
            setTextureInfo(info);
          }
        }
      }
    }
    ImGui.EndCombo();
  }

  ImGui.SameLine();

  // Zoom control
  ImGui.Text('Zoom:');
  ImGui.SameLine();
  ImGui.SetNextItemWidth(100);
  const zoomArr: [number] = [state.zoom * 100];
  if (ImGui.SliderFloat('##Zoom', zoomArr, 25, 400, '%.0f%%')) {
    setZoom(zoomArr[0] / 100);
  }

  ImGui.SameLine();

  // Dirty indicator
  if (state.isDirty) {
    ImGui.TextColored({ x: 1.0, y: 0.5, z: 0.2, w: 1.0 }, '(unsaved)');
  }
}

// ============================================================================
// Texture Viewer
// ============================================================================

function renderTextureViewer(
  state: ReturnType<typeof getSpriteEditorState>,
  renderer: THREE.WebGLRenderer,
): void {
  if (!state.selectedTextureGuid) {
    ImGui.TextDisabled('No texture selected');
    ImGui.TextDisabled('Select a texture from the dropdown above');
    return;
  }

  // Try to load texture if not cached
  let textureInfo = state.textureInfo;
  if (!textureInfo) {
    textureInfo = loadTextureForDisplay(state.selectedTextureGuid, renderer);
    if (textureInfo) {
      setTextureInfo(textureInfo);
    }
  }

  if (!textureInfo) {
    ImGui.TextDisabled('Loading texture...');
    return;
  }

  const { textureId, width, height } = textureInfo;
  const metadata = getSelectedTextureMetadata();
  const sprites = metadata?.sprites ?? [];

  // Calculate display size
  const displayWidth = width * state.zoom;
  const displayHeight = height * state.zoom;

  // Get cursor start position (window-local)
  const cursorStartX = ImGui.GetCursorPosX();
  const cursorStartY = ImGui.GetCursorPosY();

  // Draw checkered background
  const checkeredId = getCheckeredTextureId(renderer);
  if (checkeredId !== null) {
    ImGui.Image(
      new ImTextureRef(checkeredId),
      { x: displayWidth, y: displayHeight },
      { x: 0, y: 0 },
      { x: displayWidth / 16, y: displayHeight / 16 },
    );
  }

  // Overlay texture
  ImGui.SetCursorPos({ x: cursorStartX, y: cursorStartY });
  ImGui.Image(
    new ImTextureRef(textureId),
    { x: displayWidth, y: displayHeight },
    { x: 0, y: 1 }, // Flip Y for WebGL
    { x: 1, y: 0 },
  );

  // Draw sprite boundaries using colored rectangles
  // We use Dummy + colored rectangles overlay approach since DrawList requires screen coords
  if (sprites.length > 0) {
    for (let i = 0; i < sprites.length; i++) {
      const sprite = sprites[i]!;
      const bounds = getSpriteBoundsForDisplay(sprite, width, height);
      const isSelected = i === state.selectedSpriteIndex;

      // Calculate display position for this sprite
      const spriteDisplayX = cursorStartX + bounds.x * state.zoom;
      const spriteDisplayY = cursorStartY + bounds.y * state.zoom;
      const spriteDisplayW = bounds.width * state.zoom;
      const spriteDisplayH = bounds.height * state.zoom;

      // Draw border using 4 thin rectangles (top, bottom, left, right)
      const thickness = isSelected ? 2 : 1;
      const color = isSelected
        ? { x: 0.4, y: 0.7, z: 1.0, w: 1.0 } // Blue
        : { x: 0.8, y: 0.8, z: 0.8, w: 0.7 }; // Light gray

      // Top edge
      ImGui.SetCursorPos({ x: spriteDisplayX, y: spriteDisplayY });
      ImGui.PushStyleColorImVec4(ImGui.Col.Button, color);
      ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, color);
      ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, color);
      ImGui.PushStyleVarImVec2(ImGui.StyleVar.FramePadding, { x: 0, y: 0 });
      ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 0);
      ImGui.Button(`##top${i}`, { x: spriteDisplayW, y: thickness });
      ImGui.PopStyleVar(2);
      ImGui.PopStyleColor(3);

      // Bottom edge
      ImGui.SetCursorPos({
        x: spriteDisplayX,
        y: spriteDisplayY + spriteDisplayH - thickness,
      });
      ImGui.PushStyleColorImVec4(ImGui.Col.Button, color);
      ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, color);
      ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, color);
      ImGui.PushStyleVarImVec2(ImGui.StyleVar.FramePadding, { x: 0, y: 0 });
      ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 0);
      ImGui.Button(`##bot${i}`, { x: spriteDisplayW, y: thickness });
      ImGui.PopStyleVar(2);
      ImGui.PopStyleColor(3);

      // Left edge
      ImGui.SetCursorPos({ x: spriteDisplayX, y: spriteDisplayY });
      ImGui.PushStyleColorImVec4(ImGui.Col.Button, color);
      ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, color);
      ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, color);
      ImGui.PushStyleVarImVec2(ImGui.StyleVar.FramePadding, { x: 0, y: 0 });
      ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 0);
      ImGui.Button(`##left${i}`, { x: thickness, y: spriteDisplayH });
      ImGui.PopStyleVar(2);
      ImGui.PopStyleColor(3);

      // Right edge
      ImGui.SetCursorPos({
        x: spriteDisplayX + spriteDisplayW - thickness,
        y: spriteDisplayY,
      });
      ImGui.PushStyleColorImVec4(ImGui.Col.Button, color);
      ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, color);
      ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, color);
      ImGui.PushStyleVarImVec2(ImGui.StyleVar.FramePadding, { x: 0, y: 0 });
      ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 0);
      ImGui.Button(`##right${i}`, { x: thickness, y: spriteDisplayH });
      ImGui.PopStyleVar(2);
      ImGui.PopStyleColor(3);

      // Draw pivot point crosshair for selected sprite
      if (isSelected) {
        const pivot = sprite.pivot ?? { x: 0.5, y: 0.5 };
        const pivotX = spriteDisplayX + spriteDisplayW * pivot.x;
        const pivotY = spriteDisplayY + spriteDisplayH * pivot.y;

        const pivotColor = { x: 1.0, y: 0.4, z: 0.0, w: 1.0 }; // Orange
        const pivotSize = 6;
        const pivotThickness = 2;

        // Horizontal line of crosshair
        ImGui.SetCursorPos({ x: pivotX - pivotSize, y: pivotY - pivotThickness / 2 });
        ImGui.PushStyleColorImVec4(ImGui.Col.Button, pivotColor);
        ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, pivotColor);
        ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, pivotColor);
        ImGui.PushStyleVarImVec2(ImGui.StyleVar.FramePadding, { x: 0, y: 0 });
        ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 0);
        ImGui.Button(`##pivotH${i}`, { x: pivotSize * 2, y: pivotThickness });
        ImGui.PopStyleVar(2);
        ImGui.PopStyleColor(3);

        // Vertical line of crosshair
        ImGui.SetCursorPos({ x: pivotX - pivotThickness / 2, y: pivotY - pivotSize });
        ImGui.PushStyleColorImVec4(ImGui.Col.Button, pivotColor);
        ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, pivotColor);
        ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, pivotColor);
        ImGui.PushStyleVarImVec2(ImGui.StyleVar.FramePadding, { x: 0, y: 0 });
        ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 0);
        ImGui.Button(`##pivotV${i}`, { x: pivotThickness, y: pivotSize * 2 });
        ImGui.PopStyleVar(2);
        ImGui.PopStyleColor(3);
      }
    }
  }
}

/**
 * Get sprite bounds for display (in texture pixel coordinates)
 */
function getSpriteBoundsForDisplay(
  sprite: SpriteDefinition,
  textureWidth: number,
  textureHeight: number,
): { x: number; y: number; width: number; height: number } {
  if (isRectSpriteDefinition(sprite)) {
    return {
      x: sprite.x,
      y: sprite.y,
      width: sprite.width,
      height: sprite.height,
    };
  } else if (isTiledSpriteDefinition(sprite)) {
    const tilesPerRow = Math.floor(textureWidth / sprite.tileWidth) || 1;
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

// Form state for adding new sprites
let newSpriteX = 0;
let newSpriteY = 0;
let newSpriteWidth = 32;
let newSpriteHeight = 32;

// Grid creation form state
let gridCols = 4;
let gridRows = 4;
let showGridCreationPopup = false;

// ============================================================================
// Grid Creation Popup
// ============================================================================

function renderGridCreationPopup(): void {
  const state = getSpriteEditorState();
  const metadata = getSelectedTextureMetadata();
  if (!metadata || !state.selectedTextureGuid) return;

  // Get actual texture dimensions from the loaded texture cache (not metadata)
  const cachedInfo = textureCache.get(state.selectedTextureGuid);
  const textureWidth = cachedInfo?.width ?? 0;
  const textureHeight = cachedInfo?.height ?? 0;

  if (!metadata.sprites) {
    metadata.sprites = [];
  }

  // Open popup if flag is set
  if (showGridCreationPopup) {
    ImGui.OpenPopup('Create Sprites by Grid###GridCreationPopup');
    showGridCreationPopup = false;
  }

  // Center the popup
  const mainViewport = ImGui.GetMainViewport();
  ImGui.SetNextWindowPos(
    {
      x: mainViewport.Pos.x + mainViewport.Size.x / 2,
      y: mainViewport.Pos.y + mainViewport.Size.y / 2,
    },
    ImGui.Cond.Appearing,
    { x: 0.5, y: 0.5 },
  );
  ImGui.SetNextWindowSize({ x: 300, y: 0 }, ImGui.Cond.Appearing);

  if (
    ImGui.BeginPopupModal(
      'Create Sprites by Grid###GridCreationPopup',
      undefined,
      ImGui.WindowFlags.AlwaysAutoResize,
    )
  ) {
    // Check if we have texture dimensions from the loaded texture
    if (textureWidth === 0 || textureHeight === 0) {
      EditorLayout.warning('Texture not loaded yet.');
      EditorLayout.textDisabled('Wait for the texture to finish loading.');
      EditorLayout.spacing();
      if (EditorLayout.button('Close', { width: -1 })) {
        ImGui.CloseCurrentPopup();
      }
      ImGui.EndPopup();
      return;
    }

    // Get texture name for sprite naming
    const textureName =
      metadata.path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'Texture';

    // Show texture info
    EditorLayout.textDisabled(`Texture: ${textureWidth} x ${textureHeight}`);
    EditorLayout.separator();

    // Use label width alignment for consistent layout
    EditorLayout.beginLabelsWidth(['Columns', 'Rows']);

    // Columns input
    const [newCols, colsChanged] = EditorLayout.integerField(
      'Columns',
      gridCols,
      {
        min: 1,
        max: textureWidth,
        speed: 1,
      },
    );
    if (colsChanged) gridCols = newCols;

    // Rows input
    const [newRows, rowsChanged] = EditorLayout.integerField('Rows', gridRows, {
      min: 1,
      max: textureHeight,
      speed: 1,
    });
    if (rowsChanged) gridRows = newRows;

    EditorLayout.endLabelsWidth();

    // Calculate tile sizes from texture dimensions
    const tileWidth = Math.floor(textureWidth / gridCols);
    const tileHeight = Math.floor(textureHeight / gridRows);

    EditorLayout.separator();

    // Preview info
    const totalSprites = gridCols * gridRows;
    EditorLayout.textDisabled(`Tile size: ${tileWidth} x ${tileHeight}`);
    EditorLayout.textDisabled(`Will create ${totalSprites} sprites`);

    EditorLayout.spacing();

    // Buttons row
    if (
      EditorLayout.styledButton('Generate', {
        width: 120,
        color: { r: 0.2, g: 0.5, b: 0.7 },
        hoverColor: { r: 0.3, g: 0.6, b: 0.8 },
      })
    ) {
      const startIndex = metadata.sprites!.length;
      const baseTime = Date.now().toString(36);

      for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
          const index = row * gridCols + col;
          const globalIndex = startIndex + index + 1;

          const newSprite: RectSpriteDefinition = {
            id: `sprite-${baseTime}-${index}`,
            name: `${textureName} Sprite ${globalIndex}`,
            x: col * tileWidth,
            y: row * tileHeight,
            width: tileWidth,
            height: tileHeight,
          };
          metadata.sprites!.push(newSprite);
        }
      }

      // Select the first newly created sprite
      selectSprite(startIndex);
      markDirty();
      ImGui.CloseCurrentPopup();
    }

    EditorLayout.sameLine();

    if (EditorLayout.button('Cancel', { width: 120 })) {
      ImGui.CloseCurrentPopup();
    }

    ImGui.EndPopup();
  }
}

// ============================================================================
// Sprite Properties Panel
// ============================================================================

function renderSpriteProperties(
  state: ReturnType<typeof getSpriteEditorState>,
): void {
  const metadata = getSelectedTextureMetadata();

  if (!metadata) {
    ImGui.TextDisabled('No texture selected');
    return;
  }

  const sprites = metadata.sprites ?? [];

  // ========== Add Sprite Section ==========
  if (
    ImGui.CollapsingHeader(
      'New Sprite###AddSpriteHeader',
      ImGui.TreeNodeFlags.DefaultOpen,
    )
  ) {
    ImGui.Indent();

    // Position inputs
    ImGui.Text('Position:');
    ImGui.SetNextItemWidth(-1);
    const posArr: [number, number] = [newSpriteX, newSpriteY];
    if (ImGui.DragInt2('##newSpritePos', posArr, 1, 0, 4096)) {
      newSpriteX = posArr[0];
      newSpriteY = posArr[1];
    }

    // Size inputs
    ImGui.Text('Size:');
    ImGui.SetNextItemWidth(-1);
    const sizeArr: [number, number] = [newSpriteWidth, newSpriteHeight];
    if (ImGui.DragInt2('##newSpriteSize', sizeArr, 1, 1, 4096)) {
      newSpriteWidth = sizeArr[0];
      newSpriteHeight = sizeArr[1];
    }

    // Add button
    ImGui.PushStyleColorImVec4(ImGui.Col.Button, {
      x: 0.2,
      y: 0.6,
      z: 0.3,
      w: 1.0,
    });
    ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, {
      x: 0.3,
      y: 0.7,
      z: 0.4,
      w: 1.0,
    });
    if (ImGui.Button('+ Add###AddSpriteBtn', { x: -1, y: 0 })) {
      const newSprite: RectSpriteDefinition = {
        id: `sprite-${Date.now().toString(36)}`,
        name: `Sprite ${sprites.length + 1}`,
        x: newSpriteX,
        y: newSpriteY,
        width: newSpriteWidth,
        height: newSpriteHeight,
      };
      sprites.push(newSprite);
      selectSprite(sprites.length - 1);
      markDirty();
    }
    ImGui.PopStyleColor(2);

    ImGui.Unindent();
  }

  ImGui.Separator();

  // ========== Sprite List Section ==========
  ImGui.Text('Sprites');
  ImGui.SameLine();
  ImGui.TextDisabled(`(${sprites.length})`);

  ImGui.Separator();

  // Sprite list
  ImGui.BeginChild('SpriteList', { x: 0, y: 150 }, ImGui.ChildFlags.Borders);

  for (let i = 0; i < sprites.length; i++) {
    const sprite = sprites[i]!;
    const isSelected = i === state.selectedSpriteIndex;

    const typeLabel = isTiledSpriteDefinition(sprite) ? '[T]' : '[R]';

    if (ImGui.Selectable(`${typeLabel} ${sprite.name}##${i}`, isSelected)) {
      selectSprite(i);
    }
  }

  if (sprites.length === 0) {
    ImGui.TextDisabled('No sprites defined');
  }

  ImGui.EndChild();

  ImGui.Separator();

  // Selected sprite properties
  const selectedSprite = getSelectedSprite();

  if (!selectedSprite || state.selectedSpriteIndex === null) {
    ImGui.TextDisabled('No sprite selected');
    ImGui.TextDisabled('Select a sprite from the list above');
    return;
  }

  ImGui.Text('Properties');
  ImGui.Separator();

  // ID
  ImGui.Text('ID:');
  ImGui.SameLine();
  ImGui.SetNextItemWidth(-1);
  const idBuf: [string] = [selectedSprite.id];
  ImGui.InputText('##spriteId', idBuf, 128);
  if (idBuf[0] !== selectedSprite.id) {
    updateSprite(state.selectedSpriteIndex, { id: idBuf[0] });
  }

  // Name
  ImGui.Text('Name:');
  ImGui.SameLine();
  ImGui.SetNextItemWidth(-1);
  const nameBuf: [string] = [selectedSprite.name];
  ImGui.InputText('##spriteName', nameBuf, 128);
  if (nameBuf[0] !== selectedSprite.name) {
    updateSprite(state.selectedSpriteIndex, { name: nameBuf[0] });
  }

  ImGui.Separator();

  // Position/Size based on sprite type
  if (isRectSpriteDefinition(selectedSprite)) {
    // Rect-based sprite
    ImGui.Text('Position:');
    const posArr: [number, number] = [selectedSprite.x, selectedSprite.y];
    ImGui.SetNextItemWidth(-1);
    if (ImGui.DragInt2('##spritePos', posArr, 1)) {
      updateSprite(state.selectedSpriteIndex, { x: posArr[0], y: posArr[1] });
    }

    ImGui.Text('Size:');
    const sizeArr: [number, number] = [
      selectedSprite.width,
      selectedSprite.height,
    ];
    ImGui.SetNextItemWidth(-1);
    if (ImGui.DragInt2('##spriteSize', sizeArr, 1, 1, 4096)) {
      updateSprite(state.selectedSpriteIndex, {
        width: sizeArr[0],
        height: sizeArr[1],
      });
    }
  } else if (isTiledSpriteDefinition(selectedSprite)) {
    // Tile-based sprite
    ImGui.Text('Tile Index:');
    const indexArr: [number] = [selectedSprite.tileIndex];
    ImGui.SetNextItemWidth(-1);
    if (ImGui.DragInt('##tileIndex', indexArr, 1, 0, 10000)) {
      updateSprite(state.selectedSpriteIndex, { tileIndex: indexArr[0] });
    }

    ImGui.Text('Tile Size:');
    const tileSizeArr: [number, number] = [
      selectedSprite.tileWidth,
      selectedSprite.tileHeight,
    ];
    ImGui.SetNextItemWidth(-1);
    if (ImGui.DragInt2('##tileSize', tileSizeArr, 1, 1, 4096)) {
      updateSprite(state.selectedSpriteIndex, {
        tileWidth: tileSizeArr[0],
        tileHeight: tileSizeArr[1],
      });
    }
  }

  ImGui.Separator();

  // Pivot point
  ImGui.Text('Pivot:');
  const pivot = selectedSprite.pivot ?? { x: 0.5, y: 0.5 };
  const pivotArr: [number, number] = [pivot.x, pivot.y];
  ImGui.SetNextItemWidth(-1);
  if (ImGui.DragFloat2('##spritePivot', pivotArr, 0.01, 0.0, 1.0)) {
    updateSprite(state.selectedSpriteIndex, {
      pivot: { x: pivotArr[0], y: pivotArr[1] },
    });
  }

  // Pivot presets
  ImGui.Text('Presets:');
  if (ImGui.Button('Center', { x: 60, y: 0 })) {
    updateSprite(state.selectedSpriteIndex, { pivot: { x: 0.5, y: 0.5 } });
  }
  ImGui.SameLine();
  if (ImGui.Button('Top', { x: 60, y: 0 })) {
    updateSprite(state.selectedSpriteIndex, { pivot: { x: 0.5, y: 0.0 } });
  }
  ImGui.SameLine();
  if (ImGui.Button('Bottom', { x: 60, y: 0 })) {
    updateSprite(state.selectedSpriteIndex, { pivot: { x: 0.5, y: 1.0 } });
  }

  if (ImGui.Button('Left', { x: 60, y: 0 })) {
    updateSprite(state.selectedSpriteIndex, { pivot: { x: 0.0, y: 0.5 } });
  }
  ImGui.SameLine();
  if (ImGui.Button('Right', { x: 60, y: 0 })) {
    updateSprite(state.selectedSpriteIndex, { pivot: { x: 1.0, y: 0.5 } });
  }

  if (ImGui.Button('BL', { x: 38, y: 0 })) {
    updateSprite(state.selectedSpriteIndex, { pivot: { x: 0.0, y: 1.0 } });
  }
  ImGui.SameLine();
  if (ImGui.Button('BR', { x: 38, y: 0 })) {
    updateSprite(state.selectedSpriteIndex, { pivot: { x: 1.0, y: 1.0 } });
  }
  ImGui.SameLine();
  if (ImGui.Button('TL', { x: 38, y: 0 })) {
    updateSprite(state.selectedSpriteIndex, { pivot: { x: 0.0, y: 0.0 } });
  }
  ImGui.SameLine();
  if (ImGui.Button('TR', { x: 38, y: 0 })) {
    updateSprite(state.selectedSpriteIndex, { pivot: { x: 1.0, y: 0.0 } });
  }

  ImGui.Separator();

  // Delete button
  ImGui.PushStyleColorImVec4(ImGui.Col.Button, {
    x: 0.7,
    y: 0.2,
    z: 0.2,
    w: 1.0,
  });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, {
    x: 0.8,
    y: 0.3,
    z: 0.3,
    w: 1.0,
  });
  if (ImGui.Button('Delete Sprite', { x: -1, y: 0 })) {
    deleteSelectedSprite();
  }
  ImGui.PopStyleColor(2);
}

// ============================================================================
// Manifest Saving
// ============================================================================

async function saveManifest(
  state: ReturnType<typeof getSpriteEditorState>,
  platform: EditorPlatform,
  assetsManifest?: string,
): Promise<void> {
  try {
    let manifestPath = state.manifestPath;

    // Try to resolve manifest path from source assets directory if not already set
    if (!manifestPath && assetsManifest && platform.sourceAssetsDir && platform.joinPath) {
      try {
        // Strip leading / from web path to make it relative
        const relativePath = assetsManifest.startsWith('/')
          ? assetsManifest.slice(1)
          : assetsManifest;
        manifestPath = await platform.joinPath(platform.sourceAssetsDir, relativePath);
        state.manifestPath = manifestPath;
        console.log(`[SpriteEditor] Resolved manifest path: ${manifestPath}`);
      } catch (error) {
        console.warn('[SpriteEditor] Could not resolve manifest path from config:', error);
      }
    }

    // Fall back to save dialog if path still not set
    if (!manifestPath) {
      manifestPath = await platform.showSaveDialog({
        title: 'Save Asset Manifest',
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      });

      if (!manifestPath) return;

      state.manifestPath = manifestPath;
    }

    // Serialize the manifest
    const json = AssetDatabase.serializeToJson(true);

    // Write to file
    await platform.writeTextFile(manifestPath, json);

    markClean();

    console.log(`[SpriteEditor] Manifest saved to: ${manifestPath}`);
  } catch (error) {
    console.error('[SpriteEditor] Failed to save manifest:', error);
  }
}
