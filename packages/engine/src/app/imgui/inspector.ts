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

// Selection state
let selectedEntity: Entity | undefined = undefined;

export function setSelectedEntity(entity: Entity | undefined): void {
  selectedEntity = entity;
}

export function getSelectedEntity(): Entity | undefined {
  return selectedEntity;
}

export function renderImGuiInspector(app: Application, entity?: Entity): void {
  // Use parameter or module state
  const targetEntity = entity ?? selectedEntity;

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
 * Render an enum property as a dropdown
 */
function renderEnumProperty(
  label: string,
  value: any,
  enumObj: Record<string, string | number>,
  uniqueId: string,
): any {
  // Get enum entries (key-value pairs)
  const entries = Object.entries(enumObj);

  // Filter to only get the string keys (enum names, not reverse mappings for numeric enums)
  const enumNames = entries
    .filter(([_key, val]) => typeof val === 'string' || typeof val === 'number')
    .map(([key]) => key);

  // Find current selection index
  const currentValue = typeof value === 'string' ? value : String(value);
  let currentIndex = enumNames.findIndex(name => enumObj[name] === currentValue || name === currentValue);
  if (currentIndex === -1) currentIndex = 0;

  // Render combo box - ImGui.Combo expects a single concatenated string with \0 separators
  const itemsString = enumNames.join('\0') + '\0';
  const arr: [number] = [currentIndex];
  if (ImGui.Combo(`${label}##${uniqueId}`, arr, itemsString)) {
    const selectedName = enumNames[arr[0]];
    return enumObj[selectedName];
  }

  return undefined; // No change
}

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

  ImGui.Text(`${label}: [${array.length} items]`);

  // Add button
  ImGui.SameLine();
  const addPopupId = `AddAsset##${uniqueId}`;
  if (ImGui.SmallButton(`+##${uniqueId}`)) {
    ImGui.OpenPopup(addPopupId);
  }

  // Add asset popup
  ImGui.SetNextWindowSize({ x: 600, y: 400 }, ImGui.Cond.FirstUseEver);
  if (ImGui.BeginPopupModal(addPopupId, null, ImGui.WindowFlags.None)) {
    ImGui.Text('Select an asset to add:');
    ImGui.Separator();

    // Get all assets from AssetDatabase
    const allAssets = AssetDatabase.getAllAssets();
    const filteredAssets: Array<{ guid: string; path: string; name: string; type: string }> = [];

    for (const [guid, metadata] of allAssets) {
      // Filter by assetTypes if specified
      if (!assetTypes || assetTypes.includes(metadata.type)) {
        // Exclude already added assets
        if (!array.some(a => a.guid === guid)) {
          const name = metadata.path.split('/').pop() || metadata.path;
          filteredAssets.push({ guid, path: metadata.path, name, type: metadata.type });
        }
      }
    }

    // Render assets in a grid
    const itemsPerRow = 4;
    const buttonSize = 128;

    ImGui.BeginChild('AssetGrid', { x: 0, y: -40 }, ImGui.WindowFlags.None);

    for (let i = 0; i < filteredAssets.length; i++) {
      const asset = filteredAssets[i];
      if (!asset) continue;

      if (i > 0 && i % itemsPerRow !== 0) {
        ImGui.SameLine();
      }

      ImGui.BeginGroup();

      if (ImGui.Button(`##add_asset_${asset.guid}`, { x: buttonSize, y: buttonSize })) {
        const metadata = AssetDatabase.getMetadata(asset.guid);
        if (metadata) {
          const runtimeAsset = RuntimeAssetManager.get().getOrCreate(asset.guid, metadata);
          newArray.push(runtimeAsset);
          changed = true;
          ImGui.CloseCurrentPopup();
          ImGui.EndGroup();
          ImGui.EndChild();
          ImGui.EndPopup();
          return newArray;
        }
      }

      ImGui.PushTextWrapPos(ImGui.GetCursorPosX() + buttonSize);
      ImGui.TextWrapped(asset.name);
      ImGui.PopTextWrapPos();

      ImGui.EndGroup();
    }

    if (filteredAssets.length === 0) {
      if (array.length > 0) {
        ImGui.Text('All available assets are already added.');
      } else if (assetTypes && assetTypes.length > 0) {
        ImGui.Text(`No ${assetTypes.join(', ')} assets found in AssetDatabase.`);
      } else {
        ImGui.Text('No assets found in AssetDatabase.');
      }
    }

    ImGui.EndChild();

    ImGui.Separator();
    if (ImGui.Button('Cancel', { x: 120, y: 0 })) {
      ImGui.CloseCurrentPopup();
    }

    ImGui.EndPopup();
  }

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

function renderRuntimeAssetPicker(
  label: string,
  value: RuntimeAsset<any> | null,
  uniqueId: string,
  componentData?: any,
  assetTypes?: string[],
): RuntimeAsset<any> | null | undefined {
  const popupId = `AssetPicker##${uniqueId}`;

  // Display current asset
  ImGui.Text(`${label}:`);
  ImGui.SameLine();

  if (value && value.path) {
    // Show asset name (last part of path)
    const assetName = value.path.split('/').pop() || value.path;
    ImGui.Text(assetName);
  } else {
    ImGui.Text('None');
  }

  ImGui.SameLine();

  // Button to open asset picker
  if (ImGui.Button(`Pick##${uniqueId}`)) {
    ImGui.OpenPopup(popupId);
  }

  // Clear button
  if (value) {
    ImGui.SameLine();
    if (ImGui.Button(`Clear##${uniqueId}`)) {
      return null; // Clear the asset
    }
  }

  // Asset picker popup
  ImGui.SetNextWindowSize({ x: 600, y: 400 }, ImGui.Cond.FirstUseEver);
  if (ImGui.BeginPopupModal(popupId, null, ImGui.WindowFlags.None)) {
    ImGui.Text('Select an asset:');
    ImGui.Separator();

    // Get all assets from AssetDatabase
    const allAssets = AssetDatabase.getAllAssets();
    const filteredAssets: Array<{ guid: string; path: string; name: string; type: string }> =
      [];

    for (const [guid, metadata] of allAssets) {
      // Filter by assetTypes if specified, otherwise show all assets
      if (!assetTypes || assetTypes.includes(metadata.type)) {
        const name = metadata.path.split('/').pop() || metadata.path;
        filteredAssets.push({ guid, path: metadata.path, name, type: metadata.type });
      }
    }

    // Render assets in a grid
    const itemsPerRow = 4;
    const buttonSize = 128;

    ImGui.BeginChild('AssetGrid', { x: 0, y: -40 }, ImGui.WindowFlags.None);

    for (let i = 0; i < filteredAssets.length; i++) {
      const asset = filteredAssets[i];
      if (!asset) continue;

      // Start new row if needed
      if (i > 0 && i % itemsPerRow !== 0) {
        ImGui.SameLine();
      }

      // Asset button (grid item)
      ImGui.BeginGroup();

      // Thumbnail placeholder (colored box)
      const isSelected = value?.guid === asset.guid;
      if (isSelected) {
        ImGui.PushStyleColorImVec4(ImGui.Col.Button, {
          x: 0.2,
          y: 0.5,
          z: 0.8,
          w: 1.0,
        });
      }

      if (
        ImGui.Button(`##asset_${asset.guid}`, { x: buttonSize, y: buttonSize })
      ) {
        // Get or create the RuntimeAsset
        const metadata = AssetDatabase.getMetadata(asset.guid);
        if (metadata) {
          const runtimeAsset = RuntimeAssetManager.get().getOrCreate(
            asset.guid,
            metadata,
          );

          // Update tile properties if componentData is provided (for Sprite2D)
          if (componentData) {
            updateSpritePropertiesForTexture(componentData, runtimeAsset);
          }

          ImGui.CloseCurrentPopup();
          ImGui.EndGroup();
          ImGui.EndChild();
          ImGui.EndPopup();
          return runtimeAsset; // Return the selected asset
        }
      }

      if (isSelected) {
        ImGui.PopStyleColor();
      }

      // Asset name below thumbnail
      ImGui.PushTextWrapPos(ImGui.GetCursorPosX() + buttonSize);
      ImGui.TextWrapped(asset.name);
      ImGui.PopTextWrapPos();

      ImGui.EndGroup();
    }

    if (filteredAssets.length === 0) {
      if (assetTypes && assetTypes.length > 0) {
        ImGui.Text(`No ${assetTypes.join(', ')} assets found in AssetDatabase.`);
      } else {
        ImGui.Text('No assets found in AssetDatabase.');
      }
      ImGui.Text('Add assets via ApplicationConfig.assets');
    }

    ImGui.EndChild();

    ImGui.Separator();
    if (ImGui.Button('Cancel', { x: 120, y: 0 })) {
      ImGui.CloseCurrentPopup();
    }

    ImGui.EndPopup();
  }

  return undefined; // No change
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
