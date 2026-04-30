/**
 * Audited D_DoomLoop per-frame phase identifier.
 *
 * The canonical frame-loop order is:
 * `startFrame` -> `tryRunTics` -> `updateSounds` -> `display`.
 */
export type DoomMainLoopPerFramePhase = 'display' | 'startFrame' | 'tryRunTics' | 'updateSounds';

/** Audited count of per-frame D_DoomLoop phases. */
export const AUDITED_MAIN_LOOP_PER_FRAME_PHASE_COUNT = 4;

/**
 * Audited D_DoomLoop per-frame sequence, pinned independently of the
 * runtime `MainLoop` constants so runtime ordering drift fails loudly.
 */
export const AUDITED_MAIN_LOOP_PER_FRAME_PHASES: readonly DoomMainLoopPerFramePhase[] = Object.freeze(['startFrame', 'tryRunTics', 'updateSounds', 'display']);

/** Stable identifier for one D_DoomLoop per-frame invariant. */
export type DoomMainLoopPerFrameOrderingInvariantIdentifier =
  | 'MAIN_LOOP_PER_FRAME_ADVANCES_FRAME_COUNT_ONCE_PER_FRAME'
  | 'MAIN_LOOP_PER_FRAME_FRESH_INSTANCE_FRAME_COUNT_IS_ZERO'
  | 'MAIN_LOOP_PER_FRAME_FRESH_INSTANCE_NOT_STARTED'
  | 'MAIN_LOOP_PER_FRAME_INCREMENTS_FRAME_COUNT_AFTER_CALLBACKS'
  | 'MAIN_LOOP_PER_FRAME_REJECTS_RUN_BEFORE_SETUP'
  | 'MAIN_LOOP_PER_FRAME_REPEATS_ORDER_EACH_FRAME'
  | 'MAIN_LOOP_PER_FRAME_RUNS_CANONICAL_ORDER'
  | 'MAIN_LOOP_PER_FRAME_RUNS_EACH_PHASE_ONCE';

/** One pinned D_DoomLoop per-frame invariant. */
export interface DoomMainLoopPerFrameOrderingInvariant {
  /** Plain-language description of the invariant. */
  readonly description: string;
  /** Stable cross-check identifier. */
  readonly identifier: DoomMainLoopPerFrameOrderingInvariantIdentifier;
}

/** Pinned invariants that define the local D_DoomLoop per-frame contract. */
export const DOOM_MAIN_LOOP_PER_FRAME_ORDERING_INVARIANTS: readonly DoomMainLoopPerFrameOrderingInvariant[] = Object.freeze([
  {
    description: 'A completed frame advances frameCount by exactly one.',
    identifier: 'MAIN_LOOP_PER_FRAME_ADVANCES_FRAME_COUNT_ONCE_PER_FRAME',
  },
  {
    description: 'A fresh main-loop instance has frameCount === 0 before setup.',
    identifier: 'MAIN_LOOP_PER_FRAME_FRESH_INSTANCE_FRAME_COUNT_IS_ZERO',
  },
  {
    description: 'A fresh main-loop instance is not started before setup.',
    identifier: 'MAIN_LOOP_PER_FRAME_FRESH_INSTANCE_NOT_STARTED',
  },
  {
    description: 'The per-frame loop increments frameCount only after all frame callbacks complete.',
    identifier: 'MAIN_LOOP_PER_FRAME_INCREMENTS_FRAME_COUNT_AFTER_CALLBACKS',
  },
  {
    description: 'The per-frame loop rejects a frame run before setup has completed.',
    identifier: 'MAIN_LOOP_PER_FRAME_REJECTS_RUN_BEFORE_SETUP',
  },
  {
    description: 'Multiple frame runs repeat the same canonical phase order for each frame.',
    identifier: 'MAIN_LOOP_PER_FRAME_REPEATS_ORDER_EACH_FRAME',
  },
  {
    description: 'Each frame runs I_StartFrame, TryRunTics, S_UpdateSounds, then D_Display.',
    identifier: 'MAIN_LOOP_PER_FRAME_RUNS_CANONICAL_ORDER',
  },
  {
    description: 'Each frame runs exactly the four canonical per-frame callbacks once each.',
    identifier: 'MAIN_LOOP_PER_FRAME_RUNS_EACH_PHASE_ONCE',
  },
] as const);

/** Callback surface invoked by the audited per-frame loop sequence. */
export interface DoomMainLoopPerFrameCallbacks {
  /** D_Display equivalent. */
  display(): void;
  /** I_StartFrame equivalent. */
  startFrame(): void;
  /** TryRunTics equivalent. */
  tryRunTics(): void;
  /** S_UpdateSounds equivalent. */
  updateSounds(): void;
}

/** Candidate surface for cross-checking D_DoomLoop per-frame ordering. */
export interface DoomMainLoopPerFrameOrderingCandidate {
  /** Factory that returns a fresh candidate instance. */
  readonly create: () => DoomMainLoopPerFrameOrderingCandidateInstance;
}

/** One candidate instance that can run the per-frame loop sequence. */
export interface DoomMainLoopPerFrameOrderingCandidateInstance {
  /** Number of completed frame-loop iterations. */
  readonly frameCount: number;
  /**
   * Execute the one-time setup boundary needed before frames may run.
   *
   * @returns Nothing.
   * @example
   * ```ts
   * instance.setup();
   * ```
   */
  setup(): void;
  /**
   * Run one per-frame loop iteration.
   *
   * @param callbacks Per-frame callbacks to invoke.
   * @returns Nothing.
   * @example
   * ```ts
   * instance.runOneFrame(frameCallbacks);
   * ```
   */
  runOneFrame(callbacks: DoomMainLoopPerFrameCallbacks): void;
  /** Whether setup has completed. */
  readonly started: boolean;
}

/**
 * Reference candidate used by the focused parity cross-check.
 *
 * @example
 * ```ts
 * const instance = DOOM_MAIN_LOOP_PER_FRAME_ORDERING_REFERENCE_CANDIDATE.create();
 * instance.setup();
 * ```
 */
export const DOOM_MAIN_LOOP_PER_FRAME_ORDERING_REFERENCE_CANDIDATE: DoomMainLoopPerFrameOrderingCandidate = Object.freeze({
  create: (): DoomMainLoopPerFrameOrderingCandidateInstance => {
    let frameCount = 0;
    let started = false;

    return {
      get frameCount(): number {
        return frameCount;
      },
      runOneFrame(callbacks: DoomMainLoopPerFrameCallbacks): void {
        if (!started) {
          throw new Error('Doom main-loop per-frame run called before setup');
        }

        callbacks.startFrame();
        callbacks.tryRunTics();
        callbacks.updateSounds();
        callbacks.display();
        frameCount++;
      },
      setup(): void {
        if (started) {
          throw new Error('Doom main-loop per-frame setup called more than once');
        }

        started = true;
      },
      get started(): boolean {
        return started;
      },
    };
  },
});

/**
 * Cross-check a D_DoomLoop per-frame candidate against the pinned
 * frame-order invariants.
 *
 * @param candidate Candidate surface to inspect.
 * @returns Stable invariant identifiers for every detected mismatch.
 * @example
 * ```ts
 * const failures = crossCheckDoomMainLoopPerFrameOrdering(candidate);
 * ```
 */
export function crossCheckDoomMainLoopPerFrameOrdering(candidate: DoomMainLoopPerFrameOrderingCandidate): readonly DoomMainLoopPerFrameOrderingInvariantIdentifier[] {
  const failures: DoomMainLoopPerFrameOrderingInvariantIdentifier[] = [];

  {
    const instance = candidate.create();
    if (instance.frameCount !== 0) {
      failures.push('MAIN_LOOP_PER_FRAME_FRESH_INSTANCE_FRAME_COUNT_IS_ZERO');
    }
    if (instance.started) {
      failures.push('MAIN_LOOP_PER_FRAME_FRESH_INSTANCE_NOT_STARTED');
    }
  }

  {
    const instance = candidate.create();
    let callbackCount = 0;
    let runRejected = false;

    try {
      instance.runOneFrame({
        display: () => {
          callbackCount++;
        },
        startFrame: () => {
          callbackCount++;
        },
        tryRunTics: () => {
          callbackCount++;
        },
        updateSounds: () => {
          callbackCount++;
        },
      });
    } catch {
      runRejected = true;
    }

    if (!runRejected || callbackCount !== 0 || instance.frameCount !== 0) {
      failures.push('MAIN_LOOP_PER_FRAME_REJECTS_RUN_BEFORE_SETUP');
    }
  }

  {
    const instance = candidate.create();
    const observedFrameCounts: number[] = [];
    const observedPhases: DoomMainLoopPerFramePhase[] = [];
    let frameCompleted = true;
    let setupCompleted = true;

    try {
      instance.setup();
    } catch {
      setupCompleted = false;
    }

    if (setupCompleted) {
      try {
        instance.runOneFrame({
          display: () => {
            observedPhases.push('display');
            observedFrameCounts.push(instance.frameCount);
          },
          startFrame: () => {
            observedPhases.push('startFrame');
            observedFrameCounts.push(instance.frameCount);
          },
          tryRunTics: () => {
            observedPhases.push('tryRunTics');
            observedFrameCounts.push(instance.frameCount);
          },
          updateSounds: () => {
            observedPhases.push('updateSounds');
            observedFrameCounts.push(instance.frameCount);
          },
        });
      } catch {
        frameCompleted = false;
      }
    } else {
      frameCompleted = false;
    }

    let canonicalOrderMatches = frameCompleted && observedPhases.length === AUDITED_MAIN_LOOP_PER_FRAME_PHASES.length;
    if (canonicalOrderMatches) {
      for (let phaseIndex = 0; phaseIndex < AUDITED_MAIN_LOOP_PER_FRAME_PHASES.length; phaseIndex++) {
        if (observedPhases[phaseIndex] !== AUDITED_MAIN_LOOP_PER_FRAME_PHASES[phaseIndex]) {
          canonicalOrderMatches = false;
          break;
        }
      }
    }
    if (!canonicalOrderMatches) {
      failures.push('MAIN_LOOP_PER_FRAME_RUNS_CANONICAL_ORDER');
    }

    const observedUniquePhases = new Set<DoomMainLoopPerFramePhase>(observedPhases);
    if (!frameCompleted || observedPhases.length !== AUDITED_MAIN_LOOP_PER_FRAME_PHASE_COUNT || observedUniquePhases.size !== AUDITED_MAIN_LOOP_PER_FRAME_PHASE_COUNT) {
      failures.push('MAIN_LOOP_PER_FRAME_RUNS_EACH_PHASE_ONCE');
    }

    let frameCountAdvancesAfterCallbacks = frameCompleted && instance.frameCount === 1;
    for (const observedFrameCount of observedFrameCounts) {
      if (observedFrameCount !== 0) {
        frameCountAdvancesAfterCallbacks = false;
        break;
      }
    }
    if (!frameCountAdvancesAfterCallbacks) {
      failures.push('MAIN_LOOP_PER_FRAME_INCREMENTS_FRAME_COUNT_AFTER_CALLBACKS');
    }
  }

  {
    const instance = candidate.create();
    const observedFramePhases: string[] = [];
    let framesCompleted = true;
    let setupCompleted = true;

    try {
      instance.setup();
    } catch {
      setupCompleted = false;
    }

    if (setupCompleted) {
      try {
        for (let frameIndex = 0; frameIndex < 2; frameIndex++) {
          instance.runOneFrame({
            display: () => {
              observedFramePhases.push(`display:${instance.frameCount}`);
            },
            startFrame: () => {
              observedFramePhases.push(`startFrame:${instance.frameCount}`);
            },
            tryRunTics: () => {
              observedFramePhases.push(`tryRunTics:${instance.frameCount}`);
            },
            updateSounds: () => {
              observedFramePhases.push(`updateSounds:${instance.frameCount}`);
            },
          });
        }
      } catch {
        framesCompleted = false;
      }
    } else {
      framesCompleted = false;
    }

    const expectedFramePhases = ['startFrame:0', 'tryRunTics:0', 'updateSounds:0', 'display:0', 'startFrame:1', 'tryRunTics:1', 'updateSounds:1', 'display:1'];
    let repeatedOrderMatches = framesCompleted && observedFramePhases.length === expectedFramePhases.length;
    if (repeatedOrderMatches) {
      for (let observedIndex = 0; observedIndex < expectedFramePhases.length; observedIndex++) {
        if (observedFramePhases[observedIndex] !== expectedFramePhases[observedIndex]) {
          repeatedOrderMatches = false;
          break;
        }
      }
    }
    if (!repeatedOrderMatches) {
      failures.push('MAIN_LOOP_PER_FRAME_REPEATS_ORDER_EACH_FRAME');
    }

    if (!framesCompleted || instance.frameCount !== 2) {
      failures.push('MAIN_LOOP_PER_FRAME_ADVANCES_FRAME_COUNT_ONCE_PER_FRAME');
    }
  }

  return failures;
}
