import { describe, expect, it } from 'bun:test';

import { SCHEDULE_PRESENTATION_CONTRACT, schedulePresentation } from '../../../src/playable/real-time-main-loop/schedulePresentation.ts';

interface AuditPlayableHostSurfaceManifest {
  readonly commandContracts: {
    readonly currentLauncherCommand: string;
    readonly targetRuntimeCommand: string;
  };
  readonly currentLauncherHostTransition: {
    readonly call: string;
  };
}

const HOST_SURFACE_MANIFEST_PATH = new URL('../../../plan_fps/manifests/01-006-audit-playable-host-surface.json', import.meta.url);

async function loadHostSurfaceManifest(): Promise<AuditPlayableHostSurfaceManifest> {
  return (await Bun.file(HOST_SURFACE_MANIFEST_PATH).json()) as AuditPlayableHostSurfaceManifest;
}

function schedulePresentationContractHash(): string {
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(SCHEDULE_PRESENTATION_CONTRACT)).digest('hex');
}

describe('schedulePresentation', () => {
  it('locks the exact schedule-presentation contract', () => {
    expect(SCHEDULE_PRESENTATION_CONTRACT).toEqual({
      accumulationRule: 'floor((delta * 35) / frequency)',
      currentLauncherCommand: 'bun run src/main.ts',
      deterministicReplayCompatibility: 'presentation observes TicAccumulator.totalTics and never advances simulation',
      mainLoopPhaseCount: 4,
      mainLoopPhases: ['startFrame', 'tryRunTics', 'updateSounds', 'display'],
      playableHostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      presentationPhase: 'display',
      requiredRuntimeCommand: 'bun run doom.ts',
      ticAuthority: ['TicAccumulator.advance()', 'TicAccumulator.totalTics'],
      ticsPerSecond: 35,
    });
    expect(Object.isFrozen(SCHEDULE_PRESENTATION_CONTRACT)).toBe(true);
  });

  it('locks a stable schedule-presentation contract hash', () => {
    expect(schedulePresentationContractHash()).toBe('f9375fd3f3ca58342ec510c00663253c1059ec20bf171d33099c3798cb732773');
  });

  it('matches the audited launcher transition and command contract', async () => {
    const hostSurfaceManifest = await loadHostSurfaceManifest();

    expect(hostSurfaceManifest.currentLauncherHostTransition.call).toBe(SCHEDULE_PRESENTATION_CONTRACT.playableHostTransition);
    expect(hostSurfaceManifest.commandContracts.currentLauncherCommand).toBe(SCHEDULE_PRESENTATION_CONTRACT.currentLauncherCommand);
    expect(hostSurfaceManifest.commandContracts.targetRuntimeCommand).toBe(SCHEDULE_PRESENTATION_CONTRACT.requiredRuntimeCommand);
  });

  it('schedules presentation from the display phase without advancing simulation', () => {
    const scheduled = schedulePresentation({
      frameCount: 7,
      mainLoopPhase: 'display',
      runtimeCommand: 'bun run doom.ts',
      totalTics: 12,
    });

    expect(scheduled).toEqual({
      frameOrdinal: 8,
      mainLoopPhase: 'display',
      presentationScheduled: true,
      runtimeCommand: 'bun run doom.ts',
      ticsPerSecond: 35,
      totalTics: 12,
    });
    expect(Object.isFrozen(scheduled)).toBe(true);
  });

  it('skips presentation for every non-display phase', () => {
    for (const phase of ['startFrame', 'tryRunTics', 'updateSounds'] as const) {
      expect(
        schedulePresentation({
          frameCount: 0,
          mainLoopPhase: phase,
          runtimeCommand: 'bun run doom.ts',
          totalTics: 0,
        }),
      ).toBeNull();
    }
  });

  it('preserves the totalTics snapshot it observes from TicAccumulator', () => {
    const scheduled = schedulePresentation({
      frameCount: 0,
      mainLoopPhase: 'display',
      runtimeCommand: 'bun run doom.ts',
      totalTics: 1234567,
    });

    expect(scheduled).not.toBeNull();
    expect(scheduled?.totalTics).toBe(1234567);
    expect(scheduled?.frameOrdinal).toBe(1);
  });

  it('skips presentation outside the display phase', () => {
    expect(
      schedulePresentation({
        frameCount: 7,
        mainLoopPhase: 'updateSounds',
        runtimeCommand: 'bun run doom.ts',
        totalTics: 12,
      }),
    ).toBeNull();
  });

  it('rejects the wrong runtime command', () => {
    expect(() =>
      schedulePresentation({
        frameCount: 0,
        mainLoopPhase: 'display',
        runtimeCommand: 'bun run src/main.ts',
        totalTics: 0,
      }),
    ).toThrow('schedulePresentation requires runtime command bun run doom.ts');
  });
});
