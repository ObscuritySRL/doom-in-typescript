import { describe, expect, test } from 'bun:test';

import { HANDLE_LONG_STALL_PANIC_CONTRACT, handleLongStallPanic } from '../../../src/playable/real-time-main-loop/handleLongStallPanic.ts';

describe('HANDLE_LONG_STALL_PANIC_CONTRACT', () => {
  test('locks the exact contract object', () => {
    expect(HANDLE_LONG_STALL_PANIC_CONTRACT).toEqual({
      auditedLauncherTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      deterministicReplayCompatibility: 'panic decisions depend only on discrete tic counts',
      mainLoopPhase: 'tryRunTics',
      panicPolicy: {
        longStallAction: 'panic',
        thresholdSource: 'caller-supplied maximumSafeElapsedTics',
        ticsToRunWhenPanicking: 0,
        units: 'tics',
      },
      runtimeCommand: 'bun run doom.ts',
      stepId: '05-006',
      stepTitle: 'handle-long-stall-panic',
      timingAuthority: {
        absoluteCountProperty: 'TicAccumulator.totalTics',
        accumulatorMethod: 'TicAccumulator.advance()',
        arithmetic: 'floor((delta * 35) / frequency)',
      },
    });
  });

  test('locks a stable serialized contract hash', () => {
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(JSON.stringify(HANDLE_LONG_STALL_PANIC_CONTRACT));

    expect(hasher.digest('hex')).toBe('6f3de6dfb529d3c4d3044b42badc469074e5796ee966f476d1a18e2101305bf7');
  });

  test('locks manifest and live source evidence', async () => {
    const manifest = (await Bun.file('plan_fps/manifests/01-006-audit-playable-host-surface.json').json()) as {
      commandContracts: { targetRuntimeCommand: string };
      currentLauncherHostTransition: { call: string };
    };
    const mainLoopSource = await Bun.file('src/mainLoop.ts').text();
    const ticAccumulatorSource = await Bun.file('src/host/ticAccumulator.ts').text();

    expect(manifest.commandContracts.targetRuntimeCommand).toBe(HANDLE_LONG_STALL_PANIC_CONTRACT.runtimeCommand);
    expect(manifest.currentLauncherHostTransition.call).toBe(HANDLE_LONG_STALL_PANIC_CONTRACT.auditedLauncherTransition);
    expect(mainLoopSource).toContain('callbacks.tryRunTics();');
    expect(ticAccumulatorSource).toContain('advance(): number {');
    expect(ticAccumulatorSource).toContain('const newTics = totalTics - this.#lastTotalTics;');
    expect(ticAccumulatorSource).toContain('get totalTics(): number {');
  });
});

describe('handleLongStallPanic', () => {
  test('passes through replay-safe tic counts when the stall is within the safe limit', () => {
    expect(
      handleLongStallPanic({
        currentTotalTics: 120,
        elapsedTics: 3,
        maximumSafeElapsedTics: 5,
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toEqual({
      currentTotalTics: 120,
      elapsedTics: 3,
      panicReason: null,
      panicTriggered: false,
      phase: 'tryRunTics',
      ticsToRun: 3,
    });
  });

  test('triggers a panic instead of synthesizing extra simulation work after a long stall', () => {
    expect(
      handleLongStallPanic({
        currentTotalTics: 120,
        elapsedTics: 9,
        maximumSafeElapsedTics: 5,
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toEqual({
      currentTotalTics: 120,
      elapsedTics: 9,
      panicReason: 'long stall exceeded 5 tics',
      panicTriggered: true,
      phase: 'tryRunTics',
      ticsToRun: 0,
    });
  });

  test('rejects non-Bun runtime commands', () => {
    expect(() =>
      handleLongStallPanic({
        currentTotalTics: 120,
        elapsedTics: 3,
        maximumSafeElapsedTics: 5,
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('handleLongStallPanic requires runtime command bun run doom.ts');
  });

  test('does not panic when elapsedTics equals maximumSafeElapsedTics (strict-greater boundary)', () => {
    expect(
      handleLongStallPanic({
        currentTotalTics: 120,
        elapsedTics: 5,
        maximumSafeElapsedTics: 5,
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toEqual({
      currentTotalTics: 120,
      elapsedTics: 5,
      panicReason: null,
      panicTriggered: false,
      phase: 'tryRunTics',
      ticsToRun: 5,
    });
  });

  test('panics on the first elapsed tic when maximumSafeElapsedTics is zero', () => {
    expect(
      handleLongStallPanic({
        currentTotalTics: 0,
        elapsedTics: 1,
        maximumSafeElapsedTics: 0,
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toEqual({
      currentTotalTics: 0,
      elapsedTics: 1,
      panicReason: 'long stall exceeded 0 tics',
      panicTriggered: true,
      phase: 'tryRunTics',
      ticsToRun: 0,
    });
  });

  test('returns ticsToRun zero without panic when elapsedTics is zero and threshold is zero', () => {
    expect(
      handleLongStallPanic({
        currentTotalTics: 0,
        elapsedTics: 0,
        maximumSafeElapsedTics: 0,
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toEqual({
      currentTotalTics: 0,
      elapsedTics: 0,
      panicReason: null,
      panicTriggered: false,
      phase: 'tryRunTics',
      ticsToRun: 0,
    });
  });

  test('panic decision is independent of currentTotalTics (deterministic-replay guarantee)', () => {
    const panicAtZero = handleLongStallPanic({
      currentTotalTics: 0,
      elapsedTics: 9,
      maximumSafeElapsedTics: 5,
      runtimeCommand: 'bun run doom.ts',
    });
    const panicAtMillion = handleLongStallPanic({
      currentTotalTics: 1_000_000,
      elapsedTics: 9,
      maximumSafeElapsedTics: 5,
      runtimeCommand: 'bun run doom.ts',
    });

    expect(panicAtZero.panicTriggered).toBe(true);
    expect(panicAtMillion.panicTriggered).toBe(true);
    expect(panicAtZero.panicReason).toBe(panicAtMillion.panicReason);
    expect(panicAtZero.ticsToRun).toBe(panicAtMillion.ticsToRun);
    expect(panicAtMillion.currentTotalTics).toBe(1_000_000);
  });

  test('rejects non-integer or negative currentTotalTics', () => {
    for (const badValue of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        handleLongStallPanic({
          currentTotalTics: badValue,
          elapsedTics: 1,
          maximumSafeElapsedTics: 5,
          runtimeCommand: 'bun run doom.ts',
        }),
      ).toThrow('currentTotalTics must be a non-negative integer');
    }
  });

  test('rejects non-integer or negative elapsedTics', () => {
    for (const badValue of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        handleLongStallPanic({
          currentTotalTics: 0,
          elapsedTics: badValue,
          maximumSafeElapsedTics: 5,
          runtimeCommand: 'bun run doom.ts',
        }),
      ).toThrow('elapsedTics must be a non-negative integer');
    }
  });

  test('rejects non-integer or negative maximumSafeElapsedTics', () => {
    for (const badValue of [-1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        handleLongStallPanic({
          currentTotalTics: 0,
          elapsedTics: 1,
          maximumSafeElapsedTics: badValue,
          runtimeCommand: 'bun run doom.ts',
        }),
      ).toThrow('maximumSafeElapsedTics must be a non-negative integer');
    }
  });
});
