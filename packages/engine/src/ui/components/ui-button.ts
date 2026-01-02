/**
 * UIButton Component
 *
 * Interactive button component for UI. Extends UIBlock with
 * state-based styling for hover, active, and disabled states.
 */

import * as THREE from 'three';
import { ImGui } from '@voidscript/imgui';
import { component } from '@voidscript/core';
import type { RuntimeAsset } from '@voidscript/core';
import type ThreeMeshUI from 'three-mesh-ui';
import type { UIAnchor, UIPivot, UIContentDirection, UIJustifyContent, UIAlignItems, UIPadding } from './ui-block.js';

// Constants for dropdown options
const ANCHOR_OPTIONS: UIAnchor[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

const PIVOT_OPTIONS: UIPivot[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

const CONTENT_DIRECTION_OPTIONS: UIContentDirection[] = [
  'row',
  'row-reverse',
  'column',
  'column-reverse',
];

const JUSTIFY_CONTENT_OPTIONS: UIJustifyContent[] = [
  'start',
  'end',
  'center',
  'space-between',
  'space-around',
  'space-evenly',
];

const ALIGN_ITEMS_OPTIONS: UIAlignItems[] = ['start', 'end', 'center', 'stretch'];

/**
 * Helper to create a combo dropdown for enum properties with label
 */
function renderEnumCombo<T extends string>(
  label: string,
  id: string,
  currentValue: T,
  options: readonly T[],
  onChange: (value: T) => void
): void {
  ImGui.Text(`${label}:`);
  ImGui.SameLine();
  if (ImGui.BeginCombo(id, currentValue)) {
    for (const option of options) {
      const isSelected = currentValue === option;
      if (ImGui.Selectable(option, isSelected)) {
        onChange(option);
      }
      if (isSelected) {
        ImGui.SetItemDefaultFocus();
      }
    }
    ImGui.EndCombo();
  }
}

/**
 * Button interaction state
 */
export type UIButtonState = 'idle' | 'hovered' | 'active' | 'disabled';

/**
 * UIButton component data
 */
export interface UIButtonData {
  // ============================================================================
  // Positioning Properties
  // ============================================================================

  /**
   * Anchor point on the screen
   * Determines where on the screen this element is positioned relative to
   * @default 'middle-center'
   */
  anchor: UIAnchor;

  /**
   * Pivot point on the element
   * Determines which point of the element is placed at the anchor position
   * @default 'middle-center'
   */
  pivot: UIPivot;

  // ============================================================================
  // Layout Properties (same as UIBlock)
  // ============================================================================

  /**
   * Width of the button in pixels
   * @default 120
   */
  width: number;

  /**
   * Height of the button in pixels
   * @default 40
   */
  height: number;

  /**
   * Direction of content layout
   * @default 'row'
   */
  contentDirection: UIContentDirection;

  /**
   * How to distribute space along the main axis
   * @default 'center'
   */
  justifyContent: UIJustifyContent;

  /**
   * How to align items along the cross axis
   * @default 'center'
   */
  alignItems: UIAlignItems;

  /**
   * Padding inside the button
   * @default { top: 8, right: 16, bottom: 8, left: 16 }
   */
  padding: UIPadding;

  /**
   * Margin around the button
   * @default 4
   */
  margin: number;

  /**
   * Border radius in pixels
   * @default 4
   */
  borderRadius: number | [number, number, number, number];

  /**
   * Border width in pixels
   * @default 0
   */
  borderWidth: number;

  /**
   * Border color (RGB 0-1)
   * @default { r: 1, g: 1, b: 1 }
   */
  borderColor: { r: number; g: number; b: number };

  // ============================================================================
  // State-Based Colors
  // ============================================================================

  /**
   * Background color when idle (RGB 0-1)
   * @default { r: 0.2, g: 0.2, b: 0.3 }
   */
  idleColor: { r: number; g: number; b: number };

  /**
   * Background color when hovered (RGB 0-1)
   * @default { r: 0.3, g: 0.3, b: 0.4 }
   */
  hoverColor: { r: number; g: number; b: number };

  /**
   * Background color when active/pressed (RGB 0-1)
   * @default { r: 0.15, g: 0.15, b: 0.25 }
   */
  activeColor: { r: number; g: number; b: number };

  /**
   * Background color when disabled (RGB 0-1)
   * @default { r: 0.1, g: 0.1, b: 0.1 }
   */
  disabledColor: { r: number; g: number; b: number };

  /**
   * Background opacity for all states
   * @default 1
   */
  backgroundOpacity: number;

  // ============================================================================
  // State
  // ============================================================================

  /**
   * Whether the button is disabled
   * @default false
   */
  isDisabled: boolean;

  /**
   * Whether the button is visible
   * @default true
   */
  visible: boolean;

  // ============================================================================
  // Text Properties (optional, for convenience)
  // ============================================================================

  /**
   * Button label text (optional)
   * If provided, a Text child will be created automatically
   * @default ''
   */
  label: string;

  /**
   * Label font size
   * @default 14
   */
  labelFontSize: number;

  /**
   * Label font color (RGB 0-1)
   * @default { r: 1, g: 1, b: 1 }
   */
  labelColor: { r: number; g: number; b: number };

  /**
   * MSDF font family JSON file for label
   * @default null
   */
  labelFontFamily: RuntimeAsset | null;

  /**
   * MSDF font texture atlas for label
   * @default null
   */
  labelFontTexture: RuntimeAsset | null;

  // ============================================================================
  // Internal State (non-serialized)
  // ============================================================================

  /**
   * Current interaction state
   * Non-serialized - managed by interaction system
   */
  _state?: UIButtonState;

  /**
   * Internal reference to the three-mesh-ui Block
   * Non-serialized - created at runtime
   */
  _block?: ThreeMeshUI.Block;

  /**
   * Internal reference to the label Text (if label is set)
   * Non-serialized
   */
  _labelText?: ThreeMeshUI.Text;

  /**
   * Internal flag to track if button needs update
   * Non-serialized
   */
  _dirty?: boolean;
}

/**
 * UIButton component definition
 */
export const UIButton = component<UIButtonData>(
  'UIButton',
  {
    // Positioning properties
    anchor: {
      serializable: true,
      customEditor: ({ label, value, onChange }) => {
        renderEnumCombo(label, '##anchor', value as UIAnchor, ANCHOR_OPTIONS, onChange);
      },
    },
    pivot: {
      serializable: true,
      customEditor: ({ label, value, onChange }) => {
        renderEnumCombo(label, '##pivot', value as UIPivot, PIVOT_OPTIONS, onChange);
      },
    },

    // Layout properties
    width: { serializable: true },
    height: { serializable: true },
    contentDirection: {
      serializable: true,
      customEditor: ({ label, value, onChange }) => {
        renderEnumCombo(label, '##contentDirection', value as UIContentDirection, CONTENT_DIRECTION_OPTIONS, onChange);
      },
    },
    justifyContent: {
      serializable: true,
      customEditor: ({ label, value, onChange }) => {
        renderEnumCombo(label, '##justifyContent', value as UIJustifyContent, JUSTIFY_CONTENT_OPTIONS, onChange);
      },
    },
    alignItems: {
      serializable: true,
      customEditor: ({ label, value, onChange }) => {
        renderEnumCombo(label, '##alignItems', value as UIAlignItems, ALIGN_ITEMS_OPTIONS, onChange);
      },
    },
    padding: { serializable: true },
    margin: { serializable: true },
    borderRadius: { serializable: true },
    borderWidth: { serializable: true },
    borderColor: { serializable: true },

    // State-based colors
    idleColor: { serializable: true },
    hoverColor: { serializable: true },
    activeColor: { serializable: true },
    disabledColor: { serializable: true },
    backgroundOpacity: { serializable: true },

    // State
    isDisabled: { serializable: true },
    visible: { serializable: true },

    // Label properties
    label: { serializable: true },
    labelFontSize: { serializable: true },
    labelColor: { serializable: true },
    labelFontFamily: {
      serializable: true,
      type: 'runtimeAsset',
      whenNullish: 'keep',
    },
    labelFontTexture: {
      serializable: true,
      type: 'runtimeAsset',
      whenNullish: 'keep',
    },

    // Internal fields - not serialized
    _state: { serializable: false },
    _block: { serializable: false },
    _labelText: { serializable: false },
    _dirty: { serializable: false },
  },
  {
    path: 'ui/interactive',
    displayName: 'UI Button',
    description: 'Interactive button with state-based styling. Supports hover, active, and disabled states.',
    defaultValue: () => ({
      // Positioning
      anchor: 'middle-center',
      pivot: 'middle-center',

      // Layout
      width: 120,
      height: 40,
      contentDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      padding: { top: 8, right: 16, bottom: 8, left: 16 },
      margin: 4,
      borderRadius: 4,
      borderWidth: 0,
      borderColor: { r: 1, g: 1, b: 1 },

      // State colors
      idleColor: { r: 0.2, g: 0.2, b: 0.3 },
      hoverColor: { r: 0.3, g: 0.3, b: 0.4 },
      activeColor: { r: 0.15, g: 0.15, b: 0.25 },
      disabledColor: { r: 0.1, g: 0.1, b: 0.1 },
      backgroundOpacity: 1,

      // State
      isDisabled: false,
      visible: true,

      // Label
      label: 'Button',
      labelFontSize: 14,
      labelColor: { r: 1, g: 1, b: 1 },
      labelFontFamily: null,
      labelFontTexture: null,

      // Internal
      _state: 'idle',
      _block: undefined,
      _labelText: undefined,
      _dirty: true,
    }),
  }
);

/**
 * Get the current background color based on button state
 */
export function getButtonBackgroundColor(data: UIButtonData): { r: number; g: number; b: number } {
  if (data.isDisabled) {
    return data.disabledColor;
  }

  switch (data._state) {
    case 'hovered':
      return data.hoverColor;
    case 'active':
      return data.activeColor;
    case 'disabled':
      return data.disabledColor;
    case 'idle':
    default:
      return data.idleColor;
  }
}

/**
 * Helper to convert UIButtonData to three-mesh-ui Block options
 */
export function uiButtonDataToOptions(data: UIButtonData): Record<string, unknown> {
  const bgColor = getButtonBackgroundColor(data);

  return {
    width: data.width,
    height: data.height,
    contentDirection: data.contentDirection,
    justifyContent: data.justifyContent,
    alignItems: data.alignItems,
    padding: data.padding.top,
    margin: data.margin,
    backgroundColor: new THREE.Color(bgColor.r, bgColor.g, bgColor.b),
    backgroundOpacity: data.backgroundOpacity,
    borderRadius: data.borderRadius,
    borderWidth: data.borderWidth,
    borderColor: new THREE.Color(data.borderColor.r, data.borderColor.g, data.borderColor.b),
  };
}
