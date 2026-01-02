/**
 * Audio Sync System
 *
 * Synchronizes audio ECS components to Three.js audio objects.
 * Only runs during Play Mode via isGameplayActive() condition.
 *
 * This system:
 * 1. Creates AudioListener, AudioSource, PositionalAudio Three.js objects
 * 2. Updates audio positions from Transform3D
 * 3. Handles component additions/removals
 * 4. Manages audio lifecycle tied to play mode
 *
 * @example
 * ```typescript
 * // Automatically registered by Application.addBuiltInSystems()
 * // Or manually add:
 * app.insertResource(new AudioManager());
 * app.addUpdateSystem(audioSyncSystem);
 * ```
 */

import { system } from '@voidscript/core';
import { Transform3D } from '../components/rendering/transform-3d.js';
import { AudioListener } from '../components/audio/audio-listener.js';
import { AudioSource } from '../components/audio/audio-source.js';
import { PositionalAudioSource } from '../components/audio/positional-audio-source.js';
import { AudioManager } from './audio-manager.js';
import { Render3DManager } from './renderer-sync-system.js';
import { isGameplayActive } from '../../editor/system-conditions.js';
import { EditorManager } from '../../editor/editor-manager.js';

/**
 * Audio sync system
 *
 * Syncs audio components to Three.js audio objects.
 * Only runs in Play Mode.
 */
export const audioSyncSystem = system(({ commands }) => {
  const audioManager = commands.tryGetResource(AudioManager);
  if (!audioManager) {
    return;
  }

  // Get renderer to access scene
  // We need to initialize AudioManager with the scene on first run
  if (!audioManager.getIsInitialized()) {
    // Get Render3DManager to access the renderer
    const renderManager = commands.tryGetResource(Render3DManager);
    if (renderManager) {
      const renderer = renderManager.getRenderer();
      audioManager.initialize(renderer.getScene());
    } else {
      // No render manager available yet
      return;
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Handle AudioListener
  // ---------------------------------------------------------------------------

  // Find and sync AudioListener
  commands
    .query()
    .all(Transform3D, AudioListener)
    .each((entity, transform, listenerData) => {
      // Create or get listener
      audioManager.getOrCreateListener(entity, listenerData);
      // Update position
      audioManager.updateListener(entity, listenerData, transform);
    });

  // ---------------------------------------------------------------------------
  // 2. Create AudioSource for new entities
  // ---------------------------------------------------------------------------

  commands
    .query()
    .all(Transform3D, AudioSource)
    .each((entity, _transform, audioData) => {
      if (!audioManager.hasAudio(entity) && audioManager.hasListener()) {
        audioManager.createAudioSource(entity, audioData);
      }
    });

  // ---------------------------------------------------------------------------
  // 3. Update existing AudioSources
  // ---------------------------------------------------------------------------

  commands
    .query()
    .all(Transform3D, AudioSource)
    .each((entity, _transform, audioData) => {
      if (audioManager.hasAudio(entity)) {
        audioManager.updateAudioSource(entity, audioData);
      }
    });

  // ---------------------------------------------------------------------------
  // 4. Create PositionalAudioSource for new entities
  // ---------------------------------------------------------------------------

  commands
    .query()
    .all(Transform3D, PositionalAudioSource)
    .each((entity, transform, positionalData) => {
      if (!audioManager.hasAudio(entity) && audioManager.hasListener()) {
        audioManager.createPositionalAudioSource(entity, positionalData);
        // Set initial position
        audioManager.updatePositionalAudioSource(entity, positionalData, transform);
      }
    });

  // ---------------------------------------------------------------------------
  // 5. Update existing PositionalAudioSource
  // ---------------------------------------------------------------------------

  commands
    .query()
    .all(Transform3D, PositionalAudioSource)
    .each((entity, transform, positionalData) => {
      if (audioManager.hasAudio(entity)) {
        audioManager.updatePositionalAudioSource(entity, positionalData, transform);
      }
    });

  // ---------------------------------------------------------------------------
  // 6. Remove audio for entities that lost their audio components
  // ---------------------------------------------------------------------------

  // Get all entities that have audio but no AudioSource or PositionalAudio
  const entitiesWithAudio = new Set<number>();

  commands
    .query()
    .all(AudioSource)
    .each((entity) => {
      entitiesWithAudio.add(entity);
    });

  commands
    .query()
    .all(PositionalAudioSource)
    .each((entity) => {
      entitiesWithAudio.add(entity);
    });

  // ---------------------------------------------------------------------------
  // 7. Clean up audio for entities that were destroyed
  // ---------------------------------------------------------------------------
  for (const entity of audioManager.getTrackedEntities()) {
    if (!commands.isAlive(entity)) {
      audioManager.removeAudio(entity);
    }
  }
}).runIf(isGameplayActive());

/**
 * Audio cleanup system
 *
 * Handles cleanup when exiting play mode.
 * This system runs ALWAYS (not just in play mode) to detect when
 * play mode ends and dispose audio resources.
 */
export const audioCleanupSystem = system(({ commands }) => {
  const audioManager = commands.tryGetResource(AudioManager);
  if (!audioManager) {
    return;
  }

  // Only cleanup if AudioManager is initialized (meaning we were playing)
  if (!audioManager.getIsInitialized()) {
    return;
  }

  // Check if we're no longer in play mode
  const editorManager = commands.tryGetResource(EditorManager);

  // If there's no EditorManager, we're in a pure game (no editor) - don't cleanup
  if (!editorManager) {
    return;
  }

  // If we're in edit mode but audio is still initialized, dispose it
  if (editorManager.mode === 'edit') {
    audioManager.dispose();
  }
});
