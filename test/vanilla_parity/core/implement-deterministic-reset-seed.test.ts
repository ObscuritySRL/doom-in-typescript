import { describe, expect, test } from 'bun:test';

import {
  AUDITED_RESET_CALL_SITE_COUNT,
  AUDITED_RESET_CALL_SITE_FILE,
  AUDITED_RESET_CALL_SITE_FUNCTION,
  AUDITED_RESET_FIRST_M_RANDOM_VALUE,
  AUDITED_RESET_FIRST_P_RANDOM_VALUE,
  AUDITED_RESET_FIRST_P_SUB_RANDOM_VALUE,
  AUDITED_RESET_PRNDINDEX_VALUE,
  AUDITED_RESET_RNDINDEX_VALUE,
  DOOM_RESET_SEED_AUDIT,
  DOOM_RESET_SEED_INVARIANTS,
  DOOM_RESET_SEED_PROBES,
  crossCheckDoomResetSeed,
} from '../../../src/core/implement-deterministic-reset-seed.ts';
import type { DoomResetSeedCandidate, DoomResetSeedCandidateInstance, DoomResetSeedFactId, DoomResetSeedInvariantId, DoomResetSeedProbeId } from '../../../src/core/implement-deterministic-reset-seed.ts';
import { DoomRandom, RNG_TABLE } from '../../../src/core/rng.ts';

const ALL_FACT_IDS: Set<DoomResetSeedFactId> = new Set([
  'C_BODY_M_CLEAR_RANDOM_CHAINED_ASSIGNMENT_BOTH_INDICES_ZERO',
  'C_BODY_M_CLEAR_RANDOM_NO_TIME_SEED_IN_VANILLA',
  'C_BODY_M_CLEAR_RANDOM_RETURN_TYPE_VOID',
  'C_HEADER_M_CLEAR_RANDOM_PROTOTYPE_VOID_VOID',
  'C_BODY_G_INIT_NEW_CALLS_M_CLEAR_RANDOM_AFTER_MAP_VALIDATION',
  'C_BODY_M_CLEAR_RANDOM_HAS_EXACTLY_ONE_CALL_SITE',
  'C_HEADER_RNDINDEX_INITIAL_ZERO_MATCHES_RESET_POST_STATE',
  'C_HEADER_PRNDINDEX_INITIAL_ZERO_MATCHES_RESET_POST_STATE',
  'C_BODY_M_CLEAR_RANDOM_DOES_NOT_TOUCH_RNDTABLE',
  'C_BODY_M_CLEAR_RANDOM_IS_IDEMPOTENT',
]);

const ALL_INVARIANT_IDS: Set<DoomResetSeedInvariantId> = new Set([
  'RESET_PRNDINDEX_BECOMES_ZERO',
  'RESET_RNDINDEX_BECOMES_ZERO',
  'RESET_BOTH_INDICES_BECOME_ZERO_TOGETHER',
  'RESET_FIRST_P_RANDOM_RETURNS_RNDTABLE_ONE',
  'RESET_FIRST_M_RANDOM_RETURNS_RNDTABLE_ONE',
  'RESET_FIRST_P_SUB_RANDOM_RETURNS_NEGATIVE_101',
  'RESET_IS_IDEMPOTENT',
  'RESET_FROM_FRESH_INSTANCE_IS_NO_OP',
  'RESET_AFTER_PARTIAL_P_CYCLE_RESTORES_FRESH_STATE',
  'RESET_AFTER_PARTIAL_M_CYCLE_RESTORES_FRESH_STATE',
  'RESET_AFTER_FULL_P_CYCLE_RESTORES_FRESH_STATE',
  'RESET_AFTER_MIXED_PM_USE_RESTORES_FRESH_STATE',
  'RESET_DOES_NOT_DEPEND_ON_PRIOR_HISTORY',
  'RESET_PRESERVES_RNDTABLE_BYTES',
  'RESET_IS_DETERMINISTIC_ACROSS_RAPID_CALLS',
  'RESET_RETURNS_VOID_OR_UNDEFINED',
]);

const ALL_PROBE_IDS: Set<DoomResetSeedProbeId> = new Set([
  'reset_from_fresh_state_makes_p_random_emit_8',
  'reset_from_fresh_state_makes_m_random_emit_8',
  'reset_after_one_p_random_makes_next_p_random_emit_8',
  'reset_after_one_m_random_makes_next_m_random_emit_8',
  'reset_after_one_p_random_makes_first_m_random_emit_8',
  'reset_after_one_m_random_makes_first_p_random_emit_8',
  'reset_after_full_p_cycle_makes_next_p_random_emit_8',
  'reset_after_full_m_cycle_makes_next_m_random_emit_8',
  'reset_after_mixed_p_then_m_then_p_emits_8',
  'reset_then_p_sub_random_emits_negative_101',
  'double_reset_then_p_random_emits_8',
  'reset_after_one_hundred_p_random_makes_prndindex_zero',
  'reset_after_one_hundred_m_random_makes_rndindex_zero',
  'reset_after_partial_cycle_then_clear_again_emits_8',
  'reset_after_p_sub_random_makes_next_p_random_emit_8',
  'reset_clears_both_indices_simultaneously',
]);

function liveRndtableBytes(): Uint8Array {
  const bytes = new Uint8Array(RNG_TABLE.length);
  for (let i = 0; i < RNG_TABLE.length; i++) bytes[i] = RNG_TABLE[i] ?? 0;
  return bytes;
}

function buildLiveCandidate(): DoomResetSeedCandidate {
  return {
    rndtable: liveRndtableBytes(),
    create: (): DoomResetSeedCandidateInstance => {
      const rng = new DoomRandom();
      return {
        pRandom: () => rng.pRandom(),
        mRandom: () => rng.mRandom(),
        pSubRandom: () => rng.pSubRandom(),
        clearRandom: () => rng.clearRandom(),
        get prndindex(): number {
          return rng.prndindex;
        },
        get rndindex(): number {
          return rng.rndindex;
        },
      };
    },
  };
}

describe('implement-deterministic-reset-seed audited canonical constants', () => {
  test('AUDITED_RESET_PRNDINDEX_VALUE is exactly 0 (canonical post-reset gameplay-stream index)', () => {
    expect(AUDITED_RESET_PRNDINDEX_VALUE).toBe(0);
  });

  test('AUDITED_RESET_RNDINDEX_VALUE is exactly 0 (vanilla 1.9, NOT Chocolate Doom 2.2.1 time-seeded)', () => {
    expect(AUDITED_RESET_RNDINDEX_VALUE).toBe(0);
  });

  test('AUDITED_RESET_FIRST_P_RANDOM_VALUE is exactly 8 (rndtable[1] after pre-increment)', () => {
    expect(AUDITED_RESET_FIRST_P_RANDOM_VALUE).toBe(8);
  });

  test('AUDITED_RESET_FIRST_M_RANDOM_VALUE is exactly 8 (rndtable[1] after pre-increment)', () => {
    expect(AUDITED_RESET_FIRST_M_RANDOM_VALUE).toBe(8);
  });

  test('AUDITED_RESET_FIRST_P_SUB_RANDOM_VALUE is exactly -101 (rndtable[1] - rndtable[2] = 8 - 109)', () => {
    expect(AUDITED_RESET_FIRST_P_SUB_RANDOM_VALUE).toBe(-101);
  });

  test('AUDITED_RESET_CALL_SITE_FUNCTION is exactly G_InitNew', () => {
    expect(AUDITED_RESET_CALL_SITE_FUNCTION).toBe('G_InitNew');
  });

  test('AUDITED_RESET_CALL_SITE_FILE is exactly linuxdoom-1.10/g_game.c', () => {
    expect(AUDITED_RESET_CALL_SITE_FILE).toBe('linuxdoom-1.10/g_game.c');
  });

  test('AUDITED_RESET_CALL_SITE_COUNT is exactly 1 (one and only call site in the canonical tree)', () => {
    expect(AUDITED_RESET_CALL_SITE_COUNT).toBe(1);
  });
});

describe('implement-deterministic-reset-seed fact ledger shape', () => {
  test('audits exactly ten facts — three c-header, seven c-body', () => {
    expect(DOOM_RESET_SEED_AUDIT.length).toBe(10);
    const cHeader = DOOM_RESET_SEED_AUDIT.filter((fact) => fact.category === 'c-header');
    const cBody = DOOM_RESET_SEED_AUDIT.filter((fact) => fact.category === 'c-body');
    expect(cHeader.length).toBe(3);
    expect(cBody.length).toBe(7);
  });

  test('every fact id is unique', () => {
    const ids = DOOM_RESET_SEED_AUDIT.map((fact) => fact.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every fact id from the canonical set exactly once', () => {
    const ids = new Set(DOOM_RESET_SEED_AUDIT.map((fact) => fact.id));
    expect(ids).toEqual(ALL_FACT_IDS);
  });

  test('every fact carries a non-empty description and cReference', () => {
    for (const fact of DOOM_RESET_SEED_AUDIT) {
      expect(fact.description.length).toBeGreaterThan(0);
      expect(fact.cReference.length).toBeGreaterThan(0);
    }
  });

  test('every fact references either linuxdoom-1.10/m_random.c or linuxdoom-1.10/g_game.c', () => {
    for (const fact of DOOM_RESET_SEED_AUDIT) {
      expect(['linuxdoom-1.10/m_random.c', 'linuxdoom-1.10/g_game.c']).toContain(fact.referenceSourceFile);
    }
  });

  test('exactly two facts reference linuxdoom-1.10/g_game.c (call-site facts only)', () => {
    const gGameCFacts = DOOM_RESET_SEED_AUDIT.filter((fact) => fact.referenceSourceFile === 'linuxdoom-1.10/g_game.c');
    expect(gGameCFacts.length).toBe(2);
    const ids = new Set(gGameCFacts.map((fact) => fact.id));
    expect(ids).toEqual(new Set(['C_BODY_G_INIT_NEW_CALLS_M_CLEAR_RANDOM_AFTER_MAP_VALIDATION', 'C_BODY_M_CLEAR_RANDOM_HAS_EXACTLY_ONE_CALL_SITE']));
  });
});

describe('implement-deterministic-reset-seed fact ledger values', () => {
  test('C_BODY_M_CLEAR_RANDOM_CHAINED_ASSIGNMENT_BOTH_INDICES_ZERO pins the chained `rndindex = prndindex = 0;` body', () => {
    const fact = DOOM_RESET_SEED_AUDIT.find((candidate) => candidate.id === 'C_BODY_M_CLEAR_RANDOM_CHAINED_ASSIGNMENT_BOTH_INDICES_ZERO');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('rndindex = prndindex = 0;');
  });

  test('C_BODY_M_CLEAR_RANDOM_NO_TIME_SEED_IN_VANILLA explicitly excludes the Chocolate Doom 2.2.1 deviation', () => {
    const fact = DOOM_RESET_SEED_AUDIT.find((candidate) => candidate.id === 'C_BODY_M_CLEAR_RANDOM_NO_TIME_SEED_IN_VANILLA');
    expect(fact).toBeDefined();
    expect(fact?.description).toContain('NOT in scope');
    expect(fact?.description).toContain('time(NULL)');
    expect(fact?.cReference).toBe('rndindex = prndindex = 0;');
  });

  test('C_BODY_M_CLEAR_RANDOM_RETURN_TYPE_VOID pins the `void M_ClearRandom (void)` signature', () => {
    const fact = DOOM_RESET_SEED_AUDIT.find((candidate) => candidate.id === 'C_BODY_M_CLEAR_RANDOM_RETURN_TYPE_VOID');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('void M_ClearRandom (void)');
  });

  test('C_HEADER_M_CLEAR_RANDOM_PROTOTYPE_VOID_VOID pins the canonical prototype', () => {
    const fact = DOOM_RESET_SEED_AUDIT.find((candidate) => candidate.id === 'C_HEADER_M_CLEAR_RANDOM_PROTOTYPE_VOID_VOID');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('void M_ClearRandom (void);');
  });

  test('C_BODY_G_INIT_NEW_CALLS_M_CLEAR_RANDOM_AFTER_MAP_VALIDATION pins the call-site placement', () => {
    const fact = DOOM_RESET_SEED_AUDIT.find((candidate) => candidate.id === 'C_BODY_G_INIT_NEW_CALLS_M_CLEAR_RANDOM_AFTER_MAP_VALIDATION');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('M_ClearRandom ();');
    expect(fact?.referenceSourceFile).toBe('linuxdoom-1.10/g_game.c');
    expect(fact?.description).toContain('AFTER the map-bounds validation');
    expect(fact?.description).toContain('BEFORE the `if (skill == sk_nightmare || respawnparm)` branch');
  });

  test('C_BODY_M_CLEAR_RANDOM_HAS_EXACTLY_ONE_CALL_SITE pins the unique-call-site invariant', () => {
    const fact = DOOM_RESET_SEED_AUDIT.find((candidate) => candidate.id === 'C_BODY_M_CLEAR_RANDOM_HAS_EXACTLY_ONE_CALL_SITE');
    expect(fact).toBeDefined();
    expect(fact?.description).toContain('exactly one call site');
    expect(fact?.referenceSourceFile).toBe('linuxdoom-1.10/g_game.c');
  });

  test('C_HEADER_RNDINDEX_INITIAL_ZERO_MATCHES_RESET_POST_STATE pins `int rndindex = 0;`', () => {
    const fact = DOOM_RESET_SEED_AUDIT.find((candidate) => candidate.id === 'C_HEADER_RNDINDEX_INITIAL_ZERO_MATCHES_RESET_POST_STATE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('int rndindex = 0;');
  });

  test('C_HEADER_PRNDINDEX_INITIAL_ZERO_MATCHES_RESET_POST_STATE pins `int prndindex = 0;`', () => {
    const fact = DOOM_RESET_SEED_AUDIT.find((candidate) => candidate.id === 'C_HEADER_PRNDINDEX_INITIAL_ZERO_MATCHES_RESET_POST_STATE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('int prndindex = 0;');
  });

  test('C_BODY_M_CLEAR_RANDOM_DOES_NOT_TOUCH_RNDTABLE pins the table-preservation invariant', () => {
    const fact = DOOM_RESET_SEED_AUDIT.find((candidate) => candidate.id === 'C_BODY_M_CLEAR_RANDOM_DOES_NOT_TOUCH_RNDTABLE');
    expect(fact).toBeDefined();
    expect(fact?.description).toContain('not aliased, modified, or even referenced');
  });

  test('C_BODY_M_CLEAR_RANDOM_IS_IDEMPOTENT pins the idempotence invariant', () => {
    const fact = DOOM_RESET_SEED_AUDIT.find((candidate) => candidate.id === 'C_BODY_M_CLEAR_RANDOM_IS_IDEMPOTENT');
    expect(fact).toBeDefined();
    expect(fact?.description).toContain('observationally indistinguishable');
  });
});

describe('implement-deterministic-reset-seed invariant ledger shape', () => {
  test('lists exactly sixteen operational invariants', () => {
    expect(DOOM_RESET_SEED_INVARIANTS.length).toBe(16);
  });

  test('every invariant id is unique', () => {
    const ids = DOOM_RESET_SEED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every invariant id from the canonical set exactly once', () => {
    const ids = new Set(DOOM_RESET_SEED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(ALL_INVARIANT_IDS);
  });

  test('every invariant carries a non-empty description', () => {
    for (const invariant of DOOM_RESET_SEED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('implement-deterministic-reset-seed probe ledger shape', () => {
  test('declares exactly sixteen probes', () => {
    expect(DOOM_RESET_SEED_PROBES.length).toBe(16);
  });

  test('every probe id is unique', () => {
    const ids = DOOM_RESET_SEED_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every probe id from the canonical set exactly once', () => {
    const ids = new Set(DOOM_RESET_SEED_PROBES.map((probe) => probe.id));
    expect(ids).toEqual(ALL_PROBE_IDS);
  });

  test('every probe carries a non-empty note', () => {
    for (const probe of DOOM_RESET_SEED_PROBES) {
      expect(probe.note.length).toBeGreaterThan(0);
    }
  });

  test('covers every probe target at least once', () => {
    const targets = new Set(DOOM_RESET_SEED_PROBES.map((probe) => probe.target));
    expect(targets).toEqual(new Set(['p_random_after_reset', 'm_random_after_reset', 'p_sub_random_after_reset', 'index_after_reset']));
  });
});

describe('implement-deterministic-reset-seed runtime invariants — DoomRandom.clearRandom() post-state', () => {
  test('clearRandom() leaves prndindex at exactly 0 from any prior state', () => {
    for (const k of [0, 1, 5, 17, 100, 200, 255]) {
      const rng = new DoomRandom();
      for (let i = 0; i < k; i++) rng.pRandom();
      rng.clearRandom();
      expect(rng.prndindex).toBe(AUDITED_RESET_PRNDINDEX_VALUE);
    }
  });

  test('clearRandom() leaves rndindex at exactly 0 from any prior state (vanilla 1.9 lineage)', () => {
    for (const k of [0, 1, 3, 42, 100, 200, 255]) {
      const rng = new DoomRandom();
      for (let i = 0; i < k; i++) rng.mRandom();
      rng.clearRandom();
      expect(rng.rndindex).toBe(AUDITED_RESET_RNDINDEX_VALUE);
    }
  });

  test('clearRandom() resets both indices simultaneously after mixed P+M use', () => {
    const rng = new DoomRandom();
    for (let i = 0; i < 50; i++) rng.pRandom();
    for (let i = 0; i < 70; i++) rng.mRandom();
    expect(rng.prndindex).toBe(50);
    expect(rng.rndindex).toBe(70);
    rng.clearRandom();
    expect(rng.prndindex).toBe(0);
    expect(rng.rndindex).toBe(0);
  });

  test('first pRandom() after clearRandom() returns rndtable[1] === 8 (canonical first roll)', () => {
    const rng = new DoomRandom();
    for (let i = 0; i < 17; i++) rng.pRandom();
    rng.clearRandom();
    expect(rng.pRandom()).toBe(AUDITED_RESET_FIRST_P_RANDOM_VALUE);
  });

  test('first mRandom() after clearRandom() returns rndtable[1] === 8', () => {
    const rng = new DoomRandom();
    for (let i = 0; i < 23; i++) rng.mRandom();
    rng.clearRandom();
    expect(rng.mRandom()).toBe(AUDITED_RESET_FIRST_M_RANDOM_VALUE);
  });

  test('first pSubRandom() after clearRandom() returns -101 (= rndtable[1] - rndtable[2])', () => {
    const rng = new DoomRandom();
    for (let i = 0; i < 7; i++) rng.pRandom();
    rng.clearRandom();
    expect(rng.pSubRandom()).toBe(AUDITED_RESET_FIRST_P_SUB_RANDOM_VALUE);
  });
});

describe('implement-deterministic-reset-seed runtime invariants — idempotence and fresh-equivalence', () => {
  test('clearRandom() called twice in succession is observationally indistinguishable from one call', () => {
    const oneReset = new DoomRandom();
    for (let i = 0; i < 30; i++) oneReset.pRandom();
    oneReset.clearRandom();

    const twoResets = new DoomRandom();
    for (let i = 0; i < 30; i++) twoResets.pRandom();
    twoResets.clearRandom();
    twoResets.clearRandom();

    expect(oneReset.prndindex).toBe(twoResets.prndindex);
    expect(oneReset.rndindex).toBe(twoResets.rndindex);
    expect(oneReset.pRandom()).toBe(twoResets.pRandom());
  });

  test('clearRandom() called five times in succession is observationally indistinguishable from one call', () => {
    const oneReset = new DoomRandom();
    for (let i = 0; i < 100; i++) oneReset.pRandom();
    oneReset.clearRandom();

    const fiveResets = new DoomRandom();
    for (let i = 0; i < 100; i++) fiveResets.pRandom();
    for (let i = 0; i < 5; i++) fiveResets.clearRandom();

    expect(oneReset.prndindex).toBe(fiveResets.prndindex);
    expect(oneReset.rndindex).toBe(fiveResets.rndindex);
  });

  test('a freshly-constructed DoomRandom instance is bit-equivalent to one cleared immediately', () => {
    const fresh = new DoomRandom();
    const cleared = new DoomRandom();
    cleared.clearRandom();

    expect(fresh.prndindex).toBe(cleared.prndindex);
    expect(fresh.rndindex).toBe(cleared.rndindex);
    expect(fresh.pRandom()).toBe(cleared.pRandom());
    expect(fresh.mRandom()).toBe(cleared.mRandom());
  });

  test('clearRandom() returns undefined (matches `void M_ClearRandom (void)` C signature)', () => {
    const rng = new DoomRandom();
    const result = rng.clearRandom() as unknown;
    expect(result).toBeUndefined();
  });
});

describe('implement-deterministic-reset-seed runtime invariants — full-cycle and table preservation', () => {
  test('clearRandom() after a full P cycle (256 calls) restores fresh state', () => {
    const rng = new DoomRandom();
    for (let i = 0; i < 256; i++) rng.pRandom();
    expect(rng.prndindex).toBe(0); // 256 calls wrap back to 0
    rng.clearRandom();
    expect(rng.prndindex).toBe(0);
    expect(rng.pRandom()).toBe(AUDITED_RESET_FIRST_P_RANDOM_VALUE);
  });

  test('clearRandom() after a full M cycle (256 calls) restores fresh state', () => {
    const rng = new DoomRandom();
    for (let i = 0; i < 256; i++) rng.mRandom();
    expect(rng.rndindex).toBe(0);
    rng.clearRandom();
    expect(rng.rndindex).toBe(0);
    expect(rng.mRandom()).toBe(AUDITED_RESET_FIRST_M_RANDOM_VALUE);
  });

  test('clearRandom() does not mutate the RNG_TABLE bytes', () => {
    const before = [...RNG_TABLE];
    const rng = new DoomRandom();
    for (let i = 0; i < 100; i++) rng.pRandom();
    for (let i = 0; i < 100; i++) rng.mRandom();
    rng.clearRandom();
    rng.clearRandom();
    const after = [...RNG_TABLE];

    expect(after.length).toBe(before.length);
    for (let i = 0; i < before.length; i++) {
      expect(after[i]).toBe(before[i] ?? Number.NaN);
    }
  });

  test('two rapid back-to-back clearRandom calls produce identical mRandom values (no time seed)', () => {
    const a = new DoomRandom();
    a.clearRandom();
    const aValue = a.mRandom();

    const b = new DoomRandom();
    b.clearRandom();
    const bValue = b.mRandom();

    expect(aValue).toBe(bValue);
    expect(aValue).toBe(AUDITED_RESET_FIRST_M_RANDOM_VALUE);
  });
});

describe('implement-deterministic-reset-seed runtime probe values', () => {
  test('every probe expected value matches the live DoomRandom class', () => {
    for (const probe of DOOM_RESET_SEED_PROBES) {
      const rng = new DoomRandom();
      for (let i = 0; i < (probe.input.setupPRandomCalls ?? 0); i++) rng.pRandom();
      for (let i = 0; i < (probe.input.setupMRandomCalls ?? 0); i++) rng.mRandom();
      for (let i = 0; i < (probe.input.setupPSubRandomCalls ?? 0); i++) rng.pSubRandom();
      rng.clearRandom();
      if (probe.input.extraResetAfterSetup === true) rng.clearRandom();

      let actual: number;
      if (probe.input.observation === 'pRandom') actual = rng.pRandom();
      else if (probe.input.observation === 'mRandom') actual = rng.mRandom();
      else if (probe.input.observation === 'pSubRandom') actual = rng.pSubRandom();
      else if (probe.input.observation === 'prndindex') actual = rng.prndindex;
      else if (probe.input.observation === 'rndindex') actual = rng.rndindex;
      else actual = rng.prndindex + rng.rndindex;

      expect(actual).toBe(probe.expected);
    }
  });
});

describe('crossCheckDoomResetSeed on the live runtime DoomRandom', () => {
  test('reports zero failures', () => {
    expect(crossCheckDoomResetSeed(buildLiveCandidate())).toEqual([]);
  });
});

describe('crossCheckDoomResetSeed failure modes — tampered candidates', () => {
  function buildSharedStateCandidate(impl: {
    pRandomImpl?: (state: { prnd: number; rnd: number; tableMutated: boolean }) => number;
    mRandomImpl?: (state: { prnd: number; rnd: number; tableMutated: boolean }) => number;
    pSubRandomImpl?: (state: { prnd: number; rnd: number; tableMutated: boolean }) => number;
    clearRandomImpl?: (state: { prnd: number; rnd: number; tableMutated: boolean }) => void | unknown;
    rndtableMutator?: (table: Uint8Array) => void;
  }): DoomResetSeedCandidate {
    const sharedTable = liveRndtableBytes();
    return {
      rndtable: sharedTable,
      create: (): DoomResetSeedCandidateInstance => {
        const state = { prnd: 0, rnd: 0, tableMutated: false };
        const defaults = {
          pRandom(): number {
            state.prnd = (state.prnd + 1) & 0xff;
            return sharedTable[state.prnd] ?? 0;
          },
          mRandom(): number {
            state.rnd = (state.rnd + 1) & 0xff;
            return sharedTable[state.rnd] ?? 0;
          },
          pSubRandom(): number {
            const a = defaults.pRandom();
            return a - defaults.pRandom();
          },
          clearRandom(): void {
            state.prnd = 0;
            state.rnd = 0;
          },
        };
        return {
          pRandom: () => (impl.pRandomImpl ? impl.pRandomImpl(state) : defaults.pRandom()),
          mRandom: () => (impl.mRandomImpl ? impl.mRandomImpl(state) : defaults.mRandom()),
          pSubRandom: () => (impl.pSubRandomImpl ? impl.pSubRandomImpl(state) : defaults.pSubRandom()),
          clearRandom: ((): unknown => {
            let result: unknown;
            if (impl.clearRandomImpl) {
              result = impl.clearRandomImpl(state);
            } else {
              defaults.clearRandom();
            }
            if (impl.rndtableMutator) impl.rndtableMutator(sharedTable);
            return result;
          }) as unknown as () => void,
          get prndindex(): number {
            return state.prnd;
          },
          get rndindex(): number {
            return state.rnd;
          },
        };
      },
    };
  }

  test('detects a candidate where clearRandom only resets prndindex (Chocolate Doom 2.2.1 time-seeded variant signature)', () => {
    const candidate = buildSharedStateCandidate({
      clearRandomImpl: (state) => {
        // Tamper: only reset prndindex; rndindex keeps walking.
        state.prnd = 0;
      },
    });
    const failures = crossCheckDoomResetSeed(candidate);
    expect(failures).toContain('invariant:RESET_RNDINDEX_BECOMES_ZERO');
    expect(failures).toContain('invariant:RESET_BOTH_INDICES_BECOME_ZERO_TOGETHER');
    expect(failures).toContain('invariant:RESET_FIRST_M_RANDOM_RETURNS_RNDTABLE_ONE');
    expect(failures).toContain('invariant:RESET_AFTER_PARTIAL_M_CYCLE_RESTORES_FRESH_STATE');
  });

  test('detects a candidate where clearRandom seeds rndindex from a "time" source (Chocolate Doom 2.2.1 deviation)', () => {
    const candidate = buildSharedStateCandidate({
      clearRandomImpl: (state) => {
        state.prnd = 0;
        // Tamper: seed rndindex from a fixed non-zero value (simulates time(NULL) & 0xff).
        state.rnd = 0x42;
      },
    });
    const failures = crossCheckDoomResetSeed(candidate);
    expect(failures).toContain('invariant:RESET_RNDINDEX_BECOMES_ZERO');
    expect(failures).toContain('invariant:RESET_BOTH_INDICES_BECOME_ZERO_TOGETHER');
    expect(failures).toContain('invariant:RESET_FIRST_M_RANDOM_RETURNS_RNDTABLE_ONE');
  });

  test('detects a candidate where clearRandom only resets rndindex (gameplay-stream desync)', () => {
    const candidate = buildSharedStateCandidate({
      clearRandomImpl: (state) => {
        // Tamper: only reset rndindex; prndindex keeps walking.
        state.rnd = 0;
      },
    });
    const failures = crossCheckDoomResetSeed(candidate);
    expect(failures).toContain('invariant:RESET_PRNDINDEX_BECOMES_ZERO');
    expect(failures).toContain('invariant:RESET_FIRST_P_RANDOM_RETURNS_RNDTABLE_ONE');
    expect(failures).toContain('invariant:RESET_AFTER_PARTIAL_P_CYCLE_RESTORES_FRESH_STATE');
  });

  test('detects a candidate where clearRandom is a no-op', () => {
    const candidate = buildSharedStateCandidate({
      clearRandomImpl: () => {
        // Tamper: no-op reset.
      },
    });
    const failures = crossCheckDoomResetSeed(candidate);
    expect(failures).toContain('invariant:RESET_PRNDINDEX_BECOMES_ZERO');
    expect(failures).toContain('invariant:RESET_RNDINDEX_BECOMES_ZERO');
    expect(failures).toContain('invariant:RESET_FIRST_P_RANDOM_RETURNS_RNDTABLE_ONE');
  });

  test('detects a candidate where clearRandom resets to a non-zero constant (e.g. 1)', () => {
    const candidate = buildSharedStateCandidate({
      clearRandomImpl: (state) => {
        state.prnd = 1;
        state.rnd = 1;
      },
    });
    const failures = crossCheckDoomResetSeed(candidate);
    expect(failures).toContain('invariant:RESET_PRNDINDEX_BECOMES_ZERO');
    expect(failures).toContain('invariant:RESET_RNDINDEX_BECOMES_ZERO');
    // First pRandom would emit rndtable[2] = 109 instead of rndtable[1] = 8.
    expect(failures).toContain('invariant:RESET_FIRST_P_RANDOM_RETURNS_RNDTABLE_ONE');
  });

  test('detects a candidate where clearRandom mutates the rndtable (table-preservation tamper)', () => {
    const candidate = buildSharedStateCandidate({
      rndtableMutator: (table) => {
        // Tamper: increment cell 200 each time clearRandom is called.
        table[200] = ((table[200] ?? 0) + 1) & 0xff;
      },
    });
    const failures = crossCheckDoomResetSeed(candidate);
    expect(failures).toContain('invariant:RESET_PRESERVES_RNDTABLE_BYTES');
  });

  test('detects a candidate where clearRandom is non-idempotent (counter-driven)', () => {
    let resetCounter = 0;
    const candidate = buildSharedStateCandidate({
      clearRandomImpl: (state) => {
        resetCounter++;
        state.prnd = 0;
        state.rnd = resetCounter & 0xff;
      },
    });
    const failures = crossCheckDoomResetSeed(candidate);
    expect(failures).toContain('invariant:RESET_IS_IDEMPOTENT');
  });

  test('detects a candidate where clearRandom only resets if prior state is non-zero', () => {
    const candidate = buildSharedStateCandidate({
      clearRandomImpl: (state) => {
        // Tamper: condition the reset on the wrap state.
        if (state.prnd === 0 && state.rnd === 0) {
          state.prnd = 17; // pretend a different seed for the "fresh" branch
          state.rnd = 23;
        } else {
          state.prnd = 0;
          state.rnd = 0;
        }
      },
    });
    const failures = crossCheckDoomResetSeed(candidate);
    expect(failures).toContain('invariant:RESET_FROM_FRESH_INSTANCE_IS_NO_OP');
  });

  test('detects a candidate where clearRandom returns a value (signature deviation)', () => {
    const candidate = buildSharedStateCandidate({
      clearRandomImpl: (state) => {
        state.prnd = 0;
        state.rnd = 0;
        return 42 as unknown;
      },
    });
    const failures = crossCheckDoomResetSeed(candidate);
    expect(failures).toContain('invariant:RESET_RETURNS_VOID_OR_UNDEFINED');
  });

  test('detects a candidate whose first pSubRandom after reset returns +101 (subtraction order swap)', () => {
    const sharedTable = liveRndtableBytes();
    const candidate: DoomResetSeedCandidate = {
      rndtable: sharedTable,
      create: () => {
        const state = { prnd: 0, rnd: 0 };
        return {
          pRandom(): number {
            state.prnd = (state.prnd + 1) & 0xff;
            return sharedTable[state.prnd] ?? 0;
          },
          mRandom(): number {
            state.rnd = (state.rnd + 1) & 0xff;
            return sharedTable[state.rnd] ?? 0;
          },
          pSubRandom(): number {
            // Tamper: swap subtraction order.
            state.prnd = (state.prnd + 1) & 0xff;
            const a = sharedTable[state.prnd] ?? 0;
            state.prnd = (state.prnd + 1) & 0xff;
            const b = sharedTable[state.prnd] ?? 0;
            return b - a;
          },
          clearRandom(): void {
            state.prnd = 0;
            state.rnd = 0;
          },
          get prndindex(): number {
            return state.prnd;
          },
          get rndindex(): number {
            return state.rnd;
          },
        };
      },
    };
    const failures = crossCheckDoomResetSeed(candidate);
    expect(failures).toContain('invariant:RESET_FIRST_P_SUB_RANDOM_RETURNS_NEGATIVE_101');
    expect(failures).toContain('probe:reset_then_p_sub_random_emits_negative_101');
  });

  test('detects a candidate where clearRandom is non-deterministic across rapid calls (time-seeded)', () => {
    let phase = 0;
    const candidate = buildSharedStateCandidate({
      clearRandomImpl: (state) => {
        // Tamper: alternate between two different rndindex seeds across calls.
        state.prnd = 0;
        state.rnd = phase & 0xff;
        phase++;
      },
    });
    const failures = crossCheckDoomResetSeed(candidate);
    expect(failures).toContain('invariant:RESET_IS_DETERMINISTIC_ACROSS_RAPID_CALLS');
  });

  test('detects a candidate where reset post-state depends on prior history', () => {
    const candidate = buildSharedStateCandidate({
      clearRandomImpl: (state) => {
        // Tamper: leave the prior state's prndindex parity in the post-state.
        state.prnd = state.prnd & 1;
        state.rnd = 0;
      },
    });
    const failures = crossCheckDoomResetSeed(candidate);
    expect(failures).toContain('invariant:RESET_DOES_NOT_DEPEND_ON_PRIOR_HISTORY');
  });

  test('detects a candidate where reset after pSubRandom does not undo the advance', () => {
    const sharedTable = liveRndtableBytes();
    const candidate: DoomResetSeedCandidate = {
      rndtable: sharedTable,
      create: () => {
        const state = { prnd: 0, rnd: 0, lastPSubRandomCount: 0 };
        return {
          pRandom(): number {
            state.prnd = (state.prnd + 1) & 0xff;
            return sharedTable[state.prnd] ?? 0;
          },
          mRandom(): number {
            state.rnd = (state.rnd + 1) & 0xff;
            return sharedTable[state.rnd] ?? 0;
          },
          pSubRandom(): number {
            state.lastPSubRandomCount++;
            state.prnd = (state.prnd + 1) & 0xff;
            const a = sharedTable[state.prnd] ?? 0;
            state.prnd = (state.prnd + 1) & 0xff;
            const b = sharedTable[state.prnd] ?? 0;
            return a - b;
          },
          clearRandom(): void {
            // Tamper: reset prndindex to lastPSubRandomCount instead of 0.
            state.prnd = state.lastPSubRandomCount & 0xff;
            state.rnd = 0;
          },
          get prndindex(): number {
            return state.prnd;
          },
          get rndindex(): number {
            return state.rnd;
          },
        };
      },
    };
    const failures = crossCheckDoomResetSeed(candidate);
    expect(failures).toContain('probe:reset_after_p_sub_random_makes_next_p_random_emit_8');
  });

  test('detects a candidate where clearRandom only restores fresh state for fresh inputs (mid-cycle desync)', () => {
    const candidate = buildSharedStateCandidate({
      clearRandomImpl: (state) => {
        // Tamper: leave a remembered offset for non-fresh starts.
        if (state.prnd > 100) {
          state.prnd = 1;
        } else {
          state.prnd = 0;
        }
        state.rnd = 0;
      },
    });
    const failures = crossCheckDoomResetSeed(candidate);
    expect(failures).toContain('invariant:RESET_AFTER_PARTIAL_P_CYCLE_RESTORES_FRESH_STATE');
  });
});

describe('implement-deterministic-reset-seed step file', () => {
  test('declares the core lane and the implement-deterministic-reset-seed write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-008-implement-deterministic-reset-seed.md').text();
    expect(stepText).toContain('## lane\n\ncore');
    expect(stepText).toContain('- src/core/implement-deterministic-reset-seed.ts');
    expect(stepText).toContain('- test/vanilla_parity/core/implement-deterministic-reset-seed.test.ts');
  });

  test('lists m_fixed.c, tables.c, d_main.c, and g_game.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-008-implement-deterministic-reset-seed.md').text();
    expect(stepText).toContain('- m_fixed.c');
    expect(stepText).toContain('- tables.c');
    expect(stepText).toContain('- d_main.c');
    expect(stepText).toContain('- g_game.c');
  });

  test('declares 00-018 as the prerequisite', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-008-implement-deterministic-reset-seed.md').text();
    expect(stepText).toContain('## prerequisites\n\n- 00-018');
  });
});
