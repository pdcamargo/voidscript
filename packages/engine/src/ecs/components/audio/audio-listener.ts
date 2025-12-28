/**
 * AudioListener Component
 *
 * Represents the listener (receiver) in 3D audio space.
 * Typically represents the player/user's "ears" in the game world.
 *
 * Unlike traditional implementations, AudioListener is NOT tied to the Camera.
 * It can be placed on any entity with a Transform3D component, allowing flexibility
 * for cases like:
 * - First-person games: Attach to the player entity
 * - Third-person games: Attach to a dedicated listener entity near the character
 * - VR: Attach to the head tracking entity
 *
 * Only one AudioListener should be active in the scene at a time.
 * If multiple are present, the first one found will be used.
 *
 * @example
 * ```typescript
 * // Create audio listener on player entity
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 1.7, 0) })
 *   .with(AudioListener, { volume: 1.0 })
 *   .build();
 *
 * // Or as child of camera
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 0, 0) })
 *   .with(LocalTransform3D, { ... })
 *   .with(Parent, { id: cameraEntity })
 *   .with(AudioListener, { volume: 1.0 })
 *   .build();
 * ```
 */

import { component } from '../../component.js';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

export interface AudioListenerData {
  /**
   * Master volume for all audio (0-1)
   * Acts as a global volume multiplier for all audio sources
   * @default 1.0
   */
  volume: number;
}

export const AudioListener = component<AudioListenerData>(
  'AudioListener',
  {
    volume: {
      serializable: true,
      instanceType: Number,
    },
  },
  {
    path: 'audio',
    displayName: 'Audio Listener',
    description: 'Audio listener for 3D spatial audio. Place on any entity with Transform3D.',
    defaultValue: () => ({
      volume: 1.0,
    }),
    customEditor: ({ componentData }) => {
      EditorLayout.beginLabelsWidth(['Master Volume']);

      const [volume, volumeChanged] = EditorLayout.numberField('Master Volume', componentData.volume, {
        min: 0, max: 1, useSlider: true, tooltip: 'Master volume for all audio (0-1)',
      });
      if (volumeChanged) componentData.volume = volume;

      EditorLayout.sameLine();
      EditorLayout.textDisabled(`(${Math.round(componentData.volume * 100)}%)`);

      EditorLayout.endLabelsWidth();

      EditorLayout.separator();
      EditorLayout.hint('Note: Only one AudioListener should be active.');
      EditorLayout.hint('Audio only plays during Play Mode.');
    },
  },
);
