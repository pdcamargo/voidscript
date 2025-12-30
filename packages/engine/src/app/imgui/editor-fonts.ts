/**
 * Editor Fonts - Multi-size font management for ImGui
 *
 * Provides pre-loaded fonts at different sizes for use throughout the editor.
 * Each font size includes both the main font and merged icon glyphs.
 *
 * Usage:
 * ```typescript
 * import { EditorFonts, ImGui } from '@voidscript/engine';
 *
 * // Push a larger font for icons
 * EditorFonts.pushIconMedium();
 * ImGui.Button(EDITOR_ICONS.PLAY);
 * EditorFonts.pop();
 *
 * // Or use the font directly
 * ImGui.PushFontFloat(EditorFonts.iconBig, EditorFonts.ICON_BIG_SIZE);
 * ImGui.Text(EDITOR_ICONS.SETTINGS);
 * ImGui.PopFont();
 * ```
 */

import type { ImFont } from '@mori2003/jsimgui';
import { ImGui } from '@mori2003/jsimgui';

// Font sizes in pixels
export const ICON_SMALL_SIZE = 16;
export const ICON_MEDIUM_SIZE = 28;
export const ICON_BIG_SIZE = 48;

/**
 * Editor fonts container - holds references to fonts at different sizes
 */
export class EditorFonts {
  // Font size constants
  static readonly ICON_SMALL_SIZE = ICON_SMALL_SIZE;
  static readonly ICON_MEDIUM_SIZE = ICON_MEDIUM_SIZE;
  static readonly ICON_BIG_SIZE = ICON_BIG_SIZE;

  // Font references (set during ImGuiLayer initialization)
  private static _iconSmall: ImFont | null = null;
  private static _iconMedium: ImFont | null = null;
  private static _iconBig: ImFont | null = null;

  /**
   * Get the small icon font (14px)
   */
  static get iconSmall(): ImFont | null {
    return this._iconSmall;
  }

  /**
   * Get the medium icon font (18px)
   */
  static get iconMedium(): ImFont | null {
    return this._iconMedium;
  }

  /**
   * Get the big icon font (24px)
   */
  static get iconBig(): ImFont | null {
    return this._iconBig;
  }

  // Track if we pushed a font (to avoid mismatched push/pop)
  private static _fontPushed = false;

  /**
   * Push the small icon font onto the font stack
   * @returns true if font was pushed, false if not available
   */
  static pushIconSmall(): boolean {
    if (this._iconSmall) {
      ImGui.PushFontFloat(this._iconSmall, ICON_SMALL_SIZE);
      this._fontPushed = true;
      return true;
    }
    this._fontPushed = false;
    return false;
  }

  /**
   * Push the medium icon font onto the font stack
   * @returns true if font was pushed, false if not available
   */
  static pushIconMedium(): boolean {
    if (this._iconMedium) {
      ImGui.PushFontFloat(this._iconMedium, ICON_MEDIUM_SIZE);
      this._fontPushed = true;
      return true;
    }
    this._fontPushed = false;
    return false;
  }

  /**
   * Push the big icon font onto the font stack
   * @returns true if font was pushed, false if not available
   */
  static pushIconBig(): boolean {
    if (this._iconBig) {
      ImGui.PushFontFloat(this._iconBig, ICON_BIG_SIZE);
      this._fontPushed = true;
      return true;
    }
    this._fontPushed = false;
    return false;
  }

  /**
   * Pop the current font from the stack (only if a font was pushed)
   */
  static pop(): void {
    if (this._fontPushed) {
      ImGui.PopFont();
      this._fontPushed = false;
    }
  }

  /**
   * @internal - Set by ImGuiLayer during initialization
   */
  static _setFonts(
    iconSmall: ImFont | null,
    iconMedium: ImFont | null,
    iconBig: ImFont | null,
  ): void {
    this._iconSmall = iconSmall;
    this._iconMedium = iconMedium;
    this._iconBig = iconBig;
  }

  /**
   * Check if fonts are initialized
   */
  static isInitialized(): boolean {
    return this._iconSmall !== null && this._iconMedium !== null && this._iconBig !== null;
  }
}
