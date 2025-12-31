/**
 * Keyframe Editor Component
 *
 * Renders keyframe editing UI for the Inspector panel.
 * When a keyframe is selected in the animation editor, the Inspector
 * automatically switches to show keyframe editing UI.
 */

import { ImGui, ImGuiImplWeb, ImTextureRef } from '@voidscript/imgui';
import * as THREE from 'three';
import {
  type AnimationEditorState,
  type EditorKeyframe,
  type EditorTrack,
  type Vector3Value,
  type KeyframeValue,
  getAnimationEditorState,
  getKeyframe,
  getTrackForKeyframe,
  updateKeyframeValue,
  updateKeyframeTime,
  updateKeyframeEasing,
  removeKeyframe,
  clearKeyframeSelection,
  getSelectedKeyframeIds,
} from './animation-editor-state.js';
import { Sprite2D } from '../../../ecs/components/rendering/sprite-2d.js';
import { World } from '../../../ecs/world.js';
import type { Color, SpriteValue } from '../../../animation/interpolation.js';
import { EASING_NAMES } from './constants.js';
import {
  parsePropertyPath,
  resolveComponentType,
  getPropertyConfig,
} from '../../../animation/property-path.js';
import type { PropertySerializerConfig } from '../../../ecs/serialization/types.js';
import { AssetDatabase } from '../../../ecs/asset-database.js';
import { RuntimeAssetManager } from '../../../ecs/runtime-asset-manager.js';
import {
  AssetType,
  isTextureMetadata,
  type TextureMetadata,
  type SpriteDefinition,
  isTiledSpriteDefinition,
  isRectSpriteDefinition,
} from '../../../ecs/asset-metadata.js';

// ============================================================================
// Types
// ============================================================================

type InferredPropertyType =
  | 'number'
  | 'integer'
  | 'boolean'
  | 'vector2'
  | 'vector3'
  | 'color'
  | 'sprite'
  | 'runtimeAsset'
  | 'object';

// ============================================================================
// Property Type Inference
// ============================================================================

/**
 * Get the serializer config for a track's property by looking it up in the component registry.
 */
function getSerializerConfigForTrack(track: EditorTrack): PropertySerializerConfig | null {
  const parsed = parsePropertyPath(track.fullPropertyPath);
  const componentType = resolveComponentType(parsed.componentName);
  if (!componentType) return null;

  return getPropertyConfig(componentType, parsed.propertyPath);
}

/**
 * Infer the property type from a track using the component's serializer config.
 * Falls back to value-based inference if config is unavailable.
 */
function inferPropertyType(track: EditorTrack): InferredPropertyType {
  // First, try to get type from serializer config (most reliable)
  const config = getSerializerConfigForTrack(track);
  if (config) {
    const typeFromConfig = inferTypeFromConfig(config);
    if (typeFromConfig) return typeFromConfig;
  }

  // Fall back to inferring from keyframe values
  if (track.keyframes.length > 0) {
    const value = track.keyframes[0]!.value;
    const inferred = inferTypeFromValue(value);
    if (inferred) return inferred;
  }

  // Last resort: infer from property path name
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
 * Infer property type from PropertySerializerConfig
 */
function inferTypeFromConfig(config: PropertySerializerConfig): InferredPropertyType | null {
  // Check preset type first (most explicit)
  if (config.type === 'runtimeAsset') {
    return 'runtimeAsset';
  }
  if (config.type === 'enum') {
    return 'integer'; // Enums are treated as integers for animation
  }

  // Check instanceType
  if (config.instanceType) {
    const typeName = config.instanceType.name?.toLowerCase() || '';

    if (config.instanceType === Number) {
      return 'number';
    }
    if (config.instanceType === Boolean) {
      return 'boolean';
    }
    if (typeName.includes('vector3')) {
      return 'vector3';
    }
    if (typeName.includes('vector2')) {
      return 'vector2';
    }
    if (typeName.includes('color')) {
      return 'color';
    }
  }

  // Check if nullable object type (likely a complex object like color, vector, rect)
  if (config.whenNullish === 'keep' || config.isNullable) {
    return 'object';
  }

  return null;
}

/**
 * Infer property type from a keyframe value (fallback)
 */
function inferTypeFromValue(value: KeyframeValue): InferredPropertyType | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return 'number';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (typeof value === 'object') {
    // Vector3-like
    if ('x' in value && 'y' in value && 'z' in value) {
      return 'vector3';
    }
    // Vector2-like (anchor, tileSize, etc.)
    if ('x' in value && 'y' in value && !('z' in value) && !('r' in value)) {
      return 'vector2';
    }
    // Color (RGBA)
    if ('r' in value && 'g' in value && 'b' in value && 'a' in value) {
      return 'color';
    }
    // Sprite value
    if ('spriteId' in value) {
      return 'sprite';
    }
    // RuntimeAsset-like (has guid property)
    if ('guid' in value) {
      return 'runtimeAsset';
    }
    // Generic object
    return 'object';
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

  const cached = spriteTextureCache.get(guid);
  if (cached) {
    cached.lastAccessed = Date.now();
    return cached;
  }

  if (pendingSpriteLoads.has(guid)) {
    return null;
  }

  pendingSpriteLoads.add(guid);

  const metadata = AssetDatabase.getMetadata(guid);
  if (!metadata || metadata.type !== AssetType.Texture) {
    pendingSpriteLoads.delete(guid);
    return null;
  }

  const runtimeAsset = RuntimeAssetManager.get().getOrCreate(guid, metadata);

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

      renderer.initTexture(threeTexture);

      const textureProps = renderer.properties.get(threeTexture) as {
        __webglTexture?: WebGLTexture;
      };
      const webglTexture = textureProps.__webglTexture;

      if (!webglTexture) {
        return;
      }

      const textureId = ImGuiImplWeb.LoadTexture(undefined, {
        processFn: () => webglTexture,
      });

      const image = threeTexture.image as {
        width?: number;
        height?: number;
        videoWidth?: number;
        videoHeight?: number;
      };
      const width = image.width || image.videoWidth || 64;
      const height = image.height || image.videoHeight || 64;

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
// Public API
// ============================================================================

/**
 * Check if a keyframe is selected and should be shown in the Inspector
 */
export function hasSelectedKeyframe(): boolean {
  const selectedIds = getSelectedKeyframeIds();
  return selectedIds.size > 0;
}

/**
 * Get the first selected keyframe ID (for Inspector display)
 */
export function getFirstSelectedKeyframeId(): string | null {
  const selectedIds = getSelectedKeyframeIds();
  if (selectedIds.size === 0) return null;
  return selectedIds.values().next().value ?? null;
}

/**
 * Render the keyframe editor in the Inspector panel.
 * Returns true if content was rendered, false if there's no keyframe to edit.
 */
export function renderKeyframeEditor(
  renderer: THREE.WebGLRenderer | null,
  world?: World,
): boolean {
  const keyframeId = getFirstSelectedKeyframeId();
  if (!keyframeId) return false;

  const state = getAnimationEditorState();
  if (!state) return false;

  const keyframe = getKeyframe(keyframeId);
  const track = getTrackForKeyframe(keyframeId);

  if (!keyframe || !track) {
    return false;
  }

  // Get default texture from preview entity
  const defaultTextureGuid = getPreviewEntityTextureGuid(world, state);

  // Header
  const selectedCount = getSelectedKeyframeIds().size;
  if (selectedCount > 1) {
    ImGui.TextColored({ x: 1, y: 0.9, z: 0.4, w: 1 }, `${selectedCount} Keyframes Selected`);
    ImGui.TextDisabled('Multi-keyframe editing coming soon');
    ImGui.Separator();

    // Show deselect button
    if (ImGui.Button('Clear Selection')) {
      clearKeyframeSelection();
    }
    return true;
  }

  ImGui.TextColored({ x: 0.4, y: 0.8, z: 1, w: 1 }, 'Keyframe Editor');
  ImGui.Separator();

  renderKeyframeContent(state, track, keyframe, renderer, defaultTextureGuid);

  // Render sprite picker window if open
  if (spritePickerState.isOpen) {
    renderSpritePickerModal(renderer);
  }

  return true;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the default texture GUID from the preview entity's Sprite2D component
 */
function getPreviewEntityTextureGuid(world?: World, state?: AnimationEditorState | null): string | null {
  if (!world || !state) return null;

  const previewEntity = state.selectedEntity;
  if (previewEntity === null) return null;

  const spriteData = world.getComponent(previewEntity, Sprite2D);
  if (!spriteData || !spriteData.texture) return null;

  return spriteData.texture.guid ?? null;
}

// ============================================================================
// Inspector Content
// ============================================================================

function renderKeyframeContent(
  state: AnimationEditorState,
  track: EditorTrack,
  keyframe: EditorKeyframe,
  renderer: THREE.WebGLRenderer | null,
  defaultTextureGuid?: string | null,
): void {
  // Header with track info
  const parsed = parsePropertyPath(track.fullPropertyPath);
  const propertyType = inferPropertyType(track);

  ImGui.Text('Track:');
  ImGui.SameLine();
  ImGui.TextColored({ x: 0.7, y: 0.7, z: 0.9, w: 1 }, `${parsed.componentName}.${parsed.propertyPath}`);

  ImGui.Text('Type:');
  ImGui.SameLine();
  ImGui.TextDisabled(propertyType);

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
  renderActionButtons(keyframe);
}

// ============================================================================
// Time Editor
// ============================================================================

function renderTimeEditor(state: AnimationEditorState, keyframe: EditorKeyframe): void {
  ImGui.Text('Time:');

  const timeValue: [number] = [keyframe.time];
  ImGui.SetNextItemWidth(-1);
  // Use InputFloat for direct text input (more precise than slider)
  if (ImGui.InputFloat('##kfTime', timeValue, 0.01, 0.1, '%.3f')) {
    updateKeyframeTime(keyframe.id, Math.max(0, Math.min(1, timeValue[0])));
  }
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip('Time (0.0 - 1.0)');
  }

  // Show in seconds
  const timeInSeconds = keyframe.time * state.duration;
  ImGui.TextDisabled(`${timeInSeconds.toFixed(2)}s of ${state.duration.toFixed(2)}s`);
}

// ============================================================================
// Value Editor
// ============================================================================

function renderValueEditor(
  track: EditorTrack,
  keyframe: EditorKeyframe,
  renderer: THREE.WebGLRenderer | null,
  defaultTextureGuid?: string | null,
): void {
  ImGui.Text('Value:');

  const propertyType = inferPropertyType(track);

  switch (propertyType) {
    case 'number':
      renderNumberEditor(keyframe);
      break;
    case 'integer':
      renderIntegerEditor(keyframe);
      break;
    case 'boolean':
      renderBooleanEditor(keyframe);
      break;
    case 'vector2':
      renderVector2Editor(keyframe);
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
    case 'runtimeAsset':
      renderRuntimeAssetEditor(keyframe, track);
      break;
    case 'object':
      renderObjectEditor(keyframe, track);
      break;
    default:
      ImGui.TextDisabled('Unknown property type');
  }
}

function renderNumberEditor(keyframe: EditorKeyframe): void {
  const value = keyframe.value as number;
  const valueRef: [number] = [value];

  ImGui.SetNextItemWidth(-1);
  if (ImGui.DragFloat('##kfValue', valueRef, 0.01, -Infinity, Infinity, '%.3f')) {
    updateKeyframeValue(keyframe.id, valueRef[0]);
  }
}

function renderIntegerEditor(keyframe: EditorKeyframe): void {
  const value = keyframe.value as number;
  const valueRef: [number] = [Math.round(value ?? 0)];

  ImGui.SetNextItemWidth(-80);
  if (ImGui.DragInt('##kfValue', valueRef, 1, 0, 1000)) {
    updateKeyframeValue(keyframe.id, valueRef[0]);
  }

  ImGui.SameLine();
  ImGui.TextDisabled('(integer)');
}

function renderBooleanEditor(keyframe: EditorKeyframe): void {
  const value = keyframe.value as boolean;
  const valueRef: [boolean] = [value ?? false];

  if (ImGui.Checkbox('##kfValueBool', valueRef)) {
    updateKeyframeValue(keyframe.id, valueRef[0]);
  }

  ImGui.SameLine();
  ImGui.TextDisabled(value ? 'true' : 'false');
}

interface Vector2Value {
  x: number;
  y: number;
}

function renderVector2Editor(keyframe: EditorKeyframe): void {
  const value = keyframe.value as Vector2Value | null;
  const safeValue = value ?? { x: 0, y: 0 };

  // X component
  ImGui.Text('X:');
  ImGui.SameLine(30);
  const xRef: [number] = [safeValue.x];
  ImGui.SetNextItemWidth(-1);
  if (ImGui.DragFloat('##kfValueX', xRef, 0.01, -Infinity, Infinity, '%.3f')) {
    updateKeyframeValue(keyframe.id, { ...safeValue, x: xRef[0] });
  }

  // Y component
  ImGui.Text('Y:');
  ImGui.SameLine(30);
  const yRef: [number] = [safeValue.y];
  ImGui.SetNextItemWidth(-1);
  if (ImGui.DragFloat('##kfValueY', yRef, 0.01, -Infinity, Infinity, '%.3f')) {
    updateKeyframeValue(keyframe.id, { ...safeValue, y: yRef[0] });
  }
}

function renderVector3Editor(keyframe: EditorKeyframe): void {
  const value = keyframe.value as Vector3Value;

  // X component
  ImGui.Text('X:');
  ImGui.SameLine(30);
  const xRef: [number] = [value.x];
  ImGui.SetNextItemWidth(-1);
  if (ImGui.DragFloat('##kfValueX', xRef, 0.01, -Infinity, Infinity, '%.3f')) {
    updateKeyframeValue(keyframe.id, { ...value, x: xRef[0] });
  }

  // Y component
  ImGui.Text('Y:');
  ImGui.SameLine(30);
  const yRef: [number] = [value.y];
  ImGui.SetNextItemWidth(-1);
  if (ImGui.DragFloat('##kfValueY', yRef, 0.01, -Infinity, Infinity, '%.3f')) {
    updateKeyframeValue(keyframe.id, { ...value, y: yRef[0] });
  }

  // Z component
  ImGui.Text('Z:');
  ImGui.SameLine(30);
  const zRef: [number] = [value.z];
  ImGui.SetNextItemWidth(-1);
  if (ImGui.DragFloat('##kfValueZ', zRef, 0.01, -Infinity, Infinity, '%.3f')) {
    updateKeyframeValue(keyframe.id, { ...value, z: zRef[0] });
  }
}

function renderColorEditor(keyframe: EditorKeyframe): void {
  const value = keyframe.value as Color;

  // Color picker with alpha
  const colorRef: [number, number, number, number] = [value.r, value.g, value.b, value.a];

  ImGui.SetNextItemWidth(-1);
  if (ImGui.ColorEdit4('##kfValueColor', colorRef, ImGui.ColorEditFlags.AlphaBar)) {
    updateKeyframeValue(keyframe.id, {
      r: colorRef[0],
      g: colorRef[1],
      b: colorRef[2],
      a: colorRef[3],
    });
  }

  // Show hex value
  const hexR = Math.round(value.r * 255).toString(16).padStart(2, '0');
  const hexG = Math.round(value.g * 255).toString(16).padStart(2, '0');
  const hexB = Math.round(value.b * 255).toString(16).padStart(2, '0');
  const hexA = Math.round(value.a * 255).toString(16).padStart(2, '0');
  ImGui.TextDisabled(`#${hexR}${hexG}${hexB}${hexA}`);
}

function renderSpriteEditor(
  keyframe: EditorKeyframe,
  renderer: THREE.WebGLRenderer | null,
  defaultTextureGuid?: string | null,
): void {
  const value = keyframe.value as SpriteValue;

  // Show current sprite info
  if (value.spriteId) {
    ImGui.Text(`Sprite: ${value.spriteId}`);
    if (value.textureGuid) {
      const metadata = AssetDatabase.getMetadata(value.textureGuid);
      const textureName = metadata?.path.split('/').pop() || value.textureGuid;
      ImGui.SameLine();
      ImGui.TextDisabled(`(${textureName})`);
    }
  } else {
    ImGui.TextDisabled('No sprite selected');
  }

  // Sprite ID input
  const spriteIdRef: [string] = [value.spriteId];
  ImGui.SetNextItemWidth(-80);
  ImGui.InputText('##kfValueSprite', spriteIdRef, 256);
  if (spriteIdRef[0] !== value.spriteId) {
    updateKeyframeValue(keyframe.id, {
      spriteId: spriteIdRef[0],
      textureGuid: value.textureGuid,
    });
  }

  ImGui.SameLine();

  // Browse button
  if (ImGui.Button('Browse...', { x: 70, y: 0 })) {
    currentSpriteKeyframeId = keyframe.id;
    spritePickerState.isOpen = true;
    spritePickerState.searchQuery = '';
    const preferredTextureGuid = value.textureGuid ?? defaultTextureGuid ?? null;
    spritePickerState.defaultTextureGuid = preferredTextureGuid;
    spritePickerState.selectedTextureGuid = preferredTextureGuid;
  }
}

/**
 * RuntimeAsset value interface (used for texture, audio, etc.)
 */
interface RuntimeAssetValue {
  guid: string;
  path?: string;
}

function renderRuntimeAssetEditor(keyframe: EditorKeyframe, track: EditorTrack): void {
  const value = keyframe.value as RuntimeAssetValue | null;

  // Get asset type filter from serializer config
  const config = getSerializerConfigForTrack(track);
  const assetTypeFilters = config?.assetTypes ?? [];

  // Determine asset type name for display
  let assetTypeName = 'Asset';
  if (assetTypeFilters.length === 1) {
    // Single type - use that name
    assetTypeName = assetTypeFilters[0] ?? 'Asset';
  } else if (assetTypeFilters.length > 1) {
    // Multiple types - show count
    assetTypeName = `Asset (${assetTypeFilters.length} types)`;
  }

  // Show current asset
  if (value && value.guid) {
    const metadata = AssetDatabase.getMetadata(value.guid);
    const assetName = metadata?.path.split('/').pop() || value.guid;
    ImGui.Text(`${assetTypeName}:`);
    ImGui.SameLine();
    ImGui.TextColored({ x: 0.7, y: 0.9, z: 0.7, w: 1 }, assetName);
  } else {
    ImGui.Text(`${assetTypeName}:`);
    ImGui.SameLine();
    ImGui.TextDisabled('(None)');
  }

  // GUID input for manual entry
  const guidRef: [string] = [value?.guid ?? ''];
  ImGui.Text('GUID:');
  ImGui.SameLine();
  ImGui.SetNextItemWidth(-1);
  ImGui.InputText('##kfValueGuid', guidRef, 256);
  if (ImGui.IsItemDeactivatedAfterEdit() && guidRef[0] !== (value?.guid ?? '')) {
    if (guidRef[0]) {
      const metadata = AssetDatabase.getMetadata(guidRef[0]);
      updateKeyframeValue(keyframe.id, {
        guid: guidRef[0],
        path: metadata?.path,
      });
    } else {
      updateKeyframeValue(keyframe.id, null);
    }
  }

  ImGui.Spacing();

  // Get all matching assets
  const allAssets = AssetDatabase.getAllAssets();
  const matchingAssets: Array<{ guid: string; name: string; path: string }> = [];

  for (const [guid, metadata] of allAssets) {
    // If no filter, show all. If filter exists, check if type matches
    const matchesFilter =
      assetTypeFilters.length === 0 || assetTypeFilters.includes(metadata.type);
    if (matchesFilter) {
      matchingAssets.push({
        guid,
        name: metadata.path.split('/').pop() || guid,
        path: metadata.path,
      });
    }
  }

  if (matchingAssets.length > 0) {
    // Build combo items
    const labels = matchingAssets.map((a) => a.name);
    const currentIndex = value?.guid
      ? matchingAssets.findIndex((a) => a.guid === value.guid)
      : -1;
    const indexRef: [number] = [currentIndex >= 0 ? currentIndex + 1 : 0];

    const comboItems = ['(None)', ...labels].join('\0') + '\0';

    ImGui.Text('Select:');
    ImGui.SameLine();
    ImGui.SetNextItemWidth(-1);
    if (ImGui.Combo('##kfAssetCombo', indexRef, comboItems)) {
      if (indexRef[0] === 0) {
        // None selected
        updateKeyframeValue(keyframe.id, null);
      } else {
        const selected = matchingAssets[indexRef[0] - 1];
        if (selected) {
          updateKeyframeValue(keyframe.id, {
            guid: selected.guid,
            path: selected.path,
          });
        }
      }
    }
  } else {
    ImGui.TextDisabled(`No ${assetTypeName.toLowerCase()} assets found`);
  }
}

/**
 * Render a generic object editor for complex types.
 * Shows JSON representation and allows direct editing.
 */
function renderObjectEditor(keyframe: EditorKeyframe, track: EditorTrack): void {
  const value = keyframe.value;

  // Try to detect specific object patterns and render appropriate editor
  if (value && typeof value === 'object') {
    // Rect-like object (spriteRect, etc.)
    if ('x' in value && 'y' in value && 'width' in value && 'height' in value) {
      const rectValue = value as { x: number; y: number; width: number; height: number };
      renderRectEditor(keyframe, rectValue);
      return;
    }

    // Vector2-like (tileSize, anchor, etc.)
    if ('x' in value && 'y' in value && !('z' in value) && !('width' in value)) {
      const vec2Value = value as { x: number; y: number };
      ImGui.Text('X:');
      ImGui.SameLine(30);
      const xRef: [number] = [vec2Value.x];
      ImGui.SetNextItemWidth(-1);
      if (ImGui.DragFloat('##kfValueX', xRef, 0.1, -Infinity, Infinity, '%.2f')) {
        updateKeyframeValue(keyframe.id, { ...vec2Value, x: xRef[0] });
      }

      ImGui.Text('Y:');
      ImGui.SameLine(30);
      const yRef: [number] = [vec2Value.y];
      ImGui.SetNextItemWidth(-1);
      if (ImGui.DragFloat('##kfValueY', yRef, 0.1, -Infinity, Infinity, '%.2f')) {
        updateKeyframeValue(keyframe.id, { ...vec2Value, y: yRef[0] });
      }
      return;
    }
  }

  // Fallback: Show JSON editor
  ImGui.TextDisabled('Complex object - edit as JSON:');
  const jsonStr = JSON.stringify(value, null, 2);
  const jsonRef: [string] = [jsonStr];
  ImGui.InputTextMultiline('##kfValueJson', jsonRef, 4096, { x: -1, y: 100 });
  if (ImGui.IsItemDeactivatedAfterEdit()) {
    try {
      const parsed = JSON.parse(jsonRef[0]);
      updateKeyframeValue(keyframe.id, parsed);
    } catch {
      // Invalid JSON - ignore
    }
  }
}

function renderRectEditor(
  keyframe: EditorKeyframe,
  value: { x: number; y: number; width: number; height: number },
): void {
  ImGui.Text('Position:');

  ImGui.Text('X:');
  ImGui.SameLine(30);
  const xRef: [number] = [value.x];
  ImGui.SetNextItemWidth(-1);
  if (ImGui.DragFloat('##kfRectX', xRef, 1, 0, 10000, '%.0f')) {
    updateKeyframeValue(keyframe.id, { ...value, x: xRef[0] });
  }

  ImGui.Text('Y:');
  ImGui.SameLine(30);
  const yRef: [number] = [value.y];
  ImGui.SetNextItemWidth(-1);
  if (ImGui.DragFloat('##kfRectY', yRef, 1, 0, 10000, '%.0f')) {
    updateKeyframeValue(keyframe.id, { ...value, y: yRef[0] });
  }

  ImGui.Spacing();
  ImGui.Text('Size:');

  ImGui.Text('W:');
  ImGui.SameLine(30);
  const wRef: [number] = [value.width];
  ImGui.SetNextItemWidth(-1);
  if (ImGui.DragFloat('##kfRectW', wRef, 1, 1, 10000, '%.0f')) {
    updateKeyframeValue(keyframe.id, { ...value, width: wRef[0] });
  }

  ImGui.Text('H:');
  ImGui.SameLine(30);
  const hRef: [number] = [value.height];
  ImGui.SetNextItemWidth(-1);
  if (ImGui.DragFloat('##kfRectH', hRef, 1, 1, 10000, '%.0f')) {
    updateKeyframeValue(keyframe.id, { ...value, height: hRef[0] });
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

  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

function renderSpritePickerModal(renderer: THREE.WebGLRenderer | null): void {
  if (!spritePickerState.isOpen) return;

  ImGui.SetNextWindowSize({ x: 600, y: 450 }, ImGui.Cond.FirstUseEver);

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

    const texturesWithSprites = getTexturesWithSprites();
    const searchLower = spritePickerState.searchQuery.toLowerCase();

    // Auto-select first texture
    if (!spritePickerState.selectedTextureGuid && texturesWithSprites.length > 0) {
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

    const availableHeight = ImGui.GetWindowHeight() - 120;

    // Left panel: Texture list
    ImGui.BeginChild('##TextureList', { x: 180, y: availableHeight }, 1, ImGui.WindowFlags.None);
    ImGui.Text('Textures');
    ImGui.Separator();

    for (const texture of texturesWithSprites) {
      const matchesSearch =
        !searchLower ||
        texture.name.toLowerCase().includes(searchLower) ||
        texture.sprites.some((s) => s.id.toLowerCase().includes(searchLower) || s.name.toLowerCase().includes(searchLower));

      if (!matchesSearch) continue;

      const isSelected = spritePickerState.selectedTextureGuid === texture.guid;
      if (ImGui.Selectable(`${texture.name}##tex_${texture.guid}`, isSelected)) {
        spritePickerState.selectedTextureGuid = texture.guid;
      }

      ImGui.SameLine(150);
      ImGui.TextDisabled(`${texture.sprites.length}`);
    }

    ImGui.EndChild();

    ImGui.SameLine();

    // Right panel: Sprite grid
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

          ImGui.BeginGroup();

          const startPosX = ImGui.GetCursorPosX();
          const startPosY = ImGui.GetCursorPosY();

          ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.2, y: 0.2, z: 0.25, w: 1.0 });
          ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, { x: 0.3, y: 0.3, z: 0.4, w: 1.0 });

          if (ImGui.Button(`##sprite_${sprite.id}`, { x: spriteSize, y: spriteSize })) {
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

          if (textureInfo) {
            ImGui.SetCursorPos({ x: startPosX + 2, y: startPosY + 2 });

            const texWidth = textureInfo.width;
            const texHeight = textureInfo.height;

            let uv0: { x: number; y: number };
            let uv1: { x: number; y: number };

            if (isTiledSpriteDefinition(sprite)) {
              const tilesPerRow = Math.floor(texWidth / sprite.tileWidth);
              const tileX = sprite.tileIndex % tilesPerRow;
              const tileY = Math.floor(sprite.tileIndex / tilesPerRow);

              const u0 = (tileX * sprite.tileWidth) / texWidth;
              const v0 = (tileY * sprite.tileHeight) / texHeight;
              const u1 = ((tileX + 1) * sprite.tileWidth) / texWidth;
              const v1 = ((tileY + 1) * sprite.tileHeight) / texHeight;

              uv0 = { x: u0, y: 1 - v0 };
              uv1 = { x: u1, y: 1 - v1 };
            } else {
              const u0 = sprite.x / texWidth;
              const v0 = sprite.y / texHeight;
              const u1 = (sprite.x + sprite.width) / texWidth;
              const v1 = (sprite.y + sprite.height) / texHeight;

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

          ImGui.SetCursorPos({ x: startPosX, y: startPosY + spriteSize + 2 });
          ImGui.PushTextWrapPos(startPosX + spriteSize);
          ImGui.TextWrapped(sprite.name || sprite.id);
          ImGui.PopTextWrapPos();

          ImGui.EndGroup();

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

    ImGui.Separator();
    const cancelButtonWidth = 80;
    ImGui.SetCursorPosX(ImGui.GetWindowWidth() - cancelButtonWidth - 10);

    if (ImGui.Button('Cancel', { x: cancelButtonWidth, y: 0 })) {
      spritePickerState.isOpen = false;
      currentSpriteKeyframeId = null;
    }
  }
  ImGui.End();

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

  const currentIndex = EASING_NAMES.indexOf(keyframe.easingName as (typeof EASING_NAMES)[number]);
  const indexRef: [number] = [currentIndex >= 0 ? currentIndex : 0];

  const comboItems = EASING_NAMES.join('\0') + '\0';

  ImGui.SetNextItemWidth(-1);
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
  ImGui.Spacing();

  const previewWidth = -1;
  const previewHeight = 50;

  ImGui.PushStyleColorImVec4(ImGui.Col.ChildBg, { x: 0.1, y: 0.1, z: 0.12, w: 1.0 });
  ImGui.BeginChild('##easingPreview', { x: previewWidth, y: previewHeight }, 1, ImGui.WindowFlags.None);

  // Draw curve using text characters
  const samples = 30;
  let curveText = '';
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    const easedT = applyEasingForPreview(t, easingName);
    const height = Math.round(easedT * 4);
    curveText += ['_', '.', '-', '=', '#'][height] ?? '#';
  }

  ImGui.SetCursorPos({ x: 10, y: 15 });
  ImGui.TextDisabled(curveText);

  ImGui.EndChild();
  ImGui.PopStyleColor();
}

// ============================================================================
// Action Buttons
// ============================================================================

function renderActionButtons(keyframe: EditorKeyframe): void {
  // Delete button
  ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.6, y: 0.2, z: 0.2, w: 1.0 });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, { x: 0.7, y: 0.3, z: 0.3, w: 1.0 });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, { x: 0.8, y: 0.2, z: 0.2, w: 1.0 });

  if (ImGui.Button('Delete Keyframe', { x: -1, y: 0 })) {
    removeKeyframe(keyframe.id);
    clearKeyframeSelection();
  }

  ImGui.PopStyleColor(3);

  // Clear selection button
  ImGui.Spacing();
  if (ImGui.Button('Back to Entity', { x: -1, y: 0 })) {
    clearKeyframeSelection();
  }
}

// ============================================================================
// Easing Function for Preview
// ============================================================================

function applyEasingForPreview(t: number, easingName: string): number {
  switch (easingName) {
    case 'linear':
      return t;

    case 'easeInQuad':
      return t * t;
    case 'easeOutQuad':
      return t * (2 - t);
    case 'easeInOutQuad':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    case 'easeInCubic':
      return t * t * t;
    case 'easeOutCubic':
      return 1 - Math.pow(1 - t, 3);
    case 'easeInOutCubic':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    case 'easeInQuart':
      return t * t * t * t;
    case 'easeOutQuart':
      return 1 - Math.pow(1 - t, 4);
    case 'easeInOutQuart':
      return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

    case 'easeInQuint':
      return t * t * t * t * t;
    case 'easeOutQuint':
      return 1 - Math.pow(1 - t, 5);
    case 'easeInOutQuint':
      return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;

    case 'easeInSine':
      return 1 - Math.cos((t * Math.PI) / 2);
    case 'easeOutSine':
      return Math.sin((t * Math.PI) / 2);
    case 'easeInOutSine':
      return -(Math.cos(Math.PI * t) - 1) / 2;

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

    case 'easeInCirc':
      return 1 - Math.sqrt(1 - t * t);
    case 'easeOutCirc':
      return Math.sqrt(1 - Math.pow(t - 1, 2));
    case 'easeInOutCirc':
      return t < 0.5
        ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
        : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;

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
