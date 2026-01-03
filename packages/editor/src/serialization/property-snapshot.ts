/**
 * Property Snapshot Types
 *
 * Types for tracking property values over time, enabling undo/redo
 * and change detection.
 */

import type { SerializedObject } from './serialized-object.js';

/**
 * A snapshot of a property value at a specific point in time
 */
export interface PropertySnapshot {
  /** The serialized value at this point in time (JSON-compatible) */
  value: unknown;

  /** Timestamp when snapshot was taken (Date.now()) */
  timestamp: number;
}

/**
 * Record of a single property change, used for undo/redo
 */
export interface PropertyChangeRecord {
  /** The SerializedObject this change belongs to */
  serializedObject: SerializedObject;

  /** Full property path (e.g., "entities[0].components[2].data.position.x") */
  path: string;

  /** Value before the change */
  oldValue: PropertySnapshot;

  /** Value after the change */
  newValue: PropertySnapshot;

  /**
   * Optional group ID for atomic operations.
   * Multiple changes with the same groupId will be undone/redone together.
   */
  groupId?: string;
}

/**
 * Create a property snapshot from a value
 */
export function createSnapshot(value: unknown): PropertySnapshot {
  return {
    value: structuredClone(value),
    timestamp: Date.now(),
  };
}

/**
 * Create a property change record
 */
export function createChangeRecord(
  serializedObject: SerializedObject,
  path: string,
  oldValue: unknown,
  newValue: unknown,
  groupId?: string,
): PropertyChangeRecord {
  return {
    serializedObject,
    path,
    oldValue: createSnapshot(oldValue),
    newValue: createSnapshot(newValue),
    groupId,
  };
}
