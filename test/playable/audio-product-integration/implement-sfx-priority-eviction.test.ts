import { describe, expect, test } from 'bun:test';

import type { SfxPriorityEvictionChannelSnapshot } from '../../../src/playable/audio-product-integration/implementSfxPriorityEviction.ts';
import {
  IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND,
  IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND_TOKENS,
  PLAYABLE_SFX_PRIORITY_CHANNEL_COUNT,
  implementSfxPriorityEviction,
} from '../../../src/playable/audio-product-integration/implementSfxPriorityEviction.ts';

const EXPECTED_SOURCE_SHA256 = '80ade5e79e77b230d1c6068b9440c1239d9ed96c7c9723483c079e43a4d6747f';

const FULL_CHANNELS: readonly SfxPriorityEvictionChannelSnapshot[] = Object.freeze([
  Object.freeze({ active: true, channelIndex: 0, origin: 10, priority: 16, soundEffectId: 1 }),
  Object.freeze({ active: true, channelIndex: 1, origin: 11, priority: 32, soundEffectId: 2 }),
  Object.freeze({ active: true, channelIndex: 2, origin: 12, priority: 96, soundEffectId: 3 }),
  Object.freeze({ active: true, channelIndex: 3, origin: 13, priority: 96, soundEffectId: 4 }),
  Object.freeze({ active: true, channelIndex: 4, origin: 14, priority: 128, soundEffectId: 5 }),
  Object.freeze({ active: true, channelIndex: 5, origin: 15, priority: 192, soundEffectId: 6 }),
  Object.freeze({ active: true, channelIndex: 6, origin: 16, priority: 224, soundEffectId: 7 }),
  Object.freeze({ active: true, channelIndex: 7, origin: 17, priority: 255, soundEffectId: 8 }),
]);

async function sha256File(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(await Bun.file(path).text());
  return hasher.digest('hex');
}

describe('implementSfxPriorityEviction', () => {
  test('locks the Bun command contract and live-audio audit linkage', async () => {
    const auditManifest = await Bun.file('plan_fps/manifests/01-011-audit-missing-live-audio.json').json();

    expect(IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND).toBe('bun run doom.ts');
    expect(IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND_TOKENS).toEqual(['bun', 'run', 'doom.ts']);
    expect(PLAYABLE_SFX_PRIORITY_CHANNEL_COUNT).toBe(8);
    expect(auditManifest).toEqual(
      expect.objectContaining({
        commandContracts: expect.objectContaining({
          target: expect.objectContaining({
            entryFile: 'doom.ts',
            runtimeCommand: IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND,
          }),
        }),
        explicitNullSurfaces: expect.arrayContaining([
          expect.objectContaining({
            name: 'live-sfx-mixer',
            path: null,
          }),
        ]),
        schemaVersion: 1,
        step: expect.objectContaining({
          id: '01-011',
          title: 'audit-missing-live-audio',
        }),
      }),
    );
    expect(await sha256File('src/playable/audio-product-integration/implementSfxPriorityEviction.ts')).toBe(EXPECTED_SOURCE_SHA256);
  });

  test('evicts the first active channel whose priority is weaker or equal', () => {
    const result = implementSfxPriorityEviction({
      channels: FULL_CHANNELS,
      incoming: Object.freeze({ origin: 99, priority: 64, soundEffectId: 42 }),
      runtimeCommand: IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND_TOKENS,
    });

    expect(result).toEqual({
      evidence: {
        afterSignature:
          '0:active:sound=1:priority=16:origin=10|1:active:sound=2:priority=32:origin=11|2:active:sound=42:priority=64:origin=99|3:active:sound=4:priority=96:origin=13|4:active:sound=5:priority=128:origin=14|5:active:sound=6:priority=192:origin=15|6:active:sound=7:priority=224:origin=16|7:active:sound=8:priority=255:origin=17',
        beforeSignature:
          '0:active:sound=1:priority=16:origin=10|1:active:sound=2:priority=32:origin=11|2:active:sound=3:priority=96:origin=12|3:active:sound=4:priority=96:origin=13|4:active:sound=5:priority=128:origin=14|5:active:sound=6:priority=192:origin=15|6:active:sound=7:priority=224:origin=16|7:active:sound=8:priority=255:origin=17',
        command: IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND,
        decision: 'evicted',
        incomingSignature: 'incoming:sound=42:priority=64:origin=99',
        replayChecksum: 2110341693,
        selectedChannelIndex: 2,
        victimSignature: '2:active:sound=3:priority=96:origin=12',
      },
      kind: 'evicted',
      replacementSignature: '2:active:sound=42:priority=64:origin=99',
      selectedChannelIndex: 2,
      victimSignature: '2:active:sound=3:priority=96:origin=12',
    });
    expect(JSON.stringify(result)).not.toContain('handle');
  });

  test('drops lower-priority incoming sounds without changing replay signatures', () => {
    const result = implementSfxPriorityEviction({
      channels: FULL_CHANNELS,
      incoming: Object.freeze({ origin: 99, priority: 300, soundEffectId: 42 }),
      runtimeCommand: IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND_TOKENS,
    });

    expect(result).toEqual({
      evidence: {
        afterSignature:
          '0:active:sound=1:priority=16:origin=10|1:active:sound=2:priority=32:origin=11|2:active:sound=3:priority=96:origin=12|3:active:sound=4:priority=96:origin=13|4:active:sound=5:priority=128:origin=14|5:active:sound=6:priority=192:origin=15|6:active:sound=7:priority=224:origin=16|7:active:sound=8:priority=255:origin=17',
        beforeSignature:
          '0:active:sound=1:priority=16:origin=10|1:active:sound=2:priority=32:origin=11|2:active:sound=3:priority=96:origin=12|3:active:sound=4:priority=96:origin=13|4:active:sound=5:priority=128:origin=14|5:active:sound=6:priority=192:origin=15|6:active:sound=7:priority=224:origin=16|7:active:sound=8:priority=255:origin=17',
        command: IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND,
        decision: 'dropped',
        incomingSignature: 'incoming:sound=42:priority=300:origin=99',
        replayChecksum: 2932157316,
        selectedChannelIndex: null,
        victimSignature: null,
      },
      kind: 'dropped',
      selectedChannelIndex: null,
      victimSignature: null,
    });
  });

  test('rejects non-target runtime commands before making an eviction decision', () => {
    expect(() =>
      implementSfxPriorityEviction({
        channels: FULL_CHANNELS,
        incoming: Object.freeze({ origin: 99, priority: 64, soundEffectId: 42 }),
        runtimeCommand: ['bun', 'run', 'src/main.ts'],
      }),
    ).toThrow('runtime command must be exactly "bun run doom.ts"');
  });

  test('rejects invalid channel state without mutating caller snapshots', () => {
    const invalidChannels: readonly SfxPriorityEvictionChannelSnapshot[] = Object.freeze([
      Object.freeze({ active: true, channelIndex: 0, origin: 10, priority: 16, soundEffectId: 1 }),
      Object.freeze({ active: true, channelIndex: 1, origin: 11, priority: 32, soundEffectId: 2 }),
      Object.freeze({ active: true, channelIndex: 2, origin: 12, priority: 96, soundEffectId: 3 }),
      Object.freeze({ active: false, channelIndex: 3, origin: 13, priority: null, soundEffectId: null }),
      Object.freeze({ active: true, channelIndex: 4, origin: 14, priority: 128, soundEffectId: 5 }),
      Object.freeze({ active: true, channelIndex: 5, origin: 15, priority: 192, soundEffectId: 6 }),
      Object.freeze({ active: true, channelIndex: 6, origin: 16, priority: 224, soundEffectId: 7 }),
      Object.freeze({ active: true, channelIndex: 7, origin: 17, priority: 255, soundEffectId: 8 }),
    ]);
    const before = JSON.stringify(invalidChannels);

    expect(() =>
      implementSfxPriorityEviction({
        channels: invalidChannels,
        incoming: Object.freeze({ origin: 99, priority: 64, soundEffectId: 42 }),
        runtimeCommand: IMPLEMENT_SFX_PRIORITY_EVICTION_COMMAND_TOKENS,
      }),
    ).toThrow('inactive channel 3 must not carry sound state');
    expect(JSON.stringify(invalidChannels)).toBe(before);
  });
});
