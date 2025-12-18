/**
 * UI Module
 *
 * Serializable UI system built on three-mesh-ui.
 * Renders with an orthographic camera on top of the game scene.
 *
 * ## Usage
 *
 * ```typescript
 * // Create a canvas (root container)
 * const canvasEntity = commands.spawn()
 *   .with(UICanvas, { enabled: true, sortOrder: 0 })
 *   .build();
 *
 * // Create a panel
 * const panelEntity = commands.spawn()
 *   .with(Parent, { id: canvasEntity })
 *   .with(UIBlock, {
 *     width: 300,
 *     height: 200,
 *     backgroundColor: { r: 0.1, g: 0.1, b: 0.2 },
 *     borderRadius: 8,
 *   })
 *   .build();
 *
 * // Create a button
 * const buttonEntity = commands.spawn()
 *   .with(Parent, { id: panelEntity })
 *   .with(UIButton, {
 *     label: 'Click Me',
 *     width: 120,
 *     height: 40,
 *   })
 *   .build();
 *
 * // Create text
 * const textEntity = commands.spawn()
 *   .with(Parent, { id: panelEntity })
 *   .with(UIText, {
 *     content: 'Hello World',
 *     fontSize: 24,
 *     fontColor: { r: 1, g: 1, b: 1 },
 *   })
 *   .build();
 * ```
 *
 * ## Notes
 *
 * - UIText requires MSDF fonts (fontFamily JSON + fontTexture image)
 * - UI coordinates: center origin by default, positive Y up
 * - Components are serializable for editor integration
 * - Renders after main scene, before ImGui
 */

// Core
export { UIManager, type UIManagerConfig, type UIOrigin } from './ui-manager.js';
export { UIInteractionManager, type UIInteractionEvent, type UIInteractionEventType, type UIInteractionCallback } from './ui-interaction.js';

// Components
export {
  // Canvas
  UICanvas,
  type UICanvasData,
  type UICanvasRenderMode,

  // Block
  UIBlock,
  type UIBlockData,
  type UIAnchor,
  type UIPivot,
  type UIContentDirection,
  type UIJustifyContent,
  type UIAlignItems,
  type UIPadding,
  uiBlockDataToOptions,
  getAnchorOffset,
  getPivotOffset,

  // Text
  UIText,
  type UITextData,
  type UITextAlign,
  type UIWhiteSpace,
  type UIBestFit,
  uiTextDataToOptions,

  // Button
  UIButton,
  type UIButtonData,
  type UIButtonState,
  uiButtonDataToOptions,
  getButtonBackgroundColor,
} from './components/index.js';

// Systems
export {
  uiCanvasSyncSystem,
  uiBlockSyncSystem,
  uiTextSyncSystem,
  uiButtonSyncSystem,
  uiUpdateSystem,
  uiRenderSystem,
  uiCleanupSystem,
} from './ui-systems.js';
