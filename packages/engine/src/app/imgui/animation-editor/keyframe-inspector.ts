/**
 * Keyframe Inspector
 *
 * Popup window for editing keyframe values, time, and easing.
 */

import { ImGui, ImGuiImplWeb, ImTextureRef } from '@voidscript/imgui';
import * as THREE from 'three';
import {
  type AnimationEditorState,
  type EditorKeyframe,
  type EditorTrack,
  type Vector3Value,
  updateKeyframeValue,
  updateKeyframeTime,
  updateKeyframeEasing,
  removeKeyframe,
  markDirty,
  clearInspectorKeyframe,
  getPreviewEntity,
} from './animation-editor-state.js';
import { Sprite2D } from '../../../ecs/components/rendering/sprite-2d.js';
import { World } from '../../../ecs/world.js';
import type { Color, SpriteValue } from '../../../animation/interpolation.js';
import { EASING_NAMES } from './constants.js';
import { parsePropertyPath } from '../../../animation/property-path.js';
import { AssetDatabase } from '../../../ecs/asset-database.js';
import { RuntimeAssetManager } from '../../../ecs/runtime-asset-manager.js';
import {
  AssetType,
  isTextureMetadata,
  type TextureMetadata,
  type SpriteDefinition,
  isTiledSpriteDefinition,
} from '../../../ecs/asset-metadata.js';
import type { KeyframeValue } from './animation-editor-state.js';

// ============================================================================
// Property Type Inference
// ============================================================================

type InferredPropertyType = 'number' | 'integer' | 'vector3' | 'color' | 'sprite';

/**
 * Infer the property type from a track's keyframe values or property path
 */
function inferPropertyType(track: EditorTrack): InferredPropertyType {
  // First, try to infer from keyframe values
  if (track.keyframes.length > 0) {
    const value = track.keyframes[0]!.value;
    const inferred = inferTypeFromValue(value);
    if (inferred) return inferred;
  }

  // Fall back to inferring from property path
  const parsed = parsePropertyPath(track.fullPropertyPath);
  const propertyPath = parsed.propertyPath.toLowerCase();

  if (propertyPath === 'position' || propertyPath === 'rotation' || propertyPath === 'scale') {
    return 'vector3';
  }
  if (propertyPath === 'color') {
    return 'color';
  }
  if (propertyPath === 'sprite') {
    return 'sprite';
  }
  if (propertyPath === 'tileindex' || propertyPath === 'frameindex') {
    return 'integer';
  }

  return 'number';
}

/**
 * Infer property type from a keyframe value
 */
function inferTypeFromValue(value: KeyframeValue): InferredPropertyType | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    // Could be number or integer - default to number
    return 'number';
  }

  if (typeof value === 'object') {
    // Vector3-like
    if ('x' in value && 'y' in value && 'z' in value) {
      return 'vector3';
    }
    // Color-like
    if ('r' in value && 'g' in value && 'b' in value && 'a' in value) {
      return 'color';
    }
    // Sprite-like
    if ('spriteId' in value) {
      return 'sprite';
    }
  }

  return null;
}

// ============================================================================
// Sprite Picker State
// ============================================================================

interface SpritePickerState {
  isOpen: boolean;
  searchQuery: string;
  selectedTextureGuid: string | null;
  defaultTextureGuid: string | null;
}

let spritePickerState: SpritePickerState = {
  isOpen: false,
  searchQuery: '',
  selectedTextureGuid: null,
  defaultTextureGuid: null,
};

// Texture cache for sprite previews
interface CachedSpriteTexture {
  textureId: bigint;
  width: number;
  height: number;
  lastAccessed: number;
}

const spriteTextureCache = new Map<string, CachedSpriteTexture>();
const pendingSpriteLoads = new Set<string>();

// Current keyframe being edited (for sprite picker callback)
let currentSpriteKeyframeId: string | null = null;

/**
 * Get or load a texture for sprite preview
 */
function getOrLoadSpriteTexture(
  guid: string,
  renderer: THREE.WebGLRenderer | null,
): CachedSpriteTexture | null {
  if (!renderer) return null;

  // Check cache first
  const cached = spriteTextureCache.get(guid);
  if (cached) {
    cached.lastAccessed = Date.now();
    return cached;
  }

  // Check if already loading
  if (pendingSpriteLoads.has(guid)) {
    return null;
  }

  // Start loading
  pendingSpriteLoads.add(guid);

  const metadata = AssetDatabase.getMetadata(guid);
  if (!metadata || metadata.type !== AssetType.Texture) {
    pendingSpriteLoads.delete(guid);
    return null;
  }

  const runtimeAsset = RuntimeAssetManager.get().getOrCreate(guid, metadata);

  // Start async load
  runtimeAsset
    .load()
    .then(() => {
      pendingSpriteLoads.delete(guid);

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
      spriteTextureCache.set(guid, {
        textureId,
        width,
        height,
        lastAccessed: Date.now(),
      });
    })
    .catch((err) => {
      pendingSpriteLoads.delete(guid);
      console.warn(`Failed to load texture for sprite picker: ${guid}`, err);
    });

  return null;
}

// ============================================================================
// Inspector Window
// ============================================================================

/**
 * Get the default texture GUID from the preview entity's Sprite2D component
 */
function getPreviewEntityTextureGuid(world?: World): string | null {
  if (!world) return null;

  const previewEntity = getPreviewEntity();
  if (previewEntity === null) return null;

  const spriteData = world.getComponent(previewEntity, Sprite2D);
  if (!spriteData || !spriteData.texture) return null;

  return spriteData.texture.guid ?? null;
}

/**
 * Render the keyframe inspector popup window
 */
export function renderKeyframeInspector(
  state: AnimationEditorState,
  renderer?: { getThreeRenderer: () => THREE.WebGLRenderer },
  world?: World,
): void {
  if (!state.inspectorKeyframeId) return;

  // Find the keyframe and its track
  let foundTrack: EditorTrack | null = null;
  let foundKeyframe: EditorKeyframe | null = null;

  for (const track of state.tracks) {
    const kf = track.keyframes.find((k) => k.id === state.inspectorKeyframeId);
    if (kf) {
      foundTrack = track;
      foundKeyframe = kf;
      break;
    }
  }

  if (!foundTrack || !foundKeyframe) {
    clearInspectorKeyframe();
    return;
  }

  // Get default texture from preview entity
  const defaultTextureGuid = getPreviewEntityTextureGuid(world);

  // Set initial window position (centered)
  ImGui.SetNextWindowSize({ x: 300, y: 0 }, ImGui.Cond.FirstUseEver);

  const windowFlags = ImGui.WindowFlags.NoCollapse | ImGui.WindowFlags.AlwaysAutoResize;

  const isOpenRef: [boolean] = [true];
  if (ImGui.Begin('Keyframe Inspector##AnimEditor', isOpenRef, windowFlags)) {
    renderKeyframeContent(state, foundTrack, foundKeyframe, renderer, defaultTextureGuid);
  }
  ImGui.End();

  // Close inspector when window is closed
  if (!isOpenRef[0]) {
    clearInspectorKeyframe();
  }

  // Render sprite picker window if open
  if (spritePickerState.isOpen) {
    renderSpritePickerModal(renderer?.getThreeRenderer() ?? null);
  }
}

// ============================================================================
// Inspector Content
// ============================================================================

function renderKeyframeContent(
  state: AnimationEditorState,
  track: EditorTrack,
  keyframe: EditorKeyframe,
  renderer?: { getThreeRenderer: () => THREE.WebGLRenderer },
  defaultTextureGuid?: string | null,
): void {
  // Header with track info - parse the full property path for display
  const parsed = parsePropertyPath(track.fullPropertyPath);
  const propertyType = inferPropertyType(track);

  ImGui.TextDisabled(`Track: ${parsed.componentName}.${parsed.propertyPath}`);
  ImGui.TextDisabled(`Type: ${propertyType}`);
  ImGui.Separator();

  // Time editor
  renderTimeEditor(state, keyframe);

  ImGui.Spacing();

  // Value editor based on property type
  renderValueEditor(track, keyframe, renderer, defaultTextureGuid);

  ImGui.Spacing();
  ImGui.Separator();

  // Easing editor
  renderEasingEditor(keyframe);

  ImGui.Spacing();
  ImGui.Separator();
  ImGui.Spacing();

  // Action buttons
  renderActionButtons(track, keyframe);
}

// ============================================================================
// Time Editor
// ============================================================================

function renderTimeEditor(state: AnimationEditorState, keyframe: EditorKeyframe): void {
  ImGui.Text('Time:');

  const timeValue: [number] = [keyframe.time];
  ImGui.SetNextItemWidth(200);
  // Use InputFloat for direct text input (more precise than slider)
  if (ImGui.InputFloat('##kfTime', timeValue, 0.01, 0.1, '%.3f')) {
    updateKeyframeTime(keyframe.id, Math.max(0, Math.min(1, timeValue[0])));
  }
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip('Time (0.0 - 1.0)');
  }

  // Also show in seconds based on duration
  const timeInSeconds = keyframe.time * state.duration;
  ImGui.SameLine();
  ImGui.TextDisabled(`(${timeInSeconds.toFixed(2)}s)`);
}

// ============================================================================
// Value Editor
// ============================================================================

function renderValueEditor(
  track: EditorTrack,
  keyframe: EditorKeyframe,
  renderer?: { getThreeRenderer: () => THREE.WebGLRenderer },
  defaultTextureGuid?: string | null,
): void {
  ImGui.Text('Value:');

  // Infer property type from track
  const propertyType = inferPropertyType(track);

  switch (propertyType) {
    case 'number':
      renderNumberEditor(keyframe);
      break;
    case 'integer':
      renderIntegerEditor(keyframe);
      break;
    case 'vector3':
      renderVector3Editor(keyframe);
      break;
    case 'color':
      renderColorEditor(keyframe);
      break;
    case 'sprite':
      renderSpriteEditor(keyframe, renderer, defaultTextureGuid);
      break;
    default:
      ImGui.TextDisabled('Unknown property type');
  }
}

function renderNumberEditor(keyframe: EditorKeyframe): void {
  const value = keyframe.value as number;
  const valueRef: [number] = [value];

  ImGui.SetNextItemWidth(200);
  if (ImGui.DragFloat('##kfValue', valueRef, 0.01, -Infinity, Infinity, '%.3f')) {
    updateKeyframeValue(keyframe.id, valueRef[0]);
  }
}

function renderIntegerEditor(keyframe: EditorKeyframe): void {
  const value = keyframe.value as number;
  const valueRef: [number] = [Math.round(value)];

  ImGui.SetNextItemWidth(200);
  if (ImGui.DragInt('##kfValue', valueRef, 1, 0, 1000)) {
    updateKeyframeValue(keyframe.id, valueRef[0]);
  }

  ImGui.SameLine();
  ImGui.TextDisabled('(frame index)');
}

function renderVector3Editor(keyframe: EditorKeyframe): void {
  const value = keyframe.value as Vector3Value;

  // X component
  ImGui.Text('X:');
  ImGui.SameLine(30);
  const xRef: [number] = [value.x];
  ImGui.SetNextItemWidth(170);
  if (ImGui.DragFloat('##kfValueX', xRef, 0.01, -Infinity, Infinity, '%.3f')) {
    updateKeyframeValue(keyframe.id, { ...value, x: xRef[0] });
  }

  // Y component
  ImGui.Text('Y:');
  ImGui.SameLine(30);
  const yRef: [number] = [value.y];
  ImGui.SetNextItemWidth(170);
  if (ImGui.DragFloat('##kfValueY', yRef, 0.01, -Infinity, Infinity, '%.3f')) {
    updateKeyframeValue(keyframe.id, { ...value, y: yRef[0] });
  }

  // Z component
  ImGui.Text('Z:');
  ImGui.SameLine(30);
  const zRef: [number] = [value.z];
  ImGui.SetNextItemWidth(170);
  if (ImGui.DragFloat('##kfValueZ', zRef, 0.01, -Infinity, Infinity, '%.3f')) {
    updateKeyframeValue(keyframe.id, { ...value, z: zRef[0] });
  }
}

function renderColorEditor(keyframe: EditorKeyframe): void {
  const value = keyframe.value as Color;

  // Color picker with alpha
  const colorRef: [number, number, number, number] = [value.r, value.g, value.b, value.a];

  ImGui.SetNextItemWidth(200);
  if (ImGui.ColorEdit4('##kfValueColor', colorRef, ImGui.ColorEditFlags.AlphaBar)) {
    updateKeyframeValue(keyframe.id, {
      r: colorRef[0],
      g: colorRef[1],
      b: colorRef[2],
      a: colorRef[3],
    });
  }

  // Show hex value
  const hexR = Math.round(value.r * 255)
    .toString(16)
    .padStart(2, '0');
  const hexG = Math.round(value.g * 255)
    .toString(16)
    .padStart(2, '0');
  const hexB = Math.round(value.b * 255)
    .toString(16)
    .padStart(2, '0');
  const hexA = Math.round(value.a * 255)
    .toString(16)
    .padStart(2, '0');
  ImGui.TextDisabled(`#${hexR}${hexG}${hexB}${hexA}`);
}

function renderSpriteEditor(
  keyframe: EditorKeyframe,
  renderer?: { getThreeRenderer: () => THREE.WebGLRenderer },
  defaultTextureGuid?: string | null,
): void {
  const value = keyframe.value as SpriteValue;

  // Show current sprite info
  if (value.spriteId) {
    ImGui.Text(`Sprite: ${value.spriteId}`);
    // Show texture info if available
    if (value.textureGuid) {
      const metadata = AssetDatabase.getMetadata(value.textureGuid);
      const textureName = metadata?.path.split('/').pop() || value.textureGuid;
      ImGui.SameLine();
      ImGui.TextDisabled(`(${textureName})`);
    }
  } else {
    ImGui.TextDisabled('No sprite selected');
  }

  // Sprite ID input (for manual entry)
  const spriteIdRef: [string] = [value.spriteId];
  ImGui.SetNextItemWidth(140);
  ImGui.InputText('##kfValueSprite', spriteIdRef, 256);
  if (spriteIdRef[0] !== value.spriteId) {
    // Preserve textureGuid when manually editing spriteId
    updateKeyframeValue(keyframe.id, {
      spriteId: spriteIdRef[0],
      textureGuid: value.textureGuid,
    });
  }

  ImGui.SameLine();

  // Browse button to open sprite picker window
  if (ImGui.Button('Browse...', { x: 70, y: 0 })) {
    currentSpriteKeyframeId = keyframe.id;
    spritePickerState.isOpen = true;
    spritePickerState.searchQuery = '';
    // Prefer the sprite's textureGuid, then entity's texture, then first available
    const preferredTextureGuid = value.textureGuid ?? defaultTextureGuid ?? null;
    spritePickerState.defaultTextureGuid = preferredTextureGuid;
    spritePickerState.selectedTextureGuid = preferredTextureGuid;
  }
}

// ============================================================================
// Sprite Picker Modal
// ============================================================================

interface TextureWithSprites {
  guid: string;
  name: string;
  path: string;
  metadata: TextureMetadata;
  sprites: SpriteDefinition[];
}

/**
 * Get all textures that have sprite definitions
 */
function getTexturesWithSprites(): TextureWithSprites[] {
  const result: TextureWithSprites[] = [];

  const allAssets = AssetDatabase.getAllAssets();
  for (const [guid, metadata] of allAssets) {
    if (isTextureMetadata(metadata) && metadata.sprites && metadata.sprites.length > 0) {
      const name = metadata.path.split('/').pop() || metadata.path;
      result.push({
        guid,
        name,
        path: metadata.path,
        metadata,
        sprites: metadata.sprites,
      });
    }
  }

  // Sort by name
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

/**
 * Render the sprite picker window (standalone window, not a modal popup)
 */
function renderSpritePickerModal(renderer: THREE.WebGLRenderer | null): void {
  if (!spritePickerState.isOpen) return;

  ImGui.SetNextWindowSize({ x: 600, y: 450 }, ImGui.Cond.FirstUseEver);

  // Use a regular window instead of popup modal to avoid context issues
  const isOpenRef: [boolean] = [true];
  if (ImGui.Begin('Select Sprite##SpritePicker', isOpenRef, ImGui.WindowFlags.None)) {
    ImGui.Separator();

    // Search bar
    ImGui.Text('Search:');
    ImGui.SameLine();
    const searchBuffer: [string] = [spritePickerState.searchQuery];
    ImGui.SetNextItemWidth(200);
    ImGui.InputText('##spriteSearch', searchBuffer, 256);
    spritePickerState.searchQuery = searchBuffer[0];

    ImGui.Separator();

    // Get textures with sprites
    const texturesWithSprites = getTexturesWithSprites();
    const searchLower = spritePickerState.searchQuery.toLowerCase();

    // Auto-select first texture if nothing is selected and there are textures available
    if (!spritePickerState.selectedTextureGuid && texturesWithSprites.length > 0) {
      // Prefer the default texture if it exists
      if (spritePickerState.defaultTextureGuid) {
        const hasDefaultTexture = texturesWithSprites.some(
          (t) => t.guid === spritePickerState.defaultTextureGuid,
        );
        if (hasDefaultTexture) {
          spritePickerState.selectedTextureGuid = spritePickerState.defaultTextureGuid;
        } else {
          spritePickerState.selectedTextureGuid = texturesWithSprites[0]?.guid ?? null;
        }
      } else {
        spritePickerState.selectedTextureGuid = texturesWithSprites[0]?.guid ?? null;
      }
    }

    // Two-column layout: textures list on left, sprites on right
    const availableHeight = ImGui.GetWindowHeight() - 120;

    // Left panel: Texture list
    ImGui.BeginChild('##TextureList', { x: 180, y: availableHeight }, 1, ImGui.WindowFlags.None);
    ImGui.Text('Textures');
    ImGui.Separator();

    for (const texture of texturesWithSprites) {
      // Filter by search
      const matchesSearch =
        !searchLower ||
        texture.name.toLowerCase().includes(searchLower) ||
        texture.sprites.some((s) => s.id.toLowerCase().includes(searchLower) || s.name.toLowerCase().includes(searchLower));

      if (!matchesSearch) continue;

      const isSelected = spritePickerState.selectedTextureGuid === texture.guid;
      if (ImGui.Selectable(`${texture.name}##tex_${texture.guid}`, isSelected)) {
        spritePickerState.selectedTextureGuid = texture.guid;
      }

      // Show sprite count
      ImGui.SameLine(150);
      ImGui.TextDisabled(`${texture.sprites.length}`);
    }

    ImGui.EndChild();

    ImGui.SameLine();

    // Right panel: Sprite grid for selected texture
    ImGui.BeginChild('##SpriteGrid', { x: 0, y: availableHeight }, 1, ImGui.WindowFlags.None);
    ImGui.Text('Sprites');
    ImGui.Separator();

    if (spritePickerState.selectedTextureGuid) {
      const selectedTexture = texturesWithSprites.find(
        (t) => t.guid === spritePickerState.selectedTextureGuid,
      );

      if (selectedTexture) {
        const textureInfo = getOrLoadSpriteTexture(selectedTexture.guid, renderer);
        const spriteSize = 64;
        const spacing = 8;
        const windowWidth = ImGui.GetWindowWidth() - 16;
        const spritesPerRow = Math.max(1, Math.floor(windowWidth / (spriteSize + spacing)));

        let index = 0;
        for (const sprite of selectedTexture.sprites) {
          // Filter sprites by search
          if (
            searchLower &&
            !sprite.id.toLowerCase().includes(searchLower) &&
            !sprite.name.toLowerCase().includes(searchLower)
          ) {
            continue;
          }

          if (index > 0 && index % spritesPerRow !== 0) {
            ImGui.SameLine();
          }

          // Render sprite button with preview
          ImGui.BeginGroup();

          const startPosX = ImGui.GetCursorPosX();
          const startPosY = ImGui.GetCursorPosY();

          // Sprite preview with button
          ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.2, y: 0.2, z: 0.25, w: 1.0 });
          ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, { x: 0.3, y: 0.3, z: 0.4, w: 1.0 });

          if (ImGui.Button(`##sprite_${sprite.id}`, { x: spriteSize, y: spriteSize })) {
            // Sprite selected! Include textureGuid for cross-texture support
            if (currentSpriteKeyframeId) {
              updateKeyframeValue(currentSpriteKeyframeId, {
                spriteId: sprite.id,
                textureGuid: selectedTexture.guid,
              });
            }
            spritePickerState.isOpen = false;
            currentSpriteKeyframeId = null;
          }

          ImGui.PopStyleColor(2);

          // Render texture preview on top of button
          if (textureInfo) {
            ImGui.SetCursorPos({ x: startPosX + 2, y: startPosY + 2 });

            // Calculate UV coordinates for this sprite
            const texWidth = textureInfo.width;
            const texHeight = textureInfo.height;

            let uv0: { x: number; y: number };
            let uv1: { x: number; y: number };

            if (isTiledSpriteDefinition(sprite)) {
              // Calculate tile position
              const tilesPerRow = Math.floor(texWidth / sprite.tileWidth);
              const tileX = sprite.tileIndex % tilesPerRow;
              const tileY = Math.floor(sprite.tileIndex / tilesPerRow);

              const u0 = (tileX * sprite.tileWidth) / texWidth;
              const v0 = (tileY * sprite.tileHeight) / texHeight;
              const u1 = ((tileX + 1) * sprite.tileWidth) / texWidth;
              const v1 = ((tileY + 1) * sprite.tileHeight) / texHeight;

              // Flip Y for correct orientation
              uv0 = { x: u0, y: 1 - v0 };
              uv1 = { x: u1, y: 1 - v1 };
            } else {
              // Rect sprite
              const u0 = sprite.x / texWidth;
              const v0 = sprite.y / texHeight;
              const u1 = (sprite.x + sprite.width) / texWidth;
              const v1 = (sprite.y + sprite.height) / texHeight;

              // Flip Y for correct orientation
              uv0 = { x: u0, y: 1 - v0 };
              uv1 = { x: u1, y: 1 - v1 };
            }

            ImGui.Image(
              new ImTextureRef(textureInfo.textureId),
              { x: spriteSize - 4, y: spriteSize - 4 },
              uv0,
              uv1,
            );
          }

          // Sprite name below
          ImGui.SetCursorPos({ x: startPosX, y: startPosY + spriteSize + 2 });
          ImGui.PushTextWrapPos(startPosX + spriteSize);
          ImGui.TextWrapped(sprite.name || sprite.id);
          ImGui.PopTextWrapPos();

          ImGui.EndGroup();

          // Tooltip with more info
          if (ImGui.IsItemHovered()) {
            ImGui.SetTooltip(`ID: ${sprite.id}\nName: ${sprite.name}`);
          }

          index++;
        }

        if (index === 0) {
          ImGui.TextDisabled('No matching sprites');
        }
      }
    } else {
      ImGui.TextDisabled('Select a texture from the left panel');
    }

    ImGui.EndChild();

    // Footer with cancel button
    ImGui.Separator();
    const cancelButtonWidth = 80;
    ImGui.SetCursorPosX(ImGui.GetWindowWidth() - cancelButtonWidth - 10);

    if (ImGui.Button('Cancel', { x: cancelButtonWidth, y: 0 })) {
      spritePickerState.isOpen = false;
      currentSpriteKeyframeId = null;
    }
  }
  ImGui.End();

  // Handle window close via X button
  if (!isOpenRef[0]) {
    spritePickerState.isOpen = false;
    currentSpriteKeyframeId = null;
  }
}

// ============================================================================
// Easing Editor
// ============================================================================

function renderEasingEditor(keyframe: EditorKeyframe): void {
  ImGui.Text('Easing:');

  // Find current easing index
  const currentIndex = EASING_NAMES.indexOf(keyframe.easingName as (typeof EASING_NAMES)[number]);
  const indexRef: [number] = [currentIndex >= 0 ? currentIndex : 0];

  // Build combo items string
  const comboItems = EASING_NAMES.join('\0') + '\0';

  ImGui.SetNextItemWidth(200);
  if (ImGui.Combo('##kfEasing', indexRef, comboItems)) {
    const newEasing = EASING_NAMES[indexRef[0]];
    if (newEasing) {
      updateKeyframeEasing(keyframe.id, newEasing);
    }
  }

  // Show easing curve preview
  renderEasingPreview(keyframe.easingName);
}

function renderEasingPreview(easingName: string): void {
  // Draw a simple visual representation of the easing curve
  ImGui.Spacing();

  const previewWidth = 200;
  const previewHeight = 60;

  // Use a child region with background
  ImGui.PushStyleColorImVec4(ImGui.Col.ChildBg, { x: 0.1, y: 0.1, z: 0.12, w: 1.0 });
  ImGui.BeginChild('##easingPreview', { x: previewWidth, y: previewHeight }, 1, ImGui.WindowFlags.None);

  // Draw curve using text characters (simple ASCII art)
  const samples = 20;
  let curveText = '';
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    const easedT = applyEasingForPreview(t, easingName);
    const height = Math.round(easedT * 4); // 0-4 levels
    curveText += ['_', '.', '-', '=', '#'][height] ?? '#';
  }

  ImGui.SetCursorPos({ x: 10, y: 20 });
  ImGui.TextDisabled(curveText);

  ImGui.EndChild();
  ImGui.PopStyleColor();
}

// ============================================================================
// Action Buttons
// ============================================================================

function renderActionButtons(track: EditorTrack, keyframe: EditorKeyframe): void {
  // Delete button
  ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.6, y: 0.2, z: 0.2, w: 1.0 });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, { x: 0.7, y: 0.3, z: 0.3, w: 1.0 });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, { x: 0.8, y: 0.2, z: 0.2, w: 1.0 });

  if (ImGui.Button('Delete Keyframe', { x: 140, y: 0 })) {
    removeKeyframe(keyframe.id);
    clearInspectorKeyframe();
  }

  ImGui.PopStyleColor(3);

  ImGui.SameLine();

  // Close button
  if (ImGui.Button('Close', { x: 80, y: 0 })) {
    clearInspectorKeyframe();
  }
}

// ============================================================================
// Easing Function for Preview
// ============================================================================

function applyEasingForPreview(t: number, easingName: string): number {
  // Simplified easing implementations for preview
  switch (easingName) {
    case 'linear':
      return t;

    // Quad
    case 'easeInQuad':
      return t * t;
    case 'easeOutQuad':
      return t * (2 - t);
    case 'easeInOutQuad':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    // Cubic
    case 'easeInCubic':
      return t * t * t;
    case 'easeOutCubic':
      return 1 - Math.pow(1 - t, 3);
    case 'easeInOutCubic':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // Quart
    case 'easeInQuart':
      return t * t * t * t;
    case 'easeOutQuart':
      return 1 - Math.pow(1 - t, 4);
    case 'easeInOutQuart':
      return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

    // Quint
    case 'easeInQuint':
      return t * t * t * t * t;
    case 'easeOutQuint':
      return 1 - Math.pow(1 - t, 5);
    case 'easeInOutQuint':
      return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;

    // Sine
    case 'easeInSine':
      return 1 - Math.cos((t * Math.PI) / 2);
    case 'easeOutSine':
      return Math.sin((t * Math.PI) / 2);
    case 'easeInOutSine':
      return -(Math.cos(Math.PI * t) - 1) / 2;

    // Expo
    case 'easeInExpo':
      return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
    case 'easeOutExpo':
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    case 'easeInOutExpo':
      return t === 0
        ? 0
        : t === 1
          ? 1
          : t < 0.5
            ? Math.pow(2, 20 * t - 10) / 2
            : (2 - Math.pow(2, -20 * t + 10)) / 2;

    // Circ
    case 'easeInCirc':
      return 1 - Math.sqrt(1 - t * t);
    case 'easeOutCirc':
      return Math.sqrt(1 - Math.pow(t - 1, 2));
    case 'easeInOutCirc':
      return t < 0.5
        ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
        : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;

    // Back
    case 'easeInBack': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return c3 * t * t * t - c1 * t * t;
    }
    case 'easeOutBack': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    case 'easeInOutBack': {
      const c1 = 1.70158;
      const c2 = c1 * 1.525;
      return t < 0.5
        ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    }

    // Elastic
    case 'easeInElastic': {
      const c4 = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
    }
    case 'easeOutElastic': {
      const c4 = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
    case 'easeInOutElastic': {
      const c5 = (2 * Math.PI) / 4.5;
      return t === 0
        ? 0
        : t === 1
          ? 1
          : t < 0.5
            ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
            : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
    }

    // Bounce
    case 'easeInBounce':
      return 1 - bounceOut(1 - t);
    case 'easeOutBounce':
      return bounceOut(t);
    case 'easeInOutBounce':
      return t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2;

    default:
      return t;
  }
}

function bounceOut(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    return n1 * (t -= 1.5 / d1) * t + 0.75;
  } else if (t < 2.5 / d1) {
    return n1 * (t -= 2.25 / d1) * t + 0.9375;
  } else {
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
}
