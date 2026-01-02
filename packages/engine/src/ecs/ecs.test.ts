/**
 * ECS System Tests
 *
 * Comprehensive tests for Entity Component System including:
 * - Entity lifecycle (spawn, destroy, recycle)
 * - Component operations (add, remove, get, has)
 * - Archetype transitions
 * - Query correctness (All/None/Any/Exclusive)
 * - Loop safety (deferred operations)
 * - Entity validity (generation checks)
 * - Performance benchmarks
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Scene } from "./scene.js";
import { component } from "./component.js";
import { entityId, entityGeneration } from "./entity.js";

// Define test components
interface PositionData {
  x: number;
  y: number;
}

interface VelocityData {
  x: number;
  y: number;
}

interface HealthData {
  current: number;
  max: number;
}

interface PickaxeData {
  durability: number;
}

interface ElfData {
  name: string;
}

interface SwordData {
  damage: number;
}

interface AxeData {
  damage: number;
}

interface BowData {
  damage: number;
  range: number;
}

interface DwarfData {
  name: string;
}

interface NewTypeData {
  value: number;
}

// Component types
const Position = component<PositionData>("Position");
const Velocity = component<VelocityData>("Velocity");
const Health = component<HealthData>("Health");
const Pickaxe = component<PickaxeData>("Pickaxe");
const Elf = component<ElfData>("Elf");
const Sword = component<SwordData>("Sword");
const Axe = component<AxeData>("Axe");
const Bow = component<BowData>("Bow");
const Dwarf = component<DwarfData>("Dwarf");
const NewType = component<NewTypeData>("NewType");

describe("ECS System", () => {
  let world: Scene;

  beforeEach(() => {
    world = new Scene();
  });

  describe("Entity Lifecycle", () => {
    it("should spawn entities with unique IDs", () => {
      const e1 = world.spawn().build();
      const e2 = world.spawn().build();
      const e3 = world.spawn().build();

      expect(e1).toBeDefined();
      expect(e2).toBeDefined();
      expect(e3).toBeDefined();
      expect(e1).not.toBe(e2);
      expect(e2).not.toBe(e3);
      expect(e1).not.toBe(e3);
    });

    it("should spawn entities with components", () => {
      const entity = world
        .spawn()
        .with(Position, { x: 10, y: 20 })
        .with(Velocity, { x: 1, y: 2 })
        .build();

      expect(entity).toBeDefined();
      expect(world.hasComponent(entity!, Position)).toBe(true);
      expect(world.hasComponent(entity!, Velocity)).toBe(true);

      const pos = world.getComponent(entity!, Position);
      const vel = world.getComponent(entity!, Velocity);

      expect(pos).toEqual({ x: 10, y: 20 });
      expect(vel).toEqual({ x: 1, y: 2 });
    });

    it("should destroy entities", () => {
      const entity = world.spawn().with(Position, { x: 0, y: 0 }).build();

      expect(world.isAlive(entity!)).toBe(true);

      world.destroy(entity!);

      expect(world.isAlive(entity!)).toBe(false);
    });

    it("should recycle entity IDs with generation counter", () => {
      const e1 = world.spawn().build();
      const id1 = entityId(e1!);
      const gen1 = entityGeneration(e1!);

      world.destroy(e1!);

      const e2 = world.spawn().build();
      const id2 = entityId(e2!);
      const gen2 = entityGeneration(e2!);

      // Should reuse same ID but increment generation
      expect(id2).toBe(id1);
      expect(gen2).toBe(gen1 + 1);

      // Old handle should be invalid
      expect(world.isAlive(e1!)).toBe(false);
      expect(world.isAlive(e2!)).toBe(true);
    });

    it("should track entity count", () => {
      expect(world.getEntityCount()).toBe(0);

      const e1 = world.spawn().build();
      expect(world.getEntityCount()).toBe(1);

      const e2 = world.spawn().build();
      expect(world.getEntityCount()).toBe(2);

      world.destroy(e1!);
      expect(world.getEntityCount()).toBe(1);

      world.destroy(e2!);
      expect(world.getEntityCount()).toBe(0);
    });
  });

  describe("Component Operations", () => {
    it("should add components to entities", () => {
      const entity = world.spawn().build();

      world.addComponent(entity!, Position, { x: 5, y: 10 });

      expect(world.hasComponent(entity!, Position)).toBe(true);
      expect(world.getComponent(entity!, Position)).toEqual({ x: 5, y: 10 });
    });

    it("should remove components from entities", () => {
      const entity = world
        .spawn()
        .with(Position, { x: 0, y: 0 })
        .with(Velocity, { x: 1, y: 1 })
        .build();

      expect(world.hasComponent(entity!, Position)).toBe(true);
      expect(world.hasComponent(entity!, Velocity)).toBe(true);

      world.removeComponent(entity!, Position);

      expect(world.hasComponent(entity!, Position)).toBe(false);
      expect(world.hasComponent(entity!, Velocity)).toBe(true);
    });

    it("should update existing component data", () => {
      const entity = world.spawn().with(Position, { x: 0, y: 0 }).build();

      const pos = world.getComponent(entity!, Position);
      expect(pos).toEqual({ x: 0, y: 0 });

      // Modify component directly
      pos!.x = 100;
      pos!.y = 200;

      // Should reflect changes
      const updated = world.getComponent(entity!, Position);
      expect(updated).toEqual({ x: 100, y: 200 });
    });

    it("should handle adding duplicate component (overwrite)", () => {
      const entity = world.spawn().with(Position, { x: 0, y: 0 }).build();

      world.addComponent(entity!, Position, { x: 10, y: 20 });

      const pos = world.getComponent(entity!, Position);
      expect(pos).toEqual({ x: 10, y: 20 });
    });
  });

  describe("Archetype Transitions", () => {
    it("should move entity to new archetype when adding component", () => {
      const entity = world.spawn().with(Position, { x: 0, y: 0 }).build();

      // Entity should be in [Position] archetype

      world.addComponent(entity!, Velocity, { x: 1, y: 1 });

      // Entity should now be in [Position, Velocity] archetype
      expect(world.hasComponent(entity!, Position)).toBe(true);
      expect(world.hasComponent(entity!, Velocity)).toBe(true);
    });

    it("should move entity to new archetype when removing component", () => {
      const entity = world
        .spawn()
        .with(Position, { x: 0, y: 0 })
        .with(Velocity, { x: 1, y: 1 })
        .build();

      // Entity should be in [Position, Velocity] archetype

      world.removeComponent(entity!, Velocity);

      // Entity should now be in [Position] archetype
      expect(world.hasComponent(entity!, Position)).toBe(true);
      expect(world.hasComponent(entity!, Velocity)).toBe(false);
    });

    it("should preserve component data during archetype transition", () => {
      const entity = world.spawn().with(Position, { x: 10, y: 20 }).build();

      world.addComponent(entity!, Velocity, { x: 1, y: 2 });

      // Position data should be preserved
      const pos = world.getComponent(entity!, Position);
      expect(pos).toEqual({ x: 10, y: 20 });

      // Velocity data should exist
      const vel = world.getComponent(entity!, Velocity);
      expect(vel).toEqual({ x: 1, y: 2 });
    });
  });

  describe("Query System - All", () => {
    it("should match entities WITH all specified components", () => {
      const e1 = world
        .spawn()
        .with(Position, { x: 0, y: 0 })
        .with(Velocity, { x: 1, y: 1 })
        .build();

      const e2 = world
        .spawn()
        .with(Position, { x: 10, y: 10 })
        .with(Velocity, { x: 2, y: 2 })
        .build();

      const e3 = world.spawn().with(Position, { x: 20, y: 20 }).build();

      const matched: number[] = [];
      world
        .query()
        .all(Position, Velocity)
        .each((entity, pos, vel) => {
          matched.push(entity);
          expect(pos).toBeDefined();
          expect(vel).toBeDefined();
        });

      expect(matched).toHaveLength(2);
      expect(matched).toContain(e1!);
      expect(matched).toContain(e2!);
      expect(matched).not.toContain(e3!);
    });

    it("should provide type-safe component access in query callback", () => {
      world
        .spawn()
        .with(Position, { x: 5, y: 10 })
        .with(Velocity, { x: 1, y: 0 })
        .build();

      world
        .query()
        .all(Position, Velocity)
        .each((entity, pos, vel) => {
          // TypeScript should infer pos and vel types
          pos.x += vel.x;
          pos.y += vel.y;

          expect(pos.x).toBe(6);
          expect(pos.y).toBe(10);
        });
    });
  });

  describe("Query System - None", () => {
    it("should exclude entities with specified components", () => {
      const e1 = world.spawn().with(Pickaxe, { durability: 100 }).build();

      const e2 = world
        .spawn()
        .with(Pickaxe, { durability: 50 })
        .with(Elf, { name: "Elvesto" })
        .build();

      const e3 = world.spawn().with(Pickaxe, { durability: 75 }).build();

      const matched: number[] = [];
      world
        .query()
        .all(Pickaxe)
        .none(Elf)
        .each((entity, pickaxe) => {
          matched.push(entity);
          expect(pickaxe).toBeDefined();
        });

      expect(matched).toHaveLength(2);
      expect(matched).toContain(e1!);
      expect(matched).not.toContain(e2!); // Has Elf, should be excluded
      expect(matched).toContain(e3!);
    });
  });

  describe("Query System - Any", () => {
    it("should match entities with ANY of specified components", () => {
      const e1 = world.spawn().with(Sword, { damage: 10 }).build();
      const e2 = world.spawn().with(Axe, { damage: 15 }).build();
      const e3 = world.spawn().with(Bow, { damage: 8, range: 100 }).build();
      const e4 = world.spawn().with(Health, { current: 100, max: 100 }).build();

      const matched: number[] = [];
      world
        .query()
        .any(Sword, Axe, Bow)
        .each((entity) => {
          matched.push(entity);
        });

      expect(matched).toHaveLength(3);
      expect(matched).toContain(e1!);
      expect(matched).toContain(e2!);
      expect(matched).toContain(e3!);
      expect(matched).not.toContain(e4!);
    });

    it("should match entities with multiple components from any filter", () => {
      const entity = world
        .spawn()
        .with(Sword, { damage: 10 })
        .with(Axe, { damage: 15 })
        .build();

      const matched: number[] = [];
      world
        .query()
        .any(Sword, Axe, Bow)
        .each((entity) => {
          matched.push(entity);
        });

      expect(matched).toHaveLength(1);
      expect(matched).toContain(entity!);
    });
  });

  describe("Query System - Exclusive", () => {
    it("should match entities with EXACTLY specified components", () => {
      const e1 = world
        .spawn()
        .with(Dwarf, { name: "Gimli" })
        .with(NewType, { value: 42 })
        .build();

      const e2 = world
        .spawn()
        .with(Dwarf, { name: "Thorin" })
        .with(NewType, { value: 100 })
        .with(Pickaxe, { durability: 50 }) // Has extra component
        .build();

      const e3 = world
        .spawn()
        .with(Dwarf, { name: "Balin" })
        .with(NewType, { value: 200 })
        .build();

      const matched: number[] = [];
      world
        .query()
        .exclusive(Dwarf, NewType)
        .each((entity, dwarf, newType) => {
          matched.push(entity);
          expect(dwarf).toBeDefined();
          expect(newType).toBeDefined();
        });

      expect(matched).toHaveLength(2);
      expect(matched).toContain(e1!);
      expect(matched).not.toContain(e2!); // Has extra Pickaxe component
      expect(matched).toContain(e3!);
    });
  });

  describe("Query System - Combined Filters", () => {
    it("should combine All and None filters", () => {
      const e1 = world
        .spawn()
        .with(Position, { x: 0, y: 0 })
        .with(Velocity, { x: 1, y: 1 })
        .build();

      const e2 = world
        .spawn()
        .with(Position, { x: 10, y: 10 })
        .with(Velocity, { x: 2, y: 2 })
        .with(Health, { current: 100, max: 100 })
        .build();

      const matched: number[] = [];
      world
        .query()
        .all(Position, Velocity)
        .none(Health)
        .each((entity) => {
          matched.push(entity);
        });

      expect(matched).toHaveLength(1);
      expect(matched).toContain(e1!);
      expect(matched).not.toContain(e2!);
    });
  });

  describe("Loop Safety", () => {
    it("should defer entity spawning during iteration", () => {
      world.spawn().with(Position, { x: 0, y: 0 }).build();
      world.spawn().with(Position, { x: 1, y: 1 }).build();

      let iterations = 0;
      world
        .query()
        .all(Position)
        .each(() => {
          iterations++;
          // Spawn new entity during iteration
          world.spawn().with(Position, { x: 100, y: 100 }).build();
        });

      // Should only iterate over original 2 entities
      expect(iterations).toBe(2);

      // New entities should be spawned after iteration
      expect(world.getEntityCount()).toBe(4);
    });

    it("should defer entity destruction during iteration", () => {
      const e1 = world.spawn().with(Position, { x: 0, y: 0 }).build();
      const e2 = world.spawn().with(Position, { x: 1, y: 1 }).build();

      let iterations = 0;
      world
        .query()
        .all(Position)
        .each((entity) => {
          iterations++;
          // Destroy entity during iteration
          world.destroy(entity);
        });

      expect(iterations).toBe(2);

      // Entities should be destroyed after iteration
      expect(world.isAlive(e1!)).toBe(false);
      expect(world.isAlive(e2!)).toBe(false);
      expect(world.getEntityCount()).toBe(0);
    });

    it("should defer component addition during iteration", () => {
      const e1 = world.spawn().with(Position, { x: 0, y: 0 }).build();
      const e2 = world.spawn().with(Position, { x: 1, y: 1 }).build();

      world
        .query()
        .all(Position)
        .each((entity) => {
          // Add component during iteration
          world.addComponent(entity, Velocity, { x: 1, y: 0 });
        });

      // Components should be added after iteration
      expect(world.hasComponent(e1!, Velocity)).toBe(true);
      expect(world.hasComponent(e2!, Velocity)).toBe(true);
    });
  });

  describe("Entity Validity", () => {
    it("should skip destroyed entities during iteration", () => {
      const e1 = world.spawn().with(Position, { x: 0, y: 0 }).build();
      const e2 = world.spawn().with(Position, { x: 1, y: 1 }).build();

      world.destroy(e1!);

      const matched: number[] = [];
      world
        .query()
        .all(Position)
        .each((entity) => {
          matched.push(entity);
        });

      expect(matched).toHaveLength(1);
      expect(matched).toContain(e2!);
    });

    it("should not return components for destroyed entities", () => {
      const entity = world.spawn().with(Position, { x: 0, y: 0 }).build();

      world.destroy(entity!);

      const pos = world.getComponent(entity!, Position);
      expect(pos).toBeUndefined();
    });
  });

  describe("Query Helper Methods", () => {
    it("should count matching entities", () => {
      world.spawn().with(Position, { x: 0, y: 0 }).build();
      world.spawn().with(Position, { x: 1, y: 1 }).build();
      world.spawn().with(Position, { x: 2, y: 2 }).build();

      const count = world.query().all(Position).count();

      expect(count).toBe(3);
    });

    it("should check if query is empty", () => {
      const isEmpty1 = world.query().all(Position).isEmpty();
      expect(isEmpty1).toBe(true);

      world.spawn().with(Position, { x: 0, y: 0 }).build();

      const isEmpty2 = world.query().all(Position).isEmpty();
      expect(isEmpty2).toBe(false);
    });

    it("should get first matching entity", () => {
      world.spawn().with(Position, { x: 0, y: 0 }).build();
      world.spawn().with(Position, { x: 1, y: 1 }).build();

      const result = world.query().all(Position).first();

      expect(result).toBeDefined();
      expect(result!.entity).toBeDefined();
      expect(result!.components).toHaveLength(1);
    });

    it("should collect all matching entities", () => {
      const e1 = world.spawn().with(Position, { x: 0, y: 0 }).build();
      const e2 = world.spawn().with(Position, { x: 1, y: 1 }).build();

      const entities = world.query().all(Position).entities();

      expect(entities).toHaveLength(2);
      expect(entities).toContain(e1!);
      expect(entities).toContain(e2!);
    });
  });

  describe("Performance Benchmarks", () => {
    it("should handle a lot of entities efficiently", () => {
      const startSpawn = performance.now();
      const amount = 1_000_000;
      const operations = 100;

      // Spawn entities
      for (let i = 0; i < amount; i++) {
        world
          .spawn()
          .with(Position, { x: i, y: i * 2 })
          .with(Velocity, { x: Math.random(), y: Math.random() })
          .with(Health, { current: 100, max: 100 })
          .build();
      }

      const spawnTime = performance.now() - startSpawn;
      console.log(`Spawn ${amount} entities: ${spawnTime.toFixed(2)}ms`);

      expect(world.getEntityCount()).toBe(amount);

      // Iterate operations times
      const startIterate = performance.now();
      for (let i = 0; i < operations; i++) {
        world
          .query()
          .all(Position, Velocity)
          .each((entity, pos, vel) => {
            pos.x += vel.x;
            pos.y += vel.y;
          });
      }
      const iterateTime = performance.now() - startIterate;
      console.log(
        `Iterate ${amount} entities ${operations}x: ${iterateTime.toFixed(2)}ms`
      );
      console.log(
        `Average per frame: ${(iterateTime / operations).toFixed(2)}ms`
      );

      // Should be well under 16ms per frame (60fps)
      expect(iterateTime / operations).toBeLessThan(16.6);
    });

    it("should handle component add/remove efficiently", () => {
      // Spawn entities
      const entities: number[] = [];
      for (let i = 0; i < 1000; i++) {
        const e = world.spawn().with(Position, { x: i, y: i }).build();
        entities.push(e!);
      }

      const start = performance.now();

      // Add component to all
      for (const entity of entities) {
        world.addComponent(entity, Velocity, { x: 1, y: 1 });
      }

      // Remove component from all
      for (const entity of entities) {
        world.removeComponent(entity, Velocity);
      }

      const time = performance.now() - start;
      console.log(`Add/remove component 1000 entities: ${time.toFixed(2)}ms`);

      // Should be fast
      expect(time).toBeLessThan(100);
    });

    it("should handle spawn/destroy efficiently", () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        const entity = world.spawn().with(Position, { x: i, y: i }).build();
        world.destroy(entity!);
      }

      const time = performance.now() - start;
      console.log(`Spawn/destroy 1000 entities: ${time.toFixed(2)}ms`);

      expect(time).toBeLessThan(50);
      expect(world.getEntityCount()).toBe(0);
    });

    it("should cache query results efficiently", () => {
      // Spawn entities
      for (let i = 0; i < 1000; i++) {
        world
          .spawn()
          .with(Position, { x: i, y: i })
          .with(Velocity, { x: 1, y: 1 })
          .build();
      }

      // First query (cache miss)
      const start1 = performance.now();
      let count1 = 0;
      world
        .query()
        .all(Position, Velocity)
        .each(() => {
          count1++;
        });
      const time1 = performance.now() - start1;

      // Second query (cache hit)
      const start2 = performance.now();
      let count2 = 0;
      world
        .query()
        .all(Position, Velocity)
        .each(() => {
          count2++;
        });
      const time2 = performance.now() - start2;

      console.log(`Query (cache miss): ${time1.toFixed(2)}ms`);
      console.log(`Query (cache hit): ${time2.toFixed(2)}ms`);

      expect(count1).toBe(1000);
      expect(count2).toBe(1000);

      // Cache hit should be at least as fast (may be similar due to iteration cost)
      expect(time2).toBeLessThanOrEqual(time1 * 1.1);
    });
  });
});
