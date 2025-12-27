/**
 * Asset Metadata Types
 *
 * Framework-agnostic asset metadata types for runtime asset management.
 * These types are used by RuntimeAsset and RuntimeAssetManager.
 */

import { Vector3 } from '../math/index.js';

/**
 * GUID type (UUID v4)
 */
export type GUID = string;

/**
 * Asset type discriminator
 */
export enum AssetType {
  Texture = 'texture',
  Material = 'material',
  Scene = 'scene',
  Model3D = 'model3d',
  TiledMap = 'tiledmap',
  Animation = 'animation',
  Audio = 'audio',
  BlueprintScript = 'blueprint-script',
  BlueprintShader = 'blueprint-shader',
  BlueprintAnimation = 'blueprint-animation',
  BlueprintAudio = 'blueprint-audio',
  Unknown = 'unknown',
}

/**
 * Texture filtering modes (Three.js compatible)
 */
export enum TextureFilter {
  Nearest = 'nearest',
  Linear = 'linear',
}

/**
 * Texture wrapping modes (Three.js compatible)
 */
export enum TextureWrap {
  Repeat = 'repeat',
  ClampToEdge = 'clamp',
  MirroredRepeat = 'mirror',
}

/**
 * 3D model file formats
 */
export enum ModelFormat {
  GLTF = 'gltf',
  GLB = 'glb',
  FBX = 'fbx',
}

/**
 * Base asset metadata interface
 */
export interface BaseAssetMetadata {
  /** Unique identifier (UUID v4) */
  guid: GUID;

  /** Relative path from project root */
  path: string;

  /** Asset type discriminator */
  type: string;

  /** When the asset was imported (ISO 8601 datetime) */
  importedAt: string;

  /** When the asset file was last modified (ISO 8601 datetime) */
  modifiedAt: string;
}

/**
 * Base sprite definition fields
 */
export interface BaseSpriteDefinition {
  /** Unique identifier for this sprite */
  id: string;

  /** Display name shown in sprite picker */
  name: string;

  /**
   * GUID of the texture this sprite belongs to.
   * Auto-populated by AssetDatabase during registration.
   * Enables cross-texture sprite animations.
   */
  textureGuid?: GUID;

  /**
   * Optional pivot point for this sprite (0-1 range, where 0.5,0.5 = center).
   * When set, this becomes the default anchor value when this sprite is selected.
   * Used for rotation/scale origin and positioning offset.
   */
  pivot?: { x: number; y: number };
}

/**
 * Tile-based sprite definition (grid-based sprite sheets)
 * Uses tile index for uniform grid layouts
 */
export interface TiledSpriteDefinition extends BaseSpriteDefinition {
  /** Tile index in the sheet (0-based, left-to-right, top-to-bottom) */
  tileIndex: number;

  /** Tile width in pixels */
  tileWidth: number;

  /** Tile height in pixels */
  tileHeight: number;
}

/**
 * Rect-based sprite definition (arbitrary position in atlas)
 * Uses pixel coordinates for non-uniform/packed atlases
 */
export interface RectSpriteDefinition extends BaseSpriteDefinition {
  /** X position in the texture (pixels from left) */
  x: number;

  /** Y position in the texture (pixels from top) */
  y: number;

  /** Sprite width in pixels */
  width: number;

  /** Sprite height in pixels */
  height: number;
}

/**
 * Sprite definition within a texture atlas
 * Can be either tile-based (grid) or rect-based (arbitrary position)
 */
export type SpriteDefinition = TiledSpriteDefinition | RectSpriteDefinition;

/**
 * Type guard for tiled (grid-based) sprite definitions
 */
export function isTiledSpriteDefinition(
  sprite: SpriteDefinition,
): sprite is TiledSpriteDefinition {
  return 'tileIndex' in sprite;
}

/**
 * Type guard for rect-based sprite definitions
 */
export function isRectSpriteDefinition(
  sprite: SpriteDefinition,
): sprite is RectSpriteDefinition {
  return 'x' in sprite && 'y' in sprite && 'width' in sprite && 'height' in sprite;
}

/**
 * Texture metadata interface (Three.js compatible)
 */
export interface TextureMetadata extends BaseAssetMetadata {
  type: AssetType.Texture;

  /** Texture filtering mode */
  filtering: TextureFilter;

  /** Horizontal wrapping mode */
  wrapS: TextureWrap;

  /** Vertical wrapping mode */
  wrapT: TextureWrap;

  /** Use sRGB color space */
  sRGB: boolean;

  /** Generate mipmaps */
  generateMipmaps: boolean;

  /** Image width in pixels (optional, populated on import) */
  width?: number;

  /** Image height in pixels (optional, populated on import) */
  height?: number;

  /** Optional named sprite definitions for sprite sheet atlases */
  sprites?: SpriteDefinition[];
}

/**
 * Scene metadata interface
 */
export interface SceneMetadata extends BaseAssetMetadata {
  type: AssetType.Scene;

  /** Number of entities in the scene */
  entityCount: number;

  /** Component types used in the scene (for dependency tracking) */
  componentTypes: string[];

  /** GUIDs of nested scenes referenced within this scene */
  nestedScenes: string[];

  /** Optional preview image path (relative from project root) */
  thumbnailPath?: string;
}

/**
 * 3D model metadata interface
 */
export interface Model3DMetadata extends BaseAssetMetadata {
  type: AssetType.Model3D;

  /** Model file format */
  format: ModelFormat;

  /** Scale preset applied at import */
  scale: number;

  /** Rotation preset applied at import (Euler angles in degrees) */
  rotation: Vector3;

  /** Whether the model contains animations */
  hasAnimations: boolean;

  /** List of animation names available in the model */
  animationNames: string[];

  /** Vertex count (optional, populated on import) */
  vertexCount?: number;

  /** Triangle count (optional, populated on import) */
  triangleCount?: number;

  /** Bounding box dimensions (optional, populated on import) */
  boundingBox?: {
    min: Vector3;
    max: Vector3;
  };
}

/**
 * Material type discriminator
 */
export enum MaterialType {
  Basic = 'basic',
  Lambert = 'lambert',
  Phong = 'phong',
  Standard = 'standard',
  Physical = 'physical',
}

/**
 * Base material metadata interface
 */
interface BaseMaterialMetadata extends BaseAssetMetadata {
  type: AssetType.Material;

  /** Material type (basic, lambert, phong, standard, physical) */
  materialType: MaterialType;

  /** Base color (hex string, e.g., "#ffffff") */
  color: string;

  /** Color/albedo texture map (GUID reference) */
  map: string | null;

  /** Normal map texture (GUID reference) */
  normalMap: string | null;
}

/**
 * MeshBasicMaterial metadata
 * Simple flat color material, unaffected by lighting
 */
export interface MaterialBasicMetadata extends BaseMaterialMetadata {
  materialType: MaterialType.Basic;
}

/**
 * MeshLambertMaterial metadata
 * Diffuse material with Lambertian reflectance
 */
export interface MaterialLambertMetadata extends BaseMaterialMetadata {
  materialType: MaterialType.Lambert;

  /** Emissive color (hex string, e.g., "#000000") */
  emissive: string;

  /** Emissive intensity (0-1) */
  emissiveIntensity: number;
}

/**
 * MeshPhongMaterial metadata
 * Specular-glossy material with Phong reflectance
 */
export interface MaterialPhongMetadata extends BaseMaterialMetadata {
  materialType: MaterialType.Phong;

  /** Emissive color (hex string) */
  emissive: string;

  /** Emissive intensity (0-1) */
  emissiveIntensity: number;

  /** Specular highlight color (hex string) */
  specular: string;

  /** Specular shininess (0-1000+) */
  shininess: number;
}

/**
 * MeshStandardMaterial metadata
 * PBR material with metallic-roughness workflow
 */
export interface MaterialStandardMetadata extends BaseMaterialMetadata {
  materialType: MaterialType.Standard;

  /** Metalness (0 = dielectric, 1 = metallic) */
  metalness: number;

  /** Roughness (0 = smooth, 1 = rough) */
  roughness: number;
}

/**
 * MeshPhysicalMaterial metadata
 * Advanced PBR material with clearcoat, transmission, etc.
 */
export interface MaterialPhysicalMetadata extends BaseMaterialMetadata {
  materialType: MaterialType.Physical;

  /** Metalness (0 = dielectric, 1 = metallic) */
  metalness: number;

  /** Roughness (0 = smooth, 1 = rough) */
  roughness: number;

  /** Clearcoat layer intensity (0-1) */
  clearcoat: number;

  /** Clearcoat roughness (0-1) */
  clearcoatRoughness: number;

  /** Light transmission (0 = opaque, 1 = transparent) */
  transmission: number;
}

/**
 * Material metadata discriminated union
 */
export type MaterialMetadata =
  | MaterialBasicMetadata
  | MaterialLambertMetadata
  | MaterialPhongMetadata
  | MaterialStandardMetadata
  | MaterialPhysicalMetadata;

/**
 * Script Blueprint metadata interface
 */
export interface BlueprintScriptMetadata extends BaseAssetMetadata {
  type: AssetType.BlueprintScript;

  /** Number of nodes in the blueprint */
  nodeCount?: number;

  /** Number of variables in the blueprint */
  variableCount?: number;

  /** Blueprint description */
  description?: string;

  /** Generated system name (camelCase) */
  systemName?: string;

  /** Optional preview image path (relative from project root) */
  thumbnailPath?: string;
}

/**
 * Shader Blueprint metadata interface
 */
export interface BlueprintShaderMetadata extends BaseAssetMetadata {
  type: AssetType.BlueprintShader;

  /** Number of nodes in the blueprint */
  nodeCount?: number;

  /** Shader type (vertex, fragment, compute) */
  shaderType?: 'vertex' | 'fragment' | 'compute';

  /** Blueprint description */
  description?: string;

  /** GLSL version target */
  glslVersion?: string;

  /** Optional preview image path (relative from project root) */
  thumbnailPath?: string;
}

/**
 * Animation Blueprint metadata interface
 */
export interface BlueprintAnimationMetadata extends BaseAssetMetadata {
  type: AssetType.BlueprintAnimation;

  /** Number of nodes in the blueprint */
  nodeCount?: number;

  /** Blueprint description */
  description?: string;

  /** Target skeleton/rig name */
  targetSkeleton?: string;

  /** Optional preview image path (relative from project root) */
  thumbnailPath?: string;
}

/**
 * Audio Blueprint metadata interface
 */
export interface BlueprintAudioMetadata extends BaseAssetMetadata {
  type: AssetType.BlueprintAudio;

  /** Number of nodes in the blueprint */
  nodeCount?: number;

  /** Blueprint description */
  description?: string;

  /** Audio context sample rate */
  sampleRate?: number;

  /** Optional preview image path (relative from project root) */
  thumbnailPath?: string;
}

/**
 * Tiled map metadata interface
 */
export interface TiledMapMetadata extends BaseAssetMetadata {
  type: AssetType.TiledMap;

  /** Pixels per unit for world-space sizing (default: map's tilewidth) */
  pixelsPerUnit?: number;

  /** World-space offset for the entire map */
  worldOffset?: { x: number; y: number; z: number };

  /** Whether to automatically spawn layers (default: true) */
  autoSpawnLayers?: boolean;
}

/**
 * Animation clip metadata interface
 */
export interface AnimationMetadata extends BaseAssetMetadata {
  type: AssetType.Animation;

  /** Duration of the animation clip in seconds */
  duration?: number;

  /** Loop mode ('once' | 'loop' | 'pingPong') */
  loopMode?: 'once' | 'loop' | 'pingPong';

  /** Number of tracks in the animation */
  trackCount?: number;

  /** Property paths animated by this clip (e.g., ['position', 'tileIndex']) */
  animatedProperties?: string[];
}

/**
 * Audio asset metadata interface
 * Supports audio files (.mp3, .wav, .ogg, etc.)
 */
export interface AudioAssetMetadata extends BaseAssetMetadata {
  type: AssetType.Audio;

  /** Duration of the audio clip in seconds (populated on import) */
  duration?: number;

  /** Number of audio channels (1 = mono, 2 = stereo) */
  channels?: number;

  /** Sample rate in Hz (e.g., 44100, 48000) */
  sampleRate?: number;
}

/**
 * Unknown asset metadata (fallback for unsupported types)
 */
export interface UnknownAssetMetadata extends BaseAssetMetadata {
  type: AssetType.Unknown;
}

/**
 * Asset metadata discriminated union
 */
export type AssetMetadata =
  | TextureMetadata
  | MaterialMetadata
  | SceneMetadata
  | Model3DMetadata
  | TiledMapMetadata
  | AnimationMetadata
  | AudioAssetMetadata
  | BlueprintScriptMetadata
  | BlueprintShaderMetadata
  | BlueprintAnimationMetadata
  | BlueprintAudioMetadata
  | UnknownAssetMetadata;

/**
 * Type guard for TextureMetadata
 */
export function isTextureMetadata(
  metadata: AssetMetadata,
): metadata is TextureMetadata {
  return metadata.type === AssetType.Texture;
}

/**
 * Type guard for MaterialMetadata
 */
export function isMaterialMetadata(
  metadata: AssetMetadata,
): metadata is MaterialMetadata {
  return metadata.type === AssetType.Material;
}

/**
 * Type guard for SceneMetadata
 */
export function isSceneMetadata(
  metadata: AssetMetadata,
): metadata is SceneMetadata {
  return metadata.type === AssetType.Scene;
}

/**
 * Type guard for Model3DMetadata
 */
export function isModel3DMetadata(
  metadata: AssetMetadata,
): metadata is Model3DMetadata {
  return metadata.type === AssetType.Model3D;
}

/**
 * Type guard for BlueprintScriptMetadata
 */
export function isBlueprintScriptMetadata(
  metadata: AssetMetadata,
): metadata is BlueprintScriptMetadata {
  return metadata.type === AssetType.BlueprintScript;
}

/**
 * Type guard for BlueprintShaderMetadata
 */
export function isBlueprintShaderMetadata(
  metadata: AssetMetadata,
): metadata is BlueprintShaderMetadata {
  return metadata.type === AssetType.BlueprintShader;
}

/**
 * Type guard for BlueprintAnimationMetadata
 */
export function isBlueprintAnimationMetadata(
  metadata: AssetMetadata,
): metadata is BlueprintAnimationMetadata {
  return metadata.type === AssetType.BlueprintAnimation;
}

/**
 * Type guard for BlueprintAudioMetadata
 */
export function isBlueprintAudioMetadata(
  metadata: AssetMetadata,
): metadata is BlueprintAudioMetadata {
  return metadata.type === AssetType.BlueprintAudio;
}

/**
 * Type guard for TiledMapMetadata
 */
export function isTiledMapMetadata(
  metadata: AssetMetadata,
): metadata is TiledMapMetadata {
  return metadata.type === AssetType.TiledMap;
}

/**
 * Type guard for AnimationMetadata
 */
export function isAnimationMetadata(
  metadata: AssetMetadata,
): metadata is AnimationMetadata {
  return metadata.type === AssetType.Animation;
}

/**
 * Type guard for AudioAssetMetadata
 */
export function isAudioAssetMetadata(
  metadata: AssetMetadata,
): metadata is AudioAssetMetadata {
  return metadata.type === AssetType.Audio;
}

/**
 * Type guard for UnknownAssetMetadata
 */
export function isUnknownAssetMetadata(
  metadata: AssetMetadata,
): metadata is UnknownAssetMetadata {
  return metadata.type === AssetType.Unknown;
}
