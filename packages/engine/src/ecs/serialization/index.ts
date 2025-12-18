/**
 * ECS World Serialization
 *
 * Exports:
 * - WorldSerializer: Core serialization/deserialization class
 * - ComponentSerializer: Interface for custom serializers
 * - Built-in serializers: DefaultSerializer, SetSerializer, ParentSerializer, ChildrenSerializer, AssetRefSerializer
 * - Types and schemas
 */

export { WorldSerializer } from "./world-serializer.js";
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
  WorldMetadata,
  WorldData,
} from "./schemas.js";
export {
  ComponentRegistryEntrySchema,
  SerializedComponentSchema,
  SerializedEntitySchema,
  WorldMetadataSchema,
  WorldSchema,
} from "./schemas.js";
