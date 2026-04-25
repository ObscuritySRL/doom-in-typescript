import { describe, expect, test } from 'bun:test';

import type { LauncherResources } from '../../../src/launcher/session.ts';

import { loadLauncherResources } from '../../../src/launcher/session.ts';
import { WIRE_INTERMISSION_AND_FINALE_TRANSITIONS_RUNTIME_CONTRACT, wireIntermissionAndFinaleTransitions } from '../../../src/playable/game-session-wiring/wireIntermissionAndFinaleTransitions.ts';

let launcherResourcesPromise: Promise<LauncherResources> | null = null;

describe('wireIntermissionAndFinaleTransitions', () => {
  test('locks the Bun runtime command contract', () => {
    expect(WIRE_INTERMISSION_AND_FINALE_TRANSITIONS_RUNTIME_CONTRACT).toEqual({
      auditStepId: '01-009',
      command: 'bun run doom.ts',
      deterministicReplay: true,
      entryFile: 'doom.ts',
      program: 'bun',
      stepId: '08-010',
      subcommand: 'run',
    });
  });

  test('wires the E1M1 gameplay to intermission transition during the canonical main loop', async () => {
    const result = wireIntermissionAndFinaleTransitions({
      command: WIRE_INTERMISSION_AND_FINALE_TRANSITIONS_RUNTIME_CONTRACT.command,
      mapName: 'E1M1',
      resources: await loadTestLauncherResources(),
      skill: 2,
      transitionKind: 'intermission',
    });

    expect(result.command).toBe('bun run doom.ts');
    expect(result.deterministicReplay).toEqual({
      frameCount: 1,
      levelTime: 1,
      mutationPhase: 'tryRunTics',
      renderPhase: 'display',
    });
    expect(result.framebufferLength).toBe(64_000);
    expect(result.mapName).toBe('E1M1');
    expect(result.phaseTrace).toEqual(['startFrame', 'tryRunTics', 'updateSounds', 'display']);
    expect(result.preLoopTrace).toEqual(['initialTryRunTics', 'restoreBuffer', 'executeSetViewSize', 'startGameLoop']);
    expect(result.transition).toEqual({
      destinationState: 'intermission',
      nextMapName: 'E1M2',
      path: ['gameplay', 'intermission'],
      sourceState: 'gameplay',
      transitionKind: 'intermission',
    });
  });

  test('wires the E1M8 gameplay through intermission to finale transition', async () => {
    const result = wireIntermissionAndFinaleTransitions({
      command: WIRE_INTERMISSION_AND_FINALE_TRANSITIONS_RUNTIME_CONTRACT.command,
      mapName: 'E1M8',
      resources: await loadTestLauncherResources(),
      skill: 2,
      transitionKind: 'finale',
    });

    expect(result.deterministicReplay).toEqual({
      frameCount: 1,
      levelTime: 1,
      mutationPhase: 'tryRunTics',
      renderPhase: 'display',
    });
    expect(result.transition).toEqual({
      destinationState: 'finale',
      nextMapName: null,
      path: ['gameplay', 'intermission', 'finale'],
      sourceState: 'gameplay',
      transitionKind: 'finale',
    });
  });

  test('rejects non-Bun-runtime commands before creating transition evidence', async () => {
    const launcherResources = await loadTestLauncherResources();

    expect(() =>
      wireIntermissionAndFinaleTransitions({
        command: 'bun run src/main.ts',
        resources: launcherResources,
        transitionKind: 'intermission',
      }),
    ).toThrow('wireIntermissionAndFinaleTransitions requires bun run doom.ts, got bun run src/main.ts');
  });

  test('rejects finale transitions before the episode finale map', async () => {
    const launcherResources = await loadTestLauncherResources();

    expect(() =>
      wireIntermissionAndFinaleTransitions({
        command: WIRE_INTERMISSION_AND_FINALE_TRANSITIONS_RUNTIME_CONTRACT.command,
        mapName: 'E1M1',
        resources: launcherResources,
        transitionKind: 'finale',
      }),
    ).toThrow('finale transition requires E1M8, got E1M1');
  });
});

function loadTestLauncherResources(): Promise<LauncherResources> {
  launcherResourcesPromise ??= loadLauncherResources('doom/DOOM1.WAD');

  return launcherResourcesPromise;
}
