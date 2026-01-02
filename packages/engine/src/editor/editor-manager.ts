/**
 * EditorManager - Central state machine for editor play/edit modes
 *
 * State Machine:
 *    EDIT ──play()──> PLAY ──pause()──> PAUSE
 *      ^                                   │
 *      └────────────stop()─────────────────┘
 *
 * Features:
 * - Manages edit/play/pause state transitions
 * - Captures world snapshot before play, restores on stop
 * - Supports single-frame stepping in pause mode
 */

import type { Scene } from '../ecs/scene.js';
import type { Command } from '../ecs/command.js';
import type { EditorMode } from './editor-mode.js';
import { SceneSnapshot } from './scene-snapshot.js';

/**
 * Event types emitted by EditorManager
 */
export type EditorManagerEvent =
  | { type: 'mode-changed'; from: EditorMode; to: EditorMode }
  | { type: 'play-started' }
  | { type: 'play-paused' }
  | { type: 'play-resumed' }
  | { type: 'play-stopping' } // Fired BEFORE world restore - use for cleanup
  | { type: 'play-stopped' }  // Fired AFTER world restore
  | { type: 'frame-stepped' };

/**
 * Event listener for EditorManager events
 */
export type EditorManagerEventListener = (event: EditorManagerEvent) => void;

/**
 * EditorManager - Central editor state machine
 */
export class EditorManager {
  private scene: Scene;
  private _mode: EditorMode = 'edit';
  private sceneSnapshot: SceneSnapshot | null = null;
  private _stepRequested = false;
  private listeners: Set<EditorManagerEventListener> = new Set();

  // Commands factory for world operations
  private createCommands: () => Command;

  /**
   * When true, editor viewports are handling scene rendering.
   * The main renderer.render() call should be skipped.
   */
  private _useViewportRendering = false;

  constructor(scene: Scene, commandFactory: () => Command) {
    this.scene = scene;
    this.createCommands = commandFactory;
  }

  /**
   * Whether editor viewports are handling scene rendering
   */
  get useViewportRendering(): boolean {
    return this._useViewportRendering;
  }

  /**
   * Set whether editor viewports are handling scene rendering.
   * When true, the main renderer.render() call will be skipped.
   */
  setUseViewportRendering(value: boolean): void {
    this._useViewportRendering = value;
  }

  /**
   * Current editor mode
   */
  get mode(): EditorMode {
    return this._mode;
  }

  /**
   * Whether gameplay systems should run this frame
   */
  isPlayMode(): boolean {
    return this._mode === 'play';
  }

  /**
   * Whether editor tools/gizmos should be active
   */
  isEditorToolsActive(): boolean {
    return this._mode === 'edit' || this._mode === 'pause';
  }

  /**
   * Whether a step frame was requested (only valid in pause mode)
   */
  isStepRequested(): boolean {
    return this._stepRequested;
  }

  /**
   * Clear step request (call after executing the step frame)
   */
  clearStepRequest(): void {
    this._stepRequested = false;
  }

  /**
   * Enter play mode
   * - Captures world snapshot for later restoration
   * - Switches mode to 'play'
   */
  play(): void {
    if (this._mode === 'play') {
      return; // Already playing
    }

    const previousMode = this._mode;

    // Capture world state before playing (only if coming from edit mode)
    if (this._mode === 'edit') {
      const commands = this.createCommands();
      this.sceneSnapshot = SceneSnapshot.capture(this.scene, commands);
    }

    this._mode = 'play';
    this._stepRequested = false;

    this.emit({ type: 'mode-changed', from: previousMode, to: 'play' });
    this.emit({ type: previousMode === 'pause' ? 'play-resumed' : 'play-started' });
  }

  /**
   * Pause playback
   * - Freezes gameplay systems
   * - Allows frame-by-frame stepping
   */
  pause(): void {
    if (this._mode !== 'play') {
      return; // Can only pause during play
    }

    const previousMode = this._mode;
    this._mode = 'pause';

    this.emit({ type: 'mode-changed', from: previousMode, to: 'pause' });
    this.emit({ type: 'play-paused' });
  }

  /**
   * Resume playback from pause
   */
  resume(): void {
    if (this._mode !== 'pause') {
      return; // Can only resume from pause
    }

    this.play();
  }

  /**
   * Stop playback and return to edit mode
   * - Emits 'play-stopping' event for cleanup BEFORE world restore
   * - Restores world to pre-play snapshot
   * - Switches mode to 'edit'
   * - Emits 'play-stopped' event AFTER world restore
   */
  stop(): void {
    if (this._mode === 'edit') {
      return; // Already in edit mode
    }

    const previousMode = this._mode;

    // Emit play-stopping BEFORE world restore
    // This allows systems to clean up Three.js objects before entities are cleared
    this.emit({ type: 'play-stopping' });

    // Restore world state if we have a snapshot
    if (this.sceneSnapshot) {
      const commands = this.createCommands();
      this.sceneSnapshot.restore(this.scene, commands);
      this.sceneSnapshot = null;
    }

    this._mode = 'edit';
    this._stepRequested = false;

    this.emit({ type: 'mode-changed', from: previousMode, to: 'edit' });
    this.emit({ type: 'play-stopped' });
  }

  /**
   * Request a single frame step (only works in pause mode)
   */
  step(): void {
    if (this._mode !== 'pause') {
      return; // Can only step in pause mode
    }

    this._stepRequested = true;
    this.emit({ type: 'frame-stepped' });
  }

  /**
   * Toggle between play and pause
   */
  togglePlayPause(): void {
    if (this._mode === 'play') {
      this.pause();
    } else if (this._mode === 'pause') {
      this.play();
    } else {
      // In edit mode - start playing
      this.play();
    }
  }

  /**
   * Add event listener
   */
  addEventListener(listener: EditorManagerEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: EditorManagerEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: EditorManagerEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * Check if there's a snapshot that can be restored
   */
  hasSnapshot(): boolean {
    return this.sceneSnapshot !== null;
  }

  /**
   * Get snapshot entity count (for debugging)
   */
  getSnapshotEntityCount(): number {
    return this.sceneSnapshot?.entityCount ?? 0;
  }
}
