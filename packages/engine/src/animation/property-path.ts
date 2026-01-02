/**
 * Property Path System
 *
 * Provides utilities for parsing and resolving property paths in the format:
 * `ComponentName.property.nested` (e.g., `Transform3D.position.x`)
 *
 * This enables the animation system to animate any serializable component property.
 */

import { globalComponentRegistry, type ComponentType } from '@voidscript/core';
import type { PropertySerializerConfig } from '@voidscript/core';

// ============================================================================
// Types
// ============================================================================

/**
 * A resolved property path containing component and property information
 */
export interface ResolvedPropertyPath {
  /** Component name (e.g., "Transform3D") */
  componentName: string;
  /** Property path within the component (e.g., "position" or "position.x") */
  propertyPath: string;
  /** Full path including component (e.g., "Transform3D.position.x") */
  fullPath: string;
}

// ============================================================================
// Property Path Parsing
// ============================================================================

/**
 * Parse a full property path into component and property parts.
 *
 * @param fullPath - Full property path like "Transform3D.position.x"
 * @returns Resolved path object with componentName, propertyPath, and fullPath
 *
 * @example
 * ```typescript
 * const parsed = parsePropertyPath("Transform3D.position.x");
 * // { componentName: "Transform3D", propertyPath: "position.x", fullPath: "Transform3D.position.x" }
 *
 * const parsed2 = parsePropertyPath("Sprite2D.color");
 * // { componentName: "Sprite2D", propertyPath: "color", fullPath: "Sprite2D.color" }
 * ```
 */
export function parsePropertyPath(fullPath: string): ResolvedPropertyPath {
  const dotIndex = fullPath.indexOf('.');
  if (dotIndex === -1) {
    // No dot found - treat entire path as component name with empty property
    return {
      componentName: fullPath,
      propertyPath: '',
      fullPath,
    };
  }

  const componentName = fullPath.substring(0, dotIndex);
  const propertyPath = fullPath.substring(dotIndex + 1);

  return {
    componentName,
    propertyPath,
    fullPath,
  };
}

/**
 * Build a full property path from component name and property path.
 *
 * @param componentName - Component name (e.g., "Transform3D")
 * @param propertyPath - Property path within component (e.g., "position.x")
 * @returns Full property path (e.g., "Transform3D.position.x")
 */
export function buildPropertyPath(componentName: string, propertyPath: string): string {
  if (!propertyPath) {
    return componentName;
  }
  return `${componentName}.${propertyPath}`;
}

// ============================================================================
// Component Resolution
// ============================================================================

/**
 * Resolve a component type from its name using the global component registry.
 *
 * @param componentName - Component name to resolve
 * @returns ComponentType if found, null otherwise
 *
 * @example
 * ```typescript
 * const transform = resolveComponentType("Transform3D");
 * if (transform) {
 *   commands.query().all(transform).each(...);
 * }
 * ```
 */
export function resolveComponentType(componentName: string): ComponentType<any> | null {
  const componentType = globalComponentRegistry.getByName(componentName);
  return componentType ?? null;
}

// ============================================================================
// Property Config Resolution
// ============================================================================

/**
 * Get the root property name from a potentially nested path.
 *
 * @param propertyPath - Property path like "position.x" or "color.r"
 * @returns Root property name (e.g., "position" or "color")
 */
export function getRootPropertyName(propertyPath: string): string {
  const dotIndex = propertyPath.indexOf('.');
  if (dotIndex === -1) {
    return propertyPath;
  }
  return propertyPath.substring(0, dotIndex);
}

/**
 * Get the PropertySerializerConfig for a property within a component type.
 *
 * @param componentType - Component type to check
 * @param propertyPath - Property path within component (e.g., "position" or "position.x")
 * @returns PropertySerializerConfig if found, null otherwise
 *
 * @example
 * ```typescript
 * const config = getPropertyConfig(Transform3D, "position");
 * if (config) {
 *   console.log(config.instanceType); // Vector3
 * }
 * ```
 */
export function getPropertyConfig(
  componentType: ComponentType<any>,
  propertyPath: string,
): PropertySerializerConfig | null {
  if (!componentType.serializerConfig) {
    return null;
  }

  // Get the root property name (for nested paths like "position.x")
  const rootProperty = getRootPropertyName(propertyPath);

  const config = componentType.serializerConfig[rootProperty as keyof typeof componentType.serializerConfig];
  return config ?? null;
}

// ============================================================================
// Property Value Access
// ============================================================================

/**
 * Get a nested property value from an object using a dot-separated path.
 *
 * @param obj - Object to read from
 * @param path - Dot-separated property path (e.g., "position.x")
 * @returns Property value, or undefined if path doesn't exist
 *
 * @example
 * ```typescript
 * const transform = { position: { x: 10, y: 20, z: 0 } };
 * getNestedProperty(transform, "position.x"); // 10
 * getNestedProperty(transform, "position");   // { x: 10, y: 20, z: 0 }
 * ```
 */
export function getNestedProperty(obj: any, path: string): unknown {
  if (!path) {
    return obj;
  }

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Set a nested property value on an object using a dot-separated path.
 * Creates intermediate objects if they don't exist.
 *
 * @param obj - Object to modify
 * @param path - Dot-separated property path (e.g., "position.x")
 * @param value - Value to set
 *
 * @example
 * ```typescript
 * const transform = { position: { x: 0, y: 0, z: 0 } };
 * setNestedProperty(transform, "position.x", 10);
 * // transform.position.x === 10
 * ```
 */
export function setNestedProperty(obj: any, path: string, value: unknown): void {
  if (!path) {
    // Can't set on empty path
    return;
  }

  const parts = path.split('.');
  let current = obj;

  // Navigate to the parent of the target property
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (current[part] === null || current[part] === undefined) {
      // Create intermediate object if needed
      current[part] = {};
    }
    current = current[part];
  }

  // Set the final property
  const lastPart = parts[parts.length - 1]!;
  current[lastPart] = value;
}

/**
 * Check if a property path exists on an object.
 *
 * @param obj - Object to check
 * @param path - Dot-separated property path
 * @returns True if the path exists (even if value is null/undefined)
 */
export function hasNestedProperty(obj: any, path: string): boolean {
  if (!path) {
    return true;
  }

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined || !(part in current)) {
      return false;
    }
    current = current[part];
  }

  return true;
}

// ============================================================================
// Property Path Utilities
// ============================================================================

/**
 * Get the parent path of a property path.
 *
 * @param path - Property path
 * @returns Parent path, or empty string if at root
 *
 * @example
 * ```typescript
 * getParentPath("position.x"); // "position"
 * getParentPath("position");   // ""
 * ```
 */
export function getParentPath(path: string): string {
  const lastDot = path.lastIndexOf('.');
  if (lastDot === -1) {
    return '';
  }
  return path.substring(0, lastDot);
}

/**
 * Get the leaf property name from a path.
 *
 * @param path - Property path
 * @returns Leaf property name
 *
 * @example
 * ```typescript
 * getLeafPropertyName("position.x"); // "x"
 * getLeafPropertyName("position");   // "position"
 * ```
 */
export function getLeafPropertyName(path: string): string {
  const lastDot = path.lastIndexOf('.');
  if (lastDot === -1) {
    return path;
  }
  return path.substring(lastDot + 1);
}

/**
 * Check if a property path is a nested sub-property of another.
 *
 * @param parentPath - Potential parent path (e.g., "position")
 * @param childPath - Potential child path (e.g., "position.x")
 * @returns True if childPath is a nested property of parentPath
 */
export function isSubPropertyOf(parentPath: string, childPath: string): boolean {
  if (parentPath === childPath) {
    return false;
  }
  return childPath.startsWith(parentPath + '.');
}
