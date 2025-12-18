/**
 * Sprite and Tilemap Materials
 *
 * Custom THREE.js materials with sprite sheet tiling and tilemap support.
 */

import * as THREE from 'three';
import { SpriteMaterial } from './SpriteMaterial.js';
import { TilemapMaterial } from './TilemapMaterial.js';

// Re-export types and utilities
export * from './SpriteMaterial.js';
export * from './TilemapMaterial.js';
export * from './WaterSpriteMaterial.js';
export * from './Water2DMaterial.js';
export * from './LitWater2DMaterial.js';
export * from './shaders.js';

/**
 * THREE.MeshBasicMaterial extending SpriteMaterial.
 *
 * ```
 * const material = new SpriteMeshBasicMaterial({
 *   map: myTexture,
 * });
 *
 * material.tile({
 *   tile: 0,
 *   tileSize: { x: 16, y: 16 },
 *   tilesetSize: { x: 128, y: 128 },
 * });
 * ```
 */
export const SpriteMeshBasicMaterial = SpriteMaterial.extendClass<
  typeof THREE.MeshBasicMaterial,
  THREE.MeshBasicMaterialParameters
>(THREE.MeshBasicMaterial);

/**
 * THREE.MeshLambertMaterial extending SpriteMaterial.
 *
 * ```
 * const material = new SpriteMeshLambertMaterial({
 *   map: myTexture,
 * });
 *
 * material.tile({
 *   tile: 0,
 *   tileSize: { x: 16, y: 16 },
 *   tilesetSize: { x: 128, y: 128 },
 * });
 * ```
 */
export const SpriteMeshLambertMaterial = SpriteMaterial.extendClass<
  typeof THREE.MeshLambertMaterial,
  THREE.MeshLambertMaterialParameters
>(THREE.MeshLambertMaterial);

/**
 * THREE.MeshStandardMaterial extending SpriteMaterial.
 *
 * ```
 * const material = new SpriteMeshStandardMaterial({
 *   map: myTexture,
 * });
 *
 * material.tile({
 *   tile: 0,
 *   tileSize: { x: 16, y: 16 },
 *   tilesetSize: { x: 128, y: 128 },
 * });
 * ```
 */
export const SpriteMeshStandardMaterial = SpriteMaterial.extendClass<
  typeof THREE.MeshStandardMaterial,
  THREE.MeshStandardMaterialParameters
>(THREE.MeshStandardMaterial);

/**
 * THREE.MeshPhysicalMaterial extending SpriteMaterial.
 *
 * ```
 * const material = new SpriteMeshPhysicalMaterial({
 *   map: myTexture,
 * });
 *
 * material.tile({
 *   tile: 0,
 *   tileSize: { x: 16, y: 16 },
 *   tilesetSize: { x: 128, y: 128 },
 * });
 * ```
 */
export const SpriteMeshPhysicalMaterial = SpriteMaterial.extendClass<
  typeof THREE.MeshPhysicalMaterial,
  THREE.MeshPhysicalMaterialParameters
>(THREE.MeshPhysicalMaterial);

/**
 * THREE.MeshPhongMaterial extending SpriteMaterial.
 *
 * ```
 * const material = new SpriteMeshPhongMaterial({
 *   map: myTexture,
 * });
 *
 * material.tile({
 *   tile: 0,
 *   tileSize: { x: 16, y: 16 },
 *   tilesetSize: { x: 128, y: 128 },
 * });
 * ```
 */
export const SpriteMeshPhongMaterial = SpriteMaterial.extendClass<
  typeof THREE.MeshPhongMaterial,
  THREE.MeshPhongMaterialParameters
>(THREE.MeshPhongMaterial);

/**
 * THREE.MeshToonMaterial extending SpriteMaterial.
 *
 * ```
 * const material = new SpriteMeshToonMaterial({
 *   map: myTexture,
 * });
 *
 * material.tile({
 *   tile: 0,
 *   tileSize: { x: 16, y: 16 },
 *   tilesetSize: { x: 128, y: 128 },
 * });
 * ```
 */
export const SpriteMeshToonMaterial = SpriteMaterial.extendClass<
  typeof THREE.MeshToonMaterial,
  THREE.MeshToonMaterialParameters
>(THREE.MeshToonMaterial);

/**
 * THREE.MeshBasicMaterial extending TilemapMaterial.
 *
 * ```
 * const material = new TilemapMeshBasicMaterial({
 *   map: myTexture,
 * });
 *
 * material.tile({
 *   tiles: [1, 2, 3, 4, 5, 6, 7],
 *   tilemapSize: { x: 3, y: 3 },
 *   tileSize: { x: 16, y: 16 },
 *   tilesetSize: { x: 128, y: 128 },
 * });
 * ```
 */
export const TilemapMeshBasicMaterial = TilemapMaterial.extendClass<
  typeof THREE.MeshBasicMaterial,
  THREE.MeshBasicMaterialParameters
>(THREE.MeshBasicMaterial);

/**
 * THREE.MeshLambertMaterial extending TilemapMaterial.
 *
 * ```
 * const material = new TilemapMeshLambertMaterial({
 *   map: myTexture,
 * });
 *
 * material.tile({
 *   tiles: [1, 2, 3, 4, 5, 6, 7],
 *   tilemapSize: { x: 3, y: 3 },
 *   tileSize: { x: 16, y: 16 },
 *   tilesetSize: { x: 128, y: 128 },
 * });
 * ```
 */
export const TilemapMeshLambertMaterial = TilemapMaterial.extendClass<
  typeof THREE.MeshLambertMaterial,
  THREE.MeshLambertMaterialParameters
>(THREE.MeshLambertMaterial);

/**
 * THREE.MeshStandardMaterial extending TilemapMaterial.
 *
 * ```
 * const material = new TilemapMeshStandardMaterial({
 *   map: myTexture,
 * });
 *
 * material.tile({
 *   tiles: [1, 2, 3, 4, 5, 6, 7],
 *   tilemapSize: { x: 3, y: 3 },
 *   tileSize: { x: 16, y: 16 },
 *   tilesetSize: { x: 128, y: 128 },
 * });
 * ```
 */
export const TilemapMeshStandardMaterial = TilemapMaterial.extendClass<
  typeof THREE.MeshStandardMaterial,
  THREE.MeshStandardMaterialParameters
>(THREE.MeshStandardMaterial);

/**
 * THREE.MeshPhysicalMaterial extending TilemapMaterial.
 *
 * ```
 * const material = new TilemapMeshPhysicalMaterial({
 *   map: myTexture,
 * });
 *
 * material.tile({
 *   tiles: [1, 2, 3, 4, 5, 6, 7],
 *   tilemapSize: { x: 3, y: 3 },
 *   tileSize: { x: 16, y: 16 },
 *   tilesetSize: { x: 128, y: 128 },
 * });
 * ```
 */
export const TilemapMeshPhysicalMaterial = TilemapMaterial.extendClass<
  typeof THREE.MeshPhysicalMaterial,
  THREE.MeshPhysicalMaterialParameters
>(THREE.MeshPhysicalMaterial);

/**
 * THREE.MeshPhongMaterial extending TilemapMaterial.
 *
 * ```
 * const material = new TilemapMeshPhongMaterial({
 *   map: myTexture,
 * });
 *
 * material.tile({
 *   tiles: [1, 2, 3, 4, 5, 6, 7],
 *   tilemapSize: { x: 3, y: 3 },
 *   tileSize: { x: 16, y: 16 },
 *   tilesetSize: { x: 128, y: 128 },
 * });
 * ```
 */
export const TilemapMeshPhongMaterial = TilemapMaterial.extendClass<
  typeof THREE.MeshPhongMaterial,
  THREE.MeshPhongMaterialParameters
>(THREE.MeshPhongMaterial);

/**
 * THREE.MeshToonMaterial extending TilemapMaterial.
 *
 * ```
 * const material = new TilemapMeshToonMaterial({
 *   map: myTexture,
 * });
 *
 * material.tile({
 *   tiles: [1, 2, 3, 4, 5, 6, 7],
 *   tilemapSize: { x: 3, y: 3 },
 *   tileSize: { x: 16, y: 16 },
 *   tilesetSize: { x: 128, y: 128 },
 * });
 * ```
 */
export const TilemapMeshToonMaterial = TilemapMaterial.extendClass<
  typeof THREE.MeshToonMaterial,
  THREE.MeshToonMaterialParameters
>(THREE.MeshToonMaterial);
