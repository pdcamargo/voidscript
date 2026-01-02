/**
 * TypeScript types for ECS world serialization system
 */

import type { Entity } from '../ecs/entity.js';
import type { ComponentMetadata, ComponentType } from '../ecs/component.js';
import { Command } from '../ecs/command.js';

/**
 * Custom serializer interface for component types
 * Allows plugins to handle serialization of complex types (Sets, Maps, Resources, etc.)
 */
export interface ComponentSerializer<T = any> {
  /** Component type this serializer handles */
  componentType: ComponentType<T>;

  /**
   * Serialize component data to JSON-compatible format
   * @param data Component data to serialize
   * @param context Serialization context (entity mapping, etc.)
   */
  serialize(data: T, context: SerializationContext): unknown;

  /**
   * Deserialize from JSON back to component data
   * @param data Serialized data
   * @param context Deserialization context (entity mapping, etc.)
   */
  deserialize(data: unknown, context: DeserializationContext): T;

  /**
   * Optional: validate serialized data before deserialization
   * @param data Data to validate
   */
  validate?(data: unknown): boolean;
}

/**
 * Serialization context passed to custom serializers
 */
export interface SerializationContext {
  /** Map from entity to serialized ID (for entity references) */
  entityMapping: Map<Entity, number>;
}

/**
 * Deserialization context passed to custom serializers
 */
export interface DeserializationContext {
  /** Map from serialized ID to new entity (for entity references) */
  entityMapping: Map<number, Entity>;

  /**
   * Optional resolver for asset metadata during deserialization
   * Used to convert GUID → RuntimeAsset with full metadata
   * If not provided, RuntimeAsset will be created with minimal metadata
   */
  assetMetadataResolver?: (guid: string) => any | null;
}

/**
 * Deserialization mode
 */
export type DeserializeMode = 'merge' | 'replace';

/**
 * Deserialization options
 */
export interface DeserializeOptions {
  /** Deserialization mode: merge adds entities, replace clears first */
  mode?: DeserializeMode;

  /** If true, skip entities with missing components instead of failing */
  skipMissingComponents?: boolean;

  /** If true, continue on errors instead of failing */
  continueOnError?: boolean;

  /**
   * Optional resolver for asset metadata during deserialization
   * Used to convert GUID → RuntimeAsset with full metadata
   * If not provided, RuntimeAsset will be created with minimal metadata
   */
  assetMetadataResolver?: (guid: string) => any | null;
}

/**
 * Result of deserialization operation
 */
export interface DeserializeResult {
  /** Whether deserialization succeeded */
  success: boolean;

  /** Number of entities created */
  entitiesCreated: number;

  /** Number of entities skipped (due to errors) */
  entitiesSkipped: number;

  /** Warning messages */
  warnings: string[];

  /** Error message if failed */
  error?: string;

  /** Mapping from old entity IDs to new entities */
  entityMapping: Map<number, Entity>;
}

/**
 * Serialization statistics
 */
export interface SerializationStats {
  /** Number of entities serialized */
  entityCount: number;

  /** Number of components serialized */
  componentCount: number;

  /** Number of unique component types */
  componentTypeCount: number;

  /** Serialized data size in bytes (approx) */
  sizeBytes: number;

  /** Time taken to serialize in milliseconds */
  serializeTime?: number;

  /** Time taken to deserialize in milliseconds */
  deserializeTime?: number;
}

/**
 * Preset serialization types for common patterns
 */
export type PresetSerializationType =
  | 'assetRef' // Legacy: plain { guid } objects (deprecated)
  | 'runtimeAsset' // RuntimeAsset instances (recommended)
  | 'entity' // Entity ID references (requires entity mapping during deserialization)
  | 'default'
  | 'set'
  | 'enum'; // Enum types (renders dropdown in editor)

/**
 * How to handle nullish (null or undefined) values during serialization
 */
export type NullishBehavior = 'throw' | 'keep' | 'skip';

/**
 * Collection type configuration
 */
export type CollectionType = 'array' | 'set';

/**
 * Custom serializer functions for property-level serialization
 */
export interface CustomPropertySerializer<T = any> {
  /** Serialize property value to JSON-compatible format */
  serialize: (value: T, context: SerializationContext) => unknown;

  /** Deserialize from JSON back to property value */
  deserialize: (value: unknown, context: DeserializationContext) => T;
}

/**
 * Property-level serialization configuration
 */
export interface PropertySerializerConfig<T = any> {
  /**
   * Whether this property should be serialized (default: false)
   * Only properties explicitly marked as serializable will be included
   */
  serializable: boolean;

  /**
   * How to handle null or undefined values (default: 'skip')
   * - 'throw': Throw error if value is nullish
   * - 'keep': Serialize as null/undefined
   * - 'skip': Skip property entirely if nullish
   */
  whenNullish?: NullishBehavior;

  /**
   * Type hint for editor UI when value is null/undefined
   * Helps the inspector render the correct input widget
   */
  instanceType?: new (...args: any[]) => any;

  /**
   * Whether the property can be set to null by the user in the inspector
   * When true, the inspector will show a null checkbox for this property
   * (default: false)
   */
  isNullable?: boolean;

  /**
   * Serialize property under a different name
   * If undefined, uses the original property name
   */
  serializeAs?: string;

  /**
   * Collection type configuration for arrays and sets
   */
  collectionType?: CollectionType;

  /**
   * Type hint for collection elements
   * Helps the inspector render correct input widgets for array/set items
   */
  collectionInstanceType?: new (...args: any[]) => any;

  /**
   * Preset serialization type (e.g., "assetRef" for asset references)
   */
  type?: PresetSerializationType;

  /**
   * Filter asset types for RuntimeAsset properties
   * When specified, the asset picker will only show these asset types
   * If undefined, shows all asset types
   */
  assetTypes?: string[]; // AssetType enum values

  /**
   * Enum object for 'enum' type
   * The editor will render a dropdown with all enum values
   */
  enum?: Record<string, string | number>;

  /**
   * Custom serializer functions for complex serialization logic
   * The system trusts these functions to correctly serialize/deserialize
   */
  customSerializer?: CustomPropertySerializer<T>;

  /**
   * Tooltip text shown when hovering over the property label in the inspector
   * Provides additional context or explanation for the property
   * @example "Controls the animation playback speed multiplier (1.0 = normal speed)"
   */
  tooltip?: string;

  customEditor?: (options: {
    label: string;
    value: T;
    onChange: (value: T) => void;
    config: PropertySerializerConfig<T>;
    commands: Command;
    componentData?: any; // Access to the entire component data for setting flags like 'dirty'
  }) => void;
}

/**
 * Helper type to filter out functions, getters, and setters from a type
 * Only includes serializable properties (variables)
 */
export type SerializableKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : K;
}[keyof T];

/**
 * Component serialization configuration mapping property keys to their configs
 * Only non-function properties are allowed as keys
 */
export type ComponentSerializerConfig<T> = {
  [K in SerializableKeys<T>]?: PropertySerializerConfig<T[K]>;
};
