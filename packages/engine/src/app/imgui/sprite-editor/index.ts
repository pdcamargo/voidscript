/**
 * Sprite Editor Module
 *
 * Unity-style visual sprite region editor for texture atlases.
 *
 * Note: Mouse-based interaction was removed because jsimgui doesn't support
 * GetCursorScreenPos(), GetItemRectMin(), or GetWindowPos() which are needed
 * for reliable coordinate conversion. Sprite creation is done via form inputs.
 */

export {
  renderSpriteEditorPanel,
  isSpriteEditorOpen,
  openSpriteEditor,
  closeSpriteEditor,
  toggleSpriteEditor,
} from './sprite-editor-panel.js';
export type { SpriteEditorPanelOptions } from './sprite-editor-panel.js';

export {
  getSpriteEditorState,
  selectTexture,
  selectSprite,
  markDirty,
  markClean,
  type SpriteEditorState,
} from './sprite-editor-state.js';
