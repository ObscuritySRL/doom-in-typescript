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

  test('locks the source hash for the selected host surface', async () => {
    const sourceText = await Bun.file(MODULE_PATH).text();

    expect(sha256(sourceText)).toBe('142bf48061edc02611dd7ca45420fc7f8a9b44e65bea2d79492154b57edd9739');
  });
});
