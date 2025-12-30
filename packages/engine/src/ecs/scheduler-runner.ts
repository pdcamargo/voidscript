/**
 * Scheduler Runner - Manages game loop with FPS detection and fixed timestep
 */

import type { Scheduler } from './scheduler.js';
import type { Command } from './command.js';
import type { World } from './world.js';

/**
 * Scheduler Runner - Executes scheduler systems in game loop
 */
export class SchedulerRunner {
  private targetFPS = 60;
  private fixedDeltaTime = 1 / 60;
  private isRunning = false;
  private accumulator = 0;
  private lastFrameTime = 0;
  private startTime = 0;
  private frameCount = 0;
  private currentFPS = 0;
  private fpsFrameTimes: number[] = [];
  private lastFPSUpdate = 0;

  constructor(private scheduler: Scheduler) {}

  /**
   * Detect target FPS by measuring frame rate
   * Runs for specified number of frames and calculates average
   */
  private async detectTargetFPS(sampleFrames = 60): Promise<number> {
    return new Promise((resolve) => {
      const frameTimes: number[] = [];
      let frameCount = 0;
      let lastTime = performance.now();

      const measureFrame = () => {
        const currentTime = performance.now();
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;

        frameTimes.push(deltaTime);
        frameCount++;

        if (frameCount < sampleFrames) {
          requestAnimationFrame(measureFrame);
        } else {
          // Calculate average FPS
          const avgDelta =
            frameTimes.reduce((a, b) => a + b) / frameTimes.length;
          const avgFPS = 1000 / avgDelta;
          resolve(Math.round(avgFPS));
        }
      };

      requestAnimationFrame(measureFrame);
    });
  }

  /**
   * Run the game loop
   * 1. Detect target FPS
   * 2. Run startup systems once
   * 3. Main loop: update → fixed update → flush events → render → after render
   */
  async run(commands: Command, world: World): Promise<void> {
    // Detect target FPS (minimum 60)
    console.log('Detecting target FPS...');
    const detectedFPS = await this.detectTargetFPS();
    this.targetFPS = Math.max(detectedFPS, 60);
    this.fixedDeltaTime = 1 / this.targetFPS;
    console.log(`Target FPS: ${this.targetFPS} (detected: ${detectedFPS})`);

    // Run startup systems once
    this.scheduler.executeSystems('earlyStartup', { commands });
    this.scheduler.executeSystems('startup', { commands });
    this.scheduler.executeSystems('lateStartup', { commands });

    // Flush events from startup (if any)
    world.flushEvents();

    // Start main loop
    this.isRunning = true;
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.frameCount = 0;
    this.currentFPS = 0;
    this.fpsFrameTimes = [];
    this.lastFPSUpdate = this.startTime;
    this.gameLoop(commands, world);
  }

  /**
   * Main game loop
   */
  private gameLoop(commands: Command, world: World): void {
    if (!this.isRunning) {
      return;
    }

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
    this.lastFrameTime = currentTime;

    // Update frame count
    this.frameCount++;

    // Track FPS (store frame times and calculate every 500ms)
    this.fpsFrameTimes.push(deltaTime * 1000); // Store in milliseconds
    if (this.fpsFrameTimes.length > 60) {
      this.fpsFrameTimes.shift();
    }

    // Update FPS every 500ms
    if (currentTime - this.lastFPSUpdate >= 500) {
      if (this.fpsFrameTimes.length > 0) {
        const avgDelta =
          this.fpsFrameTimes.reduce((a, b) => a + b, 0) /
          this.fpsFrameTimes.length;
        this.currentFPS = Math.round(1000 / avgDelta);
      }
      this.lastFPSUpdate = currentTime;
    }

    // Run update systems
    this.scheduler.executeSystems('earlyUpdate', { commands });
    this.scheduler.executeSystems('update', { commands });
    this.scheduler.executeSystems('lateUpdate', { commands });

    // Fixed update with accumulator
    this.accumulator += deltaTime;
    while (this.accumulator >= this.fixedDeltaTime) {
      this.scheduler.executeSystems('earlyFixedUpdate', { commands });
      this.scheduler.executeSystems('fixedUpdate', { commands });
      this.scheduler.executeSystems('lateFixedUpdate', { commands });
      this.accumulator -= this.fixedDeltaTime;
    }

    // Flush events at safe point (after updates, before render)
    world.flushEvents();

    // Run render systems
    this.scheduler.executeSystems('earlyRender', { commands });
    this.scheduler.executeSystems('render', { commands });
    this.scheduler.executeSystems('lateRender', { commands });

    // After render
    this.scheduler.executeSystems('afterRender', { commands });

    // Schedule next frame
    requestAnimationFrame(() => this.gameLoop(commands, world));
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Get current target FPS (detected at startup)
   */
  getTargetFPS(): number {
    return this.targetFPS;
  }

  /**
   * Get fixed delta time (1 / target FPS)
   */
  getFixedDeltaTime(): number {
    return this.fixedDeltaTime;
  }

  /**
   * Get fixed FPS (inverse of fixed delta time)
   */
  getFixedFPS(): number {
    return Math.round(1 / this.fixedDeltaTime);
  }

  /**
   * Get current FPS (measured from actual frame times)
   */
  getCurrentFPS(): number {
    return this.currentFPS;
  }

  /**
   * Get current frame count since start
   */
  getFrameCount(): number {
    return this.frameCount;
  }

  /**
   * Get elapsed time in seconds since start
   */
  getElapsedTime(): number {
    if (!this.isRunning) {
      return 0;
    }
    return (performance.now() - this.startTime) / 1000;
  }

  /**
   * Check if runner is active
   */
  get running(): boolean {
    return this.isRunning;
  }
}
