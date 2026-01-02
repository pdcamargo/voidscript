/**
 * Application Module
 *
 * Provides the core application architecture:
 * - Application class with game loop
 * - Layer system for organizing game logic
 * - Event system for input handling
 * - Input polling system
 * - Window/canvas management
 * - Three.js renderer integration
 * - ImGui support
 */

// Core application (legacy - full featured with editor support)
export {
  Application,
  type ApplicationConfig,
  type DefaultSceneConfig,
  type AppEditorConfig,
} from "./application.js";

// Clean engine application (no editor coupling)
export {
  EngineApplication,
  type EngineApplicationConfig,
  type PhysicsConfig,
} from "./engine-application.js";

// Scene loader
export { SceneLoader, type SceneLoaderConfig } from "./scene-loader.js";

// Layer system
export { Layer, LayerStack } from "./layer.js";

// Event system
export {
  EventType,
  EventCategory,
  EventDispatcher,
  // Event types
  type Event,
  type AppEvent,
  type WindowCloseEvent,
  type WindowResizeEvent,
  type WindowFocusEvent,
  type WindowLostFocusEvent,
  type KeyEvent,
  type KeyPressedEvent,
  type KeyReleasedEvent,
  type KeyTypedEvent,
  type MouseButtonEvent,
  type MouseButtonPressedEvent,
  type MouseButtonReleasedEvent,
  type MouseMovedEvent,
  type MouseScrolledEvent,
  type GamepadConnectedEvent,
  type GamepadDisconnectedEvent,
  // Factory functions
  createWindowCloseEvent,
  createWindowResizeEvent,
  createWindowFocusEvent,
  createWindowLostFocusEvent,
  createKeyPressedEvent,
  createKeyReleasedEvent,
  createKeyTypedEvent,
  createMouseButtonPressedEvent,
  createMouseButtonReleasedEvent,
  createMouseMovedEvent,
  createMouseScrolledEvent,
  createGamepadConnectedEvent,
  createGamepadDisconnectedEvent,
} from "./events.js";

// Input system
export { Input, KeyCode, MouseButton } from "./input.js";

// Window management
export { Window, type WindowConfig } from "./window.js";

// Renderer
export { Renderer, type RendererConfig } from "./renderer.js";

// Built-in layers
export {
  ImGuiLayer,
  type ImGuiLayerConfig,
  ImGui,
  ImGuiImplWeb,
} from "./layers/index.js";

// ImGui utilities
export * from "./imgui/index.js";

// Editor camera management
export {
  EditorCameraManager,
  type EditorCameraMode,
} from "./editor-camera-manager.js";

// Helper management
export {
  HelperManager,
  type HelperManagerConfig,
} from "./helper-manager.js";
