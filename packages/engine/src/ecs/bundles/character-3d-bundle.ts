/**
 * Character3D Bundle
 *
 * A bundle for spawning 3D character entities with physics and character controller.
 * Configured for kinematic character movement with capsule collider.
 *
 * Components:
 * - Transform3D: Character position and rotation in world space
 * - RigidBody3D: Physics body (defaults to kinematic)
 * - Collider3D: Capsule collision shape
 * - CharacterController3D: Move-and-slide character movement
 * - Ccd: Continuous collision detection (always enabled)
 * - Name: Display name in editor
 *
 * @example
 * ```ts
 * import { Character3DBundle } from '@voidscript/engine/ecs/bundles';
 *
 * // Spawn a 3D character
 * commands.spawn().withBundle(Character3DBundle, {
 *   transform: {
 *     position: new Vector3(0, 2, 0)
 *   }
 * }).build();
 *
 * // Spawn with custom collider size
 * commands.spawn().withBundle(Character3DBundle, {
 *   transform: {
 *     position: new Vector3(5, 2, 0)
 *   },
 *   collider: {
 *     shape: { type: 'capsule', halfHeight: 1.0, radius: 0.5 }
 *   },
 *   name: {
 *     name: 'Player'
 *   }
 * }).build();
 * ```
 */

import {
  componentConfig,
  requiredProperty,
  optionalProperty,
  hiddenProperty,
} from '../bundle.js';
import { registerBundle } from '../bundle-registry.js';
import { Transform3D } from '../components/rendering/transform-3d.js';
import { RigidBody3D } from '../../physics/3d/components/rigidbody-3d.js';
import {
  Collider3D,
  type Collider3DData,
} from '../../physics/3d/components/collider-3d.js';
import { CharacterController3D } from '../../physics/3d/components/character-controller-3d.js';
import { Ccd } from '../../physics/components/ccd.js';
import { Name } from '../components/name.js';
import { Vector3 } from '../../math/index.js';
import type { BodyType, ColliderShape3D } from '../../physics/types.js';
import * as THREE from 'three';

export const Character3DBundle = registerBundle('Character3D', {
  transform: componentConfig(Transform3D, {
    position: requiredProperty<Vector3>(),
    rotation: optionalProperty<Vector3>({ default: () => new Vector3(0, 0, 0) }),
    scale: optionalProperty<Vector3>({ default: () => new Vector3(1, 1, 1) }),
  }),
  rigidBody: componentConfig(RigidBody3D, {
    bodyType: optionalProperty<BodyType>({ default: 'kinematic' }),
    canSleep: optionalProperty<boolean>({ default: true }),
  }),
  collider: componentConfig(Collider3D, {
    shape: optionalProperty<ColliderShape3D>({
      default: { type: 'capsule', halfHeight: 0.5, radius: 0.25 },
    }),
    offset: optionalProperty<THREE.Vector3>({
      default: () => new THREE.Vector3(0, 0, 0),
    }),
    rotationOffset: optionalProperty<THREE.Vector3>({
      default: () => new THREE.Vector3(0, 0, 0),
    }),
    isSensor: optionalProperty<boolean>({ default: false }),
    friction: optionalProperty<number>({ default: 0.5 }),
    restitution: optionalProperty<number>({ default: 0 }),
    density: optionalProperty<number>({ default: 1 }),
  }),
  characterController: componentConfig(CharacterController3D, {
    offset: optionalProperty<number>({ default: 0.01 }),
    up: optionalProperty<THREE.Vector3>({
      default: () => new THREE.Vector3(0, 1, 0),
    }),
    maxSlopeClimbAngle: optionalProperty<number>({ default: Math.PI / 4 }),
    minSlopeSlideAngle: optionalProperty<number>({ default: Math.PI / 3 }),
    autostepEnabled: optionalProperty<boolean>({ default: false }),
    autostepMaxHeight: optionalProperty<number>({ default: 0.5 }),
    autostepMinWidth: optionalProperty<number>({ default: 0.2 }),
    autostepIncludesDynamicBodies: optionalProperty<boolean>({ default: false }),
    snapToGroundEnabled: optionalProperty<boolean>({ default: false }),
    snapToGroundDistance: optionalProperty<number>({ default: 0.2 }),
    slideEnabled: optionalProperty<boolean>({ default: true }),
    normalNudgeFactor: optionalProperty<number>({ default: 0 }),
    applyImpulsesToDynamicBodies: optionalProperty<boolean>({ default: false }),
    characterMass: optionalProperty<number | null>({ default: null }),
  }),
  ccd: componentConfig(Ccd, {
    enabled: hiddenProperty<boolean>({ default: true }),
  }),
  name: componentConfig(Name, {
    name: optionalProperty<string>({ default: 'Character 3D' }),
  }),
});
