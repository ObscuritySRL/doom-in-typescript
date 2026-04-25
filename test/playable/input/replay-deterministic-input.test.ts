import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { KEY_UPARROW, LPARAM_EXTENDED_FLAG } from '../../../src/input/keyboard.ts';
import { EMPTY_TICCMD, TICCMD_SIZE } from '../../../src/input/ticcmd.ts';
import { REPLAY_DETERMINISTIC_INPUT_CONTRACT, replayDeterministicInput } from '../../../src/playable/input/replayDeterministicInput.ts';

import type { KeyboardReplayTraceEvent, MouseButtonReplayTraceEvent, MouseMotionReplayTraceEvent, ReplayInputTrace, ScriptedDoomKeyReplayTraceEvent } from '../../../src/playable/input/replayDeterministicInput.ts';

const EXPECTED_CONTRACT = {
  domains: ['keyboard', 'mouse-button', 'mouse-motion', 'scripted-doom-key'],
  neutralTicCommand: EMPTY_TICCMD,
  preservesArrivalOrder: true,
  replaysOnlyCurrentTic: true,
  runtimeCommand: 'bun run doom.ts',
  ticCommandSize: TICCMD_SIZE,
  traceSchemaVersion: 1,
  validatesKeyboardTranslation: true,
} as const;

const EXPECTED_CONTRACT_HASH = '7f5c4d812027beda26a0ee71974fe529f89019c35db9a8af27480151b35cf8a3';

interface AuditMissingLiveInputManifest {
  readonly explicitNullSurfaces: readonly {
    readonly reason: string;
    readonly surface: string;
  }[];
  readonly stepId: string;
}

function createReplayTrace(): ReplayInputTrace {
  return {
    events: [
      {
        arrivalIndex: 0,
        doomKey: KEY_UPARROW,
        extendedKey: true,
        keyTransition: 'keydown',
        messageLongParameter: (0x48 << 16) | LPARAM_EXTENDED_FLAG,
        scanCode: 0x48,
        ticIndex: 12,
        type: 'keyboard',
      },
      {
        arrivalIndex: 1,
        button: 'left',
        buttonTransition: 'buttondown',
        ticIndex: 12,
        type: 'mouse-button',
      },
      {
        arrivalIndex: 2,
        deltaX: 3,
        deltaY: -1,
        ticIndex: 12,
        type: 'mouse-motion',
      },
      {
        arrivalIndex: 0,
        doomKey: KEY_UPARROW,
        keyTransition: 'keyup',
        ticIndex: 13,
        type: 'scripted-doom-key',
      },
    ],
    header: {
      neutralTicCommand: EMPTY_TICCMD,
      runtimeCommand: 'bun run doom.ts',
      ticCommandSize: TICCMD_SIZE,
      traceSchemaVersion: 1,
    },
  };
}

function isAuditMissingLiveInputManifest(value: unknown): value is AuditMissingLiveInputManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const maybeManifest = value as {
    explicitNullSurfaces?: unknown;
    stepId?: unknown;
  };

  if (maybeManifest.stepId !== '01-010' || !Array.isArray(maybeManifest.explicitNullSurfaces)) {
    return false;
  }

  return maybeManifest.explicitNullSurfaces.every((explicitNullSurface) => {
    if (typeof explicitNullSurface !== 'object' || explicitNullSurface === null) {
      return false;
    }

    const maybeExplicitNullSurface = explicitNullSurface as {
      reason?: unknown;
      surface?: unknown;
    };

    return typeof maybeExplicitNullSurface.reason === 'string' && typeof maybeExplicitNullSurface.surface === 'string';
  });
}

describe('replayDeterministicInput', () => {
  test('exports the exact Bun replay contract', () => {
    expect(REPLAY_DETERMINISTIC_INPUT_CONTRACT).toEqual(EXPECTED_CONTRACT);
  });

  test('locks the replay contract hash', () => {
    const contractHash = createHash('sha256').update(JSON.stringify(REPLAY_DETERMINISTIC_INPUT_CONTRACT)).digest('hex');

    expect(contractHash).toBe(EXPECTED_CONTRACT_HASH);
  });

  test('keeps the 01-010 live-input audit linkage explicit', async () => {
    const manifestText = await Bun.file('plan_fps/manifests/01-010-audit-missing-live-input.json').text();
    const manifestValue = JSON.parse(manifestText) as unknown;

    if (!isAuditMissingLiveInputManifest(manifestValue)) {
      throw new TypeError('Expected the 01-010 manifest shape.');
    }

    expect(manifestValue.explicitNullSurfaces.some(({ reason, surface }) => reason.includes('No live input trace recording surface') && surface === 'input-trace-recording')).toBe(true);
    expect(manifestValue.explicitNullSurfaces.some(({ reason, surface }) => reason.includes('No per-tic input accumulation surface') && surface === 'per-tic-input-accumulation')).toBe(true);
    expect(manifestValue.stepId).toBe('01-010');
  });

  test('replays only the requested tic in recorded arrival order and keeps the neutral ticcmd', () => {
    const replayTrace = createReplayTrace();

    const replayResult = replayDeterministicInput({
      runtimeCommand: 'bun run doom.ts',
      ticIndex: 12,
      trace: replayTrace,
      traceCursor: 0,
    });

    expect(replayResult.consumedEvents).toEqual(replayTrace.events.slice(0, 3));
    expect(replayResult.nextCursor).toBe(3);
    expect(replayResult.ticCommand).toBe(EMPTY_TICCMD);
    expect(replayResult.ticCommandSize).toBe(TICCMD_SIZE);
  });

  test('rejects a non-Bun runtime command', () => {
    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run src/main.ts',
        ticIndex: 12,
        trace: createReplayTrace(),
        traceCursor: 0,
      }),
    ).toThrow('Replay deterministic input requires bun run doom.ts.');
  });

  test('rejects keyboard metadata that drifts from the shared translation table', () => {
    const replayTrace = createReplayTrace();
    const driftingKeyboardReplayEvent: KeyboardReplayTraceEvent = {
      arrivalIndex: 0,
      doomKey: 0,
      extendedKey: true,
      keyTransition: 'keydown',
      messageLongParameter: (0x48 << 16) | LPARAM_EXTENDED_FLAG,
      scanCode: 0x48,
      ticIndex: 12,
      type: 'keyboard',
    };
    const driftingReplayTrace: ReplayInputTrace = {
      ...replayTrace,
      events: [driftingKeyboardReplayEvent, ...replayTrace.events.slice(1)],
    };

    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: 12,
        trace: driftingReplayTrace,
        traceCursor: 0,
      }),
    ).toThrow('Keyboard replay event doomKey mismatch at tic 12.');
  });

  test('rejects keyboard metadata when the recorded scanCode disagrees with the LPARAM bits', () => {
    const replayTrace = createReplayTrace();
    const driftingKeyboardReplayEvent: KeyboardReplayTraceEvent = {
      arrivalIndex: 0,
      doomKey: KEY_UPARROW,
      extendedKey: true,
      keyTransition: 'keydown',
      messageLongParameter: (0x48 << 16) | LPARAM_EXTENDED_FLAG,
      scanCode: 0x49,
      ticIndex: 12,
      type: 'keyboard',
    };
    const driftingReplayTrace: ReplayInputTrace = {
      ...replayTrace,
      events: [driftingKeyboardReplayEvent, ...replayTrace.events.slice(1)],
    };

    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: 12,
        trace: driftingReplayTrace,
        traceCursor: 0,
      }),
    ).toThrow('Keyboard replay event scanCode mismatch at tic 12.');
  });

  test('rejects keyboard metadata when the recorded extendedKey disagrees with the LPARAM bits', () => {
    const replayTrace = createReplayTrace();
    const driftingKeyboardReplayEvent: KeyboardReplayTraceEvent = {
      arrivalIndex: 0,
      doomKey: KEY_UPARROW,
      extendedKey: false,
      keyTransition: 'keydown',
      messageLongParameter: (0x48 << 16) | LPARAM_EXTENDED_FLAG,
      scanCode: 0x48,
      ticIndex: 12,
      type: 'keyboard',
    };
    const driftingReplayTrace: ReplayInputTrace = {
      ...replayTrace,
      events: [driftingKeyboardReplayEvent, ...replayTrace.events.slice(1)],
    };

    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: 12,
        trace: driftingReplayTrace,
        traceCursor: 0,
      }),
    ).toThrow('Keyboard replay event extendedKey mismatch at tic 12.');
  });

  test('rejects an unsupported keyboard transition value', () => {
    const replayTrace = createReplayTrace();
    const invalidKeyboardReplayEvent = {
      arrivalIndex: 0,
      doomKey: KEY_UPARROW,
      extendedKey: true,
      keyTransition: 'keypress' as 'keydown',
      messageLongParameter: (0x48 << 16) | LPARAM_EXTENDED_FLAG,
      scanCode: 0x48,
      ticIndex: 12,
      type: 'keyboard',
    } as const satisfies KeyboardReplayTraceEvent;
    const invalidReplayTrace: ReplayInputTrace = {
      ...replayTrace,
      events: [invalidKeyboardReplayEvent, ...replayTrace.events.slice(1)],
    };

    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: 12,
        trace: invalidReplayTrace,
        traceCursor: 0,
      }),
    ).toThrow('Unsupported keyboard replay transition: keypress.');
  });

  test('rejects an unsupported mouse button value', () => {
    const invalidMouseButtonReplayEvent = {
      arrivalIndex: 0,
      button: 'forward' as 'left',
      buttonTransition: 'buttondown',
      ticIndex: 12,
      type: 'mouse-button',
    } as const satisfies MouseButtonReplayTraceEvent;

    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: 12,
        trace: { events: [invalidMouseButtonReplayEvent], header: createReplayTrace().header },
        traceCursor: 0,
      }),
    ).toThrow('Unsupported mouse replay button: forward.');
  });

  test('rejects an unsupported mouse button transition', () => {
    const invalidMouseButtonReplayEvent = {
      arrivalIndex: 0,
      button: 'left',
      buttonTransition: 'buttonpress' as 'buttondown',
      ticIndex: 12,
      type: 'mouse-button',
    } as const satisfies MouseButtonReplayTraceEvent;

    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: 12,
        trace: { events: [invalidMouseButtonReplayEvent], header: createReplayTrace().header },
        traceCursor: 0,
      }),
    ).toThrow('Unsupported mouse replay transition: buttonpress.');
  });

  test('rejects mouse motion events with non-integer deltas', () => {
    const fractionalMouseMotionReplayEvent: MouseMotionReplayTraceEvent = {
      arrivalIndex: 0,
      deltaX: 1.5,
      deltaY: 0,
      ticIndex: 12,
      type: 'mouse-motion',
    };

    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: 12,
        trace: { events: [fractionalMouseMotionReplayEvent], header: createReplayTrace().header },
        traceCursor: 0,
      }),
    ).toThrow('Mouse motion replay deltaX must be an integer.');
  });

  test('rejects an unsupported scripted Doom key transition', () => {
    const invalidScriptedKeyReplayEvent = {
      arrivalIndex: 0,
      doomKey: KEY_UPARROW,
      keyTransition: 'keypress' as 'keydown',
      ticIndex: 12,
      type: 'scripted-doom-key',
    } as const satisfies ScriptedDoomKeyReplayTraceEvent;

    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: 12,
        trace: { events: [invalidScriptedKeyReplayEvent], header: createReplayTrace().header },
        traceCursor: 0,
      }),
    ).toThrow('Unsupported scripted Doom key transition: keypress.');
  });

  test('rejects events with negative ticIndex before consulting the cursor', () => {
    const replayTrace = createReplayTrace();
    const negativeTicReplayEvent: ScriptedDoomKeyReplayTraceEvent = {
      arrivalIndex: 0,
      doomKey: KEY_UPARROW,
      keyTransition: 'keydown',
      ticIndex: -1,
      type: 'scripted-doom-key',
    };

    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: 0,
        trace: { events: [negativeTicReplayEvent], header: replayTrace.header },
        traceCursor: 0,
      }),
    ).toThrow('scripted-doom-key replay ticIndex cannot be negative.');
  });

  test('rejects a non-monotonic arrival order within the same tic', () => {
    const replayTrace = createReplayTrace();
    const reorderedReplayTrace: ReplayInputTrace = {
      header: replayTrace.header,
      events: [
        {
          arrivalIndex: 5,
          doomKey: KEY_UPARROW,
          extendedKey: true,
          keyTransition: 'keydown',
          messageLongParameter: (0x48 << 16) | LPARAM_EXTENDED_FLAG,
          scanCode: 0x48,
          ticIndex: 12,
          type: 'keyboard',
        },
        {
          arrivalIndex: 3,
          deltaX: 1,
          deltaY: 0,
          ticIndex: 12,
          type: 'mouse-motion',
        },
      ],
    };

    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: 12,
        trace: reorderedReplayTrace,
        traceCursor: 0,
      }),
    ).toThrow('Replay arrival order must increase within tic 12.');
  });

  test('rejects a traceCursor positioned past a pending earlier tic', () => {
    const replayTrace = createReplayTrace();

    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: 13,
        trace: replayTrace,
        traceCursor: 0,
      }),
    ).toThrow('Replay traceCursor skipped pending tic 12.');
  });

  test('returns an empty result and leaves the cursor unchanged when no events match the requested tic', () => {
    const replayTrace = createReplayTrace();

    const replayResult = replayDeterministicInput({
      runtimeCommand: 'bun run doom.ts',
      ticIndex: 11,
      trace: replayTrace,
      traceCursor: 0,
    });

    expect(replayResult.consumedEvents).toEqual([]);
    expect(replayResult.nextCursor).toBe(0);
    expect(replayResult.ticCommand).toBe(EMPTY_TICCMD);
    expect(replayResult.ticCommandSize).toBe(TICCMD_SIZE);
  });

  test('returns an empty result when the cursor is already at the end of the trace', () => {
    const replayTrace = createReplayTrace();

    const replayResult = replayDeterministicInput({
      runtimeCommand: 'bun run doom.ts',
      ticIndex: 99,
      trace: replayTrace,
      traceCursor: replayTrace.events.length,
    });

    expect(replayResult.consumedEvents).toEqual([]);
    expect(replayResult.nextCursor).toBe(replayTrace.events.length);
  });

  test('returns an empty result when the trace contains no events at all', () => {
    const replayTrace = createReplayTrace();
    const emptyReplayTrace: ReplayInputTrace = {
      events: [],
      header: replayTrace.header,
    };

    const replayResult = replayDeterministicInput({
      runtimeCommand: 'bun run doom.ts',
      ticIndex: 0,
      trace: emptyReplayTrace,
      traceCursor: 0,
    });

    expect(replayResult.consumedEvents).toEqual([]);
    expect(replayResult.nextCursor).toBe(0);
  });

  test('rejects a non-integer ticIndex', () => {
    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: 1.5,
        trace: createReplayTrace(),
        traceCursor: 0,
      }),
    ).toThrow('Replay ticIndex must be an integer.');
  });

  test('rejects a negative ticIndex', () => {
    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: -1,
        trace: createReplayTrace(),
        traceCursor: 0,
      }),
    ).toThrow('Replay ticIndex cannot be negative.');
  });

  test('rejects a traceCursor outside the trace bounds', () => {
    const replayTrace = createReplayTrace();

    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: 12,
        trace: replayTrace,
        traceCursor: -1,
      }),
    ).toThrow('Replay traceCursor is outside the trace bounds.');

    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: 12,
        trace: replayTrace,
        traceCursor: replayTrace.events.length + 1,
      }),
    ).toThrow('Replay traceCursor is outside the trace bounds.');
  });

  test('rejects a header runtimeCommand mismatch', () => {
    const replayTrace = createReplayTrace();
    const driftingHeaderReplayTrace: ReplayInputTrace = {
      events: replayTrace.events,
      header: { ...replayTrace.header, runtimeCommand: 'bun run src/main.ts' },
    };

    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: 12,
        trace: driftingHeaderReplayTrace,
        traceCursor: 0,
      }),
    ).toThrow('Replay trace runtime command mismatch.');
  });

  test('rejects a header traceSchemaVersion mismatch', () => {
    const replayTrace = createReplayTrace();
    const driftingHeaderReplayTrace: ReplayInputTrace = {
      events: replayTrace.events,
      header: { ...replayTrace.header, traceSchemaVersion: 2 },
    };

    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: 12,
        trace: driftingHeaderReplayTrace,
        traceCursor: 0,
      }),
    ).toThrow('Replay trace schema version must be 1.');
  });

  test('rejects a header ticCommandSize mismatch', () => {
    const replayTrace = createReplayTrace();
    const driftingHeaderReplayTrace: ReplayInputTrace = {
      events: replayTrace.events,
      header: { ...replayTrace.header, ticCommandSize: TICCMD_SIZE + 1 },
    };

    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: 12,
        trace: driftingHeaderReplayTrace,
        traceCursor: 0,
      }),
    ).toThrow(`Replay trace ticCommandSize must be ${TICCMD_SIZE}.`);
  });

  test('rejects a header neutralTicCommand that is not the empty ticcmd', () => {
    const replayTrace = createReplayTrace();
    const driftingHeaderReplayTrace: ReplayInputTrace = {
      events: replayTrace.events,
      header: {
        ...replayTrace.header,
        neutralTicCommand: { ...EMPTY_TICCMD, forwardmove: 1 },
      },
    };

    expect(() =>
      replayDeterministicInput({
        runtimeCommand: 'bun run doom.ts',
        ticIndex: 12,
        trace: driftingHeaderReplayTrace,
        traceCursor: 0,
      }),
    ).toThrow('Replay trace neutralTicCommand mismatch.');
  });

  test('resumes consumption from a non-zero cursor at the requested tic', () => {
    const replayTrace = createReplayTrace();

    const replayResult = replayDeterministicInput({
      runtimeCommand: 'bun run doom.ts',
      ticIndex: 13,
      trace: replayTrace,
      traceCursor: 3,
    });

    expect(replayResult.consumedEvents).toEqual(replayTrace.events.slice(3, 4));
    expect(replayResult.nextCursor).toBe(4);
  });
});
