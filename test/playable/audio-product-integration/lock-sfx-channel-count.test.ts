import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import type { SfxChannelSnapshot } from '../../../src/playable/audio-product-integration/lockSfxChannelCount.ts';
import { LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND, LOCKED_SFX_CHANNEL_COUNT, lockSfxChannelCount } from '../../../src/playable/audio-product-integration/lockSfxChannelCount.ts';

const AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-011-audit-missing-live-audio.json';
const SOURCE_PATH = 'src/playable/audio-product-integration/lockSfxChannelCount.ts';

describe('lockSfxChannelCount', () => {
  test('locks the Bun runtime command contract and missing-live-audio audit surface', async () => {
    const auditManifest = await Bun.file(AUDIT_MANIFEST_PATH).json();

    expect(LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(LOCKED_SFX_CHANNEL_COUNT).toBe(8);
    expect(auditManifest).toMatchObject({
      commandContracts: {
        target: {
          entryFile: 'doom.ts',
          runtimeCommand: 'bun run doom.ts',
        },
      },
      schemaVersion: 1,
      step: {
        id: '01-011',
        title: 'audit-missing-live-audio',
      },
    });
    expect(auditManifest.explicitNullSurfaces).toContainEqual({
      name: 'live-sfx-mixer',
      path: null,
      reason: 'No sound-effect mixer route is exposed by src/main.ts.',
    });
  });

  test('locks exact source hash and deterministic eight-channel replay evidence', async () => {
    const sourceText = await Bun.file(SOURCE_PATH).text();
    const sourceSha256 = createHash('sha256').update(sourceText).digest('hex');
    const channelSnapshots = createChannelSnapshots();

    const result = lockSfxChannelCount({
      channelSnapshots,
      runtimeCommand: LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND,
    });

    expect(sourceSha256).toBe('d639d060f1698e9c306a35d5a60afadb0ff52218aa46584a5ff71810c798c50e');
    expect(result).toEqual({
      channelCount: 8,
      emptyChannelCount: 5,
      occupiedChannelCount: 3,
      replayEvidence: {
        channelCount: 8,
        channelIndexMaximum: 7,
        channelIndexMinimum: 0,
        deviceHandlesIncluded: false,
        replayChecksum: 3330980668,
        slotSignatures: [
          'channel=0;origin=100;sfx=1',
          'channel=1;origin=null;sfx=null',
          'channel=2;origin=205;sfx=12',
          'channel=3;origin=null;sfx=null',
          'channel=4;origin=null;sfx=null',
          'channel=5;origin=410;sfx=37',
          'channel=6;origin=null;sfx=null',
          'channel=7;origin=null;sfx=null',
        ],
      },
      runtimeCommand: 'bun run doom.ts',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.replayEvidence)).toBe(true);
    expect(Object.isFrozen(result.replayEvidence.slotSignatures)).toBe(true);
    expect(JSON.stringify(result.replayEvidence)).not.toContain('handle');
  });

  test('rejects non-Bun playable runtime commands', () => {
    expect(() =>
      lockSfxChannelCount({
        channelSnapshots: createChannelSnapshots(),
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('lockSfxChannelCount requires bun run doom.ts');
  });

  test('rejects channel tables that do not contain exactly eight slots', () => {
    expect(() =>
      lockSfxChannelCount({
        channelSnapshots: createChannelSnapshots().slice(0, 7),
        runtimeCommand: LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND,
      }),
    ).toThrow('SFX channel table must contain exactly 8 channels, got 7');
  });

  test('rejects invalid channel transitions before mutating caller snapshots', () => {
    const channelSnapshots = createChannelSnapshots();
    const invalidChannelSnapshots = channelSnapshots.map((channelSnapshot) => (channelSnapshot.channelIndex === 7 ? { ...channelSnapshot, channelIndex: 8 } : channelSnapshot));

    expect(() =>
      lockSfxChannelCount({
        channelSnapshots: invalidChannelSnapshots,
        runtimeCommand: LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND,
      }),
    ).toThrow('SFX channel index 8 must match slot 7');

    expect(channelSnapshots[7]).toEqual({
      channelIndex: 7,
      origin: null,
      sfxId: null,
    });
  });
});

function createChannelSnapshots(): SfxChannelSnapshot[] {
  return [
    { channelIndex: 0, origin: 100, sfxId: 1 },
    { channelIndex: 1, origin: null, sfxId: null },
    { channelIndex: 2, origin: 205, sfxId: 12 },
    { channelIndex: 3, origin: null, sfxId: null },
    { channelIndex: 4, origin: null, sfxId: null },
    { channelIndex: 5, origin: 410, sfxId: 37 },
    { channelIndex: 6, origin: null, sfxId: null },
    { channelIndex: 7, origin: null, sfxId: null },
  ];
}
