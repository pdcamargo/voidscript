/**
 * EditorLayout - Standardized Component UI Rendering
 *
 * Provides a consistent API for building component inspector UIs.
 * All field methods follow the pattern:
 * - Label on the LEFT (rendered with Text + SameLine)
 * - Input control on the RIGHT (using ## prefix for hidden ID)
 * - Returns [newValue, hasChanged] tuple
 *
 * @example
 * ```typescript
 * const [newVolume, changed] = EditorLayout.numberField('Volume', data.volume, { min: 0, max: 1 });
 * if (changed) data.volume = newVolume;
 * ```
 */

import { ImGui, ImGuiImplWeb, ImTextureRef } from '@mori2003/jsimgui';
import * as THREE from 'three';
import type { Entity } from '../../ecs/entity.js';
import type { RuntimeAsset } from '../../ecs/runtime-asset.js';
import type {
  SpriteDefinition,
  TextureMetadata,
} from '../../ecs/asset-metadata.js';
import { Vector3 } from '../../math/vector3.js';
import { Name } from '../../ecs/components/name.js';
import {
  generateUniqueId,
  getContextRenderer,
  getContextCommands,
  tryGetEditorLayoutContext,
  pushLabelWidth,
  popLabelWidth,
  getCurrentLabelWidth,
} from './editor-layout-context.js';
import {
  openAssetPicker,
  renderAssetPickerModal,
} from './asset-picker.js';
import {
  openSpritePicker,
  renderSpritePickerModal,
} from './sprite-picker.js';
import { AssetDatabase } from '../../ecs/asset-database.js';
import { RuntimeAssetManager } from '../../ecs/runtime-asset-manager.js';
import { entityPicker } from './entity-picker.js';
import { renderEventNamePicker } from './event-name-picker.js';
import { renderComponentNamePicker } from './component-name-picker.js';
import { DefaultTextureGenerator } from '../../shader/default-texture-generator.js';
import type { NoiseTextureParams } from '../../shader/vsl/ast.js';
import type { Events } from '../../ecs/events.js';
import type { ComponentType } from '../../ecs/component.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Result tuple for field methods: [newValue, hasChanged]
 */
export type FieldResult<T> = [value: T, changed: boolean];

/**
 * Field options common to most field types
 */
export interface BaseFieldOptions {
  /** Tooltip shown on hover */
  tooltip?: string;
  /** Unique ID suffix (auto-generated if not provided) */
  id?: string;
  /** Width of the field in pixels (uses ImGui default if not set) */
  width?: number;
}

export interface NumberFieldOptions extends BaseFieldOptions {
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Drag speed */
  speed?: number;
  /** Use slider instead of drag input */
  useSlider?: boolean;
  /** Decimal format string (e.g., "%.2f") */
  format?: string;
}

export interface IntegerFieldOptions extends BaseFieldOptions {
  min?: number;
  max?: number;
  speed?: number;
  useSlider?: boolean;
}

export interface StringFieldOptions extends BaseFieldOptions {
  /** Maximum buffer size */
  maxLength?: number;
  /** Multiline text input */
  multiline?: boolean;
  /** Hint text shown when empty */
  hint?: string;
}

export interface Vector2FieldOptions extends BaseFieldOptions {
  speed?: number;
  min?: number;
  max?: number;
}

export interface Vector3FieldOptions extends BaseFieldOptions {
  speed?: number;
  min?: number;
  max?: number;
}

export interface Vector4FieldOptions extends BaseFieldOptions {
  speed?: number;
  min?: number;
  max?: number;
}

export interface ColorFieldOptions extends BaseFieldOptions {
  /** Include alpha channel */
  hasAlpha?: boolean;
}

export interface RuntimeAssetFieldOptions extends BaseFieldOptions {
  /** Filter to specific asset types */
  assetTypes?: string[];
  /** Allow clearing the asset */
  allowClear?: boolean;
}

export interface SpriteFieldOptions extends BaseFieldOptions {
  /** The texture asset containing sprites */
  textureAsset: RuntimeAsset | null;
  /** Texture metadata with sprite definitions */
  metadata: TextureMetadata | null;
}

export interface EntityFieldOptions extends BaseFieldOptions {
  /** Allow selecting "None" */
  allowNone?: boolean;
  /** Only show entities with these components */
  requiredComponents?: import('../../ecs/component.js').ComponentType<unknown>[];
}

export interface EnumFieldOptions extends BaseFieldOptions {
  /** Format enum key to display label */
  formatLabel?: (key: string) => string;
}

export interface EventNamesFieldOptions extends BaseFieldOptions {
  /** Events resource (required) */
  events: Events;
  /** Allow multiple selection */
  multiSelect?: boolean;
  /** Popup width */
  popupWidth?: number;
  /** Popup height */
  popupHeight?: number;
}

export interface ComponentNamesFieldOptions extends BaseFieldOptions {
  /** Allow multiple selection */
  multiSelect?: boolean;
  /** Filter function to exclude certain components */
  filter?: (componentType: ComponentType<unknown>) => boolean;
  /** Popup width */
  popupWidth?: number;
  /** Popup height */
  popupHeight?: number;
}

// ============================================================================
// State Management for Pickers
// ============================================================================

// Track pending asset picker selections (popup ID → result)
const pendingAssetSelections = new Map<
  string,
  { result: RuntimeAsset | null | undefined }
>();

// Track pending sprite picker selections (popup ID → result)
const pendingSpriteSelections = new Map<string, SpriteDefinition | null>();

// ============================================================================
// Noise Texture Preview Cache
// ============================================================================

interface NoisePreviewCache {
  textureId: bigint;
  texture: THREE.DataTexture;
  paramsHash: string;
}

// Cache for generated noise texture previews
const noisePreviewCache = new Map<string, NoisePreviewCache>();

// Track which previews are expanded (collapsed by default)
const noisePreviewExpanded = new Map<string, boolean>();

/**
 * Get or create a noise texture preview for ImGui rendering
 */
function getOrCreateNoisePreview(
  cacheKey: string,
  params: NoiseTextureParams,
  renderer: THREE.WebGLRenderer,
): { textureId: bigint; width: number; height: number } | null {
  const paramsHash = JSON.stringify(params);

  // Check if we have a cached preview with matching params
  const cached = noisePreviewCache.get(cacheKey);
  if (cached && cached.paramsHash === paramsHash) {
    return { textureId: cached.textureId, width: params.width, height: params.height };
  }

  // Dispose old texture if params changed
  if (cached) {
    cached.texture.dispose();
    noisePreviewCache.delete(cacheKey);
  }

  // Generate new noise texture
  const texture = DefaultTextureGenerator.generate(params);

  // Initialize texture in Three.js
  renderer.initTexture(texture);

  // Get WebGL texture handle
  const textureProps = renderer.properties.get(texture) as { __webglTexture?: WebGLTexture };
  const webglTexture = textureProps.__webglTexture;

  if (!webglTexture) {
    return null;
  }

  // Create ImGui texture ID
  const textureId = ImGuiImplWeb.LoadTexture(undefined, {
    processFn: () => webglTexture,
  });

  // Cache it
  noisePreviewCache.set(cacheKey, {
    textureId,
    texture,
    paramsHash,
  });

  return { textureId, width: params.width, height: params.height };
}

// ============================================================================
// EditorLayout Static Class
// ============================================================================

export class EditorLayout {
  // ==========================================================================
  // Layout Utilities
  // ==========================================================================

  /**
   * Begin a collapsible property group
   * @returns true if the group is expanded
   */
  static beginGroup(name: string, defaultOpen?: boolean): boolean {
    return ImGui.CollapsingHeader(
      name,
      defaultOpen ? ImGui.TreeNodeFlags.DefaultOpen : ImGui.TreeNodeFlags.None,
    );
  }

  /**
   * End a property group (no-op, keeps API symmetric)
   */
  static endGroup(): void {
    // CollapsingHeader doesn't need explicit end
  }

  /**
   * Begin an indented section
   */
  static beginIndent(): void {
    ImGui.Indent();
  }

  /**
   * End an indented section
   */
  static endIndent(): void {
    ImGui.Unindent();
  }

  /**
   * Add vertical spacing between properties
   */
  static spacing(): void {
    ImGui.Spacing();
  }

  /**
   * Add a horizontal separator line
   */
  static separator(): void {
    ImGui.Separator();
  }

  /**
   * Display a colored header text
   */
  static header(
    text: string,
    color?: { r: number; g: number; b: number },
  ): void {
    const c = color ?? { r: 0.4, g: 0.8, b: 1.0 };
    ImGui.TextColored({ x: c.r, y: c.g, z: c.b, w: 1.0 }, text);
  }

  /**
   * Display regular text
   */
  static text(text: string): void {
    ImGui.Text(text);
  }

  /**
   * Display disabled/grayed out text
   */
  static textDisabled(text: string): void {
    ImGui.TextDisabled(text);
  }

  /**
   * Display a warning message (orange)
   */
  static warning(text: string): void {
    ImGui.TextColored({ x: 1, y: 0.6, z: 0, w: 1 }, text);
  }

  /**
   * Display an error message (red)
   */
  static error(text: string): void {
    ImGui.TextColored({ x: 1, y: 0, z: 0, w: 1 }, text);
  }

  /**
   * Display a hint/info message (gray)
   */
  static hint(text: string): void {
    ImGui.TextColored({ x: 0.7, y: 0.7, z: 0.7, w: 1 }, text);
  }

  // ==========================================================================
  // Label Width Alignment (Unity-style)
  // ==========================================================================

  /**
   * Begin a label width scope where all labels will have the same width.
   * Pass an array of label strings to calculate the maximum width.
   * This creates a Unity-style inspector where labels are left-aligned
   * and values are right-aligned with consistent spacing.
   *
   * Can be nested for groups with different label sets.
   *
   * @example
   * ```typescript
   * EditorLayout.beginLabelsWidth(['Position', 'Rotation', 'Scale']);
   * // All fields here will have labels matching the width of "Rotation:"
   * const [pos, posChanged] = EditorLayout.vector3Field('Position', data.position);
   * const [rot, rotChanged] = EditorLayout.vector3Field('Rotation', data.rotation);
   * const [scale, scaleChanged] = EditorLayout.vector3Field('Scale', data.scale);
   * EditorLayout.endLabelsWidth();
   * ```
   */
  static beginLabelsWidth(labels: string[]): void {
    if (labels.length === 0) {
      pushLabelWidth(0);
      return;
    }

    // Find the longest label and estimate its width
    // We add ":" suffix to match how labels are rendered
    // NOTE: ImGui.CalcTextSize() returns ImVec2 which has WASM binding issues
    // so we estimate based on character count (approx 7 pixels per char)
    const CHAR_WIDTH = 7;
    let maxLength = 0;
    for (const label of labels) {
      const labelText = `${label}:`;
      if (labelText.length > maxLength) {
        maxLength = labelText.length;
      }
    }

    // Calculate width: characters * approx width + padding
    const maxWidth = maxLength * CHAR_WIDTH + 8;

    pushLabelWidth(maxWidth);
  }

  /**
   * End a label width scope.
   * Must be called after beginLabelsWidth().
   */
  static endLabelsWidth(): void {
    popLabelWidth();
  }

  /**
   * Internal helper to render a label with consistent width.
   * If a label width scope is active, the label will be rendered with that width.
   * Returns the label width used for tooltip positioning.
   */
  private static renderLabel(label: string, tooltip?: string): void {
    const labelWidth = getCurrentLabelWidth();
    const labelText = `${label}:`;

    if (labelWidth !== null && labelWidth > 0) {
      // Render with fixed width for alignment
      // NOTE: ImGui.CalcTextSize() returns ImVec2 which has WASM binding issues
      // so we estimate based on character count (approx 7 pixels per char)
      const CHAR_WIDTH = 7;
      const textWidth = labelText.length * CHAR_WIDTH;
      ImGui.Text(labelText);
      if (tooltip && ImGui.IsItemHovered()) {
        ImGui.SetTooltip(tooltip);
      }
      // Add spacing to reach the desired width
      const padding = labelWidth - textWidth;
      if (padding > 0) {
        ImGui.SameLine(0, padding);
      } else {
        ImGui.SameLine();
      }
    } else {
      // No width set, use default behavior
      ImGui.Text(labelText);
      if (tooltip && ImGui.IsItemHovered()) {
        ImGui.SetTooltip(tooltip);
      }
      ImGui.SameLine();
    }
  }

  // ==========================================================================
  // Primitive Field Methods
  // ==========================================================================

  /**
   * Render a number field with label on left
   */
  static numberField(
    label: string,
    value: number,
    options?: NumberFieldOptions,
  ): FieldResult<number> {
    const id = generateUniqueId(label, options?.id);
    const arr: [number] = [value];
    let changed = false;

    EditorLayout.renderLabel(label, options?.tooltip);

    if (options?.width) {
      ImGui.SetNextItemWidth(options.width);
    }

    if (options?.useSlider) {
      changed = ImGui.SliderFloat(
        id,
        arr,
        options?.min ?? 0,
        options?.max ?? 100,
        options?.format,
      );
    } else {
      changed = ImGui.DragFloat(
        id,
        arr,
        options?.speed ?? 0.1,
        options?.min,
        options?.max,
        options?.format,
      );
    }

    return [arr[0], changed];
  }

  /**
   * Render an integer field with label on left
   */
  static integerField(
    label: string,
    value: number,
    options?: IntegerFieldOptions,
  ): FieldResult<number> {
    const id = generateUniqueId(label, options?.id);
    const arr: [number] = [Math.round(value)];
    let changed = false;

    EditorLayout.renderLabel(label, options?.tooltip);

    if (options?.width) {
      ImGui.SetNextItemWidth(options.width);
    }

    if (options?.useSlider) {
      changed = ImGui.SliderInt(
        id,
        arr,
        options?.min ?? 0,
        options?.max ?? 100,
      );
    } else {
      changed = ImGui.DragInt(
        id,
        arr,
        options?.speed ?? 1,
        options?.min,
        options?.max,
      );
    }

    return [arr[0], changed];
  }

  /**
   * Render a string field with label on left
   */
  static stringField(
    label: string,
    value: string,
    options?: StringFieldOptions,
  ): FieldResult<string> {
    const id = generateUniqueId(label, options?.id);
    const buffer: [string] = [value];
    const maxLength = options?.maxLength ?? 256;

    EditorLayout.renderLabel(label, options?.tooltip);

    if (options?.width) {
      ImGui.SetNextItemWidth(options.width);
    }

    if (options?.multiline) {
      ImGui.InputTextMultiline(id, buffer, maxLength);
    } else if (options?.hint) {
      ImGui.InputTextWithHint(id, options.hint, buffer, maxLength);
    } else {
      ImGui.InputText(id, buffer, maxLength);
    }

    // Only return changed when edit is complete
    const changed = ImGui.IsItemDeactivatedAfterEdit();
    return [buffer[0], changed];
  }

  /**
   * Render a checkbox field with label on left, checkbox on right
   */
  static checkboxField(
    label: string,
    value: boolean,
    options?: BaseFieldOptions,
  ): FieldResult<boolean> {
    const id = generateUniqueId(label, options?.id);
    const arr: [boolean] = [value];

    EditorLayout.renderLabel(label, options?.tooltip);

    const changed = ImGui.Checkbox(id, arr);

    return [arr[0], changed];
  }

  // ==========================================================================
  // Vector and Color Fields
  // ==========================================================================

  /**
   * Render a Vector2 field (x, y) with label on left
   */
  static vector2Field(
    label: string,
    value: { x: number; y: number },
    options?: Vector2FieldOptions,
  ): FieldResult<{ x: number; y: number }> {
    const id = generateUniqueId(label, options?.id);
    const arr: [number, number] = [value.x, value.y];

    EditorLayout.renderLabel(label, options?.tooltip);

    if (options?.width) {
      ImGui.SetNextItemWidth(options.width);
    }

    const min = options?.min ?? -Infinity;
    const max = options?.max ?? Infinity;
    const changed = ImGui.DragFloat2(id, arr, options?.speed ?? 0.1, min, max);
    return [{ x: arr[0], y: arr[1] }, changed];
  }

  /**
   * Render a Vector3 field (x, y, z) with label on left
   */
  static vector3Field(
    label: string,
    value: Vector3 | { x: number; y: number; z: number },
    options?: Vector3FieldOptions,
  ): FieldResult<Vector3> {
    const id = generateUniqueId(label, options?.id);
    const arr: [number, number, number] = [value.x, value.y, value.z];

    EditorLayout.renderLabel(label, options?.tooltip);

    if (options?.width) {
      ImGui.SetNextItemWidth(options.width);
    }

    const min = options?.min ?? -Infinity;
    const max = options?.max ?? Infinity;
    const changed = ImGui.DragFloat3(id, arr, options?.speed ?? 0.1, min, max);
    return [new Vector3(arr[0], arr[1], arr[2]), changed];
  }

  /**
   * Render a Vector4 field (x, y, z, w) with label on left
   */
  static vector4Field(
    label: string,
    value: { x: number; y: number; z: number; w: number },
    options?: Vector4FieldOptions,
  ): FieldResult<{ x: number; y: number; z: number; w: number }> {
    const id = generateUniqueId(label, options?.id);
    const arr: [number, number, number, number] = [
      value.x,
      value.y,
      value.z,
      value.w,
    ];

    EditorLayout.renderLabel(label, options?.tooltip);

    if (options?.width) {
      ImGui.SetNextItemWidth(options.width);
    }

    const min = options?.min ?? -Infinity;
    const max = options?.max ?? Infinity;
    const changed = ImGui.DragFloat4(id, arr, options?.speed ?? 0.1, min, max);
    return [{ x: arr[0], y: arr[1], z: arr[2], w: arr[3] }, changed];
  }

  /**
   * Render a color field with label on left
   */
  static colorField(
    label: string,
    value: { r: number; g: number; b: number; a?: number },
    options?: ColorFieldOptions,
  ): FieldResult<{ r: number; g: number; b: number; a?: number }> {
    const id = generateUniqueId(label, options?.id);
    const hasAlpha = options?.hasAlpha ?? value.a !== undefined;
    let changed = false;

    EditorLayout.renderLabel(label, options?.tooltip);

    if (hasAlpha) {
      const arr: [number, number, number, number] = [
        value.r,
        value.g,
        value.b,
        value.a ?? 1,
      ];
      changed = ImGui.ColorEdit4(id, arr);
      return [{ r: arr[0], g: arr[1], b: arr[2], a: arr[3] }, changed];
    } else {
      const arr: [number, number, number] = [value.r, value.g, value.b];
      changed = ImGui.ColorEdit3(id, arr);
      return [{ r: arr[0], g: arr[1], b: arr[2] }, changed];
    }
  }

  // ==========================================================================
  // Complex Fields
  // ==========================================================================

  /**
   * Render an enum dropdown field with label on left
   */
  static enumField<T extends string | number>(
    label: string,
    value: T,
    enumObj: Record<string, T>,
    options?: EnumFieldOptions,
  ): FieldResult<T> {
    const id = generateUniqueId(label, options?.id);

    // Filter out reverse mappings for numeric enums
    const entries = Object.entries(enumObj).filter(([key]) => {
      const keyIsNumeric = !isNaN(Number(key));
      return !keyIsNumeric;
    });

    const formatLabel =
      options?.formatLabel ??
      ((key: string) =>
        key
          .split('_')
          .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          )
          .join(' '));

    const enumKeys = entries.map(([key]) => key);
    const enumLabels = enumKeys.map(formatLabel);
    let currentIndex = entries.findIndex(([, val]) => val === value);
    if (currentIndex === -1) currentIndex = 0;

    EditorLayout.renderLabel(label, options?.tooltip);

    if (options?.width) {
      ImGui.SetNextItemWidth(options.width);
    }

    const itemsString = enumLabels.join('\0') + '\0';
    const arr: [number] = [currentIndex];
    const changed = ImGui.Combo(id, arr, itemsString);

    if (changed) {
      const selectedKey = enumKeys[arr[0]];
      if (selectedKey !== undefined) {
        return [enumObj[selectedKey] as T, true];
      }
    }

    return [value, false];
  }

  /**
   * Render a runtime asset picker with label on left
   */
  static runtimeAssetField(
    label: string,
    value: RuntimeAsset | null,
    options?: RuntimeAssetFieldOptions,
  ): FieldResult<RuntimeAsset | null> {
    const id = generateUniqueId(label, options?.id);
    const popupId = `AssetPicker${id}`;
    const renderer = getContextRenderer();

    // Check for pending result from callback
    const pending = pendingAssetSelections.get(popupId);
    if (pending && pending.result !== undefined) {
      const result = pending.result;
      pendingAssetSelections.delete(popupId);
      return [result, true];
    }

    // Display label and current asset
    EditorLayout.renderLabel(label, options?.tooltip);

    if (value && value.path) {
      const assetName = value.path.split('/').pop() || value.path;
      ImGui.Text(assetName);
    } else {
      ImGui.TextDisabled('(None)');
    }

    ImGui.SameLine();

    // Pick button
    if (ImGui.Button(`Pick${id}`)) {
      openAssetPicker(popupId);
      pendingAssetSelections.set(popupId, { result: undefined });
    }

    // Clear button
    if ((options?.allowClear ?? true) && value) {
      ImGui.SameLine();
      if (ImGui.Button(`Clear${id}`)) {
        return [null, true];
      }
    }

    // Render the asset picker modal
    renderAssetPickerModal({
      popupId,
      title: `Select ${label}`,
      assetTypes: options?.assetTypes,
      selectedGuid: value?.guid ?? null,
      renderer,
      onSelect: (runtimeAsset) => {
        pendingAssetSelections.set(popupId, { result: runtimeAsset });
      },
      onCancel: () => {
        pendingAssetSelections.delete(popupId);
      },
    });

    return [value, false];
  }

  /**
   * Render a sprite picker with label on left
   * Requires textureAsset and metadata in options
   */
  static spriteField(
    label: string,
    value: SpriteDefinition | null,
    options: SpriteFieldOptions,
  ): FieldResult<SpriteDefinition | null> {
    const id = generateUniqueId(label, options?.id);
    const popupId = `SpritePicker${id}`;
    const renderer = getContextRenderer();

    if (!options.textureAsset || !options.metadata) {
      EditorLayout.renderLabel(label, options?.tooltip);
      ImGui.TextDisabled('(No texture)');
      return [value, false];
    }

    // Check for pending result from callback
    const pending = pendingSpriteSelections.get(popupId);
    if (pending !== undefined) {
      pendingSpriteSelections.delete(popupId);
      return [pending, true];
    }

    // Display label and current sprite
    EditorLayout.renderLabel(label, options?.tooltip);

    if (value) {
      ImGui.Text(value.name);
    } else {
      ImGui.TextDisabled('(None)');
    }

    ImGui.SameLine();

    // Pick button
    if (ImGui.Button(`Pick${id}`)) {
      openSpritePicker(popupId);
    }

    // Render sprite picker modal
    renderSpritePickerModal({
      popupId,
      textureAsset: options.textureAsset,
      metadata: options.metadata,
      currentSprite: value,
      currentTileIndex: null,
      currentSpriteRect: null,
      renderer,
      onSelect: (sprite) => {
        pendingSpriteSelections.set(popupId, sprite);
      },
      onCancel: () => {
        pendingSpriteSelections.delete(popupId);
      },
    });

    return [value, false];
  }

  /**
   * Render an entity picker with label on left
   */
  static entityField(
    label: string,
    value: Entity | null,
    options?: EntityFieldOptions,
  ): FieldResult<Entity | null> {
    const id = generateUniqueId(label, options?.id);
    const commands = getContextCommands();

    EditorLayout.renderLabel(label, options?.tooltip);

    // Use the existing entityPicker implementation
    const result = entityPicker({
      label: id,
      currentEntity: value,
      commands,
      allowNone: options?.allowNone ?? false,
      requiredComponents: options?.requiredComponents,
    });

    return [result.entity, result.changed];
  }

  // ==========================================================================
  // Combo/Dropdown without enum
  // ==========================================================================

  /**
   * Render a combo dropdown with string options
   */
  static comboField(
    label: string,
    currentValue: string,
    options: string[],
    fieldOptions?: BaseFieldOptions,
  ): FieldResult<string> {
    const id = generateUniqueId(label, fieldOptions?.id);

    // Only render label if it's not empty (some usages pass empty label)
    if (label) {
      EditorLayout.renderLabel(label, fieldOptions?.tooltip);
    }

    if (fieldOptions?.width) {
      ImGui.SetNextItemWidth(fieldOptions.width);
    }

    if (ImGui.BeginCombo(id, currentValue)) {
      for (const option of options) {
        const isSelected = option === currentValue;
        if (ImGui.Selectable(option, isSelected)) {
          ImGui.EndCombo();
          return [option, true];
        }
        if (isSelected) {
          ImGui.SetItemDefaultFocus();
        }
      }
      ImGui.EndCombo();
    }

    return [currentValue, false];
  }

  // ==========================================================================
  // Button
  // ==========================================================================

  /**
   * Render a button
   * @returns true if clicked
   */
  static button(
    label: string,
    options?: { width?: number; height?: number; tooltip?: string },
  ): boolean {
    const size = options?.width || options?.height
      ? { x: options.width ?? 0, y: options.height ?? 0 }
      : undefined;

    const clicked = size ? ImGui.Button(label, size) : ImGui.Button(label);

    if (options?.tooltip && ImGui.IsItemHovered()) {
      ImGui.SetTooltip(options.tooltip);
    }

    return clicked;
  }

  /**
   * Render a small button
   * @returns true if clicked
   */
  static smallButton(label: string, tooltip?: string): boolean {
    const clicked = ImGui.SmallButton(label);

    if (tooltip && ImGui.IsItemHovered()) {
      ImGui.SetTooltip(tooltip);
    }

    return clicked;
  }

  /**
   * Continue on the same line
   */
  static sameLine(): void {
    ImGui.SameLine();
  }

  // ==========================================================================
  // Name List Pickers (Event Names, Component Names)
  // ==========================================================================

  /**
   * Render a list of names with remove buttons
   * Returns the updated list if any item was removed
   */
  static nameList(
    names: string[],
    idPrefix: string,
    options?: { tooltip?: string },
  ): FieldResult<string[]> {
    if (names.length === 0) {
      ImGui.TextDisabled('(None)');
      return [names, false];
    }

    let changed = false;
    let removedIndex = -1;

    for (let i = 0; i < names.length; i++) {
      const name = names[i]!;
      ImGui.Text(`  - ${name}`);
      ImGui.SameLine();
      if (ImGui.SmallButton(`X##remove_${idPrefix}_${i}`)) {
        removedIndex = i;
        changed = true;
      }
    }

    if (changed && removedIndex >= 0) {
      const newNames = [...names];
      newNames.splice(removedIndex, 1);
      return [newNames, true];
    }

    return [names, false];
  }

  /**
   * Render an event names picker field with "Add" button and picker popup
   * Use nameList() to display the current list with remove buttons
   */
  static eventNamesField(
    label: string,
    values: string[],
    options: EventNamesFieldOptions,
  ): FieldResult<string[]> {
    const id = generateUniqueId(label, options?.id);
    const popupId = `EventPicker${id}`;

    EditorLayout.renderLabel(label, options?.tooltip);

    // Display name list with remove buttons
    const [newValues, listChanged] = EditorLayout.nameList(values, id);

    // Add button to open picker
    if (ImGui.Button(`Add${id}`)) {
      ImGui.OpenPopup(popupId);
    }

    // Track selection changes
    let pickerChanged = false;
    let finalValues = listChanged ? newValues : values;

    // Render the popup
    renderEventNamePicker({
      popupId,
      selectedNames: finalValues,
      multiSelect: options?.multiSelect ?? true,
      onSelect: (names) => {
        finalValues = names;
        pickerChanged = true;
      },
      events: options.events,
      width: options?.popupWidth,
      height: options?.popupHeight,
    });

    return [finalValues, listChanged || pickerChanged];
  }

  /**
   * Render a component names picker field with "Add" button and picker popup
   * Use nameList() to display the current list with remove buttons
   */
  static componentNamesField(
    label: string,
    values: string[],
    options?: ComponentNamesFieldOptions,
  ): FieldResult<string[]> {
    const id = generateUniqueId(label, options?.id);
    const popupId = `ComponentPicker${id}`;

    EditorLayout.renderLabel(label, options?.tooltip);

    // Display name list with remove buttons
    const [newValues, listChanged] = EditorLayout.nameList(values, id);

    // Add button to open picker
    if (ImGui.Button(`Add${id}`)) {
      ImGui.OpenPopup(popupId);
    }

    // Track selection changes
    let pickerChanged = false;
    let finalValues = listChanged ? newValues : values;

    // Render the popup
    renderComponentNamePicker({
      popupId,
      selectedNames: finalValues,
      multiSelect: options?.multiSelect ?? true,
      onSelect: (names) => {
        finalValues = names;
        pickerChanged = true;
      },
      filter: options?.filter,
      width: options?.popupWidth,
      height: options?.popupHeight,
    });

    return [finalValues, listChanged || pickerChanged];
  }

  /**
   * Render radio buttons for filter mode (AND/OR)
   */
  static filterModeField(
    label: string,
    value: 'and' | 'or',
    options?: BaseFieldOptions,
  ): FieldResult<'and' | 'or'> {
    const id = generateUniqueId(label, options?.id);

    EditorLayout.renderLabel(label, options?.tooltip);

    const isAnd = value === 'and';
    let newValue = value;
    let changed = false;

    if (ImGui.RadioButton(`ALL (AND)${id}`, isAnd)) {
      newValue = 'and';
      changed = true;
    }
    ImGui.SameLine();
    if (ImGui.RadioButton(`ANY (OR)${id}`, !isAnd)) {
      newValue = 'or';
      changed = true;
    }

    return [newValue, changed];
  }

  // ==========================================================================
  // Noise Texture Preview
  // ==========================================================================

  /**
   * Render a collapsible noise texture preview
   * Shows a visual preview of the generated noise texture
   *
   * @param label - Label for the preview section
   * @param params - Noise texture parameters
   * @param options - Preview options
   */
  static noiseTexturePreview(
    label: string,
    params: NoiseTextureParams,
    options?: {
      /** Preview size in pixels (default: 128) */
      previewSize?: number;
      /** Default expanded state (default: false) */
      defaultExpanded?: boolean;
      /** Unique ID suffix */
      id?: string;
    },
  ): void {
    const id = generateUniqueId(label, options?.id);
    const previewSize = options?.previewSize ?? 128;
    const cacheKey = `noisePreview_${id}`;

    // Get or set expanded state
    if (!noisePreviewExpanded.has(cacheKey)) {
      noisePreviewExpanded.set(cacheKey, options?.defaultExpanded ?? false);
    }

    // Render collapsible header
    const isExpanded = noisePreviewExpanded.get(cacheKey) ?? false;
    const arrow = isExpanded ? '▼' : '▶';

    if (ImGui.SmallButton(`${arrow} ${label}${id}`)) {
      noisePreviewExpanded.set(cacheKey, !isExpanded);
    }

    if (!isExpanded) {
      return;
    }

    // Get renderer
    const renderer = getContextRenderer();
    if (!renderer) {
      EditorLayout.beginIndent();
      EditorLayout.textDisabled('(No renderer available)');
      EditorLayout.endIndent();
      return;
    }

    // Get or create preview texture
    const preview = getOrCreateNoisePreview(cacheKey, params, renderer);
    if (!preview) {
      EditorLayout.beginIndent();
      EditorLayout.textDisabled('(Failed to generate preview)');
      EditorLayout.endIndent();
      return;
    }

    EditorLayout.beginIndent();

    // Calculate display size maintaining aspect ratio
    const aspectRatio = preview.width / preview.height;
    let displayWidth = previewSize;
    let displayHeight = previewSize / aspectRatio;

    if (displayHeight > previewSize) {
      displayHeight = previewSize;
      displayWidth = previewSize * aspectRatio;
    }

    // Render the texture preview
    ImGui.Image(
      new ImTextureRef(preview.textureId),
      { x: displayWidth, y: displayHeight },
    );

    // Show texture info
    EditorLayout.textDisabled(`${preview.width}×${preview.height} (${params.type})`);

    EditorLayout.endIndent();
  }
}
