/**
 * Audio parity harness.
 *
 * Composes the digital sfx pipeline ({@link ./channels.ts} allocator,
 * {@link ./spatial.ts} distance / stereo math, {@link ./soundSystem.ts}
 * start path, {@link ./soundOrigins.ts} update pass, {@link ./pcmMixer.ts}
 * mixer) and the music pipeline ({@link ./musicSystem.ts} lifecycle plus
 * {@link ./musScheduler.ts} event dispatch) behind a single per-tic step
 * that produces the deterministic mixed sfx buffer consumed by the
 * {@link ../oracles/audioHash.ts} oracle (F-037 / O-017).
 *
 * Every public operation mirrors an existing audio module call and
 * keeps the harness's internal state in lock-step with the module it
 * delegates to:
 *
 *  - {@link startHarnessSfx} wraps {@link startSound}.  On a `started`
 *    result the harness expands the supplied {@link SfxLump} via
 *    {@link expandDmxSamples}, computes per-channel stereo gains with
 *    {@link computeStereoGains}, and installs a fresh {@link MixerVoice}
 *    keyed by the chosen `cnum`.  A previous voice on the same `cnum`
 *    is replaced (matches vanilla's `stopSound(origin)` short-circuit
 *    inside `S_StartSound` that frees the slot before the allocator
 *    reuses it).
 *  - {@link updateHarnessSfx} wraps {@link updateSounds}.  After the
 *    delegate returns the harness reaps any voice whose channel slot
 *    is now free OR whose underlying {@link MixerVoice.finished} flag
 *    went `true` during the last mix.  The emitted
 *    {@link SoundUpdateAction} list is returned verbatim so the host
 *    bridge can dispatch `I_UpdateSoundParams` / `I_StopSound`; the
 *    `update-params` variant also rewrites the voice's gains in place
 *    so the next {@link runHarnessTic} mixes at the new values.
 *  - {@link stopHarnessSfxByOrigin} wraps {@link stopSound} (channels
 *    module), removing the matching voice entry when the channel is
 *    freed.
 *  - The music lifecycle wrappers ({@link changeHarnessMusic},
 *    {@link startHarnessMusic}, {@link stopHarnessMusic},
 *    {@link pauseHarnessMusic}, {@link resumeHarnessMusic},
 *    {@link setHarnessMusicVolume}) forward to the matching
 *    {@link ./musicSystem.ts} entry point and return the same
 *    `MusicDeviceAction[]` the caller would have seen directly.
 *  - {@link runHarnessTic} advances the music scheduler by exactly one
 *    game tic (F-010 35 Hz) via {@link advanceMusic}, mixes every
 *    active voice into a {@link SAMPLES_PER_TIC}-frame interleaved
 *    stereo {@link Int16Array} via {@link mixVoices}, increments
 *    {@link AudioParityHarness.tic}, reaps voices whose
 *    {@link MixerVoice.finished} flag went `true`, and hashes the
 *    stereo buffer with SHA-256 for the {@link AudioHashEntry} oracle.
 *    The active-channel count reported in the result matches
 *    {@link ./channels.ts} `getOccupiedChannelCount` at the end of the
 *    tic so the oracle's divergence-isolation signal (wrong mix vs.
 *    wrong channel count) stays faithful to vanilla `snd_channels`
 *    occupancy rather than voice-list size.
 *
 * Parity-critical details preserved here:
 *
 *  - The harness defers to the underlying modules for every parity
 *    decision (pitch perturbation, link-volume early stop, same-music
 *    no-op, resume-before-stop ordering, unconditional `setMusicVolume`
 *    emission, pause-halts-scheduler).  This module is a composition
 *    layer; it does NOT introduce new behaviour.  Every divergence
 *    from the vanilla reference is a bug in this module, not a
 *    feature.
 *  - The mix buffer is always exactly {@link SAMPLES_PER_TIC} *frames*
 *    (2520 `Int16Array` slots = 1260 frames × 2 channels).  A port
 *    that produces a different frame count per tic would desync the
 *    audio-hash oracle against the reference capture; the value is
 *    derived from {@link ../oracles/audioHash.ts} `SAMPLES_PER_TIC`
 *    (44100 / 35 = 1260) so a future change to the output sample rate
 *    stays consistent across harness and oracle.
 *  - Voices are reaped AFTER the mix pass, not before.  A voice whose
 *    final sample lands in the current tic still contributes that
 *    sample to the mix — and only after {@link mixVoices} marks it
 *    {@link MixerVoice.finished} does the harness drop the entry.
 *    Reaping before the mix would silence the last frame and shift
 *    the hash by one sample against vanilla's SDL_mixer which also
 *    consumes the last sample before flagging the chunk as done.
 *  - Voice reaping also drops the entry when the underlying channel
 *    slot is free (for example after {@link updateSounds} stops the
 *    channel because `isPlaying` went `false`).  Keeping an orphan
 *    voice around would leak PCM into the next tic and diverge the
 *    hash from the reference.
 *  - Music scheduler advance uses the same {@link advanceMusic}
 *    wrapper the production host bridge calls, so a pause / resume
 *    cycle inside the harness behaves exactly like vanilla's
 *    I_PauseSong / I_ResumeSong under pause.  Under pause the
 *    dispatched-events list is empty AND the music-scheduler clock
 *    does not advance.
 *  - {@link hashPcmBuffer} hashes the raw byte view of the
 *    `Int16Array` at its native little-endian layout (V8 / Bun both
 *    run on little-endian hosts and the {@link ../oracles/audioHash.ts}
 *    oracle hash is specified against the little-endian layout that
 *    chocolate-doom's SDL_mixer writes on x86).  The returned hex
 *    string is UPPERCASE to match the rest of the oracle hash
 *    machinery (O-001 / F-011 / F-012 manifests, {@link ./../reference/target.ts}
 *    `PRIMARY_TARGET` hashes).
 *
 * The module is pure: no Win32 bindings, no audio device calls, no
 * global mutable state beyond the caller-supplied
 * {@link AudioParityHarness} object.  Every per-tic allocation is a
 * bounded {@link Int16Array} of `SAMPLES_PER_TIC * 2` slots plus the
 * dispatched-event array returned by {@link advanceMusic}.
 *
 * @example
 * ```ts
 * import { parseSfxLump } from "../src/audio/sfxLumps.ts";
 * import {
 *   createAudioParityHarness,
 *   runHarnessTic,
 *   startHarnessSfx,
 *   toAudioHashEntry,
 * } from "../src/audio/audioParity.ts";
 * import { DoomRandom } from "../src/core/rng.ts";
 *
 * const harness = createAudioParityHarness();
 * const rng = new DoomRandom();
 * const pistolLump = parseSfxLump(lookup.getLumpData("DSPISTOL", wad));
 *
 * startHarnessSfx(harness, {
 *   sfxLump: pistolLump,
 *   request: {
 *     sfxId: 1,
 *     priority: 64,
 *     pitchClass: "default",
 *     origin: 42,
 *     sourcePosition: { x: 0, y: 0 },
 *     listener: { x: 0, y: 0, angle: 0 },
 *     listenerOrigin: 1,
 *     sfxVolume: 15,
 *     isBossMap: false,
 *     linkVolumeAdjust: null,
 *     linkPitch: null,
 *     rng,
 *     table: harness.channelTable,
 *   },
 * });
 *
 * const tic = runHarnessTic(harness);
 * // tic.sfxFrames is a 2520-length Int16Array (interleaved stereo)
 * // tic.sfxHash is a 64-char uppercase hex SHA-256 digest
 * const entry = toAudioHashEntry(tic);
 * // entry satisfies AudioHashEntry → ready for audio-hash oracle
 * ```
 */

import type { ChannelTable } from './channels.ts';
import { NUM_CHANNELS, createChannelTable, findChannelByOrigin, getOccupiedChannelCount, isChannelFree, stopSound as stopChannelBySound } from './channels.ts';
import type { MixerVoice } from './pcmMixer.ts';
import { DEFAULT_OUTPUT_SAMPLE_RATE, computeStereoGains, createMixerVoice, expandDmxSamples, mixVoices } from './pcmMixer.ts';
import type { SfxLump } from './sfxLumps.ts';
import type { StartSoundRequest, StartSoundResult } from './soundSystem.ts';
import { startSound } from './soundSystem.ts';
import type { SoundUpdateAction, UpdateSoundsRequest } from './soundOrigins.ts';
import { updateSounds } from './soundOrigins.ts';
import type { ChangeMusicRequest, CreateMusicSystemOptions, MusicDeviceAction, MusicSystemState, StartMusicRequest } from './musicSystem.ts';
import { advanceMusic, changeMusic, createMusicSystem, isMusicPlaying, pauseMusic, resumeMusic, setMusicVolume, startMusic, stopMusic } from './musicSystem.ts';
import type { DispatchedMusEventEntry } from './musScheduler.ts';
import type { AudioHashEntry } from '../oracles/audioHash.ts';
import { AUDIO_MAX_CHANNELS, AUDIO_SAMPLE_RATE, SAMPLES_PER_TIC } from '../oracles/audioHash.ts';

/** Reference tic rate from F-010 — 35 Hz, exactly `AUDIO_SAMPLE_RATE / SAMPLES_PER_TIC`. */
export const HARNESS_TIC_RATE_HZ = 35;

/** Number of `Int16Array` slots per tic — 2 (stereo) × {@link SAMPLES_PER_TIC}. */
export const HARNESS_SAMPLES_PER_TIC_STEREO = SAMPLES_PER_TIC * 2;

/** Hex length of a SHA-256 digest (32 bytes × 2 hex chars). */
export const HARNESS_SHA256_HEX_LENGTH = 64;

/** Options accepted by {@link createAudioParityHarness}. */
export interface AudioParityHarnessOptions {
  /**
   * Music system seed options forwarded verbatim to
   * {@link createMusicSystem}.  Defaults to vanilla reference values
   * (volume 8, device {@link SNDDEVICE_SB}, no `D_INTROA` lump).
   */
  readonly music?: CreateMusicSystemOptions;
  /**
   * Output sample rate in Hz.  Defaults to
   * {@link DEFAULT_OUTPUT_SAMPLE_RATE} (44100), matching the audio
   * hash oracle (F-037).
   */
  readonly outputSampleRate?: number;
  /**
   * Tic rate in Hz.  Defaults to {@link HARNESS_TIC_RATE_HZ} (35,
   * vanilla).  Changing this breaks audio-hash oracle parity.
   */
  readonly ticRateHz?: number;
  /**
   * Channel table capacity.  Defaults to {@link NUM_CHANNELS} (8, the
   * vanilla `snd_channels` default and {@link AUDIO_MAX_CHANNELS}).
   */
  readonly channelCapacity?: number;
}

/** Mutable parity harness state.  Owns the channel table, music system, and voice map. */
export interface AudioParityHarness {
  /** Channel table the harness mutates through {@link startSound} / {@link updateSounds}. */
  readonly channelTable: ChannelTable;
  /** Music system state advanced by {@link advanceMusic} each tic. */
  readonly music: MusicSystemState;
  /**
   * Map from channel index → active mixer voice.  Present while the
   * matching channel slot is occupied; removed when the voice is
   * reaped after {@link runHarnessTic} or when {@link updateHarnessSfx}
   * frees the slot.
   */
  readonly voices: Map<number, MixerVoice>;
  /** Output sample rate (Hz) — 44100 by default. */
  readonly outputSampleRate: number;
  /** Tic rate (Hz) — 35 by default. */
  readonly ticRateHz: number;
  /** Stereo frames mixed per tic — equals `outputSampleRate / ticRateHz`. */
  readonly samplesPerTic: number;
  /** Number of game tics advanced since creation. */
  tic: number;
}

/** Inputs for {@link startHarnessSfx}. */
export interface StartHarnessSfxInput {
  /**
   * Parsed DMX sound lump.  The harness expands the audible region
   * (`playableSampleStart` .. `playableSampleStart + playableSampleCount`)
   * from the lump's native rate to the harness output rate and keeps
   * the resulting `Int16Array` alive for the voice's lifetime.
   */
  readonly sfxLump: Readonly<SfxLump>;
  /**
   * Start-sound request forwarded to {@link startSound}.  The
   * `table` field MUST reference the harness's own
   * {@link AudioParityHarness.channelTable} — supplying any other
   * table is a programming error and throws.
   */
  readonly request: StartSoundRequest;
}

/** Output of {@link runHarnessTic}. */
export interface AudioParityTicOutput {
  /**
   * Game tic number this snapshot covers (0-based).  Matches the
   * {@link AudioHashEntry.tic} field.
   */
  readonly tic: number;
  /**
   * Interleaved stereo signed-16-bit PCM frames mixed during this
   * tic.  Length is exactly {@link AudioParityHarness.samplesPerTic}
   * × 2 (left, right, left, right, ...).
   */
  readonly sfxFrames: Int16Array;
  /**
   * Number of occupied channel slots at the END of the tic, AFTER
   * voice reaping.  Matches {@link AudioHashEntry.activeChannels}.
   */
  readonly activeChannels: number;
  /**
   * Music events dispatched during this tic by {@link advanceMusic}.
   * Empty when no song is loaded, when the system is paused, or when
   * no events fired within the tic window.
   */
  readonly dispatchedMusicEvents: readonly DispatchedMusEventEntry[];
  /**
   * SHA-256 hex digest (UPPERCASE, 64 chars) of {@link sfxFrames}
   * interpreted as little-endian bytes.  Matches
   * {@link AudioHashEntry.hash}.
   */
  readonly sfxHash: string;
}

/**
 * Allocate a fresh audio parity harness.  Every field defaults to the
 * vanilla reference configuration: music volume 8 / device SB / no
 * `D_INTROA`, output rate 44100 Hz, tic rate 35 Hz, 8 channels.
 *
 * @throws {RangeError} If `outputSampleRate` or `ticRateHz` is not a
 *   positive integer, `outputSampleRate % ticRateHz !== 0`,
 *   `channelCapacity` is not a positive integer, or the music system
 *   options reject the initial volume.
 */
export function createAudioParityHarness(options?: AudioParityHarnessOptions): AudioParityHarness {
  const outputSampleRate = options?.outputSampleRate ?? AUDIO_SAMPLE_RATE;
  const ticRateHz = options?.ticRateHz ?? HARNESS_TIC_RATE_HZ;
  const channelCapacity = options?.channelCapacity ?? NUM_CHANNELS;

  if (!Number.isInteger(outputSampleRate) || outputSampleRate <= 0) {
    throw new RangeError(`outputSampleRate must be a positive integer, got ${outputSampleRate}`);
  }
  if (!Number.isInteger(ticRateHz) || ticRateHz <= 0) {
    throw new RangeError(`ticRateHz must be a positive integer, got ${ticRateHz}`);
  }
  if (outputSampleRate % ticRateHz !== 0) {
    throw new RangeError(`outputSampleRate (${outputSampleRate}) must be divisible by ticRateHz (${ticRateHz}) for integer samplesPerTic`);
  }
  if (!Number.isInteger(channelCapacity) || channelCapacity <= 0) {
    throw new RangeError(`channelCapacity must be a positive integer, got ${channelCapacity}`);
  }

  return {
    channelTable: createChannelTable(channelCapacity),
    music: createMusicSystem(options?.music),
    voices: new Map<number, MixerVoice>(),
    outputSampleRate,
    ticRateHz,
    samplesPerTic: outputSampleRate / ticRateHz,
    tic: 0,
  };
}

/**
 * Start a digital sfx through the full vanilla start path.  Delegates
 * to {@link startSound} for the allocator / audibility / pitch
 * pipeline and, on a `started` result, installs a fresh
 * {@link MixerVoice} for the chosen channel index.  When `startSound`
 * drops the request (`link-silenced`, `inaudible`, `no-channel`) the
 * voice map is left unchanged.
 *
 * @throws {RangeError} If `input.request.table` is not the harness's
 *   own {@link AudioParityHarness.channelTable}.
 */
export function startHarnessSfx(harness: AudioParityHarness, input: StartHarnessSfxInput): StartSoundResult {
  if (input.request.table !== harness.channelTable) {
    throw new RangeError('startHarnessSfx: request.table must be the harness channelTable');
  }

  const result = startSound(input.request);
  if (result.kind !== 'started') {
    return result;
  }

  const playable = input.sfxLump.samples.subarray(input.sfxLump.playableSampleStart, input.sfxLump.playableSampleStart + input.sfxLump.playableSampleCount);
  const expanded = expandDmxSamples(playable, input.sfxLump.sampleRate, harness.outputSampleRate);
  const voice = createMixerVoice(expanded, result.volume, result.separation);
  harness.voices.set(result.cnum, voice);
  return result;
}

/**
 * Stop any digital sfx currently occupying the channel tied to
 * `origin`, mirroring vanilla's `S_StopSound(origin)`.  Returns the
 * freed channel index when a match was found, or `null` when no slot
 * held the origin.  Removes the matching voice entry on success.
 */
export function stopHarnessSfxByOrigin(harness: AudioParityHarness, origin: number | null): number | null {
  const cnum = findChannelByOrigin(harness.channelTable, origin);
  if (cnum === null) {
    return null;
  }
  stopChannelBySound(harness.channelTable, origin);
  harness.voices.delete(cnum);
  return cnum;
}

/**
 * Run one vanilla `S_UpdateSounds` pass against the harness channel
 * table.  Delegates to {@link updateSounds} for the parity logic and
 * then reconciles the voice map so any channel that was freed loses
 * its voice AND any channel whose params were updated has its voice
 * gains rewritten in place.  The returned action list is the same
 * list the caller would have seen from the underlying
 * {@link updateSounds} invocation; the harness consumes it only for
 * the gain-rewrite side effect.
 *
 * @throws {RangeError} If `request.table` is not the harness's own
 *   channel table.
 */
export function updateHarnessSfx(harness: AudioParityHarness, request: UpdateSoundsRequest): SoundUpdateAction[] {
  if (request.table !== harness.channelTable) {
    throw new RangeError('updateHarnessSfx: request.table must be the harness channelTable');
  }

  const actions = updateSounds(request);
  for (const action of actions) {
    if (action.kind === 'stop') {
      harness.voices.delete(action.cnum);
    } else {
      const voice = harness.voices.get(action.cnum);
      if (voice !== undefined && action.volume !== undefined && action.separation !== undefined) {
        const gains = computeStereoGains(action.volume, action.separation);
        voice.leftGain = gains.left;
        voice.rightGain = gains.right;
      }
    }
  }
  reapVoices(harness);
  return actions;
}

/** Forward to {@link changeMusic} on the harness music system. */
export function changeHarnessMusic(harness: AudioParityHarness, request: ChangeMusicRequest): readonly MusicDeviceAction[] {
  return changeMusic(harness.music, request);
}

/** Forward to {@link startMusic} on the harness music system. */
export function startHarnessMusic(harness: AudioParityHarness, request: StartMusicRequest): readonly MusicDeviceAction[] {
  return startMusic(harness.music, request);
}

/** Forward to {@link stopMusic} on the harness music system. */
export function stopHarnessMusic(harness: AudioParityHarness): readonly MusicDeviceAction[] {
  return stopMusic(harness.music);
}

/** Forward to {@link pauseMusic} on the harness music system. */
export function pauseHarnessMusic(harness: AudioParityHarness): readonly MusicDeviceAction[] {
  return pauseMusic(harness.music);
}

/** Forward to {@link resumeMusic} on the harness music system. */
export function resumeHarnessMusic(harness: AudioParityHarness): readonly MusicDeviceAction[] {
  return resumeMusic(harness.music);
}

/** Forward to {@link setMusicVolume} on the harness music system. */
export function setHarnessMusicVolume(harness: AudioParityHarness, volume: number): readonly MusicDeviceAction[] {
  return setMusicVolume(harness.music, volume);
}

/** `true` iff the harness music system has a song registered (independent of pause state). */
export function isHarnessMusicPlaying(harness: AudioParityHarness): boolean {
  return isMusicPlaying(harness.music);
}

/**
 * Advance the harness by exactly one 35 Hz game tic.
 *
 * Sequence (matches vanilla per-tic order, `I_UpdateSound` / mixer
 * pump at the top of `D_Display`):
 *
 *  1. Advance the music scheduler by 1 game tic via
 *     {@link advanceMusic}.  Collected events are returned verbatim
 *     in {@link AudioParityTicOutput.dispatchedMusicEvents}.  No
 *     events fire when the song is paused or no song is loaded.
 *  2. Mix every active {@link MixerVoice} into a fresh
 *     `samplesPerTic`-frame stereo buffer via {@link mixVoices}.
 *     Voices whose last sample lands in this tic contribute that
 *     sample and are then flagged `finished` by the mixer.
 *  3. Reap every voice whose {@link MixerVoice.finished} flag went
 *     `true` during the mix OR whose channel slot is free (the
 *     channel table can be stopped externally between tics).  The
 *     channel table itself is not modified — the voice map only
 *     tracks active mixer buffers; channel occupancy is the
 *     {@link ChannelTable}'s concern.
 *  4. Increment {@link AudioParityHarness.tic} and hash the mix
 *     buffer with SHA-256 for the
 *     {@link ../oracles/audioHash.ts} oracle.
 */
export function runHarnessTic(harness: AudioParityHarness): AudioParityTicOutput {
  const dispatched = advanceMusic(harness.music, 1);
  const scratch = getAudioParityScratch(harness);
  scratch.voices.length = 0;
  for (const voice of harness.voices.values()) {
    scratch.voices.push(voice);
  }
  const sfxFrames = mixVoices(scratch.voices, harness.samplesPerTic);
  reapVoices(harness);
  const tic = harness.tic;
  harness.tic = tic + 1;
  return {
    tic,
    sfxFrames,
    activeChannels: getOccupiedChannelCount(harness.channelTable),
    dispatchedMusicEvents: dispatched,
    sfxHash: hashPcmBuffer(sfxFrames),
  };
}

/**
 * Hash an `Int16Array` with SHA-256 and return the upper-case hex
 * digest.  The buffer is hashed via its native little-endian byte
 * view; the oracle hash is specified against that layout so the host
 * platform's native endianness is what the oracle expects.
 */
export function hashPcmBuffer(buffer: Int16Array): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
  return hasher.digest('hex').toUpperCase();
}

/**
 * Convert a {@link AudioParityTicOutput} into a ready-to-store
 * {@link AudioHashEntry} matching the audio-hash oracle shape
 * (F-037 / O-017).
 */
export function toAudioHashEntry(output: AudioParityTicOutput): AudioHashEntry {
  return Object.freeze<AudioHashEntry>({
    tic: output.tic,
    hash: output.sfxHash,
    activeChannels: output.activeChannels,
  });
}

interface AudioParityScratch {
  readonly voices: MixerVoice[];
}

const AUDIO_PARITY_SCRATCH = new WeakMap<AudioParityHarness, AudioParityScratch>();

function getAudioParityScratch(harness: AudioParityHarness): AudioParityScratch {
  let scratch = AUDIO_PARITY_SCRATCH.get(harness);
  if (scratch === undefined) {
    scratch = { voices: [] };
    AUDIO_PARITY_SCRATCH.set(harness, scratch);
  }
  return scratch;
}

function reapVoices(harness: AudioParityHarness): void {
  for (const [cnum, voice] of harness.voices) {
    if (voice.finished) {
      harness.voices.delete(cnum);
      continue;
    }
    if (cnum < 0 || cnum >= harness.channelTable.capacity) {
      harness.voices.delete(cnum);
      continue;
    }
    if (isChannelFree(harness.channelTable.channels[cnum]!)) {
      harness.voices.delete(cnum);
    }
  }
}

// Sanity checks executed at module load — guard against silent drift if
// AUDIO_MAX_CHANNELS ever diverges from NUM_CHANNELS or the oracle
// sample rate stops matching the harness default.
/* c8 ignore next 6 */
if (AUDIO_MAX_CHANNELS !== NUM_CHANNELS) {
  throw new Error(`AUDIO_MAX_CHANNELS (${AUDIO_MAX_CHANNELS}) must equal NUM_CHANNELS (${NUM_CHANNELS})`);
}
if (AUDIO_SAMPLE_RATE !== DEFAULT_OUTPUT_SAMPLE_RATE) {
  throw new Error(`AUDIO_SAMPLE_RATE (${AUDIO_SAMPLE_RATE}) must equal DEFAULT_OUTPUT_SAMPLE_RATE (${DEFAULT_OUTPUT_SAMPLE_RATE})`);
}
