/**
 * Entity Utilities - Helper functions for entity manipulation
 *
 * Provides utility functions for duplicating, copying, and manipulating entities.
 */

import type { World } from './world.js';
import type { Command } from './command.js';
import type { Entity } from './entity.js';
import type { ComponentType } from './component.js';
import { Parent, Children, Name } from './components/index.js';
import { RuntimeAsset } from './runtime-asset.js';

export interface DuplicateEntityOptions {
  /** Whether to recursively duplicate children (default: false) */
  duplicateChildren?: boolean;
  /** Name suffix for duplicate (default: " (Copy)") */
  nameSuffix?: string;
}

/**
 * Duplicate an entity with all its components
 *
 * Creates a new entity that is a copy of the source entity:
 * - Copies all components except Children
 * - Copies Parent component to make duplicate a sibling
 * - Appends suffix to Name component if present
 * - Returns the new entity ID
 *
 * @param entity - Entity to duplicate
 * @param world - World instance
 * @param commands - Command instance
 * @param options - Optional configuration
 * @returns New entity ID, or undefined if duplication failed
 *
 * @example
 * ```typescript
 * const duplicate = duplicateEntity(entity, world, commands);
 * if (duplicate !== undefined) {
 *   console.log(`Duplicated entity #${entity} → #${duplicate}`);
 * }
 * ```
 */
export function duplicateEntity(
  entity: Entity,
  world: World,
  commands: Command,
  options: DuplicateEntityOptions = {},
): Entity | undefined {
  const { duplicateChildren = false, nameSuffix = ' (Copy)' } = options;

  // Get all components from source entity
  const componentsMap = world.getAllComponents(entity);
  if (!componentsMap) {
    console.warn(`[entity-utils] Cannot duplicate entity ${entity} - not found`);
    return undefined;
  }

  // Build new entity with copied components
  const builder = commands.spawn();

  for (const [componentType, componentData] of componentsMap) {
    // Skip Children component (don't recursively duplicate children for now)
    if (componentType === Children) {
      continue;
    }

    // Skip non-serializable components (runtime-only components like RenderObject)
    // These are automatically created/managed by systems
    if (componentType.serializerConfig === false) {
      continue;
    }

    // Deep copy component data
    let copiedData: any;

    try {
      // Deep copy using custom logic that preserves RuntimeAsset references
      copiedData = deepCopyComponentData(componentData);

      // Special handling for Name component
      if (componentType === Name && copiedData.name) {
        copiedData.name = copiedData.name + nameSuffix;
      }

      // Add component to builder
      builder.with(componentType as ComponentType<any>, copiedData);
    } catch (error) {
      console.warn(
        `[entity-utils] Failed to copy component ${componentType.name}:`,
        error,
      );
      // Continue with other components even if one fails
      continue;
    }
  }

  // Build the new entity
  const newEntity = builder.build();
  const newEntityId = newEntity.id();

  // Fix parent-child relationship: if duplicate has a Parent component,
  // register it in the parent's Children set so the hierarchy is consistent
  const parentComp = world.getComponent(newEntityId, Parent);
  if (parentComp && world.isAlive(parentComp.id)) {
    const parentChildren = world.getComponent(parentComp.id, Children);
    if (parentChildren) {
      parentChildren.ids.add(newEntityId);
    } else {
      world.addComponent(parentComp.id, Children, {
        ids: new Set([newEntityId]),
      });
    }
  }

  // TODO: Implement recursive child duplication if requested
  if (duplicateChildren) {
    console.warn(
      '[entity-utils] Recursive child duplication not yet implemented',
    );
  }

  return newEntityId;
}

/**
 * Deep copy component data while preserving RuntimeAsset references
 *
 * RuntimeAsset instances should be preserved (same singleton reference)
 * rather than cloned, since they are managed by RuntimeAssetManager.
 *
 * @param data - Component data to copy
 * @returns Deep copy of the data with RuntimeAsset references preserved
 */
export function deepCopyComponentData(data: any): any {
  // Handle null/undefined
  if (data === null || data === undefined) {
    return data;
  }

  // Preserve RuntimeAsset references (don't clone, return same instance)
  if (data instanceof RuntimeAsset) {
    return data;
  }

  // Handle Arrays
  if (Array.isArray(data)) {
    return data.map((item) => deepCopyComponentData(item));
  }

  // Handle Sets
  if (data instanceof Set) {
    const newSet = new Set();
    for (const item of data) {
      newSet.add(deepCopyComponentData(item));
    }
    return newSet;
  }

  // Handle Maps
  if (data instanceof Map) {
    const newMap = new Map();
    for (const [key, value] of data) {
      newMap.set(key, deepCopyComponentData(value));
    }
    return newMap;
  }

  // Handle plain objects
  if (typeof data === 'object') {
    const copy: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        copy[key] = deepCopyComponentData(data[key]);
      }
    }
    return copy;
  }

  // Primitives (string, number, boolean) - return as-is
  return data;
}
