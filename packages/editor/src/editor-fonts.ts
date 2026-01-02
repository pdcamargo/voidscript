/**
 * EditorFonts - Font management for VoidScript Editor
 *
 * Handles loading and switching between fonts in ImGui.
 * The editor uses Roboto as the main font and Font Awesome 7 for icons.
 *
 * Font loading must happen before ImGui is fully initialized.
 * Call EditorFonts.loadFonts() during EditorApplication.initialize().
 *
 * @example
 * ```typescript
 * // During initialization
 * await EditorFonts.loadFonts('/fonts/Roboto-Medium.ttf', '/fonts/fa-solid-900.otf');
 *
 * // During rendering
 * EditorFonts.pushIcon();
 * ImGui.Text(EditorIcons.PLAY);
 * EditorFonts.pop();
 * ```
 */

import { ImGui, ImGuiImplWeb, ImFontConfig } from '@voidscript/imgui';
import type { ImFont } from '@voidscript/imgui';

// Font sizes in pixels
const MAIN_FONT_SIZE = 14;
const ICON_FONT_SIZE = 14;
const ICON_SMALL_SIZE = 10;
const ICON_LARGE_SIZE = 18;

// Font Awesome 7 glyph range (solid icons are in Private Use Area)
const FA7_GLYPH_RANGE = [0xf000, 0xf8ff, 0];

/**
 * Static class for managing editor fonts
 */
export class EditorFonts {
  // Font size constants
  static readonly MAIN_FONT_SIZE = MAIN_FONT_SIZE;
  static readonly ICON_FONT_SIZE = ICON_FONT_SIZE;
  static readonly ICON_SMALL_SIZE = ICON_SMALL_SIZE;
  static readonly ICON_LARGE_SIZE = ICON_LARGE_SIZE;

  // Font references
  private static _mainFont: ImFont | null = null;
  private static _iconFont: ImFont | null = null;
  private static _iconSmallFont: ImFont | null = null;
  private static _iconLargeFont: ImFont | null = null;

  // Track if we pushed a font
  private static _fontPushed = false;

  // Track if fonts are loaded
  private static _loaded = false;

  /**
   * Load fonts from URLs and register them with ImGui.
   * Must be called before ImGui.NewFrame() is called for the first time.
   *
   * @param mainFontUrl - URL to the main TTF font file (e.g., Roboto)
   * @param iconFontUrl - URL to the icon font file (e.g., Font Awesome OTF)
   */
  static async loadFonts(
    mainFontUrl: string,
    iconFontUrl: string,
  ): Promise<void> {
    if (this._loaded) {
      console.warn('[EditorFonts] Fonts already loaded');
      return;
    }

    try {
      // Fetch both fonts in parallel
      const [mainFontBuf, iconFontBuf] = await Promise.all([
        fetch(mainFontUrl).then((r) => r.arrayBuffer()),
        fetch(iconFontUrl).then((r) => r.arrayBuffer()),
      ]);

      // Extract filenames
      const mainFontFileName = mainFontUrl.split('/').pop() || 'main-font.ttf';
      const iconFontFileName = iconFontUrl.split('/').pop() || 'icon-font.otf';

      // Load font data into ImGui's virtual filesystem
      ImGuiImplWeb.LoadFont(mainFontFileName, new Uint8Array(mainFontBuf));
      ImGuiImplWeb.LoadFont(iconFontFileName, new Uint8Array(iconFontBuf));

      const io = ImGui.GetIO();

      // Helper to create font config for merging
      const createMergeConfig = (): InstanceType<typeof ImFontConfig> => {
        const cfg = ImFontConfig.New();
        cfg.RasterizerDensity = 1.0;
        cfg.RasterizerMultiply = 1.0;
        cfg.FontDataOwnedByAtlas = true;
        cfg.MergeMode = true;
        return cfg;
      };

      // Helper to create font config without merging
      const createNonMergeConfig = (): InstanceType<typeof ImFontConfig> => {
        const cfg = ImFontConfig.New();
        cfg.RasterizerDensity = 1.0;
        cfg.RasterizerMultiply = 1.0;
        cfg.FontDataOwnedByAtlas = true;
        cfg.MergeMode = false;
        return cfg;
      };

      // Add main font at default size
      this._mainFont = io.Fonts.AddFontFromFileTTF(
        mainFontFileName,
        MAIN_FONT_SIZE,
      );

      // Merge icons into main font
      const mainMergeConfig = createMergeConfig();
      io.Fonts.AddFontFromFileTTF(
        iconFontFileName,
        ICON_FONT_SIZE,
        mainMergeConfig,
        FA7_GLYPH_RANGE,
      );
      mainMergeConfig.Drop();

      // Create icon-only font at regular size (for when we need icons without text baseline issues)
      const iconConfig = createNonMergeConfig();
      this._iconFont = io.Fonts.AddFontFromFileTTF(
        mainFontFileName,
        ICON_FONT_SIZE,
        iconConfig,
        null,
      );
      iconConfig.Drop();

      const iconMergeConfig = createMergeConfig();
      io.Fonts.AddFontFromFileTTF(
        iconFontFileName,
        ICON_FONT_SIZE,
        iconMergeConfig,
        FA7_GLYPH_RANGE,
      );
      iconMergeConfig.Drop();

      // Create smaller icon font for traffic lights and small buttons
      const smallConfig = createNonMergeConfig();
      this._iconSmallFont = io.Fonts.AddFontFromFileTTF(
        mainFontFileName,
        ICON_SMALL_SIZE,
        smallConfig,
        null,
      );
      smallConfig.Drop();

      const smallMergeConfig = createMergeConfig();
      io.Fonts.AddFontFromFileTTF(
        iconFontFileName,
        ICON_SMALL_SIZE,
        smallMergeConfig,
        FA7_GLYPH_RANGE,
      );
      smallMergeConfig.Drop();

      // Create larger icon font for toolbar buttons
      const largeConfig = createNonMergeConfig();
      this._iconLargeFont = io.Fonts.AddFontFromFileTTF(
        mainFontFileName,
        ICON_LARGE_SIZE,
        largeConfig,
        null,
      );
      largeConfig.Drop();

      const largeMergeConfig = createMergeConfig();
      io.Fonts.AddFontFromFileTTF(
        iconFontFileName,
        ICON_LARGE_SIZE,
        largeMergeConfig,
        FA7_GLYPH_RANGE,
      );
      largeMergeConfig.Drop();

      this._loaded = true;
      console.log(
        `[EditorFonts] Loaded fonts: main=${MAIN_FONT_SIZE}px, icon=${ICON_FONT_SIZE}px, iconSmall=${ICON_SMALL_SIZE}px, iconLarge=${ICON_LARGE_SIZE}px`,
      );
    } catch (error) {
      console.error('[EditorFonts] Failed to load fonts:', error);
      throw error;
    }
  }

  /**
   * Get the main font reference
   */
  static get mainFont(): ImFont | null {
    return this._mainFont;
  }

  /**
   * Get the icon font reference
   */
  static get iconFont(): ImFont | null {
    return this._iconFont;
  }

  /**
   * Get the small icon font reference
   */
  static get iconSmallFont(): ImFont | null {
    return this._iconSmallFont;
  }

  /**
   * Get the large icon font reference
   */
  static get iconLargeFont(): ImFont | null {
    return this._iconLargeFont;
  }

  /**
   * Check if fonts are loaded
   */
  static isLoaded(): boolean {
    return this._loaded;
  }

  /**
   * Push the icon font onto the stack
   * @returns true if font was pushed, false if not available
   */
  static pushIcon(): boolean {
    if (this._iconFont) {
      ImGui.PushFontFloat(this._iconFont, ICON_FONT_SIZE);
      this._fontPushed = true;
      return true;
    }
    this._fontPushed = false;
    return false;
  }

  /**
   * Push the small icon font onto the stack (for traffic lights, etc.)
   * @returns true if font was pushed, false if not available
   */
  static pushIconSmall(): boolean {
    if (this._iconSmallFont) {
      ImGui.PushFontFloat(this._iconSmallFont, ICON_SMALL_SIZE);
      this._fontPushed = true;
      return true;
    }
    this._fontPushed = false;
    return false;
  }

  /**
   * Push the large icon font onto the stack
   * @returns true if font was pushed, false if not available
   */
  static pushIconLarge(): boolean {
    if (this._iconLargeFont) {
      ImGui.PushFontFloat(this._iconLargeFont, ICON_LARGE_SIZE);
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
}
