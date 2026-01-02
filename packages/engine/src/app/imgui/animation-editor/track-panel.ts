/**
 * Track Panel
 *
 * Left panel of the animation editor showing the list of tracks
 * grouped by component, with add/remove functionality.
 *
 * Uses a two-step picker for adding tracks:
 * 1. Select a component from the selected entity
 * 2. Select an animatable property from that component
 */

import { ImGui } from '@voidscript/imgui';
import {
  type AnimationEditorState,
  type EditorTrack,
  addTrack,
  removeTrack,
  selectTrack,
  markDirty,
  getTracksGroupedByComponent,
  getSelectedEntity,
  addKeyframe,
} from './animation-editor-state.js';
import {
  COLORS,
  TRACK_PANEL_WIDTH,
  TRACK_ROW_HEIGHT,
  TIME_RULER_HEIGHT,
} from './constants.js';
import { getDefaultValueForProperty } from './animation-serializer.js';
import { parsePropertyPath, buildPropertyPath } from '../../../animation/property-path.js';
import type { Scene } from '../../../ecs/scene.js';
import type { ComponentType } from '../../../ecs/component.js';
import type { PropertySerializerConfig } from '../../../ecs/serialization/types.js';

// ============================================================================
// Module State for Add Track Picker
// ============================================================================

interface AddTrackPickerState {
  /** Currently selected component (step 1) */
  selectedComponent: ComponentType<any> | null;
  /** Component name for display */
  selectedComponentName: string;
  /** Step: 'component' or 'property' */
  step: 'component' | 'property';
}

let pickerState: AddTrackPickerState = {
  selectedComponent: null,
  selectedComponentName: '',
  step: 'component',
};

/** Reset the picker state */
function resetPickerState(): void {
  pickerState = {
    selectedComponent: null,
    selectedComponentName: '',
    step: 'component',
  };
}

// ============================================================================
// Track Panel Rendering
// ============================================================================

/**
 * Render the track panel (left side of animation editor)
 *
 * @param state - Animation editor state
 * @param availableHeight - Available height for the panel
 * @param scene - Scene for querying entity components (optional, needed for Add Track picker)
 */
export function renderTrackPanel(
  state: AnimationEditorState,
  availableHeight: number,
  scene?: Scene,
): void {
  ImGui.PushStyleColorImVec4(ImGui.Col.ChildBg, COLORS.trackPanelBackground);

  const headerHeight = TIME_RULER_HEIGHT;
  const contentHeight = availableHeight;

  ImGui.BeginChild('##TrackPanel', { x: TRACK_PANEL_WIDTH, y: contentHeight }, 0, ImGui.WindowFlags.None);

  // Header area (aligns with time ruler)
  renderTrackPanelHeader(state, headerHeight, scene);

  // Track list
  const trackListHeight = contentHeight - headerHeight;
  renderTrackList(state, trackListHeight);

  ImGui.EndChild();

  ImGui.PopStyleColor();
}

// ============================================================================
// Header
// ============================================================================

function renderTrackPanelHeader(state: AnimationEditorState, height: number, scene?: Scene): void {
  ImGui.BeginChild('##TrackPanelHeader', { x: 0, y: height }, 0, ImGui.WindowFlags.None);

  // Add Track button
  ImGui.SetCursorPos({ x: 8, y: (height - 20) / 2 });
  if (ImGui.Button('+ Add Track', { x: TRACK_PANEL_WIDTH - 16, y: 20 })) {
    resetPickerState();
    ImGui.OpenPopup('##AddTrackPopup');
  }

  // Add Track popup menu
  if (ImGui.BeginPopup('##AddTrackPopup')) {
    renderAddTrackMenu(state, scene);
    ImGui.EndPopup();
  }

  ImGui.EndChild();

  // Separator line
  ImGui.PushStyleColorImVec4(ImGui.Col.Separator, COLORS.trackPanelDivider);
  ImGui.Separator();
  ImGui.PopStyleColor();
}

// ============================================================================
// Add Track Menu - Component and Property Picker
// ============================================================================

function renderAddTrackMenu(state: AnimationEditorState, scene?: Scene): void {
  const entity = getSelectedEntity();

  if (!entity || !scene) {
    ImGui.TextDisabled('No entity selected');
    return;
  }

  // Get components on the selected entity
  const components = scene.getAllComponents(entity);
  if (!components || components.size === 0) {
    ImGui.TextDisabled('Entity has no components');
    return;
  }

  // Render based on current step
  if (pickerState.step === 'component') {
    renderComponentPicker(state, components);
  } else {
    renderPropertyPicker(state);
  }
}

/**
 * Step 1: Component picker
 * Shows all components on the entity that have serializable properties
 */
function renderComponentPicker(
  state: AnimationEditorState,
  components: Map<ComponentType<any>, any>,
): void {
  ImGui.TextDisabled('Select Component');
  ImGui.Separator();

  // Build list of animatable components
  const animatableComponents: Array<{ type: ComponentType<any>; name: string; propertyCount: number }> = [];

  for (const [componentType] of components) {
    const serializerConfig = componentType.serializerConfig;
    if (!serializerConfig || typeof serializerConfig !== 'object') {
      continue;
    }

    // Count animatable properties
    const propertyNames = Object.keys(serializerConfig);
    let animatableCount = 0;
    for (const propName of propertyNames) {
      const config = serializerConfig[propName] as PropertySerializerConfig | undefined;
      if (config && isAnimatableProperty(config)) {
        animatableCount++;
      }
    }

    if (animatableCount > 0) {
      animatableComponents.push({
        type: componentType,
        name: componentType.name,
        propertyCount: animatableCount,
      });
    }
  }

  // Sort alphabetically
  animatableComponents.sort((a, b) => a.name.localeCompare(b.name));

  if (animatableComponents.length === 0) {
    ImGui.TextDisabled('No animatable components found');
    return;
  }

  for (const { type, name, propertyCount } of animatableComponents) {
    const label = `${name} (${propertyCount})`;

    // Use Selectable with NoAutoClosePopups flag to prevent popup from closing
    if (ImGui.Selectable(label, false, ImGui.SelectableFlags.NoAutoClosePopups)) {
      pickerState.selectedComponent = type;
      pickerState.selectedComponentName = name;
      pickerState.step = 'property';
    }
  }
}

/**
 * Step 2: Property picker
 * Shows all animatable properties on the selected component
 */
function renderPropertyPicker(state: AnimationEditorState): void {
  const componentType = pickerState.selectedComponent;
  if (!componentType) {
    resetPickerState();
    return;
  }

  // Back button
  if (ImGui.ArrowButton('##back', ImGui.Dir._Left)) {
    pickerState.step = 'component';
    pickerState.selectedComponent = null;
    pickerState.selectedComponentName = '';
    return;
  }
  ImGui.SameLine();
  ImGui.Text(pickerState.selectedComponentName);
  ImGui.Separator();

  const serializerConfig = componentType.serializerConfig;
  if (!serializerConfig || typeof serializerConfig !== 'object') {
    ImGui.TextDisabled('No properties');
    resetPickerState();
    return;
  }

  // Build list of animatable properties
  const animatableProps: Array<{
    name: string;
    config: PropertySerializerConfig | null;
    icon: string;
    typeName: string;
    isVirtual?: boolean;
  }> = [];

  // Add virtual properties for specific components
  const virtualProps = getVirtualAnimatableProperties(pickerState.selectedComponentName);
  for (const vProp of virtualProps) {
    animatableProps.push({
      name: vProp.name,
      config: null,
      icon: vProp.icon,
      typeName: vProp.typeName,
      isVirtual: true,
    });
  }

  // Get default values from component metadata
  const componentDefaults = getComponentDefaultValues(componentType);

  const propertyNames = Object.keys(serializerConfig);
  for (const propName of propertyNames) {
    const config = serializerConfig[propName] as PropertySerializerConfig | undefined;
    if (config && isAnimatableProperty(config)) {
      const propDefaultValue = componentDefaults?.[propName];
      animatableProps.push({
        name: propName,
        config,
        icon: getPropertyIconFromConfig(config, propDefaultValue),
        typeName: getPropertyTypeName(config, propDefaultValue),
      });
    }
  }

  // Sort alphabetically
  animatableProps.sort((a, b) => a.name.localeCompare(b.name));

  if (animatableProps.length === 0) {
    ImGui.TextDisabled('No animatable properties');
    return;
  }

  for (const { name, icon, typeName } of animatableProps) {
    const fullPath = buildPropertyPath(pickerState.selectedComponentName, name);

    // Check if track already exists
    const existingTrack = state.tracks.find((t) => t.fullPropertyPath === fullPath);
    const alreadyExists = existingTrack !== undefined;

    // Show disabled if already exists
    if (alreadyExists) {
      ImGui.BeginDisabled(true);
    }

    const label = `${icon} ${name}`;
    const suffix = alreadyExists ? ' (exists)' : ` [${typeName}]`;

    if (ImGui.MenuItem(label + suffix)) {
      // Create new track
      const defaultValue = getDefaultValueForProperty(fullPath);
      const newTrack = addTrack(fullPath, defaultValue);
      selectTrack(newTrack.id);
      resetPickerState();
      ImGui.CloseCurrentPopup();
    }

    if (alreadyExists) {
      ImGui.EndDisabled();
    }
  }
}

// ============================================================================
// Virtual Property Definitions
// ============================================================================

/**
 * Virtual properties that can be animated but don't exist directly on the component.
 * These are handled by value handlers at runtime.
 */
interface VirtualAnimatableProperty {
  name: string;
  icon: string;
  typeName: string;
}

/**
 * Get virtual animatable properties for a component.
 * These are special properties like "sprite" for Sprite2D that are handled
 * by value handlers rather than direct property access.
 */
function getVirtualAnimatableProperties(componentName: string): VirtualAnimatableProperty[] {
  switch (componentName) {
    case 'Sprite2D':
      return [
        {
          name: 'sprite',
          icon: 'SP',
          typeName: 'Sprite',
        },
      ];
    default:
      return [];
  }
}

// ============================================================================
// Component Default Value Helper
// ============================================================================

/**
 * Get the default values object from a component type's metadata.
 * Handles both static objects and factory functions.
 */
function getComponentDefaultValues(componentType: ComponentType<any>): Record<string, unknown> | null {
  const defaultValue = componentType.metadata?.defaultValue;
  if (!defaultValue) {
    return null;
  }

  // If it's a function, call it to get the default object
  if (typeof defaultValue === 'function') {
    return defaultValue() as Record<string, unknown>;
  }

  // Otherwise, it's a static object
  return defaultValue as Record<string, unknown>;
}

// ============================================================================
// Property Analysis Helpers
// ============================================================================

/**
 * Check if a property is animatable based on its serializer config
 */
function isAnimatableProperty(config: PropertySerializerConfig): boolean {
  // Skip non-serializable
  if (config.serializable === false) {
    return false;
  }

  // Skip entity references (can't animate)
  if (config.type === 'entity') {
    return false;
  }

  // Skip collections for now (arrays, sets)
  if (config.collectionType === 'array' || config.collectionType === 'set') {
    return false;
  }

  // Numbers are animatable
  if (config.instanceType === Number) {
    return true;
  }

  // Booleans can be animated (discrete)
  if (config.instanceType === Boolean) {
    return true;
  }

  // Vectors (check by name pattern)
  const instanceName = config.instanceType?.name?.toLowerCase() || '';
  if (instanceName.includes('vector')) {
    return true;
  }

  // Colors (check by type or name)
  if (instanceName.includes('color')) {
    return true;
  }

  // Enums are animatable (discrete)
  if (config.type === 'enum') {
    return true;
  }

  // Runtime assets (sprites, textures) - discrete animation
  if (config.type === 'runtimeAsset') {
    return true;
  }

  // Default: if serializable and no explicit exclusion, assume animatable
  // This catches properties without explicit instanceType (like color objects, tile indices)
  if (config.serializable === true) {
    return true;
  }

  return false;
}

/**
 * Get an icon for a property based on its config and optional default value
 */
function getPropertyIconFromConfig(
  config: PropertySerializerConfig,
  defaultValue?: unknown,
): string {
  // Numbers
  if (config.instanceType === Number) {
    return '#';
  }

  // Booleans
  if (config.instanceType === Boolean) {
    return 'B';
  }

  // Enums
  if (config.type === 'enum') {
    return 'E';
  }

  // Runtime assets (sprites)
  if (config.type === 'runtimeAsset') {
    return 'SP';
  }

  // Check instance type name
  const instanceName = config.instanceType?.name?.toLowerCase() || '';
  if (instanceName.includes('vector')) {
    return 'V';
  }
  if (instanceName.includes('color')) {
    return 'C';
  }

  // Infer from default value if no instanceType
  if (defaultValue !== undefined && defaultValue !== null) {
    if (typeof defaultValue === 'boolean') {
      return 'B';
    }
    if (typeof defaultValue === 'number') {
      return '#';
    }
    if (typeof defaultValue === 'object') {
      if ('x' in defaultValue && 'y' in defaultValue && 'z' in defaultValue) {
        return 'V';
      }
      if ('r' in defaultValue && 'g' in defaultValue && 'b' in defaultValue) {
        return 'C';
      }
    }
  }

  return '?';
}

/**
 * Get a human-readable type name for a property
 */
function getPropertyTypeName(config: PropertySerializerConfig, defaultValue?: unknown): string {
  // Numbers
  if (config.instanceType === Number) {
    return 'Number';
  }

  // Booleans
  if (config.instanceType === Boolean) {
    return 'Boolean';
  }

  // Enums
  if (config.type === 'enum') {
    return 'Enum';
  }

  // Runtime assets
  if (config.type === 'runtimeAsset') {
    const assetTypes = config.assetTypes;
    if (assetTypes && assetTypes.length > 0) {
      return assetTypes.join('/');
    }
    return 'Asset';
  }

  // Check instance type name
  const instanceName = config.instanceType?.name || '';
  if (instanceName) {
    return instanceName;
  }

  // Infer from default value if no instanceType
  if (defaultValue !== undefined && defaultValue !== null) {
    if (typeof defaultValue === 'boolean') {
      return 'Boolean';
    }
    if (typeof defaultValue === 'number') {
      return 'Number';
    }
    if (typeof defaultValue === 'object') {
      if ('x' in defaultValue && 'y' in defaultValue && 'z' in defaultValue) {
        return 'Vector3';
      }
      if ('x' in defaultValue && 'y' in defaultValue) {
        return 'Vector2';
      }
      if ('r' in defaultValue && 'g' in defaultValue && 'b' in defaultValue) {
        return 'Color';
      }
    }
  }

  // If nullable, show Object (likely a complex type)
  if (config.whenNullish === 'keep' || config.isNullable) {
    return 'Object';
  }

  // Default for serializable properties without explicit type
  return 'Value';
}

// ============================================================================
// Track List - Grouped by Component
// ============================================================================

function renderTrackList(state: AnimationEditorState, availableHeight: number): void {
  ImGui.BeginChild('##TrackList', { x: 0, y: availableHeight }, 0, ImGui.WindowFlags.None);

  if (state.tracks.length === 0) {
    ImGui.SetCursorPos({ x: 10, y: 20 });
    ImGui.TextDisabled('No tracks');
    ImGui.SetCursorPos({ x: 10, y: 38 });
    ImGui.TextDisabled('Click "Add Track" to add one');
  } else {
    // Group tracks by component
    const groups = getTracksGroupedByComponent();
    let rowIndex = 0;

    for (const [componentName, tracks] of groups) {
      // Component header
      renderComponentHeader(componentName, tracks.length);

      // Render tracks in this group
      for (const track of tracks) {
        renderTrackRow(state, track, rowIndex);
        rowIndex++;
      }
    }
  }

  ImGui.EndChild();
}

// ============================================================================
// Component Header
// ============================================================================

function renderComponentHeader(componentName: string, trackCount: number): void {
  const headerHeight = 20;

  ImGui.PushStyleColorImVec4(ImGui.Col.Button, COLORS.componentHeaderBackground);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, COLORS.componentHeaderBackground);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, COLORS.componentHeaderBackground);

  ImGui.Button(`##componentHeader_${componentName}`, { x: TRACK_PANEL_WIDTH - 16, y: headerHeight });

  ImGui.PopStyleColor(3);

  // Draw header text on top
  const cursorY = ImGui.GetCursorPosY() - headerHeight;
  ImGui.SetCursorPos({ x: 8, y: cursorY + 2 });
  ImGui.PushStyleColorImVec4(ImGui.Col.Text, COLORS.componentHeaderText);
  ImGui.Text(componentName);
  ImGui.PopStyleColor();

  // Track count
  ImGui.SameLine(TRACK_PANEL_WIDTH - 35);
  ImGui.TextDisabled(`(${trackCount})`);

  ImGui.SetCursorPosY(cursorY + headerHeight);
}

// ============================================================================
// Track Row
// ============================================================================

function renderTrackRow(state: AnimationEditorState, track: EditorTrack, index: number): void {
  const isSelected = state.selectedTrackId === track.id;
  const rowHeight = TRACK_ROW_HEIGHT;

  // Background color based on selection and alternating rows
  const bgColor = isSelected
    ? COLORS.trackRowSelected
    : index % 2 === 0
      ? COLORS.trackRowEven
      : COLORS.trackRowOdd;

  // Draw row background
  const cursorY = ImGui.GetCursorPosY();
  ImGui.SetCursorPosY(cursorY);

  ImGui.PushStyleColorImVec4(ImGui.Col.Button, bgColor);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, isSelected ? COLORS.trackRowSelected : COLORS.trackRowHovered);
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, COLORS.trackRowSelected);

  // Full-width invisible button for selection
  const buttonId = `##trackRow_${track.id}`;
  if (ImGui.Button(buttonId, { x: TRACK_PANEL_WIDTH - 16, y: rowHeight })) {
    selectTrack(track.id);
  }

  ImGui.PopStyleColor(3);

  // Context menu
  if (ImGui.BeginPopupContextItem(`##trackContext_${track.id}`)) {
    renderTrackContextMenu(state, track);
    ImGui.EndPopup();
  }

  // Draw track info on top of the button
  ImGui.SetCursorPos({ x: 16, y: cursorY + 4 });

  // Parse the full property path for display
  const parsed = parsePropertyPath(track.fullPropertyPath);

  // Type icon (based on property name)
  const typeIcon = getPropertyIcon(parsed.propertyPath);
  ImGui.TextDisabled(typeIcon);
  ImGui.SameLine();

  // Property path (just the property, not the component since it's in the header)
  ImGui.Text(parsed.propertyPath);

  // Keyframe count (right-aligned)
  const kfCountText = `${track.keyframes.length}`;
  ImGui.SameLine(TRACK_PANEL_WIDTH - 40);
  ImGui.TextDisabled(kfCountText);

  // Move cursor to next row
  ImGui.SetCursorPosY(cursorY + rowHeight);
}

// ============================================================================
// Track Context Menu
// ============================================================================

function renderTrackContextMenu(state: AnimationEditorState, track: EditorTrack): void {
  const parsed = parsePropertyPath(track.fullPropertyPath);
  ImGui.TextDisabled(`${parsed.componentName}.${parsed.propertyPath}`);
  ImGui.Separator();

  // Rename track (edit property path)
  if (ImGui.BeginMenu('Rename...')) {
    renderRenameTrackMenu(track);
    ImGui.EndMenu();
  }

  // Duplicate track
  if (ImGui.MenuItem('Duplicate')) {
    duplicateTrack(state, track);
  }

  ImGui.Separator();

  // Delete track
  ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: 0.9, y: 0.3, z: 0.3, w: 1.0 });
  if (ImGui.MenuItem('Delete')) {
    removeTrack(track.id);
  }
  ImGui.PopStyleColor();
}

// State for rename input
let renameTrackPath = '';

function renderRenameTrackMenu(track: EditorTrack): void {
  // Initialize with current path if empty
  if (renameTrackPath === '') {
    renameTrackPath = track.fullPropertyPath;
  }

  ImGui.Text('Property Path:');
  const buffer: [string] = [renameTrackPath];
  ImGui.SetNextItemWidth(200);
  ImGui.InputText('##renamePath', buffer, 128);
  if (buffer[0] !== renameTrackPath) {
    renameTrackPath = buffer[0];
  }

  ImGui.Spacing();

  if (ImGui.Button('Rename', { x: 70, y: 0 })) {
    if (renameTrackPath.trim() && renameTrackPath.includes('.')) {
      track.fullPropertyPath = renameTrackPath.trim();
      markDirty();
      renameTrackPath = '';
      ImGui.CloseCurrentPopup();
    }
  }
  ImGui.SameLine();
  if (ImGui.Button('Cancel', { x: 70, y: 0 })) {
    renameTrackPath = '';
    ImGui.CloseCurrentPopup();
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get an icon for a property based on its name
 */
function getPropertyIcon(propertyPath: string): string {
  const prop = propertyPath.toLowerCase();

  if (prop.includes('position')) return 'V';
  if (prop.includes('rotation')) return 'R';
  if (prop.includes('scale')) return 'S';
  if (prop.includes('color')) return 'C';
  if (prop.includes('sprite')) return 'SP';
  if (prop.includes('tile') || prop.includes('frame')) return '#';
  if (prop.includes('opacity') || prop.includes('alpha')) return 'A';

  return '?';
}

function duplicateTrack(state: AnimationEditorState, track: EditorTrack): void {
  // Generate a new property path
  let newPath = `${track.fullPropertyPath}_copy`;
  let counter = 1;
  while (state.tracks.some((t) => t.fullPropertyPath === newPath)) {
    newPath = `${track.fullPropertyPath}_copy${counter}`;
    counter++;
  }

  // Create new track
  const defaultValue = getDefaultValueForProperty(newPath);
  const newTrack = addTrack(newPath, defaultValue);

  // Copy keyframes
  for (const kf of track.keyframes) {
    addKeyframe(newTrack.id, kf.time, structuredClone(kf.value), kf.easingName);
  }

  selectTrack(newTrack.id);
}
