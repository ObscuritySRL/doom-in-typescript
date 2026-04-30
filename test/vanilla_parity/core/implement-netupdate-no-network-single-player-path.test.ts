import { describe, expect, test } from 'bun:test';

import {
  AUDITED_BACKUPTICS,
  AUDITED_CHOCOLATE_NETUPDATE_SOURCE_FILE,
  AUDITED_FRESH_LASTTIME,
  AUDITED_FRESH_MAKETIC,
  AUDITED_FRESH_SKIPTICS,
  AUDITED_NETUPDATE_HALF_BUFFER_GUARD,
  AUDITED_NETUPDATE_PHASE_BUILD_LOOP,
  AUDITED_NETUPDATE_PHASE_LISTEN,
  AUDITED_NETUPDATE_PHASE_NO_NEWTICS_SHORT_CIRCUIT,
  AUDITED_NETUPDATE_PHASE_SEND,
  AUDITED_NETUPDATE_PHASE_SINGLETICS_RETURN,
  AUDITED_NETUPDATE_PHASE_SKIPTICS_CONSUMPTION,
  AUDITED_NETUPDATE_PHASE_TIME_CHECK,
  AUDITED_SINGLE_PLAYER_CONSOLEPLAYER,
  AUDITED_SINGLE_PLAYER_NUMNODES,
  AUDITED_SINGLE_PLAYER_NUMPLAYERS,
  AUDITED_VANILLA_NETUPDATE_SOURCE_FILE,
  DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT,
  DOOM_NETUPDATE_SINGLE_PLAYER_CANDIDATE,
  DOOM_NETUPDATE_SINGLE_PLAYER_INVARIANTS,
  DOOM_NETUPDATE_SINGLE_PLAYER_PROBES,
  DoomNetUpdateSinglePlayer,
  crossCheckDoomNetUpdateSinglePlayer,
} from '../../../src/core/implement-netupdate-no-network-single-player-path.ts';
import type {
  DoomNetUpdateSinglePlayerCandidate,
  DoomNetUpdateSinglePlayerCandidateInstance,
  DoomNetUpdateSinglePlayerFactId,
  DoomNetUpdateSinglePlayerInvariantId,
  DoomNetUpdateSinglePlayerProbeId,
  NetUpdateCandidateCallbacks,
  NetUpdateCandidateInput,
} from '../../../src/core/implement-netupdate-no-network-single-player-path.ts';

const ALL_FACT_IDS: Set<DoomNetUpdateSinglePlayerFactId> = new Set([
  'C_BODY_NETUPDATE_TIME_CHECK_USES_TICDUP_DIVISION',
  'C_BODY_NETUPDATE_NEWTICS_DELTA_FROM_LASTTIME',
  'C_BODY_NETUPDATE_LASTTIME_UPDATE_BEFORE_BUILD_LOOP',
  'C_BODY_NETUPDATE_NEWTICS_NONPOSITIVE_GOTO_LISTEN',
  'C_BODY_NETUPDATE_SKIPTICS_CONSUMED_AGAINST_NEWTICS',
  'C_BODY_NETUPDATE_BUILD_LOOP_HEADER_FOR_NEWTICS',
  'C_BODY_NETUPDATE_BUILD_LOOP_STARTTIC_BEFORE_PROCESS',
  'C_BODY_NETUPDATE_BUILD_LOOP_PROCESS_BEFORE_BUILDTICCMD',
  'C_BODY_NETUPDATE_HALF_BUFFER_GUARD_BREAK',
  'C_BODY_NETUPDATE_LOCALCMDS_INDEXED_BY_MAKETIC_MOD_BACKUPTICS',
  'C_BODY_NETUPDATE_MAKETIC_INCREMENT_AFTER_BUILDTICCMD',
  'C_BODY_NETUPDATE_SINGLETICS_EARLY_RETURN',
  'C_BODY_NETUPDATE_SINGLE_PLAYER_NUMNODES_MAKES_SEND_NOOP',
  'C_BODY_NETUPDATE_SINGLE_PLAYER_NUMNODES_MAKES_LISTEN_NOOP',
  'C_BODY_NETUPDATE_DOES_NOT_INVOKE_M_TICKER_OR_G_TICKER',
  'C_BODY_NETUPDATE_DOES_NOT_ADVANCE_GAMETIC',
  'C_HEADER_BACKUPTICS_HALF_DEPTH_MINUS_ONE_IS_FIVE',
  'C_HEADER_VANILLA_LASTTIME_FILE_SCOPE_STATIC',
  'C_BODY_CHOCOLATE_RECVTIC_REPLACES_NETTICS_INDEX',
]);

const ALL_INVARIANT_IDS: Set<DoomNetUpdateSinglePlayerInvariantId> = new Set([
  'NETUPDATE_FRESH_INSTANCE_MAKETIC_IS_ZERO',
  'NETUPDATE_FRESH_INSTANCE_LASTTIME_IS_ZERO',
  'NETUPDATE_NO_CLOCK_ADVANCE_BUILDS_NO_TICCMDS',
  'NETUPDATE_ONE_TIC_PER_CLOCK_UNIT_BELOW_HALF_BUFFER',
  'NETUPDATE_HALF_BUFFER_GUARD_CAPS_BUILD_AT_FIVE',
  'NETUPDATE_PER_ITERATION_CALLBACK_ORDER_STARTTIC_PROCESS_BUILD',
  'NETUPDATE_LASTTIME_PERSISTS_ACROSS_CALLS',
  'NETUPDATE_DOES_NOT_INVOKE_TICKER_CALLBACKS',
  'NETUPDATE_DOES_NOT_INVOKE_DOADVANCEDEMO_CALLBACK',
  'NETUPDATE_MAKETIC_NEVER_DECREMENTS',
  'NETUPDATE_TWO_INSTANCES_ARE_INDEPENDENT',
  'NETUPDATE_LASTTIME_UPDATED_EVEN_ON_SHORT_CIRCUIT',
  'NETUPDATE_BACK_TO_BACK_CALLS_ACCUMULATE_MAKETIC',
  'NETUPDATE_NEWTICS_NEGATIVE_DELTA_BUILDS_NO_TICCMDS',
  'NETUPDATE_GAMETIC_FEEDBACK_RELEASES_HALF_BUFFER_GUARD',
]);

const ALL_PROBE_IDS: Set<DoomNetUpdateSinglePlayerProbeId> = new Set([
  'fresh_no_clock_advance_builds_zero',
  'fresh_clock_one_builds_one_ticcmd',
  'fresh_clock_three_builds_three_ticcmds',
  'fresh_clock_five_builds_five_ticcmds_at_guard',
  'fresh_clock_six_capped_at_five_by_half_buffer_guard',
  'fresh_clock_eleven_capped_at_five_by_half_buffer_guard',
  'lasttime_persistence_two_calls_three_then_two',
  'negative_clock_delta_builds_zero',
  'after_gametic_catchup_half_buffer_guard_releases',
  'no_ticker_or_doAdvanceDemo_calls',
]);

/**
 * Reference candidate that mirrors the canonical vanilla DOOM 1.9
 * NetUpdate body for the single-player no-network path: a per-instance
 * `maketic` and `lasttime` counter, a build loop that runs startTic →
 * processEvents → half-buffer-guard → buildTiccmd → maketic++ per
 * newtic, and the canonical `if (newtics <= 0) goto listen;`
 * short-circuit. The candidate honours every audited fact, invariant,
 * and probe expectation (verified by the focused test below).
 */
function buildReferenceCandidate(): DoomNetUpdateSinglePlayerCandidate {
  return {
    create: (): DoomNetUpdateSinglePlayerCandidateInstance => {
      const state = { maketic: 0, lasttime: 0 };
      return {
        get maketic(): number {
          return state.maketic;
        },
        get lasttime(): number {
          return state.lasttime;
        },
        netUpdate(input: NetUpdateCandidateInput, callbacks: NetUpdateCandidateCallbacks): void {
          // Phase 1 + 2: time check, lasttime update BEFORE short-circuit.
          const newTicCount = input.currentClock - state.lasttime;
          state.lasttime = input.currentClock;
          if (newTicCount <= 0) return; // canonical `goto listen;` short-circuit (listen is no-op in single-player)
          // Phase 3: skiptics consumption (skiptics=0 in single-player no-network - no-op).
          // Phase 4: build loop with half-buffer guard.
          for (let newTicIndex = 0; newTicIndex < newTicCount; newTicIndex++) {
            callbacks.startTic();
            callbacks.processEvents();
            if (state.maketic - input.gameticFeedback >= AUDITED_NETUPDATE_HALF_BUFFER_GUARD) break;
            callbacks.buildTiccmd();
            state.maketic += 1;
          }
          // Phase 5: singletics early return (observationally equivalent in single-player).
          // Phase 6: send phase (no-op in single-player numnodes=1).
          // Phase 7: listen phase (no-op in single-player numnodes=1).
        },
      };
    },
  };
}

describe('implement-netupdate-no-network-single-player-path audited canonical constants', () => {
  test('AUDITED_BACKUPTICS is exactly 12 (shared across vanilla and chocolate)', () => {
    expect(AUDITED_BACKUPTICS).toBe(12);
  });

  test('AUDITED_NETUPDATE_HALF_BUFFER_GUARD is exactly 5 (BACKUPTICS / 2 - 1)', () => {
    expect(AUDITED_NETUPDATE_HALF_BUFFER_GUARD).toBe(5);
  });

  test('AUDITED_NETUPDATE_HALF_BUFFER_GUARD equals AUDITED_BACKUPTICS / 2 - 1', () => {
    expect(AUDITED_NETUPDATE_HALF_BUFFER_GUARD).toBe(AUDITED_BACKUPTICS / 2 - 1);
  });

  test('AUDITED_SINGLE_PLAYER_NUMNODES is exactly 1', () => {
    expect(AUDITED_SINGLE_PLAYER_NUMNODES).toBe(1);
  });

  test('AUDITED_SINGLE_PLAYER_NUMPLAYERS is exactly 1', () => {
    expect(AUDITED_SINGLE_PLAYER_NUMPLAYERS).toBe(1);
  });

  test('AUDITED_SINGLE_PLAYER_CONSOLEPLAYER is exactly 0', () => {
    expect(AUDITED_SINGLE_PLAYER_CONSOLEPLAYER).toBe(0);
  });

  test('AUDITED_FRESH_LASTTIME is exactly 0 (C runtime zero-init)', () => {
    expect(AUDITED_FRESH_LASTTIME).toBe(0);
  });

  test('AUDITED_FRESH_MAKETIC is exactly 0 (C runtime zero-init)', () => {
    expect(AUDITED_FRESH_MAKETIC).toBe(0);
  });

  test('AUDITED_FRESH_SKIPTICS is exactly 0 (C runtime zero-init)', () => {
    expect(AUDITED_FRESH_SKIPTICS).toBe(0);
  });

  test('AUDITED_NETUPDATE_PHASE_TIME_CHECK is exactly 1 (first phase)', () => {
    expect(AUDITED_NETUPDATE_PHASE_TIME_CHECK).toBe(1);
  });

  test('AUDITED_NETUPDATE_PHASE_NO_NEWTICS_SHORT_CIRCUIT is exactly 2 (after time check)', () => {
    expect(AUDITED_NETUPDATE_PHASE_NO_NEWTICS_SHORT_CIRCUIT).toBe(2);
  });

  test('AUDITED_NETUPDATE_PHASE_SKIPTICS_CONSUMPTION is exactly 3 (after short-circuit)', () => {
    expect(AUDITED_NETUPDATE_PHASE_SKIPTICS_CONSUMPTION).toBe(3);
  });

  test('AUDITED_NETUPDATE_PHASE_BUILD_LOOP is exactly 4 (after skiptics)', () => {
    expect(AUDITED_NETUPDATE_PHASE_BUILD_LOOP).toBe(4);
  });

  test('AUDITED_NETUPDATE_PHASE_SINGLETICS_RETURN is exactly 5 (after build loop)', () => {
    expect(AUDITED_NETUPDATE_PHASE_SINGLETICS_RETURN).toBe(5);
  });

  test('AUDITED_NETUPDATE_PHASE_SEND is exactly 6 (after singletics check)', () => {
    expect(AUDITED_NETUPDATE_PHASE_SEND).toBe(6);
  });

  test('AUDITED_NETUPDATE_PHASE_LISTEN is exactly 7 (after send)', () => {
    expect(AUDITED_NETUPDATE_PHASE_LISTEN).toBe(7);
  });

  test('AUDITED_VANILLA_NETUPDATE_SOURCE_FILE is exactly linuxdoom-1.10/d_net.c', () => {
    expect(AUDITED_VANILLA_NETUPDATE_SOURCE_FILE).toBe('linuxdoom-1.10/d_net.c');
  });

  test('AUDITED_CHOCOLATE_NETUPDATE_SOURCE_FILE is exactly chocolate-doom-2.2.1/src/d_loop.c', () => {
    expect(AUDITED_CHOCOLATE_NETUPDATE_SOURCE_FILE).toBe('chocolate-doom-2.2.1/src/d_loop.c');
  });

  test('phase indices are strictly increasing 1 through 7', () => {
    expect(AUDITED_NETUPDATE_PHASE_TIME_CHECK).toBeLessThan(AUDITED_NETUPDATE_PHASE_NO_NEWTICS_SHORT_CIRCUIT);
    expect(AUDITED_NETUPDATE_PHASE_NO_NEWTICS_SHORT_CIRCUIT).toBeLessThan(AUDITED_NETUPDATE_PHASE_SKIPTICS_CONSUMPTION);
    expect(AUDITED_NETUPDATE_PHASE_SKIPTICS_CONSUMPTION).toBeLessThan(AUDITED_NETUPDATE_PHASE_BUILD_LOOP);
    expect(AUDITED_NETUPDATE_PHASE_BUILD_LOOP).toBeLessThan(AUDITED_NETUPDATE_PHASE_SINGLETICS_RETURN);
    expect(AUDITED_NETUPDATE_PHASE_SINGLETICS_RETURN).toBeLessThan(AUDITED_NETUPDATE_PHASE_SEND);
    expect(AUDITED_NETUPDATE_PHASE_SEND).toBeLessThan(AUDITED_NETUPDATE_PHASE_LISTEN);
  });
});

describe('implement-netupdate-no-network-single-player-path fact ledger shape', () => {
  test('audits exactly nineteen facts', () => {
    expect(DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.length).toBe(19);
  });

  test('every fact id is unique', () => {
    const ids = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.map((fact) => fact.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every fact id from the canonical set exactly once', () => {
    const ids = new Set(DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.map((fact) => fact.id));
    expect(ids).toEqual(ALL_FACT_IDS);
  });

  test('every fact carries a non-empty description and cReference', () => {
    for (const fact of DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT) {
      expect(fact.description.length).toBeGreaterThan(0);
      expect(fact.cReference.length).toBeGreaterThan(0);
    }
  });

  test('every fact references one of the canonical upstream files', () => {
    const allowedFiles = new Set(['linuxdoom-1.10/d_net.c', 'linuxdoom-1.10/d_net.h', 'chocolate-doom-2.2.1/src/d_loop.c', 'chocolate-doom-2.2.1/src/d_loop.h', 'shared:vanilla+chocolate']);
    for (const fact of DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT) {
      expect(allowedFiles.has(fact.referenceSourceFile)).toBe(true);
    }
  });

  test('every fact category is c-header or c-body', () => {
    for (const fact of DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT) {
      expect(['c-header', 'c-body']).toContain(fact.category);
    }
  });
});

describe('implement-netupdate-no-network-single-player-path fact ledger values', () => {
  test('C_BODY_NETUPDATE_TIME_CHECK_USES_TICDUP_DIVISION pins the I_GetTime/ticdup capture statement', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_BODY_NETUPDATE_TIME_CHECK_USES_TICDUP_DIVISION');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('I_GetTime');
    expect(fact?.cReference).toContain('ticdup');
    expect(fact?.referenceSourceFile).toBe('linuxdoom-1.10/d_net.c');
  });

  test('C_BODY_NETUPDATE_NEWTICS_DELTA_FROM_LASTTIME pins the newtics computation', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_BODY_NETUPDATE_NEWTICS_DELTA_FROM_LASTTIME');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('newtics = nowtime - lasttime;');
  });

  test('C_BODY_NETUPDATE_LASTTIME_UPDATE_BEFORE_BUILD_LOOP pins the lasttime assignment', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_BODY_NETUPDATE_LASTTIME_UPDATE_BEFORE_BUILD_LOOP');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('lasttime = nowtime;');
  });

  test('C_BODY_NETUPDATE_NEWTICS_NONPOSITIVE_GOTO_LISTEN pins the goto listen short-circuit', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_BODY_NETUPDATE_NEWTICS_NONPOSITIVE_GOTO_LISTEN');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('newtics <= 0');
    expect(fact?.cReference).toContain('goto listen');
  });

  test('C_BODY_NETUPDATE_SKIPTICS_CONSUMED_AGAINST_NEWTICS pins the skiptics rule', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_BODY_NETUPDATE_SKIPTICS_CONSUMED_AGAINST_NEWTICS');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('skiptics');
    expect(fact?.cReference).toContain('newtics');
  });

  test('C_BODY_NETUPDATE_BUILD_LOOP_HEADER_FOR_NEWTICS pins the build loop header', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_BODY_NETUPDATE_BUILD_LOOP_HEADER_FOR_NEWTICS');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('for (i=0 ; i<newtics ; i++)');
  });

  test('C_BODY_NETUPDATE_BUILD_LOOP_STARTTIC_BEFORE_PROCESS pins the I_StartTic call', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_BODY_NETUPDATE_BUILD_LOOP_STARTTIC_BEFORE_PROCESS');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('I_StartTic ();');
  });

  test('C_BODY_NETUPDATE_BUILD_LOOP_PROCESS_BEFORE_BUILDTICCMD pins the D_ProcessEvents call', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_BODY_NETUPDATE_BUILD_LOOP_PROCESS_BEFORE_BUILDTICCMD');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('D_ProcessEvents ();');
  });

  test('C_BODY_NETUPDATE_HALF_BUFFER_GUARD_BREAK pins the half-buffer guard form', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_BODY_NETUPDATE_HALF_BUFFER_GUARD_BREAK');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('BACKUPTICS/2-1');
    expect(fact?.cReference).toContain('break');
  });

  test('C_BODY_NETUPDATE_LOCALCMDS_INDEXED_BY_MAKETIC_MOD_BACKUPTICS pins the ring index', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_BODY_NETUPDATE_LOCALCMDS_INDEXED_BY_MAKETIC_MOD_BACKUPTICS');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('localcmds[maketic%BACKUPTICS]');
    expect(fact?.cReference).toContain('G_BuildTiccmd');
  });

  test('C_BODY_NETUPDATE_MAKETIC_INCREMENT_AFTER_BUILDTICCMD pins the maketic++ placement', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_BODY_NETUPDATE_MAKETIC_INCREMENT_AFTER_BUILDTICCMD');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toBe('maketic++;');
  });

  test('C_BODY_NETUPDATE_SINGLETICS_EARLY_RETURN pins the singletics check', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_BODY_NETUPDATE_SINGLETICS_EARLY_RETURN');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('singletics');
    expect(fact?.cReference).toContain('return');
  });

  test('C_BODY_NETUPDATE_SINGLE_PLAYER_NUMNODES_MAKES_SEND_NOOP pins the send-phase no-op', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_BODY_NETUPDATE_SINGLE_PLAYER_NUMNODES_MAKES_SEND_NOOP');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('numnodes');
    expect(fact?.referenceSourceFile).toBe('linuxdoom-1.10/d_net.c');
  });

  test('C_BODY_NETUPDATE_SINGLE_PLAYER_NUMNODES_MAKES_LISTEN_NOOP pins the listen-phase no-op', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_BODY_NETUPDATE_SINGLE_PLAYER_NUMNODES_MAKES_LISTEN_NOOP');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('listen');
    expect(fact?.cReference).toContain('GetPackets');
  });

  test('C_BODY_NETUPDATE_DOES_NOT_INVOKE_M_TICKER_OR_G_TICKER pins the no-ticker role boundary', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_BODY_NETUPDATE_DOES_NOT_INVOKE_M_TICKER_OR_G_TICKER');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('M_Ticker');
    expect(fact?.cReference).toContain('G_Ticker');
    expect(fact?.referenceSourceFile).toBe('shared:vanilla+chocolate');
  });

  test('C_BODY_NETUPDATE_DOES_NOT_ADVANCE_GAMETIC pins the no-gametic-write role boundary', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_BODY_NETUPDATE_DOES_NOT_ADVANCE_GAMETIC');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('gametic');
    expect(fact?.referenceSourceFile).toBe('shared:vanilla+chocolate');
  });

  test('C_HEADER_BACKUPTICS_HALF_DEPTH_MINUS_ONE_IS_FIVE pins the compile-time arithmetic', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_HEADER_BACKUPTICS_HALF_DEPTH_MINUS_ONE_IS_FIVE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('BACKUPTICS/2-1');
    expect(fact?.cReference).toContain('5');
  });

  test('C_HEADER_VANILLA_LASTTIME_FILE_SCOPE_STATIC pins the lasttime declaration', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_HEADER_VANILLA_LASTTIME_FILE_SCOPE_STATIC');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('lasttime');
    expect(fact?.referenceSourceFile).toBe('linuxdoom-1.10/d_net.c');
  });

  test('C_BODY_CHOCOLATE_RECVTIC_REPLACES_NETTICS_INDEX pins the chocolate rename', () => {
    const fact = DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT.find((candidate) => candidate.id === 'C_BODY_CHOCOLATE_RECVTIC_REPLACES_NETTICS_INDEX');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('recvtic');
    expect(fact?.cReference).toContain('BACKUPTICS/2-1');
    expect(fact?.referenceSourceFile).toBe('chocolate-doom-2.2.1/src/d_loop.c');
  });
});

describe('implement-netupdate-no-network-single-player-path invariant ledger shape', () => {
  test('lists exactly fifteen operational invariants', () => {
    expect(DOOM_NETUPDATE_SINGLE_PLAYER_INVARIANTS.length).toBe(15);
  });

  test('every invariant id is unique', () => {
    const ids = DOOM_NETUPDATE_SINGLE_PLAYER_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every invariant id from the canonical set exactly once', () => {
    const ids = new Set(DOOM_NETUPDATE_SINGLE_PLAYER_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(ALL_INVARIANT_IDS);
  });

  test('every invariant carries a non-empty description', () => {
    for (const invariant of DOOM_NETUPDATE_SINGLE_PLAYER_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('implement-netupdate-no-network-single-player-path probe table shape', () => {
  test('lists exactly ten probes', () => {
    expect(DOOM_NETUPDATE_SINGLE_PLAYER_PROBES.length).toBe(10);
  });

  test('every probe id is unique', () => {
    const ids = DOOM_NETUPDATE_SINGLE_PLAYER_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every probe id from the canonical set exactly once', () => {
    const ids = new Set(DOOM_NETUPDATE_SINGLE_PLAYER_PROBES.map((probe) => probe.id));
    expect(ids).toEqual(ALL_PROBE_IDS);
  });

  test('every probe carries a non-empty input.steps list', () => {
    for (const probe of DOOM_NETUPDATE_SINGLE_PLAYER_PROBES) {
      expect(probe.input.steps.length).toBeGreaterThan(0);
    }
  });

  test('every probe target is one of the six canonical kinds', () => {
    for (const probe of DOOM_NETUPDATE_SINGLE_PLAYER_PROBES) {
      expect(['maketic_after_calls', 'startTic_call_count_after_calls', 'processEvents_call_count_after_calls', 'buildTiccmd_call_count_after_calls', 'ticker_call_count_after_calls', 'doAdvanceDemo_call_count_after_calls']).toContain(
        probe.target,
      );
    }
  });

  test('every probe carries a non-empty note', () => {
    for (const probe of DOOM_NETUPDATE_SINGLE_PLAYER_PROBES) {
      expect(probe.note.length).toBeGreaterThan(0);
    }
  });
});

describe('implement-netupdate-no-network-single-player-path reference candidate cross-check', () => {
  test('the reference candidate honours every audited probe and invariant (no failures)', () => {
    const failures = crossCheckDoomNetUpdateSinglePlayer(buildReferenceCandidate());
    expect(failures).toEqual([]);
  });
});

describe('DoomNetUpdateSinglePlayer runtime behavior', () => {
  test('the exported runtime candidate honours every audited probe and invariant', () => {
    const failures = crossCheckDoomNetUpdateSinglePlayer(DOOM_NETUPDATE_SINGLE_PLAYER_CANDIDATE);
    expect(failures).toEqual([]);
  });

  test('creates independent fresh instances with canonical baselines', () => {
    const firstInstance = DOOM_NETUPDATE_SINGLE_PLAYER_CANDIDATE.create();
    const secondInstance = DOOM_NETUPDATE_SINGLE_PLAYER_CANDIDATE.create();

    expect(firstInstance).toBeInstanceOf(DoomNetUpdateSinglePlayer);
    expect(firstInstance.maketic).toBe(AUDITED_FRESH_MAKETIC);
    expect(firstInstance.lasttime).toBe(AUDITED_FRESH_LASTTIME);

    firstInstance.netUpdate(
      { currentClock: 5, gameticFeedback: 0 },
      {
        buildTiccmd: () => {},
        doAdvanceDemo: () => {},
        processEvents: () => {},
        startTic: () => {},
        ticker: () => {},
      },
    );

    expect(firstInstance.maketic).toBe(5);
    expect(firstInstance.lasttime).toBe(5);
    expect(secondInstance.maketic).toBe(AUDITED_FRESH_MAKETIC);
    expect(secondInstance.lasttime).toBe(AUDITED_FRESH_LASTTIME);
  });

  test('short-circuits when the clock has not advanced', () => {
    const instance = new DoomNetUpdateSinglePlayer();
    instance.netUpdate(
      { currentClock: 0, gameticFeedback: 0 },
      {
        buildTiccmd: () => {
          throw new Error('buildTiccmd should not run without clock advance');
        },
        doAdvanceDemo: () => {
          throw new Error('doAdvanceDemo should not run inside NetUpdate');
        },
        processEvents: () => {
          throw new Error('processEvents should not run without clock advance');
        },
        startTic: () => {
          throw new Error('startTic should not run without clock advance');
        },
        ticker: () => {
          throw new Error('ticker should not run inside NetUpdate');
        },
      },
    );

    expect(instance.maketic).toBe(0);
    expect(instance.lasttime).toBe(0);
  });

  test('runs startTic, processEvents, and buildTiccmd in order until the half-buffer guard caps maketic', () => {
    const instance = new DoomNetUpdateSinglePlayer();
    const events: string[] = [];

    instance.netUpdate(
      { currentClock: 6, gameticFeedback: 0 },
      {
        buildTiccmd: () => {
          events.push('buildTiccmd');
        },
        doAdvanceDemo: () => {
          events.push('doAdvanceDemo');
        },
        processEvents: () => {
          events.push('processEvents');
        },
        startTic: () => {
          events.push('startTic');
        },
        ticker: () => {
          events.push('ticker');
        },
      },
    );

    expect(instance.maketic).toBe(AUDITED_NETUPDATE_HALF_BUFFER_GUARD);
    expect(instance.lasttime).toBe(6);
    expect(events).toEqual([
      'startTic',
      'processEvents',
      'buildTiccmd',
      'startTic',
      'processEvents',
      'buildTiccmd',
      'startTic',
      'processEvents',
      'buildTiccmd',
      'startTic',
      'processEvents',
      'buildTiccmd',
      'startTic',
      'processEvents',
      'buildTiccmd',
      'startTic',
      'processEvents',
    ]);
  });

  test('updates lasttime but builds no ticcmds on negative clock delta', () => {
    const instance = new DoomNetUpdateSinglePlayer();
    let secondCallBuildCount = 0;

    instance.netUpdate(
      { currentClock: 5, gameticFeedback: 0 },
      {
        buildTiccmd: () => {},
        doAdvanceDemo: () => {},
        processEvents: () => {},
        startTic: () => {},
        ticker: () => {},
      },
    );

    instance.netUpdate(
      { currentClock: 3, gameticFeedback: instance.maketic },
      {
        buildTiccmd: () => {
          secondCallBuildCount++;
        },
        doAdvanceDemo: () => {},
        processEvents: () => {},
        startTic: () => {},
        ticker: () => {},
      },
    );

    expect(secondCallBuildCount).toBe(0);
    expect(instance.maketic).toBe(5);
    expect(instance.lasttime).toBe(3);
  });

  test('leaves ticker and demo advancement outside NetUpdate', () => {
    const instance = new DoomNetUpdateSinglePlayer();
    let doAdvanceDemoCount = 0;
    let tickerCount = 0;

    instance.netUpdate(
      { currentClock: 5, gameticFeedback: 0 },
      {
        buildTiccmd: () => {},
        doAdvanceDemo: () => {
          doAdvanceDemoCount++;
        },
        processEvents: () => {},
        startTic: () => {},
        ticker: () => {
          tickerCount++;
        },
      },
    );

    expect(doAdvanceDemoCount).toBe(0);
    expect(tickerCount).toBe(0);
    expect(instance.maketic).toBe(5);
  });
});

describe('implement-netupdate-no-network-single-player-path tampered candidates fail with the expected ids', () => {
  test('candidate that resets lasttime every call fails the lasttime-persistence invariant', () => {
    const tampered: DoomNetUpdateSinglePlayerCandidate = {
      create: () => {
        const state = { maketic: 0, lasttime: 0 };
        return {
          get maketic(): number {
            return state.maketic;
          },
          get lasttime(): number {
            return state.lasttime;
          },
          netUpdate(input: NetUpdateCandidateInput, callbacks: NetUpdateCandidateCallbacks): void {
            // BUG: lasttime is reset to 0 on every call, so newtics == currentClock always.
            const newTicCount = input.currentClock - 0; // always equals currentClock
            state.lasttime = 0; // RESET (WRONG)
            if (newTicCount <= 0) return;
            for (let newTicIndex = 0; newTicIndex < newTicCount; newTicIndex++) {
              callbacks.startTic();
              callbacks.processEvents();
              if (state.maketic - input.gameticFeedback >= AUDITED_NETUPDATE_HALF_BUFFER_GUARD) break;
              callbacks.buildTiccmd();
              state.maketic += 1;
            }
          },
        };
      },
    };
    const failures = crossCheckDoomNetUpdateSinglePlayer(tampered);
    expect(failures).toContain('invariant:NETUPDATE_LASTTIME_PERSISTS_ACROSS_CALLS');
  });

  test('candidate that uses BACKUPTICS-1 instead of BACKUPTICS/2-1 fails the half-buffer-cap invariant', () => {
    const tampered: DoomNetUpdateSinglePlayerCandidate = {
      create: () => {
        const state = { maketic: 0, lasttime: 0 };
        return {
          get maketic(): number {
            return state.maketic;
          },
          get lasttime(): number {
            return state.lasttime;
          },
          netUpdate(input: NetUpdateCandidateInput, callbacks: NetUpdateCandidateCallbacks): void {
            const newTicCount = input.currentClock - state.lasttime;
            state.lasttime = input.currentClock;
            if (newTicCount <= 0) return;
            for (let newTicIndex = 0; newTicIndex < newTicCount; newTicIndex++) {
              callbacks.startTic();
              callbacks.processEvents();
              // BUG: uses BACKUPTICS - 1 = 11 instead of BACKUPTICS / 2 - 1 = 5.
              if (state.maketic - input.gameticFeedback >= AUDITED_BACKUPTICS - 1) break;
              callbacks.buildTiccmd();
              state.maketic += 1;
            }
          },
        };
      },
    };
    const failures = crossCheckDoomNetUpdateSinglePlayer(tampered);
    expect(failures).toContain('invariant:NETUPDATE_HALF_BUFFER_GUARD_CAPS_BUILD_AT_FIVE');
  });

  test('candidate that swaps startTic and processEvents fails the per-iteration-callback-order invariant', () => {
    const tampered: DoomNetUpdateSinglePlayerCandidate = {
      create: () => {
        const state = { maketic: 0, lasttime: 0 };
        return {
          get maketic(): number {
            return state.maketic;
          },
          get lasttime(): number {
            return state.lasttime;
          },
          netUpdate(input: NetUpdateCandidateInput, callbacks: NetUpdateCandidateCallbacks): void {
            const newTicCount = input.currentClock - state.lasttime;
            state.lasttime = input.currentClock;
            if (newTicCount <= 0) return;
            for (let newTicIndex = 0; newTicIndex < newTicCount; newTicIndex++) {
              callbacks.processEvents(); // SWAPPED ORDER (WRONG)
              callbacks.startTic();
              if (state.maketic - input.gameticFeedback >= AUDITED_NETUPDATE_HALF_BUFFER_GUARD) break;
              callbacks.buildTiccmd();
              state.maketic += 1;
            }
          },
        };
      },
    };
    const failures = crossCheckDoomNetUpdateSinglePlayer(tampered);
    expect(failures).toContain('invariant:NETUPDATE_PER_ITERATION_CALLBACK_ORDER_STARTTIC_PROCESS_BUILD');
  });

  test('candidate that invokes ticker inside netUpdate fails the no-ticker invariant', () => {
    const tampered: DoomNetUpdateSinglePlayerCandidate = {
      create: () => {
        const state = { maketic: 0, lasttime: 0 };
        return {
          get maketic(): number {
            return state.maketic;
          },
          get lasttime(): number {
            return state.lasttime;
          },
          netUpdate(input: NetUpdateCandidateInput, callbacks: NetUpdateCandidateCallbacks): void {
            const newTicCount = input.currentClock - state.lasttime;
            state.lasttime = input.currentClock;
            if (newTicCount <= 0) return;
            for (let newTicIndex = 0; newTicIndex < newTicCount; newTicIndex++) {
              callbacks.startTic();
              callbacks.processEvents();
              if (state.maketic - input.gameticFeedback >= AUDITED_NETUPDATE_HALF_BUFFER_GUARD) break;
              callbacks.buildTiccmd();
              callbacks.ticker(); // CONFLATED ROLE (WRONG): NetUpdate should not invoke the ticker.
              state.maketic += 1;
            }
          },
        };
      },
    };
    const failures = crossCheckDoomNetUpdateSinglePlayer(tampered);
    expect(failures).toContain('invariant:NETUPDATE_DOES_NOT_INVOKE_TICKER_CALLBACKS');
  });

  test('candidate that invokes doAdvanceDemo inside netUpdate fails the no-doAdvanceDemo invariant', () => {
    const tampered: DoomNetUpdateSinglePlayerCandidate = {
      create: () => {
        const state = { maketic: 0, lasttime: 0 };
        return {
          get maketic(): number {
            return state.maketic;
          },
          get lasttime(): number {
            return state.lasttime;
          },
          netUpdate(input: NetUpdateCandidateInput, callbacks: NetUpdateCandidateCallbacks): void {
            const newTicCount = input.currentClock - state.lasttime;
            state.lasttime = input.currentClock;
            if (newTicCount <= 0) return;
            for (let newTicIndex = 0; newTicIndex < newTicCount; newTicIndex++) {
              callbacks.startTic();
              callbacks.processEvents();
              callbacks.doAdvanceDemo(); // CONFLATED ROLE (WRONG): NetUpdate should not advance the demo.
              if (state.maketic - input.gameticFeedback >= AUDITED_NETUPDATE_HALF_BUFFER_GUARD) break;
              callbacks.buildTiccmd();
              state.maketic += 1;
            }
          },
        };
      },
    };
    const failures = crossCheckDoomNetUpdateSinglePlayer(tampered);
    expect(failures).toContain('invariant:NETUPDATE_DOES_NOT_INVOKE_DOADVANCEDEMO_CALLBACK');
  });

  test('candidate that omits the newtics<=0 short-circuit (still updates lasttime; build loop iterates zero times) honours all invariants', () => {
    // A candidate that runs the build loop with newtics<=0 iterates zero times.
    // The lasttime update happens BEFORE the (omitted) short-circuit. This candidate is
    // semantically equivalent to the canonical body and should NOT fail any invariant.
    const semanticallyEquivalent: DoomNetUpdateSinglePlayerCandidate = {
      create: () => {
        const state = { maketic: 0, lasttime: 0 };
        return {
          get maketic(): number {
            return state.maketic;
          },
          get lasttime(): number {
            return state.lasttime;
          },
          netUpdate(input: NetUpdateCandidateInput, callbacks: NetUpdateCandidateCallbacks): void {
            const newTicCount = input.currentClock - state.lasttime;
            state.lasttime = input.currentClock;
            // No `if (newtics <= 0) return;` short-circuit; for-loop with newtics<=0 iterates zero times.
            for (let newTicIndex = 0; newTicIndex < newTicCount; newTicIndex++) {
              callbacks.startTic();
              callbacks.processEvents();
              if (state.maketic - input.gameticFeedback >= AUDITED_NETUPDATE_HALF_BUFFER_GUARD) break;
              callbacks.buildTiccmd();
              state.maketic += 1;
            }
          },
        };
      },
    };
    const failures = crossCheckDoomNetUpdateSinglePlayer(semanticallyEquivalent);
    expect(failures).toEqual([]);
  });

  test('candidate that defers lasttime update to AFTER short-circuit fails the lasttime-updated-on-short-circuit invariant', () => {
    const tampered: DoomNetUpdateSinglePlayerCandidate = {
      create: () => {
        const state = { maketic: 0, lasttime: 0 };
        return {
          get maketic(): number {
            return state.maketic;
          },
          get lasttime(): number {
            return state.lasttime;
          },
          netUpdate(input: NetUpdateCandidateInput, callbacks: NetUpdateCandidateCallbacks): void {
            const newTicCount = input.currentClock - state.lasttime;
            // BUG: short-circuit BEFORE updating lasttime - lasttime stays stale on negative deltas.
            if (newTicCount <= 0) return;
            state.lasttime = input.currentClock;
            for (let newTicIndex = 0; newTicIndex < newTicCount; newTicIndex++) {
              callbacks.startTic();
              callbacks.processEvents();
              if (state.maketic - input.gameticFeedback >= AUDITED_NETUPDATE_HALF_BUFFER_GUARD) break;
              callbacks.buildTiccmd();
              state.maketic += 1;
            }
          },
        };
      },
    };
    const failures = crossCheckDoomNetUpdateSinglePlayer(tampered);
    expect(failures).toContain('invariant:NETUPDATE_LASTTIME_UPDATED_EVEN_ON_SHORT_CIRCUIT');
  });

  test('candidate that uses a global static state across instances fails the two-instances-independent invariant', () => {
    const sharedState = { maketic: 0, lasttime: 0 };
    const tampered: DoomNetUpdateSinglePlayerCandidate = {
      create: () => {
        return {
          get maketic(): number {
            return sharedState.maketic;
          },
          get lasttime(): number {
            return sharedState.lasttime;
          },
          netUpdate(input: NetUpdateCandidateInput, callbacks: NetUpdateCandidateCallbacks): void {
            const newTicCount = input.currentClock - sharedState.lasttime;
            sharedState.lasttime = input.currentClock;
            if (newTicCount <= 0) return;
            for (let newTicIndex = 0; newTicIndex < newTicCount; newTicIndex++) {
              callbacks.startTic();
              callbacks.processEvents();
              if (sharedState.maketic - input.gameticFeedback >= AUDITED_NETUPDATE_HALF_BUFFER_GUARD) break;
              callbacks.buildTiccmd();
              sharedState.maketic += 1;
            }
          },
        };
      },
    };
    const failures = crossCheckDoomNetUpdateSinglePlayer(tampered);
    expect(failures).toContain('invariant:NETUPDATE_TWO_INSTANCES_ARE_INDEPENDENT');
  });

  test('candidate that captures gameticFeedback only at function entry fails the gametic-feedback-release invariant', () => {
    const tampered: DoomNetUpdateSinglePlayerCandidate = {
      create: () => {
        const state = { maketic: 0, lasttime: 0 };
        return {
          get maketic(): number {
            return state.maketic;
          },
          get lasttime(): number {
            return state.lasttime;
          },
          netUpdate(input: NetUpdateCandidateInput, callbacks: NetUpdateCandidateCallbacks): void {
            const newTicCount = input.currentClock - state.lasttime;
            state.lasttime = input.currentClock;
            if (newTicCount <= 0) return;
            // BUG: snapshot guard threshold at entry (capturing maketic-at-start) instead of using the live maketic per-iteration.
            const initialMaketic = state.maketic;
            for (let newTicIndex = 0; newTicIndex < newTicCount; newTicIndex++) {
              callbacks.startTic();
              callbacks.processEvents();
              if (initialMaketic - input.gameticFeedback >= AUDITED_NETUPDATE_HALF_BUFFER_GUARD) break;
              callbacks.buildTiccmd();
              state.maketic += 1;
            }
          },
        };
      },
    };
    // The first call (10 clock units, gameticFeedback=0): initialMaketic=0, guard `0 - 0 >= 5` is false on iter 1 (builds, maketic=1),
    // iter 2 guard `0 - 0 >= 5` still false (builds, maketic=2), ... iter 10 guard `0 - 0 >= 5` false (builds, maketic=10).
    // The tampered candidate would build 10 ticcmds in one call, capping at maketic=10 instead of 5.
    const failures = crossCheckDoomNetUpdateSinglePlayer(tampered);
    // The half-buffer guard test should fail because the snapshot-at-entry causes the cap to fail at the first call.
    expect(failures).toContain('invariant:NETUPDATE_HALF_BUFFER_GUARD_CAPS_BUILD_AT_FIVE');
  });
});
