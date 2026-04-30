/**
 * Audited D_DoomLoop pre-loop step identifier.
 *
 * The canonical one-time setup order is:
 * `initialTryRunTics` -> `restoreBuffer` -> `executeSetViewSize` -> `startGameLoop`.
 */
export type DoomMainLoopPreLoopStep = 'executeSetViewSize' | 'initialTryRunTics' | 'restoreBuffer' | 'startGameLoop';

/** Audited count of one-time D_DoomLoop pre-loop steps. */
export const AUDITED_MAIN_LOOP_PRELOOP_STEP_COUNT = 4;

/**
 * Audited D_DoomLoop pre-loop sequence, pinned independently of the
 * runtime `MainLoop` constants so a runtime ordering drift fails loudly.
 */
export const AUDITED_MAIN_LOOP_PRELOOP_STEPS: readonly DoomMainLoopPreLoopStep[] = Object.freeze(['initialTryRunTics', 'restoreBuffer', 'executeSetViewSize', 'startGameLoop']);

/** Stable identifier for one D_DoomLoop pre-loop invariant. */
export type DoomMainLoopPreLoopOrderingInvariantIdentifier =
  | 'MAIN_LOOP_PRELOOP_FRESH_INSTANCE_FRAME_COUNT_IS_ZERO'
  | 'MAIN_LOOP_PRELOOP_FRESH_INSTANCE_NOT_STARTED'
  | 'MAIN_LOOP_PRELOOP_SETUP_DOES_NOT_ADVANCE_FRAME_COUNT'
  | 'MAIN_LOOP_PRELOOP_SETUP_MARKS_STARTED_AFTER_CALLBACKS'
  | 'MAIN_LOOP_PRELOOP_SETUP_REJECTS_SECOND_CALL'
  | 'MAIN_LOOP_PRELOOP_SETUP_RUNS_CANONICAL_ORDER'
  | 'MAIN_LOOP_PRELOOP_SETUP_RUNS_EACH_STEP_ONCE';

/** One pinned D_DoomLoop pre-loop invariant. */
export interface DoomMainLoopPreLoopOrderingInvariant {
  /** Plain-language description of the invariant. */
  readonly description: string;
  /** Stable cross-check identifier. */
  readonly identifier: DoomMainLoopPreLoopOrderingInvariantIdentifier;
}

/** Pinned invariants that define the local D_DoomLoop pre-loop contract. */
export const DOOM_MAIN_LOOP_PRELOOP_ORDERING_INVARIANTS: readonly DoomMainLoopPreLoopOrderingInvariant[] = Object.freeze([
  {
    description: 'A fresh main-loop instance has frameCount === 0 before setup.',
    identifier: 'MAIN_LOOP_PRELOOP_FRESH_INSTANCE_FRAME_COUNT_IS_ZERO',
  },
  {
    description: 'A fresh main-loop instance is not started before setup.',
    identifier: 'MAIN_LOOP_PRELOOP_FRESH_INSTANCE_NOT_STARTED',
  },
  {
    description: 'The one-time setup sequence does not advance the per-frame frameCount counter.',
    identifier: 'MAIN_LOOP_PRELOOP_SETUP_DOES_NOT_ADVANCE_FRAME_COUNT',
  },
  {
    description: 'The started flag becomes true only after all pre-loop callbacks complete.',
    identifier: 'MAIN_LOOP_PRELOOP_SETUP_MARKS_STARTED_AFTER_CALLBACKS',
  },
  {
    description: 'The one-time setup sequence rejects a second setup call.',
    identifier: 'MAIN_LOOP_PRELOOP_SETUP_REJECTS_SECOND_CALL',
  },
  {
    description: 'The one-time setup sequence runs initial TryRunTics, restore buffer, execute set view size, then start game loop.',
    identifier: 'MAIN_LOOP_PRELOOP_SETUP_RUNS_CANONICAL_ORDER',
  },
  {
    description: 'The one-time setup sequence runs exactly the four canonical pre-loop callbacks once each.',
    identifier: 'MAIN_LOOP_PRELOOP_SETUP_RUNS_EACH_STEP_ONCE',
  },
] as const);

/** Callback surface invoked by the audited pre-loop setup sequence. */
export interface DoomMainLoopPreLoopCallbacks {
  /** R_ExecuteSetViewSize equivalent. */
  executeSetViewSize(): void;
  /** Initial TryRunTics equivalent before entering the frame loop. */
  initialTryRunTics(): void;
  /** V_RestoreBuffer equivalent. */
  restoreBuffer(): void;
  /** D_StartGameLoop equivalent. */
  startGameLoop(): void;
}

/** Candidate surface for cross-checking D_DoomLoop pre-loop ordering. */
export interface DoomMainLoopPreLoopOrderingCandidate {
  /** Factory that returns a fresh candidate instance. */
  readonly create: () => DoomMainLoopPreLoopOrderingCandidateInstance;
}

/** One candidate instance that can run the pre-loop setup sequence. */
export interface DoomMainLoopPreLoopOrderingCandidateInstance {
  /** Number of completed frame-loop iterations. */
  readonly frameCount: number;
  /**
   * Execute the one-time pre-loop setup callbacks.
   *
   * @param callbacks Pre-loop callbacks to invoke.
   * @returns Nothing.
   * @example
   * ```ts
   * instance.setup(preLoopCallbacks);
   * ```
   */
  setup(callbacks: DoomMainLoopPreLoopCallbacks): void;
  /** Whether setup has completed. */
  readonly started: boolean;
}

/**
 * Reference candidate used by the focused parity cross-check.
 *
 * @example
 * ```ts
 * const instance = DOOM_MAIN_LOOP_PRELOOP_ORDERING_REFERENCE_CANDIDATE.create();
 * instance.setup(preLoopCallbacks);
 * ```
 */
export const DOOM_MAIN_LOOP_PRELOOP_ORDERING_REFERENCE_CANDIDATE: DoomMainLoopPreLoopOrderingCandidate = Object.freeze({
  create: (): DoomMainLoopPreLoopOrderingCandidateInstance => {
    let started = false;
    return {
      get frameCount(): number {
        return 0;
      },
      setup(callbacks: DoomMainLoopPreLoopCallbacks): void {
        if (started) {
          throw new Error('Doom main-loop pre-loop setup called more than once');
        }

        callbacks.initialTryRunTics();
        callbacks.restoreBuffer();
        callbacks.executeSetViewSize();
        callbacks.startGameLoop();
        started = true;
      },
      get started(): boolean {
        return started;
      },
    };
  },
});

/**
 * Cross-check a D_DoomLoop pre-loop candidate against the pinned
 * setup-order invariants.
 *
 * @param candidate Candidate surface to inspect.
 * @returns Stable invariant identifiers for every detected mismatch.
 * @example
 * ```ts
 * const failures = crossCheckDoomMainLoopPreLoopOrdering(candidate);
 * ```
 */
export function crossCheckDoomMainLoopPreLoopOrdering(candidate: DoomMainLoopPreLoopOrderingCandidate): readonly DoomMainLoopPreLoopOrderingInvariantIdentifier[] {
  const failures: DoomMainLoopPreLoopOrderingInvariantIdentifier[] = [];

  {
    const instance = candidate.create();
    if (instance.frameCount !== 0) {
      failures.push('MAIN_LOOP_PRELOOP_FRESH_INSTANCE_FRAME_COUNT_IS_ZERO');
    }
    if (instance.started) {
      failures.push('MAIN_LOOP_PRELOOP_FRESH_INSTANCE_NOT_STARTED');
    }
  }

  {
    const instance = candidate.create();
    const observedSteps: DoomMainLoopPreLoopStep[] = [];
    const startedDuringCallbacks: boolean[] = [];
    let setupCompleted = true;

    try {
      instance.setup({
        executeSetViewSize: () => {
          observedSteps.push('executeSetViewSize');
          startedDuringCallbacks.push(instance.started);
        },
        initialTryRunTics: () => {
          observedSteps.push('initialTryRunTics');
          startedDuringCallbacks.push(instance.started);
        },
        restoreBuffer: () => {
          observedSteps.push('restoreBuffer');
          startedDuringCallbacks.push(instance.started);
        },
        startGameLoop: () => {
          observedSteps.push('startGameLoop');
          startedDuringCallbacks.push(instance.started);
        },
      });
    } catch {
      setupCompleted = false;
    }

    let canonicalOrderMatches = setupCompleted && observedSteps.length === AUDITED_MAIN_LOOP_PRELOOP_STEPS.length;
    if (canonicalOrderMatches) {
      for (let stepIndex = 0; stepIndex < AUDITED_MAIN_LOOP_PRELOOP_STEPS.length; stepIndex++) {
        if (observedSteps[stepIndex] !== AUDITED_MAIN_LOOP_PRELOOP_STEPS[stepIndex]) {
          canonicalOrderMatches = false;
          break;
        }
      }
    }
    if (!canonicalOrderMatches) {
      failures.push('MAIN_LOOP_PRELOOP_SETUP_RUNS_CANONICAL_ORDER');
    }

    const observedUniqueSteps = new Set<DoomMainLoopPreLoopStep>(observedSteps);
    if (!setupCompleted || observedSteps.length !== AUDITED_MAIN_LOOP_PRELOOP_STEP_COUNT || observedUniqueSteps.size !== AUDITED_MAIN_LOOP_PRELOOP_STEP_COUNT) {
      failures.push('MAIN_LOOP_PRELOOP_SETUP_RUNS_EACH_STEP_ONCE');
    }

    let startedAfterCallbacks = setupCompleted && instance.started;
    for (const startedDuringCallback of startedDuringCallbacks) {
      if (startedDuringCallback) {
        startedAfterCallbacks = false;
        break;
      }
    }
    if (!startedAfterCallbacks) {
      failures.push('MAIN_LOOP_PRELOOP_SETUP_MARKS_STARTED_AFTER_CALLBACKS');
    }

    if (setupCompleted && instance.frameCount !== 0) {
      failures.push('MAIN_LOOP_PRELOOP_SETUP_DOES_NOT_ADVANCE_FRAME_COUNT');
    }
  }

  {
    const instance = candidate.create();
    let firstSetupCompleted = false;
    let secondSetupRejected = false;
    const callbacks: DoomMainLoopPreLoopCallbacks = {
      executeSetViewSize: () => {},
      initialTryRunTics: () => {},
      restoreBuffer: () => {},
      startGameLoop: () => {},
    };

    try {
      instance.setup(callbacks);
      firstSetupCompleted = true;
      instance.setup(callbacks);
    } catch {
      if (firstSetupCompleted) {
        secondSetupRejected = true;
      }
    }

    if (!secondSetupRejected) {
      failures.push('MAIN_LOOP_PRELOOP_SETUP_REJECTS_SECOND_CALL');
    }
  }

  return failures;
}
