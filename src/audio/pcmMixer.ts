/**
 * PCM mixer clipping-and-stepping for digital sfx.
 *
 * Vanilla Doom ships digital sfx as unsigned 8-bit PCM at 11025 Hz in
 * the DMX lump format (F-028, F-151).  Chocolate Doom's SDL audio
 * backend upsamples each lump to the output mixer rate (default
 * `44100 Hz`, F-033 / F-037) and converts it to signed 16-bit mono at
 * initialization time, then runs the real-time mixer over those
 * pre-expanded buffers.  Per-channel volume and stereo separation
 * computed by {@link ./spatial.ts} and installed on the channel table
 * by {@link ./soundSystem.ts} / {@link ./soundOrigins.ts} are fed into
 * SDL_mixer's `Mix_SetPanning` via the chocolate-doom bridge
 * (`i_sdlsound.c` `I_SDL_UpdateSoundParams`):
 *
 * ```c
 * left  = ((254 - sep) * vol) / 127;
 * right = ((sep)       * vol) / 127;
 * Mix_SetPanning(handle, left, right);
 * ```
 *
 * The DMX → int16 conversion replicates the byte into the high and
 * low halves of a 16-bit word and subtracts 32768 to recentre the
 * unsigned midpoint (`0x80`) near zero (`i_sdlsound.c`
 * `ExpandSoundData_SDL`):
 *
 * ```c
 * sample = data[src] | (data[src] << 8);
 * sample -= 32768;
 * expanded[i * 2] = expanded[i * 2 + 1] = sample;
 * ```
 *
 * Upsampling is nearest-neighbour / sample-and-hold with an 8.8
 * fixed-point step ratio:
 *
 * ```c
 * expanded_length = ((uint64_t) length * mixer_freq) / samplerate;
 * expand_ratio    = (length << 8) / expanded_length;
 * for (i = 0; i < expanded_length; ++i)
 *     src = (i * expand_ratio) >> 8;
 * ```
 *
 * The module exposes a small set of pure primitives that together
 * model the clipping-and-stepping behaviour exercised by the audio
 * parity oracle:
 *
 *  - {@link dmxByteToInt16} converts a single DMX sample byte.
 *  - {@link computeExpandRatio} reproduces the vanilla 8.8 step.
 *  - {@link expandDmxSamples} turns a DMX sample buffer into the
 *    pre-resampled signed 16-bit mono buffer that the real-time
 *    mixer consumes.
 *  - {@link computeStereoGains} models the `I_SDL_UpdateSoundParams`
 *    volume / separation → (left, right) conversion, including the
 *    asymmetric values at the end points.
 *  - {@link clipToInt16} saturates an integer accumulator at the
 *    signed 16-bit range.
 *  - {@link mixVoices} composes multiple {@link MixerVoice}s into an
 *    interleaved signed 16-bit stereo `Int16Array` of `frameCount`
 *    frames (2 samples per frame), advancing each voice through its
 *    pre-expanded sample buffer by one frame per output sample and
 *    marking it {@link MixerVoice.finished} when exhausted.
 *
 * Parity-critical details preserved here:
 *
 *  - DMX byte `0x80` (vanilla "silence") decodes to int16 `128`, not
 *    `0`.  This is a quirk of the replicate-then-subtract-32768
 *    conversion and is preserved verbatim because the audio-hash
 *    oracle (F-037) is taken over the mixed stereo bytes.
 *  - Byte `0x00` decodes to `-32768` (`INT16_MIN`) and byte `0xFF`
 *    to `32767` (`INT16_MAX`), giving the DMX body an asymmetric
 *    amplitude range centred at `+128`.
 *  - The expand-ratio uses C integer division (`Math.trunc`), which
 *    is how SDL_mixer lands on nearest-neighbour indices; using
 *    `Math.floor` or `Math.round` would drift by ±1 sample at the
 *    first boundary.
 *  - The stereo gain formula divides by `127` (vanilla constant —
 *    the Mix_Volume max) even though separation spans `0..254`; at
 *    the end points one side of the pair can exceed the mixer's
 *    nominal max or go negative, which is clamped later by
 *    SDL_mixer itself.  We expose the unclamped formula so a port
 *    of the real-time mixer can reproduce the asymmetry exactly.
 *  - The mixer accumulator is signed 32-bit (JavaScript double with
 *    `| 0` coercion) so two channels at full volume are guaranteed
 *    to stay representable before {@link clipToInt16} saturates at
 *    `INT16_MIN` / `INT16_MAX`.  A port that uses int16 accumulation
 *    directly would wrap instead of clipping, producing loud
 *    discontinuities on overlapping sfx.
 *
 * The module is pure: no Win32 bindings, no audio playback, no
 * global mutable state.  Expansion is allocation-only (no in-place
 * mutation of the input) and mixing mutates only the caller-supplied
 * output buffer (optional) plus the `position` / `finished` fields
 * of each voice.  The `handle`-based SDL_mixer bridge is the concern
 * of later steps (15-011 music device, 15-012 audio-parity harness).
 *
 * @example
 * ```ts
 * import { parseSfxLump } from "../src/audio/sfxLumps.ts";
 * import {
 *   DEFAULT_OUTPUT_SAMPLE_RATE,
 *   computeStereoGains,
 *   expandDmxSamples,
 *   mixVoices,
 * } from "../src/audio/pcmMixer.ts";
 *
 * const pistol = parseSfxLump(lookup.getLumpData("DSPISTOL", wad));
 * const expanded = expandDmxSamples(
 *   pistol.samples.subarray(pistol.playableSampleStart,
 *     pistol.playableSampleStart + pistol.playableSampleCount),
 *   pistol.sampleRate,
 *   DEFAULT_OUTPUT_SAMPLE_RATE,
 * );
 * const gains = computeStereoGains(15, 128);
 * const frames = mixVoices([{ samples: expanded, position: 0, ...gains, finished: false }], 1260);
 * ```
 */

/** DC midpoint of the DMX unsigned 8-bit encoding. */
export const PCM_BYTE_MIDPOINT = 0x80;

/** Signed 16-bit minimum; `INT16_MIN` from C. */
export const INT16_MIN = -32768;

/** Signed 16-bit maximum; `INT16_MAX` from C. */
export const INT16_MAX = 32767;

/** Divisor used by chocolate-doom's `I_SDL_UpdateSoundParams`. */
export const MIX_MAX_VOLUME = 127;

/** Separation ceiling used in the `(254 - sep)` left-gain term. */
export const SEP_LEFT_MAX = 254;

/** Default DMX native sample rate (F-028); the sole exception is `DSITMBK` at 22050 Hz. */
export const DMX_NATIVE_SAMPLE_RATE = 11_025;

/** Default output sample rate the reference SDL mixer runs at (F-033). */
export const DEFAULT_OUTPUT_SAMPLE_RATE = 44_100;

/** Number of fractional bits in the 8.8 `expand_ratio` step. */
export const EXPAND_RATIO_SHIFT = 8;

/** Scale applied by the `expand_ratio` fixed-point step (`1 << EXPAND_RATIO_SHIFT`). */
export const EXPAND_RATIO_SCALE = 1 << EXPAND_RATIO_SHIFT;

/**
 * Convert a single DMX sample byte (unsigned 8-bit) to signed 16-bit
 * using the chocolate-doom `ExpandSoundData_SDL` formula
 * `(b | (b << 8)) - 32768`.  The result spans `[INT16_MIN,
 * INT16_MAX]` with `0x80` mapping to `+128` (vanilla silence quirk).
 *
 * @throws {RangeError} If `byte` is outside `[0, 255]` or not an integer.
 */
export function dmxByteToInt16(byte: number): number {
  if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
    throw new RangeError(`DMX sample byte must be an integer in [0, 255], got ${byte}`);
  }
  return (byte | (byte << 8)) - 0x8000;
}

/**
 * Saturate an integer accumulator to the signed 16-bit range.
 * Values above {@link INT16_MAX} clip to `+32767`; values below
 * {@link INT16_MIN} clip to `-32768`; values inside the range pass
 * through unchanged.  The result is always an integer.
 */
export function clipToInt16(accumulator: number): number {
  const truncated = Math.trunc(accumulator);
  if (truncated > INT16_MAX) {
    return INT16_MAX;
  }
  if (truncated < INT16_MIN) {
    return INT16_MIN;
  }
  return truncated | 0;
}

/**
 * Number of output samples the vanilla expansion produces for a DMX
 * body of `sourceLength` bytes at `sourceRate` Hz when targeting
 * `outputRate` Hz.  Matches chocolate-doom's
 * `((uint64_t) length * mixer_freq) / samplerate`.
 *
 * @throws {RangeError} If rates are not positive integers or
 *   `sourceLength` is negative.
 */
export function computeExpandedLength(sourceLength: number, sourceRate: number, outputRate: number): number {
  if (!Number.isInteger(sourceLength) || sourceLength < 0) {
    throw new RangeError(`sourceLength must be a non-negative integer, got ${sourceLength}`);
  }
  if (!Number.isInteger(sourceRate) || sourceRate <= 0) {
    throw new RangeError(`sourceRate must be a positive integer, got ${sourceRate}`);
  }
  if (!Number.isInteger(outputRate) || outputRate <= 0) {
    throw new RangeError(`outputRate must be a positive integer, got ${outputRate}`);
  }
  return Math.trunc((sourceLength * outputRate) / sourceRate);
}

/**
 * Compute the vanilla 8.8 fixed-point step ratio such that
 * `src = (i * expand_ratio) >> EXPAND_RATIO_SHIFT` maps output
 * sample `i` back to the nearest DMX input index.  Returns `0` when
 * `expandedLength` is `0` (empty source).
 *
 * @throws {RangeError} If either length is negative / non-integer.
 */
export function computeExpandRatio(sourceLength: number, expandedLength: number): number {
  if (!Number.isInteger(sourceLength) || sourceLength < 0) {
    throw new RangeError(`sourceLength must be a non-negative integer, got ${sourceLength}`);
  }
  if (!Number.isInteger(expandedLength) || expandedLength < 0) {
    throw new RangeError(`expandedLength must be a non-negative integer, got ${expandedLength}`);
  }
  if (expandedLength === 0) {
    return 0;
  }
  return Math.trunc((sourceLength << EXPAND_RATIO_SHIFT) / expandedLength);
}

/**
 * Expand a DMX PCM body (unsigned 8-bit, one byte per sample) to
 * signed 16-bit mono at `outputRate` Hz using nearest-neighbour /
 * sample-and-hold resampling.  Equivalent to chocolate-doom's
 * `ExpandSoundData_SDL` generic branch with the low-pass filter
 * disabled.  The returned buffer has
 * `computeExpandedLength(samples.length, sourceRate, outputRate)`
 * elements and is safe to pass to {@link mixVoices} as a voice's
 * `samples` field.
 *
 * @throws {RangeError} If rates are not positive integers or
 *   `samples` is not a `Buffer` / `Uint8Array`.
 */
export function expandDmxSamples(samples: Uint8Array, sourceRate: number, outputRate: number): Int16Array {
  if (!(samples instanceof Uint8Array)) {
    throw new TypeError(`samples must be a Uint8Array (or Buffer), got ${typeof samples}`);
  }
  const expandedLength = computeExpandedLength(samples.length, sourceRate, outputRate);
  const output = new Int16Array(expandedLength);
  if (expandedLength === 0) {
    return output;
  }
  const ratio = computeExpandRatio(samples.length, expandedLength);
  for (let i = 0; i < expandedLength; i++) {
    const src = (i * ratio) >> EXPAND_RATIO_SHIFT;
    const byte = samples[src] ?? PCM_BYTE_MIDPOINT;
    output[i] = (byte | (byte << 8)) - 0x8000;
  }
  return output;
}

/** Left / right pair returned by {@link computeStereoGains}. */
export interface StereoGains {
  /** Left-channel gain from `((254 - sep) * vol) / 127`. */
  readonly left: number;

  /** Right-channel gain from `(sep * vol) / 127`. */
  readonly right: number;
}

/**
 * Compute the (left, right) channel gains chocolate-doom hands to
 * `Mix_SetPanning`.  Uses C integer division (`Math.trunc`), so the
 * extreme separation values (`0` and `255`) produce asymmetric
 * results — one side can exceed {@link MIX_MAX_VOLUME} and the other
 * can go negative, which SDL_mixer clamps downstream.  The formula
 * is exposed unclamped so a port can reproduce the vanilla
 * asymmetry bit-for-bit.
 *
 * @throws {RangeError} If `volume` is negative or separation is
 *   outside `[0, 255]` or either argument is not an integer.
 */
export function computeStereoGains(volume: number, separation: number): StereoGains {
  if (!Number.isInteger(volume) || volume < 0) {
    throw new RangeError(`volume must be a non-negative integer, got ${volume}`);
  }
  if (!Number.isInteger(separation) || separation < 0 || separation > 0xff) {
    throw new RangeError(`separation must be an integer in [0, 255], got ${separation}`);
  }
  const left = Math.trunc(((SEP_LEFT_MAX - separation) * volume) / MIX_MAX_VOLUME);
  const right = Math.trunc((separation * volume) / MIX_MAX_VOLUME);
  return { left, right };
}

/**
 * One active voice in the PCM mixer.  Holds a reference to a
 * pre-expanded signed 16-bit mono sample buffer at the output rate,
 * the next output sample to read (`position`), and the
 * {@link StereoGains} pair computed from its (volume, separation).
 * `finished` goes `true` when the mixer has consumed every sample,
 * so callers can reap the slot on the next tic.
 */
export interface MixerVoice {
  /** Pre-expanded signed 16-bit mono samples at the output rate. */
  samples: Int16Array;

  /** Next output sample index to read from {@link samples}. */
  position: number;

  /** Left-channel gain from {@link computeStereoGains}. */
  leftGain: number;

  /** Right-channel gain from {@link computeStereoGains}. */
  rightGain: number;

  /** `true` once every sample has been consumed. */
  finished: boolean;
}

/**
 * Create a {@link MixerVoice} for the supplied pre-expanded sample
 * buffer and (volume, separation) pair.  Convenience wrapper around
 * {@link computeStereoGains} that fills in `position = 0` and
 * `finished = samples.length === 0`.
 *
 * @throws {RangeError} If `samples` is not an `Int16Array` or
 *   `volume` / `separation` are invalid.
 */
export function createMixerVoice(samples: Int16Array, volume: number, separation: number): MixerVoice {
  if (!(samples instanceof Int16Array)) {
    throw new TypeError(`samples must be an Int16Array, got ${typeof samples}`);
  }
  const { left, right } = computeStereoGains(volume, separation);
  return {
    samples,
    position: 0,
    leftGain: left,
    rightGain: right,
    finished: samples.length === 0,
  };
}

/**
 * Mix a list of {@link MixerVoice}s into `frameCount` interleaved
 * signed 16-bit stereo frames (2 samples per frame, left before
 * right).  Each voice advances by one sample per frame until it is
 * exhausted, at which point it is marked `finished` and contributes
 * silence to the remaining frames.  Per-sample contributions are
 * accumulated as signed 32-bit integers and saturated to the int16
 * range via {@link clipToInt16} before being written to the output
 * buffer, so any number of overlapping voices can mix without wrap
 * artefacts.
 *
 * The caller may supply an `output` buffer of length
 * `frameCount * 2`; otherwise a fresh `Int16Array` is allocated.
 * The buffer is zero-filled at the start of the call so stale data
 * from prior tics never leaks into the current mix.
 *
 * Per-sample accumulator derivation:
 *
 * ```
 * contribution = (sample16 * gain) / MIX_MAX_VOLUME  // toward zero
 * accumL += contributionL
 * accumR += contributionR
 * output[2*f]   = clipToInt16(accumL)
 * output[2*f+1] = clipToInt16(accumR)
 * ```
 *
 * @throws {RangeError} If `frameCount` is not a non-negative
 *   integer, or `output` is provided with a length other than
 *   `frameCount * 2`.
 */
export function mixVoices(voices: MixerVoice[], frameCount: number, output?: Int16Array): Int16Array {
  if (!Number.isInteger(frameCount) || frameCount < 0) {
    throw new RangeError(`frameCount must be a non-negative integer, got ${frameCount}`);
  }
  const frameBytes = frameCount * 2;
  let buffer: Int16Array;
  if (output === undefined) {
    buffer = new Int16Array(frameBytes);
  } else {
    if (output.length !== frameBytes) {
      throw new RangeError(`output must have length frameCount*2 (${frameBytes}), got ${output.length}`);
    }
    buffer = output;
    buffer.fill(0);
  }

  if (frameCount === 0 || voices.length === 0) {
    return buffer;
  }

  for (let f = 0; f < frameCount; f++) {
    let accumL = 0;
    let accumR = 0;
    for (const voice of voices) {
      if (voice.finished || voice.position >= voice.samples.length) {
        voice.finished = true;
        continue;
      }
      const sample = voice.samples[voice.position]!;
      accumL += Math.trunc((sample * voice.leftGain) / MIX_MAX_VOLUME);
      accumR += Math.trunc((sample * voice.rightGain) / MIX_MAX_VOLUME);
      voice.position += 1;
      if (voice.position >= voice.samples.length) {
        voice.finished = true;
      }
    }
    buffer[f * 2] = clipToInt16(accumL);
    buffer[f * 2 + 1] = clipToInt16(accumR);
  }

  return buffer;
}
