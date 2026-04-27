import { describe, expect, test } from 'bun:test';

import {
  REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER,
  VANILLA_D_DOOMLOOP_ABSENT_CHOCOLATE_OPS,
  VANILLA_D_DOOMLOOP_ABSENT_CHOCOLATE_OP_COUNT,
  VANILLA_D_DOOMLOOP_DEBUGFILE_FILENAME_FORMAT,
  VANILLA_D_DOOMLOOP_DEBUGFILE_FOPEN_MODE,
  VANILLA_D_DOOMLOOP_DEBUGFILE_PARM_LITERAL,
  VANILLA_D_DOOMLOOP_DEBUGFILE_PRINTF_LITERAL,
  VANILLA_D_DOOMLOOP_ENTRY_ORDER,
  VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT,
  VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_CLAUSE_COUNT,
  VANILLA_D_DOOMLOOP_ENTRY_TIMING_DERIVED_INVARIANTS,
  VANILLA_D_DOOMLOOP_ENTRY_TIMING_DERIVED_INVARIANT_COUNT,
  VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES,
  VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBE_COUNT,
  VANILLA_D_DOOMLOOP_FRAME_LOOP_FIRST_CALL_C_SYMBOL,
  VANILLA_D_DOOMLOOP_FRAME_LOOP_HAS_EXIT_CONDITION,
  VANILLA_D_DOOMLOOP_PRE_LOOP_STEP_COUNT,
  VANILLA_D_DOOMLOOP_TICRATE_HZ,
  crossCheckVanillaDDoomLoopEntryTiming,
  deriveExpectedVanillaDDoomLoopEntryTimingResult,
} from '../../../src/bootstrap/implement-d-doomloop-entry-timing.ts';
import type { VanillaDDoomLoopEntryTimingHandler, VanillaDDoomLoopEntryTimingProbe, VanillaDDoomLoopEntryTimingResult } from '../../../src/bootstrap/implement-d-doomloop-entry-timing.ts';

const STEP_FILE_RELATIVE_PATH = 'plan_vanilla_parity/steps/03-009-implement-d-doomloop-entry-timing.md';

const NULL_RESULT_FIELDS = Object.freeze({
  answeredOpName: null,
  answeredPresent: null,
  answeredCondition: null,
  answeredPrintfLiteral: null,
  answeredCount: null,
  answeredHasExitCondition: null,
  answeredLiteral: null,
  answeredPrecedes: null,
}) satisfies VanillaDDoomLoopEntryTimingResult;

describe('VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT ledger shape', () => {
  test('audits exactly twenty-three contract clauses for the D_DoomLoop entry-timing skeleton', () => {
    expect(VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT.length).toBe(23);
    expect(VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT.length).toBe(VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_CLAUSE_COUNT);
  });

  test('every clause id is unique', () => {
    const ids = VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every clause references d_main.c or i_timer.h', () => {
    for (const entry of VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT) {
      expect(['d_main.c', 'i_timer.h']).toContain(entry.referenceSourceFile);
      expect(['D_DoomLoop', 'TICRATE']).toContain(entry.cSymbol);
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('exactly one clause is pinned against TICRATE in i_timer.h', () => {
    const ticRateClauses = VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT.filter((entry) => entry.cSymbol === 'TICRATE');
    expect(ticRateClauses.length).toBe(1);
    expect(ticRateClauses[0]!.referenceSourceFile).toBe('i_timer.h');
  });

  test('the ENTRY_HAS_THREE_PRE_LOOP_OPERATIONS clause names the three operations', () => {
    const entry = VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT.find((clause) => clause.id === 'ENTRY_HAS_THREE_PRE_LOOP_OPERATIONS');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('G_BeginRecording');
    expect(entry!.invariant).toContain('M_CheckParm("-debugfile")');
    expect(entry!.invariant).toContain('I_InitGraphics');
  });

  test('the ENTRY_FIRST_OP_IS_CONDITIONAL_G_BEGINRECORDING clause cites the demorecording flag', () => {
    const entry = VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT.find((clause) => clause.id === 'ENTRY_FIRST_OP_IS_CONDITIONAL_G_BEGINRECORDING');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('demorecording');
    expect(entry!.invariant).toContain('G_BeginRecording');
  });

  test('the ENTRY_SECOND_OP_IS_CONDITIONAL_DEBUGFILE_SETUP clause cites the sprintf and printf literals', () => {
    const entry = VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT.find((clause) => clause.id === 'ENTRY_SECOND_OP_IS_CONDITIONAL_DEBUGFILE_SETUP');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('debug%i.txt');
    expect(entry!.invariant).toContain('debug output to: %s');
    expect(entry!.invariant).toContain('M_CheckParm("-debugfile")');
  });

  test('the ENTRY_THIRD_OP_IS_UNCONDITIONAL_I_INITGRAPHICS clause cites the unconditional behavior', () => {
    const entry = VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT.find((clause) => clause.id === 'ENTRY_THIRD_OP_IS_UNCONDITIONAL_I_INITGRAPHICS');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('unconditional');
    expect(entry!.invariant).toContain('I_InitGraphics');
    expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
  });

  test('the ENTRY_DEBUGFILE_FILENAME_FORMAT_IS_DEBUG_PERCENT_I_TXT clause cites the %i idiosyncrasy', () => {
    const entry = VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT.find((clause) => clause.id === 'ENTRY_DEBUGFILE_FILENAME_FORMAT_IS_DEBUG_PERCENT_I_TXT');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('debug%i.txt');
    expect(entry!.invariant).toContain('%i');
    expect(entry!.invariant).toContain('%d');
  });

  test('the ENTRY_DEBUGFILE_PRINTF_LITERAL clause cites the verbatim format', () => {
    const entry = VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT.find((clause) => clause.id === 'ENTRY_DEBUGFILE_PRINTF_LITERAL_IS_DEBUG_OUTPUT_TO_PERCENT_S_NEWLINE');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('debug output to: %s');
    expect(entry!.invariant).toContain('verbatim');
  });

  test('the ENTRY_DEBUGFILE_FOPEN_MODE_IS_WRITE clause distinguishes "w" from "a"', () => {
    const entry = VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT.find((clause) => clause.id === 'ENTRY_DEBUGFILE_FOPEN_MODE_IS_WRITE');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('"w"');
    expect(entry!.invariant).toContain('"a"');
  });

  test('the ENTRY_DEBUGFILE_PARM_LITERAL clause cites the dash prefix', () => {
    const entry = VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT.find((clause) => clause.id === 'ENTRY_DEBUGFILE_PARM_LITERAL_IS_DASH_DEBUGFILE');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('"-debugfile"');
    expect(entry!.invariant).toContain('M_CheckParm');
  });

  test('the ENTRY_FRAME_LOOP_FIRST_CALL_IS_I_STARTFRAME clause distinguishes vanilla from D_RunFrame', () => {
    const entry = VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT.find((clause) => clause.id === 'ENTRY_FRAME_LOOP_FIRST_CALL_IS_I_STARTFRAME');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('I_StartFrame');
    expect(entry!.invariant).toContain('D_RunFrame');
  });

  test('the ENTRY_FRAME_LOOP_HAS_NO_EXIT_CONDITION clause cites I_Quit/I_Error', () => {
    const entry = VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT.find((clause) => clause.id === 'ENTRY_FRAME_LOOP_HAS_NO_EXIT_CONDITION');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('while (1)');
    expect(entry!.invariant).toContain('I_Quit');
    expect(entry!.invariant).toContain('I_Error');
  });

  test('the ENTRY_FRAME_LOOP_TIC_RATE_IS_THIRTY_FIVE_HZ clause cites TICRATE = 35', () => {
    const entry = VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT.find((clause) => clause.id === 'ENTRY_FRAME_LOOP_TIC_RATE_IS_THIRTY_FIVE_HZ');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('TICRATE = 35');
    expect(entry!.invariant).toContain('i_timer.h');
  });

  test('every Chocolate-only-omission clause names its specific Chocolate addition', () => {
    const omissionClauses: ReadonlyArray<{ id: string; expectedSnippet: string }> = [
      { id: 'ENTRY_OMITS_BFG_EDITION_WARNING_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'BFG-Edition' },
      { id: 'ENTRY_OMITS_MAIN_LOOP_STARTED_FLAG_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'main_loop_started' },
      { id: 'ENTRY_OMITS_PRELOOP_TRYRUNTICS_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'TryRunTics' },
      { id: 'ENTRY_OMITS_I_SETWINDOWTITLE_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'I_SetWindowTitle' },
      { id: 'ENTRY_OMITS_I_GRAPHICSCHECKCOMMANDLINE_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'I_GraphicsCheckCommandLine' },
      { id: 'ENTRY_OMITS_I_SETGRABMOUSECALLBACK_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'I_SetGrabMouseCallback' },
      { id: 'ENTRY_OMITS_ENABLELOADINGDISK_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'EnableLoadingDisk' },
      { id: 'ENTRY_OMITS_V_RESTOREBUFFER_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'V_RestoreBuffer' },
      { id: 'ENTRY_OMITS_R_EXECUTESETVIEWSIZE_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'R_ExecuteSetViewSize' },
      { id: 'ENTRY_OMITS_D_STARTGAMELOOP_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'D_StartGameLoop' },
      { id: 'ENTRY_OMITS_TESTCONTROLS_BRANCH_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'testcontrols' },
    ];
    for (const { id, expectedSnippet } of omissionClauses) {
      const entry = VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT.find((clause) => clause.id === id);
      expect(entry).toBeDefined();
      expect(entry!.invariant).toContain(expectedSnippet);
      expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
    }
  });

  test('the ENTRY_PRELOOP_OPS_PRECEDE_FRAME_LOOP_FIRST_CALL clause cites the I_StartFrame ordering', () => {
    const entry = VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT.find((clause) => clause.id === 'ENTRY_PRELOOP_OPS_PRECEDE_FRAME_LOOP_FIRST_CALL');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('I_StartFrame');
    expect(entry!.invariant).toContain('I_InitGraphics');
    expect(entry!.invariant).toContain('while (1)');
  });
});

describe('VANILLA_D_DOOMLOOP_ENTRY_ORDER canonical sequence', () => {
  test('has exactly three entries', () => {
    expect(VANILLA_D_DOOMLOOP_ENTRY_ORDER.length).toBe(3);
    expect(VANILLA_D_DOOMLOOP_ENTRY_ORDER.length).toBe(VANILLA_D_DOOMLOOP_PRE_LOOP_STEP_COUNT);
  });

  test('orders the canonical 3-step sequence verbatim', () => {
    expect(VANILLA_D_DOOMLOOP_ENTRY_ORDER.map((step) => step.opName)).toEqual(['G_BeginRecording', 'debugfileSetup', 'I_InitGraphics']);
  });

  test('positions every step at the canonical 0-based index', () => {
    for (let index = 0; index < VANILLA_D_DOOMLOOP_ENTRY_ORDER.length; index++) {
      expect(VANILLA_D_DOOMLOOP_ENTRY_ORDER[index]!.index).toBe(index);
    }
  });

  test('classifies every step as pre-loop', () => {
    for (const step of VANILLA_D_DOOMLOOP_ENTRY_ORDER) {
      expect(step.phase).toBe('pre-loop');
    }
  });

  test('declares the canonical condition for each pre-loop op', () => {
    const conditions = VANILLA_D_DOOMLOOP_ENTRY_ORDER.map((step) => step.condition);
    expect(conditions).toEqual(['demorecording-flag-set', 'debugfile-parm-present', 'always']);
  });

  test('only debugfileSetup has a non-null printf literal', () => {
    const literals = VANILLA_D_DOOMLOOP_ENTRY_ORDER.map((step) => step.printfLiteral);
    expect(literals).toEqual([null, 'debug output to: %s\n', null]);
  });

  test('pins the verbatim debugfileSetup printf literal', () => {
    const debugfile = VANILLA_D_DOOMLOOP_ENTRY_ORDER.find((step) => step.opName === 'debugfileSetup');
    expect(debugfile).toBeDefined();
    expect(debugfile!.printfLiteral).toBe('debug output to: %s\n');
    expect(debugfile!.printfLiteral!.endsWith('\n')).toBe(true);
    expect(debugfile!.printfLiteral!.startsWith('debug output to: ')).toBe(true);
  });

  test('every step has a non-empty op name', () => {
    for (const step of VANILLA_D_DOOMLOOP_ENTRY_ORDER) {
      expect(step.opName.length).toBeGreaterThan(0);
    }
  });

  test('places G_BeginRecording before I_InitGraphics', () => {
    const gbr = VANILLA_D_DOOMLOOP_ENTRY_ORDER.find((step) => step.opName === 'G_BeginRecording')!;
    const iig = VANILLA_D_DOOMLOOP_ENTRY_ORDER.find((step) => step.opName === 'I_InitGraphics')!;
    expect(gbr.index).toBe(0);
    expect(iig.index).toBe(2);
    expect(gbr.index).toBeLessThan(iig.index);
  });

  test('places debugfileSetup between G_BeginRecording and I_InitGraphics', () => {
    const debugfile = VANILLA_D_DOOMLOOP_ENTRY_ORDER.find((step) => step.opName === 'debugfileSetup')!;
    expect(debugfile.index).toBe(1);
  });
});

describe('VANILLA_D_DOOMLOOP_ABSENT_CHOCOLATE_OPS list', () => {
  test('has exactly eleven Chocolate-only ops', () => {
    expect(VANILLA_D_DOOMLOOP_ABSENT_CHOCOLATE_OPS.length).toBe(11);
    expect(VANILLA_D_DOOMLOOP_ABSENT_CHOCOLATE_OPS.length).toBe(VANILLA_D_DOOMLOOP_ABSENT_CHOCOLATE_OP_COUNT);
  });

  test('lists every Chocolate-only entry-time addition', () => {
    expect([...VANILLA_D_DOOMLOOP_ABSENT_CHOCOLATE_OPS]).toEqual([
      'bfgEditionWarning',
      'mainLoopStartedFlag',
      'preLoopTryRunTics',
      'I_SetWindowTitle',
      'I_GraphicsCheckCommandLine',
      'I_SetGrabMouseCallback',
      'EnableLoadingDisk',
      'V_RestoreBuffer',
      'R_ExecuteSetViewSize',
      'D_StartGameLoop',
      'testcontrolsBranch',
    ]);
  });

  test('every absent op is missing from the canonical entry order', () => {
    const presentOpNames = new Set(VANILLA_D_DOOMLOOP_ENTRY_ORDER.map((step) => step.opName));
    for (const absentOp of VANILLA_D_DOOMLOOP_ABSENT_CHOCOLATE_OPS) {
      expect(presentOpNames.has(absentOp as never)).toBe(false);
    }
  });
});

describe('VANILLA_D_DOOMLOOP top-level constants', () => {
  test('pins TICRATE at 35 Hz', () => {
    expect(VANILLA_D_DOOMLOOP_TICRATE_HZ).toBe(35);
  });

  test('pins the frame-loop first call as I_StartFrame', () => {
    expect(VANILLA_D_DOOMLOOP_FRAME_LOOP_FIRST_CALL_C_SYMBOL).toBe('I_StartFrame');
  });

  test('reports the frame-loop has no exit condition', () => {
    expect(VANILLA_D_DOOMLOOP_FRAME_LOOP_HAS_EXIT_CONDITION).toBe(false);
  });

  test('pins the debugfile filename format as "debug%i.txt"', () => {
    expect(VANILLA_D_DOOMLOOP_DEBUGFILE_FILENAME_FORMAT).toBe('debug%i.txt');
  });

  test('pins the debugfile fopen mode as "w"', () => {
    expect(VANILLA_D_DOOMLOOP_DEBUGFILE_FOPEN_MODE).toBe('w');
  });

  test('pins the debugfile printf literal verbatim', () => {
    expect(VANILLA_D_DOOMLOOP_DEBUGFILE_PRINTF_LITERAL).toBe('debug output to: %s\n');
  });

  test('pins the debugfile parm literal as "-debugfile" (with leading dash)', () => {
    expect(VANILLA_D_DOOMLOOP_DEBUGFILE_PARM_LITERAL).toBe('-debugfile');
    expect(VANILLA_D_DOOMLOOP_DEBUGFILE_PARM_LITERAL.startsWith('-')).toBe(true);
  });
});

describe('VANILLA_D_DOOMLOOP_ENTRY_TIMING_DERIVED_INVARIANTS list', () => {
  test('has exactly twenty-two derived invariants', () => {
    expect(VANILLA_D_DOOMLOOP_ENTRY_TIMING_DERIVED_INVARIANTS.length).toBe(22);
    expect(VANILLA_D_DOOMLOOP_ENTRY_TIMING_DERIVED_INVARIANTS.length).toBe(VANILLA_D_DOOMLOOP_ENTRY_TIMING_DERIVED_INVARIANT_COUNT);
  });

  test('every invariant id is unique', () => {
    const ids = VANILLA_D_DOOMLOOP_ENTRY_TIMING_DERIVED_INVARIANTS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every invariant declares a non-empty description', () => {
    for (const entry of VANILLA_D_DOOMLOOP_ENTRY_TIMING_DERIVED_INVARIANTS) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});

describe('VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES probe set', () => {
  test('has exactly thirty-three pinned probes', () => {
    expect(VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES.length).toBe(33);
    expect(VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES.length).toBe(VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBE_COUNT);
  });

  test('every probe id is unique', () => {
    const ids = VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every probe declares one expected answer field consistent with its query kind', () => {
    for (const probe of VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES) {
      switch (probe.queryKind) {
        case 'op-at-index':
          expect(probe.queryIndex).not.toBeNull();
          expect(probe.expectedAnsweredOpName).not.toBeNull();
          break;
        case 'op-condition':
          expect(probe.queryOpName).not.toBeNull();
          expect(probe.expectedAnsweredCondition).not.toBeNull();
          break;
        case 'op-presence':
          expect(probe.queryOpName).not.toBeNull();
          expect(probe.expectedAnsweredPresent).not.toBeNull();
          break;
        case 'op-printf-literal':
          expect(probe.queryOpName).not.toBeNull();
          break;
        case 'pre-loop-op-count':
        case 'tic-rate-hz':
          expect(probe.expectedAnsweredCount).not.toBeNull();
          break;
        case 'frame-loop-first-call':
          expect(probe.expectedAnsweredOpName).not.toBeNull();
          break;
        case 'frame-loop-has-exit':
          expect(probe.expectedAnsweredHasExitCondition).not.toBeNull();
          break;
        case 'debugfile-filename-format':
        case 'debugfile-fopen-mode':
        case 'debugfile-parm-literal':
          expect(probe.expectedAnsweredLiteral).not.toBeNull();
          break;
        case 'debugfile-printf-literal':
          expect(probe.expectedAnsweredPrintfLiteral).not.toBeNull();
          break;
        case 'op-precedes-op':
          expect(probe.queryEarlierOpName).not.toBeNull();
          expect(probe.queryLaterOpName).not.toBeNull();
          expect(probe.expectedAnsweredPrecedes).not.toBeNull();
          break;
      }
    }
  });

  test('every witness invariant id refers to a declared derived invariant', () => {
    const declaredInvariantIds = new Set(VANILLA_D_DOOMLOOP_ENTRY_TIMING_DERIVED_INVARIANTS.map((entry) => entry.id));
    for (const probe of VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES) {
      expect(declaredInvariantIds.has(probe.witnessInvariantId)).toBe(true);
    }
  });
});

describe('REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER cross-check', () => {
  test('passes every probe with zero failures', () => {
    expect(crossCheckVanillaDDoomLoopEntryTiming(REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER)).toEqual([]);
  });

  test('answers op-at-index probes with the canonical op name', () => {
    for (const probe of VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES) {
      if (probe.queryKind !== 'op-at-index') continue;
      const result = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
      expect(result.answeredOpName).toBe(probe.expectedAnsweredOpName);
      expect(result.answeredPresent).toBeNull();
      expect(result.answeredCondition).toBeNull();
    }
  });

  test('answers op-presence probes correctly', () => {
    for (const probe of VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES) {
      if (probe.queryKind !== 'op-presence') continue;
      const result = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
      expect(result.answeredPresent).toBe(probe.expectedAnsweredPresent);
    }
  });

  test('answers op-condition probes with the canonical condition', () => {
    for (const probe of VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES) {
      if (probe.queryKind !== 'op-condition') continue;
      const result = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
      expect(result.answeredCondition).toBe(probe.expectedAnsweredCondition);
    }
  });

  test('answers op-printf-literal probes correctly (null for ops without stdout)', () => {
    for (const probe of VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES) {
      if (probe.queryKind !== 'op-printf-literal') continue;
      const result = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
      expect(result.answeredPrintfLiteral).toBe(probe.expectedAnsweredPrintfLiteral);
    }
  });

  test('answers pre-loop-op-count with 3', () => {
    for (const probe of VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES) {
      if (probe.queryKind !== 'pre-loop-op-count') continue;
      const result = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
      expect(result.answeredCount).toBe(3);
    }
  });

  test('answers frame-loop-first-call with I_StartFrame', () => {
    for (const probe of VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES) {
      if (probe.queryKind !== 'frame-loop-first-call') continue;
      const result = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
      expect(result.answeredOpName).toBe('I_StartFrame');
    }
  });

  test('answers frame-loop-has-exit with false', () => {
    for (const probe of VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES) {
      if (probe.queryKind !== 'frame-loop-has-exit') continue;
      const result = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
      expect(result.answeredHasExitCondition).toBe(false);
    }
  });

  test('answers tic-rate-hz with 35', () => {
    for (const probe of VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES) {
      if (probe.queryKind !== 'tic-rate-hz') continue;
      const result = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
      expect(result.answeredCount).toBe(35);
    }
  });

  test('answers debugfile literals correctly', () => {
    for (const probe of VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES) {
      if (probe.queryKind === 'debugfile-filename-format') {
        expect(REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe).answeredLiteral).toBe('debug%i.txt');
      } else if (probe.queryKind === 'debugfile-fopen-mode') {
        expect(REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe).answeredLiteral).toBe('w');
      } else if (probe.queryKind === 'debugfile-parm-literal') {
        expect(REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe).answeredLiteral).toBe('-debugfile');
      } else if (probe.queryKind === 'debugfile-printf-literal') {
        expect(REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe).answeredPrintfLiteral).toBe('debug output to: %s\n');
      }
    }
  });

  test('answers op-precedes-op with true/false correctly', () => {
    for (const probe of VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES) {
      if (probe.queryKind !== 'op-precedes-op') continue;
      const result = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
      expect(result.answeredPrecedes).toBe(probe.expectedAnsweredPrecedes);
    }
  });
});

describe('crossCheckVanillaDDoomLoopEntryTiming failure modes', () => {
  test('detects a handler that places I_InitGraphics at index 0 (Chocolate-style early init)', () => {
    const swappedFirstStep: VanillaDDoomLoopEntryTimingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'op-at-index' && probe.queryIndex === 0) {
          return Object.freeze({ ...inner, answeredOpName: 'I_InitGraphics' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomLoopEntryTiming(swappedFirstStep);
    expect(failures.some((failure) => failure.startsWith('probe:index-zero-is-g-beginrecording:answeredOpName:value-mismatch'))).toBe(true);
  });

  test('detects a handler that gates I_InitGraphics on a flag (Chocolate-style)', () => {
    const conditionalIInitGraphics: VanillaDDoomLoopEntryTimingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'op-condition' && probe.queryOpName === 'I_InitGraphics') {
          return Object.freeze({ ...inner, answeredCondition: 'demorecording-flag-set' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomLoopEntryTiming(conditionalIInitGraphics);
    expect(failures.some((failure) => failure.startsWith('probe:i-initgraphics-condition-is-always:answeredCondition:value-mismatch'))).toBe(true);
  });

  test('detects a handler that includes the BFG-Edition warning in the entry sequence', () => {
    const includesBfg: VanillaDDoomLoopEntryTimingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'op-presence' && probe.queryOpName === 'bfgEditionWarning') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomLoopEntryTiming(includesBfg);
    expect(failures.some((failure) => failure.startsWith('probe:bfg-edition-warning-is-absent:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that includes the main_loop_started flag in the entry sequence', () => {
    const includesFlag: VanillaDDoomLoopEntryTimingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'op-presence' && probe.queryOpName === 'mainLoopStartedFlag') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomLoopEntryTiming(includesFlag);
    expect(failures.some((failure) => failure.startsWith('probe:main-loop-started-flag-is-absent:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that primes the tic accumulator pre-loop (Chocolate TryRunTics)', () => {
    const includesPriming: VanillaDDoomLoopEntryTimingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'op-presence' && probe.queryOpName === 'preLoopTryRunTics') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomLoopEntryTiming(includesPriming);
    expect(failures.some((failure) => failure.startsWith('probe:preloop-tryruntics-is-absent:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that includes I_SetWindowTitle at entry-time (Chocolate-only)', () => {
    const includesWindowTitle: VanillaDDoomLoopEntryTimingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'op-presence' && probe.queryOpName === 'I_SetWindowTitle') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomLoopEntryTiming(includesWindowTitle);
    expect(failures.some((failure) => failure.startsWith('probe:i-setwindowtitle-is-absent:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that includes D_StartGameLoop at entry-time (Chocolate-only)', () => {
    const includesStartGameLoop: VanillaDDoomLoopEntryTimingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'op-presence' && probe.queryOpName === 'D_StartGameLoop') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomLoopEntryTiming(includesStartGameLoop);
    expect(failures.some((failure) => failure.startsWith('probe:d-startgameloop-is-absent:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that contains the testcontrols branch at entry-time (Chocolate-only)', () => {
    const includesTestControls: VanillaDDoomLoopEntryTimingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'op-presence' && probe.queryOpName === 'testcontrolsBranch') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomLoopEntryTiming(includesTestControls);
    expect(failures.some((failure) => failure.startsWith('probe:testcontrols-branch-is-absent:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that uses "debug%d.txt" filename format (typo against vanilla source)', () => {
    const wrongFormat: VanillaDDoomLoopEntryTimingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'debugfile-filename-format') {
          return Object.freeze({ ...inner, answeredLiteral: 'debug%d.txt' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomLoopEntryTiming(wrongFormat);
    expect(failures.some((failure) => failure.startsWith('probe:debugfile-filename-format-is-debug-percent-i-txt:answeredLiteral:value-mismatch'))).toBe(true);
  });

  test('detects a handler that uses fopen mode "a" instead of "w"', () => {
    const wrongMode: VanillaDDoomLoopEntryTimingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'debugfile-fopen-mode') {
          return Object.freeze({ ...inner, answeredLiteral: 'a' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomLoopEntryTiming(wrongMode);
    expect(failures.some((failure) => failure.startsWith('probe:debugfile-fopen-mode-is-write:answeredLiteral:value-mismatch'))).toBe(true);
  });

  test('detects a handler that drops the leading dash from the parm literal', () => {
    const noLeadingDash: VanillaDDoomLoopEntryTimingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'debugfile-parm-literal') {
          return Object.freeze({ ...inner, answeredLiteral: 'debugfile' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomLoopEntryTiming(noLeadingDash);
    expect(failures.some((failure) => failure.startsWith('probe:debugfile-parm-literal-is-dash-debugfile:answeredLiteral:value-mismatch'))).toBe(true);
  });

  test('detects a handler that emits a different debugfile printf literal', () => {
    const wrongPrintf: VanillaDDoomLoopEntryTimingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'debugfile-printf-literal') {
          return Object.freeze({ ...inner, answeredPrintfLiteral: 'Debug output: %s\n' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomLoopEntryTiming(wrongPrintf);
    expect(failures.some((failure) => failure.startsWith('probe:debugfile-printf-literal-is-debug-output-to:answeredPrintfLiteral:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports D_RunFrame as the first per-frame call (Chocolate-style)', () => {
    const chocolateBody: VanillaDDoomLoopEntryTimingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'frame-loop-first-call') {
          return Object.freeze({ ...inner, answeredOpName: 'D_RunFrame' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomLoopEntryTiming(chocolateBody);
    expect(failures.some((failure) => failure.startsWith('probe:frame-loop-first-call-is-i-startframe:answeredOpName:value-mismatch'))).toBe(true);
  });

  test('detects a handler that adds an explicit exit condition to the frame loop', () => {
    const explicitExit: VanillaDDoomLoopEntryTimingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'frame-loop-has-exit') {
          return Object.freeze({ ...inner, answeredHasExitCondition: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomLoopEntryTiming(explicitExit);
    expect(failures.some((failure) => failure.startsWith('probe:frame-loop-has-no-exit-condition:answeredHasExitCondition:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports a different tic rate (e.g. 70 Hz)', () => {
    const wrongRate: VanillaDDoomLoopEntryTimingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'tic-rate-hz') {
          return Object.freeze({ ...inner, answeredCount: 70 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomLoopEntryTiming(wrongRate);
    expect(failures.some((failure) => failure.startsWith('probe:tic-rate-is-thirty-five-hz:answeredCount:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports pre-loop-op-count as 11 (Chocolate-style)', () => {
    const chocolateCount: VanillaDDoomLoopEntryTimingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'pre-loop-op-count') {
          return Object.freeze({ ...inner, answeredCount: 11 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomLoopEntryTiming(chocolateCount);
    expect(failures.some((failure) => failure.startsWith('probe:pre-loop-op-count-is-three:answeredCount:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports G_BeginRecording as following I_InitGraphics', () => {
    const reversedOrder: VanillaDDoomLoopEntryTimingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'op-precedes-op' && probe.queryEarlierOpName === 'G_BeginRecording' && probe.queryLaterOpName === 'I_InitGraphics') {
          return Object.freeze({ ...inner, answeredPrecedes: false });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomLoopEntryTiming(reversedOrder);
    expect(failures.some((failure) => failure.startsWith('probe:g-beginrecording-precedes-i-initgraphics:answeredPrecedes:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports debugfileSetup with no printf literal', () => {
    const droppedPrintf: VanillaDDoomLoopEntryTimingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'op-printf-literal' && probe.queryOpName === 'debugfileSetup') {
          return Object.freeze({ ...inner, answeredPrintfLiteral: null });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomLoopEntryTiming(droppedPrintf);
    expect(failures.some((failure) => failure.startsWith('probe:debugfile-setup-printf-literal-is-debug-output-to:answeredPrintfLiteral:value-mismatch'))).toBe(true);
  });
});

describe('deriveExpectedVanillaDDoomLoopEntryTimingResult helper', () => {
  test('matches the canonical answer for every pinned probe', () => {
    for (const probe of VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES) {
      const expected = deriveExpectedVanillaDDoomLoopEntryTimingResult(probe);
      const actual = REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER.runProbe(probe);
      expect(actual).toEqual(expected);
    }
  });

  test('answers op-at-index for an out-of-range index by returning null answeredOpName', () => {
    const outOfRangeProbe: VanillaDDoomLoopEntryTimingProbe = {
      id: 'derive-out-of-range',
      description: 'Synthetic probe used to verify out-of-range handling outside the pinned probe set.',
      queryKind: 'op-at-index',
      queryIndex: 99,
      queryOpName: null,
      queryEarlierOpName: null,
      queryLaterOpName: null,
      expectedAnsweredOpName: null,
      expectedAnsweredPresent: null,
      expectedAnsweredCondition: null,
      expectedAnsweredPrintfLiteral: null,
      expectedAnsweredCount: null,
      expectedAnsweredHasExitCondition: null,
      expectedAnsweredLiteral: null,
      expectedAnsweredPrecedes: null,
      witnessInvariantId: 'ENTRY_HAS_EXACTLY_THREE_PRE_LOOP_OPS',
    };
    const result = deriveExpectedVanillaDDoomLoopEntryTimingResult(outOfRangeProbe);
    expect(result.answeredOpName).toBeNull();
  });

  test('answers op-condition with null for an unrecognised op', () => {
    const unknownOpProbe: VanillaDDoomLoopEntryTimingProbe = {
      id: 'derive-unknown-op',
      description: 'Synthetic probe for an unrecognised op.',
      queryKind: 'op-condition',
      queryIndex: null,
      queryOpName: 'Foo_Bar',
      queryEarlierOpName: null,
      queryLaterOpName: null,
      expectedAnsweredOpName: null,
      expectedAnsweredPresent: null,
      expectedAnsweredCondition: null,
      expectedAnsweredPrintfLiteral: null,
      expectedAnsweredCount: null,
      expectedAnsweredHasExitCondition: null,
      expectedAnsweredLiteral: null,
      expectedAnsweredPrecedes: null,
      witnessInvariantId: 'ENTRY_HAS_EXACTLY_THREE_PRE_LOOP_OPS',
    };
    const result = deriveExpectedVanillaDDoomLoopEntryTimingResult(unknownOpProbe);
    expect(result.answeredCondition).toBeNull();
  });

  test('answers op-precedes-op with false when one or both ops are absent', () => {
    const absentEarlierProbe: VanillaDDoomLoopEntryTimingProbe = {
      id: 'derive-absent-earlier',
      description: 'Synthetic probe for a precedence query with an absent earlier op.',
      queryKind: 'op-precedes-op',
      queryIndex: null,
      queryOpName: null,
      queryEarlierOpName: 'Foo_Bar',
      queryLaterOpName: 'I_InitGraphics',
      expectedAnsweredOpName: null,
      expectedAnsweredPresent: null,
      expectedAnsweredCondition: null,
      expectedAnsweredPrintfLiteral: null,
      expectedAnsweredCount: null,
      expectedAnsweredHasExitCondition: null,
      expectedAnsweredLiteral: null,
      expectedAnsweredPrecedes: false,
      witnessInvariantId: 'ENTRY_HAS_EXACTLY_THREE_PRE_LOOP_OPS',
    };
    const result = deriveExpectedVanillaDDoomLoopEntryTimingResult(absentEarlierProbe);
    expect(result.answeredPrecedes).toBe(false);
  });
});

describe('vanilla DOOM 1.9 D_DoomLoop entry sequence matches the linuxdoom-1.10 source ordering', () => {
  test('orders G_BeginRecording strictly before I_InitGraphics in the canonical pre-loop sequence', () => {
    const opNames = VANILLA_D_DOOMLOOP_ENTRY_ORDER.map((step) => step.opName);
    const gbrOffset = opNames.indexOf('G_BeginRecording');
    const iigOffset = opNames.indexOf('I_InitGraphics');
    expect(gbrOffset).toBe(0);
    expect(iigOffset).toBe(2);
    expect(gbrOffset).toBeLessThan(iigOffset);
  });

  test('orders debugfileSetup strictly before I_InitGraphics in the canonical pre-loop sequence', () => {
    const opNames = VANILLA_D_DOOMLOOP_ENTRY_ORDER.map((step) => step.opName);
    const debugfileOffset = opNames.indexOf('debugfileSetup');
    const iigOffset = opNames.indexOf('I_InitGraphics');
    expect(debugfileOffset).toBe(1);
    expect(iigOffset).toBe(2);
    expect(debugfileOffset).toBeLessThan(iigOffset);
  });

  test('omits every Chocolate-only entry-time op from the canonical pre-loop sequence', () => {
    const opNames = new Set(VANILLA_D_DOOMLOOP_ENTRY_ORDER.map((step) => step.opName));
    for (const chocolateOnly of VANILLA_D_DOOMLOOP_ABSENT_CHOCOLATE_OPS) {
      expect(opNames.has(chocolateOnly as never)).toBe(false);
    }
  });

  test('produces the verbatim debugfile printf literal as the only stdout side-effect among the three pre-loop ops', () => {
    const stdoutEmitters = VANILLA_D_DOOMLOOP_ENTRY_ORDER.filter((step) => step.printfLiteral !== null);
    expect(stdoutEmitters.length).toBe(1);
    expect(stdoutEmitters[0]!.opName).toBe('debugfileSetup');
    expect(stdoutEmitters[0]!.printfLiteral).toBe('debug output to: %s\n');
  });
});

describe('NULL_RESULT_FIELDS template (test-internal sanity)', () => {
  test('matches the answeredX-null shape that probes use when a field is not relevant', () => {
    expect(NULL_RESULT_FIELDS.answeredOpName).toBeNull();
    expect(NULL_RESULT_FIELDS.answeredPresent).toBeNull();
    expect(NULL_RESULT_FIELDS.answeredCondition).toBeNull();
    expect(NULL_RESULT_FIELDS.answeredPrintfLiteral).toBeNull();
    expect(NULL_RESULT_FIELDS.answeredCount).toBeNull();
    expect(NULL_RESULT_FIELDS.answeredHasExitCondition).toBeNull();
    expect(NULL_RESULT_FIELDS.answeredLiteral).toBeNull();
    expect(NULL_RESULT_FIELDS.answeredPrecedes).toBeNull();
  });
});

describe('implement-d-doomloop-entry-timing step file', () => {
  test('declares the launch lane and the implement write lock', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('## lane\n\nlaunch');
    expect(stepText).toContain('- src/bootstrap/implement-d-doomloop-entry-timing.ts');
    expect(stepText).toContain('- test/vanilla_parity/launch/implement-d-doomloop-entry-timing.test.ts');
  });

  test('lists d_main.c, g_game.c, i_timer.c, i_video.c, and m_menu.c as research sources', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('- d_main.c');
    expect(stepText).toContain('- g_game.c');
    expect(stepText).toContain('- i_timer.c');
    expect(stepText).toContain('- i_video.c');
    expect(stepText).toContain('- m_menu.c');
  });

  test('declares the prerequisite gate 00-018', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('## prerequisites\n\n- 00-018');
  });
});
