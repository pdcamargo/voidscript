# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
pnpm build           # Build all packages
pnpm dev             # Run dev servers (desktop + editor)
pnpm lint            # Lint all packages
pnpm format          # Format code with prettier

# Package-specific commands
pnpm --filter @voidscript/engine typecheck  # Type check engine
pnpm --filter @voidscript/engine test       # Run engine tests (vitest)
pnpm --filter game dev                       # Run game app dev server
```

Never run dev commands directly - ask the user to test instead.

## Architecture Overview

VoidScript is a TypeScript game engine built on Three.js with an Entity Component System (ECS) architecture.

### Monorepo Structure

- `packages/engine` - Core engine (`@voidscript/engine`)
- `apps/game` - Example game application using the engine

### Engine Architecture

The engine has two main layers:

**1. ECS Layer** (`packages/engine/src/ecs/`)

- `component.ts` - Define components with `component<T>(name)`
- `system.ts` - Define systems with `system(fn)`, supports `.runAfter()`, `.runBefore()`, `.runIf()`
- `query.ts` - Query entities: `.all()`, `.any()`, `.none()`, `.exclusive()`, then `.each()` to iterate
- `world.ts` - Entity/component storage with archetype-based grouping
- `command.ts` - High-level API: `commands.spawn().with(Component, data).build()`
- `scheduler.ts` - System execution phases: startup, update, fixedUpdate, render, etc.

**2. Application Layer** (`packages/engine/src/app/`)

- `application.ts` - Game loop integrating ECS, Three.js, and ImGui
- `layer.ts` - Layer system for organizing game logic (inspired by TheCherno)
- `input.ts` - Polling input: `Input.isKeyPressed(KeyCode.Space)`
- `events.ts` - Event dispatch: `EventDispatcher` with typed events
- `renderer.ts` - Three.js wrapper with scene/camera management
- `window.ts` - Canvas and browser event management
- `layers/imgui-layer.ts` - Built-in ImGui overlay for debug UI

### Key Patterns

**ECS Query Pattern:**

```typescript
commands
  .query()
  .all(Position, Velocity)
  .each((entity, pos, vel) => {
    pos.x += vel.x * deltaTime;
  });
```

**System Definition:**

```typescript
const movementSystem = system(({ commands }) => {
  commands
    .query()
    .all(Position, Velocity)
    .each((entity, pos, vel) => {
      // ...
    });
}).runAfter(inputSystem);
```

**Layer Lifecycle:**

```typescript
class GameLayer extends Layer {
  onAttach(): void {} // Initialize resources
  onDetach(): void {} // Cleanup
  onUpdate(dt: number): void {} // Per-frame logic
  onFixedUpdate(dt: number): void {} // Physics timestep
  onImGuiRender(): void {} // Debug UI
  onEvent(event: AppEvent): boolean {} // Input events
}
```

**Three.js + ImGui Integration:**

- Three.js renders first, then `renderer.resetState()`, then ImGui renders on top
- This prevents WebGL context conflicts

**Resources (Shared State Across Layers):**

Resources allow sharing state between layers. Define as a class, register with Application:

```typescript
// Define resource
class PlayerStateResource {
  health = 100;
  gold = 0;
}

// Register in main.ts
app.insertResource(new PlayerStateResource());

// Access in any layer
const player = this.app.getResource(PlayerStateResource);
player.gold += 50;
```

### Scheduler Phases

Systems execute in this order each frame:

1. earlyStartup → startup → lateStartup (once)
2. earlyUpdate → update → lateUpdate
3. earlyFixedUpdate → fixedUpdate → lateFixedUpdate (fixed timestep)
4. earlyRender → render → lateRender → afterRender

### Adding Built-in Resources and Systems

**CRITICAL**: When adding new resources or systems that should be available engine-wide (not app-specific), you MUST register them in `Application.addBuiltInSystems()` in `packages/engine/src/app/application.ts`.

This includes:
- Manager classes (e.g., `AudioManager`, `TweenManager`, `Render3DManager`)
- Sync systems that bridge ECS components to Three.js objects
- Any system that should run automatically without user configuration

**Pattern:**
```typescript
// In addBuiltInSystems():
this.insertResource(new MyManager());
this.addUpdateSystem(mySyncSystem);
```

Forgetting this step will cause the feature to silently not work at runtime.

### Editor and Play Mode

The engine has a built-in editor with Play/Pause/Stop functionality. Understanding the distinction between Edit Mode and Play Mode is critical.

**Key Concepts:**
- **Edit Mode**: Scene editing, no gameplay logic runs
- **Play Mode**: Gameplay is active, systems with `.runIf(isGameplayActive())` execute
- **EditorManager**: Resource that tracks the current mode (`packages/engine/src/editor/editor-manager.ts`)

**Play-Mode-Only Systems:**
Some systems should ONLY run during gameplay (not while editing). Use the `isGameplayActive()` condition:

```typescript
import { isGameplayActive } from '../../editor/system-conditions.js';

export const myGameplaySystem = system(({ commands }) => {
  // This only runs during Play Mode
}).runIf(isGameplayActive());
```

**Examples of play-mode-only features:**
- Audio playback (AudioSource, PositionalAudioSource)
- Physics simulation
- AI/gameplay logic
- Animation playback tied to game state

**Checking Play Mode in Code:**
```typescript
const editorManager = commands.tryGetResource(EditorManager);
if (editorManager?.isPlaying()) {
  // Play mode logic
}
```

**Important Files:**
- `packages/engine/src/editor/editor-manager.ts` - Play mode state management
- `packages/engine/src/editor/system-conditions.ts` - `isGameplayActive()` condition
- `packages/engine/src/editor/editor-layer.ts` - Editor UI and controls

### Play Mode Cleanup (Three.js Resource Management)

**CRITICAL**: When stopping play mode, Three.js objects (meshes, materials, textures) must be disposed BEFORE the world is restored from snapshot. This is handled by the `play-stopping` event.

**Why this matters:**
1. When `stop()` is called, `world.clear()` removes all entities
2. World snapshot is restored with NEW entity IDs
3. If cleanup happens AFTER restore, render managers still have old entity IDs → orphaned Three.js objects in scene
4. Result: Objects accumulate, post-processing stacks, memory leaks

**EditorManager Events (in order):**
- `play-stopping` - Fired BEFORE world restore. Use for cleanup!
- `play-stopped` - Fired AFTER world restore

**The cleanup is handled by `setupPlayModeCleanup()` in `play-mode-cleanup-system.ts`:**
```typescript
// This is already registered in Application.setupEditorInternal()
// and setup-editor.ts - you don't need to call it manually

// It disposes all render managers:
// - Render3DManager (3D meshes/lights)
// - SpriteRenderManager (2D sprites)
// - Water2DRenderManager (water effects)
// - SkyGradientRenderManager (sky backgrounds)
// - PostProcessingManager (post-processing effects)
// - AudioManager (audio sources/listener)
```

**When creating new render managers:**
1. Add a `dispose()` method that clears tracked entities and removes Three.js objects from scene
2. Do NOT dispose constructor-created shared resources (like noise textures) - only per-entity resources
3. Add the manager to `disposeAllRenderManagers()` in `play-mode-cleanup-system.ts`

**Example dispose() pattern:**
```typescript
dispose(): void {
  // Remove all entity-specific resources
  for (const [entity] of this.entries) {
    this.removeEntry(entity);  // This should dispose mesh/material/geometry
  }

  // Reset runtime state
  this.elapsedTime = 0;

  // Do NOT dispose shared resources created in constructor!
  // They persist across play/stop cycles
}
```

### Asset Database System

The engine has a comprehensive asset management system for loading textures, audio, 3D models, animations, and more. Assets can be configured either inline in code or loaded from a JSON manifest file.

**Key Files:**
- `packages/engine/src/ecs/asset-metadata.ts` - Asset types and metadata interfaces
- `packages/engine/src/ecs/asset-database.ts` - Asset registration and lookup
- `packages/engine/src/ecs/asset-loader-registry.ts` - Asset loaders by type
- `packages/engine/src/ecs/runtime-asset.ts` - Runtime asset wrapper with lazy loading

**Two Ways to Configure Assets:**

1. **Code-based** (inline in ApplicationConfig):
```typescript
const app = new Application({
  assets: {
    'player-texture': {
      type: AssetType.Texture,
      path: '/textures/player.png',
      magFilter: TextureFilter.Nearest,
    }
  }
});
```

2. **JSON Manifest** (external file):
```typescript
const app = new Application({
  assetsManifest: '/assets/manifest.json'
});
```

Both approaches can be used together - manifest assets are merged with code-based assets, with manifest taking priority on GUID conflicts.

**Existing Asset Types** (in `AssetType` enum):
- `Texture` - Images (.png, .jpg, etc.)
- `Audio` - Sound files (.mp3, .wav, .ogg)
- `Model3D` - 3D models (.gltf, .glb)
- `TiledMap` - Tiled map files (.tmj, .json)
- `Animation` - Animation clip files
- `Material`, `Scene`, `BlueprintScript`, `BlueprintShader`, etc.

**Adding a New Asset Type:**

1. **Add to AssetType enum** in `asset-metadata.ts`:
```typescript
export enum AssetType {
  // ... existing types
  MyNewType = 'my-new-type',
}
```

2. **Create metadata interface** in `asset-metadata.ts`:
```typescript
export interface MyNewTypeMetadata extends BaseAssetMetadata {
  type: AssetType.MyNewType;
  // Type-specific properties
  customProperty?: string;
}
```

3. **Add to AssetMetadata union** in `asset-metadata.ts`:
```typescript
export type AssetMetadata =
  | TextureMetadata
  | MyNewTypeMetadata  // Add here
  // ... other types
```

4. **Add type guard** in `asset-metadata.ts`:
```typescript
export function isMyNewTypeMetadata(
  metadata: AssetMetadata,
): metadata is MyNewTypeMetadata {
  return metadata.type === AssetType.MyNewType;
}
```

5. **Create AssetConfig interface** in `asset-database.ts`:
```typescript
export interface MyNewTypeAssetConfig extends BaseAssetConfig {
  type: AssetType.MyNewType;
  path: string;
  customProperty?: string;
}
```

6. **Add to AssetConfig union** in `asset-database.ts`:
```typescript
export type AssetConfig =
  | TextureAssetConfig
  | MyNewTypeAssetConfig  // Add here
  // ... other types
```

7. **Add config-to-metadata conversion** in `AssetDatabase.configToMetadata()`:
```typescript
case AssetType.MyNewType: {
  return {
    ...base,
    type: AssetType.MyNewType,
    customProperty: config.customProperty,
  } satisfies MyNewTypeMetadata;
}
```

8. **Register loader** in `asset-loader-registry.ts`:
```typescript
AssetLoaderRegistry.register(AssetType.MyNewType, async (asset) => {
  const url = asset.getLoadableUrl();
  // Load and return the asset data
  const response = await fetch(url);
  return await response.json();
});
```

**Using Assets in Components:**
```typescript
// In component data
interface MyComponentData {
  myAsset: RuntimeAsset | null;
}

// Loading the asset
if (myComponentData.myAsset && !myComponentData.myAsset.isLoaded) {
  await myComponentData.myAsset.load();
}

// Accessing loaded data
const loadedData = myComponentData.myAsset?.data;
```

### Asset Manifest (JSON Format)

Assets can be defined in an external JSON file instead of inline code. This is useful for:
- Separating asset configuration from code
- Editing assets without recompiling
- Sharing asset definitions across projects

**Using a Manifest:**
```typescript
const app = new Application({
  // Load assets from JSON file
  assetsManifest: '/assets/manifest.json',

  // Can still have inline assets too (merged together)
  assets: {
    'extra-asset': { type: AssetType.Audio, path: '/audio/extra.ogg' }
  }
});
```

**Manifest JSON Format:**

The manifest is a JSON object where keys are asset GUIDs and values are asset configurations:

```json
{
  "player-texture": {
    "type": "texture",
    "path": "/textures/player.png",
    "magFilter": "nearest",
    "minFilter": "nearest",
    "wrapS": "clamp",
    "wrapT": "clamp",
    "width": 64,
    "height": 64,
    "sprites": [
      {
        "id": "player-idle",
        "name": "Player Idle",
        "tileIndex": 0,
        "tileWidth": 32,
        "tileHeight": 32
      }
    ]
  },
  "background-music": {
    "type": "audio",
    "path": "/audio/background.ogg"
  },
  "enemy-model": {
    "type": "model3d",
    "path": "/models/enemy.glb",
    "format": "glb",
    "scale": 1.0
  }
}
```

**Supported Asset Types in JSON:**

| Type | JSON `type` value | Additional Properties |
|------|-------------------|----------------------|
| Texture | `"texture"` | `magFilter`, `minFilter`, `wrapS`, `wrapT`, `width`, `height`, `sprites` |
| Audio | `"audio"` | (none) |
| Model3D | `"model3d"` | `format` (`"gltf"`, `"glb"`, `"fbx"`), `scale`, `rotation` |
| TiledMap | `"tiledmap"` | `pixelsPerUnit`, `worldOffset`, `autoSpawnLayers` |
| Animation | `"animation"` | (none) |

**Enum String Values:**

| Property | Valid Values |
|----------|-------------|
| `magFilter`, `minFilter` | `"nearest"`, `"linear"` |
| `wrapS`, `wrapT` | `"repeat"`, `"clamp"`, `"mirror"` |
| `format` (Model3D) | `"gltf"`, `"glb"`, `"fbx"` |

**Sprite Definitions (Two Formats):**

1. **Tile-based** (grid sprite sheets):
```json
{
  "id": "walk-1",
  "name": "Walk Frame 1",
  "tileIndex": 0,
  "tileWidth": 32,
  "tileHeight": 32
}
```

2. **Rect-based** (arbitrary atlas positions):
```json
{
  "id": "tree-1",
  "name": "Tree",
  "x": 0,
  "y": 0,
  "width": 64,
  "height": 128
}
```

**Loading Order:**
1. Code-based `assets` are registered in the Application constructor
2. Manifest is loaded at the start of `app.run()` via fetch (or platform file reading for native apps)
3. Manifest assets are merged in, overwriting any conflicting GUIDs

**Programmatic JSON Parsing:**
```typescript
// Parse JSON string manually if needed
const jsonString = await fetch('/assets/manifest.json').then(r => r.text());
const assets = AssetDatabase.parseAssetsJson(jsonString);
AssetDatabase.registerAdditionalAssets(assets);
```

### Custom Editor System

The engine supports custom editors for components and individual properties. This allows creating specialized UI for asset pickers, sprite selectors, and other complex interactions.

**Two Levels of Custom Editors:**

1. **Component-level `customEditor`** - Renders the ENTIRE component inspector UI
2. **Property-level `customEditor`** - Renders a SINGLE property's UI

**Key Files:**
- `packages/engine/src/ecs/component.ts` - `ComponentMetadata.customEditor` interface
- `packages/engine/src/ecs/serialization/types.ts` - `PropertySerializerConfig.customEditor` interface
- Example: `packages/engine/src/ecs/components/rendering/sprite-2d.ts` (property-level)
- Example: `packages/engine/src/ecs/components/audio/audio-source.ts` (component-level)

**Component-Level Custom Editor:**

Replaces the default inspector for the entire component. Useful when you need full control over layout.

```typescript
const MyComponent = component<MyData>(
  'MyComponent',
  { /* serializer config */ },
  {
    path: 'my/path',
    customEditor: ({ componentData, componentType, metadata, commands }) => {
      // Render entire component UI with ImGui
      ImGui.Text('Custom Component Editor');

      // Access and modify component data directly
      const volume: [number] = [componentData.volume];
      if (ImGui.SliderFloat('Volume', volume, 0.0, 1.0)) {
        componentData.volume = volume[0];
      }

      // Show asset picker, etc.
    },
  },
);
```

**Property-Level Custom Editor:**

Replaces the default input for a single property. Useful for pickers, special inputs, etc.

```typescript
const MyComponent = component<MyData>(
  'MyComponent',
  {
    myProperty: {
      serializable: true,
      customEditor: ({ label, value, onChange, config, commands, componentData }) => {
        // Render just this property's UI
        ImGui.Text(`${label}:`);

        // Use onChange to update the value
        if (ImGui.Button('Pick Value')) {
          onChange(newValue);
        }

        // Can also access other properties via componentData
        if (componentData.someOtherProperty) {
          // ...
        }
      },
    },
  },
);
```

**Custom Editor Function Signatures:**

```typescript
// Component-level (in ComponentMetadata)
customEditor?: (options: {
  componentData: T;          // Mutable component data
  componentType: ComponentType<T>;
  metadata: ComponentMetadata<T>;
  commands: Command;         // ECS commands for queries, etc.
}) => void;

// Property-level (in PropertySerializerConfig)
customEditor?: (options: {
  label: string;             // Property name for display
  value: T;                  // Current value (read-only, use onChange to update)
  onChange: (value: T) => void;  // Call to update the property
  config: PropertySerializerConfig<T>;
  commands: Command;
  componentData?: any;       // Access to entire component (for cross-property logic)
}) => void;
```

**Asset Picker Pattern (common use case):**

```typescript
audioClip: {
  serializable: true,
  type: 'runtimeAsset',
  assetTypes: [AssetType.Audio],  // Filter asset picker to audio only
  whenNullish: 'keep',
},
```

For custom asset pickers with special UI:

```typescript
customEditor: ({ label, value, onChange, componentData }) => {
  ImGui.Text(`${label}:`);

  if (value && value.guid) {
    const metadata = AssetDatabase.getMetadata(value.guid);
    ImGui.Text(metadata?.path.split('/').pop() || 'Unknown');
  } else {
    ImGui.TextDisabled('(None)');
  }

  if (ImGui.Button('Pick Asset')) {
    ImGui.OpenPopup('AssetPicker##myProperty');
  }

  // Modal with asset selection grid...
  if (ImGui.BeginPopupModal('AssetPicker##myProperty')) {
    // Get filtered assets
    const assets = AssetDatabase.getAllGuids().filter(guid => {
      const meta = AssetDatabase.getMetadata(guid);
      return meta && meta.type === AssetType.Audio;
    });

    // Render selection grid...

    if (ImGui.Button('Cancel')) {
      ImGui.CloseCurrentPopup();
    }
    ImGui.EndPopup();
  }
},
```

**When to Use Each Approach:**

| Use Case | Approach |
|----------|----------|
| Simple asset filtering | `assetTypes` in property config |
| Custom picker with preview | Property-level `customEditor` |
| Complex multi-property UI | Component-level `customEditor` |
| Hide/show based on other props | Property-level (access `componentData`) |
| Full layout control | Component-level `customEditor` |

**Tips:**
- Always use unique popup IDs: `'MyPopup##' + uniqueIdentifier`
- Use `ImGui.BeginChild` for scrollable regions in pickers
- Access other properties via `componentData` in property editors
- Property editors can return early to hide the field entirely

**CRITICAL - Label Positioning:**

When implementing custom editors, **ALWAYS put labels on the LEFT side of controls**, not on the right. This follows standard UI conventions and improves readability.

**INCORRECT (label on right):**
```typescript
// DON'T DO THIS - label appears on the right side
const value: [number] = [data.myValue];
ImGui.SliderFloat('My Value', value, 0.0, 1.0);  // ❌ WRONG
data.myValue = value[0];
```

**CORRECT (label on left):**
```typescript
// DO THIS - label appears on the left side
ImGui.Text('My Value:');
const value: [number] = [data.myValue];
ImGui.SliderFloat('##myValue', value, 0.0, 1.0);  // ✅ CORRECT (using ## hidden label)
if (ImGui.IsItemHovered()) {
  ImGui.SetTooltip('Helpful description of this property');
}
data.myValue = value[0];
```

**Pattern for all controls:**
- Sliders: `ImGui.Text('Label:')` then `ImGui.SliderFloat('##hiddenLabel', ...)`
- Drag inputs: `ImGui.Text('Label:')` then `ImGui.DragFloat('##hiddenLabel', ...)`
- Integer inputs: `ImGui.Text('Label:')` then `ImGui.DragInt('##hiddenLabel', ...)`
- Checkboxes: Use `ImGui.Checkbox('Label', ...)` (checkboxes naturally have labels on the right)
- Color pickers: `ImGui.Text('Label:')` then `ImGui.ColorEdit3('##hiddenLabel', ...)`

Always use unique `##hiddenLabel` identifiers for each control to avoid ImGui ID conflicts.

### Animation System

The engine has a keyframe-based animation system supporting multiple property types, easing functions, and loop modes.

**Key Files:**
- `packages/engine/src/animation/animation-clip.ts` - Animation clip definition
- `packages/engine/src/animation/animation-track.ts` - Track types and keyframes
- `packages/engine/src/animation/animation-manager.ts` - Global animation control
- `packages/engine/src/animation/animation-json-parser.ts` - JSON serialization/parsing
- `packages/engine/src/animation/tween.ts` - Easing functions
- `packages/engine/src/ecs/components/animation/animation-controller.ts` - ECS component
- `packages/engine/src/ecs/systems/animation-system.ts` - Update system

**Core Concepts:**

1. **AnimationClip** - Container for animation tracks with duration, loop mode, and speed
2. **AnimationTrack** - Animates a single property with keyframes
3. **Keyframe** - Time/value pair with optional easing function
4. **AnimationController** - ECS component for playback control

**Track Types:**

| Track Type | Property Type | Interpolation | Use Case |
|------------|---------------|---------------|----------|
| `NumberTrack` | `'number'` | Smooth linear | Float values |
| `IntegerTrack` | `'integer'` | Discrete (no interpolation) | Sprite frames, indices |
| `Vector3Track` | `'vector3'` | Component-wise linear | Position, rotation, scale |
| `ColorTrack` | `'color'` | RGBA linear | Color animations |
| `SpriteTrack` | `'sprite'` | Discrete | Named sprites with metadata lookup |

**Loop Modes:**
- `LoopMode.Once` - Play once and stop
- `LoopMode.Loop` - Loop indefinitely
- `LoopMode.PingPong` - Alternate forward/backward

**Creating Animations in Code:**

```typescript
import { AnimationClip, Vector3Track, NumberTrack, LoopMode } from '@voidscript/engine';

const walkAnimation = AnimationClip.create('walk')
  .addTrack(new Vector3Track('position')
    .keyframe(0, new Vector3(0, 0, 0))
    .keyframe(0.5, new Vector3(1, 0, 0), Easing.easeInOutQuad)
    .keyframe(1, new Vector3(2, 0, 0))
  )
  .addTrack(new NumberTrack('rotation.y')
    .keyframe(0, 0)
    .keyframe(1, Math.PI * 2)
  )
  .setDuration(1.0)
  .setLoopMode(LoopMode.Loop)
  .setSpeed(1.0);
```

**Animation JSON Format:**

Animations are stored as `.anim.json` files:

```json
{
  "id": "walk-cycle",
  "duration": 1.0,
  "loopMode": "loop",
  "speed": 1.0,
  "tracks": [
    {
      "propertyPath": "position",
      "propertyType": "vector3",
      "keyframes": [
        { "time": 0.0, "value": { "x": 0, "y": 0, "z": 0 } },
        { "time": 0.5, "value": { "x": 1, "y": 0, "z": 0 }, "easing": "easeInOutQuad" },
        { "time": 1.0, "value": { "x": 2, "y": 0, "z": 0 } }
      ]
    },
    {
      "propertyPath": "tileIndex",
      "propertyType": "integer",
      "keyframes": [
        { "time": 0.0, "value": 0 },
        { "time": 0.25, "value": 1 },
        { "time": 0.5, "value": 2 },
        { "time": 0.75, "value": 3 }
      ]
    }
  ]
}
```

**Sprite Animation Example:**

```json
{
  "id": "moon-phase",
  "duration": 0.8,
  "loopMode": "loop",
  "tracks": [
    {
      "propertyPath": "sprite",
      "propertyType": "sprite",
      "keyframes": [
        { "time": 0.0, "value": { "spriteId": "moon-1" } },
        { "time": 0.125, "value": { "spriteId": "moon-2" } },
        { "time": 0.25, "value": { "spriteId": "moon-3" } }
      ]
    }
  ]
}
```

**Property Path Mapping:**

The animation system maps property paths to component properties:
- `position`, `rotation`, `scale` → `Transform3D`
- `color`, `tileIndex`, `tileSize`, `tilesetSize` → `Sprite2D`
- `sprite` → `Sprite2D` (auto-updates tileIndex, tileSize, tilesetSize from sprite metadata)

**Using AnimationController Component:**

```typescript
import { AnimationController, playAnimation, stopAnimation } from '@voidscript/engine';

// Query entities with animation
commands.query().all(AnimationController).each((entity, controller) => {
  // Play a specific animation
  playAnimation(controller, 'walk-cycle', { speed: 1.5 });

  // Stop animation
  stopAnimation(controller);

  // Get current clip
  const clip = getCurrentClip(controller);
});
```

**AnimationController Data Structure:**

```typescript
interface AnimationControllerData {
  animations: RuntimeAsset<AnimationClip>[];  // Animation assets
  currentAnimationId: string | null;           // Currently playing
  isPlaying: boolean;
  currentTime: number;                         // Playback time (seconds)
  speed: number;                               // Speed multiplier
  loopCount: number;
  onComplete?: () => void;                     // Callback when done
  onLoop?: (loopCount: number) => void;        // Callback on loop
}
```

**Available Easing Functions:**

All easing functions are available in the `Easing` object and as JSON string names:

```typescript
// Easing functions available:
linear
easeInQuad, easeOutQuad, easeInOutQuad
easeInCubic, easeOutCubic, easeInOutCubic
easeInQuart, easeOutQuart, easeInOutQuart
easeInQuint, easeOutQuint, easeInOutQuint
easeInSine, easeOutSine, easeInOutSine
easeInExpo, easeOutExpo, easeInOutExpo
easeInCirc, easeOutCirc, easeInOutCirc
easeInBack, easeOutBack, easeInOutBack
easeInElastic, easeOutElastic, easeInOutElastic
easeInBounce, easeOutBounce, easeInOutBounce
```

**Global Animation Control:**

```typescript
import { AnimationManager } from '@voidscript/engine';

const animManager = commands.getResource(AnimationManager);

// Control all animations globally
animManager.setGlobalSpeed(0.5);  // Half speed
animManager.pauseAll();
animManager.resumeAll();
animManager.togglePause();
```

**Registering Animation Assets:**

```typescript
// In ApplicationConfig.assets
{
  "walk-anim-guid": {
    type: AssetType.Animation,
    path: "/animations/walk.anim.json"
  }
}
```

**Important Notes:**
- Animations only run during Play Mode (system uses `runIf(isGameplayActive())`)
- Keyframe times are normalized (0.0 to 1.0) within the clip duration
- `IntegerTrack` and `SpriteTrack` use discrete stepping (no interpolation)
- `SpriteTrack` automatically looks up sprite metadata from textures
- The `AnimationManager` resource must be registered (done automatically in `Application.addBuiltInSystems()`)

### VoidShader Language (VSL) - Custom Shader System

The engine includes a Godot-inspired shader language called VoidShader Language (VSL) that transpiles to THREE.js GLSL. This allows writing shaders in a more intuitive syntax with built-in variables and automatic uniform management.

**Key Files:**
- `packages/engine/src/shader/vsl/` - Lexer, parser, and transpiler
- `packages/engine/src/shader/shader-asset.ts` - ShaderAsset class
- `packages/engine/src/shader/shader-manager.ts` - Runtime shader management
- `packages/engine/src/shader/shader-library.ts` - Reusable shader snippets
- `packages/engine/src/shader/material-factory.ts` - Material creation utilities
- `packages/engine/src/ecs/components/rendering/sprite-2d-material.ts` - Sprite2DMaterial component

**VSL Shader Syntax:**

```glsl
shader_type canvas_item;  // or: spatial, particles
render_mode unshaded;     // or: blend_add, blend_mul

uniform float wave_amplitude : hint_range(0.0, 1.0) = 0.1;
uniform float wave_speed = 2.0;
uniform sampler2D noise_tex : hint_texture;

void vertex() {
    VERTEX.y += sin(TIME * wave_speed + VERTEX.x * 4.0) * wave_amplitude;
}

void fragment() {
    COLOR = texture(TEXTURE, UV) * COLOR;
}
```

**Shader Types:**

| Type | THREE.js Target | Use Case |
|------|-----------------|----------|
| `canvas_item` | ShaderMaterial (2D) | Sprites, UI, 2D effects |
| `spatial` | ShaderMaterial (3D) | 3D objects, PBR (future) |
| `particles` | Points ShaderMaterial | GPU particles (future) |

**Render Modes:**

| Mode | THREE.js Mapping |
|------|------------------|
| `unshaded` | `lights: false` (default) |
| `blend_add` | `THREE.AdditiveBlending` |
| `blend_mul` | `THREE.MultiplyBlending` |

**Built-in Variables (canvas_item):**

| Variable | Type | Stage | Description |
|----------|------|-------|-------------|
| `VERTEX` | `vec2` | V | Vertex position (writable) |
| `UV` | `vec2` | V/F | Texture coordinates |
| `COLOR` | `vec4` | V/F | Vertex color / final output |
| `NORMAL` | `vec3` | V/F | Normal vector |
| `TIME` | `float` | V/F | Elapsed time (seconds) |
| `TEXTURE` | `sampler2D` | F | Main sprite texture |
| `TEXTURE_SIZE` | `vec2` | F | Texture dimensions |
| `SCREEN_UV` | `vec2` | F | Screen-space UV |

**Uniform Hints (for editor UI):**

| Hint | Example |
|------|---------|
| `hint_range(min, max)` | `uniform float speed : hint_range(0.0, 10.0) = 1.0;` |
| `source_color` | `uniform vec4 tint : source_color = vec4(1.0);` |
| `hint_texture` | `uniform sampler2D noise : hint_texture;` |

**Using Shaders with Sprites:**

Add the `Sprite2DMaterial` component alongside `Sprite2D` to apply custom shaders:

```typescript
commands.spawn()
  .with(Transform3D, { position: new Vector3(0, 0, 0) })
  .with(Sprite2D, { texture: myTexture })
  .with(Sprite2DMaterial, {
    shader: myShaderAsset,  // RuntimeAsset pointing to .vsl file
    uniforms: {
      wave_speed: 2.0,
      wave_amplitude: 0.1,
    },
    uniqueInstance: true,   // Create unique material for this entity
    enabled: true,
  })
  .build();
```

**Registering Shader Assets:**

```typescript
// In ApplicationConfig.assets
{
  "water-shader": {
    type: AssetType.Shader,
    path: "/shaders/water.vsl"
  }
}
```

**JSON Manifest Format:**

```json
{
  "water-shader": {
    "type": "shader",
    "path": "/shaders/water.vsl"
  }
}
```

**ShaderManager Resource:**

The `ShaderManager` automatically updates the `TIME` uniform on all materials each frame:

```typescript
const shaderManager = commands.getResource(ShaderManager);

// Compile shader from source
const shader = shaderManager.compileFromSource(`
  shader_type canvas_item;
  uniform float time = 0.0;
  void fragment() {
    COLOR = vec4(sin(time), 0.0, 0.0, 1.0);
  }
`);

// Create material from shader
const material = shader.createMaterial({ time: 0 });
```

**Default Sprite Shader:**

The default sprite shader is located at `packages/engine/src/shader/built-in-shaders/sprite-default.vsl`:

```glsl
shader_type canvas_item;
render_mode unshaded;

void vertex() {
    // Default vertex pass-through
}

void fragment() {
    vec4 tex_color = texture(TEXTURE, UV);
    COLOR = tex_color * COLOR;
}
```

**Creating Custom Shaders:**

1. Create a `.vsl` file in your assets folder
2. Register it in your asset manifest or ApplicationConfig
3. Add `Sprite2DMaterial` component to entities with the shader RuntimeAsset
4. Define uniforms in the component's `uniforms` object

**Important Notes:**
- Shaders are compiled at load time via the asset loader
- The `TIME` uniform is automatically updated by `ShaderManager`
- Use `uniqueInstance: true` when each entity needs different uniform values
- The editor displays uniform editors based on shader metadata (uniform hints)

### Event System (Bevy-Inspired)

The engine has a Bevy-inspired event system for type-safe communication between systems. Events are retained for multiple frames to ensure systems across different phases can read them.

**Key Files:**
- `packages/engine/src/ecs/events.ts` - `Events`, `EventWriter`, `EventReader` classes
- `packages/engine/src/ecs/command.ts` - `commands.eventWriter()`, `commands.eventReader()` methods

**Core Concepts:**

1. **Event Classes** - Define events as regular TypeScript classes
2. **EventWriter** - Used to send events from a system
3. **EventReader** - Used to receive events in a system (each system has its own read cursor)
4. **Frame Retention** - Events persist for 2 frames by default, ensuring cross-phase communication

**Defining Events:**

```typescript
// Events are just classes - no decoration needed
class PlayerDamagedEvent {
  constructor(public damage: number, public source: string) {}
}

class EnemySpawnedEvent {
  constructor(public enemyType: string, public position: Vector3) {}
}
```

**Registering Events:**

Events must be registered before use (typically in application setup):

```typescript
const app = new Application(config);
app.addEvent(PlayerDamagedEvent);
app.addEvent(EnemySpawnedEvent);
```

**Sending Events:**

```typescript
const damageSystem = system(({ commands }) => {
  const writer = commands.eventWriter(PlayerDamagedEvent);

  // Send event when damage occurs
  if (playerTookDamage) {
    writer.send(new PlayerDamagedEvent(10, 'enemy-attack'));
  }
});
```

**Reading Events:**

```typescript
const uiSystem = system(({ commands }) => {
  const reader = commands.eventReader(PlayerDamagedEvent);

  // Read all new events since last frame
  for (const event of reader.read()) {
    console.log(`Player took ${event.damage} damage from ${event.source}`);
    updateHealthBar(event.damage);
  }
});
```

**Multiple Readers:**

Each system maintains its own read cursor, so multiple systems can independently consume the same events:

```typescript
// Both systems will receive the same PlayerDamagedEvent
const healthUISystem = system(({ commands }) => {
  for (const event of commands.eventReader(PlayerDamagedEvent).read()) {
    updateHealthBar(event.damage);
  }
});

const soundSystem = system(({ commands }) => {
  for (const event of commands.eventReader(PlayerDamagedEvent).read()) {
    playDamageSound(event.damage);
  }
});
```

**Frame Retention:**

Events are retained for 2 frames by default. This ensures:
- Systems in different phases (update vs render) can read the same event
- Late-running systems don't miss events sent earlier in the frame

Configure retention if needed:

```typescript
const events = app.getResource(Events);
events.setRetentionFrames(3); // Keep events for 3 frames
events.setAutoClear(false);   // Disable automatic cleanup (call maintain() manually)
```

**Important Notes:**
- Events are automatically cleaned up at frame end (after all systems run)
- `eventReader()` can only be called inside systems (requires system identity)
- `eventWriter()` can be called anywhere with access to commands
- Events use class names as keys, so ensure unique class names
- The `Events` resource is registered automatically in `Application.addBuiltInSystems()`

## Code Style

- Use strict TypeScript types, avoid `any`
- Prefer type inference when obvious
- When console logging objects, always use `JSON.stringify`

## ImGui Binding Limitations (jsimgui)

**CRITICAL**: The jsimgui WASM bindings have issues with functions that return `ImVec2` directly. These functions will throw runtime errors like `Cannot call ImGui_GetWindowPos due to unbound types: 8ImVec2_t`.

### Functions that DON'T work (throw runtime errors):
- `ImGui.GetWindowPos()` - throws unbound type error
- `ImGui.GetWindowSize()` - throws unbound type error
- `ImGui.GetCursorScreenPos()` - throws unbound type error
- `ImGui.GetCursorPos()` - throws unbound type error
- `ImGui.GetItemRectMin()` - throws unbound type error
- `ImGui.GetItemRectMax()` - throws unbound type error
- `ImGui.GetMousePos()` - throws unbound type error

### Functions that DO work:
- `ImGui.GetWindowWidth()` - returns number
- `ImGui.GetWindowHeight()` - returns number
- `ImGui.GetCursorPosX()` - returns number
- `ImGui.GetCursorPosY()` - returns number
- `ImGui.GetScrollX()` - returns number
- `ImGui.GetScrollY()` - returns number
- `ImGui.GetFrameHeight()` - returns number
- `ImGui.GetMainViewport().Pos` - works (property access on bound object)
- `ImGui.GetMainViewport().Size` - works (property access on bound object)
- `ImGui.GetIO().MousePos` - works (property access on bound object)

### Workaround Pattern:
Instead of `GetCursorScreenPos()`, calculate manually:
```typescript
// DON'T do this - will throw:
// const pos = ImGui.GetCursorScreenPos();

// DO this instead:
const mainViewport = ImGui.GetMainViewport();
const io = ImGui.GetIO();
// Use mainViewport.Pos, mainViewport.Size, io.MousePos for coordinates
// Use GetCursorPosX(), GetCursorPosY() for window-local positions
```

## Game-Specific Documentation

For the **Slay the Spire-style game** in `apps/game/`:

- **Location**: `apps/game/`
- **Documentation**: See [`apps/game/LLM_DOCUMENTATION.md`](apps/game/LLM_DOCUMENTATION.md) for architecture patterns, examples, and LLM instructions specific to the game codebase.
