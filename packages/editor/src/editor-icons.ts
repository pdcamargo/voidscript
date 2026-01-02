/**
 * EditorIcons - Font Awesome 7 icon unicode constants
 *
 * These constants are used with the Font Awesome 7 Free Solid font.
 * Use with EditorFonts.pushIcon() to render icons.
 *
 * @example
 * ```typescript
 * EditorFonts.pushIcon();
 * ImGui.Text(EditorIcons.PLAY);
 * EditorFonts.pop();
 * ```
 */
export class EditorIcons {
  // ============================================================================
  // Play Controls
  // ============================================================================

  /** Play icon (solid right-pointing triangle) */
  static readonly PLAY = '\uf04b';

  /** Stop icon (solid square) */
  static readonly STOP = '\uf04d';

  /** Step forward icon (skip to next) */
  static readonly STEP_FORWARD = '\uf051';

  // ============================================================================
  // Window Controls
  // ============================================================================

  /** Window minimize icon (horizontal line at bottom) */
  static readonly WINDOW_MINIMIZE = '\uf2d1';

  /** Window maximize icon (expand arrows) */
  static readonly WINDOW_MAXIMIZE = '\uf065';

  /** Window restore icon (overlapping squares) */
  static readonly WINDOW_RESTORE = '\uf2d2';

  /** Close icon (X mark) */
  static readonly CLOSE = '\uf00d';

  /** Expand/fullscreen icon (used for macOS green button) */
  static readonly EXPAND = '\uf424';

  // ============================================================================
  // Miscellaneous
  // ============================================================================

  /** Square icon (placeholder) */
  static readonly SQUARE = '\uf0c8';

  /** Minus icon (for minimize in traffic lights) */
  static readonly MINUS = '\uf068';
}
