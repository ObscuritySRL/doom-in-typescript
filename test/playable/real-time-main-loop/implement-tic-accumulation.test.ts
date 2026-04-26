import { describe, expect, test } from 'bun:test';

import { MAIN_LOOP_PHASES } from '../../../src/mainLoop.ts';
import { TICS_PER_SECOND, TicAccumulator, type TicClock } from '../../../src/host/ticAccumulator.ts';
import { IMPLEMENT_TIC_ACCUMULATION_CONTRACT, implementTicAccumulation } from '../../../src/playable/real-time-main-loop/implementTicAccumulation.ts';

const HOST_SURFACE_MANIFEST_PATH = new URL('../../../plan_fps/manifests/01-006-audit-playable-host-surface.json', import.meta.url);
const EXPECTED_CONTRACT_HASH = 'cd34e35585bc38fc46100183448b93d536e0f39e57607369ecdc57edc22ea34b';

function createContractHash(): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(JSON.stringify(IMPLEMENT_TIC_ACCUMULATION_CONTRACT));
  return hasher.digest('hex');
}

describe('IMPLEMENT_TIC_ACCUMULATION_CONTRACT', () => {
  test('locks the exact Bun tic-accumulation contract and hash', () => {
    expect(IMPLEMENT_TIC_ACCUMULATION_CONTRACT).toEqual({
      accumulationFormula: 'floor((delta * 35) / frequency)',
      accumulationMethod: 'TicAccumulator.advance()',
      deterministicReplayCompatibility: 'Discrete tics come from integer-only absolute clock deltas, so gameplay remains tic-driven instead of presentation-driven.',
      launcherTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      mainLoopPhase: 'tryRunTics',
      runtimeCommand: 'bun run doom.ts',
      stepId: '05-003',
      stepTitle: 'implement-tic-accumulation',
      ticRateHz: TICS_PER_SECOND,
      totalTicsProperty: 'totalTics',
    });
    expect(createContractHash()).toBe(EXPECTED_CONTRACT_HASH);
  });

  test('matches the main-loop phase and audited launcher transition', async () => {
    const hostSurfaceManifest = (await Bun.file(HOST_SURFACE_MANIFEST_PATH).json()) as {
      currentLauncherHostTransition: { call: string };
      stepId: string;
    };

    expect(hostSurfaceManifest.stepId).toBe('01-006');
    expect(MAIN_LOOP_PHASES).toContain(IMPLEMENT_TIC_ACCUMULATION_CONTRACT.mainLoopPhase);
    expect(MAIN_LOOP_PHASES[1]).toBe(IMPLEMENT_TIC_ACCUMULATION_CONTRACT.mainLoopPhase);
    expect(hostSurfaceManifest.currentLauncherHostTransition.call).toBe(IMPLEMENT_TIC_ACCUMULATION_CONTRACT.launcherTransition);
  });
});

describe('implementTicAccumulation', () => {
  test('accumulates whole tics from the absolute clock baseline', () => {
    let counter = 0n;
    const ticClock: TicClock = {
      frequency: 350n,
      now() {
        return counter;
      },
    };
    const ticAccumulator = new TicAccumulator(ticClock);

    expect(implementTicAccumulation('bun run doom.ts', ticAccumulator)).toEqual({
      ...IMPLEMENT_TIC_ACCUMULATION_CONTRACT,
      newTics: 0,
      totalTics: 0,
    });

    counter = 40n;
    expect(implementTicAccumulation('bun run doom.ts', ticAccumulator)).toEqual({
      ...IMPLEMENT_TIC_ACCUMULATION_CONTRACT,
      newTics: 4,
      totalTics: 4,
    });

    counter = 85n;
    expect(implementTicAccumulation('bun run doom.ts', ticAccumulator)).toEqual({
      ...IMPLEMENT_TIC_ACCUMULATION_CONTRACT,
      newTics: 4,
      totalTics: 8,
    });
  });

  test('rejects non-Bun runtime commands', () => {
    const ticAccumulator = new TicAccumulator({
      frequency: 350n,
      now() {
        return 0n;
      },
    });

    expect(() => implementTicAccumulation('bun run src/main.ts', ticAccumulator)).toThrow('implementTicAccumulation requires bun run doom.ts');
  });
});
