/**
 * Tiled Map Loader System
 *
 * Startup system that processes TiledMap components and spawns layer entities.
 *
 * Responsibilities:
 * - Load tilesets (embedded and external)
 * - Generate tileset info with textures and animations
 * - Recursively spawn layer entities (tile, object, image, group layers)
 * - Assign z-ordering based on layer hierarchy
 *
 * Runs in the startup phase (once per map load).
 */

import { system } from '../../ecs/system.js';
import type { Entity } from '../../ecs/entity.js';
import type { Command } from '../../ecs/command.js';
import * as tiled from '@kayahr/tiled';
import { TiledMap, type TiledMapData, type TilesetInfo } from '../../ecs/components/tiled/tiled-map.js';
import { TiledTileLayer } from '../../ecs/components/tiled/tiled-tile-layer.js';
import { TiledObjectLayer } from '../../ecs/components/tiled/tiled-object-layer.js';
import { Transform3D } from '../../ecs/components/rendering/transform-3d.js';
import { LocalTransform3D } from '../../ecs/components/rendering/local-transform-3d.js';
import { Parent } from '../../ecs/components/parent.js';
import { Name } from '../../ecs/components/name.js';
import { TiledAssetRegistry } from '../tiled-asset-registry.js';
import { validateMapSupport, parseProperties, resolvePath } from '../tiled-utils.js';
import { Vector3 } from '../../math/vector3.js';

/**
 * Tiled Map Loader System
 *
 * Processes TiledMap components and spawns layer entities.
 */
export const tiledMapLoaderSystem = system(({ commands }) => {
  const registry = commands.getResource(TiledAssetRegistry);

  // Query for TiledMap components that haven't spawned layers yet
  commands
    .query()
    .all(TiledMap, Transform3D)
    .each((entity, tiledMap, transform) => {
      // Initialize layerEntities if missing (happens after deserialization)
      if (!tiledMap.layerEntities) {
        tiledMap.layerEntities = new Set();
      }

      // Initialize tilesetMapping if missing (happens after deserialization)
      if (!tiledMap.tilesetMapping) {
        tiledMap.tilesetMapping = new Map();
      }

      // Initialize properties if missing (happens after deserialization)
      if (!tiledMap.properties) {
        tiledMap.properties = new Map();
      }

      // Skip if layers already spawned
      // After deserialization with skipChildrenSerialization, layerEntities will be empty,
      // so layers are regenerated automatically
      if (tiledMap.layerEntities.size > 0) return;

      // Skip if auto-spawn is disabled
      if (!tiledMap.autoSpawnLayers) return;

      // Skip if we have neither mapData nor mapAsset (nothing to load)
      if (!tiledMap.mapData && !tiledMap.mapAsset) return;

      // If mapData exists, we've already started/finished loading
      // This prevents multiple parallel loads while async operations are in progress
      if (tiledMap.mapData) {
        // Map data is ready, spawn layers synchronously
        spawnMapLayers(entity, tiledMap, transform, commands, registry).catch(
          (error) => {
            console.error(
              `[tiledMapLoaderSystem] Failed to spawn layers for entity ${entity}:`,
              error
            );
          }
        );
        return;
      }

      // Load map data from asset (async, fire-and-forget)
      // After this completes, mapData will be set and we'll take the branch above
      loadAndSpawnMap(entity, tiledMap, transform, commands, registry).catch(
        (error) => {
          console.error(
            `[tiledMapLoaderSystem] Failed to load map for entity ${entity}:`,
            error
          );
        }
      );
    });
});

/**
 * Load map data from asset (if needed) and spawn layers
 */
async function loadAndSpawnMap(
  mapEntity: Entity,
  tiledMap: TiledMapData,
  mapTransform: { position: Vector3; rotation: Vector3; scale: Vector3 },
  commands: Command,
  registry: TiledAssetRegistry
): Promise<void> {
  // If mapData is missing but mapAsset is set, load from asset
  if (!tiledMap.mapData && tiledMap.mapAsset) {
    if (!tiledMap.mapAsset.isLoaded) {
      try {
        await tiledMap.mapAsset.load();
      } catch (error) {
        console.error(`[tiledMapLoaderSystem] Failed to load asset:`, error);
        return;
      }
    }

    const loadedData = tiledMap.mapAsset.data;
    if (!loadedData) {
      console.error(`[tiledMapLoaderSystem] Asset loaded but data is missing`);
      return;
    }

    tiledMap.mapData = loadedData;

    if (!tiledMap.sourcePath) {
      tiledMap.sourcePath = tiledMap.mapAsset.path;
    }
  }

  if (!tiledMap.mapData) {
    console.error(`[tiledMapLoaderSystem] No map data available for entity ${mapEntity}`);
    return;
  }

  validateMapSupport(tiledMap.mapData);
  await spawnMapLayers(mapEntity, tiledMap, mapTransform, commands, registry);
}

/**
 * Spawn all layers for a map
 */
async function spawnMapLayers(
  mapEntity: Entity,
  tiledMap: TiledMapData,
  mapTransform: { position: Vector3; rotation: Vector3; scale: Vector3 },
  commands: Command,
  registry: TiledAssetRegistry
): Promise<void> {
  const map = tiledMap.mapData;

  // Pre-load all tilesets (await all in parallel)
  if (map.tilesets) {
    const tilesetPromises = map.tilesets.map((tilesetRef) =>
      loadTilesetInfo(tilesetRef, tiledMap, registry)
    );
    await Promise.all(tilesetPromises);
    console.log(
      `[tiledMapLoaderSystem] Loaded ${map.tilesets.length} tileset(s)`
    );
  }

  // Spawn layers recursively
  let zIndex = 0;
  for (const layer of map.layers) {
    spawnLayer(layer, mapEntity, tiledMap, zIndex++, commands);
  }
}

/**
 * Load tileset information (texture, animations, etc.)
 */
async function loadTilesetInfo(
  tilesetRef: tiled.AnyTileset,
  tiledMap: TiledMapData,
  registry: TiledAssetRegistry
): Promise<void> {
  let tileset: tiled.Tileset;
  const firstGid = (tilesetRef as any).firstgid ?? 1;

  // Check if already loaded
  if (tiledMap.tilesetMapping.has(firstGid)) {
    return;
  }

  // Determine if this is an external tileset
  if (tiled.isTilesetRef(tilesetRef)) {
    // External tileset - load it
    console.log(
      `[tiledMapLoaderSystem] Loading external tileset: ${tilesetRef.source}`
    );

    // Pass the full map path (not just directory) to loadExternalTileset
    // The resolvePath function needs a file path to extract the directory
    tileset = await registry.loadExternalTileset(tilesetRef, tiledMap.sourcePath);
  } else {
    // Embedded tileset
    tileset = tilesetRef;
  }

  // Determine image path
  const imagePath = tileset.image
    ? resolvePath(tiledMap.sourcePath, tileset.image)
    : '';

  if (!imagePath) {
    console.error(`[tiledMapLoaderSystem] Tileset "${tileset.name}" has no image`);
    return;
  }

  // Load texture (await to ensure it's loaded before spawning layers)
  const texture = await registry.loadTilesetTexture(imagePath);

  // Generate animation clips
  const animationClips = registry.generateAnimationClips(
    tileset,
    firstGid,
    tiledMap.sourcePath
  );

  // Convert animation clips to TiledAnimation format
  const animations = new Map();
  for (const [tileId, clip] of animationClips.entries()) {
    animations.set(tileId, {
      clip,
      frames: [], // Frame data can be extracted from tileset if needed
    });
  }

  // Create tileset info
  const tilesetInfo: TilesetInfo = {
    firstGid,
    texture,
    tilesetData: tileset,
    imageWidth: tileset.imagewidth,
    imageHeight: tileset.imageheight,
    tileWidth: tileset.tilewidth,
    tileHeight: tileset.tileheight,
    columns: tileset.columns ?? Math.floor(tileset.imagewidth / tileset.tilewidth),
    tileCount: tileset.tilecount,
    animations,
  };

  // Store in tileset mapping
  tiledMap.tilesetMapping.set(firstGid, tilesetInfo);
}

/**
 * Spawn a layer entity (handles all layer types)
 */
function spawnLayer(
  layer: tiled.AnyLayer,
  mapEntity: Entity,
  tiledMap: TiledMapData,
  zIndex: number,
  commands: Command
): void {
  // Determine layer type and spawn accordingly
  if (tiled.isTileLayer(layer)) {
    spawnTileLayer(layer, mapEntity, tiledMap, zIndex, commands);
  } else if (tiled.isObjectGroup(layer)) {
    spawnObjectLayer(layer, mapEntity, tiledMap, zIndex, commands);
  } else if (tiled.isImageLayer(layer)) {
    // Image layers not yet supported
    console.warn(
      `[tiledMapLoaderSystem] Image layer "${layer.name}" is not yet supported. Skipping.`
    );
  } else if (tiled.isGroup(layer)) {
    // Group layers: recursively spawn children
    let childZ = 0;
    for (const child of layer.layers) {
      // Use hierarchical z-ordering: parentZ * 100 + childIndex
      spawnLayer(child, mapEntity, tiledMap, zIndex * 100 + childZ++, commands);
    }
  }
}

/**
 * Spawn a tile layer entity
 */
function spawnTileLayer(
  layer: tiled.TileLayer,
  mapEntity: Entity,
  tiledMap: TiledMapData,
  zIndex: number,
  commands: Command
): void {
  // Parse layer properties
  const layerProperties = parseProperties(layer.properties);

  // Determine isLit: layer property overrides map default
  let isLit = tiledMap.isLit ?? false;
  if (layerProperties.has('isLit')) {
    const layerIsLit = layerProperties.get('isLit');
    if (typeof layerIsLit === 'boolean') {
      isLit = layerIsLit;
    }
  }

  const layerEntity = commands
    .spawn()
    .with(Name, { name: layer.name })
    .with(LocalTransform3D, {
      // Store layer offset relative to map
      position: new Vector3(
        (layer.x ?? 0),
        -(layer.y ?? 0), // Flip Y
        0
      ),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
    })
    .with(Transform3D, {
      // World transform (will be computed by transformPropagationSystem)
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
    })
    .with(Parent, { id: mapEntity })
    .with(TiledTileLayer, {
      mapEntity,
      layerData: layer,
      name: layer.name,
      offsetX: layer.offsetx ?? 0,
      offsetY: layer.offsety ?? 0,
      opacity: layer.opacity ?? 1,
      visible: layer.visible ?? true,
      parallaxX: layer.parallaxx ?? 1,
      parallaxY: layer.parallaxy ?? 1,
      zOrder: zIndex,
      properties: layerProperties,
      renderHandle: null,
      isLit,
    })
    .build();

  // Add to map's layer tracking
  tiledMap.layerEntities.add(layerEntity.id());

  // Register as child of map
  commands.entity(mapEntity).addChild(layerEntity.id());
}

/**
 * Spawn an object layer entity
 */
function spawnObjectLayer(
  layer: tiled.ObjectGroup,
  mapEntity: Entity,
  tiledMap: TiledMapData,
  zIndex: number,
  commands: Command
): void {
  const layerEntity = commands
    .spawn()
    .with(Name, { name: layer.name })
    .with(LocalTransform3D, {
      // Store layer offset relative to map
      position: new Vector3(
        (layer.x ?? 0),
        -(layer.y ?? 0), // Flip Y
        0
      ),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
    })
    .with(Transform3D, {
      // World transform (will be computed by transformPropagationSystem)
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
    })
    .with(Parent, { id: mapEntity })
    .with(TiledObjectLayer, {
      mapEntity,
      layerData: layer,
      name: layer.name,
      objectEntities: new Set<Entity>(),
      opacity: layer.opacity ?? 1,
      visible: layer.visible ?? true,
      zOrder: zIndex,
      properties: parseProperties(layer.properties),
    })
    .build();

  // Add to map's layer tracking
  tiledMap.layerEntities.add(layerEntity.id());

  // Register as child of map
  commands.entity(mapEntity).addChild(layerEntity.id());
}
