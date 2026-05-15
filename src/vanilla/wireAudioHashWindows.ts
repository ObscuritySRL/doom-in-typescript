/**
 * Vanilla DOOM 1.9 deterministic audio-hash-window facade.
 *
 * Plan_final step `11-008` (lane: audio) exposes the deterministic
 * SFX + mixed-PCM + music-event hash windows the acceptance gates
 * compare against the reference: the `src/audio/audioParity.ts`
 * harness (per-tic mixed-PCM SHA-256) and the
 * `src/oracles/musicEventLog.ts` music-event log schema.
 *
 * The read-only `src/audio/audioParity.ts` (deterministic per-tic
 * SFX/mixer/music harness + `hashPcmBuffer`) and
 * `src/oracles/musicEventLog.ts` (the ordered music-event log
 * payload + baseline empty logs) already implement the per-piece
 * behavior and are SHA-pinned by the inventory; this module does
 * NOT modify them.  It is a pure re-export barrel (value/type split
 * for `verbatimModuleSyntax`, no `const enum`s) plus a frozen
 * invariants manifest.
 *
 * Five parity invariants this step pins:
 *
 *   1. The harness runs at `HARNESS_TIC_RATE_HZ` = 35 Hz and the
 *      output sample rate must be an integer multiple of the tic
 *      rate so `samplesPerTic` is exact (no fractional drift).
 *   2. Each tic's mixed stereo PCM is hashed by `hashPcmBuffer` into
 *      a `HARNESS_SHA256_HEX_LENGTH` = 64-char uppercase hex SHA-256,
 *      deterministic for identical input.
 *   3. The SFX start path is deterministic: `startHarnessSfx`
 *      delegates to the vanilla allocator/audibility/pitch pipeline
 *      and only installs a voice on a `started` result.
 *   4. The music-event log records exactly four deterministic kinds
 *      (`MUSIC_EVENT_KINDS` = change/pause/resume/stop) and ships
 *      frozen empty baselines for the title loop and demo playback.
 *   5. MUS uses `MUS_MAX_CHANNELS` = 16 channels with the percussion
 *      channel at MUS index 15 / MIDI index 9, and music volume is
 *      bounded to `[MUSIC_VOLUME_MIN, MUSIC_VOLUME_MAX]` = `[0, 15]`.
 *
 * @example
 * ```ts
 * import { hashPcmBuffer, VANILLA_AUDIO_HASH_WINDOW_INVARIANTS } from './wireAudioHashWindows.ts';
 * hashPcmBuffer(new Int16Array([1, 2, 3])).length;     // 64
 * VANILLA_AUDIO_HASH_WINDOW_INVARIANTS.length;         // 5
 * ```
 */

export {
  HARNESS_SAMPLES_PER_TIC_STEREO,
  HARNESS_SHA256_HEX_LENGTH,
  HARNESS_TIC_RATE_HZ,
  changeHarnessMusic,
  createAudioParityHarness,
  hashPcmBuffer,
  isHarnessMusicPlaying,
  pauseHarnessMusic,
  resumeHarnessMusic,
  runHarnessTic,
  setHarnessMusicVolume,
  startHarnessMusic,
  startHarnessSfx,
  stopHarnessMusic,
  stopHarnessSfxByOrigin,
  toAudioHashEntry,
  updateHarnessSfx,
} from '../audio/audioParity.ts';
export type { AudioParityHarness, AudioParityHarnessOptions, AudioParityTicOutput, StartHarnessSfxInput } from '../audio/audioParity.ts';
export { EMPTY_DEMO_PLAYBACK_MUSIC_EVENT_LOG, EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG, MIDI_PERCUSSION_CHANNEL, MUS_MAX_CHANNELS, MUS_PERCUSSION_CHANNEL, MUSIC_EVENT_KINDS, MUSIC_VOLUME_MAX, MUSIC_VOLUME_MIN } from '../oracles/musicEventLog.ts';
export type { ChangeMusicEvent, MusicEvent, MusicEventKind, MusicEventLogArtifact, MusicEventLogPayload, PauseMusicEvent, ResumeMusicEvent, StopMusicEvent } from '../oracles/musicEventLog.ts';

/**
 * One pinned deterministic audio-hash-window parity invariant.
 */
export interface VanillaAudioHashWindowInvariant {
  readonly id:
    | 'HARNESS_TIC_RATE_IS_35HZ_WITH_INTEGER_SAMPLES_PER_TIC'
    | 'MIXED_PCM_HASHED_AS_64_HEX_SHA256_PER_TIC'
    | 'MUSIC_EVENT_LOG_HAS_FOUR_DETERMINISTIC_KINDS'
    | 'MUS_USES_16_CHANNELS_PERCUSSION_15_MIDI_9'
    | 'SFX_START_PATH_IS_DETERMINISTIC_THROUGH_THE_HARNESS';
  readonly rule: string;
}

/**
 * Frozen manifest of the five deterministic audio-hash-window parity
 * invariants this step pins.  A later acceptance gate that diffs the
 * audio/music hash windows against the reference must preserve all
 * five.
 */
export const VANILLA_AUDIO_HASH_WINDOW_INVARIANTS: readonly VanillaAudioHashWindowInvariant[] = Object.freeze([
  Object.freeze({
    id: 'HARNESS_TIC_RATE_IS_35HZ_WITH_INTEGER_SAMPLES_PER_TIC',
    rule: 'createAudioParityHarness runs at HARNESS_TIC_RATE_HZ = 35 Hz and rejects an outputSampleRate that is not a positive integer multiple of the tic rate, so samplesPerTic is exact and the per-tic hash window does not drift.',
  } satisfies VanillaAudioHashWindowInvariant),
  Object.freeze({
    id: 'MIXED_PCM_HASHED_AS_64_HEX_SHA256_PER_TIC',
    rule: 'hashPcmBuffer reduces a tic of mixed stereo Int16 PCM to a HARNESS_SHA256_HEX_LENGTH = 64-character uppercase hex SHA-256 that is identical for identical input and differs for any sample change.',
  } satisfies VanillaAudioHashWindowInvariant),
  Object.freeze({
    id: 'MUSIC_EVENT_LOG_HAS_FOUR_DETERMINISTIC_KINDS',
    rule: 'MUSIC_EVENT_KINDS is the frozen ordered set [change-music, pause-music, resume-music, stop-music]; EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG and EMPTY_DEMO_PLAYBACK_MUSIC_EVENT_LOG are the frozen empty baselines.',
  } satisfies VanillaAudioHashWindowInvariant),
  Object.freeze({
    id: 'MUS_USES_16_CHANNELS_PERCUSSION_15_MIDI_9',
    rule: 'MUS_MAX_CHANNELS = 16 with MUS_PERCUSSION_CHANNEL = 15 mapping to MIDI_PERCUSSION_CHANNEL = 9, and music volume is bounded to [MUSIC_VOLUME_MIN, MUSIC_VOLUME_MAX] = [0, 15].',
  } satisfies VanillaAudioHashWindowInvariant),
  Object.freeze({
    id: 'SFX_START_PATH_IS_DETERMINISTIC_THROUGH_THE_HARNESS',
    rule: 'startHarnessSfx routes through the vanilla startSound allocator/audibility/pitch pipeline and installs a MixerVoice only on a started result, so the SFX hash window is reproducible from the same input script.',
  } satisfies VanillaAudioHashWindowInvariant),
]);
