/**
 * Asset Browser Panel - Unity-style asset browser
 *
 * Features:
 * - Folder tree view (left panel)
 * - Asset grid with thumbnails (right panel)
 * - Search/filter with T:type prefix support
 * - Asset import from file picker
 * - Thumbnail size slider
 */

import { ImGui, ImTextureRef } from '@voidscript/imgui';
import { AssetDatabase } from '../../../ecs/asset/asset-database.js';
import { AssetType, isTextureMetadata } from '../../../ecs/asset/asset-metadata.js';
import { RuntimeAssetManager } from '@voidscript/core';
import type { EditorPlatform } from '../../../editor/editor-platform.js';
import * as THREE from 'three';

import {
  getAssetBrowserState,
  buildFolderTree,
  selectFolder,
  setFolderExpanded,
  selectAsset,
  setSearchQuery,
  getFilteredAssets,
  getThumbnail,
  getCheckeredTextureId,
  setThumbnailSize,
  openImportDialog,
  closeImportDialog,
  canImport,
  executeImport,
  detectAssetTypeFromExtension,
  getAssetTypeDisplayName,
  type FolderNode,
  type TextureImportOptions,
  type Model3DImportOptions,
} from './asset-browser-state.js';

import { getSearchHintText } from './asset-query-parser.js';

// Panel visibility is managed by animation-editor-state.ts
import {
  isPanelVisible,
  setPanelVisible,
  type PanelName,
} from '../animation-editor/animation-editor-state.js';

// ============================================================================
// Panel Visibility API
// ============================================================================

export function isAssetBrowserOpen(): boolean {
  return isPanelVisible('assetBrowser' as PanelName);
}

export function openAssetBrowser(): void {
  setPanelVisible('assetBrowser' as PanelName, true);
}

export function closeAssetBrowser(): void {
  setPanelVisible('assetBrowser' as PanelName, false);
}

export function toggleAssetBrowser(): void {
  setPanelVisible('assetBrowser' as PanelName, !isAssetBrowserOpen());
}

// ============================================================================
// Panel Options
// ============================================================================

/**
 * Options for the asset browser panel
 */
export interface AssetBrowserPanelOptions {
  /** Platform for file operations */
  platform: EditorPlatform | null;
  /** Three.js renderer */
  renderer: THREE.WebGLRenderer;
  /** Path to asset manifest (from ApplicationConfig.assetsManifest) */
  assetsManifest?: string;
}

// ============================================================================
// Main Panel Render
// ============================================================================

/**
 * Render the Asset Browser panel
 */
export function renderAssetBrowserPanel(options: AssetBrowserPanelOptions): void {
  const state = getAssetBrowserState();

  // Build folder tree if not done yet
  if (!state.rootFolder) {
    state.rootFolder = buildFolderTree();
  }

  ImGui.SetNextWindowSize({ x: 900, y: 600 }, ImGui.Cond.FirstUseEver);
  ImGui.SetNextWindowSizeConstraints({ x: 500, y: 300 }, { x: 10000, y: 10000 });

  const windowFlags = ImGui.WindowFlags.MenuBar;

  const open: [boolean] = [true];
  if (ImGui.Begin('Asset Browser###AssetBrowser', open, windowFlags)) {
    // Menu bar
    renderMenuBar(options);

    // Search bar
    renderSearchBar();

    ImGui.Separator();

    // Main content area - split horizontally
    const windowHeight = ImGui.GetWindowHeight();
    const cursorY = ImGui.GetCursorPosY();
    // Reserve space for slider at bottom (30px)
    const availableHeight = Math.max(100, windowHeight - cursorY - 50);

    // Left: Folder tree
    ImGui.BeginChild(
      'FolderTreeArea',
      { x: state.splitterPosition, y: availableHeight },
      ImGui.ChildFlags.Borders,
    );
    renderFolderTree();
    ImGui.EndChild();

    ImGui.SameLine();

    // Right: Asset grid (remaining width)
    ImGui.BeginChild('AssetGridArea', { x: 0, y: availableHeight }, ImGui.ChildFlags.Borders);
    renderAssetGrid(options);
    ImGui.EndChild();

    ImGui.Separator();

    // Bottom: Thumbnail size slider
    renderThumbnailSlider();
  }
  ImGui.End();

  // Handle close button
  if (!open[0]) {
    closeAssetBrowser();
  }

  // Render import dialog if open
  renderImportDialog(options);
}

// ============================================================================
// Menu Bar
// ============================================================================

function renderMenuBar(options: AssetBrowserPanelOptions): void {
  if (ImGui.BeginMenuBar()) {
    if (ImGui.BeginMenu('File')) {
      const canImportAsset = !!options.platform;

      if (ImGui.MenuItem('Import Asset...', 'Ctrl+I', false, canImportAsset)) {
        handleImportAsset(options);
      }

      ImGui.Separator();

      if (ImGui.MenuItem('Refresh', 'F5')) {
        const state = getAssetBrowserState();
        state.rootFolder = buildFolderTree();
      }

      ImGui.EndMenu();
    }

    ImGui.EndMenuBar();
  }
}

// ============================================================================
// Search Bar
// ============================================================================

function renderSearchBar(): void {
  const state = getAssetBrowserState();

  ImGui.Text('Search:');
  ImGui.SameLine();

  ImGui.SetNextItemWidth(-1);
  const searchBuffer: [string] = [state.searchQuery];
  ImGui.InputTextWithHint('##AssetSearch', getSearchHintText(), searchBuffer, 256);
  if (searchBuffer[0] !== state.searchQuery) {
    setSearchQuery(searchBuffer[0]);
  }
}

// ============================================================================
// Folder Tree
// ============================================================================

function renderFolderTree(): void {
  const state = getAssetBrowserState();

  if (!state.rootFolder) {
    ImGui.TextDisabled('No assets loaded');
    return;
  }

  // "All Assets" option at top
  const allSelected = state.selectedFolderPath === null;
  if (ImGui.Selectable('All Assets', allSelected)) {
    selectFolder(null);
  }

  ImGui.Separator();

  // Render folder tree recursively
  renderFolderNode(state.rootFolder);
}

function renderFolderNode(node: FolderNode): void {
  const state = getAssetBrowserState();

  // Skip empty folders with no children and no assets
  if (node.children.length === 0 && node.assetGuids.length === 0 && node.path !== '/') {
    return;
  }

  const hasChildren = node.children.length > 0;
  const isSelected = node.path === state.selectedFolderPath;
  const assetCount = countAssetsRecursive(node);

  // Build flags
  let flags = ImGui.TreeNodeFlags.OpenOnArrow | ImGui.TreeNodeFlags.SpanAvailWidth;

  if (isSelected) {
    flags |= ImGui.TreeNodeFlags.Selected;
  }

  if (!hasChildren) {
    flags |= ImGui.TreeNodeFlags.Leaf;
  }

  // Set open state
  ImGui.SetNextItemOpen(node.isExpanded, ImGui.Cond.Always);

  // Render tree node
  const label = `${node.name} (${assetCount})##${node.path}`;
  const isOpen = ImGui.TreeNodeEx(label, flags);

  // Handle click (select folder)
  if (ImGui.IsItemClicked() && !ImGui.IsItemToggledOpen()) {
    selectFolder(node.path);
  }

  // Track expansion state change
  if (isOpen !== node.isExpanded) {
    setFolderExpanded(node.path, isOpen);
  }

  // Render children if open
  if (isOpen) {
    for (const child of node.children) {
      renderFolderNode(child);
    }
    ImGui.TreePop();
  }
}

function countAssetsRecursive(node: FolderNode): number {
  let count = node.assetGuids.length;
  for (const child of node.children) {
    count += countAssetsRecursive(child);
  }
  return count;
}

// ============================================================================
// Asset Grid
// ============================================================================

function renderAssetGrid(options: AssetBrowserPanelOptions): void {
  const state = getAssetBrowserState();
  const assets = getFilteredAssets();

  if (assets.length === 0) {
    ImGui.TextDisabled('No assets found');
    if (state.searchQuery) {
      ImGui.TextDisabled(`Try a different search query`);
    }
    return;
  }

  const thumbnailSize = state.thumbnailSize;
  const padding = 8;
  const textHeight = 20;
  const cellWidth = thumbnailSize + padding * 2;
  const cellHeight = thumbnailSize + textHeight + padding * 2;

  // Calculate columns
  const windowWidth = ImGui.GetWindowWidth();
  const columns = Math.max(1, Math.floor(windowWidth / cellWidth));

  let column = 0;

  for (const guid of assets) {
    const metadata = AssetDatabase.getMetadata(guid);
    if (!metadata) continue;

    const isSelected = guid === state.selectedAssetGuid;

    // Start group for the asset cell
    ImGui.BeginGroup();

    // Calculate position for centering within cell
    const cellStartX = ImGui.GetCursorPosX();
    const cellStartY = ImGui.GetCursorPosY();

    // Selection background
    if (isSelected) {
      ImGui.PushStyleColorImVec4(ImGui.Col.ChildBg, { x: 0.2, y: 0.4, z: 0.7, w: 0.5 });
    }

    // Invisible child to capture clicks
    ImGui.BeginChild(`##asset_${guid}`, { x: cellWidth, y: cellHeight }, ImGui.ChildFlags.None);

    // Render thumbnail
    const thumbX = (cellWidth - thumbnailSize) / 2;
    ImGui.SetCursorPosX(thumbX);
    renderAssetThumbnail(guid, metadata.type, thumbnailSize, options.renderer);

    // Asset name (centered, truncated)
    const fileName = metadata.path.split('/').pop() || guid;
    const displayName = truncateName(fileName, Math.floor(cellWidth / 7));

    // Center the text
    const textWidth = displayName.length * 7; // Approximate character width
    const textX = Math.max(0, (cellWidth - textWidth) / 2);
    ImGui.SetCursorPosX(textX);
    ImGui.Text(displayName);

    // Handle clicks
    if (ImGui.IsWindowHovered()) {
      if (ImGui.IsMouseClicked(0)) {
        selectAsset(guid);
      }
      // Double-click could open in editor (future feature)
    }

    ImGui.EndChild();

    if (isSelected) {
      ImGui.PopStyleColor();
    }

    ImGui.EndGroup();

    // Layout: same line or wrap
    column++;
    if (column < columns) {
      ImGui.SameLine();
    } else {
      column = 0;
    }
  }
}

/**
 * Render thumbnail for an asset
 */
function renderAssetThumbnail(
  guid: string,
  assetType: AssetType,
  size: number,
  renderer: THREE.WebGLRenderer,
): void {
  // For textures, try to render actual texture preview
  if (assetType === AssetType.Texture) {
    const thumbnail = getThumbnail(guid, renderer);
    const checkeredBg = getCheckeredTextureId(renderer);

    if (thumbnail && checkeredBg !== null) {
      // Calculate aspect-ratio-preserving size
      const aspectRatio = thumbnail.width / thumbnail.height;
      let renderWidth = size;
      let renderHeight = size;

      if (aspectRatio > 1) {
        // Wider than tall
        renderHeight = size / aspectRatio;
      } else {
        // Taller than wide
        renderWidth = size * aspectRatio;
      }

      // Center the image in the cell
      const offsetX = (size - renderWidth) / 2;
      const offsetY = (size - renderHeight) / 2;

      // Save cursor position before rendering
      const startX = ImGui.GetCursorPosX();
      const startY = ImGui.GetCursorPosY();

      // Render checkered background first (full cell size)
      const bgRef = new ImTextureRef(checkeredBg);
      ImGui.Image(bgRef, { x: size, y: size }, { x: 0, y: 0 }, { x: size / 16, y: size / 16 });

      // Move cursor back to overlay the texture, centered
      ImGui.SetCursorPosX(startX + offsetX);
      ImGui.SetCursorPosY(startY + offsetY);

      // Render the actual texture with flipped UVs (WebGL textures are upside down)
      const texRef = new ImTextureRef(thumbnail.textureId);
      ImGui.Image(texRef, { x: renderWidth, y: renderHeight }, { x: 0, y: 1 }, { x: 1, y: 0 });

      // Move cursor to after the full cell for proper layout
      ImGui.SetCursorPosX(startX);
      ImGui.SetCursorPosY(startY + size);
      return;
    }
  }

  // For other types or if texture not loaded, show placeholder
  // TODO: Add waveform preview for audio, 3D preview for models, etc.
  renderAssetPlaceholder(assetType, size);
}

/**
 * Render placeholder for non-texture assets
 */
function renderAssetPlaceholder(assetType: AssetType, size: number): void {
  // Color based on asset type
  const typeColors: Record<AssetType, { x: number; y: number; z: number; w: number }> = {
    [AssetType.Texture]: { x: 0.2, y: 0.6, z: 0.2, w: 1 }, // Green
    [AssetType.Audio]: { x: 0.6, y: 0.2, z: 0.6, w: 1 }, // Purple
    [AssetType.Model3D]: { x: 0.2, y: 0.4, z: 0.8, w: 1 }, // Blue
    [AssetType.Animation]: { x: 0.8, y: 0.4, z: 0.2, w: 1 }, // Orange
    [AssetType.Shader]: { x: 0.4, y: 0.8, z: 0.4, w: 1 }, // Light green
    [AssetType.StateMachine]: { x: 0.8, y: 0.5, z: 0.2, w: 1 }, // Dark orange
    [AssetType.TiledMap]: { x: 0.6, y: 0.6, z: 0.2, w: 1 }, // Yellow
    [AssetType.Prefab]: { x: 0.4, y: 0.4, z: 0.8, w: 1 }, // Light blue
    [AssetType.Material]: { x: 0.7, y: 0.3, z: 0.3, w: 1 }, // Red
    [AssetType.Scene]: { x: 0.3, y: 0.7, z: 0.5, w: 1 }, // Teal
    [AssetType.BlueprintScript]: { x: 0.5, y: 0.5, z: 0.5, w: 1 }, // Gray
    [AssetType.BlueprintShader]: { x: 0.5, y: 0.5, z: 0.5, w: 1 }, // Gray
    [AssetType.BlueprintAnimation]: { x: 0.5, y: 0.5, z: 0.5, w: 1 }, // Gray
    [AssetType.BlueprintAudio]: { x: 0.5, y: 0.5, z: 0.5, w: 1 }, // Gray
    [AssetType.Unknown]: { x: 0.4, y: 0.4, z: 0.4, w: 1 }, // Dark gray
  };

  const color = typeColors[assetType] || typeColors[AssetType.Unknown];

  // Draw colored rectangle
  ImGui.PushStyleColorImVec4(ImGui.Col.Button, color);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, color);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, color);
  ImGui.PushStyleVarImVec2(ImGui.StyleVar.FramePadding, { x: 0, y: 0 });
  ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 4);

  ImGui.Button(`##placeholder`, { x: size, y: size });

  ImGui.PopStyleVar(2);
  ImGui.PopStyleColor(3);

  // Draw type label in center
  const typeLabel = getTypeLabel(assetType);
  const labelSize = typeLabel.length * 7;
  const cursorX = ImGui.GetCursorPosX();
  const cursorY = ImGui.GetCursorPosY();

  // Position label in center of button (go back up)
  ImGui.SetCursorPos({
    x: cursorX + (size - labelSize) / 2,
    y: cursorY - size / 2 - 7,
  });
  ImGui.TextDisabled(typeLabel);

  // Reset cursor
  ImGui.SetCursorPos({ x: cursorX, y: cursorY });
}

/**
 * Get short type label for placeholder
 */
function getTypeLabel(assetType: AssetType): string {
  switch (assetType) {
    case AssetType.Texture:
      return 'TEX';
    case AssetType.Audio:
      return 'AUD';
    case AssetType.Model3D:
      return '3D';
    case AssetType.Animation:
      return 'ANIM';
    case AssetType.Shader:
      return 'VSL';
    case AssetType.TiledMap:
      return 'MAP';
    case AssetType.Prefab:
      return 'PRE';
    case AssetType.Material:
      return 'MAT';
    default:
      return '???';
  }
}

/**
 * Truncate name to fit in cell
 */
function truncateName(name: string, maxChars: number): string {
  if (name.length <= maxChars) return name;
  return name.substring(0, maxChars - 2) + '..';
}

// ============================================================================
// Thumbnail Size Slider
// ============================================================================

function renderThumbnailSlider(): void {
  const state = getAssetBrowserState();

  ImGui.Text('Size:');
  ImGui.SameLine();

  ImGui.SetNextItemWidth(-80);
  const sizeArr: [number] = [state.thumbnailSize];
  if (ImGui.SliderInt('##ThumbnailSize', sizeArr, 32, 256)) {
    setThumbnailSize(sizeArr[0]);
  }

  ImGui.SameLine();
  ImGui.Text(`${state.thumbnailSize}px`);
}

// ============================================================================
// Import Asset
// ============================================================================

async function handleImportAsset(options: AssetBrowserPanelOptions): Promise<void> {
  const platform = options.platform;
  if (!platform) return;

  try {
    const result = await platform.showOpenDialog({
      title: 'Import Asset',
      filters: [
        {
          name: 'All Assets',
          extensions: [
            'png',
            'jpg',
            'jpeg',
            'webp',
            'gif',
            'mp3',
            'wav',
            'ogg',
            'gltf',
            'glb',
            'fbx',
            'vsl',
            'tmj',
          ],
        },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
        { name: 'Audio', extensions: ['mp3', 'wav', 'ogg'] },
        { name: '3D Models', extensions: ['gltf', 'glb', 'fbx'] },
        { name: 'Shaders', extensions: ['vsl'] },
        { name: 'Tiled Maps', extensions: ['tmj', 'json'] },
      ],
    });

    if (!result) return;

    const filePath = Array.isArray(result) ? result[0] : result;
    if (!filePath) return;

    // Detect asset type from extension
    const ext = filePath.split('.').pop();
    const assetType = detectAssetTypeFromExtension(ext);

    if (!assetType) {
      console.warn(`[AssetBrowser] Unknown file type: ${ext}`);
      return;
    }

    // Calculate relative path
    let relativePath = filePath;
    if (platform.sourceAssetsDir) {
      // Try to make path relative to source assets dir
      if (filePath.startsWith(platform.sourceAssetsDir)) {
        relativePath = filePath.substring(platform.sourceAssetsDir.length);
        if (!relativePath.startsWith('/')) {
          relativePath = '/' + relativePath;
        }
      }
    }

    // Open import dialog
    openImportDialog(filePath, relativePath, assetType);
  } catch (error) {
    console.error('[AssetBrowser] Error opening file picker:', error);
  }
}

// ============================================================================
// Import Dialog
// ============================================================================

function renderImportDialog(options: AssetBrowserPanelOptions): void {
  const state = getAssetBrowserState();

  if (!state.importDialogOpen) return;

  const open: [boolean] = [true];
  ImGui.SetNextWindowSize({ x: 450, y: 350 }, ImGui.Cond.FirstUseEver);

  if (ImGui.Begin('Import Asset###ImportAssetDialog', open, ImGui.WindowFlags.None)) {
    // File path
    ImGui.Text('File:');
    ImGui.SameLine();
    ImGui.TextWrapped(state.importDialogFilePath || '(none)');

    // Relative path (what will be stored in manifest)
    ImGui.Text('Path in manifest:');
    ImGui.SameLine();
    ImGui.TextColored({ x: 0.6, y: 0.8, z: 1.0, w: 1.0 }, state.importDialogRelativePath || '');

    ImGui.Separator();

    // Type
    ImGui.Text('Type:');
    ImGui.SameLine();
    ImGui.Text(getAssetTypeDisplayName(state.importDialogAssetType));

    ImGui.Separator();

    // Error message
    if (state.importDialogError) {
      ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: 1.0, y: 0.3, z: 0.3, w: 1.0 });
      ImGui.TextWrapped(state.importDialogError);
      ImGui.PopStyleColor();
      ImGui.Separator();
    }

    // Type-specific options
    switch (state.importDialogAssetType) {
      case AssetType.Texture:
        renderTextureImportOptions();
        break;
      case AssetType.Model3D:
        renderModel3DImportOptions();
        break;
      case AssetType.Audio:
        ImGui.TextDisabled('No additional options for audio assets.');
        break;
      case AssetType.Shader:
        ImGui.TextDisabled('Shader settings are parsed from .vsl file.');
        break;
      default:
        ImGui.TextDisabled('No additional options.');
    }

    ImGui.Separator();

    // Buttons
    const canDoImport = canImport();

    if (!canDoImport) {
      ImGui.BeginDisabled();
    }

    if (ImGui.Button('Import', { x: 100, y: 0 })) {
      if (options.platform) {
        executeImport(options.platform, options.assetsManifest);
      }
    }

    if (!canDoImport) {
      ImGui.EndDisabled();
    }

    ImGui.SameLine();

    if (ImGui.Button('Cancel', { x: 100, y: 0 })) {
      closeImportDialog();
    }
  }
  ImGui.End();

  if (!open[0]) {
    closeImportDialog();
  }
}

function renderTextureImportOptions(): void {
  const state = getAssetBrowserState();
  const options = state.importDialogOptions as TextureImportOptions;

  ImGui.Text('Import Options');

  // Filtering
  ImGui.Text('Filtering:');
  ImGui.SameLine();
  ImGui.SetNextItemWidth(150);
  const filterOptions = ['nearest', 'linear'];
  const currentFilter = options.filtering || 'nearest';
  const filterIdx: [number] = [filterOptions.indexOf(currentFilter)];
  if (ImGui.Combo('##filter', filterIdx, filterOptions.join('\0') + '\0')) {
    options.filtering = filterOptions[filterIdx[0]] as 'nearest' | 'linear';
  }

  // Wrap S
  ImGui.Text('Wrap S:');
  ImGui.SameLine();
  ImGui.SetNextItemWidth(150);
  const wrapOptions = ['clamp', 'repeat', 'mirror'];
  const currentWrapS = options.wrapS || 'clamp';
  const wrapSIdx: [number] = [wrapOptions.indexOf(currentWrapS)];
  if (ImGui.Combo('##wrapS', wrapSIdx, wrapOptions.join('\0') + '\0')) {
    options.wrapS = wrapOptions[wrapSIdx[0]] as 'repeat' | 'clamp' | 'mirror';
  }

  // Wrap T
  ImGui.Text('Wrap T:');
  ImGui.SameLine();
  ImGui.SetNextItemWidth(150);
  const currentWrapT = options.wrapT || 'clamp';
  const wrapTIdx: [number] = [wrapOptions.indexOf(currentWrapT)];
  if (ImGui.Combo('##wrapT', wrapTIdx, wrapOptions.join('\0') + '\0')) {
    options.wrapT = wrapOptions[wrapTIdx[0]] as 'repeat' | 'clamp' | 'mirror';
  }
}

function renderModel3DImportOptions(): void {
  const state = getAssetBrowserState();
  const options = state.importDialogOptions as Model3DImportOptions;

  ImGui.Text('Import Options');

  // Format (read-only, detected from extension)
  ImGui.Text('Format:');
  ImGui.SameLine();
  ImGui.TextDisabled(options.format || 'glb');

  // Scale
  ImGui.Text('Scale:');
  ImGui.SameLine();
  ImGui.SetNextItemWidth(150);
  const scaleArr: [number] = [options.scale || 1.0];
  if (ImGui.DragFloat('##scale', scaleArr, 0.01, 0.01, 100.0)) {
    options.scale = scaleArr[0];
  }
}
