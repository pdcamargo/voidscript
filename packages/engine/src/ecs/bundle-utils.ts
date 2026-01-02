/**
 * Bundle Utilities
 *
 * Helper functions for spawning bundles in the editor with sensible defaults.
 */

import type { BundleSchema, BundleType } from './bundle.js';
import type { Scene } from './scene.js';
import type { Command } from './command.js';
import type { EntityHandle } from './command.js';
import { Vector3 } from '../math/index.js';

/**
 * Generate a default value for a required property based on heuristics
 *
 * Uses property name and component defaultValue to infer sensible defaults:
 * - position/rotation: Vector3.ZERO
 * - scale: Vector3(1, 1, 1)
 * - strings: ""
 * - numbers: 0
 * - booleans: false
 * - objects: null
 */
function generateDefaultValue(
  componentType: any,
  propKey: string,
): any {
  // Try to infer from component's defaultValue
  const metadata = componentType.metadata;
  if (metadata?.defaultValue) {
    const defaultValue =
      typeof metadata.defaultValue === 'function'
        ? metadata.defaultValue()
        : metadata.defaultValue;

    if (propKey in defaultValue) {
      // Deep copy to avoid shared references
      const value = defaultValue[propKey];
      if (value && typeof value === 'object') {
        // Check if it's a Vector3-like object
        if ('x' in value && 'y' in value && 'z' in value) {
          return new Vector3(value.x, value.y, value.z);
        }
        // Generic object - shallow copy
        return { ...value };
      }
      return value;
    }
  }

  // Fallback: Generate zero values for common types based on property name
  if (propKey === 'position' || propKey === 'rotation') {
    return new Vector3(0, 0, 0);
  }
  if (propKey === 'scale') {
    return new Vector3(1, 1, 1);
  }
  if (propKey === 'color') {
    return { r: 1, g: 1, b: 1, a: 1 };
  }
  if (propKey === 'texture' || propKey === 'material') {
    return null;
  }
  if (propKey.includes('name') || propKey.includes('Name')) {
    return '';
  }

  // Generic fallback based on type hints from property name
  if (propKey.includes('count') || propKey.includes('size') || propKey.includes('width') || propKey.includes('height')) {
    return 1;
  }

  // Default to null for unknown types
  return null;
}

/**
 * Spawn a bundle with sensible defaults for required properties
 *
 * For each component in the bundle:
 * - Generates default values for required properties
 * - Uses component defaults or heuristic defaults based on property names
 *
 * This allows bundles to be spawned from the editor even if they have required properties.
 *
 * @param bundleType - Bundle type to spawn
 * @param world - World instance
 * @param commands - Command instance
 * @returns Entity handle for the spawned entity
 */
export function spawnBundleWithDefaults(
  bundleType: BundleType<any>,
  world: Scene,
  commands: Command,
): EntityHandle {
  const spawnData: any = {};

  // For each component in bundle
  for (const componentKey in bundleType.schema) {
    const componentConfig = bundleType.schema[componentKey];
    const properties = componentConfig.properties;

    if (!properties) continue;

    const componentSpawnData: any = {};
    let hasRequiredProps = false;

    // Generate defaults for required properties
    for (const propKey in properties) {
      const propConfig = properties[propKey];

      if (propConfig.type === 'required') {
        hasRequiredProps = true;
        // Generate sensible default based on property name and component metadata
        componentSpawnData[propKey] = generateDefaultValue(
          componentConfig.component,
          propKey,
        );
      }
    }

    // Only add component spawn data if it has required props
    if (hasRequiredProps) {
      spawnData[componentKey] = componentSpawnData;
    }
  }

  // Spawn entity with bundle
  return commands.spawn().withBundle(bundleType, spawnData).build();
}
