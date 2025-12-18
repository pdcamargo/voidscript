/**
 * System - Wrapper for ECS systems with metadata and ordering
 * Provides API similar to component() for defining systems
 */

import type { Command } from "./command.js";

/**
 * System arguments passed to system functions
 */
export interface SystemArguments {
  commands: Command;
}

/**
 * System function type
 */
export type SystemFunction = (args: SystemArguments) => void;

/**
 * System run condition function
 */
export type SystemRunCondition = (args: SystemArguments) => boolean;

/**
 * System metadata for identification and ordering
 */
export interface SystemMetadata {
  /** Unique symbol ID for this system */
  id: symbol;
  /** The system function to execute */
  fn: SystemFunction;
  /** Optional run condition */
  runCondition?: SystemRunCondition;
  /** Systems this must run after */
  runAfter: Set<SystemMetadata>;
  /** Systems this must run before */
  runBefore: Set<SystemMetadata>;
}

/**
 * System wrapper with fluent API
 */
export interface SystemWrapper {
  /** Execute the system */
  execute: SystemFunction;
  /** Add run condition */
  runIf: (condition: SystemRunCondition) => SystemWrapper;
  /** This system must run after another */
  runAfter: (other: SystemWrapper) => SystemWrapper;
  /** This system must run before another */
  runBefore: (other: SystemWrapper) => SystemWrapper;
  /** Internal metadata (used by scheduler) */
  _metadata: SystemMetadata;
}

/**
 * Create a system with metadata
 * Similar to component() pattern for consistency
 *
 * @example
 * ```ts
 * const moveSystem = system(({ commands }) => {
 *   const query = commands.query().all(Position, Velocity);
 *   // ... movement logic
 * });
 *
 * const conditionalSystem = system(myFunc)
 *   .runIf(({ commands }) => gameActive);
 *
 * const orderedSystem = system(physics)
 *   .runAfter(input)
 *   .runBefore(render);
 * ```
 */
export function system(fn: SystemFunction): SystemWrapper {
  const metadata: SystemMetadata = {
    id: Symbol(),
    fn,
    runCondition: undefined,
    runAfter: new Set(),
    runBefore: new Set(),
  };

  const wrapper: SystemWrapper = {
    execute: fn,

    runIf(condition: SystemRunCondition): SystemWrapper {
      metadata.runCondition = condition;
      return wrapper;
    },

    runAfter(other: SystemWrapper): SystemWrapper {
      metadata.runAfter.add(other._metadata);
      // Also add reverse dependency
      other._metadata.runBefore.add(metadata);
      return wrapper;
    },

    runBefore(other: SystemWrapper): SystemWrapper {
      metadata.runBefore.add(other._metadata);
      // Also add reverse dependency
      other._metadata.runAfter.add(metadata);
      return wrapper;
    },

    _metadata: metadata,
  };

  return wrapper;
}
