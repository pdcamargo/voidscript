/**
 * Sprite Area Generator System
 *
 * ECS system that regenerates sprites for SpriteAreaGenerator components
 * that don't have the SpriteAreaGeneratorGenerated marker.
 *
 * This runs at startup (once) to regenerate sprites that weren't serialized
 * due to skipChildrenSerialization on the SpriteAreaGenerator component.
 */

import { system } from '../system.js';
import type { Command } from '../command.js';
import {
  SpriteAreaGenerator,
  SpriteAreaGeneratorGenerated,
  type SpriteAreaGeneratorData,
} from '../components/generators/sprite-area-generator.js';
import { Children } from '../components/children.js';
import { Parent } from '../components/parent.js';
import { LocalTransform3D } from '../components/rendering/local-transform-3d.js';
import { Transform3D } from '../components/rendering/transform-3d.js';
import { Sprite2D } from '../components/rendering/sprite-2d.js';
import { AssetDatabase } from '../asset-database.js';
import {
  isTextureMetadata,
  isTiledSpriteDefinition,
  isRectSpriteDefinition,
} from '../asset-metadata.js';
import { globalComponentRegistry } from '../component.js';
import { SeededRandom } from '../../math/seeded-random.js';
import { Vector3 } from '../../math/vector3.js';

/**
 * System that regenerates sprites for SpriteAreaGenerator components.
 *
 * Queries for entities that have SpriteAreaGenerator but NOT SpriteAreaGeneratorGenerated,
 * generates their sprites, and adds the marker component.
 *
 * This runs as a startup system (once) to handle:
 * - Fresh world load (sprites not serialized)
 * - Play mode stop (world restored from snapshot without children)
 */
export const spriteAreaGeneratorSystem = system(({ commands }) => {
  // Collect entities that need generation (can't modify during query)
  const entitiesToGenerate: Array<{
    entity: number;
    data: SpriteAreaGeneratorData;
  }> = [];

  commands
    .query()
    .all(SpriteAreaGenerator)
    .none(SpriteAreaGeneratorGenerated)
    .each((entity, generatorData) => {
      entitiesToGenerate.push({ entity, data: generatorData });
    });

  // Generate sprites for each entity
  for (const { entity, data } of entitiesToGenerate) {
    generateSpritesForEntity(entity, data, commands);
  }

  if (entitiesToGenerate.length > 0) {
    console.log(
      `[SpriteAreaGeneratorSystem] Regenerated sprites for ${entitiesToGenerate.length} entities`
    );
  }
});

/**
 * Generate sprites for a single SpriteAreaGenerator entity.
 * This is a copy of the logic from sprite-area-generator.ts to avoid circular imports.
 */
function generateSpritesForEntity(
  parentEntity: number,
  data: SpriteAreaGeneratorData,
  commands: Command
): void {
  // 1. Clear existing children (shouldn't have any, but just in case)
  const existingChildren = commands.tryGetComponent(parentEntity, Children);
  if (existingChildren) {
    for (const childId of existingChildren.ids) {
      commands.entity(childId).destroyRecursive();
    }
  }

  // 2. Validate texture
  if (!data.spriteTexture) {
    // No texture - add marker anyway to prevent repeated attempts
    commands.entity(parentEntity).addComponent(SpriteAreaGeneratorGenerated, {});
    return;
  }

  const metadata = AssetDatabase.getMetadata(data.spriteTexture.guid);
  if (!metadata || !isTextureMetadata(metadata)) {
    commands.entity(parentEntity).addComponent(SpriteAreaGeneratorGenerated, {});
    return;
  }

  const sprites = metadata.sprites || [];
  if (sprites.length === 0) {
    commands.entity(parentEntity).addComponent(SpriteAreaGeneratorGenerated, {});
    return;
  }

  // 3. Normalize bounds
  const minX = Math.min(data.boundsMin.x, data.boundsMax.x);
  const maxX = Math.max(data.boundsMin.x, data.boundsMax.x);
  const minY = Math.min(data.boundsMin.y, data.boundsMax.y);
  const maxY = Math.max(data.boundsMin.y, data.boundsMax.y);
  const minZ = Math.min(data.boundsMin.z, data.boundsMax.z);
  const maxZ = Math.max(data.boundsMin.z, data.boundsMax.z);

  // 4. Resolve additional component types
  const additionalComponentTypes = (data.additionalComponents || [])
    .map((name: string) => globalComponentRegistry.getByName(name))
    .filter((comp: unknown) => comp !== undefined);

  // 5. Generate sprites with optional minimum distance constraint
  const rng = new SeededRandom(data.seed);
  const childIds: number[] = [];
  const generatedPositions: { x: number; y: number; z: number }[] = [];
  const minDistSquared = data.minDistance * data.minDistance;
  const maxAttempts = 100;

  const anchor = data.anchor ?? { x: 0.5, y: 0.5 };

  for (let i = 0; i < data.spriteCount; i++) {
    let attempts = 0;
    let validPosition = false;
    let x = 0,
      y = 0,
      z = 0;

    while (attempts < maxAttempts && !validPosition) {
      x = rng.range(minX, maxX);
      y = rng.range(minY, maxY);
      z = rng.range(minZ, maxZ);

      if (data.minDistance > 0) {
        validPosition = true;
        for (const existing of generatedPositions) {
          const dx = x - existing.x;
          const dy = y - existing.y;
          const dz = z - existing.z;
          const distSquared = dx * dx + dy * dy + dz * dz;
          if (distSquared < minDistSquared) {
            validPosition = false;
            break;
          }
        }
      } else {
        validPosition = true;
      }
      attempts++;
    }

    if (!validPosition) {
      continue;
    }

    generatedPositions.push({ x, y, z });

    const scale = rng.range(data.minScale, data.maxScale);
    const sprite = rng.pick(sprites);
    if (!sprite) continue;

    let builder = commands
      .spawn()
      .with(LocalTransform3D, {
        position: new Vector3(x, y, z),
        rotation: new Vector3(0, 0, 0),
        scale: new Vector3(scale, scale, scale),
      })
      .with(Transform3D, {
        position: new Vector3(0, 0, 0),
        rotation: new Vector3(0, 0, 0),
        scale: new Vector3(1, 1, 1),
      })
      .with(Parent, { id: parentEntity })
      .with(Sprite2D, {
        texture: data.spriteTexture,
        color: data.tintColor ?? { r: 1, g: 1, b: 1, a: 1 },
        tileIndex: isTiledSpriteDefinition(sprite) ? sprite.tileIndex : null,
        tileSize: isTiledSpriteDefinition(sprite)
          ? { x: sprite.tileWidth, y: sprite.tileHeight }
          : null,
        tilesetSize:
          isTiledSpriteDefinition(sprite) && metadata.width && metadata.height
            ? { x: metadata.width, y: metadata.height }
            : null,
        spriteRect: isRectSpriteDefinition(sprite)
          ? {
              x: sprite.x,
              y: sprite.y,
              width: sprite.width,
              height: sprite.height,
            }
          : null,
        pixelsPerUnit: 100,
        flipX: false,
        flipY: false,
        sortingLayer: data.sortingLayer,
        sortingOrder: data.sortingOrder,
        anchor,
        visible: true,
        isLit: data.isLit,
      });

    // Add additional components with their default values
    for (const componentType of additionalComponentTypes) {
      const defaultValue = (componentType as any).metadata?.defaultValue;
      const componentData =
        typeof defaultValue === 'function' ? defaultValue() : defaultValue;
      builder = builder.with(componentType as any, componentData);
    }

    const childEntity = builder.build();
    childIds.push(childEntity.id());
  }

  // 6. Batch update parent's Children component
  if (childIds.length > 0) {
    commands.entity(parentEntity).addComponent(Children, {
      ids: new Set(childIds),
    });
  }

  // 7. Add marker component
  commands.entity(parentEntity).addComponent(SpriteAreaGeneratorGenerated, {});
}
