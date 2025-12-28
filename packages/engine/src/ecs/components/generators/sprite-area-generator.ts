import {
  component,
  type Entity,
  RuntimeAsset,
  RuntimeAssetManager,
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
  renderComponentNamePicker,
} from '@voidscript/engine';
import { ImGui, ImVec2, ImVec4 } from '@mori2003/jsimgui';

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
  commands: Command
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
    .map(name => globalComponentRegistry.getByName(name))
    .filter(comp => comp !== undefined);

  // 5. Generate sprites with optional minimum distance constraint
  const rng = new SeededRandom(data.seed);
  const childIds: Entity[] = [];
  const generatedPositions: { x: number; y: number; z: number }[] = [];
  const minDistSquared = data.minDistance * data.minDistance;
  const maxAttempts = 100;
  let skippedCount = 0;

  // Use configured anchor or default to center
  const anchor = data.anchor ?? { x: 0.5, y: 0.5 };

  for (let i = 0; i < data.spriteCount; i++) {
    let attempts = 0;
    let validPosition = false;
    let x = 0, y = 0, z = 0;

    // Try to find a valid position
    while (attempts < maxAttempts && !validPosition) {
      x = rng.range(minX, maxX);
      y = rng.range(minY, maxY);
      z = rng.range(minZ, maxZ);

      // Check 3D distance to all existing sprites
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
      skippedCount++;
      continue;
    }

    generatedPositions.push({ x, y, z });

    const scale = rng.range(data.minScale, data.maxScale);
    const sprite = rng.pick(sprites);
    if (!sprite) continue;

    // Spawn WITH Parent component (critical for proper hierarchy!)
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
          ? { x: sprite.x, y: sprite.y, width: sprite.width, height: sprite.height }
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
      const componentData = typeof defaultValue === 'function' ? defaultValue() : defaultValue;
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
    console.log(`[SpriteAreaGenerator] Generated ${childIds.length} of ${data.spriteCount} sprites (${skippedCount} skipped due to distance constraints)`);
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
  if (ImGui.CollapsingHeader('📦 Bounds', ImGui.TreeNodeFlags.DefaultOpen)) {
    ImGui.Indent();

    // Min Bounds - inline X Y Z
    ImGui.Text('Min:');
    ImGui.SameLine();
    const minX: [number] = [data.boundsMin.x];
    const minY: [number] = [data.boundsMin.y];
    const minZ: [number] = [data.boundsMin.z];
    ImGui.SetNextItemWidth(60);
    if (ImGui.DragFloat('##minX', minX, 0.5)) {
      data.boundsMin.x = minX[0];
    }
    ImGui.SameLine();
    ImGui.SetNextItemWidth(60);
    if (ImGui.DragFloat('##minY', minY, 0.5)) {
      data.boundsMin.y = minY[0];
    }
    ImGui.SameLine();
    ImGui.SetNextItemWidth(60);
    if (ImGui.DragFloat('##minZ', minZ, 0.5)) {
      data.boundsMin.z = minZ[0];
    }

    // Max Bounds - inline X Y Z
    ImGui.Text('Max:');
    ImGui.SameLine();
    const maxX: [number] = [data.boundsMax.x];
    const maxY: [number] = [data.boundsMax.y];
    const maxZ: [number] = [data.boundsMax.z];
    ImGui.SetNextItemWidth(60);
    if (ImGui.DragFloat('##maxX', maxX, 0.5)) {
      data.boundsMax.x = maxX[0];
    }
    ImGui.SameLine();
    ImGui.SetNextItemWidth(60);
    if (ImGui.DragFloat('##maxY', maxY, 0.5)) {
      data.boundsMax.y = maxY[0];
    }
    ImGui.SameLine();
    ImGui.SetNextItemWidth(60);
    if (ImGui.DragFloat('##maxZ', maxZ, 0.5)) {
      data.boundsMax.z = maxZ[0];
    }

    ImGui.Spacing();

    // Validate bounds
    if (
      data.boundsMin.x > data.boundsMax.x ||
      data.boundsMin.y > data.boundsMax.y ||
      data.boundsMin.z > data.boundsMax.z
    ) {
      ImGui.TextColored(
        new ImVec4(1.0, 0.5, 0.0, 1.0),
        'Warning: Min should be less than Max',
      );
    }

    if (ImGui.Button('Reset Bounds')) {
      data.boundsMin = { x: -50, y: 0, z: -5 };
      data.boundsMax = { x: 50, y: 30, z: 5 };
    }

    ImGui.Unindent();
  }
}

function renderGenerationSection(data: SpriteAreaGeneratorData): void {
  if (ImGui.CollapsingHeader('🎲 Generation', ImGui.TreeNodeFlags.DefaultOpen)) {
    ImGui.Indent();

    // Texture picker
    ImGui.Text('Texture:');
    ImGui.SameLine();
    if (data.spriteTexture && data.spriteTexture.guid) {
      const metadata = AssetDatabase.getMetadata(data.spriteTexture.guid);
      const textureName = metadata?.path.split('/').pop() || 'Unknown';
      ImGui.TextColored(new ImVec4(0.7, 0.9, 0.7, 1.0), textureName);

      // Show sprite count
      if (metadata && isTextureMetadata(metadata)) {
        const sprites = metadata.sprites || [];
        ImGui.SameLine();
        ImGui.TextDisabled(`(${sprites.length} sprites)`);
      }
    } else {
      ImGui.TextDisabled('(None)');
    }

    if (ImGui.Button('Select Texture##spriteTexture')) {
      ImGui.OpenPopup('TexturePicker##spriteTexture');
    }

    // Texture picker popup
    const popupOpen: [boolean] = [true];
    if (ImGui.BeginPopupModal('TexturePicker##spriteTexture', popupOpen, ImGui.WindowFlags.AlwaysAutoResize)) {
      ImGui.Text('Select Sprite Texture');
      ImGui.Separator();

      const textureGuids = AssetDatabase.getAllGuids().filter((guid) => {
        const meta = AssetDatabase.getMetadata(guid);
        return meta && meta.type === AssetType.Texture;
      });

      ImGui.BeginChild('TextureList', new ImVec2(400, 300), 1);
      let selectedGuid: string | null = null;
      for (const guid of textureGuids) {
        const meta = AssetDatabase.getMetadata(guid);
        if (meta) {
          const name = meta.path.split('/').pop() || guid;
          if (ImGui.Selectable(name, data.spriteTexture?.guid === guid)) {
            selectedGuid = guid;
          }
        }
      }
      ImGui.EndChild();

      if (selectedGuid) {
        const metadata = AssetDatabase.getMetadata(selectedGuid);
        if (metadata) {
          data.spriteTexture = RuntimeAssetManager.get().getOrCreate(
            selectedGuid,
            metadata,
          );
        }
        ImGui.CloseCurrentPopup();
      }

      if (ImGui.Button('Cancel')) {
        ImGui.CloseCurrentPopup();
      }

      ImGui.EndPopup();
    }

    ImGui.Spacing();

    // Seed
    ImGui.Text('Seed:');
    ImGui.SameLine();
    const seed: [number] = [data.seed];
    ImGui.SetNextItemWidth(120);
    if (ImGui.InputInt('##seed', seed)) {
      data.seed = seed[0];
    }
    ImGui.SameLine();
    if (ImGui.Button('Randomize')) {
      data.seed = Math.floor(Math.random() * 1000000);
    }

    ImGui.Spacing();

    // Sprite count - drag + input for precise control
    ImGui.Text('Sprite Count:');
    const spriteCount: [number] = [data.spriteCount];
    ImGui.SetNextItemWidth(120);
    ImGui.DragInt('##spriteCountDrag', spriteCount, 1, 0, 10000);
    ImGui.SameLine();
    ImGui.SetNextItemWidth(80);
    if (ImGui.InputInt('##spriteCountInput', spriteCount, 0, 0)) {
      // InputInt returns true on change
    }
    data.spriteCount = Math.max(0, spriteCount[0]);

    ImGui.Spacing();

    // Scale range - drag + input for precise control
    ImGui.Text('Scale Range:');
    ImGui.Indent();

    ImGui.Text('Min:');
    ImGui.SameLine();
    const minScale: [number] = [data.minScale];
    ImGui.SetNextItemWidth(80);
    ImGui.DragFloat('##minScaleDrag', minScale, 0.01, 0.01, 20);
    ImGui.SameLine();
    ImGui.SetNextItemWidth(60);
    ImGui.InputFloat('##minScaleInput', minScale);
    data.minScale = Math.max(0.01, minScale[0]);

    ImGui.Text('Max:');
    ImGui.SameLine();
    const maxScale: [number] = [data.maxScale];
    ImGui.SetNextItemWidth(80);
    ImGui.DragFloat('##maxScaleDrag', maxScale, 0.01, 0.01, 20);
    ImGui.SameLine();
    ImGui.SetNextItemWidth(60);
    ImGui.InputFloat('##maxScaleInput', maxScale);
    data.maxScale = Math.max(0.01, maxScale[0]);

    ImGui.Unindent();

    ImGui.Spacing();

    // Min Distance
    ImGui.Text('Min Distance:');
    const minDist: [number] = [data.minDistance ?? 0];
    ImGui.SetNextItemWidth(100);
    ImGui.DragFloat('##minDistDrag', minDist, 0.1, 0, 100);
    ImGui.SameLine();
    ImGui.SetNextItemWidth(60);
    ImGui.InputFloat('##minDistInput', minDist);
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Minimum 3D distance between sprites (0 = disabled)');
    }
    data.minDistance = Math.max(0, minDist[0]);

    ImGui.Unindent();
  }
}

function renderVisualPropertiesSection(data: SpriteAreaGeneratorData): void {
  if (ImGui.CollapsingHeader('🎨 Visual Properties')) {
    ImGui.Indent();

    // Sorting Layer
    ImGui.Text('Sorting Layer:');
    const sortingLayer: [number] = [data.sortingLayer];
    ImGui.SetNextItemWidth(100);
    if (ImGui.DragInt('##sortingLayer', sortingLayer, 1, -1000, 1000)) {
      data.sortingLayer = sortingLayer[0];
    }

    // Sorting Order
    ImGui.Text('Sorting Order:');
    const sortingOrder: [number] = [data.sortingOrder];
    ImGui.SetNextItemWidth(100);
    if (ImGui.DragInt('##sortingOrder', sortingOrder, 1, -1000, 1000)) {
      data.sortingOrder = sortingOrder[0];
    }

    ImGui.Spacing();

    // Anchor
    ImGui.Text('Anchor:');
    if (!data.anchor) {
      data.anchor = { x: 0.5, y: 0.5 };
    }
    const anchorX: [number] = [data.anchor.x];
    const anchorY: [number] = [data.anchor.y];
    ImGui.SetNextItemWidth(80);
    ImGui.DragFloat('##anchorX', anchorX, 0.01, 0, 1);
    ImGui.SameLine();
    ImGui.Text('×');
    ImGui.SameLine();
    ImGui.SetNextItemWidth(80);
    ImGui.DragFloat('##anchorY', anchorY, 0.01, 0, 1);
    data.anchor.x = anchorX[0];
    data.anchor.y = anchorY[0];

    ImGui.Spacing();

    // Is Lit (simple checkbox, no tooltip as per user request)
    const isLit: [boolean] = [data.isLit];
    if (ImGui.Checkbox('Is Lit', isLit)) {
      data.isLit = isLit[0];
    }

    ImGui.Spacing();

    // Tint Color
    if (!data.tintColor) {
      data.tintColor = { r: 1, g: 1, b: 1, a: 1 };
    }
    ImGui.Text('Tint Color:');
    const tintColor: [number, number, number, number] = [
      data.tintColor.r,
      data.tintColor.g,
      data.tintColor.b,
      data.tintColor.a,
    ];
    if (ImGui.ColorEdit4('##tintColor', tintColor)) {
      data.tintColor.r = tintColor[0];
      data.tintColor.g = tintColor[1];
      data.tintColor.b = tintColor[2];
      data.tintColor.a = tintColor[3];
    }

    ImGui.Unindent();
  }
}

function renderAdditionalComponentsSection(data: SpriteAreaGeneratorData): void {
  if (ImGui.CollapsingHeader('🧩 Additional Components')) {
    ImGui.Indent();

    // Initialize if missing
    if (!data.additionalComponents) {
      data.additionalComponents = [];
    }

    ImGui.TextDisabled('Components spawned on each sprite:');
    ImGui.Spacing();

    // List existing components
    if (data.additionalComponents.length === 0) {
      ImGui.TextDisabled('(None)');
    } else {
      let componentToRemove: string | null = null;

      for (let i = 0; i < data.additionalComponents.length; i++) {
        const componentName = data.additionalComponents[i];
        if (!componentName) continue;

        const componentType = globalComponentRegistry.getByName(componentName);
        const displayName = componentType?.metadata?.displayName || componentName;

        ImGui.BulletText(displayName);
        ImGui.SameLine();
        if (ImGui.SmallButton(`Remove##${i}`)) {
          componentToRemove = componentName;
        }

        // Tooltip with description
        if (ImGui.IsItemHovered() && componentType?.metadata?.description) {
          ImGui.SetTooltip(componentType.metadata.description);
        }
      }

      // Remove component outside the loop
      if (componentToRemove) {
        data.additionalComponents = data.additionalComponents.filter(
          name => name !== componentToRemove
        );
      }
    }

    ImGui.Spacing();

    // Add component button
    ImGui.PushID('additionalComponentsSection');
    if (ImGui.Button('Add Component', new ImVec2(200, 0))) {
      ImGui.OpenPopup('ComponentPicker##spriteAreaGen');
    }

    // Component picker popup
    renderComponentNamePicker({
      popupId: 'ComponentPicker##spriteAreaGen',
      selectedNames: data.additionalComponents,
      multiSelect: true,
      onSelect: (names) => {
        data.additionalComponents = names;
      },
      filter: (comp) => {
        // Filter out base components that are always added
        const excludedNames = ['LocalTransform3D', 'Transform3D', 'Parent', 'Sprite2D', 'Children'];
        return !excludedNames.includes(comp.name);
      },
    });
    ImGui.PopID();

    ImGui.Unindent();
  }
}

function renderActionsSection(
  entity: Entity,
  data: SpriteAreaGeneratorData,
  commands: Command
): void {
  ImGui.Separator();
  ImGui.Spacing();

  if (ImGui.Button('Generate Sprites', new ImVec2(150, 28))) {
    generateSprites(entity, data, commands);
  }

  ImGui.SameLine();

  if (ImGui.Button('Clear Sprites', new ImVec2(150, 28))) {
    clearSprites(entity, commands);
  }

  ImGui.Spacing();

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
    ImGui.TextColored({ x: 1, y: 0.5, z: 0, w: 1 }, `Children: ${aliveCount} (${count - aliveCount} dead refs!)`);
  } else {
    ImGui.TextDisabled(`Children: ${count}`);
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
    description: 'Generates seeded sprite children within defined 3D boundaries',
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
