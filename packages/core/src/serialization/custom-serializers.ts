/**
 * Built-in custom serializers for common types
 */

import type { ComponentSerializer, SerializationContext, DeserializationContext } from "./types.js";
import type { ComponentType } from "../ecs/component.js";
import { Parent } from "../ecs/components/parent.js";
import { Children } from "../ecs/components/children.js";

/**
 * Default serializer for primitives and plain objects
 * Handles: number, string, boolean, null, arrays, plain objects
 */
export class DefaultSerializer implements ComponentSerializer {
  constructor(public componentType: ComponentType<any>) {}

  serialize(data: any, _context: SerializationContext): unknown {
    // For primitives and plain objects, just return as-is (JSON compatible)
    return data;
  }

  deserialize(data: unknown, _context: DeserializationContext): any {
    return data;
  }

  validate(data: unknown): boolean {
    // Accept anything for default serializer
    return data !== undefined;
  }
}

/**
 * Set serializer
 * Converts Set to Array for JSON serialization
 */
export class SetSerializer implements ComponentSerializer {
  constructor(public componentType: ComponentType<any>) {}

  serialize(data: any, context: SerializationContext): unknown {
    if (data instanceof Set) {
      return { __type: "Set", values: Array.from(data) };
    }
    // Handle object with Set property
    const serialized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Set) {
        serialized[key] = { __type: "Set", values: Array.from(value) };
      } else {
        serialized[key] = value;
      }
    }
    return serialized;
  }

  deserialize(data: unknown, context: DeserializationContext): any {
    if (typeof data !== "object" || data === null) {
      return data;
    }

    const obj = data as any;

    // Direct Set serialization
    if (obj.__type === "Set" && Array.isArray(obj.values)) {
      return new Set(obj.values);
    }

    // Handle object with Set properties
    const deserialized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (
        typeof value === "object" &&
        value !== null &&
        (value as any).__type === "Set"
      ) {
        deserialized[key] = new Set((value as any).values);
      } else {
        deserialized[key] = value;
      }
    }
    return deserialized;
  }
}

/**
 * Parent component serializer
 * Handles entity reference remapping
 */
export class ParentSerializer implements ComponentSerializer {
  componentType = Parent;

  serialize(data: any, context: SerializationContext): unknown {
    // Remap entity reference to serialized ID
    const parentId = data.id;
    const serializedId = context.entityMapping.get(parentId);

    if (serializedId === undefined) {
      // Parent entity not in serialization scope, store original ID
      return { id: parentId };
    }

    return { id: serializedId };
  }

  deserialize(data: unknown, context: DeserializationContext): any {
    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid Parent component data");
    }

    const obj = data as any;
    const serializedId = obj.id;

    // Remap serialized ID to new entity
    const newEntity = context.entityMapping.get(serializedId);

    if (newEntity === undefined) {
      // Parent entity not in deserialization scope, keep original ID
      return { id: serializedId };
    }

    return { id: newEntity };
  }
}

/**
 * Children component serializer
 * Handles Set<Entity> serialization with entity reference remapping
 */
export class ChildrenSerializer implements ComponentSerializer {
  componentType = Children;

  serialize(data: any, context: SerializationContext): unknown {
    const childIds = data.ids as Set<number>;

    // Remap entity references to serialized IDs
    const serializedIds: number[] = [];
    for (const childId of childIds) {
      const serializedId = context.entityMapping.get(childId);
      if (serializedId !== undefined) {
        serializedIds.push(serializedId);
      } else {
        // Child entity not in serialization scope, keep original ID
        serializedIds.push(childId);
      }
    }

    return { ids: serializedIds };
  }

  deserialize(data: unknown, context: DeserializationContext): any {
    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid Children component data");
    }

    const obj = data as any;
    const serializedIds = obj.ids;

    if (!Array.isArray(serializedIds)) {
      throw new Error("Invalid Children component: ids must be an array");
    }

    // Remap serialized IDs to new entities
    const newChildIds = new Set<number>();
    for (const serializedId of serializedIds) {
      const newEntity = context.entityMapping.get(serializedId);
      if (newEntity !== undefined) {
        newChildIds.add(newEntity);
      } else {
        // Child entity not in deserialization scope, keep original ID
        newChildIds.add(serializedId);
      }
    }

    return { ids: newChildIds };
  }
}
