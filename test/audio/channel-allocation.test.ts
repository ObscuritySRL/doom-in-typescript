import { describe, expect, it } from 'bun:test';

import {
  CHANNEL_FREE_HANDLE,
  CHANNEL_FREE_PITCH,
  CHANNEL_FREE_PRIORITY,
  CHANNEL_FREE_SFX,
  CHANNEL_NO_ORIGIN,
  NORM_PITCH,
  NORM_PRIORITY,
  NUM_CHANNELS,
  allocateChannel,
  createChannelTable,
  findChannelByOrigin,
  findEvictableChannel,
  findFreeChannel,
  getOccupiedChannelCount,
  isChannelFree,
  stopChannel,
  stopSound,
} from '../../src/audio/channels.ts';
import type { AllocateChannelRequest, Channel, ChannelTable } from '../../src/audio/channels.ts';

const SFX_PISTOL = 1;
const SFX_SHOTGN = 2;
const SFX_TELEPT = 35;
const SFX_BFG = 9;
const SFX_PSTART = 60;
const SFX_PSTOP = 61;
const SFX_DOOR = 70;

const PRIORITY_PISTOL = 64;
const PRIORITY_SHOTGN = 64;
const PRIORITY_TELEPT = 32;
const PRIORITY_DOOR = 100;
const PRIORITY_PSTART = 100;
const PRIORITY_PSTOP = 100;

function fill(table: ChannelTable, request: AllocateChannelRequest): number {
  const cnum = allocateChannel(table, request);
  if (cnum === null) {
    throw new Error('expected allocation to succeed');
  }
  return cnum;
}

function snapshotChannel(channel: Channel): {
  sfxId: number | null;
  origin: number | null;
  priority: number;
  handle: number;
  pitch: number;
} {
  return {
    sfxId: channel.sfxId,
    origin: channel.origin,
    priority: channel.priority,
    handle: channel.handle,
    pitch: channel.pitch,
  };
}

describe('channel constants', () => {
  it('NUM_CHANNELS matches vanilla snd_channels default of 8', () => {
    expect(NUM_CHANNELS).toBe(8);
  });

  it('CHANNEL_FREE_SFX is null', () => {
    expect(CHANNEL_FREE_SFX).toBeNull();
  });

  it('CHANNEL_NO_ORIGIN is null', () => {
    expect(CHANNEL_NO_ORIGIN).toBeNull();
  });

  it('CHANNEL_FREE_HANDLE is 0', () => {
    expect(CHANNEL_FREE_HANDLE).toBe(0);
  });

  it('CHANNEL_FREE_PRIORITY is 0', () => {
    expect(CHANNEL_FREE_PRIORITY).toBe(0);
  });

  it('CHANNEL_FREE_PITCH is 0', () => {
    expect(CHANNEL_FREE_PITCH).toBe(0);
  });

  it('NORM_PRIORITY matches vanilla NORM_PRIORITY=64', () => {
    expect(NORM_PRIORITY).toBe(64);
  });

  it('NORM_PITCH matches vanilla NORM_PITCH=128', () => {
    expect(NORM_PITCH).toBe(128);
  });
});

describe('createChannelTable', () => {
  it('creates a table with 8 free channels by default', () => {
    const table = createChannelTable();
    expect(table.capacity).toBe(NUM_CHANNELS);
    expect(table.channels).toHaveLength(NUM_CHANNELS);
    for (const channel of table.channels) {
      expect(snapshotChannel(channel)).toEqual({
        sfxId: null,
        origin: null,
        priority: 0,
        handle: 0,
        pitch: 0,
      });
    }
  });

  it('honors a custom capacity', () => {
    const table = createChannelTable(4);
    expect(table.capacity).toBe(4);
    expect(table.channels).toHaveLength(4);
  });

  it('rejects non-positive capacities', () => {
    expect(() => createChannelTable(0)).toThrow(RangeError);
    expect(() => createChannelTable(-1)).toThrow(RangeError);
  });

  it('rejects non-integer capacities', () => {
    expect(() => createChannelTable(1.5)).toThrow(RangeError);
    expect(() => createChannelTable(Number.NaN)).toThrow(RangeError);
  });

  it('produces independent slot arrays per table', () => {
    const a = createChannelTable();
    const b = createChannelTable();
    a.channels[0]!.sfxId = SFX_PISTOL;
    expect(b.channels[0]!.sfxId).toBeNull();
  });
});

describe('isChannelFree', () => {
  it('returns true for a fresh channel slot', () => {
    const table = createChannelTable();
    expect(isChannelFree(table.channels[0]!)).toBe(true);
  });

  it('returns false after a channel is occupied', () => {
    const table = createChannelTable();
    fill(table, { origin: 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    expect(isChannelFree(table.channels[0]!)).toBe(false);
  });

  it('returns true again after the channel is stopped', () => {
    const table = createChannelTable();
    fill(table, { origin: 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    stopChannel(table, 0);
    expect(isChannelFree(table.channels[0]!)).toBe(true);
  });
});

describe('findFreeChannel', () => {
  it('returns 0 for a fresh table', () => {
    const table = createChannelTable();
    expect(findFreeChannel(table)).toBe(0);
  });

  it('returns the first hole after intermediate slots are filled', () => {
    const table = createChannelTable();
    fill(table, { origin: 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    fill(table, { origin: 2, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    expect(findFreeChannel(table)).toBe(2);
  });

  it('returns null when every slot is occupied', () => {
    const table = createChannelTable();
    for (let i = 0; i < NUM_CHANNELS; i++) {
      fill(table, { origin: i + 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    }
    expect(findFreeChannel(table)).toBeNull();
  });

  it('rediscovers a hole created by stopChannel', () => {
    const table = createChannelTable();
    for (let i = 0; i < NUM_CHANNELS; i++) {
      fill(table, { origin: i + 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    }
    stopChannel(table, 3);
    expect(findFreeChannel(table)).toBe(3);
  });
});

describe('findChannelByOrigin', () => {
  it('returns the index of the matching origin', () => {
    const table = createChannelTable();
    fill(table, { origin: 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    fill(table, { origin: 42, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    expect(findChannelByOrigin(table, 42)).toBe(1);
  });

  it('returns the FIRST matching slot when duplicates somehow exist', () => {
    const table = createChannelTable();
    fill(table, { origin: 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    fill(table, { origin: 1, sfxId: SFX_SHOTGN, priority: PRIORITY_SHOTGN }); // dedup will replace slot 0
    expect(findChannelByOrigin(table, 1)).toBe(0);
    expect(table.channels[0]!.sfxId).toBe(SFX_SHOTGN);
  });

  it('returns null when no slot matches', () => {
    const table = createChannelTable();
    fill(table, { origin: 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    expect(findChannelByOrigin(table, 99)).toBeNull();
  });

  it('returns null when origin is null even if slots have null origins', () => {
    const table = createChannelTable();
    fill(table, { origin: null, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    expect(findChannelByOrigin(table, null)).toBeNull();
  });

  it('does not match free slots whose default origin is null', () => {
    const table = createChannelTable();
    expect(findChannelByOrigin(table, null)).toBeNull();
  });
});

describe('findEvictableChannel', () => {
  it('returns null for an empty table — no occupied slots to evict', () => {
    const table = createChannelTable();
    expect(findEvictableChannel(table, PRIORITY_PISTOL)).toBeNull();
  });

  it('skips free slots and only considers occupied ones', () => {
    const table = createChannelTable();
    fill(table, { origin: 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    expect(findEvictableChannel(table, PRIORITY_PISTOL)).toBe(0);
  });

  it('returns the first slot with priority >= request when full', () => {
    const table = createChannelTable();
    for (let i = 0; i < NUM_CHANNELS; i++) {
      fill(table, { origin: i + 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    }
    expect(findEvictableChannel(table, PRIORITY_PISTOL)).toBe(0);
  });

  it('skips slots whose priority value is strictly lower than the request', () => {
    const table = createChannelTable();
    fill(table, { origin: 1, sfxId: SFX_TELEPT, priority: PRIORITY_TELEPT });
    fill(table, { origin: 2, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    for (let i = 2; i < NUM_CHANNELS; i++) {
      fill(table, { origin: i + 1, sfxId: SFX_TELEPT, priority: PRIORITY_TELEPT });
    }
    expect(findEvictableChannel(table, PRIORITY_PISTOL)).toBe(1);
  });

  it('returns null when every occupied slot is more important than the request', () => {
    const table = createChannelTable();
    for (let i = 0; i < NUM_CHANNELS; i++) {
      fill(table, { origin: i + 1, sfxId: SFX_TELEPT, priority: PRIORITY_TELEPT });
    }
    expect(findEvictableChannel(table, PRIORITY_DOOR)).toBeNull();
  });
});

describe('stopChannel', () => {
  it('clears every field back to free defaults', () => {
    const table = createChannelTable();
    fill(table, { origin: 7, sfxId: SFX_BFG, priority: NORM_PRIORITY, handle: 99, pitch: 200 });
    stopChannel(table, 0);
    expect(snapshotChannel(table.channels[0]!)).toEqual({
      sfxId: null,
      origin: null,
      priority: 0,
      handle: 0,
      pitch: 0,
    });
  });

  it('is a no-op for already-free slots', () => {
    const table = createChannelTable();
    stopChannel(table, 3);
    expect(snapshotChannel(table.channels[3]!)).toEqual({
      sfxId: null,
      origin: null,
      priority: 0,
      handle: 0,
      pitch: 0,
    });
  });

  it('ignores out-of-range indices without throwing', () => {
    const table = createChannelTable();
    fill(table, { origin: 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    expect(() => stopChannel(table, -1)).not.toThrow();
    expect(() => stopChannel(table, NUM_CHANNELS)).not.toThrow();
    expect(table.channels[0]!.sfxId).toBe(SFX_PISTOL);
  });
});

describe('stopSound', () => {
  it('returns the channel index and clears the matching slot', () => {
    const table = createChannelTable();
    fill(table, { origin: 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    fill(table, { origin: 42, sfxId: SFX_SHOTGN, priority: PRIORITY_SHOTGN });
    expect(stopSound(table, 42)).toBe(1);
    expect(isChannelFree(table.channels[1]!)).toBe(true);
    expect(table.channels[0]!.sfxId).toBe(SFX_PISTOL);
  });

  it('returns null when no channel matches the origin', () => {
    const table = createChannelTable();
    fill(table, { origin: 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    expect(stopSound(table, 99)).toBeNull();
    expect(table.channels[0]!.sfxId).toBe(SFX_PISTOL);
  });

  it('returns null and is a no-op when origin is null', () => {
    const table = createChannelTable();
    fill(table, { origin: null, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    expect(stopSound(table, null)).toBeNull();
    expect(table.channels[0]!.sfxId).toBe(SFX_PISTOL);
  });

  it('only stops the FIRST matching slot per vanilla S_StopSound break', () => {
    const table = createChannelTable();
    table.channels[0]!.sfxId = SFX_PISTOL;
    table.channels[0]!.origin = 5;
    table.channels[0]!.priority = PRIORITY_PISTOL;
    table.channels[1]!.sfxId = SFX_SHOTGN;
    table.channels[1]!.origin = 5;
    table.channels[1]!.priority = PRIORITY_SHOTGN;

    expect(stopSound(table, 5)).toBe(0);
    expect(isChannelFree(table.channels[0]!)).toBe(true);
    expect(isChannelFree(table.channels[1]!)).toBe(false);
  });
});

describe('allocateChannel - free slot path', () => {
  it('uses the first free slot for a new origin', () => {
    const table = createChannelTable();
    const cnum = allocateChannel(table, { origin: 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    expect(cnum).toBe(0);
    expect(snapshotChannel(table.channels[0]!)).toEqual({
      sfxId: SFX_PISTOL,
      origin: 1,
      priority: PRIORITY_PISTOL,
      handle: CHANNEL_FREE_HANDLE,
      pitch: NORM_PITCH,
    });
  });

  it('fills slots in ascending order', () => {
    const table = createChannelTable();
    for (let i = 0; i < NUM_CHANNELS; i++) {
      const cnum = allocateChannel(table, { origin: i + 100, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
      expect(cnum).toBe(i);
    }
    expect(getOccupiedChannelCount(table)).toBe(NUM_CHANNELS);
  });

  it('honors explicit handle and pitch overrides', () => {
    const table = createChannelTable();
    allocateChannel(table, { origin: 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL, handle: 73, pitch: 200 });
    expect(table.channels[0]!.handle).toBe(73);
    expect(table.channels[0]!.pitch).toBe(200);
  });

  it('allocates anonymous (null origin) sounds into separate slots without dedup', () => {
    const table = createChannelTable();
    const a = allocateChannel(table, { origin: null, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    const b = allocateChannel(table, { origin: null, sfxId: SFX_SHOTGN, priority: PRIORITY_SHOTGN });
    expect(a).toBe(0);
    expect(b).toBe(1);
    expect(table.channels[0]!.sfxId).toBe(SFX_PISTOL);
    expect(table.channels[1]!.sfxId).toBe(SFX_SHOTGN);
  });
});

describe('allocateChannel - origin dedup path', () => {
  it('reuses the existing slot for the same origin', () => {
    const table = createChannelTable();
    fill(table, { origin: 42, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    fill(table, { origin: 99, sfxId: SFX_TELEPT, priority: PRIORITY_TELEPT });
    fill(table, { origin: 7, sfxId: SFX_BFG, priority: NORM_PRIORITY });
    const cnum = allocateChannel(table, { origin: 42, sfxId: SFX_SHOTGN, priority: PRIORITY_SHOTGN });
    expect(cnum).toBe(0);
    expect(table.channels[0]!.sfxId).toBe(SFX_SHOTGN);
    expect(table.channels[0]!.origin).toBe(42);
    expect(table.channels[1]!.sfxId).toBe(SFX_TELEPT);
    expect(table.channels[2]!.sfxId).toBe(SFX_BFG);
  });

  it('takes the dedup branch even when free slots exist (vanilla early break)', () => {
    const table = createChannelTable();
    fill(table, { origin: 42, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    expect(getOccupiedChannelCount(table)).toBe(1);
    const cnum = allocateChannel(table, { origin: 42, sfxId: SFX_SHOTGN, priority: PRIORITY_SHOTGN });
    expect(cnum).toBe(0);
    expect(getOccupiedChannelCount(table)).toBe(1);
  });

  it('treats null-origin requests as anonymous and never matches the origin branch', () => {
    const table = createChannelTable();
    fill(table, { origin: null, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    fill(table, { origin: null, sfxId: SFX_SHOTGN, priority: PRIORITY_SHOTGN });
    const cnum = allocateChannel(table, { origin: null, sfxId: SFX_BFG, priority: NORM_PRIORITY });
    expect(cnum).toBe(2);
    expect(table.channels[0]!.sfxId).toBe(SFX_PISTOL);
    expect(table.channels[1]!.sfxId).toBe(SFX_SHOTGN);
  });

  it('only dedups the FIRST matching origin slot when duplicates exist', () => {
    const table = createChannelTable();
    table.channels[0]!.sfxId = SFX_PISTOL;
    table.channels[0]!.origin = 5;
    table.channels[0]!.priority = PRIORITY_PISTOL;
    table.channels[1]!.sfxId = SFX_TELEPT;
    table.channels[1]!.origin = 5;
    table.channels[1]!.priority = PRIORITY_TELEPT;
    const cnum = allocateChannel(table, { origin: 5, sfxId: SFX_SHOTGN, priority: PRIORITY_SHOTGN });
    expect(cnum).toBe(0);
    expect(table.channels[0]!.sfxId).toBe(SFX_SHOTGN);
    expect(table.channels[1]!.sfxId).toBe(SFX_TELEPT); // unchanged
  });
});

describe('allocateChannel - eviction path', () => {
  it('evicts the first equally-prioritized slot when full', () => {
    const table = createChannelTable();
    for (let i = 0; i < NUM_CHANNELS; i++) {
      fill(table, { origin: i + 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    }
    const cnum = allocateChannel(table, { origin: 999, sfxId: SFX_SHOTGN, priority: PRIORITY_SHOTGN });
    expect(cnum).toBe(0);
    expect(table.channels[0]!.sfxId).toBe(SFX_SHOTGN);
    expect(table.channels[0]!.origin).toBe(999);
  });

  it('skips lower-priority-value (more important) slots and evicts the first higher-or-equal', () => {
    const table = createChannelTable();
    fill(table, { origin: 1, sfxId: SFX_TELEPT, priority: PRIORITY_TELEPT });
    fill(table, { origin: 2, sfxId: SFX_TELEPT, priority: PRIORITY_TELEPT });
    fill(table, { origin: 3, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    for (let i = 3; i < NUM_CHANNELS; i++) {
      fill(table, { origin: i + 1, sfxId: SFX_TELEPT, priority: PRIORITY_TELEPT });
    }
    const cnum = allocateChannel(table, { origin: 999, sfxId: SFX_SHOTGN, priority: PRIORITY_SHOTGN });
    expect(cnum).toBe(2);
    expect(table.channels[0]!.sfxId).toBe(SFX_TELEPT);
    expect(table.channels[1]!.sfxId).toBe(SFX_TELEPT);
    expect(table.channels[2]!.sfxId).toBe(SFX_SHOTGN);
  });

  it('returns null when every slot is more important than the request', () => {
    const table = createChannelTable();
    for (let i = 0; i < NUM_CHANNELS; i++) {
      fill(table, { origin: i + 1, sfxId: SFX_TELEPT, priority: PRIORITY_TELEPT });
    }
    const cnum = allocateChannel(table, { origin: 999, sfxId: SFX_DOOR, priority: PRIORITY_DOOR });
    expect(cnum).toBeNull();
    for (let i = 0; i < NUM_CHANNELS; i++) {
      expect(table.channels[i]!.sfxId).toBe(SFX_TELEPT);
    }
  });

  it('evicts a low-importance (high priority value) slot when a higher-importance sound arrives', () => {
    const table = createChannelTable();
    for (let i = 0; i < NUM_CHANNELS; i++) {
      fill(table, { origin: i + 1, sfxId: SFX_PSTART, priority: PRIORITY_PSTART });
    }
    const cnum = allocateChannel(table, { origin: 999, sfxId: SFX_TELEPT, priority: PRIORITY_TELEPT });
    expect(cnum).toBe(0);
    expect(table.channels[0]!.sfxId).toBe(SFX_TELEPT);
  });

  it('re-uses a slot freed by stopSound before falling back to eviction', () => {
    const table = createChannelTable();
    for (let i = 0; i < NUM_CHANNELS; i++) {
      fill(table, { origin: i + 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    }
    stopSound(table, 4);
    const cnum = allocateChannel(table, { origin: 999, sfxId: SFX_SHOTGN, priority: PRIORITY_SHOTGN });
    expect(cnum).toBe(3);
    expect(table.channels[3]!.sfxId).toBe(SFX_SHOTGN);
  });
});

describe('allocateChannel - vanilla S_StartSound sequence', () => {
  it('matches the canonical S_StopSound -> S_GetChannel ordering for an origin restart', () => {
    const table = createChannelTable();
    fill(table, { origin: 42, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    stopSound(table, 42);
    const cnum = allocateChannel(table, { origin: 42, sfxId: SFX_SHOTGN, priority: PRIORITY_SHOTGN });
    expect(cnum).toBe(0);
    expect(table.channels[0]!.sfxId).toBe(SFX_SHOTGN);
    expect(getOccupiedChannelCount(table)).toBe(1);
  });

  it('fills then evicts in priority-aware order over an 8-shot burst plus low-importance dings', () => {
    const table = createChannelTable();
    for (let i = 0; i < 5; i++) {
      const cnum = fill(table, { origin: i + 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
      expect(cnum).toBe(i);
    }
    fill(table, { origin: 100, sfxId: SFX_PSTOP, priority: PRIORITY_PSTOP });
    fill(table, { origin: 101, sfxId: SFX_DOOR, priority: PRIORITY_DOOR });
    fill(table, { origin: 102, sfxId: SFX_TELEPT, priority: PRIORITY_TELEPT });
    expect(getOccupiedChannelCount(table)).toBe(NUM_CHANNELS);
    const cnum = allocateChannel(table, { origin: 200, sfxId: SFX_SHOTGN, priority: PRIORITY_SHOTGN });
    expect(cnum).toBe(0);
    expect(table.channels[0]!.sfxId).toBe(SFX_SHOTGN);
    expect(table.channels[5]!.sfxId).toBe(SFX_PSTOP);
    expect(table.channels[6]!.sfxId).toBe(SFX_DOOR);
    expect(table.channels[7]!.sfxId).toBe(SFX_TELEPT);
  });
});

describe('getOccupiedChannelCount', () => {
  it('returns 0 for a fresh table', () => {
    const table = createChannelTable();
    expect(getOccupiedChannelCount(table)).toBe(0);
  });

  it('counts each occupied slot exactly once', () => {
    const table = createChannelTable();
    fill(table, { origin: 1, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    fill(table, { origin: 2, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    fill(table, { origin: 3, sfxId: SFX_PISTOL, priority: PRIORITY_PISTOL });
    expect(getOccupiedChannelCount(table)).toBe(3);
    stopChannel(table, 1);
    expect(getOccupiedChannelCount(table)).toBe(2);
  });
});
