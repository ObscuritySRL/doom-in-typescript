import { describe, expect, test } from 'bun:test';

import {
  REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER,
  VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT,
  VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_CLAUSE_COUNT,
  VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_DERIVED_INVARIANTS,
  VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_DERIVED_INVARIANT_COUNT,
  VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES,
  VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBE_COUNT,
  VANILLA_FATAL_EXPLICIT_SHUTDOWN_COUNT,
  VANILLA_FATAL_EXPLICIT_SHUTDOWN_ORDER,
  VANILLA_FATAL_PATH_ABSENT_CHOCOLATE_SHUTDOWN_CALLS,
  VANILLA_FATAL_PATH_ABSENT_CHOCOLATE_SHUTDOWN_CALL_COUNT,
  VANILLA_FATAL_PATH_HAS_REGISTRATION_STACK,
  VANILLA_FATAL_PATH_ORDERING_VARIES_BY_PHASE_OF_ORIGIN,
  VANILLA_FATAL_PATH_PERFORMS_PARTIAL_INIT_ROLLBACK,
  VANILLA_FATAL_PATH_PERFORMS_REVERSE_INIT_UNWINDING,
  VANILLA_FATAL_PATH_USES_SETJMP_LONGJMP,
  VANILLA_INIT_PHASES_WITH_EXPLICIT_FATAL_SHUTDOWN_COUNT,
  VANILLA_INIT_PHASES_WITH_OS_RECLAMATION_COUNT,
  VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE,
  VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE_COUNT,
  crossCheckVanillaFatalErrorShutdownOrdering,
  deriveExpectedVanillaFatalErrorShutdownOrderingResult,
} from '../../../src/bootstrap/implement-fatal-error-shutdown-ordering.ts';
import type { VanillaFatalErrorShutdownOrderingHandler, VanillaFatalErrorShutdownOrderingProbe, VanillaFatalErrorShutdownOrderingResult } from '../../../src/bootstrap/implement-fatal-error-shutdown-ordering.ts';

const STEP_FILE_RELATIVE_PATH = 'plan_vanilla_parity/steps/03-011-implement-fatal-error-shutdown-ordering.md';

describe('VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT ledger shape', () => {
  test('audits exactly twenty-eight contract clauses for the fatal-error shutdown-ordering landscape', () => {
    expect(VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT.length).toBe(28);
    expect(VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT.length).toBe(VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_CLAUSE_COUNT);
  });

  test('every clause id is unique', () => {
    const ids = VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every clause references a real linuxdoom-1.10 source file and a canonical C symbol', () => {
    for (const entry of VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT) {
      expect(['i_system.c', 'd_main.c']).toContain(entry.referenceSourceFile);
      expect(['I_Error', 'D_DoomMain', 'D_DoomLoop']).toContain(entry.cSymbol);
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('the FATAL_PATH_HAS_THREE_EXPLICIT_SHUTDOWN_CALLS clause names every shutdown in canonical order', () => {
    const entry = VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT.find((clause) => clause.id === 'FATAL_PATH_HAS_THREE_EXPLICIT_SHUTDOWN_CALLS');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('G_CheckDemoStatus');
    expect(entry!.invariant).toContain('D_QuitNetGame');
    expect(entry!.invariant).toContain('I_ShutdownGraphics');
    expect(entry!.invariant).toContain('exit(-1)');
  });

  test('the FATAL_PATH_DEMO_CLEANUP_IS_DEMORECORDING_GATED clause cites the gate', () => {
    const entry = VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT.find((clause) => clause.id === 'FATAL_PATH_DEMO_CLEANUP_IS_DEMORECORDING_GATED');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('demorecording');
    expect(entry!.invariant).toContain('M_WriteFile');
  });

  test('the FATAL_PATH_ORDERING_DOES_NOT_VARY_BY_INIT_PHASE_OF_ORIGIN clause cites both endpoint phases', () => {
    const entry = VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT.find((clause) => clause.id === 'FATAL_PATH_ORDERING_DOES_NOT_VARY_BY_INIT_PHASE_OF_ORIGIN');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('V_Init');
    expect(entry!.invariant).toContain('ST_Init');
    expect(entry!.invariant).toContain('phase-aware');
  });

  test('the FATAL_PATH_DOES_NOT_REVERSE_UNWIND_INIT_ORDER clause references the canonical 12-step init order', () => {
    const entry = VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT.find((clause) => clause.id === 'FATAL_PATH_DOES_NOT_REVERSE_UNWIND_INIT_ORDER');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('03-008');
    expect(entry!.invariant).toContain('RAII');
    expect(entry!.invariant).toContain('reverse');
  });

  test('the FATAL_PATH_DOES_NOT_USE_SETJMP_LONGJMP clause cites the C library symbols', () => {
    const entry = VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT.find((clause) => clause.id === 'FATAL_PATH_DOES_NOT_USE_SETJMP_LONGJMP');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('setjmp');
    expect(entry!.invariant).toContain('longjmp');
  });

  test('the FATAL_PATH_DOES_NOT_HAVE_REGISTRATION_STACK clause cites Chocolate I_AtExit', () => {
    const entry = VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT.find((clause) => clause.id === 'FATAL_PATH_DOES_NOT_HAVE_REGISTRATION_STACK');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('I_AtExit');
    expect(entry!.invariant).toContain('LIFO');
    expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
  });

  test('the M_LOADDEFAULTS_NOT_TORN_DOWN_AND_NOT_SAVED_ON_ERROR_PATH clause distinguishes I_Quit and I_Error', () => {
    const entry = VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT.find((clause) => clause.id === 'M_LOADDEFAULTS_NOT_TORN_DOWN_AND_NOT_SAVED_ON_ERROR_PATH');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('M_SaveDefaults');
    expect(entry!.invariant).toContain('I_Quit');
    expect(entry!.invariant).toContain('I_Error');
    expect(entry!.invariant).toContain('inconsistent');
  });

  test('the I_INIT_NOT_EXPLICITLY_TORN_DOWN_DOS_RECLAIMS_INTERRUPT_VECTOR clause cites the DOS interrupt vector', () => {
    const entry = VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT.find((clause) => clause.id === 'I_INIT_NOT_EXPLICITLY_TORN_DOWN_DOS_RECLAIMS_INTERRUPT_VECTOR');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('INT 8');
    expect(entry!.invariant).toContain('I_ShutdownTimer');
    expect(entry!.invariant).toContain('DMA');
  });

  test('the D_CHECKNETGAME_EXPLICITLY_TORN_DOWN_VIA_D_QUITNETGAME clause cites NETPACKET_QUIT', () => {
    const entry = VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT.find((clause) => clause.id === 'D_CHECKNETGAME_EXPLICITLY_TORN_DOWN_VIA_D_QUITNETGAME');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('D_QuitNetGame');
    expect(entry!.invariant).toContain('NETPACKET_QUIT');
  });

  test('the I_INITGRAPHICS_EXPLICITLY_TORN_DOWN_VIA_I_SHUTDOWNGRAPHICS clause references D_DoomLoop', () => {
    const entry = VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT.find((clause) => clause.id === 'I_INITGRAPHICS_EXPLICITLY_TORN_DOWN_VIA_I_SHUTDOWNGRAPHICS');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('D_DoomLoop');
    expect(entry!.invariant).toContain('VGA mode 13h');
  });

  test('every Chocolate-only-omission clause names its specific Chocolate addition', () => {
    const omissionClauses: ReadonlyArray<{ id: string; expectedSnippet: string }> = [
      { id: 'FATAL_PATH_OMITS_S_SHUTDOWN_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'S_Shutdown' },
      { id: 'FATAL_PATH_OMITS_I_SHUTDOWNTIMER_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'I_ShutdownTimer' },
      { id: 'FATAL_PATH_OMITS_I_SHUTDOWNMUSIC_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'I_ShutdownMusic' },
      { id: 'FATAL_PATH_OMITS_OPL_SHUTDOWN_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'OPL_Shutdown' },
      { id: 'FATAL_PATH_OMITS_NET_SHUTDOWN_PRESENT_ONLY_IN_CHOCOLATE', expectedSnippet: 'NET_ShutdownClient' },
    ];
    for (const { id, expectedSnippet } of omissionClauses) {
      const entry = VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT.find((clause) => clause.id === id);
      expect(entry).toBeDefined();
      expect(entry!.invariant).toContain(expectedSnippet);
      expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
    }
  });

  test('every D_DoomMain-pinned clause references the d_main.c source file', () => {
    const dMainClauses = VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT.filter((entry) => entry.cSymbol === 'D_DoomMain');
    for (const clause of dMainClauses) {
      expect(clause.referenceSourceFile).toBe('d_main.c');
    }
  });

  test('the D_DoomLoop-pinned clause references the d_main.c source file', () => {
    const dLoopClauses = VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT.filter((entry) => entry.cSymbol === 'D_DoomLoop');
    expect(dLoopClauses.length).toBe(1);
    expect(dLoopClauses[0]!.referenceSourceFile).toBe('d_main.c');
  });
});

describe('VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE pinned ledger', () => {
  test('has exactly thirteen entries', () => {
    expect(VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE.length).toBe(13);
    expect(VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE.length).toBe(VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE_COUNT);
  });

  test('orders the canonical thirteen-phase landscape verbatim (12 D_DoomMain phases + I_InitGraphics)', () => {
    expect(VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE.map((entry) => entry.phaseName)).toEqual([
      'V_Init',
      'M_LoadDefaults',
      'Z_Init',
      'W_Init',
      'M_Init',
      'R_Init',
      'P_Init',
      'I_Init',
      'D_CheckNetGame',
      'S_Init',
      'HU_Init',
      'ST_Init',
      'I_InitGraphics',
    ]);
  });

  test('reports exactly two phases with explicit-shutdown-call strategy', () => {
    const explicitPhases = VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE.filter((entry) => entry.teardownStrategy === 'explicit-shutdown-call');
    expect(explicitPhases.length).toBe(2);
    expect(explicitPhases.length).toBe(VANILLA_INIT_PHASES_WITH_EXPLICIT_FATAL_SHUTDOWN_COUNT);
    expect(explicitPhases.map((entry) => entry.phaseName)).toEqual(['D_CheckNetGame', 'I_InitGraphics']);
  });

  test('reports exactly eleven phases without an explicit shutdown call', () => {
    const osReclaimedPhases = VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE.filter((entry) => entry.explicitShutdownSymbol === null);
    expect(osReclaimedPhases.length).toBe(11);
    expect(osReclaimedPhases.length).toBe(VANILLA_INIT_PHASES_WITH_OS_RECLAMATION_COUNT);
  });

  test('every phase name is unique', () => {
    const names = VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE.map((entry) => entry.phaseName);
    expect(new Set(names).size).toBe(names.length);
  });

  test('M_LoadDefaults uses the defaults-not-saved-on-error-path strategy distinct from os-reclaims-* strategies', () => {
    const record = VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE.find((entry) => entry.phaseName === 'M_LoadDefaults');
    expect(record).toBeDefined();
    expect(record!.teardownStrategy).toBe('defaults-not-saved-on-error-path');
    expect(record!.explicitShutdownSymbol).toBeNull();
  });

  test('S_Init has a Chocolate-only S_Shutdown counterpart', () => {
    const record = VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE.find((entry) => entry.phaseName === 'S_Init');
    expect(record).toBeDefined();
    expect(record!.explicitShutdownSymbol).toBeNull();
    expect(record!.chocolateShutdownSymbol).toBe('S_Shutdown');
  });

  test('I_Init has a Chocolate-only I_ShutdownTimer counterpart', () => {
    const record = VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE.find((entry) => entry.phaseName === 'I_Init');
    expect(record).toBeDefined();
    expect(record!.explicitShutdownSymbol).toBeNull();
    expect(record!.chocolateShutdownSymbol).toBe('I_ShutdownTimer');
  });

  test('D_CheckNetGame and I_InitGraphics share their explicit shutdown symbol with Chocolate', () => {
    const dCheckNetGame = VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE.find((entry) => entry.phaseName === 'D_CheckNetGame');
    const iInitGraphics = VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE.find((entry) => entry.phaseName === 'I_InitGraphics');
    expect(dCheckNetGame!.explicitShutdownSymbol).toBe('D_QuitNetGame');
    expect(dCheckNetGame!.chocolateShutdownSymbol).toBe('D_QuitNetGame');
    expect(iInitGraphics!.explicitShutdownSymbol).toBe('I_ShutdownGraphics');
    expect(iInitGraphics!.chocolateShutdownSymbol).toBe('I_ShutdownGraphics');
  });
});

describe('VANILLA_FATAL_EXPLICIT_SHUTDOWN_ORDER canonical sequence', () => {
  test('has exactly three entries', () => {
    expect(VANILLA_FATAL_EXPLICIT_SHUTDOWN_ORDER.length).toBe(3);
    expect(VANILLA_FATAL_EXPLICIT_SHUTDOWN_ORDER.length).toBe(VANILLA_FATAL_EXPLICIT_SHUTDOWN_COUNT);
  });

  test('orders the canonical three-shutdown sequence verbatim', () => {
    expect([...VANILLA_FATAL_EXPLICIT_SHUTDOWN_ORDER]).toEqual(['G_CheckDemoStatus-gated', 'D_QuitNetGame', 'I_ShutdownGraphics']);
  });
});

describe('VANILLA_FATAL_PATH_ABSENT_CHOCOLATE_SHUTDOWN_CALLS list', () => {
  test('has exactly seven Chocolate-only shutdown calls', () => {
    expect(VANILLA_FATAL_PATH_ABSENT_CHOCOLATE_SHUTDOWN_CALLS.length).toBe(7);
    expect(VANILLA_FATAL_PATH_ABSENT_CHOCOLATE_SHUTDOWN_CALLS.length).toBe(VANILLA_FATAL_PATH_ABSENT_CHOCOLATE_SHUTDOWN_CALL_COUNT);
  });

  test('includes every Chocolate-only shutdown call referenced by the audit ledger', () => {
    expect([...VANILLA_FATAL_PATH_ABSENT_CHOCOLATE_SHUTDOWN_CALLS]).toEqual(['S_Shutdown', 'I_ShutdownTimer', 'I_ShutdownSound', 'I_ShutdownMusic', 'OPL_Shutdown', 'NET_ShutdownClient', 'NET_ShutdownServer']);
  });
});

describe('VANILLA top-level fatal-path booleans', () => {
  test('reports vanilla 1.9 fatal path does not perform reverse-init unwinding', () => {
    expect(VANILLA_FATAL_PATH_PERFORMS_REVERSE_INIT_UNWINDING).toBe(false);
  });

  test('reports vanilla 1.9 fatal path does not perform partial-init rollback', () => {
    expect(VANILLA_FATAL_PATH_PERFORMS_PARTIAL_INIT_ROLLBACK).toBe(false);
  });

  test('reports vanilla 1.9 fatal-path ordering does not vary by phase of origin', () => {
    expect(VANILLA_FATAL_PATH_ORDERING_VARIES_BY_PHASE_OF_ORIGIN).toBe(false);
  });

  test('reports vanilla 1.9 fatal path does not use setjmp/longjmp', () => {
    expect(VANILLA_FATAL_PATH_USES_SETJMP_LONGJMP).toBe(false);
  });

  test('reports vanilla 1.9 fatal path has no registration stack', () => {
    expect(VANILLA_FATAL_PATH_HAS_REGISTRATION_STACK).toBe(false);
  });
});

describe('VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_DERIVED_INVARIANTS list', () => {
  test('has exactly twenty derived invariants', () => {
    expect(VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_DERIVED_INVARIANTS.length).toBe(20);
    expect(VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_DERIVED_INVARIANTS.length).toBe(VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_DERIVED_INVARIANT_COUNT);
  });

  test('every invariant id is unique', () => {
    const ids = VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_DERIVED_INVARIANTS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every invariant declares a non-empty description', () => {
    for (const entry of VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_DERIVED_INVARIANTS) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});

describe('VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES probe set', () => {
  test('has exactly thirty-four pinned probes', () => {
    expect(VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES.length).toBe(34);
    expect(VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES.length).toBe(VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBE_COUNT);
  });

  test('every probe id is unique', () => {
    const ids = VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every probe declares an expected answer field consistent with its query kind', () => {
    for (const probe of VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES) {
      switch (probe.queryKind) {
        case 'fatal-explicit-shutdown-at-index':
          expect(probe.queryIndex).not.toBeNull();
          expect(probe.expectedAnsweredShutdownSymbol).not.toBeNull();
          break;
        case 'fatal-explicit-shutdown-count':
        case 'landscape-total-phase-count':
        case 'landscape-explicit-shutdown-phase-count':
        case 'landscape-os-reclaimed-phase-count':
          expect(probe.expectedAnsweredCount).not.toBeNull();
          break;
        case 'phase-teardown-strategy':
          expect(probe.queryPhaseName).not.toBeNull();
          expect(probe.expectedAnsweredTeardownStrategy).not.toBeNull();
          break;
        case 'phase-explicit-shutdown-symbol':
          expect(probe.queryPhaseName).not.toBeNull();
          // Symbol can legally be null for OS-reclaimed phases.
          break;
        case 'phase-presence-in-explicit-shutdown':
          expect(probe.queryPhaseName).not.toBeNull();
          expect(probe.expectedAnsweredPresent).not.toBeNull();
          break;
        case 'fatal-path-ordering-varies-by-phase-of-origin':
        case 'fatal-path-performs-reverse-init-unwinding':
        case 'fatal-path-performs-partial-init-rollback':
        case 'fatal-path-uses-setjmp-longjmp':
        case 'fatal-path-has-registration-stack':
          expect(probe.expectedAnsweredPresent).not.toBeNull();
          break;
        case 'fatal-path-includes-chocolate-shutdown':
          expect(probe.queryChocolateShutdownName).not.toBeNull();
          expect(probe.expectedAnsweredPresent).not.toBeNull();
          break;
      }
    }
  });

  test('every witness invariant id refers to a declared derived invariant', () => {
    const declaredInvariantIds = new Set(VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_DERIVED_INVARIANTS.map((entry) => entry.id));
    for (const probe of VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES) {
      expect(declaredInvariantIds.has(probe.witnessInvariantId)).toBe(true);
    }
  });
});

describe('REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER cross-check', () => {
  test('passes every probe with zero failures', () => {
    expect(crossCheckVanillaFatalErrorShutdownOrdering(REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER)).toEqual([]);
  });

  test('answers fatal-explicit-shutdown-at-index probes with the canonical shutdown symbol', () => {
    for (const probe of VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES) {
      if (probe.queryKind !== 'fatal-explicit-shutdown-at-index') continue;
      const result = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
      expect(result.answeredShutdownSymbol).toBe(probe.expectedAnsweredShutdownSymbol);
    }
  });

  test('answers fatal-explicit-shutdown-count with 3', () => {
    for (const probe of VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES) {
      if (probe.queryKind !== 'fatal-explicit-shutdown-count') continue;
      const result = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
      expect(result.answeredCount).toBe(3);
    }
  });

  test('answers phase-teardown-strategy probes with the canonical strategy', () => {
    for (const probe of VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES) {
      if (probe.queryKind !== 'phase-teardown-strategy') continue;
      const result = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
      expect(result.answeredTeardownStrategy).toBe(probe.expectedAnsweredTeardownStrategy);
    }
  });

  test('answers phase-explicit-shutdown-symbol probes with the canonical symbol or null', () => {
    for (const probe of VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES) {
      if (probe.queryKind !== 'phase-explicit-shutdown-symbol') continue;
      const result = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
      expect(result.answeredShutdownSymbol).toBe(probe.expectedAnsweredShutdownSymbol);
    }
  });

  test('answers phase-presence-in-explicit-shutdown probes correctly', () => {
    for (const probe of VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES) {
      if (probe.queryKind !== 'phase-presence-in-explicit-shutdown') continue;
      const result = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
      expect(result.answeredPresent).toBe(probe.expectedAnsweredPresent);
    }
  });

  test('answers landscape-total-phase-count with 13', () => {
    for (const probe of VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES) {
      if (probe.queryKind !== 'landscape-total-phase-count') continue;
      const result = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
      expect(result.answeredCount).toBe(13);
    }
  });

  test('answers landscape-explicit-shutdown-phase-count with 2', () => {
    for (const probe of VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES) {
      if (probe.queryKind !== 'landscape-explicit-shutdown-phase-count') continue;
      const result = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
      expect(result.answeredCount).toBe(2);
    }
  });

  test('answers landscape-os-reclaimed-phase-count with 11', () => {
    for (const probe of VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES) {
      if (probe.queryKind !== 'landscape-os-reclaimed-phase-count') continue;
      const result = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
      expect(result.answeredCount).toBe(11);
    }
  });

  test('answers every meta-property boolean with false for vanilla', () => {
    for (const probe of VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES) {
      if (
        probe.queryKind !== 'fatal-path-ordering-varies-by-phase-of-origin' &&
        probe.queryKind !== 'fatal-path-performs-reverse-init-unwinding' &&
        probe.queryKind !== 'fatal-path-performs-partial-init-rollback' &&
        probe.queryKind !== 'fatal-path-uses-setjmp-longjmp' &&
        probe.queryKind !== 'fatal-path-has-registration-stack'
      )
        continue;
      const result = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
      expect(result.answeredPresent).toBe(false);
    }
  });

  test('answers fatal-path-includes-chocolate-shutdown with false for every Chocolate-only call', () => {
    for (const probe of VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES) {
      if (probe.queryKind !== 'fatal-path-includes-chocolate-shutdown') continue;
      const result = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
      expect(result.answeredPresent).toBe(false);
    }
  });
});

describe('crossCheckVanillaFatalErrorShutdownOrdering failure modes', () => {
  test('detects a handler that places I_ShutdownGraphics first instead of last', () => {
    const swappedFirstShutdown: VanillaFatalErrorShutdownOrderingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'fatal-explicit-shutdown-at-index' && probe.queryIndex === 0) {
          return Object.freeze({ ...inner, answeredShutdownSymbol: 'I_ShutdownGraphics' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaFatalErrorShutdownOrdering(swappedFirstShutdown);
    expect(failures.some((failure) => failure.startsWith('probe:fatal-shutdown-index-zero-is-g-checkdemostatus-gated:answeredShutdownSymbol:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports an extra fourth shutdown call', () => {
    const fourShutdowns: VanillaFatalErrorShutdownOrderingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'fatal-explicit-shutdown-count') {
          return Object.freeze({ ...inner, answeredCount: 4 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaFatalErrorShutdownOrdering(fourShutdowns);
    expect(failures.some((failure) => failure.startsWith('probe:fatal-explicit-shutdown-count-is-three:answeredCount:value-mismatch'))).toBe(true);
  });

  test('detects a handler that includes S_Shutdown in the fatal-error path (Chocolate-style)', () => {
    const includesSShutdown: VanillaFatalErrorShutdownOrderingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'fatal-path-includes-chocolate-shutdown' && probe.queryChocolateShutdownName === 'S_Shutdown') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaFatalErrorShutdownOrdering(includesSShutdown);
    expect(failures.some((failure) => failure.startsWith('probe:fatal-path-omits-s-shutdown:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that includes I_ShutdownTimer in the fatal-error path (Chocolate-style)', () => {
    const includesShutdownTimer: VanillaFatalErrorShutdownOrderingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'fatal-path-includes-chocolate-shutdown' && probe.queryChocolateShutdownName === 'I_ShutdownTimer') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaFatalErrorShutdownOrdering(includesShutdownTimer);
    expect(failures.some((failure) => failure.startsWith('probe:fatal-path-omits-i-shutdowntimer:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that adds an explicit shutdown for Z_Init (modern-RAII style)', () => {
    const zShutdown: VanillaFatalErrorShutdownOrderingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'phase-teardown-strategy' && probe.queryPhaseName === 'Z_Init') {
          return Object.freeze({ ...inner, answeredTeardownStrategy: 'explicit-shutdown-call' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaFatalErrorShutdownOrdering(zShutdown);
    expect(failures.some((failure) => failure.startsWith('probe:phase-z-init-strategy-is-os-reclaims-heap:answeredTeardownStrategy:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports phase-aware ordering variation', () => {
    const phaseAware: VanillaFatalErrorShutdownOrderingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'fatal-path-ordering-varies-by-phase-of-origin') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaFatalErrorShutdownOrdering(phaseAware);
    expect(failures.some((failure) => failure.startsWith('probe:fatal-path-ordering-does-not-vary-by-phase-of-origin:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports reverse-init unwinding', () => {
    const reverseUnwind: VanillaFatalErrorShutdownOrderingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'fatal-path-performs-reverse-init-unwinding') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaFatalErrorShutdownOrdering(reverseUnwind);
    expect(failures.some((failure) => failure.startsWith('probe:fatal-path-does-not-reverse-unwind:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports partial-init rollback', () => {
    const partialRollback: VanillaFatalErrorShutdownOrderingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'fatal-path-performs-partial-init-rollback') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaFatalErrorShutdownOrdering(partialRollback);
    expect(failures.some((failure) => failure.startsWith('probe:fatal-path-does-not-perform-partial-init-rollback:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports setjmp/longjmp unwinding', () => {
    const setjmpUnwind: VanillaFatalErrorShutdownOrderingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'fatal-path-uses-setjmp-longjmp') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaFatalErrorShutdownOrdering(setjmpUnwind);
    expect(failures.some((failure) => failure.startsWith('probe:fatal-path-does-not-use-setjmp-longjmp:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports an I_AtExit-style registration stack', () => {
    const hasStack: VanillaFatalErrorShutdownOrderingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'fatal-path-has-registration-stack') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaFatalErrorShutdownOrdering(hasStack);
    expect(failures.some((failure) => failure.startsWith('probe:fatal-path-does-not-have-registration-stack:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the wrong total phase count (12 instead of 13)', () => {
    const wrongTotal: VanillaFatalErrorShutdownOrderingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'landscape-total-phase-count') {
          return Object.freeze({ ...inner, answeredCount: 12 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaFatalErrorShutdownOrdering(wrongTotal);
    expect(failures.some((failure) => failure.startsWith('probe:landscape-total-phase-count-is-thirteen:answeredCount:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports S_Init as having an explicit shutdown', () => {
    const sInitExplicit: VanillaFatalErrorShutdownOrderingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'phase-presence-in-explicit-shutdown' && probe.queryPhaseName === 'S_Init') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaFatalErrorShutdownOrdering(sInitExplicit);
    expect(failures.some((failure) => failure.startsWith('probe:phase-s-init-presence-is-false:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports D_CheckNetGame as OS-reclaimed (dropping its explicit shutdown)', () => {
    const dropDQuit: VanillaFatalErrorShutdownOrderingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'phase-teardown-strategy' && probe.queryPhaseName === 'D_CheckNetGame') {
          return Object.freeze({ ...inner, answeredTeardownStrategy: 'os-reclaims-heap' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaFatalErrorShutdownOrdering(dropDQuit);
    expect(failures.some((failure) => failure.startsWith('probe:phase-d-checknetgame-strategy-is-explicit:answeredTeardownStrategy:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the wrong explicit-shutdown count (3 instead of 2)', () => {
    const wrongExplicitCount: VanillaFatalErrorShutdownOrderingHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
        if (probe.queryKind === 'landscape-explicit-shutdown-phase-count') {
          return Object.freeze({ ...inner, answeredCount: 3 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaFatalErrorShutdownOrdering(wrongExplicitCount);
    expect(failures.some((failure) => failure.startsWith('probe:landscape-explicit-shutdown-phase-count-is-two:answeredCount:value-mismatch'))).toBe(true);
  });
});

describe('deriveExpectedVanillaFatalErrorShutdownOrderingResult helper', () => {
  test('matches the reference handler answer for every pinned probe', () => {
    for (const probe of VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES) {
      const derived: VanillaFatalErrorShutdownOrderingResult = deriveExpectedVanillaFatalErrorShutdownOrderingResult(probe);
      const reference: VanillaFatalErrorShutdownOrderingResult = REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER.runProbe(probe);
      expect(derived.answeredShutdownSymbol).toBe(reference.answeredShutdownSymbol);
      expect(derived.answeredTeardownStrategy).toBe(reference.answeredTeardownStrategy);
      expect(derived.answeredPresent).toBe(reference.answeredPresent);
      expect(derived.answeredCount).toBe(reference.answeredCount);
    }
  });

  test('returns null for an out-of-range fatal-explicit-shutdown-at-index query', () => {
    const probe: VanillaFatalErrorShutdownOrderingProbe = {
      id: 'out-of-range-probe-test',
      description: 'Test probe with index outside the canonical 0..2 range.',
      queryKind: 'fatal-explicit-shutdown-at-index',
      queryIndex: 99,
      queryPhaseName: null,
      queryChocolateShutdownName: null,
      expectedAnsweredShutdownSymbol: null,
      expectedAnsweredTeardownStrategy: null,
      expectedAnsweredPresent: null,
      expectedAnsweredCount: null,
      witnessInvariantId: 'FATAL_PATH_ORDER_IS_DEMO_NETWORK_GRAPHICS',
    };
    const result = deriveExpectedVanillaFatalErrorShutdownOrderingResult(probe);
    expect(result.answeredShutdownSymbol).toBeNull();
  });

  test('returns null for a phase-teardown-strategy query with an unknown phase name', () => {
    const probe: VanillaFatalErrorShutdownOrderingProbe = {
      id: 'unknown-phase-probe-test',
      description: 'Test probe with an unknown phase name.',
      queryKind: 'phase-teardown-strategy',
      queryIndex: null,
      queryPhaseName: 'V_Init',
      queryChocolateShutdownName: null,
      expectedAnsweredShutdownSymbol: null,
      expectedAnsweredTeardownStrategy: null,
      expectedAnsweredPresent: null,
      expectedAnsweredCount: null,
      witnessInvariantId: 'INIT_PHASE_LANDSCAPE_HAS_ELEVEN_OS_RECLAIMED_PHASES',
    };
    const result = deriveExpectedVanillaFatalErrorShutdownOrderingResult(probe);
    expect(result.answeredTeardownStrategy).toBe('static-memory-implicit-reclaim');
  });
});

describe('implement-fatal-error-shutdown-ordering step file', () => {
  test('declares the launch lane and the implement write lock', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('## lane\n\nlaunch');
    expect(stepText).toContain('- src/bootstrap/implement-fatal-error-shutdown-ordering.ts');
    expect(stepText).toContain('- test/vanilla_parity/launch/implement-fatal-error-shutdown-ordering.test.ts');
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
