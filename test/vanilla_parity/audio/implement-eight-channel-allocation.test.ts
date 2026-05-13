import { describe, expect, test } from 'bun:test';

import { NUM_CHANNELS } from '../../../src/audio/channels.ts';
import { VANILLA_CHANNEL_TABLE_INITIAL_INDEX, VANILLA_GET_CHANNEL_DROP_SENTINEL, VANILLA_SND_CHANNELS_DEFAULT, type VanillaChannelSnapshot, vanillaGetChannel } from '../../../src/audio/implement-eight-channel-allocation.ts';

const FREE: VanillaChannelSnapshot = Object.freeze({ sfxId: null, origin: null, priority: 0 });

function active(sfxId: number, origin: number | null, priority: number): VanillaChannelSnapshot {
  return Object.freeze({ sfxId, origin, priority });
}

describe('vanilla eight-channel allocation constants', () => {
  test('snd_channels default = 8 and matches channels.ts NUM_CHANNELS', () => {
    expect(VANILLA_SND_CHANNELS_DEFAULT).toBe(8);
    expect(VANILLA_SND_CHANNELS_DEFAULT).toBe(NUM_CHANNELS);
  });

  test('S_GetChannel scans starting at index 0 and drops with sentinel -1', () => {
    expect(VANILLA_CHANNEL_TABLE_INITIAL_INDEX).toBe(0);
    expect(VANILLA_GET_CHANNEL_DROP_SENTINEL).toBe(-1);
  });
});

describe('vanillaGetChannel pass-one', () => {
  test('picks the first free slot when one exists', () => {
    const channels = [active(1, 10, 64), active(2, 11, 64), FREE, FREE, FREE, FREE, FREE, FREE];
    const result = vanillaGetChannel({ channels, incomingOrigin: 99, incomingPriority: 64 });
    expect(result).toEqual({ kind: 'free', channelIndex: 2 });
  });

  test('reuses a same-origin slot before considering later free slots', () => {
    const channels = [active(1, 10, 64), active(2, 99, 64), FREE, FREE, FREE, FREE, FREE, FREE];
    const result = vanillaGetChannel({ channels, incomingOrigin: 99, incomingPriority: 64 });
    expect(result).toEqual({ kind: 'reuse-origin', channelIndex: 1 });
  });

  test('null incomingOrigin never matches the origin branch', () => {
    const channels = [active(1, null, 64), active(2, 11, 64), FREE, FREE, FREE, FREE, FREE, FREE];
    const result = vanillaGetChannel({ channels, incomingOrigin: null, incomingPriority: 64 });
    expect(result).toEqual({ kind: 'free', channelIndex: 2 });
  });
});

describe('vanillaGetChannel pass-two priority eviction', () => {
  test('full table: evicts first slot whose priority is >= incoming', () => {
    const channels = [active(1, 10, 32), active(2, 11, 64), active(3, 12, 70), active(4, 13, 78), active(5, 14, 96), active(6, 15, 98), active(7, 16, 100), active(8, 17, 120)];
    const result = vanillaGetChannel({ channels, incomingOrigin: 99, incomingPriority: 64 });
    expect(result).toEqual({ kind: 'evict-priority', channelIndex: 1 });
  });

  test('full table: tied priority evicts the first equal slot encountered', () => {
    const channels = [active(1, 10, 64), active(2, 11, 64), active(3, 12, 64), active(4, 13, 64), active(5, 14, 64), active(6, 15, 64), active(7, 16, 64), active(8, 17, 64)];
    const result = vanillaGetChannel({ channels, incomingOrigin: 99, incomingPriority: 64 });
    expect(result).toEqual({ kind: 'evict-priority', channelIndex: 0 });
  });

  test('full table: drops incoming when every slot is strictly more important', () => {
    const channels = [active(1, 10, 32), active(2, 11, 32), active(3, 12, 60), active(4, 13, 60), active(5, 14, 60), active(6, 15, 60), active(7, 16, 60), active(8, 17, 60)];
    const result = vanillaGetChannel({ channels, incomingOrigin: 99, incomingPriority: 64 });
    expect(result).toEqual({ kind: 'drop' });
  });

  test('empty channel table drops the incoming (no slot to occupy)', () => {
    const result = vanillaGetChannel({ channels: [], incomingOrigin: 99, incomingPriority: 64 });
    expect(result).toEqual({ kind: 'drop' });
  });
});
