import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import type { SfxChannelSnapshot } from '../../../src/playable/audio-product-integration/lockSfxChannelCount.ts';
import { LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND, LOCKED_SFX_CHANNEL_COUNT, SFX_CHANNEL_INDEX_MAXIMUM, SFX_CHANNEL_INDEX_MINIMUM, lockSfxChannelCount } from '../../../src/playable/audio-product-integration/lockSfxChannelCount.ts';

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

  test('locks the exported channel-index minimum and maximum constants to the vanilla 0..7 range', () => {
    expect(SFX_CHANNEL_INDEX_MINIMUM).toBe(0);
    expect(SFX_CHANNEL_INDEX_MAXIMUM).toBe(7);
    expect(SFX_CHANNEL_INDEX_MAXIMUM - SFX_CHANNEL_INDEX_MINIMUM + 1).toBe(LOCKED_SFX_CHANNEL_COUNT);
  });

  test('locks an all-empty channel table to occupied=0, empty=8 with deterministic replay evidence', () => {
    const allEmptySnapshots: SfxChannelSnapshot[] = Array.from({ length: LOCKED_SFX_CHANNEL_COUNT }, (_unused, channelIndex) => ({
      channelIndex,
      origin: null,
      sfxId: null,
    }));

    const result = lockSfxChannelCount({
      channelSnapshots: allEmptySnapshots,
      runtimeCommand: LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND,
    });

    expect(result).toEqual({
      channelCount: 8,
      emptyChannelCount: 8,
      occupiedChannelCount: 0,
      replayEvidence: {
        channelCount: 8,
        channelIndexMaximum: 7,
        channelIndexMinimum: 0,
        deviceHandlesIncluded: false,
        replayChecksum: 1178400533,
        slotSignatures: [
          'channel=0;origin=null;sfx=null',
          'channel=1;origin=null;sfx=null',
          'channel=2;origin=null;sfx=null',
          'channel=3;origin=null;sfx=null',
          'channel=4;origin=null;sfx=null',
          'channel=5;origin=null;sfx=null',
          'channel=6;origin=null;sfx=null',
          'channel=7;origin=null;sfx=null',
        ],
      },
      runtimeCommand: 'bun run doom.ts',
    });
  });

  test('locks an all-occupied channel table to occupied=8, empty=0 with deterministic replay evidence', () => {
    const allOccupiedSnapshots: SfxChannelSnapshot[] = Array.from({ length: LOCKED_SFX_CHANNEL_COUNT }, (_unused, channelIndex) => ({
      channelIndex,
      origin: 100 + channelIndex * 10,
      sfxId: channelIndex + 1,
    }));

    const result = lockSfxChannelCount({
      channelSnapshots: allOccupiedSnapshots,
      runtimeCommand: LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND,
    });

    expect(result).toEqual({
      channelCount: 8,
      emptyChannelCount: 0,
      occupiedChannelCount: 8,
      replayEvidence: {
        channelCount: 8,
        channelIndexMaximum: 7,
        channelIndexMinimum: 0,
        deviceHandlesIncluded: false,
        replayChecksum: 3655650829,
        slotSignatures: [
          'channel=0;origin=100;sfx=1',
          'channel=1;origin=110;sfx=2',
          'channel=2;origin=120;sfx=3',
          'channel=3;origin=130;sfx=4',
          'channel=4;origin=140;sfx=5',
          'channel=5;origin=150;sfx=6',
          'channel=6;origin=160;sfx=7',
          'channel=7;origin=170;sfx=8',
        ],
      },
      runtimeCommand: 'bun run doom.ts',
    });
  });

  test('accepts integer zero for origin and sfxId without confusing them with null', () => {
    const channelSnapshots: SfxChannelSnapshot[] = [
      { channelIndex: 0, origin: 0, sfxId: 0 },
      { channelIndex: 1, origin: null, sfxId: null },
      { channelIndex: 2, origin: 0, sfxId: 0 },
      { channelIndex: 3, origin: null, sfxId: null },
      { channelIndex: 4, origin: null, sfxId: null },
      { channelIndex: 5, origin: null, sfxId: null },
      { channelIndex: 6, origin: null, sfxId: null },
      { channelIndex: 7, origin: null, sfxId: null },
    ];

    const result = lockSfxChannelCount({
      channelSnapshots,
      runtimeCommand: LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND,
    });

    expect(result.occupiedChannelCount).toBe(2);
    expect(result.emptyChannelCount).toBe(6);
    expect(result.replayEvidence.replayChecksum).toBe(3054747893);
    expect(result.replayEvidence.slotSignatures[0]).toBe('channel=0;origin=0;sfx=0');
    expect(result.replayEvidence.slotSignatures[2]).toBe('channel=2;origin=0;sfx=0');
    expect(result.replayEvidence.slotSignatures[1]).toBe('channel=1;origin=null;sfx=null');
  });

  test('rejects non-integer origin values per slot', () => {
    const channelSnapshots = createChannelSnapshots();
    const fractionalOriginSnapshots = channelSnapshots.map((channelSnapshot) => (channelSnapshot.channelIndex === 4 ? { ...channelSnapshot, origin: 100.5 } : channelSnapshot));

    expect(() =>
      lockSfxChannelCount({
        channelSnapshots: fractionalOriginSnapshots,
        runtimeCommand: LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND,
      }),
    ).toThrow('SFX channel 4 origin must be an integer or null');
  });

  test('rejects non-integer sfxId values per slot', () => {
    const channelSnapshots = createChannelSnapshots();
    const nanSfxIdSnapshots = channelSnapshots.map((channelSnapshot) => (channelSnapshot.channelIndex === 5 ? { ...channelSnapshot, sfxId: Number.NaN } : channelSnapshot));

    expect(() =>
      lockSfxChannelCount({
        channelSnapshots: nanSfxIdSnapshots,
        runtimeCommand: LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND,
      }),
    ).toThrow('SFX channel 5 sfxId must be an integer or null');
  });

  test('rejects Infinity origin values per slot', () => {
    const channelSnapshots = createChannelSnapshots();
    const infinityOriginSnapshots = channelSnapshots.map((channelSnapshot) => (channelSnapshot.channelIndex === 0 ? { ...channelSnapshot, origin: Number.POSITIVE_INFINITY } : channelSnapshot));

    expect(() =>
      lockSfxChannelCount({
        channelSnapshots: infinityOriginSnapshots,
        runtimeCommand: LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND,
      }),
    ).toThrow('SFX channel 0 origin must be an integer or null');
  });

  test('rejects channel-index/slot mismatches at the first slot, not just the last', () => {
    const channelSnapshots = createChannelSnapshots();
    const invalidFirstSlotSnapshots = channelSnapshots.map((channelSnapshot) => (channelSnapshot.channelIndex === 0 ? { ...channelSnapshot, channelIndex: 1 } : channelSnapshot));

    expect(() =>
      lockSfxChannelCount({
        channelSnapshots: invalidFirstSlotSnapshots,
        runtimeCommand: LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND,
      }),
    ).toThrow('SFX channel index 1 must match slot 0');
  });

  test('rejects negative channel-index values that would otherwise alias an array sentinel', () => {
    const channelSnapshots = createChannelSnapshots();
    const negativeIndexSnapshots = channelSnapshots.map((channelSnapshot) => (channelSnapshot.channelIndex === 0 ? { ...channelSnapshot, channelIndex: -1 } : channelSnapshot));

    expect(() =>
      lockSfxChannelCount({
        channelSnapshots: negativeIndexSnapshots,
        runtimeCommand: LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND,
      }),
    ).toThrow('SFX channel index -1 must match slot 0');
  });

  test('rejects an empty-string runtimeCommand at the boundary', () => {
    expect(() =>
      lockSfxChannelCount({
        channelSnapshots: createChannelSnapshots(),
        runtimeCommand: '',
      }),
    ).toThrow('lockSfxChannelCount requires bun run doom.ts');
  });

  test('rejects channel-snapshot tables longer than the locked count', () => {
    const channelSnapshots = createChannelSnapshots();
    const overlongSnapshots: SfxChannelSnapshot[] = [...channelSnapshots, { channelIndex: 8, origin: null, sfxId: null }];

    expect(() =>
      lockSfxChannelCount({
        channelSnapshots: overlongSnapshots,
        runtimeCommand: LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND,
      }),
    ).toThrow('SFX channel table must contain exactly 8 channels, got 9');
  });

  test('locks the runtime-frozen invariant on every layer of the returned evidence', () => {
    const result = lockSfxChannelCount({
      channelSnapshots: createChannelSnapshots(),
      runtimeCommand: LOCK_SFX_CHANNEL_COUNT_RUNTIME_COMMAND,
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.replayEvidence)).toBe(true);
    expect(Object.isFrozen(result.replayEvidence.slotSignatures)).toBe(true);
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
