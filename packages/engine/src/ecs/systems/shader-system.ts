/**
 * Shader System
 *
 * Updates ShaderManager each frame to keep TIME uniforms synchronized.
 * This system runs in the update phase to ensure TIME is updated before
 * render systems that use shader materials.
 */

import { system } from '../system.js';
import { ShaderManager } from '../../shader/shader-manager.js';
import { Application } from '../../app/application.js';

/**
 * Shader update system
 *
 * Updates the ShaderManager's elapsed time and all tracked materials
 * with TIME uniforms.
 */
export const shaderUpdateSystem = system(({ commands }) => {
  const shaderManager = commands.tryGetResource(ShaderManager);
  if (!shaderManager) return;

  // Get delta time from application
  const app = Application.exists() ? Application.get() : null;
  const deltaTime = app?.getDeltaTime() ?? 0;

  // Debug: Log every 60 frames (roughly once per second at 60fps)
  const trackedCount = shaderManager.getTrackedMaterialCount();
  if (trackedCount > 0 && Math.random() < 0.02) {
    console.log('[ShaderUpdateSystem] Updating TIME:', shaderManager.getElapsedTime().toFixed(2), 'on', trackedCount, 'materials');
  }

  shaderManager.update(deltaTime);
});
