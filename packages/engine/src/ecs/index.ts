/**
 * VoidScript ECS - High-performance Entity Component System
 *
 * Re-exports core ECS primitives from @voidscript/core and adds
 * engine-specific extensions (assets, components, systems, bundles).
 *
 * @example
 * ```ts
 * import { Scene, component } from '@voidscript/engine/ecs';
 *
 * // Define components
 * const Position = component<{ x: number; y: number }>('Position');
 * const Velocity = component<{ x: number; y: number }>('Velocity');
 *
 * // Create scene
 * const scene = new Scene();
 *
 * // Spawn entities
 * scene.spawn()
 *   .with(Position, { x: 0, y: 0 })
 *   .with(Velocity, { x: 1, y: 0 })
 *   .build();
 *
 * // Query and iterate
 * scene.query()
 *   .all(Position, Velocity)
 *   .each((entity, pos, vel) => {
 *     pos.x += vel.x;
 *     pos.y += vel.y;
 *   });
 * ```
 */

// Re-export all core ECS primitives
// Note: We omit BaseAssetMetadata, PrefabMetadata, SceneMetadata from core
// because engine's asset/asset-metadata.ts has extended versions
export {
  // Math
  Vector2, Vector3, Vector4, Matrix2, Matrix3, Matrix4,
  Euler, Quaternion, Box2, Box3, Sphere, Plane, Ray, Line3,
  Triangle, Frustum, Cylindrical, Spherical, SphericalHarmonics3, MathUtils,
  Color,
  // ECS primitives
  EntityManager, INVALID_ENTITY, packEntity, entityId, entityGeneration,
  ComponentRegistry, defineComponent, component, globalComponentRegistry,
  Archetype, ArchetypeGraph,
  Scene, EntityBuilder,
  EventEmitter,
  Query,
  Command, EntityHandle, EntityCommandBuilder, EntityCommands,
  Scheduler, SchedulerRunner,
  system,
  // Bundle
  bundle, componentConfig, requiredProperty, optionalProperty, hiddenProperty,
  resolveComponentData, resolveBundleComponents,
  BundleRegistry, globalBundleRegistry, registerBundle,
  // Hierarchy components
  Name, Parent, Children, PrefabInstance,
  // Serialization
  SceneSerializer, DefaultSerializer, SetSerializer, ParentSerializer, ChildrenSerializer,
  ComponentRegistryEntrySchema, SerializedComponentSchema, SerializedEntitySchema,
  SceneMetadataSchema, SceneSchema,
  // Prefab
  PrefabManager, PrefabSerializer,
  // Runtime Asset
  RuntimeAsset, isRuntimeAsset, RuntimeAssetManager,
  assetRef, isAssetRef,
  // Resource
  ResourceType, ResourceRegistry, globalResourceRegistry, registerResource, isInitializableResource,
  // Events
  Events, EventWriter, EventReader,
  // YAML
  yamlToJson, jsonToYaml, isYamlFile,
} from '@voidscript/core';

// Re-export types from core
export type {
  // Math types
  Vector2Metadata, Vector3Metadata, Vector4Metadata,
  Matrix2Metadata, Matrix3Metadata, Matrix4Metadata,
  EulerMetadata, EulerOrder, QuaternionMetadata, ColorMetadata,
  Box2Metadata, Box3Metadata, SphereMetadata, PlaneMetadata,
  RayMetadata, Line3Metadata, TriangleMetadata, FrustumMetadata,
  CylindricalMetadata, SphericalMetadata, SphericalHarmonics3Metadata,
  // ECS types
  Entity, EntityMetadata, ComponentType, SceneEvent,
  SystemPhase, SystemFunction, SystemArguments, SystemWrapper, SystemMetadata, SystemRunCondition,
  // Bundle types
  BundleSchema, BundleType, BundleSpawnData, ComponentConfig, PropertyConfig,
  RequiredPropertyConfig, OptionalPropertyConfig, HiddenPropertyConfig,
  // Hierarchy types
  NameData, PrefabInstanceData,
  // Serialization types
  ComponentSerializer, SerializationContext, DeserializationContext,
  DeserializeMode, DeserializeOptions, DeserializeResult, SerializationStats,
  ComponentRegistryEntry, SerializedComponent, SerializedEntity,
  SceneData,
  // Prefab types
  PrefabAsset, PrefabData, InstantiatePrefabOptions, InstantiatePrefabResult, SavePrefabOptions,
  // Asset types (from core - minimal version)
  AssetRef,
  // Resource types
  ResourceMetadata, ResourceSerializerConfig, ResourceEditorOptions, InitializableResource,
} from '@voidscript/core';

// Engine-specific: Asset System (includes extended BaseAssetMetadata, PrefabMetadata, SceneMetadata)
export * from './asset/index.js';

// Engine-specific: Application and Scene utilities
export { Application } from './application.js';
export { cloneSceneViaSnapshot, cloneWorldViaSnapshot } from './scene-clone.js';
export {
  createSceneSnapshot,
  getEntityFromSnapshot,
  getRootEntitiesFromSnapshot,
  getChildrenFromSnapshot,
} from './scene-snapshot.js';
export type { EntitySnapshot, SceneSnapshot } from './scene-snapshot.js';
export { spawnBundleWithDefaults } from './bundle-utils.js';

// Engine-specific: Components
export * from './components/index.js';

// Engine-specific: Systems
export * from './systems/index.js';

// Engine-specific: Bundles (import for side-effects to register them)
import './bundles/index.js';
export * from './bundles/index.js';
