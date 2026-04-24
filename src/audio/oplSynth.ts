/**
 * OPL2 (YM3812) FM synthesis core.
 *
 * Implements the pure-mathematical primitives that turn the register
 * state produced by {@link ./oplRegisters.ts} (F-162) into per-sample
 * signed 16-bit audio at the chip's native 49716 Hz rate.  Chocolate
 * Doom 2.2.1's `i_oplmusic.c` runs a MAME-derived YM3812 emulator in
 * OPL2-compatibility mode; this module mirrors that emulator's core
 * waveform and phase primitives without the envelope generator (owned
 * by 15-011 music-device-integration which manages per-voice state).
 *
 * The module exposes:
 *
 *  - {@link OPL_SAMPLE_RATE_HZ} — the 49716 Hz chip rate derived from
 *    the YM3812 master clock (14.31818 MHz / 288).
 *  - {@link OPL_MULTIPLIER_TABLE_X2} — the canonical 16-entry
 *    multiplier lookup (doubled to keep integer math) mapping the
 *    4-bit register field to the chip's documented 0.5/1/2/.../15
 *    frequency multipliers.  Entries 11 and 13 are the documented
 *    duplicates (`{10, 10, 12, 12}`) that give the YM3812 its
 *    characteristic gaps at those positions.
 *  - {@link OPL_SINE_QUARTER_TABLE} — a 256-entry quarter-wave
 *    `Int16Array` holding `round(32767 * sin((i + 0.5) * π / 512))`
 *    for `i` in `[0, 256)`.  Mirroring and signing are applied by
 *    {@link computeWaveformSample} to build the full 1024-sample
 *    period across all four OPL2 waveform shapes.
 *  - {@link OPL_WAVEFORM_SINE} / {@link OPL_WAVEFORM_HALF_SINE} /
 *    {@link OPL_WAVEFORM_FULL_RECT} / {@link OPL_WAVEFORM_QUARTER_RECT}
 *    — the four waveform selector values the YM3812 honours on OPL2
 *    (register 0xE0 bits 0-1).  Values outside `[0, 3]` are rejected
 *    by {@link computeWaveformSample} so a port that forgets to mask
 *    the waveform-select byte to 0x03 cannot silently emit OPL3
 *    waveforms 4..7.
 *  - {@link computePhaseIncrement} — the per-sample 20-bit phase
 *    advance given an `fNumber` (10-bit), `block` (3-bit octave), and
 *    4-bit multiplier code.  One full cycle through the 1024-sample
 *    waveform LUT corresponds to `2^20` phase units, so the output
 *    frequency in Hz is
 *    `phase_inc * OPL_SAMPLE_RATE_HZ / (1 << 20)`.
 *  - {@link advancePhase} — masks `phase + delta` back into the
 *    20-bit accumulator range, handling negative deltas (used for FM
 *    modulation with negative modulator output) by adding the modulo
 *    before masking so the JavaScript bitwise-AND produces the correct
 *    unsigned wrap.
 *  - {@link computeWaveformSample} — converts a 20-bit phase plus a
 *    waveform selector into a signed int16 sample by indexing the
 *    quarter-wave table with the top 10 bits of the phase and applying
 *    the per-waveform sign / mirror / silence logic.
 *  - {@link computeTotalLevelGain} — the TL (Total Level) 0.75 dB-per-
 *    step attenuation formula.  TL ranges 0..63, gain ranges from 1.0
 *    (TL=0, no attenuation) to ~0.00434 (TL=63, 47.25 dB attenuation).
 *  - {@link applyTotalLevel} — multiplies a signed int16 waveform
 *    sample by the TL linear gain and truncates back to int16.
 *  - {@link combineOperators} — selects per-algorithm mixing.  On
 *    algorithm 0 (FM / serial) the caller has already phase-modulated
 *    the carrier with the modulator output so the channel output is
 *    just the carrier sample.  On algorithm 1 (additive / parallel)
 *    both operator samples are summed and saturated to int16.
 *
 * Parity-critical details preserved here:
 *
 *  - The multiplier table's {10, 10, 12, 12, 15, 15} duplicates at
 *    positions 10/11/12/13/14/15 are documented YM3812 behaviour.
 *    A port that "fixes" the gaps (e.g., to {10, 11, 12, 13, 14, 15})
 *    would shift every pitch that uses those codes and audibly detune
 *    every GENMIDI instrument that relies on them.
 *  - The 20-bit phase accumulator with 10 bits consumed by the LUT
 *    index plus 10 bits of sub-sample precision matches the
 *    MAME/DOSBox reference — the sub-sample bits are dropped before
 *    lookup (`phase >> OPL_PHASE_LUT_SHIFT`) but accumulate across
 *    samples so the effective pitch resolution is
 *    `OPL_SAMPLE_RATE_HZ / 2^20` ≈ 0.0474 Hz.
 *  - The sine table uses (i + 0.5) offset so the quarter-wave is
 *    sampled at the centre of each bin — this matches the MAME OPL2
 *    emulator's table and avoids the phase-shift that (i) offsets
 *    would introduce at low frequencies.
 *  - Waveform 3 (quarter-rect) zeros the second and fourth quarters of
 *    each period instead of the negative half-cycle.  A port that
 *    confused waveform 3 with "half sine shifted" would produce
 *    audibly different harmonic content on percussion instruments.
 *  - TL uses base-10 conversion (`10^(-0.75 * tl / 20)`) rather than
 *    the `2^(-tl/8)` approximation so the 0.75 dB step matches the
 *    chip's documented linear-in-dB attenuation at all TL values, not
 *    just the octave boundaries.
 *  - {@link combineOperators} on algorithm 0 returns ONLY the carrier
 *    sample, matching the YM3812's FM topology where the modulator's
 *    output is consumed as phase modulation and does not appear in the
 *    channel output directly.  A port that summed both operators on
 *    algorithm 0 would double the output level and change the harmonic
 *    content of every FM instrument.
 *
 * The module is pure: every function is referentially transparent, no
 * global mutable state, zero Win32 bindings, zero audio device calls.
 * The only allocation is the pre-computed {@link OPL_SINE_QUARTER_TABLE}
 * built at module load.
 *
 * @example
 * ```ts
 * import {
 *   OPL_ALGORITHM_FM,
 *   OPL_WAVEFORM_SINE,
 *   advancePhase,
 *   applyTotalLevel,
 *   combineOperators,
 *   computePhaseIncrement,
 *   computeWaveformSample,
 * } from '../src/audio/oplSynth.ts';
 *
 * // Render one sample of a two-operator FM voice:
 * const modInc = computePhaseIncrement(512, 4, 1);   // modulator 388.5 Hz
 * const carInc = computePhaseIncrement(512, 4, 1);   // carrier 388.5 Hz
 * let modPhase = 0;
 * let carPhase = 0;
 * for (let frame = 0; frame < 441; frame++) {
 *   modPhase = advancePhase(modPhase, modInc);
 *   const modSample = applyTotalLevel(
 *     computeWaveformSample(modPhase, OPL_WAVEFORM_SINE),
 *     16,
 *   );
 *   carPhase = advancePhase(carPhase, carInc + modSample * 4);
 *   const carSample = applyTotalLevel(
 *     computeWaveformSample(carPhase, OPL_WAVEFORM_SINE),
 *     0,
 *   );
 *   const channelSample = combineOperators(modSample, carSample, OPL_ALGORITHM_FM);
 * }
 * ```
 */

/**
 * YM3812 chip sample rate in Hertz.  Derived from the 14.31818 MHz
 * master clock divided by 288 (72 samples * 4 operator channels).
 */
export const OPL_SAMPLE_RATE_HZ = 49716;

/** Phase accumulator width in bits; a full cycle equals `1 << 20` phase units. */
export const OPL_PHASE_ACCUMULATOR_BITS = 20;

/** Modulo value for the phase accumulator (`1 << 20`). */
export const OPL_PHASE_ACCUMULATOR_MODULO = 1 << OPL_PHASE_ACCUMULATOR_BITS;

/** Bit-mask for the phase accumulator (`(1 << 20) - 1`). */
export const OPL_PHASE_ACCUMULATOR_MASK = OPL_PHASE_ACCUMULATOR_MODULO - 1;

/** Number of waveform samples per full cycle (top 10 bits of the 20-bit phase). */
export const OPL_WAVEFORM_SAMPLES_PER_PERIOD = 1024;

/** Right-shift applied to the phase accumulator to produce the 10-bit LUT index. */
export const OPL_PHASE_LUT_SHIFT = OPL_PHASE_ACCUMULATOR_BITS - 10;

/** Mask isolating the 10-bit waveform LUT index (`OPL_WAVEFORM_SAMPLES_PER_PERIOD - 1`). */
export const OPL_WAVEFORM_PHASE_MASK = OPL_WAVEFORM_SAMPLES_PER_PERIOD - 1;

/** Number of entries in the quarter-wave sine lookup table. */
export const OPL_QUARTER_WAVE_TABLE_SIZE = 256;

/** Inclusive upper bound on signed 16-bit waveform output. */
export const OPL_SAMPLE_PEAK = 32767;

/** Inclusive lower bound on signed 16-bit waveform output. */
export const OPL_SAMPLE_NADIR = -32768;

/** Inclusive upper bound on a valid multiplier code (4-bit register field). */
export const OPL_MULTIPLIER_CODE_MAX = 15;

/** Inclusive upper bound on a valid FNumber (10-bit field). */
export const OPL_FNUMBER_MAX = 1023;

/** Inclusive upper bound on a valid block / octave code (3-bit field). */
export const OPL_BLOCK_MAX = 7;

/** Waveform selector: full sine (both halves). */
export const OPL_WAVEFORM_SINE = 0;

/** Waveform selector: half sine (positive half; silence in the negative half). */
export const OPL_WAVEFORM_HALF_SINE = 1;

/** Waveform selector: full-rectified sine (|sine|; two positive humps per cycle). */
export const OPL_WAVEFORM_FULL_RECT = 2;

/** Waveform selector: quarter-rectified sine (two rising quarter-bumps per cycle). */
export const OPL_WAVEFORM_QUARTER_RECT = 3;

/** Number of waveform selectors honoured on OPL2 (bits 0-1 of register 0xE0). */
export const OPL_WAVEFORM_COUNT = 4;

/** Decibel attenuation per TL step (Total Level 0..63 → 0..47.25 dB). */
export const OPL_TL_DB_STEP = 0.75;

/** Inclusive upper bound on a valid Total Level field (6-bit). */
export const OPL_TL_MAX = 63;

/** Algorithm / connection selector: FM / serial (modulator phase-modulates carrier). */
export const OPL_ALGORITHM_FM = 0;

/** Algorithm / connection selector: additive / parallel (operators summed at the output). */
export const OPL_ALGORITHM_ADDITIVE = 1;

/**
 * Canonical YM3812 frequency-multiplier lookup, stored doubled so the
 * per-sample phase increment can use integer math.  Code 0 maps to
 * 0.5 (stored as 1), code 1 to 1 (stored as 2), ..., code 15 to 15
 * (stored as 30).  Positions 11 and 13 carry documented duplicates
 * (10, 12) giving the chip its audible gaps at those codes.
 */
export const OPL_MULTIPLIER_TABLE_X2: readonly number[] = Object.freeze([
  1, // code 0: 0.5
  2, // code 1: 1
  4, // code 2: 2
  6, // code 3: 3
  8, // code 4: 4
  10, // code 5: 5
  12, // code 6: 6
  14, // code 7: 7
  16, // code 8: 8
  18, // code 9: 9
  20, // code 10: 10
  20, // code 11: 10 (documented duplicate)
  24, // code 12: 12
  24, // code 13: 12 (documented duplicate)
  30, // code 14: 15
  30, // code 15: 15 (documented duplicate)
]);

/**
 * 256-entry quarter-wave sine lookup table.
 *
 * `OPL_SINE_QUARTER_TABLE[i] = round(32767 * sin((i + 0.5) * π / 512))`
 * for `i` in `[0, 256)`.  The centre-of-bin (`+ 0.5`) offset matches
 * MAME's YM3812 emulator and avoids the phase-shift that a simple
 * `i * π / 512` table would introduce at low frequencies.
 *
 * {@link computeWaveformSample} uses this table with mirroring (second
 * quarter of each half-cycle) and signing (negative half of each full
 * cycle) to build every point of every OPL2 waveform.
 */
export const OPL_SINE_QUARTER_TABLE: Int16Array = buildSineQuarterTable();

/**
 * 64-entry Total-Level linear-gain lookup.  `OPL_TOTAL_LEVEL_GAIN_TABLE[tl]`
 * equals `10^(-0.75 * tl / 20)` — the same value
 * {@link computeTotalLevelGain} returns — precomputed so the
 * {@link applyTotalLevel} per-sample path is a single array read
 * instead of a `Math.pow` call.  Index 0 is exactly `1`.
 */
export const OPL_TOTAL_LEVEL_GAIN_TABLE: Float64Array = buildTotalLevelGainTable();

/**
 * Look up the doubled multiplier for a 4-bit multiplier code.
 *
 * @throws {RangeError} If `code` is not an integer in
 *   `[0, OPL_MULTIPLIER_CODE_MAX]`.
 */
export function multiplierCodeToDoubled(code: number): number {
  if (!Number.isInteger(code) || code < 0 || code > OPL_MULTIPLIER_CODE_MAX) {
    throw new RangeError(`OPL multiplier code must be an integer in [0, ${OPL_MULTIPLIER_CODE_MAX}], got ${code}`);
  }
  return OPL_MULTIPLIER_TABLE_X2[code]!;
}

/**
 * Compute the per-sample 20-bit phase increment for a voice whose
 * channel registers carry the given FNumber and block and whose
 * operator register carries the given multiplier code.  One full
 * waveform cycle equals {@link OPL_PHASE_ACCUMULATOR_MODULO} phase
 * units, so the resulting output frequency is
 * `phase_inc * OPL_SAMPLE_RATE_HZ / (1 << 20)` Hz.
 *
 * @throws {RangeError} If `fNumber` is outside `[0, OPL_FNUMBER_MAX]`,
 *   `block` is outside `[0, OPL_BLOCK_MAX]`, or the multiplier code is
 *   invalid (delegated to {@link multiplierCodeToDoubled}).
 */
export function computePhaseIncrement(fNumber: number, block: number, multiplierCode: number): number {
  if (!Number.isInteger(fNumber) || fNumber < 0 || fNumber > OPL_FNUMBER_MAX) {
    throw new RangeError(`OPL fNumber must be an integer in [0, ${OPL_FNUMBER_MAX}], got ${fNumber}`);
  }
  if (!Number.isInteger(block) || block < 0 || block > OPL_BLOCK_MAX) {
    throw new RangeError(`OPL block must be an integer in [0, ${OPL_BLOCK_MAX}], got ${block}`);
  }
  const multiplierDoubled = multiplierCodeToDoubled(multiplierCode);
  return ((fNumber << block) * multiplierDoubled) >>> 1;
}

/**
 * Advance a 20-bit phase accumulator by `delta` phase units and wrap
 * back into the accumulator range.  Accepts negative deltas (used for
 * FM modulation when the modulator output is negative) by adding the
 * modulo before masking so the wraparound matches unsigned integer
 * semantics.
 *
 * @throws {RangeError} If `phase` is not an integer in
 *   `[0, OPL_PHASE_ACCUMULATOR_MASK]` or `delta` is not an integer.
 */
export function advancePhase(phase: number, delta: number): number {
  if (!Number.isInteger(phase) || phase < 0 || phase > OPL_PHASE_ACCUMULATOR_MASK) {
    throw new RangeError(`OPL phase must be an integer in [0, ${OPL_PHASE_ACCUMULATOR_MASK}], got ${phase}`);
  }
  if (!Number.isInteger(delta)) {
    throw new RangeError(`OPL phase delta must be an integer, got ${delta}`);
  }
  // `& MASK` is equivalent to floor-mod by MODULO for every int32 sum because
  // MODULO divides 2^32 (the int32 coercion modulus).  For `phase + delta`
  // outside int32 range, JS `&` first applies ToInt32 (reduces mod 2^32),
  // then masks — same net result because MODULO divides 2^32.
  return (phase + delta) & OPL_PHASE_ACCUMULATOR_MASK;
}

/**
 * Compute a signed int16 waveform sample at the given 20-bit phase for
 * an OPL2 operator with the given waveform selector.  Uses
 * {@link OPL_SINE_QUARTER_TABLE} with mirroring across each half-cycle
 * and signing across the full cycle.  Waveforms 1..3 apply additional
 * per-waveform masking.
 *
 * @throws {RangeError} If `phase` is not an integer in
 *   `[0, OPL_PHASE_ACCUMULATOR_MASK]` or `waveform` is not an integer
 *   in `[0, OPL_WAVEFORM_COUNT - 1]`.
 */
export function computeWaveformSample(phase: number, waveform: number): number {
  if (!Number.isInteger(phase) || phase < 0 || phase > OPL_PHASE_ACCUMULATOR_MASK) {
    throw new RangeError(`OPL phase must be an integer in [0, ${OPL_PHASE_ACCUMULATOR_MASK}], got ${phase}`);
  }
  if (!Number.isInteger(waveform) || waveform < 0 || waveform >= OPL_WAVEFORM_COUNT) {
    throw new RangeError(`OPL waveform must be an integer in [0, ${OPL_WAVEFORM_COUNT - 1}], got ${waveform}`);
  }
  const lutPhase = (phase >>> OPL_PHASE_LUT_SHIFT) & OPL_WAVEFORM_PHASE_MASK;
  switch (waveform) {
    case OPL_WAVEFORM_SINE:
      return sineSample(lutPhase);
    case OPL_WAVEFORM_HALF_SINE:
      return (lutPhase & 0x200) !== 0 ? 0 : quarterMagnitude(lutPhase);
    case OPL_WAVEFORM_FULL_RECT:
      return quarterMagnitude(lutPhase);
    case OPL_WAVEFORM_QUARTER_RECT:
      return (lutPhase & 0x100) !== 0 ? 0 : OPL_SINE_QUARTER_TABLE[lutPhase & 0xff]!;
    default:
      return 0;
  }
}

/**
 * Return the linear gain (in `[0, 1]`) applied by a Total Level of
 * `tl`.  `tl = 0` returns `1`; every unit of `tl` attenuates by
 * {@link OPL_TL_DB_STEP} dB.
 *
 * @throws {RangeError} If `tl` is not an integer in `[0, OPL_TL_MAX]`.
 */
export function computeTotalLevelGain(tl: number): number {
  if (!Number.isInteger(tl) || tl < 0 || tl > OPL_TL_MAX) {
    throw new RangeError(`OPL total level must be an integer in [0, ${OPL_TL_MAX}], got ${tl}`);
  }
  return OPL_TOTAL_LEVEL_GAIN_TABLE[tl]!;
}

/**
 * Apply a Total Level attenuation to a signed int16 waveform sample
 * and saturate the result back to the int16 range.  Returns `0` when
 * `sample` is `0` regardless of `tl`.
 *
 * @throws {RangeError} If `sample` is not an integer in
 *   `[OPL_SAMPLE_NADIR, OPL_SAMPLE_PEAK]` or `tl` is out of range
 *   (delegated to {@link computeTotalLevelGain}).
 */
export function applyTotalLevel(sample: number, tl: number): number {
  if (!Number.isInteger(sample) || sample < OPL_SAMPLE_NADIR || sample > OPL_SAMPLE_PEAK) {
    throw new RangeError(`OPL sample must be an integer in [${OPL_SAMPLE_NADIR}, ${OPL_SAMPLE_PEAK}], got ${sample}`);
  }
  const gain = computeTotalLevelGain(tl);
  const attenuated = (sample * gain) | 0;
  if (attenuated > OPL_SAMPLE_PEAK) return OPL_SAMPLE_PEAK;
  if (attenuated < OPL_SAMPLE_NADIR) return OPL_SAMPLE_NADIR;
  return attenuated;
}

/**
 * Combine the two operator samples of a channel into a single channel
 * sample according to the channel's algorithm bit.
 *
 * - Algorithm 0 (FM / serial, {@link OPL_ALGORITHM_FM}): the modulator
 *   output was already consumed as phase modulation by the caller when
 *   computing the carrier sample, so the channel output is just the
 *   carrier sample.
 * - Algorithm 1 (additive / parallel, {@link OPL_ALGORITHM_ADDITIVE}):
 *   both operators contribute directly; the result is the saturating
 *   sum of the two samples.
 *
 * @throws {RangeError} If either sample is not an integer in
 *   `[OPL_SAMPLE_NADIR, OPL_SAMPLE_PEAK]` or `algorithm` is not `0` or
 *   `1`.
 */
export function combineOperators(modulatorSample: number, carrierSample: number, algorithm: number): number {
  if (!Number.isInteger(modulatorSample) || modulatorSample < OPL_SAMPLE_NADIR || modulatorSample > OPL_SAMPLE_PEAK) {
    throw new RangeError(`OPL modulator sample must be an integer in [${OPL_SAMPLE_NADIR}, ${OPL_SAMPLE_PEAK}], got ${modulatorSample}`);
  }
  if (!Number.isInteger(carrierSample) || carrierSample < OPL_SAMPLE_NADIR || carrierSample > OPL_SAMPLE_PEAK) {
    throw new RangeError(`OPL carrier sample must be an integer in [${OPL_SAMPLE_NADIR}, ${OPL_SAMPLE_PEAK}], got ${carrierSample}`);
  }
  if (algorithm !== OPL_ALGORITHM_FM && algorithm !== OPL_ALGORITHM_ADDITIVE) {
    throw new RangeError(`OPL algorithm must be ${OPL_ALGORITHM_FM} (FM) or ${OPL_ALGORITHM_ADDITIVE} (additive), got ${algorithm}`);
  }
  if (algorithm === OPL_ALGORITHM_FM) {
    return carrierSample;
  }
  const summed = modulatorSample + carrierSample;
  if (summed > OPL_SAMPLE_PEAK) return OPL_SAMPLE_PEAK;
  if (summed < OPL_SAMPLE_NADIR) return OPL_SAMPLE_NADIR;
  return summed | 0;
}

function buildSineQuarterTable(): Int16Array {
  const table = new Int16Array(OPL_QUARTER_WAVE_TABLE_SIZE);
  const scale = Math.PI / (OPL_QUARTER_WAVE_TABLE_SIZE * 2);
  for (let i = 0; i < OPL_QUARTER_WAVE_TABLE_SIZE; i++) {
    const value = Math.round(OPL_SAMPLE_PEAK * Math.sin((i + 0.5) * scale));
    table[i] = value > OPL_SAMPLE_PEAK ? OPL_SAMPLE_PEAK : value;
  }
  return table;
}

function buildTotalLevelGainTable(): Float64Array {
  const table = new Float64Array(OPL_TL_MAX + 1);
  table[0] = 1;
  for (let tl = 1; tl <= OPL_TL_MAX; tl++) {
    table[tl] = Math.pow(10, (-OPL_TL_DB_STEP * tl) / 20);
  }
  return table;
}

function quarterMagnitude(lutPhase: number): number {
  const mirror = (lutPhase & 0x100) !== 0;
  const quarterIndex = mirror ? 0xff - (lutPhase & 0xff) : lutPhase & 0xff;
  return OPL_SINE_QUARTER_TABLE[quarterIndex]!;
}

function sineSample(lutPhase: number): number {
  const magnitude = quarterMagnitude(lutPhase);
  return (lutPhase & 0x200) !== 0 ? -magnitude : magnitude;
}
