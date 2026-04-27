import { describe, expect, test } from 'bun:test';

import { ANG45 } from '../../../src/core/angle.ts';
import { FRACUNIT } from '../../../src/core/fixed.ts';
import { FINEANGLES, SLOPERANGE, finetangent, slopeDiv, tantoangle } from '../../../src/core/trig.ts';
import {
  AUDITED_FINETANGENT_AT_FRACUNIT_CROSSING,
  AUDITED_FINETANGENT_AT_FRACUNIT_CROSSING_MINUS_ONE,
  AUDITED_FINETANGENT_FRACUNIT_CROSSING_INDEX,
  AUDITED_FINETANGENT_MIN_ABSOLUTE_VALUE,
  AUDITED_FINETANGENT_NEGATIVE_HALF_END_INDEX,
  AUDITED_FINETANGENT_PIVOT_NEGATIVE_VALUE,
  AUDITED_FINETANGENT_PIVOT_POSITIVE_VALUE,
  AUDITED_FINETANGENT_POSITIVE_HALF_START_INDEX,
  AUDITED_FINETANGENT_SHA256,
  AUDITED_SLOPE_DEN_RIGHT_SHIFT,
  AUDITED_SLOPE_GUARD_THRESHOLD,
  AUDITED_SLOPE_NUM_LEFT_SHIFT,
  AUDITED_TANTOANGLE_FINAL_INCREMENT,
  AUDITED_TANTOANGLE_FIRST_INCREMENT,
  AUDITED_TANTOANGLE_INCREMENT_SUM,
  AUDITED_TANTOANGLE_MIDDLE_INCREMENT,
  AUDITED_TANTOANGLE_SHA256,
  FINE_TANGENT_AND_SLOPE_AUDIT,
  FINE_TANGENT_AND_SLOPE_INVARIANTS,
  FINE_TANGENT_AND_SLOPE_PROBES,
  crossCheckFineTangentAndSlope,
  sha256OfTypedArray,
} from '../../../src/core/audit-fine-tangent-and-slope-tables.ts';
import type { FineTangentAndSlopeCandidate, FineTangentAndSlopeFactId, FineTangentAndSlopeInvariantId, FineTangentAndSlopeProbeId } from '../../../src/core/audit-fine-tangent-and-slope-tables.ts';

const ALL_FACT_IDS: Set<FineTangentAndSlopeFactId> = new Set([
  'C_HEADER_DECLARE_FINETANGENT_HALF_CIRCLE_LENGTH',
  'C_HEADER_DECLARE_TANTOANGLE_SLOPERANGE_PLUS_ONE_LENGTH',
  'C_HEADER_DECLARE_SLOPEDIV_SIGNATURE',
  'C_BODY_FINETANGENT_LITERAL_FIRST_ENTRY',
  'C_BODY_FINETANGENT_LITERAL_LAST_ENTRY',
  'C_BODY_TANTOANGLE_LITERAL_FIRST_ENTRY',
  'C_BODY_TANTOANGLE_LITERAL_LAST_ENTRY',
  'C_BODY_SLOPEDIV_GUARD_THRESHOLD',
  'C_BODY_SLOPEDIV_FORMULA',
  'C_BODY_SLOPEDIV_CLAMP',
]);

const ALL_INVARIANT_IDS: Set<FineTangentAndSlopeInvariantId> = new Set([
  'FINETANGENT_STRICTLY_MONOTONIC_INCREASING',
  'FINETANGENT_NEGATIVE_HALF_ALL_NEGATIVE',
  'FINETANGENT_POSITIVE_HALF_ALL_POSITIVE',
  'FINETANGENT_NO_EXACT_ZERO_ENTRY',
  'FINETANGENT_PIVOT_VALUES_AT_2047_AND_2048',
  'FINETANGENT_FRACUNIT_CROSSING_AT_INDEX_3072',
  'TANTOANGLE_STRICTLY_MONOTONIC_INCREASING',
  'TANTOANGLE_INCREMENT_SUM_EQUALS_ANG45',
  'TANTOANGLE_INCREMENTS_MONOTONIC_DECREASING',
  'SLOPEDIV_RETURNS_VALUE_IN_ZERO_TO_SLOPERANGE',
  'SLOPEDIV_GUARDS_DEN_LESS_THAN_GUARD_THRESHOLD',
  'SLOPEDIV_TANTOANGLE_COMPOSITION_BAM_IN_ZERO_TO_ANG45',
  'TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS',
]);

const ALL_PROBE_IDS: Set<FineTangentAndSlopeProbeId> = new Set([
  'finetangent_strict_increase_sentinel_low',
  'finetangent_strict_increase_sentinel_high',
  'finetangent_min_abs_negative_pivot',
  'finetangent_min_abs_positive_pivot',
  'finetangent_just_below_fracunit_crossing',
  'finetangent_at_fracunit_crossing',
  'tantoangle_first_increment_value',
  'tantoangle_middle_increment_value',
  'tantoangle_final_increment_value',
  'slopediv_at_guard_boundary_511',
  'slopediv_at_guard_boundary_512',
  'slopediv_with_negative_num_returns_clamp',
  'slopediv_with_negative_den_underflows_to_zero_quotient',
  'composition_zero_slope_yields_zero_bam',
  'composition_unit_slope_yields_ang45_bam',
  'composition_quarter_slope_lookup_known_bam',
]);

function buildLiveCandidate(): FineTangentAndSlopeCandidate {
  return {
    finetangent,
    tantoangle,
    slopeDiv,
  };
}

describe('audit-fine-tangent-and-slope-tables audited canonical constants', () => {
  test('AUDITED_FINETANGENT_MIN_ABSOLUTE_VALUE is exactly 25 (the smallest |value| in finetangent)', () => {
    expect(AUDITED_FINETANGENT_MIN_ABSOLUTE_VALUE).toBe(25);
  });

  test('AUDITED_FINETANGENT_PIVOT_NEGATIVE_VALUE is exactly -25 (finetangent[2047])', () => {
    expect(AUDITED_FINETANGENT_PIVOT_NEGATIVE_VALUE).toBe(-25);
  });

  test('AUDITED_FINETANGENT_PIVOT_POSITIVE_VALUE is exactly +25 (finetangent[2048])', () => {
    expect(AUDITED_FINETANGENT_PIVOT_POSITIVE_VALUE).toBe(25);
  });

  test('AUDITED_FINETANGENT_NEGATIVE_HALF_END_INDEX is exactly 2048 (= FINEANGLES / 4)', () => {
    expect(AUDITED_FINETANGENT_NEGATIVE_HALF_END_INDEX).toBe(2048);
    expect(AUDITED_FINETANGENT_NEGATIVE_HALF_END_INDEX).toBe(FINEANGLES / 4);
  });

  test('AUDITED_FINETANGENT_POSITIVE_HALF_START_INDEX is exactly 2048 (= FINEANGLES / 4)', () => {
    expect(AUDITED_FINETANGENT_POSITIVE_HALF_START_INDEX).toBe(2048);
    expect(AUDITED_FINETANGENT_POSITIVE_HALF_START_INDEX).toBe(FINEANGLES / 4);
  });

  test('AUDITED_FINETANGENT_FRACUNIT_CROSSING_INDEX is exactly 3072 (= 3 * FINEANGLES / 8)', () => {
    expect(AUDITED_FINETANGENT_FRACUNIT_CROSSING_INDEX).toBe(3072);
    expect(AUDITED_FINETANGENT_FRACUNIT_CROSSING_INDEX).toBe((3 * FINEANGLES) / 8);
  });

  test('AUDITED_FINETANGENT_AT_FRACUNIT_CROSSING is exactly 65586 (just above FRACUNIT)', () => {
    expect(AUDITED_FINETANGENT_AT_FRACUNIT_CROSSING).toBe(65_586);
    expect(AUDITED_FINETANGENT_AT_FRACUNIT_CROSSING).toBeGreaterThanOrEqual(FRACUNIT);
  });

  test('AUDITED_FINETANGENT_AT_FRACUNIT_CROSSING_MINUS_ONE is exactly 65485 (just below FRACUNIT)', () => {
    expect(AUDITED_FINETANGENT_AT_FRACUNIT_CROSSING_MINUS_ONE).toBe(65_485);
    expect(AUDITED_FINETANGENT_AT_FRACUNIT_CROSSING_MINUS_ONE).toBeLessThan(FRACUNIT);
  });

  test('AUDITED_TANTOANGLE_FIRST_INCREMENT is exactly 333772', () => {
    expect(AUDITED_TANTOANGLE_FIRST_INCREMENT).toBe(333_772);
  });

  test('AUDITED_TANTOANGLE_FINAL_INCREMENT is exactly 166912', () => {
    expect(AUDITED_TANTOANGLE_FINAL_INCREMENT).toBe(166_912);
  });

  test('AUDITED_TANTOANGLE_MIDDLE_INCREMENT is exactly 267072', () => {
    expect(AUDITED_TANTOANGLE_MIDDLE_INCREMENT).toBe(267_072);
  });

  test('AUDITED_TANTOANGLE_INCREMENT_SUM equals ANG45 = 0x20000000', () => {
    expect(AUDITED_TANTOANGLE_INCREMENT_SUM).toBe(0x2000_0000);
    expect(AUDITED_TANTOANGLE_INCREMENT_SUM).toBe(ANG45);
  });

  test('AUDITED_SLOPE_GUARD_THRESHOLD is exactly 512', () => {
    expect(AUDITED_SLOPE_GUARD_THRESHOLD).toBe(512);
  });

  test('AUDITED_SLOPE_NUM_LEFT_SHIFT is exactly 3', () => {
    expect(AUDITED_SLOPE_NUM_LEFT_SHIFT).toBe(3);
  });

  test('AUDITED_SLOPE_DEN_RIGHT_SHIFT is exactly 8', () => {
    expect(AUDITED_SLOPE_DEN_RIGHT_SHIFT).toBe(8);
  });
});

describe('audit-fine-tangent-and-slope-tables fact ledger shape', () => {
  test('audits exactly ten facts — three c-header, seven c-body', () => {
    expect(FINE_TANGENT_AND_SLOPE_AUDIT.length).toBe(10);
    const cHeader = FINE_TANGENT_AND_SLOPE_AUDIT.filter((fact) => fact.category === 'c-header');
    const cBody = FINE_TANGENT_AND_SLOPE_AUDIT.filter((fact) => fact.category === 'c-body');
    expect(cHeader.length).toBe(3);
    expect(cBody.length).toBe(7);
  });

  test('every fact id is unique', () => {
    const ids = FINE_TANGENT_AND_SLOPE_AUDIT.map((fact) => fact.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every fact id from the canonical set exactly once', () => {
    const ids = new Set(FINE_TANGENT_AND_SLOPE_AUDIT.map((fact) => fact.id));
    expect(ids).toEqual(ALL_FACT_IDS);
  });

  test('every fact carries a non-empty description and cReference', () => {
    for (const fact of FINE_TANGENT_AND_SLOPE_AUDIT) {
      expect(fact.description.length).toBeGreaterThan(0);
      expect(fact.cReference.length).toBeGreaterThan(0);
    }
  });

  test('every c-header fact references src/tables.h', () => {
    for (const fact of FINE_TANGENT_AND_SLOPE_AUDIT) {
      if (fact.category === 'c-header') {
        expect(fact.referenceSourceFile).toBe('src/tables.h');
      }
    }
  });

  test('every c-body fact references src/tables.c', () => {
    for (const fact of FINE_TANGENT_AND_SLOPE_AUDIT) {
      if (fact.category === 'c-body') {
        expect(fact.referenceSourceFile).toBe('src/tables.c');
      }
    }
  });
});

describe('audit-fine-tangent-and-slope-tables fact ledger values', () => {
  test('C_HEADER_DECLARE_FINETANGENT_HALF_CIRCLE_LENGTH pins the canonical extern declaration exactly', () => {
    const fact = FINE_TANGENT_AND_SLOPE_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DECLARE_FINETANGENT_HALF_CIRCLE_LENGTH');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('extern fixed_t finetangent[FINEANGLES/2];');
    expect(fact?.referenceSourceFile).toBe('src/tables.h');
  });

  test('C_HEADER_DECLARE_TANTOANGLE_SLOPERANGE_PLUS_ONE_LENGTH pins the canonical extern declaration exactly', () => {
    const fact = FINE_TANGENT_AND_SLOPE_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DECLARE_TANTOANGLE_SLOPERANGE_PLUS_ONE_LENGTH');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('extern angle_t tantoangle[SLOPERANGE+1];');
  });

  test('C_HEADER_DECLARE_SLOPEDIV_SIGNATURE pins the canonical prototype with two unsigned arguments', () => {
    const fact = FINE_TANGENT_AND_SLOPE_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DECLARE_SLOPEDIV_SIGNATURE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('int SlopeDiv (unsigned num, unsigned den);');
  });

  test('C_BODY_FINETANGENT_LITERAL_FIRST_ENTRY pins the array literal opening with -170910304', () => {
    const fact = FINE_TANGENT_AND_SLOPE_AUDIT.find((candidate) => candidate.id === 'C_BODY_FINETANGENT_LITERAL_FIRST_ENTRY');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('-170910304');
    expect(fact?.referenceSourceFile).toBe('src/tables.c');
  });

  test('C_BODY_FINETANGENT_LITERAL_LAST_ENTRY pins the array literal closing with 170910304', () => {
    const fact = FINE_TANGENT_AND_SLOPE_AUDIT.find((candidate) => candidate.id === 'C_BODY_FINETANGENT_LITERAL_LAST_ENTRY');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('170910304');
  });

  test('C_BODY_TANTOANGLE_LITERAL_FIRST_ENTRY pins the array literal opening with 0', () => {
    const fact = FINE_TANGENT_AND_SLOPE_AUDIT.find((candidate) => candidate.id === 'C_BODY_TANTOANGLE_LITERAL_FIRST_ENTRY');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('{ 0,');
  });

  test('C_BODY_TANTOANGLE_LITERAL_LAST_ENTRY pins the array literal closing with 0x20000000', () => {
    const fact = FINE_TANGENT_AND_SLOPE_AUDIT.find((candidate) => candidate.id === 'C_BODY_TANTOANGLE_LITERAL_LAST_ENTRY');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('0x20000000');
  });

  test('C_BODY_SLOPEDIV_GUARD_THRESHOLD pins the canonical guard exactly', () => {
    const fact = FINE_TANGENT_AND_SLOPE_AUDIT.find((candidate) => candidate.id === 'C_BODY_SLOPEDIV_GUARD_THRESHOLD');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('if (den < 512) return SLOPERANGE;');
  });

  test('C_BODY_SLOPEDIV_FORMULA pins the canonical division formula exactly', () => {
    const fact = FINE_TANGENT_AND_SLOPE_AUDIT.find((candidate) => candidate.id === 'C_BODY_SLOPEDIV_FORMULA');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('ans = (num<<3) / (den>>8);');
  });

  test('C_BODY_SLOPEDIV_CLAMP pins the canonical clamp expression exactly', () => {
    const fact = FINE_TANGENT_AND_SLOPE_AUDIT.find((candidate) => candidate.id === 'C_BODY_SLOPEDIV_CLAMP');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('return ans <= SLOPERANGE ? ans : SLOPERANGE;');
  });
});

describe('audit-fine-tangent-and-slope-tables invariant ledger shape', () => {
  test('lists exactly thirteen operational invariants', () => {
    expect(FINE_TANGENT_AND_SLOPE_INVARIANTS.length).toBe(13);
  });

  test('every invariant id is unique', () => {
    const ids = FINE_TANGENT_AND_SLOPE_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every invariant id from the canonical set exactly once', () => {
    const ids = new Set(FINE_TANGENT_AND_SLOPE_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(ALL_INVARIANT_IDS);
  });

  test('every invariant carries a non-empty description', () => {
    for (const invariant of FINE_TANGENT_AND_SLOPE_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('audit-fine-tangent-and-slope-tables probe ledger shape', () => {
  test('declares exactly sixteen probes', () => {
    expect(FINE_TANGENT_AND_SLOPE_PROBES.length).toBe(16);
  });

  test('every probe id is unique', () => {
    const ids = FINE_TANGENT_AND_SLOPE_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every probe id from the canonical set exactly once', () => {
    const ids = new Set(FINE_TANGENT_AND_SLOPE_PROBES.map((probe) => probe.id));
    expect(ids).toEqual(ALL_PROBE_IDS);
  });

  test('every probe carries a non-empty note', () => {
    for (const probe of FINE_TANGENT_AND_SLOPE_PROBES) {
      expect(probe.note.length).toBeGreaterThan(0);
    }
  });

  test('covers every probe target at least once', () => {
    const targets = new Set(FINE_TANGENT_AND_SLOPE_PROBES.map((probe) => probe.target));
    expect(targets).toEqual(new Set(['finetangent', 'tantoangle_increment', 'slopeDiv', 'composition']));
  });
});

describe('audit-fine-tangent-and-slope-tables sha256 fingerprints match the live runtime tables', () => {
  test('finetangent buffer hash matches AUDITED_FINETANGENT_SHA256', () => {
    expect(sha256OfTypedArray(finetangent)).toBe(AUDITED_FINETANGENT_SHA256);
  });

  test('tantoangle buffer hash matches AUDITED_TANTOANGLE_SHA256', () => {
    expect(sha256OfTypedArray(tantoangle)).toBe(AUDITED_TANTOANGLE_SHA256);
  });
});

describe('audit-fine-tangent-and-slope-tables runtime probe values', () => {
  test('every probe input maps to its expected output on the live runtime tables', () => {
    for (const probe of FINE_TANGENT_AND_SLOPE_PROBES) {
      let actual: number;
      if (probe.target === 'finetangent') {
        const index = probe.input as number;
        actual = finetangent[index] ?? Number.NaN;
      } else if (probe.target === 'tantoangle_increment') {
        const index = probe.input as number;
        const high = tantoangle[index + 1] ?? Number.NaN;
        const low = tantoangle[index] ?? Number.NaN;
        actual = high - low;
      } else if (probe.target === 'slopeDiv') {
        const [num, den] = probe.input as readonly [number, number];
        actual = slopeDiv(num, den);
      } else {
        const [num, den] = probe.input as readonly [number, number];
        const idx = slopeDiv(num, den);
        actual = tantoangle[idx] ?? Number.NaN;
      }
      expect(actual).toBe(probe.expected);
    }
  });
});

describe('audit-fine-tangent-and-slope-tables runtime invariants — finetangent', () => {
  test('finetangent is strictly monotonic increasing across every consecutive pair', () => {
    for (let i = 1; i < finetangent.length; i++) {
      const prev = finetangent[i - 1] ?? Number.NaN;
      const curr = finetangent[i] ?? Number.NaN;
      expect(curr).toBeGreaterThan(prev);
    }
  });

  test('finetangent[0..2047] are all strictly negative', () => {
    for (let i = 0; i < AUDITED_FINETANGENT_NEGATIVE_HALF_END_INDEX; i++) {
      expect(finetangent[i]).toBeLessThan(0);
    }
  });

  test('finetangent[2048..4095] are all strictly positive', () => {
    for (let i = AUDITED_FINETANGENT_POSITIVE_HALF_START_INDEX; i < finetangent.length; i++) {
      expect(finetangent[i]).toBeGreaterThan(0);
    }
  });

  test('finetangent contains no exact-zero entry', () => {
    for (let i = 0; i < finetangent.length; i++) {
      expect(finetangent[i]).not.toBe(0);
    }
  });

  test('finetangent[2047] === -25 and finetangent[2048] === +25 (the antisymmetry pivot)', () => {
    expect(finetangent[2047]).toBe(AUDITED_FINETANGENT_PIVOT_NEGATIVE_VALUE);
    expect(finetangent[2048]).toBe(AUDITED_FINETANGENT_PIVOT_POSITIVE_VALUE);
  });

  test('finetangent[3071] === 65485 and finetangent[3072] === 65586 (the FRACUNIT crossing)', () => {
    expect(finetangent[AUDITED_FINETANGENT_FRACUNIT_CROSSING_INDEX - 1]).toBe(AUDITED_FINETANGENT_AT_FRACUNIT_CROSSING_MINUS_ONE);
    expect(finetangent[AUDITED_FINETANGENT_FRACUNIT_CROSSING_INDEX]).toBe(AUDITED_FINETANGENT_AT_FRACUNIT_CROSSING);
    expect(finetangent[AUDITED_FINETANGENT_FRACUNIT_CROSSING_INDEX]).toBeGreaterThanOrEqual(FRACUNIT);
    expect(finetangent[AUDITED_FINETANGENT_FRACUNIT_CROSSING_INDEX - 1]).toBeLessThan(FRACUNIT);
  });

  test('the FRACUNIT crossing index is the FIRST index where |finetangent[i]| >= FRACUNIT — there is no earlier crossing', () => {
    for (let i = AUDITED_FINETANGENT_POSITIVE_HALF_START_INDEX; i < AUDITED_FINETANGENT_FRACUNIT_CROSSING_INDEX; i++) {
      const value = finetangent[i] ?? Number.NaN;
      expect(value).toBeLessThan(FRACUNIT);
    }
  });

  test('finetangent[0] and finetangent[4095] are the saturating endpoints (no entry exceeds them in magnitude)', () => {
    for (let i = 1; i < finetangent.length - 1; i++) {
      const value = finetangent[i] ?? 0;
      expect(Math.abs(value)).toBeLessThan(Math.abs(finetangent[0] ?? 0));
      expect(Math.abs(value)).toBeLessThan(Math.abs(finetangent[finetangent.length - 1] ?? 0));
    }
  });
});

describe('audit-fine-tangent-and-slope-tables runtime invariants — tantoangle', () => {
  test('tantoangle is strictly monotonic increasing across every consecutive pair', () => {
    for (let i = 1; i < tantoangle.length; i++) {
      const prev = tantoangle[i - 1] ?? Number.NaN;
      const curr = tantoangle[i] ?? Number.NaN;
      expect(curr).toBeGreaterThan(prev);
    }
  });

  test('the cumulative sum of every consecutive tantoangle increment equals exactly ANG45', () => {
    let sum = 0;
    for (let i = 1; i < tantoangle.length; i++) {
      sum += (tantoangle[i] ?? 0) - (tantoangle[i - 1] ?? 0);
    }
    expect(sum).toBe(AUDITED_TANTOANGLE_INCREMENT_SUM);
    expect(sum).toBe(ANG45);
  });

  test('tantoangle increments are monotonically non-strictly decreasing (arctangent concavity)', () => {
    let prevIncrement = Number.POSITIVE_INFINITY;
    for (let i = 1; i < tantoangle.length; i++) {
      const increment = (tantoangle[i] ?? 0) - (tantoangle[i - 1] ?? 0);
      expect(increment).toBeLessThanOrEqual(prevIncrement);
      prevIncrement = increment;
    }
  });

  test('the first increment is strictly larger than the final increment', () => {
    expect(AUDITED_TANTOANGLE_FIRST_INCREMENT).toBeGreaterThan(AUDITED_TANTOANGLE_FINAL_INCREMENT);
    expect(tantoangle[1]! - tantoangle[0]!).toBe(AUDITED_TANTOANGLE_FIRST_INCREMENT);
    expect(tantoangle[2048]! - tantoangle[2047]!).toBe(AUDITED_TANTOANGLE_FINAL_INCREMENT);
  });

  test('the middle increment differs from a hypothetical linearised increment (ANG45 / SLOPERANGE = 262144)', () => {
    const linearisedIncrement = ANG45 / SLOPERANGE;
    expect(linearisedIncrement).toBe(262_144);
    expect(AUDITED_TANTOANGLE_MIDDLE_INCREMENT).not.toBe(linearisedIncrement);
    expect(AUDITED_TANTOANGLE_MIDDLE_INCREMENT).toBeGreaterThan(linearisedIncrement);
  });
});

describe('audit-fine-tangent-and-slope-tables runtime invariants — slopeDiv', () => {
  test('slopeDiv returns a value in [0, SLOPERANGE] across a sweep of (num, den) pairs', () => {
    for (let den = 0; den < 65_536; den += 17) {
      for (let num = 0; num < 65_536; num += 1023) {
        const result = slopeDiv(num, den);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(SLOPERANGE);
        expect(Number.isInteger(result)).toBe(true);
      }
    }
  });

  test('slopeDiv with den in [0, 511] always returns SLOPERANGE (the < 512 guard is exact)', () => {
    for (let den = 0; den < AUDITED_SLOPE_GUARD_THRESHOLD; den++) {
      expect(slopeDiv(0, den)).toBe(SLOPERANGE);
      expect(slopeDiv(1024, den)).toBe(SLOPERANGE);
      expect(slopeDiv(0xffff, den)).toBe(SLOPERANGE);
    }
  });

  test('slopeDiv with den === 512 takes the formula path (does not fall into the guard)', () => {
    expect(slopeDiv(64, 512)).toBe(256);
    expect(slopeDiv(0, 512)).toBe(0);
    expect(slopeDiv(256, 512)).toBe(1024);
  });

  test('slopeDiv with negative num clamps to SLOPERANGE (uint32 coercion makes num huge)', () => {
    expect(slopeDiv(-1, 1024)).toBe(SLOPERANGE);
    expect(slopeDiv(-1024, 1024)).toBe(SLOPERANGE);
  });

  test('slopeDiv with negative den underflows the formula to a near-zero quotient', () => {
    expect(slopeDiv(1024, -1)).toBe(0);
    expect(slopeDiv(0, -1)).toBe(0);
  });
});

describe('audit-fine-tangent-and-slope-tables runtime invariants — composition', () => {
  test('tantoangle[slopeDiv(num, den)] is in [0, ANG45] for a sweep of first-octant (num, den) pairs', () => {
    for (let den = 1; den < 8192; den += 11) {
      for (let num = 0; num <= den; num += 7) {
        const idx = slopeDiv(num, den);
        const angle = tantoangle[idx] ?? Number.NaN;
        expect(angle).toBeGreaterThanOrEqual(0);
        expect(angle).toBeLessThanOrEqual(ANG45);
      }
    }
  });

  test('tantoangle[slopeDiv(0, den)] === 0 for every den >= 512', () => {
    for (let den = 512; den < 65_536; den += 1023) {
      expect(tantoangle[slopeDiv(0, den)]).toBe(0);
    }
  });

  test('tantoangle[slopeDiv(den, den)] === ANG45 for every den >= 512 (unit-slope canonical case)', () => {
    for (let den = 512; den < 65_536; den += 1023) {
      expect(tantoangle[slopeDiv(den, den)]).toBe(ANG45);
    }
  });
});

describe('crossCheckFineTangentAndSlope on the live runtime tables', () => {
  test('reports zero failures', () => {
    expect(crossCheckFineTangentAndSlope(buildLiveCandidate())).toEqual([]);
  });
});

describe('crossCheckFineTangentAndSlope failure modes — tampered candidates', () => {
  test('detects a candidate where finetangent contains an exact-zero cell', () => {
    const tampered = new Int32Array(finetangent);
    tampered[2047] = 0;
    const failures = crossCheckFineTangentAndSlope({ ...buildLiveCandidate(), finetangent: tampered });
    expect(failures).toContain('probe:finetangent_min_abs_negative_pivot');
    expect(failures).toContain('invariant:FINETANGENT_NEGATIVE_HALF_ALL_NEGATIVE');
    expect(failures).toContain('invariant:FINETANGENT_NO_EXACT_ZERO_ENTRY');
    expect(failures).toContain('invariant:FINETANGENT_PIVOT_VALUES_AT_2047_AND_2048');
    expect(failures).toContain('invariant:TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS');
  });

  test('detects a candidate where finetangent loses its strict-monotonic property (one cell duplicated)', () => {
    const tampered = new Int32Array(finetangent);
    tampered[100] = tampered[99] ?? 0;
    const failures = crossCheckFineTangentAndSlope({ ...buildLiveCandidate(), finetangent: tampered });
    expect(failures).toContain('invariant:FINETANGENT_STRICTLY_MONOTONIC_INCREASING');
    expect(failures).toContain('invariant:TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS');
  });

  test('detects a candidate where the FRACUNIT crossing has been linearised away', () => {
    const tampered = new Int32Array(finetangent);
    tampered[3072] = 65_536; // tampered to exact FRACUNIT (canonical is 65586)
    const failures = crossCheckFineTangentAndSlope({ ...buildLiveCandidate(), finetangent: tampered });
    expect(failures).toContain('probe:finetangent_at_fracunit_crossing');
    expect(failures).toContain('invariant:FINETANGENT_FRACUNIT_CROSSING_AT_INDEX_3072');
    expect(failures).toContain('invariant:TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS');
  });

  test('detects a candidate where tantoangle has been replaced by a linear interpolation', () => {
    const tampered = new Uint32Array(tantoangle.length);
    const linearStep = ANG45 / SLOPERANGE;
    for (let i = 0; i < tampered.length; i++) {
      tampered[i] = Math.round(i * linearStep);
    }
    const failures = crossCheckFineTangentAndSlope({ ...buildLiveCandidate(), tantoangle: tampered });
    expect(failures).toContain('probe:tantoangle_first_increment_value');
    expect(failures).toContain('probe:tantoangle_middle_increment_value');
    expect(failures).toContain('probe:tantoangle_final_increment_value');
    expect(failures).toContain('invariant:TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS');
  });

  test('detects a candidate where tantoangle is non-strict (one cell duplicated)', () => {
    const tampered = new Uint32Array(tantoangle);
    tampered[100] = tampered[99] ?? 0;
    const failures = crossCheckFineTangentAndSlope({ ...buildLiveCandidate(), tantoangle: tampered });
    expect(failures).toContain('invariant:TANTOANGLE_STRICTLY_MONOTONIC_INCREASING');
    expect(failures).toContain('invariant:TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS');
  });

  test('detects a candidate where the tantoangle increment sum drifts from ANG45', () => {
    const tampered = new Uint32Array(tantoangle);
    tampered[2048] = ANG45 - 1; // breaks the cumulative sum
    const failures = crossCheckFineTangentAndSlope({ ...buildLiveCandidate(), tantoangle: tampered });
    expect(failures).toContain('invariant:TANTOANGLE_INCREMENT_SUM_EQUALS_ANG45');
    expect(failures).toContain('invariant:TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS');
  });

  test('detects a candidate where tantoangle increments are not concave (one increment exceeds its predecessor)', () => {
    // Use a fresh canonical-shape Uint32Array (not derived from runtime tantoangle) so the hash invariant fires too.
    const tampered = new Uint32Array(tantoangle);
    // Make increment[1500] larger than increment[1499] by stealing from a far-away cell so monotonic-decrease breaks.
    tampered[1500] = (tampered[1499] ?? 0) + 1; // forces increment[1500] = 1 (very small) AND increment[1501] now larger
    const failures = crossCheckFineTangentAndSlope({ ...buildLiveCandidate(), tantoangle: tampered });
    expect(failures).toContain('invariant:TANTOANGLE_INCREMENTS_MONOTONIC_DECREASING');
    expect(failures).toContain('invariant:TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS');
  });

  test('detects a candidate slopeDiv that returns a value larger than SLOPERANGE', () => {
    const tamperedSlopeDiv = (num: number, den: number): number => {
      const denU = den >>> 0;
      if (denU < 512) {
        return SLOPERANGE;
      }
      // Tamper: drop the clamp.
      return ((num << 3) >>> 0) / (denU >>> 8);
    };
    const failures = crossCheckFineTangentAndSlope({ ...buildLiveCandidate(), slopeDiv: tamperedSlopeDiv });
    expect(failures).toContain('invariant:SLOPEDIV_RETURNS_VALUE_IN_ZERO_TO_SLOPERANGE');
  });

  test('detects a candidate slopeDiv that bypasses the < 512 guard for exactly den === 0', () => {
    const tamperedSlopeDiv = (num: number, den: number): number => {
      if (den === 0) {
        return 0;
      } // tamper: bypasses guard for exact zero
      const denU = den >>> 0;
      if (denU < 512) {
        return SLOPERANGE;
      }
      const ans = ((num << 3) >>> 0) / (denU >>> 8);
      return ans <= SLOPERANGE ? ans >>> 0 : SLOPERANGE;
    };
    const failures = crossCheckFineTangentAndSlope({ ...buildLiveCandidate(), slopeDiv: tamperedSlopeDiv });
    expect(failures).toContain('invariant:SLOPEDIV_GUARDS_DEN_LESS_THAN_GUARD_THRESHOLD');
  });

  test('detects a tantoangle tamper that breaks the unit-slope composition lookup', () => {
    const tampered = new Uint32Array(tantoangle);
    tampered[2048] = 0;
    const failures = crossCheckFineTangentAndSlope({ ...buildLiveCandidate(), tantoangle: tampered });
    expect(failures).toContain('probe:composition_unit_slope_yields_ang45_bam');
    expect(failures).toContain('invariant:TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS');
  });

  test('detects a candidate slopeDiv that returns negative values (would break the composition lookup)', () => {
    const tamperedSlopeDiv = (_num: number, _den: number): number => -1;
    const failures = crossCheckFineTangentAndSlope({ ...buildLiveCandidate(), slopeDiv: tamperedSlopeDiv });
    expect(failures).toContain('invariant:SLOPEDIV_RETURNS_VALUE_IN_ZERO_TO_SLOPERANGE');
  });
});

describe('audit-fine-tangent-and-slope-tables sha256OfTypedArray helper', () => {
  test('produces a stable 64-character hex string for a known input', () => {
    const buffer = new Int32Array([0, 0, 0, 0]);
    const hash = sha256OfTypedArray(buffer);
    expect(hash.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  test('produces different hashes for different inputs of the same length', () => {
    const buffer1 = new Uint32Array([1, 0, 0, 0]);
    const buffer2 = new Uint32Array([0, 1, 0, 0]);
    expect(sha256OfTypedArray(buffer1)).not.toBe(sha256OfTypedArray(buffer2));
  });
});

describe('audit-fine-tangent-and-slope-tables step file', () => {
  test('declares the core lane and the audit write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-006-audit-fine-tangent-and-slope-tables.md').text();
    expect(stepText).toContain('## lane\n\ncore');
    expect(stepText).toContain('- src/core/audit-fine-tangent-and-slope-tables.ts');
    expect(stepText).toContain('- test/vanilla_parity/core/audit-fine-tangent-and-slope-tables.test.ts');
  });

  test('lists m_fixed.c, tables.c, d_main.c, and g_game.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-006-audit-fine-tangent-and-slope-tables.md').text();
    expect(stepText).toContain('- m_fixed.c');
    expect(stepText).toContain('- tables.c');
    expect(stepText).toContain('- d_main.c');
    expect(stepText).toContain('- g_game.c');
  });

  test('declares 00-018 as the prerequisite', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-006-audit-fine-tangent-and-slope-tables.md').text();
    expect(stepText).toContain('## prerequisites\n\n- 00-018');
  });
});
