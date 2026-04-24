import { describe, expect, it } from 'bun:test';

import {
  OPL_ALGORITHM_ADDITIVE,
  OPL_ALGORITHM_FM,
  OPL_BLOCK_MAX,
  OPL_FNUMBER_MAX,
  OPL_MULTIPLIER_CODE_MAX,
  OPL_MULTIPLIER_TABLE_X2,
  OPL_PHASE_ACCUMULATOR_BITS,
  OPL_PHASE_ACCUMULATOR_MASK,
  OPL_PHASE_ACCUMULATOR_MODULO,
  OPL_PHASE_LUT_SHIFT,
  OPL_QUARTER_WAVE_TABLE_SIZE,
  OPL_SAMPLE_NADIR,
  OPL_SAMPLE_PEAK,
  OPL_SAMPLE_RATE_HZ,
  OPL_SINE_QUARTER_TABLE,
  OPL_TL_DB_STEP,
  OPL_TL_MAX,
  OPL_TOTAL_LEVEL_GAIN_TABLE,
  OPL_WAVEFORM_COUNT,
  OPL_WAVEFORM_FULL_RECT,
  OPL_WAVEFORM_HALF_SINE,
  OPL_WAVEFORM_PHASE_MASK,
  OPL_WAVEFORM_QUARTER_RECT,
  OPL_WAVEFORM_SAMPLES_PER_PERIOD,
  OPL_WAVEFORM_SINE,
  advancePhase,
  applyTotalLevel,
  combineOperators,
  computePhaseIncrement,
  computeTotalLevelGain,
  computeWaveformSample,
  multiplierCodeToDoubled,
} from '../../src/audio/oplSynth.ts';

describe('OPL synthesis core constants', () => {
  it('OPL_SAMPLE_RATE_HZ is the 49716 Hz YM3812 chip rate', () => {
    expect(OPL_SAMPLE_RATE_HZ).toBe(49716);
  });

  it('OPL_PHASE_ACCUMULATOR_BITS is 20 with modulo / mask derived from the bit count', () => {
    expect(OPL_PHASE_ACCUMULATOR_BITS).toBe(20);
    expect(OPL_PHASE_ACCUMULATOR_MODULO).toBe(1 << 20);
    expect(OPL_PHASE_ACCUMULATOR_MASK).toBe((1 << 20) - 1);
  });

  it('OPL_WAVEFORM_SAMPLES_PER_PERIOD is 1024 with derived LUT shift / mask', () => {
    expect(OPL_WAVEFORM_SAMPLES_PER_PERIOD).toBe(1024);
    expect(OPL_PHASE_LUT_SHIFT).toBe(OPL_PHASE_ACCUMULATOR_BITS - 10);
    expect(OPL_WAVEFORM_PHASE_MASK).toBe(OPL_WAVEFORM_SAMPLES_PER_PERIOD - 1);
  });

  it('OPL_QUARTER_WAVE_TABLE_SIZE is 256 (one quarter of the 1024-sample period)', () => {
    expect(OPL_QUARTER_WAVE_TABLE_SIZE).toBe(256);
    expect(OPL_QUARTER_WAVE_TABLE_SIZE * 4).toBe(OPL_WAVEFORM_SAMPLES_PER_PERIOD);
  });

  it('OPL_SAMPLE_PEAK and OPL_SAMPLE_NADIR match signed int16 range', () => {
    expect(OPL_SAMPLE_PEAK).toBe(32767);
    expect(OPL_SAMPLE_NADIR).toBe(-32768);
  });

  it('OPL_WAVEFORM_* selectors cover the OPL2 four-waveform set', () => {
    expect(OPL_WAVEFORM_SINE).toBe(0);
    expect(OPL_WAVEFORM_HALF_SINE).toBe(1);
    expect(OPL_WAVEFORM_FULL_RECT).toBe(2);
    expect(OPL_WAVEFORM_QUARTER_RECT).toBe(3);
    expect(OPL_WAVEFORM_COUNT).toBe(4);
  });

  it('OPL_TL_DB_STEP is 0.75 dB per step and OPL_TL_MAX is 63', () => {
    expect(OPL_TL_DB_STEP).toBe(0.75);
    expect(OPL_TL_MAX).toBe(63);
  });

  it('OPL_FNUMBER_MAX is 1023 (10 bits) and OPL_BLOCK_MAX is 7 (3 bits)', () => {
    expect(OPL_FNUMBER_MAX).toBe(1023);
    expect(OPL_BLOCK_MAX).toBe(7);
  });

  it('OPL_MULTIPLIER_CODE_MAX is 15 (4 bits)', () => {
    expect(OPL_MULTIPLIER_CODE_MAX).toBe(15);
  });

  it('OPL_ALGORITHM_FM is 0 and OPL_ALGORITHM_ADDITIVE is 1', () => {
    expect(OPL_ALGORITHM_FM).toBe(0);
    expect(OPL_ALGORITHM_ADDITIVE).toBe(1);
  });
});

describe('OPL_MULTIPLIER_TABLE_X2', () => {
  it('has exactly 16 entries (one per multiplier code)', () => {
    expect(OPL_MULTIPLIER_TABLE_X2).toHaveLength(16);
  });

  it('matches the canonical YM3812 multiplier table (doubled)', () => {
    expect([...OPL_MULTIPLIER_TABLE_X2]).toEqual([1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 20, 24, 24, 30, 30]);
  });

  it('code 0 stores doubled 0.5 (i.e., 1) — the chip has no zero-multiplier entry', () => {
    expect(OPL_MULTIPLIER_TABLE_X2[0]).toBe(1);
  });

  it('codes 10 and 11 are documented duplicates (both map to multiplier 10)', () => {
    expect(OPL_MULTIPLIER_TABLE_X2[10]).toBe(20);
    expect(OPL_MULTIPLIER_TABLE_X2[11]).toBe(20);
  });

  it('codes 12 and 13 are documented duplicates (both map to multiplier 12)', () => {
    expect(OPL_MULTIPLIER_TABLE_X2[12]).toBe(24);
    expect(OPL_MULTIPLIER_TABLE_X2[13]).toBe(24);
  });

  it('codes 14 and 15 are documented duplicates (both map to multiplier 15)', () => {
    expect(OPL_MULTIPLIER_TABLE_X2[14]).toBe(30);
    expect(OPL_MULTIPLIER_TABLE_X2[15]).toBe(30);
  });

  it('is frozen — push throws', () => {
    expect(() => (OPL_MULTIPLIER_TABLE_X2 as unknown as number[]).push(0)).toThrow();
  });

  it('every stored value is even (the table stores the doubled multiplier)', () => {
    for (const doubled of OPL_MULTIPLIER_TABLE_X2) {
      expect(doubled % 2 === 0 || doubled === 1).toBe(true);
    }
  });
});

describe('OPL_SINE_QUARTER_TABLE', () => {
  it('is an Int16Array of length 256', () => {
    expect(OPL_SINE_QUARTER_TABLE).toBeInstanceOf(Int16Array);
    expect(OPL_SINE_QUARTER_TABLE.length).toBe(256);
  });

  it('first entry equals round(32767 * sin(0.5 * π / 512))', () => {
    const expected = Math.round(32767 * Math.sin((0 + 0.5) * (Math.PI / 512)));
    expect(OPL_SINE_QUARTER_TABLE[0]).toBe(expected);
  });

  it('last entry equals round(32767 * sin(255.5 * π / 512)) and is near the peak', () => {
    const expected = Math.round(32767 * Math.sin((255 + 0.5) * (Math.PI / 512)));
    expect(OPL_SINE_QUARTER_TABLE[255]).toBe(expected);
    expect(OPL_SINE_QUARTER_TABLE[255]!).toBeGreaterThan(32760);
  });

  it('is strictly monotonically increasing (rising first quarter of sine)', () => {
    for (let i = 1; i < OPL_SINE_QUARTER_TABLE.length; i++) {
      expect(OPL_SINE_QUARTER_TABLE[i]!).toBeGreaterThan(OPL_SINE_QUARTER_TABLE[i - 1]!);
    }
  });

  it('middle entry (i=127) is approximately 32767 * sin(π/4) ≈ 23170', () => {
    const expected = Math.round(32767 * Math.sin((127 + 0.5) * (Math.PI / 512)));
    expect(OPL_SINE_QUARTER_TABLE[127]).toBe(expected);
    expect(OPL_SINE_QUARTER_TABLE[127]!).toBeGreaterThan(23000);
    expect(OPL_SINE_QUARTER_TABLE[127]!).toBeLessThan(23300);
  });

  it('every entry fits signed int16 range', () => {
    for (const entry of OPL_SINE_QUARTER_TABLE) {
      expect(entry).toBeGreaterThanOrEqual(0);
      expect(entry).toBeLessThanOrEqual(OPL_SAMPLE_PEAK);
    }
  });
});

describe('OPL_TOTAL_LEVEL_GAIN_TABLE', () => {
  it('is a Float64Array of length OPL_TL_MAX + 1', () => {
    expect(OPL_TOTAL_LEVEL_GAIN_TABLE).toBeInstanceOf(Float64Array);
    expect(OPL_TOTAL_LEVEL_GAIN_TABLE.length).toBe(OPL_TL_MAX + 1);
  });

  it('index 0 is exactly 1 (no attenuation)', () => {
    expect(OPL_TOTAL_LEVEL_GAIN_TABLE[0]).toBe(1);
  });

  it('every entry equals 10^(-OPL_TL_DB_STEP * tl / 20)', () => {
    for (let tl = 1; tl <= OPL_TL_MAX; tl++) {
      expect(OPL_TOTAL_LEVEL_GAIN_TABLE[tl]).toBe(Math.pow(10, (-OPL_TL_DB_STEP * tl) / 20));
    }
  });

  it('is strictly monotonically decreasing across all TL values', () => {
    for (let tl = 1; tl <= OPL_TL_MAX; tl++) {
      expect(OPL_TOTAL_LEVEL_GAIN_TABLE[tl]!).toBeLessThan(OPL_TOTAL_LEVEL_GAIN_TABLE[tl - 1]!);
    }
  });

  it('agrees with computeTotalLevelGain at every index', () => {
    for (let tl = 0; tl <= OPL_TL_MAX; tl++) {
      expect(OPL_TOTAL_LEVEL_GAIN_TABLE[tl]).toBe(computeTotalLevelGain(tl));
    }
  });
});

describe('multiplierCodeToDoubled', () => {
  it('returns the doubled multiplier for every valid code', () => {
    for (let code = 0; code <= OPL_MULTIPLIER_CODE_MAX; code++) {
      expect(multiplierCodeToDoubled(code)).toBe(OPL_MULTIPLIER_TABLE_X2[code]!);
    }
  });

  it('throws RangeError on code = -1 (below range)', () => {
    expect(() => multiplierCodeToDoubled(-1)).toThrow(RangeError);
  });

  it('throws RangeError on code = 16 (above range)', () => {
    expect(() => multiplierCodeToDoubled(16)).toThrow(RangeError);
  });

  it('throws RangeError on non-integer code', () => {
    expect(() => multiplierCodeToDoubled(1.5)).toThrow(RangeError);
    expect(() => multiplierCodeToDoubled(Number.NaN)).toThrow(RangeError);
  });
});

describe('computePhaseIncrement', () => {
  it('returns 0 when fNumber = 0 regardless of block / multiplier code', () => {
    expect(computePhaseIncrement(0, 0, 0)).toBe(0);
    expect(computePhaseIncrement(0, 7, 15)).toBe(0);
  });

  it('computes (fNumber << block) * multiplier_x2 / 2', () => {
    expect(computePhaseIncrement(1, 0, 1)).toBe(1);
    expect(computePhaseIncrement(512, 4, 1)).toBe(8192);
    expect(computePhaseIncrement(1023, 7, 15)).toBe(((1023 << 7) * 30) / 2);
  });

  it('multiplier code 0 (0.5) halves the phase increment relative to code 1 (1.0)', () => {
    const half = computePhaseIncrement(512, 4, 0);
    const unit = computePhaseIncrement(512, 4, 1);
    expect(half * 2).toBe(unit);
  });

  it('produces a frequency consistent with phase_inc * sample_rate / 2^20 (within 1 Hz)', () => {
    // A voice at fNumber=580, block=4, mult=1 should land near the 440 Hz concert-A region.
    const phaseInc = computePhaseIncrement(580, 4, 1);
    const frequency = (phaseInc * OPL_SAMPLE_RATE_HZ) / OPL_PHASE_ACCUMULATOR_MODULO;
    expect(frequency).toBeGreaterThan(435);
    expect(frequency).toBeLessThan(445);
  });

  it('throws RangeError on invalid fNumber (-1, 1024, non-integer)', () => {
    expect(() => computePhaseIncrement(-1, 0, 0)).toThrow(RangeError);
    expect(() => computePhaseIncrement(1024, 0, 0)).toThrow(RangeError);
    expect(() => computePhaseIncrement(1.5, 0, 0)).toThrow(RangeError);
  });

  it('throws RangeError on invalid block (-1, 8, non-integer)', () => {
    expect(() => computePhaseIncrement(0, -1, 0)).toThrow(RangeError);
    expect(() => computePhaseIncrement(0, 8, 0)).toThrow(RangeError);
    expect(() => computePhaseIncrement(0, 0.5, 0)).toThrow(RangeError);
  });

  it('throws RangeError on invalid multiplier code (delegates to multiplierCodeToDoubled)', () => {
    expect(() => computePhaseIncrement(0, 0, -1)).toThrow(RangeError);
    expect(() => computePhaseIncrement(0, 0, 16)).toThrow(RangeError);
  });
});

describe('advancePhase', () => {
  it('adds delta to phase when the result stays within the accumulator', () => {
    expect(advancePhase(0, 0)).toBe(0);
    expect(advancePhase(100, 50)).toBe(150);
    expect(advancePhase(OPL_PHASE_ACCUMULATOR_MASK - 1, 1)).toBe(OPL_PHASE_ACCUMULATOR_MASK);
  });

  it('wraps once on a +1 overflow past the modulo', () => {
    expect(advancePhase(OPL_PHASE_ACCUMULATOR_MASK, 1)).toBe(0);
  });

  it('wraps exactly on an advance equal to one full modulo', () => {
    expect(advancePhase(0, OPL_PHASE_ACCUMULATOR_MODULO)).toBe(0);
    expect(advancePhase(123, OPL_PHASE_ACCUMULATOR_MODULO)).toBe(123);
  });

  it('handles multi-cycle positive deltas by reducing modulo the accumulator', () => {
    expect(advancePhase(0, OPL_PHASE_ACCUMULATOR_MODULO * 3 + 7)).toBe(7);
  });

  it('handles negative deltas by wrapping with unsigned semantics', () => {
    expect(advancePhase(0, -1)).toBe(OPL_PHASE_ACCUMULATOR_MASK);
    expect(advancePhase(10, -100)).toBe(OPL_PHASE_ACCUMULATOR_MODULO + 10 - 100);
  });

  it('wraps correctly at int32-edge deltas (relies on ToInt32 in JS `&`)', () => {
    // delta = INT32_MAX: sum is 0x7FFFFFFF = 2^31 - 1.  2^31 - 1 mod 2^20 = 2^20 - 1.
    expect(advancePhase(0, 0x7fff_ffff)).toBe(OPL_PHASE_ACCUMULATOR_MASK);
    // delta = -INT32_MAX: (-0x7FFFFFFF) mod 2^20 = 1 (since 2^31 mod 2^20 = 0).
    expect(advancePhase(0, -0x7fff_ffff)).toBe(1);
    // One full modulo past the mask: (MASK + MODULO) & MASK = MASK.
    expect(advancePhase(OPL_PHASE_ACCUMULATOR_MASK, OPL_PHASE_ACCUMULATOR_MODULO)).toBe(OPL_PHASE_ACCUMULATOR_MASK);
  });

  it('throws RangeError on invalid phase', () => {
    expect(() => advancePhase(-1, 0)).toThrow(RangeError);
    expect(() => advancePhase(OPL_PHASE_ACCUMULATOR_MODULO, 0)).toThrow(RangeError);
    expect(() => advancePhase(1.5, 0)).toThrow(RangeError);
  });

  it('throws RangeError on non-integer delta', () => {
    expect(() => advancePhase(0, 1.5)).toThrow(RangeError);
    expect(() => advancePhase(0, Number.NaN)).toThrow(RangeError);
  });
});

describe('computeWaveformSample — full sine (waveform 0)', () => {
  it('matches the quarter-wave table at the first bin', () => {
    expect(computeWaveformSample(0, OPL_WAVEFORM_SINE)).toBe(OPL_SINE_QUARTER_TABLE[0]!);
  });

  it('peaks near +OPL_SAMPLE_PEAK at the 90° phase boundary (lutPhase=255)', () => {
    const phase = 255 << OPL_PHASE_LUT_SHIFT;
    expect(computeWaveformSample(phase, OPL_WAVEFORM_SINE)).toBe(OPL_SINE_QUARTER_TABLE[255]!);
    expect(computeWaveformSample(phase, OPL_WAVEFORM_SINE)).toBeGreaterThan(32760);
  });

  it('mirrors downward across the second quarter (lutPhase=256..511)', () => {
    const phaseMirror = (256 + 10) << OPL_PHASE_LUT_SHIFT;
    const mirroredExpected = OPL_SINE_QUARTER_TABLE[0xff - 10]!;
    expect(computeWaveformSample(phaseMirror, OPL_WAVEFORM_SINE)).toBe(mirroredExpected);
  });

  it('crosses zero at the half-cycle boundary (lutPhase=512) and is negative in the second half', () => {
    const peak = computeWaveformSample(255 << OPL_PHASE_LUT_SHIFT, OPL_WAVEFORM_SINE);
    const trough = computeWaveformSample((512 + 255) << OPL_PHASE_LUT_SHIFT, OPL_WAVEFORM_SINE);
    expect(trough).toBe(-peak);
  });

  it('is negative throughout the second half-cycle (lutPhase=512..1023)', () => {
    for (let lutPhase = 512; lutPhase < 1024; lutPhase += 32) {
      const phase = lutPhase << OPL_PHASE_LUT_SHIFT;
      expect(computeWaveformSample(phase, OPL_WAVEFORM_SINE)).toBeLessThan(0);
    }
  });

  it('ignores the sub-sample phase bits below OPL_PHASE_LUT_SHIFT', () => {
    const lutBase = 100 << OPL_PHASE_LUT_SHIFT;
    expect(computeWaveformSample(lutBase, OPL_WAVEFORM_SINE)).toBe(computeWaveformSample(lutBase + (1 << OPL_PHASE_LUT_SHIFT) - 1, OPL_WAVEFORM_SINE));
  });
});

describe('computeWaveformSample — half sine (waveform 1)', () => {
  it('matches full sine in the first half-cycle', () => {
    for (let lutPhase = 0; lutPhase < 512; lutPhase += 37) {
      const phase = lutPhase << OPL_PHASE_LUT_SHIFT;
      expect(computeWaveformSample(phase, OPL_WAVEFORM_HALF_SINE)).toBe(computeWaveformSample(phase, OPL_WAVEFORM_SINE));
    }
  });

  it('is silent (zero) throughout the second half-cycle', () => {
    for (let lutPhase = 512; lutPhase < 1024; lutPhase += 19) {
      const phase = lutPhase << OPL_PHASE_LUT_SHIFT;
      expect(computeWaveformSample(phase, OPL_WAVEFORM_HALF_SINE)).toBe(0);
    }
  });
});

describe('computeWaveformSample — full rect (waveform 2)', () => {
  it('equals |full sine| at every phase', () => {
    for (let lutPhase = 0; lutPhase < 1024; lutPhase += 17) {
      const phase = lutPhase << OPL_PHASE_LUT_SHIFT;
      expect(computeWaveformSample(phase, OPL_WAVEFORM_FULL_RECT)).toBe(Math.abs(computeWaveformSample(phase, OPL_WAVEFORM_SINE)));
    }
  });

  it('is never negative', () => {
    for (let lutPhase = 0; lutPhase < 1024; lutPhase += 13) {
      const phase = lutPhase << OPL_PHASE_LUT_SHIFT;
      expect(computeWaveformSample(phase, OPL_WAVEFORM_FULL_RECT)).toBeGreaterThanOrEqual(0);
    }
  });

  it('produces two positive humps per full cycle (peaks at lutPhase=255 and lutPhase=767)', () => {
    const firstPeak = computeWaveformSample(255 << OPL_PHASE_LUT_SHIFT, OPL_WAVEFORM_FULL_RECT);
    const secondPeak = computeWaveformSample(767 << OPL_PHASE_LUT_SHIFT, OPL_WAVEFORM_FULL_RECT);
    expect(firstPeak).toBe(secondPeak);
    expect(firstPeak).toBeGreaterThan(32760);
  });
});

describe('computeWaveformSample — quarter rect (waveform 3)', () => {
  it('is the rising quarter sine for phase in the first quarter (lutPhase=0..255)', () => {
    for (let lutPhase = 0; lutPhase < 256; lutPhase += 13) {
      const phase = lutPhase << OPL_PHASE_LUT_SHIFT;
      expect(computeWaveformSample(phase, OPL_WAVEFORM_QUARTER_RECT)).toBe(OPL_SINE_QUARTER_TABLE[lutPhase]!);
    }
  });

  it('is silent in the second quarter (lutPhase=256..511)', () => {
    for (let lutPhase = 256; lutPhase < 512; lutPhase += 13) {
      const phase = lutPhase << OPL_PHASE_LUT_SHIFT;
      expect(computeWaveformSample(phase, OPL_WAVEFORM_QUARTER_RECT)).toBe(0);
    }
  });

  it('repeats the rising quarter in the third quarter (lutPhase=512..767)', () => {
    for (let i = 0; i < 256; i += 13) {
      const phase = (512 + i) << OPL_PHASE_LUT_SHIFT;
      expect(computeWaveformSample(phase, OPL_WAVEFORM_QUARTER_RECT)).toBe(OPL_SINE_QUARTER_TABLE[i]!);
    }
  });

  it('is silent in the fourth quarter (lutPhase=768..1023)', () => {
    for (let lutPhase = 768; lutPhase < 1024; lutPhase += 13) {
      const phase = lutPhase << OPL_PHASE_LUT_SHIFT;
      expect(computeWaveformSample(phase, OPL_WAVEFORM_QUARTER_RECT)).toBe(0);
    }
  });

  it('is never negative', () => {
    for (let lutPhase = 0; lutPhase < 1024; lutPhase += 7) {
      const phase = lutPhase << OPL_PHASE_LUT_SHIFT;
      expect(computeWaveformSample(phase, OPL_WAVEFORM_QUARTER_RECT)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('computeWaveformSample — validation', () => {
  it('throws RangeError on invalid phase', () => {
    expect(() => computeWaveformSample(-1, OPL_WAVEFORM_SINE)).toThrow(RangeError);
    expect(() => computeWaveformSample(OPL_PHASE_ACCUMULATOR_MODULO, OPL_WAVEFORM_SINE)).toThrow(RangeError);
    expect(() => computeWaveformSample(1.5, OPL_WAVEFORM_SINE)).toThrow(RangeError);
  });

  it('throws RangeError on waveform outside [0, OPL_WAVEFORM_COUNT - 1]', () => {
    expect(() => computeWaveformSample(0, -1)).toThrow(RangeError);
    expect(() => computeWaveformSample(0, OPL_WAVEFORM_COUNT)).toThrow(RangeError);
    expect(() => computeWaveformSample(0, 7)).toThrow(RangeError);
    expect(() => computeWaveformSample(0, 1.5)).toThrow(RangeError);
  });
});

describe('computeTotalLevelGain', () => {
  it('returns exactly 1 at TL = 0', () => {
    expect(computeTotalLevelGain(0)).toBe(1);
  });

  it('returns 10^(-OPL_TL_DB_STEP / 20) ≈ 0.9173 at TL = 1', () => {
    expect(computeTotalLevelGain(1)).toBeCloseTo(0.9172759354, 8);
  });

  it('returns 10^(-0.3) ≈ 0.5012 at TL = 8 (6 dB attenuation)', () => {
    expect(computeTotalLevelGain(8)).toBeCloseTo(Math.pow(10, -0.3), 8);
    expect(computeTotalLevelGain(8)).toBeGreaterThan(0.5);
    expect(computeTotalLevelGain(8)).toBeLessThan(0.505);
  });

  it('returns ~0.00434 at TL = 63 (max attenuation, 47.25 dB)', () => {
    expect(computeTotalLevelGain(63)).toBeCloseTo(Math.pow(10, -2.3625), 8);
  });

  it('is strictly monotonically decreasing across TL=0..63', () => {
    let previous = computeTotalLevelGain(0);
    for (let tl = 1; tl <= OPL_TL_MAX; tl++) {
      const current = computeTotalLevelGain(tl);
      expect(current).toBeLessThan(previous);
      previous = current;
    }
  });

  it('throws RangeError on invalid TL (-1, 64, non-integer)', () => {
    expect(() => computeTotalLevelGain(-1)).toThrow(RangeError);
    expect(() => computeTotalLevelGain(64)).toThrow(RangeError);
    expect(() => computeTotalLevelGain(1.5)).toThrow(RangeError);
  });
});

describe('applyTotalLevel', () => {
  it('is a no-op at TL = 0', () => {
    expect(applyTotalLevel(1000, 0)).toBe(1000);
    expect(applyTotalLevel(-32768, 0)).toBe(-32768);
    expect(applyTotalLevel(32767, 0)).toBe(32767);
  });

  it('returns 0 for a zero sample regardless of TL', () => {
    for (let tl = 0; tl <= OPL_TL_MAX; tl++) {
      expect(applyTotalLevel(0, tl)).toBe(0);
    }
  });

  it('halves the sample (approximately) at TL = 8 (6 dB)', () => {
    const result = applyTotalLevel(32767, 8);
    expect(result).toBeGreaterThan(16350);
    expect(result).toBeLessThan(16450);
  });

  it('preserves sign under attenuation', () => {
    expect(applyTotalLevel(20000, 4)).toBeGreaterThan(0);
    expect(applyTotalLevel(-20000, 4)).toBeLessThan(0);
  });

  it('heavily attenuates at TL = 63', () => {
    const magnitude = Math.abs(applyTotalLevel(32767, 63));
    expect(magnitude).toBeLessThan(200);
  });

  it('throws RangeError on invalid sample', () => {
    expect(() => applyTotalLevel(32768, 0)).toThrow(RangeError);
    expect(() => applyTotalLevel(-32769, 0)).toThrow(RangeError);
    expect(() => applyTotalLevel(1.5, 0)).toThrow(RangeError);
  });

  it('throws RangeError on invalid TL (delegated to computeTotalLevelGain)', () => {
    expect(() => applyTotalLevel(1000, -1)).toThrow(RangeError);
    expect(() => applyTotalLevel(1000, 64)).toThrow(RangeError);
  });
});

describe('combineOperators', () => {
  it('returns the carrier sample on algorithm 0 (FM), ignoring the modulator', () => {
    expect(combineOperators(0, 12345, OPL_ALGORITHM_FM)).toBe(12345);
    expect(combineOperators(32767, -100, OPL_ALGORITHM_FM)).toBe(-100);
    expect(combineOperators(-32768, 0, OPL_ALGORITHM_FM)).toBe(0);
  });

  it('sums modulator and carrier on algorithm 1 (additive)', () => {
    expect(combineOperators(1000, 2000, OPL_ALGORITHM_ADDITIVE)).toBe(3000);
    expect(combineOperators(-500, 1500, OPL_ALGORITHM_ADDITIVE)).toBe(1000);
  });

  it('saturates at OPL_SAMPLE_PEAK on additive overflow', () => {
    expect(combineOperators(20000, 20000, OPL_ALGORITHM_ADDITIVE)).toBe(OPL_SAMPLE_PEAK);
    expect(combineOperators(32767, 32767, OPL_ALGORITHM_ADDITIVE)).toBe(OPL_SAMPLE_PEAK);
  });

  it('saturates at OPL_SAMPLE_NADIR on additive underflow', () => {
    expect(combineOperators(-20000, -20000, OPL_ALGORITHM_ADDITIVE)).toBe(OPL_SAMPLE_NADIR);
    expect(combineOperators(-32768, -32768, OPL_ALGORITHM_ADDITIVE)).toBe(OPL_SAMPLE_NADIR);
  });

  it('throws RangeError on an out-of-range modulator sample', () => {
    expect(() => combineOperators(32768, 0, OPL_ALGORITHM_ADDITIVE)).toThrow(RangeError);
    expect(() => combineOperators(-32769, 0, OPL_ALGORITHM_ADDITIVE)).toThrow(RangeError);
  });

  it('throws RangeError on an out-of-range carrier sample', () => {
    expect(() => combineOperators(0, 32768, OPL_ALGORITHM_FM)).toThrow(RangeError);
    expect(() => combineOperators(0, -32769, OPL_ALGORITHM_FM)).toThrow(RangeError);
  });

  it('throws RangeError on an invalid algorithm code', () => {
    expect(() => combineOperators(0, 0, -1)).toThrow(RangeError);
    expect(() => combineOperators(0, 0, 2)).toThrow(RangeError);
    expect(() => combineOperators(0, 0, 1.5)).toThrow(RangeError);
  });
});

describe('parity-sensitive edge cases', () => {
  it('multiplier duplicates produce identical phase increment (codes 10 and 11)', () => {
    expect(computePhaseIncrement(256, 3, 10)).toBe(computePhaseIncrement(256, 3, 11));
  });

  it('multiplier duplicates produce identical phase increment (codes 14 and 15)', () => {
    expect(computePhaseIncrement(256, 3, 14)).toBe(computePhaseIncrement(256, 3, 15));
  });

  it('integrating phase over one second at phase_inc = OPL_PHASE_ACCUMULATOR_MODULO / OPL_SAMPLE_RATE_HZ produces ≈ 1 Hz output', () => {
    const inc = Math.round(OPL_PHASE_ACCUMULATOR_MODULO / OPL_SAMPLE_RATE_HZ);
    let phase = 0;
    let zeroCrossings = 0;
    let previous = computeWaveformSample(phase, OPL_WAVEFORM_SINE);
    for (let sample = 1; sample <= OPL_SAMPLE_RATE_HZ; sample++) {
      phase = advancePhase(phase, inc);
      const current = computeWaveformSample(phase, OPL_WAVEFORM_SINE);
      if ((previous >= 0 && current < 0) || (previous < 0 && current >= 0)) {
        zeroCrossings++;
      }
      previous = current;
    }
    expect(zeroCrossings).toBeGreaterThanOrEqual(1);
    expect(zeroCrossings).toBeLessThanOrEqual(3);
  });

  it('waveform 3 at lutPhase=256 is 0 (start of second-quarter silence), not the peak', () => {
    const phase = 256 << OPL_PHASE_LUT_SHIFT;
    expect(computeWaveformSample(phase, OPL_WAVEFORM_QUARTER_RECT)).toBe(0);
    expect(computeWaveformSample(phase, OPL_WAVEFORM_FULL_RECT)).toBeGreaterThan(32760);
  });

  it('algorithm 0 (FM) does not double-count the modulator when composing a channel output', () => {
    const modulator = 10000;
    const carrier = 5000;
    expect(combineOperators(modulator, carrier, OPL_ALGORITHM_FM)).toBe(carrier);
    expect(combineOperators(modulator, carrier, OPL_ALGORITHM_ADDITIVE)).toBe(modulator + carrier);
  });

  it('applyTotalLevel preserves int16 invariant for every valid (sample, tl) pair', () => {
    const samples = [OPL_SAMPLE_NADIR, -10000, -1, 0, 1, 10000, OPL_SAMPLE_PEAK];
    for (const sample of samples) {
      for (let tl = 0; tl <= OPL_TL_MAX; tl += 7) {
        const result = applyTotalLevel(sample, tl);
        expect(result).toBeGreaterThanOrEqual(OPL_SAMPLE_NADIR);
        expect(result).toBeLessThanOrEqual(OPL_SAMPLE_PEAK);
        expect(Number.isInteger(result)).toBe(true);
      }
    }
  });

  it('phase accumulator cycle length matches OPL_PHASE_ACCUMULATOR_MODULO when stepped by 1', () => {
    let phase = 0;
    let wrapped = false;
    for (let step = 0; step < OPL_PHASE_ACCUMULATOR_MODULO; step++) {
      phase = advancePhase(phase, 1);
    }
    wrapped = phase === 0;
    expect(wrapped).toBe(true);
  });
});
