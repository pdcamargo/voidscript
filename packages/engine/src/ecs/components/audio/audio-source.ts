/**
 * AudioSource Component (Non-positional Audio)
 *
 * Represents a global audio source that plays at constant volume regardless of position.
 * Use this for:
 * - Background music
 * - UI sounds
 * - Ambient soundscapes
 * - Any audio that should not be affected by 3D positioning
 *
 * For 3D spatial audio that changes based on listener position, use PositionalAudio instead.
 *
 * Audio only plays during Play Mode.
 *
 * @example
 * ```typescript
 * // Background music
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3() })
 *   .with(AudioSource, {
 *     audioClip: bgMusicAsset,
 *     volume: 0.5,
 *     loop: true,
 *     playOnAwake: true,
 *   })
 *   .build();
 * ```
 */

import { component } from '@voidscript/core';
import { RuntimeAsset } from '@voidscript/core';
import { AssetType } from '../../asset/asset-metadata.js';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

export interface AudioSourceData {
  /**
   * Reference to the audio asset (RuntimeAsset<AudioBuffer>)
   * null means no audio clip assigned
   */
  audioClip: RuntimeAsset | null;

  /**
   * Playback volume (0-1)
   * @default 1.0
   */
  volume: number;

  /**
   * Whether the audio should loop
   * @default false
   */
  loop: boolean;

  /**
   * Playback rate/speed (1 = normal, 0.5 = half speed, 2 = double speed)
   * @default 1.0
   */
  playbackRate: number;

  /**
   * Auto-play when entering play mode
   * @default true
   */
  playOnAwake: boolean;
}

export const AudioSource = component<AudioSourceData>(
  'AudioSource',
  {
    audioClip: {
      serializable: true,
      type: 'runtimeAsset',
      assetTypes: [AssetType.Audio],
      whenNullish: 'keep',
    },
    volume: {
      serializable: true,
      instanceType: Number,
    },
    loop: {
      serializable: true,
      instanceType: Boolean,
    },
    playbackRate: {
      serializable: true,
      instanceType: Number,
    },
    playOnAwake: {
      serializable: true,
      instanceType: Boolean,
    },
  },
  {
    path: 'audio',
    displayName: 'Audio Source',
    description: 'Non-positional audio source for music, UI sounds, and ambient audio.',
    defaultValue: () => ({
      audioClip: null,
      volume: 1.0,
      loop: false,
      playbackRate: 1.0,
      playOnAwake: true,
    }),
    customEditor: ({ componentData }) => {
      EditorLayout.beginLabelsWidth(['Audio Clip', 'Volume', 'Loop', 'Play on Awake', 'Playback Rate']);

      // Audio Clip picker using runtimeAssetField
      const [audioClip, audioClipChanged] = EditorLayout.runtimeAssetField(
        'Audio Clip',
        componentData.audioClip,
        {
          assetTypes: [AssetType.Audio],
          allowClear: true,
          tooltip: 'Audio asset to play'
        }
      );
      if (audioClipChanged) componentData.audioClip = audioClip;

      EditorLayout.separator();

      // Volume slider
      const [volume, volumeChanged] = EditorLayout.numberField('Volume', componentData.volume, {
        min: 0, max: 1, useSlider: true, tooltip: 'Playback volume (0-1)'
      });
      if (volumeChanged) componentData.volume = volume;

      // Loop checkbox
      const [loop, loopChanged] = EditorLayout.checkboxField('Loop', componentData.loop, {
        tooltip: 'Whether the audio loops continuously'
      });
      if (loopChanged) componentData.loop = loop;

      // Play on awake checkbox
      const [playOnAwake, playOnAwakeChanged] = EditorLayout.checkboxField('Play on Awake', componentData.playOnAwake, {
        tooltip: 'Auto-play when entering play mode'
      });
      if (playOnAwakeChanged) componentData.playOnAwake = playOnAwake;

      // Playback rate
      const [playbackRate, playbackRateChanged] = EditorLayout.numberField('Playback Rate', componentData.playbackRate, {
        min: 0.1, max: 3, useSlider: true, tooltip: 'Playback speed (1 = normal, 0.5 = half, 2 = double)'
      });
      if (playbackRateChanged) componentData.playbackRate = playbackRate;

      EditorLayout.endLabelsWidth();

      EditorLayout.separator();
      EditorLayout.hint('Audio only plays during Play Mode.');
    },
  },
);
