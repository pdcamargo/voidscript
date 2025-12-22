/**
 * ImGui Inspector - Renders component properties for selected entity
 *
 * Displays all components attached to a selected entity with editable fields.
 * Uses component serialization config to automatically choose appropriate UI controls.
 */

import * as THREE from 'three';
import type { Application } from '../application.js';
import type { Entity } from '../../ecs/entity.js';
import type { ComponentType } from '../../ecs/component.js';
import type { PropertySerializerConfig } from '../../ecs/serialization/types.js';
import { globalComponentRegistry } from '../../ecs/component.js';
import { Vector3 } from '../../math/vector3.js';
import { ImGui } from '@mori2003/jsimgui';
import { Name } from '../../ecs/components/index.js';
import { AssetDatabase } from '../../ecs/asset-database.js';
import { RuntimeAssetManager } from '../../ecs/runtime-asset-manager.js';
import { AssetType } from '../../ecs/asset-metadata.js';
import type { RuntimeAsset } from '../../ecs/runtime-asset.js';
import { Input, KeyCode } from '../input.js';
import { duplicateEntity } from '../../ecs/entity-utils.js';
import {
  openComponentPicker,
  renderComponentPicker,
  isComponentPickerOpen,
} from './component-picker.js';
import {
  renderAssetPickerModal,
  openAssetPicker,
} from './asset-picker.js';
import { setSpritePickerRenderer } from '../../ecs/components/rendering/sprite-2d.js';

// Selection state
let selectedEntity: Entity | undefined = undefined;

// Current renderer (set during renderImGuiInspector for use by nested functions)
let currentRenderer: THREE.WebGLRenderer | null = null;

export function setSelectedEntity(entity: Entity | undefined): void {
  selectedEntity = entity;
}

export function getSelectedEntity(): Entity | undefined {
  return selectedEntity;
}

export function renderImGuiInspector(app: Application, entity?: Entity): void {
  // Use parameter or module state
  const targetEntity = entity ?? selectedEntity;

  // Store renderer for nested functions (asset picker and sprite picker)
  currentRenderer = app.getRenderer().getThreeRenderer();
  setSpritePickerRenderer(currentRenderer);

  // Setup window
  ImGui.SetNextWindowPos({ x: 320, y: 10 }, ImGui.Cond.FirstUseEver);
  ImGui.SetNextWindowSize({ x: 400, y: 600 }, ImGui.Cond.FirstUseEver);

  if (ImGui.Begin('Inspector')) {
    // Keyboard shortcuts (only when window focused and not typing in text fields)
    if (
      targetEntity !== undefined &&
      ImGui.IsWindowFocused() &&
      !ImGui.GetIO().WantTextInput
    ) {
      // Ctrl+D to duplicate
      if (Input.isCtrlPressed() && Input.isKeyJustPressed(KeyCode.KeyD)) {
        const duplicate = duplicateEntity(
          targetEntity,
          app.world,
          app.getCommands(),
        );
        if (duplicate !== undefined) {
          setSelectedEntity(duplicate); // Auto-select the duplicate
          console.log(
            `[Inspector] Duplicated entity #${targetEntity} → #${duplicate}`,
          );
        }
      }

      // Delete key to delete
      if (Input.isKeyJustPressed(KeyCode.Delete)) {
        app.getCommands().entity(targetEntity).destroy();
        setSelectedEntity(undefined); // Clear selection
        console.log(`[Inspector] Deleted entity #${targetEntity}`);
      }
    }

    if (targetEntity === undefined) {
      ImGui.Text('No entity selected');
    } else {
      renderEntityInspector(app, targetEntity);
    }
    ImGui.End();
  }
}

function renderEntityInspector(app: Application, entity: Entity): void {
  const world = app.world;
  const commands = app.getCommands();

  // Entity header
  const nameComp = world.getComponent(entity, Name);
  const displayName = nameComp?.name || `Entity #${entity}`;
  ImGui.Text(`Entity: ${displayName}`);

  // Context menu on entity header (right-click)
  if (ImGui.IsItemClicked(1)) {
    ImGui.OpenPopup('InspectorEntityContextMenu');
  }

  if (ImGui.BeginPopup('InspectorEntityContextMenu')) {
    ImGui.Text(displayName);
    ImGui.Separator();

    if (ImGui.MenuItem('Duplicate', 'Ctrl+D')) {
      const duplicate = duplicateEntity(entity, world, commands);
      if (duplicate !== undefined) {
        setSelectedEntity(duplicate);
        console.log(`[Inspector] Duplicated entity #${entity} → #${duplicate}`);
      }
    }

    if (ImGui.MenuItem('Delete', 'Del')) {
      commands.entity(entity).destroy();
      setSelectedEntity(undefined);
      console.log(`[Inspector] Deleted entity #${entity}`);
    }

    ImGui.EndPopup();
  }

  ImGui.Separator();

  // Get all components for this entity
  const componentsMap = world.getAllComponents(entity);
  if (!componentsMap) {
    ImGui.Text('Entity not found');
    return;
  }

  // Iterate through all components
  for (const [componentType, componentData] of componentsMap) {
    renderComponentSection(app, entity, componentType, componentData);
  }

  // Add Component section
  ImGui.Separator();
  if (ImGui.Button('Add Component')) {
    openComponentPicker();
  }

  // Render component picker (separate window)
  if (isComponentPickerOpen()) {
    renderComponentPicker({
      onSelect: (componentType) => {
        const metadata = componentType.metadata;
        const defaultValue =
          typeof metadata?.defaultValue === 'function'
            ? metadata.defaultValue()
            : metadata?.defaultValue || {};
        world.addComponent(entity, componentType, defaultValue);
      },
      // Filter out components already on the entity
      filter: (componentType) => {
        return !componentsMap.has(componentType);
      },
    });
  }
}

function renderComponentSection(
  app: Application,
  entity: Entity,
  componentType: ComponentType<any>,
  componentData: any,
): void {
  const world = app.world;
  const metadata = componentType.metadata;

  if (!componentData || !metadata) return;

  const displayName = metadata.displayName || componentType.name;

  // Collapsible header for component
  if (ImGui.CollapsingHeader(displayName)) {
    ImGui.Indent();

    // Check if component has custom editor - takes precedence over property rendering
    if (metadata.customEditor) {
      try {
        metadata.customEditor({
          entity,
          componentData,
          componentType,
          metadata,
          commands: app.getCommands(),
        });
      } catch (error) {
        ImGui.TextColored({ x: 1, y: 0, z: 0, w: 1 }, 'Custom editor error');
        console.error(
          `Error in custom editor for ${componentType.name}:`,
          error,
        );
      }
    } else {
      // Render each serializable property (default behavior)
      const serializationConfig = componentType.serializerConfig || {};

      for (const [propKey, propConfig] of Object.entries(serializationConfig)) {
        const config = propConfig as PropertySerializerConfig;

        // Skip non-serializable fields
        if (!config.serializable) continue;

        const propValue = componentData[propKey];

        // Check if property has custom editor
        if (config.customEditor) {
          try {
            config.customEditor({
              label: propKey,
              value: propValue,
              onChange: (newValue) => {
                componentData[propKey] = newValue;
              },
              config,
              commands: app.getCommands(),
              componentData, // Pass entire component data for custom editors that need it
            });
          } catch (error) {
            ImGui.TextColored({ x: 1, y: 0, z: 0, w: 1 }, `${propKey}: error`);
            console.error(
              `Error in custom editor for ${componentType.name}.${propKey}:`,
              error,
            );
          }
        } else {
          // Use default property rendering
          // Create unique ID by combining component type ID and property key
          const uniqueId = `${componentType.id}_${propKey}`;
          const newValue = renderProperty(
            propKey,
            propValue,
            config,
            uniqueId,
            componentData,
          );

          // Update component if value changed
          if (newValue !== undefined && newValue !== propValue) {
            componentData[propKey] = newValue;
            // Component is already mutated (reference type), no need to re-add
          }
        }
      }
    }

    // Remove component button
    if (ImGui.Button(`Remove ${displayName}##${componentType.id}`)) {
      world.removeComponent(entity, componentType);
    }

    ImGui.Unindent();
  }
}

function renderProperty(
  label: string,
  value: any,
  config: PropertySerializerConfig,
  uniqueId: string,
  componentData?: any,
): any {
  // Handle RuntimeAsset arrays first (before single RuntimeAsset)
  if (config.type === 'runtimeAsset' && config.collectionType === 'array') {
    return renderRuntimeAssetArray(label, value, uniqueId, componentData, config.assetTypes);
  }

  // Check single RuntimeAsset type (handles both null and non-null values)
  if (config.type === 'runtimeAsset') {
    return renderRuntimeAssetPicker(label, value, uniqueId, componentData, config.assetTypes);
  }

  // Handle enum types
  if (config.type === 'enum' && config.enum) {
    return renderEnumProperty(label, value, config.enum, uniqueId);
  }

  // Handle null/undefined for other types
  if (value === null || value === undefined) {
    return renderNullProperty(label, value, config, uniqueId);
  }

  // Detect type and render appropriate control

  // 1. Vector3 (instanceType check)
  if (config.instanceType === Vector3 || value instanceof Vector3) {
    const vec: [number, number, number] = [value.x, value.y, value.z];

    if (ImGui.DragFloat3(`${label}##${uniqueId}`, vec, 0.1)) {
      return new Vector3(vec[0], vec[1], vec[2]);
    }
    return undefined; // No change
  }

  // 2. Color objects (detect by properties or THREE.Color instance)
  if (isColorObject(value)) {
    const isThreeColor = value instanceof THREE.Color;

    if (value.a !== undefined) {
      // RGBA (plain object with alpha)
      const arr: [number, number, number, number] = [
        value.r,
        value.g,
        value.b,
        value.a,
      ];
      if (ImGui.ColorEdit4(`${label}##${uniqueId}`, arr)) {
        return { r: arr[0], g: arr[1], b: arr[2], a: arr[3] };
      }
    } else {
      // RGB (THREE.Color or plain object)
      const arr: [number, number, number] = [value.r, value.g, value.b];
      if (ImGui.ColorEdit3(`${label}##${uniqueId}`, arr)) {
        // Return same type as input - THREE.Color or plain object
        if (isThreeColor) {
          return new THREE.Color(arr[0], arr[1], arr[2]);
        }
        return { r: arr[0], g: arr[1], b: arr[2] };
      }
    }
    return undefined;
  }

  // 3. Nested objects (like { x, y })
  if (typeof value === 'object' && !Array.isArray(value)) {
    ImGui.Text(`${label}:`);
    ImGui.Indent();
    let changed = false;
    const newObj = { ...value };

    for (const [key, val] of Object.entries(value)) {
      if (typeof val === 'number') {
        const arr: [number] = [val];
        if (ImGui.DragFloat(`${key}##${uniqueId}_${key}`, arr, 0.1)) {
          newObj[key] = arr[0];
          changed = true;
        }
      }
      // Add more nested type support as needed
    }

    ImGui.Unindent();
    return changed ? newObj : undefined;
  }

  // 4. Primitives
  if (typeof value === 'number') {
    const arr: [number] = [value];
    if (ImGui.DragFloat(`${label}##${uniqueId}`, arr, 0.1)) {
      return arr[0];
    }
  } else if (typeof value === 'boolean') {
    const arr: [boolean] = [value];
    if (ImGui.Checkbox(`${label}##${uniqueId}`, arr)) {
      return arr[0];
    }
  } else if (typeof value === 'string') {
    try {
      // String input using InputText
      const bufferSize = 256; // Max string length
      const buffer: [string] = [value];

      ImGui.InputText(`${label}##${uniqueId}`, buffer, bufferSize);

      // Only commit changes when user finishes editing (press Enter or click away)
      // This prevents disrupting the game view while typing
      if (ImGui.IsItemDeactivatedAfterEdit()) {
        return buffer[0];
      }

      // While actively editing, don't update the component
      return undefined;
    } catch (error) {
      console.error(`Error in string input for ${label}:`, error);
      ImGui.TextColored({ x: 1, y: 0, z: 0, w: 1 }, `${label}: error`);
      return undefined;
    }
  }

  // 5. Entity reference
  if (config.type === 'entity') {
    ImGui.Text(`${label}: Entity #${value}`);
  }

  // 6. Collections (arrays/sets)
  if (config.collectionType === 'array' && Array.isArray(value)) {
    ImGui.Text(`${label}: [${value.length} items]`);
  } else if (config.collectionType === 'set' && value instanceof Set) {
    ImGui.Text(`${label}: {${value.size} items}`);
  }

  return undefined; // No change
}

function renderNullProperty(
  label: string,
  _value: any,
  config: PropertySerializerConfig,
  uniqueId: string,
): any {
  // Special handling for Vector3
  if (config.instanceType === Vector3) {
    ImGui.Text(`${label}: null`);
    ImGui.SameLine();
    if (ImGui.SmallButton(`Create##${uniqueId}`)) {
      return new Vector3(0, 0, 0);
    }
  } else {
    ImGui.Text(`${label}: null`);
  }

  return undefined;
}

/**
 * Format enum key to human-readable label
 * e.g., "COLLISION_EVENTS" -> "Collision Events"
 *       "ALL" -> "All"
 *       "NONE" -> "None"
 */
function formatEnumLabel(key: string): string {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Render an enum property as a dropdown
 */
function renderEnumProperty(
  label: string,
  value: any,
  enumObj: Record<string, string | number>,
  uniqueId: string,
): any {
  // Get enum entries - for numeric enums, filter out reverse mappings (where key is a number)
  // TypeScript numeric enums create: { A: 0, B: 1, 0: "A", 1: "B" }
  // We only want the string keys that map to numbers
  const entries = Object.entries(enumObj).filter(([key, val]) => {
    // For numeric enums: keep only entries where key is NOT a number and value IS a number
    // For string enums: keep only entries where value is a string
    const keyIsNumeric = !isNaN(Number(key));
    return !keyIsNumeric && typeof val === 'number';
  });

  // Extract keys and create formatted labels
  const enumKeys = entries.map(([key]) => key);
  const enumLabels = enumKeys.map(formatEnumLabel);

  // Find current selection index by matching the current value
  let currentIndex = entries.findIndex(([_key, val]) => val === value);
  if (currentIndex === -1) currentIndex = 0;

  // Render combo box - ImGui.Combo expects a single concatenated string with \0 separators
  const itemsString = enumLabels.join('\0') + '\0';
  const arr: [number] = [currentIndex];
  if (ImGui.Combo(`${label}##${uniqueId}`, arr, itemsString)) {
    const selectedKey = enumKeys[arr[0]];
    if (selectedKey !== undefined) {
      return enumObj[selectedKey]; // Return the numeric value
    }
  }

  return undefined; // No change
}

// Track pending asset array additions
const pendingAssetArrayAdditions = new Map<string, RuntimeAsset<any> | null>();

/**
 * Render an array of RuntimeAssets with add/remove functionality
 */
function renderRuntimeAssetArray(
  label: string,
  value: RuntimeAsset<any>[] | null | undefined,
  uniqueId: string,
  componentData?: any,
  assetTypes?: string[],
): RuntimeAsset<any>[] | undefined {
  const array = Array.isArray(value) ? value : [];
  let changed = false;
  let newArray = [...array];
  const addPopupId = `AddAsset##${uniqueId}`;

  // Check for pending addition from callback
  const pendingAddition = pendingAssetArrayAdditions.get(addPopupId);
  if (pendingAddition) {
    newArray.push(pendingAddition);
    changed = true;
    pendingAssetArrayAdditions.delete(addPopupId);
  }

  ImGui.Text(`${label}: [${array.length} items]`);

  // Add button
  ImGui.SameLine();
  if (ImGui.SmallButton(`+##${uniqueId}`)) {
    openAssetPicker(addPopupId);
  }

  // Create exclude set from current array
  const excludeGuids = new Set(array.map(a => a.guid).filter((g): g is string => !!g));

  // Render the asset picker modal
  renderAssetPickerModal({
    popupId: addPopupId,
    title: `Add ${label}`,
    assetTypes,
    excludeGuids,
    renderer: currentRenderer,
    onSelect: (runtimeAsset) => {
      // Store for next frame
      pendingAssetArrayAdditions.set(addPopupId, runtimeAsset);
    },
    onCancel: () => {
      pendingAssetArrayAdditions.delete(addPopupId);
    },
  });

  // Render each item in the array
  ImGui.Indent();
  for (let i = 0; i < array.length; i++) {
    const item = array[i];
    if (!item) continue;

    const assetName = item.path?.split('/').pop() || item.guid || 'Unknown';

    ImGui.Text(`[${i}] ${assetName}`);
    ImGui.SameLine();

    // Remove button
    if (ImGui.SmallButton(`X##remove_${uniqueId}_${i}`)) {
      newArray.splice(i, 1);
      changed = true;
    }
  }
  ImGui.Unindent();

  return changed ? newArray : undefined;
}

// Track pending asset picker selections
const pendingAssetSelections = new Map<string, {
  result: RuntimeAsset<any> | null | undefined;
  componentData?: any;
}>();

function renderRuntimeAssetPicker(
  label: string,
  value: RuntimeAsset<any> | null,
  uniqueId: string,
  componentData?: any,
  assetTypes?: string[],
): RuntimeAsset<any> | null | undefined {
  const popupId = `AssetPicker##${uniqueId}`;

  // Check for pending result from callback
  const pending = pendingAssetSelections.get(popupId);
  if (pending && pending.result !== undefined) {
    const result = pending.result;
    pendingAssetSelections.delete(popupId);

    // Update tile properties if componentData is provided (for Sprite2D)
    if (result && pending.componentData) {
      updateSpritePropertiesForTexture(pending.componentData, result);
    }

    return result;
  }

  // Display current asset
  ImGui.Text(`${label}:`);
  ImGui.SameLine();

  if (value && value.path) {
    // Show asset name (last part of path)
    const assetName = value.path.split('/').pop() || value.path;
    ImGui.Text(assetName);
  } else {
    ImGui.TextDisabled('None');
  }

  ImGui.SameLine();

  // Button to open asset picker
  if (ImGui.Button(`Pick##${uniqueId}`)) {
    openAssetPicker(popupId);
    // Store componentData for when selection is made
    pendingAssetSelections.set(popupId, { result: undefined, componentData });
  }

  // Clear button
  if (value) {
    ImGui.SameLine();
    if (ImGui.Button(`Clear##${uniqueId}`)) {
      return null; // Clear the asset
    }
  }

  // Render the asset picker modal
  renderAssetPickerModal({
    popupId,
    title: `Select ${label}`,
    assetTypes,
    selectedGuid: value?.guid ?? null,
    renderer: currentRenderer,
    onSelect: (runtimeAsset) => {
      // Store the result for next frame
      const existingPending = pendingAssetSelections.get(popupId);
      pendingAssetSelections.set(popupId, {
        result: runtimeAsset,
        componentData: existingPending?.componentData ?? componentData,
      });
    },
    onCancel: () => {
      pendingAssetSelections.delete(popupId);
    },
  });

  return undefined; // No change this frame
}

/**
 * Update sprite tile properties when a new texture is selected
 * Sets tileIndex to 0 and tileSize/tilesetSize to match the texture dimensions
 */
function updateSpritePropertiesForTexture(
  componentData: any,
  runtimeAsset: RuntimeAsset<any>,
): void {
  // Load the asset if not already loaded to get dimensions
  runtimeAsset
    .load()
    .then(() => {
      if (runtimeAsset.data && runtimeAsset.data.image) {
        const image = runtimeAsset.data.image;
        const width = image.width || image.videoWidth || 1;
        const height = image.height || image.videoHeight || 1;

        // Set tile properties to render the full texture
        componentData.tileIndex = 0;
        componentData.tileSize = { x: width, y: height };
        componentData.tilesetSize = { x: width, y: height };
      }
    })
    .catch((err) => {
      console.warn('Failed to load texture for dimension detection:', err);
    });
}

function isColorObject(value: any): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.r === 'number' &&
    typeof value.g === 'number' &&
    typeof value.b === 'number'
  );
}
