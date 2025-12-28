/**
 * Resource Type System
 *
 * Resources are singletons stored by constructor type, similar to Bevy's Resources.
 * Unlike components, resources are not attached to entities - they are global state.
 *
 * This module provides:
 * - ResourceType: Type identifier with metadata and serialization config
 * - ResourceRegistry: Global registry for discovering all registered resources
 * - registerResource: Function to opt a class into serialization and editor features
 *
 * @example
 * ```ts
 * // Define a resource class
 * class GameSettings {
 *   masterVolume = 1.0;
 *   difficulty: 'easy' | 'normal' | 'hard' = 'normal';
 * }
 *
 * // Register for serialization and editor support
 * registerResource(GameSettings, {
 *   masterVolume: { serializable: true, instanceType: Number },
 *   difficulty: { serializable: true, type: 'enum', enum: { easy: 'easy', normal: 'normal', hard: 'hard' } },
 * }, {
 *   path: 'gameplay',
 *   displayName: 'Game Settings',
 *   description: 'Global game settings',
 *   defaultValue: (app) => new GameSettings(),
 * });
 *
 * // Usage in systems remains unchanged:
 * const settings = commands.getResource(GameSettings);
 * settings.masterVolume = 0.5;
 * ```
 */

import type { Command } from './command.js';
import type {
  PropertySerializerConfig,
  SerializableKeys,
} from './serialization/types.js';

// Forward declaration to avoid circular dependency
// Application type is used in defaultValue factory
type Application = any;

/**
 * Resource editor options passed to custom editors
 */
export interface ResourceEditorOptions<T = any> {
  /** The resource data instance (mutable) */
  resourceData: T;
  /** The resource type definition */
  resourceType: ResourceType<T>;
  /** The resource metadata */
  metadata: ResourceMetadata<T>;
  /** ECS commands for queries, etc. */
  commands: Command;
}

/**
 * Resource metadata for editor UI and organization
 */
export interface ResourceMetadata<T = any> {
  /**
   * Hierarchical path for resource browser organization
   * @example "audio", "physics", "gameplay/settings"
   */
  path?: string;

  /**
   * Display name override for UI (defaults to class name)
   */
  displayName?: string;

  /**
   * Tooltip/help text for resource browser
   */
  description?: string;

  /**
   * Factory function to create default resource instance
   * Receives Application for resources that need app access during creation
   * Required for user-defined resources that can be added from the editor
   */
  defaultValue?: (app: Application) => T;

  /**
   * Mark as built-in resource
   * Built-in resources are always present and cannot be added/removed from editor
   * They are still editable if they have serializable properties
   * @default false
   */
  builtIn?: boolean;

  /**
   * Custom editor for entire resource (overrides property rendering)
   * Use this for complex UIs that need full control over layout
   */
  customEditor?: (options: ResourceEditorOptions<T>) => void;
}

/**
 * Resource serialization configuration mapping property keys to their configs
 * Reuses the same PropertySerializerConfig from components for consistency
 * Only non-function properties are allowed as keys
 */
export type ResourceSerializerConfig<T> = {
  [K in SerializableKeys<T>]?: PropertySerializerConfig<T[K]>;
};

/**
 * Resource type identifier with TypeScript type information
 *
 * Similar to ComponentType but for resources.
 * Stores the constructor function so we can map back from ResourceType to class.
 */
export class ResourceType<T = any> {
  /** Unique integer ID for this resource type */
  readonly id: number;

  /** Human-readable name (class name) */
  readonly name: string;

  /** The constructor function */
  readonly ctor: new (...args: any[]) => T;

  /** Serialization configuration for properties */
  readonly serializerConfig?: ResourceSerializerConfig<T> | false;

  /** Metadata for editor UI */
  readonly metadata?: ResourceMetadata<T>;

  constructor(
    id: number,
    name: string,
    ctor: new (...args: any[]) => T,
    serializerConfig?: ResourceSerializerConfig<T> | false,
    metadata?: ResourceMetadata<T>,
  ) {
    this.id = id;
    this.name = name;
    this.ctor = ctor;
    this.serializerConfig = serializerConfig;
    this.metadata = metadata;
  }

  toString(): string {
    return `ResourceType(${this.name}:${this.id})`;
  }
}

/**
 * Resource Registry - Maps constructor types to ResourceType metadata
 *
 * Similar to ComponentRegistry but for resources.
 * Provides lookup by id, name, or constructor.
 */
export class ResourceRegistry {
  private resources = new Map<number, ResourceType<any>>();
  private resourcesByName = new Map<string, ResourceType<any>>();
  private resourcesByCtor = new Map<
    new (...args: any[]) => any,
    ResourceType<any>
  >();

  /**
   * Register a resource type
   */
  register<T>(type: ResourceType<T>): void {
    if (this.resources.has(type.id)) {
      throw new Error(
        `Resource type ${type.name} (ID: ${type.id}) already registered`,
      );
    }
    this.resources.set(type.id, type);
    this.resourcesByName.set(type.name, type);
    this.resourcesByCtor.set(type.ctor, type);
  }

  /**
   * Get resource type by ID
   */
  get(id: number): ResourceType | undefined {
    return this.resources.get(id);
  }

  /**
   * Get resource type by name
   */
  getByName(name: string): ResourceType | undefined {
    return this.resourcesByName.get(name);
  }

  /**
   * Get resource type by constructor
   */
  getByCtor<T>(
    ctor: new (...args: any[]) => T,
  ): ResourceType<T> | undefined {
    return this.resourcesByCtor.get(ctor) as ResourceType<T> | undefined;
  }

  /**
   * Check if resource type is registered by ID
   */
  has(id: number): boolean {
    return this.resources.has(id);
  }

  /**
   * Check if resource type is registered by name
   */
  hasByName(name: string): boolean {
    return this.resourcesByName.has(name);
  }

  /**
   * Check if resource type is registered by constructor
   */
  hasByCtor(ctor: new (...args: any[]) => any): boolean {
    return this.resourcesByCtor.has(ctor);
  }

  /**
   * Get all registered resource types
   */
  getAll(): ResourceType[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get all resources that have metadata (for editor display)
   */
  getAllWithMetadata(): ResourceType[] {
    return this.getAll().filter(
      (resource) => resource.metadata !== undefined,
    );
  }

  /**
   * Get resources at a specific path (direct children only, not recursive)
   * @param path - The path to search (e.g., "audio" or "physics/2d")
   * @returns Array of resources at that path
   */
  getResourcesAtPath(path: string): ResourceType[] {
    const resources = this.getAllWithMetadata();
    const normalizedPath =
      path === '' ? '' : path.endsWith('/') ? path.slice(0, -1) : path;

    return resources.filter((resource) => {
      const resourcePath = resource.metadata?.path || '';

      // If we're at root, only show resources with no path or empty path
      if (normalizedPath === '') {
        return !resourcePath || resourcePath === '';
      }

      // Check if resource is at exactly this path
      return resourcePath === normalizedPath;
    });
  }

  /**
   * Get all unique folder paths at a specific level
   * @param path - The parent path to search
   * @returns Array of folder names that exist at this level
   */
  getFoldersAtPath(path: string): string[] {
    const resources = this.getAllWithMetadata();
    const normalizedPath =
      path === '' ? '' : path.endsWith('/') ? path.slice(0, -1) : path;
    const folders = new Set<string>();

    for (const resource of resources) {
      const resourcePath = resource.metadata?.path || '';

      if (normalizedPath === '') {
        // At root level, find all top-level folders
        const parts = resourcePath.split('/');
        if (parts.length >= 1 && parts[0]) {
          folders.add(parts[0]);
        }
      } else {
        // At a specific path, find subfolders
        if (resourcePath.startsWith(normalizedPath + '/')) {
          const remainder = resourcePath.slice(normalizedPath.length + 1);
          const parts = remainder.split('/');
          if (parts.length >= 1 && parts[0]) {
            folders.add(parts[0]);
          }
        }
      }
    }

    return Array.from(folders).sort();
  }

  /**
   * Clear all registered resources
   */
  clear(): void {
    this.resources.clear();
    this.resourcesByName.clear();
    this.resourcesByCtor.clear();
  }
}

/**
 * Global resource registry instance
 */
export const globalResourceRegistry = new ResourceRegistry();

/** Global resource ID counter */
let nextResourceId = 0;

/**
 * Register a resource class for serialization and editor support.
 *
 * The class itself remains the key for getResource/insertResource.
 * This function adds metadata for serialization and editor UI.
 *
 * If a resource with the same name already exists (hot-reload scenario),
 * updates the existing type's config and metadata.
 *
 * @param ctor - The resource class constructor
 * @param serializerConfig - Property serialization config, or false to mark as non-serializable
 * @param metadata - Editor metadata (path, displayName, description, etc.)
 * @returns The ResourceType for this class
 *
 * @example
 * ```ts
 * class GameSettings {
 *   masterVolume = 1.0;
 *   musicVolume = 0.8;
 * }
 *
 * registerResource(GameSettings, {
 *   masterVolume: { serializable: true, instanceType: Number },
 *   musicVolume: { serializable: true, instanceType: Number },
 * }, {
 *   path: 'audio',
 *   displayName: 'Game Settings',
 *   description: 'Global audio settings',
 *   defaultValue: (app) => new GameSettings(),
 * });
 * ```
 */
export function registerResource<T extends object>(
  ctor: new (...args: any[]) => T,
  serializerConfig?: ResourceSerializerConfig<T> | false,
  metadata?: ResourceMetadata<T>,
): ResourceType<T> {
  // Check if already registered by constructor
  const existing = globalResourceRegistry.getByCtor(ctor);
  if (existing) {
    // Hot-reload support: update config and metadata
    if (serializerConfig !== undefined) {
      // @ts-expect-error - We need to mutate readonly property for hot-reload support
      existing.serializerConfig = serializerConfig;
    }
    if (metadata !== undefined) {
      // @ts-expect-error - We need to mutate readonly property for hot-reload support
      existing.metadata = metadata;
    }
    return existing as ResourceType<T>;
  }

  // Create and register new resource type
  const type = new ResourceType<T>(
    nextResourceId++,
    ctor.name,
    ctor,
    serializerConfig,
    metadata,
  );
  globalResourceRegistry.register(type);
  return type;
}

/**
 * Optional interface for resources that need immediate app access
 *
 * Most resources use lazy initialization in their sync systems.
 * This interface is for resources that truly need app access at insertion time.
 *
 * @example
 * ```ts
 * class MyResource implements InitializableResource {
 *   private app: Application | null = null;
 *
 *   onInitialize(app: Application): void {
 *     this.app = app;
 *     // Perform setup that needs app access
 *   }
 * }
 * ```
 */
export interface InitializableResource {
  onInitialize(app: Application): void;
}

/**
 * Type guard to check if an object implements InitializableResource
 */
export function isInitializableResource(
  obj: unknown,
): obj is InitializableResource {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as any).onInitialize === 'function'
  );
}
