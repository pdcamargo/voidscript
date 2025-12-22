/**
 * 3D Physics Components
 *
 * Components for 3D physics simulation using Rapier.
 */

export { RigidBody3D, type RigidBody3DData } from './rigidbody-3d.js';
export { Velocity3D, type Velocity3DData } from './velocity-3d.js';
export { LockedAxes3D, type LockedAxes3DData } from './locked-axes-3d.js';
export { Collider3D, type Collider3DData } from './collider-3d.js';
export { PhysicsObject3D, type PhysicsObject3DData } from './physics-object-3d.js';
export {
  CharacterController3D,
  type CharacterController3DData,
} from './character-controller-3d.js';
export {
  DesiredMovement3D,
  type DesiredMovement3DData,
} from './desired-movement-3d.js';
export {
  ActiveCollisionEvents3D,
  ActiveCollisionEventsFlags3D,
  type ActiveCollisionEvents3DData,
} from './active-collision-events-3d.js';
export {
  ContactForceEventThreshold3D,
  type ContactForceEventThreshold3DData,
} from './contact-force-threshold-3d.js';
export {
  CollisionGroups3D,
  type CollisionGroups3DData,
} from './collision-groups-3d.js';
export {
  ActiveHooks3D,
  type ActiveHooks3DData,
} from './active-hooks-3d.js';
