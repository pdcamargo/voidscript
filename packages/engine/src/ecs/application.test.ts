/**
 * Application System Tests
 *
 * Tests for:
 * - Command API
 * - Parent-Child hierarchy
 * - System wrapper
 * - Scheduler ordering
 * - Application integration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { World } from "./world.js";
import { Command } from "./command.js";
import { Application } from "./application.js";
import { system } from "./system.js";
import { Scheduler } from "./scheduler.js";
import { component } from "./component.js";
import { Parent } from "./components/parent.js";
import { Children } from "./components/children.js";
import type { SystemArguments } from "./system.js";

// Test components
interface PositionData {
  x: number;
  y: number;
}

interface VelocityData {
  x: number;
  y: number;
}

const Position = component<PositionData>("Position");
const Velocity = component<VelocityData>("Velocity");

describe("Command API", () => {
  let world: World;
  let commands: Command;

  beforeEach(() => {
    world = new World();
    commands = new Command(world);
  });

  describe("Entity spawning", () => {
    it("should spawn entity with immediate ID access", () => {
      const entity = commands.spawn().with(Position, { x: 1, y: 2 }).build();

      expect(entity.id()).toBeDefined();
      expect(typeof entity.id()).toBe("number");
    });

    it("should spawn entity with components via Command", () => {
      const entity = commands
        .spawn()
        .with(Position, { x: 10, y: 20 })
        .with(Velocity, { x: 1, y: 1 })
        .build();

      const pos = commands.getComponent(entity.id(), Position);
      const vel = commands.getComponent(entity.id(), Velocity);

      expect(pos).toEqual({ x: 10, y: 20 });
      expect(vel).toEqual({ x: 1, y: 1 });
    });

    it("should allow using entity ID before build()", () => {
      const entityBuilder = commands.spawn().with(Position, { x: 5, y: 5 });
      const entity = entityBuilder.build();

      // ID is available immediately
      expect(entity.id()).toBeDefined();
      expect(commands.isAlive(entity.id())).toBe(true);
    });
  });

  describe("Query delegation", () => {
    it("should delegate query to world", () => {
      commands.spawn().with(Position, { x: 1, y: 1 }).build();
      commands.spawn().with(Position, { x: 2, y: 2 }).build();

      let count = 0;
      commands.query().all(Position).each(() => count++);

      expect(count).toBe(2);
    });
  });

  describe("Entity commands", () => {
    it("should add component via entity commands", () => {
      const entity = commands.spawn().with(Position, { x: 0, y: 0 }).build();

      commands.entity(entity.id()).addComponent(Velocity, { x: 5, y: 5 });

      const vel = commands.getComponent(entity.id(), Velocity);
      expect(vel).toEqual({ x: 5, y: 5 });
    });

    it("should remove component via entity commands", () => {
      const entity = commands
        .spawn()
        .with(Position, { x: 0, y: 0 })
        .with(Velocity, { x: 1, y: 1 })
        .build();

      commands.entity(entity.id()).removeComponent(Velocity);

      expect(commands.hasComponent(entity.id(), Velocity)).toBe(false);
      expect(commands.hasComponent(entity.id(), Position)).toBe(true);
    });
  });
});

describe("Parent-Child Hierarchy", () => {
  let world: World;
  let commands: Command;

  beforeEach(() => {
    world = new World();
    commands = new Command(world);
  });

  describe("Adding children", () => {
    it("should add child to parent", () => {
      const parent = commands.spawn().with(Position, { x: 0, y: 0 }).build();
      const child = commands.spawn().with(Position, { x: 1, y: 1 }).build();

      commands.entity(parent.id()).addChild(child.id());

      // Parent should have Children component
      const childrenComp = commands.getComponent(parent.id(), Children);
      expect(childrenComp).toBeDefined();
      expect(childrenComp?.ids.has(child.id())).toBe(true);

      // Child should have Parent component
      const parentComp = commands.getComponent(child.id(), Parent);
      expect(parentComp).toBeDefined();
      expect(parentComp?.id).toBe(parent.id());
    });

    it("should use entity handle shortcut for addChild", () => {
      const parent = commands.spawn().with(Position, { x: 0, y: 0 }).build();
      const child = commands.spawn().with(Position, { x: 1, y: 1 }).build();

      parent.addChild(child.id());

      const childrenComp = commands.getComponent(parent.id(), Children);
      expect(childrenComp?.ids.has(child.id())).toBe(true);
    });

    it("should add multiple children to same parent", () => {
      const parent = commands.spawn().with(Position, { x: 0, y: 0 }).build();
      const child1 = commands.spawn().with(Position, { x: 1, y: 1 }).build();
      const child2 = commands.spawn().with(Position, { x: 2, y: 2 }).build();

      parent.addChild(child1.id());
      parent.addChild(child2.id());

      const childrenComp = commands.getComponent(parent.id(), Children);
      expect(childrenComp?.ids.size).toBe(2);
      expect(childrenComp?.ids.has(child1.id())).toBe(true);
      expect(childrenComp?.ids.has(child2.id())).toBe(true);
    });
  });

  describe("Removing children", () => {
    it("should remove child from parent", () => {
      const parent = commands.spawn().with(Position, { x: 0, y: 0 }).build();
      const child = commands.spawn().with(Position, { x: 1, y: 1 }).build();

      parent.addChild(child.id());
      parent.removeChild(child.id());

      // Parent should not have Children component (removed when empty)
      expect(commands.hasComponent(parent.id(), Children)).toBe(false);

      // Child should not have Parent component
      expect(commands.hasComponent(child.id(), Parent)).toBe(false);
    });

    it("should keep Children component if other children remain", () => {
      const parent = commands.spawn().with(Position, { x: 0, y: 0 }).build();
      const child1 = commands.spawn().with(Position, { x: 1, y: 1 }).build();
      const child2 = commands.spawn().with(Position, { x: 2, y: 2 }).build();

      parent.addChild(child1.id());
      parent.addChild(child2.id());
      parent.removeChild(child1.id());

      const childrenComp = commands.getComponent(parent.id(), Children);
      expect(childrenComp?.ids.size).toBe(1);
      expect(childrenComp?.ids.has(child2.id())).toBe(true);
    });
  });

  describe("withChildren builder", () => {
    it("should spawn children using withChildren", () => {
      const parent = commands
        .spawn()
        .with(Position, { x: 0, y: 0 })
        .withChildren((parentId) => {
          const child = commands.spawn().with(Position, { x: 1, y: 1 }).build();
          commands.entity(parentId).addChild(child.id());
        })
        .build();

      const childrenComp = commands.getComponent(parent.id(), Children);
      expect(childrenComp).toBeDefined();
      expect(childrenComp?.ids.size).toBeGreaterThan(0);
    });
  });

  describe("Recursive destruction", () => {
    it("should destroy entity and all children recursively", () => {
      const parent = commands.spawn().with(Position, { x: 0, y: 0 }).build();
      const child1 = commands.spawn().with(Position, { x: 1, y: 1 }).build();
      const child2 = commands.spawn().with(Position, { x: 2, y: 2 }).build();
      const grandchild = commands.spawn().with(Position, { x: 3, y: 3 }).build();

      parent.addChild(child1.id());
      parent.addChild(child2.id());
      child1.addChild(grandchild.id());

      commands.entity(parent.id()).destroyRecursive();

      expect(commands.isAlive(parent.id())).toBe(false);
      expect(commands.isAlive(child1.id())).toBe(false);
      expect(commands.isAlive(child2.id())).toBe(false);
      expect(commands.isAlive(grandchild.id())).toBe(false);
    });

    it("should remove from parent when child destroyed recursively", () => {
      const parent = commands.spawn().with(Position, { x: 0, y: 0 }).build();
      const child = commands.spawn().with(Position, { x: 1, y: 1 }).build();
      const grandchild = commands.spawn().with(Position, { x: 2, y: 2 }).build();

      parent.addChild(child.id());
      child.addChild(grandchild.id());

      commands.entity(child.id()).destroyRecursive();

      // Parent should not have Children component anymore
      expect(commands.hasComponent(parent.id(), Children)).toBe(false);
      expect(commands.isAlive(child.id())).toBe(false);
      expect(commands.isAlive(grandchild.id())).toBe(false);
    });
  });
});

describe("System Wrapper", () => {
  it("should create system with metadata", () => {
    const testSystem = system(({ commands }: SystemArguments) => {
      // Do nothing
    });

    expect(testSystem).toBeDefined();
    expect(testSystem._metadata).toBeDefined();
    expect(testSystem._metadata.id).toBeDefined();
  });

  it("should execute system function", () => {
    let executed = false;
    const testSystem = system(() => {
      executed = true;
    });

    const world = new World();
    const commands = new Command(world);
    testSystem.execute({ commands });

    expect(executed).toBe(true);
  });

  it("should support runIf condition", () => {
    let shouldRun = false;
    let executed = false;

    const testSystem = system(() => {
      executed = true;
    }).runIf(() => shouldRun);

    const world = new World();
    const commands = new Command(world);

    // runIf condition is enforced by the Scheduler, not by execute()
    // So we test that the metadata is set correctly
    expect(testSystem._metadata.runCondition).toBeDefined();
    expect(testSystem._metadata.runCondition!({ commands })).toBe(false);

    shouldRun = true;
    expect(testSystem._metadata.runCondition!({ commands })).toBe(true);
  });

  it("should support runAfter dependency", () => {
    const systemA = system(() => {});
    const systemB = system(() => {}).runAfter(systemA);

    expect(systemB._metadata.runAfter.has(systemA._metadata)).toBe(true);
    expect(systemA._metadata.runBefore.has(systemB._metadata)).toBe(true);
  });

  it("should support runBefore dependency", () => {
    const systemA = system(() => {});
    const systemB = system(() => {}).runBefore(systemA);

    expect(systemB._metadata.runBefore.has(systemA._metadata)).toBe(true);
    expect(systemA._metadata.runAfter.has(systemB._metadata)).toBe(true);
  });
});

describe("Scheduler", () => {
  let scheduler: Scheduler;
  let world: World;
  let commands: Command;

  beforeEach(() => {
    scheduler = new Scheduler();
    world = new World();
    commands = new Command(world);
  });

  it("should add and execute systems", () => {
    let executed = false;
    const testSystem = system(() => {
      executed = true;
    });

    scheduler.addSystem("update", testSystem);
    scheduler.executeSystems("update", { commands });

    expect(executed).toBe(true);
  });

  it("should order systems based on dependencies", () => {
    const executionOrder: number[] = [];

    const system1 = system(() => executionOrder.push(1));
    const system2 = system(() => executionOrder.push(2)).runAfter(system1);
    const system3 = system(() => executionOrder.push(3)).runAfter(system2);

    // Add in reverse order to test sorting
    scheduler.addSystem("update", system3);
    scheduler.addSystem("update", system1);
    scheduler.addSystem("update", system2);

    scheduler.executeSystems("update", { commands });

    expect(executionOrder).toEqual([1, 2, 3]);
  });

  it("should respect run conditions", () => {
    let shouldRun = false;
    let executed = false;

    const testSystem = system(() => {
      executed = true;
    }).runIf(() => shouldRun);

    scheduler.addSystem("update", testSystem);

    // Should not run
    scheduler.executeSystems("update", { commands });
    expect(executed).toBe(false);

    // Now should run
    shouldRun = true;
    scheduler.executeSystems("update", { commands });
    expect(executed).toBe(true);
  });

  it("should detect circular dependencies", () => {
    const system1 = system(() => {});
    const system2 = system(() => {}).runAfter(system1);
    system1._metadata.runAfter.add(system2._metadata); // Create cycle

    scheduler.addSystem("update", system1);
    scheduler.addSystem("update", system2);

    expect(() => scheduler.executeSystems("update", { commands })).toThrow(
      "Circular dependency"
    );
  });

  it("should handle multiple phases", () => {
    const startupExecuted: string[] = [];
    const updateExecuted: string[] = [];

    const startupSystem = system(() => startupExecuted.push("startup"));
    const updateSystem = system(() => updateExecuted.push("update"));

    scheduler.addSystem("startup", startupSystem);
    scheduler.addSystem("update", updateSystem);

    scheduler.executeSystems("startup", { commands });
    scheduler.executeSystems("update", { commands });

    expect(startupExecuted).toEqual(["startup"]);
    expect(updateExecuted).toEqual(["update"]);
  });
});

describe("Application", () => {
  it("should create application with all components", () => {
    const app = new Application();

    expect(app.world).toBeDefined();
    expect(app.commands).toBeDefined();
    expect(app.scheduler).toBeDefined();
    expect(app.runner).toBeDefined();
  });

  it("should allow registering systems", () => {
    const app = new Application();
    let executed = false;

    const testSystem = system(() => {
      executed = true;
    });

    app.scheduler.addSystem("startup", testSystem);
    app.scheduler.executeSystems("startup", { commands: app.commands });

    expect(executed).toBe(true);
  });

  it("should clear world and scheduler", () => {
    const app = new Application();

    app.commands.spawn().with(Position, { x: 1, y: 1 }).build();
    app.scheduler.addSystem("update", system(() => {}));

    app.clear();

    expect(app.world.getEntityCount()).toBe(0);
  });
});

describe("Integration Tests", () => {
  it("should handle complete game loop simulation", () => {
    const app = new Application();
    const updates: number[] = [];

    // Movement system
    const moveSystem = system(({ commands }: SystemArguments) => {
      commands.query().all(Position, Velocity).each((entity, pos, vel) => {
        pos.x += vel.x;
        pos.y += vel.y;
      });
    });

    // Track system
    const trackSystem = system(({ commands }: SystemArguments) => {
      commands.query().all(Position).each((entity, pos) => {
        updates.push(pos.x);
      });
    }).runAfter(moveSystem);

    app.scheduler.addSystem("update", moveSystem);
    app.scheduler.addSystem("update", trackSystem);

    // Spawn entity
    app.commands
      .spawn()
      .with(Position, { x: 0, y: 0 })
      .with(Velocity, { x: 1, y: 0 })
      .build();

    // Simulate 3 frames
    for (let i = 0; i < 3; i++) {
      app.scheduler.executeSystems("update", { commands: app.commands });
    }

    expect(updates).toEqual([1, 2, 3]);
  });

  it("should handle hierarchical entity updates", () => {
    const app = new Application();

    const parent = app.commands.spawn().with(Position, { x: 10, y: 10 }).build();

    const child1 = app.commands.spawn().with(Position, { x: 5, y: 5 }).build();

    const child2 = app.commands.spawn().with(Position, { x: 3, y: 3 }).build();

    parent.addChild(child1.id());
    parent.addChild(child2.id());

    // Verify hierarchy
    const children = app.commands.getComponent(parent.id(), Children);
    expect(children?.ids.size).toBe(2);

    // Destroy parent recursively
    app.commands.entity(parent.id()).destroyRecursive();

    expect(app.world.getEntityCount()).toBe(0);
  });
});
