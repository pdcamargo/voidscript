/**
 * UIText Component
 *
 * Text display component for UI. Wraps three-mesh-ui Text
 * with ECS serialization support.
 *
 * Requires MSDF font files (JSON + texture) for rendering.
 */

import * as THREE from 'three';
import { ImGui } from '@mori2003/jsimgui';
import { component } from '../../ecs/component.js';
import type { RuntimeAsset } from '../../ecs/runtime-asset.js';
import type ThreeMeshUI from 'three-mesh-ui';

// Constants for dropdown options
const TEXT_ALIGN_OPTIONS: UITextAlign[] = ['left', 'center', 'right', 'justify'];

const WHITE_SPACE_OPTIONS: UIWhiteSpace[] = [
  'normal',
  'pre-line',
  'pre-wrap',
  'pre',
  'nowrap',
];

const BEST_FIT_OPTIONS: UIBestFit[] = ['none', 'shrink', 'grow', 'auto'];

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
 * Text alignment options
 */
export type UITextAlign = 'left' | 'center' | 'right' | 'justify';

/**
 * White space handling options
 */
export type UIWhiteSpace = 'normal' | 'pre-line' | 'pre-wrap' | 'pre' | 'nowrap';

/**
 * Best fit options for text sizing
 */
export type UIBestFit = 'none' | 'shrink' | 'grow' | 'auto';

/**
 * UIText component data
 */
export interface UITextData {
  /**
   * Text content to display
   * @default ''
   */
  content: string;

  /**
   * Font size in pixels
   * @default 16
   */
  fontSize: number;

  /**
   * Font color (RGB 0-1)
   * @default { r: 1, g: 1, b: 1 }
   */
  fontColor: { r: number; g: number; b: number };

  /**
   * Font opacity (0-1)
   * @default 1
   */
  fontOpacity: number;

  /**
   * MSDF font family JSON file
   * Required for text rendering
   * @default null
   */
  fontFamily: RuntimeAsset | null;

  /**
   * MSDF font texture atlas
   * Required for text rendering
   * @default null
   */
  fontTexture: RuntimeAsset | null;

  /**
   * Text alignment within the block
   * @default 'center'
   */
  textAlign: UITextAlign;

  /**
   * How white space should be handled
   * @default 'normal'
   */
  whiteSpace: UIWhiteSpace;

  /**
   * Letter spacing multiplier (1 = normal)
   * @default 1
   */
  letterSpacing: number;

  /**
   * Line height multiplier
   * @default 1
   */
  lineHeight: number;

  /**
   * Best fit behavior for text sizing
   * @default 'none'
   */
  bestFit: UIBestFit;

  /**
   * Characters to break on for word wrapping
   * @default '- ,.:?!\n'
   */
  breakOn: string;

  /**
   * Whether this text is visible
   * @default true
   */
  visible: boolean;

  /**
   * Internal reference to the three-mesh-ui Text
   * Non-serialized - created at runtime
   */
  _text?: ThreeMeshUI.Text;

  /**
   * Internal flag to track if text needs update
   * Non-serialized
   */
  _dirty?: boolean;
}

/**
 * UIText component definition
 */
export const UIText = component<UITextData>(
  'UIText',
  {
    content: {
      serializable: true,
    },
    fontSize: {
      serializable: true,
    },
    fontColor: {
      serializable: true,
    },
    fontOpacity: {
      serializable: true,
    },
    fontFamily: {
      serializable: true,
      type: 'runtimeAsset',
      whenNullish: 'keep',
    },
    fontTexture: {
      serializable: true,
      type: 'runtimeAsset',
      whenNullish: 'keep',
    },
    textAlign: {
      serializable: true,
      customEditor: ({ label, value, onChange }) => {
        renderEnumCombo(label, '##textAlign', value as UITextAlign, TEXT_ALIGN_OPTIONS, onChange);
      },
    },
    whiteSpace: {
      serializable: true,
      customEditor: ({ label, value, onChange }) => {
        renderEnumCombo(label, '##whiteSpace', value as UIWhiteSpace, WHITE_SPACE_OPTIONS, onChange);
      },
    },
    letterSpacing: {
      serializable: true,
    },
    lineHeight: {
      serializable: true,
    },
    bestFit: {
      serializable: true,
      customEditor: ({ label, value, onChange }) => {
        renderEnumCombo(label, '##bestFit', value as UIBestFit, BEST_FIT_OPTIONS, onChange);
      },
    },
    breakOn: {
      serializable: true,
    },
    visible: {
      serializable: true,
    },
    // Internal fields - not serialized
    _text: {
      serializable: false,
    },
    _dirty: {
      serializable: false,
    },
  },
  {
    path: 'ui/content',
    displayName: 'UI Text',
    description: 'Text element for displaying content in the UI. Requires MSDF font files.',
    defaultValue: () => ({
      content: 'Text',
      fontSize: 16,
      fontColor: { r: 1, g: 1, b: 1 },
      fontOpacity: 1,
      fontFamily: null,
      fontTexture: null,
      textAlign: 'center',
      whiteSpace: 'normal',
      letterSpacing: 1,
      lineHeight: 1,
      bestFit: 'none',
      breakOn: '- ,.:?!\n',
      visible: true,
      _text: undefined,
      _dirty: true,
    }),
  }
);

/**
 * Helper to convert UITextData to three-mesh-ui Text options
 */
export function uiTextDataToOptions(data: UITextData): Record<string, unknown> {
  const options: Record<string, unknown> = {
    content: data.content,
    fontSize: data.fontSize,
    fontColor: new THREE.Color(data.fontColor.r, data.fontColor.g, data.fontColor.b),
    fontOpacity: data.fontOpacity,
    textAlign: data.textAlign,
    whiteSpace: data.whiteSpace,
    letterSpacing: data.letterSpacing,
    bestFit: data.bestFit,
    breakOn: data.breakOn,
  };

  return options;
}
