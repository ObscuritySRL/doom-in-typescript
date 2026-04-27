/**
 * Audit ledger for the vanilla DOOM 1.9 startup error path and the
 * `I_Error` cleanup-fan-out semantics modeled by
 * `src/bootstrap/quitFlow.ts`.
 *
 * Each entry pins one contract invariant of Chocolate Doom 2.2.1's
 * `I_AtExit`, `I_Quit`, and `I_Error` (see `src/i_system.c`) to its
 * upstream source declaration. The accompanying focused test imports
 * the runtime `QuitFlow` class and cross-checks every audit entry
 * against concrete probes. If a future change silently weakens the
 * LIFO traversal, the `runOnError` filter, the recursive-call guard,
 * or the canonical shareware registration set, the audit ledger and
 * the focused test together reject the change.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source,
 *   5. Chocolate Doom 2.2.1 source (`src/i_system.c`, `src/d_main.c`,
 *      `src/g_game.c`, `src/i_video.c`, `src/m_menu.c`).
 *
 * The audit invariants below are pinned against authority 5 because
 * the `I_Error`, `I_Quit`, and `I_AtExit` contract is a textual
 * property of the C source: a singly-linked list built by prepend, a
 * traversal loop walking that list, a `run_on_error` boolean filter
 * on the error path, and a recursive-call sentinel that short-circuits
 * cleanup. Authority 1 (the DOS binary) cannot disagree with these
 * because they are the visible pre-condition every vanilla startup
 * error consumer depends on.
 */

import { CANONICAL_QUIT_ORDER, CANONICAL_REGISTRATION_ORDER, CLEANUP_STEP_COUNT, QuitFlow } from './quitFlow.ts';
import type { CleanupRegistration, CleanupStepName } from './quitFlow.ts';

/**
 * One audited contract invariant of `I_Error`.
 */
export interface VanillaIErrorContractAuditEntry {
  /** Stable identifier of the invariant. */
  readonly id: 'RECURSIVE_CALL_PRINTS_WARNING_AND_EXITS' | 'RUNS_ONLY_RUN_ON_ERROR_HANDLERS' | 'HANDLERS_RUN_IN_LIFO_ORDER' | 'ERROR_MESSAGE_FORMATTED_TO_STDERR' | 'EXITS_PROCESS_NON_ZERO';
  /** Plain-language description of the contract clause. */
  readonly invariant: string;
  /** Reference source file inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/i_system.c';
  /** Verbatim C symbol the contract clause is pinned to. */
  readonly cSymbol: 'I_Error';
}

/**
 * Pinned ledger of every contract clause of `I_Error`.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every dispatch-observable clause holds against the
 * runtime `QuitFlow` class.
 */
export const VANILLA_I_ERROR_CONTRACT_AUDIT: readonly VanillaIErrorContractAuditEntry[] = [
  {
    id: 'RECURSIVE_CALL_PRINTS_WARNING_AND_EXITS',
    invariant:
      'I_Error guards against re-entry via the static `already_quitting` sentinel. When the sentinel is already set, I_Error prints a warning to stderr and exits without walking the exit_funcs list a second time. The first call sets the sentinel, ensuring that any subsequent I_Error or I_Quit invocation short-circuits cleanup.',
    referenceSourceFile: 'src/i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'RUNS_ONLY_RUN_ON_ERROR_HANDLERS',
    invariant: 'I_Error walks the exit_funcs linked list and dispatches `entry->func()` only when `entry->run_on_error` is true. Handlers registered with `run_on_error == false` are skipped on the error path even when present in the list.',
    referenceSourceFile: 'src/i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'HANDLERS_RUN_IN_LIFO_ORDER',
    invariant:
      'I_Error walks exit_funcs head-to-tail. Because I_AtExit prepends every new entry at the head of the list, head-to-tail traversal yields LIFO execution: the most recently registered handler fires first, and the oldest registration fires last among eligible handlers.',
    referenceSourceFile: 'src/i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'ERROR_MESSAGE_FORMATTED_TO_STDERR',
    invariant:
      'I_Error formats the variadic error message to stderr (not stdout) using the printf-style format string. The output is bracketed by a leading "\\nError: " prefix and a trailing "\\n\\n" suffix, with the formatted body written by vfprintf in between, and the stream is flushed before cleanup runs.',
    referenceSourceFile: 'src/i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'EXITS_PROCESS_NON_ZERO',
    invariant: 'I_Error terminates the process with a non-zero exit status (vanilla and Chocolate Doom both call exit(-1)) after running eligible cleanup. The non-zero status distinguishes the error path from the I_Quit success path.',
    referenceSourceFile: 'src/i_system.c',
    cSymbol: 'I_Error',
  },
] as const;

/**
 * One audited contract invariant of `I_Quit`.
 */
export interface VanillaIQuitContractAuditEntry {
  /** Stable identifier of the invariant. */
  readonly id: 'RUNS_ALL_HANDLERS_REGARDLESS_OF_RUN_ON_ERROR' | 'HANDLERS_RUN_IN_LIFO_ORDER' | 'EXITS_PROCESS_ZERO';
  /** Plain-language description of the contract clause. */
  readonly invariant: string;
  /** Reference source file inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/i_system.c';
  /** Verbatim C symbol the contract clause is pinned to. */
  readonly cSymbol: 'I_Quit';
}

/**
 * Pinned ledger of every contract clause of `I_Quit`.
 */
export const VANILLA_I_QUIT_CONTRACT_AUDIT: readonly VanillaIQuitContractAuditEntry[] = [
  {
    id: 'RUNS_ALL_HANDLERS_REGARDLESS_OF_RUN_ON_ERROR',
    invariant:
      'I_Quit walks the exit_funcs linked list and dispatches `entry->func()` for every entry without inspecting `entry->run_on_error`. The `run_on_error` flag is only consulted by I_Error; I_Quit treats every registered handler as eligible.',
    referenceSourceFile: 'src/i_system.c',
    cSymbol: 'I_Quit',
  },
  {
    id: 'HANDLERS_RUN_IN_LIFO_ORDER',
    invariant:
      'I_Quit walks exit_funcs head-to-tail just like I_Error. Because I_AtExit prepends every new entry at the head, head-to-tail traversal yields LIFO execution: the most recently registered handler fires first, and the first registration fires last.',
    referenceSourceFile: 'src/i_system.c',
    cSymbol: 'I_Quit',
  },
  {
    id: 'EXITS_PROCESS_ZERO',
    invariant: 'I_Quit terminates the process with exit status 0 (success) after running every registered handler. The zero status distinguishes the I_Quit success path from the I_Error fatal path.',
    referenceSourceFile: 'src/i_system.c',
    cSymbol: 'I_Quit',
  },
] as const;

/**
 * One audited contract invariant of `I_AtExit`.
 */
export interface VanillaIAtExitContractAuditEntry {
  /** Stable identifier of the invariant. */
  readonly id: 'PREPENDS_TO_LINKED_LIST' | 'PRESERVES_RUN_ON_ERROR_FLAG';
  /** Plain-language description of the contract clause. */
  readonly invariant: string;
  /** Reference source file inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/i_system.c';
  /** Verbatim C symbol the contract clause is pinned to. */
  readonly cSymbol: 'I_AtExit';
}

/**
 * Pinned ledger of every contract clause of `I_AtExit`.
 */
export const VANILLA_I_ATEXIT_CONTRACT_AUDIT: readonly VanillaIAtExitContractAuditEntry[] = [
  {
    id: 'PREPENDS_TO_LINKED_LIST',
    invariant:
      'I_AtExit allocates a new atexit_listentry_t, points its `next` field at the current `exit_funcs` head, and reassigns `exit_funcs` to the new entry. The result is a head-prepend that makes the most recently registered handler the new head, which is what produces LIFO execution when the list is later walked head-to-tail.',
    referenceSourceFile: 'src/i_system.c',
    cSymbol: 'I_AtExit',
  },
  {
    id: 'PRESERVES_RUN_ON_ERROR_FLAG',
    invariant: 'I_AtExit copies the caller-supplied `run_on_error` boolean verbatim into `entry->run_on_error`. The flag is not normalized, defaulted, or mutated; whatever value the caller passed is the value I_Error later checks.',
    referenceSourceFile: 'src/i_system.c',
    cSymbol: 'I_AtExit',
  },
] as const;

/**
 * One derived high-level invariant the cross-check enforces on top of
 * the raw clause declarations. Failures point at concrete identities
 * that any vanilla parity startup error path must preserve.
 */
export interface VanillaStartupErrorPathDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const VANILLA_STARTUP_ERROR_PATH_DERIVED_INVARIANTS: readonly VanillaStartupErrorPathDerivedInvariant[] = [
  {
    id: 'ERROR_PATH_RUNS_ONLY_RUN_ON_ERROR_HANDLERS',
    description: 'The error path executes exactly those registrations whose `runOnError` flag is true, and skips the rest.',
  },
  {
    id: 'NORMAL_PATH_RUNS_ALL_HANDLERS',
    description: 'The normal quit path executes every registered handler regardless of `runOnError`.',
  },
  {
    id: 'BOTH_PATHS_USE_LIFO_ORDER',
    description: 'Both I_Error and I_Quit traverse the linked list head-to-tail; because I_AtExit prepends, the visible execution order is LIFO with respect to registration.',
  },
  {
    id: 'SHAREWARE_CANONICAL_PATHS_ARE_IDENTICAL',
    description: 'For shareware Doom 2.2.1 every one of the eight canonical handlers is registered with `runOnError == true`, so I_Error and I_Quit produce the identical execution sequence (CANONICAL_QUIT_ORDER).',
  },
  {
    id: 'RECURSIVE_QUIT_IS_REJECTED',
    description: 'A second invocation of I_Error or I_Quit after the first one has run must be rejected by the runtime sentinel, modeling the `already_quitting` short-circuit in i_system.c.',
  },
  {
    id: 'REGISTER_AFTER_QUIT_IS_REJECTED',
    description: 'I_AtExit-style registration is not permitted once cleanup has started; the runtime must reject the registration to model the `already_quitting` sentinel.',
  },
  {
    id: 'EMPTY_REGISTRATION_RUNS_NO_HANDLERS',
    description: 'When no handlers have been registered, both I_Error and I_Quit dispatch zero handlers and emit an empty execution sequence.',
  },
];

/**
 * Type of dispatch path being exercised by a probe.
 *
 * - `'error'`: I_Error path (uses `executeErrorQuit`, filters by
 *   `runOnError`).
 * - `'normal'`: I_Quit path (uses `executeQuit`, dispatches every
 *   handler).
 */
export type StartupErrorPathDispatchKind = 'error' | 'normal';

/**
 * Type of post-quit follow-up exercised by a probe to verify the
 * recursive-call guard.
 *
 * - `'none'`: no follow-up; the probe finishes after the initial
 *   dispatch.
 * - `'register'`: the probe attempts to register another handler
 *   after dispatch and expects the runtime to reject it.
 * - `'dispatch'`: the probe attempts a second dispatch and expects
 *   the runtime to reject it.
 */
export type StartupErrorPathRecursiveFollowUp = 'none' | 'register' | 'dispatch';

/**
 * One probe applied to a runtime startup-error-path handler.
 *
 * Each probe pins:
 *  - a concrete sequence of registrations to install,
 *  - which dispatch path to take,
 *  - the expected execution sequence,
 *  - and the expected recursive-call follow-up outcome.
 *
 * The cross-check helper runs every probe against the runtime handler
 * and reports failures by stable identifier.
 */
export interface VanillaStartupErrorPathProbe {
  /** Stable identifier used in cross-check failure ids. */
  readonly id: string;
  /** Plain-language description of what the probe exercises. */
  readonly description: string;
  /** Registrations to install in chronological (I_AtExit call) order. */
  readonly registrations: readonly CleanupRegistration[];
  /** Dispatch path the probe exercises. */
  readonly dispatchKind: StartupErrorPathDispatchKind;
  /** Expected execution sequence in dispatch order. */
  readonly expectedExecution: readonly CleanupStepName[];
  /** Recursive follow-up to attempt after the initial dispatch. */
  readonly recursiveFollowUp: StartupErrorPathRecursiveFollowUp;
  /** Whether the recursive follow-up is expected to be rejected. */
  readonly expectsRecursiveRejection: boolean;
  /** Stable invariant id this probe witnesses. */
  readonly witnessInvariantId:
    | 'ERROR_PATH_RUNS_ONLY_RUN_ON_ERROR_HANDLERS'
    | 'NORMAL_PATH_RUNS_ALL_HANDLERS'
    | 'BOTH_PATHS_USE_LIFO_ORDER'
    | 'SHAREWARE_CANONICAL_PATHS_ARE_IDENTICAL'
    | 'RECURSIVE_QUIT_IS_REJECTED'
    | 'REGISTER_AFTER_QUIT_IS_REJECTED'
    | 'EMPTY_REGISTRATION_RUNS_NO_HANDLERS';
}

/** Reverse a list of registrations into LIFO execution order, filtering by `runOnError` if requested. */
function lifoExecution(registrations: readonly CleanupRegistration[], filterByRunOnError: boolean): readonly CleanupStepName[] {
  const order: CleanupStepName[] = [];
  for (let index = registrations.length - 1; index >= 0; index--) {
    const registration = registrations[index]!;
    if (!filterByRunOnError || registration.runOnError) {
      order.push(registration.name);
    }
  }
  return order;
}

/**
 * Pinned probe set covering every derived invariant. Each probe is
 * minimal: a tiny registration sequence, one dispatch path, and one
 * expected execution sequence.
 */
export const VANILLA_STARTUP_ERROR_PATH_PROBES: readonly VanillaStartupErrorPathProbe[] = [
  {
    id: 'empty-error-path-runs-zero-handlers',
    description: 'With no registrations, I_Error dispatches nothing and the execution sequence is empty.',
    registrations: [],
    dispatchKind: 'error',
    expectedExecution: [],
    recursiveFollowUp: 'none',
    expectsRecursiveRejection: false,
    witnessInvariantId: 'EMPTY_REGISTRATION_RUNS_NO_HANDLERS',
  },
  {
    id: 'empty-normal-path-runs-zero-handlers',
    description: 'With no registrations, I_Quit dispatches nothing and the execution sequence is empty.',
    registrations: [],
    dispatchKind: 'normal',
    expectedExecution: [],
    recursiveFollowUp: 'none',
    expectsRecursiveRejection: false,
    witnessInvariantId: 'EMPTY_REGISTRATION_RUNS_NO_HANDLERS',
  },
  {
    id: 'error-path-skips-run-on-error-false',
    description: 'A registration with `runOnError: false` is skipped on the error path even when present, and a second registration with `runOnError: true` still fires.',
    registrations: [Object.freeze({ name: 'M_SaveDefaults', runOnError: false }), Object.freeze({ name: 'I_ShutdownGraphics', runOnError: true })],
    dispatchKind: 'error',
    expectedExecution: ['I_ShutdownGraphics'],
    recursiveFollowUp: 'none',
    expectsRecursiveRejection: false,
    witnessInvariantId: 'ERROR_PATH_RUNS_ONLY_RUN_ON_ERROR_HANDLERS',
  },
  {
    id: 'normal-path-runs-run-on-error-false',
    description: 'A registration with `runOnError: false` still fires on the normal quit path because I_Quit ignores the flag.',
    registrations: [Object.freeze({ name: 'M_SaveDefaults', runOnError: false }), Object.freeze({ name: 'I_ShutdownGraphics', runOnError: true })],
    dispatchKind: 'normal',
    expectedExecution: ['I_ShutdownGraphics', 'M_SaveDefaults'],
    recursiveFollowUp: 'none',
    expectsRecursiveRejection: false,
    witnessInvariantId: 'NORMAL_PATH_RUNS_ALL_HANDLERS',
  },
  {
    id: 'lifo-order-three-handlers-error-path',
    description: 'Three registrations on the error path execute in LIFO order: last-registered first, first-registered last.',
    registrations: [Object.freeze({ name: 'M_SaveDefaults', runOnError: true }), Object.freeze({ name: 'I_ShutdownTimer', runOnError: true }), Object.freeze({ name: 'I_ShutdownGraphics', runOnError: true })],
    dispatchKind: 'error',
    expectedExecution: ['I_ShutdownGraphics', 'I_ShutdownTimer', 'M_SaveDefaults'],
    recursiveFollowUp: 'none',
    expectsRecursiveRejection: false,
    witnessInvariantId: 'BOTH_PATHS_USE_LIFO_ORDER',
  },
  {
    id: 'lifo-order-three-handlers-normal-path',
    description: 'Three registrations on the normal quit path execute in the same LIFO order as on the error path.',
    registrations: [Object.freeze({ name: 'M_SaveDefaults', runOnError: true }), Object.freeze({ name: 'I_ShutdownTimer', runOnError: true }), Object.freeze({ name: 'I_ShutdownGraphics', runOnError: true })],
    dispatchKind: 'normal',
    expectedExecution: ['I_ShutdownGraphics', 'I_ShutdownTimer', 'M_SaveDefaults'],
    recursiveFollowUp: 'none',
    expectsRecursiveRejection: false,
    witnessInvariantId: 'BOTH_PATHS_USE_LIFO_ORDER',
  },
  {
    id: 'shareware-canonical-error-path-matches-quit-order',
    description: 'For shareware Doom 2.2.1, the canonical 8-handler registration sequence on the error path produces CANONICAL_QUIT_ORDER verbatim because every handler has `runOnError == true`.',
    registrations: CANONICAL_REGISTRATION_ORDER,
    dispatchKind: 'error',
    expectedExecution: CANONICAL_QUIT_ORDER,
    recursiveFollowUp: 'none',
    expectsRecursiveRejection: false,
    witnessInvariantId: 'SHAREWARE_CANONICAL_PATHS_ARE_IDENTICAL',
  },
  {
    id: 'shareware-canonical-normal-path-matches-quit-order',
    description: 'For shareware Doom 2.2.1, the canonical 8-handler registration sequence on the normal path produces CANONICAL_QUIT_ORDER verbatim.',
    registrations: CANONICAL_REGISTRATION_ORDER,
    dispatchKind: 'normal',
    expectedExecution: CANONICAL_QUIT_ORDER,
    recursiveFollowUp: 'none',
    expectsRecursiveRejection: false,
    witnessInvariantId: 'SHAREWARE_CANONICAL_PATHS_ARE_IDENTICAL',
  },
  {
    id: 'recursive-error-quit-is-rejected',
    description: 'A second `executeErrorQuit` after the first one has run is rejected, modeling the `already_quitting` recursive-call guard.',
    registrations: [Object.freeze({ name: 'I_ShutdownGraphics', runOnError: true })],
    dispatchKind: 'error',
    expectedExecution: ['I_ShutdownGraphics'],
    recursiveFollowUp: 'dispatch',
    expectsRecursiveRejection: true,
    witnessInvariantId: 'RECURSIVE_QUIT_IS_REJECTED',
  },
  {
    id: 'recursive-normal-quit-is-rejected',
    description: 'A second `executeQuit` after the first one has run is rejected, modeling the `already_quitting` recursive-call guard.',
    registrations: [Object.freeze({ name: 'I_ShutdownGraphics', runOnError: true })],
    dispatchKind: 'normal',
    expectedExecution: ['I_ShutdownGraphics'],
    recursiveFollowUp: 'dispatch',
    expectsRecursiveRejection: true,
    witnessInvariantId: 'RECURSIVE_QUIT_IS_REJECTED',
  },
  {
    id: 'register-after-error-quit-is-rejected',
    description: 'After `executeErrorQuit` has run, attempting to register another handler is rejected, modeling that I_AtExit cannot extend the list once cleanup has begun.',
    registrations: [Object.freeze({ name: 'I_ShutdownGraphics', runOnError: true })],
    dispatchKind: 'error',
    expectedExecution: ['I_ShutdownGraphics'],
    recursiveFollowUp: 'register',
    expectsRecursiveRejection: true,
    witnessInvariantId: 'REGISTER_AFTER_QUIT_IS_REJECTED',
  },
];

/**
 * A minimal handler interface covering the three vanilla
 * startup-error-path primitives. The reference implementation routes
 * every method to a fresh `QuitFlow`, but the cross-check accepts any
 * handler shape so the focused test can exercise deliberately broken
 * adapters and observe the failure ids.
 */
export interface VanillaStartupErrorPathHandler {
  /**
   * Run a probe against a fresh runtime handler instance. Returns
   * the executed cleanup sequence, plus a flag indicating whether the
   * recursive follow-up was rejected (when the probe specifies one).
   */
  readonly runProbe: (probe: VanillaStartupErrorPathProbe) => {
    readonly executed: readonly CleanupStepName[];
    readonly recursiveFollowUpRejected: boolean | null;
  };
}

/**
 * Run a probe against a fresh `QuitFlow` instance. Implements the
 * reference adapter every parity-safe handler must satisfy.
 */
function runQuitFlowProbe(probe: VanillaStartupErrorPathProbe): {
  readonly executed: readonly CleanupStepName[];
  readonly recursiveFollowUpRejected: boolean | null;
} {
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

  if (probe.recursiveFollowUp === 'none') {
    return { executed, recursiveFollowUpRejected: null };
  }

  let rejected = false;
  try {
    if (probe.recursiveFollowUp === 'dispatch') {
      const sink = (_name: CleanupStepName): void => {
        // Sink intentionally drops dispatched names; this branch only
        // exists to detect rejection by the runtime's recursive guard.
      };
      if (probe.dispatchKind === 'error') {
        flow.executeErrorQuit(sink);
      } else {
        flow.executeQuit(sink);
      }
    } else {
      flow.register('M_SaveDefaults', true);
    }
  } catch {
    rejected = true;
  }
  return { executed, recursiveFollowUpRejected: rejected };
}

/**
 * Reference handler routing every probe to a fresh `QuitFlow`. The
 * focused test asserts that this handler passes every probe with zero
 * failures.
 */
export const REFERENCE_VANILLA_STARTUP_ERROR_PATH_HANDLER: VanillaStartupErrorPathHandler = Object.freeze({
  runProbe: runQuitFlowProbe,
});

/**
 * Stable count of canonical shareware cleanup registrations, mirrored
 * here so the focused test can assert the audit and the runtime stay
 * in lock-step on the registration arity.
 */
export const VANILLA_SHAREWARE_CANONICAL_HANDLER_COUNT = CLEANUP_STEP_COUNT;

/**
 * Cross-check a `VanillaStartupErrorPathHandler` against
 * `VANILLA_STARTUP_ERROR_PATH_PROBES`. Returns the list of failures
 * by stable identifier; an empty list means the handler is
 * parity-safe with `I_Error` / `I_Quit` / `I_AtExit`.
 *
 * Identifiers used:
 *  - `probe:<probe.id>:execution:length-mismatch`
 *  - `probe:<probe.id>:execution:order-mismatch`
 *  - `probe:<probe.id>:recursive:expected-rejection-missing`
 *  - `probe:<probe.id>:recursive:unexpected-rejection`
 *  - `probe:<probe.id>:recursive:expected-followup-skipped`
 */
export function crossCheckVanillaStartupErrorPath(handler: VanillaStartupErrorPathHandler): readonly string[] {
  const failures: string[] = [];

  for (const probe of VANILLA_STARTUP_ERROR_PATH_PROBES) {
    const result = handler.runProbe(probe);

    if (result.executed.length !== probe.expectedExecution.length) {
      failures.push(`probe:${probe.id}:execution:length-mismatch`);
    } else {
      for (let index = 0; index < probe.expectedExecution.length; index++) {
        if (result.executed[index] !== probe.expectedExecution[index]) {
          failures.push(`probe:${probe.id}:execution:order-mismatch`);
          break;
        }
      }
    }

    if (probe.recursiveFollowUp === 'none') {
      if (result.recursiveFollowUpRejected !== null) {
        failures.push(`probe:${probe.id}:recursive:unexpected-rejection`);
      }
    } else if (result.recursiveFollowUpRejected === null) {
      failures.push(`probe:${probe.id}:recursive:expected-followup-skipped`);
    } else if (probe.expectsRecursiveRejection && !result.recursiveFollowUpRejected) {
      failures.push(`probe:${probe.id}:recursive:expected-rejection-missing`);
    } else if (!probe.expectsRecursiveRejection && result.recursiveFollowUpRejected) {
      failures.push(`probe:${probe.id}:recursive:unexpected-rejection`);
    }
  }

  return failures;
}

/**
 * Convenience helper: derive the LIFO execution sequence for a given
 * registration list and dispatch kind, matching the I_Error /
 * I_Quit semantics the audit pins. Used by the focused test to
 * cross-validate probe expectations independently of `QuitFlow`.
 */
export function deriveExpectedDispatchSequence(registrations: readonly CleanupRegistration[], dispatchKind: StartupErrorPathDispatchKind): readonly CleanupStepName[] {
  return lifoExecution(registrations, dispatchKind === 'error');
}
