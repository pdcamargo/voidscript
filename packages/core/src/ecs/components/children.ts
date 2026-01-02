/**
 * Children component - Stores set of child entity IDs for hierarchical relationships
 */

import { component } from "../component.js";
import type { Entity } from "../entity.js";

export interface ChildrenData {
  /** Set of child entity IDs */
  ids: Set<Entity>;
}

/**
 * Children component - Marks an entity as having children
 */
export const Children = component<ChildrenData>("Children", {
  ids: {
    serializable: true,
    collectionType: "set",
    type: "entity",
  },
});
