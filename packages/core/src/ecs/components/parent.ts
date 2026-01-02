/**
 * Parent component - Stores parent entity ID for hierarchical relationships
 */

import { component } from "../component.js";
import type { Entity } from "../entity.js";

export interface ParentData {
  /** ID of the parent entity */
  id: Entity;
}

/**
 * Parent component - Marks an entity as having a parent
 */
export const Parent = component<ParentData>("Parent", {
  id: {
    serializable: true,
    type: "entity",
  },
});
