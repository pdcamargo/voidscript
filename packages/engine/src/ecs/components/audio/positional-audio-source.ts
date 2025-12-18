/**
 * PositionalAudioSource Component (3D Spatial Audio)
 *
 * Represents a 3D audio source that changes volume and panning based on
 * the listener's position relative to the source.
 *
 * Use this for:
 * - Sound effects from objects in the world
 * - Character voices/footsteps
 * - Environmental sounds (water, fire, machinery)
 * - Any audio that should feel "positioned" in 3D space
 *
 * Requires an entity with AudioListener component in the scene.
 * Position is taken from the entity's Transform3D component.
 *
 * Audio only plays during Play Mode.
 *
 * @example
 * ```typescript
 * // Campfire crackling sound
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(10, 0, 5) })
 *   .with(PositionalAudioSource, {
 *     audioClip: campfireSound,
 *     volume: 0.8,
 *     loop: true,
 *     playOnAwake: true,
 *     refDistance: 1,
 *     maxDistance: 20,
 *     rolloffFactor: 1,
 *   })
 *   .build();
 * ```
 */

import { component } from '../../component.js';
import { RuntimeAsset } from '../../runtime-asset.js';
import { AssetDatabase } from '../../asset-database.js';
import { isAudioAssetMetadata, type AudioAssetMetadata, AssetType } from '../../asset-metadata.js';
import { ImGui } from '@mori2003/jsimgui';

/**
 * Distance model for audio attenuation
 * - 'linear': Linear rolloff (volume = 1 - rolloffFactor * (distance - refDistance) / (maxDistance - refDistance))
 * - 'inverse': Inverse distance (volume = refDistance / (refDistance + rolloffFactor * (distance - refDistance)))
 * - 'exponential': Exponential rolloff (volume = pow(distance / refDistance, -rolloffFactor))
 */
export type DistanceModel = 'linear' | 'inverse' | 'exponential';

export interface PositionalAudioSourceData {
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

  /**
   * Reference distance for volume attenuation
   * At this distance, volume is at full (before rolloff starts)
   * @default 1
   */
  refDistance: number;

  /**
   * Maximum distance for audio
   * Beyond this distance, volume is 0 (for linear) or minimum (for other models)
   * @default 10000
   */
  maxDistance: number;

  /**
   * Rolloff factor for attenuation curve
   * Higher values = faster volume falloff with distance
   * @default 1
   */
  rolloffFactor: number;

  /**
   * Distance model for calculating volume attenuation
   * @default 'inverse'
   */
  distanceModel: DistanceModel;

  /**
   * Inner cone angle in degrees for directional audio
   * Full volume within this cone
   * @default 360 (omnidirectional)
   */
  coneInnerAngle: number;

  /**
   * Outer cone angle in degrees for directional audio
   * Volume transitions from full to coneOuterGain between inner and outer cone
   * @default 360 (omnidirectional)
   */
  coneOuterAngle: number;

  /**
   * Volume outside the outer cone (0-1)
   * @default 0
   */
  coneOuterGain: number;
}

export const PositionalAudioSource = component<PositionalAudioSourceData>(
  'PositionalAudioSource',
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
    refDistance: {
      serializable: true,
      instanceType: Number,
    },
    maxDistance: {
      serializable: true,
      instanceType: Number,
    },
    rolloffFactor: {
      serializable: true,
      instanceType: Number,
    },
    distanceModel: {
      serializable: true,
      instanceType: String,
    },
    coneInnerAngle: {
      serializable: true,
      instanceType: Number,
    },
    coneOuterAngle: {
      serializable: true,
      instanceType: Number,
    },
    coneOuterGain: {
      serializable: true,
      instanceType: Number,
    },
  },
  {
    path: 'audio',
    displayName: 'Positional Audio',
    description: '3D spatial audio source with distance-based attenuation.',
    defaultValue: () => ({
      audioClip: null,
      volume: 1.0,
      loop: false,
      playbackRate: 1.0,
      playOnAwake: true,
      refDistance: 1,
      maxDistance: 10000,
      rolloffFactor: 1,
      distanceModel: 'inverse' as DistanceModel,
      coneInnerAngle: 360,
      coneOuterAngle: 360,
      coneOuterGain: 0,
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
      const popupId = 'AudioClipPicker##PositionalAudioSource';
      if (ImGui.Button('Pick##audioClip')) {
        ImGui.OpenPopup(popupId);
      }

      // Asset picker modal (same as AudioSource)
      ImGui.SetNextWindowSize({ x: 500, y: 400 }, ImGui.Cond.FirstUseEver);
      if (ImGui.BeginPopupModal(popupId, null, ImGui.WindowFlags.None)) {
        ImGui.Text('Select an audio clip:');
        ImGui.Separator();

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
              import('../../runtime-asset-manager.js').then(({ RuntimeAssetManager }) => {
                const runtimeAsset = RuntimeAssetManager.get().getOrCreate(asset.guid, asset.metadata);
                componentData.audioClip = runtimeAsset;
              });
              ImGui.CloseCurrentPopup();
            }

            if (isSelected) {
              ImGui.PopStyleColor();
            }

            if (asset.metadata.duration !== undefined) {
              ImGui.TextDisabled(`${asset.metadata.duration.toFixed(1)}s`);
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

      // Basic playback settings
      ImGui.Text('Volume:');
      const volume: [number] = [componentData.volume];
      if (ImGui.SliderFloat('##volume_PositionalAudioSource', volume, 0.0, 1.0)) {
        componentData.volume = Math.max(0, Math.min(1, volume[0]));
      }

      const loop: [boolean] = [componentData.loop];
      if (ImGui.Checkbox('Loop##loop_PositionalAudioSource', loop)) {
        componentData.loop = loop[0];
      }

      const playOnAwake: [boolean] = [componentData.playOnAwake];
      if (ImGui.Checkbox('Play on Awake##playOnAwake_PositionalAudioSource', playOnAwake)) {
        componentData.playOnAwake = playOnAwake[0];
      }

      ImGui.Text('Playback Rate:');
      const playbackRate: [number] = [componentData.playbackRate];
      if (ImGui.SliderFloat('##playbackRate_PositionalAudioSource', playbackRate, 0.1, 3.0)) {
        componentData.playbackRate = Math.max(0.1, Math.min(3, playbackRate[0]));
      }

      ImGui.Separator();
      ImGui.Text('3D Spatial Settings');

      // Distance model dropdown
      ImGui.Text('Distance Model:');
      ImGui.SameLine();
      const distanceModels: DistanceModel[] = ['linear', 'inverse', 'exponential'];
      if (ImGui.BeginCombo('##distanceModel_PositionalAudioSource', componentData.distanceModel)) {
        for (const model of distanceModels) {
          const isSelected = componentData.distanceModel === model;
          if (ImGui.Selectable(model, isSelected)) {
            componentData.distanceModel = model;
          }
          if (isSelected) {
            ImGui.SetItemDefaultFocus();
          }
        }
        ImGui.EndCombo();
      }

      // Distance parameters
      ImGui.Text('Ref Distance:');
      const refDistance: [number] = [componentData.refDistance];
      if (ImGui.DragFloat('##refDistance_PositionalAudioSource', refDistance, 0.1, 0.1, 100)) {
        componentData.refDistance = Math.max(0.1, refDistance[0]);
      }

      ImGui.Text('Max Distance:');
      const maxDistance: [number] = [componentData.maxDistance];
      if (ImGui.DragFloat('##maxDistance_PositionalAudioSource', maxDistance, 1, 1, 100000)) {
        componentData.maxDistance = Math.max(1, maxDistance[0]);
      }

      ImGui.Text('Rolloff Factor:');
      const rolloffFactor: [number] = [componentData.rolloffFactor];
      if (ImGui.DragFloat('##rolloffFactor_PositionalAudioSource', rolloffFactor, 0.1, 0, 10)) {
        componentData.rolloffFactor = Math.max(0, rolloffFactor[0]);
      }

      ImGui.Separator();
      ImGui.Text('Directional Audio (Cone)');

      ImGui.Text('Inner Cone Angle:');
      const coneInnerAngle: [number] = [componentData.coneInnerAngle];
      if (ImGui.SliderFloat('##coneInnerAngle_PositionalAudioSource', coneInnerAngle, 0, 360)) {
        componentData.coneInnerAngle = Math.max(0, Math.min(360, coneInnerAngle[0]));
      }

      ImGui.Text('Outer Cone Angle:');
      const coneOuterAngle: [number] = [componentData.coneOuterAngle];
      if (ImGui.SliderFloat('##coneOuterAngle_PositionalAudioSource', coneOuterAngle, 0, 360)) {
        componentData.coneOuterAngle = Math.max(0, Math.min(360, coneOuterAngle[0]));
      }

      ImGui.Text('Outer Gain:');
      const coneOuterGain: [number] = [componentData.coneOuterGain];
      if (ImGui.SliderFloat('##coneOuterGain_PositionalAudioSource', coneOuterGain, 0.0, 1.0)) {
        componentData.coneOuterGain = Math.max(0, Math.min(1, coneOuterGain[0]));
      }

      ImGui.Separator();
      ImGui.TextColored({ x: 0.7, y: 0.7, z: 0.7, w: 1.0 }, 'Audio only plays during Play Mode.');
    },
  },
);
