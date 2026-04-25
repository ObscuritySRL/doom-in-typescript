import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { SCHEDULE_35HZ_GAME_TICS_CONTRACT, schedule35hzGameTics } from '../../../src/playable/real-time-main-loop/schedule35hzGameTics.ts';

const AUDIT_MANIFEST_URL = new URL('../../../plan_fps/manifests/01-006-audit-playable-host-surface.json', import.meta.url);
const MAIN_LOOP_SOURCE_URL = new URL('../../../src/mainLoop.ts', import.meta.url);
const TIC_ACCUMULATOR_SOURCE_URL = new URL('../../../src/host/ticAccumulator.ts', import.meta.url);

describe('schedule35hzGameTics', () => {
  test('exports the exact 35 hz scheduling contract', () => {
    expect(SCHEDULE_35HZ_GAME_TICS_CONTRACT).toEqual({
      accumulator: {
        advanceMethod: 'advance',
        className: 'TicAccumulator',
        totalTicsField: 'totalTics',
      },
      deterministicReplayCompatible: true,
      hostTransitionCall: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      mainLoop: {
        phaseCount: 4,
        phaseOrder: ['startFrame', 'tryRunTics', 'updateSounds', 'display'],
        scheduledPhase: 'tryRunTics',
      },
      runtimeCommand: 'bun run doom.ts',
      stepId: '05-001',
      stepTitle: 'schedule-35hz-game-tics',
      timing: {
        clockCounterType: 'bigint',
        clockFrequencyType: 'bigint',
        formula: 'floor((delta * 35) / frequency)',
        ticRateHz: 35,
      },
    });
  });

  test('has a stable contract hash', () => {
    const contractHash = createHash('sha256').update(JSON.stringify(SCHEDULE_35HZ_GAME_TICS_CONTRACT)).digest('hex');

    expect(contractHash).toBe('591dc4e6d3876637b619f7166f286b933d4a6fe57300a0f4ebab48afe29e0571');
  });

  test('returns the frozen contract for the Bun runtime command', () => {
    expect(schedule35hzGameTics('bun run doom.ts')).toBe(SCHEDULE_35HZ_GAME_TICS_CONTRACT);
  });

  test('rejects non-playable runtime commands', () => {
    expect(() => schedule35hzGameTics('bun run src/main.ts')).toThrow('schedule35hzGameTics requires runtime command bun run doom.ts');
  });

  test('locks the audited launcher transition and live timing sources', async () => {
    const auditManifest = JSON.parse(await Bun.file(AUDIT_MANIFEST_URL).text()) as {
      commandContracts: {
        targetRuntimeCommand: string;
      };
      currentLauncherHostTransition: {
        call: string;
      };
    };

    const mainLoopSource = await Bun.file(MAIN_LOOP_SOURCE_URL).text();
    const ticAccumulatorSource = await Bun.file(TIC_ACCUMULATOR_SOURCE_URL).text();

    expect(auditManifest.commandContracts.targetRuntimeCommand).toBe(SCHEDULE_35HZ_GAME_TICS_CONTRACT.runtimeCommand);
    expect(auditManifest.currentLauncherHostTransition.call).toBe(SCHEDULE_35HZ_GAME_TICS_CONTRACT.hostTransitionCall);
    expect(mainLoopSource).toContain('callbacks.tryRunTics();');
    expect(ticAccumulatorSource).toContain('export const TICS_PER_SECOND = 35;');
    expect(ticAccumulatorSource).toContain('floor((delta * 35) / frequency)');
  });
});
