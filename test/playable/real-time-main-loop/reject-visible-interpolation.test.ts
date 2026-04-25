import { describe, expect, it } from 'bun:test';

import { createHash } from 'node:crypto';

import { MAIN_LOOP_PHASES } from '../../../src/mainLoop.ts';
import { TICS_PER_SECOND } from '../../../src/host/ticAccumulator.ts';
import { REJECT_VISIBLE_INTERPOLATION_CONTRACT, rejectVisibleInterpolation } from '../../../src/playable/real-time-main-loop/rejectVisibleInterpolation.ts';

describe('rejectVisibleInterpolation', () => {
  it('exports the exact reject-visible-interpolation contract', () => {
    expect(REJECT_VISIBLE_INTERPOLATION_CONTRACT).toEqual({
      auditedLauncherTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      deterministicReplayCompatibility: 'Presentation samples only discrete TicAccumulator state, so display never invents blended frames between game tics.',
      interpolationPolicy: {
        interpolationAlpha: 0,
        presentationMode: 'discrete-tic-only',
        simulationAdvancedByPresentation: false,
        visibleInterpolationAllowed: false,
      },
      mainLoopPhase: 'display',
      runtimeCommand: 'bun run doom.ts',
      stepId: '05-009',
      stepTitle: 'reject-visible-interpolation',
      timingAuthority: {
        absoluteTimingSource: 'TicAccumulator',
        newTicsAccessor: 'advance()',
        ticsPerSecond: 35,
        totalTicsAccessor: 'totalTics',
      },
    });
  });

  it('locks the serialized contract hash', () => {
    const serializedContract = JSON.stringify(REJECT_VISIBLE_INTERPOLATION_CONTRACT);
    const contractHash = createHash('sha256').update(serializedContract).digest('hex');

    expect(contractHash).toBe('e490ade71a9edd1ce40167e2324c7ec84de98c21d3164b1031882fe5c980cf18');
  });

  it('matches the audited launcher transition and live timing authorities', async () => {
    const playableHostAudit = JSON.parse(await Bun.file('plan_fps/manifests/01-006-audit-playable-host-surface.json').text()) as {
      currentLauncherHostTransition: {
        call: string;
      };
    };
    const mainLoopSource = await Bun.file('src/mainLoop.ts').text();
    const ticAccumulatorSource = await Bun.file('src/host/ticAccumulator.ts').text();

    expect(playableHostAudit.currentLauncherHostTransition.call).toBe(REJECT_VISIBLE_INTERPOLATION_CONTRACT.auditedLauncherTransition);
    expect(MAIN_LOOP_PHASES[MAIN_LOOP_PHASES.length - 1]).toBe(REJECT_VISIBLE_INTERPOLATION_CONTRACT.mainLoopPhase);
    expect(mainLoopSource).toContain("Object.freeze(['startFrame', 'tryRunTics', 'updateSounds', 'display'])");
    expect(TICS_PER_SECOND).toBe(REJECT_VISIBLE_INTERPOLATION_CONTRACT.timingAuthority.ticsPerSecond);
    expect(ticAccumulatorSource).toContain('floor((delta * 35) / frequency)');
    expect(ticAccumulatorSource).toContain('totalTics');
  });

  it('rejects visible interpolation during the display phase', () => {
    expect(
      rejectVisibleInterpolation({
        mainLoopPhase: 'display',
        runtimeCommand: 'bun run doom.ts',
        totalTics: 12,
      }),
    ).toEqual({
      interpolationAlpha: 0,
      mainLoopPhase: 'display',
      presentationMode: 'discrete-tic-only',
      presentedTotalTics: 12,
      simulationAdvancedByPresentation: false,
      visibleInterpolationRejected: true,
    });
  });

  it('ignores non-display phases without inventing interpolated state', () => {
    expect(
      rejectVisibleInterpolation({
        mainLoopPhase: 'tryRunTics',
        runtimeCommand: 'bun run doom.ts',
        totalTics: 12,
      }),
    ).toEqual({
      interpolationAlpha: 0,
      mainLoopPhase: 'tryRunTics',
      presentationMode: 'phase-ignored',
      presentedTotalTics: 12,
      simulationAdvancedByPresentation: false,
      visibleInterpolationRejected: false,
    });
  });

  it('rejects the wrong runtime command', () => {
    expect(() =>
      rejectVisibleInterpolation({
        mainLoopPhase: 'display',
        runtimeCommand: 'bun run src/main.ts',
        totalTics: 12,
      }),
    ).toThrow('rejectVisibleInterpolation requires runtime command bun run doom.ts');
  });
});
