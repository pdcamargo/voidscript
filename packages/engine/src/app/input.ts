/**
 * Input - Polling-based input state management
 *
 * Provides immediate input state queries (is key pressed right now?)
 * Complementary to the event-based system for frame-based logic.
 *
 * @example
 * ```ts
 * // In your update loop
 * if (Input.isKeyPressed(KeyCode.Space)) {
 *   player.jump();
 * }
 *
 * if (Input.isKeyJustPressed(KeyCode.KeyE)) {
 *   player.interact();
 * }
 *
 * const { x, y } = Input.getMousePosition();
 * ```
 */

/**
 * Mouse button constants
 */
export enum MouseButton {
  Left = 0,
  Middle = 1,
  Right = 2,
  Button4 = 3,
  Button5 = 4,
}

/**
 * Keyboard key codes (maps to KeyboardEvent.code)
 */
export enum KeyCode {
  // Common keys
  Space = "Space",
  Enter = "Enter",
  Escape = "Escape",
  Tab = "Tab",
  Backspace = "Backspace",
  Delete = "Delete",
  Insert = "Insert",
  Home = "Home",
  End = "End",
  PageUp = "PageUp",
  PageDown = "PageDown",

  // Arrow keys
  ArrowUp = "ArrowUp",
  ArrowDown = "ArrowDown",
  ArrowLeft = "ArrowLeft",
  ArrowRight = "ArrowRight",

  // Modifiers
  ShiftLeft = "ShiftLeft",
  ShiftRight = "ShiftRight",
  ControlLeft = "ControlLeft",
  ControlRight = "ControlRight",
  AltLeft = "AltLeft",
  AltRight = "AltRight",
  MetaLeft = "MetaLeft",
  MetaRight = "MetaRight",
  CapsLock = "CapsLock",

  // Letters
  KeyA = "KeyA",
  KeyB = "KeyB",
  KeyC = "KeyC",
  KeyD = "KeyD",
  KeyE = "KeyE",
  KeyF = "KeyF",
  KeyG = "KeyG",
  KeyH = "KeyH",
  KeyI = "KeyI",
  KeyJ = "KeyJ",
  KeyK = "KeyK",
  KeyL = "KeyL",
  KeyM = "KeyM",
  KeyN = "KeyN",
  KeyO = "KeyO",
  KeyP = "KeyP",
  KeyQ = "KeyQ",
  KeyR = "KeyR",
  KeyS = "KeyS",
  KeyT = "KeyT",
  KeyU = "KeyU",
  KeyV = "KeyV",
  KeyW = "KeyW",
  KeyX = "KeyX",
  KeyY = "KeyY",
  KeyZ = "KeyZ",

  // Numbers (top row)
  Digit0 = "Digit0",
  Digit1 = "Digit1",
  Digit2 = "Digit2",
  Digit3 = "Digit3",
  Digit4 = "Digit4",
  Digit5 = "Digit5",
  Digit6 = "Digit6",
  Digit7 = "Digit7",
  Digit8 = "Digit8",
  Digit9 = "Digit9",

  // Numpad
  Numpad0 = "Numpad0",
  Numpad1 = "Numpad1",
  Numpad2 = "Numpad2",
  Numpad3 = "Numpad3",
  Numpad4 = "Numpad4",
  Numpad5 = "Numpad5",
  Numpad6 = "Numpad6",
  Numpad7 = "Numpad7",
  Numpad8 = "Numpad8",
  Numpad9 = "Numpad9",
  NumpadAdd = "NumpadAdd",
  NumpadSubtract = "NumpadSubtract",
  NumpadMultiply = "NumpadMultiply",
  NumpadDivide = "NumpadDivide",
  NumpadDecimal = "NumpadDecimal",
  NumpadEnter = "NumpadEnter",
  NumLock = "NumLock",

  // Function keys
  F1 = "F1",
  F2 = "F2",
  F3 = "F3",
  F4 = "F4",
  F5 = "F5",
  F6 = "F6",
  F7 = "F7",
  F8 = "F8",
  F9 = "F9",
  F10 = "F10",
  F11 = "F11",
  F12 = "F12",

  // Punctuation
  Minus = "Minus",
  Equal = "Equal",
  BracketLeft = "BracketLeft",
  BracketRight = "BracketRight",
  Backslash = "Backslash",
  Semicolon = "Semicolon",
  Quote = "Quote",
  Backquote = "Backquote",
  Comma = "Comma",
  Period = "Period",
  Slash = "Slash",
}

/**
 * Input singleton for polling-based input queries
 */
export class Input {
  private static instance: Input | null = null;

  // Keyboard state
  private keysPressed = new Set<string>();
  private keysJustPressed = new Set<string>();
  private keysJustReleased = new Set<string>();

  // Mouse button state
  private mouseButtonsPressed = new Set<number>();
  private mouseButtonsJustPressed = new Set<number>();
  private mouseButtonsJustReleased = new Set<number>();

  // Mouse position
  private mouseX = 0;
  private mouseY = 0;
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;

  // Scroll state
  private scrollDeltaX = 0;
  private scrollDeltaY = 0;

  private constructor() {}

  /**
   * Initialize the Input system (called by Application)
   */
  static initialize(): Input {
    if (Input.instance) {
      return Input.instance;
    }
    Input.instance = new Input();
    return Input.instance;
  }

  /**
   * Get the Input singleton instance
   */
  static get(): Input {
    if (!Input.instance) {
      throw new Error("Input not initialized. Call Input.initialize() first.");
    }
    return Input.instance;
  }

  /**
   * Check if Input system is initialized
   */
  static isInitialized(): boolean {
    return Input.instance !== null;
  }

  // ============================================================================
  // Keyboard State Queries
  // ============================================================================

  /**
   * Check if a key is currently pressed
   */
  static isKeyPressed(keyCode: string | KeyCode): boolean {
    return Input.get().keysPressed.has(keyCode);
  }

  /**
   * Check if a key was just pressed this frame
   */
  static isKeyJustPressed(keyCode: string | KeyCode): boolean {
    return Input.get().keysJustPressed.has(keyCode);
  }

  /**
   * Check if a key was just released this frame
   */
  static isKeyJustReleased(keyCode: string | KeyCode): boolean {
    return Input.get().keysJustReleased.has(keyCode);
  }

  /**
   * Check if any of the given keys are pressed
   */
  static isAnyKeyPressed(...keyCodes: (string | KeyCode)[]): boolean {
    const input = Input.get();
    return keyCodes.some((code) => input.keysPressed.has(code));
  }

  /**
   * Check if all of the given keys are pressed
   */
  static areAllKeysPressed(...keyCodes: (string | KeyCode)[]): boolean {
    const input = Input.get();
    return keyCodes.every((code) => input.keysPressed.has(code));
  }

  /**
   * Get all currently pressed keys
   */
  static getPressedKeys(): string[] {
    return Array.from(Input.get().keysPressed);
  }

  // ============================================================================
  // Mouse Button State Queries
  // ============================================================================

  /**
   * Check if a mouse button is currently pressed
   */
  static isMouseButtonPressed(button: MouseButton | number): boolean {
    return Input.get().mouseButtonsPressed.has(button);
  }

  /**
   * Check if a mouse button was just pressed this frame
   */
  static isMouseButtonJustPressed(button: MouseButton | number): boolean {
    return Input.get().mouseButtonsJustPressed.has(button);
  }

  /**
   * Check if a mouse button was just released this frame
   */
  static isMouseButtonJustReleased(button: MouseButton | number): boolean {
    return Input.get().mouseButtonsJustReleased.has(button);
  }

  // ============================================================================
  // Mouse Position Queries
  // ============================================================================

  /**
   * Get current mouse position (relative to canvas)
   */
  static getMousePosition(): { x: number; y: number } {
    const input = Input.get();
    return { x: input.mouseX, y: input.mouseY };
  }

  /**
   * Get mouse X position
   */
  static getMouseX(): number {
    return Input.get().mouseX;
  }

  /**
   * Get mouse Y position
   */
  static getMouseY(): number {
    return Input.get().mouseY;
  }

  /**
   * Get mouse movement delta since last frame
   */
  static getMouseDelta(): { x: number; y: number } {
    const input = Input.get();
    return { x: input.mouseDeltaX, y: input.mouseDeltaY };
  }

  /**
   * Get mouse movement delta X since last frame
   */
  static getMouseDeltaX(): number {
    return Input.get().mouseDeltaX;
  }

  /**
   * Get mouse movement delta Y since last frame
   */
  static getMouseDeltaY(): number {
    return Input.get().mouseDeltaY;
  }

  // ============================================================================
  // Scroll State Queries
  // ============================================================================

  /**
   * Get scroll wheel delta since last frame
   */
  static getScrollDelta(): { x: number; y: number } {
    const input = Input.get();
    return { x: input.scrollDeltaX, y: input.scrollDeltaY };
  }

  /**
   * Get scroll wheel delta X since last frame
   */
  static getScrollDeltaX(): number {
    return Input.get().scrollDeltaX;
  }

  /**
   * Get scroll wheel delta Y since last frame
   */
  static getScrollDeltaY(): number {
    return Input.get().scrollDeltaY;
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  /**
   * Check if any modifier key is pressed (Shift, Ctrl, Alt, Meta)
   */
  static isModifierPressed(): boolean {
    return Input.isAnyKeyPressed(
      KeyCode.ShiftLeft,
      KeyCode.ShiftRight,
      KeyCode.ControlLeft,
      KeyCode.ControlRight,
      KeyCode.AltLeft,
      KeyCode.AltRight,
      KeyCode.MetaLeft,
      KeyCode.MetaRight
    );
  }

  /**
   * Check if Shift key is pressed
   */
  static isShiftPressed(): boolean {
    return Input.isAnyKeyPressed(KeyCode.ShiftLeft, KeyCode.ShiftRight);
  }

  /**
   * Check if Ctrl key is pressed
   */
  static isCtrlPressed(): boolean {
    return Input.isAnyKeyPressed(KeyCode.ControlLeft, KeyCode.ControlRight);
  }

  /**
   * Check if Alt key is pressed
   */
  static isAltPressed(): boolean {
    return Input.isAnyKeyPressed(KeyCode.AltLeft, KeyCode.AltRight);
  }

  /**
   * Check if Meta key is pressed (Cmd on Mac, Win on Windows)
   */
  static isMetaPressed(): boolean {
    return Input.isAnyKeyPressed(KeyCode.MetaLeft, KeyCode.MetaRight);
  }

  // ============================================================================
  // Internal State Update Methods (called by Window)
  // ============================================================================

  /** @internal */
  _onKeyDown(code: string): void {
    if (!this.keysPressed.has(code)) {
      this.keysJustPressed.add(code);
    }
    this.keysPressed.add(code);
  }

  /** @internal */
  _onKeyUp(code: string): void {
    this.keysPressed.delete(code);
    this.keysJustReleased.add(code);
  }

  /** @internal */
  _onMouseMove(x: number, y: number): void {
    this.mouseDeltaX += x - this.mouseX;
    this.mouseDeltaY += y - this.mouseY;
    this.mouseX = x;
    this.mouseY = y;
  }

  /** @internal */
  _onMouseDown(button: number): void {
    if (!this.mouseButtonsPressed.has(button)) {
      this.mouseButtonsJustPressed.add(button);
    }
    this.mouseButtonsPressed.add(button);
  }

  /** @internal */
  _onMouseUp(button: number): void {
    this.mouseButtonsPressed.delete(button);
    this.mouseButtonsJustReleased.add(button);
  }

  /** @internal */
  _onScroll(deltaX: number, deltaY: number): void {
    this.scrollDeltaX += deltaX;
    this.scrollDeltaY += deltaY;
  }

  /** @internal - Clear per-frame state at end of frame */
  _endFrame(): void {
    this.keysJustPressed.clear();
    this.keysJustReleased.clear();
    this.mouseButtonsJustPressed.clear();
    this.mouseButtonsJustReleased.clear();
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.scrollDeltaX = 0;
    this.scrollDeltaY = 0;
  }

  /** @internal - Reset all state */
  _reset(): void {
    this.keysPressed.clear();
    this.keysJustPressed.clear();
    this.keysJustReleased.clear();
    this.mouseButtonsPressed.clear();
    this.mouseButtonsJustPressed.clear();
    this.mouseButtonsJustReleased.clear();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.scrollDeltaX = 0;
    this.scrollDeltaY = 0;
  }
}
