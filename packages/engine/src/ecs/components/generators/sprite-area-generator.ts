import {
  component,
  type Entity,
  RuntimeAsset,
  AssetDatabase,
  isTextureMetadata,
  isTiledSpriteDefinition,
  isRectSpriteDefinition,
  AssetType,
  type Command,
  Vector3,
  SeededRandom,
  LocalTransform3D,
  Transform3D,
  Sprite2D,
  Parent,
  Children,
  globalComponentRegistry,
  EditorLayout,
} from '@voidscript/engine';

/**
 * Marker component to indicate sprites have been generated.
 * This is NOT serialized - sprites are regenerated at runtime.
 * No metadata = hidden from inspector.
 * serializerConfig = false = not serialized.
 */
export const SpriteAreaGeneratorGenerated = component<Record<string, never>>(
  'SpriteAreaGeneratorGenerated',
  false, // Not serializable - will be regenerated at runtime
  // No metadata = hidden from inspector
);

export interface SpriteAreaGeneratorData {
  // Boundary definition
  boundsMin: { x: number; y: number; z: number };
  boundsMax: { x: number; y: number; z: number };

  // Generation parameters
  spriteTexture: RuntimeAsset | null;
  seed: number;
  spriteCount: number;
  minScale: number;
  maxScale: number;
  minDistance: number;

  // Per-axis uniform distance controls
  uniformDistanceX: boolean;
  uniformDistanceY: boolean;
  uniformDistanceZ: boolean;
  uniformDistanceSpacing: { x: number; y: number; z: number }; // 0 = seeded random

  // Visual properties
  sortingLayer: number;
  sortingOrder: number;
  isLit: boolean;
  tintColor: { r: number; g: number; b: number; a: number };
  anchor: { x: number; y: number };

  // Additional components to spawn on each sprite
  additionalComponents: string[];
}

/**
 * Generate sprites as children of the parent entity
 */
function generateSprites(
  parentEntity: Entity,
  data: SpriteAreaGeneratorData,
  commands: Command,
): void {
  // 1. Clear existing children using Children component
  const existingChildren = commands.tryGetComponent(parentEntity, Children);
  if (existingChildren) {
    for (const childId of existingChildren.ids) {
      commands.entity(childId).destroyRecursive();
    }
  }

  // 2. Validate texture (we only need the asset reference, not the loaded data)
  if (!data.spriteTexture) {
    console.warn('[SpriteAreaGenerator] No texture selected');
    return;
  }

  const metadata = AssetDatabase.getMetadata(data.spriteTexture.guid);
  if (!metadata || !isTextureMetadata(metadata)) {
    console.warn('[SpriteAreaGenerator] Invalid texture metadata');
    return;
  }

  const sprites = metadata.sprites || [];
  if (sprites.length === 0) {
    console.warn('[SpriteAreaGenerator] No sprites in texture');
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
    .map((name) => globalComponentRegistry.getByName(name))
    .filter((comp) => comp !== undefined);

  // 5. Generate sprite positions
  const rng = new SeededRandom(data.seed);
  const childIds: Entity[] = [];
  let skippedCount = 0;

  // Use configured anchor or default to center
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

        // Check 3D distance to all existing sprites
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
        skippedCount++;
        continue;
      }

      positions.push({ x, y, z });
    }
  } else {
    // Uniform distance mode - expand from center outward
    // E.g., spriteCount=3, spacing=10, center=0 → [-10, 0, 10]
    // E.g., spriteCount=4, spacing=10, center=0 → [-15, -5, 5, 15]
    const spacing = data.uniformDistanceSpacing ?? { x: 5, y: 5, z: 5 };

    // Calculate center of bounds
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    // Check if bounds have any range (min != max)
    const hasRangeX = maxX - minX > 0;
    const hasRangeY = maxY - minY > 0;
    const hasRangeZ = maxZ - minZ > 0;

    // Calculate actual spacing for each axis:
    // - If spacing > 0: use that spacing
    // - If spacing == 0 AND has range: use seeded random spacing
    // - If spacing == 0 AND no range: use 0 (all at center)
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
    // count=3, spacing=10, center=0 → [-10, 0, 10]
    // count=3, spacing=0, center=5 → [5, 5, 5] (all at center)
    const generateUniformPositions = (
      count: number,
      spacingVal: number,
      center: number,
    ): number[] => {
      const result: number[] = [];
      if (spacingVal === 0) {
        // All sprites at center
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
        // Generate position for this sprite on X axis
        // All sprites get uniformly distributed positions
        const xPositions = generateUniformPositions(
          data.spriteCount,
          spacingX,
          centerX,
        );
        x = xPositions[i]!;
      } else {
        x = rng.range(minX, maxX);
      }

      if (uniformY) {
        const yPositions = generateUniformPositions(
          data.spriteCount,
          spacingY,
          centerY,
        );
        y = yPositions[i]!;
      } else {
        y = rng.range(minY, maxY);
      }

      if (uniformZ) {
        const zPositions = generateUniformPositions(
          data.spriteCount,
          spacingZ,
          centerZ,
        );
        z = zPositions[i]!;
      } else {
        z = rng.range(minZ, maxZ);
      }

      positions.push({ x, y, z });
    }
  }

  // Spawn sprites at generated positions (limited to spriteCount)
  const positionsToUse = positions.slice(0, data.spriteCount);

  for (const pos of positionsToUse) {
    const scale = rng.range(data.minScale, data.maxScale);
    const sprite = rng.pick(sprites);
    if (!sprite) continue;

    // Spawn WITH Parent component (critical for proper hierarchy!)
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
      const defaultValue = componentType.metadata?.defaultValue;
      const componentData =
        typeof defaultValue === 'function' ? defaultValue() : defaultValue;
      builder = builder.with(componentType, componentData);
    }

    const childEntity = builder.build();

    childIds.push(childEntity.id());
  }

  // 6. Batch update parent's Children component (OUTSIDE query iteration)
  if (childIds.length > 0) {
    commands.entity(parentEntity).addComponent(Children, {
      ids: new Set(childIds),
    });
  }

  // 7. Add marker component to indicate sprites have been generated
  commands.entity(parentEntity).addComponent(SpriteAreaGeneratorGenerated, {});

  if (skippedCount > 0) {
    console.log(
      `[SpriteAreaGenerator] Generated ${childIds.length} of ${data.spriteCount} sprites (${skippedCount} skipped due to distance constraints)`,
    );
  } else {
    console.log(`[SpriteAreaGenerator] Generated ${childIds.length} sprites`);
  }
}

/**
 * Clear all sprite children
 */
function clearSprites(parentEntity: Entity, commands: Command): void {
  const existingChildren = commands.tryGetComponent(parentEntity, Children);
  if (existingChildren) {
    // Destroy all child entities
    for (const childId of existingChildren.ids) {
      commands.entity(childId).destroyRecursive();
    }
    // Clear the Children component's ids Set to remove dead references
    existingChildren.ids.clear();
  }

  // Remove the generated marker so sprites can be regenerated
  commands.entity(parentEntity).removeComponent(SpriteAreaGeneratorGenerated);

  console.log('[SpriteAreaGenerator] Cleared all sprites');
}

// ============================================================================
// Custom Editor - Helper Functions
// ============================================================================

function renderBoundsSection(data: SpriteAreaGeneratorData): void {
  if (EditorLayout.beginGroup('Bounds', true)) {
    EditorLayout.beginLabelsWidth(['Min', 'Max']);

    // Min Bounds
    const [boundsMin, minChanged] = EditorLayout.vector3Field(
      'Min',
      new Vector3(data.boundsMin.x, data.boundsMin.y, data.boundsMin.z),
      {
        speed: 0.5,
        tooltip: 'Minimum bounds for sprite generation area',
      },
    );
    if (minChanged) {
      data.boundsMin.x = boundsMin.x;
      data.boundsMin.y = boundsMin.y;
      data.boundsMin.z = boundsMin.z;
    }

    // Max Bounds
    const [boundsMax, maxChanged] = EditorLayout.vector3Field(
      'Max',
      new Vector3(data.boundsMax.x, data.boundsMax.y, data.boundsMax.z),
      {
        speed: 0.5,
        tooltip: 'Maximum bounds for sprite generation area',
      },
    );
    if (maxChanged) {
      data.boundsMax.x = boundsMax.x;
      data.boundsMax.y = boundsMax.y;
      data.boundsMax.z = boundsMax.z;
    }

    EditorLayout.endLabelsWidth();
    EditorLayout.spacing();

    // Validate bounds
    if (
      data.boundsMin.x > data.boundsMax.x ||
      data.boundsMin.y > data.boundsMax.y ||
      data.boundsMin.z > data.boundsMax.z
    ) {
      EditorLayout.warning('Min should be less than Max');
    }

    if (EditorLayout.button('Reset Bounds##bounds')) {
      data.boundsMin = { x: -50, y: 0, z: -5 };
      data.boundsMax = { x: 50, y: 30, z: 5 };
    }

    EditorLayout.endGroup();
  }
}

function renderGenerationSection(data: SpriteAreaGeneratorData): void {
  if (EditorLayout.beginGroup('Generation', true)) {
    EditorLayout.beginLabelsWidth([
      'Texture',
      'Seed',
      'Sprite Count',
      'Min Distance',
    ]);

    // Texture picker using runtimeAssetField
    const [texture, textureChanged] = EditorLayout.runtimeAssetField(
      'Texture',
      data.spriteTexture,
      {
        assetTypes: [AssetType.Texture],
        allowClear: true,
        tooltip: 'Texture containing sprite definitions',
      },
    );
    if (textureChanged) {
      data.spriteTexture = texture;
    }

    // Show sprite count if texture is selected
    if (data.spriteTexture && data.spriteTexture.guid) {
      const metadata = AssetDatabase.getMetadata(data.spriteTexture.guid);
      if (metadata && isTextureMetadata(metadata)) {
        const sprites = metadata.sprites || [];
        EditorLayout.textDisabled(`(${sprites.length} sprites available)`);
      }
    }

    EditorLayout.spacing();

    // Seed
    const [seed, seedChanged] = EditorLayout.integerField('Seed', data.seed, {
      tooltip: 'Random seed for deterministic generation',
    });
    if (seedChanged) data.seed = seed;

    EditorLayout.sameLine();
    if (EditorLayout.button('Randomize##seed')) {
      data.seed = Math.floor(Math.random() * 1000000);
    }

    EditorLayout.spacing();

    // Sprite count
    const [spriteCount, countChanged] = EditorLayout.integerField(
      'Sprite Count',
      data.spriteCount,
      {
        speed: 1,
        min: 0,
        max: 10000,
        tooltip: 'Number of sprites to generate',
      },
    );
    if (countChanged) data.spriteCount = Math.max(0, spriteCount);

    EditorLayout.endLabelsWidth();
    EditorLayout.spacing();

    // Scale range
    EditorLayout.text('Scale Range:');
    EditorLayout.beginIndent();
    EditorLayout.beginLabelsWidth(['Min Scale', 'Max Scale']);

    const [minScale, minScaleChanged] = EditorLayout.numberField(
      'Min Scale',
      data.minScale,
      {
        speed: 0.01,
        min: 0.01,
        max: 20,
        tooltip: 'Minimum sprite scale',
      },
    );
    if (minScaleChanged) data.minScale = Math.max(0.01, minScale);

    const [maxScale, maxScaleChanged] = EditorLayout.numberField(
      'Max Scale',
      data.maxScale,
      {
        speed: 0.01,
        min: 0.01,
        max: 20,
        tooltip: 'Maximum sprite scale',
      },
    );
    if (maxScaleChanged) data.maxScale = Math.max(0.01, maxScale);

    EditorLayout.endLabelsWidth();
    EditorLayout.endIndent();

    EditorLayout.spacing();

    // Uniform Distance section
    EditorLayout.text('Uniform Distance:');
    EditorLayout.beginIndent();

    // Per-axis toggles (horizontal layout)
    const [uniformX, uniformXChanged] = EditorLayout.checkboxField(
      'X',
      data.uniformDistanceX ?? false,
      { tooltip: 'Use uniform spacing on X axis' },
    );
    if (uniformXChanged) data.uniformDistanceX = uniformX;

    EditorLayout.sameLine();

    const [uniformY, uniformYChanged] = EditorLayout.checkboxField(
      'Y',
      data.uniformDistanceY ?? false,
      { tooltip: 'Use uniform spacing on Y axis' },
    );
    if (uniformYChanged) data.uniformDistanceY = uniformY;

    EditorLayout.sameLine();

    const [uniformZ, uniformZChanged] = EditorLayout.checkboxField(
      'Z',
      data.uniformDistanceZ ?? false,
      { tooltip: 'Use uniform spacing on Z axis' },
    );
    if (uniformZChanged) data.uniformDistanceZ = uniformZ;

    // Show spacing Vector3 if any uniform axis is enabled
    const hasUniform =
      data.uniformDistanceX || data.uniformDistanceY || data.uniformDistanceZ;
    if (hasUniform) {
      if (!data.uniformDistanceSpacing) {
        data.uniformDistanceSpacing = { x: 5, y: 5, z: 5 };
      }

      EditorLayout.beginLabelsWidth(['Spacing']);
      const [spacing, spacingChanged] = EditorLayout.vector3Field(
        'Spacing',
        new Vector3(
          data.uniformDistanceSpacing.x,
          data.uniformDistanceSpacing.y,
          data.uniformDistanceSpacing.z,
        ),
        {
          speed: 0.1,
          min: 0,
          tooltip: 'Spacing per axis (0 = seeded random)',
        },
      );
      if (spacingChanged) {
        data.uniformDistanceSpacing.x = spacing.x;
        data.uniformDistanceSpacing.y = spacing.y;
        data.uniformDistanceSpacing.z = spacing.z;
      }
      EditorLayout.endLabelsWidth();
    }

    EditorLayout.endIndent();

    // Only show minDistance if fully random (no uniform axes enabled)
    const isFullyRandom =
      !data.uniformDistanceX && !data.uniformDistanceY && !data.uniformDistanceZ;
    if (isFullyRandom) {
      EditorLayout.spacing();

      EditorLayout.beginLabelsWidth(['Min Distance']);

      // Min Distance
      const [minDistance, minDistChanged] = EditorLayout.numberField(
        'Min Distance',
        data.minDistance ?? 0,
        {
          speed: 0.1,
          min: 0,
          max: 100,
          tooltip: 'Minimum 3D distance between sprites (0 = disabled)',
        },
      );
      if (minDistChanged) data.minDistance = Math.max(0, minDistance);

      EditorLayout.endLabelsWidth();
    }

    EditorLayout.endGroup();
  }
}

function renderVisualPropertiesSection(data: SpriteAreaGeneratorData): void {
  if (EditorLayout.beginGroup('Visual Properties', false)) {
    EditorLayout.beginLabelsWidth([
      'Sorting Layer',
      'Sorting Order',
      'Anchor',
      'Is Lit',
      'Tint Color',
    ]);

    // Sorting Layer
    const [sortingLayer, layerChanged] = EditorLayout.integerField(
      'Sorting Layer',
      data.sortingLayer,
      {
        speed: 1,
        min: -1000,
        max: 1000,
        tooltip: 'Sorting layer for render order',
      },
    );
    if (layerChanged) data.sortingLayer = sortingLayer;

    // Sorting Order
    const [sortingOrder, orderChanged] = EditorLayout.integerField(
      'Sorting Order',
      data.sortingOrder,
      {
        speed: 1,
        min: -1000,
        max: 1000,
        tooltip: 'Sorting order within the layer',
      },
    );
    if (orderChanged) data.sortingOrder = sortingOrder;

    EditorLayout.spacing();

    // Anchor
    if (!data.anchor) {
      data.anchor = { x: 0.5, y: 0.5 };
    }
    const [anchor, anchorChanged] = EditorLayout.vector2Field(
      'Anchor',
      data.anchor,
      {
        speed: 0.01,
        min: 0,
        max: 1,
        tooltip: 'Sprite anchor point (0-1 range)',
      },
    );
    if (anchorChanged) {
      data.anchor.x = anchor.x;
      data.anchor.y = anchor.y;
    }

    EditorLayout.spacing();

    // Is Lit
    const [isLit, isLitChanged] = EditorLayout.checkboxField(
      'Is Lit',
      data.isLit,
      {
        tooltip: 'Whether sprites receive lighting',
      },
    );
    if (isLitChanged) data.isLit = isLit;

    EditorLayout.spacing();

    // Tint Color
    if (!data.tintColor) {
      data.tintColor = { r: 1, g: 1, b: 1, a: 1 };
    }
    const [tintColor, tintChanged] = EditorLayout.colorField(
      'Tint Color',
      data.tintColor,
      {
        hasAlpha: true,
        tooltip: 'Tint color applied to all sprites',
      },
    );
    if (tintChanged) {
      data.tintColor.r = tintColor.r;
      data.tintColor.g = tintColor.g;
      data.tintColor.b = tintColor.b;
      data.tintColor.a = tintColor.a ?? 1;
    }

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderAdditionalComponentsSection(
  data: SpriteAreaGeneratorData,
): void {
  if (EditorLayout.beginGroup('Additional Components', false)) {
    // Initialize if missing
    if (!data.additionalComponents) {
      data.additionalComponents = [];
    }

    EditorLayout.textDisabled('Components spawned on each sprite:');
    EditorLayout.spacing();

    EditorLayout.beginLabelsWidth(['Components']);

    // Use componentNamesField for managing additional components
    const [components, componentsChanged] = EditorLayout.componentNamesField(
      'Components',
      data.additionalComponents,
      {
        tooltip: 'Additional components to add to generated sprites',
        id: 'additionalComponents',
        filter: (comp) => {
          // Filter out base components that are always added
          const excludedNames = [
            'LocalTransform3D',
            'Transform3D',
            'Parent',
            'Sprite2D',
            'Children',
          ];
          return !excludedNames.includes(comp.name);
        },
      },
    );
    if (componentsChanged) {
      data.additionalComponents = components;
    }

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderActionsSection(
  entity: Entity,
  data: SpriteAreaGeneratorData,
  commands: Command,
): void {
  EditorLayout.separator();
  EditorLayout.spacing();

  if (EditorLayout.button('Generate Sprites##action')) {
    generateSprites(entity, data, commands);
  }

  EditorLayout.sameLine();

  if (EditorLayout.button('Clear Sprites##action')) {
    clearSprites(entity, commands);
  }

  EditorLayout.spacing();

  // Info - get child count from Children component
  const children = commands.tryGetComponent(entity, Children);
  const count = children?.ids.size ?? 0;

  // DEBUG: Count how many children are actually alive
  let aliveCount = 0;
  if (children?.ids) {
    for (const childId of children.ids) {
      if (commands.isAlive(childId)) {
        aliveCount++;
      }
    }
  }

  if (aliveCount !== count) {
    EditorLayout.warning(
      `Children: ${aliveCount} (${count - aliveCount} dead refs!)`,
    );
  } else {
    EditorLayout.textDisabled(`Children: ${count}`);
  }
}

export const SpriteAreaGenerator = component<SpriteAreaGeneratorData>(
  'SpriteAreaGenerator',
  {
    boundsMin: {
      serializable: true,
    },
    boundsMax: {
      serializable: true,
    },
    spriteTexture: {
      serializable: true,
      type: 'runtimeAsset',
      assetTypes: [AssetType.Texture],
      whenNullish: 'keep',
    },
    seed: {
      serializable: true,
      instanceType: Number,
    },
    spriteCount: {
      serializable: true,
      instanceType: Number,
    },
    minScale: {
      serializable: true,
      instanceType: Number,
    },
    maxScale: {
      serializable: true,
      instanceType: Number,
    },
    minDistance: {
      serializable: true,
      instanceType: Number,
    },
    uniformDistanceX: {
      serializable: true,
      instanceType: Boolean,
    },
    uniformDistanceY: {
      serializable: true,
      instanceType: Boolean,
    },
    uniformDistanceZ: {
      serializable: true,
      instanceType: Boolean,
    },
    uniformDistanceSpacing: {
      serializable: true,
    },
    sortingLayer: {
      serializable: true,
      instanceType: Number,
    },
    sortingOrder: {
      serializable: true,
      instanceType: Number,
    },
    isLit: {
      serializable: true,
      instanceType: Boolean,
    },
    tintColor: {
      serializable: true,
    },
    anchor: {
      serializable: true,
    },
    additionalComponents: {
      serializable: true,
    },
  },
  {
    displayName: 'Sprite Area Generator',
    description:
      'Generates seeded sprite children within defined 3D boundaries',
    path: 'generators/sprites',
    showHelper: true,
    skipChildrenSerialization: true,
    defaultValue: () => ({
      boundsMin: { x: -50, y: 0, z: -5 },
      boundsMax: { x: 50, y: 30, z: 5 },
      spriteTexture: null,
      seed: 42,
      spriteCount: 50,
      minScale: 0.5,
      maxScale: 2.0,
      minDistance: 0,
      uniformDistanceX: false,
      uniformDistanceY: false,
      uniformDistanceZ: false,
      uniformDistanceSpacing: { x: 5, y: 5, z: 5 },
      sortingLayer: 0,
      sortingOrder: 0,
      isLit: false,
      tintColor: { r: 1, g: 1, b: 1, a: 1 },
      anchor: { x: 0.5, y: 0.5 },
      additionalComponents: [],
    }),
    customEditor: ({ entity, componentData, commands }) => {
      // Render all sections using helper functions
      renderBoundsSection(componentData);
      renderGenerationSection(componentData);
      renderVisualPropertiesSection(componentData);
      renderAdditionalComponentsSection(componentData);
      renderActionsSection(entity, componentData, commands);
    },
  },
);
