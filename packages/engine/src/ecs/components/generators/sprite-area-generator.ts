import {
  component,
  type Entity,
  RuntimeAsset,
  RuntimeAssetManager,
  AssetDatabase,
  isTextureMetadata,
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

  // Visual properties
  sortingLayer: number;
  sortingOrder: number;
  isLit: boolean;
  tintColor: { r: number; g: number; b: number; a: number };

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

  // 2. Validate texture
  if (!data.spriteTexture || !data.spriteTexture.isLoaded) {
    console.warn('[SpriteAreaGenerator] No texture loaded');
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

  // 5. Generate sprites
  const rng = new SeededRandom(data.seed);
  const childIds: Entity[] = [];

  for (let i = 0; i < data.spriteCount; i++) {
    const x = rng.range(minX, maxX);
    const y = rng.range(minY, maxY);
    const z = rng.range(minZ, maxZ);
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
        tileIndex: sprite.tileIndex,
        tileSize:
          sprite.tileWidth && sprite.tileHeight
            ? { x: sprite.tileWidth, y: sprite.tileHeight }
            : null,
        tilesetSize:
          metadata.width && metadata.height
            ? { x: metadata.width, y: metadata.height }
            : null,
        pixelsPerUnit: 100,
        flipX: false,
        flipY: false,
        sortingLayer: data.sortingLayer,
        sortingOrder: data.sortingOrder,
        anchor: { x: 0.5, y: 0.5 },
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

  console.log(`[SpriteAreaGenerator] Generated ${childIds.length} sprites`);
}

/**
 * Clear all sprite children
 */
function clearSprites(parentEntity: Entity, commands: Command): void {
  const existingChildren = commands.tryGetComponent(parentEntity, Children);
  if (existingChildren) {
    for (const childId of existingChildren.ids) {
      commands.entity(childId).destroyRecursive();
    }
  }
  console.log('[SpriteAreaGenerator] Cleared all sprites');
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
    additionalComponents: {
      serializable: true,
    },
  },
  {
    displayName: 'Sprite Area Generator',
    description: 'Generates seeded sprite children within defined 3D boundaries',
    path: 'generators/sprites',
    showHelper: true,
    defaultValue: () => ({
      boundsMin: { x: -50, y: 0, z: -5 },
      boundsMax: { x: 50, y: 30, z: 5 },
      spriteTexture: null,
      seed: 42,
      spriteCount: 50,
      minScale: 0.5,
      maxScale: 2.0,
      sortingLayer: 0,
      sortingOrder: 0,
      isLit: false,
      tintColor: { r: 1, g: 1, b: 1, a: 1 },
      additionalComponents: [],
    }),
    customEditor: ({ entity, componentData, commands }) => {
      // Header
      ImGui.TextColored(new ImVec4(0.4, 0.7, 1.0, 1.0), 'Sprite Area Generator');
      ImGui.Separator();
      ImGui.Spacing();

      // Bounds Section
      if (ImGui.CollapsingHeader('Bounds', ImGui.TreeNodeFlags.DefaultOpen)) {
        ImGui.Indent();

        ImGui.Text('Min Bounds:');
        ImGui.Indent();
        const minX: [number] = [componentData.boundsMin.x];
        const minY: [number] = [componentData.boundsMin.y];
        const minZ: [number] = [componentData.boundsMin.z];
        if (ImGui.DragFloat('X##minX', minX, 0.5)) {
          componentData.boundsMin.x = minX[0];
        }
        if (ImGui.DragFloat('Y##minY', minY, 0.5)) {
          componentData.boundsMin.y = minY[0];
        }
        if (ImGui.DragFloat('Z##minZ', minZ, 0.5)) {
          componentData.boundsMin.z = minZ[0];
        }
        ImGui.Unindent();
        ImGui.Spacing();

        ImGui.Text('Max Bounds:');
        ImGui.Indent();
        const maxX: [number] = [componentData.boundsMax.x];
        const maxY: [number] = [componentData.boundsMax.y];
        const maxZ: [number] = [componentData.boundsMax.z];
        if (ImGui.DragFloat('X##maxX', maxX, 0.5)) {
          componentData.boundsMax.x = maxX[0];
        }
        if (ImGui.DragFloat('Y##maxY', maxY, 0.5)) {
          componentData.boundsMax.y = maxY[0];
        }
        if (ImGui.DragFloat('Z##maxZ', maxZ, 0.5)) {
          componentData.boundsMax.z = maxZ[0];
        }
        ImGui.Unindent();
        ImGui.Spacing();

        // Validate bounds
        if (
          componentData.boundsMin.x > componentData.boundsMax.x ||
          componentData.boundsMin.y > componentData.boundsMax.y ||
          componentData.boundsMin.z > componentData.boundsMax.z
        ) {
          ImGui.TextColored(
            new ImVec4(1.0, 0.5, 0.0, 1.0),
            'Warning: Min should be less than Max',
          );
        }

        if (ImGui.Button('Reset to Default (100x30x10)')) {
          componentData.boundsMin = { x: -50, y: 0, z: -5 };
          componentData.boundsMax = { x: 50, y: 30, z: 5 };
        }

        ImGui.Unindent();
      }

      ImGui.Spacing();

      // Generation Section
      if (ImGui.CollapsingHeader('Generation', ImGui.TreeNodeFlags.DefaultOpen)) {
        ImGui.Indent();

        // Texture picker
        ImGui.Text('Sprite Texture:');
        if (componentData.spriteTexture && componentData.spriteTexture.guid) {
          const metadata = AssetDatabase.getMetadata(componentData.spriteTexture.guid);
          const textureName = metadata?.path.split('/').pop() || 'Unknown';
          ImGui.SameLine();
          ImGui.TextColored(new ImVec4(0.7, 0.9, 0.7, 1.0), textureName);

          // Show sprite count
          if (metadata && isTextureMetadata(metadata)) {
            const sprites = metadata.sprites || [];
            ImGui.SameLine();
            ImGui.TextDisabled(`(${sprites.length} sprites)`);
          }
        } else {
          ImGui.SameLine();
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
              if (ImGui.Selectable(name, componentData.spriteTexture?.guid === guid)) {
                selectedGuid = guid;
              }
            }
          }
          ImGui.EndChild();

          if (selectedGuid) {
            const metadata = AssetDatabase.getMetadata(selectedGuid);
            if (metadata) {
              componentData.spriteTexture = RuntimeAssetManager.get().getOrCreate(
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
        const seed: [number] = [componentData.seed];
        ImGui.SetNextItemWidth(150);
        if (ImGui.InputInt('##seed', seed)) {
          componentData.seed = seed[0];
        }
        ImGui.SameLine();
        if (ImGui.Button('Randomize##seed')) {
          componentData.seed = Math.floor(Math.random() * 1000000);
        }

        ImGui.Spacing();

        // Sprite count
        const spriteCount: [number] = [componentData.spriteCount];
        if (ImGui.SliderInt('Sprite Count', spriteCount, 0, 10000)) {
          componentData.spriteCount = spriteCount[0];
        }

        ImGui.Spacing();

        // Scale range
        ImGui.Text('Scale Range:');
        ImGui.Indent();
        const minScale: [number] = [componentData.minScale];
        const maxScale: [number] = [componentData.maxScale];
        if (ImGui.SliderFloat('Min##minScale', minScale, 0.1, 10.0)) {
          componentData.minScale = minScale[0];
        }
        if (ImGui.SliderFloat('Max##maxScale', maxScale, 0.1, 10.0)) {
          componentData.maxScale = maxScale[0];
        }
        ImGui.Unindent();

        ImGui.Unindent();
      }

      ImGui.Spacing();

      // Visual Properties Section
      if (ImGui.CollapsingHeader('Visual Properties')) {
        ImGui.Indent();

        const sortingLayer: [number] = [componentData.sortingLayer];
        if (ImGui.InputInt('Sorting Layer', sortingLayer)) {
          componentData.sortingLayer = sortingLayer[0];
        }

        const sortingOrder: [number] = [componentData.sortingOrder];
        if (ImGui.InputInt('Sorting Order', sortingOrder)) {
          componentData.sortingOrder = sortingOrder[0];
        }

        ImGui.Spacing();

        const isLit: [boolean] = [componentData.isLit];
        if (ImGui.Checkbox('Is Lit', isLit)) {
          componentData.isLit = isLit[0];
        }
        ImGui.SameLine();
        ImGui.TextDisabled('(?)');
        if (ImGui.IsItemHovered()) {
          ImGui.SetTooltip('When enabled, sprites will respond to scene lighting');
        }

        ImGui.Spacing();

        // Tint Color - initialize if missing (for entities created before this property existed)
        if (!componentData.tintColor) {
          componentData.tintColor = { r: 1, g: 1, b: 1, a: 1 };
        }
        ImGui.Text('Tint Color:');
        const tintColor: [number, number, number, number] = [
          componentData.tintColor.r,
          componentData.tintColor.g,
          componentData.tintColor.b,
          componentData.tintColor.a,
        ];
        if (ImGui.ColorEdit4('##tintColor', tintColor)) {
          componentData.tintColor.r = tintColor[0];
          componentData.tintColor.g = tintColor[1];
          componentData.tintColor.b = tintColor[2];
          componentData.tintColor.a = tintColor[3];
        }

        ImGui.Unindent();
      }

      ImGui.Spacing();

      // Additional Components Section
      if (ImGui.CollapsingHeader('Additional Components')) {
        ImGui.Indent();

        // Initialize if missing
        if (!componentData.additionalComponents) {
          componentData.additionalComponents = [];
        }

        ImGui.Text('Components to spawn on each sprite:');
        ImGui.Spacing();

        // List existing components
        if (componentData.additionalComponents.length === 0) {
          ImGui.TextDisabled('(No additional components)');
        } else {
          let componentToRemove: string | null = null;

          for (let i = 0; i < componentData.additionalComponents.length; i++) {
            const componentName = componentData.additionalComponents[i];
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

          // Remove component (do this outside the loop to avoid modifying array while iterating)
          if (componentToRemove) {
            componentData.additionalComponents = componentData.additionalComponents.filter(
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
          selectedNames: componentData.additionalComponents,
          multiSelect: true,
          onSelect: (names) => {
            componentData.additionalComponents = names;
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

      ImGui.Spacing();
      ImGui.Separator();
      ImGui.Spacing();

      // Actions Section
      ImGui.TextColored(new ImVec4(1.0, 0.8, 0.3, 1.0), 'Actions');
      ImGui.Spacing();

      if (ImGui.Button('Generate Sprites', new ImVec2(200, 30))) {
        generateSprites(entity, componentData, commands);
      }

      ImGui.SameLine();

      if (ImGui.Button('Clear Sprites', new ImVec2(200, 30))) {
        clearSprites(entity, commands);
      }

      ImGui.Spacing();

      // Info - get child count from Children component (use tryGetComponent since it may not exist)
      const children = commands.tryGetComponent(entity, Children);
      const count = children?.ids.size ?? 0;
      ImGui.TextDisabled(`Children: ${count}`);
    },
  },
);
