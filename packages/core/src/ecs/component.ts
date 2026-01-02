/**
 * Component Type System
 *
 * Components are plain objects/classes with unique type identifiers.
 * No base class required - any object can be a component.
 */

import type { ComponentSerializerConfig } from '../serialization/types.js';
import type { Command } from './command.js';
import type { Entity } from './entity.js';
/**
 * Component metadata for editor UI and organization
 */
export interface ComponentMetadata<T = any> {
  /** Hierarchical path for component browser (e.g., "rendering/3d" or "physics/collision") */
  path?: string;

  /** Default value when adding component in editor (static object or factory function) */
  defaultValue?: T | (() => T);

  /** Optional display name override for UI (defaults to component name) */
  displayName?: string;

  /** Tooltip/help text for component browser */
  description?: string;

  /**
   * Skip serialization of child entities when this component is present
   * If true, any entities with a Parent component pointing to this entity will be excluded
   * from serialization. This is useful for components that dynamically spawn children
   * and need to regenerate them on deserialization.
   * @default false
   */
  skipChildrenSerialization?: boolean;

  /**
   * Show debug helper in editor for this component
   * If true, helper will always be visible. If false/undefined, helper only shows when entity is selected.
   * @default false
   */
  showHelper?: boolean;

  customEditor?: (options: {
    entity: Entity;
    componentData: T;
    componentType: ComponentType<T>;
    metadata: ComponentMetadata<T>;
    commands: Command;
  }) => void;
}

/** Component type identifier with TypeScript type information */
export class ComponentType<T = any> {
  /** Unique integer ID for this component type */
  readonly id: number;

  /** Human-readable name for debugging */
  readonly name: string;

  /** Optional serialization configuration for component properties */
  readonly serializerConfig?: ComponentSerializerConfig<T> | false;

  /** Optional metadata for editor UI and organization */
  readonly metadata?: ComponentMetadata<T>;

  constructor(
    id: number,
    name: string,
    serializerConfig?: ComponentSerializerConfig<T> | false,
    metadata?: ComponentMetadata<T>,
  ) {
    this.id = id;
    this.name = name;
    this.serializerConfig = serializerConfig;
    this.metadata = metadata;
  }

  toString(): string {
    return `ComponentType(${this.name}:${this.id})`;
  }
}

/** Global component ID counter */
let nextComponentId = 0;

/**
 * Define a new component type
 *
 * @example
 * ```ts
 * interface PositionData { x: number; y: number; }
 * const Position = defineComponent<PositionData>('Position');
 *
 * // TypeScript infers Position is ComponentType<PositionData>
 * ```
 */
export function defineComponent<T>(
  name: string,
  serializerConfig?: ComponentSerializerConfig<T> | false,
  metadata?: ComponentMetadata<T>,
): ComponentType<T> {
  return new ComponentType<T>(
    nextComponentId++,
    name,
    serializerConfig,
    metadata,
  );
}

/**
 * Component Registry - Maps component type IDs to metadata
 */
export class ComponentRegistry {
  private components = new Map<number, ComponentType>();
  private componentsByName = new Map<string, ComponentType>();

  /**
   * Register a component type
   */
  register<T>(type: ComponentType<T>): void {
    if (this.components.has(type.id)) {
      throw new Error(
        `Component type ${type.name} (ID: ${type.id}) already registered`,
      );
    }
    this.components.set(type.id, type);
    this.componentsByName.set(type.name, type);
  }

  /**
   * Get component type by ID
   */
  get(id: number): ComponentType | undefined {
    return this.components.get(id);
  }

  /**
   * Get component type by name
   */
  getByName(name: string): ComponentType | undefined {
    return this.componentsByName.get(name);
  }

  /**
   * Check if component type is registered
   */
  has(id: number): boolean {
    return this.components.has(id);
  }

  /**
   * Check if component type is registered by name
   */
  hasByName(name: string): boolean {
    return this.componentsByName.has(name);
  }

  /**
   * Get all registered component types
   */
  getAll(): ComponentType[] {
    return Array.from(this.components.values());
  }

  /**
   * Get all components that have metadata
   */
  getAllComponentsWithMetadata(): ComponentType[] {
    return this.getAll().filter(
      (component) => component.metadata !== undefined,
    );
  }

  /**
   * Get components at a specific path (direct children only, not recursive)
   * Returns both components and folders at that path
   *
   * @param path - The path to search (e.g., "rendering" or "rendering/3d")
   * @returns Array of components at that path and folders that exist deeper
   */
  getComponentsAtPath(path: string): ComponentType[] {
    const components = this.getAllComponentsWithMetadata();
    const normalizedPath =
      path === '' ? '' : path.endsWith('/') ? path.slice(0, -1) : path;

    // Filter components that are direct children of this path
    return components.filter((component) => {
      const componentPath = component.metadata?.path || '';

      // If we're at root, only show components with no path or empty path
      if (normalizedPath === '') {
        return !componentPath || componentPath === '';
      }

      // Check if component is at exactly this path
      // e.g., if path is "physics", accept component with path "physics"
      // if path is "rendering/2d", accept component with path "rendering/2d"
      return componentPath === normalizedPath;
    });
  }

  /**
   * Get all unique folder paths at a specific level
   *
   * @param path - The parent path to search
   * @returns Array of folder names that exist at this level
   */
  getFoldersAtPath(path: string): string[] {
    const components = this.getAllComponentsWithMetadata();
    const normalizedPath =
      path === '' ? '' : path.endsWith('/') ? path.slice(0, -1) : path;
    const folders = new Set<string>();

    for (const component of components) {
      const componentPath = component.metadata?.path || '';

      if (normalizedPath === '') {
        // At root level, find all top-level folders
        // Every component path creates a folder for the first segment
        const parts = componentPath.split('/');
        if (parts.length >= 1 && parts[0]) {
          folders.add(parts[0]);
        }
      } else {
        // At a specific path, find subfolders
        if (componentPath.startsWith(normalizedPath + '/')) {
          const remainder = componentPath.slice(normalizedPath.length + 1);
          const parts = remainder.split('/');
          // If there's at least one more segment, the first segment is a direct child
          // e.g., at "rendering", if component is "rendering/2d", remainder is "2d" (1 part)
          // That means "2d" is a FOLDER at this level (not a component)
          if (parts.length >= 1 && parts[0]) {
            folders.add(parts[0]);
          }
        }
      }
    }

    return Array.from(folders).sort();
  }

  /**
   * Clear all registered components
   */
  clear(): void {
    this.components.clear();
    this.componentsByName.clear();
  }
}

/**
 * Global component registry instance
 */
export const globalComponentRegistry = new ComponentRegistry();

/**
 * Helper to auto-register component types when defined
 *
 * If a component with the same name already exists, returns the existing type.
 * This makes the function idempotent and safe to use in hot-reloading environments.
 *
 * @example
 * ```ts
 * interface SpriteData {
 *   texture: AssetRef | null;
 *   tint: number;
 * }
 *
 * const Sprite = component<SpriteData>("Sprite", {
 *   texture: {
 *     serializable: true,
 *     type: "assetRef",
 *     whenNullish: "keep"
 *   },
 *   tint: {
 *     serializable: true,
 *     instanceType: Number
 *   }
 * }, {
 *   path: "rendering/2d",
 *   defaultValue: { texture: null, tint: 0xFFFFFF }
 * });
 *
 * // Mark component as non-serializable (shorthand)
 * const PhysicsVelocity = component<VelocityData>("PhysicsVelocity", false);
 * ```
 */
export function component<T>(
  name: string,
  serializerConfig?: ComponentSerializerConfig<T> | false,
  metadata?: ComponentMetadata<T>,
): ComponentType<T> {
  // Check if component already exists by name
  const existing = globalComponentRegistry.getByName(name);
  if (existing) {
    // If a new config or metadata is provided, update the existing component
    // This handles hot-reloading scenarios where the config/metadata changes
    if (serializerConfig !== undefined) {
      // @ts-expect-error - We need to mutate readonly property for hot-reload support
      existing.serializerConfig = serializerConfig;
    }
    if (metadata !== undefined) {
      // @ts-expect-error - We need to mutate readonly property for hot-reload support
      existing.metadata = metadata;
    }
    return existing as ComponentType<T>;
  }

  // Create and register new component type
  const type = defineComponent<T>(name, serializerConfig, metadata);
  globalComponentRegistry.register(type);
  return type;
}
