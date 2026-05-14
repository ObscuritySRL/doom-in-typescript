/**
 * SFX oracle window comparator contract.
 *
 * The SFX oracle is a sequence of fixed-length PCM windows captured from
 * a reference DOOM run (DOS or Chocolate Doom) over a deterministic
 * input script.  Replay parity is established by capturing the same
 * windows from this implementation and byte-comparing them.
 *
 * Window contract:
 *   - Sample rate: 11025 Hz (matches vanilla DMX digital sfx rate).
 *   - Sample format: signed 16-bit little-endian, stereo interleaved
 *     (L, R, L, R...).  The DMX mixer outputs unsigned 8-bit per
 *     sample but the audio device receives a final post-mix signed
 *     16-bit stereo stream after volume + separation are applied.
 *   - Window size: WINDOW_SAMPLES_PER_FRAME samples per stereo frame,
 *     captured at gametic boundaries (35 Hz).  Each window covers
 *     11025 / 35 = 315 samples per channel = 1260 bytes signed-16
 *     stereo.
 *
 * Comparison:
 *   - Strict equality: every byte of every window must match.
 *   - Allowable drift: zero.  Sample-level drift would let
 *     accumulating-precision rounding hide regression.
 */

export const VANILLA_SFX_ORACLE_SAMPLE_RATE_HZ = 11025;
export const VANILLA_SFX_ORACLE_GAMETICS_PER_SECOND = 35;
export const VANILLA_SFX_ORACLE_SAMPLES_PER_GAMETIC = 315;
export const VANILLA_SFX_ORACLE_BYTES_PER_SAMPLE_PAIR = 4;
export const VANILLA_SFX_ORACLE_WINDOW_BYTES_PER_GAMETIC = 1260;

export interface SfxOracleWindow {
  readonly gameTic: number;
  readonly samples: Buffer;
}

export function vanillaSfxOracleWindowIsValid(window: SfxOracleWindow): boolean {
  if (!Number.isInteger(window.gameTic) || window.gameTic < 0) return false;
  if (window.samples.length !== VANILLA_SFX_ORACLE_WINDOW_BYTES_PER_GAMETIC) return false;
  return true;
}

export function vanillaSfxOracleWindowsEqual(actual: readonly SfxOracleWindow[], expected: readonly SfxOracleWindow[]): boolean {
  if (actual.length !== expected.length) return false;
  for (let index = 0; index < actual.length; index += 1) {
    const a = actual[index]!;
    const e = expected[index]!;
    if (a.gameTic !== e.gameTic) return false;
    if (a.samples.length !== e.samples.length) return false;
    if (Buffer.compare(a.samples, e.samples) !== 0) return false;
  }
  return true;
}
