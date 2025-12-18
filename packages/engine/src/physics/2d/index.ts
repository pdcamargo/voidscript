/**
 * 2D Physics System
 *
 * Rapier-based 2D physics integration for VoidScript ECS.
 */

// Context
export { Physics2DContext, type RaycastHit2D } from './physics-2d-context.js';

// Components
export * from './components/index.js';

// Systems
export { physics2DComponentSyncSystem } from './physics-2d-component-sync.js';
export { physics2DSyncSystem } from './physics-2d-sync-system.js';
export { physics2DCleanupSystem } from './physics-2d-cleanup-system.js';
