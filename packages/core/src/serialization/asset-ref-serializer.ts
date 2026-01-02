/**
 * AssetRef serializer
 * Handles serialization of AssetRef objects in component data
 */

import type {
  ComponentSerializer,
  SerializationContext,
  DeserializationContext,
} from "./types.js";
import type { ComponentType } from "../ecs/component.js";
import { isAssetRef, type AssetRef } from "../ecs/asset-types.js";

/**
 * UUID v4 regex pattern for validating GUIDs
 */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates if a string is a valid UUID v4 GUID
 */
function isValidGuid(guid: string): boolean {
  return UUID_V4_REGEX.test(guid);
}

/**
 * AssetRef serializer
 *
 * Handles components with AssetRef properties by:
 * - Serializing: Converting AssetRef objects to plain { guid: string }
 * - Deserializing: Reconstructing AssetRef objects from plain data
 * - Validating: Checking GUID format (UUID v4)
 *
 * Supports:
 * - Direct AssetRef values
 * - AssetRef | null for optional assets
 * - Nested AssetRef in component objects
 * - Arrays of AssetRef
 */
export class AssetRefSerializer implements ComponentSerializer {
  constructor(public componentType: ComponentType<any>) {}

  serialize(data: any, _context: SerializationContext): unknown {
    return this.serializeValue(data);
  }

  private serializeValue(value: any): any {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Handle AssetRef directly
    if (isAssetRef(value)) {
      return { guid: value.guid };
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((item) => this.serializeValue(item));
    }

    // Handle objects with AssetRef properties
    if (typeof value === "object") {
      const serialized: any = {};
      for (const [key, val] of Object.entries(value)) {
        serialized[key] = this.serializeValue(val);
      }
      return serialized;
    }

    // Primitives pass through
    return value;
  }

  deserialize(data: unknown, _context: DeserializationContext): any {
    return this.deserializeValue(data);
  }

  private deserializeValue(value: any): any {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Handle AssetRef objects
    if (this.isAssetRefData(value)) {
      // Validate GUID format
      if (!isValidGuid(value.guid)) {
        console.warn(
          `AssetRef has invalid GUID format: "${value.guid}". Expected UUID v4 format.`
        );
      }
      return { guid: value.guid };
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((item) => this.deserializeValue(item));
    }

    // Handle objects with potential AssetRef properties
    if (typeof value === "object") {
      const deserialized: any = {};
      for (const [key, val] of Object.entries(value)) {
        deserialized[key] = this.deserializeValue(val);
      }
      return deserialized;
    }

    // Primitives pass through
    return value;
  }

  private isAssetRefData(value: any): boolean {
    return (
      typeof value === "object" &&
      value !== null &&
      "guid" in value &&
      typeof value.guid === "string" &&
      Object.keys(value).length === 1
    );
  }

  validate(data: unknown): boolean {
    // AssetRef data must be an object with a guid string
    if (data === null || data === undefined) {
      return true; // Allow null/undefined for optional assets
    }

    return this.validateValue(data);
  }

  private validateValue(value: any): boolean {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return true;
    }

    // Handle AssetRef objects
    if (this.isAssetRefData(value)) {
      return typeof value.guid === "string" && isValidGuid(value.guid);
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.every((item) => this.validateValue(item));
    }

    // Handle objects with potential AssetRef properties
    if (typeof value === "object") {
      return Object.values(value).every((val) => this.validateValue(val));
    }

    // Primitives are valid
    return true;
  }
}
