/**
 * Asset Picker Modal - Enhanced UI for selecting assets
 *
 * Features:
 * - Search bar for filtering assets by name
 * - Sort options (name, type, recent)
 * - Texture previews with checkered background for transparency
 * - Grid layout with proper aspect ratio preservation
 * - Type filtering
 */

import { ImGui, ImGuiImplWeb, ImTextureRef } from '@voidscript/imgui';
import { AssetDatabase } from '../../ecs/asset/asset-database.js';
import { RuntimeAssetManager } from '@voidscript/core';
import { AssetType, type AssetMetadata, isTextureMetadata } from '../../ecs/asset/asset-metadata.js';
import type { RuntimeAsset } from '@voidscript/core';
import * as THREE from 'three';

// ============================================================================
// Types
// ============================================================================

export type SortMode = 'name-asc' | 'name-desc' | 'type' | 'recent';

export interface AssetPickerState {
  searchQuery: string;
  sortMode: SortMode;
  selectedTypeFilter: AssetType | null;
  previewSize: number; // 100-300, default 100
}

interface CachedTextureInfo {
  textureId: bigint;
  width: number;
  height: number;
  lastAccessed: number;
}

// ============================================================================
// Texture Cache Management
// ============================================================================

// Cache for texture IDs (maps asset GUID to texture info)
const textureCache = new Map<string, CachedTextureInfo>();

// Pending texture loads (to avoid duplicate load attempts)
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
 * Get or load a texture ID for an asset
 * Returns null if texture is not yet ready
 */
function getOrLoadTextureId(
  guid: string,
  renderer: THREE.WebGLRenderer,
): CachedTextureInfo | null {
  // Check cache first
  const cached = textureCache.get(guid);
  if (cached) {
    cached.lastAccessed = Date.now();
    return cached;
  }

  // Check if already loading
  if (pendingLoads.has(guid)) {
    return null;
  }

  // Start loading
  pendingLoads.add(guid);

  const metadata = AssetDatabase.getMetadata(guid);
  if (!metadata || metadata.type !== AssetType.Texture) {
    pendingLoads.delete(guid);
    return null;
  }

  const runtimeAsset = RuntimeAssetManager.get().getOrCreate(guid, metadata);

  // Start async load
  runtimeAsset.load().then(() => {
    pendingLoads.delete(guid);

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
    const textureProps = renderer.properties.get(threeTexture) as { __webglTexture?: WebGLTexture };
    const webglTexture = textureProps.__webglTexture;

    if (!webglTexture) {
      return;
    }

    // Create ImGui texture ID
    const textureId = ImGuiImplWeb.LoadTexture(undefined, {
      processFn: () => webglTexture,
    });

    // Get dimensions
    const image = threeTexture.image as { width?: number; height?: number; videoWidth?: number; videoHeight?: number };
    const width = image.width || image.videoWidth || 64;
    const height = image.height || image.videoHeight || 64;

    // Cache it
    textureCache.set(guid, {
      textureId,
      width,
      height,
      lastAccessed: Date.now(),
    });
  }).catch((err) => {
    pendingLoads.delete(guid);
    console.warn(`Failed to load texture for asset picker: ${guid}`, err);
  });

  return null;
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

  // Initialize the texture
  renderer.initTexture(checkeredTexture);

  const textureProps = renderer.properties.get(checkeredTexture) as { __webglTexture?: WebGLTexture };
  const webglTexture = textureProps.__webglTexture;

  if (!webglTexture) {
    return null;
  }

  checkeredTextureId = ImGuiImplWeb.LoadTexture(undefined, {
    processFn: () => webglTexture,
  });

  return checkeredTextureId;
}

/**
 * Clear old cached textures (older than 60 seconds)
 */
export function cleanupTextureCache(): void {
  const now = Date.now();
  const maxAge = 60000; // 60 seconds

  for (const [guid, info] of textureCache) {
    if (now - info.lastAccessed > maxAge) {
      textureCache.delete(guid);
    }
  }
}

// ============================================================================
// Asset Picker State Management
// ============================================================================

// Global picker state per popup ID
const pickerStates = new Map<string, AssetPickerState>();

function getOrCreatePickerState(popupId: string): AssetPickerState {
  let state = pickerStates.get(popupId);
  if (!state) {
    state = {
      searchQuery: '',
      sortMode: 'name-asc',
      selectedTypeFilter: null,
      previewSize: 100,
    };
    pickerStates.set(popupId, state);
  }
  return state;
}

// ============================================================================
// Asset Filtering and Sorting
// ============================================================================

interface FilteredAsset {
  guid: string;
  path: string;
  name: string;
  type: AssetType;
  metadata: AssetMetadata;
}

function filterAndSortAssets(
  state: AssetPickerState,
  assetTypes?: string[],
  excludeGuids?: Set<string>,
): FilteredAsset[] {
  const allAssets = AssetDatabase.getAllAssets();
  const filtered: FilteredAsset[] = [];

  const searchLower = state.searchQuery.toLowerCase();

  for (const [guid, metadata] of allAssets) {
    // Exclude already selected
    if (excludeGuids?.has(guid)) {
      continue;
    }

    // Filter by asset types if specified
    if (assetTypes && !assetTypes.includes(metadata.type)) {
      continue;
    }

    // Filter by selected type filter
    if (state.selectedTypeFilter && metadata.type !== state.selectedTypeFilter) {
      continue;
    }

    // Filter by search query
    const name = metadata.path.split('/').pop() || metadata.path;
    if (searchLower && !name.toLowerCase().includes(searchLower) && !metadata.path.toLowerCase().includes(searchLower)) {
      continue;
    }

    filtered.push({
      guid,
      path: metadata.path,
      name,
      type: metadata.type as AssetType,
      metadata,
    });
  }

  // Sort
  switch (state.sortMode) {
    case 'name-asc':
      filtered.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      filtered.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'type':
      filtered.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
      break;
    case 'recent':
      // TODO: Track recent usage if needed
      filtered.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  return filtered;
}

// ============================================================================
// Render Functions
// ============================================================================

/**
 * Render the search and filter toolbar
 */
function renderToolbar(state: AssetPickerState, assetTypes?: string[]): void {
  // Search input
  ImGui.SetNextItemWidth(200);
  const searchBuffer: [string] = [state.searchQuery];
  ImGui.InputTextWithHint('##search', 'Search assets...', searchBuffer, 256);
  state.searchQuery = searchBuffer[0];

  ImGui.SameLine();

  // Sort dropdown
  ImGui.SetNextItemWidth(120);
  const sortOptions = ['Name (A-Z)', 'Name (Z-A)', 'Type', 'Recent'];
  const sortModes: SortMode[] = ['name-asc', 'name-desc', 'type', 'recent'];
  const currentSortIndex = sortModes.indexOf(state.sortMode);
  const sortArr: [number] = [currentSortIndex >= 0 ? currentSortIndex : 0];

  if (ImGui.Combo('##sort', sortArr, sortOptions.join('\0') + '\0')) {
    state.sortMode = sortModes[sortArr[0]] || 'name-asc';
  }

  // Type filter (only if multiple types or no filter)
  if (!assetTypes || assetTypes.length > 1) {
    ImGui.SameLine();

    // Build type options
    const typeOptions = ['All Types'];
    const typeValues: (AssetType | null)[] = [null];

    if (assetTypes) {
      for (const t of assetTypes) {
        typeOptions.push(t.charAt(0).toUpperCase() + t.slice(1));
        typeValues.push(t as AssetType);
      }
    } else {
      // Show all types
      for (const t of Object.values(AssetType)) {
        typeOptions.push(t.charAt(0).toUpperCase() + t.slice(1));
        typeValues.push(t);
      }
    }

    const currentTypeIndex = state.selectedTypeFilter
      ? typeValues.indexOf(state.selectedTypeFilter)
      : 0;
    const typeArr: [number] = [currentTypeIndex >= 0 ? currentTypeIndex : 0];

    ImGui.SetNextItemWidth(120);
    if (ImGui.Combo('##typeFilter', typeArr, typeOptions.join('\0') + '\0')) {
      state.selectedTypeFilter = typeValues[typeArr[0]] ?? null;
    }
  }

  // Preview size slider
  ImGui.SameLine();
  ImGui.Text('Size:');
  ImGui.SameLine();
  ImGui.SetNextItemWidth(100);
  const sizeArr: [number] = [state.previewSize];
  if (ImGui.SliderInt('##previewSize', sizeArr, 100, 300)) {
    state.previewSize = sizeArr[0];
  }
}

/**
 * Get asset type icon/label
 */
function getAssetTypeLabel(type: AssetType): string {
  switch (type) {
    case AssetType.Texture: return '[T]';
    case AssetType.Audio: return '[A]';
    case AssetType.Model3D: return '[3D]';
    case AssetType.Animation: return '[An]';
    case AssetType.TiledMap: return '[M]';
    case AssetType.Material: return '[Mt]';
    case AssetType.Prefab: return '[P]';
    default: return '[?]';
  }
}

/**
 * Render a single asset item with optional texture preview
 */
function renderAssetItem(
  asset: FilteredAsset,
  buttonSize: number,
  isSelected: boolean,
  renderer: THREE.WebGLRenderer | null,
): boolean {
  let clicked = false;

  ImGui.BeginGroup();

  // Selection highlight
  if (isSelected) {
    ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.2, y: 0.5, z: 0.8, w: 1.0 });
  }

  // Check if this is a texture and we have a renderer
  const isTexture = asset.type === AssetType.Texture;
  const textureInfo = isTexture && renderer ? getOrLoadTextureId(asset.guid, renderer) : null;

  if (textureInfo && renderer) {
    // We have a texture preview - render with checkered background
    const checkeredId = getCheckeredTextureId(renderer);

    // Calculate aspect-ratio-preserving size
    const aspectRatio = textureInfo.width / textureInfo.height;
    let displayWidth = buttonSize - 8; // Padding
    let displayHeight = displayWidth / aspectRatio;

    if (displayHeight > buttonSize - 8) {
      displayHeight = buttonSize - 8;
      displayWidth = displayHeight * aspectRatio;
    }

    // Center the image
    const offsetX = (buttonSize - displayWidth) / 2;
    const offsetY = (buttonSize - displayHeight) / 2;

    // Button as container
    const startPosX = ImGui.GetCursorPosX();
    const startPosY = ImGui.GetCursorPosY();

    if (ImGui.InvisibleButton(`##asset_${asset.guid}`, { x: buttonSize, y: buttonSize })) {
      clicked = true;
    }

    // Reset cursor to draw images on top of the button
    ImGui.SetCursorPos({ x: startPosX, y: startPosY });

    // Draw button background
    ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.15, y: 0.15, z: 0.15, w: 1.0 });
    ImGui.Button(`##bg_${asset.guid}`, { x: buttonSize, y: buttonSize });
    ImGui.PopStyleColor();

    // Overlay the image
    ImGui.SetCursorPos({ x: startPosX + offsetX, y: startPosY + offsetY });

    // Draw checkered background first (if available)
    if (checkeredId !== null) {
      ImGui.Image(
        new ImTextureRef(checkeredId),
        { x: displayWidth, y: displayHeight },
        { x: 0, y: 0 },
        { x: displayWidth / 16, y: displayHeight / 16 }, // Tile the checkered pattern
      );
    }

    // Overlay the actual texture (flip Y for correct orientation)
    ImGui.SetCursorPos({ x: startPosX + offsetX, y: startPosY + offsetY });
    ImGui.Image(
      new ImTextureRef(textureInfo.textureId),
      { x: displayWidth, y: displayHeight },
      { x: 0, y: 1 },
      { x: 1, y: 0 },
    );

    // Move cursor to after the button
    ImGui.SetCursorPos({ x: startPosX, y: startPosY + buttonSize });

  } else {
    // No texture preview - standard button
    if (ImGui.Button(`##asset_${asset.guid}`, { x: buttonSize, y: buttonSize })) {
      clicked = true;
    }

    // Show type label in center of button
    if (!textureInfo && isTexture) {
      // Loading indicator for textures
      ImGui.SetCursorPosY(ImGui.GetCursorPosY() - buttonSize / 2 - 8);
      ImGui.TextDisabled('Loading...');
    }
  }

  if (isSelected) {
    ImGui.PopStyleColor();
  }

  // Asset name with type indicator
  const typeLabel = getAssetTypeLabel(asset.type);
  ImGui.PushTextWrapPos(ImGui.GetCursorPosX() + buttonSize);
  ImGui.TextWrapped(`${typeLabel} ${asset.name}`);
  ImGui.PopTextWrapPos();

  ImGui.EndGroup();

  return clicked;
}

// ============================================================================
// Main Asset Picker Modal
// ============================================================================

export interface AssetPickerOptions {
  /** Popup ID (must be unique) */
  popupId: string;
  /** Title shown in the modal */
  title?: string;
  /** Filter to specific asset types */
  assetTypes?: string[];
  /** Currently selected asset GUID (for highlighting) */
  selectedGuid?: string | null;
  /** GUIDs to exclude from the list */
  excludeGuids?: Set<string>;
  /** Three.js renderer for texture previews */
  renderer?: THREE.WebGLRenderer | null;
  /** Callback when an asset is selected */
  onSelect: (runtimeAsset: RuntimeAsset<any>) => void;
  /** Callback when cancelled */
  onCancel?: () => void;
}

/**
 * Render the asset picker modal
 * Must be called every frame when the modal is open
 *
 * @returns true if the modal is still open, false if closed
 */
export function renderAssetPickerModal(options: AssetPickerOptions): boolean {
  const {
    popupId,
    title = 'Select Asset',
    assetTypes,
    selectedGuid,
    excludeGuids,
    renderer = null,
    onSelect,
    onCancel,
  } = options;

  const state = getOrCreatePickerState(popupId);

  ImGui.SetNextWindowSize({ x: 700, y: 500 }, ImGui.Cond.FirstUseEver);

  let isOpen = true;

  if (ImGui.BeginPopupModal(popupId, null, ImGui.WindowFlags.None)) {
    // Title
    ImGui.Text(title);
    ImGui.Separator();

    // Toolbar (search, sort, filter)
    renderToolbar(state, assetTypes);
    ImGui.Separator();

    // Get filtered assets
    const filteredAssets = filterAndSortAssets(state, assetTypes, excludeGuids);

    // Asset grid with dynamic sizing
    const buttonSize = state.previewSize;
    const windowWidth = ImGui.GetWindowWidth();
    const itemSpacing = 8;
    const itemsPerRow = Math.max(1, Math.floor((windowWidth - 20) / (buttonSize + itemSpacing)));

    ImGui.BeginChild('AssetGrid', { x: 0, y: -40 }, ImGui.WindowFlags.None);

    if (filteredAssets.length === 0) {
      ImGui.TextDisabled('No assets found');
      if (state.searchQuery) {
        ImGui.TextDisabled(`Try a different search term`);
      } else if (assetTypes && assetTypes.length > 0) {
        ImGui.TextDisabled(`No ${assetTypes.join(', ')} assets in database`);
      }
    } else {
      for (let i = 0; i < filteredAssets.length; i++) {
        const asset = filteredAssets[i];
        if (!asset) continue;

        if (i > 0 && i % itemsPerRow !== 0) {
          ImGui.SameLine();
        }

        const isSelected = selectedGuid === asset.guid;

        if (renderAssetItem(asset, buttonSize, isSelected, renderer)) {
          // Asset clicked - create RuntimeAsset and call onSelect
          const runtimeAsset = RuntimeAssetManager.get().getOrCreate(asset.guid, asset.metadata);
          onSelect(runtimeAsset);
          ImGui.CloseCurrentPopup();
          isOpen = false;
        }
      }
    }

    ImGui.EndChild();

    // Footer
    ImGui.Separator();

    // Show count
    ImGui.TextDisabled(`${filteredAssets.length} assets`);
    ImGui.SameLine();

    // Right-align cancel button
    const cancelButtonWidth = 80;
    ImGui.SetCursorPosX(ImGui.GetWindowWidth() - cancelButtonWidth - 10);

    if (ImGui.Button('Cancel', { x: cancelButtonWidth, y: 0 })) {
      onCancel?.();
      ImGui.CloseCurrentPopup();
      isOpen = false;
    }

    ImGui.EndPopup();
  } else {
    // Modal was closed externally
    isOpen = false;
  }

  return isOpen;
}

/**
 * Open the asset picker popup
 */
export function openAssetPicker(popupId: string): void {
  // Reset state when opening
  const state = getOrCreatePickerState(popupId);
  state.searchQuery = '';
  // Keep sort mode as user preference
  ImGui.OpenPopup(popupId);
}
