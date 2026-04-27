import { describe, expect, test } from 'bun:test';

import { CANONICAL_QUIT_ORDER, CANONICAL_REGISTRATION_ORDER, CLEANUP_STEP_COUNT, QuitFlow } from '../../../src/bootstrap/quitFlow.ts';
import type { CleanupRegistration, CleanupStepName } from '../../../src/bootstrap/quitFlow.ts';
import {
  REFERENCE_VANILLA_STARTUP_ERROR_PATH_HANDLER,
  VANILLA_I_ATEXIT_CONTRACT_AUDIT,
  VANILLA_I_ERROR_CONTRACT_AUDIT,
  VANILLA_I_QUIT_CONTRACT_AUDIT,
  VANILLA_SHAREWARE_CANONICAL_HANDLER_COUNT,
  VANILLA_STARTUP_ERROR_PATH_DERIVED_INVARIANTS,
  VANILLA_STARTUP_ERROR_PATH_PROBES,
  crossCheckVanillaStartupErrorPath,
  deriveExpectedDispatchSequence,
} from '../../../src/bootstrap/implement-startup-error-path-and-i-error-semantics.ts';
import type { VanillaStartupErrorPathHandler, VanillaStartupErrorPathProbe } from '../../../src/bootstrap/implement-startup-error-path-and-i-error-semantics.ts';

const STEP_FILE_RELATIVE_PATH = 'plan_vanilla_parity/steps/03-003-implement-startup-error-path-and-i-error-semantics.md';

describe('VANILLA_I_ERROR_CONTRACT_AUDIT ledger shape', () => {
  test('audits exactly five contract clauses for I_Error', () => {
    expect(VANILLA_I_ERROR_CONTRACT_AUDIT.length).toBe(5);
  });

  test('every clause id is unique', () => {
    const ids = VANILLA_I_ERROR_CONTRACT_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every clause references src/i_system.c and pins the I_Error symbol', () => {
    for (const entry of VANILLA_I_ERROR_CONTRACT_AUDIT) {
      expect(entry.referenceSourceFile).toBe('src/i_system.c');
      expect(entry.cSymbol).toBe('I_Error');
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('declares the five contract ids the cross-check enforces', () => {
    const ids = new Set(VANILLA_I_ERROR_CONTRACT_AUDIT.map((entry) => entry.id));
    expect(ids).toEqual(new Set(['RECURSIVE_CALL_PRINTS_WARNING_AND_EXITS', 'RUNS_ONLY_RUN_ON_ERROR_HANDLERS', 'HANDLERS_RUN_IN_LIFO_ORDER', 'ERROR_MESSAGE_FORMATTED_TO_STDERR', 'EXITS_PROCESS_NON_ZERO']));
  });
});

describe('VANILLA_I_QUIT_CONTRACT_AUDIT ledger shape', () => {
  test('audits exactly three contract clauses for I_Quit', () => {
    expect(VANILLA_I_QUIT_CONTRACT_AUDIT.length).toBe(3);
  });

  test('every clause id is unique', () => {
    const ids = VANILLA_I_QUIT_CONTRACT_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every clause references src/i_system.c and pins the I_Quit symbol', () => {
    for (const entry of VANILLA_I_QUIT_CONTRACT_AUDIT) {
      expect(entry.referenceSourceFile).toBe('src/i_system.c');
      expect(entry.cSymbol).toBe('I_Quit');
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('declares the three contract ids the cross-check enforces', () => {
    const ids = new Set(VANILLA_I_QUIT_CONTRACT_AUDIT.map((entry) => entry.id));
    expect(ids).toEqual(new Set(['RUNS_ALL_HANDLERS_REGARDLESS_OF_RUN_ON_ERROR', 'HANDLERS_RUN_IN_LIFO_ORDER', 'EXITS_PROCESS_ZERO']));
  });
});

describe('VANILLA_I_ATEXIT_CONTRACT_AUDIT ledger shape', () => {
  test('audits exactly two contract clauses for I_AtExit', () => {
    expect(VANILLA_I_ATEXIT_CONTRACT_AUDIT.length).toBe(2);
  });

  test('every clause id is unique', () => {
    const ids = VANILLA_I_ATEXIT_CONTRACT_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every clause references src/i_system.c and pins the I_AtExit symbol', () => {
    for (const entry of VANILLA_I_ATEXIT_CONTRACT_AUDIT) {
      expect(entry.referenceSourceFile).toBe('src/i_system.c');
      expect(entry.cSymbol).toBe('I_AtExit');
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('declares the PREPENDS_TO_LINKED_LIST and PRESERVES_RUN_ON_ERROR_FLAG ids', () => {
    const ids = new Set(VANILLA_I_ATEXIT_CONTRACT_AUDIT.map((entry) => entry.id));
    expect(ids).toEqual(new Set(['PREPENDS_TO_LINKED_LIST', 'PRESERVES_RUN_ON_ERROR_FLAG']));
  });
});

describe('VANILLA_STARTUP_ERROR_PATH_DERIVED_INVARIANTS ledger shape', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = VANILLA_STARTUP_ERROR_PATH_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares the seven derived invariants the cross-check witnesses', () => {
    const ids = new Set(VANILLA_STARTUP_ERROR_PATH_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'ERROR_PATH_RUNS_ONLY_RUN_ON_ERROR_HANDLERS',
        'NORMAL_PATH_RUNS_ALL_HANDLERS',
        'BOTH_PATHS_USE_LIFO_ORDER',
        'SHAREWARE_CANONICAL_PATHS_ARE_IDENTICAL',
        'RECURSIVE_QUIT_IS_REJECTED',
        'REGISTER_AFTER_QUIT_IS_REJECTED',
        'EMPTY_REGISTRATION_RUNS_NO_HANDLERS',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of VANILLA_STARTUP_ERROR_PATH_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('VANILLA_STARTUP_ERROR_PATH_PROBES ledger shape', () => {
  test('every probe id is unique', () => {
    const ids = VANILLA_STARTUP_ERROR_PATH_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every probe witnesses an existing derived invariant', () => {
    const declaredIds = new Set(VANILLA_STARTUP_ERROR_PATH_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    for (const probe of VANILLA_STARTUP_ERROR_PATH_PROBES) {
      expect(declaredIds.has(probe.witnessInvariantId)).toBe(true);
    }
  });

  test('every derived invariant is witnessed by at least one probe', () => {
    const witnessedIds = new Set(VANILLA_STARTUP_ERROR_PATH_PROBES.map((probe) => probe.witnessInvariantId));
    const declaredIds = new Set(VANILLA_STARTUP_ERROR_PATH_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    for (const id of declaredIds) {
      expect(witnessedIds.has(id as VanillaStartupErrorPathProbe['witnessInvariantId'])).toBe(true);
    }
  });

  test('every probe carries a non-empty description and a valid dispatchKind', () => {
    for (const probe of VANILLA_STARTUP_ERROR_PATH_PROBES) {
      expect(probe.description.length).toBeGreaterThan(0);
      expect(['error', 'normal']).toContain(probe.dispatchKind);
      expect(['none', 'register', 'dispatch']).toContain(probe.recursiveFollowUp);
    }
  });

  test('every probe expectedExecution is consistent with deriveExpectedDispatchSequence', () => {
    for (const probe of VANILLA_STARTUP_ERROR_PATH_PROBES) {
      const derived = deriveExpectedDispatchSequence(probe.registrations, probe.dispatchKind);
      expect([...probe.expectedExecution]).toEqual([...derived]);
    }
  });

  test('expectsRecursiveRejection is false whenever recursiveFollowUp is "none"', () => {
    for (const probe of VANILLA_STARTUP_ERROR_PATH_PROBES) {
      if (probe.recursiveFollowUp === 'none') {
        expect(probe.expectsRecursiveRejection).toBe(false);
      }
    }
  });
});

describe('VANILLA_SHAREWARE_CANONICAL_HANDLER_COUNT', () => {
  test('matches CLEANUP_STEP_COUNT verbatim', () => {
    expect(VANILLA_SHAREWARE_CANONICAL_HANDLER_COUNT).toBe(CLEANUP_STEP_COUNT);
  });

  test('equals 8 (the shareware Doom 2.2.1 canonical registration count)', () => {
    expect(VANILLA_SHAREWARE_CANONICAL_HANDLER_COUNT).toBe(8);
  });
});

describe('crossCheckVanillaStartupErrorPath against REFERENCE_VANILLA_STARTUP_ERROR_PATH_HANDLER', () => {
  test('reports zero failures for the runtime QuitFlow class', () => {
    expect(crossCheckVanillaStartupErrorPath(REFERENCE_VANILLA_STARTUP_ERROR_PATH_HANDLER)).toEqual([]);
  });

  test('the reference handler routes every probe to a fresh QuitFlow instance', () => {
    const probe = VANILLA_STARTUP_ERROR_PATH_PROBES.find((entry) => entry.id === 'shareware-canonical-error-path-matches-quit-order');
    expect(probe).toBeDefined();
    const refResult = REFERENCE_VANILLA_STARTUP_ERROR_PATH_HANDLER.runProbe(probe!);
    expect([...refResult.executed]).toEqual([...CANONICAL_QUIT_ORDER]);

    const flow = new QuitFlow();
    for (const registration of CANONICAL_REGISTRATION_ORDER) {
      flow.register(registration.name, registration.runOnError);
    }
    const captured: CleanupStepName[] = [];
    flow.executeErrorQuit((name) => {
      captured.push(name);
    });
    expect([...captured]).toEqual([...refResult.executed]);
  });
});

describe('crossCheckVanillaStartupErrorPath failure modes', () => {
  test('detects a handler that drops the runOnError filter on the error path', () => {
    const ignoreFilter: VanillaStartupErrorPathHandler = {
      runProbe: (probe) => {
        const flow = new QuitFlow();
        for (const registration of probe.registrations) {
          flow.register(registration.name, registration.runOnError);
        }
        const executed: CleanupStepName[] = [];
        const dispatch = (name: CleanupStepName): void => {
          executed.push(name);
        };
        flow.executeQuit(dispatch);
        return { executed, recursiveFollowUpRejected: probe.recursiveFollowUp === 'none' ? null : true };
      },
    };
    const failures = crossCheckVanillaStartupErrorPath(ignoreFilter);
    expect(failures.some((failure) => failure.startsWith('probe:error-path-skips-run-on-error-false:'))).toBe(true);
  });

  test('detects a handler that uses FIFO order instead of LIFO', () => {
    const fifoOrder: VanillaStartupErrorPathHandler = {
      runProbe: (probe) => {
        const filtered = probe.registrations.filter((registration) => probe.dispatchKind !== 'error' || registration.runOnError);
        const executed = filtered.map((registration) => registration.name);
        return { executed, recursiveFollowUpRejected: probe.recursiveFollowUp === 'none' ? null : true };
      },
    };
    const failures = crossCheckVanillaStartupErrorPath(fifoOrder);
    expect(failures.some((failure) => failure.startsWith('probe:lifo-order-three-handlers-error-path:execution:order-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:lifo-order-three-handlers-normal-path:execution:order-mismatch'))).toBe(true);
  });

  test('detects a handler that does not reject a second dispatch', () => {
    const noRecursiveGuard: VanillaStartupErrorPathHandler = {
      runProbe: (probe) => {
        const filtered = probe.registrations.filter((registration) => probe.dispatchKind !== 'error' || registration.runOnError);
        const executed: CleanupStepName[] = [];
        for (let index = filtered.length - 1; index >= 0; index--) {
          executed.push(filtered[index]!.name);
        }
        if (probe.recursiveFollowUp === 'none') {
          return { executed, recursiveFollowUpRejected: null };
        }
        return { executed, recursiveFollowUpRejected: false };
      },
    };
    const failures = crossCheckVanillaStartupErrorPath(noRecursiveGuard);
    expect(failures.some((failure) => failure.startsWith('probe:recursive-error-quit-is-rejected:recursive:expected-rejection-missing'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:recursive-normal-quit-is-rejected:recursive:expected-rejection-missing'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:register-after-error-quit-is-rejected:recursive:expected-rejection-missing'))).toBe(true);
  });

  test('detects a handler that runs zero handlers even when registrations are present', () => {
    const dropAll: VanillaStartupErrorPathHandler = {
      runProbe: (probe) => {
        return {
          executed: [],
          recursiveFollowUpRejected: probe.recursiveFollowUp === 'none' ? null : true,
        };
      },
    };
    const failures = crossCheckVanillaStartupErrorPath(dropAll);
    expect(failures.some((failure) => failure.startsWith('probe:lifo-order-three-handlers-error-path:execution:length-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:shareware-canonical-error-path-matches-quit-order:execution:length-mismatch'))).toBe(true);
  });

  test('detects a handler that returns a recursive-rejection flag for a no-followup probe', () => {
    const overzealousGuard: VanillaStartupErrorPathHandler = {
      runProbe: (probe) => {
        const flow = new QuitFlow();
        for (const registration of probe.registrations) {
          flow.register(registration.name, registration.runOnError);
        }
        const executed: CleanupStepName[] = [];
        const dispatch = (name: CleanupStepName): void => {
          executed.push(name);
        };
        if (probe.dispatchKind === 'error') {
          flow.executeErrorQuit(dispatch);
        } else {
          flow.executeQuit(dispatch);
        }
        return { executed, recursiveFollowUpRejected: true };
      },
    };
    const failures = crossCheckVanillaStartupErrorPath(overzealousGuard);
    expect(failures.some((failure) => failure.startsWith('probe:empty-error-path-runs-zero-handlers:recursive:unexpected-rejection'))).toBe(true);
  });
});

describe('runtime QuitFlow satisfies the documented vanilla I_Error semantics directly', () => {
  test('executeErrorQuit on canonical shareware registrations matches CANONICAL_QUIT_ORDER', () => {
    const flow = new QuitFlow();
    for (const registration of CANONICAL_REGISTRATION_ORDER) {
      flow.register(registration.name, registration.runOnError);
    }
    const executed: CleanupStepName[] = [];
    flow.executeErrorQuit((name) => {
      executed.push(name);
    });
    expect([...executed]).toEqual([...CANONICAL_QUIT_ORDER]);
  });

  test('executeQuit on canonical shareware registrations matches CANONICAL_QUIT_ORDER', () => {
    const flow = new QuitFlow();
    for (const registration of CANONICAL_REGISTRATION_ORDER) {
      flow.register(registration.name, registration.runOnError);
    }
    const executed: CleanupStepName[] = [];
    flow.executeQuit((name) => {
      executed.push(name);
    });
    expect([...executed]).toEqual([...CANONICAL_QUIT_ORDER]);
  });

  test('a handler with runOnError=false is skipped on the error path but runs on the normal path', () => {
    const errorFlow = new QuitFlow();
    errorFlow.register('M_SaveDefaults', false);
    errorFlow.register('I_ShutdownGraphics', true);
    const errorExecuted: CleanupStepName[] = [];
    errorFlow.executeErrorQuit((name) => {
      errorExecuted.push(name);
    });
    expect([...errorExecuted]).toEqual(['I_ShutdownGraphics']);

    const normalFlow = new QuitFlow();
    normalFlow.register('M_SaveDefaults', false);
    normalFlow.register('I_ShutdownGraphics', true);
    const normalExecuted: CleanupStepName[] = [];
    normalFlow.executeQuit((name) => {
      normalExecuted.push(name);
    });
    expect([...normalExecuted]).toEqual(['I_ShutdownGraphics', 'M_SaveDefaults']);
  });

  test('a second executeErrorQuit after the first throws (recursive guard)', () => {
    const flow = new QuitFlow();
    flow.register('I_ShutdownGraphics', true);
    flow.executeErrorQuit(() => {
      // Initial dispatch consumes the registration; sink ignores the names.
    });
    expect(() => {
      flow.executeErrorQuit(() => {
        // Recursive dispatch must throw before any name is dispatched.
      });
    }).toThrow();
  });

  test('a second executeQuit after the first throws (recursive guard)', () => {
    const flow = new QuitFlow();
    flow.register('I_ShutdownGraphics', true);
    flow.executeQuit(() => {
      // Initial dispatch consumes the registration; sink ignores the names.
    });
    expect(() => {
      flow.executeQuit(() => {
        // Recursive dispatch must throw before any name is dispatched.
      });
    }).toThrow();
  });

  test('register after executeErrorQuit throws (modeling the already_quitting sentinel)', () => {
    const flow = new QuitFlow();
    flow.register('I_ShutdownGraphics', true);
    flow.executeErrorQuit(() => {
      // Drain the initial registration before attempting a post-quit register.
    });
    expect(() => {
      flow.register('M_SaveDefaults', true);
    }).toThrow();
  });
});

describe('deriveExpectedDispatchSequence helper', () => {
  test('returns LIFO of all registrations on the normal path', () => {
    const registrations: readonly CleanupRegistration[] = [
      { name: 'M_SaveDefaults', runOnError: false },
      { name: 'I_ShutdownTimer', runOnError: true },
      { name: 'I_ShutdownGraphics', runOnError: false },
    ];
    expect([...deriveExpectedDispatchSequence(registrations, 'normal')]).toEqual(['I_ShutdownGraphics', 'I_ShutdownTimer', 'M_SaveDefaults']);
  });

  test('returns LIFO of runOnError=true registrations on the error path', () => {
    const registrations: readonly CleanupRegistration[] = [
      { name: 'M_SaveDefaults', runOnError: false },
      { name: 'I_ShutdownTimer', runOnError: true },
      { name: 'I_ShutdownGraphics', runOnError: false },
    ];
    expect([...deriveExpectedDispatchSequence(registrations, 'error')]).toEqual(['I_ShutdownTimer']);
  });

  test('returns an empty sequence when there are no registrations', () => {
    expect([...deriveExpectedDispatchSequence([], 'error')]).toEqual([]);
    expect([...deriveExpectedDispatchSequence([], 'normal')]).toEqual([]);
  });
});

describe('implement-startup-error-path-and-i-error-semantics step file', () => {
  test('declares the launch lane and the implement write lock', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('## lane\n\nlaunch');
    expect(stepText).toContain('- src/bootstrap/implement-startup-error-path-and-i-error-semantics.ts');
    expect(stepText).toContain('- test/vanilla_parity/launch/implement-startup-error-path-and-i-error-semantics.test.ts');
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
