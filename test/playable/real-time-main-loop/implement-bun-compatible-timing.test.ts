import { describe, expect, it } from 'bun:test';

import { BUN_COMPATIBLE_TIMING_CONTRACT, implementBunCompatibleTiming } from '../../../src/playable/real-time-main-loop/implementBunCompatibleTiming.ts';

const PLAYABLE_HOST_MANIFEST_PATH = new URL('../../../plan_fps/manifests/01-006-audit-playable-host-surface.json', import.meta.url);
const MAIN_LOOP_SOURCE_PATH = new URL('../../../src/mainLoop.ts', import.meta.url);
const TIC_ACCUMULATOR_SOURCE_PATH = new URL('../../../src/host/ticAccumulator.ts', import.meta.url);

describe('BUN_COMPATIBLE_TIMING_CONTRACT', () => {
  it('matches the locked timing contract', () => {
    expect(BUN_COMPATIBLE_TIMING_CONTRACT).toEqual({
      deterministicReplayCompatibility: 'Bun host timing is advisory only; TicAccumulator remains the absolute 35 Hz authority.',
      hostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      mainLoopPhaseOrder: ['startFrame', 'tryRunTics', 'updateSounds', 'display'],
      runtimeCommand: 'bun run doom.ts',
      ticArithmetic: 'floor((delta * 35) / frequency)',
      ticAuthority: 'TicAccumulator',
      ticRate: 35,
      ticTimingPhase: 'tryRunTics',
      timingApi: 'Bun.nanoseconds',
      waitApi: 'Bun.sleep',
    });
  });

  it('matches the locked contract sha256', () => {
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(JSON.stringify(BUN_COMPATIBLE_TIMING_CONTRACT));

    expect(hasher.digest('hex')).toBe('17b3c3622146fd2f2f8981945f1d2337ee1d62df7b3d81d07fe5fe3566df59e1');
  });

  it('matches the audited playable host transition', async () => {
    const manifest = JSON.parse(await Bun.file(PLAYABLE_HOST_MANIFEST_PATH).text()) as {
      currentLauncherHostTransition: {
        call: string;
      };
    };

    expect(manifest.currentLauncherHostTransition.call).toBe(BUN_COMPATIBLE_TIMING_CONTRACT.hostTransition);
  });

  it('matches the live main-loop and tic-accumulator timing evidence', async () => {
    const mainLoopSource = await Bun.file(MAIN_LOOP_SOURCE_PATH).text();
    const ticAccumulatorSource = await Bun.file(TIC_ACCUMULATOR_SOURCE_PATH).text();

    expect(mainLoopSource).toContain('callbacks.tryRunTics();');
    expect(ticAccumulatorSource).toContain('const totalTics = Number((delta * TICS_PER_SECOND_BIG) / this.#frequency);');
  });
});

describe('implementBunCompatibleTiming', () => {
  it('builds the Bun timing plan from a sampled baseline', () => {
    let sampleCount = 0;

    const plan = implementBunCompatibleTiming('bun run doom.ts', () => {
      sampleCount++;
      return 123_456_789;
    });

    expect(sampleCount).toBe(1);
    expect(plan).toEqual({
      baselineNanoseconds: 123_456_789,
      deterministicReplayCompatible: true,
      hostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      mainLoopPhaseOrder: ['startFrame', 'tryRunTics', 'updateSounds', 'display'],
      nanosecondsPerTic: 28_571_428,
      nextTicDeadlineNanoseconds: 152_028_217,
      runtimeCommand: 'bun run doom.ts',
      ticArithmetic: 'floor((delta * 35) / frequency)',
      ticAuthority: 'TicAccumulator',
      ticRate: 35,
      ticTimingPhase: 'tryRunTics',
      timingApi: 'Bun.nanoseconds',
      waitApi: 'Bun.sleep',
    });
  });

  it('rejects non-Bun runtime commands before sampling time', () => {
    let sampleCalled = false;

    expect(() =>
      implementBunCompatibleTiming('bun run src/main.ts', () => {
        sampleCalled = true;
        return 0;
      }),
    ).toThrow('implementBunCompatibleTiming requires bun run doom.ts');
    expect(sampleCalled).toBe(false);
  });
});
