import { describe, expect, test } from 'bun:test';

import {
  BUN_WIN32_AUDIO_HOST_BUFFER_SAMPLE_COUNT,
  BUN_WIN32_AUDIO_HOST_CHANNEL_COUNT,
  BUN_WIN32_AUDIO_HOST_KIND,
  BUN_WIN32_AUDIO_HOST_PLATFORM,
  BUN_WIN32_AUDIO_HOST_PROVIDER,
  BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND,
  BUN_WIN32_AUDIO_HOST_SAMPLE_RATE_HZ,
  LIVE_AUDIO_HOST_AUDIT_STEP_ID,
  LIVE_AUDIO_HOST_NULL_SURFACE,
  OPEN_AUDIO_HOST_TRANSITION,
  selectAndOpenBunWin32AudioHost,
} from '../../../src/playable/audio-product-integration/selectAndOpenBunWin32AudioHost.ts';
import type {
  BunWin32AudioHostDeviceOpenReceipt,
  BunWin32AudioHostDeviceOpenRequest,
  BunWin32AudioHostDeviceRole,
  SelectAndOpenBunWin32AudioHostReplayEvidence,
} from '../../../src/playable/audio-product-integration/selectAndOpenBunWin32AudioHost.ts';

const AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-011-audit-missing-live-audio.json';
const MODULE_PATH = 'src/playable/audio-product-integration/selectAndOpenBunWin32AudioHost.ts';

function createDeterministicOpener(openedRequests: BunWin32AudioHostDeviceOpenRequest[]): (request: BunWin32AudioHostDeviceOpenRequest) => BunWin32AudioHostDeviceOpenReceipt {
  return (request) => {
    openedRequests.push(request);
    return Object.freeze({
      deviceName: `waveOut:${request.role}:0`,
      handle: request.role === 'sfx' ? 0x1001n : 0x2002n,
      role: request.role,
    });
  };
}

function sha256(text: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(text);
  return hasher.digest('hex');
}

describe('selectAndOpenBunWin32AudioHost', () => {
  test('locks the Bun command contract and missing-audio audit linkage', async () => {
    const auditManifestText = await Bun.file(AUDIT_MANIFEST_PATH).text();

    expect(BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(LIVE_AUDIO_HOST_AUDIT_STEP_ID).toBe('01-011');
    expect(LIVE_AUDIO_HOST_NULL_SURFACE).toBe('live-audio-host');
    expect(auditManifestText).toContain('"schemaVersion": 1');
    expect(auditManifestText).toContain('"runtimeCommand": "bun run doom.ts"');
    expect(auditManifestText).toContain('"name": "live-audio-host"');
    expect(auditManifestText).toContain('"path": null');
    expect(auditManifestText).toContain('"dependencyName": "@bun-win32/winmm"');
  });

  test('opens deterministic music and sfx devices while keeping replay evidence handle-free', () => {
    const openedRequests: BunWin32AudioHostDeviceOpenRequest[] = [];
    const result = selectAndOpenBunWin32AudioHost({
      openDevice: createDeterministicOpener(openedRequests),
      openedAtTic: 35,
      platform: BUN_WIN32_AUDIO_HOST_PLATFORM,
      runtimeCommand: BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND,
    });
    const expectedSelectedRoles = Object.freeze<BunWin32AudioHostDeviceRole[]>(['music', 'sfx']);
    const expectedReplayEvidence: SelectAndOpenBunWin32AudioHostReplayEvidence = Object.freeze({
      bufferSampleCount: BUN_WIN32_AUDIO_HOST_BUFFER_SAMPLE_COUNT,
      channelCount: BUN_WIN32_AUDIO_HOST_CHANNEL_COUNT,
      hostKind: BUN_WIN32_AUDIO_HOST_KIND,
      openedAtTic: 35,
      platform: BUN_WIN32_AUDIO_HOST_PLATFORM,
      provider: BUN_WIN32_AUDIO_HOST_PROVIDER,
      runtimeCommand: BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND,
      sampleRateHz: BUN_WIN32_AUDIO_HOST_SAMPLE_RATE_HZ,
      selectedRoles: expectedSelectedRoles,
      sourceAuditStepId: LIVE_AUDIO_HOST_AUDIT_STEP_ID,
      sourceNullSurface: LIVE_AUDIO_HOST_NULL_SURFACE,
      transition: OPEN_AUDIO_HOST_TRANSITION,
    });

    expect(openedRequests).toEqual([
      {
        bufferSampleCount: BUN_WIN32_AUDIO_HOST_BUFFER_SAMPLE_COUNT,
        channelCount: BUN_WIN32_AUDIO_HOST_CHANNEL_COUNT,
        hostKind: BUN_WIN32_AUDIO_HOST_KIND,
        provider: BUN_WIN32_AUDIO_HOST_PROVIDER,
        role: 'music',
        sampleRateHz: BUN_WIN32_AUDIO_HOST_SAMPLE_RATE_HZ,
      },
      {
        bufferSampleCount: BUN_WIN32_AUDIO_HOST_BUFFER_SAMPLE_COUNT,
        channelCount: BUN_WIN32_AUDIO_HOST_CHANNEL_COUNT,
        hostKind: BUN_WIN32_AUDIO_HOST_KIND,
        provider: BUN_WIN32_AUDIO_HOST_PROVIDER,
        role: 'sfx',
        sampleRateHz: BUN_WIN32_AUDIO_HOST_SAMPLE_RATE_HZ,
      },
    ]);
    expect(result).toEqual({
      deterministicReplayCompatible: true,
      liveDevices: [
        { deviceName: 'waveOut:music:0', handle: 0x2002n, role: 'music' },
        { deviceName: 'waveOut:sfx:0', handle: 0x1001n, role: 'sfx' },
      ],
      replayEvidence: expectedReplayEvidence,
      selection: {
        bufferSampleCount: BUN_WIN32_AUDIO_HOST_BUFFER_SAMPLE_COUNT,
        channelCount: BUN_WIN32_AUDIO_HOST_CHANNEL_COUNT,
        hostKind: BUN_WIN32_AUDIO_HOST_KIND,
        platform: BUN_WIN32_AUDIO_HOST_PLATFORM,
        provider: BUN_WIN32_AUDIO_HOST_PROVIDER,
        runtimeCommand: BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND,
        sampleRateHz: BUN_WIN32_AUDIO_HOST_SAMPLE_RATE_HZ,
      },
      transition: OPEN_AUDIO_HOST_TRANSITION,
    });
    expect(JSON.stringify(result.replayEvidence)).not.toContain('handle');
    expect(sha256(JSON.stringify(result.replayEvidence))).toBe('8e1ce622d9400b790aee5d76f750f2eae9d9b2a862ef5a865a55a9d65a62add1');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.liveDevices)).toBe(true);
    expect(Object.isFrozen(result.replayEvidence)).toBe(true);
    expect(Object.isFrozen(result.selection)).toBe(true);
    for (const device of result.liveDevices) {
      expect(Object.isFrozen(device)).toBe(true);
    }
  });

  test('rejects the old launcher command before opening any device', () => {
    const openedRequests: BunWin32AudioHostDeviceOpenRequest[] = [];

    expect(() =>
      selectAndOpenBunWin32AudioHost({
        openDevice: createDeterministicOpener(openedRequests),
        openedAtTic: 0,
        platform: BUN_WIN32_AUDIO_HOST_PLATFORM,
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('audio host requires runtime command bun run doom.ts, got bun run src/main.ts');
    expect(openedRequests).toEqual([]);
  });

  test('rejects non-win32 platforms before opening any device', () => {
    const openedRequests: BunWin32AudioHostDeviceOpenRequest[] = [];

    expect(() =>
      selectAndOpenBunWin32AudioHost({
        openDevice: createDeterministicOpener(openedRequests),
        openedAtTic: 0,
        platform: 'darwin',
        runtimeCommand: BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND,
      }),
    ).toThrow('audio host requires platform win32, got darwin');
    expect(openedRequests).toEqual([]);
  });

  test('rejects negative, fractional, NaN, and Infinity openedAtTic values before opening any device', () => {
    const openedRequests: BunWin32AudioHostDeviceOpenRequest[] = [];

    for (const badTic of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        selectAndOpenBunWin32AudioHost({
          openDevice: createDeterministicOpener(openedRequests),
          openedAtTic: badTic,
          platform: BUN_WIN32_AUDIO_HOST_PLATFORM,
          runtimeCommand: BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND,
        }),
      ).toThrow(`openedAtTic must be a non-negative integer, got ${badTic}`);
    }
    expect(openedRequests).toEqual([]);
  });

  test('rejects non-positive override values before opening any device', () => {
    const openedRequests: BunWin32AudioHostDeviceOpenRequest[] = [];

    for (const [field, badValue] of [
      ['bufferSampleCount', 0],
      ['bufferSampleCount', -1],
      ['bufferSampleCount', 1.5],
      ['channelCount', 0],
      ['channelCount', Number.NaN],
      ['sampleRateHz', 0],
      ['sampleRateHz', Number.POSITIVE_INFINITY],
    ] as const) {
      expect(() =>
        selectAndOpenBunWin32AudioHost({
          [field]: badValue,
          openDevice: createDeterministicOpener(openedRequests),
          openedAtTic: 0,
          platform: BUN_WIN32_AUDIO_HOST_PLATFORM,
          runtimeCommand: BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND,
        }),
      ).toThrow(`${field} must be a positive integer, got ${badValue}`);
    }
    expect(openedRequests).toEqual([]);
  });

  test('accepts undefined overrides and falls back to defaults', () => {
    const openedRequests: BunWin32AudioHostDeviceOpenRequest[] = [];
    const result = selectAndOpenBunWin32AudioHost({
      bufferSampleCount: undefined,
      channelCount: undefined,
      openDevice: createDeterministicOpener(openedRequests),
      openedAtTic: 0,
      platform: BUN_WIN32_AUDIO_HOST_PLATFORM,
      runtimeCommand: BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND,
      sampleRateHz: undefined,
    });

    expect(result.selection.bufferSampleCount).toBe(BUN_WIN32_AUDIO_HOST_BUFFER_SAMPLE_COUNT);
    expect(result.selection.channelCount).toBe(BUN_WIN32_AUDIO_HOST_CHANNEL_COUNT);
    expect(result.selection.sampleRateHz).toBe(BUN_WIN32_AUDIO_HOST_SAMPLE_RATE_HZ);
  });

  test('rejects an opener receipt whose role does not match the requested role and closes prior opens', () => {
    const openedRequests: BunWin32AudioHostDeviceOpenRequest[] = [];
    const closedReceipts: BunWin32AudioHostDeviceOpenReceipt[] = [];
    const opener = (request: BunWin32AudioHostDeviceOpenRequest): BunWin32AudioHostDeviceOpenReceipt => {
      openedRequests.push(request);
      return Object.freeze({
        deviceName: `waveOut:${request.role}:0`,
        handle: request.role === 'sfx' ? 0x1001n : 0x2002n,
        role: 'music',
      });
    };

    expect(() =>
      selectAndOpenBunWin32AudioHost({
        closeDevice: (receipt) => {
          closedReceipts.push(receipt);
        },
        openDevice: opener,
        openedAtTic: 0,
        platform: BUN_WIN32_AUDIO_HOST_PLATFORM,
        runtimeCommand: BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND,
      }),
    ).toThrow('audio host opener returned role music for sfx');
    expect(openedRequests.map((r) => r.role)).toEqual(['music', 'sfx']);
    expect(closedReceipts.map((r) => r.handle)).toEqual([0x2002n, 0x1001n]);
  });

  test('rejects an opener receipt with empty device name and closes prior opens', () => {
    const openedRequests: BunWin32AudioHostDeviceOpenRequest[] = [];
    const closedReceipts: BunWin32AudioHostDeviceOpenReceipt[] = [];
    const opener = (request: BunWin32AudioHostDeviceOpenRequest): BunWin32AudioHostDeviceOpenReceipt => {
      openedRequests.push(request);
      return Object.freeze({
        deviceName: request.role === 'sfx' ? '' : `waveOut:${request.role}:0`,
        handle: request.role === 'sfx' ? 0x1001n : 0x2002n,
        role: request.role,
      });
    };

    expect(() =>
      selectAndOpenBunWin32AudioHost({
        closeDevice: (receipt) => {
          closedReceipts.push(receipt);
        },
        openDevice: opener,
        openedAtTic: 0,
        platform: BUN_WIN32_AUDIO_HOST_PLATFORM,
        runtimeCommand: BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND,
      }),
    ).toThrow('audio host opener returned an empty device name for sfx');
    expect(closedReceipts.map((r) => r.role)).toEqual(['music', 'sfx']);
  });

  test('rejects an opener receipt with non-positive handle and closes prior opens', () => {
    const closedReceipts: BunWin32AudioHostDeviceOpenReceipt[] = [];
    const opener = (request: BunWin32AudioHostDeviceOpenRequest): BunWin32AudioHostDeviceOpenReceipt =>
      Object.freeze({
        deviceName: `waveOut:${request.role}:0`,
        handle: request.role === 'sfx' ? 0n : 0x2002n,
        role: request.role,
      });

    expect(() =>
      selectAndOpenBunWin32AudioHost({
        closeDevice: (receipt) => {
          closedReceipts.push(receipt);
        },
        openDevice: opener,
        openedAtTic: 0,
        platform: BUN_WIN32_AUDIO_HOST_PLATFORM,
        runtimeCommand: BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND,
      }),
    ).toThrow('audio host opener returned an invalid handle for sfx');
    expect(closedReceipts.map((r) => r.handle)).toEqual([0x2002n, 0n]);
  });

  test('closes already-opened devices when a later open throws', () => {
    const openedRequests: BunWin32AudioHostDeviceOpenRequest[] = [];
    const closedReceipts: BunWin32AudioHostDeviceOpenReceipt[] = [];
    const opener = (request: BunWin32AudioHostDeviceOpenRequest): BunWin32AudioHostDeviceOpenReceipt => {
      openedRequests.push(request);
      if (request.role === 'sfx') {
        throw new Error('waveOutOpen failed for sfx');
      }
      return Object.freeze({
        deviceName: `waveOut:${request.role}:0`,
        handle: 0x2002n,
        role: request.role,
      });
    };

    expect(() =>
      selectAndOpenBunWin32AudioHost({
        closeDevice: (receipt) => {
          closedReceipts.push(receipt);
        },
        openDevice: opener,
        openedAtTic: 0,
        platform: BUN_WIN32_AUDIO_HOST_PLATFORM,
        runtimeCommand: BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND,
      }),
    ).toThrow('waveOutOpen failed for sfx');
    expect(openedRequests.map((r) => r.role)).toEqual(['music', 'sfx']);
    expect(closedReceipts.map((r) => r.role)).toEqual(['music']);
  });

  test('still re-throws when no closer is provided and never returns a partial result', () => {
    const openedRequests: BunWin32AudioHostDeviceOpenRequest[] = [];
    const opener = (request: BunWin32AudioHostDeviceOpenRequest): BunWin32AudioHostDeviceOpenReceipt => {
      openedRequests.push(request);
      if (request.role === 'sfx') {
        throw new Error('waveOutOpen failed for sfx');
      }
      return Object.freeze({
        deviceName: `waveOut:${request.role}:0`,
        handle: 0x2002n,
        role: request.role,
      });
    };

    expect(() =>
      selectAndOpenBunWin32AudioHost({
        openDevice: opener,
        openedAtTic: 0,
        platform: BUN_WIN32_AUDIO_HOST_PLATFORM,
        runtimeCommand: BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND,
      }),
    ).toThrow('waveOutOpen failed for sfx');
    expect(openedRequests.map((r) => r.role)).toEqual(['music', 'sfx']);
  });

  test('swallows closer failures so the original error is preserved', () => {
    const opener = (request: BunWin32AudioHostDeviceOpenRequest): BunWin32AudioHostDeviceOpenReceipt => {
      if (request.role === 'sfx') {
        throw new Error('waveOutOpen failed for sfx');
      }
      return Object.freeze({
        deviceName: `waveOut:${request.role}:0`,
        handle: 0x2002n,
        role: request.role,
      });
    };

    expect(() =>
      selectAndOpenBunWin32AudioHost({
        closeDevice: () => {
          throw new Error('closer should not mask original failure');
        },
        openDevice: opener,
        openedAtTic: 0,
        platform: BUN_WIN32_AUDIO_HOST_PLATFORM,
        runtimeCommand: BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND,
      }),
    ).toThrow('waveOutOpen failed for sfx');
  });

  test('locks the source hash for the selected host surface', async () => {
    const sourceText = await Bun.file(MODULE_PATH).text();

    expect(sha256(sourceText)).toBe('c54b69b523fd7cd2a15ebd1087ae51a0f5474215d111c2760905d288b8e53e4a');
  });
});
