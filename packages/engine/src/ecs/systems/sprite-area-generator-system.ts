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

  // 5. Generate sprite positions
  const rng = new SeededRandom(data.seed);
  const childIds: number[] = [];
  const anchor = data.anchor ?? { x: 0.5, y: 0.5 };

  // Determine if we're in fully random mode (no uniform axes)
  // Use explicit === true check to handle undefined values correctly
  const uniformX = data.uniformDistanceX === true;
  const uniformY = data.uniformDistanceY === true;
  const uniformZ = data.uniformDistanceZ === true;
  const isFullyRandom = !uniformX && !uniformY && !uniformZ;

  // Generate positions based on mode
  const positions: { x: number; y: number; z: number }[] = [];

  if (isFullyRandom) {
    // Random placement with minDistance constraint
    const minDistSquared = data.minDistance * data.minDistance;
    const maxAttempts = 100;

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
          for (const existing of positions) {
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

      positions.push({ x, y, z });
    }
  } else {
    // Uniform distance mode - expand from center outward
    const spacing = data.uniformDistanceSpacing ?? { x: 5, y: 5, z: 5 };

    // Calculate center of bounds
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    // Check if bounds have any range (min != max)
    const hasRangeX = maxX - minX > 0;
    const hasRangeY = maxY - minY > 0;
    const hasRangeZ = maxZ - minZ > 0;

    // Calculate actual spacing for each axis
    const spacingX = uniformX
      ? spacing.x > 0
        ? spacing.x
        : hasRangeX
          ? rng.range(1, 5)
          : 0
      : 0;
    const spacingY = uniformY
      ? spacing.y > 0
        ? spacing.y
        : hasRangeY
          ? rng.range(1, 5)
          : 0
      : 0;
    const spacingZ = uniformZ
      ? spacing.z > 0
        ? spacing.z
        : hasRangeZ
          ? rng.range(1, 5)
          : 0
      : 0;

    // Generate uniform positions for an axis
    const generateUniformPositions = (
      count: number,
      spacingVal: number,
      center: number
    ): number[] => {
      const result: number[] = [];
      if (spacingVal === 0) {
        for (let i = 0; i < count; i++) {
          result.push(center);
        }
      } else {
        const halfSpan = ((count - 1) * spacingVal) / 2;
        for (let i = 0; i < count; i++) {
          result.push(center - halfSpan + i * spacingVal);
        }
      }
      return result;
    };

    // For each sprite index, calculate position on each axis
    for (let i = 0; i < data.spriteCount; i++) {
      let x: number;
      let y: number;
      let z: number;

      if (uniformX) {
        const xPositions = generateUniformPositions(
          data.spriteCount,
          spacingX,
          centerX
        );
        x = xPositions[i]!;
      } else {
        x = rng.range(minX, maxX);
      }

      if (uniformY) {
        const yPositions = generateUniformPositions(
          data.spriteCount,
          spacingY,
          centerY
        );
        y = yPositions[i]!;
      } else {
        y = rng.range(minY, maxY);
      }

      if (uniformZ) {
        const zPositions = generateUniformPositions(
          data.spriteCount,
          spacingZ,
          centerZ
        );
        z = zPositions[i]!;
      } else {
        z = rng.range(minZ, maxZ);
      }

      positions.push({ x, y, z });
    }
  }

  // Spawn sprites at generated positions
  for (const pos of positions) {
    const scale = rng.range(data.minScale, data.maxScale);
    const sprite = rng.pick(sprites);
    if (!sprite) continue;

    let builder = commands
      .spawn()
      .with(LocalTransform3D, {
        position: new Vector3(pos.x, pos.y, pos.z),
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
