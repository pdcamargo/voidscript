/**
 * ImGui Hierarchy Viewer - Renders entity hierarchy tree
 *
 * Displays all entities in the world in a tree structure based on Parent/Children components.
 * Shows entity names from Name component or "Entity #{handle}" as fallback.
 */

import type { Application } from '../application.js';
import type { Entity } from '../../ecs/entity.js';
import { Parent, Children, Name } from '../../ecs/components/index.js';
import { ImGui } from '@mori2003/jsimgui';
import { setSelectedEntity, getSelectedEntity } from './inspector.js';
import { duplicateEntity } from '../../ecs/entity-utils.js';
import { globalBundleRegistry } from '../../ecs/bundle-registry.js';
import { spawnBundleWithDefaults } from '../../ecs/bundle-utils.js';

/**
 * Render the hierarchy viewer window showing all entities in a tree structure
 * @param app Application instance
 */
// Track if entity context menu was opened this frame
let entityContextMenuOpened = false;

// Track entities that should auto-expand (when first child is added)
const autoExpandEntities = new Set<Entity>();

export function renderImGuiHierarchy(app: Application): void {
  // Setup window position and size (only on first use)
  ImGui.SetNextWindowPos({ x: 10, y: 10 }, ImGui.Cond.FirstUseEver);
  ImGui.SetNextWindowSize({ x: 300, y: 500 }, ImGui.Cond.FirstUseEver);

  if (ImGui.Begin('Hierarchy')) {
    const world = app.world;

    // Reset flag at start of frame
    entityContextMenuOpened = false;

    // Find ALL root entities (entities without Parent component)
    const roots: Entity[] = [];
    world
      .query()
      .none(Parent)
      .each((entity) => {
        roots.push(entity);
      });

    if (roots.length === 0) {
      ImGui.Text('No entities in scene');
    } else {
      // Render each root entity (with or without children)
      for (const root of roots) {
        renderEntityNode(app, root);
      }
    }

    // Context menu for the hierarchy panel (right-click on empty space)
    // Only open if no entity context menu was opened and not hovering over any item
    if (!entityContextMenuOpened && ImGui.IsWindowHovered() && !ImGui.IsAnyItemHovered() && ImGui.IsMouseClicked(1)) {
      ImGui.OpenPopup('HierarchyContextMenu');
    }

    if (ImGui.BeginPopup('HierarchyContextMenu')) {
      if (ImGui.MenuItem('Spawn Entity')) {
        // Spawn a new empty entity
        world.spawn().build();
        console.log('[Hierarchy] Spawned new empty entity');
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

      ImGui.EndPopup();
    }

    ImGui.End();
  }
}

/**
 * Recursively render an entity node in the hierarchy tree
 * @param app Application instance
 * @param entity Entity to render
 */
function renderEntityNode(app: Application, entity: Entity): void {
  const world = app.world;
  const commands = app.getCommands();

  // Get name or use fallback
  const nameComp = world.getComponent(entity, Name);
  const displayName = nameComp?.name || `Entity #${entity}`;
  const nodeLabel = `${displayName}##${entity}`; // Unique ID for ImGui

  // Check if entity has children
  const childrenComp = world.getComponent(entity, Children);
  const hasChildren = childrenComp && childrenComp.ids.size > 0;

  // Check if this entity is selected
  const isSelected = getSelectedEntity() === entity;

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
        // Spawn a new child entity
        const childId = world.spawn().build();
        if (childId !== undefined) {
          commands.entity(entity).addChild(childId);
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

      if (ImGui.MenuItem('Delete')) {
        // Delete the entity
        commands.entity(entity).destroy();
        console.log(`[Hierarchy] Deleted entity #${entity}`);
      }

      ImGui.EndPopup();
    }

    if (nodeOpen) {
      // Recursively render children
      for (const childId of childrenComp.ids) {
        renderEntityNode(app, childId);
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
        // Spawn a new child entity
        const childId = world.spawn().build();
        if (childId !== undefined) {
          commands.entity(entity).addChild(childId);
          // Mark entity for auto-expansion (since it's getting its first child)
          autoExpandEntities.add(entity);
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

      if (ImGui.MenuItem('Delete')) {
        // Delete the entity
        commands.entity(entity).destroy();
        console.log(`[Hierarchy] Deleted entity #${entity}`);
      }

      ImGui.EndPopup();
    }
  }
}
