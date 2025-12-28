// ECS core (excluding Application which is replaced by the enhanced version)
export type { Entity, EntityMetadata } from "./ecs/entity.js";
export {
  EntityManager,
  INVALID_ENTITY,
  packEntity,
  entityId,
  entityGeneration,
} from "./ecs/entity.js";
export type { ComponentType } from "./ecs/component.js";
export {
  ComponentRegistry,
  defineComponent,
  component,
  globalComponentRegistry,
} from "./ecs/component.js";
export { Archetype, ArchetypeGraph } from "./ecs/archetype.js";
export { World, EntityBuilder } from "./ecs/world.js";
export type { WorldEvent } from "./ecs/world.js";
export { EventEmitter } from "./ecs/event-emitter.js";
export { Query } from "./ecs/query.js";
export { Command, EntityHandle, EntityCommandBuilder, EntityCommands } from "./ecs/command.js";
export { Scheduler } from "./ecs/scheduler.js";
export type { SystemPhase } from "./ecs/scheduler.js";
export { SchedulerRunner } from "./ecs/scheduler-runner.js";
export { system } from "./ecs/system.js";
export type { SystemFunction, SystemArguments, SystemWrapper, SystemMetadata, SystemRunCondition } from "./ecs/system.js";

// Bundle system
export type {
  BundleSchema,
  BundleType,
  BundleSpawnData,
  ComponentConfig,
  PropertyConfig,
  RequiredPropertyConfig,
  OptionalPropertyConfig,
  HiddenPropertyConfig,
} from "./ecs/bundle.js";
export {
  bundle,
  componentConfig,
  requiredProperty,
  optionalProperty,
  hiddenProperty,
  resolveComponentData,
  resolveBundleComponents,
} from "./ecs/bundle.js";
export { BundleRegistry, globalBundleRegistry, registerBundle } from "./ecs/bundle-registry.js";
export { Sprite2DBundle } from "./ecs/bundles/index.js";

// ECS Components
export { Name } from "./ecs/components/name.js";
export type { NameData } from "./ecs/components/name.js";
export { Parent } from "./ecs/components/parent.js";
export { Children } from "./ecs/components/children.js";
export { SceneRoot } from "./ecs/components/scene-root.js";
export type { SceneRootData } from "./ecs/components/scene-root.js";
export { SceneChild } from "./ecs/components/scene-child.js";
export type { SceneChildData } from "./ecs/components/scene-child.js";

// ECS Serialization
export {
  WorldSerializer,
  DefaultSerializer,
  SetSerializer,
  ParentSerializer,
  ChildrenSerializer,
  ComponentRegistryEntrySchema,
  SerializedComponentSchema,
  SerializedEntitySchema,
  WorldMetadataSchema,
  WorldSchema,
} from "./ecs/serialization/index.js";
export type {
  ComponentSerializer,
  SerializationContext,
  DeserializationContext,
  DeserializeMode,
  DeserializeOptions,
  DeserializeResult,
  SerializationStats,
  ComponentRegistryEntry,
  SerializedComponent,
  SerializedEntity,
  WorldMetadata,
  WorldData,
} from "./ecs/serialization/index.js";

// Scene System
export { SceneManager } from "./ecs/scene-manager.js";
export { SceneSerializer } from "./ecs/scene-serializer.js";
export type {
  SceneAsset,
  SceneData,
  InstantiateSceneOptions,
  InstantiateSceneResult,
} from "./ecs/scene-asset.js";
export type { SaveSceneOptions } from "./ecs/scene-serializer.js";

// Asset System
export { RuntimeAsset, isRuntimeAsset } from "./ecs/runtime-asset.js";
export { RuntimeAssetManager } from "./ecs/runtime-asset-manager.js";
export { AssetDatabase } from "./ecs/asset-database.js";
export { AssetLoaderRegistry } from "./ecs/asset-loader-registry.js";
export { preloadAssets, preloadWorldAssets, findAllRuntimeAssets } from "./ecs/asset-preloader.js";
export type { AssetLoadProgress, PreloadAssetsOptions } from "./ecs/asset-preloader.js";
export { assetRef, isAssetRef } from "./ecs/asset-ref.js";
export type { AssetRef } from "./ecs/asset-ref.js";
export {
  AssetType,
  TextureFilter,
  TextureWrap,
  isTextureMetadata,
  isSceneMetadata,
  isAnimationMetadata,
  isAudioAssetMetadata,
  isUnknownAssetMetadata,
  isTiledSpriteDefinition,
  isRectSpriteDefinition,
} from "./ecs/asset-metadata.js";
export type {
  GUID,
  BaseAssetMetadata,
  TextureMetadata,
  SceneMetadata,
  AnimationMetadata,
  AudioAssetMetadata,
  UnknownAssetMetadata,
  AssetMetadata,
  BaseSpriteDefinition,
  TiledSpriteDefinition,
  RectSpriteDefinition,
  SpriteDefinition,
} from "./ecs/asset-metadata.js";
export type {
  AssetConfig,
  BaseAssetConfig,
  TextureAssetConfig,
  Model3DAssetConfig,
  AnimationAssetConfig,
  AssetsConfig,
} from "./ecs/asset-database.js";

// Asset Manifest (for standalone/JSON-based asset loading)
export { AssetManifestLoader, loadManifest, createManifest } from "./ecs/asset-manifest.js";
export type {
  AssetManifest,
  ManifestAssetEntry,
  ManifestLoadOptions,
  ManifestLoadResult,
} from "./ecs/asset-manifest.js";

// Application module (Layer architecture, Input, Events, Renderer)
// This exports the enhanced Application class with Layer support
export * from './app/index.js';

// Rendering Components (3D)
export { Transform3D } from "./ecs/components/rendering/transform-3d.js";
export type { Transform3DData } from "./ecs/components/rendering/transform-3d.js";
export {
  LocalTransform3D,
  computeWorldTransform,
  computeLocalTransform,
  IDENTITY_LOCAL_TRANSFORM,
} from "./ecs/components/rendering/local-transform-3d.js";
export type { LocalTransform3DData } from "./ecs/components/rendering/local-transform-3d.js";
export { Camera } from "./ecs/components/rendering/camera.js";
export type { CameraData } from "./ecs/components/rendering/camera.js";
export { CameraClearColor } from "./ecs/components/rendering/camera-clear-color.js";
export type { CameraClearColorData } from "./ecs/components/rendering/camera-clear-color.js";
export { MainCamera } from "./ecs/components/rendering/main-camera.js";
export type { MainCameraData } from "./ecs/components/rendering/main-camera.js";
export { VirtualCamera } from "./ecs/components/rendering/virtual-camera.js";
export type { VirtualCameraData } from "./ecs/components/rendering/virtual-camera.js";
export { VirtualCameraBounds } from "./ecs/components/rendering/virtual-camera-bounds.js";
export type { VirtualCameraBoundsData } from "./ecs/components/rendering/virtual-camera-bounds.js";
export { VirtualCameraFollow } from "./ecs/components/rendering/virtual-camera-follow.js";
export type { VirtualCameraFollowData, FollowMode } from "./ecs/components/rendering/virtual-camera-follow.js";
export { CameraBrain } from "./ecs/components/rendering/camera-brain.js";
export type { CameraBrainData, BlendCurve } from "./ecs/components/rendering/camera-brain.js";
export {
  Light3D,
  createDirectionalLight,
  createPointLight,
  createSpotLight,
  createAmbientLight,
  isDirectionalLight,
  isPointLight,
  isSpotLight,
  isAmbientLight,
  DEFAULT_SHADOW_CONFIG,
} from "./ecs/components/rendering/light-3d.js";
export type {
  Light3DData,
  LightType,
  LightColor,
  ShadowConfig,
  DirectionalLightData,
  PointLightData,
  SpotLightData,
  AmbientLightData,
} from "./ecs/components/rendering/light-3d.js";
export { Mesh3D } from "./ecs/components/rendering/mesh-3d.js";
export type { Mesh3DData, GeometryData, GeometryType } from "./ecs/components/rendering/mesh-3d.js";
export { GLTFModel } from "./ecs/components/rendering/gltf-model.js";
export type { GLTFModelData } from "./ecs/components/rendering/gltf-model.js";
export { FBXModel } from "./ecs/components/rendering/fbx-model.js";
export type { FBXModelData } from "./ecs/components/rendering/fbx-model.js";
export { Material3D } from "./ecs/components/rendering/material-3d.js";
export type { Material3DData } from "./ecs/components/rendering/material-3d.js";
export { RenderObject } from "./ecs/components/rendering/render-object.js";
export type { RenderObjectData } from "./ecs/components/rendering/render-object.js";

// Rendering Components (2D)
export {
  Sprite2D,
  calculateRenderOrder,
  calculateSpriteScale,
} from "./ecs/components/rendering/sprite-2d.js";
export type {
  Sprite2DData,
} from "./ecs/components/rendering/sprite-2d.js";
export { Water2D } from "./ecs/components/rendering/water-2d.js";
export type { Water2DData } from "./ecs/components/rendering/water-2d.js";
export { SkyGradient2D } from "./ecs/components/rendering/sky-gradient.js";
export type { SkyGradient2DData, GradientStop } from "./ecs/components/rendering/sky-gradient.js";
export { Fog2D, FogType } from "./ecs/components/rendering/fog-2d.js";
export type { Fog2DData } from "./ecs/components/rendering/fog-2d.js";
export { Rain2D } from "./ecs/components/rendering/rain-2d.js";
export type { Rain2DData } from "./ecs/components/rendering/rain-2d.js";
export { LightningField2D } from "./ecs/components/rendering/lightning-field-2d.js";
export type { LightningField2DData } from "./ecs/components/rendering/lightning-field-2d.js";

// Audio Components
export { AudioListener } from "./ecs/components/audio/audio-listener.js";
export type { AudioListenerData } from "./ecs/components/audio/audio-listener.js";
export { AudioSource } from "./ecs/components/audio/audio-source.js";
export type { AudioSourceData } from "./ecs/components/audio/audio-source.js";
export { PositionalAudioSource } from "./ecs/components/audio/positional-audio-source.js";
export type { PositionalAudioSourceData, DistanceModel } from "./ecs/components/audio/positional-audio-source.js";

// Generator Components
export { SpriteAreaGenerator, SpriteAreaGeneratorGenerated } from "./ecs/components/generators/sprite-area-generator.js";
export type { SpriteAreaGeneratorData } from "./ecs/components/generators/sprite-area-generator.js";

// Post-Processing Component
export { PostProcessing } from "./ecs/components/rendering/post-processing.js";
export type { PostProcessingData } from "./ecs/components/rendering/post-processing.js";

// ECS Systems (Animation)
export { animationUpdateSystem } from "./ecs/systems/animation-system.js";
export { tweenUpdateSystem } from "./ecs/systems/tween-system.js";

// ECS Systems (2D)
export {
  SpriteRenderManager,
  spriteSyncSystem,
} from "./ecs/systems/sprite-sync-system.js";
export {
  Water2DRenderManager,
  water2DSyncSystem,
} from "./ecs/systems/water-2d-system.js";
export {
  SkyGradientRenderManager,
  skyGradient2DSystem,
} from "./ecs/systems/sky-gradient-system.js";
export {
  LightningField2DRenderManager,
  lightningField2DSyncSystem,
} from "./ecs/systems/lightning-field-2d-system.js";

// ECS Systems (3D)
export {
  Render3DManager,
  transformPropagationSystem,
  render3DSyncSystem,
} from "./ecs/systems/renderer-sync-system.js";

// ECS Systems (Audio)
export { AudioManager } from "./ecs/systems/audio-manager.js";
export { audioSyncSystem, audioCleanupSystem } from "./ecs/systems/audio-sync-system.js";

// ECS Systems (Post-Processing)
export {
  postProcessingSystem,
  postProcessingCleanupSystem,
} from "./ecs/systems/post-processing-system.js";

// Post-Processing Module
export {
  PostProcessingManager,
  EFFECT_REGISTRY,
  getEffectMetadata,
  getEffectsByCategory,
  getEffectCategories,
  formatCategoryName,
  createPass,
  updatePass,
  disposePass,
} from "./post-processing/index.js";
export type {
  EffectConfig,
  EffectType,
  EffectCategory,
  EffectMetadata,
  BaseEffectConfig,
  FXAAConfig,
  SMAAConfig,
  SSAAConfig,
  TAAConfig,
  BloomConfig,
  SSAOConfig,
  SAOConfig,
  GTAOConfig,
  OutlineConfig,
  BokehConfig,
  FilmConfig,
  VignetteConfig,
  SepiaConfig,
  BrightnessContrastConfig,
  HueSaturationConfig,
  ColorCorrectionConfig,
  DotScreenConfig,
  GlitchConfig,
  PixelateConfig,
  HalftoneConfig,
  AfterimageConfig,
  RGBShiftConfig,
} from "./post-processing/index.js";

// Asset Loaders
export { loadTexture, TextureLoader, clearTextureCache } from "./loaders/texture-loader.js";
export type { TextureLoadOptions } from "./loaders/texture-loader.js";

// Rendering Utilities
export { TextRenderer } from "./rendering/text-renderer.js";
export type { TextOptions, TextMeasurement, TextAlign, TextBaseline } from "./rendering/text-renderer.js";
export { createNoiseTexture, createWaterNoiseTextures } from "./rendering/noise-texture.js";
export type { NoiseTextureOptions, WaterNoiseTextures } from "./rendering/noise-texture.js";
export { createMoonTexture, createSunTexture } from "./rendering/celestial-textures.js";
export type { MoonTextureOptions, SunTextureOptions, RGB } from "./rendering/celestial-textures.js";

// Sprite Materials
export * from "./rendering/sprite/index.js";

// Tiled Integration
export * from "./tiled/index.js";
export * from "./ecs/components/tiled/index.js";

// Animation - Tweening
export {
  Tween,
  TweenSequence,
  TweenParallel,
  TweenManager,
  Easing,
  lerp,
  lerpClamped,
  smoothDamp,
  moveTowards,
  pingPong,
  repeat,
} from "./animation/tween.js";
export type { TweenState, TweenConfig, EasingFunction } from "./animation/tween.js";

// Animation - Tracks and Clips
export {
  NumberTrack,
  Vector3Track,
  ColorTrack,
} from "./animation/animation-track.js";
export type { AnimationTrack, Color } from "./animation/animation-track.js";
export { AnimationClip, LoopMode } from "./animation/animation-clip.js";
export type { TrackValue } from "./animation/animation-clip.js";
export { AnimationManager } from "./animation/animation-manager.js";

// Animation - Property-Based System
export { PropertyTrack, getEasingFunction, getEasingName, getAvailableEasingNames } from "./animation/property-track.js";
export type { PropertyKeyframe, SerializedKeyframe } from "./animation/property-track.js";
export { parsePropertyPath, setNestedProperty, getNestedProperty } from "./animation/property-path.js";
export type { ResolvedPropertyPath } from "./animation/property-path.js";
export {
  InterpolationMode,
  getInterpolationMode,
  inferInterpolationMode,
  interpolateValue,
  lerpNumber,
  lerpVector3,
  lerpColor,
  isVector3Like,
  isColorLike,
  isSpriteValueLike,
} from "./animation/interpolation.js";
export type { SpriteValue } from "./animation/interpolation.js";

// Animation - Controller Component
export {
  AnimationController,
  createAnimationController,
  addAnimationAsset,
  removeAnimationAsset,
  playAnimation,
  stopAnimation,
  pauseAnimation,
  resumeAnimation,
  isPlayingClip,
  getCurrentClip,
  getAvailableAnimationIds,
  setAnimationSpeed,
} from "./ecs/components/animation/animation-controller.js";
export type { AnimationControllerData } from "./ecs/components/animation/animation-controller.js";

// Animation - JSON Parser
export {
  parseAnimationClipJson,
  easingFromString,
} from "./animation/animation-json-parser.js";
export type {
  AnimationClipJson,
  AnimationTrackJson,
  AnimationKeyframeJson,
  Vector3Json,
  ColorJson,
  SpriteValueJson,
  KeyframeValueJson,
} from "./animation/animation-json-parser.js";

// Physics System - Rapier 2D/3D integration
export {
  // Contexts
  Physics2DContext,
  Physics3DContext,
  // 2D Components
  RigidBody2D,
  Velocity2D,
  LockedAxes2D,
  Collider2D,
  PhysicsObject2D,
  CharacterController2D,
  DesiredMovement2D,
  ActiveCollisionEvents2D,
  ActiveCollisionEventsFlags2D,
  CollisionGroups2D,
  CollisionGroup,
  ActiveHooks2D,
  ContactForceEventThreshold2D,
  // 3D Components
  RigidBody3D,
  Velocity3D,
  LockedAxes3D,
  Collider3D,
  PhysicsObject3D,
  CharacterController3D,
  DesiredMovement3D,
  ActiveCollisionEvents3D,
  ActiveCollisionEventsFlags3D,
  CollisionGroups3D,
  ActiveHooks3D,
  ContactForceEventThreshold3D,
  // Shared Components
  GravityScale,
  Damping,
  Ccd,
  // Collision Events
  CollisionEventFlags,
  CollisionStarted2D,
  CollisionEnded2D,
  CollisionStarted3D,
  CollisionEnded3D,
  ContactForce2D,
  ContactForce3D,
  // Query Filter & Physics Hooks
  QueryFilterFlags,
  DEFAULT_QUERY_FILTER,
  SolverFlags,
  ActiveHooksFlags,
  // Systems
  physics2DComponentSyncSystem,
  physics3DComponentSyncSystem,
  physics2DCleanupSystem,
  physics3DCleanupSystem,
  physics2DSyncSystem,
  physics3DSyncSystem,
  physics2DCollisionEventSystem,
  physics3DCollisionEventSystem,
} from './physics/index.js';
export type {
  // Config
  PhysicsConfig,
  // Types
  BodyType,
  ColliderShape2D,
  ColliderShape3D,
  // 2D Data
  RigidBody2DData,
  Velocity2DData,
  LockedAxes2DData,
  Collider2DData,
  PhysicsObject2DData,
  CharacterController2DData,
  DesiredMovement2DData,
  ActiveCollisionEvents2DData,
  CollisionGroups2DData,
  ActiveHooks2DData,
  ContactForceEventThreshold2DData,
  // 3D Data
  RigidBody3DData,
  Velocity3DData,
  LockedAxes3DData,
  Collider3DData,
  PhysicsObject3DData,
  CharacterController3DData,
  DesiredMovement3DData,
  ActiveCollisionEvents3DData,
  CollisionGroups3DData,
  ActiveHooks3DData,
  ContactForceEventThreshold3DData,
  // Shared Data
  GravityScaleData,
  DampingData,
  CcdData,
  // Query Results
  RaycastHit2D,
  RaycastHit3D,
  ShapeCastHit2D,
  ShapeCastHit3D,
  PointProjection2D,
  PointProjection3D,
  ContactPair2D,
  ContactPair3D,
  // Query Filter & Hooks
  QueryFilter,
  QueryPredicate,
  PhysicsHooks2D,
  PhysicsHooks3D,
  ContactFilterContext,
  ContactModificationContext2D,
  ContactModificationContext3D,
} from './physics/index.js';

// Trigger Zone Components (generic collision event dispatching)
export { TriggerZone2D } from './ecs/components/trigger/trigger-zone-2d.js';
export type { TriggerZone2DData } from './ecs/components/trigger/trigger-zone-2d.js';
export { TriggerZone3D } from './ecs/components/trigger/trigger-zone-3d.js';
export type { TriggerZone3DData } from './ecs/components/trigger/trigger-zone-3d.js';

// Trigger Zone Systems
export {
  triggerZone2DSystem,
  triggerZone3DSystem,
  passesTriggerFilter,
  dispatchTriggerEvents,
} from './ecs/systems/trigger/index.js';
export type { TriggerFilterMode } from './ecs/systems/trigger/trigger-utils.js';

// Trigger Zone Events
export {
  TriggerZoneEnter2D,
  TriggerZoneLeave2D,
  TriggerZoneEnter3D,
  TriggerZoneLeave3D,
} from './physics/collision/trigger-events.js';

// Event Name Picker (for custom trigger zone editors)
export {
  renderEventNamePicker,
  clearEventPickerState,
} from './app/imgui/event-name-picker.js';
export type { EventNamePickerOptions } from './app/imgui/event-name-picker.js';

// Math utilities
export { Vector3, SeededRandom, SimplexNoise } from './math/index.js';
export type { Vector3JSON } from './math/vector3.js';
export type { FBMOptions } from './math/noise.js';

// Re-export ImGui for convenience (also available from app module)
export { ImGui, ImGuiImplWeb } from '@mori2003/jsimgui';

// Editor module - tools for building game editors
export {
  // Editor state management
  EditorManager,
  // System conditions for runIf()
  isGameplayActive,
  isEditorActive,
  isEditModeOnly,
  isPausedMode,
  and,
  or,
  not,
  // World state snapshots
  WorldSnapshot,
  // Type helpers
  isPlayMode,
  isEditingMode,
  isEditorToolsActive,
  // Platform abstraction
  WebPlatform,
  detectPlatform,
  // Editor layer
  EditorLayer,
  // Setup utility
  setupEditor,
  createTauriPlatform,
  createWebPlatform,
} from './editor/index.js';
export type {
  EditorMode,
  EditorManagerEvent,
  EditorManagerEventListener,
  // Platform types
  EditorPlatform,
  FileFilter,
  SaveDialogOptions,
  OpenDialogOptions,
  // Editor layer types
  EditorConfig,
  // Setup types
  SetupEditorOptions,
  EditorContext,
} from './editor/index.js';

// UI module - three-mesh-ui based serializable UI system
export {
  // Core
  UIManager,
  UIInteractionManager,
  // Components
  UICanvas,
  UIBlock,
  UIText,
  UIButton,
  // Helper functions
  uiBlockDataToOptions,
  uiTextDataToOptions,
  uiButtonDataToOptions,
  getButtonBackgroundColor,
  getAnchorOffset,
  getPivotOffset,
  // Systems
  uiCanvasSyncSystem,
  uiBlockSyncSystem,
  uiTextSyncSystem,
  uiButtonSyncSystem,
  uiUpdateSystem,
  uiRenderSystem,
  uiCleanupSystem,
} from './ui/index.js';
export type {
  // Core types
  UIManagerConfig,
  UIOrigin,
  UIInteractionEvent,
  UIInteractionEventType,
  UIInteractionCallback,
  // Component data types
  UICanvasData,
  UICanvasRenderMode,
  UIBlockData,
  UIAnchor,
  UIPivot,
  UIContentDirection,
  UIJustifyContent,
  UIAlignItems,
  UIPadding,
  UITextData,
  UITextAlign,
  UIWhiteSpace,
  UIBestFit,
  UIButtonData,
  UIButtonState,
} from './ui/index.js';

// Animation Editor module - visual animation clip editor
export {
  // Window and state
  renderAnimationEditorWindow,
  isAnimationEditorOpen,
  openAnimationEditor,
  closeAnimationEditor,
  createNewAnimation,
  getAnimationEditorState,
  handleAnimationEditorShortcut,
  initializeCustomWindowsFromStorage,
  // Panel visibility API
  isPanelVisible,
  setPanelVisible,
  togglePanelVisibility,
  // Serialization
  jsonToEditorState,
  editorStateToJson,
  loadAnimationFromJson,
  serializeCurrentState,
  getDefaultValueForProperty,
  // Constants
  ANIMATION_EDITOR_COLORS,
  TRACK_PANEL_WIDTH,
  TRACK_ROW_HEIGHT,
  TIME_RULER_HEIGHT,
  TOOLBAR_HEIGHT,
  PLAYBACK_CONTROLS_HEIGHT,
  KEYFRAME_SIZE,
  EASING_NAMES,
} from './app/imgui/animation-editor/index.js';
export type {
  AnimationEditorState,
  EditorTrack,
  EditorKeyframe,
  KeyframeValue,
  Vector3Value,
  EasingName,
  PanelName,
} from './app/imgui/animation-editor/index.js';

// Sprite Editor module - visual sprite region editor
export {
  // Panel functions
  renderSpriteEditorPanel,
  isSpriteEditorOpen,
  openSpriteEditor,
  closeSpriteEditor,
  toggleSpriteEditor,
  // State functions
  getSpriteEditorState,
  selectTexture,
  selectSprite,
  markDirty,
  markClean,
} from './app/imgui/sprite-editor/index.js';
export type { SpriteEditorState } from './app/imgui/sprite-editor/index.js';
