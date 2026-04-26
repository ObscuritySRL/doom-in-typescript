import { describe, expect, it } from 'bun:test';

import { EMPTY_TICCMD, TICCMD_SIZE } from '../../../src/input/ticcmd.ts';
import { KEY_ESCAPE, KEY_RCTRL, LPARAM_EXTENDED_FLAG } from '../../../src/input/keyboard.ts';
import { RECORD_INPUT_TRACE_FORMAT_CONTRACT, recordInputTraceFormat } from '../../../src/playable/input/recordInputTraceFormat.ts';

interface AuditMissingLiveInputManifest {
  readonly explicitNullSurfaces: readonly {
    readonly reason: string;
    readonly surface: string;
  }[];
  readonly stepId: string;
}

const EXPECTED_CONTRACT = {
  auditStepId: '01-010',
  auditSurface: 'input-trace-recording',
  deterministicReplayCompatibility: 'tic-indexed-arrival-order',
  keyboardEncoding: 'scan-code-and-doom-key',
  neutralTicCommand: EMPTY_TICCMD,
  runtimeCommand: 'bun run doom.ts',
  schemaVersion: 1,
  ticCommandSize: TICCMD_SIZE,
  traceSources: ['keyboard', 'mouse-button', 'mouse-motion', 'scripted-doom-key'],
} as const;

const EXPECTED_CONTRACT_HASH = '455e09bee9c67eec5fd6bd0747c24c30b2e6d0cdaba28bee565f716d52e0dda3';
const EXTENDED_RIGHT_CONTROL_LPARAM = (0x1d << 16) | LPARAM_EXTENDED_FLAG;

function isAuditMissingLiveInputManifest(value: unknown): value is AuditMissingLiveInputManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  if (!('explicitNullSurfaces' in value) || !('stepId' in value)) {
    return false;
  }

  const explicitNullSurfaces = value.explicitNullSurfaces;
  if (!Array.isArray(explicitNullSurfaces)) {
    return false;
  }

  return (
    typeof value.stepId === 'string' &&
    explicitNullSurfaces.every((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return false;
      }

      return 'reason' in entry && typeof entry.reason === 'string' && 'surface' in entry && typeof entry.surface === 'string';
    })
  );
}

async function sha256Hex(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('recordInputTraceFormat', () => {
  it('exports the exact Bun-only trace contract', () => {
    expect(RECORD_INPUT_TRACE_FORMAT_CONTRACT).toEqual(EXPECTED_CONTRACT);
  });

  it('locks the stable SHA-256 contract hash', async () => {
    const contractHash = await sha256Hex(JSON.stringify(RECORD_INPUT_TRACE_FORMAT_CONTRACT));
    expect(contractHash).toBe(EXPECTED_CONTRACT_HASH);
  });

  it('links the trace format contract to the 01-010 missing input audit surface', async () => {
    const parsed = JSON.parse(await Bun.file('plan_fps/manifests/01-010-audit-missing-live-input.json').text());
    if (!isAuditMissingLiveInputManifest(parsed)) {
      throw new Error('01-010 manifest did not match the expected audit shape.');
    }

    expect(parsed.stepId).toBe(RECORD_INPUT_TRACE_FORMAT_CONTRACT.auditStepId);
    expect(
      parsed.explicitNullSurfaces.some((entry) => {
        return entry.reason === 'No live input trace recording surface is visible within the 01-010 read scope.' && entry.surface === RECORD_INPUT_TRACE_FORMAT_CONTRACT.auditSurface;
      }),
    ).toBe(true);
  });

  it('records a deterministic trace that preserves tic order, arrival order, and keyboard translation', () => {
    const trace = recordInputTraceFormat('bun run doom.ts', [
      { lparam: EXTENDED_RIGHT_CONTROL_LPARAM, phase: 'keydown', source: 'keyboard', tic: 0 },
      { mouseX: 4, mouseY: -2, source: 'mouse-motion', tic: 0 },
      { button: 'left', phase: 'down', source: 'mouse-button', tic: 1 },
      { doomKey: KEY_ESCAPE, phase: 'keyup', source: 'scripted-doom-key', tic: 1 },
    ]);

    expect(trace.header).toEqual({
      neutralTicCommand: EMPTY_TICCMD,
      runtimeCommand: 'bun run doom.ts',
      schemaVersion: 1,
      ticCommandSize: TICCMD_SIZE,
    });
    expect(trace.summary).toEqual({
      keyboardEventCount: 1,
      lastTic: 1,
      mouseButtonEventCount: 1,
      mouseMotionEventCount: 1,
      recordedEventCount: 4,
      scriptedEventCount: 1,
    });
    expect(trace.entries).toEqual([
      {
        arrivalOrder: 0,
        doomKey: KEY_RCTRL,
        extendedKey: true,
        lparam: EXTENDED_RIGHT_CONTROL_LPARAM,
        phase: 'keydown',
        scanCode: 0x1d,
        source: 'keyboard',
        tic: 0,
      },
      {
        arrivalOrder: 1,
        mouseX: 4,
        mouseY: -2,
        source: 'mouse-motion',
        tic: 0,
      },
      {
        arrivalOrder: 2,
        button: 'left',
        phase: 'down',
        source: 'mouse-button',
        tic: 1,
      },
      {
        arrivalOrder: 3,
        doomKey: KEY_ESCAPE,
        phase: 'keyup',
        source: 'scripted-doom-key',
        tic: 1,
      },
    ]);
  });

  it('rejects a non-Bun runtime command', () => {
    expect(() => {
      recordInputTraceFormat('bun run src/main.ts', []);
    }).toThrow('Input trace recording requires `bun run doom.ts`.');
  });

  it('rejects out-of-order tics and unsupported keyboard scan codes', () => {
    expect(() => {
      recordInputTraceFormat('bun run doom.ts', [
        { lparam: EXTENDED_RIGHT_CONTROL_LPARAM, phase: 'keydown', source: 'keyboard', tic: 1 },
        { button: 'left', phase: 'up', source: 'mouse-button', tic: 0 },
      ]);
    }).toThrow('Input trace events must be provided in tic order.');

    expect(() => {
      recordInputTraceFormat('bun run doom.ts', [{ lparam: 0, phase: 'keydown', source: 'keyboard', tic: 0 }]);
    }).toThrow('Input trace recording requires mappable keyboard scan codes.');
  });

  it('returns a neutral trace with null lastTic for an empty event list', () => {
    const trace = recordInputTraceFormat('bun run doom.ts', []);

    expect(trace.entries).toEqual([]);
    expect(trace.summary).toEqual({
      keyboardEventCount: 0,
      lastTic: null,
      mouseButtonEventCount: 0,
      mouseMotionEventCount: 0,
      recordedEventCount: 0,
      scriptedEventCount: 0,
    });
    expect(trace.header).toEqual({
      neutralTicCommand: EMPTY_TICCMD,
      runtimeCommand: 'bun run doom.ts',
      schemaVersion: 1,
      ticCommandSize: TICCMD_SIZE,
    });
  });

  it('rejects non-integer, negative, NaN, and Infinity tics', () => {
    const cases: { lparam: number; phase: 'keydown' | 'keyup'; source: 'keyboard'; tic: number }[] = [
      { lparam: EXTENDED_RIGHT_CONTROL_LPARAM, phase: 'keydown', source: 'keyboard', tic: -1 },
      { lparam: EXTENDED_RIGHT_CONTROL_LPARAM, phase: 'keydown', source: 'keyboard', tic: 1.5 },
      { lparam: EXTENDED_RIGHT_CONTROL_LPARAM, phase: 'keydown', source: 'keyboard', tic: Number.NaN },
      { lparam: EXTENDED_RIGHT_CONTROL_LPARAM, phase: 'keydown', source: 'keyboard', tic: Number.POSITIVE_INFINITY },
    ];
    for (const event of cases) {
      expect(() => recordInputTraceFormat('bun run doom.ts', [event])).toThrow('Input trace events must use non-negative integer tics.');
    }
  });

  it('rejects keyboard events with a non-integer lparam or invalid phase', () => {
    expect(() => recordInputTraceFormat('bun run doom.ts', [{ lparam: 1.25, phase: 'keydown', source: 'keyboard', tic: 0 }])).toThrow('Keyboard input trace events must use an integer lparam.');
    expect(() => recordInputTraceFormat('bun run doom.ts', [{ lparam: EXTENDED_RIGHT_CONTROL_LPARAM, phase: 'tap' as 'keydown', source: 'keyboard', tic: 0 }])).toThrow('Keyboard input trace events must use keydown or keyup.');
  });

  it('rejects mouse-motion events with non-integer deltas', () => {
    expect(() => recordInputTraceFormat('bun run doom.ts', [{ mouseX: 0.5, mouseY: 0, source: 'mouse-motion', tic: 0 }])).toThrow('Mouse motion input trace events must use integer deltas.');
    expect(() => recordInputTraceFormat('bun run doom.ts', [{ mouseX: 0, mouseY: Number.NaN, source: 'mouse-motion', tic: 0 }])).toThrow('Mouse motion input trace events must use integer deltas.');
  });

  it('rejects mouse-button events with invalid button labels or phases', () => {
    expect(() => recordInputTraceFormat('bun run doom.ts', [{ button: 'extra' as 'left', phase: 'down', source: 'mouse-button', tic: 0 }])).toThrow('Mouse button input trace events must use left, middle, or right.');
    expect(() => recordInputTraceFormat('bun run doom.ts', [{ button: 'left', phase: 'press' as 'down', source: 'mouse-button', tic: 0 }])).toThrow('Mouse button input trace events must use down or up.');
  });

  it('rejects scripted Doom key events outside the one-byte range or with an invalid phase', () => {
    expect(() => recordInputTraceFormat('bun run doom.ts', [{ doomKey: 0, phase: 'keydown', source: 'scripted-doom-key', tic: 0 }])).toThrow('Scripted Doom key input trace events must use a one-byte Doom key.');
    expect(() => recordInputTraceFormat('bun run doom.ts', [{ doomKey: 256, phase: 'keydown', source: 'scripted-doom-key', tic: 0 }])).toThrow('Scripted Doom key input trace events must use a one-byte Doom key.');
    expect(() => recordInputTraceFormat('bun run doom.ts', [{ doomKey: 1.5, phase: 'keydown', source: 'scripted-doom-key', tic: 0 }])).toThrow('Scripted Doom key input trace events must use a one-byte Doom key.');
    expect(() => recordInputTraceFormat('bun run doom.ts', [{ doomKey: KEY_ESCAPE, phase: 'tap' as 'keydown', source: 'scripted-doom-key', tic: 0 }])).toThrow('Scripted Doom key input trace events must use keydown or keyup.');
  });
});
