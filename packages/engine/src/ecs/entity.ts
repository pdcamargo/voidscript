/**
 * Entity System - Lightweight handles with generation versioning
 *
 * Entities are 64-bit values packed as [32-bit ID | 32-bit generation].
 * Generation counter prevents use-after-free bugs by invalidating old handles.
 */

/** Entity handle (packed ID + generation) */
export type Entity = number;

/** Entity metadata stored in sparse array */
export interface EntityMetadata {
  /** Generation counter for this entity ID */
  generation: number;
  /** Index of archetype containing this entity */
  archetypeId: number;
  /** Row index within archetype's component arrays */
  row: number;
}

/** Invalid entity constant */
export const INVALID_ENTITY: Entity = 0;

/** Maximum entity ID (2^32 - 1) */
const MAX_ENTITY_ID = 0xffffffff;

/** Maximum generation (2^32 - 1) */
const MAX_GENERATION = 0xffffffff;

/**
 * Pack entity ID and generation into single 64-bit number
 */
export function packEntity(id: number, generation: number): Entity {
  // JavaScript numbers are 64-bit floats, but bitwise operations work on 32-bit integers
  // We store as a float that preserves both 32-bit values when decomposed
  return id + generation * (MAX_ENTITY_ID + 1);
}

/**
 * Extract entity ID from packed entity
 */
export function entityId(entity: Entity): number {
  return entity % (MAX_ENTITY_ID + 1);
}

/**
 * Extract generation from packed entity
 */
export function entityGeneration(entity: Entity): number {
  return Math.floor(entity / (MAX_ENTITY_ID + 1));
}

/**
 * Entity Manager - Handles entity creation, destruction, and recycling
 */
export class EntityManager {
  /** Sparse array mapping entity ID → metadata */
  private entityMeta: (EntityMetadata | undefined)[] = [];

  /** Free list for recycling destroyed entity IDs */
  private freeEntities: number[] = [];

  /** Next entity ID to allocate (if free list empty) */
  private nextEntityId = 1; // Start at 1 (0 is INVALID_ENTITY)

  /**
   * Spawn a new entity
   * @returns New entity handle
   */
  spawn(): Entity {
    let id: number;
    let generation: number;

    if (this.freeEntities.length > 0) {
      // Reuse entity ID from free list
      id = this.freeEntities.pop()!;
      const meta = this.entityMeta[id];
      generation = meta ? meta.generation : 0;
    } else {
      // Allocate new entity ID
      id = this.nextEntityId++;
      generation = 0;
    }

    // Initialize metadata (archetype/row set later by World)
    this.entityMeta[id] = {
      generation,
      archetypeId: -1, // Will be set when entity added to archetype
      row: -1,
    };

    return packEntity(id, generation);
  }

  /**
   * Destroy an entity (increment generation, add to free list)
   * @param entity Entity to destroy
   */
  destroy(entity: Entity): void {
    const id = entityId(entity);
    const meta = this.entityMeta[id];

    if (!meta) {
      return; // Already destroyed
    }

    // Increment generation to invalidate old handles
    meta.generation = (meta.generation + 1) % MAX_GENERATION;
    meta.archetypeId = -1;
    meta.row = -1;

    // Add to free list for recycling
    this.freeEntities.push(id);
  }

  /**
   * Check if entity is alive (generation matches)
   * @param entity Entity to check
   * @returns True if entity is alive
   */
  isAlive(entity: Entity): boolean {
    const id = entityId(entity);
    const generation = entityGeneration(entity);
    const meta = this.entityMeta[id];

    return meta !== undefined && meta.generation === generation;
  }

  /**
   * Get entity metadata (archetype + row)
   * @param entity Entity to look up
   * @returns Metadata or undefined if entity invalid
   */
  getMetadata(entity: Entity): EntityMetadata | undefined {
    if (!this.isAlive(entity)) {
      return undefined;
    }

    return this.entityMeta[entityId(entity)];
  }

  /**
   * Update entity location (archetype + row)
   * @param entity Entity to update
   * @param archetypeId Archetype index
   * @param row Row index in archetype
   */
  setLocation(entity: Entity, archetypeId: number, row: number): void {
    const meta = this.getMetadata(entity);
    if (!meta) {
      throw new Error(`Cannot set location for invalid entity ${entity}`);
    }

    meta.archetypeId = archetypeId;
    meta.row = row;
  }

  /**
   * Get current entity count (alive entities)
   */
  getEntityCount(): number {
    return this.nextEntityId - 1 - this.freeEntities.length;
  }

  /**
   * Clear all entities
   */
  clear(): void {
    this.entityMeta = [];
    this.freeEntities = [];
    this.nextEntityId = 1;
  }
}
