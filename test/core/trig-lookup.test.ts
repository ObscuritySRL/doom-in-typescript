import { describe, expect, test } from 'bun:test';

import { ANGLETOFINESHIFT, DBITS, FINEANGLES, FINEMASK, SLOPERANGE, SLOPEBITS, finecosine, finesine, finetangent, slopeDiv, tantoangle } from '../../src/core/trig.ts';
import { ANG45, ANG90, ANG180, ANG270 } from '../../src/core/angle.ts';
import { FRACBITS, FRACUNIT } from '../../src/core/fixed.ts';

describe('constants', () => {
  test('FINEANGLES is 8192', () => {
    expect(FINEANGLES).toBe(8192);
  });

  test('FINEMASK is FINEANGLES - 1', () => {
    expect(FINEMASK).toBe(FINEANGLES - 1);
  });

  test('ANGLETOFINESHIFT is 19', () => {
    expect(ANGLETOFINESHIFT).toBe(19);
  });

  test('SLOPERANGE is 2048', () => {
    expect(SLOPERANGE).toBe(2048);
  });

  test('SLOPEBITS is 11', () => {
    expect(SLOPEBITS).toBe(11);
  });

  test('DBITS is FRACBITS minus SLOPEBITS', () => {
    expect(DBITS).toBe(FRACBITS - SLOPEBITS);
    expect(DBITS).toBe(5);
  });

  test('BAM angle cardinal points shift to expected fine indices', () => {
    expect((ANG90 >>> ANGLETOFINESHIFT) & FINEMASK).toBe(2048);
    expect((ANG180 >>> ANGLETOFINESHIFT) & FINEMASK).toBe(4096);
    expect((ANG270 >>> ANGLETOFINESHIFT) & FINEMASK).toBe(6144);
    expect((0 >>> ANGLETOFINESHIFT) & FINEMASK).toBe(0);
  });
});

describe('finesine', () => {
  test('has 10240 entries (5 * FINEANGLES / 4)', () => {
    expect(finesine.length).toBe((5 * FINEANGLES) / 4);
    expect(finesine.length).toBe(10240);
  });

  test('is Int32Array', () => {
    expect(finesine).toBeInstanceOf(Int32Array);
  });

  test('sin(0) is near zero', () => {
    expect(finesine[0]).toBe(25);
  });

  test('sin(90°) is FRACUNIT - 1', () => {
    expect(finesine[FINEANGLES / 4]).toBe(65535);
  });

  test('sin(180°) is near zero (negative due to +0.5 bin offset)', () => {
    expect(finesine[FINEANGLES / 2]).toBe(-25);
  });

  test('sin(270°) is -(FRACUNIT - 1)', () => {
    expect(finesine[(3 * FINEANGLES) / 4]).toBe(-65535);
  });

  test('first entry matches canonical tables.c value', () => {
    expect(finesine[0]).toBe(25);
    expect(finesine[1]).toBe(75);
    expect(finesine[2]).toBe(125);
    expect(finesine[3]).toBe(175);
  });

  test('last entry matches canonical tables.c value', () => {
    expect(finesine[10239]).toBe(65535);
  });

  test('peak value does not exceed FRACUNIT', () => {
    let maximum = -Infinity;
    let minimum = Infinity;
    for (let i = 0; i < finesine.length; i++) {
      if (finesine[i] > maximum) maximum = finesine[i];
      if (finesine[i] < minimum) minimum = finesine[i];
    }
    expect(maximum).toBeLessThanOrEqual(FRACUNIT);
    expect(minimum).toBeGreaterThanOrEqual(-FRACUNIT);
  });
});

describe('finecosine', () => {
  test('is a subarray view into finesine offset by FINEANGLES/4', () => {
    expect(finecosine).toBeInstanceOf(Int32Array);
    expect(finecosine.length).toBe(finesine.length - FINEANGLES / 4);
    for (let i = 0; i < 16; i++) {
      expect(finecosine[i]).toBe(finesine[i + FINEANGLES / 4]);
    }
  });

  test('cos(0) is FRACUNIT - 1', () => {
    expect(finecosine[0]).toBe(65535);
  });

  test('cos(90°) is near zero (negative due to +0.5 bin offset)', () => {
    expect(finecosine[FINEANGLES / 4]).toBe(-25);
  });
});

describe('finetangent', () => {
  test('has 4096 entries (FINEANGLES / 2)', () => {
    expect(finetangent.length).toBe(FINEANGLES / 2);
    expect(finetangent.length).toBe(4096);
  });

  test('is Int32Array', () => {
    expect(finetangent).toBeInstanceOf(Int32Array);
  });

  test('first entry matches canonical tables.c value', () => {
    expect(finetangent[0]).toBe(-170910304);
  });

  test('last entry matches canonical tables.c value', () => {
    expect(finetangent[4095]).toBe(170910304);
  });

  test('center entries are near zero', () => {
    expect(finetangent[2047]).toBe(-25);
    expect(finetangent[2048]).toBe(25);
  });

  test('is perfectly antisymmetric', () => {
    for (let i = 0; i < 2048; i++) {
      expect(finetangent[i]).toBe(-finetangent[4095 - i]);
    }
  });

  test('first half is non-positive, second half is non-negative', () => {
    for (let i = 0; i < 2048; i++) {
      expect(finetangent[i]).toBeLessThanOrEqual(0);
    }
    for (let i = 2048; i < 4096; i++) {
      expect(finetangent[i]).toBeGreaterThanOrEqual(0);
    }
  });

  test('magnitude increases toward poles (monotonic abs in each half)', () => {
    for (let i = 1; i < 2048; i++) {
      expect(Math.abs(finetangent[i - 1])).toBeGreaterThanOrEqual(Math.abs(finetangent[i]));
    }
    for (let i = 2049; i < 4096; i++) {
      expect(Math.abs(finetangent[i])).toBeGreaterThanOrEqual(Math.abs(finetangent[i - 1]));
    }
  });
});

describe('tantoangle', () => {
  test('has 2049 entries (SLOPERANGE + 1)', () => {
    expect(tantoangle.length).toBe(SLOPERANGE + 1);
    expect(tantoangle.length).toBe(2049);
  });

  test('is Uint32Array', () => {
    expect(tantoangle).toBeInstanceOf(Uint32Array);
  });

  test('tantoangle[0] is 0 (atan of zero slope)', () => {
    expect(tantoangle[0]).toBe(0);
  });

  test('tantoangle[SLOPERANGE] is ANG45 (atan of slope 1)', () => {
    expect(tantoangle[SLOPERANGE]).toBe(ANG45);
    expect(tantoangle[2048]).toBe(0x2000_0000);
  });

  test('first few entries match canonical tables.c values', () => {
    expect(tantoangle[1]).toBe(333772);
    expect(tantoangle[2]).toBe(667544);
    expect(tantoangle[3]).toBe(1001315);
  });

  test('is monotonically non-decreasing', () => {
    for (let i = 1; i <= SLOPERANGE; i++) {
      expect(tantoangle[i]).toBeGreaterThanOrEqual(tantoangle[i - 1]);
    }
  });

  test('all values are less than or equal to ANG45', () => {
    for (let i = 0; i <= SLOPERANGE; i++) {
      expect(tantoangle[i]).toBeLessThanOrEqual(ANG45);
    }
  });
});

describe('slopeDiv', () => {
  test('returns SLOPERANGE when denominator is less than 512', () => {
    expect(slopeDiv(1000, 0)).toBe(SLOPERANGE);
    expect(slopeDiv(1000, 511)).toBe(SLOPERANGE);
    expect(slopeDiv(0, 0)).toBe(SLOPERANGE);
  });

  test('returns SLOPERANGE when result would overflow', () => {
    expect(slopeDiv(1000, 1000)).toBe(SLOPERANGE);
  });

  test('computes (num << 3) / (den >> 8) for normal inputs', () => {
    expect(slopeDiv(100, 512)).toBe(400);
  });

  test('handles unsigned overflow of num << 3', () => {
    expect(slopeDiv(0x2000_0000, 1024)).toBe(0);
  });

  test('denominator exactly 512 is not clamped', () => {
    expect(slopeDiv(100, 512)).not.toBe(SLOPERANGE);
  });

  test('result at SLOPERANGE boundary is valid', () => {
    expect(slopeDiv(2048, 2048)).toBe(SLOPERANGE);
  });

  test('parity-critical: reproduces C unsigned integer division truncation', () => {
    // C: (7 << 3) / (1024 >> 8) = 56 / 4 = 14 (exact quotient)
    expect(slopeDiv(7, 1024)).toBe(14);
    // C: (255 << 3) / (768 >> 8) = 2040 / 3 = 680 (exact quotient)
    expect(slopeDiv(255, 768)).toBe(680);
    // C: (100 << 3) / (1000 >> 8) = 800 / 3 = 266 (truncates toward zero; 266.666…)
    expect(slopeDiv(100, 1000)).toBe(266);
    // C: (37 << 3) / (600 >> 8) = 296 / 2 = 148 (exact quotient, near SLOPERANGE)
    expect(slopeDiv(37, 600)).toBe(148);
    // C: (1 << 3) / (1023 >> 8) = 8 / 3 = 2 (truncates; 2.666…)
    expect(slopeDiv(1, 1023)).toBe(2);
  });

  test('does not return a non-integer SLOPERANGE result', () => {
    // Exercise fractional float results near the clamp boundary and
    // confirm the return is always an int32.
    for (let denominator = 512; denominator < 4096; denominator += 37) {
      for (let numerator = 0; numerator < 4096; numerator += 53) {
        const result = slopeDiv(numerator, denominator);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(SLOPERANGE);
      }
    }
  });

  test('treats both arguments as unsigned to match C SlopeDiv signature', () => {
    // C: `unsigned den = (unsigned)-1` is 0xFFFFFFFF, NOT < 512, so the
    // guard does not trigger and the quotient `(num << 3) / (den >> 8)`
    // truncates to 0. A naive signed comparison would short-circuit to
    // SLOPERANGE here.
    expect(slopeDiv(100, -1)).toBe(0);
    // Numerator at the int32 sign-bit boundary stays unsigned through
    // the left-shift: (0x10000000 << 3) wraps to 0x80000000, the unsigned
    // quotient is 0x20000000 = 536870912, which clamps to SLOPERANGE.
    expect(slopeDiv(0x1000_0000, 1024)).toBe(SLOPERANGE);
  });
});
