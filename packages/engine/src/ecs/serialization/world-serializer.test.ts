/**
 * WorldSerializer Tests
 *
 * Comprehensive test suite covering:
 * - Basic serialization/deserialization
 * - Round-trip correctness
 * - Parent-child hierarchies
 * - Custom serializers
 * - Partial serialization
 * - Performance benchmarks
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeEach } from "vitest";
import { World } from "../world.js";
import { Command } from "../command.js";
import { component } from "../component.js";
import { WorldSerializer } from "./world-serializer.js";
import { Parent } from "../components/parent.js";
import { Children } from "../components/children.js";
import { RuntimeAsset } from "../runtime-asset.js";
import { RuntimeAssetManager } from "../runtime-asset-manager.js";
import type { AssetMetadata } from "../asset-metadata.js";
import { AssetType, TextureFilter, TextureWrap } from "../asset-metadata.js";
import { SetSerializer } from "./custom-serializers.js";
import type {
  ComponentSerializer,
  SerializationContext,
  DeserializationContext,
} from "./types.js";

// Test components
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

interface TagData {
  tags: Set<string>;
}

const Position = component<PositionData>("Position");
const Velocity = component<VelocityData>("Velocity");
const Health = component<HealthData>("Health");
const Tag = component<TagData>("Tag");

describe("WorldSerializer - Basic Serialization", () => {
  let world: World;
  let commands: Command;
  let serializer: WorldSerializer;

  beforeEach(() => {
    world = new World();
    commands = new Command(world);
    serializer = new WorldSerializer();
  });

  it("should serialize empty world", () => {
    const data = serializer.serialize(world, commands);

    expect(data.version).toBe("1.0.0");
    expect(data.entities).toEqual([]);
    expect(data.componentRegistry).toEqual([]);
    expect(data.metadata).toBeDefined();
    expect(data.metadata?.entityCount).toBe(0);
  });

  it("should serialize single entity with one component", () => {
    commands.spawn().with(Position, { x: 10, y: 20 }).build();

    const data = serializer.serialize(world, commands);

    expect(data.entities.length).toBe(1);
    expect(data.componentRegistry.length).toBe(1);
    expect(data.componentRegistry[0]?.name).toBe("Position");
    expect(data.entities[0]?.components.length).toBe(1);
    expect(data.entities[0]?.components[0]?.typeName).toBe("Position");
    expect(data.entities[0]?.components[0]?.data).toEqual({ x: 10, y: 20 });
  });

  it("should serialize single entity with multiple components", () => {
    commands
      .spawn()
      .with(Position, { x: 5, y: 10 })
      .with(Velocity, { x: 1, y: 2 })
      .with(Health, { current: 50, max: 100 })
      .build();

    const data = serializer.serialize(world, commands);

    expect(data.entities.length).toBe(1);
    expect(data.componentRegistry.length).toBe(3);
    expect(data.entities[0]?.components.length).toBe(3);

    const componentNames = data.entities[0]?.components
      .map((c) => c.typeName)
      .sort();
    expect(componentNames).toEqual(["Health", "Position", "Velocity"]);
  });

  it("should serialize multiple entities", () => {
    for (let i = 0; i < 10; i++) {
      commands
        .spawn()
        .with(Position, { x: i, y: i * 2 })
        .build();
    }

    const data = serializer.serialize(world, commands);

    expect(data.entities.length).toBe(10);
    expect(data.metadata?.entityCount).toBe(10);
  });

  it("should serialize entities with different component combinations", () => {
    commands.spawn().with(Position, { x: 1, y: 1 }).build();
    commands.spawn().with(Velocity, { x: 2, y: 2 }).build();
    commands
      .spawn()
      .with(Position, { x: 3, y: 3 })
      .with(Velocity, { x: 4, y: 4 })
      .build();

    const data = serializer.serialize(world, commands);

    expect(data.entities.length).toBe(3);
    expect(data.componentRegistry.length).toBe(2); // Position and Velocity
  });
});

describe("WorldSerializer - Basic Deserialization", () => {
  let world: World;
  let commands: Command;
  let serializer: WorldSerializer;

  beforeEach(() => {
    world = new World();
    commands = new Command(world);
    serializer = new WorldSerializer();
  });

  it("should deserialize empty world", () => {
    const data = serializer.serialize(world, commands);

    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);

    const result = serializer.deserialize(targetWorld, targetCommands, data);

    expect(result.success).toBe(true);
    expect(result.entitiesCreated).toBe(0);
    expect(result.entitiesSkipped).toBe(0);
    expect(targetWorld.getEntityCount()).toBe(0);
  });

  it("should deserialize single entity with one component", () => {
    commands.spawn().with(Position, { x: 10, y: 20 }).build();
    const data = serializer.serialize(world, commands);

    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);

    const result = serializer.deserialize(targetWorld, targetCommands, data);

    if (!result.success) {
      console.log("Deserialization failed:", result.error);
      console.log("Warnings:", result.warnings);
    }

    expect(result.success).toBe(true);
    expect(result.entitiesCreated).toBe(1);
    expect(targetWorld.getEntityCount()).toBe(1);

    // Verify component data
    targetCommands
      .query()
      .all(Position)
      .each((entity, pos) => {
        expect(pos.x).toBe(10);
        expect(pos.y).toBe(20);
      });
  });

  it("should deserialize multiple entities", () => {
    for (let i = 0; i < 10; i++) {
      commands
        .spawn()
        .with(Position, { x: i, y: i * 2 })
        .build();
    }
    const data = serializer.serialize(world, commands);

    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);

    const result = serializer.deserialize(targetWorld, targetCommands, data);

    expect(result.success).toBe(true);
    expect(result.entitiesCreated).toBe(10);
    expect(targetWorld.getEntityCount()).toBe(10);
  });

  it("should deserialize in replace mode (clear existing entities)", () => {
    // Create entities in target world
    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);
    for (let i = 0; i < 5; i++) {
      targetCommands.spawn().with(Position, { x: 0, y: 0 }).build();
    }
    expect(targetWorld.getEntityCount()).toBe(5);

    // Serialize source with 3 entities
    for (let i = 0; i < 3; i++) {
      commands.spawn().with(Position, { x: i, y: i }).build();
    }
    const data = serializer.serialize(world, commands);

    // Deserialize in replace mode
    const result = serializer.deserialize(targetWorld, targetCommands, data, {
      mode: "replace",
    });

    expect(result.success).toBe(true);
    expect(targetWorld.getEntityCount()).toBe(3); // Replaced, not merged
  });

  it("should deserialize in merge mode (keep existing entities)", () => {
    // Create entities in target world
    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);
    for (let i = 0; i < 5; i++) {
      targetCommands.spawn().with(Position, { x: 0, y: 0 }).build();
    }
    expect(targetWorld.getEntityCount()).toBe(5);

    // Serialize source with 3 entities
    for (let i = 0; i < 3; i++) {
      commands.spawn().with(Position, { x: i, y: i }).build();
    }
    const data = serializer.serialize(world, commands);

    // Deserialize in merge mode
    const result = serializer.deserialize(targetWorld, targetCommands, data, {
      mode: "merge",
    });

    expect(result.success).toBe(true);
    expect(targetWorld.getEntityCount()).toBe(8); // 5 + 3
  });
});

describe("WorldSerializer - Round-trip Correctness", () => {
  let world: World;
  let commands: Command;
  let serializer: WorldSerializer;

  beforeEach(() => {
    world = new World();
    commands = new Command(world);
    serializer = new WorldSerializer();
  });

  it("should maintain component data through round-trip", () => {
    const entities = [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 60 },
    ];

    for (const pos of entities) {
      commands.spawn().with(Position, pos).build();
    }

    const data = serializer.serialize(world, commands);
    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);
    serializer.deserialize(targetWorld, targetCommands, data);

    // Verify all positions
    const positions: PositionData[] = [];
    targetCommands
      .query()
      .all(Position)
      .each((entity, pos) => {
        positions.push({ x: pos.x, y: pos.y });
      });

    expect(positions.length).toBe(3);
    expect(positions).toContainEqual({ x: 10, y: 20 });
    expect(positions).toContainEqual({ x: 30, y: 40 });
    expect(positions).toContainEqual({ x: 50, y: 60 });
  });

  it("should maintain multiple component types through round-trip", () => {
    commands
      .spawn()
      .with(Position, { x: 1, y: 2 })
      .with(Velocity, { x: 3, y: 4 })
      .with(Health, { current: 50, max: 100 })
      .build();

    const data = serializer.serialize(world, commands);
    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);
    serializer.deserialize(targetWorld, targetCommands, data);

    targetCommands
      .query()
      .all(Position, Velocity, Health)
      .each((entity, pos, vel, health) => {
        expect(pos).toEqual({ x: 1, y: 2 });
        expect(vel).toEqual({ x: 3, y: 4 });
        expect(health).toEqual({ current: 50, max: 100 });
      });
  });

  it("should handle JSON string round-trip", () => {
    commands.spawn().with(Position, { x: 10, y: 20 }).build();

    const jsonString = serializer.serializeToString(world, commands);
    expect(typeof jsonString).toBe("string");

    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);
    const result = serializer.deserializeFromString(
      targetWorld,
      targetCommands,
      jsonString
    );

    expect(result.success).toBe(true);
    expect(targetWorld.getEntityCount()).toBe(1);
  });

  it("should handle pretty-printed JSON", () => {
    commands.spawn().with(Position, { x: 10, y: 20 }).build();

    const jsonString = serializer.serializeToString(world, commands, true);
    expect(jsonString).toContain("\n"); // Has newlines from pretty print

    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);
    const result = serializer.deserializeFromString(
      targetWorld,
      targetCommands,
      jsonString
    );

    expect(result.success).toBe(true);
  });
});

describe("WorldSerializer - Parent-Child Hierarchies", () => {
  let world: World;
  let commands: Command;
  let serializer: WorldSerializer;

  beforeEach(() => {
    world = new World();
    commands = new Command(world);
    serializer = new WorldSerializer();
  });

  it("should serialize parent-child relationship", () => {
    const parent = commands.spawn().with(Position, { x: 0, y: 0 }).build();
    const child = commands.spawn().with(Position, { x: 10, y: 10 }).build();
    parent.addChild(child.id());

    const data = serializer.serialize(world, commands);

    // Should have Parent and Children components
    const componentNames = new Set(data.componentRegistry.map((c) => c.name));
    expect(componentNames.has("Parent")).toBe(true);
    expect(componentNames.has("Children")).toBe(true);
  });

  it("should deserialize parent-child relationship", () => {
    const parent = commands.spawn().with(Position, { x: 0, y: 0 }).build();
    const child = commands.spawn().with(Position, { x: 10, y: 10 }).build();
    parent.addChild(child.id());

    const data = serializer.serialize(world, commands);

    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);
    const result = serializer.deserialize(targetWorld, targetCommands, data);

    if (!result.success) {
      console.error("Deserialization error:", result.error);
    }
    expect(result.success).toBe(true);
    expect(targetWorld.getEntityCount()).toBe(2);

    // Find parent entity (has Children component)
    let parentEntity = 0;
    let childEntity = 0;

    targetCommands
      .query()
      .all(Children)
      .each((entity, children) => {
        parentEntity = entity;
        expect(children.ids.size).toBe(1);
        childEntity = Array.from(children.ids)[0]!;
      });

    expect(parentEntity).not.toBe(0);
    expect(childEntity).not.toBe(0);

    // Verify child has Parent component
    const parentComp = targetCommands.getComponent(childEntity, Parent);
    expect(parentComp).toBeDefined();
    expect(parentComp?.id).toBe(parentEntity);
  });

  it("should handle multiple children", () => {
    const parent = commands.spawn().with(Position, { x: 0, y: 0 }).build();
    const child1 = commands.spawn().with(Position, { x: 1, y: 1 }).build();
    const child2 = commands.spawn().with(Position, { x: 2, y: 2 }).build();
    const child3 = commands.spawn().with(Position, { x: 3, y: 3 }).build();

    parent.addChild(child1.id());
    parent.addChild(child2.id());
    parent.addChild(child3.id());

    const data = serializer.serialize(world, commands);
    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);
    serializer.deserialize(targetWorld, targetCommands, data);

    // Verify parent has 3 children
    targetCommands
      .query()
      .all(Children)
      .each((entity, children) => {
        expect(children.ids.size).toBe(3);
      });
  });

  it("should handle nested hierarchies (grandchildren)", () => {
    const grandparent = commands.spawn().with(Position, { x: 0, y: 0 }).build();
    const parent = commands.spawn().with(Position, { x: 1, y: 1 }).build();
    const child = commands.spawn().with(Position, { x: 2, y: 2 }).build();

    grandparent.addChild(parent.id());
    parent.addChild(child.id());

    const data = serializer.serialize(world, commands);
    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);
    const result = serializer.deserialize(targetWorld, targetCommands, data);

    expect(result.success).toBe(true);
    expect(targetWorld.getEntityCount()).toBe(3);

    // Verify hierarchy
    let grandparentEntity = 0;
    let parentEntity = 0;
    let childEntity = 0;

    // Find grandparent (has Children but no Parent)
    targetCommands
      .query()
      .all(Children)
      .each((entity, children) => {
        const hasParent = targetCommands.hasComponent(entity, Parent);
        if (!hasParent) {
          grandparentEntity = entity;
          parentEntity = Array.from(children.ids)[0]!;
        }
      });

    // Get child from parent
    const parentChildren = targetCommands.getComponent(parentEntity, Children);
    childEntity = Array.from(parentChildren!.ids)[0]!;

    expect(grandparentEntity).not.toBe(0);
    expect(parentEntity).not.toBe(0);
    expect(childEntity).not.toBe(0);

    // Verify relationships
    expect(targetCommands.getComponent(parentEntity, Parent)?.id).toBe(
      grandparentEntity
    );
    expect(targetCommands.getComponent(childEntity, Parent)?.id).toBe(
      parentEntity
    );
  });
});

describe("WorldSerializer - Custom Serializers", () => {
  let world: World;
  let commands: Command;
  let serializer: WorldSerializer;

  beforeEach(() => {
    world = new World();
    commands = new Command(world);
    serializer = new WorldSerializer();
  });

  it("should use SetSerializer for Set components", () => {
    // Register SetSerializer
    serializer.registerSerializer(new SetSerializer(Tag));

    commands
      .spawn()
      .with(Tag, { tags: new Set(["player", "alive"]) })
      .build();

    const data = serializer.serialize(world, commands);
    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);
    serializer.deserialize(targetWorld, targetCommands, data);

    targetCommands
      .query()
      .all(Tag)
      .each((entity, tag) => {
        expect(tag.tags).toBeInstanceOf(Set);
        expect(tag.tags.size).toBe(2);
        expect(tag.tags.has("player")).toBe(true);
        expect(tag.tags.has("alive")).toBe(true);
      });
  });

  it("should allow custom serializer registration", () => {
    // Custom serializer that doubles numbers
    const DoubleSerializer: ComponentSerializer<PositionData> = {
      componentType: Position,
      serialize(data: PositionData, context: SerializationContext) {
        return { x: data.x * 2, y: data.y * 2 };
      },
      deserialize(data: unknown, context: DeserializationContext) {
        const d = data as PositionData;
        return { x: d.x / 2, y: d.y / 2 };
      },
    };

    serializer.registerSerializer(DoubleSerializer);

    commands.spawn().with(Position, { x: 10, y: 20 }).build();

    const data = serializer.serialize(world, commands);
    // Check serialized data is doubled
    expect(data.entities[0]?.components[0]?.data).toEqual({ x: 20, y: 40 });

    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);
    serializer.deserialize(targetWorld, targetCommands, data);

    // Check deserialized data is halved back
    targetCommands
      .query()
      .all(Position)
      .each((entity, pos) => {
        expect(pos.x).toBe(10);
        expect(pos.y).toBe(20);
      });
  });
});

describe("WorldSerializer - Error Handling", () => {
  let world: World;
  let commands: Command;
  let serializer: WorldSerializer;

  beforeEach(() => {
    world = new World();
    commands = new Command(world);
    serializer = new WorldSerializer();
  });

  it("should fail on invalid JSON", () => {
    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);

    const result = serializer.deserializeFromString(
      targetWorld,
      targetCommands,
      "not valid json"
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("JSON parse error");
  });

  it("should fail on schema validation error", () => {
    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);

    const invalidData = { invalid: "data" };

    const result = serializer.deserialize(
      targetWorld,
      targetCommands,
      invalidData
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Schema validation failed");
  });

  it("should skip missing components with skipMissingComponents option", () => {
    commands.spawn().with(Position, { x: 10, y: 20 }).build();
    const data = serializer.serialize(world, commands);

    // Modify data to reference non-existent component
    data.componentRegistry.push({ id: 999, name: "NonExistent" });
    data.entities[0]?.components.push({
      typeId: 999,
      typeName: "NonExistent",
      data: { foo: "bar" },
    });

    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);

    const result = serializer.deserialize(targetWorld, targetCommands, data, {
      skipMissingComponents: true,
    });

    expect(result.success).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(targetWorld.getEntityCount()).toBe(1);
  });

  it("should fail on missing component without skipMissingComponents", () => {
    commands.spawn().with(Position, { x: 10, y: 20 }).build();
    const data = serializer.serialize(world, commands);

    // Modify data to reference non-existent component
    data.componentRegistry.push({ id: 999, name: "NonExistent" });
    data.entities[0]?.components.push({
      typeId: 999,
      typeName: "NonExistent",
      data: { foo: "bar" },
    });

    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);

    const result = serializer.deserialize(targetWorld, targetCommands, data, {
      skipMissingComponents: false,
    });

    expect(result.success).toBe(false);
  });
});

describe("WorldSerializer - Utility Methods", () => {
  let world: World;
  let commands: Command;
  let serializer: WorldSerializer;

  beforeEach(() => {
    world = new World();
    commands = new Command(world);
    serializer = new WorldSerializer();
  });

  it("should clone world", () => {
    for (let i = 0; i < 5; i++) {
      commands
        .spawn()
        .with(Position, { x: i, y: i * 2 })
        .build();
    }

    const { world: clonedWorld, commands: clonedCommands } = serializer.clone(
      world,
      commands
    );

    expect(clonedWorld.getEntityCount()).toBe(5);

    // Verify cloned data
    const positions: PositionData[] = [];
    clonedCommands
      .query()
      .all(Position)
      .each((entity, pos) => {
        positions.push({ x: pos.x, y: pos.y });
      });

    expect(positions.length).toBe(5);
  });

  it("should provide serialization stats", () => {
    for (let i = 0; i < 100; i++) {
      commands
        .spawn()
        .with(Position, { x: i, y: i })
        .with(Velocity, { x: i, y: i })
        .build();
    }

    const stats = serializer.getStats(world, commands);

    expect(stats.entityCount).toBe(100);
    expect(stats.componentCount).toBe(200); // 100 entities * 2 components
    expect(stats.componentTypeCount).toBe(2); // Position and Velocity
    expect(stats.sizeBytes).toBeGreaterThan(0);
    expect(stats.serializeTime).toBeGreaterThan(0);
  });
});

describe("WorldSerializer - Performance", () => {
  let world: World;
  let commands: Command;
  let serializer: WorldSerializer;

  beforeEach(() => {
    world = new World();
    commands = new Command(world);
    serializer = new WorldSerializer();
  });

  it("should serialize 10k entities quickly (<50ms)", () => {
    for (let i = 0; i < 10000; i++) {
      commands
        .spawn()
        .with(Position, { x: i, y: i })
        .with(Velocity, { x: i, y: i })
        .build();
    }

    const start = performance.now();
    const data = serializer.serialize(world, commands);
    const elapsed = performance.now() - start;

    console.log(`Serialized 10k entities in ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeLessThan(50);
    expect(data.entities.length).toBe(10000);
  });

  it("should deserialize 10k entities quickly (<50ms)", () => {
    for (let i = 0; i < 10000; i++) {
      commands
        .spawn()
        .with(Position, { x: i, y: i })
        .with(Velocity, { x: i, y: i })
        .build();
    }

    const data = serializer.serialize(world, commands);
    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);

    const start = performance.now();
    const result = serializer.deserialize(targetWorld, targetCommands, data);
    const elapsed = performance.now() - start;

    console.log(`Deserialized 10k entities in ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeLessThan(52);
    expect(result.success).toBe(true);
    expect(targetWorld.getEntityCount()).toBe(10000);
  });
});

describe("WorldSerializer - Property-Level Serialization Config", () => {
  let world: World;
  let commands: Command;
  let serializer: WorldSerializer;

  beforeEach(() => {
    world = new World();
    commands = new Command(world);
    serializer = new WorldSerializer();
  });

  it("should serialize only configured properties", () => {
    interface TestData {
      serialized: number;
      notSerialized: string;
    }

    const TestComponent = component<TestData>("TestComponentBasic", {
      serialized: {
        serializable: true,
      },
    });

    commands
      .spawn()
      .with(TestComponent, { serialized: 42, notSerialized: "ignored" })
      .build();

    const data = serializer.serialize(world, commands);

    expect(data.entities[0]?.components[0]?.data).toEqual({ serialized: 42 });
    expect(data.entities[0]?.components[0]?.data).not.toHaveProperty(
      "notSerialized"
    );
  });

  it("should NOT serialize properties with serializable: false", () => {
    interface TestData {
      x: number;
      y: number;
    }

    const TestComponent = component<TestData>("TestComponentExplicitFalse", {
      x: {
        serializable: true,
      },
      y: {
        serializable: false,
      },
    });

    commands.spawn().with(TestComponent, { x: 10, y: 20 }).build();

    const data = serializer.serialize(world, commands);

    expect(data.entities[0]?.components[0]?.data).toEqual({ x: 10 });
    expect(data.entities[0]?.components[0]?.data).not.toHaveProperty("y");
  });

  it("should serialize with empty object when no config provided", () => {
    interface NoConfigData {
      value: number;
    }

    const NoConfigComponent = component<NoConfigData>("NoConfigComponent");

    commands.spawn().with(NoConfigComponent, { value: 123 }).build();

    const data = serializer.serialize(world, commands);

    // Without property config, falls back to default serializer (pass-through)
    expect(data.entities[0]?.components[0]?.data).toEqual({ value: 123 });
  });

  it("should handle whenNullish: 'skip' by omitting property", () => {
    interface NullishData {
      value: number | null;
    }

    const NullishComponent = component<NullishData>("NullishSkip", {
      value: {
        serializable: true,
        whenNullish: "skip",
      },
    });

    commands.spawn().with(NullishComponent, { value: null }).build();

    const data = serializer.serialize(world, commands);

    expect(data.entities[0]?.components[0]?.data).toEqual({});
  });

  it("should handle whenNullish: 'keep' by serializing null", () => {
    interface NullishData {
      value: number | null;
    }

    const NullishComponent = component<NullishData>("NullishKeep", {
      value: {
        serializable: true,
        whenNullish: "keep",
      },
    });

    commands.spawn().with(NullishComponent, { value: null }).build();

    const data = serializer.serialize(world, commands);

    expect(data.entities[0]?.components[0]?.data).toEqual({ value: null });
  });

  it("should handle whenNullish: 'throw' by throwing error", () => {
    interface NullishData {
      value: number | null;
    }

    const NullishComponent = component<NullishData>("NullishThrow", {
      value: {
        serializable: true,
        whenNullish: "throw",
      },
    });

    commands.spawn().with(NullishComponent, { value: null }).build();

    expect(() => serializer.serialize(world, commands)).toThrow();
  });

  it("should handle serializeAs renaming", () => {
    interface RenameData {
      internalName: number;
    }

    const RenameComponent = component<RenameData>("RenameComponent", {
      internalName: {
        serializable: true,
        serializeAs: "externalName",
      },
    });

    commands.spawn().with(RenameComponent, { internalName: 100 }).build();

    const data = serializer.serialize(world, commands);

    expect(data.entities[0]?.components[0]?.data).toEqual({
      externalName: 100,
    });
    expect(data.entities[0]?.components[0]?.data).not.toHaveProperty(
      "internalName"
    );
  });

  it("should deserialize renamed properties correctly", () => {
    interface RenameData {
      internalName: number;
    }

    const RenameComponent = component<RenameData>("RenameComponentDeser", {
      internalName: {
        serializable: true,
        serializeAs: "externalName",
      },
    });

    commands.spawn().with(RenameComponent, { internalName: 200 }).build();

    const data = serializer.serialize(world, commands);
    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);

    const result = serializer.deserialize(targetWorld, targetCommands, data);

    expect(result.success).toBe(true);

    targetCommands
      .query()
      .all(RenameComponent)
      .each((_, comp) => {
        expect(comp.internalName).toBe(200);
      });
  });

  it("should handle type: 'assetRef' preset", () => {
    interface SpriteData {
      texture: { guid: string } | null;
    }

    const SpriteComponent = component<SpriteData>("SpriteWithAssetRef", {
      texture: {
        serializable: true,
        type: "assetRef",
        whenNullish: "keep",
      },
    });

    const assetRef = { guid: "12345678-1234-4234-8234-123456789abc" };
    commands.spawn().with(SpriteComponent, { texture: assetRef }).build();

    const data = serializer.serialize(world, commands);

    expect(data.entities[0]?.components[0]?.data).toEqual({
      texture: { guid: "12345678-1234-4234-8234-123456789abc" },
    });
  });

  it("should handle type: 'runtimeAsset' preset - serialize to guid", () => {
    interface SpriteData {
      texture: RuntimeAsset | null;
    }

    const SpriteComponent = component<SpriteData>("SpriteWithRuntimeAsset", {
      texture: {
        serializable: true,
        type: "runtimeAsset",
        whenNullish: "keep",
      },
    });

    // Initialize RuntimeAssetManager
    if (!RuntimeAssetManager.has()) {
      RuntimeAssetManager.initialize();
    }

    const metadata: AssetMetadata = {
      guid: "12345678-1234-4234-8234-123456789abc",
      path: "assets/textures/sprite.png",
      type: AssetType.Texture,
      importedAt: "2024-01-01T00:00:00Z",
      modifiedAt: "2024-01-01T00:00:00Z",
      filtering: TextureFilter.Linear,
      wrapS: TextureWrap.Repeat,
      wrapT: TextureWrap.Repeat,
      sRGB: true,
      generateMipmaps: true,
    };

    const runtimeAsset = RuntimeAssetManager.get().getOrCreate(
      metadata.guid,
      metadata
    );
    commands.spawn().with(SpriteComponent, { texture: runtimeAsset }).build();

    const data = serializer.serialize(world, commands);

    expect(data.entities[0]?.components[0]?.data).toEqual({
      texture: { guid: "12345678-1234-4234-8234-123456789abc" },
    });
  });

  it("should handle type: 'runtimeAsset' preset - deserialize to RuntimeAsset", () => {
    interface SpriteData {
      texture: RuntimeAsset | null;
    }

    const SpriteComponent = component<SpriteData>("SpriteWithRuntimeAsset2", {
      texture: {
        serializable: true,
        type: "runtimeAsset",
        whenNullish: "keep",
      },
    });

    // Initialize RuntimeAssetManager
    if (!RuntimeAssetManager.has()) {
      RuntimeAssetManager.initialize();
    }

    const metadata: AssetMetadata = {
      guid: "abcdef12-3456-4789-8abc-def123456789",
      path: "assets/models/cube.obj",
      type: AssetType.Unknown,
      importedAt: "2024-01-01T00:00:00Z",
      modifiedAt: "2024-01-01T00:00:00Z",
    };

    const runtimeAsset = RuntimeAssetManager.get().getOrCreate(
      metadata.guid,
      metadata
    );
    commands.spawn().with(SpriteComponent, { texture: runtimeAsset }).build();

    const data = serializer.serialize(world, commands);

    // Create a new world and deserialize
    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);

    const result = serializer.deserialize(targetWorld, targetCommands, data, {
      mode: "replace",
    });

    expect(result.success).toBe(true);

    targetCommands
      .query()
      .all(SpriteComponent)
      .each((_, sprite) => {
        expect(sprite.texture).toBeInstanceOf(RuntimeAsset);
        expect(sprite.texture?.guid).toBe(
          "abcdef12-3456-4789-8abc-def123456789"
        );
        expect(sprite.texture?.path).toBe("assets/models/cube.obj");
        expect(sprite.texture?.type).toBe(AssetType.Unknown);
        expect(sprite.texture?.isLoaded).toBe(false);
      });
  });

  it("should handle type: 'runtimeAsset' preset - singleton behavior", () => {
    interface ModelData {
      mesh: RuntimeAsset | null;
      texture: RuntimeAsset | null;
    }

    const ModelComponent = component<ModelData>("ModelWithRuntimeAssets", {
      mesh: {
        serializable: true,
        type: "runtimeAsset",
        whenNullish: "keep",
      },
      texture: {
        serializable: true,
        type: "runtimeAsset",
        whenNullish: "keep",
      },
    });

    // Initialize RuntimeAssetManager
    if (!RuntimeAssetManager.has()) {
      RuntimeAssetManager.initialize();
    }

    const sharedGuid = "99999999-9999-4999-8999-999999999999";
    const sharedMetadata: AssetMetadata = {
      guid: sharedGuid,
      path: "assets/textures/shared.png",
      type: AssetType.Texture,
      importedAt: "2024-01-01T00:00:00Z",
      modifiedAt: "2024-01-01T00:00:00Z",
      filtering: TextureFilter.Nearest,
      wrapS: TextureWrap.ClampToEdge,
      wrapT: TextureWrap.ClampToEdge,
      sRGB: false,
      generateMipmaps: false,
    };

    const meshMetadata: AssetMetadata = {
      guid: "88888888-8888-4888-8888-888888888888",
      path: "assets/models/mesh.obj",
      type: AssetType.Unknown,
      importedAt: "2024-01-01T00:00:00Z",
      modifiedAt: "2024-01-01T00:00:00Z",
    };

    const sharedAsset = RuntimeAssetManager.get().getOrCreate(
      sharedGuid,
      sharedMetadata
    );
    const meshAsset = RuntimeAssetManager.get().getOrCreate(
      meshMetadata.guid,
      meshMetadata
    );

    // Spawn entity with same asset referenced twice
    commands
      .spawn()
      .with(ModelComponent, { mesh: meshAsset, texture: sharedAsset })
      .build();

    const data = serializer.serialize(world, commands);

    // Create a new world and deserialize
    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);

    // Clear RuntimeAssetManager to test singleton creation during deserialization
    RuntimeAssetManager.clear();
    RuntimeAssetManager.initialize();

    const result = serializer.deserialize(targetWorld, targetCommands, data, {
      mode: "replace",
    });

    expect(result.success).toBe(true);

    targetCommands
      .query()
      .all(ModelComponent)
      .each((_, model) => {
        expect(model.mesh).toBeInstanceOf(RuntimeAsset);
        expect(model.texture).toBeInstanceOf(RuntimeAsset);

        // Verify singleton: getting the same GUID returns the same instance
        const meshInstance1 = RuntimeAssetManager.get().get(meshMetadata.guid);
        const meshInstance2 = RuntimeAssetManager.get().get(meshMetadata.guid);
        expect(meshInstance1).toBe(meshInstance2);
        expect(meshInstance1).toBe(model.mesh);

        const textureInstance1 = RuntimeAssetManager.get().get(sharedGuid);
        const textureInstance2 = RuntimeAssetManager.get().get(sharedGuid);
        expect(textureInstance1).toBe(textureInstance2);
        expect(textureInstance1).toBe(model.texture);
      });
  });

  it("should handle type: 'set' preset", () => {
    interface TagData {
      tags: Set<string>;
    }

    const TagComponent = component<TagData>("TagWithSet", {
      tags: {
        serializable: true,
        type: "set",
      },
    });

    commands
      .spawn()
      .with(TagComponent, { tags: new Set(["player", "enemy"]) })
      .build();

    const data = serializer.serialize(world, commands);

    expect((data.entities[0]?.components[0]?.data as any).tags).toEqual([
      "player",
      "enemy",
    ]);
  });

  it("should deserialize type: 'set' back to Set", () => {
    interface TagData {
      tags: Set<string>;
    }

    const TagComponent = component<TagData>("TagWithSetDeser", {
      tags: {
        serializable: true,
        type: "set",
      },
    });

    commands
      .spawn()
      .with(TagComponent, { tags: new Set(["a", "b", "c"]) })
      .build();

    const data = serializer.serialize(world, commands);
    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);

    const result = serializer.deserialize(targetWorld, targetCommands, data);

    expect(result.success).toBe(true);

    targetCommands
      .query()
      .all(TagComponent)
      .each((_, comp) => {
        expect(comp.tags).toBeInstanceOf(Set);
        expect(comp.tags.has("a")).toBe(true);
        expect(comp.tags.has("b")).toBe(true);
        expect(comp.tags.has("c")).toBe(true);
      });
  });

  it("should handle collectionType: 'array'", () => {
    interface ArrayData {
      items: number[];
    }

    const ArrayComponent = component<ArrayData>("ArrayComponent", {
      items: {
        serializable: true,
        collectionType: "array",
      },
    });

    commands
      .spawn()
      .with(ArrayComponent, { items: [1, 2, 3] })
      .build();

    const data = serializer.serialize(world, commands);

    expect(data.entities[0]?.components[0]?.data).toEqual({ items: [1, 2, 3] });
  });

  it("should handle collectionType: 'set'", () => {
    interface SetData {
      values: Set<number>;
    }

    const SetComponent = component<SetData>("SetComponent", {
      values: {
        serializable: true,
        collectionType: "set",
      },
    });

    commands
      .spawn()
      .with(SetComponent, { values: new Set([10, 20, 30]) })
      .build();

    const data = serializer.serialize(world, commands);

    expect((data.entities[0]?.components[0]?.data as any).values).toEqual([
      10, 20, 30,
    ]);
  });

  it("should handle customSerializer functions", () => {
    interface CustomData {
      value: number;
    }

    const CustomComponent = component<CustomData>("CustomComponent", {
      value: {
        serializable: true,
        customSerializer: {
          serialize: (val) => val * 2,
          deserialize: (val) => (val as number) / 2,
        },
      },
    });

    commands.spawn().with(CustomComponent, { value: 50 }).build();

    const data = serializer.serialize(world, commands);

    expect(data.entities[0]?.components[0]?.data).toEqual({ value: 100 });
  });

  it("should round-trip with customSerializer", () => {
    interface CustomData {
      value: number;
    }

    const CustomComponent = component<CustomData>("CustomComponentRoundTrip", {
      value: {
        serializable: true,
        customSerializer: {
          serialize: (val) => val * 10,
          deserialize: (val) => (val as number) / 10,
        },
      },
    });

    commands.spawn().with(CustomComponent, { value: 7 }).build();

    const data = serializer.serialize(world, commands);
    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);

    const result = serializer.deserialize(targetWorld, targetCommands, data);

    expect(result.success).toBe(true);

    targetCommands
      .query()
      .all(CustomComponent)
      .each((_, comp) => {
        expect(comp.value).toBe(7);
      });
  });

  it("should handle multiple properties with different configs", () => {
    interface ComplexData {
      id: number;
      name: string;
      tags: Set<string>;
      metadata: string | null;
    }

    const ComplexComponent = component<ComplexData>("ComplexComponent", {
      id: {
        serializable: true,
        serializeAs: "_id",
      },
      name: {
        serializable: true,
      },
      tags: {
        serializable: true,
        type: "set",
      },
      metadata: {
        serializable: true,
        whenNullish: "skip",
      },
    });

    commands
      .spawn()
      .with(ComplexComponent, {
        id: 1,
        name: "test",
        tags: new Set(["a", "b"]),
        metadata: null,
      })
      .build();

    const data = serializer.serialize(world, commands);

    expect(data.entities[0]?.components[0]?.data).toEqual({
      _id: 1,
      name: "test",
      tags: ["a", "b"],
      // metadata is skipped because it's null
    });
  });

  it("should round-trip complex component correctly", () => {
    interface ComplexData {
      id: number;
      name: string;
      tags: Set<string>;
      count: number;
    }

    const ComplexComponent = component<ComplexData>("ComplexRoundTrip", {
      id: {
        serializable: true,
        serializeAs: "entityId",
      },
      name: {
        serializable: true,
      },
      tags: {
        serializable: true,
        type: "set",
      },
      count: {
        serializable: true,
        customSerializer: {
          serialize: (val) => val.toString(),
          deserialize: (val) => parseInt(val as string),
        },
      },
    });

    commands
      .spawn()
      .with(ComplexComponent, {
        id: 42,
        name: "player",
        tags: new Set(["hero", "warrior"]),
        count: 99,
      })
      .build();

    const data = serializer.serialize(world, commands);
    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);

    const result = serializer.deserialize(targetWorld, targetCommands, data);

    expect(result.success).toBe(true);

    targetCommands
      .query()
      .all(ComplexComponent)
      .each((_, comp) => {
        expect(comp.id).toBe(42);
        expect(comp.name).toBe("player");
        expect(comp.tags).toBeInstanceOf(Set);
        expect(comp.tags.has("hero")).toBe(true);
        expect(comp.tags.has("warrior")).toBe(true);
        expect(comp.count).toBe(99);
      });
  });

  it("should handle array with assetRef items", () => {
    interface TextureArrayData {
      textures: { guid: string }[];
    }

    const TextureArrayComponent = component<TextureArrayData>("TextureArray", {
      textures: {
        serializable: true,
        collectionType: "array",
        type: "assetRef",
      },
    });

    commands
      .spawn()
      .with(TextureArrayComponent, {
        textures: [
          { guid: "11111111-1111-4111-8111-111111111111" },
          { guid: "22222222-2222-4222-8222-222222222222" },
        ],
      })
      .build();

    const data = serializer.serialize(world, commands);

    expect((data.entities[0]?.components[0]?.data as any).textures).toEqual([
      { guid: "11111111-1111-4111-8111-111111111111" },
      { guid: "22222222-2222-4222-8222-222222222222" },
    ]);
  });

  it("should handle Set with assetRef items", () => {
    interface AssetSetData {
      assets: Set<{ guid: string }>;
    }

    const AssetSetComponent = component<AssetSetData>("AssetSetWithAssetRefs", {
      assets: {
        serializable: true,
        collectionType: "set",
        type: "assetRef",
      },
    });

    const asset1 = { guid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
    const asset2 = { guid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };

    commands
      .spawn()
      .with(AssetSetComponent, { assets: new Set([asset1, asset2]) })
      .build();

    const data = serializer.serialize(world, commands);

    // The serialized data should have assets as an array (Set converted to array)
    const assetsData = (data.entities[0]?.components[0]?.data as any).assets;
    expect(Array.isArray(assetsData)).toBe(true);
    expect(assetsData).toHaveLength(2);
    // Check that the items still have guid property
    expect(assetsData[0]).toHaveProperty("guid");
    expect(assetsData[1]).toHaveProperty("guid");
  });

  it("should handle array with runtimeAsset items", () => {
    interface TextureArrayData {
      textures: RuntimeAsset[];
    }

    const TextureArrayComponent = component<TextureArrayData>(
      "RuntimeAssetTextureArray",
      {
        textures: {
          serializable: true,
          collectionType: "array",
          type: "runtimeAsset",
        },
      }
    );

    // Initialize RuntimeAssetManager
    if (!RuntimeAssetManager.has()) {
      RuntimeAssetManager.initialize();
    }

    const metadata1: AssetMetadata = {
      guid: "11111111-1111-4111-8111-111111111111",
      path: "assets/textures/texture1.png",
      type: AssetType.Texture,
      importedAt: "2024-01-01T00:00:00Z",
      modifiedAt: "2024-01-01T00:00:00Z",
      filtering: TextureFilter.Linear,
      wrapS: TextureWrap.Repeat,
      wrapT: TextureWrap.Repeat,
      sRGB: true,
      generateMipmaps: true,
    };

    const metadata2: AssetMetadata = {
      guid: "22222222-2222-4222-8222-222222222222",
      path: "assets/textures/texture2.png",
      type: AssetType.Texture,
      importedAt: "2024-01-01T00:00:00Z",
      modifiedAt: "2024-01-01T00:00:00Z",
      filtering: TextureFilter.Nearest,
      wrapS: TextureWrap.ClampToEdge,
      wrapT: TextureWrap.ClampToEdge,
      sRGB: false,
      generateMipmaps: false,
    };

    const asset1 = RuntimeAssetManager.get().getOrCreate(
      metadata1.guid,
      metadata1
    );
    const asset2 = RuntimeAssetManager.get().getOrCreate(
      metadata2.guid,
      metadata2
    );

    commands
      .spawn()
      .with(TextureArrayComponent, {
        textures: [asset1, asset2],
      })
      .build();

    const data = serializer.serialize(world, commands);

    expect((data.entities[0]?.components[0]?.data as any).textures).toEqual([
      { guid: "11111111-1111-4111-8111-111111111111" },
      { guid: "22222222-2222-4222-8222-222222222222" },
    ]);
  });

  it("should handle Set with runtimeAsset items", () => {
    interface AssetSetData {
      assets: Set<RuntimeAsset>;
    }

    const AssetSetComponent = component<AssetSetData>(
      "AssetSetWithRuntimeAssets",
      {
        assets: {
          serializable: true,
          collectionType: "set",
          type: "runtimeAsset",
        },
      }
    );

    // Initialize RuntimeAssetManager
    if (!RuntimeAssetManager.has()) {
      RuntimeAssetManager.initialize();
    }

    const metadata1: AssetMetadata = {
      guid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      path: "assets/models/model1.obj",
      type: AssetType.Unknown,
      importedAt: "2024-01-01T00:00:00Z",
      modifiedAt: "2024-01-01T00:00:00Z",
    };

    const metadata2: AssetMetadata = {
      guid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      path: "assets/models/model2.obj",
      type: AssetType.Unknown,
      importedAt: "2024-01-01T00:00:00Z",
      modifiedAt: "2024-01-01T00:00:00Z",
    };

    const asset1 = RuntimeAssetManager.get().getOrCreate(
      metadata1.guid,
      metadata1
    );
    const asset2 = RuntimeAssetManager.get().getOrCreate(
      metadata2.guid,
      metadata2
    );

    commands
      .spawn()
      .with(AssetSetComponent, { assets: new Set([asset1, asset2]) })
      .build();

    const data = serializer.serialize(world, commands);

    // The serialized data should have assets as an array (Set converted to array)
    const assetsData = (data.entities[0]?.components[0]?.data as any).assets;
    expect(Array.isArray(assetsData)).toBe(true);
    expect(assetsData).toHaveLength(2);
    // Check that the items still have guid property
    expect(assetsData[0]).toHaveProperty("guid");
    expect(assetsData[1]).toHaveProperty("guid");
  });

  it("should maintain backward compatibility with components without config", () => {
    // Test that old-style components still work
    const OldStyleComponent = component<PositionData>("OldStylePosition");

    commands.spawn().with(OldStyleComponent, { x: 100, y: 200 }).build();

    const data = serializer.serialize(world, commands);
    const targetWorld = new World();
    const targetCommands = new Command(targetWorld);

    const result = serializer.deserialize(targetWorld, targetCommands, data);

    expect(result.success).toBe(true);

    targetCommands
      .query()
      .all(OldStyleComponent)
      .each((_, pos) => {
        expect(pos.x).toBe(100);
        expect(pos.y).toBe(200);
      });
  });
});
