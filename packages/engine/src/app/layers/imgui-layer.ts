/**
 * ImGuiLayer - Built-in layer for ImGui rendering
 *
 * This overlay layer handles ImGui initialization, input, and rendering.
 * It should be added as an overlay so it renders on top and receives events first.
 *
 * @example
 * ```ts
 * // ImGuiLayer is automatically added by Application unless disabled
 * // To draw ImGui UI, override onImGuiRender in your layers:
 * class GameLayer extends Layer {
 *   override onImGuiRender(): void {
 *     ImGui.Begin('Game Menu');
 *     if (ImGui.Button('Start Game')) {
 *       this.startGame();
 *     }
 *     ImGui.End();
 *   }
 * }
 * ```
 */

import { Layer } from '../layer.js';
import { ImGui, ImGuiImplWeb, ImVec2, ImVec4 } from '@mori2003/jsimgui';
import type { AppEvent } from '../events.js';
import { EventType, EventDispatcher } from '../events.js';

/**
 * ImGui layer configuration options
 */
export interface ImGuiLayerConfig {
  /** Enable ImGui demo window (default: false) */
  enableDemos?: boolean;

  /** Enable docking support (default: true) */
  enableDocking?: boolean;

  /** Enable keyboard navigation (default: true) */
  enableKeyboardNav?: boolean;

  /** Block input events when ImGui wants them (default: true) */
  blockEvents?: boolean;

  /**
   * Enable INI settings persistence (default: true)
   * Uses localStorage with key 'imgui-ini'
   */
  enableIniPersistence?: boolean;

  /**
   * Custom storage key for INI settings (default: 'imgui-ini')
   */
  iniStorageKey?: string;

  /**
   * Custom font configuration
   * If provided, loads a custom TTF font from the specified URL
   */
  customFont?: {
    /** URL to the TTF font file (e.g., '/font.ttf') */
    url: string;
    /** Font size in pixels (default: 16) */
    size?: number;
  };

  /**
   * Theme to apply (default: 'default')
   * - 'default': Vanilla ImGui styling
   * - 'moonlight': Dark theme with rounded corners and soft colors
   */
  theme?: 'default' | 'moonlight' | 'dracula';
}

/**
 * ImGuiLayer - Handles ImGui initialization and rendering
 *
 * This layer is automatically added as an overlay by Application
 * unless ImGui is disabled in ApplicationConfig.
 */
/**
 * Set of keys that jsimgui's KEYBOARD_MAP handles.
 * Characters NOT in this set need to be manually forwarded to ImGui.
 */
const JSIMGUI_HANDLED_KEYS = new Set([
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  "'",
  ',',
  '-',
  '.',
  '/',
  ';',
  '=',
  '[',
  '\\',
  ']',
  '`',
  ' ',
  'Tab',
  'Enter',
  'Escape',
  'Backspace',
  'Delete',
  'Insert',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Control',
  'Shift',
  'Alt',
  'Super',
  'Meta',
  'CapsLock',
  'ScrollLock',
  'NumLock',
  'PrintScreen',
  'Pause',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',
  'F13',
  'F14',
  'F15',
  'F16',
  'F17',
  'F18',
  'F19',
  'F20',
  'F21',
  'F22',
  'F23',
  'F24',
  'Numpad0',
  'Numpad1',
  'Numpad2',
  'Numpad3',
  'Numpad4',
  'Numpad5',
  'Numpad6',
  'Numpad7',
  'Numpad8',
  'Numpad9',
  'NumpadDecimal',
  'NumpadDivide',
  'NumpadMultiply',
  'NumpadSubtract',
  'NumpadAdd',
  'NumpadEnter',
  'NumpadEqual',
]);

export class ImGuiLayer extends Layer {
  private initialized = false;
  private config: Required<ImGuiLayerConfig>;
  private blockEvents: boolean;
  private themeApplied = false;
  private currentPixelRatio = 1;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(config: ImGuiLayerConfig = {}) {
    super('ImGuiLayer');
    this.config = {
      enableDemos: config.enableDemos ?? false,
      enableDocking: config.enableDocking ?? true,
      enableKeyboardNav: config.enableKeyboardNav ?? true,
      blockEvents: config.blockEvents ?? true,
      enableIniPersistence: config.enableIniPersistence ?? true,
      iniStorageKey: config.iniStorageKey ?? 'imgui-ini',
      customFont: config.customFont ?? {
        url: '/font.ttf',
        size: 16,
      },
      theme: config.theme ?? 'default',
    };
    this.blockEvents = this.config.blockEvents;
  }

  /**
   * Initialize ImGui (async)
   */
  override async onAttach(): Promise<void> {
    const app = this.getApplication();
    const canvas = app.getWindow().getCanvas();

    // Set up INI persistence callbacks BEFORE Init (as required by jsimgui)
    if (this.config.enableIniPersistence) {
      const storageKey = this.config.iniStorageKey;

      ImGuiImplWeb.SetSaveIniSettingsFn((iniData: string) => {
        try {
          localStorage.setItem(storageKey, iniData);
        } catch (e) {
          console.warn('[ImGuiLayer] Failed to save INI settings:', e);
        }
      });

      ImGuiImplWeb.SetLoadIniSettingsFn(() => {
        try {
          return localStorage.getItem(storageKey) ?? '';
        } catch (e) {
          console.warn('[ImGuiLayer] Failed to load INI settings:', e);
          return '';
        }
      });
    }

    await ImGuiImplWeb.Init({
      canvas,
      enableDemos: this.config.enableDemos,
    });

    // Load custom font if provided
    if (this.config.customFont) {
      try {
        const fontUrl = this.config.customFont.url;
        const fontSize = this.config.customFont.size ?? 16;

        // Fetch font file as ArrayBuffer
        const fontBuf = await (await fetch(fontUrl)).arrayBuffer();

        // Load font data into ImGui's virtual filesystem
        const fontFileName = fontUrl.split('/').pop() || 'font.ttf';
        ImGuiImplWeb.LoadFont(fontFileName, new Uint8Array(fontBuf));

        // Add font to ImGui with specified size
        ImGui.GetIO().Fonts.AddFontFromFileTTF(fontFileName, fontSize);
      } catch (error) {
        console.error('[ImGuiLayer] Failed to load custom font:', error);
        // Continue with default font on error
      }
    }

    const io = ImGui.GetIO();

    // Enable docking
    if (this.config.enableDocking) {
      io.ConfigFlags |= ImGui.ConfigFlags.DockingEnable;
    }

    // Enable keyboard navigation
    if (this.config.enableKeyboardNav) {
      io.ConfigFlags |= ImGui.ConfigFlags.NavEnableKeyboard;
    }

    // Initialize pixel ratio from window.devicePixelRatio
    this.currentPixelRatio = window.devicePixelRatio ?? 1;

    // Setup supplementary keyboard handler for characters jsimgui misses
    // jsimgui's KEYBOARD_MAP doesn't include shifted characters like :, <, >, @, etc.
    // We add our own listener to catch these and forward them to ImGui
    this.keydownHandler = (e: KeyboardEvent) => {
      // Only process if ImGui wants text input and it's a single printable character
      if (!io.WantTextInput) return;
      if (e.key.length !== 1) return;

      // Skip keys that jsimgui already handles
      if (JSIMGUI_HANDLED_KEYS.has(e.key)) return;

      // Forward the character to ImGui
      io.AddInputCharactersUTF8(e.key);
    };
    canvas.addEventListener('keydown', this.keydownHandler);

    this.initialized = true;

    // Theme will be applied in beginFrame() on first render
    // to ensure ImGui's internal state is fully ready
  }

  /**
   * Cleanup ImGui
   */
  override onDetach(): void {
    if (this.initialized) {
      // Remove our supplementary keyboard handler
      if (this.keydownHandler) {
        const app = this.getApplication();
        const canvas = app.getWindow().getCanvas();
        canvas.removeEventListener('keydown', this.keydownHandler);
        this.keydownHandler = null;
      }

      // ImGuiImplWeb may not have a shutdown method in all versions
      if (
        'Shutdown' in ImGuiImplWeb &&
        typeof (ImGuiImplWeb as Record<string, unknown>)['Shutdown'] ===
          'function'
      ) {
        (ImGuiImplWeb as unknown as { Shutdown: () => void }).Shutdown();
      }
      this.initialized = false;
    }
  }

  /**
   * Update ImGui display size when canvas/window resizes
   * This ensures ImGui knows the correct display dimensions after DPI changes
   * @internal
   */
  updateDisplaySize(
    width: number,
    height: number,
    pixelRatio: number = 1,
  ): void {
    // Store pixel ratio for use in beginFrame()
    // We must set DisplayFramebufferScale AFTER BeginRender() because
    // jsimgui's BeginRender() overwrites DisplaySize but not DisplayFramebufferScale
    this.currentPixelRatio = pixelRatio;

    if (!this.initialized) return;

    const io = ImGui.GetIO();
    io.DisplaySize.x = width;
    io.DisplaySize.y = height;

    // Set framebuffer scale for Retina/HiDPI displays
    // This tells ImGui the relationship between CSS pixels and device pixels
    io.DisplayFramebufferScale.x = pixelRatio;
    io.DisplayFramebufferScale.y = pixelRatio;
  }

  /**
   * Begin ImGui frame - called at start of ImGui render phase
   * @internal
   */
  beginFrame(): void {
    if (this.initialized) {
      ImGuiImplWeb.BeginRender();

      // Apply theme on first frame after BeginRender
      // This ensures ImGui's internal state is fully initialized
      if (!this.themeApplied) {
        this.applyTheme(this.config.theme);
        this.themeApplied = true;
      }
    }

    if (this.config.enableDemos) {
      ImGui.ShowDemoWindow();
    }
  }

  /**
   * End ImGui frame - called at end of ImGui render phase
   * @internal
   */
  endFrame(): void {
    if (this.initialized) {
      ImGuiImplWeb.EndRender();
    }
  }

  /**
   * Handle events - block events when ImGui wants input
   */
  override onEvent(event: AppEvent): boolean {
    if (!this.initialized || !this.blockEvents) {
      return false;
    }

    const io = ImGui.GetIO();
    const dispatcher = new EventDispatcher(event);

    // Block keyboard events if ImGui wants keyboard input
    dispatcher.dispatch(EventType.KeyPressed, () => io.WantCaptureKeyboard);
    dispatcher.dispatch(EventType.KeyReleased, () => io.WantCaptureKeyboard);
    dispatcher.dispatch(EventType.KeyTyped, () => io.WantCaptureKeyboard);

    // Block mouse events if ImGui wants mouse input
    dispatcher.dispatch(
      EventType.MouseButtonPressed,
      () => io.WantCaptureMouse,
    );
    dispatcher.dispatch(
      EventType.MouseButtonReleased,
      () => io.WantCaptureMouse,
    );
    dispatcher.dispatch(EventType.MouseMoved, () => io.WantCaptureMouse);
    dispatcher.dispatch(EventType.MouseScrolled, () => io.WantCaptureMouse);

    return event.handled;
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Set whether ImGui should block events when focused
   */
  setBlockEvents(block: boolean): void {
    this.blockEvents = block;
  }

  /**
   * Check if event blocking is enabled
   */
  isBlockingEvents(): boolean {
    return this.blockEvents;
  }

  /**
   * Check if ImGui is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ============================================================================
  // ImGui State Queries
  // ============================================================================

  /**
   * Check if ImGui wants keyboard input
   */
  wantsKeyboard(): boolean {
    if (!this.initialized) return false;
    return ImGui.GetIO().WantCaptureKeyboard;
  }

  /**
   * Check if ImGui wants mouse input
   */
  wantsMouse(): boolean {
    if (!this.initialized) return false;
    return ImGui.GetIO().WantCaptureMouse;
  }

  /**
   * Check if ImGui wants text input
   */
  wantsTextInput(): boolean {
    if (!this.initialized) return false;
    return ImGui.GetIO().WantTextInput;
  }

  /**
   * Check if any ImGui window is focused
   */
  isAnyWindowFocused(): boolean {
    if (!this.initialized) return false;
    return ImGui.IsWindowFocused(ImGui.FocusedFlags.AnyWindow);
  }

  /**
   * Check if any ImGui window is hovered
   */
  isAnyWindowHovered(): boolean {
    if (!this.initialized) return false;
    return ImGui.IsWindowHovered(ImGui.HoveredFlags.AnyWindow);
  }

  // ============================================================================
  // Style Configuration
  // ============================================================================

  /**
   * Set ImGui color scheme to dark
   */
  setDarkColors(): void {
    if (!this.initialized) return;
    ImGui.StyleColorsDark();
  }

  /**
   * Set ImGui color scheme to light
   */
  setLightColors(): void {
    if (!this.initialized) return;
    ImGui.StyleColorsLight();
  }

  /**
   * Set ImGui color scheme to classic
   */
  setClassicColors(): void {
    if (!this.initialized) return;
    ImGui.StyleColorsClassic();
  }

  /**
   * Get ImGui style for customization
   */
  getStyle(): ReturnType<typeof ImGui.GetStyle> | null {
    if (!this.initialized) return null;
    return ImGui.GetStyle();
  }

  /**
   * Scale UI for high-DPI displays
   */
  setScale(scale: number): void {
    if (!this.initialized) return;
    const style = ImGui.GetStyle();
    style.ScaleAllSizes(scale);
  }

  /**
   * Apply a theme to ImGui
   */
  private applyTheme(theme: 'default' | 'moonlight' | 'dracula'): void {
    if (theme === 'moonlight') {
      this.applyMoonlightTheme();
    } else if (theme === 'dracula') {
      this.applyDraculaTheme();
    }
    // 'default' theme uses vanilla ImGui styling (no action needed)
  }

  /**
   * Apply the Moonlight theme
   */
  private applyMoonlightTheme(): void {
    const style = ImGui.GetStyle();

    // Style settings
    style.Alpha = 1.0;
    style.DisabledAlpha = 1.0;
    style.WindowPadding.x = 12.0;
    style.WindowPadding.y = 12.0;
    style.WindowRounding = 11.5;
    style.WindowBorderSize = 0.0;
    style.WindowMinSize.x = 20.0;
    style.WindowMinSize.y = 20.0;
    style.WindowTitleAlign.x = 0.5;
    style.WindowTitleAlign.y = 0.5;
    style.WindowMenuButtonPosition = ImGui.Dir._Right;
    style.ChildRounding = 0.0;
    style.ChildBorderSize = 1.0;
    style.PopupRounding = 0.0;
    style.PopupBorderSize = 1.0;
    style.FramePadding.x = 20.0;
    style.FramePadding.y = 3.4;
    style.FrameRounding = 11.9;
    style.FrameBorderSize = 0.0;
    style.ItemSpacing.x = 4.3;
    style.ItemSpacing.y = 5.5;
    style.ItemInnerSpacing.x = 7.1;
    style.ItemInnerSpacing.y = 1.8;
    style.CellPadding.x = 12.1;
    style.CellPadding.y = 9.2;
    style.IndentSpacing = 21.0;
    style.ColumnsMinSpacing = 4.9;
    style.ScrollbarSize = 11.6;
    style.ScrollbarRounding = 15.9;
    style.GrabMinSize = 3.7;
    style.GrabRounding = 20.0;
    style.TabRounding = 0.0;
    style.TabBorderSize = 0.0;
    style.ColorButtonPosition = ImGui.Dir._Right;
    style.ButtonTextAlign.x = 0.5;
    style.ButtonTextAlign.y = 0.5;
    style.SelectableTextAlign.x = 0.0;
    style.SelectableTextAlign.y = 0.0;

    // Colors
    const colors = style.Colors;
    colors[ImGui.Col.Text] = new ImVec4(1.0, 1.0, 1.0, 1.0);
    colors[ImGui.Col.TextDisabled] = new ImVec4(
      0.2745098173618317,
      0.3176470696926117,
      0.4509803950786591,
      1.0,
    );
    colors[ImGui.Col.WindowBg] = new ImVec4(
      0.0784313753247261,
      0.08627451211214066,
      0.1019607856869698,
      1.0,
    );
    colors[ImGui.Col.ChildBg] = new ImVec4(
      0.09250493347644806,
      0.100297249853611,
      0.1158798336982727,
      1.0,
    );
    colors[ImGui.Col.PopupBg] = new ImVec4(
      0.0784313753247261,
      0.08627451211214066,
      0.1019607856869698,
      1.0,
    );
    colors[ImGui.Col.Border] = new ImVec4(
      0.1568627506494522,
      0.168627455830574,
      0.1921568661928177,
      1.0,
    );
    colors[ImGui.Col.BorderShadow] = new ImVec4(
      0.0784313753247261,
      0.08627451211214066,
      0.1019607856869698,
      1.0,
    );
    colors[ImGui.Col.FrameBg] = new ImVec4(
      0.1120669096708298,
      0.1262156516313553,
      0.1545064449310303,
      1.0,
    );
    colors[ImGui.Col.FrameBgHovered] = new ImVec4(
      0.1568627506494522,
      0.168627455830574,
      0.1921568661928177,
      1.0,
    );
    colors[ImGui.Col.FrameBgActive] = new ImVec4(
      0.1568627506494522,
      0.168627455830574,
      0.1921568661928177,
      1.0,
    );
    colors[ImGui.Col.TitleBg] = new ImVec4(
      0.0470588244497776,
      0.05490196123719215,
      0.07058823853731155,
      1.0,
    );
    colors[ImGui.Col.TitleBgActive] = new ImVec4(
      0.0470588244497776,
      0.05490196123719215,
      0.07058823853731155,
      1.0,
    );
    colors[ImGui.Col.TitleBgCollapsed] = new ImVec4(
      0.0784313753247261,
      0.08627451211214066,
      0.1019607856869698,
      1.0,
    );
    colors[ImGui.Col.MenuBarBg] = new ImVec4(
      0.09803921729326248,
      0.105882354080677,
      0.1215686276555061,
      1.0,
    );
    colors[ImGui.Col.ScrollbarBg] = new ImVec4(
      0.0470588244497776,
      0.05490196123719215,
      0.07058823853731155,
      1.0,
    );
    colors[ImGui.Col.ScrollbarGrab] = new ImVec4(
      0.1176470592617989,
      0.1333333402872086,
      0.1490196138620377,
      1.0,
    );
    colors[ImGui.Col.ScrollbarGrabHovered] = new ImVec4(
      0.1568627506494522,
      0.168627455830574,
      0.1921568661928177,
      1.0,
    );
    colors[ImGui.Col.ScrollbarGrabActive] = new ImVec4(
      0.1176470592617989,
      0.1333333402872086,
      0.1490196138620377,
      1.0,
    );
    colors[ImGui.Col.CheckMark] = new ImVec4(
      0.9725490212440491,
      1.0,
      0.4980392158031464,
      1.0,
    );
    colors[ImGui.Col.SliderGrab] = new ImVec4(
      0.971993625164032,
      1.0,
      0.4980392456054688,
      1.0,
    );
    colors[ImGui.Col.SliderGrabActive] = new ImVec4(
      1.0,
      0.7953379154205322,
      0.4980392456054688,
      1.0,
    );
    colors[ImGui.Col.Button] = new ImVec4(
      0.1176470592617989,
      0.1333333402872086,
      0.1490196138620377,
      1.0,
    );
    colors[ImGui.Col.ButtonHovered] = new ImVec4(
      0.1821731775999069,
      0.1897992044687271,
      0.1974248886108398,
      1.0,
    );
    colors[ImGui.Col.ButtonActive] = new ImVec4(
      0.1545050293207169,
      0.1545048952102661,
      0.1545064449310303,
      1.0,
    );
    colors[ImGui.Col.Header] = new ImVec4(
      0.1414651423692703,
      0.1629818230867386,
      0.2060086131095886,
      1.0,
    );
    colors[ImGui.Col.HeaderHovered] = new ImVec4(
      0.1072951927781105,
      0.107295036315918,
      0.1072961091995239,
      1.0,
    );
    colors[ImGui.Col.HeaderActive] = new ImVec4(
      0.0784313753247261,
      0.08627451211214066,
      0.1019607856869698,
      1.0,
    );
    colors[ImGui.Col.Separator] = new ImVec4(
      0.1293079704046249,
      0.1479243338108063,
      0.1931330561637878,
      1.0,
    );
    colors[ImGui.Col.SeparatorHovered] = new ImVec4(
      0.1568627506494522,
      0.1843137294054031,
      0.250980406999588,
      1.0,
    );
    colors[ImGui.Col.SeparatorActive] = new ImVec4(
      0.1568627506494522,
      0.1843137294054031,
      0.250980406999588,
      1.0,
    );
    colors[ImGui.Col.ResizeGrip] = new ImVec4(
      0.1459212601184845,
      0.145922005176544,
      0.1459227204322815,
      1.0,
    );
    colors[ImGui.Col.ResizeGripHovered] = new ImVec4(
      0.9725490212440491,
      1.0,
      0.4980392158031464,
      1.0,
    );
    colors[ImGui.Col.ResizeGripActive] = new ImVec4(
      0.999999463558197,
      1.0,
      0.9999899864196777,
      1.0,
    );
    colors[ImGui.Col.Tab] = new ImVec4(
      0.0784313753247261,
      0.08627451211214066,
      0.1019607856869698,
      1.0,
    );
    colors[ImGui.Col.TabHovered] = new ImVec4(
      0.1176470592617989,
      0.1333333402872086,
      0.1490196138620377,
      1.0,
    );
    colors[ImGui.Col.TabSelected] = new ImVec4(
      0.1176470592617989,
      0.1333333402872086,
      0.1490196138620377,
      1.0,
    );
    colors[ImGui.Col.TabDimmed] = new ImVec4(
      0.0784313753247261,
      0.08627451211214066,
      0.1019607856869698,
      1.0,
    );
    colors[ImGui.Col.TabDimmedSelected] = new ImVec4(
      0.1249424293637276,
      0.2735691666603088,
      0.5708154439926147,
      1.0,
    );
    colors[ImGui.Col.PlotLines] = new ImVec4(
      0.5215686559677124,
      0.6000000238418579,
      0.7019608020782471,
      1.0,
    );
    colors[ImGui.Col.PlotLinesHovered] = new ImVec4(
      0.03921568766236305,
      0.9803921580314636,
      0.9803921580314636,
      1.0,
    );
    colors[ImGui.Col.PlotHistogram] = new ImVec4(
      0.8841201663017273,
      0.7941429018974304,
      0.5615870356559753,
      1.0,
    );
    colors[ImGui.Col.PlotHistogramHovered] = new ImVec4(
      0.9570815563201904,
      0.9570719599723816,
      0.9570761322975159,
      1.0,
    );
    colors[ImGui.Col.TableHeaderBg] = new ImVec4(
      0.0470588244497776,
      0.05490196123719215,
      0.07058823853731155,
      1.0,
    );
    colors[ImGui.Col.TableBorderStrong] = new ImVec4(
      0.0470588244497776,
      0.05490196123719215,
      0.07058823853731155,
      1.0,
    );
    colors[ImGui.Col.TableBorderLight] = new ImVec4(0.0, 0.0, 0.0, 1.0);
    colors[ImGui.Col.TableRowBg] = new ImVec4(
      0.1176470592617989,
      0.1333333402872086,
      0.1490196138620377,
      1.0,
    );
    colors[ImGui.Col.TableRowBgAlt] = new ImVec4(
      0.09803921729326248,
      0.105882354080677,
      0.1215686276555061,
      1.0,
    );
    colors[ImGui.Col.TextSelectedBg] = new ImVec4(
      0.9356134533882141,
      0.9356129765510559,
      0.9356223344802856,
      1.0,
    );
    colors[ImGui.Col.DragDropTarget] = new ImVec4(
      0.4980392158031464,
      0.5137255191802979,
      1.0,
      1.0,
    );
    colors[ImGui.Col.NavCursor] = new ImVec4(
      0.266094446182251,
      0.2890366911888123,
      1.0,
      1.0,
    );
    colors[ImGui.Col.NavWindowingHighlight] = new ImVec4(
      0.4980392158031464,
      0.5137255191802979,
      1.0,
      1.0,
    );
    colors[ImGui.Col.NavWindowingDimBg] = new ImVec4(
      0.196078434586525,
      0.1764705926179886,
      0.5450980663299561,
      0.501960813999176,
    );
    colors[ImGui.Col.ModalWindowDimBg] = new ImVec4(
      0.196078434586525,
      0.1764705926179886,
      0.5450980663299561,
      0.501960813999176,
    );

    // Set the modified colors array back
    style.Colors = colors;
  }

  private applyDraculaTheme(): void {
    const bg = new ImVec4(0.16, 0.16, 0.21, 1.0);
    const bg_alt = new ImVec4(0.27, 0.28, 0.35, 1.0);
    const fg = new ImVec4(0.97, 0.97, 0.95, 1.0);
    const purple = new ImVec4(0.74, 0.58, 0.98, 1.0);
    const pink = new ImVec4(1.0, 0.47, 0.78, 1.0);
    const cyan = new ImVec4(0.55, 0.91, 0.99, 1.0);

    const style = ImGui.GetStyle();

    // Style settings
    style.Alpha = 1.0;
    style.DisabledAlpha = 1.0;
    style.WindowPadding = new ImVec2(12.0, 12.0);
    style.WindowRounding = 11.5;
    style.WindowBorderSize = 0.0;
    style.WindowMinSize = new ImVec2(20.0, 20.0);
    style.WindowTitleAlign = new ImVec2(0.5, 0.5);
    style.WindowMenuButtonPosition = ImGui.Dir._Right;
    style.ChildRounding = 0.0;
    style.ChildBorderSize = 1.0;
    style.PopupRounding = 0.0;
    style.PopupBorderSize = 1.0;
    style.FramePadding = new ImVec2(20.0, 3.4);
    style.FrameRounding = 11.9;
    style.FrameBorderSize = 0.0;
    style.ItemSpacing = new ImVec2(4.3, 5.5);
    style.ItemInnerSpacing = new ImVec2(7.1, 1.8);
    style.CellPadding = new ImVec2(12.1, 9.2);
    style.IndentSpacing = 21.0;
    style.ColumnsMinSpacing = 4.9;
    style.ScrollbarSize = 11.6;
    style.ScrollbarRounding = 15.9;
    style.GrabMinSize = 3.7;
    style.GrabRounding = 20.0;
    style.TabRounding = 0.0;
    style.TabBorderSize = 0.0;
    style.ColorButtonPosition = ImGui.Dir._Right;
    style.ButtonTextAlign = new ImVec2(0.5, 0.5);
    style.SelectableTextAlign = new ImVec2(0.0, 0.0);

    // Get the colors array, modify it, and set it back
    const colors = style.Colors;

    // Window
    colors[ImGui.Col.WindowBg] = bg;
    colors[ImGui.Col.ChildBg] = bg_alt;
    colors[ImGui.Col.PopupBg] = bg_alt;

    // Text
    colors[ImGui.Col.Text] = fg;
    colors[ImGui.Col.TextDisabled] = new ImVec4(fg.x, fg.y, fg.z, 0.58);

    // Headers
    colors[ImGui.Col.Header] = purple;
    colors[ImGui.Col.HeaderHovered] = pink;
    colors[ImGui.Col.HeaderActive] = purple;

    // Buttons
    colors[ImGui.Col.Button] = bg_alt;
    colors[ImGui.Col.ButtonHovered] = purple;
    colors[ImGui.Col.ButtonActive] = pink;

    // Frame background (inputs, sliders)
    colors[ImGui.Col.FrameBg] = bg_alt;
    colors[ImGui.Col.FrameBgHovered] = purple;
    colors[ImGui.Col.FrameBgActive] = pink;

    // Tabs
    colors[ImGui.Col.Tab] = bg_alt;
    colors[ImGui.Col.TabHovered] = purple;
    colors[ImGui.Col.TabSelected] = pink;

    // Title
    colors[ImGui.Col.TitleBg] = bg_alt;
    colors[ImGui.Col.TitleBgActive] = bg_alt;
    colors[ImGui.Col.TitleBgCollapsed] = bg;

    // Borders
    colors[ImGui.Col.Border] = new ImVec4(0.31, 0.33, 0.44, 1.0);
    colors[ImGui.Col.Separator] = new ImVec4(0.31, 0.33, 0.44, 1.0);

    // Misc accents
    colors[ImGui.Col.CheckMark] = cyan;
    colors[ImGui.Col.SliderGrab] = purple;
    colors[ImGui.Col.SliderGrabActive] = pink;
    colors[ImGui.Col.ResizeGrip] = bg_alt;
    colors[ImGui.Col.ResizeGripHovered] = purple;
    colors[ImGui.Col.ResizeGripActive] = pink;

    // Set the modified colors array back
    style.Colors = colors;
  }
}

// Re-export ImGui for convenience
export { ImGui, ImGuiImplWeb, ImVec2, ImVec4 };
