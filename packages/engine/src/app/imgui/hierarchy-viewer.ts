/**
 * ImGui Hierarchy Viewer - Renders entity hierarchy tree
 *
 * Displays all entities in the world in a tree structure based on Parent/Children components.
 * Shows entity names from Name component or "Entity #{handle}" as fallback.
 */

import type { Application } from '../application.js';
import type { Entity } from '../../ecs/entity.js';
import { Parent, Children, Name, Transform3D, LocalTransform3D } from '../../ecs/components/index.js';
import { PrefabInstance } from '../../ecs/components/prefab-instance.js';
import { Vector3 } from '../../math/index.js';
import { ImGui } from '@mori2003/jsimgui';
import { setSelectedEntity, getSelectedEntity } from './inspector.js';
import { duplicateEntity } from '../../ecs/entity-utils.js';
import { globalBundleRegistry } from '../../ecs/bundle-registry.js';
import { spawnBundleWithDefaults } from '../../ecs/bundle-utils.js';
import { parseQuery, type ParsedQuery } from './entity-query-parser.js';
import { evaluateQuery } from './entity-query-evaluator.js';
import { PrefabManager } from '../../ecs/prefab-manager.js';
import { PrefabSerializer } from '../../ecs/prefab-serializer.js';
import { AssetDatabase } from '../../ecs/asset-database.js';
import { AssetType, isPrefabMetadata } from '../../ecs/asset-metadata.js';
import { RuntimeAssetManager } from '../../ecs/runtime-asset-manager.js';
import type { RuntimeAsset } from '../../ecs/runtime-asset.js';
import type { PrefabAsset } from '../../ecs/prefab-asset.js';
import type { EditorPlatform } from '../../editor/editor-platform.js';

/**
 * Render the hierarchy viewer window showing all entities in a tree structure
 * @param app Application instance
 */
// Track if entity context menu was opened this frame
let entityContextMenuOpened = false;

// Track entities that should auto-expand (when first child is added)
const autoExpandEntities = new Set<Entity>();

// Search filter state
let searchFilter = '';

// Cached parsed query (re-parse only when filter changes)
let cachedFilter = '';
let cachedQuery: ParsedQuery | null = null;

// Prefab picker popup state
let prefabPickerOpen = false;
let prefabPickerParentEntity: Entity | null = null; // null = spawn at root level

// Platform reference for file operations
let currentPlatform: EditorPlatform | null = null;

/**
 * Check if an entity matches the search filter query
 *
 * Supports advanced query syntax:
 * - `Test` - Entity name contains "test" (case-insensitive)
 * - `Test C:Sprite2D` - Name contains "test" AND has Sprite2D
 * - `C:Sprite2D,Transform3D` - Has BOTH Sprite2D AND Transform3D
 * - `C:Sprite2D C:Camera` - Has Sprite2D OR Camera
 * - `NC:Rigidbody2D` - Does NOT have Rigidbody2D
 * - `Player | Enemy` - Name contains "player" OR "enemy"
 * - `C:Sprite2D & NC:Camera` - Has Sprite2D AND lacks Camera
 */
function entityMatchesFilter(
  entity: Entity,
  world: Application['world'],
  filter: string,
): boolean {
  if (!filter.trim()) return true;

  // Re-parse only if filter changed
  if (filter !== cachedFilter) {
    cachedFilter = filter;
    const result = parseQuery(filter);
    cachedQuery = result.success ? result.query : null;
  }

  // Parse error = show all (graceful degradation)
  if (!cachedQuery) return true;

  return evaluateQuery(entity, world, cachedQuery);
}

/**
 * Recursively check if an entity or any of its descendants match the filter.
 * Returns a Set of entities that should be visible (matches + their ancestors).
 */
function collectVisibleEntities(
  entity: Entity,
  world: Application['world'],
  filter: string,
): Set<Entity> {
  const visible = new Set<Entity>();

  const selfMatches = entityMatchesFilter(entity, world, filter);

  // Check children
  const childrenComp = world.getComponent(entity, Children);
  let childMatches = false;

  if (childrenComp && childrenComp.ids.size > 0) {
    for (const childId of childrenComp.ids) {
      const childVisible = collectVisibleEntities(childId, world, filter);
      if (childVisible.size > 0) {
        childMatches = true;
        for (const e of childVisible) {
          visible.add(e);
        }
      }
    }
  }

  // Include this entity if it matches or has matching descendants
  if (selfMatches || childMatches) {
    visible.add(entity);
  }

  return visible;
}

export function renderImGuiHierarchy(app: Application, platform?: EditorPlatform | null): void {
  // Store platform reference for use in other functions
  currentPlatform = platform ?? null;

  // Setup window position and size (only on first use)
  ImGui.SetNextWindowPos({ x: 10, y: 10 }, ImGui.Cond.FirstUseEver);
  ImGui.SetNextWindowSize({ x: 300, y: 500 }, ImGui.Cond.FirstUseEver);

  if (ImGui.Begin('Hierarchy')) {
    const world = app.world;

    // Reset flag at start of frame
    entityContextMenuOpened = false;

    // Search input
    ImGui.SetNextItemWidth(-1); // Full width
    const filterBuffer: [string] = [searchFilter];
    ImGui.InputTextWithHint('##HierarchySearch', 'Search...', filterBuffer, 256);
    searchFilter = filterBuffer[0];

    ImGui.Separator();

    // Find ALL root entities (entities without Parent component)
    const roots: Entity[] = [];
    world
      .query()
      .none(Parent)
      .each((entity) => {
        roots.push(entity);
      });

    // Build set of visible entities based on filter
    let visibleEntities: Set<Entity> | null = null;
    if (searchFilter) {
      visibleEntities = new Set<Entity>();
      for (const root of roots) {
        const visible = collectVisibleEntities(root, world, searchFilter);
        for (const e of visible) {
          visibleEntities.add(e);
        }
      }
    }

    if (roots.length === 0) {
      ImGui.Text('No entities in scene');
    } else {
      // Render each root entity (with or without children)
      for (const root of roots) {
        // Skip roots that aren't visible when filtering
        if (visibleEntities && !visibleEntities.has(root)) {
          continue;
        }
        renderEntityNode(app, root, visibleEntities);
      }
    }

    // Context menu for the hierarchy panel (right-click on empty space)
    // Only open if no entity context menu was opened and not hovering over any item
    if (!entityContextMenuOpened && ImGui.IsWindowHovered() && !ImGui.IsAnyItemHovered() && ImGui.IsMouseClicked(1)) {
      ImGui.OpenPopup('HierarchyContextMenu');
    }

    if (ImGui.BeginPopup('HierarchyContextMenu')) {
      if (ImGui.MenuItem('Spawn Entity')) {
        // Spawn a new entity with Name and Transform3D
        const newEntity = world
          .spawn()
          .with(Name, { name: 'New Entity' })
          .with(Transform3D, {
            position: new Vector3(0, 0, 0),
            rotation: new Vector3(0, 0, 0),
            scale: new Vector3(1, 1, 1),
          })
          .build();
        setSelectedEntity(newEntity);
        console.log('[Hierarchy] Spawned new entity with Name and Transform3D');
      }

      // Spawn Bundle submenu
      if (ImGui.BeginMenu('Spawn Bundle')) {
        const allBundles = globalBundleRegistry.getAll();

        if (allBundles.length === 0) {
          ImGui.TextDisabled('No bundles registered');
        } else {
          for (const bundleType of allBundles) {
            if (ImGui.MenuItem(bundleType.name)) {
              const entityHandle = spawnBundleWithDefaults(
                bundleType,
                world,
                app.getCommands(),
              );
              setSelectedEntity(entityHandle.id());
              console.log(`[Hierarchy] Spawned bundle: ${bundleType.name}`);
            }
          }
        }

        ImGui.EndMenu();
      }

      // Spawn Prefab submenu
      if (ImGui.BeginMenu('Spawn Prefab')) {
        const prefabGuids = AssetDatabase.getAllGuids().filter((guid) => {
          const meta = AssetDatabase.getMetadata(guid);
          return meta && isPrefabMetadata(meta);
        });

        if (prefabGuids.length === 0) {
          ImGui.TextDisabled('No prefabs registered');
        } else {
          for (const guid of prefabGuids) {
            const meta = AssetDatabase.getMetadata(guid);
            const displayName = meta?.path.split('/').pop() || guid;

            if (ImGui.MenuItem(displayName)) {
              // Spawn prefab at root level
              if (PrefabManager.has()) {
                const prefabManager = PrefabManager.get();
                const runtimeAsset = RuntimeAssetManager.get().get(guid);
                if (runtimeAsset) {
                  // Load prefab if not already loaded, then instantiate
                  prefabManager.loadPrefab(runtimeAsset as RuntimeAsset<PrefabAsset>).then(() => {
                    const result = prefabManager.instantiate(guid, world, app.getCommands());
                    setSelectedEntity(result.rootEntity);
                    console.log(`[Hierarchy] Spawned prefab: ${displayName}`);
                  }).catch((err) => {
                    console.error(`[Hierarchy] Failed to spawn prefab: ${err}`);
                  });
                }
              }
            }
          }
        }

        ImGui.EndMenu();
      }

      ImGui.EndPopup();
    }

  }
  ImGui.End();

  // Render the save prefab dialog if open
  renderSavePrefabDialog(app);
}

/**
 * Recursively render an entity node in the hierarchy tree
 * @param app Application instance
 * @param entity Entity to render
 * @param visibleEntities Set of entities that should be visible (null = show all)
 */
function renderEntityNode(
  app: Application,
  entity: Entity,
  visibleEntities: Set<Entity> | null,
): void {
  const world = app.world;
  const commands = app.getCommands();

  // Get name or use fallback
  const nameComp = world.getComponent(entity, Name);
  const displayName = nameComp?.name || `Entity #${entity}`;

  // Check if entity is a prefab instance (root)
  const prefabInstance = world.getComponent(entity, PrefabInstance);
  const isPrefabRoot = prefabInstance !== null && prefabInstance !== undefined;

  // For prefab instances, add [P] prefix and render as collapsed (no children)
  const prefabPrefix = isPrefabRoot ? '[P] ' : '';
  const nodeLabel = `${prefabPrefix}${displayName}##${entity}`; // Unique ID for ImGui

  // Check if entity has children
  const childrenComp = world.getComponent(entity, Children);
  const hasChildren = childrenComp && childrenComp.ids.size > 0;

  // Check if this entity is selected
  const isSelected = getSelectedEntity() === entity;

  // Prefab instances render as leaf nodes (collapsed view - no children shown)
  if (isPrefabRoot) {
    renderPrefabNode(app, entity, displayName, nodeLabel, isSelected, prefabInstance);
    return;
  }

  if (hasChildren) {
    // Auto-expand if this entity was marked for expansion
    if (autoExpandEntities.has(entity)) {
      ImGui.SetNextItemOpen(true);
      autoExpandEntities.delete(entity);
    }

    // Add flags for parent nodes
    let flags = ImGui.TreeNodeFlags.OpenOnArrow;
    if (isSelected) {
      flags |= ImGui.TreeNodeFlags.Selected;
    }

    // Render as expandable tree node
    const nodeOpen = ImGui.TreeNodeEx(nodeLabel, flags);

    // Handle selection on left click
    if (ImGui.IsItemClicked(0)) {
      setSelectedEntity(entity);
    }

    // Check for right-click on the tree node (must be done immediately after TreeNode)
    const wasRightClicked = ImGui.IsItemClicked(1);
    if (wasRightClicked) {
      ImGui.OpenPopup(`EntityContextMenu##${entity}`);
      entityContextMenuOpened = true;
    }

    // Render context menu for this entity (before rendering children)
    if (ImGui.BeginPopup(`EntityContextMenu##${entity}`)) {
      ImGui.Text(displayName);
      ImGui.Separator();

      if (ImGui.MenuItem('Duplicate')) {
        const duplicate = duplicateEntity(entity, world, commands);
        if (duplicate !== undefined) {
          setSelectedEntity(duplicate);
          console.log(`[Hierarchy] Duplicated entity #${entity} → #${duplicate}`);
        }
      }

      if (ImGui.MenuItem('Add Child')) {
        // Spawn a new child entity with Name, Transform3D, and LocalTransform3D
        const childId = world
          .spawn()
          .with(Name, { name: 'New Entity' })
          .with(Transform3D, {
            position: new Vector3(0, 0, 0),
            rotation: new Vector3(0, 0, 0),
            scale: new Vector3(1, 1, 1),
          })
          .with(LocalTransform3D, {
            position: new Vector3(0, 0, 0),
            rotation: new Vector3(0, 0, 0),
            scale: new Vector3(1, 1, 1),
          })
          .build();
        if (childId !== undefined) {
          commands.entity(entity).addChild(childId);
          autoExpandEntities.add(entity);
          setSelectedEntity(childId);
          console.log(`[Hierarchy] Added child entity #${childId} to entity #${entity}`);
        }
      }

      // Spawn Bundle as Child submenu
      if (ImGui.BeginMenu('Spawn Bundle as Child')) {
        const allBundles = globalBundleRegistry.getAll();

        if (allBundles.length === 0) {
          ImGui.TextDisabled('No bundles registered');
        } else {
          for (const bundleType of allBundles) {
            if (ImGui.MenuItem(bundleType.name)) {
              const childHandle = spawnBundleWithDefaults(
                bundleType,
                world,
                commands,
              );
              commands.entity(entity).addChild(childHandle.id());
              autoExpandEntities.add(entity); // Auto-expand parent
              setSelectedEntity(childHandle.id());
              console.log(
                `[Hierarchy] Spawned bundle "${bundleType.name}" as child of entity #${entity}`,
              );
            }
          }
        }

        ImGui.EndMenu();
      }

      // Spawn Prefab as Child submenu
      if (ImGui.BeginMenu('Spawn Prefab as Child')) {
        const prefabGuids = AssetDatabase.getAllGuids().filter((guid) => {
          const meta = AssetDatabase.getMetadata(guid);
          return meta && isPrefabMetadata(meta);
        });

        if (prefabGuids.length === 0) {
          ImGui.TextDisabled('No prefabs registered');
        } else {
          for (const guid of prefabGuids) {
            const meta = AssetDatabase.getMetadata(guid);
            const prefabDisplayName = meta?.path.split('/').pop() || guid;

            if (ImGui.MenuItem(prefabDisplayName)) {
              if (PrefabManager.has()) {
                const prefabManager = PrefabManager.get();
                const runtimeAsset = RuntimeAssetManager.get().get(guid);
                if (runtimeAsset) {
                  prefabManager.loadPrefab(runtimeAsset as RuntimeAsset<PrefabAsset>).then(() => {
                    const result = prefabManager.instantiate(guid, world, commands, {
                      parentEntity: entity,
                    });
                    autoExpandEntities.add(entity);
                    setSelectedEntity(result.rootEntity);
                    console.log(`[Hierarchy] Spawned prefab "${prefabDisplayName}" as child of entity #${entity}`);
                  }).catch((err) => {
                    console.error(`[Hierarchy] Failed to spawn prefab: ${err}`);
                  });
                }
              }
            }
          }
        }

        ImGui.EndMenu();
      }

      ImGui.Separator();

      if (ImGui.MenuItem('Save as Prefab...')) {
        // Save this entity and its children as a prefab
        savePrefabFromEntity(app, entity, displayName);
      }

      if (ImGui.MenuItem('Delete')) {
        // Delete the entity and all its children
        commands.entity(entity).destroyRecursive();
        setSelectedEntity(undefined);
        console.log(`[Hierarchy] Deleted entity #${entity}`);
      }

      ImGui.EndPopup();
    }

    if (nodeOpen) {
      // Recursively render children (filtered if searching)
      let skippedDead = 0;
      for (const childId of childrenComp.ids) {
        // Check if child entity is alive
        if (!commands.isAlive(childId)) {
          skippedDead++;
          continue;
        }
        if (visibleEntities && !visibleEntities.has(childId)) {
          continue;
        }
        renderEntityNode(app, childId, visibleEntities);
      }
      if (skippedDead > 0) {
        console.warn(`[Hierarchy] Entity ${entity} (${displayName}) has ${skippedDead} dead children in its Children component!`);
      }
      ImGui.TreePop();
    }
  } else {
    // Render as leaf node (no children) using TreeNodeEx with Leaf flag for proper indentation
    let flags = ImGui.TreeNodeFlags.Leaf | ImGui.TreeNodeFlags.NoTreePushOnOpen;
    if (isSelected) {
      flags |= ImGui.TreeNodeFlags.Selected;
    }

    ImGui.TreeNodeEx(nodeLabel, flags);

    // Handle selection on left click
    if (ImGui.IsItemClicked(0)) {
      setSelectedEntity(entity);
    }

    // Check for right-click on leaf node
    if (ImGui.IsItemClicked(1)) {
      ImGui.OpenPopup(`EntityContextMenu##${entity}`);
      entityContextMenuOpened = true;
    }

    // Render context menu for leaf node
    if (ImGui.BeginPopup(`EntityContextMenu##${entity}`)) {
      ImGui.Text(displayName);
      ImGui.Separator();

      if (ImGui.MenuItem('Duplicate')) {
        const duplicate = duplicateEntity(entity, world, commands);
        if (duplicate !== undefined) {
          setSelectedEntity(duplicate);
          console.log(`[Hierarchy] Duplicated entity #${entity} → #${duplicate}`);
        }
      }

      if (ImGui.MenuItem('Add Child')) {
        // Spawn a new child entity with Name, Transform3D, and LocalTransform3D
        const childId = world
          .spawn()
          .with(Name, { name: 'New Entity' })
          .with(Transform3D, {
            position: new Vector3(0, 0, 0),
            rotation: new Vector3(0, 0, 0),
            scale: new Vector3(1, 1, 1),
          })
          .with(LocalTransform3D, {
            position: new Vector3(0, 0, 0),
            rotation: new Vector3(0, 0, 0),
            scale: new Vector3(1, 1, 1),
          })
          .build();
        if (childId !== undefined) {
          commands.entity(entity).addChild(childId);
          // Mark entity for auto-expansion (since it's getting its first child)
          autoExpandEntities.add(entity);
          setSelectedEntity(childId);
          console.log(`[Hierarchy] Added child entity #${childId} to entity #${entity}`);
        }
      }

      // Spawn Bundle as Child submenu
      if (ImGui.BeginMenu('Spawn Bundle as Child')) {
        const allBundles = globalBundleRegistry.getAll();

        if (allBundles.length === 0) {
          ImGui.TextDisabled('No bundles registered');
        } else {
          for (const bundleType of allBundles) {
            if (ImGui.MenuItem(bundleType.name)) {
              const childHandle = spawnBundleWithDefaults(
                bundleType,
                world,
                commands,
              );
              commands.entity(entity).addChild(childHandle.id());
              autoExpandEntities.add(entity); // Auto-expand parent
              setSelectedEntity(childHandle.id());
              console.log(
                `[Hierarchy] Spawned bundle "${bundleType.name}" as child of entity #${entity}`,
              );
            }
          }
        }

        ImGui.EndMenu();
      }

      // Spawn Prefab as Child submenu
      if (ImGui.BeginMenu('Spawn Prefab as Child')) {
        const prefabGuids = AssetDatabase.getAllGuids().filter((guid) => {
          const meta = AssetDatabase.getMetadata(guid);
          return meta && isPrefabMetadata(meta);
        });

        if (prefabGuids.length === 0) {
          ImGui.TextDisabled('No prefabs registered');
        } else {
          for (const guid of prefabGuids) {
            const meta = AssetDatabase.getMetadata(guid);
            const prefabDisplayName = meta?.path.split('/').pop() || guid;

            if (ImGui.MenuItem(prefabDisplayName)) {
              if (PrefabManager.has()) {
                const prefabManager = PrefabManager.get();
                const runtimeAsset = RuntimeAssetManager.get().get(guid);
                if (runtimeAsset) {
                  prefabManager.loadPrefab(runtimeAsset as RuntimeAsset<PrefabAsset>).then(() => {
                    const result = prefabManager.instantiate(guid, world, commands, {
                      parentEntity: entity,
                    });
                    autoExpandEntities.add(entity);
                    setSelectedEntity(result.rootEntity);
                    console.log(`[Hierarchy] Spawned prefab "${prefabDisplayName}" as child of entity #${entity}`);
                  }).catch((err) => {
                    console.error(`[Hierarchy] Failed to spawn prefab: ${err}`);
                  });
                }
              }
            }
          }
        }

        ImGui.EndMenu();
      }

      ImGui.Separator();

      if (ImGui.MenuItem('Save as Prefab...')) {
        // Save this entity and its children as a prefab
        savePrefabFromEntity(app, entity, displayName);
      }

      if (ImGui.MenuItem('Delete')) {
        // Delete the entity and all its children
        commands.entity(entity).destroyRecursive();
        setSelectedEntity(undefined);
        console.log(`[Hierarchy] Deleted entity #${entity}`);
      }

      ImGui.EndPopup();
    }
  }
}

/**
 * Render a prefab instance node (collapsed view - children not shown)
 */
function renderPrefabNode(
  app: Application,
  entity: Entity,
  displayName: string,
  nodeLabel: string,
  isSelected: boolean,
  prefabInstance: { prefabAssetGuid: string; instanceId: string },
): void {
  const world = app.world;
  const commands = app.getCommands();

  // Render as leaf node with special styling
  let flags = ImGui.TreeNodeFlags.Leaf | ImGui.TreeNodeFlags.NoTreePushOnOpen;
  if (isSelected) {
    flags |= ImGui.TreeNodeFlags.Selected;
  }

  // Blue color for prefab nodes
  ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: 0.4, y: 0.7, z: 1.0, w: 1.0 });
  ImGui.TreeNodeEx(nodeLabel, flags);
  ImGui.PopStyleColor();

  // Handle selection on left click
  if (ImGui.IsItemClicked(0)) {
    setSelectedEntity(entity);
  }

  // Check for right-click
  if (ImGui.IsItemClicked(1)) {
    ImGui.OpenPopup(`PrefabContextMenu##${entity}`);
    entityContextMenuOpened = true;
  }

  // Render context menu for prefab node
  if (ImGui.BeginPopup(`PrefabContextMenu##${entity}`)) {
    ImGui.Text(`[P] ${displayName}`);
    ImGui.TextDisabled(`Prefab: ${prefabInstance.prefabAssetGuid}`);
    ImGui.Separator();

    if (ImGui.MenuItem('Unpack Prefab')) {
      // Remove PrefabInstance component, making it a regular entity
      if (PrefabManager.has()) {
        PrefabManager.get().unpack(entity, commands);
        console.log(`[Hierarchy] Unpacked prefab instance: ${displayName}`);
      }
    }

    if (ImGui.MenuItem('Duplicate')) {
      const duplicate = duplicateEntity(entity, world, commands);
      if (duplicate !== undefined) {
        setSelectedEntity(duplicate);
        console.log(`[Hierarchy] Duplicated prefab instance #${entity} → #${duplicate}`);
      }
    }

    if (ImGui.MenuItem('Delete')) {
      // Delete the prefab and all its children
      commands.entity(entity).destroyRecursive();
      setSelectedEntity(undefined);
      console.log(`[Hierarchy] Deleted prefab instance #${entity}`);
    }

    ImGui.EndPopup();
  }
}

// ============================================================================
// Save Prefab Dialog State
// ============================================================================

let savePrefabDialogOpen = false;
let savePrefabEntity: Entity | null = null;
let savePrefabName = '';
let savePrefabPath = '';

/**
 * Initiate saving an entity as a prefab
 * Opens a dialog to get the prefab path
 */
function savePrefabFromEntity(app: Application, entity: Entity, displayName: string): void {
  savePrefabDialogOpen = true;
  savePrefabEntity = entity;
  savePrefabName = displayName;
  // Suggest a default path based on the entity name
  const safeName = displayName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  savePrefabPath = `/prefabs/${safeName}.prefab.yaml`;
}

/**
 * Render the Save Prefab dialog (call this from renderImGuiHierarchy)
 */
export function renderSavePrefabDialog(app: Application): void {
  if (!savePrefabDialogOpen || savePrefabEntity === null) {
    return;
  }

  ImGui.SetNextWindowSize({ x: 400, y: 150 }, ImGui.Cond.FirstUseEver);

  if (ImGui.Begin('Save as Prefab', undefined, ImGui.WindowFlags.NoCollapse)) {
    ImGui.Text('Entity:');
    ImGui.SameLine();
    ImGui.TextDisabled(savePrefabName);

    ImGui.Text('Path:');
    ImGui.SameLine();
    ImGui.SetNextItemWidth(-1);
    const pathBuffer: [string] = [savePrefabPath];
    ImGui.InputText('##PrefabPath', pathBuffer, 256);
    savePrefabPath = pathBuffer[0];

    ImGui.Separator();

    if (ImGui.Button('Save')) {
      // Perform the save
      performPrefabSave(app, savePrefabEntity, savePrefabPath);
      savePrefabDialogOpen = false;
      savePrefabEntity = null;
    }

    ImGui.SameLine();

    if (ImGui.Button('Cancel')) {
      savePrefabDialogOpen = false;
      savePrefabEntity = null;
    }
  }
  ImGui.End();
}

/**
 * Actually save the prefab to the manifest and generate YAML
 */
async function performPrefabSave(app: Application, entity: Entity, path: string): Promise<void> {
  const world = app.world;
  const commands = app.getCommands();
  const platform = currentPlatform;

  // Use PrefabSerializer to create the prefab asset
  const serializer = new PrefabSerializer();

  try {
    const prefabAsset = serializer.savePrefab(entity, world, commands, {
      path,
    });

    // Convert to YAML
    const yaml = serializer.toYaml(prefabAsset);
    const guid = prefabAsset.metadata.guid;

    // Write the prefab YAML file to disk
    if (platform && platform.sourceAssetsDir && platform.joinPath) {
      // Convert web path like "/prefabs/foo.prefab.yaml" to absolute path
      const relativePath = path.startsWith('/') ? path.slice(1) : path;
      const absolutePath = await platform.joinPath(platform.sourceAssetsDir, relativePath);

      // Ensure the directory exists before writing
      const dirPath = relativePath.split('/').slice(0, -1).join('/');
      if (dirPath && platform.ensureDir) {
        try {
          const absoluteDirPath = await platform.joinPath(platform.sourceAssetsDir, dirPath);
          await platform.ensureDir(absoluteDirPath);
        } catch (dirErr) {
          console.error(`[Hierarchy] Failed to create directory: ${dirErr}`);
          return; // Don't attempt to write if directory creation failed
        }
      }

      try {
        await platform.writeTextFile(absolutePath, yaml);
        console.log(`[Hierarchy] Saved prefab to disk: ${absolutePath}`);
      } catch (writeErr) {
        console.error(`[Hierarchy] Failed to write prefab file: ${writeErr}`);
        return; // Don't register the prefab if file write failed
      }

      // Register the prefab in AssetDatabase AFTER successful file write
      AssetDatabase.registerAdditionalAssets({
        [guid]: {
          type: AssetType.Prefab,
          path,
        },
      });

      // Update the manifest.json if available
      const assetsManifest = app.getAssetsManifestPath();
      if (assetsManifest) {
        // Save the updated manifest
        const manifestRelativePath = assetsManifest.startsWith('/')
          ? assetsManifest.slice(1)
          : assetsManifest;
        const manifestAbsPath = await platform.joinPath(platform.sourceAssetsDir, manifestRelativePath);
        const manifestJson = AssetDatabase.serializeToJson(true);
        await platform.writeTextFile(manifestAbsPath, manifestJson);
        console.log(`[Hierarchy] Updated manifest at: ${manifestAbsPath}`);
      }

      // Cache the prefab data in PrefabManager
      if (PrefabManager.has()) {
        PrefabManager.get().loadPrefabFromData(guid, prefabAsset);
      }

      console.log(`[Hierarchy] Prefab "${path}" registered with GUID: ${guid}`);
    } else if (platform) {
      // Web platform fallback - trigger download
      // Don't register in AssetDatabase since file won't persist
      await platform.writeTextFile(path, yaml);
      console.log(`[Hierarchy] Triggered prefab download: ${path}`);
      console.log(`[Hierarchy] Note: Prefab not registered (web platform - file won't persist)`);
    } else {
      // No platform, just log
      console.log(`[Hierarchy] Prefab YAML (no platform for saving):`);
      console.log(yaml);
      console.log(`[Hierarchy] Note: Prefab not registered (no platform available)`);
    }
  } catch (err) {
    console.error(`[Hierarchy] Failed to save prefab: ${err}`);
  }
}
