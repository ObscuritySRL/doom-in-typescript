import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { MAIN_LOOP_PHASES } from '../../../src/mainLoop.ts';
import { TICS_PER_SECOND } from '../../../src/host/ticAccumulator.ts';
import { PREVENT_FRAME_RATE_DEPENDENT_SIMULATION_CONTRACT, preventFrameRateDependentSimulation } from '../../../src/playable/real-time-main-loop/preventFrameRateDependentSimulation.ts';

describe('preventFrameRateDependentSimulation', () => {
  test('locks the exact contract surface', () => {
    expect(PREVENT_FRAME_RATE_DEPENDENT_SIMULATION_CONTRACT).toEqual({
      accumulationAuthority: {
        accumulatorMethod: 'advance',
        accumulatorProperty: 'totalTics',
        accumulationRule: 'integer-only floor((delta * 35) / frequency)',
        fixedTicRate: 35,
        source: 'src/host/ticAccumulator.ts',
      },
      auditedLauncherTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      deterministicReplayCompatible: true,
      frameRateIndependent: true,
      ignoredInput: 'presentedFramesSinceLastSimulation',
      mainLoopPhase: 'tryRunTics',
      manifestPath: 'plan_fps/manifests/01-006-audit-playable-host-surface.json',
      runtimeCommand: 'bun run doom.ts',
      simulationRule: 'advance-simulation-by-runnable-tics-only',
    });
  });

  test('keeps a stable serialized contract hash', () => {
    const serializedContract = JSON.stringify(PREVENT_FRAME_RATE_DEPENDENT_SIMULATION_CONTRACT);
    const contractHash = createHash('sha256').update(serializedContract).digest('hex');

    expect(contractHash).toBe('0c36dd1873d490eac37e68555e83966c5001b15de64806e7b15d5c8413218b04');
  });

  test('anchors the live main-loop and tic-accumulator evidence', () => {
    expect(PREVENT_FRAME_RATE_DEPENDENT_SIMULATION_CONTRACT.mainLoopPhase).toBe(MAIN_LOOP_PHASES[1]);
    expect(PREVENT_FRAME_RATE_DEPENDENT_SIMULATION_CONTRACT.accumulationAuthority.fixedTicRate).toBe(TICS_PER_SECOND);
    expect(PREVENT_FRAME_RATE_DEPENDENT_SIMULATION_CONTRACT.auditedLauncherTransition).toBe('runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })');
  });

  test('advances simulation from runnable tics instead of presentation frames', () => {
    const firstResult = preventFrameRateDependentSimulation({
      mainLoopPhase: 'tryRunTics',
      presentedFramesSinceLastSimulation: 1,
      runnableTics: 3,
      runtimeCommand: 'bun run doom.ts',
      totalTics: 41,
    });
    const secondResult = preventFrameRateDependentSimulation({
      mainLoopPhase: 'tryRunTics',
      presentedFramesSinceLastSimulation: 240,
      runnableTics: 3,
      runtimeCommand: 'bun run doom.ts',
      totalTics: 41,
    });

    expect(firstResult).toEqual({
      deterministicReplayCompatible: true,
      frameRateIndependent: true,
      mainLoopPhase: 'tryRunTics',
      simulationTics: 3,
      totalTics: 41,
    });
    expect(secondResult).toEqual(firstResult);
  });

  test('returns a no-op outside tryRunTics', () => {
    expect(
      preventFrameRateDependentSimulation({
        mainLoopPhase: 'display',
        presentedFramesSinceLastSimulation: 240,
        runnableTics: 9,
        runtimeCommand: 'bun run doom.ts',
        totalTics: 41,
      }),
    ).toEqual({
      deterministicReplayCompatible: true,
      frameRateIndependent: true,
      mainLoopPhase: 'display',
      simulationTics: 0,
      totalTics: 41,
    });
  });

  test('rejects any runtime command other than bun run doom.ts', () => {
    expect(() =>
      preventFrameRateDependentSimulation({
        mainLoopPhase: MAIN_LOOP_PHASES[1],
        presentedFramesSinceLastSimulation: 1,
        runnableTics: 1,
        runtimeCommand: 'bun run src/main.ts',
        totalTics: 1,
      }),
    ).toThrow('preventFrameRateDependentSimulation requires bun run doom.ts');
  });
});
