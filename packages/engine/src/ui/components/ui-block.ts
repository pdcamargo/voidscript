/**
 * UIBlock Component
 *
 * Container component for UI layouts. Wraps three-mesh-ui Block
 * with ECS serialization support.
 *
 * Supports flexbox-like layout properties.
 */

import * as THREE from 'three';
import { ImGui } from '@voidscript/imgui';
import { component } from '@voidscript/core';
import type { RuntimeAsset } from '@voidscript/core';
import type ThreeMeshUI from 'three-mesh-ui';

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

const BACKGROUND_SIZE_OPTIONS: Array<'stretch' | 'contain' | 'cover'> = [
  'stretch',
  'contain',
  'cover',
];

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
 * UI Anchor presets
 * Determines the reference point on the screen for positioning
 */
export type UIAnchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/**
 * UI Pivot presets
 * Determines the reference point on the element itself
 */
export type UIPivot =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/**
 * Content direction for layout
 */
export type UIContentDirection =
  | 'row'
  | 'row-reverse'
  | 'column'
  | 'column-reverse';

/**
 * Justify content options
 */
export type UIJustifyContent =
  | 'start'
  | 'end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';

/**
 * Align items options
 */
export type UIAlignItems = 'start' | 'end' | 'center' | 'stretch';

/**
 * Padding configuration - can be a single number or per-side
 */
export interface UIPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * UIBlock component data
 */
export interface UIBlockData {
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

  /**
   * Width of the block in pixels
   * Use 'auto' behavior by setting to 0 (will size to content)
   * @default 100
   */
  width: number;

  /**
   * Height of the block in pixels
   * Use 'auto' behavior by setting to 0 (will size to content)
   * @default 100
   */
  height: number;

  /**
   * Direction of content layout
   * @default 'column'
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
   * Padding inside the block
   * @default { top: 0, right: 0, bottom: 0, left: 0 }
   */
  padding: UIPadding;

  /**
   * Margin around the block
   * @default 0
   */
  margin: number;

  /**
   * Offset from parent (for overlap effects)
   * @default 0
   */
  offset: number;

  /**
   * Background color (RGB 0-1)
   * @default { r: 0.1, g: 0.1, b: 0.1 }
   */
  backgroundColor: { r: number; g: number; b: number };

  /**
   * Background opacity (0-1)
   * @default 1
   */
  backgroundOpacity: number;

  /**
   * Optional background texture
   * @default null
   */
  backgroundTexture: RuntimeAsset | null;

  /**
   * How the background texture should be sized
   * @default 'cover'
   */
  backgroundSize: 'stretch' | 'contain' | 'cover';

  /**
   * Border radius in pixels
   * Can be a single value or array of 4 values [topLeft, topRight, bottomRight, bottomLeft]
   * @default 0
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

  /**
   * Border opacity (0-1)
   * @default 1
   */
  borderOpacity: number;

  /**
   * Whether this block is visible
   * @default true
   */
  visible: boolean;

  /**
   * Whether to hide content that overflows the block bounds
   * @default false
   */
  hiddenOverflow: boolean;

  /**
   * Internal reference to the three-mesh-ui Block
   * Non-serialized - created at runtime
   */
  _block?: ThreeMeshUI.Block;

  /**
   * Internal flag to track if block needs update
   * Non-serialized
   */
  _dirty?: boolean;
}

/**
 * UIBlock component definition
 */
export const UIBlock = component<UIBlockData>(
  'UIBlock',
  {
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
    width: {
      serializable: true,
    },
    height: {
      serializable: true,
    },
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
    padding: {
      serializable: true,
    },
    margin: {
      serializable: true,
    },
    offset: {
      serializable: true,
    },
    backgroundColor: {
      serializable: true,
    },
    backgroundOpacity: {
      serializable: true,
    },
    backgroundTexture: {
      serializable: true,
      type: 'runtimeAsset',
      whenNullish: 'keep',
    },
    backgroundSize: {
      serializable: true,
      customEditor: ({ label, value, onChange }) => {
        renderEnumCombo(label, '##backgroundSize', value as 'stretch' | 'contain' | 'cover', BACKGROUND_SIZE_OPTIONS, onChange);
      },
    },
    borderRadius: {
      serializable: true,
    },
    borderWidth: {
      serializable: true,
    },
    borderColor: {
      serializable: true,
    },
    borderOpacity: {
      serializable: true,
    },
    visible: {
      serializable: true,
    },
    hiddenOverflow: {
      serializable: true,
    },
    // Internal fields - not serialized
    _block: {
      serializable: false,
    },
    _dirty: {
      serializable: false,
    },
  },
  {
    path: 'ui/layout',
    displayName: 'UI Block',
    description: 'Container for UI elements with flexbox-like layout support.',
    defaultValue: () => ({
      anchor: 'middle-center',
      pivot: 'middle-center',
      width: 100,
      height: 100,
      contentDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      margin: 0,
      offset: 0,
      backgroundColor: { r: 0.1, g: 0.1, b: 0.1 },
      backgroundOpacity: 1,
      backgroundTexture: null,
      backgroundSize: 'cover',
      borderRadius: 0,
      borderWidth: 0,
      borderColor: { r: 1, g: 1, b: 1 },
      borderOpacity: 1,
      visible: true,
      hiddenOverflow: false,
      _block: undefined,
      _dirty: true,
    }),
  },
);

/**
 * Helper to convert UIBlockData to three-mesh-ui Block options
 */
export function uiBlockDataToOptions(
  data: UIBlockData,
): Record<string, unknown> {
  const options: Record<string, unknown> = {
    width: data.width,
    height: data.height,
    contentDirection: data.contentDirection,
    justifyContent: data.justifyContent,
    alignItems: data.alignItems,
    padding: data.padding.top, // three-mesh-ui uses single padding value
    margin: data.margin,
    offset: data.offset,
    backgroundColor: colorToThreeColor(data.backgroundColor),
    backgroundOpacity: data.backgroundOpacity,
    backgroundSize: data.backgroundSize,
    borderRadius: data.borderRadius,
    borderWidth: data.borderWidth,
    borderColor: colorToThreeColor(data.borderColor),
    borderOpacity: data.borderOpacity,
    hiddenOverflow: data.hiddenOverflow,
  };

  return options;
}

/**
 * Get the screen position offset for an anchor point
 * Returns normalized values (-0.5 to 0.5) that should be multiplied by screen dimensions
 */
export function getAnchorOffset(anchor: UIAnchor): { x: number; y: number } {
  switch (anchor) {
    case 'top-left':
      return { x: -0.5, y: 0.5 };
    case 'top-center':
      return { x: 0, y: 0.5 };
    case 'top-right':
      return { x: 0.5, y: 0.5 };
    case 'middle-left':
      return { x: -0.5, y: 0 };
    case 'middle-center':
      return { x: 0, y: 0 };
    case 'middle-right':
      return { x: 0.5, y: 0 };
    case 'bottom-left':
      return { x: -0.5, y: -0.5 };
    case 'bottom-center':
      return { x: 0, y: -0.5 };
    case 'bottom-right':
      return { x: 0.5, y: -0.5 };
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Get the element offset for a pivot point
 * Returns normalized values (-0.5 to 0.5) that should be multiplied by element dimensions
 */
export function getPivotOffset(pivot: UIPivot): { x: number; y: number } {
  switch (pivot) {
    case 'top-left':
      return { x: 0.5, y: -0.5 };
    case 'top-center':
      return { x: 0, y: -0.5 };
    case 'top-right':
      return { x: -0.5, y: -0.5 };
    case 'middle-left':
      return { x: 0.5, y: 0 };
    case 'middle-center':
      return { x: 0, y: 0 };
    case 'middle-right':
      return { x: -0.5, y: 0 };
    case 'bottom-left':
      return { x: 0.5, y: 0.5 };
    case 'bottom-center':
      return { x: 0, y: 0.5 };
    case 'bottom-right':
      return { x: -0.5, y: 0.5 };
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Convert RGB object (0-1 range) to THREE.Color
 */
function colorToThreeColor(color: {
  r: number;
  g: number;
  b: number;
}): THREE.Color {
  return new THREE.Color(color.r, color.g, color.b);
}
