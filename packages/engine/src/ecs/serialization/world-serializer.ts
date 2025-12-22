/**
 * WorldSerializer - Core serialization/deserialization for ECS World
 *
 * Features:
 * - Two-pass deserialization with entity ID remapping
 * - Plugin-based custom serializer system
 * - Merge and replace modes
 * - Metadata preservation
 * - Component registry tracking
 */

import type { World } from "../world.js";
import type { Command } from "../command.js";
import type { ComponentType } from "../component.js";
import { globalComponentRegistry } from "../component.js";
import { Parent } from "../components/parent.js";
import type { Entity } from "../entity.js";
import type {
  ComponentSerializer,
  SerializationContext,
  DeserializationContext,
  DeserializeMode,
  DeserializeOptions,
  DeserializeResult,
  SerializationStats,
  PropertySerializerConfig,
  ComponentSerializerConfig,
} from "./types.js";
import type {
  WorldData,
  SerializedEntity,
  SerializedComponent,
  ComponentRegistryEntry,
} from "./schemas.js";
import { WorldSchema } from "./schemas.js";
import {
  DefaultSerializer,
  SetSerializer,
} from "./custom-serializers.js";
import { AssetRefSerializer } from "./asset-ref-serializer.js";
import { isAssetRef } from "../asset-ref.js";
import { isRuntimeAsset } from "../runtime-asset.js";
import { RuntimeAssetManager } from "../runtime-asset-manager.js";

/**
 * WorldSerializer - Orchestrates serialization/deserialization of ECS World
 */
export class WorldSerializer {
  private customSerializers = new Map<ComponentType<any>, ComponentSerializer>();
  private skipChildrenComponentTypes: Set<ComponentType<any>> | null = null;

  constructor() {
    // Note: Parent and Children components now use property-level serialization config
    // with type: "entity" instead of custom serializers
  }

  /**
   * Get component types that have skipChildrenSerialization enabled
   * Results are cached for performance
   */
  private getSkipChildrenComponentTypes(): Set<ComponentType<any>> {
    if (this.skipChildrenComponentTypes === null) {
      this.skipChildrenComponentTypes = new Set(
        globalComponentRegistry.getAll()
          .filter(type => type.metadata?.skipChildrenSerialization === true)
      );
    }
    return this.skipChildrenComponentTypes;
  }

  /**
   * Invalidate cache for component types (call when registry changes)
   */
  invalidateCache(): void {
    this.skipChildrenComponentTypes = null;
  }

  /**
   * Register custom serializer for a component type
   */
  registerSerializer(serializer: ComponentSerializer): void {
    this.customSerializers.set(serializer.componentType, serializer);
  }

  /**
   * Get serializer for component type (custom or default)
   */
  private getSerializer(componentType: ComponentType<any>): ComponentSerializer {
    // Check for custom serializer
    const custom = this.customSerializers.get(componentType);
    if (custom) {
      return custom;
    }

    // Default serializer for primitives and plain objects
    return new DefaultSerializer(componentType);
  }

  /**
   * Serialize a single property value based on its config
   */
  private serializePropertyValue(
    value: any,
    config: PropertySerializerConfig,
    context: SerializationContext,
    skipEntities?: Set<Entity>
  ): any {
    // Handle nullish values
    if (value === null || value === undefined) {
      if (config.whenNullish === "throw") {
        throw new Error(`Property value is nullish but whenNullish is set to 'throw'`);
      }
      if (config.whenNullish === "skip") {
        return undefined; // Signal to skip this property
      }
      // 'keep' mode: serialize as-is
      return value;
    }

    // Use custom serializer if provided
    if (config.customSerializer) {
      return config.customSerializer.serialize(value, context);
    }

    // Handle collection types FIRST (before preset types)
    if (config.collectionType === "array") {
      if (Array.isArray(value)) {
        return value
          .filter((item) => {
            // Filter out entity references that should be skipped or don't exist
            if (config.type === "entity" && typeof item === "number") {
              // Filter out skipped entities
              if (skipEntities && skipEntities.has(item)) {
                return false;
              }
              // Filter out entities that don't exist in the mapping (deleted entities)
              if (!context.entityMapping.has(item)) {
                return false;
              }
            }
            return true;
          })
          .map((item) => {
            // If collection has entity ID items, remap them
            if (config.type === "entity" && typeof item === "number") {
              // Safe to use ! here because we filtered out unmapped entities above
              return context.entityMapping.get(item)!;
            }
            // If collection has RuntimeAsset items, serialize them
            if (config.type === "runtimeAsset" && isRuntimeAsset(item)) {
              return { guid: item.guid };
            }
            // If collection has AssetRef items, serialize them
            if (config.type === "assetRef" && isAssetRef(item)) {
              return { guid: item.guid };
            }
            return item;
          });
      }
      return value;
    }

    if (config.collectionType === "set") {
      if (value instanceof Set) {
        // If collection has entity ID items, remap them
        if (config.type === "entity") {
          return Array.from(value)
            .filter((item) => {
              if (typeof item === "number") {
                // Filter out skipped entities
                if (skipEntities && skipEntities.has(item)) {
                  return false;
                }
                // Filter out entities that don't exist in the mapping (deleted entities)
                if (!context.entityMapping.has(item)) {
                  return false;
                }
              }
              return true;
            })
            .map((item) => {
              if (typeof item === "number") {
                // Safe to use ! here because we filtered out unmapped entities above
                return context.entityMapping.get(item)!;
              }
              return item;
            });
        }
        // If collection has RuntimeAsset items, serialize them
        if (config.type === "runtimeAsset") {
          return Array.from(value).map((item) => {
            if (isRuntimeAsset(item)) {
              return { guid: item.guid };
            }
            return item;
          });
        }
        // If collection has AssetRef items, serialize them
        if (config.type === "assetRef") {
          return Array.from(value).map((item) => {
            if (isAssetRef(item)) {
              return { guid: item.guid };
            }
            return item;
          });
        }
        return Array.from(value);
      }
      return value;
    }

    // Handle preset types (for non-collection values)
    if (config.type === "entity") {
      // Entity ID reference - remap to serialized ID
      if (typeof value === "number") {
        // If this entity was skipped, return undefined to skip serialization
        if (skipEntities && skipEntities.has(value)) {
          return undefined; // Will be handled by whenNullish logic if configured
        }
        // If entity doesn't exist in mapping (was deleted), return undefined
        const mappedId = context.entityMapping.get(value);
        if (mappedId === undefined) {
          return undefined; // Will be handled by whenNullish logic if configured
        }
        return mappedId;
      }
      return value;
    }

    if (config.type === "runtimeAsset") {
      if (isRuntimeAsset(value)) {
        return { guid: value.guid };
      }
      return value;
    }

    if (config.type === "assetRef") {
      if (isAssetRef(value)) {
        return { guid: value.guid };
      }
      return value;
    }

    if (config.type === "set") {
      if (value instanceof Set) {
        return Array.from(value);
      }
      return value;
    }

    // Default: pass through
    return value;
  }

  /**
   * Deserialize a single property value based on its config
   */
  private deserializePropertyValue(
    value: any,
    config: PropertySerializerConfig,
    context: DeserializationContext
  ): any {
    // Handle nullish values
    if (value === null || value === undefined) {
      return value; // Keep as-is during deserialization
    }

    // Use custom deserializer if provided
    if (config.customSerializer) {
      return config.customSerializer.deserialize(value, context);
    }

    // Handle preset types (check collections FIRST to avoid early return)
    if (config.type === "entity" && !config.collectionType) {
      // Entity ID reference - remap from serialized ID to new entity ID
      // NOTE: Skip if collectionType is set (handled in collection block below)
      if (typeof value === "number") {
        const mappedEntity = context.entityMapping.get(value);
        if (mappedEntity === undefined) {
          throw new Error(`Cannot remap entity ID ${value} - not found in entity mapping`);
        }
        return mappedEntity;
      }
      return value;
    }

    // Handle single RuntimeAsset (NOT arrays - those are handled in collectionType block below)
    if (config.type === "runtimeAsset" && !config.collectionType) {
      if (typeof value === "object" && value !== null && "guid" in value) {
        const guid = value.guid as string;

        // Try to get metadata from resolver
        let metadata = context.assetMetadataResolver?.(guid);

        // If no metadata available, create minimal metadata
        if (!metadata) {
          metadata = {
            guid,
            path: `unknown/${guid}`,
            type: "unknown",
            importedAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
          };
        }

        // Get or create RuntimeAsset instance from manager
        if (!RuntimeAssetManager.has()) {
          RuntimeAssetManager.initialize();
        }
        return RuntimeAssetManager.get().getOrCreate(guid, metadata);
      }
      return value;
    }

    if (config.type === "assetRef") {
      if (typeof value === "object" && value !== null && "guid" in value) {
        return { guid: value.guid };
      }
      return value;
    }

    if (config.type === "set") {
      if (Array.isArray(value)) {
        return new Set(value);
      }
      return value;
    }

    // Handle collection types
    if (config.collectionType === "array") {
      if (Array.isArray(value)) {
        return value.map((item) => {
          // If collection has entity ID items, remap them
          if (config.type === "entity" && typeof item === "number") {
            const mappedEntity = context.entityMapping.get(item);
            if (mappedEntity === undefined) {
              throw new Error(`Cannot remap entity ID ${item} in array - not found in entity mapping`);
            }
            return mappedEntity;
          }
          // If collection has RuntimeAsset items, deserialize them
          if (config.type === "runtimeAsset" && typeof item === "object" && item !== null && "guid" in item) {
            const guid = item.guid as string;
            let metadata = context.assetMetadataResolver?.(guid);
            if (!metadata) {
              metadata = {
                guid,
                path: `unknown/${guid}`,
                type: "unknown",
                importedAt: new Date().toISOString(),
                modifiedAt: new Date().toISOString(),
              };
            }
            if (!RuntimeAssetManager.has()) {
              RuntimeAssetManager.initialize();
            }
            return RuntimeAssetManager.get().getOrCreate(guid, metadata);
          }
          // If collection has AssetRef items, deserialize them
          if (config.type === "assetRef" && typeof item === "object" && item !== null && "guid" in item) {
            return { guid: item.guid };
          }
          return item;
        });
      }
      return value;
    }

    if (config.collectionType === "set") {
      if (Array.isArray(value)) {
        const items = value.map((item) => {
          // If collection has entity ID items, remap them
          if (config.type === "entity" && typeof item === "number") {
            const mappedEntity = context.entityMapping.get(item);
            if (mappedEntity === undefined) {
              throw new Error(`Cannot remap entity ID ${item} in set - not found in entity mapping`);
            }
            return mappedEntity;
          }
          // If collection has RuntimeAsset items, deserialize them
          if (config.type === "runtimeAsset" && typeof item === "object" && item !== null && "guid" in item) {
            const guid = item.guid as string;
            let metadata = context.assetMetadataResolver?.(guid);
            if (!metadata) {
              metadata = {
                guid,
                path: `unknown/${guid}`,
                type: "unknown",
                importedAt: new Date().toISOString(),
                modifiedAt: new Date().toISOString(),
              };
            }
            if (!RuntimeAssetManager.has()) {
              RuntimeAssetManager.initialize();
            }
            return RuntimeAssetManager.get().getOrCreate(guid, metadata);
          }
          // If collection has AssetRef items, deserialize them
          if (config.type === "assetRef" && typeof item === "object" && item !== null && "guid" in item) {
            return { guid: item.guid };
          }
          return item;
        });
        return new Set(items);
      }
      return value;
    }

    // Default: pass through
    return value;
  }

  /**
   * Serialize component data using property-level config
   */
  private serializeWithPropertyConfig(
    data: any,
    config: ComponentSerializerConfig<any>,
    context: SerializationContext,
    skipEntities?: Set<Entity>
  ): any {
    const result: any = {};

    for (const [propertyKey, propertyConfig] of Object.entries(config)) {
      if (!propertyConfig || !propertyConfig.serializable) {
        continue; // Skip non-serializable properties
      }

      const value = data[propertyKey];
      const serializedValue = this.serializePropertyValue(value, propertyConfig, context, skipEntities);

      // Skip if whenNullish is 'skip' and value is undefined
      if (serializedValue === undefined && propertyConfig.whenNullish === "skip") {
        continue;
      }

      // Use serializeAs name if provided, otherwise use original key
      const outputKey = propertyConfig.serializeAs || propertyKey;
      result[outputKey] = serializedValue;
    }

    return result;
  }

  /**
   * Deserialize component data using property-level config
   */
  private deserializeWithPropertyConfig(
    data: any,
    config: ComponentSerializerConfig<any>,
    context: DeserializationContext
  ): any {
    const result: any = {};

    for (const [propertyKey, propertyConfig] of Object.entries(config)) {
      if (!propertyConfig || !propertyConfig.serializable) {
        continue; // Skip non-serializable properties
      }

      // Use serializeAs name if provided to read from data
      const inputKey = propertyConfig.serializeAs || propertyKey;
      const value = data[inputKey];

      const deserializedValue = this.deserializePropertyValue(value, propertyConfig, context);

      // Store under original property key
      result[propertyKey] = deserializedValue;
    }

    return result;
  }

  /**
   * Recursively collect all descendant entities
   */
  private collectDescendants(
    entity: Entity,
    childrenMap: Map<Entity, Set<Entity>>,
    skipSet: Set<Entity>
  ): void {
    const children = childrenMap.get(entity);
    if (!children) return;

    for (const child of children) {
      // Already visited - prevents infinite loops in malformed hierarchies
      if (skipSet.has(child)) continue;

      skipSet.add(child);
      // Recursively collect grandchildren
      this.collectDescendants(child, childrenMap, skipSet);
    }
  }

  /**
   * Build set of entities to skip during serialization
   * based on skipChildrenSerialization metadata
   */
  private buildSkipSet(
    commands: Command,
    entityFilter?: Set<number>
  ): Set<Entity> {
    const skipSet = new Set<Entity>();

    // Step 1: Build parent → children mapping for efficient lookup
    const childrenMap = new Map<Entity, Set<Entity>>();
    commands.query().all(Parent).each((entity, parent) => {
      // Skip entities not in filter
      if (entityFilter && !entityFilter.has(entity)) {
        return;
      }

      const parentId = parent.id;
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, new Set());
      }
      childrenMap.get(parentId)!.add(entity);
    });

    // Step 2: Get component types with skipChildrenSerialization enabled
    const componentsToCheck = this.getSkipChildrenComponentTypes();

    // Step 3: For each entity with skip-enabled components, recursively collect children
    for (const componentType of componentsToCheck) {
      commands.query().all(componentType).each((entity) => {
        // Skip if not in filter
        if (entityFilter && !entityFilter.has(entity)) {
          return;
        }

        // Recursively add all descendants to skip set
        this.collectDescendants(entity, childrenMap, skipSet);
      });
    }

    return skipSet;
  }

  /**
   * Serialize World to WorldData object
   * @param world - World instance
   * @param commands - Command instance for queries
   * @param entityFilter - Optional set of entity IDs to serialize (defaults to all entities)
   */
  serialize(
    world: World,
    commands: Command,
    entityFilter?: Set<number>
  ): WorldData {
    const startTime = performance.now();

    // Build skip set for entities with skipChildrenSerialization components
    const skipEntities = this.buildSkipSet(commands, entityFilter);

    // Build component registry
    const componentRegistry: ComponentRegistryEntry[] = [];
    const componentTypeMap = new Map<ComponentType<any>, number>();

    // Collect all component types from filtered entities
    const allComponentTypes = new Set<ComponentType<any>>();
    commands.query().all().each((entity) => {
      // Skip entities not in filter
      if (entityFilter && !entityFilter.has(entity)) {
        return;
      }

      // Skip entities excluded by skipChildrenSerialization
      if (skipEntities.has(entity)) {
        return;
      }

      const components = commands.getAllComponents(entity);
      if (components) {
        for (const [componentType] of components) {
          allComponentTypes.add(componentType);
        }
      }
    });

    // Build registry with sequential IDs
    let typeId = 0;
    for (const componentType of allComponentTypes) {
      componentRegistry.push({
        id: typeId,
        name: componentType.name,
      });
      componentTypeMap.set(componentType, typeId);
      typeId++;
    }

    // Build entity mapping (entity ID -> sequential ID)
    const entityMapping = new Map<number, number>();
    let serializedId = 0;

    commands.query().all().each((entity) => {
      // Skip entities not in filter
      if (entityFilter && !entityFilter.has(entity)) {
        return;
      }

      // Skip entities excluded by skipChildrenSerialization
      if (skipEntities.has(entity)) {
        return;
      }

      entityMapping.set(entity, serializedId);
      serializedId++;
    });

    // Serialize entities
    const context: SerializationContext = { entityMapping };
    const entities: SerializedEntity[] = [];

    commands.query().all().each((entity) => {
      // Skip entities not in filter
      if (entityFilter && !entityFilter.has(entity)) {
        return;
      }

      // Skip entities excluded by skipChildrenSerialization
      if (skipEntities.has(entity)) {
        return;
      }

      const components = commands.getAllComponents(entity);
      if (!components) {
        return;
      }

      const serializedComponents: SerializedComponent[] = [];

      for (const [componentType, data] of components) {
        const typeId = componentTypeMap.get(componentType);
        if (typeId === undefined) {
          continue; // Should never happen
        }

        // Skip non-serializable components (marked with false)
        if (componentType.serializerConfig === false) {
          continue;
        }

        let serializedData: any;

        // Check if component has property-level serialization config
        if (componentType.serializerConfig) {
          // Use property-level config
          serializedData = this.serializeWithPropertyConfig(
            data,
            componentType.serializerConfig,
            context,
            skipEntities
          );
        } else {
          // Fall back to custom serializer or default
          const serializer = this.getSerializer(componentType);
          serializedData = serializer.serialize(data, context);
        }

        serializedComponents.push({
          typeId,
          typeName: componentType.name,
          data: serializedData,
        });
      }

      // Get generation for entity validation
      const generation = world.getGeneration(entity);

      entities.push({
        id: entityMapping.get(entity)!,
        generation,
        components: serializedComponents,
      });
    });

    const serializeTime = performance.now() - startTime;

    return {
      version: "1.0.0",
      componentRegistry,
      entities,
      metadata: {
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        entityCount: entities.length,
        archetypeCount: world.getArchetypeCount(),
      },
    };
  }

  /**
   * Deserialize WorldData into World
   * Two-pass:
   * 1. Create all entities and add components (simple data)
   * 2. Fix up entity references using entityMapping
   */
  deserialize(
    world: World,
    commands: Command,
    data: unknown,
    options: DeserializeOptions = {}
  ): DeserializeResult {
    const startTime = performance.now();
    const {
      mode = "replace",
      skipMissingComponents = false,
      continueOnError = false,
    } = options;

    // Validate data
    const parseResult = WorldSchema.safeParse(data);
    if (!parseResult.success) {
      return {
        success: false,
        entitiesCreated: 0,
        entitiesSkipped: 0,
        warnings: [],
        error: `Schema validation failed: ${parseResult.error.message}`,
        entityMapping: new Map(),
      };
    }

    const worldData = parseResult.data;
    const warnings: string[] = [];
    let entitiesCreated = 0;
    let entitiesSkipped = 0;

    // Clear world if replace mode
    if (mode === "replace") {
      world.clear();
    }

    // Build component type lookup (by ID and name) using global registry
    const componentTypeById = new Map<number, ComponentType<any>>();
    const componentTypeByName = new Map<string, ComponentType<any>>();

    // Build lookup maps from registry using global component registry
    for (const entry of worldData.componentRegistry) {
      // Try to find matching component type by name in global registry
      let componentType: ComponentType<any> | undefined;

      // Search global registry for component with matching name
      for (const type of globalComponentRegistry.getAll()) {
        if (type.name === entry.name) {
          componentType = type;
          break;
        }
      }

      if (!componentType) {
        if (skipMissingComponents) {
          warnings.push(
            `Component type "${entry.name}" (ID: ${entry.id}) not found, skipping`
          );
          continue;
        } else {
          return {
            success: false,
            entitiesCreated,
            entitiesSkipped,
            warnings,
            error: `Component type "${entry.name}" (ID: ${entry.id}) not found in registry`,
            entityMapping: new Map(),
          };
        }
      }

      componentTypeById.set(entry.id, componentType);
      componentTypeByName.set(entry.name, componentType);
    }

    // PASS 1: Create empty entities and build entity mapping
    const entityMapping = new Map<number, number>();
    const entitiesToPopulate: Array<{ serializedEntity: SerializedEntity; entity: number }> = [];

    for (const serializedEntity of worldData.entities) {
      try {
        // Create new entity (without components yet)
        const entityBuilder = commands.spawn();
        const newEntity = entityBuilder.build();

        // Build entity mapping immediately
        entityMapping.set(serializedEntity.id, newEntity.id());
        entitiesToPopulate.push({ serializedEntity, entity: newEntity.id() });
        entitiesCreated++;
      } catch (error) {
        if (continueOnError) {
          warnings.push(
            `Failed to create entity ${serializedEntity.id}: ${error instanceof Error ? error.message : String(error)}`
          );
          entitiesSkipped++;
          continue;
        } else {
          return {
            success: false,
            entitiesCreated,
            entitiesSkipped,
            warnings,
            error: `Failed to create entity ${serializedEntity.id}: ${error instanceof Error ? error.message : String(error)}`,
            entityMapping,
          };
        }
      }
    }

    // PASS 2: Add components with complete entity mapping
    for (const { serializedEntity, entity } of entitiesToPopulate) {
      try {
        // Add all components
        for (const serializedComponent of serializedEntity.components) {
          // Skip components with missing typeId (corrupted data)
          if (serializedComponent.typeId === undefined) {
            if (skipMissingComponents) {
              warnings.push(
                `Component "${serializedComponent.typeName}" missing typeId for entity ${serializedEntity.id}, skipping component`
              );
              continue;
            } else {
              throw new Error(
                `Component "${serializedComponent.typeName}" missing typeId`
              );
            }
          }

          const componentType = componentTypeById.get(serializedComponent.typeId);

          if (!componentType) {
            if (skipMissingComponents) {
              warnings.push(
                `Component type "${serializedComponent.typeName}" (ID: ${serializedComponent.typeId}) not found for entity ${serializedEntity.id}, skipping component`
              );
              continue;
            } else {
              throw new Error(
                `Component type "${serializedComponent.typeName}" (ID: ${serializedComponent.typeId}) not found`
              );
            }
          }

          // Deserialize component data
          let componentData: any;

          // Check if component has property-level serialization config
          if (componentType.serializerConfig) {
            // Use property-level config with complete entity mapping
            componentData = this.deserializeWithPropertyConfig(
              serializedComponent.data,
              componentType.serializerConfig,
              {
                entityMapping,
                assetMetadataResolver: options.assetMetadataResolver,
              }
            );
          } else {
            // For components without property config, add raw data
            // Entity references will be fixed in pass 3 for custom serializers
            componentData = serializedComponent.data;
          }

          world.addComponent(entity, componentType, componentData);
        }
      } catch (error) {
        if (continueOnError) {
          warnings.push(
            `Failed to add components to entity ${serializedEntity.id}: ${error instanceof Error ? error.message : String(error)}`
          );
          continue;
        } else {
          return {
            success: false,
            entitiesCreated,
            entitiesSkipped,
            warnings,
            error: `Failed to add components to entity ${serializedEntity.id}: ${error instanceof Error ? error.message : String(error)}`,
            entityMapping,
          };
        }
      }
    }

    // PASS 3: Fix entity references using custom deserializers (legacy path)
    const deserializationContext: DeserializationContext = {
      entityMapping,
      assetMetadataResolver: options.assetMetadataResolver,
    };

    for (const serializedEntity of worldData.entities) {
      const newEntityId = entityMapping.get(serializedEntity.id);
      if (newEntityId === undefined) {
        continue; // Entity was skipped
      }

      for (const serializedComponent of serializedEntity.components) {
        // Skip components with missing typeId (already handled in Pass 2)
        if (serializedComponent.typeId === undefined) {
          continue;
        }

        const componentType = componentTypeById.get(serializedComponent.typeId);
        if (!componentType) {
          continue; // Component was skipped
        }

        // Skip components with property-level config (already fully deserialized in pass 1)
        if (componentType.serializerConfig) {
          continue;
        }

        // Check if this component type has a custom deserializer
        const serializer = this.customSerializers.get(componentType);
        if (serializer) {
          // Re-deserialize with entity mapping
          const deserializedData = serializer.deserialize(
            serializedComponent.data,
            deserializationContext
          );

          // Update component with fixed references
          commands.entity(newEntityId).addComponent(componentType, deserializedData);
        }
      }
    }

    const deserializeTime = performance.now() - startTime;

    return {
      success: true,
      entitiesCreated,
      entitiesSkipped,
      warnings,
      entityMapping,
    };
  }

  /**
   * Serialize to JSON string
   */
  serializeToString(world: World, commands: Command, pretty = false): string {
    const data = this.serialize(world, commands);
    return JSON.stringify(data, null, pretty ? 2 : 0);
  }

  /**
   * Deserialize from JSON string
   */
  deserializeFromString(
    world: World,
    commands: Command,
    json: string,
    options?: DeserializeOptions
  ): DeserializeResult {
    try {
      const data = JSON.parse(json);
      return this.deserialize(world, commands, data, options);
    } catch (error) {
      return {
        success: false,
        entitiesCreated: 0,
        entitiesSkipped: 0,
        warnings: [],
        error: `JSON parse error: ${error instanceof Error ? error.message : String(error)}`,
        entityMapping: new Map(),
      };
    }
  }

  /**
   * Clone a world by serializing and deserializing
   */
  clone(sourceWorld: World, sourceCommands: Command): {
    world: World;
    commands: Command;
    result: DeserializeResult;
  } {
    const World = sourceWorld.constructor as new () => World;
    const targetWorld = new World();
    const Command = sourceCommands.constructor as new (world: World) => Command;
    const targetCommands = new Command(targetWorld);

    const data = this.serialize(sourceWorld, sourceCommands);
    const result = this.deserialize(targetWorld, targetCommands, data, {
      mode: "replace",
    });

    return {
      world: targetWorld,
      commands: targetCommands,
      result,
    };
  }

  /**
   * Get serialization stats
   */
  getStats(world: World, commands: Command): SerializationStats {
    const startTime = performance.now();
    const data = this.serialize(world, commands);
    const serializeTime = performance.now() - startTime;

    const jsonString = JSON.stringify(data);
    const sizeBytes = new Blob([jsonString]).size;

    let componentCount = 0;
    for (const entity of data.entities) {
      componentCount += entity.components.length;
    }

    return {
      entityCount: data.entities.length,
      componentCount,
      componentTypeCount: data.componentRegistry.length,
      sizeBytes,
      serializeTime,
    };
  }
}
