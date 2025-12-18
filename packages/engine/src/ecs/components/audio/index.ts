/**
 * Audio Components
 *
 * Three.js audio integration for the VoidScript ECS.
 *
 * Components:
 * - AudioListener: The "ears" in 3D audio space (place on player/camera)
 * - AudioSource: Non-positional audio (music, UI sounds)
 * - PositionalAudioSource: 3D spatial audio with distance attenuation
 *
 * Audio only plays during Play Mode.
 *
 * @example
 * ```typescript
 * import { AudioListener, AudioSource, PositionalAudioSource } from '@voidscript/engine';
 *
 * // Create listener on player
 * commands.spawn()
 *   .with(Transform3D, { position: playerPos })
 *   .with(AudioListener, { volume: 1.0 })
 *   .build();
 *
 * // Background music
 * commands.spawn()
 *   .with(Transform3D, {})
 *   .with(AudioSource, { audioClip: musicAsset, loop: true })
 *   .build();
 *
 * // 3D positioned sound
 * commands.spawn()
 *   .with(Transform3D, { position: soundPos })
 *   .with(PositionalAudioSource, { audioClip: sfxAsset, refDistance: 5 })
 *   .build();
 * ```
 */

export { AudioListener, type AudioListenerData } from './audio-listener.js';
export { AudioSource, type AudioSourceData } from './audio-source.js';
export { PositionalAudioSource, type PositionalAudioSourceData, type DistanceModel } from './positional-audio-source.js';
