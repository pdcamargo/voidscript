/**
 * Scene Snapshot System
 *
 * Provides lightweight serialization of Scene state for editor UI rendering.
 * Unlike full scene serialization, snapshots capture current entity state
 * without metadata or asset resolution complexity.
 */

import type { Scene } from "./scene.js";
import type { Command } from "./command.js";
import type { Entity } from "./entity.js";
import { Parent } from "./components/parent.js";
import { Children } from "./components/children.js";

/**
 * Entity snapshot with components and hierarchy info
 */
export interface EntitySnapshot {
  /** Entity runtime ID */
  id: Entity;

  /** Component data (component type name → serialized data) */
  components: Map<string, unknown>;

  /** Parent entity ID (null if root) */
  parentId: Entity | null;

  /** Child entity IDs */
  childIds: Entity[];
}

/**
 * Lightweight Scene snapshot for editor UI
 */
export interface SceneSnapshot {
  /** All entities with their component data */
  entities: EntitySnapshot[];

  /** Root entity IDs (entities without parents) */
  rootEntityIds: Entity[];

  /** Total entity count */
  entityCount: number;

  /** Timestamp when snapshot was created */
  timestamp: number;
}

/**
 * Serialize Scene to snapshot for editor UI rendering
 *
 * This is a lightweight serialization that captures:
 * - Entity IDs
 * - Component data (as-is, no special serialization)
 * - Parent/child relationships
 *
 * Unlike full scene serialization, this does NOT:
 * - Generate stable UUIDs
 * - Resolve asset metadata
 * - Handle entity ID remapping
 *
 * @param scene - The ECS Scene to snapshot
 * @param commands - The Command interface
 * @returns Immutable snapshot of current Scene state
 */
export function createSceneSnapshot(
  scene: Scene,
  commands: Command
): SceneSnapshot {
  const entities: EntitySnapshot[] = [];
  const rootEntityIds: Entity[] = [];

  // Iterate all entities
  scene.query().each((entityId: Entity) => {
    // Get all components for this entity
    const componentsMap = scene.getAllComponents(entityId);

    // Extract component data (component type name → data)
    const components = new Map<string, unknown>();
    if (componentsMap) {
      for (const [componentType, componentData] of componentsMap.entries()) {
        components.set(componentType.name, componentData);
      }
    }

    // Get parent/children relationships
    const parentData = commands.tryGetComponent(entityId, Parent);
    const childrenData = commands.tryGetComponent(entityId, Children);

    const parentId = parentData ? parentData.id : null;
    const childIds = childrenData ? Array.from(childrenData.ids) : [];

    // Build entity snapshot
    entities.push({
      id: entityId,
      components,
      parentId,
      childIds,
    });

    // Track root entities (no parent)
    if (!parentId) {
      rootEntityIds.push(entityId);
    }
  });

  return {
    entities,
    rootEntityIds,
    entityCount: entities.length,
    timestamp: Date.now(),
  };
}

/**
 * Get entity snapshot by ID
 */
export function getEntityFromSnapshot(
  snapshot: SceneSnapshot,
  entityId: Entity
): EntitySnapshot | undefined {
  return snapshot.entities.find((e) => e.id === entityId);
}

/**
 * Get root entities from snapshot
 */
export function getRootEntitiesFromSnapshot(
  snapshot: SceneSnapshot
): EntitySnapshot[] {
  return snapshot.rootEntityIds.map((id) => {
    const entity = getEntityFromSnapshot(snapshot, id);
    if (!entity) {
      throw new Error(`Root entity ${id} not found in snapshot`);
    }
    return entity;
  });
}

/**
 * Get children of an entity from snapshot
 */
export function getChildrenFromSnapshot(
  snapshot: SceneSnapshot,
  parentId: Entity
): EntitySnapshot[] {
  const parent = getEntityFromSnapshot(snapshot, parentId);
  if (!parent) return [];

  return parent.childIds
    .map((childId) => getEntityFromSnapshot(snapshot, childId))
    .filter((child): child is EntitySnapshot => child !== undefined);
}

