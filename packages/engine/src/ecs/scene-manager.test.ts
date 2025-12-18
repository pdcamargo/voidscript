/**
 * SceneManager Tests
 *
 * Comprehensive test suite covering:
 * - Scene saving and loading
 * - Scene instantiation with entity ID remapping
 * - Multiple root entities (Godot-style)
 * - Position offsets and parent assignment
 * - Nested scenes
 * - Scene despawning
 * - Component overrides (prefab system)
 * - Scene caching
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { World } from "./world.js";
import { Command } from "./command.js";
import { component } from "./component.js";
import { SceneManager } from "./scene-manager.js";
import { SceneSerializer } from "./scene-serializer.js";
import { SceneRoot } from "./components/scene-root.js";
import { SceneChild } from "./components/scene-child.js";
import { Parent } from "./components/parent.js";
import { Children } from "./components/children.js";
import type { SceneAsset } from "./scene-asset.js";
import { AssetType } from "./asset-metadata.js";

// Test components
interface PositionData {
  x: number;
  y: number;
}

interface HealthData {
  current: number;
  max: number;
}

interface NameData {
  value: string;
}

const Position = component<PositionData>("Position", {
  x: { serializable: true },
  y: { serializable: true },
});

const Health = component<HealthData>("Health", {
  current: { serializable: true },
  max: { serializable: true },
});

const Name = component<NameData>("Name", {
  value: { serializable: true },
});

describe("SceneManager - Singleton Pattern", () => {
  afterEach(() => {
    SceneManager.clear();
  });

  it("should initialize singleton", () => {
    expect(SceneManager.has()).toBe(false);

    const manager = SceneManager.initialize();

    expect(SceneManager.has()).toBe(true);
    expect(SceneManager.get()).toBe(manager);
  });

  it("should throw if initializing twice", () => {
    SceneManager.initialize();

    expect(() => SceneManager.initialize()).toThrow(
      "SceneManager already initialized"
    );
  });

  it("should throw if getting before initialization", () => {
    expect(() => SceneManager.get()).toThrow(
      "SceneManager not initialized"
    );
  });

  it("should clear singleton", () => {
    SceneManager.initialize();
    expect(SceneManager.has()).toBe(true);

    SceneManager.clear();
    expect(SceneManager.has()).toBe(false);
  });
});

describe("SceneManager - Scene Saving", () => {
  let world: World;
  let commands: Command;
  let manager: SceneManager;

  beforeEach(() => {
    world = new World();
    commands = new Command(world);
    manager = SceneManager.initialize();
  });

  afterEach(() => {
    SceneManager.clear();
  });

  it("should save single entity as scene", () => {
    const entity = commands
      .spawn()
      .with(Position, { x: 10, y: 20 })
      .with(Health, { current: 100, max: 100 })
      .build();

    const sceneAsset = manager.saveScene(
      [entity.id()],
      world,
      commands,
      { path: "test-scene.scene.json" }
    );

    expect(sceneAsset.version).toBe("1.0.0");
    expect(sceneAsset.metadata.type).toBe(AssetType.Scene);
    expect(sceneAsset.metadata.path).toBe("test-scene.scene.json");
    expect(sceneAsset.metadata.entityCount).toBe(1);
    expect(sceneAsset.metadata.componentTypes).toContain("Position");
    expect(sceneAsset.metadata.componentTypes).toContain("Health");
    expect(sceneAsset.sceneData.rootEntityLocalIds).toHaveLength(1);
    expect(sceneAsset.world.entities).toHaveLength(1);
  });

  it("should save entity hierarchy as scene", () => {
    const parent = commands
      .spawn()
      .with(Position, { x: 0, y: 0 })
      .with(Name, { value: "Parent" })
      .build();

    const child1 = commands
      .spawn()
      .with(Position, { x: 10, y: 0 })
      .with(Name, { value: "Child1" })
      .build();

    const child2 = commands
      .spawn()
      .with(Position, { x: 20, y: 0 })
      .with(Name, { value: "Child2" })
      .build();

    commands.entity(parent.id()).addChild(child1.id());
    commands.entity(parent.id()).addChild(child2.id());
    
    const sceneAsset = manager.saveScene(
      [parent.id()],
      world,
      commands,
      { path: "hierarchy-scene.scene.json" }
    );

    expect(sceneAsset.metadata.entityCount).toBe(3);
    expect(sceneAsset.world.entities).toHaveLength(3);
    expect(sceneAsset.sceneData.rootEntityLocalIds).toHaveLength(1);
  });

  it("should save scene with multiple roots (Godot-style)", () => {
    const root1 = commands
      .spawn()
      .with(Position, { x: 0, y: 0 })
      .with(Name, { value: "Root1" })
      .build();

    const root2 = commands
      .spawn()
      .with(Position, { x: 100, y: 0 })
      .with(Name, { value: "Root2" })
      .build();

    const root3 = commands
      .spawn()
      .with(Position, { x: 200, y: 0 })
      .with(Name, { value: "Root3" })
      .build();

    const sceneAsset = manager.saveScene(
      [root1.id(), root2.id(), root3.id()],
      world,
      commands,
      { path: "multi-root-scene.scene.json" }
    );

    expect(sceneAsset.metadata.entityCount).toBe(3);
    expect(sceneAsset.sceneData.rootEntityLocalIds).toHaveLength(3);
  });

  it("should throw if saving with no root entities", () => {
    expect(() =>
      manager.saveScene([], world, commands, { path: "invalid.scene.json" })
    ).toThrow("Scene must have at least one root entity");
  });
});

describe("SceneManager - Scene Loading & Caching", () => {
  let manager: SceneManager;

  beforeEach(() => {
    manager = SceneManager.initialize();
  });

  afterEach(() => {
    SceneManager.clear();
  });

  it("should load and cache scene asset", async () => {
    const mockScene: SceneAsset = {
      version: "1.0.0",
      metadata: {
        guid: "test-guid-123",
        path: "test-scene.scene.json",
        type: AssetType.Scene,
        entityCount: 1,
        componentTypes: ["Position"],
        nestedScenes: [],
        importedAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
      world: {
        version: "1.0.0",
        componentRegistry: [{ id: 0, name: "Position" }],
        entities: [
          {
            id: 0,
            generation: 1,
            components: [
              {
                typeId: 0,
                typeName: "Position",
                data: { x: 10, y: 20 },
              },
            ],
          },
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          entityCount: 1,
          archetypeCount: 1,
        },
      },
      sceneData: {
        entityIdMap: { 0: "local-id-123" },
        rootEntityLocalIds: ["local-id-123"],
      },
    };

    const loader = async (guid: string) => {
      if (guid === "test-guid-123") {
        return mockScene;
      }
      throw new Error(`Scene ${guid} not found`);
    };

    expect(manager.isLoaded("test-guid-123")).toBe(false);

    await manager.loadSceneAsset("test-guid-123", loader);

    expect(manager.isLoaded("test-guid-123")).toBe(true);

    // Loading again should not call loader (cached)
    await manager.loadSceneAsset("test-guid-123", loader);
  });

  it("should recursively load nested scenes", async () => {
    const parentScene: SceneAsset = {
      version: "1.0.0",
      metadata: {
        guid: "parent-guid",
        path: "parent-scene.scene.json",
        type: AssetType.Scene,
        entityCount: 1,
        componentTypes: [],
        nestedScenes: ["child-guid"],
        importedAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
      world: {
        version: "1.0.0",
        componentRegistry: [],
        entities: [],
        metadata: {
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          entityCount: 1,
          archetypeCount: 1,
        },
      },
      sceneData: {
        entityIdMap: {},
        rootEntityLocalIds: [],
      },
    };

    const childScene: SceneAsset = {
      ...parentScene,
      metadata: {
        ...parentScene.metadata,
        guid: "child-guid",
        path: "child-scene.scene.json",
        nestedScenes: [],
      },
    };

    const scenes = new Map([
      ["parent-guid", parentScene],
      ["child-guid", childScene],
    ]);

    const loader = async (guid: string) => {
      const scene = scenes.get(guid);
      if (!scene) throw new Error(`Scene ${guid} not found`);
      return scene;
    };

    await manager.loadSceneAsset("parent-guid", loader);

    expect(manager.isLoaded("parent-guid")).toBe(true);
    expect(manager.isLoaded("child-guid")).toBe(true);
  });

  it("should unload scene from cache", async () => {
    const mockScene: SceneAsset = {
      version: "1.0.0",
      metadata: {
        guid: "test-guid",
        path: "test-scene.scene.json",
        type: AssetType.Scene,
        entityCount: 0,
        componentTypes: [],
        nestedScenes: [],
        importedAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
      world: {
        version: "1.0.0",
        componentRegistry: [],
        entities: [],
        metadata: {
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          entityCount: 0,
          archetypeCount: 0,
        },
      },
      sceneData: {
        entityIdMap: {},
        rootEntityLocalIds: [],
      },
    };

    await manager.loadSceneAsset("test-guid", async () => mockScene);
    expect(manager.isLoaded("test-guid")).toBe(true);

    manager.unloadSceneAsset("test-guid");
    expect(manager.isLoaded("test-guid")).toBe(false);
  });

  it("should clear all cached scenes", async () => {
    const mockScene: SceneAsset = {
      version: "1.0.0",
      metadata: {
        guid: "guid-1",
        path: "scene-1.scene.json",
        type: AssetType.Scene,
        entityCount: 0,
        componentTypes: [],
        nestedScenes: [],
        importedAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
      world: {
        version: "1.0.0",
        componentRegistry: [],
        entities: [],
        metadata: {
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          entityCount: 0,
          archetypeCount: 0,
        },
      },
      sceneData: {
        entityIdMap: {},
        rootEntityLocalIds: [],
      },
    };

    await manager.loadSceneAsset("guid-1", async () => ({
      ...mockScene,
      metadata: { ...mockScene.metadata, guid: "guid-1" },
    }));
    await manager.loadSceneAsset("guid-2", async () => ({
      ...mockScene,
      metadata: { ...mockScene.metadata, guid: "guid-2" },
    }));

    expect(manager.isLoaded("guid-1")).toBe(true);
    expect(manager.isLoaded("guid-2")).toBe(true);

    manager.clearCache();

    expect(manager.isLoaded("guid-1")).toBe(false);
    expect(manager.isLoaded("guid-2")).toBe(false);
  });
});

describe("SceneManager - Scene Instantiation", () => {
  let world: World;
  let commands: Command;
  let manager: SceneManager;

  beforeEach(() => {
    world = new World();
    commands = new Command(world);
    manager = SceneManager.initialize();
  });

  afterEach(() => {
    SceneManager.clear();
  });

  it("should throw if instantiating scene that's not loaded", () => {
    expect(() =>
      manager.instantiateScene("not-loaded-guid", world, commands)
    ).toThrow("Scene not-loaded-guid not loaded");
  });

  it("should instantiate simple scene", async () => {
    // Create and save a scene
    const entity = commands
      .spawn()
      .with(Position, { x: 10, y: 20 })
      .with(Health, { current: 50, max: 100 })
      .build();

    const sceneAsset = manager.saveScene(
      [entity.id()],
      world,
      commands,
      { guid: "simple-scene", path: "simple-scene.scene.json" }
    );

    // Clear world
    world = new World();
    commands = new Command(world);

    // Load scene
    await manager.loadSceneAsset("simple-scene", async () => sceneAsset);

    // Instantiate scene
    const result = manager.instantiateScene("simple-scene", world, commands);

    expect(result.rootEntities).toHaveLength(1);
    expect(result.allEntities).toHaveLength(1);
    expect(result.entityMapping.size).toBe(1);

    // Verify components were created
    const newEntity = result.rootEntities[0]!;
    const position = commands.getComponent(newEntity, Position);
    const health = commands.getComponent(newEntity, Health);

    expect(position.x).toBe(10);
    expect(position.y).toBe(20);
    expect(health.current).toBe(50);
    expect(health.max).toBe(100);

    // Verify SceneChild marker
    const sceneChild = commands.tryGetComponent(newEntity, SceneChild);
    expect(sceneChild).toBeDefined();
    expect(sceneChild?.sceneAssetGuid).toBe("simple-scene");
  });

  it("should instantiate scene with hierarchy", async () => {
    // Create parent with children
    const parent = commands
      .spawn()
      .with(Position, { x: 0, y: 0 })
      .with(Name, { value: "Parent" })
      .build();

    const child1 = commands
      .spawn()
      .with(Position, { x: 10, y: 0 })
      .with(Name, { value: "Child1" })
      .build();

    const child2 = commands
      .spawn()
      .with(Position, { x: 20, y: 0 })
      .with(Name, { value: "Child2" })
      .build();

    commands.entity(parent.id()).addChild(child1.id());
    commands.entity(parent.id()).addChild(child2.id());
    
    const sceneAsset = manager.saveScene(
      [parent.id()],
      world,
      commands,
      { guid: "hierarchy-scene", path: "hierarchy-scene.scene.json" }
    );


    // Clear world
    world = new World();
    commands = new Command(world);

    // Load and instantiate
    await manager.loadSceneAsset("hierarchy-scene", async () => sceneAsset);
    const result = manager.instantiateScene("hierarchy-scene", world, commands);

    expect(result.rootEntities).toHaveLength(1);
    expect(result.allEntities).toHaveLength(3);

    // Verify hierarchy was recreated
    const newParent = result.rootEntities[0]!;
    const parentChildren = commands.tryGetComponent(newParent, Children);
    expect(parentChildren).toBeDefined();
    expect(parentChildren?.ids.size).toBe(2);
  });

  it("should instantiate scene with multiple roots", async () => {
    const root1 = commands
      .spawn()
      .with(Position, { x: 0, y: 0 })
      .with(Name, { value: "Root1" })
      .build();

    const root2 = commands
      .spawn()
      .with(Position, { x: 100, y: 0 })
      .with(Name, { value: "Root2" })
      .build();

    const sceneAsset = manager.saveScene(
      [root1.id(), root2.id()],
      world,
      commands,
      { guid: "multi-root-scene", path: "multi-root.scene.json" }
    );

    // Clear world
    world = new World();
    commands = new Command(world);

    // Load and instantiate
    await manager.loadSceneAsset("multi-root-scene", async () => sceneAsset);
    const result = manager.instantiateScene("multi-root-scene", world, commands);

    expect(result.rootEntities).toHaveLength(2);
    expect(result.allEntities).toHaveLength(2);
  });

  it("should instantiate scene with parent entity", async () => {
    const entity = commands
      .spawn()
      .with(Position, { x: 10, y: 20 })
      .build();

    const sceneAsset = manager.saveScene(
      [entity.id()],
      world,
      commands,
      { guid: "child-scene", path: "child-scene.scene.json" }
    );

    // Clear world and create parent
    world = new World();
    commands = new Command(world);
    const parentEntity = commands.spawn().with(Position, { x: 100, y: 100 }).build();

    // Load and instantiate as child
    await manager.loadSceneAsset("child-scene", async () => sceneAsset);
    const result = manager.instantiateScene("child-scene", world, commands, {
      parentEntity: parentEntity.id(),
    });

    // Verify scene root became child of parent
    const sceneRoot = result.rootEntities[0]!;
    const parent = commands.tryGetComponent(sceneRoot, Parent);
    expect(parent).toBeDefined();
    expect(parent?.id).toBe(parentEntity.id());
  });

  it("should instantiate scene multiple times with different entity IDs", async () => {
    const entity = commands
      .spawn()
      .with(Position, { x: 10, y: 20 })
      .build();

    const sceneAsset = manager.saveScene(
      [entity.id()],
      world,
      commands,
      { guid: "reusable-scene", path: "reusable-scene.scene.json" }
    );

    // Clear world
    world = new World();
    commands = new Command(world);

    await manager.loadSceneAsset("reusable-scene", async () => sceneAsset);

    // Instantiate first time
    const result1 = manager.instantiateScene("reusable-scene", world, commands);
    const entity1 = result1.rootEntities[0]!;

    // Instantiate second time
    const result2 = manager.instantiateScene("reusable-scene", world, commands);
    const entity2 = result2.rootEntities[0]!;

    // Different entity IDs
    expect(entity1).not.toBe(entity2);

    // Same component values
    const pos1 = commands.getComponent(entity1, Position);
    const pos2 = commands.getComponent(entity2, Position);
    expect(pos1.x).toBe(pos2.x);
    expect(pos1.y).toBe(pos2.y);
  });
});

describe("SceneManager - Scene Despawning", () => {
  let world: World;
  let commands: Command;
  let manager: SceneManager;

  beforeEach(() => {
    world = new World();
    commands = new Command(world);
    manager = SceneManager.initialize();
  });

  afterEach(() => {
    SceneManager.clear();
  });

  it("should despawn scene by root entity", async () => {
    const entity = commands
      .spawn()
      .with(Position, { x: 10, y: 20 })
      .build();

    const sceneAsset = manager.saveScene(
      [entity.id()],
      world,
      commands,
      { guid: "despawn-scene", path: "despawn-scene.scene.json" }
    );

    world = new World();
    commands = new Command(world);

    await manager.loadSceneAsset("despawn-scene", async () => sceneAsset);
    const result = manager.instantiateScene("despawn-scene", world, commands);

    const entityCount = world.getEntityCount();
    expect(entityCount).toBeGreaterThan(0);

    // Despawn scene
    manager.despawnSceneByRootEntity(result.sceneRootEntity, commands);

    // All entities should be destroyed
    const newEntityCount = world.getEntityCount();
    expect(newEntityCount).toBe(0);
  });

  it("should despawn scene with hierarchy", async () => {
    const parent = commands
      .spawn()
      .with(Position, { x: 0, y: 0 })
      .build();

    const child = commands
      .spawn()
      .with(Position, { x: 10, y: 0 })
      .build();

    commands.entity(parent.id()).addChild(child.id());
    
    const sceneAsset = manager.saveScene(
      [parent.id()],
      world,
      commands,
      { guid: "hierarchy-despawn", path: "hierarchy-despawn.scene.json" }
    );

    world = new World();
    commands = new Command(world);

    await manager.loadSceneAsset("hierarchy-despawn", async () => sceneAsset);
    const result = manager.instantiateScene("hierarchy-despawn", world, commands);

    expect(world.getEntityCount()).toBeGreaterThan(2);

    manager.despawnSceneByRootEntity(result.sceneRootEntity, commands);

    expect(world.getEntityCount()).toBe(0);
  });
});

describe("SceneManager - Component Overrides", () => {
  let world: World;
  let commands: Command;
  let manager: SceneManager;

  beforeEach(() => {
    world = new World();
    commands = new Command(world);
    manager = SceneManager.initialize();
  });

  afterEach(() => {
    SceneManager.clear();
  });

  it("should apply component overrides during instantiation", async () => {
    const entity = commands
      .spawn()
      .with(Health, { current: 100, max: 100 })
      .build();

    const sceneAsset = manager.saveScene(
      [entity.id()],
      world,
      commands,
      { guid: "override-scene", path: "override-scene.scene.json" }
    );

    world = new World();
    commands = new Command(world);

    await manager.loadSceneAsset("override-scene", async () => sceneAsset);
    const result = manager.instantiateScene("override-scene", world, commands, {
      overrides: {
        "Health.max": 200,
        "Health.current": 200,
      },
    });

    const newEntity = result.rootEntities[0]!;
    const health = commands.getComponent(newEntity, Health);

    expect(health.max).toBe(200);
    expect(health.current).toBe(200);
  });
});
