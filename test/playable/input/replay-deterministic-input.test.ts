import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { KEY_UPARROW, LPARAM_EXTENDED_FLAG } from '../../../src/input/keyboard.ts';
import { EMPTY_TICCMD, TICCMD_SIZE } from '../../../src/input/ticcmd.ts';
import { REPLAY_DETERMINISTIC_INPUT_CONTRACT, replayDeterministicInput } from '../../../src/playable/input/replayDeterministicInput.ts';

import type { KeyboardReplayTraceEvent, ReplayInputTrace } from '../../../src/playable/input/replayDeterministicInput.ts';

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
});
