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
});
