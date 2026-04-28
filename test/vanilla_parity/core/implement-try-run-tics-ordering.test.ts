import { describe, expect, test } from 'bun:test';

import {
  AUDITED_BACKUPTICS,
  AUDITED_CHOCOLATE_MAX_NETGAME_STALL_TICS,
  AUDITED_CHOCOLATE_TRYRUNTICS_SOURCE_FILE,
  AUDITED_TICDUP_SINGLE_PLAYER,
  AUDITED_TRYRUNTICS_NETUPDATE_CALL_SITE_COUNT,
  AUDITED_TRYRUNTICS_PHASE_COUNTS_DECISION,
  AUDITED_TRYRUNTICS_PHASE_ENTERTIC_CAPTURE,
  AUDITED_TRYRUNTICS_PHASE_NETUPDATE_TOP,
  AUDITED_TRYRUNTICS_PHASE_OUTER_RUN_LOOP,
  AUDITED_TRYRUNTICS_PHASE_POST_INNER_NETUPDATE,
  AUDITED_TRYRUNTICS_PHASE_WAIT_LOOP,
  AUDITED_VANILLA_MAX_NETGAME_STALL_TICS,
  AUDITED_VANILLA_TRYRUNTICS_SOURCE_FILE,
  DOOM_TRY_RUN_TICS_ORDERING_AUDIT,
  DOOM_TRY_RUN_TICS_ORDERING_INVARIANTS,
  DOOM_TRY_RUN_TICS_ORDERING_PROBES,
  crossCheckDoomTryRunTicsOrdering,
} from '../../../src/core/implement-try-run-tics-ordering.ts';
import type {
  DoomTryRunTicsOrderingCandidate,
  DoomTryRunTicsOrderingCandidateInstance,
  DoomTryRunTicsOrderingFactId,
  DoomTryRunTicsOrderingInvariantId,
  DoomTryRunTicsOrderingProbeId,
  TryRunTicsCandidateCallbacks,
  TryRunTicsCandidateInput,
} from '../../../src/core/implement-try-run-tics-ordering.ts';

const ALL_FACT_IDS: Set<DoomTryRunTicsOrderingFactId> = new Set([
  'C_BODY_TRYRUNTICS_ENTERTIC_CAPTURE_BEFORE_NETUPDATE',
  'C_BODY_TRYRUNTICS_REALTICS_DELTA_FROM_OLDENTERTICS',
  'C_BODY_TRYRUNTICS_OLDENTERTICS_UPDATED_BEFORE_NETUPDATE',
  'C_BODY_TRYRUNTICS_NETUPDATE_AFTER_ENTERTIC_BEFORE_COUNTS',
  'C_BODY_TRYRUNTICS_AVAILABLETICS_FROM_LOWTIC_MINUS_GAMETIC',
  'C_BODY_TRYRUNTICS_VANILLA_OLD_SYNC_THREE_BRANCH_RULE',
  'C_BODY_TRYRUNTICS_CHOCOLATE_NEW_SYNC_COUNTS_EQUALS_AVAILABLETICS',
  'C_BODY_TRYRUNTICS_COUNTS_FLOORED_AT_ONE',
  'C_BODY_TRYRUNTICS_WAIT_LOOP_USES_NETUPDATE_AND_BAIL',
  'C_BODY_TRYRUNTICS_INNER_TICDUP_LOOP_FOUR_STEP_ORDER',
  'C_BODY_TRYRUNTICS_INNER_LOOP_GAMETIC_INCREMENT_AFTER_TICKER',
  'C_BODY_TRYRUNTICS_OUTER_NETUPDATE_AFTER_INNER_LOOP',
  'C_HEADER_LINUXDOOM_MAX_STALL_IS_TWENTY_TICS',
  'C_HEADER_CHOCOLATE_MAX_NETGAME_STALL_TICS_IS_FIVE',
  'C_HEADER_BACKUPTICS_IS_TWELVE',
  'C_BODY_NETUPDATE_INNER_NEWTICS_LOOP_STARTTIC_THEN_BUILDTICCMD',
  'C_BODY_NETUPDATE_BUFFER_OVERFLOW_GUARD',
  'C_BODY_TRYRUNTICS_TICDUP_ONE_FOR_SINGLE_PLAYER',
]);

const ALL_INVARIANT_IDS: Set<DoomTryRunTicsOrderingInvariantId> = new Set([
  'TRYRUNTICS_FRESH_INSTANCE_GAMETIC_IS_ZERO',
  'TRYRUNTICS_NO_CLOCK_ADVANCE_RUNS_NO_TICS',
  'TRYRUNTICS_ONE_TIC_PER_CLOCK_UNIT_AT_TICDUP_ONE',
  'TRYRUNTICS_NEWTIC_CALLBACK_ORDER_STARTTIC_THEN_BUILDTICCMD',
  'TRYRUNTICS_INNER_TIC_CALLBACK_ORDER_DEMO_THEN_TICKER',
  'TRYRUNTICS_NEWTICS_PROCESSED_BEFORE_INNER_TICKERS',
  'TRYRUNTICS_TICKER_OBSERVES_PRE_INCREMENT_GAMETIC',
  'TRYRUNTICS_GAMETIC_AFTER_K_TICS_FROM_FRESH_EQUALS_K',
  'TRYRUNTICS_GAMETIC_INCREMENT_IS_BY_EXACTLY_ONE_PER_INNER_TIC',
  'TRYRUNTICS_DOADVANCEDEMO_CALLED_ONLY_WHEN_FLAG_TRUE',
  'TRYRUNTICS_DOADVANCEDEMO_CALLED_BEFORE_TICKER',
  'TRYRUNTICS_TWO_INSTANCES_ARE_INDEPENDENT',
  'TRYRUNTICS_RETURNED_COUNT_EQUALS_TICKERS_RUN',
  'TRYRUNTICS_BACK_TO_BACK_CALLS_ACCUMULATE_GAMETIC',
  'TRYRUNTICS_NEWTICS_PER_CLOCK_DELTA_IS_LINEAR',
]);

const ALL_PROBE_IDS: Set<DoomTryRunTicsOrderingProbeId> = new Set([
  'fresh_clock_zero_runs_zero_tics',
  'clock_one_runs_one_tic',
  'clock_two_runs_two_tics',
  'clock_five_runs_five_tics',
  'clock_thirty_five_runs_thirty_five_tics',
  'clock_seventy_runs_seventy_tics',
  'clock_two_hundred_fifty_six_runs_two_hundred_fifty_six_tics',
  'clock_two_thousand_one_hundred_runs_two_thousand_one_hundred_tics',
  'advancedemo_false_skips_doAdvanceDemo',
  'advancedemo_true_calls_doAdvanceDemo_once_per_tic',
  'back_to_back_three_then_two_runs_total_five_tics',
  'back_to_back_alternating_demo_flag_invokes_demo_only_when_true',
]);

/**
 * Reference candidate that mirrors the canonical vanilla DOOM 1.9
 * TryRunTics ordering for the single-player ticdup=1 path: a
 * per-instance gametic and lastClock counter, a NetUpdate phase
 * that calls startTic-then-buildTiccmd per newtic, and a run-loop
 * phase that calls doAdvanceDemo (when flag set) then ticker per
 * inner tic, with gametic++ as the last per-iteration step.
 */
function buildReferenceCandidate(): DoomTryRunTicsOrderingCandidate {
  return {
    create: (): DoomTryRunTicsOrderingCandidateInstance => {
      const state = { gametic: 0, lastClock: 0 };
      return {
        get gametic(): number {
          return state.gametic;
        },
        tryRunTics(input: TryRunTicsCandidateInput, callbacks: TryRunTicsCandidateCallbacks): number {
          const newtics = input.currentClock - state.lastClock;
          state.lastClock = input.currentClock;
          if (newtics <= 0) return 0;
          for (let i = 0; i < newtics; i++) {
            callbacks.startTic();
            callbacks.buildTiccmd();
          }
          const availabletics = newtics;
          for (let i = 0; i < availabletics; i++) {
            if (input.advancedemoFlag) {
              callbacks.doAdvanceDemo();
            }
            callbacks.ticker(state.gametic);
            state.gametic += 1;
          }
          return availabletics;
        },
      };
    },
  };
}

describe('implement-try-run-tics-ordering audited canonical constants', () => {
  test('AUDITED_VANILLA_MAX_NETGAME_STALL_TICS is exactly 20 (linuxdoom inline literal)', () => {
    expect(AUDITED_VANILLA_MAX_NETGAME_STALL_TICS).toBe(20);
  });

  test('AUDITED_CHOCOLATE_MAX_NETGAME_STALL_TICS is exactly 5 (chocolate-doom 2.2.1 named macro)', () => {
    expect(AUDITED_CHOCOLATE_MAX_NETGAME_STALL_TICS).toBe(5);
  });

  test('AUDITED_BACKUPTICS is exactly 12 (shared across vanilla and chocolate)', () => {
    expect(AUDITED_BACKUPTICS).toBe(12);
  });

  test('AUDITED_TICDUP_SINGLE_PLAYER is exactly 1', () => {
    expect(AUDITED_TICDUP_SINGLE_PLAYER).toBe(1);
  });

  test('AUDITED_TRYRUNTICS_NETUPDATE_CALL_SITE_COUNT is exactly 3 (top + wait-loop + post-inner)', () => {
    expect(AUDITED_TRYRUNTICS_NETUPDATE_CALL_SITE_COUNT).toBe(3);
  });

  test('AUDITED_TRYRUNTICS_PHASE_ENTERTIC_CAPTURE is exactly 1 (first phase)', () => {
    expect(AUDITED_TRYRUNTICS_PHASE_ENTERTIC_CAPTURE).toBe(1);
  });

  test('AUDITED_TRYRUNTICS_PHASE_NETUPDATE_TOP is exactly 2 (after entertic capture)', () => {
    expect(AUDITED_TRYRUNTICS_PHASE_NETUPDATE_TOP).toBe(2);
  });

  test('AUDITED_TRYRUNTICS_PHASE_COUNTS_DECISION is exactly 3 (after NetUpdate)', () => {
    expect(AUDITED_TRYRUNTICS_PHASE_COUNTS_DECISION).toBe(3);
  });

  test('AUDITED_TRYRUNTICS_PHASE_WAIT_LOOP is exactly 4 (after counts decision)', () => {
    expect(AUDITED_TRYRUNTICS_PHASE_WAIT_LOOP).toBe(4);
  });

  test('AUDITED_TRYRUNTICS_PHASE_OUTER_RUN_LOOP is exactly 5 (after wait loop)', () => {
    expect(AUDITED_TRYRUNTICS_PHASE_OUTER_RUN_LOOP).toBe(5);
  });

  test('AUDITED_TRYRUNTICS_PHASE_POST_INNER_NETUPDATE is exactly 6 (after outer run loop)', () => {
    expect(AUDITED_TRYRUNTICS_PHASE_POST_INNER_NETUPDATE).toBe(6);
  });

  test('AUDITED_VANILLA_TRYRUNTICS_SOURCE_FILE is exactly linuxdoom-1.10/d_net.c', () => {
    expect(AUDITED_VANILLA_TRYRUNTICS_SOURCE_FILE).toBe('linuxdoom-1.10/d_net.c');
  });

  test('AUDITED_CHOCOLATE_TRYRUNTICS_SOURCE_FILE is exactly chocolate-doom-2.2.1/src/d_loop.c', () => {
    expect(AUDITED_CHOCOLATE_TRYRUNTICS_SOURCE_FILE).toBe('chocolate-doom-2.2.1/src/d_loop.c');
  });

  test('phase indices are strictly increasing 1 through 6', () => {
    expect(AUDITED_TRYRUNTICS_PHASE_ENTERTIC_CAPTURE).toBeLessThan(AUDITED_TRYRUNTICS_PHASE_NETUPDATE_TOP);
    expect(AUDITED_TRYRUNTICS_PHASE_NETUPDATE_TOP).toBeLessThan(AUDITED_TRYRUNTICS_PHASE_COUNTS_DECISION);
    expect(AUDITED_TRYRUNTICS_PHASE_COUNTS_DECISION).toBeLessThan(AUDITED_TRYRUNTICS_PHASE_WAIT_LOOP);
    expect(AUDITED_TRYRUNTICS_PHASE_WAIT_LOOP).toBeLessThan(AUDITED_TRYRUNTICS_PHASE_OUTER_RUN_LOOP);
    expect(AUDITED_TRYRUNTICS_PHASE_OUTER_RUN_LOOP).toBeLessThan(AUDITED_TRYRUNTICS_PHASE_POST_INNER_NETUPDATE);
  });
});

describe('implement-try-run-tics-ordering fact ledger shape', () => {
  test('audits exactly eighteen facts', () => {
    expect(DOOM_TRY_RUN_TICS_ORDERING_AUDIT.length).toBe(18);
  });

  test('every fact id is unique', () => {
    const ids = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.map((fact) => fact.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every fact id from the canonical set exactly once', () => {
    const ids = new Set(DOOM_TRY_RUN_TICS_ORDERING_AUDIT.map((fact) => fact.id));
    expect(ids).toEqual(ALL_FACT_IDS);
  });

  test('every fact carries a non-empty description and cReference', () => {
    for (const fact of DOOM_TRY_RUN_TICS_ORDERING_AUDIT) {
      expect(fact.description.length).toBeGreaterThan(0);
      expect(fact.cReference.length).toBeGreaterThan(0);
    }
  });

  test('every fact references one of the canonical upstream files', () => {
    const allowedFiles = new Set(['chocolate-doom-2.2.1/src/d_loop.c', 'chocolate-doom-2.2.1/src/d_loop.h', 'linuxdoom-1.10/d_net.c', 'linuxdoom-1.10/d_net.h', 'shared:vanilla+chocolate']);
    for (const fact of DOOM_TRY_RUN_TICS_ORDERING_AUDIT) {
      expect(allowedFiles.has(fact.referenceSourceFile)).toBe(true);
    }
  });

  test('every fact category is c-header or c-body', () => {
    for (const fact of DOOM_TRY_RUN_TICS_ORDERING_AUDIT) {
      expect(['c-header', 'c-body']).toContain(fact.category);
    }
  });
});

describe('implement-try-run-tics-ordering fact ledger values', () => {
  test('C_BODY_TRYRUNTICS_ENTERTIC_CAPTURE_BEFORE_NETUPDATE pins the I_GetTime/ticdup capture statement', () => {
    const fact = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.find((candidate) => candidate.id === 'C_BODY_TRYRUNTICS_ENTERTIC_CAPTURE_BEFORE_NETUPDATE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('I_GetTime');
    expect(fact?.cReference).toContain('ticdup');
    expect(fact?.referenceSourceFile).toBe('linuxdoom-1.10/d_net.c');
  });

  test('C_BODY_TRYRUNTICS_REALTICS_DELTA_FROM_OLDENTERTICS pins the realtics computation', () => {
    const fact = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.find((candidate) => candidate.id === 'C_BODY_TRYRUNTICS_REALTICS_DELTA_FROM_OLDENTERTICS');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('realtics = entertic - oldentertics;');
  });

  test('C_BODY_TRYRUNTICS_OLDENTERTICS_UPDATED_BEFORE_NETUPDATE pins the oldentertics assignment', () => {
    const fact = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.find((candidate) => candidate.id === 'C_BODY_TRYRUNTICS_OLDENTERTICS_UPDATED_BEFORE_NETUPDATE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('oldentertics = entertic;');
  });

  test('C_BODY_TRYRUNTICS_NETUPDATE_AFTER_ENTERTIC_BEFORE_COUNTS pins the top-of-function NetUpdate call', () => {
    const fact = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.find((candidate) => candidate.id === 'C_BODY_TRYRUNTICS_NETUPDATE_AFTER_ENTERTIC_BEFORE_COUNTS');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('NetUpdate ();');
  });

  test('C_BODY_TRYRUNTICS_AVAILABLETICS_FROM_LOWTIC_MINUS_GAMETIC pins the availabletics formula', () => {
    const fact = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.find((candidate) => candidate.id === 'C_BODY_TRYRUNTICS_AVAILABLETICS_FROM_LOWTIC_MINUS_GAMETIC');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('availabletics = lowtic - gametic/ticdup;');
  });

  test('C_BODY_TRYRUNTICS_VANILLA_OLD_SYNC_THREE_BRANCH_RULE pins the realtics-vs-availabletics three-branch rule', () => {
    const fact = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.find((candidate) => candidate.id === 'C_BODY_TRYRUNTICS_VANILLA_OLD_SYNC_THREE_BRANCH_RULE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('realtics+1');
    expect(fact?.cReference).toContain('realtics');
    expect(fact?.cReference).toContain('availabletics');
  });

  test('C_BODY_TRYRUNTICS_CHOCOLATE_NEW_SYNC_COUNTS_EQUALS_AVAILABLETICS pins the new_sync simplification', () => {
    const fact = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.find((candidate) => candidate.id === 'C_BODY_TRYRUNTICS_CHOCOLATE_NEW_SYNC_COUNTS_EQUALS_AVAILABLETICS');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('new_sync');
    expect(fact?.cReference).toContain('availabletics');
    expect(fact?.referenceSourceFile).toBe('chocolate-doom-2.2.1/src/d_loop.c');
  });

  test('C_BODY_TRYRUNTICS_COUNTS_FLOORED_AT_ONE pins the if (counts < 1) counts = 1 floor', () => {
    const fact = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.find((candidate) => candidate.id === 'C_BODY_TRYRUNTICS_COUNTS_FLOORED_AT_ONE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('if (counts < 1) counts = 1;');
    expect(fact?.referenceSourceFile).toBe('shared:vanilla+chocolate');
  });

  test('C_BODY_TRYRUNTICS_WAIT_LOOP_USES_NETUPDATE_AND_BAIL pins the wait-loop body', () => {
    const fact = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.find((candidate) => candidate.id === 'C_BODY_TRYRUNTICS_WAIT_LOOP_USES_NETUPDATE_AND_BAIL');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('NetUpdate');
    expect(fact?.cReference).toContain('MAX_NETGAME_STALL_TICS');
    expect(fact?.cReference).toContain('return');
  });

  test('C_BODY_TRYRUNTICS_INNER_TICDUP_LOOP_FOUR_STEP_ORDER pins the canonical four-step', () => {
    const fact = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.find((candidate) => candidate.id === 'C_BODY_TRYRUNTICS_INNER_TICDUP_LOOP_FOUR_STEP_ORDER');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('if (advancedemo) D_DoAdvanceDemo (); M_Ticker (); G_Ticker (); gametic++;');
  });

  test('C_BODY_TRYRUNTICS_INNER_LOOP_GAMETIC_INCREMENT_AFTER_TICKER pins the gametic++ placement', () => {
    const fact = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.find((candidate) => candidate.id === 'C_BODY_TRYRUNTICS_INNER_LOOP_GAMETIC_INCREMENT_AFTER_TICKER');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('gametic++;');
  });

  test('C_BODY_TRYRUNTICS_OUTER_NETUPDATE_AFTER_INNER_LOOP pins the trailing NetUpdate call with verbatim comment', () => {
    const fact = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.find((candidate) => candidate.id === 'C_BODY_TRYRUNTICS_OUTER_NETUPDATE_AFTER_INNER_LOOP');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('NetUpdate');
    expect(fact?.cReference).toContain('check for new console commands');
  });

  test('C_HEADER_LINUXDOOM_MAX_STALL_IS_TWENTY_TICS pins the inline literal 20', () => {
    const fact = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.find((candidate) => candidate.id === 'C_HEADER_LINUXDOOM_MAX_STALL_IS_TWENTY_TICS');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('>= 20');
    expect(fact?.referenceSourceFile).toBe('linuxdoom-1.10/d_net.c');
  });

  test('C_HEADER_CHOCOLATE_MAX_NETGAME_STALL_TICS_IS_FIVE pins the named-macro form', () => {
    const fact = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.find((candidate) => candidate.id === 'C_HEADER_CHOCOLATE_MAX_NETGAME_STALL_TICS_IS_FIVE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('#define MAX_NETGAME_STALL_TICS  5');
    expect(fact?.referenceSourceFile).toBe('chocolate-doom-2.2.1/src/d_loop.c');
  });

  test('C_HEADER_BACKUPTICS_IS_TWELVE pins the BACKUPTICS macro', () => {
    const fact = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.find((candidate) => candidate.id === 'C_HEADER_BACKUPTICS_IS_TWELVE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('#define BACKUPTICS 12');
  });

  test('C_BODY_NETUPDATE_INNER_NEWTICS_LOOP_STARTTIC_THEN_BUILDTICCMD pins the NetUpdate inner ordering', () => {
    const fact = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.find((candidate) => candidate.id === 'C_BODY_NETUPDATE_INNER_NEWTICS_LOOP_STARTTIC_THEN_BUILDTICCMD');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('I_StartTic');
    expect(fact?.cReference).toContain('D_ProcessEvents');
    expect(fact?.cReference).toContain('G_BuildTiccmd');
  });

  test('C_BODY_NETUPDATE_BUFFER_OVERFLOW_GUARD pins the BACKUPTICS-1 guard', () => {
    const fact = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.find((candidate) => candidate.id === 'C_BODY_NETUPDATE_BUFFER_OVERFLOW_GUARD');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('BACKUPTICS-1');
    expect(fact?.cReference).toContain('break');
  });

  test('C_BODY_TRYRUNTICS_TICDUP_ONE_FOR_SINGLE_PLAYER pins the inner ticdup loop header', () => {
    const fact = DOOM_TRY_RUN_TICS_ORDERING_AUDIT.find((candidate) => candidate.id === 'C_BODY_TRYRUNTICS_TICDUP_ONE_FOR_SINGLE_PLAYER');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('for (i=0 ; i<ticdup ; i++)');
  });
});

describe('implement-try-run-tics-ordering invariant ledger shape', () => {
  test('lists exactly fifteen operational invariants', () => {
    expect(DOOM_TRY_RUN_TICS_ORDERING_INVARIANTS.length).toBe(15);
  });

  test('every invariant id is unique', () => {
    const ids = DOOM_TRY_RUN_TICS_ORDERING_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every invariant id from the canonical set exactly once', () => {
    const ids = new Set(DOOM_TRY_RUN_TICS_ORDERING_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(ALL_INVARIANT_IDS);
  });

  test('every invariant carries a non-empty description', () => {
    for (const invariant of DOOM_TRY_RUN_TICS_ORDERING_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('implement-try-run-tics-ordering probe table shape', () => {
  test('lists exactly twelve probes', () => {
    expect(DOOM_TRY_RUN_TICS_ORDERING_PROBES.length).toBe(12);
  });

  test('every probe id is unique', () => {
    const ids = DOOM_TRY_RUN_TICS_ORDERING_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every probe id from the canonical set exactly once', () => {
    const ids = new Set(DOOM_TRY_RUN_TICS_ORDERING_PROBES.map((probe) => probe.id));
    expect(ids).toEqual(ALL_PROBE_IDS);
  });

  test('every probe carries a non-empty input.calls list', () => {
    for (const probe of DOOM_TRY_RUN_TICS_ORDERING_PROBES) {
      expect(probe.input.calls.length).toBeGreaterThan(0);
    }
  });

  test('every probe target is one of the four canonical kinds', () => {
    for (const probe of DOOM_TRY_RUN_TICS_ORDERING_PROBES) {
      expect(['cumulative_gametic_after_calls', 'callback_counts_after_call', 'returned_count_equals_inner_tics', 'doAdvanceDemo_count_after_call']).toContain(probe.target);
    }
  });

  test('every probe carries a non-empty note', () => {
    for (const probe of DOOM_TRY_RUN_TICS_ORDERING_PROBES) {
      expect(probe.note.length).toBeGreaterThan(0);
    }
  });
});

describe('implement-try-run-tics-ordering reference candidate cross-check', () => {
  test('the reference candidate honours every audited probe and invariant (no failures)', () => {
    const failures = crossCheckDoomTryRunTicsOrdering(buildReferenceCandidate());
    expect(failures).toEqual([]);
  });
});

describe('implement-try-run-tics-ordering tampered candidates fail with the expected ids', () => {
  test('candidate that pre-increments gametic before ticker fails the pre-increment invariant', () => {
    const tampered: DoomTryRunTicsOrderingCandidate = {
      create: () => {
        const state = { gametic: 0, lastClock: 0 };
        return {
          get gametic(): number {
            return state.gametic;
          },
          tryRunTics(input: TryRunTicsCandidateInput, callbacks: TryRunTicsCandidateCallbacks): number {
            const newtics = input.currentClock - state.lastClock;
            state.lastClock = input.currentClock;
            if (newtics <= 0) return 0;
            for (let i = 0; i < newtics; i++) {
              callbacks.startTic();
              callbacks.buildTiccmd();
            }
            for (let i = 0; i < newtics; i++) {
              if (input.advancedemoFlag) callbacks.doAdvanceDemo();
              state.gametic += 1; // PRE-INCREMENT (WRONG)
              callbacks.ticker(state.gametic);
            }
            return newtics;
          },
        };
      },
    };
    const failures = crossCheckDoomTryRunTicsOrdering(tampered);
    expect(failures).toContain('invariant:TRYRUNTICS_TICKER_OBSERVES_PRE_INCREMENT_GAMETIC');
  });

  test('candidate that swaps startTic and buildTiccmd fails the newtic-callback-order invariant', () => {
    const tampered: DoomTryRunTicsOrderingCandidate = {
      create: () => {
        const state = { gametic: 0, lastClock: 0 };
        return {
          get gametic(): number {
            return state.gametic;
          },
          tryRunTics(input: TryRunTicsCandidateInput, callbacks: TryRunTicsCandidateCallbacks): number {
            const newtics = input.currentClock - state.lastClock;
            state.lastClock = input.currentClock;
            if (newtics <= 0) return 0;
            for (let i = 0; i < newtics; i++) {
              callbacks.buildTiccmd(); // SWAPPED ORDER (WRONG)
              callbacks.startTic();
            }
            for (let i = 0; i < newtics; i++) {
              if (input.advancedemoFlag) callbacks.doAdvanceDemo();
              callbacks.ticker(state.gametic);
              state.gametic += 1;
            }
            return newtics;
          },
        };
      },
    };
    const failures = crossCheckDoomTryRunTicsOrdering(tampered);
    expect(failures).toContain('invariant:TRYRUNTICS_NEWTIC_CALLBACK_ORDER_STARTTIC_THEN_BUILDTICCMD');
  });

  test('candidate that calls ticker before doAdvanceDemo fails the inner-tic-callback-order invariant', () => {
    const tampered: DoomTryRunTicsOrderingCandidate = {
      create: () => {
        const state = { gametic: 0, lastClock: 0 };
        return {
          get gametic(): number {
            return state.gametic;
          },
          tryRunTics(input: TryRunTicsCandidateInput, callbacks: TryRunTicsCandidateCallbacks): number {
            const newtics = input.currentClock - state.lastClock;
            state.lastClock = input.currentClock;
            if (newtics <= 0) return 0;
            for (let i = 0; i < newtics; i++) {
              callbacks.startTic();
              callbacks.buildTiccmd();
            }
            for (let i = 0; i < newtics; i++) {
              callbacks.ticker(state.gametic); // SWAPPED ORDER (WRONG): ticker before doAdvanceDemo
              if (input.advancedemoFlag) callbacks.doAdvanceDemo();
              state.gametic += 1;
            }
            return newtics;
          },
        };
      },
    };
    const failures = crossCheckDoomTryRunTicsOrdering(tampered);
    expect(failures).toContain('invariant:TRYRUNTICS_INNER_TIC_CALLBACK_ORDER_DEMO_THEN_TICKER');
  });

  test('candidate that interleaves NetUpdate-phase and run-loop callbacks fails the newtics-before-tickers invariant', () => {
    const tampered: DoomTryRunTicsOrderingCandidate = {
      create: () => {
        const state = { gametic: 0, lastClock: 0 };
        return {
          get gametic(): number {
            return state.gametic;
          },
          tryRunTics(input: TryRunTicsCandidateInput, callbacks: TryRunTicsCandidateCallbacks): number {
            const newtics = input.currentClock - state.lastClock;
            state.lastClock = input.currentClock;
            if (newtics <= 0) return 0;
            // INTERLEAVED (WRONG): startTic, buildTiccmd, ticker per inner tic.
            for (let i = 0; i < newtics; i++) {
              callbacks.startTic();
              callbacks.buildTiccmd();
              if (input.advancedemoFlag) callbacks.doAdvanceDemo();
              callbacks.ticker(state.gametic);
              state.gametic += 1;
            }
            return newtics;
          },
        };
      },
    };
    const failures = crossCheckDoomTryRunTicsOrdering(tampered);
    expect(failures).toContain('invariant:TRYRUNTICS_NEWTICS_PROCESSED_BEFORE_INNER_TICKERS');
  });

  test('candidate that double-increments gametic per inner tic fails the increment-by-one invariant', () => {
    const tampered: DoomTryRunTicsOrderingCandidate = {
      create: () => {
        const state = { gametic: 0, lastClock: 0 };
        return {
          get gametic(): number {
            return state.gametic;
          },
          tryRunTics(input: TryRunTicsCandidateInput, callbacks: TryRunTicsCandidateCallbacks): number {
            const newtics = input.currentClock - state.lastClock;
            state.lastClock = input.currentClock;
            if (newtics <= 0) return 0;
            for (let i = 0; i < newtics; i++) {
              callbacks.startTic();
              callbacks.buildTiccmd();
            }
            for (let i = 0; i < newtics; i++) {
              if (input.advancedemoFlag) callbacks.doAdvanceDemo();
              callbacks.ticker(state.gametic);
              state.gametic += 2; // DOUBLE INCREMENT (WRONG)
            }
            return newtics;
          },
        };
      },
    };
    const failures = crossCheckDoomTryRunTicsOrdering(tampered);
    expect(failures).toContain('invariant:TRYRUNTICS_GAMETIC_INCREMENT_IS_BY_EXACTLY_ONE_PER_INNER_TIC');
  });

  test('candidate that ignores advancedemoFlag (always calls doAdvanceDemo) fails the demo-only-when-flag-true invariant', () => {
    const tampered: DoomTryRunTicsOrderingCandidate = {
      create: () => {
        const state = { gametic: 0, lastClock: 0 };
        return {
          get gametic(): number {
            return state.gametic;
          },
          tryRunTics(input: TryRunTicsCandidateInput, callbacks: TryRunTicsCandidateCallbacks): number {
            const newtics = input.currentClock - state.lastClock;
            state.lastClock = input.currentClock;
            if (newtics <= 0) return 0;
            for (let i = 0; i < newtics; i++) {
              callbacks.startTic();
              callbacks.buildTiccmd();
            }
            for (let i = 0; i < newtics; i++) {
              callbacks.doAdvanceDemo(); // ALWAYS CALLED, IGNORES FLAG (WRONG)
              callbacks.ticker(state.gametic);
              state.gametic += 1;
            }
            return newtics;
          },
        };
      },
    };
    const failures = crossCheckDoomTryRunTicsOrdering(tampered);
    expect(failures).toContain('invariant:TRYRUNTICS_DOADVANCEDEMO_CALLED_ONLY_WHEN_FLAG_TRUE');
  });

  test('candidate that resets oldentertics every call fails the back-to-back accumulation invariant', () => {
    const tampered: DoomTryRunTicsOrderingCandidate = {
      create: () => {
        const state = { gametic: 0 };
        return {
          get gametic(): number {
            return state.gametic;
          },
          tryRunTics(input: TryRunTicsCandidateInput, callbacks: TryRunTicsCandidateCallbacks): number {
            const newtics = input.currentClock; // NO oldentertics — treats every call as fresh (WRONG)
            if (newtics <= 0) return 0;
            for (let i = 0; i < newtics; i++) {
              callbacks.startTic();
              callbacks.buildTiccmd();
            }
            for (let i = 0; i < newtics; i++) {
              if (input.advancedemoFlag) callbacks.doAdvanceDemo();
              callbacks.ticker(state.gametic);
              state.gametic += 1;
            }
            return newtics;
          },
        };
      },
    };
    const failures = crossCheckDoomTryRunTicsOrdering(tampered);
    expect(failures).toContain('invariant:TRYRUNTICS_BACK_TO_BACK_CALLS_ACCUMULATE_GAMETIC');
  });

  test('candidate with shared state across instances fails the two-instances-independent invariant', () => {
    const sharedState = { gametic: 0, lastClock: 0 };
    const tampered: DoomTryRunTicsOrderingCandidate = {
      create: () => ({
        get gametic(): number {
          return sharedState.gametic;
        },
        tryRunTics(input: TryRunTicsCandidateInput, callbacks: TryRunTicsCandidateCallbacks): number {
          const newtics = input.currentClock - sharedState.lastClock;
          sharedState.lastClock = input.currentClock;
          if (newtics <= 0) return 0;
          for (let i = 0; i < newtics; i++) {
            callbacks.startTic();
            callbacks.buildTiccmd();
          }
          for (let i = 0; i < newtics; i++) {
            if (input.advancedemoFlag) callbacks.doAdvanceDemo();
            callbacks.ticker(sharedState.gametic);
            sharedState.gametic += 1;
          }
          return newtics;
        },
      }),
    };
    const failures = crossCheckDoomTryRunTicsOrdering(tampered);
    expect(failures).toContain('invariant:TRYRUNTICS_TWO_INSTANCES_ARE_INDEPENDENT');
  });

  test('candidate that returns 0 instead of the count fails the returned-count invariant', () => {
    const tampered: DoomTryRunTicsOrderingCandidate = {
      create: () => {
        const state = { gametic: 0, lastClock: 0 };
        return {
          get gametic(): number {
            return state.gametic;
          },
          tryRunTics(input: TryRunTicsCandidateInput, callbacks: TryRunTicsCandidateCallbacks): number {
            const newtics = input.currentClock - state.lastClock;
            state.lastClock = input.currentClock;
            if (newtics <= 0) return 0;
            for (let i = 0; i < newtics; i++) {
              callbacks.startTic();
              callbacks.buildTiccmd();
            }
            for (let i = 0; i < newtics; i++) {
              if (input.advancedemoFlag) callbacks.doAdvanceDemo();
              callbacks.ticker(state.gametic);
              state.gametic += 1;
            }
            return 0; // ALWAYS ZERO (WRONG)
          },
        };
      },
    };
    const failures = crossCheckDoomTryRunTicsOrdering(tampered);
    expect(failures).toContain('invariant:TRYRUNTICS_RETURNED_COUNT_EQUALS_TICKERS_RUN');
  });

  test('candidate that initialises gametic to 1 fails the fresh-instance-gametic-zero invariant', () => {
    const tampered: DoomTryRunTicsOrderingCandidate = {
      create: () => {
        const state = { gametic: 1, lastClock: 0 }; // NONZERO INITIAL (WRONG)
        return {
          get gametic(): number {
            return state.gametic;
          },
          tryRunTics(input: TryRunTicsCandidateInput, callbacks: TryRunTicsCandidateCallbacks): number {
            const newtics = input.currentClock - state.lastClock;
            state.lastClock = input.currentClock;
            if (newtics <= 0) return 0;
            for (let i = 0; i < newtics; i++) {
              callbacks.startTic();
              callbacks.buildTiccmd();
            }
            for (let i = 0; i < newtics; i++) {
              if (input.advancedemoFlag) callbacks.doAdvanceDemo();
              callbacks.ticker(state.gametic);
              state.gametic += 1;
            }
            return newtics;
          },
        };
      },
    };
    const failures = crossCheckDoomTryRunTicsOrdering(tampered);
    expect(failures).toContain('invariant:TRYRUNTICS_FRESH_INSTANCE_GAMETIC_IS_ZERO');
  });
});
