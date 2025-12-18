# @voidscript/engine

Blueprint-based visual scripting system for TypeScript, inspired by Unreal Engine Blueprints.

## Features

- **Event-Driven Architecture**: Support for lifecycle events (OnStart, OnUpdate, OnFixedUpdate, OnRender, OnInput)
- **Node-Based System**: Pure function nodes, flow control, variables, and property access
- **Type-Safe**: Full TypeScript support with proper type checking
- **Lazy Evaluation**: Data nodes are only executed when their values are needed
- **Flow Control**: Branch (if/else) and ForLoop nodes
- **60 FPS Optimized**: No runtime validation overhead, designed for game loops
- **Serialization**: Save and load blueprints to/from JSON
- **Class Integration**: Auto-generate property accessor nodes from TypeScript classes

## Installation

```bash
pnpm add @voidscript/engine
```

## Quick Start

```typescript
import {
  BlueprintGraph,
  BlueprintInstance,
  OnStartNode,
  MathAddNode,
  PrintNode,
} from "@voidscript/engine";

// Create a blueprint
const graph = new BlueprintGraph("my-blueprint", "My First Blueprint");

// Add nodes
const startNode = new OnStartNode("start");
const addNode = new MathAddNode("add");
const printNode = new PrintNode("print");

graph.addNode(startNode);
graph.addNode(addNode);
graph.addNode(printNode);

// Connect nodes
graph.addConnection({
  sourceNodeId: "start",
  sourcePinId: "exec-out",
  targetNodeId: "print",
  targetPinId: "exec-in",
});

graph.addConnection({
  sourceNodeId: "add",
  sourcePinId: "result",
  targetNodeId: "print",
  targetPinId: "value",
});

// Run the blueprint
const instance = new BlueprintInstance(graph);
instance.start();
```

## Core Concepts

### Nodes

Nodes are the building blocks of blueprints. There are several types:

- **Event Nodes**: Root nodes that trigger execution (OnStart, OnUpdate, etc.)
- **Function Nodes**: Pure functions that compute values (Math operations)
- **Variable Nodes**: Get/Set blueprint variables
- **Property Nodes**: Get/Set class properties
- **Flow Control Nodes**: Branch, ForLoop

### Pins

Pins are connection points on nodes:

- **Execution Pins** (white): Control the flow of execution
- **Data Pins** (colored by type): Carry typed data between nodes

### Execution Model

- **Synchronous**: All execution is synchronous for 60fps performance
- **Lazy Evaluation**: Pure nodes are only executed when their output is needed
- **Caching**: Results are cached per frame to avoid redundant computations

## Examples

### Variables

```typescript
const graph = new BlueprintGraph("counter", "Counter Example");

// Define a variable
graph.addVariable({
  name: "counter",
  type: PinType.Number,
  defaultValue: 0,
});

// Use variable get/set nodes
const getNode = new VariableGetNode("get", "counter", PinType.Number);
const setNode = new VariableSetNode("set", "counter", PinType.Number);
```

### Branch (If/Else)

```typescript
const branchNode = new BranchNode("branch");

// Connect to true/false paths
graph.addConnection({
  sourceNodeId: "branch",
  sourcePinId: "true",
  targetNodeId: "print-healthy",
  targetPinId: "exec-in",
});

graph.addConnection({
  sourceNodeId: "branch",
  sourcePinId: "false",
  targetNodeId: "print-low",
  targetPinId: "exec-in",
});
```

### Class Properties

```typescript
class Player {
  health: number = 100;
  name: string = "Hero";
}

// Register the class
const nodeRegistry = new NodeRegistry();
const classRegistry = new ClassRegistry(nodeRegistry);

registerSimpleClass(classRegistry, "Player", {
  health: PinType.Number,
  name: PinType.String,
});

// Use property nodes
const getHealth = new PropertyGetNode("get", "Player", "health", PinType.Number);
const setHealth = new PropertySetNode("set", "Player", "health", PinType.Number);

// Register instance at runtime
const instance = new BlueprintInstance(graph);
const player = new Player();
instance.registerInstance("Player", player);
```

### Game Loop

```typescript
const instance = new BlueprintInstance(graph);

// Start
instance.start();

// Update loop (60 FPS)
function gameLoop() {
  const deltaTime = 1 / 60;
  instance.update(deltaTime);
  requestAnimationFrame(gameLoop);
}
gameLoop();

// Fixed update (physics)
setInterval(() => {
  instance.fixedUpdate();
}, 1000 / 60);
```

### Serialization

```typescript
import { BlueprintSerializer, NodeRegistry } from "@voidscript/engine";

const registry = new NodeRegistry();
const serializer = new BlueprintSerializer(registry);

// Save
const json = serializer.serializeToString(graph);
localStorage.setItem("my-blueprint", json);

// Load
const loaded = serializer.deserializeFromString(json);
const instance = new BlueprintInstance(loaded);
```

## Node Types

### Event Nodes

- `OnStartNode` - Triggers once when blueprint starts
- `OnUpdateNode` - Triggers every frame
- `OnFixedUpdateNode` - Triggers at fixed intervals (physics)
- `OnRenderNode` - Triggers during render phase
- `OnInputNode` - Triggers on keyboard/mouse input

### Math Nodes

- `MathAddNode` - Add two numbers
- `MathSubtractNode` - Subtract two numbers
- `MathMultiplyNode` - Multiply two numbers
- `MathDivideNode` - Divide two numbers

### Flow Control

- `BranchNode` - If/else conditional
- `ForLoopNode` - Loop with index

### Utility

- `PrintNode` - Debug print to console

## API Reference

### BlueprintGraph

```typescript
class BlueprintGraph {
  constructor(id: string, name: string, description?: string);

  addNode(node: INode): void;
  removeNode(nodeId: string): void;
  getNode(nodeId: string): INode | undefined;

  addConnection(connection: PinConnection): void;
  removeConnection(connection: PinConnection): void;

  addVariable(variable: BlueprintVariable): void;
  removeVariable(name: string): void;
}
```

### BlueprintInstance

```typescript
class BlueprintInstance {
  constructor(graph: BlueprintGraph);

  start(): void;
  update(deltaTime: number): void;
  fixedUpdate(): void;
  render(): void;

  getVariable<T>(name: string): T | undefined;
  setVariable(name: string, value: unknown): void;

  registerInstance(name: string, instance: unknown): void;
}
```

## Testing

The package includes comprehensive tests:

```bash
pnpm test
```

Test coverage includes:
- All node types
- Flow control (Branch, ForLoop)
- Graph execution
- Variable and property access
- Serialization/deserialization

## Performance

- **No Runtime Validation**: Type checking happens at design time (UI level)
- **Lazy Evaluation**: Nodes only execute when needed
- **Caching**: Results cached per frame
- **Synchronous**: No async overhead for 60fps performance

## Contributing

This is part of the VoidScript project. The engine provides the foundation for a blueprint-based coding system.

## License

MIT

## Future Enhancements

- Full loop iteration support (currently simplified)
- More math/logic nodes
- Async node support
- Better debugging tools
- Visual editor integration
