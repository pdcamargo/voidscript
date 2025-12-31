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
import { ImGui } from '@voidscript/imgui';
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
import {
  hasSelectedKeyframe,
  renderKeyframeEditor,
} from './animation-editor/keyframe-editor.js';
import { setEditorLayoutContext } from './editor-layout-context.js';
import { EditorLayout } from './editor-layout.js';

// ============================================================================
// Label Formatting Utilities
// ============================================================================

/**
 * Convert camelCase or PascalCase to Title Case with spaces
 * e.g., "minInterval" → "Min Interval"
 *       "enableScreenFlash" → "Enable Screen Flash"
 *       "XMLParser" → "XML Parser"
 */
function toTitleCase(str: string): string {
  // Handle empty string
  if (!str) return '';

  // Insert space before uppercase letters that follow lowercase letters
  // Also handle sequences like "XMLParser" → "XML Parser"
  const spaced = str
    .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase → camel Case
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');  // XMLParser → XML Parser

  // Capitalize first letter of each word
  return spaced
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

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

/**
 * Render all default properties for a component.
 * This can be called from custom editors to render properties automatically
 * while still allowing custom UI to be added before or after.
 *
 * @param componentType - The component type
 * @param componentData - The mutable component data
 * @param commands - ECS commands for queries
 */
export function renderDefaultProperties<T>(
  componentType: ComponentType<T>,
  componentData: T,
  commands: ReturnType<Application['getCommands']>,
): void {
  const serializationConfig = componentType.serializerConfig || {};

  // Collect all title-cased labels for width calculation
  const titleCasedLabels: string[] = [];
  const serializableEntries: [string, PropertySerializerConfig][] = [];

  for (const [propKey, propConfig] of Object.entries(serializationConfig)) {
    const config = propConfig as PropertySerializerConfig;
    if (config.serializable) {
      const titleCasedLabel = toTitleCase(propKey);
      titleCasedLabels.push(titleCasedLabel);
      serializableEntries.push([propKey, config]);
    }
  }

  // Use EditorLayout's label width alignment
  EditorLayout.beginLabelsWidth(titleCasedLabels);

  // Render properties with consistent label width
  for (let i = 0; i < serializableEntries.length; i++) {
    const [propKey, config] = serializableEntries[i]!;
    const propValue = (componentData as any)[propKey];
    const titleCasedLabel = titleCasedLabels[i]!;

    // Check if property has custom editor
    if (config.customEditor) {
      try {
        config.customEditor({
          label: titleCasedLabel,
          value: propValue,
          onChange: (newValue) => {
            (componentData as any)[propKey] = newValue;
          },
          config,
          commands,
          componentData,
        });
      } catch (error) {
        ImGui.TextColored({ x: 1, y: 0, z: 0, w: 1 }, `${titleCasedLabel}: error`);
        console.error(
          `Error in custom editor for ${componentType.name}.${propKey}:`,
          error,
        );
      }
    } else {
      // Use default property rendering with EditorLayout
      const uniqueId = `${componentType.id}_${propKey}`;
      const newValue = renderProperty(
        titleCasedLabel,
        propValue,
        config,
        uniqueId,
        componentData,
      );

      // Update component if value changed
      if (newValue !== undefined && newValue !== propValue) {
        (componentData as any)[propKey] = newValue;
      }
    }
  }

  // End label width scope
  EditorLayout.endLabelsWidth();
}

export function renderImGuiInspector(app: Application, entity?: Entity): void {
  // Use parameter or module state
  const targetEntity = entity ?? selectedEntity;

  // Store renderer for nested functions (asset picker and sprite picker)
  currentRenderer = app.getRenderer().getThreeRenderer();
  setSpritePickerRenderer(currentRenderer);

  // Set EditorLayout context for this frame
  setEditorLayoutContext({
    commands: app.getCommands(),
    world: app.world,
    renderer: currentRenderer,
    idPrefix: 'inspector',
  });

  // Setup window
  ImGui.SetNextWindowPos({ x: 320, y: 10 }, ImGui.Cond.FirstUseEver);
  ImGui.SetNextWindowSize({ x: 400, y: 600 }, ImGui.Cond.FirstUseEver);

  if (ImGui.Begin('Inspector')) {
    // Check if a keyframe is selected in the animation editor - show keyframe editor instead
    if (hasSelectedKeyframe()) {
      renderKeyframeEditor(currentRenderer, app.world);
    } else {
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
          app.getCommands().entity(targetEntity).destroyRecursive();
          setSelectedEntity(undefined); // Clear selection
          console.log(`[Inspector] Deleted entity #${targetEntity}`);
        }
      }

      if (targetEntity === undefined) {
        ImGui.Text('No entity selected');
      } else {
        renderEntityInspector(app, targetEntity);
      }
    }
  }
  ImGui.End();
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
      commands.entity(entity).destroyRecursive();
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

      // Collect all title-cased labels for width calculation
      const titleCasedLabels: string[] = [];
      const serializableEntries: [string, PropertySerializerConfig][] = [];

      for (const [propKey, propConfig] of Object.entries(serializationConfig)) {
        const config = propConfig as PropertySerializerConfig;
        if (config.serializable) {
          const titleCasedLabel = toTitleCase(propKey);
          titleCasedLabels.push(titleCasedLabel);
          serializableEntries.push([propKey, config]);
        }
      }

      // Use EditorLayout's label width alignment
      EditorLayout.beginLabelsWidth(titleCasedLabels);

      // Render properties with consistent label width
      for (let i = 0; i < serializableEntries.length; i++) {
        const [propKey, config] = serializableEntries[i]!;
        const propValue = componentData[propKey];
        const titleCasedLabel = titleCasedLabels[i]!;

        // Check if property has custom editor
        if (config.customEditor) {
          try {
            config.customEditor({
              label: titleCasedLabel, // Use title-cased label for custom editors too
              value: propValue,
              onChange: (newValue) => {
                componentData[propKey] = newValue;
              },
              config,
              commands: app.getCommands(),
              componentData, // Pass entire component data for custom editors that need it
            });
          } catch (error) {
            ImGui.TextColored({ x: 1, y: 0, z: 0, w: 1 }, `${titleCasedLabel}: error`);
            console.error(
              `Error in custom editor for ${componentType.name}.${propKey}:`,
              error,
            );
          }
        } else {
          // Use default property rendering with EditorLayout
          // Create unique ID by combining component type ID and property key
          const uniqueId = `${componentType.id}_${propKey}`;
          const newValue = renderProperty(
            titleCasedLabel,  // Use title-cased label
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

      // End label width scope
      EditorLayout.endLabelsWidth();
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

  // Handle enum types - use EditorLayout.enumField
  if (config.type === 'enum' && config.enum) {
    const [newValue, changed] = EditorLayout.enumField(
      label,
      value,
      config.enum as Record<string, string | number>,
      { tooltip: config.tooltip, id: uniqueId },
    );
    return changed ? newValue : undefined;
  }

  // Handle null/undefined for other types
  if (value === null || value === undefined) {
    return renderNullProperty(label, value, config, uniqueId);
  }

  // 1. Vector3 (instanceType check) - use EditorLayout.vector3Field
  if (config.instanceType === Vector3 || value instanceof Vector3) {
    const [newValue, changed] = EditorLayout.vector3Field(label, value, {
      tooltip: config.tooltip,
      id: uniqueId,
    });
    return changed ? newValue : undefined;
  }

  // 2. Color objects (detect by properties or THREE.Color instance)
  if (isColorObject(value)) {
    const isThreeColor = value instanceof THREE.Color;
    const hasAlpha = value.a !== undefined;

    const [newValue, changed] = EditorLayout.colorField(label, value, {
      tooltip: config.tooltip,
      id: uniqueId,
      hasAlpha,
    });

    if (changed) {
      // Return same type as input - THREE.Color or plain object
      if (isThreeColor && !hasAlpha) {
        return new THREE.Color(newValue.r, newValue.g, newValue.b);
      }
      return newValue;
    }
    return undefined;
  }

  // 3. Nested objects (like { x, y }) - use EditorLayout.vector2Field for 2D vectors
  if (typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);

    // Check if it's a 2D vector-like object { x, y }
    if (keys.length === 2 && 'x' in value && 'y' in value &&
        typeof value.x === 'number' && typeof value.y === 'number') {
      const [newValue, changed] = EditorLayout.vector2Field(label, value, {
        tooltip: config.tooltip,
        id: uniqueId,
      });
      return changed ? newValue : undefined;
    }

    // For other objects, render nested fields
    EditorLayout.text(`${label}:`);
    EditorLayout.beginIndent();
    let changed = false;
    const newObj = { ...value };

    // Collect and title-case nested keys for alignment
    const nestedEntries = Object.entries(value).filter(([, val]) => typeof val === 'number');
    const nestedLabels = nestedEntries.map(([key]) => toTitleCase(key));

    // Use EditorLayout's label width for nested fields
    EditorLayout.beginLabelsWidth(nestedLabels);

    for (let i = 0; i < nestedEntries.length; i++) {
      const [key, val] = nestedEntries[i]!;
      const nestedLabel = nestedLabels[i]!;

      if (typeof val === 'number') {
        const [newVal, fieldChanged] = EditorLayout.numberField(nestedLabel, val, {
          id: `${uniqueId}_${key}`,
        });
        if (fieldChanged) {
          newObj[key] = newVal;
          changed = true;
        }
      }
    }

    EditorLayout.endLabelsWidth();
    EditorLayout.endIndent();
    return changed ? newObj : undefined;
  }

  // 4. Primitives - use EditorLayout field methods
  if (typeof value === 'number') {
    const [newValue, changed] = EditorLayout.numberField(label, value, {
      tooltip: config.tooltip,
      id: uniqueId,
    });
    return changed ? newValue : undefined;
  }

  if (typeof value === 'boolean') {
    const [newValue, changed] = EditorLayout.checkboxField(label, value, {
      tooltip: config.tooltip,
      id: uniqueId,
    });
    return changed ? newValue : undefined;
  }

  if (typeof value === 'string') {
    const [newValue, changed] = EditorLayout.stringField(label, value, {
      tooltip: config.tooltip,
      id: uniqueId,
    });
    return changed ? newValue : undefined;
  }

  // 5. Entity reference - use EditorLayout.entityField
  if (config.type === 'entity') {
    const [newValue, changed] = EditorLayout.entityField(label, value, {
      tooltip: config.tooltip,
      id: uniqueId,
    });
    return changed ? newValue : undefined;
  }

  // 6. Collections (arrays/sets) - display info only
  if (config.collectionType === 'array' && Array.isArray(value)) {
    EditorLayout.text(`${label}: [${value.length} items]`);
  } else if (config.collectionType === 'set' && value instanceof Set) {
    EditorLayout.text(`${label}: {${value.size} items}`);
  }

  return undefined; // No change
}

function renderNullProperty(
  label: string,
  _value: any,
  config: PropertySerializerConfig,
  uniqueId: string,
): any {
  // Use EditorLayout's text method for the label, then show null value
  EditorLayout.text(`${label}:`);
  EditorLayout.sameLine();

  // Special handling for Vector3
  if (config.instanceType === Vector3) {
    EditorLayout.textDisabled('null');
    EditorLayout.sameLine();
    if (EditorLayout.smallButton(`Create##${uniqueId}`)) {
      return new Vector3(0, 0, 0);
    }
  } else {
    EditorLayout.textDisabled('null');
  }

  return undefined;
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

  EditorLayout.text(`${label}: [${array.length} items]`);

  // Add button
  EditorLayout.sameLine();
  if (EditorLayout.smallButton(`+##${uniqueId}`)) {
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
  EditorLayout.beginIndent();
  for (let i = 0; i < array.length; i++) {
    const item = array[i];
    if (!item) continue;

    const assetName = item.path?.split('/').pop() || item.guid || 'Unknown';

    EditorLayout.text(`[${i}] ${assetName}`);
    EditorLayout.sameLine();

    // Remove button
    if (EditorLayout.smallButton(`X##remove_${uniqueId}_${i}`)) {
      newArray.splice(i, 1);
      changed = true;
    }
  }
  EditorLayout.endIndent();

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
  EditorLayout.text(`${label}:`);
  EditorLayout.sameLine();

  if (value && value.path) {
    // Show asset name (last part of path)
    const assetName = value.path.split('/').pop() || value.path;
    EditorLayout.text(assetName);
  } else {
    EditorLayout.textDisabled('(None)');
  }

  EditorLayout.sameLine();

  // Button to open asset picker
  if (EditorLayout.button(`Pick##${uniqueId}`)) {
    openAssetPicker(popupId);
    // Store componentData for when selection is made
    pendingAssetSelections.set(popupId, { result: undefined, componentData });
  }

  // Clear button
  if (value) {
    EditorLayout.sameLine();
    if (EditorLayout.button(`Clear##${uniqueId}`)) {
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
