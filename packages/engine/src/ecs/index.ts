/**
 * VoidScript ECS - High-performance Entity Component System
 *
 * @example
 * ```ts
 * import { World, component } from '@voidscript/engine/ecs';
 *
 * // Define components
 * const Position = component<{ x: number; y: number }>('Position');
 * const Velocity = component<{ x: number; y: number }>('Velocity');
 *
 * // Create world
 * const world = new World();
 *
 * // Spawn entities
 * world.spawn()
 *   .with(Position, { x: 0, y: 0 })
 *   .with(Velocity, { x: 1, y: 0 })
 *   .build();
 *
 * // Query and iterate
 * world.query()
 *   .all(Position, Velocity)
 *   .each((entity, pos, vel) => {
 *     pos.x += vel.x;
 *     pos.y += vel.y;
 *   });
 * ```
 */

// Entity system
export type { Entity, EntityMetadata } from "./entity.js";
export {
  EntityManager,
  INVALID_ENTITY,
  packEntity,
  entityId,
  entityGeneration,
} from "./entity.js";

// Component system
export type { ComponentType } from "./component.js";
export {
  ComponentRegistry,
  defineComponent,
  component,
  globalComponentRegistry,
} from "./component.js";

// Archetype system
export { Archetype, ArchetypeGraph } from "./archetype.js";

// World
export { World, EntityBuilder } from "./world.js";
export type { WorldEvent } from "./world.js";

// Event system
export { EventEmitter } from "./event-emitter.js";

// Query system
export { Query } from "./query.js";

// Command system
export { Command, EntityHandle, EntityCommandBuilder, EntityCommands } from "./command.js";

// Event system
export { Events, EventWriter, EventReader } from "./events.js";
export type { EventClass, EventsApi } from "./events.js";

// Bundle system
export type {
  BundleSchema,
  BundleType,
  BundleSpawnData,
  ComponentConfig,
  PropertyConfig,
  RequiredPropertyConfig,
  OptionalPropertyConfig,
  HiddenPropertyConfig,
} from "./bundle.js";
export {
  bundle,
  componentConfig,
  requiredProperty,
  optionalProperty,
  hiddenProperty,
  resolveComponentData,
  resolveBundleComponents,
} from "./bundle.js";
export { BundleRegistry, globalBundleRegistry, registerBundle } from "./bundle-registry.js";

// Built-in bundles (import for side-effects to register them)
import "./bundles/index.js";
export {
  Sprite2DBundle,
  MainCameraBundle,
  VirtualCameraBundle,
  Character2DBundle,
  Character3DBundle,
} from "./bundles/index.js";

// Application system
export { Application } from "./application.js";
export { Scheduler } from "./scheduler.js";
export type { SystemPhase } from "./scheduler.js";
export { SchedulerRunner } from "./scheduler-runner.js";
export { system } from "./system.js";
export type { SystemFunction, SystemArguments, SystemWrapper, SystemMetadata, SystemRunCondition } from "./system.js";

// Components
export { Name } from "./components/name.js";
export type { NameData } from "./components/name.js";
export { Parent } from "./components/parent.js";
export { Children } from "./components/children.js";
export { SceneRoot } from "./components/scene-root.js";
export type { SceneRootData } from "./components/scene-root.js";
export { SceneChild } from "./components/scene-child.js";
export type { SceneChildData } from "./components/scene-child.js";

// Serialization
export {
  WorldSerializer,
  DefaultSerializer,
  SetSerializer,
  ParentSerializer,
  ChildrenSerializer,
  ComponentRegistryEntrySchema,
  SerializedComponentSchema,
  SerializedEntitySchema,
  WorldMetadataSchema,
  WorldSchema,
} from "./serialization/index.js";
export type {
  ComponentSerializer,
  SerializationContext,
  DeserializationContext,
  DeserializeMode,
  DeserializeOptions,
  DeserializeResult,
  SerializationStats,
  ComponentRegistryEntry,
  SerializedComponent,
  SerializedEntity,
  WorldMetadata,
  WorldData,
} from "./serialization/index.js";

// Scene System
export { SceneManager } from "./scene-manager.js";
export { SceneSerializer } from "./scene-serializer.js";
export type {
  SceneAsset,
  SceneData,
  InstantiateSceneOptions,
  InstantiateSceneResult,
} from "./scene-asset.js";
export type { SaveSceneOptions } from "./scene-serializer.js";

// Asset System
export { RuntimeAsset, isRuntimeAsset } from "./runtime-asset.js";
export { RuntimeAssetManager } from "./runtime-asset-manager.js";
export { assetRef, isAssetRef } from "./asset-ref.js";
export type { AssetRef } from "./asset-ref.js";
export {
  AssetType,
  TextureFilter,
  TextureWrap,
  isTextureMetadata,
  isSceneMetadata,
  isAnimationMetadata,
  isUnknownAssetMetadata,
} from "./asset-metadata.js";
export type {
  GUID,
  BaseAssetMetadata,
  TextureMetadata,
  SceneMetadata,
  AnimationMetadata,
  UnknownAssetMetadata,
  AssetMetadata,
} from "./asset-metadata.js";

// Resource System
export {
  ResourceType,
  ResourceRegistry,
  globalResourceRegistry,
  registerResource,
  isInitializableResource,
} from "./resource.js";
export type {
  ResourceMetadata,
  ResourceSerializerConfig,
  ResourceEditorOptions,
  InitializableResource,
} from "./resource.js";
