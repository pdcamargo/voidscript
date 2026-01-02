/**
 * Scheduler - Manages and orders systems for execution
 * Automatically orders systems based on runAfter/runBefore dependencies
 */

import type { SystemWrapper, SystemMetadata, SystemArguments } from "./system.js";

/**
 * System execution phase
 */
export type SystemPhase =
  | "earlyStartup"
  | "startup"
  | "lateStartup"
  | "earlyUpdate"
  | "update"
  | "lateUpdate"
  | "earlyFixedUpdate"
  | "fixedUpdate"
  | "lateFixedUpdate"
  | "earlyRender"
  | "render"
  | "lateRender"
  | "afterRender";

/**
 * Scheduler - Stores and orders systems by phase
 */
export class Scheduler {
  private systems = new Map<SystemPhase, SystemWrapper[]>();
  private orderedSystems = new Map<SystemPhase, SystemWrapper[]>();

  /**
   * Add a system to a specific phase
   */
  addSystem(phase: SystemPhase, system: SystemWrapper): void {
    if (!this.systems.has(phase)) {
      this.systems.set(phase, []);
    }
    this.systems.get(phase)!.push(system);

    // Invalidate ordering for this phase
    this.orderedSystems.delete(phase);
  }

  /**
   * Get systems for a phase (ordered by dependencies)
   */
  getSystems(phase: SystemPhase): SystemWrapper[] {
    // Return cached ordered systems if available
    if (this.orderedSystems.has(phase)) {
      return this.orderedSystems.get(phase)!;
    }

    // Get systems for this phase
    const systems = this.systems.get(phase) || [];
    if (systems.length === 0) {
      this.orderedSystems.set(phase, []);
      return [];
    }

    // Order systems by dependencies
    const ordered = this.topologicalSort(systems);
    this.orderedSystems.set(phase, ordered);
    return ordered;
  }

  /**
   * Execute systems for a phase
   */
  executeSystems(phase: SystemPhase, args: SystemArguments): void {
    const systems = this.getSystems(phase);

    for (const system of systems) {
      // Check run condition if present
      if (system._metadata.runCondition) {
        if (!system._metadata.runCondition(args)) {
          continue; // Skip this system
        }
      }

      // Set system identity for event reader tracking
      args.commands.setSystemIdentity(system._metadata);

      // Execute system
      system.execute(args);
    }
  }

  /**
   * Topological sort systems based on dependencies
   * Uses Kahn's algorithm for cycle detection
   */
  private topologicalSort(systems: SystemWrapper[]): SystemWrapper[] {
    const sorted: SystemWrapper[] = [];
    const visited = new Set<symbol>();
    const inProgress = new Set<symbol>();

    // DFS visit function
    const visit = (system: SystemWrapper): void => {
      const metadata = system._metadata;

      if (visited.has(metadata.id)) {
        return; // Already processed
      }

      if (inProgress.has(metadata.id)) {
        throw new Error("Circular dependency detected in system ordering");
      }

      inProgress.add(metadata.id);

      // Visit all dependencies (systems this must run after)
      for (const dep of metadata.runAfter) {
        // Find the system wrapper for this dependency
        const depSystem = systems.find((s) => s._metadata.id === dep.id);
        if (depSystem) {
          visit(depSystem);
        }
      }

      inProgress.delete(metadata.id);
      visited.add(metadata.id);
      sorted.push(system);
    };

    // Visit all systems
    for (const system of systems) {
      if (!visited.has(system._metadata.id)) {
        visit(system);
      }
    }

    return sorted;
  }

  /**
   * Clear all systems
   */
  clear(): void {
    this.systems.clear();
    this.orderedSystems.clear();
  }

  /**
   * Remove a system from a phase
   */
  removeSystem(phase: SystemPhase, system: SystemWrapper): void {
    const systems = this.systems.get(phase);
    if (systems) {
      const index = systems.indexOf(system);
      if (index !== -1) {
        systems.splice(index, 1);
        // Invalidate ordering
        this.orderedSystems.delete(phase);
      }
    }
  }
}
