/**
 * Vanilla DOOM 1.9 mixer sample-stepping parity facts.
 *
 * From Chocolate Doom 2.2.1 `i_sdlsound.c` `ExpandSoundData_SDL`:
 *
 *   expanded_length = ((uint64_t) length * mixer_freq) / samplerate;
 *   expand_ratio    = (length << 8) / expanded_length;
 *   for (i = 0; i < expanded_length; ++i)
 *   {
 *       src = (i * expand_ratio) >> 8;
 *       sample = data[src] | (data[src] << 8);
 *       sample -= 32768;
 *       expanded[i * 2]     = sample;
 *       expanded[i * 2 + 1] = sample;
 *   }
 *
 * The expansion runs ONCE at sfx-load time — every DMX lump is
 * upsampled from the native 11025 Hz to the output mixer rate (default
 * 44100 Hz) and replicated mono → stereo using nearest-neighbour
 * sample-and-hold via an 8.8 fixed-point step.
 *
 * Parity-critical invariants pinned here:
 *
 *   1. The expanded length is `(srcLength * mixerFreq) / srcRate`
 *      using C integer division (truncation toward zero).  Vanilla
 *      computes via uint64 to avoid 32-bit overflow on large sfx; JS
 *      doubles have 53-bit integer precision so a direct multiply is
 *      safe for the lump sizes vanilla actually uses.
 *   2. The step ratio is an 8.8 fixed-point value:
 *        expand_ratio = (length << 8) / expanded_length
 *      Computed with C integer division (truncation).  When
 *      `expanded_length === 0` (empty source) the divide is undefined
 *      in C; we return 0.
 *   3. The 8 fractional bits give the step sub-sample precision.
 *      `expand_ratio = 64` means "advance 1/4 source sample per
 *      output sample" (a 4:1 upsample).  `expand_ratio = 256` means
 *      "advance exactly 1 source sample per output sample" (1:1).
 *   4. Per output sample `i`:
 *        src = (i * expand_ratio) >> 8
 *      The right shift truncates the fractional bits.  No rounding —
 *      vanilla's nearest-neighbour is actually "floor toward zero",
 *      which means a 4:1 upsample's first four output samples all
 *      read src=0, the next four read src=1, etc.
 *   5. DMX native rate is 11025 Hz (F-028).  The sole exception is
 *      `DSITMBK` at 22050 Hz.  Default mixer rate is 44100 Hz (F-033).
 *   6. The mono-to-stereo replicate happens INSIDE the loop: each
 *      output index writes to `expanded[i*2]` AND `expanded[i*2+1]`
 *      with the same sample.  Sfx are mono in the source and stereo
 *      pan is applied at mix time, not here.
 *   7. Source sample expansion uses `data[src] | (data[src] << 8)` —
 *      replicate the unsigned 8-bit byte into both halves of a 16-bit
 *      word, then subtract 32768 to recentre.  This is the DMX
 *      conversion pinned by 11-009.
 */

/** Number of fractional bits in the 8.8 expand_ratio step. */
export const VANILLA_MIXER_EXPAND_RATIO_SHIFT = 8;

/** Scale factor for the expand_ratio fixed-point step (`1 << SHIFT`). */
export const VANILLA_MIXER_EXPAND_RATIO_SCALE = 256;

/** DMX native sample rate (Hz). */
export const VANILLA_MIXER_DMX_NATIVE_RATE = 11_025;

/** Default chocolate-doom output mixer rate (Hz). */
export const VANILLA_MIXER_DEFAULT_OUTPUT_RATE = 44_100;

/**
 * Compute the expanded length for a DMX lump.  Mirrors:
 *
 *   expanded_length = ((uint64_t) srcLength * mixerFreq) / srcRate
 */
export function vanillaMixerExpandedLength(srcLength: number, srcRate: number, mixerFreq: number): number {
  if (!Number.isInteger(srcLength) || srcLength < 0) {
    throw new RangeError(`vanillaMixerExpandedLength: srcLength must be a non-negative integer, got ${srcLength}`);
  }
  if (!Number.isInteger(srcRate) || srcRate <= 0) {
    throw new RangeError(`vanillaMixerExpandedLength: srcRate must be a positive integer, got ${srcRate}`);
  }
  if (!Number.isInteger(mixerFreq) || mixerFreq <= 0) {
    throw new RangeError(`vanillaMixerExpandedLength: mixerFreq must be a positive integer, got ${mixerFreq}`);
  }
  return Math.trunc((srcLength * mixerFreq) / srcRate);
}

/**
 * Compute the 8.8 fixed-point step ratio used by the per-output-sample
 * loop.  Mirrors:
 *
 *   expand_ratio = (srcLength << 8) / expandedLength
 *
 * Returns `0` when `expandedLength === 0` (vanilla divide-by-zero).
 */
export function vanillaMixerExpandRatio(srcLength: number, expandedLength: number): number {
  if (!Number.isInteger(srcLength) || srcLength < 0) {
    throw new RangeError(`vanillaMixerExpandRatio: srcLength must be a non-negative integer, got ${srcLength}`);
  }
  if (!Number.isInteger(expandedLength) || expandedLength < 0) {
    throw new RangeError(`vanillaMixerExpandRatio: expandedLength must be a non-negative integer, got ${expandedLength}`);
  }
  if (expandedLength === 0) return 0;
  return Math.trunc((srcLength << VANILLA_MIXER_EXPAND_RATIO_SHIFT) / expandedLength);
}

/**
 * Compute the source index for output sample `i`:
 *
 *   src = (i * expand_ratio) >> 8
 *
 * The right shift truncates the fractional bits (floor toward zero).
 */
export function vanillaMixerSourceIndex(outputIndex: number, expandRatio: number): number {
  return (outputIndex * expandRatio) >> VANILLA_MIXER_EXPAND_RATIO_SHIFT;
}
