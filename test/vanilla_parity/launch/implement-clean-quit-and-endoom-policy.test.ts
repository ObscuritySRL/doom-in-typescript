import { describe, expect, test } from 'bun:test';

import {
  REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER,
  VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT,
  VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_CLAUSE_COUNT,
  VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_DERIVED_INVARIANTS,
  VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_DERIVED_INVARIANT_COUNT,
  VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES,
  VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBE_COUNT,
  VANILLA_ENDOOM_BYTES_PER_CELL,
  VANILLA_ENDOOM_CELL_COUNT,
  VANILLA_ENDOOM_GRID_COLUMNS,
  VANILLA_ENDOOM_GRID_ROWS,
  VANILLA_ENDOOM_LUMP_NAME,
  VANILLA_ENDOOM_LUMP_SIZE_BYTES,
  VANILLA_I_ERROR_CLEANUP_OP_COUNT,
  VANILLA_I_ERROR_CLEANUP_ORDER,
  VANILLA_I_ERROR_EXIT_CODE,
  VANILLA_I_ERROR_HAS_RECURSIVE_GUARD,
  VANILLA_I_ERROR_PROLOGUE_OP_COUNT,
  VANILLA_I_ERROR_PROLOGUE_ORDER,
  VANILLA_I_ERROR_STDERR_PREFIX,
  VANILLA_I_ERROR_STDERR_TRAILING_NEWLINE,
  VANILLA_I_QUIT_CLEANUP_OP_COUNT,
  VANILLA_I_QUIT_EXIT_CODE,
  VANILLA_I_QUIT_ORDER,
  VANILLA_I_QUIT_TOTAL_STEP_COUNT,
  VANILLA_LINUXDOOM_ABSENT_CHOCOLATE_QUIT_FEATURES,
  VANILLA_LINUXDOOM_ABSENT_CHOCOLATE_QUIT_FEATURE_COUNT,
  VANILLA_LINUXDOOM_HAS_D_ENDOOM_FUNCTION,
  VANILLA_LINUXDOOM_HAS_I_ATEXIT_STACK,
  VANILLA_LINUXDOOM_HAS_I_ENDOOM_FUNCTION,
  crossCheckVanillaCleanQuitAndEndoomPolicy,
  deriveExpectedVanillaCleanQuitAndEndoomPolicyResult,
} from '../../../src/bootstrap/implement-clean-quit-and-endoom-policy.ts';
import type { VanillaCleanQuitAndEndoomPolicyHandler, VanillaCleanQuitAndEndoomPolicyProbe, VanillaCleanQuitAndEndoomPolicyResult } from '../../../src/bootstrap/implement-clean-quit-and-endoom-policy.ts';

const STEP_FILE_RELATIVE_PATH = 'plan_vanilla_parity/steps/03-010-implement-clean-quit-and-endoom-policy.md';

const NULL_RESULT_FIELDS = Object.freeze({
  answeredOpName: null,
  answeredPresent: null,
  answeredCondition: null,
  answeredCount: null,
  answeredLiteral: null,
  answeredPrecedes: null,
}) satisfies VanillaCleanQuitAndEndoomPolicyResult;

describe('VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT ledger shape', () => {
  test('audits exactly thirty-one contract clauses for the clean-quit and ENDOOM policy', () => {
    expect(VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.length).toBe(31);
    expect(VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.length).toBe(VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_CLAUSE_COUNT);
  });

  test('every clause id is unique', () => {
    const ids = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every clause references a real linuxdoom-1.10 source file or the IWAD', () => {
    for (const entry of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT) {
      expect(['i_system.c', 'd_main.c', 'i_video.c', 'DOOM1.WAD']).toContain(entry.referenceSourceFile);
      expect(['I_Quit', 'I_Error', 'D_Endoom', 'I_Endoom', 'I_AtExit', 'ENDOOM']).toContain(entry.cSymbol);
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('exactly four clauses are pinned against the IWAD ENDOOM lump', () => {
    const endoomClauses = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.filter((entry) => entry.cSymbol === 'ENDOOM');
    expect(endoomClauses.length).toBe(4);
    for (const clause of endoomClauses) {
      expect(clause.referenceSourceFile).toBe('DOOM1.WAD');
    }
  });

  test('the I_QUIT_HAS_FIVE_OPERATIONS clause names every op in canonical order', () => {
    const entry = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'I_QUIT_HAS_FIVE_OPERATIONS');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('D_QuitNetGame');
    expect(entry!.invariant).toContain('G_CheckDemoStatus');
    expect(entry!.invariant).toContain('M_SaveDefaults');
    expect(entry!.invariant).toContain('I_ShutdownGraphics');
    expect(entry!.invariant).toContain('exit(0)');
  });

  test('the I_QUIT_FIRST_OP_IS_D_QUITNETGAME clause cites unconditional behavior', () => {
    const entry = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'I_QUIT_FIRST_OP_IS_D_QUITNETGAME');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('D_QuitNetGame');
    expect(entry!.invariant).toContain('unconditional');
  });

  test('the I_QUIT_THIRD_OP_IS_M_SAVEDEFAULTS clause distinguishes from I_Error', () => {
    const entry = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'I_QUIT_THIRD_OP_IS_M_SAVEDEFAULTS');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('M_SaveDefaults');
    expect(entry!.invariant).toContain('I_Error');
    expect(entry!.invariant).toContain('default.cfg');
  });

  test('the I_QUIT_FIFTH_OP_IS_EXIT_ZERO clause cites the verbatim exit code', () => {
    const entry = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'I_QUIT_FIFTH_OP_IS_EXIT_ZERO');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('exit(0)');
    expect(entry!.invariant).toContain('zero');
  });

  test('the I_ERROR_HAS_FOUR_PROLOGUE_PRINTS clause cites the verbatim print sequence', () => {
    const entry = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'I_ERROR_HAS_FOUR_PROLOGUE_PRINTS');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('fprintf');
    expect(entry!.invariant).toContain('vfprintf');
    expect(entry!.invariant).toContain('fflush');
    expect(entry!.invariant).toContain('Error: ');
  });

  test('the I_ERROR_PROLOGUE_PREFIX_IS_ERROR_COLON_SPACE clause pins the verbatim prefix', () => {
    const entry = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'I_ERROR_PROLOGUE_PREFIX_IS_ERROR_COLON_SPACE');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('"Error: "');
    expect(entry!.invariant).toContain('verbatim');
  });

  test('the I_ERROR_FIRST_CLEANUP_IS_DEMORECORDING_GATED_G_CHECKDEMOSTATUS clause cites the gate', () => {
    const entry = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'I_ERROR_FIRST_CLEANUP_IS_DEMORECORDING_GATED_G_CHECKDEMOSTATUS');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('demorecording');
    expect(entry!.invariant).toContain('G_CheckDemoStatus');
    expect(entry!.invariant).toContain('I_Quit');
  });

  test('the I_ERROR_FOURTH_CLEANUP_IS_EXIT_MINUS_ONE clause cites the negative exit code', () => {
    const entry = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'I_ERROR_FOURTH_CLEANUP_IS_EXIT_MINUS_ONE');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('exit(-1)');
    expect(entry!.invariant).toContain('-1');
  });

  test('the I_ERROR_OMITS_M_SAVEDEFAULTS clause cites the inconsistent-state rationale', () => {
    const entry = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'I_ERROR_OMITS_M_SAVEDEFAULTS');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('M_SaveDefaults');
    expect(entry!.invariant).toContain('inconsistent state');
  });

  test('the I_ERROR_HAS_NO_RECURSIVE_GUARD_SENTINEL clause distinguishes from Chocolate', () => {
    const entry = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'I_ERROR_HAS_NO_RECURSIVE_GUARD_SENTINEL');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('already_quitting');
    expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
    expect(entry!.invariant).toContain('recursive');
  });

  test('the LINUXDOOM_OMITS_D_ENDOOM_FUNCTION clause cites the W_CacheLumpName call', () => {
    const entry = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'LINUXDOOM_OMITS_D_ENDOOM_FUNCTION');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('D_Endoom');
    expect(entry!.invariant).toContain('W_CacheLumpName');
    expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
  });

  test('the LINUXDOOM_OMITS_I_ENDOOM_FUNCTION clause cites the SDL host emulation', () => {
    const entry = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'LINUXDOOM_OMITS_I_ENDOOM_FUNCTION');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('I_Endoom');
    expect(entry!.invariant).toContain('SDL host');
    expect(entry!.invariant).toContain('B8000');
  });

  test('the LINUXDOOM_OMITS_I_ATEXIT_REGISTRATION_STACK clause cites the linked-list mechanism', () => {
    const entry = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'LINUXDOOM_OMITS_I_ATEXIT_REGISTRATION_STACK');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('I_AtExit');
    expect(entry!.invariant).toContain('linked list');
    expect(entry!.invariant).toContain('run_on_error');
  });

  test('the ENDOOM_LUMP_NAME_IS_ENDOOM clause pins the verbatim name', () => {
    const entry = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'ENDOOM_LUMP_NAME_IS_ENDOOM');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('"ENDOOM"');
    expect(entry!.invariant).toContain('case-insensitive');
  });

  test('the ENDOOM_LUMP_SIZE_IS_FOUR_THOUSAND_BYTES clause cites the VGA layout', () => {
    const entry = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'ENDOOM_LUMP_SIZE_IS_FOUR_THOUSAND_BYTES');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('4000 bytes');
    expect(entry!.invariant).toContain('80 columns');
    expect(entry!.invariant).toContain('25 rows');
    expect(entry!.invariant).toContain('0xB8000');
  });

  test('the ENDOOM_GRID_IS_EIGHTY_BY_TWENTY_FIVE_CELLS clause cites the IBM PC text mode', () => {
    const entry = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'ENDOOM_GRID_IS_EIGHTY_BY_TWENTY_FIVE_CELLS');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('80 columns');
    expect(entry!.invariant).toContain('25 rows');
    expect(entry!.invariant).toContain('IBM PC VGA');
  });

  test('the ENDOOM_BYTES_PER_CELL_IS_TWO clause cites the CP437 + attribute layout', () => {
    const entry = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'ENDOOM_BYTES_PER_CELL_IS_TWO');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('2 bytes');
    expect(entry!.invariant).toContain('CP437');
    expect(entry!.invariant).toContain('blink');
  });

  test('every Chocolate-only-omission clause names its specific Chocolate addition', () => {
    const omissionClauses: ReadonlyArray<{ id: string; expectedSnippet: string }> = [
      { id: 'QUIT_OMITS_S_SHUTDOWN_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'S_Shutdown' },
      { id: 'QUIT_OMITS_I_SHUTDOWNTIMER_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'I_ShutdownTimer' },
      { id: 'QUIT_OMITS_LIFO_TRAVERSAL_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'LIFO' },
      { id: 'QUIT_OMITS_RUN_ON_ERROR_FILTER_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'run_on_error' },
    ];
    for (const { id, expectedSnippet } of omissionClauses) {
      const entry = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === id);
      expect(entry).toBeDefined();
      expect(entry!.invariant).toContain(expectedSnippet);
      expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
    }
  });
});

describe('VANILLA_I_QUIT_ORDER canonical sequence', () => {
  test('has exactly five entries', () => {
    expect(VANILLA_I_QUIT_ORDER.length).toBe(5);
    expect(VANILLA_I_QUIT_ORDER.length).toBe(VANILLA_I_QUIT_TOTAL_STEP_COUNT);
  });

  test('orders the canonical 5-step sequence verbatim', () => {
    expect(VANILLA_I_QUIT_ORDER.map((step) => step.opName)).toEqual(['D_QuitNetGame', 'G_CheckDemoStatus', 'M_SaveDefaults', 'I_ShutdownGraphics', 'exit-zero']);
  });

  test('positions every step at the canonical 0-based index', () => {
    for (let index = 0; index < VANILLA_I_QUIT_ORDER.length; index++) {
      expect(VANILLA_I_QUIT_ORDER[index]!.index).toBe(index);
    }
  });

  test('classifies the first four steps as quit-cleanup and the last as quit-termination', () => {
    expect(VANILLA_I_QUIT_ORDER[0]!.phase).toBe('quit-cleanup');
    expect(VANILLA_I_QUIT_ORDER[1]!.phase).toBe('quit-cleanup');
    expect(VANILLA_I_QUIT_ORDER[2]!.phase).toBe('quit-cleanup');
    expect(VANILLA_I_QUIT_ORDER[3]!.phase).toBe('quit-cleanup');
    expect(VANILLA_I_QUIT_ORDER[4]!.phase).toBe('quit-termination');
  });

  test('declares every quit step as unconditional', () => {
    for (const step of VANILLA_I_QUIT_ORDER) {
      expect(step.condition).toBe('always');
    }
  });

  test('matches the canonical cleanup op count of four (excluding termination)', () => {
    const cleanupSteps = VANILLA_I_QUIT_ORDER.filter((step) => step.phase === 'quit-cleanup');
    expect(cleanupSteps.length).toBe(4);
    expect(cleanupSteps.length).toBe(VANILLA_I_QUIT_CLEANUP_OP_COUNT);
  });
});

describe('VANILLA_I_ERROR_CLEANUP_ORDER canonical sequence', () => {
  test('has exactly four entries (3 cleanup + 1 termination)', () => {
    expect(VANILLA_I_ERROR_CLEANUP_ORDER.length).toBe(4);
  });

  test('orders the canonical 4-step error cleanup sequence verbatim', () => {
    expect(VANILLA_I_ERROR_CLEANUP_ORDER.map((step) => step.opName)).toEqual(['G_CheckDemoStatus', 'D_QuitNetGame', 'I_ShutdownGraphics', 'exit-minus-one']);
  });

  test('gates only G_CheckDemoStatus on demorecording', () => {
    expect(VANILLA_I_ERROR_CLEANUP_ORDER[0]!.condition).toBe('demorecording-flag-set');
    expect(VANILLA_I_ERROR_CLEANUP_ORDER[1]!.condition).toBe('always');
    expect(VANILLA_I_ERROR_CLEANUP_ORDER[2]!.condition).toBe('always');
    expect(VANILLA_I_ERROR_CLEANUP_ORDER[3]!.condition).toBe('always');
  });

  test('classifies the first three as error-cleanup and the last as error-termination', () => {
    expect(VANILLA_I_ERROR_CLEANUP_ORDER[0]!.phase).toBe('error-cleanup');
    expect(VANILLA_I_ERROR_CLEANUP_ORDER[1]!.phase).toBe('error-cleanup');
    expect(VANILLA_I_ERROR_CLEANUP_ORDER[2]!.phase).toBe('error-cleanup');
    expect(VANILLA_I_ERROR_CLEANUP_ORDER[3]!.phase).toBe('error-termination');
  });

  test('omits M_SaveDefaults from the I_Error cleanup sequence', () => {
    const opNames = VANILLA_I_ERROR_CLEANUP_ORDER.map((step) => step.opName);
    expect(opNames).not.toContain('M_SaveDefaults');
  });

  test('reports cleanup op count of three (excluding termination)', () => {
    const cleanupSteps = VANILLA_I_ERROR_CLEANUP_ORDER.filter((step) => step.phase === 'error-cleanup');
    expect(cleanupSteps.length).toBe(3);
    expect(cleanupSteps.length).toBe(VANILLA_I_ERROR_CLEANUP_OP_COUNT);
  });
});

describe('VANILLA_I_ERROR_PROLOGUE_ORDER canonical sequence', () => {
  test('has exactly four prologue prints', () => {
    expect(VANILLA_I_ERROR_PROLOGUE_ORDER.length).toBe(4);
    expect(VANILLA_I_ERROR_PROLOGUE_ORDER.length).toBe(VANILLA_I_ERROR_PROLOGUE_OP_COUNT);
  });

  test('orders the canonical prologue prints verbatim', () => {
    expect(VANILLA_I_ERROR_PROLOGUE_ORDER.map((step) => step.opName)).toEqual(['fprintf-error-prefix', 'vfprintf-error-message', 'fprintf-trailing-newline', 'fflush-stderr']);
  });

  test('classifies every prologue step as error-prologue', () => {
    for (const step of VANILLA_I_ERROR_PROLOGUE_ORDER) {
      expect(step.phase).toBe('error-prologue');
      expect(step.condition).toBe('always');
    }
  });
});

describe('VANILLA_LINUXDOOM_ABSENT_CHOCOLATE_QUIT_FEATURES list', () => {
  test('has exactly eight Chocolate-only quit-stage features', () => {
    expect(VANILLA_LINUXDOOM_ABSENT_CHOCOLATE_QUIT_FEATURES.length).toBe(8);
    expect(VANILLA_LINUXDOOM_ABSENT_CHOCOLATE_QUIT_FEATURES.length).toBe(VANILLA_LINUXDOOM_ABSENT_CHOCOLATE_QUIT_FEATURE_COUNT);
  });

  test('lists every Chocolate-only quit-stage feature in canonical order', () => {
    expect([...VANILLA_LINUXDOOM_ABSENT_CHOCOLATE_QUIT_FEATURES]).toEqual(['I_AtExit', 'lifoTraversal', 'runOnErrorFilter', 'D_Endoom', 'I_Endoom', 'S_Shutdown', 'I_ShutdownTimer', 'recursiveCallGuard']);
  });
});

describe('VANILLA top-level constants', () => {
  test('pins the I_Quit exit code at 0', () => {
    expect(VANILLA_I_QUIT_EXIT_CODE).toBe(0);
  });

  test('pins the I_Error exit code at -1', () => {
    expect(VANILLA_I_ERROR_EXIT_CODE).toBe(-1);
  });

  test('pins the I_Error stderr prefix as "Error: " (capital E, single space)', () => {
    expect(VANILLA_I_ERROR_STDERR_PREFIX).toBe('Error: ');
    expect(VANILLA_I_ERROR_STDERR_PREFIX.length).toBe(7);
  });

  test('pins the I_Error trailing newline as "\\n"', () => {
    expect(VANILLA_I_ERROR_STDERR_TRAILING_NEWLINE).toBe('\n');
    expect(VANILLA_I_ERROR_STDERR_TRAILING_NEWLINE.length).toBe(1);
  });

  test('pins the ENDOOM lump name as "ENDOOM"', () => {
    expect(VANILLA_ENDOOM_LUMP_NAME).toBe('ENDOOM');
  });

  test('pins the ENDOOM lump size at 4000 bytes', () => {
    expect(VANILLA_ENDOOM_LUMP_SIZE_BYTES).toBe(4000);
  });

  test('pins the ENDOOM grid as 80 columns by 25 rows', () => {
    expect(VANILLA_ENDOOM_GRID_COLUMNS).toBe(80);
    expect(VANILLA_ENDOOM_GRID_ROWS).toBe(25);
  });

  test('pins ENDOOM bytes-per-cell at 2', () => {
    expect(VANILLA_ENDOOM_BYTES_PER_CELL).toBe(2);
  });

  test('pins ENDOOM total cell count at 2000', () => {
    expect(VANILLA_ENDOOM_CELL_COUNT).toBe(2000);
    expect(VANILLA_ENDOOM_CELL_COUNT).toBe(VANILLA_ENDOOM_GRID_COLUMNS * VANILLA_ENDOOM_GRID_ROWS);
  });

  test('reports linuxdoom-1.10 has no D_Endoom function', () => {
    expect(VANILLA_LINUXDOOM_HAS_D_ENDOOM_FUNCTION).toBe(false);
  });

  test('reports linuxdoom-1.10 has no I_Endoom function', () => {
    expect(VANILLA_LINUXDOOM_HAS_I_ENDOOM_FUNCTION).toBe(false);
  });

  test('reports linuxdoom-1.10 has no I_AtExit registration stack', () => {
    expect(VANILLA_LINUXDOOM_HAS_I_ATEXIT_STACK).toBe(false);
  });

  test('reports vanilla I_Error has no recursive-call guard sentinel', () => {
    expect(VANILLA_I_ERROR_HAS_RECURSIVE_GUARD).toBe(false);
  });

  test('cross-validates ENDOOM byte arithmetic (cells * bytes-per-cell == lump size)', () => {
    expect(VANILLA_ENDOOM_CELL_COUNT * VANILLA_ENDOOM_BYTES_PER_CELL).toBe(VANILLA_ENDOOM_LUMP_SIZE_BYTES);
  });
});

describe('VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_DERIVED_INVARIANTS list', () => {
  test('has exactly twenty-four derived invariants', () => {
    expect(VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_DERIVED_INVARIANTS.length).toBe(24);
    expect(VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_DERIVED_INVARIANTS.length).toBe(VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_DERIVED_INVARIANT_COUNT);
  });

  test('every invariant id is unique', () => {
    const ids = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_DERIVED_INVARIANTS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every invariant declares a non-empty description', () => {
    for (const entry of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_DERIVED_INVARIANTS) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});

describe('VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES probe set', () => {
  test('has exactly forty pinned probes', () => {
    expect(VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES.length).toBe(40);
    expect(VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES.length).toBe(VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBE_COUNT);
  });

  test('every probe id is unique', () => {
    const ids = VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every probe declares an expected answer field consistent with its query kind', () => {
    for (const probe of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES) {
      switch (probe.queryKind) {
        case 'quit-op-at-index':
        case 'error-cleanup-op-at-index':
        case 'error-prologue-op-at-index':
          expect(probe.queryIndex).not.toBeNull();
          expect(probe.expectedAnsweredOpName).not.toBeNull();
          break;
        case 'op-condition':
          expect(probe.queryOpName).not.toBeNull();
          expect(probe.queryPhase).not.toBeNull();
          expect(probe.expectedAnsweredCondition).not.toBeNull();
          break;
        case 'op-presence-in-quit':
        case 'op-presence-in-error-cleanup':
          expect(probe.queryOpName).not.toBeNull();
          expect(probe.expectedAnsweredPresent).not.toBeNull();
          break;
        case 'quit-total-step-count':
        case 'error-cleanup-op-count':
        case 'quit-exit-code':
        case 'error-exit-code':
        case 'endoom-lump-size-bytes':
        case 'endoom-grid-columns':
        case 'endoom-grid-rows':
        case 'endoom-bytes-per-cell':
          expect(probe.expectedAnsweredCount).not.toBeNull();
          break;
        case 'error-stderr-prefix':
        case 'error-trailing-newline':
        case 'endoom-lump-name':
          expect(probe.expectedAnsweredLiteral).not.toBeNull();
          break;
        case 'linuxdoom-has-feature':
          expect(probe.queryFeatureName).not.toBeNull();
          expect(probe.expectedAnsweredPresent).not.toBeNull();
          break;
        case 'error-has-recursive-guard':
          expect(probe.expectedAnsweredPresent).not.toBeNull();
          break;
        case 'quit-op-precedes-quit-op':
          expect(probe.queryEarlierOpName).not.toBeNull();
          expect(probe.queryLaterOpName).not.toBeNull();
          expect(probe.expectedAnsweredPrecedes).not.toBeNull();
          break;
      }
    }
  });

  test('every witness invariant id refers to a declared derived invariant', () => {
    const declaredInvariantIds = new Set(VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_DERIVED_INVARIANTS.map((entry) => entry.id));
    for (const probe of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES) {
      expect(declaredInvariantIds.has(probe.witnessInvariantId)).toBe(true);
    }
  });
});

describe('REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER cross-check', () => {
  test('passes every probe with zero failures', () => {
    expect(crossCheckVanillaCleanQuitAndEndoomPolicy(REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER)).toEqual([]);
  });

  test('answers quit-op-at-index probes with the canonical op name', () => {
    for (const probe of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES) {
      if (probe.queryKind !== 'quit-op-at-index') continue;
      const result = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
      expect(result.answeredOpName).toBe(probe.expectedAnsweredOpName);
    }
  });

  test('answers error-cleanup-op-at-index probes with the canonical op name', () => {
    for (const probe of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES) {
      if (probe.queryKind !== 'error-cleanup-op-at-index') continue;
      const result = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
      expect(result.answeredOpName).toBe(probe.expectedAnsweredOpName);
    }
  });

  test('answers error-prologue-op-at-index probes with the canonical op name', () => {
    for (const probe of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES) {
      if (probe.queryKind !== 'error-prologue-op-at-index') continue;
      const result = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
      expect(result.answeredOpName).toBe(probe.expectedAnsweredOpName);
    }
  });

  test('answers op-condition probes with the canonical condition', () => {
    for (const probe of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES) {
      if (probe.queryKind !== 'op-condition') continue;
      const result = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
      expect(result.answeredCondition).toBe(probe.expectedAnsweredCondition);
    }
  });

  test('answers op-presence probes correctly', () => {
    for (const probe of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES) {
      if (probe.queryKind !== 'op-presence-in-quit' && probe.queryKind !== 'op-presence-in-error-cleanup') continue;
      const result = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
      expect(result.answeredPresent).toBe(probe.expectedAnsweredPresent);
    }
  });

  test('answers quit-total-step-count with 5', () => {
    for (const probe of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES) {
      if (probe.queryKind !== 'quit-total-step-count') continue;
      const result = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
      expect(result.answeredCount).toBe(5);
    }
  });

  test('answers quit-exit-code with 0', () => {
    for (const probe of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES) {
      if (probe.queryKind !== 'quit-exit-code') continue;
      const result = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
      expect(result.answeredCount).toBe(0);
    }
  });

  test('answers error-exit-code with -1', () => {
    for (const probe of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES) {
      if (probe.queryKind !== 'error-exit-code') continue;
      const result = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
      expect(result.answeredCount).toBe(-1);
    }
  });

  test('answers error-stderr-prefix with verbatim "Error: "', () => {
    for (const probe of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES) {
      if (probe.queryKind !== 'error-stderr-prefix') continue;
      const result = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
      expect(result.answeredLiteral).toBe('Error: ');
    }
  });

  test('answers error-trailing-newline with verbatim "\\n"', () => {
    for (const probe of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES) {
      if (probe.queryKind !== 'error-trailing-newline') continue;
      const result = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
      expect(result.answeredLiteral).toBe('\n');
    }
  });

  test('answers ENDOOM dimensional probes correctly', () => {
    for (const probe of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES) {
      if (probe.queryKind === 'endoom-lump-name') {
        expect(REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe).answeredLiteral).toBe('ENDOOM');
      } else if (probe.queryKind === 'endoom-lump-size-bytes') {
        expect(REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe).answeredCount).toBe(4000);
      } else if (probe.queryKind === 'endoom-grid-columns') {
        expect(REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe).answeredCount).toBe(80);
      } else if (probe.queryKind === 'endoom-grid-rows') {
        expect(REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe).answeredCount).toBe(25);
      } else if (probe.queryKind === 'endoom-bytes-per-cell') {
        expect(REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe).answeredCount).toBe(2);
      }
    }
  });

  test('answers linuxdoom-has-feature with false for every Chocolate-only feature', () => {
    for (const probe of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES) {
      if (probe.queryKind !== 'linuxdoom-has-feature') continue;
      const result = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
      expect(result.answeredPresent).toBe(false);
    }
  });

  test('answers error-has-recursive-guard with false', () => {
    for (const probe of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES) {
      if (probe.queryKind !== 'error-has-recursive-guard') continue;
      const result = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
      expect(result.answeredPresent).toBe(false);
    }
  });

  test('answers quit-op-precedes-quit-op with true/false correctly', () => {
    for (const probe of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES) {
      if (probe.queryKind !== 'quit-op-precedes-quit-op') continue;
      const result = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
      expect(result.answeredPrecedes).toBe(probe.expectedAnsweredPrecedes);
    }
  });
});

describe('crossCheckVanillaCleanQuitAndEndoomPolicy failure modes', () => {
  test('detects a handler that places M_SaveDefaults before D_QuitNetGame in I_Quit (Chocolate-style early save)', () => {
    const swappedFirstStep: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'quit-op-at-index' && probe.queryIndex === 0) {
          return Object.freeze({ ...inner, answeredOpName: 'M_SaveDefaults' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(swappedFirstStep);
    expect(failures.some((failure) => failure.startsWith('probe:quit-index-zero-is-d-quitnetgame:answeredOpName:value-mismatch'))).toBe(true);
  });

  test('detects a handler that gates M_SaveDefaults on a flag (Chocolate-style)', () => {
    const conditionalSave: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'op-condition' && probe.queryOpName === 'M_SaveDefaults' && probe.queryPhase === 'quit') {
          return Object.freeze({ ...inner, answeredCondition: 'demorecording-flag-set' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(conditionalSave);
    expect(failures.some((failure) => failure.startsWith('probe:quit-m-savedefaults-is-unconditional:answeredCondition:value-mismatch'))).toBe(true);
  });

  test('detects a handler that includes S_Shutdown in the quit sequence', () => {
    const includesSShutdown: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'op-presence-in-quit' && probe.queryOpName === 'S_Shutdown') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(includesSShutdown);
    expect(failures.some((failure) => failure.startsWith('probe:s-shutdown-is-absent-from-quit:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that includes I_ShutdownTimer in the quit sequence', () => {
    const includesShutdownTimer: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'op-presence-in-quit' && probe.queryOpName === 'I_ShutdownTimer') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(includesShutdownTimer);
    expect(failures.some((failure) => failure.startsWith('probe:i-shutdowntimer-is-absent-from-quit:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports D_Endoom as present in linuxdoom-1.10', () => {
    const includesDEndoom: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'linuxdoom-has-feature' && probe.queryFeatureName === 'D_Endoom') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(includesDEndoom);
    expect(failures.some((failure) => failure.startsWith('probe:d-endoom-is-absent-from-linuxdoom:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports I_AtExit stack as present in linuxdoom-1.10', () => {
    const includesAtExit: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'linuxdoom-has-feature' && probe.queryFeatureName === 'I_AtExit') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(includesAtExit);
    expect(failures.some((failure) => failure.startsWith('probe:i-atexit-is-absent-from-linuxdoom:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports a recursive-call guard inside I_Error', () => {
    const includesGuard: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'error-has-recursive-guard') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(includesGuard);
    expect(failures.some((failure) => failure.startsWith('probe:error-has-no-recursive-guard:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that fires G_CheckDemoStatus unconditionally in I_Error', () => {
    const unconditionalDemoCheck: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'op-condition' && probe.queryOpName === 'G_CheckDemoStatus' && probe.queryPhase === 'error-cleanup') {
          return Object.freeze({ ...inner, answeredCondition: 'always' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(unconditionalDemoCheck);
    expect(failures.some((failure) => failure.startsWith('probe:error-g-checkdemostatus-is-demorecording-gated:answeredCondition:value-mismatch'))).toBe(true);
  });

  test('detects a handler that includes M_SaveDefaults in the I_Error cleanup', () => {
    const includesMSaveInError: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'op-presence-in-error-cleanup' && probe.queryOpName === 'M_SaveDefaults') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(includesMSaveInError);
    expect(failures.some((failure) => failure.startsWith('probe:m-savedefaults-is-absent-from-error-cleanup:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports a wrong I_Quit exit code (1 instead of 0)', () => {
    const wrongQuitCode: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'quit-exit-code') {
          return Object.freeze({ ...inner, answeredCount: 1 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(wrongQuitCode);
    expect(failures.some((failure) => failure.startsWith('probe:quit-exit-code-is-zero:answeredCount:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports a wrong I_Error exit code (1 instead of -1)', () => {
    const wrongErrorCode: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'error-exit-code') {
          return Object.freeze({ ...inner, answeredCount: 1 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(wrongErrorCode);
    expect(failures.some((failure) => failure.startsWith('probe:error-exit-code-is-minus-one:answeredCount:value-mismatch'))).toBe(true);
  });

  test('detects a handler that emits a different stderr prefix (lowercase "error: ")', () => {
    const wrongPrefix: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'error-stderr-prefix') {
          return Object.freeze({ ...inner, answeredLiteral: 'error: ' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(wrongPrefix);
    expect(failures.some((failure) => failure.startsWith('probe:error-stderr-prefix-is-error-colon-space:answeredLiteral:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the wrong ENDOOM lump size (4096 instead of 4000)', () => {
    const wrongSize: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'endoom-lump-size-bytes') {
          return Object.freeze({ ...inner, answeredCount: 4096 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(wrongSize);
    expect(failures.some((failure) => failure.startsWith('probe:endoom-lump-size-is-four-thousand-bytes:answeredCount:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports a wrong ENDOOM grid (40x25 CGA instead of 80x25 VGA)', () => {
    const wrongGrid: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'endoom-grid-columns') {
          return Object.freeze({ ...inner, answeredCount: 40 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(wrongGrid);
    expect(failures.some((failure) => failure.startsWith('probe:endoom-grid-columns-is-eighty:answeredCount:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports D_QuitNetGame following I_ShutdownGraphics in I_Quit', () => {
    const reversedOrder: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'quit-op-precedes-quit-op' && probe.queryEarlierOpName === 'D_QuitNetGame' && probe.queryLaterOpName === 'I_ShutdownGraphics') {
          return Object.freeze({ ...inner, answeredPrecedes: false });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(reversedOrder);
    expect(failures.some((failure) => failure.startsWith('probe:d-quitnetgame-precedes-i-shutdowngraphics-in-quit:answeredPrecedes:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports a wrong ENDOOM lump name', () => {
    const wrongName: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'endoom-lump-name') {
          return Object.freeze({ ...inner, answeredLiteral: 'ENDOOM2' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(wrongName);
    expect(failures.some((failure) => failure.startsWith('probe:endoom-lump-name-is-endoom:answeredLiteral:value-mismatch'))).toBe(true);
  });

  test('detects a handler that drops the I_Error trailing newline', () => {
    const noTrailingNewline: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'error-trailing-newline') {
          return Object.freeze({ ...inner, answeredLiteral: '' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(noTrailingNewline);
    expect(failures.some((failure) => failure.startsWith('probe:error-trailing-newline-is-newline:answeredLiteral:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports a wrong cleanup op count (4 instead of 3)', () => {
    const wrongCleanupCount: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'error-cleanup-op-count') {
          return Object.freeze({ ...inner, answeredCount: 4 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(wrongCleanupCount);
    expect(failures.some((failure) => failure.startsWith('probe:error-cleanup-op-count-is-three:answeredCount:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports a wrong total quit step count (8 instead of 5, Chocolate-style)', () => {
    const wrongTotalCount: VanillaCleanQuitAndEndoomPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'quit-total-step-count') {
          return Object.freeze({ ...inner, answeredCount: 8 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaCleanQuitAndEndoomPolicy(wrongTotalCount);
    expect(failures.some((failure) => failure.startsWith('probe:quit-total-step-count-is-five:answeredCount:value-mismatch'))).toBe(true);
  });
});

describe('deriveExpectedVanillaCleanQuitAndEndoomPolicyResult helper', () => {
  test('matches the canonical answer for every pinned probe', () => {
    for (const probe of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES) {
      const expected = deriveExpectedVanillaCleanQuitAndEndoomPolicyResult(probe);
      const actual = REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER.runProbe(probe);
      expect(actual).toEqual(expected);
    }
  });

  test('answers quit-op-at-index for an out-of-range index by returning null answeredOpName', () => {
    const outOfRangeProbe: VanillaCleanQuitAndEndoomPolicyProbe = {
      id: 'derive-out-of-range',
      description: 'Synthetic probe used to verify out-of-range handling outside the pinned probe set.',
      queryKind: 'quit-op-at-index',
      queryIndex: 99,
      queryOpName: null,
      queryPhase: null,
      queryFeatureName: null,
      queryEarlierOpName: null,
      queryLaterOpName: null,
      expectedAnsweredOpName: null,
      expectedAnsweredPresent: null,
      expectedAnsweredCondition: null,
      expectedAnsweredCount: null,
      expectedAnsweredLiteral: null,
      expectedAnsweredPrecedes: null,
      witnessInvariantId: 'QUIT_HAS_EXACTLY_FIVE_OPS',
    };
    const result = deriveExpectedVanillaCleanQuitAndEndoomPolicyResult(outOfRangeProbe);
    expect(result.answeredOpName).toBeNull();
  });

  test('answers op-condition with null for an unrecognised op', () => {
    const unknownOpProbe: VanillaCleanQuitAndEndoomPolicyProbe = {
      id: 'derive-unknown-op',
      description: 'Synthetic probe for an unrecognised op.',
      queryKind: 'op-condition',
      queryIndex: null,
      queryOpName: 'Foo_Bar',
      queryPhase: 'quit',
      queryFeatureName: null,
      queryEarlierOpName: null,
      queryLaterOpName: null,
      expectedAnsweredOpName: null,
      expectedAnsweredPresent: null,
      expectedAnsweredCondition: null,
      expectedAnsweredCount: null,
      expectedAnsweredLiteral: null,
      expectedAnsweredPrecedes: null,
      witnessInvariantId: 'QUIT_HAS_EXACTLY_FIVE_OPS',
    };
    const result = deriveExpectedVanillaCleanQuitAndEndoomPolicyResult(unknownOpProbe);
    expect(result.answeredCondition).toBeNull();
  });

  test('answers quit-op-precedes-quit-op with false when one or both ops are absent', () => {
    const absentEarlierProbe: VanillaCleanQuitAndEndoomPolicyProbe = {
      id: 'derive-absent-earlier',
      description: 'Synthetic probe for a precedence query with an absent earlier op.',
      queryKind: 'quit-op-precedes-quit-op',
      queryIndex: null,
      queryOpName: null,
      queryPhase: null,
      queryFeatureName: null,
      queryEarlierOpName: 'S_Shutdown',
      queryLaterOpName: 'I_ShutdownGraphics',
      expectedAnsweredOpName: null,
      expectedAnsweredPresent: null,
      expectedAnsweredCondition: null,
      expectedAnsweredCount: null,
      expectedAnsweredLiteral: null,
      expectedAnsweredPrecedes: false,
      witnessInvariantId: 'QUIT_HAS_EXACTLY_FIVE_OPS',
    };
    const result = deriveExpectedVanillaCleanQuitAndEndoomPolicyResult(absentEarlierProbe);
    expect(result.answeredPrecedes).toBe(false);
  });

  test('answers linuxdoom-has-feature with true for a non-Chocolate-only feature (synthetic)', () => {
    const knownVanillaFeatureProbe: VanillaCleanQuitAndEndoomPolicyProbe = {
      id: 'derive-vanilla-feature',
      description: 'Synthetic probe for a feature not in the Chocolate-only absence list (e.g., D_QuitNetGame, which IS in linuxdoom-1.10).',
      queryKind: 'linuxdoom-has-feature',
      queryIndex: null,
      queryOpName: null,
      queryPhase: null,
      queryFeatureName: 'D_QuitNetGame',
      queryEarlierOpName: null,
      queryLaterOpName: null,
      expectedAnsweredOpName: null,
      expectedAnsweredPresent: true,
      expectedAnsweredCondition: null,
      expectedAnsweredCount: null,
      expectedAnsweredLiteral: null,
      expectedAnsweredPrecedes: null,
      witnessInvariantId: 'QUIT_HAS_EXACTLY_FIVE_OPS',
    };
    const result = deriveExpectedVanillaCleanQuitAndEndoomPolicyResult(knownVanillaFeatureProbe);
    expect(result.answeredPresent).toBe(true);
  });
});

describe('vanilla DOOM 1.9 clean-quit and ENDOOM policy matches the linuxdoom-1.10 source ordering', () => {
  test('orders D_QuitNetGame strictly before I_ShutdownGraphics in I_Quit', () => {
    const opNames = VANILLA_I_QUIT_ORDER.map((step) => step.opName);
    const dqngOffset = opNames.indexOf('D_QuitNetGame');
    const isgOffset = opNames.indexOf('I_ShutdownGraphics');
    expect(dqngOffset).toBe(0);
    expect(isgOffset).toBe(3);
    expect(dqngOffset).toBeLessThan(isgOffset);
  });

  test('orders M_SaveDefaults strictly before I_ShutdownGraphics in I_Quit (config saved before display teardown)', () => {
    const opNames = VANILLA_I_QUIT_ORDER.map((step) => step.opName);
    const msdOffset = opNames.indexOf('M_SaveDefaults');
    const isgOffset = opNames.indexOf('I_ShutdownGraphics');
    expect(msdOffset).toBe(2);
    expect(isgOffset).toBe(3);
    expect(msdOffset).toBeLessThan(isgOffset);
  });

  test('orders I_ShutdownGraphics strictly before exit-zero in I_Quit (text mode restored before exit)', () => {
    const opNames = VANILLA_I_QUIT_ORDER.map((step) => step.opName);
    const isgOffset = opNames.indexOf('I_ShutdownGraphics');
    const exitOffset = opNames.indexOf('exit-zero');
    expect(isgOffset).toBe(3);
    expect(exitOffset).toBe(4);
    expect(isgOffset).toBeLessThan(exitOffset);
  });

  test('orders I_ShutdownGraphics strictly before exit-minus-one in I_Error', () => {
    const opNames = VANILLA_I_ERROR_CLEANUP_ORDER.map((step) => step.opName);
    const isgOffset = opNames.indexOf('I_ShutdownGraphics');
    const exitOffset = opNames.indexOf('exit-minus-one');
    expect(isgOffset).toBe(2);
    expect(exitOffset).toBe(3);
    expect(isgOffset).toBeLessThan(exitOffset);
  });

  test('omits every Chocolate-only quit-stage feature from the canonical mechanisms', () => {
    const features = new Set<string>(VANILLA_LINUXDOOM_ABSENT_CHOCOLATE_QUIT_FEATURES);
    expect(features.has('I_AtExit')).toBe(true);
    expect(features.has('D_Endoom')).toBe(true);
    expect(features.has('I_Endoom')).toBe(true);
    expect(features.has('S_Shutdown')).toBe(true);
    expect(features.has('I_ShutdownTimer')).toBe(true);
    expect(features.has('lifoTraversal')).toBe(true);
    expect(features.has('runOnErrorFilter')).toBe(true);
    expect(features.has('recursiveCallGuard')).toBe(true);
  });

  test('preserves the ENDOOM byte-product invariant across the dimensional constants', () => {
    expect(VANILLA_ENDOOM_GRID_COLUMNS * VANILLA_ENDOOM_GRID_ROWS * VANILLA_ENDOOM_BYTES_PER_CELL).toBe(VANILLA_ENDOOM_LUMP_SIZE_BYTES);
  });
});

describe('NULL_RESULT_FIELDS template (test-internal sanity)', () => {
  test('matches the answeredX-null shape that probes use when a field is not relevant', () => {
    expect(NULL_RESULT_FIELDS.answeredOpName).toBeNull();
    expect(NULL_RESULT_FIELDS.answeredPresent).toBeNull();
    expect(NULL_RESULT_FIELDS.answeredCondition).toBeNull();
    expect(NULL_RESULT_FIELDS.answeredCount).toBeNull();
    expect(NULL_RESULT_FIELDS.answeredLiteral).toBeNull();
    expect(NULL_RESULT_FIELDS.answeredPrecedes).toBeNull();
  });
});

describe('implement-clean-quit-and-endoom-policy step file', () => {
  test('declares the launch lane and the implement write lock', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('## lane\n\nlaunch');
    expect(stepText).toContain('- src/bootstrap/implement-clean-quit-and-endoom-policy.ts');
    expect(stepText).toContain('- test/vanilla_parity/launch/implement-clean-quit-and-endoom-policy.test.ts');
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
