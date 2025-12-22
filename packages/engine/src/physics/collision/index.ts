/**
 * Collision Detection Module
 *
 * Event classes, query filters, and utilities for physics collision detection.
 * Inspired by Bevy Rapier with JavaScript naming conventions.
 */

// Query filters
export {
  type QueryFilter,
  QueryFilterFlags,
  type QueryPredicate,
  DEFAULT_QUERY_FILTER,
} from './query-filter.js';

// Physics hooks
export {
  type ContactFilterContext,
  type ContactModificationContext2D,
  type ContactModificationContext3D,
  SolverFlags,
  ActiveHooksFlags,
  type PhysicsHooks2D,
  type PhysicsHooks3D,
} from './physics-hooks.js';

// Collision events
export {
  CollisionEventFlags,
  CollisionStarted2D,
  CollisionEnded2D,
  CollisionStarted3D,
  CollisionEnded3D,
} from './collision-events.js';

// Contact force events
export { ContactForce2D, ContactForce3D } from './contact-events.js';

// Trigger zone events
export {
  TriggerZoneEnter2D,
  TriggerZoneLeave2D,
  TriggerZoneEnter3D,
  TriggerZoneLeave3D,
} from './trigger-events.js';
