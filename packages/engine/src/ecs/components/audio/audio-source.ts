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

import { component } from '../../component.js';
import { RuntimeAsset } from '../../runtime-asset.js';
import { AssetDatabase } from '../../asset-database.js';
import { isAudioAssetMetadata, type AudioAssetMetadata, AssetType } from '../../asset-metadata.js';
import { ImGui } from '@mori2003/jsimgui';

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
      // Audio Clip picker
      ImGui.Text('Audio Clip:');
      ImGui.SameLine();

      const audioClip = componentData.audioClip;
      if (audioClip && audioClip.guid) {
        const metadata = AssetDatabase.getMetadata(audioClip.guid);
        if (metadata) {
          ImGui.Text(metadata.path.split('/').pop() || 'Unknown');
        } else {
          ImGui.Text('Unknown Asset');
        }
      } else {
        ImGui.TextDisabled('(None)');
      }

      ImGui.SameLine();
      const popupId = 'AudioClipPicker##AudioSource';
      if (ImGui.Button('Pick##audioClip')) {
        ImGui.OpenPopup(popupId);
      }

      // Asset picker modal
      ImGui.SetNextWindowSize({ x: 500, y: 400 }, ImGui.Cond.FirstUseEver);
      if (ImGui.BeginPopupModal(popupId, null, ImGui.WindowFlags.None)) {
        ImGui.Text('Select an audio clip:');
        ImGui.Separator();

        // Get all audio assets
        const allGuids = AssetDatabase.getAllGuids();
        const audioAssets: { guid: string; metadata: AudioAssetMetadata }[] = [];

        for (const guid of allGuids) {
          const metadata = AssetDatabase.getMetadata(guid);
          if (metadata && isAudioAssetMetadata(metadata)) {
            audioAssets.push({ guid, metadata });
          }
        }

        if (audioAssets.length === 0) {
          ImGui.TextColored({ x: 1, y: 0.5, z: 0, w: 1 }, 'No audio assets found.');
          ImGui.TextDisabled('Register audio assets in your Application config.');
        } else {
          ImGui.BeginChild('AudioAssetGrid', { x: 0, y: -40 }, ImGui.WindowFlags.None);

          const itemsPerRow = 3;
          for (let i = 0; i < audioAssets.length; i++) {
            const asset = audioAssets[i];
            if (!asset) continue;

            if (i > 0 && i % itemsPerRow !== 0) {
              ImGui.SameLine();
            }

            ImGui.BeginGroup();

            const isSelected = audioClip?.guid === asset.guid;
            if (isSelected) {
              ImGui.PushStyleColorImVec4(ImGui.Col.Button, { x: 0.2, y: 0.5, z: 0.8, w: 1.0 });
            }

            const fileName = asset.metadata.path.split('/').pop() || 'Unknown';
            if (ImGui.Button(`${fileName}##${asset.guid}`, { x: 150, y: 60 })) {
              // Import RuntimeAssetManager to get or create the asset
              import('../../runtime-asset-manager.js').then(({ RuntimeAssetManager }) => {
                const runtimeAsset = RuntimeAssetManager.get().getOrCreate(asset.guid, asset.metadata);
                componentData.audioClip = runtimeAsset;
              });
              ImGui.CloseCurrentPopup();
            }

            if (isSelected) {
              ImGui.PopStyleColor();
            }

            // Show duration if available
            if (asset.metadata.duration !== undefined) {
              const duration = asset.metadata.duration.toFixed(1);
              ImGui.TextDisabled(`${duration}s`);
            }

            ImGui.EndGroup();
          }

          ImGui.EndChild();
        }

        ImGui.Separator();
        if (ImGui.Button('Clear', { x: 80, y: 0 })) {
          componentData.audioClip = null;
          ImGui.CloseCurrentPopup();
        }
        ImGui.SameLine();
        if (ImGui.Button('Cancel', { x: 80, y: 0 })) {
          ImGui.CloseCurrentPopup();
        }

        ImGui.EndPopup();
      }

      ImGui.Separator();

      // Volume slider
      ImGui.Text('Volume:');
      const volume: [number] = [componentData.volume];
      if (ImGui.SliderFloat('##volume_AudioSource', volume, 0.0, 1.0)) {
        componentData.volume = Math.max(0, Math.min(1, volume[0]));
      }

      // Loop checkbox
      const loop: [boolean] = [componentData.loop];
      if (ImGui.Checkbox('Loop##loop_AudioSource', loop)) {
        componentData.loop = loop[0];
      }

      // Play on awake checkbox
      const playOnAwake: [boolean] = [componentData.playOnAwake];
      if (ImGui.Checkbox('Play on Awake##playOnAwake_AudioSource', playOnAwake)) {
        componentData.playOnAwake = playOnAwake[0];
      }

      // Playback rate
      ImGui.Text('Playback Rate:');
      const playbackRate: [number] = [componentData.playbackRate];
      if (ImGui.SliderFloat('##playbackRate_AudioSource', playbackRate, 0.1, 3.0)) {
        componentData.playbackRate = Math.max(0.1, Math.min(3, playbackRate[0]));
      }

      ImGui.Separator();
      ImGui.TextColored({ x: 0.7, y: 0.7, z: 0.7, w: 1.0 }, 'Audio only plays during Play Mode.');
    },
  },
);
