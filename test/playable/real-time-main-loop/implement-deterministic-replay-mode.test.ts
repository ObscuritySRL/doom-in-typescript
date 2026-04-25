import { describe, expect, it } from 'bun:test';

import { createHash } from 'node:crypto';

import { IMPLEMENT_DETERMINISTIC_REPLAY_MODE_CONTRACT, implementDeterministicReplayMode } from '../../../src/playable/real-time-main-loop/implementDeterministicReplayMode.ts';
import type { DeterministicReplayModeContract } from '../../../src/playable/real-time-main-loop/implementDeterministicReplayMode.ts';

const IMPLEMENT_DETERMINISTIC_REPLAY_MODE_EXPECTED_HASH = '773e428838712435e576accd1dc988e9588a34084c114c41d7de730616629f8a';

describe('implementDeterministicReplayMode', () => {
  it('locks the exact deterministic replay mode contract', () => {
    const expectedContract = {
      currentLauncherHostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      mainLoopPhase: 'tryRunTics',
      presentationTimingMode: 'presentation-independent',
      replayCompatibility: 'deterministic',
      runtimeCommand: 'bun run doom.ts',
      ticAccumulatorAdvanceCall: 'TicAccumulator.advance()',
      ticAccumulatorRule: 'floor((delta * 35) / frequency)',
      ticAccumulatorTotalTicsProperty: 'TicAccumulator.totalTics',
    } as const satisfies DeterministicReplayModeContract;

    expect(IMPLEMENT_DETERMINISTIC_REPLAY_MODE_CONTRACT).toEqual(expectedContract);
  });

  it('locks a stable serialized contract hash', () => {
    const actualHash = createHash('sha256').update(JSON.stringify(IMPLEMENT_DETERMINISTIC_REPLAY_MODE_CONTRACT)).digest('hex');

    expect(actualHash).toBe(IMPLEMENT_DETERMINISTIC_REPLAY_MODE_EXPECTED_HASH);
  });

  it('returns the deterministic replay plan for the Bun runtime command', () => {
    expect(implementDeterministicReplayMode('bun run doom.ts')).toEqual({
      ...IMPLEMENT_DETERMINISTIC_REPLAY_MODE_CONTRACT,
      enabled: true,
    });
  });

  it('rejects non-Bun runtime commands', () => {
    expect(() => implementDeterministicReplayMode('bun run src/main.ts')).toThrow('implementDeterministicReplayMode requires `bun run doom.ts`, got `bun run src/main.ts`');
  });

  it('matches the audited launcher transition and command contract', async () => {
    const manifestPath = new URL('../../../plan_fps/manifests/01-006-audit-playable-host-surface.json', import.meta.url);
    const manifest = (await Bun.file(manifestPath).json()) as {
      commandContracts: { targetRuntimeCommand: string };
      currentLauncherHostTransition: { call: string };
      stepId: string;
    };

    expect(manifest.stepId).toBe('01-006');
    expect(manifest.commandContracts.targetRuntimeCommand).toBe(IMPLEMENT_DETERMINISTIC_REPLAY_MODE_CONTRACT.runtimeCommand);
    expect(manifest.currentLauncherHostTransition.call).toBe(IMPLEMENT_DETERMINISTIC_REPLAY_MODE_CONTRACT.currentLauncherHostTransition);
  });

  it('locks the live main loop and tic accumulator replay evidence', async () => {
    const mainLoopPath = new URL('../../../src/mainLoop.ts', import.meta.url);
    const ticAccumulatorPath = new URL('../../../src/host/ticAccumulator.ts', import.meta.url);

    const mainLoopSource = await Bun.file(mainLoopPath).text();
    const ticAccumulatorSource = await Bun.file(ticAccumulatorPath).text();

    expect(mainLoopSource).toContain("export type MainLoopPhase = 'display' | 'startFrame' | 'tryRunTics' | 'updateSounds';");
    expect(mainLoopSource).toContain('callbacks.tryRunTics();');
    expect(ticAccumulatorSource).toContain('advance(): number {');
    expect(ticAccumulatorSource).toContain('get totalTics(): number {');
    expect(ticAccumulatorSource).toContain('floor((delta * 35) / frequency)');
  });
});
