# VoidScript Engine Roadmap

> **Vision**: A production-ready TypeScript game engine with ECS architecture, capable of shipping games to Desktop, Web, and Mobile platforms.

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
| **0.3.0** | Save/load, scenes, input actions working | Planned |
| **0.4.0** | Standalone editor, undo/redo, profiler | Planned |
| **1.0.0** | Production-ready, particle system, localization | Planned |

---

## Current State

### What Works
- [x] ECS Core (archetype-based, efficient queries, command buffer)
- [x] 2D Sprite Rendering (sprites, VSL shaders, 19 post-processing effects)
- [x] Editor (play/pause/stop, hierarchy, inspector, animation/sprite/state-machine editors)
- [x] Asset System (lazy loading, JSON manifest, 13+ asset types)
- [x] World Serialization (snapshots, entity ID remapping)
- [x] Basic Tauri Integration (apps/kingdom/src-tauri)

### Critical Gaps
- [ ] Build/Export Pipeline
- [ ] Asset Packing
- [ ] Editor/Engine Separation
- [ ] Save/Load System
- [ ] Scene Management
- [ ] Test Coverage (currently 3 test files)

---

## Target Architecture

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

---

## Phase 1: Foundation (4-6 weeks)

**Goal**: Separate editor from engine, enable external projects

**Milestone**: Can create and run projects outside the monorepo

### 1.1 Editor Package Separation
- [ ] Create `packages/editor/` package structure
- [ ] Move `src/editor/` to new package
- [ ] Move editor panels from `src/app/imgui/`
- [ ] Move editor-specific systems and managers
- [ ] Create engine/editor interface contract
- [ ] Update all imports across codebase
- [ ] Verify engine runs standalone without editor
- [ ] Add tests for editor initialization

### 1.2 CLI Tool Package
- [ ] Create `packages/cli/` package
- [ ] Implement `voidscript create <name>` command
- [ ] Create project template files
- [ ] Implement `voidscript dev` command
- [ ] Add project configuration schema (`voidscript.config.ts`)
- [ ] Document CLI usage

### 1.3 Runtime Mode Flag
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

---

## Phase 2: Asset & Build Pipeline (4-6 weeks)

**Goal**: Pack assets and export distributable games

**Milestone**: Can export playable desktop and web games

### 2.1 Asset Packing System
- [ ] Define .vpk pack format specification
- [ ] Implement asset packer CLI command
- [ ] Create VirtualFileSystem abstraction
- [ ] Implement pack reader
- [ ] Add gzip compression support
- [ ] Integrate with asset loader
- [ ] Add asset hash verification

### 2.2 Build Export Pipeline
- [ ] Implement `voidscript export` command
- [ ] Tauri desktop export (Windows, macOS, Linux)
- [ ] Web export (static files)
- [ ] Generate platform-specific configs
- [ ] Bundle optimization (minification, tree-shaking)
- [ ] Asset copying/packing during build

### 2.3 Scene System
- [ ] Create SceneManager resource
- [ ] Define Scene asset type
- [ ] Implement scene loading/unloading
- [ ] Add scene transition system
- [ ] Implement persistent entities
- [ ] Add additive scene loading
- [ ] Create scene serialization format

**Files to Create**:
- `packages/cli/src/commands/pack.ts`
- `packages/cli/src/commands/export.ts`
- `packages/engine/src/asset/virtual-fs.ts`
- `packages/engine/src/asset/pack-reader.ts`
- `packages/engine/src/scene/scene-manager.ts`
- `packages/engine/src/scene/scene-asset.ts`
- `packages/engine/src/scene/scene-loader.ts`

---

## Phase 3: Game Features (4-6 weeks)

**Goal**: Essential systems for shipping complete games

**Milestone**: Can ship a complete single-player game

### 3.1 Save/Load System
- [ ] Create SaveManager resource
- [ ] Implement save serialization
- [ ] Add save slot management
- [ ] Implement save versioning
- [ ] Add migration system for old saves
- [ ] Create Saveable component marker
- [ ] Add auto-save functionality

### 3.2 Input Action System
- [ ] Create InputMap configuration
- [ ] Implement action bindings
- [ ] Add gamepad support
- [ ] Implement input contexts
- [ ] Add rebindable controls
- [ ] Implement input buffering

### 3.3 Audio Improvements
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
- [ ] Scene system tests (target: 70%)
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
- [ ] Implement project manager UI
- [ ] Add recent projects list
- [ ] Implement project settings panel
- [ ] Add build/export from editor
- [ ] Create installer/distribution

### 4.2 Undo/Redo System
- [ ] Implement command pattern
- [ ] Create operation history
- [ ] Track component changes
- [ ] Track entity operations
- [ ] Track hierarchy changes
- [ ] Add undo groups
- [ ] Keyboard shortcuts (Ctrl+Z, Ctrl+Y)

### 4.3 Prefab Improvements
- [ ] Implement prefab variants
- [ ] Add nested prefabs support
- [ ] Create prefab overrides UI
- [ ] Add batch prefab updates

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

## Success Metrics

| Phase | Metric | Target |
|-------|--------|--------|
| 1 | External project creation | Works |
| 1 | Editor/engine separation | Clean interface |
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
