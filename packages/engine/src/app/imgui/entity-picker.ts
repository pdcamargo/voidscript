/**
 * Entity Picker - Reusable ImGui widget for selecting entities
 *
 * Provides a dropdown combo box that lists all entities in the world,
 * displaying their names (from Name component) or fallback IDs.
 *
 * @example
 * ```typescript
 * // In a component's customEditor
 * customEditor: ({ componentData, commands }) => {
 *   const result = entityPicker({
 *     label: "Target",
 *     currentEntity: componentData.target,
 *     commands,
 *     allowNone: true,
 *   });
 *   if (result.changed) {
 *     componentData.target = result.entity;
 *   }
 * }
 * ```
 */

import { ImGui } from "@voidscript/imgui";
import type { Command } from "../../ecs/command.js";
import type { Entity } from "../../ecs/entity.js";
import type { ComponentType } from "../../ecs/component.js";
import { Name } from "../../ecs/components/name.js";

export interface EntityPickerOptions {
  /** Label for the picker (used as ImGui ID) */
  label: string;
  /** Currently selected entity (null if none) */
  currentEntity: Entity | null;
  /** Commands instance for querying entities */
  commands: Command;
  /** Whether to show "None" option (default: true) */
  allowNone?: boolean;
  /** Optional filter function to limit which entities appear in the list */
  filter?: (entity: Entity) => boolean;
  /**
   * Only show entities that have ALL of these components.
   * This is applied before the custom filter function.
   */
  requiredComponents?: ComponentType<unknown>[];
  /** Width of the combo box (default: uses ImGui default) */
  width?: number;
}

export interface EntityPickerResult {
  /** Whether the selection changed */
  changed: boolean;
  /** The newly selected entity (or null if None selected) */
  entity: Entity | null;
}

/**
 * Renders an entity picker combo box.
 *
 * @param options - Configuration options
 * @returns Result indicating if selection changed and the new entity
 */
export function entityPicker(options: EntityPickerOptions): EntityPickerResult {
  const {
    label,
    currentEntity,
    commands,
    allowNone = true,
    filter,
    requiredComponents,
    width,
  } = options;

  let changed = false;
  let newEntity: Entity | null = currentEntity;

  // Build list of all entities with names for the picker
  const entities: Array<{ id: Entity; label: string }> = [];
  commands.query().all().each((entity) => {
    // Check required components first
    if (requiredComponents && requiredComponents.length > 0) {
      for (const componentType of requiredComponents) {
        if (!commands.hasComponent(entity, componentType)) {
          return; // Entity doesn't have this required component
        }
      }
    }

    // Apply custom filter if provided
    if (filter && !filter(entity)) {
      return;
    }

    const nameComp = commands.tryGetComponent(entity, Name);
    const entityLabel = nameComp?.name
      ? `${nameComp.name} (#${entity})`
      : `Entity #${entity}`;
    entities.push({ id: entity, label: entityLabel });
  });

  // Sort by label for easier navigation
  entities.sort((a, b) => a.label.localeCompare(b.label));

  // Get current target label
  let currentLabel = "None";
  if (currentEntity !== null) {
    const targetName = commands.tryGetComponent(currentEntity, Name);
    currentLabel = targetName?.name
      ? `${targetName.name} (#${currentEntity})`
      : `Entity #${currentEntity}`;
  }

  // Set width if specified
  if (width !== undefined) {
    ImGui.SetNextItemWidth(width);
  }

  // Entity picker combo box
  if (ImGui.BeginCombo(`##${label}`, currentLabel)) {
    // None option
    if (allowNone) {
      const isNoneSelected = currentEntity === null;
      if (ImGui.Selectable("None", isNoneSelected)) {
        newEntity = null;
        changed = currentEntity !== null;
      }
      if (isNoneSelected) {
        ImGui.SetItemDefaultFocus();
      }
      ImGui.Separator();
    }

    // Entity options
    for (const { id, label: entityLabel } of entities) {
      const isSelected = currentEntity === id;
      if (ImGui.Selectable(entityLabel, isSelected)) {
        newEntity = id;
        changed = currentEntity !== id;
      }
      if (isSelected) {
        ImGui.SetItemDefaultFocus();
      }
    }
    ImGui.EndCombo();
  }

  return { changed, entity: newEntity };
}

/**
 * Renders an entity picker with a label on the same line.
 * Convenience wrapper for common use case.
 *
 * @param options - Configuration options
 * @returns Result indicating if selection changed and the new entity
 */
export function entityPickerWithLabel(
  options: EntityPickerOptions
): EntityPickerResult {
  ImGui.Text(`${options.label}:`);
  ImGui.SameLine();
  return entityPicker(options);
}
