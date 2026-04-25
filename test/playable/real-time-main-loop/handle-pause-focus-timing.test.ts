import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { HANDLE_PAUSE_FOCUS_TIMING_CONTRACT, handlePauseFocusTiming } from '../../../src/playable/real-time-main-loop/handlePauseFocusTiming.ts';

const CONTRACT_HASH = 'acf813aa6e4ae4273010419957ad8065ae115ae6f3fdd580fd71550c7a668c1d';

describe('handlePauseFocusTiming', () => {
  test('locks the exact pause focus timing contract', () => {
    expect(HANDLE_PAUSE_FOCUS_TIMING_CONTRACT).toEqual({
      deterministicReplayGuard: 'Reset the tic accumulator baseline on focus regain and never convert unfocused wall time into runnable tics.',
      focusLossPolicy: 'pause tryRunTics timing immediately when the window is not focused',
      focusRegainPolicy: 'reset the tic accumulator baseline before simulation resumes',
      hostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      mainLoopPhase: 'tryRunTics',
      runtimeCommand: 'bun run doom.ts',
      ticTimingAuthority: 'TicAccumulator.reset() and TicAccumulator.totalTics',
    });
  });

  test('locks the serialized contract hash', () => {
    const contractHash = createHash('sha256').update(JSON.stringify(HANDLE_PAUSE_FOCUS_TIMING_CONTRACT)).digest('hex');

    expect(contractHash).toBe(CONTRACT_HASH);
  });

  test('locks the audited host transition and live timing evidence', async () => {
    const auditManifest = JSON.parse(await Bun.file('plan_fps/manifests/01-006-audit-playable-host-surface.json').text()) as {
      currentLauncherHostTransition: { call: string };
    };
    const mainLoopSource = await Bun.file('src/mainLoop.ts').text();
    const ticAccumulatorSource = await Bun.file('src/host/ticAccumulator.ts').text();

    expect(auditManifest.currentLauncherHostTransition.call).toBe(HANDLE_PAUSE_FOCUS_TIMING_CONTRACT.hostTransition);
    expect(mainLoopSource).toContain('callbacks.tryRunTics();');
    expect(ticAccumulatorSource).toContain('get totalTics(): number');
    expect(ticAccumulatorSource).toContain('reset(): void');
  });

  test('pauses immediately on focus loss and resets the timing baseline on resume', () => {
    const ticAccumulator = {
      resetCallCount: 0,
      totalTics: 11,
      reset() {
        this.resetCallCount++;
        this.totalTics = 0;
      },
    };

    const pauseDecision = handlePauseFocusTiming('bun run doom.ts', 'tryRunTics', true, false, ticAccumulator);
    const resumeDecision = handlePauseFocusTiming('bun run doom.ts', 'tryRunTics', false, true, ticAccumulator);

    expect(pauseDecision).toEqual({
      action: 'pause',
      paused: true,
      resetApplied: false,
      runnableTics: 0,
      totalTics: 11,
    });
    expect(resumeDecision).toEqual({
      action: 'resume',
      paused: false,
      resetApplied: true,
      runnableTics: 0,
      totalTics: 0,
    });
    expect(ticAccumulator.resetCallCount).toBe(1);
  });

  test('does not alter timing outside tryRunTics', () => {
    const ticAccumulator = {
      resetCallCount: 0,
      totalTics: 7,
      reset() {
        this.resetCallCount++;
      },
    };

    const decision = handlePauseFocusTiming('bun run doom.ts', 'display', false, true, ticAccumulator);

    expect(decision).toEqual({
      action: 'skip',
      paused: false,
      resetApplied: false,
      runnableTics: 0,
      totalTics: 7,
    });
    expect(ticAccumulator.resetCallCount).toBe(0);
  });

  test('rejects non-doom runtime commands', () => {
    const ticAccumulator = {
      totalTics: 0,
      reset() {
        throw new Error('reset should not be called');
      },
    };

    expect(() => handlePauseFocusTiming('bun run src/main.ts', 'tryRunTics', true, false, ticAccumulator)).toThrow('handlePauseFocusTiming requires bun run doom.ts');
  });
});
