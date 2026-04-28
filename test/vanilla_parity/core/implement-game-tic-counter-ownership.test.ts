import { describe, expect, test } from 'bun:test';

import {
  AUDITED_GAMETIC_AFTER_256_TICS_VALUE,
  AUDITED_GAMETIC_AFTER_FIRST_TICK_VALUE,
  AUDITED_GAMETIC_AFTER_ONE_SECOND_VALUE,
  AUDITED_GAMETIC_DECLARATION_FILE,
  AUDITED_GAMETIC_DURING_FIRST_TICKER_VALUE,
  AUDITED_GAMETIC_INCREMENT_DELTA,
  AUDITED_GAMETIC_INCREMENT_SITE_COUNT_LINUXDOOM,
  AUDITED_GAMETIC_INCREMENT_STATEMENT,
  AUDITED_GAMETIC_INITIAL_VALUE,
  AUDITED_GAMETIC_RESET_STATEMENT_COUNT_LINUXDOOM,
  DOOM_GAME_TIC_AUDIT,
  DOOM_GAME_TIC_INVARIANTS,
  DOOM_GAME_TIC_PROBES,
  crossCheckDoomGameTicCounter,
} from '../../../src/core/implement-game-tic-counter-ownership.ts';
import type { DoomGameTicCandidate, DoomGameTicCandidateInstance, DoomGameTicFactId, DoomGameTicInvariantId, DoomGameTicProbeId } from '../../../src/core/implement-game-tic-counter-ownership.ts';

const ALL_FACT_IDS: Set<DoomGameTicFactId> = new Set([
  'C_HEADER_GAMETIC_FILE_SCOPE_INT_DECLARATION',
  'C_HEADER_GAMETIC_DEFAULT_INITIALISES_TO_ZERO',
  'C_HEADER_LEVELSTARTTIC_DECLARED_BESIDE_GAMETIC',
  'C_BODY_GAMETIC_INCREMENT_IN_DOOMLOOP_SINGLETICS_PATH',
  'C_BODY_GAMETIC_INCREMENT_IN_TRYRUNTICS_TICDUP_LOOP',
  'C_BODY_GAMETIC_INCREMENT_USES_POST_INCREMENT_FORM',
  'C_BODY_GAMETIC_NEVER_RESET_IN_LINUXDOOM_TREE',
  'C_BODY_GAMETIC_NOT_TOUCHED_IN_G_INIT_NEW',
  'C_BODY_GAMETIC_NOT_TOUCHED_IN_G_DO_LOAD_GAME_OR_SAVE_GAME',
  'C_BODY_LEVELSTARTTIC_CAPTURES_GAMETIC_IN_G_DO_LOAD_LEVEL',
  'C_BODY_GAMETIC_TICKER_ORDER_M_THEN_G_THEN_INCREMENT',
  'C_BODY_GAMETIC_INCREMENT_HAS_EXACTLY_TWO_CALL_SITES',
]);

const ALL_INVARIANT_IDS: Set<DoomGameTicInvariantId> = new Set([
  'GAMETIC_INITIALISES_TO_ZERO',
  'GAMETIC_INCREMENT_IS_BY_EXACTLY_ONE_PER_TIC',
  'GAMETIC_NEVER_DECREASES_DURING_LIFETIME',
  'GAMETIC_OBSERVED_DURING_TICKER_EQUALS_PRE_INCREMENT_VALUE',
  'GAMETIC_AFTER_N_TICS_EQUALS_N_FROM_FRESH_INSTANCE',
  'GAMETIC_NOT_RESET_BY_REPEATED_TICKING',
  'GAMETIC_TICKER_OBSERVED_VALUES_ARE_ZERO_INDEXED_SEQUENCE',
  'GAMETIC_INCREMENT_IS_INTEGER_NEVER_FRACTIONAL',
  'GAMETIC_SURVIVES_LARGE_COUNT_WITHOUT_PREMATURE_WRAP',
  'GAMETIC_AFTER_ONE_SECOND_EQUALS_THIRTY_FIVE',
  'GAMETIC_AFTER_TWO_SECONDS_EQUALS_SEVENTY',
  'GAMETIC_AFTER_BYTE_BOUNDARY_DOES_NOT_WRAP',
  'GAMETIC_TWO_INSTANCES_ARE_INDEPENDENT',
  'GAMETIC_DURING_TICKER_OF_KTH_TIC_EQUALS_K_MINUS_ONE',
  'GAMETIC_INCREMENT_OBSERVABLE_BEFORE_TICKER_RETURN_IS_FALSE',
]);

const ALL_PROBE_IDS: Set<DoomGameTicProbeId> = new Set([
  'fresh_instance_gametic_is_zero',
  'after_one_tic_gametic_is_one',
  'after_two_tics_gametic_is_two',
  'after_five_tics_gametic_is_five',
  'after_thirty_five_tics_gametic_is_thirty_five',
  'after_seventy_tics_gametic_is_seventy',
  'after_one_hundred_tics_gametic_is_one_hundred',
  'after_two_hundred_fifty_six_tics_gametic_is_two_hundred_fifty_six',
  'after_one_thousand_tics_gametic_is_one_thousand',
  'after_two_thousand_one_hundred_tics_gametic_is_two_thousand_one_hundred',
  'during_first_ticker_observed_gametic_is_zero',
  'during_second_ticker_observed_gametic_is_one',
  'during_thirty_sixth_ticker_observed_gametic_is_thirty_five',
  'during_one_thousandth_ticker_observed_gametic_is_nine_hundred_ninety_nine',
  'after_one_game_minute_gametic_is_two_thousand_one_hundred',
  'after_one_game_hour_gametic_is_one_hundred_twenty_six_thousand',
]);

/**
 * Reference candidate that mirrors the canonical vanilla DOOM 1.9
 * gametic post-Ticker post-increment contract: a per-instance int
 * counter that starts at 0, exposes the pre-increment value through
 * the ticker callback, and increments by exactly +1 after each call.
 */
function buildReferenceCandidate(): DoomGameTicCandidate {
  return {
    create: (): DoomGameTicCandidateInstance => {
      const state = { gametic: 0 };
      return {
        get gametic(): number {
          return state.gametic;
        },
        runOneTic(tickerCallback: (gameticDuringTicker: number) => void): void {
          tickerCallback(state.gametic);
          state.gametic += 1;
        },
      };
    },
  };
}

describe('implement-game-tic-counter-ownership audited canonical constants', () => {
  test('AUDITED_GAMETIC_INITIAL_VALUE is exactly 0 (canonical file-scope C-default zero-initialised)', () => {
    expect(AUDITED_GAMETIC_INITIAL_VALUE).toBe(0);
  });

  test('AUDITED_GAMETIC_INCREMENT_DELTA is exactly 1 (gametic++ post-increment)', () => {
    expect(AUDITED_GAMETIC_INCREMENT_DELTA).toBe(1);
  });

  test('AUDITED_GAMETIC_RESET_STATEMENT_COUNT_LINUXDOOM is exactly 0 (no gametic = N anywhere)', () => {
    expect(AUDITED_GAMETIC_RESET_STATEMENT_COUNT_LINUXDOOM).toBe(0);
  });

  test('AUDITED_GAMETIC_INCREMENT_SITE_COUNT_LINUXDOOM is exactly 2 (d_main.c singletics + d_net.c TryRunTics)', () => {
    expect(AUDITED_GAMETIC_INCREMENT_SITE_COUNT_LINUXDOOM).toBe(2);
  });

  test('AUDITED_GAMETIC_DURING_FIRST_TICKER_VALUE is exactly 0 (post-Ticker post-increment contract)', () => {
    expect(AUDITED_GAMETIC_DURING_FIRST_TICKER_VALUE).toBe(0);
  });

  test('AUDITED_GAMETIC_AFTER_FIRST_TICK_VALUE is exactly 1 (after one runOneTic)', () => {
    expect(AUDITED_GAMETIC_AFTER_FIRST_TICK_VALUE).toBe(1);
  });

  test('AUDITED_GAMETIC_AFTER_ONE_SECOND_VALUE is exactly 35 (one second at 35 Hz)', () => {
    expect(AUDITED_GAMETIC_AFTER_ONE_SECOND_VALUE).toBe(35);
  });

  test('AUDITED_GAMETIC_AFTER_256_TICS_VALUE is exactly 256 (no byte wrap)', () => {
    expect(AUDITED_GAMETIC_AFTER_256_TICS_VALUE).toBe(256);
  });

  test('AUDITED_GAMETIC_DECLARATION_FILE is exactly linuxdoom-1.10/g_game.c', () => {
    expect(AUDITED_GAMETIC_DECLARATION_FILE).toBe('linuxdoom-1.10/g_game.c');
  });

  test('AUDITED_GAMETIC_INCREMENT_STATEMENT is exactly gametic++; (post-increment)', () => {
    expect(AUDITED_GAMETIC_INCREMENT_STATEMENT).toBe('gametic++;');
  });
});

describe('implement-game-tic-counter-ownership fact ledger shape', () => {
  test('audits exactly twelve facts — three c-header, nine c-body', () => {
    expect(DOOM_GAME_TIC_AUDIT.length).toBe(12);
    const cHeader = DOOM_GAME_TIC_AUDIT.filter((fact) => fact.category === 'c-header');
    const cBody = DOOM_GAME_TIC_AUDIT.filter((fact) => fact.category === 'c-body');
    expect(cHeader.length).toBe(3);
    expect(cBody.length).toBe(9);
  });

  test('every fact id is unique', () => {
    const ids = DOOM_GAME_TIC_AUDIT.map((fact) => fact.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every fact id from the canonical set exactly once', () => {
    const ids = new Set(DOOM_GAME_TIC_AUDIT.map((fact) => fact.id));
    expect(ids).toEqual(ALL_FACT_IDS);
  });

  test('every fact carries a non-empty description and cReference', () => {
    for (const fact of DOOM_GAME_TIC_AUDIT) {
      expect(fact.description.length).toBeGreaterThan(0);
      expect(fact.cReference.length).toBeGreaterThan(0);
    }
  });

  test('every fact references one of g_game.c, d_main.c, or d_net.c in linuxdoom-1.10', () => {
    for (const fact of DOOM_GAME_TIC_AUDIT) {
      expect(['linuxdoom-1.10/d_main.c', 'linuxdoom-1.10/d_net.c', 'linuxdoom-1.10/g_game.c']).toContain(fact.referenceSourceFile);
    }
  });

  test('exactly two facts reference linuxdoom-1.10/d_main.c (singletics increment site, two-call-site cardinality)', () => {
    const dmaincFacts = DOOM_GAME_TIC_AUDIT.filter((fact) => fact.referenceSourceFile === 'linuxdoom-1.10/d_main.c');
    expect(dmaincFacts.length).toBe(2);
    const ids = new Set(dmaincFacts.map((fact) => fact.id));
    expect(ids).toEqual(new Set(['C_BODY_GAMETIC_INCREMENT_IN_DOOMLOOP_SINGLETICS_PATH', 'C_BODY_GAMETIC_INCREMENT_HAS_EXACTLY_TWO_CALL_SITES']));
  });

  test('exactly three facts reference linuxdoom-1.10/d_net.c (TryRunTics increment, post-increment form, ticker order)', () => {
    const dnetcFacts = DOOM_GAME_TIC_AUDIT.filter((fact) => fact.referenceSourceFile === 'linuxdoom-1.10/d_net.c');
    expect(dnetcFacts.length).toBe(3);
    const ids = new Set(dnetcFacts.map((fact) => fact.id));
    expect(ids).toEqual(new Set(['C_BODY_GAMETIC_INCREMENT_IN_TRYRUNTICS_TICDUP_LOOP', 'C_BODY_GAMETIC_INCREMENT_USES_POST_INCREMENT_FORM', 'C_BODY_GAMETIC_TICKER_ORDER_M_THEN_G_THEN_INCREMENT']));
  });

  test('the remaining seven facts reference linuxdoom-1.10/g_game.c', () => {
    const ggameFacts = DOOM_GAME_TIC_AUDIT.filter((fact) => fact.referenceSourceFile === 'linuxdoom-1.10/g_game.c');
    expect(ggameFacts.length).toBe(7);
  });
});

describe('implement-game-tic-counter-ownership fact ledger values', () => {
  test('C_HEADER_GAMETIC_FILE_SCOPE_INT_DECLARATION pins the verbatim `int             gametic;` declaration', () => {
    const fact = DOOM_GAME_TIC_AUDIT.find((candidate) => candidate.id === 'C_HEADER_GAMETIC_FILE_SCOPE_INT_DECLARATION');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('int             gametic;');
    expect(fact?.referenceSourceFile).toBe('linuxdoom-1.10/g_game.c');
  });

  test('C_HEADER_GAMETIC_DEFAULT_INITIALISES_TO_ZERO pins the C-default zero contract', () => {
    const fact = DOOM_GAME_TIC_AUDIT.find((candidate) => candidate.id === 'C_HEADER_GAMETIC_DEFAULT_INITIALISES_TO_ZERO');
    expect(fact).toBeDefined();
    expect(fact?.description).toContain('zero-initialised');
    expect(fact?.description).toContain('static storage duration');
  });

  test('C_HEADER_LEVELSTARTTIC_DECLARED_BESIDE_GAMETIC pins the verbatim levelstarttic declaration with the canonical comment', () => {
    const fact = DOOM_GAME_TIC_AUDIT.find((candidate) => candidate.id === 'C_HEADER_LEVELSTARTTIC_DECLARED_BESIDE_GAMETIC');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('levelstarttic');
    expect(fact?.cReference).toContain('// gametic at level start');
  });

  test('C_BODY_GAMETIC_INCREMENT_IN_DOOMLOOP_SINGLETICS_PATH pins the d_main.c singletics statement form', () => {
    const fact = DOOM_GAME_TIC_AUDIT.find((candidate) => candidate.id === 'C_BODY_GAMETIC_INCREMENT_IN_DOOMLOOP_SINGLETICS_PATH');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('M_Ticker ();');
    expect(fact?.cReference).toContain('G_Ticker ();');
    expect(fact?.cReference).toContain('gametic++;');
    expect(fact?.cReference).toContain('maketic++;');
    expect(fact?.referenceSourceFile).toBe('linuxdoom-1.10/d_main.c');
  });

  test('C_BODY_GAMETIC_INCREMENT_IN_TRYRUNTICS_TICDUP_LOOP pins the inner ticdup loop placement', () => {
    const fact = DOOM_GAME_TIC_AUDIT.find((candidate) => candidate.id === 'C_BODY_GAMETIC_INCREMENT_IN_TRYRUNTICS_TICDUP_LOOP');
    expect(fact).toBeDefined();
    expect(fact?.description).toContain('inner');
    expect(fact?.description).toContain('ticdup');
    expect(fact?.referenceSourceFile).toBe('linuxdoom-1.10/d_net.c');
  });

  test('C_BODY_GAMETIC_INCREMENT_USES_POST_INCREMENT_FORM pins the canonical `gametic++;` syntax', () => {
    const fact = DOOM_GAME_TIC_AUDIT.find((candidate) => candidate.id === 'C_BODY_GAMETIC_INCREMENT_USES_POST_INCREMENT_FORM');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('gametic++;');
    expect(fact?.description).toContain('post-increment');
  });

  test('C_BODY_GAMETIC_NEVER_RESET_IN_LINUXDOOM_TREE pins the no-reset invariant', () => {
    const fact = DOOM_GAME_TIC_AUDIT.find((candidate) => candidate.id === 'C_BODY_GAMETIC_NEVER_RESET_IN_LINUXDOOM_TREE');
    expect(fact).toBeDefined();
    expect(fact?.description).toContain('never assigned');
  });

  test('C_BODY_GAMETIC_NOT_TOUCHED_IN_G_INIT_NEW pins that G_InitNew does not assign gametic', () => {
    const fact = DOOM_GAME_TIC_AUDIT.find((candidate) => candidate.id === 'C_BODY_GAMETIC_NOT_TOUCHED_IN_G_INIT_NEW');
    expect(fact).toBeDefined();
    expect(fact?.description).toContain('does NOT touch `gametic`');
    expect(fact?.description).toContain('M_ClearRandom');
  });

  test('C_BODY_GAMETIC_NOT_TOUCHED_IN_G_DO_LOAD_GAME_OR_SAVE_GAME pins the save/load invariant', () => {
    const fact = DOOM_GAME_TIC_AUDIT.find((candidate) => candidate.id === 'C_BODY_GAMETIC_NOT_TOUCHED_IN_G_DO_LOAD_GAME_OR_SAVE_GAME');
    expect(fact).toBeDefined();
    expect(fact?.description).toContain('Neither G_DoLoadGame nor G_DoSaveGame');
    expect(fact?.description).toContain('leveltime');
  });

  test('C_BODY_LEVELSTARTTIC_CAPTURES_GAMETIC_IN_G_DO_LOAD_LEVEL pins the verbatim capture statement', () => {
    const fact = DOOM_GAME_TIC_AUDIT.find((candidate) => candidate.id === 'C_BODY_LEVELSTARTTIC_CAPTURES_GAMETIC_IN_G_DO_LOAD_LEVEL');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('levelstarttic = gametic;');
    expect(fact?.cReference).toContain('// for time calculation');
  });

  test('C_BODY_GAMETIC_TICKER_ORDER_M_THEN_G_THEN_INCREMENT pins the four-step ordering', () => {
    const fact = DOOM_GAME_TIC_AUDIT.find((candidate) => candidate.id === 'C_BODY_GAMETIC_TICKER_ORDER_M_THEN_G_THEN_INCREMENT');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('M_Ticker (); G_Ticker (); gametic++;');
    expect(fact?.description).toContain('M_Ticker must run BEFORE G_Ticker');
  });

  test('C_BODY_GAMETIC_INCREMENT_HAS_EXACTLY_TWO_CALL_SITES pins the unique-pair-call-site invariant', () => {
    const fact = DOOM_GAME_TIC_AUDIT.find((candidate) => candidate.id === 'C_BODY_GAMETIC_INCREMENT_HAS_EXACTLY_TWO_CALL_SITES');
    expect(fact).toBeDefined();
    expect(fact?.description).toContain('exactly two locations');
    expect(fact?.description).toContain('singletics');
    expect(fact?.description).toContain('TryRunTics');
  });
});

describe('implement-game-tic-counter-ownership invariant ledger shape', () => {
  test('lists exactly fifteen operational invariants', () => {
    expect(DOOM_GAME_TIC_INVARIANTS.length).toBe(15);
  });

  test('every invariant id is unique', () => {
    const ids = DOOM_GAME_TIC_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every invariant id from the canonical set exactly once', () => {
    const ids = new Set(DOOM_GAME_TIC_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(ALL_INVARIANT_IDS);
  });

  test('every invariant carries a non-empty description', () => {
    for (const invariant of DOOM_GAME_TIC_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('implement-game-tic-counter-ownership probe ledger shape', () => {
  test('declares exactly sixteen probes', () => {
    expect(DOOM_GAME_TIC_PROBES.length).toBe(16);
  });

  test('every probe id is unique', () => {
    const ids = DOOM_GAME_TIC_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every probe id from the canonical set exactly once', () => {
    const ids = new Set(DOOM_GAME_TIC_PROBES.map((probe) => probe.id));
    expect(ids).toEqual(ALL_PROBE_IDS);
  });

  test('every probe carries a non-empty note', () => {
    for (const probe of DOOM_GAME_TIC_PROBES) {
      expect(probe.note.length).toBeGreaterThan(0);
    }
  });

  test('covers both probe targets at least once', () => {
    const targets = new Set(DOOM_GAME_TIC_PROBES.map((probe) => probe.target));
    expect(targets).toEqual(new Set(['gametic_after_n_tics', 'gametic_observed_during_kth_ticker']));
  });

  test('every gametic_observed_during_kth_ticker probe declares observeTickerOfKthCall', () => {
    for (const probe of DOOM_GAME_TIC_PROBES) {
      if (probe.target === 'gametic_observed_during_kth_ticker') {
        expect(probe.input.observeTickerOfKthCall).toBeDefined();
        expect(probe.input.observeTickerOfKthCall).toBeGreaterThan(0);
      }
    }
  });
});

describe('implement-game-tic-counter-ownership reference candidate — fresh-state values', () => {
  test('a freshly-constructed reference candidate exposes gametic === 0', () => {
    const instance = buildReferenceCandidate().create();
    expect(instance.gametic).toBe(AUDITED_GAMETIC_INITIAL_VALUE);
  });

  test('after one runOneTic call, gametic === 1', () => {
    const instance = buildReferenceCandidate().create();
    instance.runOneTic(() => {});
    expect(instance.gametic).toBe(AUDITED_GAMETIC_AFTER_FIRST_TICK_VALUE);
  });

  test('after 35 runOneTic calls, gametic === 35 (one second at 35 Hz)', () => {
    const instance = buildReferenceCandidate().create();
    for (let i = 0; i < 35; i++) instance.runOneTic(() => {});
    expect(instance.gametic).toBe(AUDITED_GAMETIC_AFTER_ONE_SECOND_VALUE);
  });

  test('after 256 runOneTic calls, gametic === 256 (no byte wrap)', () => {
    const instance = buildReferenceCandidate().create();
    for (let i = 0; i < 256; i++) instance.runOneTic(() => {});
    expect(instance.gametic).toBe(AUDITED_GAMETIC_AFTER_256_TICS_VALUE);
  });

  test('after 35 * 60 * 60 = 126000 runOneTic calls (one game hour), gametic === 126000', () => {
    const instance = buildReferenceCandidate().create();
    const target = 35 * 60 * 60;
    for (let i = 0; i < target; i++) instance.runOneTic(() => {});
    expect(instance.gametic).toBe(target);
  });
});

describe('implement-game-tic-counter-ownership reference candidate — post-Ticker post-increment contract', () => {
  test('the ticker callback observes 0 during the first runOneTic call', () => {
    const instance = buildReferenceCandidate().create();
    let observed = -1;
    instance.runOneTic((current) => {
      observed = current;
    });
    expect(observed).toBe(AUDITED_GAMETIC_DURING_FIRST_TICKER_VALUE);
  });

  test('the ticker callback observes K-1 during the K-th runOneTic call (K=1..1000)', () => {
    for (const k of [1, 2, 3, 36, 100, 1000]) {
      const instance = buildReferenceCandidate().create();
      let observed = -1;
      for (let i = 1; i <= k; i++) {
        instance.runOneTic((current) => {
          if (i === k) observed = current;
        });
      }
      expect(observed).toBe(k - 1);
    }
  });

  test('the gametic getter inside the ticker callback agrees with the captured value', () => {
    const instance = buildReferenceCandidate().create();
    for (let i = 0; i < 5; i++) {
      let captured = -1;
      let getterValue = -2;
      instance.runOneTic((current) => {
        captured = current;
        getterValue = instance.gametic;
      });
      expect(captured).toBe(getterValue);
    }
  });

  test('after the ticker callback returns and runOneTic exits, gametic is incremented by exactly +1', () => {
    const instance = buildReferenceCandidate().create();
    for (let i = 0; i < 17; i++) {
      const before = instance.gametic;
      instance.runOneTic(() => {});
      const after = instance.gametic;
      expect(after - before).toBe(AUDITED_GAMETIC_INCREMENT_DELTA);
    }
  });
});

describe('implement-game-tic-counter-ownership reference candidate — invariants', () => {
  test('gametic is monotonic non-decreasing across 100 tics', () => {
    const instance = buildReferenceCandidate().create();
    let prev = instance.gametic;
    for (let i = 0; i < 100; i++) {
      instance.runOneTic(() => {});
      expect(instance.gametic).toBeGreaterThanOrEqual(prev);
      prev = instance.gametic;
    }
  });

  test('the captured ticker-observed sequence across N tics is exactly [0, 1, 2, ..., N-1]', () => {
    const instance = buildReferenceCandidate().create();
    const captured: number[] = [];
    for (let i = 0; i < 50; i++) {
      instance.runOneTic((current) => {
        captured.push(current);
      });
    }
    expect(captured.length).toBe(50);
    for (let i = 0; i < 50; i++) {
      expect(captured[i]).toBe(i);
    }
  });

  test('two reference candidate instances are independent', () => {
    const a = buildReferenceCandidate().create();
    const b = buildReferenceCandidate().create();
    for (let i = 0; i < 5; i++) a.runOneTic(() => {});
    expect(a.gametic).toBe(5);
    expect(b.gametic).toBe(0);
  });

  test('every observed gametic value is a non-negative integer', () => {
    const instance = buildReferenceCandidate().create();
    for (let i = 0; i < 30; i++) {
      instance.runOneTic((current) => {
        expect(Number.isInteger(current)).toBe(true);
        expect(current).toBeGreaterThanOrEqual(0);
      });
      expect(Number.isInteger(instance.gametic)).toBe(true);
      expect(instance.gametic).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('implement-game-tic-counter-ownership reference candidate — probe table', () => {
  test('every probe expected value matches the reference candidate output', () => {
    for (const probe of DOOM_GAME_TIC_PROBES) {
      const instance = buildReferenceCandidate().create();
      let observedDuringKthTicker: number | null = null;
      for (let k = 1; k <= probe.input.setupTicCount; k++) {
        instance.runOneTic((current) => {
          if (probe.input.observeTickerOfKthCall !== undefined && k === probe.input.observeTickerOfKthCall) {
            observedDuringKthTicker = current;
          }
        });
      }
      const actual = probe.target === 'gametic_after_n_tics' ? instance.gametic : (observedDuringKthTicker ?? Number.NaN);
      expect(actual).toBe(probe.expected);
    }
  });
});

describe('crossCheckDoomGameTicCounter on the reference candidate', () => {
  test('reports zero failures', () => {
    expect(crossCheckDoomGameTicCounter(buildReferenceCandidate())).toEqual([]);
  });
});

describe('crossCheckDoomGameTicCounter failure modes — tampered candidates', () => {
  test('detects a candidate whose initial gametic is 1 instead of 0', () => {
    const candidate: DoomGameTicCandidate = {
      create: () => {
        const state = { gametic: 1 };
        return {
          get gametic(): number {
            return state.gametic;
          },
          runOneTic(tickerCallback: (gameticDuringTicker: number) => void): void {
            tickerCallback(state.gametic);
            state.gametic += 1;
          },
        };
      },
    };
    const failures = crossCheckDoomGameTicCounter(candidate);
    expect(failures).toContain('invariant:GAMETIC_INITIALISES_TO_ZERO');
    expect(failures).toContain('probe:fresh_instance_gametic_is_zero');
    expect(failures).toContain('probe:after_one_tic_gametic_is_one');
    expect(failures).toContain('invariant:GAMETIC_OBSERVED_DURING_TICKER_EQUALS_PRE_INCREMENT_VALUE');
  });

  test('detects a candidate that pre-increments instead of post-increments', () => {
    const candidate: DoomGameTicCandidate = {
      create: () => {
        const state = { gametic: 0 };
        return {
          get gametic(): number {
            return state.gametic;
          },
          runOneTic(tickerCallback: (gameticDuringTicker: number) => void): void {
            state.gametic += 1;
            tickerCallback(state.gametic);
          },
        };
      },
    };
    const failures = crossCheckDoomGameTicCounter(candidate);
    expect(failures).toContain('invariant:GAMETIC_OBSERVED_DURING_TICKER_EQUALS_PRE_INCREMENT_VALUE');
    expect(failures).toContain('invariant:GAMETIC_TICKER_OBSERVED_VALUES_ARE_ZERO_INDEXED_SEQUENCE');
    expect(failures).toContain('invariant:GAMETIC_DURING_TICKER_OF_KTH_TIC_EQUALS_K_MINUS_ONE');
    expect(failures).toContain('probe:during_first_ticker_observed_gametic_is_zero');
  });

  test('detects a candidate that increments by 2 per tic', () => {
    const candidate: DoomGameTicCandidate = {
      create: () => {
        const state = { gametic: 0 };
        return {
          get gametic(): number {
            return state.gametic;
          },
          runOneTic(tickerCallback: (gameticDuringTicker: number) => void): void {
            tickerCallback(state.gametic);
            state.gametic += 2;
          },
        };
      },
    };
    const failures = crossCheckDoomGameTicCounter(candidate);
    expect(failures).toContain('invariant:GAMETIC_INCREMENT_IS_BY_EXACTLY_ONE_PER_TIC');
    expect(failures).toContain('invariant:GAMETIC_AFTER_N_TICS_EQUALS_N_FROM_FRESH_INSTANCE');
    expect(failures).toContain('probe:after_one_tic_gametic_is_one');
    expect(failures).toContain('probe:after_two_tics_gametic_is_two');
  });

  test('detects a candidate that does not increment at all (no-op)', () => {
    const candidate: DoomGameTicCandidate = {
      create: () => {
        const state = { gametic: 0 };
        return {
          get gametic(): number {
            return state.gametic;
          },
          runOneTic(tickerCallback: (gameticDuringTicker: number) => void): void {
            tickerCallback(state.gametic);
          },
        };
      },
    };
    const failures = crossCheckDoomGameTicCounter(candidate);
    expect(failures).toContain('invariant:GAMETIC_INCREMENT_IS_BY_EXACTLY_ONE_PER_TIC');
    expect(failures).toContain('invariant:GAMETIC_AFTER_N_TICS_EQUALS_N_FROM_FRESH_INSTANCE');
    expect(failures).toContain('invariant:GAMETIC_NOT_RESET_BY_REPEATED_TICKING');
    expect(failures).toContain('probe:after_one_tic_gametic_is_one');
  });

  test('detects a candidate that wraps at byte boundary (Uint8Array storage)', () => {
    const candidate: DoomGameTicCandidate = {
      create: () => {
        const state = new Uint8Array(1);
        return {
          get gametic(): number {
            return state[0] ?? 0;
          },
          runOneTic(tickerCallback: (gameticDuringTicker: number) => void): void {
            tickerCallback(state[0] ?? 0);
            state[0] = ((state[0] ?? 0) + 1) & 0xff;
          },
        };
      },
    };
    const failures = crossCheckDoomGameTicCounter(candidate);
    expect(failures).toContain('invariant:GAMETIC_AFTER_BYTE_BOUNDARY_DOES_NOT_WRAP');
    expect(failures).toContain('invariant:GAMETIC_SURVIVES_LARGE_COUNT_WITHOUT_PREMATURE_WRAP');
    expect(failures).toContain('probe:after_two_hundred_fifty_six_tics_gametic_is_two_hundred_fifty_six');
  });

  test('detects a candidate that resets gametic at the 35-tic boundary (per-second wrap)', () => {
    const candidate: DoomGameTicCandidate = {
      create: () => {
        const state = { gametic: 0 };
        return {
          get gametic(): number {
            return state.gametic;
          },
          runOneTic(tickerCallback: (gameticDuringTicker: number) => void): void {
            tickerCallback(state.gametic);
            state.gametic += 1;
            if (state.gametic >= 35) state.gametic = 0;
          },
        };
      },
    };
    const failures = crossCheckDoomGameTicCounter(candidate);
    expect(failures).toContain('invariant:GAMETIC_AFTER_TWO_SECONDS_EQUALS_SEVENTY');
    expect(failures).toContain('invariant:GAMETIC_NOT_RESET_BY_REPEATED_TICKING');
    expect(failures).toContain('probe:after_seventy_tics_gametic_is_seventy');
  });

  test('detects a candidate that uses a global static counter (two instances share state)', () => {
    let globalCounter = 0;
    const candidate: DoomGameTicCandidate = {
      create: () => {
        return {
          get gametic(): number {
            return globalCounter;
          },
          runOneTic(tickerCallback: (gameticDuringTicker: number) => void): void {
            tickerCallback(globalCounter);
            globalCounter += 1;
          },
        };
      },
    };
    const failures = crossCheckDoomGameTicCounter(candidate);
    expect(failures).toContain('invariant:GAMETIC_TWO_INSTANCES_ARE_INDEPENDENT');
  });

  test('detects a candidate that uses fractional increments', () => {
    const candidate: DoomGameTicCandidate = {
      create: () => {
        const state = { gametic: 0 };
        return {
          get gametic(): number {
            return state.gametic;
          },
          runOneTic(tickerCallback: (gameticDuringTicker: number) => void): void {
            tickerCallback(state.gametic);
            state.gametic += 0.5;
          },
        };
      },
    };
    const failures = crossCheckDoomGameTicCounter(candidate);
    expect(failures).toContain('invariant:GAMETIC_INCREMENT_IS_INTEGER_NEVER_FRACTIONAL');
    expect(failures).toContain('invariant:GAMETIC_INCREMENT_IS_BY_EXACTLY_ONE_PER_TIC');
  });

  test('detects a candidate that exposes the post-increment value via the getter inside the callback (incoherent contract)', () => {
    const candidate: DoomGameTicCandidate = {
      create: () => {
        const state = { gametic: 0 };
        return {
          get gametic(): number {
            return state.gametic;
          },
          runOneTic(tickerCallback: (gameticDuringTicker: number) => void): void {
            const before = state.gametic;
            state.gametic += 1;
            tickerCallback(before);
          },
        };
      },
    };
    const failures = crossCheckDoomGameTicCounter(candidate);
    expect(failures).toContain('invariant:GAMETIC_INCREMENT_OBSERVABLE_BEFORE_TICKER_RETURN_IS_FALSE');
  });

  test('detects a candidate whose monotonic sequence breaks (e.g. periodic decrement)', () => {
    const candidate: DoomGameTicCandidate = {
      create: () => {
        const state = { gametic: 0, calls: 0 };
        return {
          get gametic(): number {
            return state.gametic;
          },
          runOneTic(tickerCallback: (gameticDuringTicker: number) => void): void {
            tickerCallback(state.gametic);
            state.calls += 1;
            if (state.calls % 10 === 0) state.gametic = Math.max(0, state.gametic - 5);
            else state.gametic += 1;
          },
        };
      },
    };
    const failures = crossCheckDoomGameTicCounter(candidate);
    expect(failures).toContain('invariant:GAMETIC_NEVER_DECREASES_DURING_LIFETIME');
    expect(failures).toContain('invariant:GAMETIC_AFTER_N_TICS_EQUALS_N_FROM_FRESH_INSTANCE');
  });

  test('detects a candidate whose ticker observed value does not match the getter inside the callback', () => {
    const candidate: DoomGameTicCandidate = {
      create: () => {
        const state = { gametic: 0 };
        return {
          get gametic(): number {
            return state.gametic;
          },
          runOneTic(tickerCallback: (gameticDuringTicker: number) => void): void {
            // Tamper: pass a stale value to the callback while the getter reflects something different.
            const stale = state.gametic - 7;
            tickerCallback(stale);
            state.gametic += 1;
          },
        };
      },
    };
    const failures = crossCheckDoomGameTicCounter(candidate);
    expect(failures).toContain('invariant:GAMETIC_INCREMENT_OBSERVABLE_BEFORE_TICKER_RETURN_IS_FALSE');
  });
});

describe('implement-game-tic-counter-ownership step file', () => {
  test('declares the core lane and the implement-game-tic-counter-ownership write lock', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-009-implement-game-tic-counter-ownership.md').text();
    expect(stepText).toContain('## lane\n\ncore');
    expect(stepText).toContain('- src/core/implement-game-tic-counter-ownership.ts');
    expect(stepText).toContain('- test/vanilla_parity/core/implement-game-tic-counter-ownership.test.ts');
  });

  test('lists m_fixed.c, tables.c, d_main.c, and g_game.c as research sources', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-009-implement-game-tic-counter-ownership.md').text();
    expect(stepText).toContain('- m_fixed.c');
    expect(stepText).toContain('- tables.c');
    expect(stepText).toContain('- d_main.c');
    expect(stepText).toContain('- g_game.c');
  });

  test('declares 00-018 as the prerequisite', async () => {
    const stepText = await Bun.file('plan_vanilla_parity/steps/04-009-implement-game-tic-counter-ownership.md').text();
    expect(stepText).toContain('## prerequisites\n\n- 00-018');
  });
});
