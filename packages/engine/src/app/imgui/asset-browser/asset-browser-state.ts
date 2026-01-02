/**
 * Asset Browser State Management
 *
 * Manages the state for the asset browser panel including folder tree,
 * asset selection, search/filter, thumbnails, and import dialog.
 */

import type { AssetMetadata, GUID } from '../../../ecs/asset/asset-metadata.js';
import {
  AssetType,
  isTextureMetadata,
  TextureFilter,
  TextureWrap,
  ModelFormat,
} from '../../../ecs/asset/asset-metadata.js';
import { AssetDatabase } from '../../../ecs/asset/asset-database.js';
import { RuntimeAssetManager } from '@voidscript/core';
import type { EditorPlatform } from '../../../editor/editor-platform.js';
import { ImGuiImplWeb } from '@voidscript/imgui';
import * as THREE from 'three';
import { parseAssetQuery, evaluateAssetQuery } from './asset-query-parser.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a folder node in the tree view
 */
export interface FolderNode {
  /** Folder name (last segment of path) */
  name: string;
  /** Full folder path (e.g., "/textures/characters") */
  path: string;
  /** Child folders */
  children: FolderNode[];
  /** Asset GUIDs directly in this folder */
  assetGuids: GUID[];
  /** Whether node is expanded in tree */
  isExpanded: boolean;
}

/**
 * Cached texture info for thumbnail rendering
 */
export interface CachedThumbnailInfo {
  /** ImGui texture ID */
  textureId: bigint;
  /** Original texture width */
  width: number;
  /** Original texture height */
  height: number;
}

/**
 * Import dialog options for textures
 */
export interface TextureImportOptions {
  filtering: 'nearest' | 'linear';
  wrapS: 'repeat' | 'clamp' | 'mirror';
  wrapT: 'repeat' | 'clamp' | 'mirror';
}

/**
 * Import dialog options for 3D models
 */
export interface Model3DImportOptions {
  format: 'gltf' | 'glb' | 'fbx';
  scale: number;
}

/**
 * Union of all import options
 */
export type ImportOptions = TextureImportOptions | Model3DImportOptions | Record<string, never>;

/**
 * Asset Browser Panel State
 */
export interface AssetBrowserState {
  /** Root folder node (virtual "/" root) */
  rootFolder: FolderNode | null;

  /** Currently selected folder path */
  selectedFolderPath: string | null;

  /** Currently selected asset GUID */
  selectedAssetGuid: GUID | null;

  /** Search query string */
  searchQuery: string;

  /** Thumbnail size in pixels (32-256) */
  thumbnailSize: number;

  /** Splitter position (folder tree width) */
  splitterPosition: number;

  /** Whether there are unsaved changes (for import) */
  isDirty: boolean;

  /** Import dialog state */
  importDialogOpen: boolean;
  importDialogAssetType: AssetType | null;
  importDialogFilePath: string | null;
  importDialogRelativePath: string | null;
  importDialogError: string | null;
  importDialogOptions: ImportOptions;
}

// ============================================================================
// Module State
// ============================================================================

let browserState: AssetBrowserState | null = null;

// Thumbnail cache (shared across state resets)
const thumbnailCache = new Map<GUID, CachedThumbnailInfo>();
const pendingThumbnails = new Set<GUID>();

// Queue of textures ready to be initialized (must be done during render, not in async callbacks)
const texturesReadyToInit: Array<{ guid: GUID; texture: THREE.Texture }> = [];

// Checkered background texture for transparency
let checkeredTextureId: bigint | null = null;
let checkeredTexture: THREE.DataTexture | null = null;

// ============================================================================
// State Access
// ============================================================================

/**
 * Get the current asset browser state, creating it if needed
 */
export function getAssetBrowserState(): AssetBrowserState {
  if (!browserState) {
    browserState = createDefaultState();
  }
  return browserState;
}

/**
 * Create a fresh default state
 */
function createDefaultState(): AssetBrowserState {
  return {
    rootFolder: null,
    selectedFolderPath: null,
    selectedAssetGuid: null,
    searchQuery: '',
    thumbnailSize: 64,
    splitterPosition: 200,
    isDirty: false,
    importDialogOpen: false,
    importDialogAssetType: null,
    importDialogFilePath: null,
    importDialogRelativePath: null,
    importDialogError: null,
    importDialogOptions: {},
  };
}

/**
 * Reset the asset browser state
 */
export function resetAssetBrowserState(): void {
  browserState = createDefaultState();
}

// ============================================================================
// Folder Tree
// ============================================================================

/**
 * Build folder tree from all registered assets
 * Parses asset paths to create hierarchical folder structure
 */
export function buildFolderTree(): FolderNode {
  const root: FolderNode = {
    name: 'assets',
    path: '/',
    children: [],
    assetGuids: [],
    isExpanded: true,
  };

  const allGuids = AssetDatabase.getAllGuids();

  for (const guid of allGuids) {
    const metadata = AssetDatabase.getMetadata(guid);
    if (!metadata) continue;

    const path = metadata.path;
    // Get folder path (everything before the filename)
    const lastSlash = path.lastIndexOf('/');
    const folderPath = lastSlash > 0 ? path.substring(0, lastSlash) : '/';

    // Find or create the folder node
    const folderNode = getOrCreateFolderNode(root, folderPath);
    folderNode.assetGuids.push(guid);
  }

  // Sort children alphabetically at each level
  sortFolderChildren(root);

  return root;
}

/**
 * Get or create a folder node at the specified path
 */
function getOrCreateFolderNode(root: FolderNode, folderPath: string): FolderNode {
  if (folderPath === '/' || folderPath === '') {
    return root;
  }

  // Split path into segments (e.g., "/assets/textures" -> ["assets", "textures"])
  const segments = folderPath.split('/').filter(Boolean);
  let current = root;
  let currentPath = '';

  for (const segment of segments) {
    currentPath += '/' + segment;

    // Find existing child or create new one
    let child = current.children.find((c) => c.name === segment);
    if (!child) {
      child = {
        name: segment,
        path: currentPath,
        children: [],
        assetGuids: [],
        isExpanded: false,
      };
      current.children.push(child);
    }
    current = child;
  }

  return current;
}

/**
 * Sort folder children alphabetically at all levels
 */
function sortFolderChildren(node: FolderNode): void {
  node.children.sort((a, b) => a.name.localeCompare(b.name));
  for (const child of node.children) {
    sortFolderChildren(child);
  }
}

/**
 * Toggle folder expansion state
 */
export function toggleFolderExpanded(folderPath: string): void {
  const state = getAssetBrowserState();
  if (!state.rootFolder) return;

  const node = findFolderNode(state.rootFolder, folderPath);
  if (node) {
    node.isExpanded = !node.isExpanded;
  }
}

/**
 * Set folder expansion state
 */
export function setFolderExpanded(folderPath: string, expanded: boolean): void {
  const state = getAssetBrowserState();
  if (!state.rootFolder) return;

  const node = findFolderNode(state.rootFolder, folderPath);
  if (node) {
    node.isExpanded = expanded;
  }
}

/**
 * Find a folder node by path
 */
function findFolderNode(root: FolderNode, path: string): FolderNode | null {
  if (root.path === path) return root;

  for (const child of root.children) {
    const found = findFolderNode(child, path);
    if (found) return found;
  }

  return null;
}

/**
 * Select a folder in the tree
 */
export function selectFolder(folderPath: string | null): void {
  const state = getAssetBrowserState();
  state.selectedFolderPath = folderPath;
  state.selectedAssetGuid = null; // Clear asset selection when changing folders
}

/**
 * Get all asset GUIDs in a folder (optionally recursive)
 */
export function getAssetsInFolder(folderPath: string | null, recursive: boolean = false): GUID[] {
  const state = getAssetBrowserState();
  if (!state.rootFolder) return [];

  if (folderPath === null) {
    // Return all assets
    return AssetDatabase.getAllGuids();
  }

  const node = findFolderNode(state.rootFolder, folderPath);
  if (!node) return [];

  if (!recursive) {
    return [...node.assetGuids];
  }

  // Recursive: collect from this node and all descendants
  const result: GUID[] = [];
  collectAssetsRecursive(node, result);
  return result;
}

/**
 * Recursively collect assets from a folder node and its children
 */
function collectAssetsRecursive(node: FolderNode, result: GUID[]): void {
  result.push(...node.assetGuids);
  for (const child of node.children) {
    collectAssetsRecursive(child, result);
  }
}

// ============================================================================
// Asset Selection
// ============================================================================

/**
 * Select an asset by GUID
 */
export function selectAsset(guid: GUID | null): void {
  const state = getAssetBrowserState();
  state.selectedAssetGuid = guid;
}

/**
 * Get the currently selected asset GUID
 */
export function getSelectedAsset(): GUID | null {
  const state = getAssetBrowserState();
  return state.selectedAssetGuid;
}

// ============================================================================
// Search and Filter
// ============================================================================

/**
 * Set the search query
 */
export function setSearchQuery(query: string): void {
  const state = getAssetBrowserState();
  state.searchQuery = query;
}

/**
 * Get filtered assets based on current search query and selected folder
 */
export function getFilteredAssets(): GUID[] {
  const state = getAssetBrowserState();

  // Get assets from selected folder (or all if none selected)
  let assets = getAssetsInFolder(state.selectedFolderPath, true);

  // Apply search filter if query exists
  if (state.searchQuery.trim()) {
    const parseResult = parseAssetQuery(state.searchQuery);
    if (parseResult.success) {
      assets = assets.filter((guid) => evaluateAssetQuery(guid, parseResult.query));
    }
  }

  return assets;
}

// ============================================================================
// Thumbnail Management
// ============================================================================

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

// Track whether we've successfully loaded any texture - used as a proxy for renderer readiness
let rendererVerified = false;

// Minimum number of frames that must render before we attempt texture operations
// This prevents issues when Asset Browser is open on page load
const MIN_FRAMES_BEFORE_TEXTURE_OPS = 10;

/**
 * Check if the renderer is ready for texture operations
 * This prevents issues when the Asset Browser is open on page load before Three.js is fully initialized
 */
function isRendererReady(renderer: THREE.WebGLRenderer): boolean {
  // If we've already successfully loaded a texture, the renderer is definitely ready
  if (rendererVerified) return true;

  try {
    // Check if renderer exists and has required properties
    if (!renderer) return false;

    // Check if the WebGL context exists and is valid
    const gl = renderer.getContext();
    if (!gl) return false;

    // Check if context is lost
    if (gl.isContextLost()) return false;

    // Check if renderer has been properly initialized by verifying it has rendered enough frames
    // The info.render.frame counter increments after each render call
    const info = renderer.info;
    if (!info) return false;

    // Require multiple frames to have rendered to ensure full initialization
    if (info.render.frame < MIN_FRAMES_BEFORE_TEXTURE_OPS) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Get checkered background texture ID
 */
export function getCheckeredTextureId(renderer: THREE.WebGLRenderer): bigint | null {
  if (checkeredTextureId !== null) {
    return checkeredTextureId;
  }

  // Safety check: don't try to create textures before renderer is ready
  if (!isRendererReady(renderer)) {
    return null;
  }

  try {
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

    // Mark renderer as verified since we successfully loaded a texture
    rendererVerified = true;

    return checkeredTextureId;
  } catch (error) {
    console.warn('[AssetBrowser] Failed to initialize checkered texture:', error);
    return null;
  }
}

/**
 * Process any textures that are ready to be initialized.
 * MUST be called during the render loop, not from async callbacks.
 * This prevents WebGL state corruption that occurs when calling
 * renderer.initTexture() from Promise callbacks.
 */
export function processPendingThumbnails(renderer: THREE.WebGLRenderer): void {
  if (texturesReadyToInit.length === 0) return;
  if (!isRendererReady(renderer)) return;

  // Process all queued textures
  while (texturesReadyToInit.length > 0) {
    const item = texturesReadyToInit.shift()!;
    initThumbnailCache(item.guid, item.texture, renderer);
  }
}

/**
 * Get or load thumbnail for an asset
 * Returns cached info or null if loading/unavailable
 */
export function getThumbnail(
  guid: GUID,
  renderer: THREE.WebGLRenderer,
): CachedThumbnailInfo | null {
  // First, process any textures that are ready to init
  processPendingThumbnails(renderer);

  // Check cache
  const cached = thumbnailCache.get(guid);
  if (cached) return cached;

  // Safety check: don't try to create textures before renderer is ready
  if (!isRendererReady(renderer)) {
    return null;
  }

  // Check if loading
  if (pendingThumbnails.has(guid)) return null;

  // Get metadata
  const metadata = AssetDatabase.getMetadata(guid);
  if (!metadata || !isTextureMetadata(metadata)) return null;

  // Get RuntimeAsset to load
  const runtimeAsset = RuntimeAssetManager.get().getOrCreate(
    guid,
    metadata,
  ) as import('@voidscript/core').RuntimeAsset<THREE.Texture>;

  if (!runtimeAsset.isLoaded) {
    pendingThumbnails.add(guid);
    runtimeAsset
      .load()
      .then(() => {
        pendingThumbnails.delete(guid);

        if (!runtimeAsset.data || !runtimeAsset.data.image) {
          console.warn(`[AssetBrowser] Texture ${guid} loaded but has no image data`);
          return;
        }

        // Queue the texture to be initialized during the next render call
        // DO NOT call initThumbnailCache directly here - it corrupts WebGL state
        texturesReadyToInit.push({ guid, texture: runtimeAsset.data });
      })
      .catch((error) => {
        pendingThumbnails.delete(guid);
        console.error(`[AssetBrowser] Failed to load texture ${guid}:`, error);
      });
    return null;
  }

  // Already loaded - safe to init here since we're in the render loop
  if (runtimeAsset.data) {
    initThumbnailCache(guid, runtimeAsset.data, renderer);
    return thumbnailCache.get(guid) ?? null;
  }

  return null;
}

/**
 * Initialize thumbnail cache entry for a loaded texture
 */
function initThumbnailCache(
  guid: GUID,
  threeTexture: THREE.Texture,
  renderer: THREE.WebGLRenderer,
): void {
  try {
    if (thumbnailCache.has(guid)) return;
    if (!threeTexture.image) return;

    // Safety check: don't try to init textures before renderer is ready
    if (!isRendererReady(renderer)) return;

    renderer.initTexture(threeTexture);

    const textureProps = renderer.properties.get(threeTexture) as {
      __webglTexture?: WebGLTexture;
    };
    const webglTexture = textureProps.__webglTexture;

    if (!webglTexture) {
      console.warn(`[AssetBrowser] No WebGL texture for ${guid}`);
      return;
    }

    const textureId = ImGuiImplWeb.LoadTexture(undefined, {
      processFn: () => webglTexture,
    });

    const image = threeTexture.image as { width?: number; height?: number };
    const width = image.width || 64;
    const height = image.height || 64;

    thumbnailCache.set(guid, { textureId, width, height });

    // Mark renderer as verified since we successfully loaded a texture
    rendererVerified = true;
  } catch (error) {
    console.error(`[AssetBrowser] Error initializing thumbnail cache for ${guid}:`, error);
  }
}

/**
 * Set thumbnail size (32-256 pixels)
 */
export function setThumbnailSize(size: number): void {
  const state = getAssetBrowserState();
  state.thumbnailSize = Math.max(32, Math.min(256, size));
}

// ============================================================================
// Splitter Position
// ============================================================================

/**
 * Set the folder tree/asset grid splitter position
 */
export function setSplitterPosition(position: number): void {
  const state = getAssetBrowserState();
  state.splitterPosition = Math.max(100, Math.min(400, position));
}

// ============================================================================
// Import Dialog
// ============================================================================

/**
 * Open import dialog for a specific file
 */
export function openImportDialog(
  filePath: string,
  relativePath: string,
  assetType: AssetType,
): void {
  const state = getAssetBrowserState();

  // Check if path already exists in manifest
  const existingGuid = AssetDatabase.findByPath(relativePath);
  const error = existingGuid
    ? `Asset already exists with this path (GUID: ${existingGuid})`
    : null;

  state.importDialogOpen = true;
  state.importDialogAssetType = assetType;
  state.importDialogFilePath = filePath;
  state.importDialogRelativePath = relativePath;
  state.importDialogError = error;

  // Set default options based on type
  switch (assetType) {
    case AssetType.Texture:
      state.importDialogOptions = {
        filtering: 'nearest',
        wrapS: 'clamp',
        wrapT: 'clamp',
      } as TextureImportOptions;
      break;
    case AssetType.Model3D:
      state.importDialogOptions = {
        format: detectModelFormat(filePath),
        scale: 1.0,
      } as Model3DImportOptions;
      break;
    default:
      state.importDialogOptions = {};
  }
}

/**
 * Detect model format from file extension
 */
function detectModelFormat(filePath: string): 'gltf' | 'glb' | 'fbx' {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'gltf':
      return 'gltf';
    case 'glb':
      return 'glb';
    case 'fbx':
      return 'fbx';
    default:
      return 'glb';
  }
}

/**
 * Close import dialog
 */
export function closeImportDialog(): void {
  const state = getAssetBrowserState();
  state.importDialogOpen = false;
  state.importDialogAssetType = null;
  state.importDialogFilePath = null;
  state.importDialogRelativePath = null;
  state.importDialogError = null;
  state.importDialogOptions = {};
}

/**
 * Check if import is valid (no errors)
 */
export function canImport(): boolean {
  const state = getAssetBrowserState();
  return state.importDialogOpen && !state.importDialogError && !!state.importDialogRelativePath;
}

/**
 * Detect asset type from file extension
 */
export function detectAssetTypeFromExtension(ext: string | undefined): AssetType | null {
  switch (ext?.toLowerCase()) {
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'gif':
      return AssetType.Texture;
    case 'mp3':
    case 'wav':
    case 'ogg':
    case 'flac':
      return AssetType.Audio;
    case 'gltf':
    case 'glb':
    case 'fbx':
      return AssetType.Model3D;
    case 'vsl':
      return AssetType.Shader;
    case 'tmj':
      return AssetType.TiledMap;
    case 'anim.json':
      return AssetType.Animation;
    case 'prefab.yaml':
      return AssetType.Prefab;
    default:
      return null;
  }
}

/**
 * Execute import with current dialog settings
 */
export async function executeImport(
  platform: EditorPlatform,
  assetsManifest: string | undefined,
): Promise<boolean> {
  const state = getAssetBrowserState();

  if (!canImport()) {
    console.error('[AssetBrowser] Cannot import: validation failed');
    return false;
  }

  const relativePath = state.importDialogRelativePath!;
  const assetType = state.importDialogAssetType!;
  const options = state.importDialogOptions;

  try {
    // Generate GUID from filename
    const fileName = relativePath.split('/').pop()?.replace(/\.[^.]+$/, '') || '';
    const guid = fileName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36);

    // Build asset config based on type
    const config = buildAssetConfig(assetType, relativePath, options);

    // Register in AssetDatabase (this also converts config to metadata internally)
    AssetDatabase.registerAdditionalAssets({ [guid]: config });

    // Save manifest
    if (assetsManifest && platform.sourceAssetsDir && platform.joinPath && platform.writeTextFile) {
      const manifestRelative = assetsManifest.startsWith('/')
        ? assetsManifest.slice(1)
        : assetsManifest;
      const manifestPath = await platform.joinPath(platform.sourceAssetsDir, manifestRelative);
      const json = AssetDatabase.serializeToJson(true);
      await platform.writeTextFile(manifestPath, json);
      console.log(`[AssetBrowser] Imported ${guid} and saved manifest to ${manifestPath}`);
    }

    // Rebuild folder tree
    state.rootFolder = buildFolderTree();

    // Select the new asset
    selectAsset(guid);

    // Close dialog
    closeImportDialog();

    return true;
  } catch (error) {
    console.error('[AssetBrowser] Import failed:', error);
    state.importDialogError = error instanceof Error ? error.message : 'Import failed';
    return false;
  }
}

/**
 * Build asset config from type, path, and options
 */
function buildAssetConfig(
  assetType: AssetType,
  path: string,
  options: ImportOptions,
): import('../../../ecs/asset/asset-database.js').AssetConfig {
  // Helper to convert string filter to enum
  const toTextureFilter = (filter: 'nearest' | 'linear'): TextureFilter =>
    filter === 'linear' ? TextureFilter.Linear : TextureFilter.Nearest;

  // Helper to convert string wrap to enum
  const toTextureWrap = (wrap: 'repeat' | 'clamp' | 'mirror'): TextureWrap => {
    switch (wrap) {
      case 'repeat':
        return TextureWrap.Repeat;
      case 'mirror':
        return TextureWrap.MirroredRepeat;
      default:
        return TextureWrap.ClampToEdge;
    }
  };

  // Helper to convert string format to enum
  const toModelFormat = (format: 'gltf' | 'glb' | 'fbx'): ModelFormat => {
    switch (format) {
      case 'gltf':
        return ModelFormat.GLTF;
      case 'fbx':
        return ModelFormat.FBX;
      default:
        return ModelFormat.GLB;
    }
  };

  switch (assetType) {
    case AssetType.Texture: {
      const textureOptions = options as TextureImportOptions;
      return {
        type: AssetType.Texture,
        path,
        magFilter: toTextureFilter(textureOptions.filtering || 'nearest'),
        minFilter: toTextureFilter(textureOptions.filtering || 'nearest'),
        wrapS: toTextureWrap(textureOptions.wrapS || 'clamp'),
        wrapT: toTextureWrap(textureOptions.wrapT || 'clamp'),
      };
    }
    case AssetType.Audio:
      return {
        type: AssetType.Audio,
        path,
      };
    case AssetType.Model3D: {
      const modelOptions = options as Model3DImportOptions;
      return {
        type: AssetType.Model3D,
        path,
        format: toModelFormat(modelOptions.format || 'glb'),
        scale: modelOptions.scale || 1.0,
      };
    }
    case AssetType.Shader:
      return {
        type: AssetType.Shader,
        path,
      };
    case AssetType.TiledMap:
      return {
        type: AssetType.TiledMap,
        path,
      };
    case AssetType.Animation:
      return {
        type: AssetType.Animation,
        path,
      };
    case AssetType.Prefab:
      return {
        type: AssetType.Prefab,
        path,
      };
    default:
      // Fallback - treat as unknown/texture
      return {
        type: AssetType.Texture,
        path,
      };
  }
}

/**
 * Get asset type display name
 */
export function getAssetTypeDisplayName(type: AssetType | null): string {
  switch (type) {
    case AssetType.Texture:
      return 'Texture';
    case AssetType.Audio:
      return 'Audio';
    case AssetType.Model3D:
      return '3D Model';
    case AssetType.Shader:
      return 'Shader';
    case AssetType.TiledMap:
      return 'Tiled Map';
    case AssetType.Animation:
      return 'Animation';
    case AssetType.Prefab:
      return 'Prefab';
    case AssetType.Material:
      return 'Material';
    default:
      return 'Unknown';
  }
}
