/**
 * Event System - Type-safe browser events for game applications
 */

/**
 * Event types supported by the application
 */
export enum EventType {
  // Window events
  WindowClose = "WindowClose",
  WindowResize = "WindowResize",
  WindowFocus = "WindowFocus",
  WindowLostFocus = "WindowLostFocus",

  // Keyboard events
  KeyPressed = "KeyPressed",
  KeyReleased = "KeyReleased",
  KeyTyped = "KeyTyped",

  // Mouse events
  MouseButtonPressed = "MouseButtonPressed",
  MouseButtonReleased = "MouseButtonReleased",
  MouseMoved = "MouseMoved",
  MouseScrolled = "MouseScrolled",

  // Gamepad events
  GamepadConnected = "GamepadConnected",
  GamepadDisconnected = "GamepadDisconnected",
}

/**
 * Event categories for filtering
 */
export enum EventCategory {
  None = 0,
  Application = 1 << 0,
  Input = 1 << 1,
  Keyboard = 1 << 2,
  Mouse = 1 << 3,
  MouseButton = 1 << 4,
  Gamepad = 1 << 5,
}

/**
 * Base event interface
 */
export interface Event {
  readonly type: EventType;
  handled: boolean;
}

// ============================================================================
// Window Events
// ============================================================================

export interface WindowCloseEvent extends Event {
  readonly type: EventType.WindowClose;
}

export interface WindowResizeEvent extends Event {
  readonly type: EventType.WindowResize;
  readonly width: number;
  readonly height: number;
}

export interface WindowFocusEvent extends Event {
  readonly type: EventType.WindowFocus;
}

export interface WindowLostFocusEvent extends Event {
  readonly type: EventType.WindowLostFocus;
}

// ============================================================================
// Keyboard Events
// ============================================================================

export interface KeyEvent extends Event {
  readonly keyCode: string; // KeyboardEvent.code
  readonly key: string; // KeyboardEvent.key
  readonly repeat: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
}

export interface KeyPressedEvent extends KeyEvent {
  readonly type: EventType.KeyPressed;
}

export interface KeyReleasedEvent extends KeyEvent {
  readonly type: EventType.KeyReleased;
}

export interface KeyTypedEvent extends Event {
  readonly type: EventType.KeyTyped;
  readonly character: string;
}

// ============================================================================
// Mouse Events
// ============================================================================

export interface MouseButtonEvent extends Event {
  readonly button: number;
  readonly x: number;
  readonly y: number;
}

export interface MouseButtonPressedEvent extends MouseButtonEvent {
  readonly type: EventType.MouseButtonPressed;
}

export interface MouseButtonReleasedEvent extends MouseButtonEvent {
  readonly type: EventType.MouseButtonReleased;
}

export interface MouseMovedEvent extends Event {
  readonly type: EventType.MouseMoved;
  readonly x: number;
  readonly y: number;
  readonly deltaX: number;
  readonly deltaY: number;
}

export interface MouseScrolledEvent extends Event {
  readonly type: EventType.MouseScrolled;
  readonly x: number;
  readonly y: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

// ============================================================================
// Gamepad Events
// ============================================================================

export interface GamepadConnectedEvent extends Event {
  readonly type: EventType.GamepadConnected;
  readonly gamepadIndex: number;
  readonly gamepadId: string;
}

export interface GamepadDisconnectedEvent extends Event {
  readonly type: EventType.GamepadDisconnected;
  readonly gamepadIndex: number;
}

// ============================================================================
// Union type for all events
// ============================================================================

export type AppEvent =
  | WindowCloseEvent
  | WindowResizeEvent
  | WindowFocusEvent
  | WindowLostFocusEvent
  | KeyPressedEvent
  | KeyReleasedEvent
  | KeyTypedEvent
  | MouseButtonPressedEvent
  | MouseButtonReleasedEvent
  | MouseMovedEvent
  | MouseScrolledEvent
  | GamepadConnectedEvent
  | GamepadDisconnectedEvent;

// ============================================================================
// Event Dispatcher
// ============================================================================

/**
 * EventDispatcher - Type-safe event dispatch with handler filtering
 *
 * @example
 * ```ts
 * const dispatcher = new EventDispatcher(event);
 * dispatcher.dispatch<KeyPressedEvent>(EventType.KeyPressed, (e) => {
 *   if (e.keyCode === 'Escape') {
 *     // Handle escape key
 *     return true; // Event handled
 *   }
 *   return false;
 * });
 * ```
 */
export class EventDispatcher {
  constructor(private event: AppEvent) {}

  /**
   * Dispatch event to handler if type matches
   * @param eventType - The event type to match
   * @param handler - Handler function that returns true if event was consumed
   * @returns true if event was handled
   */
  dispatch<T extends AppEvent>(
    eventType: EventType,
    handler: (event: T) => boolean
  ): boolean {
    if (this.event.type === eventType && !this.event.handled) {
      this.event.handled = handler(this.event as T);
      return this.event.handled;
    }
    return false;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export const createWindowCloseEvent = (): WindowCloseEvent => ({
  type: EventType.WindowClose,
  handled: false,
});

export const createWindowResizeEvent = (
  width: number,
  height: number
): WindowResizeEvent => ({
  type: EventType.WindowResize,
  width,
  height,
  handled: false,
});

export const createWindowFocusEvent = (): WindowFocusEvent => ({
  type: EventType.WindowFocus,
  handled: false,
});

export const createWindowLostFocusEvent = (): WindowLostFocusEvent => ({
  type: EventType.WindowLostFocus,
  handled: false,
});

export const createKeyPressedEvent = (e: KeyboardEvent): KeyPressedEvent => ({
  type: EventType.KeyPressed,
  keyCode: e.code,
  key: e.key,
  repeat: e.repeat,
  ctrlKey: e.ctrlKey,
  shiftKey: e.shiftKey,
  altKey: e.altKey,
  metaKey: e.metaKey,
  handled: false,
});

export const createKeyReleasedEvent = (e: KeyboardEvent): KeyReleasedEvent => ({
  type: EventType.KeyReleased,
  keyCode: e.code,
  key: e.key,
  repeat: e.repeat,
  ctrlKey: e.ctrlKey,
  shiftKey: e.shiftKey,
  altKey: e.altKey,
  metaKey: e.metaKey,
  handled: false,
});

export const createKeyTypedEvent = (character: string): KeyTypedEvent => ({
  type: EventType.KeyTyped,
  character,
  handled: false,
});

export const createMouseButtonPressedEvent = (
  e: MouseEvent,
  canvasRect?: DOMRect
): MouseButtonPressedEvent => {
  const x = canvasRect ? e.clientX - canvasRect.left : e.clientX;
  const y = canvasRect ? e.clientY - canvasRect.top : e.clientY;
  return {
    type: EventType.MouseButtonPressed,
    button: e.button,
    x,
    y,
    handled: false,
  };
};

export const createMouseButtonReleasedEvent = (
  e: MouseEvent,
  canvasRect?: DOMRect
): MouseButtonReleasedEvent => {
  const x = canvasRect ? e.clientX - canvasRect.left : e.clientX;
  const y = canvasRect ? e.clientY - canvasRect.top : e.clientY;
  return {
    type: EventType.MouseButtonReleased,
    button: e.button,
    x,
    y,
    handled: false,
  };
};

export const createMouseMovedEvent = (
  e: MouseEvent,
  lastX: number,
  lastY: number,
  canvasRect?: DOMRect
): MouseMovedEvent => {
  const x = canvasRect ? e.clientX - canvasRect.left : e.clientX;
  const y = canvasRect ? e.clientY - canvasRect.top : e.clientY;
  return {
    type: EventType.MouseMoved,
    x,
    y,
    deltaX: x - lastX,
    deltaY: y - lastY,
    handled: false,
  };
};

export const createMouseScrolledEvent = (
  e: WheelEvent,
  canvasRect?: DOMRect
): MouseScrolledEvent => {
  const x = canvasRect ? e.clientX - canvasRect.left : e.clientX;
  const y = canvasRect ? e.clientY - canvasRect.top : e.clientY;
  return {
    type: EventType.MouseScrolled,
    x,
    y,
    offsetX: e.deltaX,
    offsetY: e.deltaY,
    handled: false,
  };
};

export const createGamepadConnectedEvent = (
  gamepad: Gamepad
): GamepadConnectedEvent => ({
  type: EventType.GamepadConnected,
  gamepadIndex: gamepad.index,
  gamepadId: gamepad.id,
  handled: false,
});

export const createGamepadDisconnectedEvent = (
  gamepadIndex: number
): GamepadDisconnectedEvent => ({
  type: EventType.GamepadDisconnected,
  gamepadIndex,
  handled: false,
});
