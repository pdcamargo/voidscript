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
import { AssetType } from '../../asset-metadata.js';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

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
      EditorLayout.beginLabelsWidth(['Audio Clip', 'Volume', 'Loop', 'Play on Awake', 'Playback Rate']);

      // Audio Clip picker
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

      // Basic playback settings
      const [volume, volumeChanged] = EditorLayout.numberField('Volume', componentData.volume, {
        min: 0, max: 1, useSlider: true, tooltip: 'Playback volume (0-1)'
      });
      if (volumeChanged) componentData.volume = volume;

      const [loop, loopChanged] = EditorLayout.checkboxField('Loop', componentData.loop, {
        tooltip: 'Whether the audio loops continuously'
      });
      if (loopChanged) componentData.loop = loop;

      const [playOnAwake, playOnAwakeChanged] = EditorLayout.checkboxField('Play on Awake', componentData.playOnAwake, {
        tooltip: 'Auto-play when entering play mode'
      });
      if (playOnAwakeChanged) componentData.playOnAwake = playOnAwake;

      const [playbackRate, playbackRateChanged] = EditorLayout.numberField('Playback Rate', componentData.playbackRate, {
        min: 0.1, max: 3, useSlider: true, tooltip: 'Playback speed (1 = normal, 0.5 = half, 2 = double)'
      });
      if (playbackRateChanged) componentData.playbackRate = playbackRate;

      EditorLayout.endLabelsWidth();

      EditorLayout.separator();
      EditorLayout.header('3D Spatial Settings', { r: 0.6, g: 0.8, b: 1 });

      EditorLayout.beginLabelsWidth(['Distance Model', 'Ref Distance', 'Max Distance', 'Rolloff Factor']);

      // Distance model dropdown
      const DistanceModelEnum = { linear: 'linear', inverse: 'inverse', exponential: 'exponential' } as const;
      const [distanceModel, distanceModelChanged] = EditorLayout.enumField('Distance Model', componentData.distanceModel, DistanceModelEnum, {
        tooltip: 'Algorithm for volume attenuation over distance'
      });
      if (distanceModelChanged) componentData.distanceModel = distanceModel;

      // Distance parameters
      const [refDistance, refDistanceChanged] = EditorLayout.numberField('Ref Distance', componentData.refDistance, {
        min: 0.1, max: 100, speed: 0.1, tooltip: 'Distance at which volume is full (before rolloff)'
      });
      if (refDistanceChanged) componentData.refDistance = refDistance;

      const [maxDistance, maxDistanceChanged] = EditorLayout.numberField('Max Distance', componentData.maxDistance, {
        min: 1, max: 100000, speed: 1, tooltip: 'Maximum audible distance'
      });
      if (maxDistanceChanged) componentData.maxDistance = maxDistance;

      const [rolloffFactor, rolloffFactorChanged] = EditorLayout.numberField('Rolloff Factor', componentData.rolloffFactor, {
        min: 0, max: 10, speed: 0.1, tooltip: 'Speed of volume falloff with distance'
      });
      if (rolloffFactorChanged) componentData.rolloffFactor = rolloffFactor;

      EditorLayout.endLabelsWidth();

      EditorLayout.separator();
      EditorLayout.header('Directional Audio (Cone)', { r: 0.6, g: 0.8, b: 1 });

      EditorLayout.beginLabelsWidth(['Inner Cone Angle', 'Outer Cone Angle', 'Outer Gain']);

      const [coneInnerAngle, coneInnerAngleChanged] = EditorLayout.numberField('Inner Cone Angle', componentData.coneInnerAngle, {
        min: 0, max: 360, useSlider: true, tooltip: 'Full volume within this cone (degrees)'
      });
      if (coneInnerAngleChanged) componentData.coneInnerAngle = coneInnerAngle;

      const [coneOuterAngle, coneOuterAngleChanged] = EditorLayout.numberField('Outer Cone Angle', componentData.coneOuterAngle, {
        min: 0, max: 360, useSlider: true, tooltip: 'Volume transitions to outer gain between inner and outer cone'
      });
      if (coneOuterAngleChanged) componentData.coneOuterAngle = coneOuterAngle;

      const [coneOuterGain, coneOuterGainChanged] = EditorLayout.numberField('Outer Gain', componentData.coneOuterGain, {
        min: 0, max: 1, useSlider: true, tooltip: 'Volume multiplier outside outer cone'
      });
      if (coneOuterGainChanged) componentData.coneOuterGain = coneOuterGain;

      EditorLayout.endLabelsWidth();

      EditorLayout.separator();
      EditorLayout.hint('Audio only plays during Play Mode.');
    },
  },
);
