import { describe, expect, test } from 'bun:test';

import {
  AUDITED_CHOCOLATE_EVENT_QUEUE_SOURCE_FILE,
  AUDITED_MAXEVENTS,
  AUDITED_MAXEVENTS_LOG2,
  AUDITED_MAXEVENTS_WRAP_MASK,
  AUDITED_RESPONDER_DISPATCH_PHASE_G_RESPONDER,
  AUDITED_RESPONDER_DISPATCH_PHASE_M_RESPONDER,
  AUDITED_VANILLA_EVENT_QUEUE_SOURCE_FILE,
  AUDITED_VANILLA_I_START_TIC_SOURCE_FILE,
  AUDITED_VANILLA_MAXEVENTS_SOURCE_FILE,
  DOOM_I_START_TIC_EVENT_PUMP_AUDIT,
  DOOM_I_START_TIC_EVENT_PUMP_INVARIANTS,
  DOOM_I_START_TIC_EVENT_PUMP_PROBES,
  crossCheckDoomIStartTicEventPump,
} from '../../../src/core/implement-i-start-tic-event-pump-contract.ts';
import type {
  DoomIStartTicEventPumpCallbacks,
  DoomIStartTicEventPumpCandidate,
  DoomIStartTicEventPumpFactId,
  DoomIStartTicEventPumpInstance,
  DoomIStartTicEventPumpInvariantId,
  DoomIStartTicEventPumpProbeId,
} from '../../../src/core/implement-i-start-tic-event-pump-contract.ts';

const ALL_FACT_IDS: Set<DoomIStartTicEventPumpFactId> = new Set([
  'C_HEADER_VANILLA_MAXEVENTS_IS_SIXTY_FOUR',
  'C_HEADER_MAXEVENTS_IS_POWER_OF_TWO',
  'C_HEADER_VANILLA_EVENT_T_STRUCT_SHAPE',
  'C_BODY_VANILLA_EVENTS_ARRAY_DECLARATION',
  'C_BODY_VANILLA_EVENTHEAD_DECLARATION',
  'C_BODY_VANILLA_EVENTTAIL_DECLARATION',
  'C_BODY_VANILLA_DPOSTEVENT_STORE_THEN_ADVANCE',
  'C_BODY_VANILLA_DPOSTEVENT_WRAP_MASK_FORM',
  'C_BODY_VANILLA_DPROCESSEVENTS_DRAIN_LOOP_HEADER',
  'C_BODY_VANILLA_DPROCESSEVENTS_TAIL_ADVANCE_FORM',
  'C_BODY_VANILLA_DPROCESSEVENTS_M_RESPONDER_BEFORE_G_RESPONDER',
  'C_BODY_VANILLA_DPROCESSEVENTS_MENU_ATE_CONTINUE_COMMENT',
  'C_BODY_VANILLA_DPROCESSEVENTS_STORE_DEMO_GUARD',
  'C_BODY_VANILLA_ISTARTTIC_DRAINS_HOST_QUEUE',
  'C_BODY_VANILLA_ISTARTTIC_DOES_NOT_CALL_RESPONDER',
  'C_BODY_CHOCOLATE_DPOSTEVENT_MODULO_FORM',
  'C_BODY_CHOCOLATE_DPOPEVENT_RETURNS_NULL_ON_EMPTY',
  'C_BODY_CHOCOLATE_DPROCESSEVENTS_USES_DPOPEVENT_LOOP',
]);

const ALL_INVARIANT_IDS: Set<DoomIStartTicEventPumpInvariantId> = new Set([
  'EVENT_PUMP_FRESH_INSTANCE_HAS_ZERO_PENDING_EVENTS',
  'EVENT_PUMP_I_START_TIC_WITH_EMPTY_LIST_DOES_NOT_INCREASE_PENDING',
  'EVENT_PUMP_I_START_TIC_INCREASES_PENDING_BY_POSTED_COUNT',
  'EVENT_PUMP_D_PROCESS_EVENTS_ON_EMPTY_DOES_NOT_INVOKE_RESPONDERS',
  'EVENT_PUMP_D_PROCESS_EVENTS_DRAINS_QUEUE_TO_EMPTY',
  'EVENT_PUMP_D_PROCESS_EVENTS_DISPATCHES_FIFO',
  'EVENT_PUMP_M_RESPONDER_RUNS_BEFORE_G_RESPONDER_FOR_SAME_EVENT',
  'EVENT_PUMP_M_RESPONDER_TRUE_SKIPS_G_RESPONDER',
  'EVENT_PUMP_M_RESPONDER_FALSE_INVOKES_G_RESPONDER',
  'EVENT_PUMP_I_START_TIC_DOES_NOT_INVOKE_RESPONDERS_DIRECTLY',
  'EVENT_PUMP_INTERLEAVED_POST_AND_PROCESS_PRESERVE_FIFO',
  'EVENT_PUMP_TWO_INSTANCES_ARE_INDEPENDENT',
]);

const ALL_PROBE_IDS: Set<DoomIStartTicEventPumpProbeId> = new Set([
  'fresh_queue_pending_count_is_zero',
  'one_post_then_process_dispatches_one_event',
  'three_posts_then_process_dispatches_three_in_fifo_order',
  'process_with_no_pending_events_dispatches_zero',
  'm_responder_true_skips_g_responder_for_that_event',
  'm_responder_false_falls_through_to_g_responder',
  'interleaved_post_process_preserves_global_fifo',
  'i_start_tic_with_empty_event_list_does_not_increase_pending',
  'two_back_to_back_pump_phases_accumulate_pending',
]);

/**
 * Reference candidate that mirrors the canonical vanilla DOOM 1.9
 * I_StartTic / D_PostEvent / D_ProcessEvents trio. Per-instance
 * `events`, `eventhead`, `eventtail` triple modelled as a Number
 * array of fixed depth `MAXEVENTS` with bitwise-mask wrap on both
 * head and tail advance. The dispatch loop honours the canonical
 * `for (; eventtail != eventhead ; ...)` body with M_Responder
 * before G_Responder and the `continue` after a true M_Responder.
 */
function buildReferenceCandidate(): DoomIStartTicEventPumpCandidate {
  return {
    create: (): DoomIStartTicEventPumpInstance => {
      const events: number[] = new Array<number>(AUDITED_MAXEVENTS).fill(0);
      const state = { eventhead: 0, eventtail: 0 };
      const pending = (): number => (state.eventhead - state.eventtail) & AUDITED_MAXEVENTS_WRAP_MASK;
      return {
        get pendingEventCount(): number {
          return pending();
        },
        iStartTic(eventsToPost: readonly number[]): void {
          for (const event of eventsToPost) {
            events[state.eventhead] = event;
            state.eventhead = (state.eventhead + 1) & AUDITED_MAXEVENTS_WRAP_MASK;
          }
        },
        dProcessEvents(callbacks: DoomIStartTicEventPumpCallbacks): void {
          while (state.eventtail !== state.eventhead) {
            const event = events[state.eventtail];
            state.eventtail = (state.eventtail + 1) & AUDITED_MAXEVENTS_WRAP_MASK;
            if (callbacks.mResponder(event)) continue;
            callbacks.gResponder(event);
          }
        },
      };
    },
  };
}

describe('implement-i-start-tic-event-pump-contract audited canonical constants', () => {
  test('AUDITED_MAXEVENTS is exactly 64 (linuxdoom-1.10/d_event.h)', () => {
    expect(AUDITED_MAXEVENTS).toBe(64);
  });

  test('AUDITED_MAXEVENTS_LOG2 is exactly 6 (so MAXEVENTS == 1 << 6)', () => {
    expect(AUDITED_MAXEVENTS_LOG2).toBe(6);
    expect(1 << AUDITED_MAXEVENTS_LOG2).toBe(AUDITED_MAXEVENTS);
  });

  test('AUDITED_MAXEVENTS_WRAP_MASK is exactly 63 (MAXEVENTS - 1)', () => {
    expect(AUDITED_MAXEVENTS_WRAP_MASK).toBe(63);
    expect(AUDITED_MAXEVENTS_WRAP_MASK).toBe(AUDITED_MAXEVENTS - 1);
  });

  test('MAXEVENTS is a power of two', () => {
    expect(AUDITED_MAXEVENTS > 0 && (AUDITED_MAXEVENTS & (AUDITED_MAXEVENTS - 1)) === 0).toBe(true);
  });

  test('AUDITED_RESPONDER_DISPATCH_PHASE_M_RESPONDER is exactly 1 (first phase)', () => {
    expect(AUDITED_RESPONDER_DISPATCH_PHASE_M_RESPONDER).toBe(1);
  });

  test('AUDITED_RESPONDER_DISPATCH_PHASE_G_RESPONDER is exactly 2 (after M_Responder)', () => {
    expect(AUDITED_RESPONDER_DISPATCH_PHASE_G_RESPONDER).toBe(2);
  });

  test('phase indices are strictly increasing (M before G)', () => {
    expect(AUDITED_RESPONDER_DISPATCH_PHASE_M_RESPONDER).toBeLessThan(AUDITED_RESPONDER_DISPATCH_PHASE_G_RESPONDER);
  });

  test('AUDITED_VANILLA_EVENT_QUEUE_SOURCE_FILE is exactly linuxdoom-1.10/d_main.c', () => {
    expect(AUDITED_VANILLA_EVENT_QUEUE_SOURCE_FILE).toBe('linuxdoom-1.10/d_main.c');
  });

  test('AUDITED_VANILLA_MAXEVENTS_SOURCE_FILE is exactly linuxdoom-1.10/d_event.h', () => {
    expect(AUDITED_VANILLA_MAXEVENTS_SOURCE_FILE).toBe('linuxdoom-1.10/d_event.h');
  });

  test('AUDITED_VANILLA_I_START_TIC_SOURCE_FILE is exactly linuxdoom-1.10/i_video.c', () => {
    expect(AUDITED_VANILLA_I_START_TIC_SOURCE_FILE).toBe('linuxdoom-1.10/i_video.c');
  });

  test('AUDITED_CHOCOLATE_EVENT_QUEUE_SOURCE_FILE is exactly chocolate-doom-2.2.1/src/d_event.c', () => {
    expect(AUDITED_CHOCOLATE_EVENT_QUEUE_SOURCE_FILE).toBe('chocolate-doom-2.2.1/src/d_event.c');
  });
});

describe('implement-i-start-tic-event-pump-contract fact ledger shape', () => {
  test('audits exactly eighteen facts', () => {
    expect(DOOM_I_START_TIC_EVENT_PUMP_AUDIT.length).toBe(18);
  });

  test('every fact id is unique', () => {
    const ids = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.map((fact) => fact.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every fact id from the canonical set exactly once', () => {
    const ids = new Set(DOOM_I_START_TIC_EVENT_PUMP_AUDIT.map((fact) => fact.id));
    expect(ids).toEqual(ALL_FACT_IDS);
  });

  test('every fact carries a non-empty description and cReference', () => {
    for (const fact of DOOM_I_START_TIC_EVENT_PUMP_AUDIT) {
      expect(fact.description.length).toBeGreaterThan(0);
      expect(fact.cReference.length).toBeGreaterThan(0);
    }
  });

  test('every fact references one of the canonical upstream files', () => {
    const allowedFiles = new Set(['linuxdoom-1.10/d_event.h', 'linuxdoom-1.10/d_main.c', 'linuxdoom-1.10/i_video.c', 'chocolate-doom-2.2.1/src/d_event.c', 'chocolate-doom-2.2.1/src/doom/d_main.c', 'shared:vanilla+chocolate']);
    for (const fact of DOOM_I_START_TIC_EVENT_PUMP_AUDIT) {
      expect(allowedFiles.has(fact.referenceSourceFile)).toBe(true);
    }
  });

  test('every fact category is c-header or c-body', () => {
    for (const fact of DOOM_I_START_TIC_EVENT_PUMP_AUDIT) {
      expect(['c-header', 'c-body']).toContain(fact.category);
    }
  });
});

describe('implement-i-start-tic-event-pump-contract fact ledger values', () => {
  test('C_HEADER_VANILLA_MAXEVENTS_IS_SIXTY_FOUR pins the #define MAXEVENTS 64 declaration', () => {
    const fact = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.find((candidate) => candidate.id === 'C_HEADER_VANILLA_MAXEVENTS_IS_SIXTY_FOUR');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('#define MAXEVENTS');
    expect(fact?.cReference).toContain('64');
    expect(fact?.referenceSourceFile).toBe('linuxdoom-1.10/d_event.h');
  });

  test('C_HEADER_MAXEVENTS_IS_POWER_OF_TWO pins the power-of-two derived invariant', () => {
    const fact = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.find((candidate) => candidate.id === 'C_HEADER_MAXEVENTS_IS_POWER_OF_TWO');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('64');
    expect(fact?.cReference).toContain('1 << 6');
  });

  test('C_HEADER_VANILLA_EVENT_T_STRUCT_SHAPE pins the four-int payload shape', () => {
    const fact = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.find((candidate) => candidate.id === 'C_HEADER_VANILLA_EVENT_T_STRUCT_SHAPE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('event_t');
    expect(fact?.cReference).toContain('evtype_t');
    expect(fact?.cReference).toContain('data1');
    expect(fact?.cReference).toContain('data2');
    expect(fact?.cReference).toContain('data3');
  });

  test('C_BODY_VANILLA_EVENTS_ARRAY_DECLARATION pins the events[MAXEVENTS] array', () => {
    const fact = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.find((candidate) => candidate.id === 'C_BODY_VANILLA_EVENTS_ARRAY_DECLARATION');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('event_t');
    expect(fact?.cReference).toContain('events[MAXEVENTS]');
    expect(fact?.referenceSourceFile).toBe('linuxdoom-1.10/d_main.c');
  });

  test('C_BODY_VANILLA_EVENTHEAD_DECLARATION pins the int eventhead declaration', () => {
    const fact = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.find((candidate) => candidate.id === 'C_BODY_VANILLA_EVENTHEAD_DECLARATION');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('eventhead');
    expect(fact?.cReference).toContain('int');
  });

  test('C_BODY_VANILLA_EVENTTAIL_DECLARATION pins the int eventtail declaration', () => {
    const fact = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.find((candidate) => candidate.id === 'C_BODY_VANILLA_EVENTTAIL_DECLARATION');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('eventtail');
    expect(fact?.cReference).toContain('int');
  });

  test('C_BODY_VANILLA_DPOSTEVENT_STORE_THEN_ADVANCE pins the canonical store-then-advance body', () => {
    const fact = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.find((candidate) => candidate.id === 'C_BODY_VANILLA_DPOSTEVENT_STORE_THEN_ADVANCE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('events[eventhead] = *ev;');
    expect(fact?.cReference).toContain('eventhead = (++eventhead)&(MAXEVENTS-1);');
  });

  test('C_BODY_VANILLA_DPOSTEVENT_WRAP_MASK_FORM pins the bitwise-mask wrap form', () => {
    const fact = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.find((candidate) => candidate.id === 'C_BODY_VANILLA_DPOSTEVENT_WRAP_MASK_FORM');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('++eventhead');
    expect(fact?.cReference).toContain('MAXEVENTS-1');
    expect(fact?.cReference).toContain('&');
  });

  test('C_BODY_VANILLA_DPROCESSEVENTS_DRAIN_LOOP_HEADER pins the for-loop header', () => {
    const fact = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.find((candidate) => candidate.id === 'C_BODY_VANILLA_DPROCESSEVENTS_DRAIN_LOOP_HEADER');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('eventtail != eventhead');
    expect(fact?.cReference).toContain('eventtail');
    expect(fact?.cReference).toContain('MAXEVENTS-1');
  });

  test('C_BODY_VANILLA_DPROCESSEVENTS_TAIL_ADVANCE_FORM pins the eventtail advance form', () => {
    const fact = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.find((candidate) => candidate.id === 'C_BODY_VANILLA_DPROCESSEVENTS_TAIL_ADVANCE_FORM');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('++eventtail');
    expect(fact?.cReference).toContain('MAXEVENTS-1');
  });

  test('C_BODY_VANILLA_DPROCESSEVENTS_M_RESPONDER_BEFORE_G_RESPONDER pins the dispatch order', () => {
    const fact = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.find((candidate) => candidate.id === 'C_BODY_VANILLA_DPROCESSEVENTS_M_RESPONDER_BEFORE_G_RESPONDER');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('M_Responder');
    expect(fact?.cReference).toContain('G_Responder');
    expect(fact?.cReference).toContain('continue');
  });

  test('C_BODY_VANILLA_DPROCESSEVENTS_MENU_ATE_CONTINUE_COMMENT pins the verbatim comment', () => {
    const fact = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.find((candidate) => candidate.id === 'C_BODY_VANILLA_DPROCESSEVENTS_MENU_ATE_CONTINUE_COMMENT');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('menu ate the event');
  });

  test('C_BODY_VANILLA_DPROCESSEVENTS_STORE_DEMO_GUARD pins the store-demo gate', () => {
    const fact = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.find((candidate) => candidate.id === 'C_BODY_VANILLA_DPROCESSEVENTS_STORE_DEMO_GUARD');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('gamemode == commercial');
    expect(fact?.cReference).toContain('W_CheckNumForName');
    expect(fact?.cReference).toContain('return');
  });

  test('C_BODY_VANILLA_ISTARTTIC_DRAINS_HOST_QUEUE pins the X11 drain loop', () => {
    const fact = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.find((candidate) => candidate.id === 'C_BODY_VANILLA_ISTARTTIC_DRAINS_HOST_QUEUE');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('X_display');
    expect(fact?.cReference).toContain('XPending');
    expect(fact?.cReference).toContain('I_GetEvent');
  });

  test('C_BODY_VANILLA_ISTARTTIC_DOES_NOT_CALL_RESPONDER pins the I_StartTic role boundary', () => {
    const fact = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.find((candidate) => candidate.id === 'C_BODY_VANILLA_ISTARTTIC_DOES_NOT_CALL_RESPONDER');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('I_StartTic');
    expect(fact?.cReference).toContain('M_Responder');
    expect(fact?.cReference).toContain('G_Responder');
  });

  test('C_BODY_CHOCOLATE_DPOSTEVENT_MODULO_FORM pins the chocolate refactor', () => {
    const fact = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.find((candidate) => candidate.id === 'C_BODY_CHOCOLATE_DPOSTEVENT_MODULO_FORM');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('eventhead');
    expect(fact?.cReference).toContain('% MAXEVENTS');
    expect(fact?.referenceSourceFile).toBe('chocolate-doom-2.2.1/src/d_event.c');
  });

  test('C_BODY_CHOCOLATE_DPOPEVENT_RETURNS_NULL_ON_EMPTY pins the chocolate D_PopEvent contract', () => {
    const fact = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.find((candidate) => candidate.id === 'C_BODY_CHOCOLATE_DPOPEVENT_RETURNS_NULL_ON_EMPTY');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('D_PopEvent');
    expect(fact?.cReference).toContain('NULL');
  });

  test('C_BODY_CHOCOLATE_DPROCESSEVENTS_USES_DPOPEVENT_LOOP pins the refactored drain loop', () => {
    const fact = DOOM_I_START_TIC_EVENT_PUMP_AUDIT.find((candidate) => candidate.id === 'C_BODY_CHOCOLATE_DPROCESSEVENTS_USES_DPOPEVENT_LOOP');
    expect(fact).toBeDefined();
    expect(fact?.cReference).toContain('D_PopEvent');
    expect(fact?.cReference).toContain('M_Responder');
    expect(fact?.cReference).toContain('G_Responder');
    expect(fact?.cReference).toContain('continue');
    expect(fact?.referenceSourceFile).toBe('chocolate-doom-2.2.1/src/doom/d_main.c');
  });
});

describe('implement-i-start-tic-event-pump-contract invariant ledger shape', () => {
  test('lists exactly twelve operational invariants', () => {
    expect(DOOM_I_START_TIC_EVENT_PUMP_INVARIANTS.length).toBe(12);
  });

  test('every invariant id is unique', () => {
    const ids = DOOM_I_START_TIC_EVENT_PUMP_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every invariant id from the canonical set exactly once', () => {
    const ids = new Set(DOOM_I_START_TIC_EVENT_PUMP_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(ALL_INVARIANT_IDS);
  });

  test('every invariant carries a non-empty description', () => {
    for (const invariant of DOOM_I_START_TIC_EVENT_PUMP_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('implement-i-start-tic-event-pump-contract probe table shape', () => {
  test('lists exactly nine probes', () => {
    expect(DOOM_I_START_TIC_EVENT_PUMP_PROBES.length).toBe(9);
  });

  test('every probe id is unique', () => {
    const ids = DOOM_I_START_TIC_EVENT_PUMP_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every probe id from the canonical set exactly once', () => {
    const ids = new Set(DOOM_I_START_TIC_EVENT_PUMP_PROBES.map((probe) => probe.id));
    expect(ids).toEqual(ALL_PROBE_IDS);
  });

  test('every probe carries a non-empty note', () => {
    for (const probe of DOOM_I_START_TIC_EVENT_PUMP_PROBES) {
      expect(probe.note.length).toBeGreaterThan(0);
    }
  });

  test('every probe target is one of the four canonical kinds', () => {
    for (const probe of DOOM_I_START_TIC_EVENT_PUMP_PROBES) {
      expect(['pending_event_count_after_calls', 'm_responder_call_count_after_calls', 'g_responder_call_count_after_calls', 'total_responder_call_count_after_calls']).toContain(probe.target);
    }
  });
});

describe('implement-i-start-tic-event-pump-contract reference candidate cross-check', () => {
  test('the reference candidate honours every audited probe and invariant (no failures)', () => {
    const failures = crossCheckDoomIStartTicEventPump(buildReferenceCandidate());
    expect(failures).toEqual([]);
  });
});

describe('implement-i-start-tic-event-pump-contract tampered candidates fail with the expected ids', () => {
  test('candidate that swaps M_Responder and G_Responder fails the dispatch-order invariant', () => {
    const tampered: DoomIStartTicEventPumpCandidate = {
      create: () => {
        const events: number[] = new Array<number>(AUDITED_MAXEVENTS).fill(0);
        const state = { eventhead: 0, eventtail: 0 };
        return {
          get pendingEventCount(): number {
            return (state.eventhead - state.eventtail) & AUDITED_MAXEVENTS_WRAP_MASK;
          },
          iStartTic(eventsToPost: readonly number[]): void {
            for (const event of eventsToPost) {
              events[state.eventhead] = event;
              state.eventhead = (state.eventhead + 1) & AUDITED_MAXEVENTS_WRAP_MASK;
            }
          },
          dProcessEvents(callbacks: DoomIStartTicEventPumpCallbacks): void {
            while (state.eventtail !== state.eventhead) {
              const event = events[state.eventtail];
              state.eventtail = (state.eventtail + 1) & AUDITED_MAXEVENTS_WRAP_MASK;
              callbacks.gResponder(event); // SWAPPED ORDER (WRONG): G before M
              if (callbacks.mResponder(event)) continue;
            }
          },
        };
      },
    };
    const failures = crossCheckDoomIStartTicEventPump(tampered);
    expect(failures).toContain('invariant:EVENT_PUMP_M_RESPONDER_RUNS_BEFORE_G_RESPONDER_FOR_SAME_EVENT');
  });

  test('candidate that drops the menu-ate-continue (always calls G_Responder) fails the menu-ate invariant', () => {
    const tampered: DoomIStartTicEventPumpCandidate = {
      create: () => {
        const events: number[] = new Array<number>(AUDITED_MAXEVENTS).fill(0);
        const state = { eventhead: 0, eventtail: 0 };
        return {
          get pendingEventCount(): number {
            return (state.eventhead - state.eventtail) & AUDITED_MAXEVENTS_WRAP_MASK;
          },
          iStartTic(eventsToPost: readonly number[]): void {
            for (const event of eventsToPost) {
              events[state.eventhead] = event;
              state.eventhead = (state.eventhead + 1) & AUDITED_MAXEVENTS_WRAP_MASK;
            }
          },
          dProcessEvents(callbacks: DoomIStartTicEventPumpCallbacks): void {
            while (state.eventtail !== state.eventhead) {
              const event = events[state.eventtail];
              state.eventtail = (state.eventtail + 1) & AUDITED_MAXEVENTS_WRAP_MASK;
              callbacks.mResponder(event); // ignore return value (WRONG)
              callbacks.gResponder(event); // ALWAYS calls G (WRONG)
            }
          },
        };
      },
    };
    const failures = crossCheckDoomIStartTicEventPump(tampered);
    expect(failures).toContain('invariant:EVENT_PUMP_M_RESPONDER_TRUE_SKIPS_G_RESPONDER');
  });

  test('candidate that drops M_Responder entirely (only calls G_Responder) fails the M-before-G invariant', () => {
    const tampered: DoomIStartTicEventPumpCandidate = {
      create: () => {
        const events: number[] = new Array<number>(AUDITED_MAXEVENTS).fill(0);
        const state = { eventhead: 0, eventtail: 0 };
        return {
          get pendingEventCount(): number {
            return (state.eventhead - state.eventtail) & AUDITED_MAXEVENTS_WRAP_MASK;
          },
          iStartTic(eventsToPost: readonly number[]): void {
            for (const event of eventsToPost) {
              events[state.eventhead] = event;
              state.eventhead = (state.eventhead + 1) & AUDITED_MAXEVENTS_WRAP_MASK;
            }
          },
          dProcessEvents(callbacks: DoomIStartTicEventPumpCallbacks): void {
            while (state.eventtail !== state.eventhead) {
              const event = events[state.eventtail];
              state.eventtail = (state.eventtail + 1) & AUDITED_MAXEVENTS_WRAP_MASK;
              callbacks.gResponder(event); // SKIPS M_Responder entirely (WRONG)
            }
          },
        };
      },
    };
    const failures = crossCheckDoomIStartTicEventPump(tampered);
    expect(failures).toContain('invariant:EVENT_PUMP_M_RESPONDER_RUNS_BEFORE_G_RESPONDER_FOR_SAME_EVENT');
  });

  test('candidate that swallows G_Responder when M_Responder is false fails the M-false-falls-through invariant', () => {
    const tampered: DoomIStartTicEventPumpCandidate = {
      create: () => {
        const events: number[] = new Array<number>(AUDITED_MAXEVENTS).fill(0);
        const state = { eventhead: 0, eventtail: 0 };
        return {
          get pendingEventCount(): number {
            return (state.eventhead - state.eventtail) & AUDITED_MAXEVENTS_WRAP_MASK;
          },
          iStartTic(eventsToPost: readonly number[]): void {
            for (const event of eventsToPost) {
              events[state.eventhead] = event;
              state.eventhead = (state.eventhead + 1) & AUDITED_MAXEVENTS_WRAP_MASK;
            }
          },
          dProcessEvents(callbacks: DoomIStartTicEventPumpCallbacks): void {
            while (state.eventtail !== state.eventhead) {
              const event = events[state.eventtail];
              state.eventtail = (state.eventtail + 1) & AUDITED_MAXEVENTS_WRAP_MASK;
              if (!callbacks.mResponder(event)) continue; // INVERTED (WRONG): swallows G when M returned false
              callbacks.gResponder(event);
            }
          },
        };
      },
    };
    const failures = crossCheckDoomIStartTicEventPump(tampered);
    expect(failures).toContain('invariant:EVENT_PUMP_M_RESPONDER_FALSE_INVOKES_G_RESPONDER');
  });

  test('candidate that drains in LIFO order fails the FIFO-dispatch invariant', () => {
    const tampered: DoomIStartTicEventPumpCandidate = {
      create: () => {
        const events: number[] = [];
        return {
          get pendingEventCount(): number {
            return events.length;
          },
          iStartTic(eventsToPost: readonly number[]): void {
            for (const event of eventsToPost) events.push(event);
          },
          dProcessEvents(callbacks: DoomIStartTicEventPumpCallbacks): void {
            while (events.length > 0) {
              const event = events.pop() as number; // LIFO (WRONG): drains from rear
              if (callbacks.mResponder(event)) continue;
              callbacks.gResponder(event);
            }
          },
        };
      },
    };
    const failures = crossCheckDoomIStartTicEventPump(tampered);
    expect(failures).toContain('invariant:EVENT_PUMP_D_PROCESS_EVENTS_DISPATCHES_FIFO');
  });

  test('candidate that does not drain to empty fails the drain-to-empty invariant', () => {
    const tampered: DoomIStartTicEventPumpCandidate = {
      create: () => {
        const events: number[] = [];
        return {
          get pendingEventCount(): number {
            return events.length;
          },
          iStartTic(eventsToPost: readonly number[]): void {
            for (const event of eventsToPost) events.push(event);
          },
          dProcessEvents(callbacks: DoomIStartTicEventPumpCallbacks): void {
            // Drains only one event per call (WRONG)
            if (events.length === 0) return;
            const event = events.shift() as number;
            if (callbacks.mResponder(event)) return;
            callbacks.gResponder(event);
          },
        };
      },
    };
    const failures = crossCheckDoomIStartTicEventPump(tampered);
    expect(failures).toContain('invariant:EVENT_PUMP_D_PROCESS_EVENTS_DRAINS_QUEUE_TO_EMPTY');
  });

  test('candidate that initialises pending non-zero fails the fresh-instance invariant', () => {
    const tampered: DoomIStartTicEventPumpCandidate = {
      create: () => ({
        pendingEventCount: 7, // NON-ZERO INIT (WRONG)
        iStartTic: (): void => {},
        dProcessEvents: (): void => {},
      }),
    };
    const failures = crossCheckDoomIStartTicEventPump(tampered);
    expect(failures).toContain('invariant:EVENT_PUMP_FRESH_INSTANCE_HAS_ZERO_PENDING_EVENTS');
  });

  test('candidate that posts twice per event fails the post-count-equals-pending invariant', () => {
    const tampered: DoomIStartTicEventPumpCandidate = {
      create: () => {
        const events: number[] = [];
        return {
          get pendingEventCount(): number {
            return events.length;
          },
          iStartTic(eventsToPost: readonly number[]): void {
            for (const event of eventsToPost) {
              events.push(event);
              events.push(event); // DOUBLE-POST (WRONG)
            }
          },
          dProcessEvents(callbacks: DoomIStartTicEventPumpCallbacks): void {
            while (events.length > 0) {
              const event = events.shift() as number;
              if (callbacks.mResponder(event)) continue;
              callbacks.gResponder(event);
            }
          },
        };
      },
    };
    const failures = crossCheckDoomIStartTicEventPump(tampered);
    expect(failures).toContain('invariant:EVENT_PUMP_I_START_TIC_INCREASES_PENDING_BY_POSTED_COUNT');
  });

  test('candidate that invokes responders inside iStartTic fails the I_StartTic-no-responder invariant', () => {
    const tampered: DoomIStartTicEventPumpCandidate = {
      create: () => {
        const events: number[] = [];
        return {
          get pendingEventCount(): number {
            return events.length;
          },
          iStartTic(eventsToPost: readonly number[]): void {
            // Drops events instead of queuing them (semantically equivalent
            // to invoking responders synchronously and consuming the event;
            // breaks the role boundary that I_StartTic only enqueues).
            for (let i = 0; i < eventsToPost.length; i++) {
              // Intentionally do nothing: events are consumed without enqueuing.
            }
          },
          dProcessEvents(callbacks: DoomIStartTicEventPumpCallbacks): void {
            while (events.length > 0) {
              const event = events.shift() as number;
              if (callbacks.mResponder(event)) continue;
              callbacks.gResponder(event);
            }
          },
        };
      },
    };
    const failures = crossCheckDoomIStartTicEventPump(tampered);
    expect(failures).toContain('invariant:EVENT_PUMP_I_START_TIC_DOES_NOT_INVOKE_RESPONDERS_DIRECTLY');
  });

  test('candidate that shares state across instances fails the two-instances-independent invariant', () => {
    const sharedEvents: number[] = [];
    const tampered: DoomIStartTicEventPumpCandidate = {
      create: () => ({
        get pendingEventCount(): number {
          return sharedEvents.length;
        },
        iStartTic(eventsToPost: readonly number[]): void {
          for (const event of eventsToPost) sharedEvents.push(event);
        },
        dProcessEvents(callbacks: DoomIStartTicEventPumpCallbacks): void {
          while (sharedEvents.length > 0) {
            const event = sharedEvents.shift() as number;
            if (callbacks.mResponder(event)) continue;
            callbacks.gResponder(event);
          }
        },
      }),
    };
    const failures = crossCheckDoomIStartTicEventPump(tampered);
    expect(failures).toContain('invariant:EVENT_PUMP_TWO_INSTANCES_ARE_INDEPENDENT');
  });

  test('candidate that breaks interleaved FIFO fails the interleaved-fifo invariant', () => {
    const tampered: DoomIStartTicEventPumpCandidate = {
      create: () => {
        const events: number[] = [];
        return {
          get pendingEventCount(): number {
            return events.length;
          },
          iStartTic(eventsToPost: readonly number[]): void {
            // Prepends to head rather than appending to tail (WRONG)
            for (const event of eventsToPost) events.unshift(event);
          },
          dProcessEvents(callbacks: DoomIStartTicEventPumpCallbacks): void {
            while (events.length > 0) {
              const event = events.shift() as number;
              if (callbacks.mResponder(event)) continue;
              callbacks.gResponder(event);
            }
          },
        };
      },
    };
    const failures = crossCheckDoomIStartTicEventPump(tampered);
    expect(failures).toContain('invariant:EVENT_PUMP_INTERLEAVED_POST_AND_PROCESS_PRESERVE_FIFO');
  });
});
