/**
 * ECS Scene Serialization
 *
 * Exports:
 * - SceneSerializer: Core serialization/deserialization class
 * - ComponentSerializer: Interface for custom serializers
 * - Built-in serializers: DefaultSerializer, SetSerializer, ParentSerializer, ChildrenSerializer, AssetRefSerializer
 * - Types and schemas
 */

export { SceneSerializer } from "./scene-serializer.js";
export type {
  ComponentSerializer,
  SerializationContext,
  DeserializationContext,
  DeserializeMode,
  DeserializeOptions,
  DeserializeResult,
  SerializationStats,
  PropertySerializerConfig,
  ComponentSerializerConfig,
  CustomPropertySerializer,
  PresetSerializationType,
  NullishBehavior,
  CollectionType,
} from "./types.js";
export {
  DefaultSerializer,
  SetSerializer,
  ParentSerializer,
  ChildrenSerializer,
} from "./custom-serializers.js";
export { AssetRefSerializer } from "./asset-ref-serializer.js";
export type {
  ComponentRegistryEntry,
  SerializedComponent,
  SerializedEntity,
  SceneMetadata,
  SceneData,
  ResourceRegistryEntry,
  SerializedResource,
} from "./schemas.js";
export {
  ComponentRegistryEntrySchema,
  SerializedComponentSchema,
  SerializedEntitySchema,
  SceneMetadataSchema,
  SceneSchema,
  ResourceRegistryEntrySchema,
  SerializedResourceSchema,
} from "./schemas.js";
export {
  jsonToYaml,
  yamlToJson,
  isYamlFile,
  isJsonFile,
} from "./yaml-utils.js";
