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
