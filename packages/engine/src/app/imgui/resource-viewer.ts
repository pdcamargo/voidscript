/**
 * ImGui Resource Viewer - Renders registered resources with edit UI
 *
 * Displays all registered resources in a panel, allowing users to:
 * - View all registered resources organized by path
 * - See which resources are active in the application
 * - Edit serializable properties of active resources
 * - Add/remove user-defined resources from the editor
 */

import type { Application } from '../application.js';
import type { ResourceType } from '@voidscript/core';
import type { PropertySerializerConfig } from '@voidscript/core';
import { globalResourceRegistry } from '@voidscript/core';
import { ImGui } from '@voidscript/imgui';
import { setEditorLayoutContext } from './editor-layout-context.js';
import { EditorLayout } from './editor-layout.js';

// Selected resource for detailed view
let selectedResource: ResourceType<any> | null = null;

// Current path for folder navigation
let currentPath = '';

/**
 * Set the currently selected resource
 */
export function setSelectedResource(resource: ResourceType<any> | null): void {
  selectedResource = resource;
}

/**
 * Get the currently selected resource
 */
export function getSelectedResource(): ResourceType<any> | null {
  return selectedResource;
}

/**
 * Render the Resources panel
 */
export function renderImGuiResourceViewer(app: Application): void {
  ImGui.SetNextWindowPos({ x: 720, y: 10 }, ImGui.Cond.FirstUseEver);
  ImGui.SetNextWindowSize({ x: 350, y: 450 }, ImGui.Cond.FirstUseEver);

  if (ImGui.Begin('Resources')) {
    // Set EditorLayout context
    setEditorLayoutContext({
      commands: app.getCommands(),
      scene: app.scene,
      renderer: app.getRenderer().getThreeRenderer(),
      idPrefix: 'resources',
    });

    // Get all registered resources
    const registeredResources = globalResourceRegistry.getAllWithMetadata();

    if (registeredResources.length === 0) {
      ImGui.TextDisabled('No registered resources');
      ImGui.Text('Use registerResource() to add resources');
    } else {
      // Render folder navigation and resource list
      renderResourceBrowser(app, registeredResources);
    }

    ImGui.Separator();

    // Selected resource details
    if (selectedResource) {
      renderResourceDetails(app, selectedResource);
    } else {
      ImGui.TextDisabled('Select a resource to view details');
    }

  }
  ImGui.End();
}

/**
 * Render the resource browser with folder navigation
 */
function renderResourceBrowser(
  app: Application,
  registeredResources: ResourceType<any>[],
): void {
  // Show current path
  if (currentPath) {
    if (ImGui.Button('< Back')) {
      // Go up one level
      const parts = currentPath.split('/');
      parts.pop();
      currentPath = parts.join('/');
    }
    ImGui.SameLine();
    ImGui.Text(`Path: ${currentPath}`);
  } else {
    ImGui.Text('All Resources');
  }

  ImGui.Separator();

  // Get folders at current path
  const folders = globalResourceRegistry.getFoldersAtPath(currentPath);

  // Render folders
  for (const folder of folders) {
    if (ImGui.Selectable(`[folder] ${folder}##folder_${folder}`, false)) {
      currentPath = currentPath ? `${currentPath}/${folder}` : folder;
    }
  }

  // Get resources at current path
  const resourcesAtPath = globalResourceRegistry.getResourcesAtPath(currentPath);

  // Render resources
  for (const resourceType of resourcesAtPath) {
    const displayName = resourceType.metadata?.displayName || resourceType.name;
    const hasInstance = app.hasResource(resourceType.ctor);
    const isBuiltIn = resourceType.metadata?.builtIn === true;

    // Show availability and type indicators
    let prefix = '';
    if (isBuiltIn) {
      prefix = '[built-in] ';
    } else if (!hasInstance) {
      prefix = '[inactive] ';
    }

    // Grey out inactive resources
    if (!hasInstance) {
      ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: 0.5, y: 0.5, z: 0.5, w: 1 });
    }

    const isSelected = selectedResource === resourceType;
    if (ImGui.Selectable(`${prefix}${displayName}##${resourceType.id}`, isSelected)) {
      selectedResource = resourceType;
    }

    if (!hasInstance) {
      ImGui.PopStyleColor();
    }

    // Tooltip with description
    if (ImGui.IsItemHovered() && resourceType.metadata?.description) {
      ImGui.SetTooltip(resourceType.metadata.description);
    }

    // Context menu
    if (ImGui.BeginPopupContextItem()) {
      if (!hasInstance && !isBuiltIn) {
        if (ImGui.MenuItem('Add Resource')) {
          // Create instance with default value
          try {
            const instance = resourceType.metadata?.defaultValue
              ? resourceType.metadata.defaultValue(app)
              : new resourceType.ctor();
            app.insertResource(instance);
          } catch (error) {
            console.error(
              `Failed to create resource "${resourceType.name}":`,
              error,
            );
          }
        }
      } else if (hasInstance && !isBuiltIn) {
        if (ImGui.MenuItem('Remove Resource')) {
          app.removeResource(resourceType.ctor);
          if (selectedResource === resourceType) {
            selectedResource = null;
          }
        }
      }
      ImGui.EndPopup();
    }
  }
}

/**
 * Render details/editor for selected resource
 */
function renderResourceDetails(
  app: Application,
  resourceType: ResourceType<any>,
): void {
  const displayName = resourceType.metadata?.displayName || resourceType.name;
  const isBuiltIn = resourceType.metadata?.builtIn === true;

  ImGui.Text(`Resource: ${displayName}`);
  if (isBuiltIn) {
    ImGui.SameLine();
    ImGui.TextDisabled('[built-in]');
  }

  const instance = app.getResource(resourceType.ctor);
  if (!instance) {
    ImGui.TextDisabled('Resource not active');
    if (!isBuiltIn) {
      if (ImGui.Button('Add Resource')) {
        try {
          const newInstance = resourceType.metadata?.defaultValue
            ? resourceType.metadata.defaultValue(app)
            : new resourceType.ctor();
          app.insertResource(newInstance);
        } catch (error) {
          console.error(
            `Failed to create resource "${resourceType.name}":`,
            error,
          );
        }
      }
    }
    return;
  }

  ImGui.Separator();

  // Check for custom editor
  if (resourceType.metadata?.customEditor) {
    try {
      resourceType.metadata.customEditor({
        resourceData: instance,
        resourceType,
        metadata: resourceType.metadata,
        commands: app.getCommands(),
      });
    } catch (error) {
      ImGui.TextColored({ x: 1, y: 0, z: 0, w: 1 }, 'Custom editor error');
      console.error(`Error in custom editor for ${resourceType.name}:`, error);
    }
    return;
  }

  // Auto-render properties from serializer config
  const serializerConfig = resourceType.serializerConfig;
  if (!serializerConfig || serializerConfig === (false as unknown)) {
    ImGui.TextDisabled('No editable properties');
    return;
  }

  // Collect labels for width calculation
  const labels: string[] = [];
  for (const [propKey, propConfig] of Object.entries(serializerConfig)) {
    const config = propConfig as PropertySerializerConfig;
    if (config.serializable) {
      labels.push(propKey);
    }
  }

  if (labels.length === 0) {
    ImGui.TextDisabled('No editable properties');
    return;
  }

  EditorLayout.beginLabelsWidth(labels);

  for (const [propKey, propConfig] of Object.entries(serializerConfig)) {
    const config = propConfig as PropertySerializerConfig;
    if (!config.serializable) continue;

    const propValue = (instance as any)[propKey];
    const uniqueId = `resource_${resourceType.id}_${propKey}`;

    // Check for property-level custom editor
    if (config.customEditor) {
      try {
        config.customEditor({
          label: propKey,
          value: propValue,
          onChange: (newValue) => {
            (instance as any)[propKey] = newValue;
          },
          config,
          commands: app.getCommands(),
          componentData: instance,
        });
      } catch (error) {
        ImGui.TextColored({ x: 1, y: 0, z: 0, w: 1 }, `${propKey}: error`);
        console.error(
          `Error in custom editor for ${resourceType.name}.${propKey}:`,
          error,
        );
      }
    } else {
      // Use EditorLayout for property rendering based on type
      renderResourceProperty(propKey, propValue, config, instance, uniqueId);
    }
  }

  EditorLayout.endLabelsWidth();
}

/**
 * Render a single resource property using EditorLayout
 */
function renderResourceProperty(
  label: string,
  value: any,
  config: PropertySerializerConfig,
  instance: any,
  uniqueId: string,
): void {
  // Handle based on instanceType or inferred type
  const instanceType = config.instanceType;

  // Handle enum type
  if (config.type === 'enum' && config.enum) {
    const options = Object.keys(config.enum);
    const currentValue = String(value);
    const [newValue, changed] = EditorLayout.comboField(label, currentValue, options, {
      id: uniqueId,
      tooltip: config.tooltip,
    });
    if (changed) {
      instance[label] = config.enum[newValue] ?? newValue;
    }
    return;
  }

  // Handle number type
  if (instanceType === Number || typeof value === 'number') {
    const [newValue, changed] = EditorLayout.numberField(label, value, {
      id: uniqueId,
      tooltip: config.tooltip,
    });
    if (changed) {
      instance[label] = newValue;
    }
    return;
  }

  // Handle boolean type
  if (instanceType === Boolean || typeof value === 'boolean') {
    const [newValue, changed] = EditorLayout.checkboxField(label, value, {
      id: uniqueId,
      tooltip: config.tooltip,
    });
    if (changed) {
      instance[label] = newValue;
    }
    return;
  }

  // Handle string type
  if (instanceType === String || typeof value === 'string') {
    const [newValue, changed] = EditorLayout.stringField(label, value, {
      id: uniqueId,
      tooltip: config.tooltip,
    });
    if (changed) {
      instance[label] = newValue;
    }
    return;
  }

  // Fallback: display as text
  ImGui.Text(`${label}:`);
  ImGui.SameLine();
  if (value === null || value === undefined) {
    ImGui.TextDisabled('(null)');
  } else if (typeof value === 'object') {
    ImGui.TextDisabled(`[${value.constructor?.name || 'Object'}]`);
  } else {
    ImGui.Text(String(value));
  }
}
