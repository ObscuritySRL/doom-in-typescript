/**
 * Vanilla DOOM 1.9 PCM mixer clipping (saturation) parity facts.
 *
 * From Chocolate Doom 2.2.1 `i_sdlsound.c` and the SDL_mixer mixing
 * stage that feeds the audio output device.  The real-time mixer
 * accumulates per-voice signed 16-bit samples (post-volume and
 * post-pan) into a wider intermediate type and saturates the final
 * mixed sample at the signed 16-bit range before emitting.
 *
 *   // Per output frame, for each active voice:
 *   //   accumLeft  += (voice.sample * gainLeft)  >> shift
 *   //   accumRight += (voice.sample * gainRight) >> shift
 *   // After all voices contribute:
 *   //   if (accumLeft  >  INT16_MAX) accumLeft  = INT16_MAX;
 *   //   if (accumLeft  <  INT16_MIN) accumLeft  = INT16_MIN;
 *   //   if (accumRight >  INT16_MAX) accumRight = INT16_MAX;
 *   //   if (accumRight <  INT16_MIN) accumRight = INT16_MIN;
 *
 * Parity-critical invariants pinned here:
 *
 *   1. The mixer saturates the final mixed sample at INT16_MIN /
 *      INT16_MAX = `-32768` / `+32767` (C `int16_t` bounds).  Two
 *      overlapping sfx that would otherwise exceed those bounds
 *      produce a clipped peak, NOT a wrapped (negative-from-positive)
 *      discontinuity.
 *   2. Saturation is per-channel (left and right are clipped
 *      independently); a sample at INT16_MAX on the left while the
 *      right is at -8000 stays asymmetric — there is no joint
 *      stereo normalization.
 *   3. The intermediate accumulator is wider than int16 — vanilla
 *      uses C `int` (≥ 32-bit on every platform it targets) so the
 *      sum of two int16 samples cannot overflow before the saturation
 *      step.  A port that uses int16 accumulation directly would
 *      WRAP instead of CLIP, producing loud discontinuities.
 *   4. Saturation does NOT change the bit pattern of in-range values.
 *      A sample at exactly INT16_MAX stays at INT16_MAX; a sample at
 *      exactly INT16_MIN stays at INT16_MIN; only out-of-range
 *      accumulator values are clamped.
 *   5. The DMX byte → int16 conversion `(b | (b << 8)) - 32768` gives
 *      byte `0x00 → -32768` and `0xFF → +32767`, so a single voice
 *      cannot exceed the int16 range; clipping only fires when
 *      multiple voices SUM beyond the range.
 *   6. The DMX silence byte (`0x80`) decodes to `+128`, NOT `0` — a
 *      load-bearing quirk preserved by the audio-hash oracle (the
 *      mixed output is hashed pre-output-device).
 */

/** Signed 16-bit minimum (`INT16_MIN` from C). */
export const VANILLA_MIXER_INT16_MIN = -32768;

/** Signed 16-bit maximum (`INT16_MAX` from C). */
export const VANILLA_MIXER_INT16_MAX = 32767;

/** DC midpoint of the DMX unsigned 8-bit encoding. */
export const VANILLA_MIXER_DMX_MIDPOINT = 0x80;

/** Vanilla DMX silence byte (0x80) → int16 value (NOT zero). */
export const VANILLA_MIXER_DMX_SILENCE_INT16 = 128;

/**
 * Saturate an integer accumulator at `[INT16_MIN, INT16_MAX]`.
 * Returns the input unchanged when already in range, otherwise the
 * nearest bound.
 *
 *   if (acc > INT16_MAX) return INT16_MAX
 *   if (acc < INT16_MIN) return INT16_MIN
 *   return acc
 */
export function vanillaMixerClipToInt16(acc: number): number {
  if (acc > VANILLA_MIXER_INT16_MAX) return VANILLA_MIXER_INT16_MAX;
  if (acc < VANILLA_MIXER_INT16_MIN) return VANILLA_MIXER_INT16_MIN;
  return acc | 0;
}

/**
 * Saturate left and right channels independently — vanilla's per-side
 * clipping behavior.  Asymmetric stereo input remains asymmetric;
 * there is no joint normalization.
 */
export function vanillaMixerClipStereo(accLeft: number, accRight: number): { left: number; right: number } {
  return {
    left: vanillaMixerClipToInt16(accLeft),
    right: vanillaMixerClipToInt16(accRight),
  };
}

/**
 * Convert a single DMX byte (unsigned 8-bit, `0..255`) to signed
 * 16-bit using the chocolate-doom `ExpandSoundData_SDL` formula
 * `(b | (b << 8)) - 32768`.  Preserves the vanilla silence quirk
 * (byte `0x80` → `+128`).
 */
export function vanillaMixerDmxByteToInt16(byte: number): number {
  if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
    throw new RangeError(`vanillaMixerDmxByteToInt16: byte must be integer in [0, 255], got ${byte}`);
  }
  return ((byte | (byte << 8)) - 32768) | 0;
}
