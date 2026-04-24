/**
 * Audio hash format for oracle sound-parity verification.
 *
 * Defines the entry structure, payload shape, and audio constants
 * for capturing deterministic audio output hashes at specific tic
 * intervals during oracle reference runs.  Each entry records a
 * SHA-256 hash of the mixed SFX PCM output buffer for that tic
 * period and the number of active sound channels.
 *
 * Music events are tracked separately by the music-event-log format
 * (step 02-007).  This format covers the sound effects mix only.
 *
 * @example
 * ```ts
 * import { AUDIO_SAMPLE_RATE, SAMPLES_PER_TIC } from "../src/oracles/audioHash.ts";
 * console.log(SAMPLES_PER_TIC); // 1260
 * ```
 */

import type { OracleArtifact } from './schema.ts';
import type { RunMode } from './referenceRunManifest.ts';

/**
 * Output sample rate in Hz from the reference configuration (F-033).
 *
 * Chocolate Doom resamples all sound effects from 11025 Hz to this
 * rate before mixing.
 */
export const AUDIO_SAMPLE_RATE = 44_100;

/**
 * Maximum simultaneous sound effect channels (F-033, default.cfg snd_channels).
 *
 * When all channels are occupied, the engine evicts lower-priority
 * sounds (F-026 sfx-priority-eviction quirk).
 */
export const AUDIO_MAX_CHANNELS = 8;

/**
 * Native sample rate of Doom sound effects in the DMX lump format (F-028).
 *
 * Each DMX sound lump contains unsigned 8-bit PCM at 11025 Hz with an
 * 8-byte header (uint16LE format=0x0003, uint16LE sampleRate=11025,
 * uint32LE sampleCount) and 2 padding bytes.
 */
export const DMX_NATIVE_SAMPLE_RATE = 11_025;

/**
 * Number of audio samples produced per game tic at the output sample rate.
 *
 * AUDIO_SAMPLE_RATE / ticRateHz = 44100 / 35 = 1260.
 * This is the exact number of PCM samples the mixer generates for
 * each game tic before sending them to the audio device.
 */
export const SAMPLES_PER_TIC = AUDIO_SAMPLE_RATE / 35;

/**
 * Default sampling interval in tics between audio hash captures.
 *
 * 35 tics equals exactly one second at the Doom tic rate (F-010).
 * Use 1 for tic-by-tic audio parity debugging.
 */
export const DEFAULT_AUDIO_SAMPLING_INTERVAL_TICS = 35;

/**
 * A single audio hash snapshot at a specific tic.
 *
 * The hash covers the mixed SFX PCM output buffer for the tic
 * period (SAMPLES_PER_TIC samples of signed 16-bit stereo PCM).
 * Music output is excluded; it is tracked by the music-event-log
 * format (step 02-007).
 *
 * The activeChannels count records how many of the AUDIO_MAX_CHANNELS
 * slots are producing output at capture time, enabling divergence
 * isolation between "wrong mix" and "wrong channel count" failures.
 */
export interface AudioHashEntry {
  /** Game tic number at which this snapshot was captured (0-based). */
  readonly tic: number;
  /**
   * SHA-256 hash of the mixed SFX PCM output buffer for this tic period.
   *
   * Covers SAMPLES_PER_TIC (1260) samples of signed 16-bit stereo PCM
   * at AUDIO_SAMPLE_RATE (44100 Hz).
   */
  readonly hash: string;
  /**
   * Number of active sound effect channels at capture time (0 to AUDIO_MAX_CHANNELS).
   *
   * 0 means silence (no SFX playing); AUDIO_MAX_CHANNELS (8) means all
   * channel slots are occupied.
   */
  readonly activeChannels: number;
}

/**
 * Payload for an audio-hash oracle artifact.
 *
 * Entries must be sorted ascending by tic number.  Each entry
 * contains a SHA-256 hash of the mixed SFX PCM output and the
 * active channel count for sound-parity comparison.  The sampling
 * interval determines the tic spacing between captures; entries at
 * non-interval tics are permitted for targeted debugging.
 */
export interface AudioHashPayload {
  /** Human-readable description of what this audio hash set verifies. */
  readonly description: string;
  /** Which run mode this audio hash set was captured from. */
  readonly targetRunMode: RunMode;
  /**
   * Tic interval between regular hash captures.
   * Use DEFAULT_AUDIO_SAMPLING_INTERVAL_TICS (35) for one-second resolution.
   * Use 1 for tic-by-tic debugging.
   */
  readonly samplingIntervalTics: number;
  /** Tic rate in Hz; must match the reference target (35). */
  readonly ticRateHz: number;
  /** Output sample rate in Hz (always 44100 for reference configuration). */
  readonly sampleRate: number;
  /** Maximum simultaneous SFX channels (always 8 for reference configuration). */
  readonly maxChannels: number;
  /** Ordered sequence of audio hash entries, sorted ascending by tic. */
  readonly entries: readonly AudioHashEntry[];
}

/** Type alias for a complete audio-hash oracle artifact. */
export type AudioHashArtifact = OracleArtifact<AudioHashPayload>;

/**
 * Frozen empty audio hash payload for title-loop captures where no
 * audio snapshots have been recorded yet.  Used as a template before
 * the reference capture populates entries.
 */
export const EMPTY_TITLE_LOOP_AUDIO_HASH: AudioHashPayload = Object.freeze({
  description: 'Empty audio hash template for title/demo attract loop capture',
  targetRunMode: 'title-loop',
  samplingIntervalTics: DEFAULT_AUDIO_SAMPLING_INTERVAL_TICS,
  ticRateHz: 35,
  sampleRate: AUDIO_SAMPLE_RATE,
  maxChannels: AUDIO_MAX_CHANNELS,
  entries: Object.freeze([]),
} satisfies AudioHashPayload);

/**
 * Frozen empty audio hash payload for demo-playback captures where no
 * audio snapshots have been recorded yet.  Used as a template before
 * the reference capture populates entries.
 */
export const EMPTY_DEMO_PLAYBACK_AUDIO_HASH: AudioHashPayload = Object.freeze({
  description: 'Empty audio hash template for demo playback capture',
  targetRunMode: 'demo-playback',
  samplingIntervalTics: DEFAULT_AUDIO_SAMPLING_INTERVAL_TICS,
  ticRateHz: 35,
  sampleRate: AUDIO_SAMPLE_RATE,
  maxChannels: AUDIO_MAX_CHANNELS,
  entries: Object.freeze([]),
} satisfies AudioHashPayload);
