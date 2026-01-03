/**
 * SerializedObject - Wraps any serializable asset for property-level access and change tracking
 *
 * Provides:
 * - Three-copy state management (disk, applied, working)
 * - Property-level dirty tracking
 * - Path-based property access
 * - Undo/redo change recording
 */

import { SerializedProperty } from './serialized-property.js';
import { createChangeRecord, type PropertyChangeRecord } from './property-snapshot.js';

// ============================================================================
// Types
// ============================================================================

export interface SerializedObjectOptions {
  /** Relative path from project root (e.g., "src/scenes/main.vscn"), null for unsaved */
  relativePath: string | null;
  /** Initial serialized data */
  data: unknown;
  /** Callback when any property changes (for undo/redo recording) */
  onPropertyChanged?: (record: PropertyChangeRecord) => void;
}

// ============================================================================
// SerializedObject Class
// ============================================================================

/**
 * SerializedObject - Unified wrapper for any serializable asset
 *
 * Manages three copies of data:
 * 1. **diskData** - Last saved version (what's on disk)
 * 2. **appliedData** - Current runtime state (after applyModifiedProperties)
 * 3. **workingData** - Current editing state (modified by inspector)
 *
 * This enables tracking:
 * - `isDirty` = working != applied (has unapplied edits)
 * - `hasUnappliedChanges` = applied != disk (applied but not saved)
 * - `isSavedToDisk` = working == disk (no unsaved changes at all)
 *
 * @example
 * ```typescript
 * const so = new SerializedObject({
 *   relativePath: 'src/scenes/main.vscn',
 *   data: sceneData,
 *   onPropertyChanged: (record) => undoRedoManager.record(record),
 * });
 *
 * // Access properties
 * const pos = so.findProperty('entities[0].components[0].data.position');
 * pos.vector3Value = new Vector3(1, 2, 3);
 *
 * // Check state
 * if (so.isDirty) {
 *   so.applyModifiedProperties(); // Apply to runtime
 * }
 *
 * // Save
 * if (!so.isSavedToDisk) {
 *   await saveToFile(so.relativePath, so.getSerializedData());
 *   so.markAsSaved();
 * }
 * ```
 */
export class SerializedObject {
  private readonly _relativePath: string | null;

  // Three copies of the data
  private _diskData: unknown;
  private _appliedData: unknown;
  private _workingData: unknown;

  // Track which paths are dirty (working != applied)
  private _dirtyPaths: Set<string> = new Set();

  // Callback for change tracking (undo/redo)
  private _onPropertyChanged: ((record: PropertyChangeRecord) => void) | null;

  // Property cache (lazy instantiation)
  private _propertyCache: Map<string, SerializedProperty> = new Map();

  // Current undo group (for atomic operations)
  private _currentGroupId: string | null = null;

  constructor(options: SerializedObjectOptions) {
    this._relativePath = options.relativePath;
    this._diskData = structuredClone(options.data);
    this._appliedData = structuredClone(options.data);
    this._workingData = structuredClone(options.data);
    this._onPropertyChanged = options.onPropertyChanged ?? null;
  }

  // ============================================================================
  // State Accessors
  // ============================================================================

  /** Relative path from project root (null for unsaved new objects) */
  get relativePath(): string | null {
    return this._relativePath;
  }

  /** Whether any property has been modified from applied state */
  get isDirty(): boolean {
    return this._dirtyPaths.size > 0;
  }

  /** Whether applied state differs from disk state */
  get hasUnappliedChanges(): boolean {
    return !this.deepEqual(this._appliedData, this._diskData);
  }

  /** Whether current working state matches disk state (no unsaved changes) */
  get isSavedToDisk(): boolean {
    return this.deepEqual(this._workingData, this._diskData);
  }

  /** Get all dirty property paths */
  get dirtyPaths(): ReadonlySet<string> {
    return this._dirtyPaths;
  }

  // ============================================================================
  // Property Access
  // ============================================================================

  /**
   * Find a property by path
   *
   * @param path Property path (e.g., "entities[0].components[2].data.position.x")
   * @returns SerializedProperty handle for the specified path
   *
   * @example
   * ```typescript
   * const pos = so.findProperty('entities[0].components[0].data.position');
   * const x = so.findProperty('entities[0].components[0].data.position.x');
   * ```
   */
  findProperty(path: string): SerializedProperty {
    // Check cache first
    let prop = this._propertyCache.get(path);
    if (prop) return prop;

    // Parse path to find parent and name
    const { parentPath, name } = this.parsePropertyPath(path);
    const parent = parentPath ? this.findProperty(parentPath) : null;

    prop = new SerializedProperty({
      serializedObject: this,
      path,
      parent,
      name,
    });

    this._propertyCache.set(path, prop);
    return prop;
  }

  /**
   * Get an iterator over all root-level properties
   */
  *rootProperties(): IterableIterator<SerializedProperty> {
    const data = this._workingData;
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      for (const key of Object.keys(data)) {
        yield this.findProperty(key);
      }
    }
  }

  /**
   * Check if a specific property path is dirty
   */
  isPropertyDirty(path: string): boolean {
    return this._dirtyPaths.has(path);
  }

  // ============================================================================
  // Internal Value Access (used by SerializedProperty)
  // ============================================================================

  /**
   * Get value at a property path (internal - used by SerializedProperty)
   */
  getValueAtPath(path: string): unknown {
    return this.resolvePath(this._workingData, path);
  }

  /**
   * Set value at a property path (internal - used by SerializedProperty)
   * Automatically marks dirty and records change for undo
   */
  setValueAtPath(path: string, value: unknown): void {
    const oldValue = this.getValueAtPath(path);

    // Skip if value unchanged
    if (this.deepEqual(oldValue, value)) return;

    // Create change record
    const record = createChangeRecord(this, path, oldValue, value, this._currentGroupId ?? undefined);

    // Apply change to working data
    this.setPathValue(this._workingData, path, structuredClone(value));

    // Mark as dirty
    this._dirtyPaths.add(path);

    // Notify listeners (for undo/redo)
    this._onPropertyChanged?.(record);
  }

  // ============================================================================
  // Apply/Revert Operations
  // ============================================================================

  /**
   * Apply all modified properties to the "applied" state
   *
   * After this call:
   * - `isDirty` becomes false
   * - `hasUnappliedChanges` may become true (if not saved to disk)
   *
   * @returns true if there were changes to apply, false otherwise
   */
  applyModifiedProperties(): boolean {
    if (!this.isDirty) return false;

    // Copy working data to applied data
    this._appliedData = structuredClone(this._workingData);

    // Clear dirty tracking
    this._dirtyPaths.clear();

    // Clear property cache (types may have changed)
    this._propertyCache.clear();

    return true;
  }

  /**
   * Revert all properties to applied state
   *
   * Discards all changes since last `applyModifiedProperties()` call.
   */
  revertAllProperties(): void {
    this._workingData = structuredClone(this._appliedData);
    this._dirtyPaths.clear();
    this._propertyCache.clear();
  }

  /**
   * Revert a specific property to applied state
   *
   * @param path Property path to revert
   */
  revertProperty(path: string): void {
    const appliedValue = this.resolvePath(this._appliedData, path);
    this.setPathValue(this._workingData, path, structuredClone(appliedValue));
    this._dirtyPaths.delete(path);
  }

  /**
   * Mark the current applied state as saved to disk
   *
   * After this call:
   * - `isSavedToDisk` becomes true (if no new changes)
   * - `hasUnappliedChanges` becomes false
   */
  markAsSaved(): void {
    this._diskData = structuredClone(this._appliedData);
  }

  /**
   * Update from fresh disk data (e.g., after external file change)
   *
   * If there are no local changes, also updates applied and working data.
   *
   * @param newData Fresh data from disk
   */
  updateFromDisk(newData: unknown): void {
    this._diskData = structuredClone(newData);

    // If no local changes, also update applied and working
    if (!this.isDirty && !this.hasUnappliedChanges) {
      this._appliedData = structuredClone(newData);
      this._workingData = structuredClone(newData);
    }
  }

  /**
   * Get the current serialized data (working copy)
   *
   * Use this to save the data to disk.
   */
  getSerializedData(): unknown {
    return structuredClone(this._workingData);
  }

  /**
   * Get the applied data (runtime state)
   */
  getAppliedData(): unknown {
    return structuredClone(this._appliedData);
  }

  /**
   * Get the disk data (last saved state)
   */
  getDiskData(): unknown {
    return structuredClone(this._diskData);
  }

  // ============================================================================
  // Undo Group Operations
  // ============================================================================

  /**
   * Begin an undo group (atomic operation)
   *
   * All property changes until `endUndoGroup()` will be recorded
   * with the same group ID and undone/redone together.
   *
   * @param groupId Unique identifier for this group
   * @throws Error if already in an undo group
   */
  beginUndoGroup(groupId: string): void {
    if (this._currentGroupId) {
      throw new Error(`Cannot nest undo groups. Current group: ${this._currentGroupId}`);
    }
    this._currentGroupId = groupId;
  }

  /**
   * End the current undo group
   */
  endUndoGroup(): void {
    this._currentGroupId = null;
  }

  /**
   * Check if currently in an undo group
   */
  get isInUndoGroup(): boolean {
    return this._currentGroupId !== null;
  }

  /**
   * Get the current undo group ID (null if not in a group)
   */
  get currentUndoGroupId(): string | null {
    return this._currentGroupId;
  }

  // ============================================================================
  // Path Parsing and Resolution
  // ============================================================================

  /**
   * Parse a property path into parent path and property name
   */
  private parsePropertyPath(path: string): { parentPath: string | null; name: string } {
    if (!path) {
      return { parentPath: null, name: '' };
    }

    // Handle array indices like "entities[0]" or "path.to.array[0]"
    const arrayMatch = path.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch && arrayMatch[1] && arrayMatch[2]) {
      return { parentPath: arrayMatch[1], name: arrayMatch[2] };
    }

    // Handle dot notation like "position.x"
    const lastDot = path.lastIndexOf('.');
    if (lastDot === -1) {
      return { parentPath: null, name: path };
    }

    // Check if the last dot is inside brackets
    const lastBracket = path.lastIndexOf(']');
    if (lastBracket > lastDot) {
      // The dot is inside brackets, find the previous dot
      const beforeBracket = path.substring(0, lastBracket + 1);
      const afterBracket = path.substring(lastBracket + 1);

      if (afterBracket.startsWith('.')) {
        return {
          parentPath: beforeBracket,
          name: afterBracket.substring(1),
        };
      }

      return { parentPath: null, name: path };
    }

    return {
      parentPath: path.substring(0, lastDot),
      name: path.substring(lastDot + 1),
    };
  }

  /**
   * Resolve a path to get a value from an object
   */
  private resolvePath(obj: unknown, path: string): unknown {
    if (!path) return obj;

    const segments = this.parsePath(path);
    let current = obj;

    for (const segment of segments) {
      if (current === null || current === undefined) return undefined;

      if (typeof segment === 'number') {
        // Array index
        if (!Array.isArray(current)) return undefined;
        current = current[segment];
      } else {
        // Object key
        if (typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[segment];
      }
    }

    return current;
  }

  /**
   * Set a value at a path in an object
   */
  private setPathValue(obj: unknown, path: string, value: unknown): void {
    const segments = this.parsePath(path);
    let current = obj;

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      if (segment === undefined) continue;

      if (typeof segment === 'number') {
        if (!Array.isArray(current)) {
          throw new Error(`Cannot index non-array at ${path}`);
        }
        current = current[segment];
      } else {
        if (typeof current !== 'object' || current === null) {
          throw new Error(`Cannot access property on non-object at ${path}`);
        }
        current = (current as Record<string, unknown>)[segment];
      }
    }

    const lastSegment = segments[segments.length - 1];
    if (lastSegment === undefined) {
      throw new Error(`Empty path: ${path}`);
    }
    if (typeof lastSegment === 'number') {
      if (!Array.isArray(current)) {
        throw new Error(`Cannot index non-array at ${path}`);
      }
      current[lastSegment] = value;
    } else {
      if (typeof current !== 'object' || current === null) {
        throw new Error(`Cannot set property on non-object at ${path}`);
      }
      (current as Record<string, unknown>)[lastSegment] = value;
    }
  }

  /**
   * Parse a path string into segments (strings and numbers for array indices)
   */
  private parsePath(path: string): (string | number)[] {
    const result: (string | number)[] = [];
    const regex = /([^.\[\]]+)|\[(\d+)\]/g;
    let match;

    while ((match = regex.exec(path)) !== null) {
      if (match[1]) {
        result.push(match[1]);
      } else if (match[2]) {
        result.push(parseInt(match[2], 10));
      }
    }

    return result;
  }

  // ============================================================================
  // Deep Equality
  // ============================================================================

  /**
   * Deep equality comparison (public for SerializedProperty.equals)
   */
  deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a !== 'object') return false;

    if (Array.isArray(a) !== Array.isArray(b)) return false;

    if (Array.isArray(a)) {
      if (a.length !== (b as unknown[]).length) return false;
      return a.every((item, i) => this.deepEqual(item, (b as unknown[])[i]));
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b as object);

    if (keysA.length !== keysB.length) return false;

    return keysA.every((key) =>
      this.deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    );
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get a string representation for debugging
   */
  toString(): string {
    return `SerializedObject(${this._relativePath ?? 'unsaved'}, dirty: ${this.isDirty}, saved: ${this.isSavedToDisk})`;
  }
}
