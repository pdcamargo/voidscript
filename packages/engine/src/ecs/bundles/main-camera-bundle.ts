/**
 * MainCamera Bundle
 *
 * A bundle for spawning the main camera entity with all required components
 * for camera brain functionality.
 *
 * Components:
 * - Transform3D: Camera position and rotation in world space
 * - Camera: Camera projection settings (perspective/orthographic)
 * - MainCamera: Marker component designating this as the active camera
 * - CameraBrain: Controls blending between virtual cameras
 * - Name: Display name in editor
 *
 * @example
 * ```ts
 * import { MainCameraBundle } from '@voidscript/engine/ecs/bundles';
 *
 * // Spawn main camera with default orthographic settings
 * commands.spawn().withBundle(MainCameraBundle, {
 *   transform: {
 *     position: new Vector3(0, 0, 10)
 *   }
 * }).build();
 *
 * // Spawn with perspective camera and custom settings
 * commands.spawn().withBundle(MainCameraBundle, {
 *   transform: {
 *     position: new Vector3(0, 5, 20)
 *   },
 *   camera: {
 *     type: 'perspective',
 *     fov: 60
 *   },
 *   cameraBrain: {
 *     blendTime: 0.3
 *   }
 * }).build();
 * ```
 */

import {
  componentConfig,
  requiredProperty,
  optionalProperty,
} from '@voidscript/core';
import { registerBundle } from '@voidscript/core';
import { Transform3D } from '../components/rendering/transform-3d.js';
import { Camera, type CameraData } from '../components/rendering/camera.js';
import { MainCamera } from '../components/rendering/main-camera.js';
import {
  CameraBrain,
  type BlendCurve,
  type CameraBrainUpdateMode,
} from '../components/rendering/camera-brain.js';
import { Name } from '@voidscript/core';
import { Vector3 } from '../../math/index.js';

export const MainCameraBundle = registerBundle('MainCamera', {
  transform: componentConfig(Transform3D, {
    position: requiredProperty<Vector3>(),
    rotation: optionalProperty<Vector3>({ default: () => new Vector3(0, 0, 0) }),
    scale: optionalProperty<Vector3>({ default: () => new Vector3(1, 1, 1) }),
  }),
  camera: componentConfig(Camera, {
    type: optionalProperty<CameraData['type']>({ default: 'orthographic' }),
    near: optionalProperty<number>({ default: 0.1 }),
    far: optionalProperty<number>({ default: 1000 }),
    fov: optionalProperty<number>({ default: 75 }),
    size: optionalProperty<number>({ default: 5 }),
    zoom: optionalProperty<number>({ default: 1 }),
  }),
  mainCamera: componentConfig(MainCamera, {}),
  cameraBrain: componentConfig(CameraBrain, {
    blendTime: optionalProperty<number>({ default: 0.5 }),
    blendCurve: optionalProperty<BlendCurve>({ default: 'easeInOut' }),
    updateMode: optionalProperty<CameraBrainUpdateMode>({ default: 'lateUpdate' }),
    worldUp: optionalProperty<{ x: number; y: number; z: number }>({
      default: { x: 0, y: 1, z: 0 },
    }),
  }),
  name: componentConfig(Name, {
    name: optionalProperty<string>({ default: 'Main Camera' }),
  }),
});
