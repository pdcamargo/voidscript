/**
 * Zod schemas for ECS world serialization
 */

import { z } from "zod";

/**
 * Component registry entry schema
 * Stores component type metadata for validation during deserialization
 */
export const ComponentRegistryEntrySchema = z.object({
  id: z.number(),
  name: z.string(),
});

/**
 * Serialized component schema
 * Stores component type info and data as unknown (validated by custom serializers)
 * Note: typeId is optional to handle corrupted/legacy scene files gracefully
 */
export const SerializedComponentSchema = z.object({
  typeId: z.number().optional(),
  typeName: z.string(),
  data: z.unknown(),
});

/**
 * Serialized entity schema
 * Stores entity metadata and all attached components
 */
export const SerializedEntitySchema = z.object({
  id: z.number(), // Packed entity handle
  generation: z.number(), // For validation
  archetypeId: z.number().optional(), // For debugging
  components: z.array(SerializedComponentSchema),
});

/**
 * World metadata schema
 * Optional metadata for editor and debugging
 */
export const WorldMetadataSchema = z
  .object({
    createdAt: z.string().optional(),
    modifiedAt: z.string().optional(),
    entityCount: z.number().optional(),
    archetypeCount: z.number().optional(),
    description: z.string().optional(),
  })
  .optional();

/**
 * Resource registry entry schema
 * Stores resource type metadata for validation during deserialization
 */
export const ResourceRegistryEntrySchema = z.object({
  id: z.number(),
  name: z.string(),
});

/**
 * Serialized resource schema
 * Stores resource type info and data as unknown (validated by custom serializers)
 */
export const SerializedResourceSchema = z.object({
  typeName: z.string(),
  data: z.unknown(),
});

/**
 * Complete world serialization schema
 */
export const WorldSchema = z.object({
  version: z.string().default("1.0.0"),
  componentRegistry: z.array(ComponentRegistryEntrySchema),
  entities: z.array(SerializedEntitySchema),
  metadata: WorldMetadataSchema,
  // Resources are optional for backward compatibility with old world files
  resourceRegistry: z.array(ResourceRegistryEntrySchema).optional(),
  resources: z.array(SerializedResourceSchema).optional(),
});

/**
 * TypeScript types derived from schemas
 */
export type ComponentRegistryEntry = z.infer<
  typeof ComponentRegistryEntrySchema
>;
export type SerializedComponent = z.infer<typeof SerializedComponentSchema>;
export type SerializedEntity = z.infer<typeof SerializedEntitySchema>;
export type WorldMetadata = z.infer<typeof WorldMetadataSchema>;
export type ResourceRegistryEntry = z.infer<typeof ResourceRegistryEntrySchema>;
export type SerializedResource = z.infer<typeof SerializedResourceSchema>;
export type WorldData = z.infer<typeof WorldSchema>;
