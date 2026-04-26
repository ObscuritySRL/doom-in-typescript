import { describe, expect, test } from 'bun:test';

import { MAIN_LOOP_PHASE_COUNT, MAIN_LOOP_PHASES } from '../../../src/mainLoop.ts';
import { TicAccumulator } from '../../../src/host/ticAccumulator.ts';
import { ADD_TIMING_INSTRUMENTATION_CONTRACT, addTimingInstrumentation } from '../../../src/playable/real-time-main-loop/addTimingInstrumentation.ts';

import type { MainLoopPhase } from '../../../src/mainLoop.ts';
import type { TicClock } from '../../../src/host/ticAccumulator.ts';
import type { TimingInstrumentationSample } from '../../../src/playable/real-time-main-loop/addTimingInstrumentation.ts';

interface PlayableHostManifest {
  readonly currentLauncherHostTransition: {
    readonly call: string;
  };
}

function hashContract(): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(JSON.stringify(ADD_TIMING_INSTRUMENTATION_CONTRACT));
  return hasher.digest('hex');
}

describe('ADD_TIMING_INSTRUMENTATION_CONTRACT', () => {
  test('locks the exact Bun-only timing instrumentation contract', () => {
    const expectedContract = {
      deterministicReplayCompatibility: 'Observer-only timing instrumentation records phase durations without advancing, resetting, or interpolating tic timing.',
      hostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      instrumentationBoundary: 'MainLoop.runOneFrame',
      phaseCount: 4,
      phaseMetricFields: ['frameIndex', 'phase', 'phaseDurationNanoseconds', 'phaseEndNanoseconds', 'phaseStartNanoseconds', 'totalTics'],
      phaseOrder: ['startFrame', 'tryRunTics', 'updateSounds', 'display'],
      playableHostManifestPath: 'plan_fps/manifests/01-006-audit-playable-host-surface.json',
      runtimeCommand: 'bun run doom.ts',
      ticAuthority: 'TicAccumulator.totalTics',
      ticAuthorityPath: 'src/host/ticAccumulator.ts',
      timingPrimitive: 'Bun.nanoseconds',
      timingRule: 'phaseDurationNanoseconds = phaseEndNanoseconds - phaseStartNanoseconds',
    } satisfies typeof ADD_TIMING_INSTRUMENTATION_CONTRACT;

    expect(ADD_TIMING_INSTRUMENTATION_CONTRACT).toEqual(expectedContract);
  });

  test('keeps a stable contract hash', () => {
    expect(hashContract()).toBe('23a2b41226b290114dc09c2f0a4f5ddf84626168163a5c2feb738a154d624a17');
  });

  test('matches the live main-loop and playable-host evidence', async () => {
    const manifest: PlayableHostManifest = await Bun.file(ADD_TIMING_INSTRUMENTATION_CONTRACT.playableHostManifestPath).json();

    expect(manifest.currentLauncherHostTransition.call).toBe(ADD_TIMING_INSTRUMENTATION_CONTRACT.hostTransition);
    expect(ADD_TIMING_INSTRUMENTATION_CONTRACT.instrumentationBoundary).toBe('MainLoop.runOneFrame');
    expect(ADD_TIMING_INSTRUMENTATION_CONTRACT.phaseCount).toBe(MAIN_LOOP_PHASE_COUNT);
    expect(ADD_TIMING_INSTRUMENTATION_CONTRACT.phaseOrder).toEqual(MAIN_LOOP_PHASES);
  });
});

describe('addTimingInstrumentation', () => {
  test('records an observer-only phase sample from tic snapshots', () => {
    let counter = 0n;
    const clock: TicClock = {
      frequency: 350n,
      now: () => counter,
    };
    const ticAccumulator = new TicAccumulator(clock);

    counter = 70n;
    expect(ticAccumulator.advance()).toBe(7);
    expect(ticAccumulator.totalTics).toBe(7);

    const sample = addTimingInstrumentation({
      frameIndex: 12,
      phase: 'tryRunTics',
      phaseEndNanoseconds: 1_275n,
      phaseStartNanoseconds: 1_000n,
      runtimeCommand: 'bun run doom.ts',
      ticSource: ticAccumulator,
    });
    const expectedSample = {
      frameIndex: 12,
      phase: 'tryRunTics',
      phaseDurationNanoseconds: 275n,
      phaseEndNanoseconds: 1_275n,
      phaseStartNanoseconds: 1_000n,
      totalTics: 7,
    } satisfies TimingInstrumentationSample;

    expect(Object.isFrozen(sample)).toBe(true);
    expect(sample).toEqual(expectedSample);
    expect(ticAccumulator.totalTics).toBe(7);
  });

  test('rejects non-doom runtime commands', () => {
    expect(() =>
      addTimingInstrumentation({
        frameIndex: 0,
        phase: 'display',
        phaseEndNanoseconds: 2n,
        phaseStartNanoseconds: 1n,
        runtimeCommand: 'bun run src/main.ts',
        ticSource: { totalTics: 0 },
      }),
    ).toThrow('addTimingInstrumentation requires bun run doom.ts');
  });

  test('rejects negative phase durations', () => {
    expect(() =>
      addTimingInstrumentation({
        frameIndex: 0,
        phase: 'display',
        phaseEndNanoseconds: 4n,
        phaseStartNanoseconds: 5n,
        runtimeCommand: 'bun run doom.ts',
        ticSource: { totalTics: 0 },
      }),
    ).toThrow('phaseEndNanoseconds must be greater than or equal to phaseStartNanoseconds');
  });

  test('produces a frozen sample for every D_DoomLoop phase', () => {
    const ticSource = { totalTics: 9 };

    for (const phase of MAIN_LOOP_PHASES) {
      const sample = addTimingInstrumentation({
        frameIndex: 41,
        phase,
        phaseEndNanoseconds: 200n,
        phaseStartNanoseconds: 100n,
        runtimeCommand: 'bun run doom.ts',
        ticSource,
      });

      expect(Object.isFrozen(sample)).toBe(true);
      expect(sample).toEqual({
        frameIndex: 41,
        phase,
        phaseDurationNanoseconds: 100n,
        phaseEndNanoseconds: 200n,
        phaseStartNanoseconds: 100n,
        totalTics: 9,
      });
    }
  });

  test('accepts zero-duration samples when start equals end', () => {
    const sample = addTimingInstrumentation({
      frameIndex: 5,
      phase: 'startFrame',
      phaseEndNanoseconds: 1_000n,
      phaseStartNanoseconds: 1_000n,
      runtimeCommand: 'bun run doom.ts',
      ticSource: { totalTics: 3 },
    });

    expect(sample.phaseDurationNanoseconds).toBe(0n);
    expect(sample.phaseEndNanoseconds).toBe(1_000n);
    expect(sample.phaseStartNanoseconds).toBe(1_000n);
    expect(sample.totalTics).toBe(3);
  });

  test('rejects unknown phase values bypassed via type cast', () => {
    const invalidPhase: string = 'unknownPhase';

    expect(() =>
      addTimingInstrumentation({
        frameIndex: 0,
        phase: invalidPhase as MainLoopPhase,
        phaseEndNanoseconds: 200n,
        phaseStartNanoseconds: 100n,
        runtimeCommand: 'bun run doom.ts',
        ticSource: { totalTics: 0 },
      }),
    ).toThrow('Unknown main loop phase: unknownPhase');
  });
});
