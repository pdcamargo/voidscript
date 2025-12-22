/**
 * Character2D Bundle
 *
 * A bundle for spawning 2D character entities with physics and character controller.
 * Configured for kinematic character movement with capsule collider.
 *
 * Components:
 * - Transform3D: Character position and rotation in world space
 * - RigidBody2D: Physics body (defaults to kinematic)
 * - Collider2D: Capsule collision shape
 * - CharacterController2D: Move-and-slide character movement
 * - Ccd: Continuous collision detection (always enabled)
 * - Name: Display name in editor
 *
 * @example
 * ```ts
 * import { Character2DBundle } from '@voidscript/engine/ecs/bundles';
 *
 * // Spawn a 2D character
 * commands.spawn().withBundle(Character2DBundle, {
 *   transform: {
 *     position: new Vector3(0, 2, 0)
 *   }
 * }).build();
 *
 * // Spawn with custom collider size
 * commands.spawn().withBundle(Character2DBundle, {
 *   transform: {
 *     position: new Vector3(5, 2, 0)
 *   },
 *   collider: {
 *     shape: { type: 'capsule', halfHeight: 0.75, radius: 0.4 }
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
import { RigidBody2D } from '../../physics/2d/components/rigidbody-2d.js';
import {
  Collider2D,
  type Collider2DData,
} from '../../physics/2d/components/collider-2d.js';
import { CharacterController2D } from '../../physics/2d/components/character-controller-2d.js';
import { Ccd } from '../../physics/components/ccd.js';
import { Name } from '../components/name.js';
import { Vector3 } from '../../math/index.js';
import type { BodyType, ColliderShape2D } from '../../physics/types.js';
import * as THREE from 'three';

export const Character2DBundle = registerBundle('Character2D', {
  transform: componentConfig(Transform3D, {
    position: requiredProperty<Vector3>(),
    rotation: optionalProperty<Vector3>({ default: () => new Vector3(0, 0, 0) }),
    scale: optionalProperty<Vector3>({ default: () => new Vector3(1, 1, 1) }),
  }),
  rigidBody: componentConfig(RigidBody2D, {
    bodyType: optionalProperty<BodyType>({ default: 'kinematic' }),
    canSleep: optionalProperty<boolean>({ default: true }),
  }),
  collider: componentConfig(Collider2D, {
    shape: optionalProperty<ColliderShape2D>({
      default: { type: 'capsule', halfHeight: 0.5, radius: 0.25 },
    }),
    offset: optionalProperty<THREE.Vector2>({
      default: () => new THREE.Vector2(0, 0),
    }),
    rotationOffset: optionalProperty<number>({ default: 0 }),
    isSensor: optionalProperty<boolean>({ default: false }),
    friction: optionalProperty<number>({ default: 0.5 }),
    restitution: optionalProperty<number>({ default: 0 }),
    density: optionalProperty<number>({ default: 1 }),
  }),
  characterController: componentConfig(CharacterController2D, {
    offset: optionalProperty<number>({ default: 0.01 }),
    up: optionalProperty<THREE.Vector2>({
      default: () => new THREE.Vector2(0, 1),
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
    name: optionalProperty<string>({ default: 'Character 2D' }),
  }),
});
