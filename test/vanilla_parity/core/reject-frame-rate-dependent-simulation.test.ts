import { describe, expect, test } from 'bun:test';

import { DOOM_FRAME_RATE_INDEPENDENT_SIMULATION_INVARIANTS, DOOM_FRAME_RATE_INDEPENDENT_SIMULATION_REFERENCE_CANDIDATE, crossCheckDoomFrameRateIndependentSimulation } from '../../../src/core/reject-frame-rate-dependent-simulation.ts';
import type { DoomFrameRateIndependentSimulationCandidate, DoomFrameRateIndependentSimulationInvariantIdentifier } from '../../../src/core/reject-frame-rate-dependent-simulation.ts';

describe('DOOM_FRAME_RATE_INDEPENDENT_SIMULATION_INVARIANTS', () => {
  test('pins the complete frame-rate-independent simulation contract', () => {
    const expectedIdentifiers: readonly DoomFrameRateIndependentSimulationInvariantIdentifier[] = [
      'FRAME_RATE_INDEPENDENT_DISPLAY_FRAME_COUNT_ADVANCES_ON_ZERO_TIC_FRAME',
      'FRAME_RATE_INDEPENDENT_FRESH_DISPLAY_FRAME_COUNT_IS_ZERO',
      'FRAME_RATE_INDEPENDENT_FRESH_SIMULATION_TIC_COUNT_IS_ZERO',
      'FRAME_RATE_INDEPENDENT_REJECTS_FRACTIONAL_AVAILABLE_TICS',
      'FRAME_RATE_INDEPENDENT_REJECTS_NEGATIVE_AVAILABLE_TICS',
      'FRAME_RATE_INDEPENDENT_RENDER_ELAPSED_MILLISECONDS_DO_NOT_CREATE_TICS',
      'FRAME_RATE_INDEPENDENT_RUNS_ALL_AVAILABLE_TICS_BEFORE_DISPLAY',
      'FRAME_RATE_INDEPENDENT_RUNS_MULTIPLE_TICS_IN_ONE_DISPLAY_FRAME',
      'FRAME_RATE_INDEPENDENT_RUNS_ZERO_TICS_WHEN_NONE_ARE_AVAILABLE',
      'FRAME_RATE_INDEPENDENT_SIMULATION_TIC_COUNT_EQUALS_AVAILABLE_TIC_SUM',
    ];

    expect(DOOM_FRAME_RATE_INDEPENDENT_SIMULATION_INVARIANTS.map((invariant) => invariant.identifier)).toEqual([...expectedIdentifiers]);
    expect(Object.isFrozen(DOOM_FRAME_RATE_INDEPENDENT_SIMULATION_INVARIANTS)).toBe(true);
  });
});

describe('DOOM_FRAME_RATE_INDEPENDENT_SIMULATION_REFERENCE_CANDIDATE', () => {
  test('runs zero simulation tics on a display frame with no available tics', () => {
    const instance = DOOM_FRAME_RATE_INDEPENDENT_SIMULATION_REFERENCE_CANDIDATE.create();
    let displayCallbackCount = 0;
    let simulationCallbackCount = 0;

    const returnedSimulationTics = instance.runFrame(
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

    expect(returnedSimulationTics).toBe(0);
    expect(simulationCallbackCount).toBe(0);
    expect(instance.simulationTicCount).toBe(0);
    expect(displayCallbackCount).toBe(1);
    expect(instance.displayFrameCount).toBe(1);
  });

  test('runs every available simulation tic before display', () => {
    const instance = DOOM_FRAME_RATE_INDEPENDENT_SIMULATION_REFERENCE_CANDIDATE.create();
    const observedEvents: string[] = [];

    const returnedSimulationTics = instance.runFrame(
      { elapsedRenderMilliseconds: 200, simulationTics: 4 },
      {
        display: () => {
          observedEvents.push('display');
        },
        runSimulationTic: (simulationTicCountBeforeIncrement: number) => {
          observedEvents.push(`simulation:${simulationTicCountBeforeIncrement}`);
        },
      },
    );

    expect(returnedSimulationTics).toBe(4);
    expect(observedEvents).toEqual(['simulation:0', 'simulation:1', 'simulation:2', 'simulation:3', 'display']);
    expect(instance.simulationTicCount).toBe(4);
    expect(instance.displayFrameCount).toBe(1);
  });

  test('rejects invalid available tic counts', () => {
    const instance = DOOM_FRAME_RATE_INDEPENDENT_SIMULATION_REFERENCE_CANDIDATE.create();
    const callbacks = {
      display: () => {},
      runSimulationTic: () => {},
    };

    expect(() => instance.runFrame({ elapsedRenderMilliseconds: 16, simulationTics: -1 }, callbacks)).toThrow(RangeError);
    expect(() => instance.runFrame({ elapsedRenderMilliseconds: 16, simulationTics: 1.5 }, callbacks)).toThrow(RangeError);
  });
});

describe('crossCheckDoomFrameRateIndependentSimulation', () => {
  test('accepts the reference candidate', () => {
    expect(crossCheckDoomFrameRateIndependentSimulation(DOOM_FRAME_RATE_INDEPENDENT_SIMULATION_REFERENCE_CANDIDATE)).toEqual([]);
  });

  test('rejects a candidate that advances one simulation tic per display frame', () => {
    const frameCountDrivenCandidate: DoomFrameRateIndependentSimulationCandidate = {
      create: () => {
        let displayFrameCount = 0;
        let simulationTicCount = 0;

        return {
          get displayFrameCount(): number {
            return displayFrameCount;
          },
          runFrame(_input, callbacks): number {
            callbacks.runSimulationTic(simulationTicCount);
            simulationTicCount++;
            callbacks.display();
            displayFrameCount++;
            return 1;
          },
          get simulationTicCount(): number {
            return simulationTicCount;
          },
        };
      },
    };

    const failures = crossCheckDoomFrameRateIndependentSimulation(frameCountDrivenCandidate);

    expect(failures).toContain('FRAME_RATE_INDEPENDENT_RUNS_ZERO_TICS_WHEN_NONE_ARE_AVAILABLE');
    expect(failures).toContain('FRAME_RATE_INDEPENDENT_SIMULATION_TIC_COUNT_EQUALS_AVAILABLE_TIC_SUM');
  });

  test('rejects a candidate that derives game tics from render-frame duration', () => {
    const elapsedMillisecondsDrivenCandidate: DoomFrameRateIndependentSimulationCandidate = {
      create: () => {
        let displayFrameCount = 0;
        let simulationTicCount = 0;

        return {
          get displayFrameCount(): number {
            return displayFrameCount;
          },
          runFrame(input, callbacks): number {
            const simulationTicsToRun = Math.floor((input.elapsedRenderMilliseconds * 35) / 1000);
            for (let simulationTicIndex = 0; simulationTicIndex < simulationTicsToRun; simulationTicIndex++) {
              callbacks.runSimulationTic(simulationTicCount);
              simulationTicCount++;
            }
            callbacks.display();
            displayFrameCount++;
            return simulationTicsToRun;
          },
          get simulationTicCount(): number {
            return simulationTicCount;
          },
        };
      },
    };

    const failures = crossCheckDoomFrameRateIndependentSimulation(elapsedMillisecondsDrivenCandidate);

    expect(failures).toContain('FRAME_RATE_INDEPENDENT_RENDER_ELAPSED_MILLISECONDS_DO_NOT_CREATE_TICS');
    expect(failures).toContain('FRAME_RATE_INDEPENDENT_SIMULATION_TIC_COUNT_EQUALS_AVAILABLE_TIC_SUM');
  });

  test('rejects a candidate that clamps multi-tic frames to one simulation tic', () => {
    const clampedMultiTicCandidate: DoomFrameRateIndependentSimulationCandidate = {
      create: () => {
        let displayFrameCount = 0;
        let simulationTicCount = 0;

        return {
          get displayFrameCount(): number {
            return displayFrameCount;
          },
          runFrame(input, callbacks): number {
            const simulationTicsToRun = input.simulationTics > 0 ? 1 : 0;
            for (let simulationTicIndex = 0; simulationTicIndex < simulationTicsToRun; simulationTicIndex++) {
              callbacks.runSimulationTic(simulationTicCount);
              simulationTicCount++;
            }
            callbacks.display();
            displayFrameCount++;
            return simulationTicsToRun;
          },
          get simulationTicCount(): number {
            return simulationTicCount;
          },
        };
      },
    };

    const failures = crossCheckDoomFrameRateIndependentSimulation(clampedMultiTicCandidate);

    expect(failures).toContain('FRAME_RATE_INDEPENDENT_RUNS_MULTIPLE_TICS_IN_ONE_DISPLAY_FRAME');
    expect(failures).toContain('FRAME_RATE_INDEPENDENT_SIMULATION_TIC_COUNT_EQUALS_AVAILABLE_TIC_SUM');
  });

  test('rejects a candidate that accepts invalid available tic counts', () => {
    const permissiveInvalidInputCandidate: DoomFrameRateIndependentSimulationCandidate = {
      create: () => {
        let displayFrameCount = 0;
        let simulationTicCount = 0;

        return {
          get displayFrameCount(): number {
            return displayFrameCount;
          },
          runFrame(input, callbacks): number {
            const simulationTicsToRun = Math.max(0, Math.trunc(input.simulationTics));
            for (let simulationTicIndex = 0; simulationTicIndex < simulationTicsToRun; simulationTicIndex++) {
              callbacks.runSimulationTic(simulationTicCount);
              simulationTicCount++;
            }
            callbacks.display();
            displayFrameCount++;
            return simulationTicsToRun;
          },
          get simulationTicCount(): number {
            return simulationTicCount;
          },
        };
      },
    };

    const failures = crossCheckDoomFrameRateIndependentSimulation(permissiveInvalidInputCandidate);

    expect(failures).toContain('FRAME_RATE_INDEPENDENT_REJECTS_FRACTIONAL_AVAILABLE_TICS');
    expect(failures).toContain('FRAME_RATE_INDEPENDENT_REJECTS_NEGATIVE_AVAILABLE_TICS');
  });
});
