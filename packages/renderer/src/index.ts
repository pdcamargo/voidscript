/**
 * @voidscript/renderer
 *
 * THREE.js renderer abstraction with SCREEN_TEXTURE support
 * and ImGui compatibility.
 */

// Core exports
export { Renderer, type RendererConfig } from './renderer.js';
export { Window, type WindowConfig } from './window.js';

// Re-export commonly used THREE types for convenience
export {
  Scene,
  PerspectiveCamera,
  OrthographicCamera,
  WebGLRenderTarget,
  WebGLRenderer,
  BoxGeometry,
  SphereGeometry,
  PlaneGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshPhongMaterial,
  AmbientLight,
  DirectionalLight,
  PointLight,
  SpotLight,
  Object3D,
  Group,
  Fog,
  FogExp2,
  Texture,
  TextureLoader,
  GridHelper,
  Color,
  Layers,
} from 'three';

export type { Camera, Material, Light, ColorRepresentation } from 'three';

// Re-export math from @voidscript/core
export * from '@voidscript/core';
