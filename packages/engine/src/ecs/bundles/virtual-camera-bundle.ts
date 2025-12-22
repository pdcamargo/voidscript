/**
 * VirtualCamera Bundle
 *
 * A bundle for spawning virtual camera entities that work with the CameraBrain.
 * Virtual cameras define viewpoints with priority-based selection.
 *
 * Components:
 * - Transform3D: Camera position and rotation in world space
 * - VirtualCamera: Priority-based camera viewpoint settings
 * - VirtualCameraFollow: Target following behavior
 * - Name: Display name in editor
 *
 * @example
 * ```ts
 * import { VirtualCameraBundle } from '@voidscript/engine/ecs/bundles';
 *
 * // Spawn a virtual camera following a target
 * commands.spawn().withBundle(VirtualCameraBundle, {
 *   transform: {
 *     position: new Vector3(0, 5, -10)
 *   },
 *   virtualCameraFollow: {
 *     target: playerEntity,
 *     mode: '2dFollow'
 *   }
 * }).build();
 *
 * // Spawn a higher priority cutscene camera
 * commands.spawn().withBundle(VirtualCameraBundle, {
 *   transform: {
 *     position: new Vector3(0, 2, -5)
 *   },
 *   virtualCamera: {
 *     priority: 20,
 *     type: 'perspective',
 *     fov: 45
 *   }
 * }).build();
 * ```
 */

import {
  componentConfig,
  requiredProperty,
  optionalProperty,
} from '../bundle.js';
import { registerBundle } from '../bundle-registry.js';
import { Transform3D } from '../components/rendering/transform-3d.js';
import {
  VirtualCamera,
  type VirtualCameraData,
} from '../components/rendering/virtual-camera.js';
import {
  VirtualCameraFollow,
  type FollowMode,
  type FollowDeadZone,
  type FollowSoftZone,
} from '../components/rendering/virtual-camera-follow.js';
import { Name } from '../components/name.js';
import { Vector3 } from '../../math/index.js';
import type { Entity } from '../entity.js';

export const VirtualCameraBundle = registerBundle('VirtualCamera', {
  transform: componentConfig(Transform3D, {
    position: requiredProperty<Vector3>(),
    rotation: optionalProperty<Vector3>({ default: () => new Vector3(0, 0, 0) }),
    scale: optionalProperty<Vector3>({ default: () => new Vector3(1, 1, 1) }),
  }),
  virtualCamera: componentConfig(VirtualCamera, {
    priority: optionalProperty<number>({ default: 10 }),
    enabled: optionalProperty<boolean>({ default: true }),
    type: optionalProperty<VirtualCameraData['type']>({ default: 'orthographic' }),
    fov: optionalProperty<number>({ default: 75 }),
    size: optionalProperty<number>({ default: 5 }),
    zoom: optionalProperty<number>({ default: 1 }),
    near: optionalProperty<number>({ default: 0.1 }),
    far: optionalProperty<number>({ default: 1000 }),
    dutch: optionalProperty<number>({ default: 0 }),
    enableCameraBounds: optionalProperty<boolean>({ default: false }),
    boundsEntity: optionalProperty<Entity | null>({ default: null }),
  }),
  virtualCameraFollow: componentConfig(VirtualCameraFollow, {
    target: optionalProperty<Entity | null>({ default: null }),
    mode: optionalProperty<FollowMode>({ default: 'transposer' }),
    offset: optionalProperty<{ x: number; y: number; z: number }>({
      default: { x: 0, y: 2, z: -10 },
    }),
    damping: optionalProperty<number>({ default: 1 }),
    dampingPerAxis: optionalProperty<{ x: number; y: number; z: number } | null>({
      default: null,
    }),
    lookaheadTime: optionalProperty<number>({ default: 0 }),
    lookaheadSmoothing: optionalProperty<number>({ default: 10 }),
    ignoreZ: optionalProperty<boolean>({ default: false }),
    enableDeadZone: optionalProperty<boolean>({ default: false }),
    screenPosition: optionalProperty<{ x: number; y: number }>({
      default: { x: 0.5, y: 0.5 },
    }),
    deadZone: optionalProperty<FollowDeadZone>({
      default: { width: 0.1, height: 0.1 },
    }),
    softZone: optionalProperty<FollowSoftZone>({
      default: { width: 0.3, height: 0.3 },
    }),
    orbitalRadius: optionalProperty<number>({ default: 10 }),
    orbitalAngleX: optionalProperty<number>({ default: 0 }),
    orbitalAngleY: optionalProperty<number>({ default: 15 }),
    orbitalUserControl: optionalProperty<boolean>({ default: false }),
  }),
  name: componentConfig(Name, {
    name: optionalProperty<string>({ default: 'Virtual Camera' }),
  }),
});
