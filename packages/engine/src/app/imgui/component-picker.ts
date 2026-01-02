/**
 * Component Picker - Hierarchical component browser with fuzzy search
 *
 * Uses component metadata `path` to organize components into a navigable
 * folder structure. Supports breadcrumb navigation and fuzzy filtering.
 *
 * @example
 * ```typescript
 * // In inspector
 * if (ImGui.Button('Add Component')) {
 *   openComponentPicker();
 * }
 * renderComponentPicker({
 *   onSelect: (componentType) => {
 *     world.addComponent(entity, componentType, defaultValue);
 *   },
 * });
 * ```
 */

import { ImGui } from "@voidscript/imgui";
import type { ComponentType } from "@voidscript/core";
import { globalComponentRegistry } from "@voidscript/core";

// State for the component picker
let isOpen = false;
let currentPath: string[] = [];
let searchQuery = "";

/**
 * Open the component picker popup
 */
export function openComponentPicker(): void {
  isOpen = true;
  currentPath = [];
  searchQuery = "";
}

/**
 * Close the component picker popup
 */
export function closeComponentPicker(): void {
  isOpen = false;
  currentPath = [];
  searchQuery = "";
}

/**
 * Check if component picker is currently open
 */
export function isComponentPickerOpen(): boolean {
  return isOpen;
}

export interface ComponentPickerOptions {
  /** Called when a component is selected */
  onSelect: (componentType: ComponentType<any>) => void;
  /** Optional filter to exclude certain components */
  filter?: (componentType: ComponentType<any>) => boolean;
}

interface FolderNode {
  name: string;
  path: string;
  children: Map<string, FolderNode>;
  components: ComponentType<any>[];
}

/**
 * Build a tree structure from component paths
 */
function buildComponentTree(
  components: ComponentType<any>[],
  filter?: (componentType: ComponentType<any>) => boolean
): FolderNode {
  const root: FolderNode = {
    name: "",
    path: "",
    children: new Map(),
    components: [],
  };

  for (const comp of components) {
    // Apply filter if provided
    if (filter && !filter(comp)) {
      continue;
    }

    const metadata = comp.metadata;
    const path = metadata?.path || "";

    if (!path) {
      // No path - add to root
      root.components.push(comp);
      continue;
    }

    // Split path into segments
    const segments = path.split("/").filter((s) => s.length > 0);

    // Navigate/create tree nodes
    let current = root;
    let currentPathStr = "";

    for (const segment of segments) {
      currentPathStr = currentPathStr ? `${currentPathStr}/${segment}` : segment;

      if (!current.children.has(segment)) {
        current.children.set(segment, {
          name: segment,
          path: currentPathStr,
          children: new Map(),
          components: [],
        });
      }

      current = current.children.get(segment)!;
    }

    // Add component to the leaf node
    current.components.push(comp);
  }

  return root;
}

/**
 * Get folder node at the current path
 */
function getNodeAtPath(root: FolderNode, path: string[]): FolderNode | null {
  let current = root;

  for (const segment of path) {
    const child = current.children.get(segment);
    if (!child) return null;
    current = child;
  }

  return current;
}

/**
 * Fuzzy match a string against a query
 */
function fuzzyMatch(str: string, query: string): boolean {
  if (!query) return true;

  const lowerStr = str.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Simple substring match
  if (lowerStr.includes(lowerQuery)) return true;

  // Character-by-character fuzzy match
  let queryIndex = 0;
  for (let i = 0; i < lowerStr.length && queryIndex < lowerQuery.length; i++) {
    if (lowerStr[i] === lowerQuery[queryIndex]) {
      queryIndex++;
    }
  }

  return queryIndex === lowerQuery.length;
}

/**
 * Get all components matching the search query (flattened)
 */
function getMatchingComponents(
  components: ComponentType<any>[],
  query: string,
  filter?: (componentType: ComponentType<any>) => boolean
): ComponentType<any>[] {
  if (!query) return [];

  const matches: ComponentType<any>[] = [];

  for (const comp of components) {
    if (filter && !filter(comp)) continue;

    const displayName = comp.metadata?.displayName || comp.name;
    const path = comp.metadata?.path || "";

    // Match against display name or path
    if (fuzzyMatch(displayName, query) || fuzzyMatch(path, query)) {
      matches.push(comp);
    }
  }

  // Sort by relevance (exact matches first, then alphabetically)
  matches.sort((a, b) => {
    const aName = (a.metadata?.displayName || a.name).toLowerCase();
    const bName = (b.metadata?.displayName || b.name).toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Exact prefix match gets priority
    const aPrefix = aName.startsWith(lowerQuery);
    const bPrefix = bName.startsWith(lowerQuery);

    if (aPrefix && !bPrefix) return -1;
    if (bPrefix && !aPrefix) return 1;

    return aName.localeCompare(bName);
  });

  return matches;
}

/**
 * Render the component picker popup
 */
export function renderComponentPicker(options: ComponentPickerOptions): void {
  if (!isOpen) return;

  const { onSelect, filter } = options;

  // Get all components
  const allComponents = globalComponentRegistry.getAllComponentsWithMetadata();

  // Build tree
  const tree = buildComponentTree(allComponents, filter);

  // Popup settings
  ImGui.SetNextWindowSize({ x: 400, y: 500 }, ImGui.Cond.FirstUseEver);

  if (ImGui.Begin("Add Component", null, ImGui.WindowFlags.None)) {
    // Search bar
    const searchBuffer: [string] = [searchQuery];
    ImGui.SetNextItemWidth(-1);
    ImGui.InputTextWithHint("##search", "Search components...", searchBuffer, 256);
    searchQuery = searchBuffer[0] || "";

    // Focus search on open
    if (ImGui.IsWindowAppearing()) {
      ImGui.SetKeyboardFocusHere(-1);
    }

    ImGui.Separator();

    // If searching, show flat list of matches
    if (searchQuery.length > 0) {
      const matches = getMatchingComponents(allComponents, searchQuery, filter);

      ImGui.BeginChild("SearchResults", { x: 0, y: -30 }, ImGui.WindowFlags.None);

      if (matches.length === 0) {
        ImGui.TextDisabled("No components found");
      } else {
        for (const comp of matches) {
          const displayName = comp.metadata?.displayName || comp.name;
          const path = comp.metadata?.path || "";

          // Show component with path hint
          if (ImGui.Selectable(`${displayName}##${comp.id}`)) {
            onSelect(comp);
            closeComponentPicker();
          }

          // Show path as hint on same line
          if (path) {
            ImGui.SameLine();
            ImGui.TextDisabled(`(${path})`);
          }
        }
      }

      ImGui.EndChild();
    } else {
      // Show hierarchical browser

      // Breadcrumb navigation
      if (currentPath.length > 0) {
        // Root button
        if (ImGui.SmallButton("Root")) {
          currentPath = [];
        }

        // Path segments
        for (let i = 0; i < currentPath.length; i++) {
          ImGui.SameLine();
          ImGui.Text(">");
          ImGui.SameLine();

          const segment = currentPath[i];
          if (i === currentPath.length - 1) {
            // Current folder (not clickable)
            ImGui.Text(segment || "");
          } else {
            // Clickable breadcrumb
            if (ImGui.SmallButton(`${segment}##breadcrumb_${i}`)) {
              currentPath = currentPath.slice(0, i + 1);
            }
          }
        }

        ImGui.Separator();
      }

      // Get current node
      const currentNode = getNodeAtPath(tree, currentPath);

      ImGui.BeginChild("Browser", { x: 0, y: -30 }, ImGui.WindowFlags.None);

      if (currentNode) {
        // Show folders first
        const folders = Array.from(currentNode.children.entries()).sort((a, b) =>
          a[0].localeCompare(b[0])
        );

        for (const [folderName, folderNode] of folders) {
          // Count items in folder (recursive)
          const itemCount = countItems(folderNode);

          if (ImGui.Selectable(`[${folderName}] (${itemCount})##folder_${folderName}`)) {
            currentPath = [...currentPath, folderName];
          }
        }

        // Show components in current folder
        const components = [...currentNode.components].sort((a, b) => {
          const aName = a.metadata?.displayName || a.name;
          const bName = b.metadata?.displayName || b.name;
          return aName.localeCompare(bName);
        });

        if (folders.length > 0 && components.length > 0) {
          ImGui.Separator();
        }

        for (const comp of components) {
          const displayName = comp.metadata?.displayName || comp.name;

          if (ImGui.Selectable(`${displayName}##${comp.id}`)) {
            onSelect(comp);
            closeComponentPicker();
          }

          // Show description as tooltip
          if (comp.metadata?.description && ImGui.IsItemHovered()) {
            ImGui.SetTooltip(comp.metadata.description);
          }
        }

        if (folders.length === 0 && components.length === 0) {
          ImGui.TextDisabled("Empty folder");
        }
      }

      ImGui.EndChild();
    }

    // Bottom bar with cancel button
    ImGui.Separator();
    if (ImGui.Button("Cancel", { x: 80, y: 0 })) {
      closeComponentPicker();
    }

    // Close on Escape
    if (ImGui.IsKeyPressed(ImGui.Key._Escape)) {
      closeComponentPicker();
    }
  }
  ImGui.End();

  // Check if window was closed via X button (handled after End)
  // Note: When Begin returns false, the window is collapsed or closed
  // but we still need to call End() unconditionally
}

/**
 * Count total items (folders + components) in a node recursively
 */
function countItems(node: FolderNode): number {
  let count = node.components.length;

  for (const child of node.children.values()) {
    count += countItems(child);
  }

  return count;
}
