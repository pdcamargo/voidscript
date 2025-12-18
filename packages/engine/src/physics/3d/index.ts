/**
 * 3D Physics System
 *
 * Rapier-based 3D physics integration for VoidScript ECS.
 */

// Context
export { Physics3DContext, type RaycastHit3D } from './physics-3d-context.js';

// Components
export * from './components/index.js';

// Systems
export { physics3DComponentSyncSystem } from './physics-3d-component-sync.js';
export { physics3DSyncSystem } from './physics-3d-sync-system.js';
export { physics3DCleanupSystem } from './physics-3d-cleanup-system.js';
