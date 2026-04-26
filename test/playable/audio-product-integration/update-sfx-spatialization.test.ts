import { expect, test } from 'bun:test';

import type { UpdateSfxSpatializationRequest } from '../../../src/playable/audio-product-integration/updateSfxSpatialization.ts';
import { UPDATE_SFX_SPATIALIZATION_AUDIT_MANIFEST_PATH, UPDATE_SFX_SPATIALIZATION_CHANNEL_COUNT, UPDATE_SFX_SPATIALIZATION_COMMAND, updateSfxSpatialization } from '../../../src/playable/audio-product-integration/updateSfxSpatialization.ts';

const UPDATE_SFX_SPATIALIZATION_SOURCE_PATH = 'src/playable/audio-product-integration/updateSfxSpatialization.ts';
const UPDATE_SFX_SPATIALIZATION_SOURCE_SHA256 = '86e86eabe1ad588309e6f71770f9c34a0fc0639f58e7b597492c6cbaa0817742';

interface MissingLiveAudioAuditManifest {
  readonly commandContracts: {
    readonly target: {
      readonly runtimeCommand: string;
    };
  };
  readonly explicitNullSurfaces: readonly {
    readonly name: string;
  }[];
  readonly schemaVersion: number;
}

function createSpatializationRequest(): UpdateSfxSpatializationRequest {
  return {
    channels: [
      { channelIndex: 0, origin: null, pitch: 127, priority: 64, soundEffectId: 1, sourcePosition: null },
      { channelIndex: 1, origin: 2, pitch: 119, priority: 80, soundEffectId: 32, sourcePosition: { x: 0, y: 0 } },
      { channelIndex: 2, origin: 3, pitch: 133, priority: 90, soundEffectId: 8, sourcePosition: { x: 65_536, y: 0 } },
      { channelIndex: 3, origin: 4, pitch: 101, priority: 120, soundEffectId: 44, sourcePosition: { x: 200_000_000, y: 0 } },
      { channelIndex: 4, origin: null, pitch: 0, priority: 0, soundEffectId: null, sourcePosition: null },
      { channelIndex: 5, origin: null, pitch: 0, priority: 0, soundEffectId: null, sourcePosition: null },
      { channelIndex: 6, origin: null, pitch: 0, priority: 0, soundEffectId: null, sourcePosition: null },
      { channelIndex: 7, origin: null, pitch: 0, priority: 0, soundEffectId: null, sourcePosition: null },
    ],
    isBossMap: false,
    listener: { x: 0, y: 0, angle: 0 },
    listenerOrigin: 2,
    runtimeCommand: UPDATE_SFX_SPATIALIZATION_COMMAND,
    soundEffectVolume: 12,
  };
}

async function readMissingLiveAudioAuditManifest(): Promise<MissingLiveAudioAuditManifest> {
  return (await Bun.file(UPDATE_SFX_SPATIALIZATION_AUDIT_MANIFEST_PATH).json()) as MissingLiveAudioAuditManifest;
}

async function sourceSha256(): Promise<string> {
  const sourceBytes = await Bun.file(UPDATE_SFX_SPATIALIZATION_SOURCE_PATH).arrayBuffer();
  return new Bun.CryptoHasher('sha256').update(sourceBytes).digest('hex');
}

test('locks the Bun command contract and missing-live-audio audit linkage', async () => {
  const manifest = await readMissingLiveAudioAuditManifest();

  expect(UPDATE_SFX_SPATIALIZATION_COMMAND).toBe('bun run doom.ts');
  expect(UPDATE_SFX_SPATIALIZATION_CHANNEL_COUNT).toBe(8);
  expect(UPDATE_SFX_SPATIALIZATION_AUDIT_MANIFEST_PATH).toBe('plan_fps/manifests/01-011-audit-missing-live-audio.json');
  expect(manifest.schemaVersion).toBe(1);
  expect(manifest.commandContracts.target.runtimeCommand).toBe(UPDATE_SFX_SPATIALIZATION_COMMAND);
  expect(manifest.explicitNullSurfaces.map((surface) => surface.name)).toContain('live-sfx-mixer');
});

test('locks the update-sfx-spatialization source hash', async () => {
  expect(await sourceSha256()).toBe(UPDATE_SFX_SPATIALIZATION_SOURCE_SHA256);
});

test('returns exact handle-free spatialization transition evidence', () => {
  const result = updateSfxSpatialization(createSpatializationRequest());

  expect(result).toEqual({
    audibleChannelCount: 3,
    auditManifestPath: UPDATE_SFX_SPATIALIZATION_AUDIT_MANIFEST_PATH,
    channelCount: UPDATE_SFX_SPATIALIZATION_CHANNEL_COUNT,
    mixerActions: [
      {
        channelIndex: 0,
        kind: 'update',
        origin: null,
        pitch: 127,
        priority: 64,
        separation: 128,
        soundEffectId: 1,
        volume: 12,
      },
      {
        channelIndex: 1,
        kind: 'update',
        origin: 2,
        pitch: 119,
        priority: 80,
        separation: 128,
        soundEffectId: 32,
        volume: 12,
      },
      {
        channelIndex: 2,
        kind: 'update',
        origin: 3,
        pitch: 133,
        priority: 90,
        separation: 129,
        soundEffectId: 8,
        volume: 12,
      },
      {
        channelIndex: 3,
        kind: 'stop',
        origin: 4,
        priority: 120,
        reason: 'inaudible',
        soundEffectId: 44,
      },
    ],
    replayChecksum: 671_174_861,
    replaySignature: '0:update:null:1:12:128:127:64|1:update:2:32:12:128:119:80|2:update:3:8:12:129:133:90|3:stop:4:44:120|4:empty|5:empty|6:empty|7:empty',
    runtimeCommand: UPDATE_SFX_SPATIALIZATION_COMMAND,
    stoppedChannelCount: 1,
    updatedChannelCount: 3,
  });
  expect(JSON.stringify(result)).not.toContain('handle');
});

test('rejects non-Bun runtime commands', () => {
  expect(() =>
    updateSfxSpatialization({
      ...createSpatializationRequest(),
      runtimeCommand: 'node doom.ts',
    }),
  ).toThrow('updateSfxSpatialization requires bun run doom.ts');
});

test('rejects invalid remote channel snapshots without mutating the request', () => {
  const request = createSpatializationRequest();
  const brokenRequest = {
    ...request,
    channels: request.channels.map((channel) => (channel.channelIndex === 2 ? { ...channel, sourcePosition: null } : channel)),
  };
  const before = JSON.stringify(brokenRequest);

  expect(() => updateSfxSpatialization(brokenRequest)).toThrow('channel 2 remote origin 3 requires sourcePosition');
  expect(JSON.stringify(brokenRequest)).toBe(before);
});

function createSingleChannelRequest(channel: UpdateSfxSpatializationRequest['channels'][number], overrides: Partial<UpdateSfxSpatializationRequest> = {}): UpdateSfxSpatializationRequest {
  const padded = [
    channel,
    { channelIndex: 1, origin: null, pitch: 0, priority: 0, soundEffectId: null, sourcePosition: null },
    { channelIndex: 2, origin: null, pitch: 0, priority: 0, soundEffectId: null, sourcePosition: null },
    { channelIndex: 3, origin: null, pitch: 0, priority: 0, soundEffectId: null, sourcePosition: null },
    { channelIndex: 4, origin: null, pitch: 0, priority: 0, soundEffectId: null, sourcePosition: null },
    { channelIndex: 5, origin: null, pitch: 0, priority: 0, soundEffectId: null, sourcePosition: null },
    { channelIndex: 6, origin: null, pitch: 0, priority: 0, soundEffectId: null, sourcePosition: null },
    { channelIndex: 7, origin: null, pitch: 0, priority: 0, soundEffectId: null, sourcePosition: null },
  ];
  return {
    channels: padded,
    isBossMap: false,
    listener: { x: 0, y: 0, angle: 0 },
    listenerOrigin: null,
    runtimeCommand: UPDATE_SFX_SPATIALIZATION_COMMAND,
    soundEffectVolume: 12,
    ...overrides,
  };
}

test('normalizes origin 0 to null and skips the spatial calculation', () => {
  const result = updateSfxSpatialization(createSingleChannelRequest({ channelIndex: 0, origin: 0, pitch: 60, priority: 10, soundEffectId: 7, sourcePosition: { x: 65_536, y: 0 } }, { listenerOrigin: 9 }));

  expect(result.mixerActions[0]).toEqual({
    channelIndex: 0,
    kind: 'update',
    origin: null,
    pitch: 60,
    priority: 10,
    separation: 128,
    soundEffectId: 7,
    volume: 12,
  });
  expect(result.audibleChannelCount).toBe(1);
  expect(result.stoppedChannelCount).toBe(0);
});

test('forces separation to NORM_SEP when source position matches listener exactly', () => {
  const result = updateSfxSpatialization(
    createSingleChannelRequest({ channelIndex: 0, origin: 5, pitch: 70, priority: 20, soundEffectId: 3, sourcePosition: { x: 1024, y: 2048 } }, { listener: { x: 1024, y: 2048, angle: 0 }, listenerOrigin: 99 }),
  );

  expect(result.mixerActions[0]).toEqual({
    channelIndex: 0,
    kind: 'update',
    origin: 5,
    pitch: 70,
    priority: 20,
    separation: 128,
    soundEffectId: 3,
    volume: 12,
  });
});

test('keeps a remote source audible at long distance under boss-map floor', () => {
  const result = updateSfxSpatialization(
    createSingleChannelRequest({ channelIndex: 0, origin: 5, pitch: 80, priority: 30, soundEffectId: 4, sourcePosition: { x: 200_000_000, y: 0 } }, { isBossMap: true, listenerOrigin: 99, soundEffectVolume: 15 }),
  );

  const action = result.mixerActions[0];
  expect(action.kind).toBe('update');
  if (action.kind !== 'update') {
    throw new Error('Expected boss-map far source to remain audible.');
  }
  expect(action.volume).toBe(15);
  expect(action.origin).toBe(5);
  expect(action.soundEffectId).toBe(4);
  expect(result.audibleChannelCount).toBe(1);
  expect(result.stoppedChannelCount).toBe(0);
});

test('treats listenerOrigin null as a distinct origin and runs the spatial calculation for any non-null channel origin', () => {
  const farResult = updateSfxSpatialization(createSingleChannelRequest({ channelIndex: 0, origin: 5, pitch: 90, priority: 40, soundEffectId: 6, sourcePosition: { x: 200_000_000, y: 0 } }, { listenerOrigin: null }));

  expect(farResult.mixerActions[0]).toEqual({
    channelIndex: 0,
    kind: 'stop',
    origin: 5,
    priority: 40,
    reason: 'inaudible',
    soundEffectId: 6,
  });
  expect(farResult.stoppedChannelCount).toBe(1);
  expect(farResult.audibleChannelCount).toBe(0);
});

test('rejects out-of-range soundEffectVolume and pitch and a negative priority', () => {
  for (const badVolume of [-1, 16, 1.5, Number.NaN]) {
    expect(() => updateSfxSpatialization({ ...createSpatializationRequest(), soundEffectVolume: badVolume })).toThrow('soundEffectVolume must be an integer in [0, 15]');
  }

  const badPitchRequest = createSpatializationRequest();
  expect(() =>
    updateSfxSpatialization({
      ...badPitchRequest,
      channels: badPitchRequest.channels.map((channel) => (channel.channelIndex === 0 ? { ...channel, pitch: 256 } : channel)),
    }),
  ).toThrow('channel 0 pitch must be an integer in [0, 255]');

  const badPriorityRequest = createSpatializationRequest();
  expect(() =>
    updateSfxSpatialization({
      ...badPriorityRequest,
      channels: badPriorityRequest.channels.map((channel) => (channel.channelIndex === 0 ? { ...channel, priority: -1 } : channel)),
    }),
  ).toThrow('channel 0 priority must be a non-negative integer');
});

test('rejects a wrong channel count and an out-of-order channel index', () => {
  expect(() => updateSfxSpatialization({ ...createSpatializationRequest(), channels: [] })).toThrow('updateSfxSpatialization requires exactly 8 channels, got 0');

  const renumberedRequest = createSpatializationRequest();
  expect(() =>
    updateSfxSpatialization({
      ...renumberedRequest,
      channels: renumberedRequest.channels.map((channel, channelIndex) => (channelIndex === 0 ? { ...channel, channelIndex: 1 } : channel)),
    }),
  ).toThrow('channelIndex must be 0, got 1');
});
