import { describe, expect, it } from 'bun:test';

import { FRACUNIT } from '../../src/core/fixed.ts';
import { ANG90 } from '../../src/core/angle.ts';
import { NORM_PRIORITY, allocateChannel, createChannelTable } from '../../src/audio/channels.ts';
import type { ChannelTable } from '../../src/audio/channels.ts';
import { NORM_SEP, S_CLIPPING_DIST, S_CLOSE_DIST, adjustSoundParams } from '../../src/audio/spatial.ts';
import { CHANNEL_UPDATE_STATE_UNUSED, SOUND_UPDATE_LINK_MIN_VOLUME, buildChannelUpdateStates, updateSounds } from '../../src/audio/soundOrigins.ts';
import type { ChannelUpdateState, SoundUpdateAction, UpdateSoundsRequest } from '../../src/audio/soundOrigins.ts';

const SFX_PISTOL = 1;
const SFX_DOOR = 70;

const PLAYER_ORIGIN = 1;
const IMP_ORIGIN = 42;
const LOST_SOUL_ORIGIN = 43;

const HANDLE_PISTOL = 0x11;
const HANDLE_DOOR = 0x22;
const HANDLE_ANON = 0x33;

const LISTENER_AT_ORIGIN = { x: 0, y: 0, angle: 0 };
const SFX_VOLUME_FULL = 15;

function makeState(overrides: Partial<ChannelUpdateState> = {}): ChannelUpdateState {
  return {
    isPlaying: overrides.isPlaying ?? true,
    sourcePosition: overrides.sourcePosition ?? null,
    linkVolumeAdjust: overrides.linkVolumeAdjust ?? null,
  };
}

function fillStates(table: ChannelTable, entries: Partial<Record<number, ChannelUpdateState>> = {}): ChannelUpdateState[] {
  const states: ChannelUpdateState[] = [];
  for (let cnum = 0; cnum < table.capacity; cnum++) {
    states.push(entries[cnum] ?? { ...CHANNEL_UPDATE_STATE_UNUSED });
  }
  return states;
}

function call(overrides: Partial<UpdateSoundsRequest>): SoundUpdateAction[] {
  if (!overrides.table) {
    throw new Error('test must supply a table');
  }
  return updateSounds({
    table: overrides.table,
    listener: overrides.listener ?? LISTENER_AT_ORIGIN,
    listenerOrigin: overrides.listenerOrigin ?? PLAYER_ORIGIN,
    sfxVolume: overrides.sfxVolume ?? SFX_VOLUME_FULL,
    isBossMap: overrides.isBossMap ?? false,
    channelState: overrides.channelState ?? fillStates(overrides.table),
  });
}

describe('sound-origins constants', () => {
  it('SOUND_UPDATE_LINK_MIN_VOLUME matches vanilla `if (volume < 1)` guard', () => {
    expect(SOUND_UPDATE_LINK_MIN_VOLUME).toBe(1);
  });

  it('CHANNEL_UPDATE_STATE_UNUSED is frozen with safe defaults', () => {
    expect(CHANNEL_UPDATE_STATE_UNUSED.isPlaying).toBe(false);
    expect(CHANNEL_UPDATE_STATE_UNUSED.sourcePosition).toBeNull();
    expect(CHANNEL_UPDATE_STATE_UNUSED.linkVolumeAdjust).toBeNull();
    expect(Object.isFrozen(CHANNEL_UPDATE_STATE_UNUSED)).toBe(true);
  });
});

describe('updateSounds — input validation', () => {
  it('throws RangeError when channelState length is shorter than capacity', () => {
    const table = createChannelTable(4);
    expect(() =>
      updateSounds({
        table,
        listener: LISTENER_AT_ORIGIN,
        listenerOrigin: PLAYER_ORIGIN,
        sfxVolume: SFX_VOLUME_FULL,
        isBossMap: false,
        channelState: [makeState(), makeState(), makeState()],
      }),
    ).toThrow(RangeError);
  });

  it('throws RangeError when channelState length is longer than capacity', () => {
    const table = createChannelTable(2);
    expect(() =>
      updateSounds({
        table,
        listener: LISTENER_AT_ORIGIN,
        listenerOrigin: PLAYER_ORIGIN,
        sfxVolume: SFX_VOLUME_FULL,
        isBossMap: false,
        channelState: [makeState(), makeState(), makeState()],
      }),
    ).toThrow(RangeError);
  });

  it('throws TypeError when a remote origin slot has sourcePosition=null', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: IMP_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_PISTOL,
    });

    expect(() =>
      call({
        table,
        channelState: fillStates(table, {
          0: makeState({ sourcePosition: null }),
        }),
      }),
    ).toThrow(TypeError);
  });
});

describe('updateSounds — empty / anonymous / local channels', () => {
  it('returns [] when every slot is free', () => {
    const table = createChannelTable();
    expect(call({ table })).toEqual([]);
  });

  it('does NOT touch anonymous (origin=null) slots still playing', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: null,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_ANON,
    });

    const actions = call({
      table,
      channelState: fillStates(table, { 0: makeState({ isPlaying: true }) }),
    });

    expect(actions).toEqual([]);
    expect(table.channels[0]!.sfxId).toBe(SFX_PISTOL);
    expect(table.channels[0]!.handle).toBe(HANDLE_ANON);
  });

  it('does NOT touch slots whose origin equals listenerOrigin (player-own sound)', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: PLAYER_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_PISTOL,
    });

    const actions = call({
      table,
      listenerOrigin: PLAYER_ORIGIN,
      channelState: fillStates(table, {
        0: makeState({
          isPlaying: true,
          sourcePosition: { x: 100 * FRACUNIT, y: 0 },
        }),
      }),
    });

    expect(actions).toEqual([]);
    expect(table.channels[0]!.sfxId).toBe(SFX_PISTOL);
  });

  it('listenerOrigin=null still treats origin-null slot as anonymous (no adjust)', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: null,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_ANON,
    });

    const actions = call({
      table,
      listenerOrigin: null,
      channelState: fillStates(table, { 0: makeState({ isPlaying: true }) }),
    });

    expect(actions).toEqual([]);
  });
});

describe('updateSounds — isPlaying=false reap path', () => {
  it('stops an anonymous slot whose handle finished playing', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: null,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_ANON,
    });

    const actions = call({
      table,
      channelState: fillStates(table, { 0: makeState({ isPlaying: false }) }),
    });

    expect(actions).toEqual([{ kind: 'stop', cnum: 0, handle: HANDLE_ANON }]);
    expect(table.channels[0]!.sfxId).toBeNull();
    expect(table.channels[0]!.origin).toBeNull();
    expect(table.channels[0]!.handle).toBe(0);
  });

  it('stops a remote slot whose handle finished playing without calling adjust', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: IMP_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_PISTOL,
    });

    const actions = call({
      table,
      channelState: fillStates(table, {
        0: makeState({
          isPlaying: false,
          sourcePosition: { x: 10 * FRACUNIT, y: 0 },
        }),
      }),
    });

    expect(actions).toEqual([{ kind: 'stop', cnum: 0, handle: HANDLE_PISTOL }]);
    expect(table.channels[0]!.sfxId).toBeNull();
  });

  it('stops a local slot whose handle finished playing (even when origin===listenerOrigin)', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: PLAYER_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_PISTOL,
    });

    const actions = call({
      table,
      channelState: fillStates(table, { 0: makeState({ isPlaying: false }) }),
    });

    expect(actions).toEqual([{ kind: 'stop', cnum: 0, handle: HANDLE_PISTOL }]);
  });

  it('preserves the pre-stop handle in the action even after the slot is cleared', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: null,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: 0xdeadbeef,
    });

    const actions = call({
      table,
      channelState: fillStates(table, { 0: makeState({ isPlaying: false }) }),
    });

    expect(actions[0]!.handle).toBe(0xdeadbeef);
    expect(table.channels[0]!.handle).toBe(0);
  });
});

describe('updateSounds — remote origin adjust path', () => {
  it('emits update-params with adjustSoundParams output for a close audible source', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: IMP_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_PISTOL,
    });

    const source = { x: 300 * FRACUNIT, y: 0 };
    const actions = call({
      table,
      channelState: fillStates(table, {
        0: makeState({ isPlaying: true, sourcePosition: source }),
      }),
    });

    const expected = adjustSoundParams({
      listener: LISTENER_AT_ORIGIN,
      source,
      sfxVolume: SFX_VOLUME_FULL,
      isBossMap: false,
    });

    expect(actions).toEqual([
      {
        kind: 'update-params',
        cnum: 0,
        handle: HANDLE_PISTOL,
        volume: expected.volume,
        separation: expected.separation,
      },
    ]);
    expect(table.channels[0]!.sfxId).toBe(SFX_PISTOL);
  });

  it('stops the channel when the remote source is beyond S_CLIPPING_DIST', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: IMP_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_PISTOL,
    });

    const actions = call({
      table,
      channelState: fillStates(table, {
        0: makeState({
          isPlaying: true,
          sourcePosition: { x: S_CLIPPING_DIST + 10 * FRACUNIT, y: 0 },
        }),
      }),
    });

    expect(actions).toEqual([{ kind: 'stop', cnum: 0, handle: HANDLE_PISTOL }]);
    expect(table.channels[0]!.sfxId).toBeNull();
  });

  it('emits update-params with full volume / near-NORM_SEP for a source inside S_CLOSE_DIST', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: IMP_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_PISTOL,
    });

    const source = { x: S_CLOSE_DIST - FRACUNIT, y: 0 };
    const actions = call({
      table,
      channelState: fillStates(table, {
        0: makeState({ isPlaying: true, sourcePosition: source }),
      }),
    });

    expect(actions.length).toBe(1);
    expect(actions[0]!.kind).toBe('update-params');
    expect(actions[0]!.volume).toBe(SFX_VOLUME_FULL);
  });

  it('honours listener angle when computing stereo separation (rotated listener pans source)', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: IMP_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_PISTOL,
    });

    const listener = { x: 0, y: 0, angle: ANG90 };
    const source = { x: 500 * FRACUNIT, y: 0 };
    const actions = call({
      table,
      listener,
      channelState: fillStates(table, {
        0: makeState({ isPlaying: true, sourcePosition: source }),
      }),
    });

    const expected = adjustSoundParams({
      listener,
      source,
      sfxVolume: SFX_VOLUME_FULL,
      isBossMap: false,
    });

    expect(actions[0]!.separation).toBe(expected.separation);
    expect(actions[0]!.volume).toBe(expected.volume);
  });

  it('MAP08 branch keeps far sounds audible via the floor-of-15 computation', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: IMP_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_PISTOL,
    });

    const source = { x: S_CLIPPING_DIST + 100 * FRACUNIT, y: 0 };
    const actions = call({
      table,
      isBossMap: true,
      channelState: fillStates(table, {
        0: makeState({ isPlaying: true, sourcePosition: source }),
      }),
    });

    const expected = adjustSoundParams({
      listener: LISTENER_AT_ORIGIN,
      source,
      sfxVolume: SFX_VOLUME_FULL,
      isBossMap: true,
    });

    expect(expected.audible).toBe(true);
    expect(actions).toEqual([
      {
        kind: 'update-params',
        cnum: 0,
        handle: HANDLE_PISTOL,
        volume: expected.volume,
        separation: expected.separation,
      },
    ]);
  });
});

describe('updateSounds — sfx->link branch', () => {
  it('passes through a null linkVolumeAdjust without change', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: IMP_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_PISTOL,
    });

    const source = { x: 500 * FRACUNIT, y: 0 };
    const actions = call({
      table,
      channelState: fillStates(table, {
        0: makeState({
          isPlaying: true,
          sourcePosition: source,
          linkVolumeAdjust: null,
        }),
      }),
    });

    const expected = adjustSoundParams({
      listener: LISTENER_AT_ORIGIN,
      source,
      sfxVolume: SFX_VOLUME_FULL,
      isBossMap: false,
    });
    expect(actions[0]!.volume).toBe(expected.volume);
  });

  it('stops the channel when link adjustment drops volume strictly below 1 (anonymous slot)', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: null,
      sfxId: SFX_DOOR,
      priority: NORM_PRIORITY,
      handle: HANDLE_DOOR,
    });

    const actions = call({
      table,
      channelState: fillStates(table, {
        0: makeState({
          isPlaying: true,
          linkVolumeAdjust: -SFX_VOLUME_FULL,
        }),
      }),
    });

    expect(actions).toEqual([{ kind: 'stop', cnum: 0, handle: HANDLE_DOOR }]);
    expect(table.channels[0]!.sfxId).toBeNull();
  });

  it('link-stop fires BEFORE the origin check — a remote slot also stops', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: IMP_ORIGIN,
      sfxId: SFX_DOOR,
      priority: NORM_PRIORITY,
      handle: HANDLE_DOOR,
    });

    const actions = call({
      table,
      channelState: fillStates(table, {
        0: makeState({
          isPlaying: true,
          sourcePosition: { x: 10 * FRACUNIT, y: 0 },
          linkVolumeAdjust: -SFX_VOLUME_FULL - 5,
        }),
      }),
    });

    expect(actions).toEqual([{ kind: 'stop', cnum: 0, handle: HANDLE_DOOR }]);
  });

  it('volume=0 (below 1) fires the stop — strict `<` guard', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: null,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_ANON,
    });

    const actions = call({
      table,
      channelState: fillStates(table, {
        0: makeState({
          isPlaying: true,
          linkVolumeAdjust: -SFX_VOLUME_FULL,
        }),
      }),
    });

    expect(actions).toEqual([{ kind: 'stop', cnum: 0, handle: HANDLE_ANON }]);
  });

  it('volume=1 (at threshold) survives and keeps the slot', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: null,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_ANON,
    });

    const actions = call({
      table,
      channelState: fillStates(table, {
        0: makeState({
          isPlaying: true,
          linkVolumeAdjust: -(SFX_VOLUME_FULL - 1),
        }),
      }),
    });

    expect(actions).toEqual([]);
    expect(table.channels[0]!.sfxId).toBe(SFX_PISTOL);
  });

  it('link clamps a too-high volume back down to sfxVolume before the remote adjust runs', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: IMP_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_PISTOL,
    });

    const source = { x: 10 * FRACUNIT, y: 0 };
    const actions = call({
      table,
      channelState: fillStates(table, {
        0: makeState({
          isPlaying: true,
          sourcePosition: source,
          linkVolumeAdjust: 1000,
        }),
      }),
    });

    const expected = adjustSoundParams({
      listener: LISTENER_AT_ORIGIN,
      source,
      sfxVolume: SFX_VOLUME_FULL,
      isBossMap: false,
    });
    expect(actions[0]!.volume).toBe(expected.volume);
  });

  it('link does NOT reach the mixer for local slots (volume computation is discarded)', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: PLAYER_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_PISTOL,
    });

    const actions = call({
      table,
      channelState: fillStates(table, {
        0: makeState({
          isPlaying: true,
          linkVolumeAdjust: 5,
        }),
      }),
    });

    expect(actions).toEqual([]);
    expect(table.channels[0]!.sfxId).toBe(SFX_PISTOL);
  });
});

describe('updateSounds — multi-channel ordering and mutation', () => {
  it('emits actions in ascending cnum order for mixed channels', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: IMP_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_PISTOL,
    });
    allocateChannel(table, {
      origin: null,
      sfxId: SFX_DOOR,
      priority: NORM_PRIORITY,
      handle: HANDLE_DOOR,
    });
    allocateChannel(table, {
      origin: LOST_SOUL_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: 0x44,
    });

    const actions = call({
      table,
      channelState: fillStates(table, {
        0: makeState({
          isPlaying: true,
          sourcePosition: { x: 500 * FRACUNIT, y: 0 },
        }),
        1: makeState({ isPlaying: false }),
        2: makeState({
          isPlaying: true,
          sourcePosition: { x: S_CLIPPING_DIST + 10 * FRACUNIT, y: 0 },
        }),
      }),
    });

    expect(actions.map((a) => a.cnum)).toEqual([0, 1, 2]);
    expect(actions[0]!.kind).toBe('update-params');
    expect(actions[1]!.kind).toBe('stop');
    expect(actions[2]!.kind).toBe('stop');
  });

  it('skips free slots entirely without emitting actions', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: null,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_ANON,
    });

    const actions = call({
      table,
      channelState: fillStates(table, {
        0: makeState({ isPlaying: true }),
      }),
    });

    expect(actions).toEqual([]);
  });

  it('mutates the table so a stopped slot is re-allocatable in the same frame', () => {
    const table = createChannelTable(2);
    allocateChannel(table, {
      origin: IMP_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_PISTOL,
    });
    allocateChannel(table, {
      origin: null,
      sfxId: SFX_DOOR,
      priority: NORM_PRIORITY,
      handle: HANDLE_DOOR,
    });

    call({
      table,
      channelState: fillStates(table, {
        0: makeState({ isPlaying: false }),
        1: makeState({ isPlaying: true }),
      }),
    });

    expect(table.channels[0]!.sfxId).toBeNull();
    expect(table.channels[1]!.sfxId).toBe(SFX_DOOR);

    const next = allocateChannel(table, {
      origin: LOST_SOUL_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: 0x99,
    });
    expect(next).toBe(0);
  });

  it('does not emit duplicate actions per channel when link-stop fires', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: IMP_ORIGIN,
      sfxId: SFX_DOOR,
      priority: NORM_PRIORITY,
      handle: HANDLE_DOOR,
    });

    const actions = call({
      table,
      channelState: fillStates(table, {
        0: makeState({
          isPlaying: true,
          sourcePosition: { x: 10 * FRACUNIT, y: 0 },
          linkVolumeAdjust: -SFX_VOLUME_FULL,
        }),
      }),
    });

    expect(actions.length).toBe(1);
    expect(actions[0]!).toEqual({ kind: 'stop', cnum: 0, handle: HANDLE_DOOR });
  });
});

describe('updateSounds — parity edge cases', () => {
  it('listener==origin (self sound) skips adjust even when sourcePosition is far away', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: PLAYER_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_PISTOL,
    });

    const actions = call({
      table,
      listenerOrigin: PLAYER_ORIGIN,
      channelState: fillStates(table, {
        0: makeState({
          isPlaying: true,
          sourcePosition: { x: S_CLIPPING_DIST + 100 * FRACUNIT, y: 0 },
        }),
      }),
    });

    expect(actions).toEqual([]);
    expect(table.channels[0]!.sfxId).toBe(SFX_PISTOL);
  });

  it('remote origin at the same position as the listener stays audible at full volume', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: IMP_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_PISTOL,
    });

    const actions = call({
      table,
      channelState: fillStates(table, {
        0: makeState({
          isPlaying: true,
          sourcePosition: { x: 0, y: 0 },
        }),
      }),
    });

    expect(actions.length).toBe(1);
    expect(actions[0]!.kind).toBe('update-params');
    expect(actions[0]!.volume).toBe(SFX_VOLUME_FULL);
    expect(actions[0]!.separation).toBe(NORM_SEP + 1);
  });

  it('sfxVolume=0 produces an inaudible sound for any remote distance and stops the slot', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: IMP_ORIGIN,
      sfxId: SFX_PISTOL,
      priority: NORM_PRIORITY,
      handle: HANDLE_PISTOL,
    });

    const actions = call({
      table,
      sfxVolume: 0,
      channelState: fillStates(table, {
        0: makeState({
          isPlaying: true,
          sourcePosition: { x: 500 * FRACUNIT, y: 0 },
        }),
      }),
    });

    expect(actions).toEqual([{ kind: 'stop', cnum: 0, handle: HANDLE_PISTOL }]);
  });
});

describe('buildChannelUpdateStates helper', () => {
  it('invokes resolve once per cnum in ascending order', () => {
    const table = createChannelTable(4);
    const seen: number[] = [];
    const states = buildChannelUpdateStates(table, (cnum) => {
      seen.push(cnum);
      return makeState({ isPlaying: cnum % 2 === 0 });
    });

    expect(seen).toEqual([0, 1, 2, 3]);
    expect(states.length).toBe(4);
    expect(states[0]!.isPlaying).toBe(true);
    expect(states[1]!.isPlaying).toBe(false);
  });

  it('returns a fresh array on each call', () => {
    const table = createChannelTable(2);
    const a = buildChannelUpdateStates(table, () => makeState());
    const b = buildChannelUpdateStates(table, () => makeState());
    expect(a).not.toBe(b);
  });
});
