/**
 * State Machine Editor Window
 *
 * Main window for editing animation state machines.
 * Uses the generic node editor framework for graph visualization.
 */

import { ImGui } from '@mori2003/jsimgui';
import type { EditorPlatform } from '../../../editor/editor-platform.js';
import type { Command } from '../../../ecs/command.js';
import { AssetDatabase } from '../../../ecs/asset-database.js';
import { AssetType } from '../../../ecs/asset-metadata.js';
import { AnimationStateMachineController } from '../../../ecs/components/animation/animation-state-machine-controller.js';
import { EditorLayout } from '../editor-layout.js';
import { EDITOR_ICONS } from '../editor-icons.js';
import {
  getStateMachineEditorState,
  isStateMachineEditorOpen,
  closeStateMachineEditor,
  createNewStateMachine,
  loadStateMachine,
  getCurrentStateMachine,
  getCurrentFilePath,
  setCurrentFilePath,
  getAssetGuid,
  setAssetGuid,
  markClean,
  markDirty,
  addState,
  deleteState,
  updateState,
  setDefaultState,
  selectState,
  getSelectedState,
  createTransition,
  deleteTransition,
  updateTransition,
  selectTransition,
  getSelectedTransition,
  addParameter,
  deleteParameter,
  updateParameter,
  selectParameter,
  getSelectedParameter,
  syncStateMachineToNodeEditor,
  isSpecialNode,
  selectEntity,
  getSelectedEntity,
  ENTRY_NODE_ID,
  ANY_STATE_NODE_ID,
  EXIT_NODE_ID,
} from './state-machine-editor-state.js';
import type { Entity } from '../../../ecs/entity.js';
import {
  renderNodeEditor,
  renderNodeEditorToolbar,
  clearSelection,
} from '../node-editor/index.js';
import { renderStateInspector } from './state-inspector.js';
import { renderTransitionInspector } from './transition-inspector.js';
import { renderParameterPanel } from './parameter-panel.js';
import { parseStateMachine, parseStateMachineJson, serializeStateMachine } from '../../../animation/state-machine/state-machine-parser.js';
import type {
  AnimationStateMachine,
  ParameterType,
} from '../../../animation/state-machine/index.js';

// ============================================================================
// Constants
// ============================================================================

const WINDOW_MIN_WIDTH = 800;
const WINDOW_MIN_HEIGHT = 600;
const INSPECTOR_WIDTH = 280;
const PARAMETER_PANEL_HEIGHT = 200;

// ============================================================================
// Main Window
// ============================================================================

// Module-level state to pass context to async handlers
let currentPlatform: EditorPlatform | undefined;
let currentAssetsManifest: string | undefined;

/**
 * Render the state machine editor window
 *
 * @param platform - Editor platform for file dialogs
 * @param commands - Optional ECS commands for entity queries
 * @param getEntitiesWithAnimationController - Callback to get entities with AnimationController.
 *        This should be filtered to only return entities that have the AnimationController component.
 * @param assetsManifest - Path to the assets manifest file for auto-registration
 */
export function renderStateMachineEditorWindow(
  platform: EditorPlatform,
  commands?: Command,
  getEntitiesWithAnimationController?: () => Array<{ entity: Entity; name: string }>,
  assetsManifest?: string,
): void {
  currentPlatform = platform;
  currentAssetsManifest = assetsManifest;

  if (!isStateMachineEditorOpen()) {
    return;
  }

  const state = getStateMachineEditorState();
  const sm = getCurrentStateMachine();
  const selectedEntity = getSelectedEntity();

  // Window title with dirty indicator
  const dirtyMarker = state.isDirty ? ' *' : '';
  const fileName = state.currentFilePath
    ? state.currentFilePath.split('/').pop()
    : 'Untitled';
  const windowTitle = `State Machine Editor - ${fileName}${dirtyMarker}###StateMachineEditor`;

  // Set initial window size
  const mainViewport = ImGui.GetMainViewport();
  ImGui.SetNextWindowSize(
    { x: WINDOW_MIN_WIDTH, y: WINDOW_MIN_HEIGHT },
    ImGui.Cond.FirstUseEver,
  );
  ImGui.SetNextWindowPos(
    {
      x: mainViewport.Pos.x + mainViewport.Size.x * 0.1,
      y: mainViewport.Pos.y + mainViewport.Size.y * 0.1,
    },
    ImGui.Cond.FirstUseEver,
  );

  const windowOpen: [boolean] = [true];
  if (ImGui.Begin(windowTitle, windowOpen, ImGui.WindowFlags.MenuBar)) {
    // Menu bar
    renderMenuBar(platform);

    // Check if entity is selected - show entity selector first if not
    if (selectedEntity === null) {
      renderEntitySelector(getEntitiesWithAnimationController, commands);
    } else {
      // Toolbar (only show when entity is selected)
      renderToolbar(platform, getEntitiesWithAnimationController, commands);

      ImGui.Separator();

      // Main content area
      // Note: GetContentRegionAvail() doesn't work in jsimgui, so we calculate manually
      const windowWidth = ImGui.GetWindowWidth();
      const windowHeight = ImGui.GetWindowHeight();
      const frameHeight = ImGui.GetFrameHeight();
      // Account for window padding, menu bar, toolbar, and separator
      const contentWidth = windowWidth - 16;
      const contentHeight = windowHeight - frameHeight * 3 - 30;

      // Left side: Node graph
      const graphWidth = contentWidth - INSPECTOR_WIDTH - 8;
      const graphHeight = contentHeight;

      if (ImGui.BeginChild('GraphPanel', { x: graphWidth, y: graphHeight }, ImGui.ChildFlags.Borders)) {
        if (sm) {
          // Render node editor
          const result = renderNodeEditor(state.nodeEditor, graphWidth - 16, graphHeight - 16);

          // Handle node selection
          if (state.nodeEditor.selectedNodeIds.size > 0) {
            const selectedId = Array.from(state.nodeEditor.selectedNodeIds)[0]!;
            if (state.selectedStateId !== selectedId) {
              selectState(selectedId);
            }
          }

          // Handle link selection
          if (state.nodeEditor.selectedLinkIds.size > 0) {
            const selectedId = Array.from(state.nodeEditor.selectedLinkIds)[0]!;
            if (state.selectedTransitionId !== selectedId) {
              selectTransition(selectedId);
            }
          }

          // Handle context menu for adding states
          if (result.interactions.canvasContextMenuPos) {
            ImGui.OpenPopup('CanvasContextMenu');
          }

          // Canvas context menu
          if (ImGui.BeginPopup('CanvasContextMenu')) {
            if (ImGui.MenuItem('Add State')) {
              const pos = result.interactions.canvasContextMenuPos ?? { x: 100, y: 100 };
              const newState = addState('New State', pos);
              if (newState) {
                selectState(newState.id);
              }
            }
            ImGui.EndPopup();
          }
        } else {
          // No state machine loaded
          EditorLayout.textDisabled('No state machine loaded');
          EditorLayout.spacing();
          if (ImGui.Button('New State Machine')) {
            createNewStateMachine();
          }
          ImGui.SameLine();
          if (ImGui.Button('Open...')) {
            handleOpen(platform);
          }
        }
      }
      ImGui.EndChild();

      ImGui.SameLine();

      // Right side: Inspector panels
      if (ImGui.BeginChild('InspectorPanel', { x: INSPECTOR_WIDTH, y: contentHeight }, ImGui.ChildFlags.Borders)) {
        if (sm) {
          // Parameters panel (collapsible)
          if (ImGui.CollapsingHeader('Parameters', ImGui.TreeNodeFlags.DefaultOpen)) {
            renderParameterPanel(sm, commands);
          }

          ImGui.Separator();

          // State/Transition inspector
          const selectedState = getSelectedState();
          const selectedTransition = getSelectedTransition();

          // Check if a special node is selected
          const selectedNodeId = state.nodeEditor.selectedNodeIds.size > 0
            ? Array.from(state.nodeEditor.selectedNodeIds)[0]
            : null;

          if (selectedNodeId && isSpecialNode(selectedNodeId)) {
            // Show info for special nodes
            renderSpecialNodeInfo(selectedNodeId);
          } else if (selectedState) {
            renderStateInspector(selectedState, sm, commands);
          } else if (selectedTransition) {
            renderTransitionInspector(selectedTransition, sm);
          } else {
            EditorLayout.textDisabled('Select a state or transition to edit');
          }
        }
      }
      ImGui.EndChild();
    }
  }
  ImGui.End();

  // Handle window close
  if (!windowOpen[0]) {
    closeStateMachineEditor();
  }
}

// ============================================================================
// Menu Bar
// ============================================================================

function renderMenuBar(platform: EditorPlatform): void {
  if (ImGui.BeginMenuBar()) {
    if (ImGui.BeginMenu('File')) {
      if (ImGui.MenuItem('New', 'Ctrl+N')) {
        handleNew();
      }
      if (ImGui.MenuItem('Open...', 'Ctrl+O')) {
        handleOpen(platform);
      }
      if (ImGui.MenuItem('Save', 'Ctrl+S')) {
        handleSave(platform);
      }
      if (ImGui.MenuItem('Save As...', 'Ctrl+Shift+S')) {
        handleSaveAs(platform);
      }
      ImGui.Separator();
      if (ImGui.MenuItem('Close')) {
        closeStateMachineEditor();
      }
      ImGui.EndMenu();
    }

    if (ImGui.BeginMenu('Edit')) {
      if (ImGui.MenuItem('Add State')) {
        const newState = addState('New State', { x: 200, y: 200 });
        if (newState) {
          selectState(newState.id);
        }
      }
      if (ImGui.MenuItem('Delete Selected', 'Del')) {
        handleDeleteSelected();
      }
      ImGui.EndMenu();
    }

    ImGui.EndMenuBar();
  }
}

// ============================================================================
// Entity Selector (shown when no entity is selected)
// ============================================================================

/**
 * Render entity selector UI when no entity is selected.
 * Only shows entities with AnimationController component.
 */
function renderEntitySelector(
  getEntitiesWithAnimationController?: () => Array<{ entity: Entity; name: string }>,
  commands?: Command,
): void {
  const availableHeight = ImGui.GetWindowHeight() - 60;
  const availableWidth = ImGui.GetWindowWidth();

  ImGui.BeginChild('##EntitySelector', { x: 0, y: availableHeight }, 0, ImGui.WindowFlags.None);

  // Center the content
  const contentWidth = 400;
  const offsetX = (availableWidth - contentWidth) / 2;
  ImGui.SetCursorPosX(offsetX > 0 ? offsetX : 10);
  ImGui.SetCursorPosY(50);

  // Header
  ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: 0.9, y: 0.9, z: 0.9, w: 1.0 });
  ImGui.Text('Select Entity to Edit State Machine');
  ImGui.PopStyleColor();

  ImGui.SetCursorPosX(offsetX > 0 ? offsetX : 10);
  ImGui.TextDisabled('Only entities with AnimationController are shown.');

  ImGui.Spacing();
  ImGui.Spacing();

  // Entity list
  ImGui.SetCursorPosX(offsetX > 0 ? offsetX : 10);

  if (!getEntitiesWithAnimationController) {
    ImGui.TextDisabled('No entity callback provided.');
    ImGui.EndChild();
    return;
  }

  const entities = getEntitiesWithAnimationController();

  if (entities.length === 0) {
    ImGui.TextDisabled('No entities with AnimationController found.');
    ImGui.Spacing();
    ImGui.SetCursorPosX(offsetX > 0 ? offsetX : 10);
    ImGui.TextDisabled('Add an AnimationController component to an entity first.');
  } else {
    ImGui.PushStyleColorImVec4(ImGui.Col.ChildBg, { x: 0.12, y: 0.12, z: 0.14, w: 1.0 });
    ImGui.BeginChild('##EntityList', { x: contentWidth, y: Math.min(300, entities.length * 32 + 16) }, 1, ImGui.WindowFlags.None);

    for (const { entity, name } of entities) {
      const label = name || `Entity #${entity}`;

      ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.18, y: 0.18, z: 0.2, w: 1.0 });
      ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, { x: 0.25, y: 0.25, z: 0.28, w: 1.0 });
      ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, { x: 0.3, y: 0.3, z: 0.35, w: 1.0 });

      if (ImGui.Button(label, { x: contentWidth - 16, y: 28 })) {
        handleSelectEntity(entity, commands);
      }

      ImGui.PopStyleColor(3);
    }

    ImGui.EndChild();
    ImGui.PopStyleColor();
  }

  ImGui.EndChild();
}

// ============================================================================
// Toolbar
// ============================================================================

function renderToolbar(
  platform: EditorPlatform,
  getEntitiesWithAnimationController?: () => Array<{ entity: Entity; name: string }>,
  commands?: Command,
): void {
  const state = getStateMachineEditorState();
  const sm = getCurrentStateMachine();
  const selectedEntity = getSelectedEntity();

  // Entity selector dropdown
  ImGui.Text('Entity:');
  ImGui.SameLine();
  const entityLabel = selectedEntity !== null ? getEntityLabel(selectedEntity, getEntitiesWithAnimationController) : '(None)';

  ImGui.SetNextItemWidth(130);
  if (ImGui.BeginCombo('##selectedEntity', entityLabel)) {
    if (getEntitiesWithAnimationController) {
      const entities = getEntitiesWithAnimationController();
      for (const { entity, name } of entities) {
        const isSelected = selectedEntity === entity;
        const label = name || `Entity #${entity}`;
        if (ImGui.Selectable(label, isSelected)) {
          handleSelectEntity(entity, commands);
        }
      }
    }
    ImGui.EndCombo();
  }

  ImGui.SameLine();
  ImGui.Separator();
  ImGui.SameLine();

  // New button
  if (EditorLayout.iconButton(EDITOR_ICONS.FILE, {
    size: 'small',
    tooltip: 'New State Machine',
    id: 'toolbar_new',
  })) {
    handleNew();
  }

  ImGui.SameLine();

  // Open button
  if (EditorLayout.iconButton(EDITOR_ICONS.FOLDER_OPEN, {
    size: 'small',
    tooltip: 'Open...',
    id: 'toolbar_open',
  })) {
    handleOpen(platform);
  }

  ImGui.SameLine();

  // Save button
  if (EditorLayout.iconButton(EDITOR_ICONS.SAVE, {
    size: 'small',
    tooltip: 'Save',
    id: 'toolbar_save',
  })) {
    handleSave(platform);
  }

  ImGui.SameLine();
  ImGui.Separator();
  ImGui.SameLine();

  // Add state button
  if (EditorLayout.iconButton(EDITOR_ICONS.ADD, {
    size: 'small',
    tooltip: 'Add State',
    id: 'toolbar_add_state',
  })) {
    if (sm) {
      const newState = addState('New State', { x: 200, y: 200 });
      if (newState) {
        selectState(newState.id);
      }
    }
  }

  ImGui.SameLine();

  // Delete selected button
  if (EditorLayout.iconButton(EDITOR_ICONS.DELETE, {
    size: 'small',
    tooltip: 'Delete Selected',
    id: 'toolbar_delete',
  })) {
    handleDeleteSelected();
  }

  ImGui.SameLine();
  ImGui.Separator();
  ImGui.SameLine();

  // State machine name
  if (sm) {
    const nameBuffer: [string] = [sm.name];
    ImGui.SetNextItemWidth(200);
    ImGui.InputText('##smName', nameBuffer, 256);
    if (ImGui.IsItemDeactivatedAfterEdit() && nameBuffer[0] !== sm.name) {
      sm.name = nameBuffer[0];
      markDirty();
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get display label for an entity
 */
function getEntityLabel(
  entity: Entity,
  getEntitiesWithAnimationController?: () => Array<{ entity: Entity; name: string }>,
): string {
  if (getEntitiesWithAnimationController) {
    const entities = getEntitiesWithAnimationController();
    const found = entities.find((e) => e.entity === entity);
    if (found && found.name) {
      return found.name;
    }
  }
  return `Entity #${entity}`;
}

// ============================================================================
// File Handlers
// ============================================================================

function handleNew(): void {
  // TODO: Check for unsaved changes
  createNewStateMachine();
}

async function handleOpen(platform: EditorPlatform): Promise<void> {
  try {
    const path = await platform.showOpenDialog({
      title: 'Open State Machine',
      filters: [
        { name: 'State Machine', extensions: ['sm.json'] },
        { name: 'JSON', extensions: ['json'] },
      ],
    });

    if (path && typeof path === 'string') {
      const content = await platform.readTextFile(path);
      const data = parseStateMachineJson(JSON.parse(content));
      loadStateMachine(data, path);
    }
  } catch (error) {
    console.error('Failed to open state machine:', error);
  }
}

async function handleSave(platform: EditorPlatform): Promise<void> {
  const state = getStateMachineEditorState();
  const sm = getCurrentStateMachine();
  if (!sm) return;

  if (state.currentFilePath) {
    try {
      const jsonString = serializeStateMachine(sm);
      await platform.writeTextFile(state.currentFilePath, jsonString);

      // Register in AssetDatabase and save manifest
      const webPath = convertToWebPath(state.currentFilePath, platform);
      if (webPath) {
        let assetGuid = getAssetGuid();

        // Generate UUID if needed
        if (!assetGuid) {
          assetGuid = crypto.randomUUID();
          setAssetGuid(assetGuid);
        }

        // Check for existing registration at this path
        const existingGuid = AssetDatabase.findByPath(webPath);
        if (existingGuid && existingGuid !== assetGuid) {
          // Path already registered with different GUID, use existing
          assetGuid = existingGuid;
          setAssetGuid(assetGuid);
        }

        // Register the asset
        AssetDatabase.registerAdditionalAssets({
          [assetGuid]: {
            type: AssetType.StateMachine,
            path: webPath,
          },
        });

        // Save manifest if available
        await saveManifestIfAvailable(platform, currentAssetsManifest);
      }

      markClean();
    } catch (error) {
      console.error('Failed to save state machine:', error);
    }
  } else {
    handleSaveAs(platform);
  }
}

async function handleSaveAs(platform: EditorPlatform): Promise<void> {
  const sm = getCurrentStateMachine();
  if (!sm) return;

  try {
    const path = await platform.showSaveDialog({
      title: 'Save State Machine As',
      defaultPath: `${sm.name}.sm.json`,
      filters: [
        { name: 'State Machine', extensions: ['sm.json'] },
        { name: 'JSON', extensions: ['json'] },
      ],
    });

    if (path) {
      const jsonString = serializeStateMachine(sm);
      await platform.writeTextFile(path, jsonString);
      setCurrentFilePath(path);

      // Generate new GUID for Save As
      const assetGuid = crypto.randomUUID();
      setAssetGuid(assetGuid);

      // Register in AssetDatabase and save manifest
      const webPath = convertToWebPath(path, platform);
      if (webPath) {
        // Check for existing registration at this path
        const existingGuid = AssetDatabase.findByPath(webPath);
        if (existingGuid) {
          // Path already registered, use existing GUID
          setAssetGuid(existingGuid);
        }

        // Register the asset
        AssetDatabase.registerAdditionalAssets({
          [getAssetGuid()!]: {
            type: AssetType.StateMachine,
            path: webPath,
          },
        });

        // Save manifest if available
        await saveManifestIfAvailable(platform, currentAssetsManifest);
      }

      markClean();
    }
  } catch (error) {
    console.error('Failed to save state machine:', error);
  }
}

function handleDeleteSelected(): void {
  const state = getStateMachineEditorState();

  // Delete selected nodes (skip special nodes)
  for (const nodeId of state.nodeEditor.selectedNodeIds) {
    if (!isSpecialNode(nodeId)) {
      deleteState(nodeId);
    }
  }

  // Delete selected links (skip entry link)
  for (const linkId of state.nodeEditor.selectedLinkIds) {
    if (linkId !== '__entry_link__') {
      deleteTransition(linkId);
    }
  }

  // Clear selection
  clearSelection(state.nodeEditor);
}

// ============================================================================
// Special Node Info
// ============================================================================

/**
 * Render info panel for special nodes (Entry, Any State, Exit)
 */
function renderSpecialNodeInfo(nodeId: string): void {
  if (nodeId === ENTRY_NODE_ID) {
    EditorLayout.sectionHeader('Entry Node');
    EditorLayout.spacing();
    EditorLayout.hint(
      'The Entry node represents the starting point of the state machine. ' +
      'Connect it to the state that should play first.',
    );
    EditorLayout.spacing();
    EditorLayout.hint(
      'To change the entry state, drag a connection from this node to the desired state.',
    );
  } else if (nodeId === ANY_STATE_NODE_ID) {
    EditorLayout.sectionHeader('Any State Node');
    EditorLayout.spacing();
    EditorLayout.hint(
      'Transitions from "Any State" can interrupt any currently playing state. ' +
      'Use this for high-priority actions like death or damage reactions.',
    );
    EditorLayout.spacing();
    EditorLayout.hint(
      'Drag a connection from this node to create an "any state" transition.',
    );
  } else if (nodeId === EXIT_NODE_ID) {
    EditorLayout.sectionHeader('Exit Node');
    EditorLayout.spacing();
    EditorLayout.hint(
      'The Exit node represents leaving the state machine. ' +
      'Connect states to this node when they should end the animation sequence.',
    );
    EditorLayout.spacing();
    EditorLayout.hint(
      '(Exit transitions are not yet implemented)',
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert an absolute file path to a web-relative path.
 * Returns null if conversion is not possible.
 */
function convertToWebPath(absolutePath: string, platform: EditorPlatform): string | null {
  if (!platform.sourceAssetsDir) return null;
  if (!absolutePath.startsWith(platform.sourceAssetsDir)) return null;

  const relative = absolutePath.slice(platform.sourceAssetsDir.length);
  return relative.startsWith('/') ? relative : '/' + relative;
}

/**
 * Save the asset manifest if platform supports it.
 */
async function saveManifestIfAvailable(
  platform: EditorPlatform,
  assetsManifest?: string,
): Promise<void> {
  if (!assetsManifest || !platform.sourceAssetsDir || !platform.joinPath || !platform.writeTextFile) {
    return;
  }

  try {
    const manifestRelative = assetsManifest.startsWith('/')
      ? assetsManifest.slice(1)
      : assetsManifest;
    const manifestPath = await platform.joinPath(platform.sourceAssetsDir, manifestRelative);
    const json = AssetDatabase.serializeToJson(true);
    await platform.writeTextFile(manifestPath, json);
  } catch (error) {
    console.error('Failed to save manifest:', error);
  }
}

/**
 * Convert a web-relative path to an absolute file path.
 * Returns null if conversion is not possible.
 */
function convertToAbsolutePath(webPath: string, platform: EditorPlatform): string | null {
  if (!platform.sourceAssetsDir) return null;
  if (!webPath) return null;

  // Remove leading slash if present for joining
  const relativePath = webPath.startsWith('/') ? webPath.slice(1) : webPath;
  return `${platform.sourceAssetsDir}/${relativePath}`;
}

/**
 * Handle entity selection and auto-load attached state machine.
 * If the entity has an AnimationStateMachineController with a loaded state machine,
 * automatically load it into the editor.
 */
function handleSelectEntity(entity: Entity, commands?: Command): void {
  selectEntity(entity);

  // Check if entity has AnimationStateMachineController with loaded state machine
  if (!commands) return;

  const smController = commands.tryGetComponent(entity, AnimationStateMachineController);
  if (!smController || !smController.stateMachine) return;

  const runtimeAsset = smController.stateMachine;

  // If the state machine is loaded, use its data
  if (runtimeAsset.isLoaded && runtimeAsset.data) {
    // Get file path from asset metadata
    const metadata = AssetDatabase.getMetadata(runtimeAsset.guid);
    const filePath = metadata?.path
      ? convertToAbsolutePath(metadata.path, currentPlatform!)
      : null;

    // Load the state machine into the editor
    loadStateMachine(runtimeAsset.data, filePath ?? undefined);

    // Set the asset GUID so save works correctly
    setAssetGuid(runtimeAsset.guid);
  } else {
    // State machine not loaded yet, try to load it
    runtimeAsset.load().then(() => {
      if (runtimeAsset.data) {
        const metadata = AssetDatabase.getMetadata(runtimeAsset.guid);
        const filePath = metadata?.path
          ? convertToAbsolutePath(metadata.path, currentPlatform!)
          : null;

        loadStateMachine(runtimeAsset.data, filePath ?? undefined);
        setAssetGuid(runtimeAsset.guid);
      }
    }).catch((err) => {
      console.error('Failed to load state machine:', err);
    });
  }
}
