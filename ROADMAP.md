# VoidScript Engine Roadmap

> **Vision**: A production-ready TypeScript game engine with ECS architecture, capable of shipping **2D and 3D** games to Desktop, Web, and Mobile platforms.

## Quick Navigation

- [Current State](#current-state)
- [Phase 1: Foundation](#phase-1-foundation-4-6-weeks)
- [Phase 2: Asset & Build Pipeline](#phase-2-asset--build-pipeline-4-6-weeks)
- [Phase 3: Game Features](#phase-3-game-features-4-6-weeks)
- [Phase 4: Editor Polish](#phase-4-editor-polish-4-6-weeks)
- [Phase 5: Advanced Features](#phase-5-advanced-features-ongoing)

---

## Version Milestones

| Version | Milestone | Status |
|---------|-----------|--------|
| **0.1.0** | Editor separated from engine, external projects possible | Planned |
| **0.2.0** | Can export playable desktop/web games | Planned |
| **0.3.0** | Save/load, input actions working | Planned |
| **0.4.0** | Standalone editor, undo/redo, profiler | Planned |
| **1.0.0** | Production-ready, particle system, localization | Planned |

---

## Current State

### What Works
- [x] ECS Core (archetype-based, efficient queries, command buffer)
- [x] 2D Sprite Rendering (sprites, VSL shaders, 19 post-processing effects)
- [x] Editor (play/pause/stop, hierarchy, inspector, animation/sprite/state-machine editors)
- [x] Asset System (lazy loading, JSON manifest, 13+ asset types)
- [x] Scene Serialization (snapshots, entity ID remapping) - currently called "World"
- [x] Basic Tauri Integration (apps/kingdom/src-tauri)

### Critical Gaps
- [ ] Build/Export Pipeline
- [ ] Asset Packing
- [ ] Editor/Engine Separation
- [ ] Project Settings System
- [ ] Save/Load System
- [ ] File Browser (separate from Asset Browser)
- [ ] Test Coverage (currently 3 test files)

---

## Target Architecture

### Package Structure
```
packages/
  @voidscript/core/         # ECS, math, utilities
  @voidscript/renderer/     # Three.js, shaders, post-processing
  @voidscript/physics/      # Rapier 2D/3D
  @voidscript/audio/        # Audio system
  @voidscript/engine/       # Full runtime (combines above)
  @voidscript/editor/       # Editor UI, tools (separate)
  @voidscript/cli/          # Build tools, project creation

apps/
  editor/                   # Standalone editor application
```

> **IMPORTANT: Three.js Re-export**
>
> The engine **re-exports Three.js** so users don't need to install it separately. All Three.js types and classes should be imported from `@voidscript/engine` (or `@voidscript/renderer`), not from `three` directly. This ensures version consistency and simplifies project setup.
>
> ```typescript
> // DO THIS:
> import { Vector3, Mesh, Scene } from '@voidscript/engine';
>
> // NOT THIS:
> import { Vector3 } from 'three';
> ```

### 2D and 3D Support

The engine supports both **2D and 3D** game development. After the standalone editor is complete, we will ensure:
- Clear separation between 2D and 3D workflows in the editor
- Easy switching or mixing of 2D/3D in the same project
- Consistent component patterns for both (Transform3D works for 2D with z=0)
- 2D-specific tools (sprite editor, tilemap) alongside 3D tools (model viewer, scene gizmos)

### Project Structure (Created by CLI)
```
my-game/                                    # Git repo root
  project/
    settings/
      physics.yaml                          # Gravity, timestep, layers
      renderer.yaml                         # Pixels per unit, clear color
      audio.yaml                            # Master volume, bus config
      input.yaml                            # Input action mappings
      build.yaml                            # Entry scene, included scenes, platforms
    scenes/
      main-menu.scene.yaml
      level-1.scene.yaml
    assets/
      textures/
      audio/
      animations/
    src/
      main.ts
      systems/
      components/

  editor/
    settings/
      preferences.yaml                      # Grid size, snap, theme (shared with team)
```

### Editor App Data (Tauri paths, outside project)
```
~/.local/share/voidscript/                  # Linux (or platform equivalent)
~/Library/Application Support/voidscript/   # macOS
%APPDATA%/voidscript/                       # Windows

  layout.json                               # Window positions, panel sizes
  window-state.json                         # Last window size/position/maximized
  recent-projects.json                      # List of recent projects with paths
  project-states/
    <project-hash>/
      recent-scenes.json                    # Recent scenes for this project
      last-opened.json                      # Last opened scene, selection state
  cache/
    thumbnails/                             # Asset thumbnails
    compiled-shaders/                       # Cached shader compilation
```

**Note**:
- `project/` is version controlled and shipped with the game
- `editor/settings/` is version controlled (team shares editor preferences)
- App data (layout, recent projects, cache) is local to each machine via Tauri's `appDataDir`

---

## Key Terminology Changes

| Old Term | New Term | Reason |
|----------|----------|--------|
| World | Scene | More intuitive, matches industry standard |
| World serialization | Scene file (.scene.yaml) | Clearer purpose |

The current `World` class remains as the ECS runtime container. "Scene" refers to the serialized format and loading/unloading operations.

---

## Phase 1: Foundation (4-6 weeks)

**Goal**: Separate editor from engine, enable external projects

**Milestone**: Can create and run projects outside the monorepo

### 1.1 Editor Package Separation

> **IMPORTANT: ImGui API Abstraction Requirement**
>
> The `@voidscript/editor` package and standalone editor application **MUST completely wrap the ImGui API**. Developers creating editor extensions, custom inspectors, or editor plugins should **NEVER**:
> - Import directly from `imgui` or `@mori2003/jsimgui`
> - See ImGui function names or types in their code
> - Deal with jsimgui binding limitations or workarounds
>
> All ImGui interactions must go through our abstraction layer (`EditorLayout`, `EditorWidgets`, etc.). This includes:
> - Mouse position workarounds (jsimgui's `GetCursorScreenPos()` doesn't work)
> - Coordinate system conversions
> - Popup/modal management
> - Input handling quirks
>
> These hacks and workarounds should be **encapsulated once** in EditorLayout and related utilities, so users get a clean, consistent API without needing to know ImGui internals.

- [ ] Create `packages/editor/` package structure
- [ ] Move `src/editor/` to new package
- [ ] Move editor panels from `src/app/imgui/`
- [ ] Move editor-specific systems and managers
- [ ] Create engine/editor interface contract
- [ ] **Wrap all ImGui calls in EditorLayout/EditorWidgets abstractions**
- [ ] **Ensure no imgui imports leak to public API**
- [ ] Update all imports across codebase
- [ ] Verify engine runs standalone without editor
- [ ] Add tests for editor initialization

### 1.2 World → Scene Rename
- [ ] Rename serialization format from `.world.yaml` to `.scene.yaml`
- [ ] Update WorldSerializer → SceneSerializer
- [ ] Add SceneManager convenience API for loading/unloading
- [ ] Implement persistent entities (survive scene changes)
- [ ] Add scene load options (clear, merge, preserve entities)
- [ ] Update all documentation and comments

### 1.3 CLI Tool Package
- [ ] Create `packages/cli/` package
- [ ] Implement `voidscript create <name>` command
- [ ] Create project template with folder structure
- [ ] Generate default settings files
- [ ] Implement `voidscript dev` command
- [ ] Document CLI usage

### 1.4 Project Settings System
- [ ] Define settings file schema (YAML)
- [ ] Create SettingsManager to load/save settings
- [ ] Implement physics.yaml loader
- [ ] Implement renderer.yaml loader
- [ ] Implement audio.yaml loader
- [ ] Implement input.yaml loader
- [ ] Implement build.yaml loader
- [ ] Settings hot-reload in editor (optional)

### 1.5 Runtime Mode Flag
- [ ] Add `VOIDSCRIPT_RUNTIME_ONLY` build flag
- [ ] Conditional imports for editor code
- [ ] Verify tree-shaking works
- [ ] Measure bundle size reduction

**Files to Create/Modify**:
- `packages/editor/package.json`
- `packages/editor/src/index.ts`
- `packages/cli/package.json`
- `packages/cli/src/commands/create.ts`
- `packages/cli/src/commands/dev.ts`
- `packages/cli/src/templates/`
- `packages/engine/src/settings/settings-manager.ts`
- `packages/engine/src/settings/schemas/`

---

## Phase 2: Asset & Build Pipeline (4-6 weeks)

**Goal**: Pack assets and export distributable games

**Milestone**: Can export playable desktop and web games

### 2.1 File Browser Panel
- [ ] Create File Browser panel (separate from Asset Browser)
- [ ] Show actual disk contents of project/assets/
- [ ] Display import status indicator per file
  - ✓ = in manifest (imported)
  - ⚠ = not in manifest (not imported)
- [ ] Right-click → Import action
- [ ] Import dialog with asset-type-specific options
  - Textures: filter, wrap, sprite slicing
  - Audio: (future: compression settings)
  - Models: scale, rotation
- [ ] Drag files from OS into File Browser
- [ ] Delete/rename/move files

### 2.2 Asset Packing System
- [ ] Define .vpk pack format specification
- [ ] Implement asset packer CLI command
- [ ] Create VirtualFileSystem abstraction
- [ ] Implement pack reader
- [ ] Add gzip compression support
- [ ] Integrate with asset loader
- [ ] Add asset hash verification

### 2.3 Build Export Pipeline
- [ ] Implement `voidscript export` command
- [ ] Read build.yaml for entry scene and included assets
- [ ] Tauri desktop export (Windows, macOS, Linux)
- [ ] Web export (static files)
- [ ] Generate platform-specific configs
- [ ] Bundle optimization (minification, tree-shaking)
- [ ] Asset copying/packing during build

**Files to Create**:
- `packages/editor/src/panels/file-browser.ts`
- `packages/editor/src/dialogs/import-dialog.ts`
- `packages/cli/src/commands/pack.ts`
- `packages/cli/src/commands/export.ts`
- `packages/engine/src/asset/virtual-fs.ts`
- `packages/engine/src/asset/pack-reader.ts`

---

## Phase 3: Game Features (4-6 weeks)

**Goal**: Essential systems for shipping complete games

**Milestone**: Can ship a complete single-player game

### 3.1 Save/Load System
- [ ] Create SaveManager resource
- [ ] Implement save serialization (separate from scene serialization)
- [ ] Add save slot management
- [ ] Implement save versioning
- [ ] Add migration system for old saves
- [ ] Create Saveable component marker
- [ ] Add auto-save functionality
- [ ] Save file location (user data directory)

### 3.2 Input Action System
- [ ] Load input mappings from input.yaml
- [ ] Create InputMap runtime configuration
- [ ] Implement action bindings
- [ ] Add gamepad support
- [ ] Implement input contexts (UI vs gameplay)
- [ ] Add rebindable controls (runtime)
- [ ] Save rebinds to user preferences
- [ ] Implement input buffering

### 3.3 Audio Improvements
- [ ] Load audio config from audio.yaml
- [ ] Create audio bus/mixer system
- [ ] Implement 3D spatial audio
- [ ] Add audio pooling
- [ ] Implement music crossfading
- [ ] Add audio snapshots

### 3.4 Test Coverage Expansion
- [ ] ECS core tests (target: 80%)
- [ ] Serialization tests (target: 70%)
- [ ] Asset system tests (target: 60%)
- [ ] Animation tests (target: 50%)
- [ ] Settings system tests (target: 70%)
- [ ] Save system tests (target: 80%)

**Files to Create**:
- `packages/engine/src/save/save-manager.ts`
- `packages/engine/src/save/save-serializer.ts`
- `packages/engine/src/save/save-migration.ts`
- `packages/engine/src/app/input-action.ts`
- `packages/engine/src/app/input-mapping.ts`
- `packages/engine/src/audio/audio-mixer.ts`

---

## Phase 4: Editor Polish (4-6 weeks)

**Goal**: Professional editor experience

**Milestone**: Editor comparable to Godot/Unity basics

### 4.1 Standalone Editor Application
- [ ] Create `apps/editor/` structure
- [ ] Implement project manager UI (open/create)
- [ ] Load/save recent projects from Tauri appDataDir
- [ ] Load project settings from project/settings/
- [ ] Load shared editor prefs from editor/settings/preferences.yaml
- [ ] Load/save window layout from Tauri appDataDir
- [ ] Per-project state (recent scenes, last opened) in appDataDir
- [ ] Implement project settings panel (edit YAML files via UI)
- [ ] Add build/export from editor menu
- [ ] Create installer/distribution

### 4.2 SerializableObject API & Undo/Redo System

The `SerializableObject`/`SerializableProperty` API provides a unified way to edit component data with built-in change tracking, dirty flags, and undo/redo support. All inspector edits go through this API.

**Benefits:**
- Automatic `isDirty` tracking per component/entity
- Undo/redo recording without manual command creation
- Diff-based serialization (only changed properties)
- Change notifications for UI updates
- Batch operations (multiple changes = single undo step)

**API Design:**
```typescript
// Wrap component for editing
const so = new SerializableObject(entity, Transform3D);

// Find and modify properties
const posProp = so.findProperty('position');
posProp.vector3Value = new Vector3(1, 2, 3); // Auto-records undo

// Check state
so.isDirty;           // true if any property changed
so.hasModifiedProperties;
so.applyModifiedProperties(); // Commit changes
so.revertAllProperties();     // Discard changes

// Nested properties
const xProp = so.findProperty('position.x');
xProp.floatValue = 5;
```

- [ ] Design SerializableObject class wrapping entity+component
- [ ] Design SerializableProperty for individual fields
- [ ] Support primitive types (float, int, bool, string)
- [ ] Support complex types (Vector3, Color, RuntimeAsset)
- [ ] Support nested properties (position.x, rotation.y)
- [ ] Support array properties
- [ ] Implement `isDirty` tracking per property
- [ ] Implement `applyModifiedProperties()` / `revertAllProperties()`
- [ ] Integrate with undo/redo command history
- [ ] Create operation history with configurable depth
- [ ] Track entity creation/deletion operations
- [ ] Track hierarchy changes (parent/child)
- [ ] Add undo groups (batch multiple changes)
- [ ] Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
- [ ] Update all inspector panels to use SerializableObject

### 4.3 Prefab Editor & Improvements

A dedicated **Prefab Editor** for editing prefabs in isolation, similar to Unity's prefab mode. Opens prefab in a separate view with its own scene context.

- [ ] Create Prefab Editor panel/mode
- [ ] Edit prefab in isolation (separate scene context)
- [ ] Live preview of prefab changes
- [ ] Implement prefab variants
- [ ] Add nested prefabs support
- [ ] Create prefab overrides UI
- [ ] Add batch prefab updates
- [ ] "Open Prefab" action from hierarchy/inspector

### 4.4 Performance Profiler
- [ ] System execution timing
- [ ] Frame time breakdown
- [ ] Memory tracking
- [ ] Entity/component counts
- [ ] Debug overlay toggle

### 4.5 Debug Console
- [ ] In-game command console
- [ ] Variable inspection
- [ ] Log viewer
- [ ] Cheat framework

**Files to Create**:
- `apps/editor/src/main.ts`
- `apps/editor/src/project-manager.ts`
- `apps/editor/src-tauri/tauri.conf.json`
- `packages/editor/src/panels/project-settings-panel.ts`
- `packages/editor/src/serialization/serializable-object.ts`
- `packages/editor/src/serialization/serializable-property.ts`
- `packages/editor/src/serialization/property-types/` (per-type handlers)
- `packages/editor/src/undo-redo/command-history.ts`
- `packages/editor/src/undo-redo/operations/`
- `packages/engine/src/debug/profiler.ts`
- `packages/engine/src/debug/console.ts`

---

## Phase 5: Advanced Features (Ongoing)

**Goal**: Competitive feature set

### Particle System
- [ ] GPU particle rendering
- [ ] Particle emitter components
- [ ] Visual particle editor
- [ ] Particle pooling

### Animation Blending
- [ ] Transition blending
- [ ] Blend trees (1D/2D)
- [ ] Animation layers
- [ ] Basic IK

### Localization
- [ ] String tables
- [ ] Language switching
- [ ] Font fallbacks
- [ ] RTL support

### UI System Enhancement
- [ ] Anchoring/layout system
- [ ] UI transitions/animations
- [ ] Focus navigation
- [ ] Better text rendering

### Mobile Export
- [ ] Tauri mobile integration
- [ ] Touch input support
- [ ] Mobile-specific optimizations

### Plugin System
- [ ] Plugin API definition
- [ ] Plugin loading mechanism
- [ ] Plugin marketplace integration

---

## Future Considerations (Not Planned)

These features are acknowledged but not currently prioritized:

- Networking/Multiplayer
- Visual Scripting
- 3D Lighting (VSL light() function)
- Terrain System
- Modding Support
- Asset Import Pipeline (.psd, .aseprite auto-conversion)
- Hot Reload

---

## Settings File Examples

### project/settings/physics.yaml
```yaml
gravity:
  x: 0
  y: -9.8
  z: 0
fixedTimestep: 0.016
velocityIterations: 8
positionIterations: 3
layers:
  - name: default
  - name: player
  - name: enemies
  - name: projectiles
collisionMatrix:
  player: [enemies, projectiles]
  enemies: [player, projectiles]
```

### project/settings/renderer.yaml
```yaml
pixelsPerUnit: 16
clearColor: "#1a1a2e"
antialiasing: false
pixelPerfect: true
defaultSortingLayer: "default"
sortingLayers:
  - background
  - default
  - foreground
  - ui
```

### project/settings/build.yaml
```yaml
gameName: "My Game"
version: "1.0.0"
entryScene: "scenes/main-menu.scene.yaml"
includedScenes:
  - "scenes/**/*.scene.yaml"
platforms:
  desktop:
    wrapper: tauri
    targets: [windows, macos, linux]
  web:
    enabled: true
    serverRequired: false
```

### editor/settings/preferences.yaml (in project, shared with team)
```yaml
theme: dark
gridSize: 16
snapToGrid: true
showGrid: true
autoSaveInterval: 300
defaultZoom: 1.0
```

### App Data: layout.json (Tauri appDataDir, local to machine)
```json
{
  "panels": {
    "hierarchy": { "width": 250, "visible": true },
    "inspector": { "width": 300, "visible": true },
    "assets": { "height": 200, "visible": true }
  },
  "windowState": {
    "width": 1920,
    "height": 1080,
    "x": 100,
    "y": 100,
    "maximized": false
  }
}
```

---

## Success Metrics

| Phase | Metric | Target |
|-------|--------|--------|
| 1 | External project creation | Works |
| 1 | Editor/engine separation | Clean interface |
| 1 | Settings loaded from YAML | All 5 settings files |
| 2 | File browser import flow | Works |
| 2 | Export to desktop | < 5 min build time |
| 2 | Bundle size (web) | < 2MB gzipped |
| 3 | Test coverage | > 60% overall |
| 3 | Save/load reliability | 100% round-trip |
| 4 | Editor startup time | < 3 seconds |
| 4 | Undo/redo history | 100+ operations |

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Editor separation breaks functionality | Medium | High | Incremental extraction with tests |
| Asset packing performance issues | Low | Medium | Start simple, optimize later |
| Tauri mobile immature | Medium | Low | Desktop-first, mobile deferred |
| Scope creep | High | High | Strict phase gates, MVP focus |

---

## How to Contribute

1. Check the current phase in progress
2. Pick an unchecked item from the checklist
3. Create a branch: `feature/phase-X-item-name`
4. Implement with tests
5. Submit PR with checklist item referenced

---

## Changelog

### 2024-12-31
- Initial roadmap created
- Current state assessment completed
- Architecture plan defined
- 5 phases outlined with detailed tasks

### 2024-12-31 (Update)
- Renamed World → Scene terminology
- Added Project Settings System (project/settings/*.yaml)
- Added Editor Settings (editor/settings/*.yaml)
- Added File Browser panel (separate from Asset Browser)
- Removed redundant "Scene System" (Scene = renamed World serialization)
- Added settings file examples
