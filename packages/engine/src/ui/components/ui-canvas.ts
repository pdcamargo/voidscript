/**
 * UICanvas Component
 *
 * Root component for UI hierarchies. Each UICanvas creates a root
 * three-mesh-ui Block that contains all child UI elements.
 *
 * Similar to Unity's Canvas component.
 */

import { component } from '../../ecs/component.js';
import type ThreeMeshUI from 'three-mesh-ui';

/**
 * Render mode for the UI canvas
 */
export type UICanvasRenderMode = 'screen-space-overlay';

/**
 * UICanvas component data
 */
export interface UICanvasData {
  /**
   * Render mode for this canvas
   * Currently only 'screen-space-overlay' is supported
   * @default 'screen-space-overlay'
   */
  renderMode: UICanvasRenderMode;

  /**
   * Sort order for rendering multiple canvases
   * Higher values render on top
   * @default 0
   */
  sortOrder: number;

  /**
   * Whether this canvas is enabled
   * @default true
   */
  enabled: boolean;

  /**
   * Internal reference to the three-mesh-ui root block
   * Non-serialized - created at runtime
   */
  _root?: ThreeMeshUI.Block;

  /**
   * Internal flag to track if root needs recreation
   * Non-serialized
   */
  _dirty?: boolean;
}

/**
 * UICanvas component definition
 */
export const UICanvas = component<UICanvasData>(
  'UICanvas',
  {
    renderMode: {
      serializable: true,
    },
    sortOrder: {
      serializable: true,
    },
    enabled: {
      serializable: true,
    },
    // Internal fields - not serialized
    _root: {
      serializable: false,
    },
    _dirty: {
      serializable: false,
    },
  },
  {
    path: 'ui',
    displayName: 'UI Canvas',
    description: 'Root container for UI elements. Creates a screen-space overlay for UI rendering.',
    defaultValue: () => ({
      renderMode: 'screen-space-overlay',
      sortOrder: 0,
      enabled: true,
      _root: undefined,
      _dirty: true,
    }),
  }
);
