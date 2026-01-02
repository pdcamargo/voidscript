/**
 * Bundle System
 *
 * Bundles provide a way to define reusable entity templates with component configurations.
 * They support required, optional, and hidden properties with full TypeScript type safety.
 *
 * @example
 * ```ts
 * const Sprite2DBundle = bundle({
 *   transform: {
 *     component: Transform3D,
 *     properties: {
 *       position: requiredProperty<Vector3>(),
 *       rotation: optionalProperty<Vector3>({ default: () => new Vector3() }),
 *     }
 *   },
 *   sprite: {
 *     component: Sprite2D,
 *   }
 * });
 *
 * commands.spawn().withBundle(Sprite2DBundle, {
 *   transform: {
 *     position: new Vector3(10, 5, 0),  // Required
 *     rotation: new Vector3(0, Math.PI, 0)  // Optional override
 *   },
 *   sprite: {
 *     texture: myTexture  // Optional override
 *   }
 * }).build();
 * ```
 */

import type { ComponentType } from './component.js';
import { deepCopyComponentData } from './entity-utils.js';

// ============================================================================
// Property Configuration Types
// ============================================================================

/**
 * Configuration for a required property
 * Must be provided when spawning the bundle
 */
export interface RequiredPropertyConfig<T> {
  readonly type: 'required';
}

/**
 * Configuration for an optional property
 * Can be overridden when spawning, uses default if not provided
 */
export interface OptionalPropertyConfig<T> {
  readonly type: 'optional';
  readonly default?: T | (() => T);
}

/**
 * Configuration for a hidden property
 * Cannot be overridden when spawning, always uses the provided default
 */
export interface HiddenPropertyConfig<T> {
  readonly type: 'hidden';
  readonly default: T | (() => T);
}

/**
 * Union of all property configuration types
 */
export type PropertyConfig<T> =
  | RequiredPropertyConfig<T>
  | OptionalPropertyConfig<T>
  | HiddenPropertyConfig<T>;

// ============================================================================
// Property Helper Functions
// ============================================================================

/**
 * Mark a property as required
 * Must be provided when spawning the bundle
 *
 * @example
 * ```ts
 * properties: {
 *   position: requiredProperty<Vector3>()
 * }
 * ```
 */
export function requiredProperty<T>(): RequiredPropertyConfig<T> {
  return { type: 'required' };
}

/**
 * Mark a property as optional with an optional default value
 * Can be overridden when spawning, uses default or component default if not provided
 *
 * @example
 * ```ts
 * properties: {
 *   rotation: optionalProperty<Vector3>({ default: () => new Vector3() })
 * }
 * ```
 */
export function optionalProperty<T>(config?: {
  default?: T | (() => T);
}): OptionalPropertyConfig<T> {
  return {
    type: 'optional',
    default: config?.default,
  };
}

/**
 * Mark a property as hidden with a default value
 * Cannot be overridden when spawning, always uses the provided default
 *
 * @example
 * ```ts
 * properties: {
 *   pixelsPerUnit: hiddenProperty({ default: 100 })
 * }
 * ```
 */
export function hiddenProperty<T>(config: {
  default: T | (() => T);
}): HiddenPropertyConfig<T> {
  return {
    type: 'hidden',
    default: config.default,
  };
}

// ============================================================================
// Bundle Schema Types
// ============================================================================

/**
 * Component configuration within a bundle
 */
export interface ComponentConfig<T> {
  /** The component type */
  component: ComponentType<T>;
  /** Optional property configurations */
  properties?: {
    [K in keyof T]?: PropertyConfig<T[K]>;
  };
}

/**
 * Bundle schema definition
 * Maps component keys to component configurations
 */
export type BundleSchema = {
  [componentKey: string]: ComponentConfig<any>;
};

/**
 * Bundle type with schema and name
 */
export interface BundleType<S extends BundleSchema> {
  readonly schema: S;
  readonly name: string;
}

// ============================================================================
// Type Utilities for Spawn Data Inference
// ============================================================================

/**
 * Extract the component data type from a ComponentType<T>
 */
type InferComponentData<C> = C extends ComponentType<infer T> ? T : never;

/**
 * Extract required properties from a component config
 */
type ExtractRequiredProps<T, Props> = Props extends {
  [K in keyof T]?: PropertyConfig<T[K]>;
}
  ? {
      [K in keyof T as K extends keyof Props
        ? Props[K] extends RequiredPropertyConfig<any>
          ? K
          : never
        : never]: T[K];
    }
  : {};

/**
 * Extract optional properties from a component config
 */
type ExtractOptionalProps<T, Props> = Props extends {
  [K in keyof T]?: PropertyConfig<T[K]>;
}
  ? {
      [K in keyof T as K extends keyof Props
        ? Props[K] extends OptionalPropertyConfig<any>
          ? K
          : never
        : never]?: T[K];
    }
  : {};

/**
 * Build spawn data type for a single component config
 * Combines required and optional properties, omits hidden properties
 */
type ComponentSpawnData<C extends ComponentConfig<any>> =
  InferComponentData<C['component']> extends infer T
    ? C['properties'] extends undefined
      ? Partial<T> // No properties config = all properties optional
      : ExtractRequiredProps<T, C['properties']> &
          ExtractOptionalProps<T, C['properties']>
    : never;

/**
 * Check if a component has any required properties
 */
type HasRequiredProps<C extends ComponentConfig<any>> =
  InferComponentData<C['component']> extends infer T
    ? C['properties'] extends { [K in keyof T]?: PropertyConfig<T[K]> }
      ? keyof ExtractRequiredProps<T, C['properties']> extends never
        ? false
        : true
      : false
    : false;

/**
 * Check if a component spawn data type is empty (no required/optional properties)
 */
type IsEmptyObject<T> = keyof T extends never ? true : false;

/**
 * Build spawn data type for entire bundle
 * Components with required properties are required keys
 * Components with only optional properties are optional keys
 * Components with no configured properties are omitted
 */
export type BundleSpawnData<S extends BundleSchema> = {
  // Required component keys (have at least one required property)
  [K in keyof S as HasRequiredProps<S[K]> extends true ? K : never]: ComponentSpawnData<S[K]>;
} & {
  // Optional component keys (have optional properties but no required ones)
  [K in keyof S as HasRequiredProps<S[K]> extends false
    ? IsEmptyObject<ComponentSpawnData<S[K]>> extends false
      ? K
      : never
    : never]?: ComponentSpawnData<S[K]>;
};

// ============================================================================
// Bundle Factory Function
// ============================================================================

/**
 * Helper to create a typed component config with autocomplete for property names
 *
 * @param component - The component type
 * @param properties - Property configurations (autocompletes property names!)
 * @returns Component config
 *
 * @example
 * ```ts
 * componentConfig(Transform3D, {
 *   position: requiredProperty<Vector3>(),  // ✅ Autocompletes "position", "rotation", "scale"
 *   rotation: optionalProperty<Vector3>()
 * })
 * ```
 */
export function componentConfig<T, const P extends { [K in keyof T]?: PropertyConfig<T[K]> } = Record<string, never>>(
  component: ComponentType<T>,
  properties?: P
): ComponentConfig<T> & { properties: P } {
  return { component, properties: properties as P };
}

/**
 * Create a new bundle definition
 *
 * @param schema - Bundle schema defining components and their properties
 * @param name - Optional name for the bundle (used in registry and debugging)
 * @returns Bundle type that can be used with .withBundle()
 *
 * @example
 * ```ts
 * // Without autocomplete (old way)
 * const MyBundle = bundle({
 *   transform: {
 *     component: Transform3D,
 *     properties: {
 *       position: requiredProperty<Vector3>()  // No autocomplete for property names
 *     }
 *   }
 * }, 'MyBundle');
 *
 * // With autocomplete (recommended)
 * const MyBundle = bundle({
 *   transform: componentConfig(Transform3D, {
 *     position: requiredProperty<Vector3>()  // ✅ Autocompletes property names!
 *   })
 * }, 'MyBundle');
 * ```
 */
export function bundle<const S extends BundleSchema>(
  schema: S,
  name?: string,
): BundleType<S> {
  return {
    schema,
    name: name || 'UnnamedBundle',
  };
}

// ============================================================================
// Bundle Resolution Logic
// ============================================================================

/**
 * Resolve value from static value or factory function
 */
function resolveValue<T>(value: T | (() => T)): T {
  if (typeof value === 'function') {
    return (value as () => T)();
  }
  // Deep copy to avoid shared references
  return deepCopyComponentData(value);
}

/**
 * Get component default value
 */
function getComponentDefault<T>(componentType: ComponentType<T>): T {
  const metadata = componentType.metadata;
  if (!metadata?.defaultValue) {
    return {} as T;
  }

  const defaultValue = metadata.defaultValue;
  if (typeof defaultValue === 'function') {
    return (defaultValue as () => T)();
  }

  // Deep copy static default to avoid shared references
  return deepCopyComponentData(defaultValue);
}

/**
 * Resolve all property values for a component
 *
 * Precedence:
 * 1. Spawn override (provided in spawnData)
 * 2. Bundle property default (from optionalProperty/hiddenProperty)
 * 3. Component default (from component metadata.defaultValue)
 * 4. Empty object fallback
 *
 * @param componentConfig - Component configuration from bundle schema
 * @param spawnData - Optional spawn data overrides
 * @returns Resolved component data
 */
export function resolveComponentData<T>(
  componentConfig: ComponentConfig<T>,
  spawnData?: Partial<T>,
): T {
  const componentType = componentConfig.component;
  const properties = componentConfig.properties;

  // Start with component's default value
  const componentDefault = getComponentDefault(componentType);
  const result: any = { ...componentDefault };

  // If no properties config, just merge spawn overrides
  if (!properties) {
    return spawnData ? { ...result, ...spawnData } : result;
  }

  // Process each configured property
  for (const key in properties) {
    const propConfig = properties[key];

    if (!propConfig) continue;

    if (propConfig.type === 'hidden') {
      // Hidden: always use property default
      result[key] = resolveValue(propConfig.default);
    } else if (propConfig.type === 'required') {
      // Required: must come from spawnData
      if (spawnData && key in spawnData) {
        result[key] = spawnData[key];
      } else {
        throw new Error(
          `Bundle: Required property "${key}" not provided for component ${componentType.name}`,
        );
      }
    } else if (propConfig.type === 'optional') {
      // Optional: spawn override > property default > component default
      if (spawnData && key in spawnData) {
        result[key] = spawnData[key];
      } else if (propConfig.default !== undefined) {
        result[key] = resolveValue(propConfig.default);
      }
      // else: keep component default already in result
    }
  }

  // Apply any spawn overrides for unlisted properties
  if (spawnData) {
    for (const key in spawnData) {
      if (!properties || !(key in properties)) {
        result[key] = spawnData[key];
      }
    }
  }

  return result;
}

/**
 * Resolve all components in a bundle to a Map<componentId, componentData>
 *
 * @param bundleType - Bundle type definition
 * @param spawnData - Spawn data overrides
 * @returns Map of component IDs to resolved component data
 */
export function resolveBundleComponents<S extends BundleSchema>(
  bundleType: BundleType<S>,
  spawnData: BundleSpawnData<S>,
): Map<number, any> {
  const componentsMap = new Map<number, any>();

  // Process each component in the bundle
  for (const componentKey in bundleType.schema) {
    const componentConfig = bundleType.schema[componentKey];

    // TypeScript guard - schema iteration should always have valid entries
    if (!componentConfig) continue;

    const componentType = componentConfig.component;

    // Get spawn data for this component (if provided)
    const componentSpawnData = (spawnData as any)?.[componentKey];

    // Resolve final component data
    const resolvedData = resolveComponentData(
      componentConfig,
      componentSpawnData,
    );

    // Add to components map
    componentsMap.set(componentType.id, resolvedData);
  }

  return componentsMap;
}
