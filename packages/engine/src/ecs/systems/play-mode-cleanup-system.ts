/**
 * Play Mode Cleanup System
 *
 * Handles cleanup of Three.js resources when exiting play mode.
 * This ensures meshes, materials, textures, and other GPU resources
 * don't accumulate across play/stop cycles.
 *
 * Without this cleanup:
 * - Post-processing effects stack on each other
 * - Sprites/meshes duplicate in the scene
 * - Memory leaks from unreleased GPU resources
 *
 * IMPORTANT: Cleanup must happen BEFORE world restore (during 'play-stopping' event),
 * not after. This is because world.clear() removes all entities, but the render
 * managers still have Three.js objects in the scene. If we clean up after restore,
 * the new entities have different IDs and the managers can't find the old objects.
 */

import type { Command } from '../command.js';
import { EditorManager } from '../../editor/editor-manager.js';
import { Render3DManager } from './renderer-sync-system.js';
import { SpriteRenderManager } from './sprite-sync-system.js';
import { SkyGradientRenderManager } from './sky-gradient-system.js';
import { Rain2DRenderManager } from './rain-2d-system.js';
import { PostProcessingManager } from '../../post-processing/managers/post-processing-manager.js';
import { AudioManager } from './audio-manager.js';
import { Physics2DContext } from '../../physics/2d/physics-2d-context.js';
import { Physics3DContext } from '../../physics/3d/physics-3d-context.js';
import { UIManager } from '../../ui/ui-manager.js';
import { clearUITracking } from '../../ui/ui-systems.js';
import { ShaderManager } from '../../shader/shader-manager.js';

/**
 * Dispose all render managers
 * Called when exiting play mode, BEFORE world restore
 */
function disposeAllRenderManagers(commands: Command): void {
  // Render3DManager - 3D meshes and lights
  const render3DManager = commands.tryGetResource(Render3DManager);
  if (render3DManager) {
    render3DManager.dispose();
  }

  // SpriteRenderManager - 2D sprites
  const spriteManager = commands.tryGetResource(SpriteRenderManager);
  if (spriteManager) {
    spriteManager.dispose();
  }

  // SkyGradientRenderManager - Sky gradients
  const skyManager = commands.tryGetResource(SkyGradientRenderManager);
  if (skyManager) {
    skyManager.dispose();
  }

  // Rain2DRenderManager - Rain effects
  const rainManager = commands.tryGetResource(Rain2DRenderManager);
  if (rainManager) {
    rainManager.dispose();
  }

  // PostProcessingManager - Post-processing effects
  const postProcessingManager = commands.tryGetResource(PostProcessingManager);
  if (postProcessingManager) {
    postProcessingManager.dispose();
  }

  // AudioManager - Audio sources and listener
  const audioManager = commands.tryGetResource(AudioManager);
  if (audioManager) {
    audioManager.dispose();
  }

  // Physics2DContext - 2D physics bodies and colliders
  const physics2D = commands.tryGetResource(Physics2DContext);
  if (physics2D) {
    physics2D.dispose();
  }

  // Physics3DContext - 3D physics bodies and colliders
  const physics3D = commands.tryGetResource(Physics3DContext);
  if (physics3D) {
    physics3D.dispose();
  }

  // UIManager - UI elements (canvases, blocks, buttons, text)
  const uiManager = commands.tryGetResource(UIManager);
  if (uiManager) {
    uiManager.dispose();
  }

  // Clear UI tracking maps (separate from UIManager as they track entity -> Three.js object mappings)
  clearUITracking();

  // ShaderManager - Clear tracked materials (they were disposed with sprite/render managers)
  // Note: We only clear tracked materials, not the shader registry or elapsed time
  // This ensures TIME continues to work after play mode stops
  const shaderManager = commands.tryGetResource(ShaderManager);
  if (shaderManager) {
    // Clear tracked materials since they were disposed
    // Don't call full dispose() as we want to keep elapsed time running
    shaderManager.clearTrackedMaterials();
  }

  console.log('[PlayModeCleanup] Disposed all render managers, physics contexts, and UI');
}

/**
 * Setup play mode cleanup event listener
 *
 * This should be called once during application initialization.
 * It registers an event listener on EditorManager that cleans up
 * all render managers when 'play-stopping' event is fired (BEFORE world restore).
 *
 * @param editorManager - The EditorManager instance
 * @param commandFactory - Factory function to create Command instances
 */
export function setupPlayModeCleanup(
  editorManager: EditorManager,
  commandFactory: () => Command,
): void {
  editorManager.addEventListener((event) => {
    if (event.type === 'play-stopping') {
      const commands = commandFactory();
      disposeAllRenderManagers(commands);
    }
  });
}
