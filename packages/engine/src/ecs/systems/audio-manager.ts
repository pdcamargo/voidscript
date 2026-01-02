/**
 * AudioManager Resource
 *
 * Manages the lifecycle of Three.js audio objects for the ECS.
 * Similar to Render3DManager but for audio.
 *
 * The AudioManager:
 * - Creates and manages THREE.AudioListener
 * - Creates THREE.Audio for AudioSource components
 * - Creates THREE.PositionalAudio for PositionalAudio components
 * - Handles audio loading and playback
 * - Cleans up audio on play mode exit
 *
 * Audio only plays during Play Mode.
 *
 * @example
 * ```typescript
 * // Register in application
 * const audioManager = new AudioManager();
 * app.insertResource(audioManager);
 *
 * // Initialize when entering play mode
 * audioManager.initialize();
 *
 * // Dispose when exiting play mode
 * audioManager.dispose();
 * ```
 */

import * as THREE from 'three';
import type { Entity } from '@voidscript/core';
import type { AudioSourceData } from '../components/audio/audio-source.js';
import type { PositionalAudioSourceData } from '../components/audio/positional-audio-source.js';
import type { AudioListenerData } from '../components/audio/audio-listener.js';
import type { Transform3DData } from '../components/rendering/transform-3d.js';

interface AudioEntry {
  type: 'audio' | 'positional';
  audio: THREE.Audio | THREE.PositionalAudio;
  entity: Entity;
  assetGuid: string | null;
  isLoading: boolean;
  hasStarted: boolean;
}

interface ListenerEntry {
  listener: THREE.AudioListener;
  entity: Entity;
  /** Dummy Object3D to position the listener independently */
  container: THREE.Object3D;
}

/**
 * AudioManager - Manages Three.js audio objects for ECS entities
 */
export class AudioManager {
  private scene: THREE.Scene | null = null;
  private listenerEntry: ListenerEntry | null = null;
  private audioEntries: Map<Entity, AudioEntry> = new Map();
  private isInitialized: boolean = false;

  /**
   * Initialize the audio manager
   * Called when entering play mode
   *
   * @param scene - The Three.js scene to add audio objects to
   */
  initialize(scene: THREE.Scene): void {
    if (this.isInitialized) {
      console.warn('[AudioManager] Already initialized');
      return;
    }

    this.scene = scene;
    this.isInitialized = true;
  }

  /**
   * Check if the audio manager is initialized
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get or create the AudioListener
   * Only one listener should exist at a time
   */
  getOrCreateListener(entity: Entity, data: AudioListenerData): THREE.AudioListener {
    if (this.listenerEntry) {
      // Update existing listener
      this.listenerEntry.listener.setMasterVolume(data.volume);
      return this.listenerEntry.listener;
    }

    // Create new listener
    const listener = new THREE.AudioListener();
    listener.setMasterVolume(data.volume);

    // Create a container Object3D to position the listener
    // This allows the listener to be positioned independently of the camera
    const container = new THREE.Object3D();
    container.add(listener);

    if (this.scene) {
      this.scene.add(container);
    }

    this.listenerEntry = {
      listener,
      entity,
      container,
    };

    return listener;
  }

  /**
   * Update the listener's position from Transform3D
   */
  updateListener(entity: Entity, data: AudioListenerData, transform: Transform3DData): void {
    if (!this.listenerEntry || this.listenerEntry.entity !== entity) {
      return;
    }

    // Update volume
    this.listenerEntry.listener.setMasterVolume(data.volume);

    // Update position via container
    const container = this.listenerEntry.container;
    container.position.set(transform.position.x, transform.position.y, transform.position.z);
    container.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z, 'YXZ');
  }

  /**
   * Remove the listener
   */
  removeListener(entity: Entity): void {
    if (!this.listenerEntry || this.listenerEntry.entity !== entity) {
      return;
    }

    if (this.scene) {
      this.scene.remove(this.listenerEntry.container);
    }

    this.listenerEntry = null;
  }

  /**
   * Check if a listener exists
   */
  hasListener(): boolean {
    return this.listenerEntry !== null;
  }

  /**
   * Get the current listener
   */
  getListener(): THREE.AudioListener | null {
    return this.listenerEntry?.listener ?? null;
  }

  // ---------------------------------------------------------------------------
  // AudioSource (Non-positional)
  // ---------------------------------------------------------------------------

  /**
   * Create an AudioSource (non-positional audio)
   */
  createAudioSource(entity: Entity, data: AudioSourceData): void {
    if (!this.listenerEntry) {
      console.warn('[AudioManager] Cannot create AudioSource without AudioListener');
      return;
    }

    if (this.audioEntries.has(entity)) {
      return;
    }

    const audio = new THREE.Audio(this.listenerEntry.listener);
    audio.setVolume(data.volume);
    audio.setLoop(data.loop);
    audio.setPlaybackRate(data.playbackRate);

    const entry: AudioEntry = {
      type: 'audio',
      audio,
      entity,
      assetGuid: data.audioClip?.guid ?? null,
      isLoading: false,
      hasStarted: false,
    };

    this.audioEntries.set(entity, entry);

    // Load and potentially play the audio
    if (data.audioClip) {
      this.loadAudioBuffer(entry, data.audioClip, data.playOnAwake);
    }
  }

  /**
   * Update an AudioSource
   */
  updateAudioSource(entity: Entity, data: AudioSourceData): void {
    const entry = this.audioEntries.get(entity);
    if (!entry || entry.type !== 'audio') {
      return;
    }

    const audio = entry.audio as THREE.Audio;

    // Update properties
    audio.setVolume(data.volume);
    audio.setLoop(data.loop);
    audio.setPlaybackRate(data.playbackRate);

    // Check if audio clip changed
    const newGuid = data.audioClip?.guid ?? null;
    if (newGuid !== entry.assetGuid) {
      entry.assetGuid = newGuid;
      entry.hasStarted = false;

      // Stop current playback
      if (audio.isPlaying) {
        audio.stop();
      }

      // Load new audio
      if (data.audioClip) {
        this.loadAudioBuffer(entry, data.audioClip, data.playOnAwake);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // PositionalAudioSource (3D Spatial)
  // ---------------------------------------------------------------------------

  /**
   * Create a PositionalAudioSource (3D spatial audio)
   */
  createPositionalAudioSource(entity: Entity, data: PositionalAudioSourceData): void {
    if (!this.listenerEntry) {
      console.warn('[AudioManager] Cannot create PositionalAudioSource without AudioListener');
      return;
    }

    if (this.audioEntries.has(entity)) {
      return;
    }

    const audio = new THREE.PositionalAudio(this.listenerEntry.listener);
    audio.setVolume(data.volume);
    audio.setLoop(data.loop);
    audio.setPlaybackRate(data.playbackRate);
    audio.setRefDistance(data.refDistance);
    audio.setMaxDistance(data.maxDistance);
    audio.setRolloffFactor(data.rolloffFactor);
    audio.setDistanceModel(data.distanceModel);
    audio.setDirectionalCone(data.coneInnerAngle, data.coneOuterAngle, data.coneOuterGain);

    // Add to scene for proper 3D positioning
    if (this.scene) {
      this.scene.add(audio);
    }

    const entry: AudioEntry = {
      type: 'positional',
      audio,
      entity,
      assetGuid: data.audioClip?.guid ?? null,
      isLoading: false,
      hasStarted: false,
    };

    this.audioEntries.set(entity, entry);

    // Load and potentially play the audio
    if (data.audioClip) {
      this.loadAudioBuffer(entry, data.audioClip, data.playOnAwake);
    }
  }

  /**
   * Update a PositionalAudioSource
   */
  updatePositionalAudioSource(entity: Entity, data: PositionalAudioSourceData, transform: Transform3DData): void {
    const entry = this.audioEntries.get(entity);
    if (!entry || entry.type !== 'positional') {
      return;
    }

    const audio = entry.audio as THREE.PositionalAudio;

    // Update properties
    audio.setVolume(data.volume);
    audio.setLoop(data.loop);
    audio.setPlaybackRate(data.playbackRate);
    audio.setRefDistance(data.refDistance);
    audio.setMaxDistance(data.maxDistance);
    audio.setRolloffFactor(data.rolloffFactor);
    audio.setDistanceModel(data.distanceModel);
    audio.setDirectionalCone(data.coneInnerAngle, data.coneOuterAngle, data.coneOuterGain);

    // Update position
    audio.position.set(transform.position.x, transform.position.y, transform.position.z);
    audio.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z, 'YXZ');

    // Check if audio clip changed
    const newGuid = data.audioClip?.guid ?? null;
    if (newGuid !== entry.assetGuid) {
      entry.assetGuid = newGuid;
      entry.hasStarted = false;

      if (audio.isPlaying) {
        audio.stop();
      }

      if (data.audioClip) {
        this.loadAudioBuffer(entry, data.audioClip, data.playOnAwake);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Common Methods
  // ---------------------------------------------------------------------------

  /**
   * Load audio buffer for an entry
   */
  private async loadAudioBuffer(
    entry: AudioEntry,
    runtimeAsset: { guid: string; isLoaded: boolean; data: AudioBuffer | null; load(): Promise<void> },
    playOnAwake: boolean,
  ): Promise<void> {
    if (entry.isLoading) {
      return;
    }

    entry.isLoading = true;

    try {
      // Load if not already loaded
      if (!runtimeAsset.isLoaded) {
        await runtimeAsset.load();
      }

      // Verify asset is still the same (could have changed during async load)
      if (entry.assetGuid !== runtimeAsset.guid) {
        entry.isLoading = false;
        return;
      }

      const buffer = runtimeAsset.data;
      if (!buffer) {
        console.warn(`[AudioManager] Failed to load audio buffer for entity ${entry.entity}`);
        entry.isLoading = false;
        return;
      }

      // Set the buffer
      entry.audio.setBuffer(buffer);

      // Play if playOnAwake and not already started
      if (playOnAwake && !entry.hasStarted) {
        entry.hasStarted = true;
        entry.audio.play();
      }

      entry.isLoading = false;
    } catch (error) {
      console.error(`[AudioManager] Error loading audio for entity ${entry.entity}:`, error);
      entry.isLoading = false;
    }
  }

  /**
   * Remove audio for an entity
   */
  removeAudio(entity: Entity): void {
    const entry = this.audioEntries.get(entity);
    if (!entry) {
      return;
    }

    // Stop playback
    if (entry.audio.isPlaying) {
      entry.audio.stop();
    }

    // Remove from scene if positional
    if (entry.type === 'positional' && this.scene) {
      this.scene.remove(entry.audio);
    }

    // Disconnect
    entry.audio.disconnect();

    this.audioEntries.delete(entity);
  }

  /**
   * Check if an entity has audio
   */
  hasAudio(entity: Entity): boolean {
    return this.audioEntries.has(entity);
  }

  /**
   * Get audio for an entity
   */
  getAudio(entity: Entity): THREE.Audio | THREE.PositionalAudio | null {
    return this.audioEntries.get(entity)?.audio ?? null;
  }

  /**
   * Play audio for an entity
   */
  play(entity: Entity): void {
    const entry = this.audioEntries.get(entity);
    if (!entry) {
      return;
    }

    if (!entry.audio.isPlaying && entry.audio.buffer) {
      entry.audio.play();
    }
  }

  /**
   * Pause audio for an entity
   */
  pause(entity: Entity): void {
    const entry = this.audioEntries.get(entity);
    if (!entry) {
      return;
    }

    if (entry.audio.isPlaying) {
      entry.audio.pause();
    }
  }

  /**
   * Stop audio for an entity
   */
  stop(entity: Entity): void {
    const entry = this.audioEntries.get(entity);
    if (!entry) {
      return;
    }

    if (entry.audio.isPlaying) {
      entry.audio.stop();
    }
  }

  /**
   * Get statistics
   */
  getStats(): { listenerCount: number; audioSourceCount: number; positionalAudioCount: number } {
    let audioSourceCount = 0;
    let positionalAudioCount = 0;

    for (const entry of this.audioEntries.values()) {
      if (entry.type === 'audio') {
        audioSourceCount++;
      } else {
        positionalAudioCount++;
      }
    }

    return {
      listenerCount: this.listenerEntry ? 1 : 0,
      audioSourceCount,
      positionalAudioCount,
    };
  }

  /**
   * Get all tracked entity IDs (for cleanup checks)
   */
  getTrackedEntities(): Entity[] {
    return Array.from(this.audioEntries.keys());
  }

  /**
   * Dispose all audio resources
   * Called when exiting play mode
   */
  dispose(): void {
    // Stop and remove all audio sources
    for (const entity of this.audioEntries.keys()) {
      this.removeAudio(entity);
    }
    this.audioEntries.clear();

    // Remove listener
    if (this.listenerEntry) {
      if (this.scene) {
        this.scene.remove(this.listenerEntry.container);
      }
      this.listenerEntry = null;
    }

    this.scene = null;
    this.isInitialized = false;
  }
}

// Register AudioManager as a resource (internal, not serializable)
import { registerResource } from '@voidscript/core';
registerResource(AudioManager, false, {
  path: 'audio',
  displayName: 'Audio Manager',
  description: 'Manages Three.js audio objects for ECS entities',
  builtIn: true,
});
