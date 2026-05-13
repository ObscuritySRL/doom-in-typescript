/**
 * Audited guard against frame-rate-dependent simulation.
 *
 * The canonical D_DoomLoop frame path runs I_StartFrame, TryRunTics,
 * S_UpdateSounds, and D_Display. Simulation advances only inside the
 * TryRunTics-owned tic path; display frames may run zero simulation
 * tics, one simulation tic, or many simulation tics depending on the
 * accumulated 35 Hz game clock. Render-frame duration is therefore
 * an observation for pacing, not an input that creates game tics here.
 */

/** Stable identifier for one frame-rate-independence invariant. */
export type DoomFrameRateIndependentSimulationInvariantIdentifier =
  | 'FRAME_RATE_INDEPENDENT_DISPLAY_FRAME_COUNT_ADVANCES_ON_ZERO_TIC_FRAME'
  | 'FRAME_RATE_INDEPENDENT_FRESH_DISPLAY_FRAME_COUNT_IS_ZERO'
  | 'FRAME_RATE_INDEPENDENT_FRESH_SIMULATION_TIC_COUNT_IS_ZERO'
  | 'FRAME_RATE_INDEPENDENT_REJECTS_FRACTIONAL_AVAILABLE_TICS'
  | 'FRAME_RATE_INDEPENDENT_REJECTS_NEGATIVE_AVAILABLE_TICS'
  | 'FRAME_RATE_INDEPENDENT_RENDER_ELAPSED_MILLISECONDS_DO_NOT_CREATE_TICS'
  | 'FRAME_RATE_INDEPENDENT_RUNS_ALL_AVAILABLE_TICS_BEFORE_DISPLAY'
  | 'FRAME_RATE_INDEPENDENT_RUNS_MULTIPLE_TICS_IN_ONE_DISPLAY_FRAME'
  | 'FRAME_RATE_INDEPENDENT_RUNS_ZERO_TICS_WHEN_NONE_ARE_AVAILABLE'
  | 'FRAME_RATE_INDEPENDENT_SIMULATION_TIC_COUNT_EQUALS_AVAILABLE_TIC_SUM';

/** One pinned invariant that rejects frame-rate-dependent simulation. */
export interface DoomFrameRateIndependentSimulationInvariant {
  /** Plain-language description of the invariant. */
  readonly description: string;
  /** Stable cross-check identifier. */
  readonly identifier: DoomFrameRateIndependentSimulationInvariantIdentifier;
}

/** Pinned invariants that define the frame-rate-independent simulation contract. */
export const DOOM_FRAME_RATE_INDEPENDENT_SIMULATION_INVARIANTS: readonly DoomFrameRateIndependentSimulationInvariant[] = Object.freeze([
  {
    description: 'A display frame with zero available game tics still advances the display-frame counter once.',
    identifier: 'FRAME_RATE_INDEPENDENT_DISPLAY_FRAME_COUNT_ADVANCES_ON_ZERO_TIC_FRAME',
  },
  {
    description: 'A fresh frame scheduler has displayFrameCount === 0.',
    identifier: 'FRAME_RATE_INDEPENDENT_FRESH_DISPLAY_FRAME_COUNT_IS_ZERO',
  },
  {
    description: 'A fresh frame scheduler has simulationTicCount === 0.',
    identifier: 'FRAME_RATE_INDEPENDENT_FRESH_SIMULATION_TIC_COUNT_IS_ZERO',
  },
  {
    description: 'The available game tic count is an integer; fractional render deltas cannot become fractional simulation steps.',
    identifier: 'FRAME_RATE_INDEPENDENT_REJECTS_FRACTIONAL_AVAILABLE_TICS',
  },
  {
    description: 'The available game tic count is non-negative.',
    identifier: 'FRAME_RATE_INDEPENDENT_REJECTS_NEGATIVE_AVAILABLE_TICS',
  },
  {
    description: 'Elapsed render milliseconds do not create simulation tics when TryRunTics made none available.',
    identifier: 'FRAME_RATE_INDEPENDENT_RENDER_ELAPSED_MILLISECONDS_DO_NOT_CREATE_TICS',
  },
  {
    description: 'All available simulation tics run before the display callback for that frame.',
    identifier: 'FRAME_RATE_INDEPENDENT_RUNS_ALL_AVAILABLE_TICS_BEFORE_DISPLAY',
  },
  {
    description: 'A single display frame may run multiple available simulation tics.',
    identifier: 'FRAME_RATE_INDEPENDENT_RUNS_MULTIPLE_TICS_IN_ONE_DISPLAY_FRAME',
  },
  {
    description: 'A display frame with zero available game tics runs zero simulation callbacks.',
    identifier: 'FRAME_RATE_INDEPENDENT_RUNS_ZERO_TICS_WHEN_NONE_ARE_AVAILABLE',
  },
  {
    description: 'Cumulative simulation tic count equals the sum of TryRunTics-provided available tics, not display-frame count.',
    identifier: 'FRAME_RATE_INDEPENDENT_SIMULATION_TIC_COUNT_EQUALS_AVAILABLE_TIC_SUM',
  },
] as const);

/** Callback surface invoked by the audited frame scheduler. */
export interface DoomFrameRateIndependentSimulationCallbacks {
  /** D_Display equivalent. */
  display(): void;
  /** M_Ticker + G_Ticker + gametic++ equivalent for one available game tic. */
  runSimulationTic(simulationTicCountBeforeIncrement: number): void;
}

/** Input for one display-frame scheduler call. */
export interface DoomFrameRateIndependentSimulationFrameInput {
  /** Elapsed wall-clock time since the previous rendered frame, retained only to prove it does not mint game tics. */
  readonly elapsedRenderMilliseconds: number;
  /** Number of game tics made available by the 35 Hz TryRunTics path for this display frame. */
  readonly simulationTics: number;
}

/** Candidate surface for cross-checking frame-rate-independent simulation. */
export interface DoomFrameRateIndependentSimulationCandidate {
  /** Factory that returns a fresh candidate instance. */
  readonly create: () => DoomFrameRateIndependentSimulationCandidateInstance;
}

/** One candidate instance that can schedule simulation tics for display frames. */
export interface DoomFrameRateIndependentSimulationCandidateInstance {
  /** Number of completed display-frame iterations. */
  readonly displayFrameCount: number;
  /**
   * Run one display-frame scheduler iteration.
   *
   * @param input Available simulation tics and the observed render-frame duration.
   * @param callbacks Callbacks for simulation tics and display.
   * @returns Number of simulation tics run for this display frame.
   * @example
   * ```ts
   * instance.runFrame({ elapsedRenderMilliseconds: 16, simulationTics: 0 }, callbacks);
   * ```
   */
  runFrame(input: DoomFrameRateIndependentSimulationFrameInput, callbacks: DoomFrameRateIndependentSimulationCallbacks): number;
  /** Number of completed simulation tic iterations. */
  readonly simulationTicCount: number;
}

/**
 * Reference candidate used by the focused parity cross-check.
 *
 * @example
 * ```ts
 * const instance = DOOM_FRAME_RATE_INDEPENDENT_SIMULATION_REFERENCE_CANDIDATE.create();
 * instance.runFrame({ elapsedRenderMilliseconds: 16, simulationTics: 2 }, callbacks);
 * ```
 */
export const DOOM_FRAME_RATE_INDEPENDENT_SIMULATION_REFERENCE_CANDIDATE: DoomFrameRateIndependentSimulationCandidate = Object.freeze({
  create: (): DoomFrameRateIndependentSimulationCandidateInstance => {
    let displayFrameCount = 0;
    let simulationTicCount = 0;

    return {
      get displayFrameCount(): number {
        return displayFrameCount;
      },
      runFrame(input: DoomFrameRateIndependentSimulationFrameInput, callbacks: DoomFrameRateIndependentSimulationCallbacks): number {
        if (!Number.isFinite(input.elapsedRenderMilliseconds) || input.elapsedRenderMilliseconds < 0) {
          throw new RangeError('elapsedRenderMilliseconds must be a finite non-negative number');
        }
        if (!Number.isInteger(input.simulationTics)) {
          throw new RangeError('simulationTics must be an integer');
        }
        if (input.simulationTics < 0) {
          throw new RangeError('simulationTics must be non-negative');
        }

        for (let simulationTicIndex = 0; simulationTicIndex < input.simulationTics; simulationTicIndex++) {
          callbacks.runSimulationTic(simulationTicCount);
          simulationTicCount++;
        }

        callbacks.display();
        displayFrameCount++;
        return input.simulationTics;
      },
      get simulationTicCount(): number {
        return simulationTicCount;
      },
    };
  },
});

/**
 * Cross-check a candidate against the pinned frame-rate-independent
 * simulation invariants.
 *
 * @param candidate Candidate surface to inspect.
 * @returns Stable invariant identifiers for every detected mismatch.
 * @example
 * ```ts
 * const failures = crossCheckDoomFrameRateIndependentSimulation(candidate);
 * ```
 */
export function crossCheckDoomFrameRateIndependentSimulation(candidate: DoomFrameRateIndependentSimulationCandidate): readonly DoomFrameRateIndependentSimulationInvariantIdentifier[] {
  const failures: DoomFrameRateIndependentSimulationInvariantIdentifier[] = [];

  {
    const instance = candidate.create();
    if (instance.displayFrameCount !== 0) {
      failures.push('FRAME_RATE_INDEPENDENT_FRESH_DISPLAY_FRAME_COUNT_IS_ZERO');
    }
    if (instance.simulationTicCount !== 0) {
      failures.push('FRAME_RATE_INDEPENDENT_FRESH_SIMULATION_TIC_COUNT_IS_ZERO');
    }
  }

  {
    const instance = candidate.create();
    let displayCallbackCount = 0;
    let frameCompleted = true;
    let returnedSimulationTics = -1;
    let simulationCallbackCount = 0;

    try {
      returnedSimulationTics = instance.runFrame(
        { elapsedRenderMilliseconds: 16, simulationTics: 0 },
        {
          display: () => {
            displayCallbackCount++;
          },
          runSimulationTic: () => {
            simulationCallbackCount++;
          },
        },
      );
    } catch {
      frameCompleted = false;
    }

    if (!frameCompleted || returnedSimulationTics !== 0 || simulationCallbackCount !== 0 || instance.simulationTicCount !== 0) {
      failures.push('FRAME_RATE_INDEPENDENT_RUNS_ZERO_TICS_WHEN_NONE_ARE_AVAILABLE');
    }
    if (!frameCompleted || displayCallbackCount !== 1 || instance.displayFrameCount !== 1) {
      failures.push('FRAME_RATE_INDEPENDENT_DISPLAY_FRAME_COUNT_ADVANCES_ON_ZERO_TIC_FRAME');
    }
  }

  {
    const instance = candidate.create();
    const observedEvents: string[] = [];
    const observedSimulationTics: number[] = [];
    let frameCompleted = true;
    let returnedSimulationTics = -1;

    try {
      returnedSimulationTics = instance.runFrame(
        { elapsedRenderMilliseconds: 200, simulationTics: 3 },
        {
          display: () => {
            observedEvents.push('display');
          },
          runSimulationTic: (simulationTicCountBeforeIncrement: number) => {
            observedEvents.push(`simulation:${simulationTicCountBeforeIncrement}`);
            observedSimulationTics.push(simulationTicCountBeforeIncrement);
          },
        },
      );
    } catch {
      frameCompleted = false;
    }

    const expectedEvents = ['simulation:0', 'simulation:1', 'simulation:2', 'display'];
    let eventsMatch = frameCompleted && observedEvents.length === expectedEvents.length;
    if (eventsMatch) {
      for (let eventIndex = 0; eventIndex < expectedEvents.length; eventIndex++) {
        if (observedEvents[eventIndex] !== expectedEvents[eventIndex]) {
          eventsMatch = false;
          break;
        }
      }
    }
    if (!eventsMatch) {
      failures.push('FRAME_RATE_INDEPENDENT_RUNS_ALL_AVAILABLE_TICS_BEFORE_DISPLAY');
    }

    if (!frameCompleted || returnedSimulationTics !== 3 || observedSimulationTics.length !== 3 || instance.simulationTicCount !== 3 || instance.displayFrameCount !== 1) {
      failures.push('FRAME_RATE_INDEPENDENT_RUNS_MULTIPLE_TICS_IN_ONE_DISPLAY_FRAME');
    }
  }

  {
    const instance = candidate.create();
    const frameInputs: readonly DoomFrameRateIndependentSimulationFrameInput[] = [
      { elapsedRenderMilliseconds: 1000, simulationTics: 0 },
      { elapsedRenderMilliseconds: 1, simulationTics: 2 },
      { elapsedRenderMilliseconds: 33, simulationTics: 1 },
      { elapsedRenderMilliseconds: 250, simulationTics: 0 },
      { elapsedRenderMilliseconds: 16, simulationTics: 5 },
    ];
    let frameCompleted = true;
    let returnedSimulationTicSum = 0;
    let expectedSimulationTicSum = 0;

    try {
      for (const frameInput of frameInputs) {
        returnedSimulationTicSum += instance.runFrame(frameInput, {
          display: () => {},
          runSimulationTic: () => {},
        });
        expectedSimulationTicSum += frameInput.simulationTics;
      }
    } catch {
      frameCompleted = false;
    }

    if (!frameCompleted || returnedSimulationTicSum !== expectedSimulationTicSum || instance.simulationTicCount !== expectedSimulationTicSum || instance.displayFrameCount !== frameInputs.length) {
      failures.push('FRAME_RATE_INDEPENDENT_SIMULATION_TIC_COUNT_EQUALS_AVAILABLE_TIC_SUM');
    }
  }

  {
    const instance = candidate.create();
    let displayCallbackCount = 0;
    let frameCompleted = true;
    let returnedSimulationTics = -1;
    let simulationCallbackCount = 0;

    try {
      returnedSimulationTics = instance.runFrame(
        { elapsedRenderMilliseconds: 1000, simulationTics: 0 },
        {
          display: () => {
            displayCallbackCount++;
          },
          runSimulationTic: () => {
            simulationCallbackCount++;
          },
        },
      );
    } catch {
      frameCompleted = false;
    }

    if (!frameCompleted || returnedSimulationTics !== 0 || simulationCallbackCount !== 0 || instance.simulationTicCount !== 0 || displayCallbackCount !== 1) {
      failures.push('FRAME_RATE_INDEPENDENT_RENDER_ELAPSED_MILLISECONDS_DO_NOT_CREATE_TICS');
    }
  }

  {
    const instance = candidate.create();
    let rejectedNegativeSimulationTics = false;

    try {
      instance.runFrame(
        { elapsedRenderMilliseconds: 16, simulationTics: -1 },
        {
          display: () => {},
          runSimulationTic: () => {},
        },
      );
    } catch {
      rejectedNegativeSimulationTics = true;
    }

    if (!rejectedNegativeSimulationTics) {
      failures.push('FRAME_RATE_INDEPENDENT_REJECTS_NEGATIVE_AVAILABLE_TICS');
    }
  }

  {
    const instance = candidate.create();
    let rejectedFractionalSimulationTics = false;

    try {
      instance.runFrame(
        { elapsedRenderMilliseconds: 16, simulationTics: 1.5 },
        {
          display: () => {},
          runSimulationTic: () => {},
        },
      );
    } catch {
      rejectedFractionalSimulationTics = true;
    }

    if (!rejectedFractionalSimulationTics) {
      failures.push('FRAME_RATE_INDEPENDENT_REJECTS_FRACTIONAL_AVAILABLE_TICS');
    }
  }

  return failures;
}
