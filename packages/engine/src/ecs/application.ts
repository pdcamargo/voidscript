/**
 * Application - Main ECS application class
 * Integrates World, Command, Scheduler, and SchedulerRunner
 */

import { World } from "./world.js";
import { Command } from "./command.js";
import { Scheduler } from "./scheduler.js";
import { SchedulerRunner } from "./scheduler-runner.js";

/**
 * Application - Main entry point for ECS applications
 *
 * @example
 * ```ts
 * // Create new application with fresh world
 * const app = new Application();
 *
 * // Or provide existing world (useful for play mode)
 * const clonedWorld = cloneWorldViaSnapshot(editorWorld);
 * const playApp = new Application(clonedWorld);
 *
 * // Register systems
 * app.scheduler.addSystem('startup', initGame);
 * app.scheduler.addSystem('update', moveSystem);
 * app.scheduler.addSystem('fixedUpdate', physicsSystem);
 * app.scheduler.addSystem('render', renderSystem);
 *
 * // Run the application
 * await app.run();
 * ```
 */
export class Application {
  /** ECS World */
  readonly world: World;

  /** Command API */
  readonly commands: Command;

  /** System scheduler */
  readonly scheduler: Scheduler;

  /** Game loop runner */
  readonly runner: SchedulerRunner;

  /**
   * Create a new Application
   * @param world - Optional existing World to use (if not provided, creates new World)
   */
  constructor(world?: World) {
    this.world = world ?? new World();
    this.commands = new Command(this.world);
    this.scheduler = new Scheduler();
    this.runner = new SchedulerRunner(this.scheduler);
  }

  /**
   * Run the application
   * Starts FPS detection, runs startup systems, and begins game loop
   */
  async run(): Promise<void> {
    await this.runner.run(this.commands, this.world);
  }

  /**
   * Stop the application
   */
  stop(): void {
    this.runner.stop();
  }

  /**
   * Clear all entities and systems
   */
  clear(): void {
    this.world.clear();
    this.scheduler.clear();
  }
}
