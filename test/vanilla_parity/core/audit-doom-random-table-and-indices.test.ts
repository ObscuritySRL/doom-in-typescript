import { describe, expect, test } from 'bun:test';

import {
  AUDITED_RNDTABLE_DISTINCT_VALUE_COUNT,
  AUDITED_RNDTABLE_FIRST_ENTRY,
  AUDITED_RNDTABLE_LAST_ENTRY,
  AUDITED_RNDTABLE_LENGTH,
  AUDITED_RNDTABLE_SECOND_ENTRY,
  AUDITED_RNDTABLE_SHA256,
  AUDITED_RNDTABLE_SUM,
  AUDITED_RNDTABLE_UNIQUE_255_INDEX,
  AUDITED_RNDTABLE_ZERO_INDICES,
  AUDITED_RNG_INDEX_INITIAL_VALUE,
  AUDITED_RNG_INDEX_WRAP_MASK,
  DOOM_RANDOM_AUDIT,
  DOOM_RANDOM_INVARIANTS,
  DOOM_RANDOM_PROBES,
  crossCheckDoomRandom,
  sha256OfBytes,
} from '../../../src/core/audit-doom-random-table-and-indices.ts';
import type { DoomRandomCandidate, DoomRandomFactId, DoomRandomInvariantId, DoomRandomProbeId } from '../../../src/core/audit-doom-random-table-and-indices.ts';
import { DoomRandom, RNG_TABLE } from '../../../src/core/rng.ts';

const ALL_FACT_IDS: Set<DoomRandomFactId> = new Set([
  'C_HEADER_DECLARE_RNDTABLE_LENGTH_AND_TYPE',
  'C_HEADER_DECLARE_RNDINDEX_INITIAL_VALUE',
  'C_HEADER_DECLARE_PRNDINDEX_INITIAL_VALUE',
  'C_BODY_RNDTABLE_LITERAL_FIRST_ENTRY',
  'C_BODY_RNDTABLE_LITERAL_SECOND_ENTRY',
  'C_BODY_RNDTABLE_LITERAL_LAST_ENTRY',
  'C_BODY_P_RANDOM_PRE_INCREMENT_AND_MASK',
  'C_BODY_M_RANDOM_PRE_INCREMENT_AND_MASK',
  'C_BODY_M_CLEAR_RANDOM_RESETS_BOTH_TO_ZERO',
  'C_BODY_P_RANDOM_RETURN_TYPE_INT_FROM_UNSIGNED_CHAR',
]);

const ALL_INVARIANT_IDS: Set<DoomRandomInvariantId> = new Set([
  'RNDTABLE_LENGTH_IS_256',
  'RNDTABLE_VALUES_ALL_IN_BYTE_RANGE',
  'RNDTABLE_FIRST_ENTRY_IS_ZERO',
  'RNDTABLE_LAST_ENTRY_IS_249',
  'RNDTABLE_UNIQUE_255_AT_INDEX_158',
  'RNDTABLE_TWO_ZERO_ENTRIES_AT_INDICES_0_AND_83',
  'RNDTABLE_SUM_IS_32986',
  'RNDTABLE_DISTINCT_VALUE_COUNT_IS_166',
  'P_RANDOM_FIRST_VALUE_AFTER_CLEAR_IS_8',
  'M_RANDOM_FIRST_VALUE_AFTER_CLEAR_IS_8',
  'P_RANDOM_FULL_CYCLE_RETURNS_INDEX_TO_ZERO',
  'P_RANDOM_AND_M_RANDOM_STREAMS_INDEPENDENT',
  'CLEAR_RANDOM_RESETS_BOTH_INDICES_TO_ZERO',
  'P_SUB_RANDOM_FIRST_VALUE_AFTER_CLEAR_IS_NEGATIVE_101',
  'P_SUB_RANDOM_CONSUMES_TWO_P_RANDOM_VALUES',
  'RNDTABLE_BUFFER_HASH_MATCHES_AUDITED_FINGERPRINT',
]);

const ALL_PROBE_IDS: Set<DoomRandomProbeId> = new Set([
  'rndtable_index_0_is_zero',
  'rndtable_index_1_is_8',
  'rndtable_index_2_is_109',
  'rndtable_index_83_is_zero',
  'rndtable_index_100_is_20',
  'rndtable_index_128_is_11',
  'rndtable_index_158_is_255',
  'rndtable_index_200_is_125',
  'rndtable_index_255_is_249',
  'fresh_p_random_first_call_returns_8',
  'fresh_p_random_second_call_returns_109',
  'fresh_p_random_third_call_returns_220',
  'fresh_m_random_first_call_returns_8',
  'fresh_p_sub_random_first_call_returns_neg_101',
  'fresh_p_random_after_full_cycle_returns_8',
  'fresh_p_random_after_partial_cycle_then_clear_returns_8',
]);

function liveRndtableBytes(): Uint8Array {
  const bytes = new Uint8Array(RNG_TABLE.length);
  for (let i = 0; i < RNG_TABLE.length; i++) bytes[i] = RNG_TABLE[i] ?? 0;
  return bytes;
}

function buildLiveCandidate(): DoomRandomCandidate {
  return {
    rndtable: liveRndtableBytes(),
    create: () => new DoomRandom(),
  };
}

describe('audit-doom-random-table-and-indices audited canonical constants', () => {
  test('AUDITED_RNDTABLE_LENGTH is exactly 256 (one cell per `& 0xff` index)', () => {
    expect(AUDITED_RNDTABLE_LENGTH).toBe(256);
  });

  test('AUDITED_RNDTABLE_FIRST_ENTRY is exactly 0 (rndtable[0])', () => {
    expect(AUDITED_RNDTABLE_FIRST_ENTRY).toBe(0);
  });

  test('AUDITED_RNDTABLE_SECOND_ENTRY is exactly 8 (the first roll after clearRandom)', () => {
    expect(AUDITED_RNDTABLE_SECOND_ENTRY).toBe(8);
  });

  test('AUDITED_RNDTABLE_LAST_ENTRY is exactly 249 (rndtable[255])', () => {
    expect(AUDITED_RNDTABLE_LAST_ENTRY).toBe(249);
  });

  test('AUDITED_RNDTABLE_UNIQUE_255_INDEX is exactly 158', () => {
    expect(AUDITED_RNDTABLE_UNIQUE_255_INDEX).toBe(158);
  });

  test('AUDITED_RNDTABLE_ZERO_INDICES are exactly [0, 83]', () => {
    expect(AUDITED_RNDTABLE_ZERO_INDICES).toEqual([0, 83]);
  });

  test('AUDITED_RNDTABLE_SUM is exactly 32986', () => {
    expect(AUDITED_RNDTABLE_SUM).toBe(32_986);
  });

  test('AUDITED_RNDTABLE_DISTINCT_VALUE_COUNT is exactly 166', () => {
    expect(AUDITED_RNDTABLE_DISTINCT_VALUE_COUNT).toBe(166);
  });

  test('AUDITED_RNG_INDEX_INITIAL_VALUE is exactly 0', () => {
    expect(AUDITED_RNG_INDEX_INITIAL_VALUE).toBe(0);
  });

  test('AUDITED_RNG_INDEX_WRAP_MASK is exactly 0xff', () => {
    expect(AUDITED_RNG_INDEX_WRAP_MASK).toBe(0xff);
  });

  test('AUDITED_RNDTABLE_SHA256 is the canonical 64-character hex fingerprint', () => {
    expect(AUDITED_RNDTABLE_SHA256.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(AUDITED_RNDTABLE_SHA256)).toBe(true);
    expect(AUDITED_RNDTABLE_SHA256).toBe('908b529108dcbcd3fe82907cd646e08b12404a893eda2165fe58dadd709a413f');
  });
});

describe('audit-doom-random-table-and-indices fact ledger shape', () => {
  test('audits exactly ten facts — three c-header, seven c-body', () => {
    expect(DOOM_RANDOM_AUDIT.length).toBe(10);
    const cHeader = DOOM_RANDOM_AUDIT.filter((fact) => fact.category === 'c-header');
    const cBody = DOOM_RANDOM_AUDIT.filter((fact) => fact.category === 'c-body');
    expect(cHeader.length).toBe(3);
    expect(cBody.length).toBe(7);
  });

  test('every fact id is unique', () => {
    const ids = DOOM_RANDOM_AUDIT.map((fact) => fact.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every fact id from the canonical set exactly once', () => {
    const ids = new Set(DOOM_RANDOM_AUDIT.map((fact) => fact.id));
    expect(ids).toEqual(ALL_FACT_IDS);
  });

  test('every fact carries a non-empty description and cReference', () => {
    for (const fact of DOOM_RANDOM_AUDIT) {
      expect(fact.description.length).toBeGreaterThan(0);
      expect(fact.cReference.length).toBeGreaterThan(0);
    }
  });

  test('every fact references linuxdoom-1.10/m_random.c', () => {
    for (const fact of DOOM_RANDOM_AUDIT) {
      expect(fact.referenceSourceFile).toBe('linuxdoom-1.10/m_random.c');
    }
  });
});

describe('audit-doom-random-table-and-indices fact ledger values', () => {
  test('C_HEADER_DECLARE_RNDTABLE_LENGTH_AND_TYPE pins the exact unsigned char + 256 declaration', () => {
    const fact = DOOM_RANDOM_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DECLARE_RNDTABLE_LENGTH_AND_TYPE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('unsigned char rndtable[256]');
  });

  test('C_HEADER_DECLARE_RNDINDEX_INITIAL_VALUE pins `int rndindex = 0`', () => {
    const fact = DOOM_RANDOM_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DECLARE_RNDINDEX_INITIAL_VALUE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('int rndindex = 0;');
  });

  test('C_HEADER_DECLARE_PRNDINDEX_INITIAL_VALUE pins `int prndindex = 0`', () => {
    const fact = DOOM_RANDOM_AUDIT.find((candidate) => candidate.id === 'C_HEADER_DECLARE_PRNDINDEX_INITIAL_VALUE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('int prndindex = 0;');
  });

  test('C_BODY_RNDTABLE_LITERAL_FIRST_ENTRY pins the array literal opening with 0, 8, 109', () => {
    const fact = DOOM_RANDOM_AUDIT.find((candidate) => candidate.id === 'C_BODY_RNDTABLE_LITERAL_FIRST_ENTRY');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('{ 0, 8, 109,');
  });

  test('C_BODY_RNDTABLE_LITERAL_SECOND_ENTRY anchors the pre-increment "first roll = 8" sentinel', () => {
    const fact = DOOM_RANDOM_AUDIT.find((candidate) => candidate.id === 'C_BODY_RNDTABLE_LITERAL_SECOND_ENTRY');
    expect(fact).toBeDefined();
    expect(fact?.description).toContain('rndtable[1] = 8');
  });

  test('C_BODY_RNDTABLE_LITERAL_LAST_ENTRY pins the array literal closing with `120, 163, 236, 249`', () => {
    const fact = DOOM_RANDOM_AUDIT.find((candidate) => candidate.id === 'C_BODY_RNDTABLE_LITERAL_LAST_ENTRY');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('120, 163, 236, 249');
  });

  test('C_BODY_P_RANDOM_PRE_INCREMENT_AND_MASK pins the canonical two-statement body of P_Random', () => {
    const fact = DOOM_RANDOM_AUDIT.find((candidate) => candidate.id === 'C_BODY_P_RANDOM_PRE_INCREMENT_AND_MASK');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('prndindex = (prndindex+1)&0xff;');
    expect(fact?.cReference).toContain('return rndtable[prndindex];');
  });

  test('C_BODY_M_RANDOM_PRE_INCREMENT_AND_MASK pins the canonical two-statement body of M_Random', () => {
    const fact = DOOM_RANDOM_AUDIT.find((candidate) => candidate.id === 'C_BODY_M_RANDOM_PRE_INCREMENT_AND_MASK');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('rndindex = (rndindex+1)&0xff;');
    expect(fact?.cReference).toContain('return rndtable[rndindex];');
  });

  test('C_BODY_M_CLEAR_RANDOM_RESETS_BOTH_TO_ZERO pins `rndindex = prndindex = 0;` (id Software 1.10, NOT Chocolate Doom 2.2.1 time-seeded variant)', () => {
    const fact = DOOM_RANDOM_AUDIT.find((candidate) => candidate.id === 'C_BODY_M_CLEAR_RANDOM_RESETS_BOTH_TO_ZERO');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('rndindex = prndindex = 0;');
    expect(fact?.description).toContain('NOT in scope');
  });

  test('C_BODY_P_RANDOM_RETURN_TYPE_INT_FROM_UNSIGNED_CHAR pins the integer-promotion return contract', () => {
    const fact = DOOM_RANDOM_AUDIT.find((candidate) => candidate.id === 'C_BODY_P_RANDOM_RETURN_TYPE_INT_FROM_UNSIGNED_CHAR');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('int P_Random');
  });
});

describe('audit-doom-random-table-and-indices invariant ledger shape', () => {
  test('lists exactly sixteen operational invariants', () => {
    expect(DOOM_RANDOM_INVARIANTS.length).toBe(16);
  });

  test('every invariant id is unique', () => {
    const ids = DOOM_RANDOM_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every invariant id from the canonical set exactly once', () => {
    const ids = new Set(DOOM_RANDOM_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(ALL_INVARIANT_IDS);
  });

  test('every invariant carries a non-empty description', () => {
    for (const invariant of DOOM_RANDOM_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('audit-doom-random-table-and-indices probe ledger shape', () => {
  test('declares exactly sixteen probes', () => {
    expect(DOOM_RANDOM_PROBES.length).toBe(16);
  });

  test('every probe id is unique', () => {
    const ids = DOOM_RANDOM_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every probe id from the canonical set exactly once', () => {
    const ids = new Set(DOOM_RANDOM_PROBES.map((probe) => probe.id));
    expect(ids).toEqual(ALL_PROBE_IDS);
  });

  test('every probe carries a non-empty note', () => {
    for (const probe of DOOM_RANDOM_PROBES) {
      expect(probe.note.length).toBeGreaterThan(0);
    }
  });

  test('covers every probe target at least once', () => {
    const targets = new Set(DOOM_RANDOM_PROBES.map((probe) => probe.target));
    expect(targets).toEqual(new Set(['rndtable', 'p_random_sequence', 'm_random_sequence', 'p_sub_random_sequence']));
  });
});

describe('audit-doom-random-table-and-indices sha256 fingerprint matches the live runtime table', () => {
  test('rndtable byte buffer hash matches AUDITED_RNDTABLE_SHA256', () => {
    expect(sha256OfBytes(liveRndtableBytes())).toBe(AUDITED_RNDTABLE_SHA256);
  });
});

describe('audit-doom-random-table-and-indices runtime probe values', () => {
  test('every rndtable cell probe maps to its expected output on the live runtime table', () => {
    for (const probe of DOOM_RANDOM_PROBES) {
      if (probe.target !== 'rndtable') continue;
      const index = probe.input as number;
      expect(RNG_TABLE[index]).toBe(probe.expected);
    }
  });

  test('every stream-sequence probe matches the live DoomRandom class', () => {
    for (const probe of DOOM_RANDOM_PROBES) {
      if (probe.target === 'rndtable') continue;
      const spec = probe.input as { readonly setupPRandomCalls?: number; readonly setupMRandomCalls?: number; readonly clearAfterSetup?: boolean; readonly observation: 'pRandom' | 'mRandom' | 'pSubRandom' };
      const instance = new DoomRandom();
      for (let i = 0; i < (spec.setupPRandomCalls ?? 0); i++) instance.pRandom();
      for (let i = 0; i < (spec.setupMRandomCalls ?? 0); i++) instance.mRandom();
      if (spec.clearAfterSetup === true) instance.clearRandom();
      let actual: number;
      if (spec.observation === 'pRandom') actual = instance.pRandom();
      else if (spec.observation === 'mRandom') actual = instance.mRandom();
      else actual = instance.pSubRandom();
      expect(actual).toBe(probe.expected);
    }
  });
});

describe('audit-doom-random-table-and-indices runtime invariants — table layout', () => {
  test('RNG_TABLE.length is exactly 256', () => {
    expect(RNG_TABLE.length).toBe(AUDITED_RNDTABLE_LENGTH);
  });

  test('every RNG_TABLE entry is an integer in [0, 255]', () => {
    for (let i = 0; i < RNG_TABLE.length; i++) {
      const value = RNG_TABLE[i] ?? Number.NaN;
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(255);
    }
  });

  test('RNG_TABLE[0] === 0 (canonical first entry)', () => {
    expect(RNG_TABLE[0]).toBe(AUDITED_RNDTABLE_FIRST_ENTRY);
  });

  test('RNG_TABLE[1] === 8 (canonical first roll after clearRandom)', () => {
    expect(RNG_TABLE[1]).toBe(AUDITED_RNDTABLE_SECOND_ENTRY);
  });

  test('RNG_TABLE[255] === 249 (canonical last entry)', () => {
    expect(RNG_TABLE[255]).toBe(AUDITED_RNDTABLE_LAST_ENTRY);
  });

  test('RNG_TABLE has exactly two entries equal to 0, at indices 0 and 83', () => {
    let count = 0;
    const positions: number[] = [];
    for (let i = 0; i < RNG_TABLE.length; i++) {
      if (RNG_TABLE[i] === 0) {
        count++;
        positions.push(i);
      }
    }
    expect(count).toBe(2);
    expect(positions).toEqual([...AUDITED_RNDTABLE_ZERO_INDICES]);
  });

  test('RNG_TABLE has exactly one entry equal to 255, at index 158', () => {
    let count = 0;
    let position = -1;
    for (let i = 0; i < RNG_TABLE.length; i++) {
      if (RNG_TABLE[i] === 255) {
        count++;
        position = i;
      }
    }
    expect(count).toBe(1);
    expect(position).toBe(AUDITED_RNDTABLE_UNIQUE_255_INDEX);
  });

  test('sum of RNG_TABLE entries is exactly 32986', () => {
    let sum = 0;
    for (let i = 0; i < RNG_TABLE.length; i++) sum += RNG_TABLE[i] ?? 0;
    expect(sum).toBe(AUDITED_RNDTABLE_SUM);
  });

  test('RNG_TABLE has exactly 166 distinct values (NOT a permutation of 0..255)', () => {
    const distinct = new Set<number>();
    for (let i = 0; i < RNG_TABLE.length; i++) {
      const value = RNG_TABLE[i];
      if (value !== undefined) distinct.add(value);
    }
    expect(distinct.size).toBe(AUDITED_RNDTABLE_DISTINCT_VALUE_COUNT);
  });
});

describe('audit-doom-random-table-and-indices runtime invariants — index machinery', () => {
  test('a fresh DoomRandom instance has prndindex === 0 and rndindex === 0', () => {
    const rng = new DoomRandom();
    expect(rng.prndindex).toBe(AUDITED_RNG_INDEX_INITIAL_VALUE);
    expect(rng.rndindex).toBe(AUDITED_RNG_INDEX_INITIAL_VALUE);
  });

  test('first pRandom() returns rndtable[1] === 8 (pre-increment)', () => {
    const rng = new DoomRandom();
    expect(rng.pRandom()).toBe(AUDITED_RNDTABLE_SECOND_ENTRY);
  });

  test('first mRandom() returns rndtable[1] === 8 (pre-increment, mirrors P_Random)', () => {
    const rng = new DoomRandom();
    expect(rng.mRandom()).toBe(AUDITED_RNDTABLE_SECOND_ENTRY);
  });

  test('256 consecutive pRandom() calls wrap prndindex back to 0 (`& 0xff` mask)', () => {
    const rng = new DoomRandom();
    for (let i = 0; i < 256; i++) rng.pRandom();
    expect(rng.prndindex).toBe(0);
  });

  test('the 257th consecutive pRandom() call again returns rndtable[1] === 8', () => {
    const rng = new DoomRandom();
    for (let i = 0; i < 256; i++) rng.pRandom();
    expect(rng.pRandom()).toBe(AUDITED_RNDTABLE_SECOND_ENTRY);
  });

  test('pRandom does not advance rndindex (stream independence)', () => {
    const rng = new DoomRandom();
    for (let i = 0; i < 50; i++) rng.pRandom();
    expect(rng.rndindex).toBe(0);
  });

  test('mRandom does not advance prndindex (stream independence)', () => {
    const rng = new DoomRandom();
    for (let i = 0; i < 50; i++) rng.mRandom();
    expect(rng.prndindex).toBe(0);
  });

  test('clearRandom() resets BOTH indices to 0 (id Software 1.10 canonical, NOT Chocolate Doom time-seeded variant)', () => {
    const rng = new DoomRandom();
    for (let i = 0; i < 50; i++) rng.pRandom();
    for (let i = 0; i < 50; i++) rng.mRandom();
    expect(rng.prndindex).toBe(50);
    expect(rng.rndindex).toBe(50);
    rng.clearRandom();
    expect(rng.prndindex).toBe(0);
    expect(rng.rndindex).toBe(0);
  });

  test('after clearRandom() the next pRandom() returns rndtable[1] === 8 again', () => {
    const rng = new DoomRandom();
    for (let i = 0; i < 100; i++) rng.pRandom();
    rng.clearRandom();
    expect(rng.pRandom()).toBe(AUDITED_RNDTABLE_SECOND_ENTRY);
  });

  test('pSubRandom() returns rndtable[1] - rndtable[2] === -101 from a fresh state', () => {
    const rng = new DoomRandom();
    expect(rng.pSubRandom()).toBe(AUDITED_RNDTABLE_SECOND_ENTRY - 109);
    expect(AUDITED_RNDTABLE_SECOND_ENTRY - 109).toBe(-101);
  });

  test('pSubRandom() advances prndindex by exactly 2', () => {
    const rng = new DoomRandom();
    rng.pSubRandom();
    expect(rng.prndindex).toBe(2);
    expect(rng.pRandom()).toBe(RNG_TABLE[3]);
  });

  test('pSubRandom() does NOT advance rndindex', () => {
    const rng = new DoomRandom();
    rng.pSubRandom();
    expect(rng.rndindex).toBe(0);
  });

  test('two fresh DoomRandom instances produce identical pRandom sequences over a full cycle', () => {
    const a = new DoomRandom();
    const b = new DoomRandom();
    for (let i = 0; i < 256; i++) {
      expect(a.pRandom()).toBe(b.pRandom());
    }
  });

  test('two fresh DoomRandom instances produce identical mRandom sequences over a full cycle', () => {
    const a = new DoomRandom();
    const b = new DoomRandom();
    for (let i = 0; i < 256; i++) {
      expect(a.mRandom()).toBe(b.mRandom());
    }
  });

  test('the index wrap mask is exactly `& 0xff`, not modulo length — the next call after 255 calls lands at index 0 then pre-increments to 1', () => {
    const rng = new DoomRandom();
    for (let i = 0; i < 255; i++) rng.pRandom();
    expect(rng.prndindex).toBe(255);
    rng.pRandom();
    expect(rng.prndindex).toBe(0);
    rng.pRandom();
    expect(rng.prndindex).toBe(1);
  });
});

describe('crossCheckDoomRandom on the live runtime table and class', () => {
  test('reports zero failures', () => {
    expect(crossCheckDoomRandom(buildLiveCandidate())).toEqual([]);
  });
});

describe('crossCheckDoomRandom failure modes — tampered candidates', () => {
  test('detects a candidate where rndtable[0] is not zero', () => {
    const tampered = liveRndtableBytes();
    tampered[0] = 1;
    const failures = crossCheckDoomRandom({ ...buildLiveCandidate(), rndtable: tampered });
    expect(failures).toContain('probe:rndtable_index_0_is_zero');
    expect(failures).toContain('invariant:RNDTABLE_FIRST_ENTRY_IS_ZERO');
    expect(failures).toContain('invariant:RNDTABLE_TWO_ZERO_ENTRIES_AT_INDICES_0_AND_83');
    expect(failures).toContain('invariant:RNDTABLE_BUFFER_HASH_MATCHES_AUDITED_FINGERPRINT');
  });

  test('detects a candidate where rndtable[1] is not 8', () => {
    const tampered = liveRndtableBytes();
    tampered[1] = 7;
    const failures = crossCheckDoomRandom({ ...buildLiveCandidate(), rndtable: tampered });
    expect(failures).toContain('probe:rndtable_index_1_is_8');
    expect(failures).toContain('invariant:RNDTABLE_BUFFER_HASH_MATCHES_AUDITED_FINGERPRINT');
  });

  test('detects a candidate where rndtable[255] is not 249', () => {
    const tampered = liveRndtableBytes();
    tampered[255] = 250;
    const failures = crossCheckDoomRandom({ ...buildLiveCandidate(), rndtable: tampered });
    expect(failures).toContain('probe:rndtable_index_255_is_249');
    expect(failures).toContain('invariant:RNDTABLE_LAST_ENTRY_IS_249');
    expect(failures).toContain('invariant:RNDTABLE_BUFFER_HASH_MATCHES_AUDITED_FINGERPRINT');
  });

  test('detects a candidate where the unique 255 cell is shifted to a different index', () => {
    const tampered = liveRndtableBytes();
    // Move the 255 from index 158 to index 100 (which currently holds 20).
    tampered[158] = 20;
    tampered[100] = 255;
    const failures = crossCheckDoomRandom({ ...buildLiveCandidate(), rndtable: tampered });
    expect(failures).toContain('invariant:RNDTABLE_UNIQUE_255_AT_INDEX_158');
    expect(failures).toContain('invariant:RNDTABLE_BUFFER_HASH_MATCHES_AUDITED_FINGERPRINT');
  });

  test('detects a candidate where the second zero (at index 83) is replaced', () => {
    const tampered = liveRndtableBytes();
    tampered[83] = 1;
    const failures = crossCheckDoomRandom({ ...buildLiveCandidate(), rndtable: tampered });
    expect(failures).toContain('probe:rndtable_index_83_is_zero');
    expect(failures).toContain('invariant:RNDTABLE_TWO_ZERO_ENTRIES_AT_INDICES_0_AND_83');
    expect(failures).toContain('invariant:RNDTABLE_BUFFER_HASH_MATCHES_AUDITED_FINGERPRINT');
  });

  test('detects a candidate where one cell drifts by +1 (sum-defence sentinel)', () => {
    const tampered = liveRndtableBytes();
    // Bump a "boring" mid-table cell by 1; the cell value isn't a probe target,
    // but the sum and fingerprint must catch the drift.
    tampered[200] = ((tampered[200] ?? 0) + 1) & 0xff;
    const failures = crossCheckDoomRandom({ ...buildLiveCandidate(), rndtable: tampered });
    expect(failures).toContain('invariant:RNDTABLE_SUM_IS_32986');
    expect(failures).toContain('invariant:RNDTABLE_BUFFER_HASH_MATCHES_AUDITED_FINGERPRINT');
  });

  test('detects a candidate where the table has been replaced by a permutation of 0..255', () => {
    const tampered = new Uint8Array(256);
    for (let i = 0; i < 256; i++) tampered[i] = i;
    const failures = crossCheckDoomRandom({ ...buildLiveCandidate(), rndtable: tampered });
    expect(failures).toContain('invariant:RNDTABLE_DISTINCT_VALUE_COUNT_IS_166');
    expect(failures).toContain('invariant:RNDTABLE_SUM_IS_32986');
    expect(failures).toContain('invariant:RNDTABLE_BUFFER_HASH_MATCHES_AUDITED_FINGERPRINT');
  });

  test('detects a candidate where pRandom uses post-increment (returns rndtable[0] = 0 first)', () => {
    const candidate: DoomRandomCandidate = {
      rndtable: liveRndtableBytes(),
      create: () => {
        let prnd = 0;
        let rnd = 0;
        return {
          pRandom(): number {
            const value = RNG_TABLE[prnd] ?? 0;
            prnd = (prnd + 1) & 0xff;
            return value;
          },
          mRandom(): number {
            const value = RNG_TABLE[rnd] ?? 0;
            rnd = (rnd + 1) & 0xff;
            return value;
          },
          pSubRandom(): number {
            const a = RNG_TABLE[prnd] ?? 0;
            prnd = (prnd + 1) & 0xff;
            const b = RNG_TABLE[prnd] ?? 0;
            prnd = (prnd + 1) & 0xff;
            return a - b;
          },
          clearRandom(): void {
            prnd = 0;
            rnd = 0;
          },
        };
      },
    };
    const failures = crossCheckDoomRandom(candidate);
    expect(failures).toContain('probe:fresh_p_random_first_call_returns_8');
    expect(failures).toContain('invariant:P_RANDOM_FIRST_VALUE_AFTER_CLEAR_IS_8');
  });

  test('detects a candidate where clearRandom only resets prndindex (Chocolate Doom time-seeded variant)', () => {
    const candidate: DoomRandomCandidate = {
      rndtable: liveRndtableBytes(),
      create: () => {
        let prnd = 0;
        let rnd = 0;
        return {
          pRandom(): number {
            prnd = (prnd + 1) & 0xff;
            return RNG_TABLE[prnd] ?? 0;
          },
          mRandom(): number {
            rnd = (rnd + 1) & 0xff;
            return RNG_TABLE[rnd] ?? 0;
          },
          pSubRandom(): number {
            prnd = (prnd + 1) & 0xff;
            const a = RNG_TABLE[prnd] ?? 0;
            prnd = (prnd + 1) & 0xff;
            const b = RNG_TABLE[prnd] ?? 0;
            return a - b;
          },
          clearRandom(): void {
            // Tamper: only reset prndindex; rndindex keeps walking.
            prnd = 0;
          },
        };
      },
    };
    const failures = crossCheckDoomRandom(candidate);
    expect(failures).toContain('invariant:CLEAR_RANDOM_RESETS_BOTH_INDICES_TO_ZERO');
  });

  test('detects a candidate where pSubRandom swaps the subtraction order (returns +101 not -101)', () => {
    const candidate: DoomRandomCandidate = {
      rndtable: liveRndtableBytes(),
      create: () => {
        let prnd = 0;
        let rnd = 0;
        return {
          pRandom(): number {
            prnd = (prnd + 1) & 0xff;
            return RNG_TABLE[prnd] ?? 0;
          },
          mRandom(): number {
            rnd = (rnd + 1) & 0xff;
            return RNG_TABLE[rnd] ?? 0;
          },
          pSubRandom(): number {
            // Tamper: swap the subtraction order.
            prnd = (prnd + 1) & 0xff;
            const a = RNG_TABLE[prnd] ?? 0;
            prnd = (prnd + 1) & 0xff;
            const b = RNG_TABLE[prnd] ?? 0;
            return b - a;
          },
          clearRandom(): void {
            prnd = 0;
            rnd = 0;
          },
        };
      },
    };
    const failures = crossCheckDoomRandom(candidate);
    expect(failures).toContain('probe:fresh_p_sub_random_first_call_returns_neg_101');
    expect(failures).toContain('invariant:P_SUB_RANDOM_FIRST_VALUE_AFTER_CLEAR_IS_NEGATIVE_101');
  });

  test('detects a candidate where pSubRandom only consumes one P_Random value', () => {
    const candidate: DoomRandomCandidate = {
      rndtable: liveRndtableBytes(),
      create: () => {
        let prnd = 0;
        let rnd = 0;
        return {
          pRandom(): number {
            prnd = (prnd + 1) & 0xff;
            return RNG_TABLE[prnd] ?? 0;
          },
          mRandom(): number {
            rnd = (rnd + 1) & 0xff;
            return RNG_TABLE[rnd] ?? 0;
          },
          pSubRandom(): number {
            // Tamper: only consume one P_Random value.
            prnd = (prnd + 1) & 0xff;
            return (RNG_TABLE[prnd] ?? 0) - 109;
          },
          clearRandom(): void {
            prnd = 0;
            rnd = 0;
          },
        };
      },
    };
    const failures = crossCheckDoomRandom(candidate);
    expect(failures).toContain('invariant:P_SUB_RANDOM_CONSUMES_TWO_P_RANDOM_VALUES');
  });

  test('detects a candidate where pRandom and mRandom share a single index (stream entanglement)', () => {
    const candidate: DoomRandomCandidate = {
      rndtable: liveRndtableBytes(),
      create: () => {
        let shared = 0;
        return {
          pRandom(): number {
            shared = (shared + 1) & 0xff;
            return RNG_TABLE[shared] ?? 0;
          },
          mRandom(): number {
            shared = (shared + 1) & 0xff;
            return RNG_TABLE[shared] ?? 0;
          },
          pSubRandom(): number {
            shared = (shared + 1) & 0xff;
            const a = RNG_TABLE[shared] ?? 0;
            shared = (shared + 1) & 0xff;
            const b = RNG_TABLE[shared] ?? 0;
            return a - b;
          },
          clearRandom(): void {
            shared = 0;
          },
        };
      },
    };
    const failures = crossCheckDoomRandom(candidate);
    expect(failures).toContain('invariant:P_RANDOM_AND_M_RANDOM_STREAMS_INDEPENDENT');
  });

  test('detects a candidate whose table buffer hash does not match the audited fingerprint', () => {
    const tampered = liveRndtableBytes();
    // Swap two cells; sum stays equal, but hash and probe expectations diverge.
    const a = tampered[5] ?? 0;
    const b = tampered[6] ?? 0;
    tampered[5] = b;
    tampered[6] = a;
    const failures = crossCheckDoomRandom({ ...buildLiveCandidate(), rndtable: tampered });
    expect(failures).toContain('invariant:RNDTABLE_BUFFER_HASH_MATCHES_AUDITED_FINGERPRINT');
  });
});

describe('audit-doom-random-table-and-indices sha256OfBytes helper', () => {
  test('produces a stable 64-character hex string for a known input', () => {
    const buffer = new Uint8Array([0, 0, 0, 0]);
    const hash = sha256OfBytes(buffer);
    expect(hash.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  test('produces different hashes for different inputs of the same length', () => {
    const buffer1 = new Uint8Array([1, 0, 0, 0]);
    const buffer2 = new Uint8Array([0, 1, 0, 0]);
    expect(sha256OfBytes(buffer1)).not.toBe(sha256OfBytes(buffer2));
  });
});

describe('audit-doom-random-table-and-indices step file', () => {
  test('declares the core lane and the audit write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-007-audit-doom-random-table-and-indices.md').text();
    expect(stepText).toContain('## lane\n\ncore');
    expect(stepText).toContain('- src/core/audit-doom-random-table-and-indices.ts');
    expect(stepText).toContain('- test/vanilla_parity/core/audit-doom-random-table-and-indices.test.ts');
  });

  test('lists m_fixed.c, tables.c, d_main.c, and g_game.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-007-audit-doom-random-table-and-indices.md').text();
    expect(stepText).toContain('- m_fixed.c');
    expect(stepText).toContain('- tables.c');
    expect(stepText).toContain('- d_main.c');
    expect(stepText).toContain('- g_game.c');
  });

  test('declares 00-018 as the prerequisite', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-007-audit-doom-random-table-and-indices.md').text();
    expect(stepText).toContain('## prerequisites\n\n- 00-018');
  });
});
