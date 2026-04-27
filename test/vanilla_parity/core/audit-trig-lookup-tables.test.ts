import { describe, expect, test } from 'bun:test';

import { ANG45 } from '../../../src/core/angle.ts';
import { ANGLETOFINESHIFT, DBITS, FINEANGLES, FINEMASK, SLOPEBITS, SLOPERANGE, finecosine, finesine, finetangent, slopeDiv, tantoangle } from '../../../src/core/trig.ts';
import {
  AUDITED_ANGLETOFINESHIFT,
  AUDITED_DBITS,
  AUDITED_FINEANGLES,
  AUDITED_FINECOSINE_LENGTH,
  AUDITED_FINECOSINE_OFFSET,
  AUDITED_FINECOSINE_SHA256,
  AUDITED_FINEMASK,
  AUDITED_FINESINE_LENGTH,
  AUDITED_FINESINE_PEAK_MAGNITUDE,
  AUDITED_FINESINE_SHA256,
  AUDITED_FINETANGENT_LENGTH,
  AUDITED_FINETANGENT_PEAK_MAGNITUDE,
  AUDITED_FINETANGENT_SHA256,
  AUDITED_SLOPEBITS,
  AUDITED_SLOPERANGE,
  AUDITED_TANTOANGLE_AT_SLOPERANGE,
  AUDITED_TANTOANGLE_LENGTH,
  AUDITED_TANTOANGLE_SHA256,
  TRIG_LOOKUP_AUDIT,
  TRIG_LOOKUP_INVARIANTS,
  TRIG_LOOKUP_PROBES,
  crossCheckTrigLookupTables,
  sha256OfTypedArray,
} from '../../../src/core/audit-trig-lookup-tables.ts';
import type { TrigLookupCandidate, TrigLookupFactId, TrigLookupInvariantId, TrigLookupProbeId } from '../../../src/core/audit-trig-lookup-tables.ts';

const ALL_FACT_IDS: Set<TrigLookupFactId> = new Set([
  'C_HEADER_DEFINE_FINEANGLES',
  'C_HEADER_DEFINE_FINEMASK',
  'C_HEADER_DEFINE_ANGLETOFINESHIFT',
  'C_HEADER_DEFINE_SLOPERANGE',
  'C_HEADER_DECLARE_FINETANGENT',
  'C_HEADER_DECLARE_FINESINE',
  'C_HEADER_DECLARE_FINECOSINE_AS_POINTER',
  'C_HEADER_DECLARE_TANTOANGLE',
  'C_BODY_FINECOSINE_ALIAS_OFFSET',
  'C_BODY_SLOPEDIV',
]);

const ALL_INVARIANT_IDS: Set<TrigLookupInvariantId> = new Set([
  'FINETANGENT_LENGTH_MATCHES_FINEANGLES_HALF',
  'FINESINE_LENGTH_MATCHES_FIVE_QUARTER_FINEANGLES',
  'FINECOSINE_LENGTH_MATCHES_FINEANGLES',
  'TANTOANGLE_LENGTH_MATCHES_SLOPERANGE_PLUS_ONE',
  'FINETANGENT_ANTISYMMETRIC_ACROSS_MIDPOINT',
  'FINESINE_PEAK_MAGNITUDE_NEVER_EXCEEDS_FRACUNIT_MINUS_ONE',
  'FINECOSINE_ALIASES_FINESINE_AT_QUARTER_OFFSET',
  'TANTOANGLE_NON_DECREASING',
  'TANTOANGLE_ENDPOINTS_ARE_ZERO_AND_ANG45',
  'TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS',
]);

const ALL_PROBE_IDS: Set<TrigLookupProbeId> = new Set([
  'finetangent_at_zero_endpoint',
  'finetangent_at_first_index',
  'finetangent_at_left_midpoint_minus_one',
  'finetangent_at_right_midpoint',
  'finetangent_at_last_endpoint',
  'finesine_at_zero',
  'finesine_at_first_index',
  'finesine_at_quarter_circle_peak_minus_one',
  'finesine_at_quarter_circle_peak',
  'finesine_at_half_circle_minus_one',
  'finesine_at_half_circle_zero_crossing',
  'finesine_at_three_quarter_circle_trough',
  'finesine_at_full_circle_wrap_back_to_start',
  'finesine_at_extension_tail_end',
  'finecosine_at_zero_equals_FRACUNIT_minus_one',
  'finecosine_at_quarter_circle_zero_crossing',
  'finecosine_at_half_circle_negative_peak',
  'finecosine_at_three_quarter_circle_zero_crossing',
  'tantoangle_at_zero_slope',
  'tantoangle_at_first_slope',
  'tantoangle_at_quarter_slope',
  'tantoangle_at_one_below_endpoint',
  'tantoangle_at_endpoint_equals_ANG45',
  'slopediv_with_zero_denominator_returns_SLOPERANGE',
  'slopediv_with_unit_slope_returns_SLOPERANGE',
]);

function buildLiveCandidate(): TrigLookupCandidate {
  return {
    finetangent,
    finesine,
    finecosine,
    tantoangle,
    slopeDiv,
  };
}

describe('audit-trig-lookup-tables audited canonical constants', () => {
  test('AUDITED_FINEANGLES is exactly 8192, independent of src/core/trig.ts', () => {
    expect(AUDITED_FINEANGLES).toBe(8192);
  });

  test('AUDITED_FINEMASK is exactly 8191, independent of src/core/trig.ts', () => {
    expect(AUDITED_FINEMASK).toBe(8191);
    expect(AUDITED_FINEMASK).toBe(AUDITED_FINEANGLES - 1);
  });

  test('AUDITED_ANGLETOFINESHIFT is exactly 19, independent of src/core/trig.ts', () => {
    expect(AUDITED_ANGLETOFINESHIFT).toBe(19);
  });

  test('AUDITED_SLOPERANGE is exactly 2048, independent of src/core/trig.ts', () => {
    expect(AUDITED_SLOPERANGE).toBe(2048);
  });

  test('AUDITED_SLOPEBITS is exactly 11, independent of src/core/trig.ts', () => {
    expect(AUDITED_SLOPEBITS).toBe(11);
  });

  test('AUDITED_DBITS is exactly 5 (= FRACBITS - SLOPEBITS = 16 - 11), independent of src/core/trig.ts', () => {
    expect(AUDITED_DBITS).toBe(5);
  });

  test('AUDITED_FINETANGENT_LENGTH is exactly 4096 (= FINEANGLES / 2)', () => {
    expect(AUDITED_FINETANGENT_LENGTH).toBe(4096);
    expect(AUDITED_FINETANGENT_LENGTH).toBe(AUDITED_FINEANGLES / 2);
  });

  test('AUDITED_FINESINE_LENGTH is exactly 10240 (= 5 * FINEANGLES / 4)', () => {
    expect(AUDITED_FINESINE_LENGTH).toBe(10_240);
    expect(AUDITED_FINESINE_LENGTH).toBe((5 * AUDITED_FINEANGLES) / 4);
  });

  test('AUDITED_FINECOSINE_OFFSET is exactly 2048 (= FINEANGLES / 4)', () => {
    expect(AUDITED_FINECOSINE_OFFSET).toBe(2048);
    expect(AUDITED_FINECOSINE_OFFSET).toBe(AUDITED_FINEANGLES / 4);
  });

  test('AUDITED_FINECOSINE_LENGTH is exactly 8192 (= FINEANGLES = FINESINE_LENGTH - FINECOSINE_OFFSET)', () => {
    expect(AUDITED_FINECOSINE_LENGTH).toBe(8192);
    expect(AUDITED_FINECOSINE_LENGTH).toBe(AUDITED_FINEANGLES);
    expect(AUDITED_FINECOSINE_LENGTH).toBe(AUDITED_FINESINE_LENGTH - AUDITED_FINECOSINE_OFFSET);
  });

  test('AUDITED_TANTOANGLE_LENGTH is exactly 2049 (= SLOPERANGE + 1)', () => {
    expect(AUDITED_TANTOANGLE_LENGTH).toBe(2049);
    expect(AUDITED_TANTOANGLE_LENGTH).toBe(AUDITED_SLOPERANGE + 1);
  });

  test('AUDITED_FINETANGENT_PEAK_MAGNITUDE is exactly 170910304', () => {
    expect(AUDITED_FINETANGENT_PEAK_MAGNITUDE).toBe(170_910_304);
  });

  test('AUDITED_FINESINE_PEAK_MAGNITUDE is exactly 65535 (= FRACUNIT - 1)', () => {
    expect(AUDITED_FINESINE_PEAK_MAGNITUDE).toBe(65_535);
  });

  test('AUDITED_TANTOANGLE_AT_SLOPERANGE equals ANG45 = 0x20000000', () => {
    expect(AUDITED_TANTOANGLE_AT_SLOPERANGE).toBe(0x2000_0000);
    expect(AUDITED_TANTOANGLE_AT_SLOPERANGE).toBe(ANG45);
  });

  test('audited canonical constants agree with the runtime exports from src/core/trig.ts', () => {
    expect(AUDITED_FINEANGLES).toBe(FINEANGLES);
    expect(AUDITED_FINEMASK).toBe(FINEMASK);
    expect(AUDITED_ANGLETOFINESHIFT).toBe(ANGLETOFINESHIFT);
    expect(AUDITED_SLOPERANGE).toBe(SLOPERANGE);
    expect(AUDITED_SLOPEBITS).toBe(SLOPEBITS);
    expect(AUDITED_DBITS).toBe(DBITS);
  });

  test('audited canonical lengths agree with the runtime table extents from src/core/trig.ts', () => {
    expect(AUDITED_FINETANGENT_LENGTH).toBe(finetangent.length);
    expect(AUDITED_FINESINE_LENGTH).toBe(finesine.length);
    expect(AUDITED_FINECOSINE_LENGTH).toBe(finecosine.length);
    expect(AUDITED_TANTOANGLE_LENGTH).toBe(tantoangle.length);
  });
});

describe('audit-trig-lookup-tables fact ledger shape', () => {
  test('audits exactly ten facts — eight c-header, two c-body', () => {
    expect(TRIG_LOOKUP_AUDIT.length).toBe(10);
    const cHeader = TRIG_LOOKUP_AUDIT.filter((fact) => fact.category === 'c-header');
    const cBody = TRIG_LOOKUP_AUDIT.filter((fact) => fact.category === 'c-body');
    expect(cHeader.length).toBe(8);
    expect(cBody.length).toBe(2);
  });

  test('every fact id is unique', () => {
    const ids = TRIG_LOOKUP_AUDIT.map((fact) => fact.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every fact id from the canonical set exactly once', () => {
    const ids = new Set(TRIG_LOOKUP_AUDIT.map((fact) => fact.id));
    expect(ids).toEqual(ALL_FACT_IDS);
  });

  test('every fact carries a non-empty description and cReference', () => {
    for (const fact of TRIG_LOOKUP_AUDIT) {
      expect(fact.description.length).toBeGreaterThan(0);
      expect(fact.cReference.length).toBeGreaterThan(0);
    }
  });

  test('every c-header fact references src/tables.h', () => {
    for (const fact of TRIG_LOOKUP_AUDIT) {
      if (fact.category === 'c-header') {
        expect(fact.referenceSourceFile).toBe('src/tables.h');
      }
    }
  });

  test('every c-body fact references src/tables.c', () => {
    for (const fact of TRIG_LOOKUP_AUDIT) {
      if (fact.category === 'c-body') {
        expect(fact.referenceSourceFile).toBe('src/tables.c');
      }
    }
  });
});

describe('audit-trig-lookup-tables fact ledger values', () => {
  test('C_HEADER_DEFINE_FINEANGLES pins the canonical macro exactly', () => {
    const fact = TRIG_LOOKUP_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DEFINE_FINEANGLES');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('#define FINEANGLES              8192');
    expect(fact?.referenceSourceFile).toBe('src/tables.h');
  });

  test('C_HEADER_DEFINE_FINEMASK pins the canonical macro exactly', () => {
    const fact = TRIG_LOOKUP_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DEFINE_FINEMASK');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('#define FINEMASK                (FINEANGLES-1)');
  });

  test('C_HEADER_DEFINE_ANGLETOFINESHIFT pins the canonical macro exactly', () => {
    const fact = TRIG_LOOKUP_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DEFINE_ANGLETOFINESHIFT');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('#define ANGLETOFINESHIFT        19');
  });

  test('C_HEADER_DEFINE_SLOPERANGE pins the canonical macro exactly', () => {
    const fact = TRIG_LOOKUP_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DEFINE_SLOPERANGE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('#define SLOPERANGE      2048');
  });

  test('C_HEADER_DECLARE_FINETANGENT pins the canonical extern declaration exactly', () => {
    const fact = TRIG_LOOKUP_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DECLARE_FINETANGENT');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('extern fixed_t finetangent[FINEANGLES/2];');
  });

  test('C_HEADER_DECLARE_FINESINE pins the canonical extern declaration exactly', () => {
    const fact = TRIG_LOOKUP_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DECLARE_FINESINE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('extern fixed_t finesine[5*FINEANGLES/4];');
  });

  test('C_HEADER_DECLARE_FINECOSINE_AS_POINTER pins finecosine as a pointer, not an array', () => {
    const fact = TRIG_LOOKUP_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DECLARE_FINECOSINE_AS_POINTER');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('extern fixed_t *finecosine;');
  });

  test('C_HEADER_DECLARE_TANTOANGLE pins the canonical extern declaration with SLOPERANGE+1 length', () => {
    const fact = TRIG_LOOKUP_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DECLARE_TANTOANGLE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('extern angle_t tantoangle[SLOPERANGE+1];');
  });

  test('C_BODY_FINECOSINE_ALIAS_OFFSET pins the canonical pointer-alias initialiser exactly', () => {
    const fact = TRIG_LOOKUP_AUDIT.find((candidate) => candidate.id === 'C_BODY_FINECOSINE_ALIAS_OFFSET');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('fixed_t *finecosine = &finesine[FINEANGLES/4];');
    expect(fact?.referenceSourceFile).toBe('src/tables.c');
  });

  test('C_BODY_SLOPEDIV pins the canonical SlopeDiv body exactly', () => {
    const fact = TRIG_LOOKUP_AUDIT.find((candidate) => candidate.id === 'C_BODY_SLOPEDIV');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('int SlopeDiv(unsigned num, unsigned den) { unsigned ans; if (den < 512) return SLOPERANGE; ans = (num<<3)/(den>>8); return ans <= SLOPERANGE ? ans : SLOPERANGE; }');
    expect(fact?.referenceSourceFile).toBe('src/tables.c');
  });
});

describe('audit-trig-lookup-tables invariant ledger shape', () => {
  test('lists exactly ten derived invariants', () => {
    expect(TRIG_LOOKUP_INVARIANTS.length).toBe(10);
  });

  test('every invariant id is unique', () => {
    const ids = TRIG_LOOKUP_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every invariant id from the canonical set exactly once', () => {
    const ids = new Set(TRIG_LOOKUP_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(ALL_INVARIANT_IDS);
  });

  test('every invariant carries a non-empty description', () => {
    for (const invariant of TRIG_LOOKUP_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('audit-trig-lookup-tables probe ledger shape', () => {
  test('declares exactly twenty-five probes', () => {
    expect(TRIG_LOOKUP_PROBES.length).toBe(25);
  });

  test('every probe id is unique', () => {
    const ids = TRIG_LOOKUP_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every probe id from the canonical set exactly once', () => {
    const ids = new Set(TRIG_LOOKUP_PROBES.map((probe) => probe.id));
    expect(ids).toEqual(ALL_PROBE_IDS);
  });

  test('every probe carries a non-empty note', () => {
    for (const probe of TRIG_LOOKUP_PROBES) {
      expect(probe.note.length).toBeGreaterThan(0);
    }
  });

  test('covers every table at least once', () => {
    const tables = new Set(TRIG_LOOKUP_PROBES.map((probe) => probe.table));
    expect(tables).toEqual(new Set(['finetangent', 'finesine', 'finecosine', 'tantoangle', 'slopeDiv']));
  });

  test('every table-indexed probe input is an integer index within the audited length, and slopeDiv probes use a (num, den) pair', () => {
    const tableLengths: Record<'finetangent' | 'finesine' | 'finecosine' | 'tantoangle', number> = {
      finetangent: AUDITED_FINETANGENT_LENGTH,
      finesine: AUDITED_FINESINE_LENGTH,
      finecosine: AUDITED_FINECOSINE_LENGTH,
      tantoangle: AUDITED_TANTOANGLE_LENGTH,
    };
    for (const probe of TRIG_LOOKUP_PROBES) {
      if (probe.table === 'slopeDiv') {
        expect(Array.isArray(probe.input)).toBe(true);
        const tuple = probe.input as readonly [number, number];
        expect(tuple.length).toBe(2);
        expect(Number.isInteger(tuple[0])).toBe(true);
        expect(Number.isInteger(tuple[1])).toBe(true);
      } else {
        expect(typeof probe.input).toBe('number');
        const index = probe.input as number;
        expect(Number.isInteger(index)).toBe(true);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(tableLengths[probe.table]);
      }
    }
  });
});

describe('audit-trig-lookup-tables audited sha256 fingerprints match the live runtime tables', () => {
  test('finetangent buffer hash matches AUDITED_FINETANGENT_SHA256', () => {
    expect(sha256OfTypedArray(finetangent)).toBe(AUDITED_FINETANGENT_SHA256);
  });

  test('finesine buffer hash matches AUDITED_FINESINE_SHA256', () => {
    expect(sha256OfTypedArray(finesine)).toBe(AUDITED_FINESINE_SHA256);
  });

  test('finecosine view hash matches AUDITED_FINECOSINE_SHA256', () => {
    expect(sha256OfTypedArray(finecosine)).toBe(AUDITED_FINECOSINE_SHA256);
  });

  test('tantoangle buffer hash matches AUDITED_TANTOANGLE_SHA256', () => {
    expect(sha256OfTypedArray(tantoangle)).toBe(AUDITED_TANTOANGLE_SHA256);
  });
});

describe('audit-trig-lookup-tables runtime table values match every probe expected value', () => {
  test('every probe input maps to its expected canonical output on the live runtime tables', () => {
    for (const probe of TRIG_LOOKUP_PROBES) {
      let actual: number;
      if (probe.table === 'slopeDiv') {
        const [num, den] = probe.input as readonly [number, number];
        actual = slopeDiv(num, den);
      } else {
        const index = probe.input as number;
        const view = probe.table === 'finetangent' ? finetangent : probe.table === 'finesine' ? finesine : probe.table === 'finecosine' ? finecosine : tantoangle;
        actual = view[index] ?? Number.NaN;
      }
      expect(actual).toBe(probe.expected);
    }
  });
});

describe('audit-trig-lookup-tables runtime invariants', () => {
  test('finetangent is bit-for-bit antisymmetric across its midpoint', () => {
    for (let i = 0; i < AUDITED_FINETANGENT_LENGTH; i++) {
      const left = finetangent[i] ?? Number.NaN;
      const right = finetangent[AUDITED_FINETANGENT_LENGTH - 1 - i] ?? Number.NaN;
      expect(left).toBe(-right);
    }
  });

  test('|finesine[i]| never exceeds AUDITED_FINESINE_PEAK_MAGNITUDE for any i', () => {
    for (let i = 0; i < AUDITED_FINESINE_LENGTH; i++) {
      const value = finesine[i] ?? Number.NaN;
      expect(Math.abs(value)).toBeLessThanOrEqual(AUDITED_FINESINE_PEAK_MAGNITUDE);
    }
  });

  test('finesine peak (= FRACUNIT - 1 = 65535) actually appears in the table — the cap is observed, not just an upper bound', () => {
    expect(finesine.indexOf(AUDITED_FINESINE_PEAK_MAGNITUDE)).toBeGreaterThanOrEqual(0);
    expect(finesine.indexOf(-AUDITED_FINESINE_PEAK_MAGNITUDE)).toBeGreaterThanOrEqual(0);
  });

  test('finetangent peak (= ±170910304) actually appears at the half-circle endpoints', () => {
    expect(finetangent[0]).toBe(-AUDITED_FINETANGENT_PEAK_MAGNITUDE);
    expect(finetangent[AUDITED_FINETANGENT_LENGTH - 1]).toBe(AUDITED_FINETANGENT_PEAK_MAGNITUDE);
  });

  test('finecosine[i] === finesine[i + FINEANGLES / 4] for every i in [0, 8192) — the canonical zero-copy alias', () => {
    for (let i = 0; i < AUDITED_FINECOSINE_LENGTH; i++) {
      expect(finecosine[i]).toBe(finesine[i + AUDITED_FINECOSINE_OFFSET]!);
    }
  });

  test('finecosine shares the same ArrayBuffer as finesine — the alias is a TypedArray subarray view, not a copy', () => {
    expect(finecosine.buffer).toBe(finesine.buffer);
    expect(finecosine.byteOffset).toBe(finesine.byteOffset + AUDITED_FINECOSINE_OFFSET * Int32Array.BYTES_PER_ELEMENT);
  });

  test('tantoangle is monotonic non-decreasing across its full extent', () => {
    for (let i = 1; i < AUDITED_TANTOANGLE_LENGTH; i++) {
      const prev = tantoangle[i - 1] ?? Number.NaN;
      const curr = tantoangle[i] ?? Number.NaN;
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  test('tantoangle endpoints are 0 and ANG45', () => {
    expect(tantoangle[0]).toBe(0);
    expect(tantoangle[AUDITED_SLOPERANGE]).toBe(AUDITED_TANTOANGLE_AT_SLOPERANGE);
    expect(tantoangle[AUDITED_SLOPERANGE]).toBe(ANG45);
  });
});

describe('crossCheckTrigLookupTables on the live runtime tables', () => {
  test('reports zero failures', () => {
    expect(crossCheckTrigLookupTables(buildLiveCandidate())).toEqual([]);
  });
});

describe('crossCheckTrigLookupTables failure modes — tampered candidates', () => {
  test('detects a candidate with a corrupted finetangent buffer (probe + antisymmetry + hash invariants fail)', () => {
    const tamperedFinetangent = new Int32Array(finetangent);
    tamperedFinetangent[0] = 0; // breaks the saturating extreme at the half-circle lower endpoint
    const failures = crossCheckTrigLookupTables({ ...buildLiveCandidate(), finetangent: tamperedFinetangent });
    expect(failures).toContain('probe:finetangent_at_zero_endpoint');
    expect(failures).toContain('invariant:FINETANGENT_ANTISYMMETRIC_ACROSS_MIDPOINT');
    expect(failures).toContain('invariant:TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS');
  });

  test('detects a candidate where finesine peak exceeds FRACUNIT - 1', () => {
    const tamperedFinesine = new Int32Array(finesine);
    tamperedFinesine[2048] = 65_536; // tampered to exact FRACUNIT (canonical table caps at 65535)
    const tamperedFinecosine = tamperedFinesine.subarray(AUDITED_FINECOSINE_OFFSET);
    const failures = crossCheckTrigLookupTables({ ...buildLiveCandidate(), finesine: tamperedFinesine, finecosine: tamperedFinecosine });
    expect(failures).toContain('probe:finesine_at_quarter_circle_peak');
    expect(failures).toContain('invariant:FINESINE_PEAK_MAGNITUDE_NEVER_EXCEEDS_FRACUNIT_MINUS_ONE');
    expect(failures).toContain('invariant:TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS');
  });

  test('detects a candidate where finecosine has been recomputed independently and drifts from finesine', () => {
    // Build a finecosine "copy" that disagrees with the finesine alias at one cell.
    const tamperedFinecosine = new Int32Array(finecosine);
    tamperedFinecosine[0] = 0; // would be cos(0) = FRACUNIT, but the alias returns finesine[2048] = 65535
    const failures = crossCheckTrigLookupTables({ ...buildLiveCandidate(), finecosine: tamperedFinecosine });
    expect(failures).toContain('probe:finecosine_at_zero_equals_FRACUNIT_minus_one');
    expect(failures).toContain('invariant:FINECOSINE_ALIASES_FINESINE_AT_QUARTER_OFFSET');
    expect(failures).toContain('invariant:TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS');
  });

  test('detects a candidate where tantoangle is non-monotonic (one cell decreased below its predecessor)', () => {
    const tamperedTantoangle = new Uint32Array(tantoangle);
    tamperedTantoangle[1024] = 0; // breaks monotonicity
    const failures = crossCheckTrigLookupTables({ ...buildLiveCandidate(), tantoangle: tamperedTantoangle });
    expect(failures).toContain('probe:tantoangle_at_quarter_slope');
    expect(failures).toContain('invariant:TANTOANGLE_NON_DECREASING');
    expect(failures).toContain('invariant:TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS');
  });

  test('detects a candidate where tantoangle endpoint is NOT ANG45', () => {
    const tamperedTantoangle = new Uint32Array(tantoangle);
    tamperedTantoangle[AUDITED_SLOPERANGE] = 0; // breaks endpoint, also breaks monotonicity
    const failures = crossCheckTrigLookupTables({ ...buildLiveCandidate(), tantoangle: tamperedTantoangle });
    expect(failures).toContain('probe:tantoangle_at_endpoint_equals_ANG45');
    expect(failures).toContain('invariant:TANTOANGLE_ENDPOINTS_ARE_ZERO_AND_ANG45');
    expect(failures).toContain('invariant:TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS');
  });

  test('detects a candidate slopeDiv that bypasses the < 512 denominator guard (returns 0 for divide-by-zero)', () => {
    const tamperedSlopeDiv = (num: number, den: number): number => {
      if (den === 0) {
        return 0;
      } // tamper: skips the guard for exact zero
      const denU = den >>> 0;
      if (denU < 512) {
        return AUDITED_SLOPERANGE;
      }
      const ans = ((num << 3) >>> 0) / (denU >>> 8);
      return ans <= AUDITED_SLOPERANGE ? ans >>> 0 : AUDITED_SLOPERANGE;
    };
    const failures = crossCheckTrigLookupTables({ ...buildLiveCandidate(), slopeDiv: tamperedSlopeDiv });
    expect(failures).toContain('probe:slopediv_with_zero_denominator_returns_SLOPERANGE');
  });

  test('detects a candidate with a finetangent length that does not match FINEANGLES / 2', () => {
    const tamperedFinetangent = new Int32Array(finetangent.length + 1);
    tamperedFinetangent.set(finetangent);
    const failures = crossCheckTrigLookupTables({ ...buildLiveCandidate(), finetangent: tamperedFinetangent });
    expect(failures).toContain('invariant:FINETANGENT_LENGTH_MATCHES_FINEANGLES_HALF');
    expect(failures).toContain('invariant:TABLE_BUFFER_HASHES_MATCH_AUDITED_FINGERPRINTS');
  });
});

describe('audit-trig-lookup-tables sha256OfTypedArray helper', () => {
  test('produces a stable 64-character hex string for a known input', () => {
    const buffer = new Int32Array([0, 0, 0, 0]);
    const hash = sha256OfTypedArray(buffer);
    expect(hash.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  test('produces different hashes for different inputs of the same length', () => {
    const buffer1 = new Int32Array([1, 0, 0, 0]);
    const buffer2 = new Int32Array([0, 1, 0, 0]);
    expect(sha256OfTypedArray(buffer1)).not.toBe(sha256OfTypedArray(buffer2));
  });
});

describe('audit-trig-lookup-tables step file', () => {
  test('declares the core lane and the audit write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-005-audit-trig-lookup-tables.md').text();
    expect(stepText).toContain('## lane\n\ncore');
    expect(stepText).toContain('- src/core/audit-trig-lookup-tables.ts');
    expect(stepText).toContain('- test/vanilla_parity/core/audit-trig-lookup-tables.test.ts');
  });

  test('lists m_fixed.c, tables.c, d_main.c, and g_game.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-005-audit-trig-lookup-tables.md').text();
    expect(stepText).toContain('- m_fixed.c');
    expect(stepText).toContain('- tables.c');
    expect(stepText).toContain('- d_main.c');
    expect(stepText).toContain('- g_game.c');
  });

  test('declares 00-018 as the prerequisite', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-005-audit-trig-lookup-tables.md').text();
    expect(stepText).toContain('## prerequisites\n\n- 00-018');
  });
});
