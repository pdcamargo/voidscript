/**
 * Undo/Redo System
 *
 * Global undo/redo manager for the editor. Uses a command pattern with
 * automatic change grouping for atomic multi-property operations.
 */

import type { PropertyChangeRecord } from './property-snapshot.js';
import type { SerializedObject } from './serialized-object.js';

// ============================================================================
// Types
// ============================================================================

/**
 * An undoable command
 */
export interface UndoCommand {
  /** Human-readable description (e.g., "Move Entity", "Change Color") */
  readonly name: string;
  /** Execute the command (do/redo) */
  execute(): void;
  /** Undo the command */
  undo(): void;
}

// ============================================================================
// PropertyChangeCommand
// ============================================================================

/**
 * Command for property changes that can be undone/redone
 */
export class PropertyChangeCommand implements UndoCommand {
  readonly name: string;
  private readonly changes: PropertyChangeRecord[];

  constructor(changes: PropertyChangeRecord[], name?: string) {
    this.changes = [...changes];
    this.name = name ?? this.generateName();
  }

  private generateName(): string {
    if (this.changes.length === 1 && this.changes[0]) {
      const path = this.changes[0].path;
      const shortPath = path.split('.').slice(-2).join('.');
      return `Change ${shortPath}`;
    }
    return `Change ${this.changes.length} properties`;
  }

  execute(): void {
    for (const change of this.changes) {
      // Apply new value without triggering another undo record
      this.applyValueSilently(change.serializedObject, change.path, change.newValue.value);
    }
  }

  undo(): void {
    // Apply in reverse order
    for (let i = this.changes.length - 1; i >= 0; i--) {
      const change = this.changes[i];
      if (change) {
        this.applyValueSilently(change.serializedObject, change.path, change.oldValue.value);
      }
    }
  }

  /**
   * Apply a value without triggering the onPropertyChanged callback
   * (to avoid creating undo records during undo/redo)
   */
  private applyValueSilently(so: SerializedObject, path: string, value: unknown): void {
    // We need to bypass the normal setValueAtPath which triggers callbacks
    // For now, we use the public API but the UndoRedoManager should guard against this
    so.setValueAtPath(path, value);
  }
}

// ============================================================================
// UndoRedoManager
// ============================================================================

/**
 * Global undo/redo manager for the editor
 *
 * Features:
 * - Stack-based undo/redo with configurable max depth
 * - Automatic grouping of changes with the same groupId
 * - Clears redo stack on new action
 *
 * @example
 * ```typescript
 * // Get the global instance
 * const undoRedo = UndoRedoManager.instance;
 *
 * // Manual commands
 * undoRedo.push(new PropertyChangeCommand([changeRecord], 'Move Entity'));
 *
 * // Undo/redo
 * if (undoRedo.canUndo) undoRedo.undo();
 * if (undoRedo.canRedo) undoRedo.redo();
 *
 * // Grouping
 * undoRedo.beginGroup('Rename Entity');
 * // ... make multiple property changes ...
 * undoRedo.endGroup();
 * ```
 */
export class UndoRedoManager {
  // Singleton instance
  private static _instance: UndoRedoManager | null = null;

  private undoStack: UndoCommand[] = [];
  private redoStack: UndoCommand[] = [];
  private readonly maxStackSize: number;

  // Pending changes for grouping
  private pendingChanges: PropertyChangeRecord[] = [];
  private pendingGroupId: string | null = null;
  private pendingGroupName: string | null = null;

  // Flag to prevent recording during undo/redo
  private isPerformingUndoRedo = false;

  // Callbacks for UI updates
  private listeners: Set<() => void> = new Set();

  constructor(maxStackSize = 100) {
    this.maxStackSize = maxStackSize;
  }

  /**
   * Get the global singleton instance
   */
  static get instance(): UndoRedoManager {
    if (!UndoRedoManager._instance) {
      UndoRedoManager._instance = new UndoRedoManager();
    }
    return UndoRedoManager._instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    UndoRedoManager._instance = null;
  }

  // ============================================================================
  // Recording
  // ============================================================================

  /**
   * Record a property change (may be grouped)
   *
   * This is typically called automatically by SerializedObject.setValueAtPath
   * when onPropertyChanged is set to this.recordChange.
   *
   * @param record The change record to record
   */
  recordChange(record: PropertyChangeRecord): void {
    // Don't record during undo/redo operations
    if (this.isPerformingUndoRedo) return;

    if (record.groupId) {
      // Add to pending group
      if (this.pendingGroupId !== record.groupId) {
        // Different group - flush the old one
        this.flushPendingChanges();
        this.pendingGroupId = record.groupId;
      }
      this.pendingChanges.push(record);
    } else {
      // Immediate single change (not grouped)
      this.flushPendingChanges();
      this.push(new PropertyChangeCommand([record]));
    }
  }

  /**
   * Begin a named undo group
   *
   * All changes until endGroup() will be grouped into a single undo operation.
   *
   * @param name Human-readable name for the operation (e.g., "Move Entity")
   */
  beginGroup(name: string): void {
    this.flushPendingChanges();
    this.pendingGroupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.pendingGroupName = name;
  }

  /**
   * End the current undo group
   */
  endGroup(): void {
    this.flushPendingChanges();
    this.pendingGroupId = null;
    this.pendingGroupName = null;
  }

  /**
   * Flush pending grouped changes as a single command
   */
  flushPendingChanges(): void {
    if (this.pendingChanges.length > 0) {
      this.push(new PropertyChangeCommand(this.pendingChanges, this.pendingGroupName ?? undefined));
      this.pendingChanges = [];
    }
  }

  // ============================================================================
  // Stack Operations
  // ============================================================================

  /**
   * Push a command onto the undo stack
   */
  push(command: UndoCommand): void {
    this.undoStack.push(command);

    // Clear redo stack when new action occurs
    this.redoStack = [];

    // Trim undo stack if too large
    while (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }

    this.notifyListeners();
  }

  /**
   * Undo the last command
   *
   * @returns true if undo was performed, false if nothing to undo
   */
  undo(): boolean {
    // Flush any pending changes first
    this.flushPendingChanges();

    const command = this.undoStack.pop();
    if (!command) return false;

    this.isPerformingUndoRedo = true;
    try {
      command.undo();
    } finally {
      this.isPerformingUndoRedo = false;
    }

    this.redoStack.push(command);
    this.notifyListeners();
    return true;
  }

  /**
   * Redo the last undone command
   *
   * @returns true if redo was performed, false if nothing to redo
   */
  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;

    this.isPerformingUndoRedo = true;
    try {
      command.execute();
    } finally {
      this.isPerformingUndoRedo = false;
    }

    this.undoStack.push(command);
    this.notifyListeners();
    return true;
  }

  // ============================================================================
  // State Accessors
  // ============================================================================

  /** Check if undo is available */
  get canUndo(): boolean {
    return this.undoStack.length > 0 || this.pendingChanges.length > 0;
  }

  /** Check if redo is available */
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Get the name of the next undo action */
  get undoName(): string | null {
    if (this.pendingChanges.length > 0) {
      return this.pendingGroupName ?? `Change ${this.pendingChanges.length} properties`;
    }
    const command = this.undoStack[this.undoStack.length - 1];
    return command?.name ?? null;
  }

  /** Get the name of the next redo action */
  get redoName(): string | null {
    const command = this.redoStack[this.redoStack.length - 1];
    return command?.name ?? null;
  }

  /** Get the number of undo operations available */
  get undoCount(): number {
    return this.undoStack.length + (this.pendingChanges.length > 0 ? 1 : 0);
  }

  /** Get the number of redo operations available */
  get redoCount(): number {
    return this.redoStack.length;
  }

  // ============================================================================
  // Clear
  // ============================================================================

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.pendingChanges = [];
    this.pendingGroupId = null;
    this.pendingGroupName = null;
    this.notifyListeners();
  }

  // ============================================================================
  // Listeners
  // ============================================================================

  /**
   * Add a listener for undo/redo state changes
   *
   * @param listener Callback when state changes
   * @returns Unsubscribe function
   */
  addListener(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // ============================================================================
  // Factory Method
  // ============================================================================

  /**
   * Create a change recorder function for use with SerializedObject.onPropertyChanged
   */
  createRecorder(): (record: PropertyChangeRecord) => void {
    return (record) => this.recordChange(record);
  }
}
