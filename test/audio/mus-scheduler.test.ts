import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { LumpLookup } from '../../src/wad/lumpLookup.ts';
import { MUS_HEADER_SIZE } from '../../src/assets/mus.ts';
import { MusEventKind, parseMusScore } from '../../src/audio/musParser.ts';
import type { MusEvent, MusScore } from '../../src/audio/musParser.ts';
import { MUS_CHANNEL_COUNT, MUS_DEFAULT_VELOCITY, MUS_TICK_HZ, MUS_TICKS_PER_GAME_TIC, advanceMusScheduler, createMusScheduler } from '../../src/audio/musScheduler.ts';
import type { DispatchedMusEvent, DispatchedMusEventEntry, MusSchedulerState } from '../../src/audio/musScheduler.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const wadHeader = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, wadHeader);
const lookup = new LumpLookup(directory);

function buildMusLump(score: number[]): Buffer {
  const scoreBytes = Buffer.from(score);
  const buf = Buffer.alloc(MUS_HEADER_SIZE + scoreBytes.length);
  buf.write('MUS\x1A', 0, 'ascii');
  buf.writeUInt16LE(scoreBytes.length, 4);
  buf.writeUInt16LE(MUS_HEADER_SIZE, 6);
  buf.writeUInt16LE(1, 8);
  buf.writeUInt16LE(0, 10);
  buf.writeUInt16LE(0, 12);
  buf.writeUInt16LE(0, 14);
  scoreBytes.copy(buf, MUS_HEADER_SIZE);
  return buf;
}

function parseSynthetic(score: number[]): Readonly<MusScore> {
  return parseMusScore(buildMusLump(score));
}

function lumpDataBuffer(name: string): Buffer {
  return lookup.getLumpData(name, wadBuffer);
}

describe('MUS scheduler constants', () => {
  it('MUS_TICK_HZ is 140', () => {
    expect(MUS_TICK_HZ).toBe(140);
  });

  it('MUS_TICKS_PER_GAME_TIC is 4 (140 / 35)', () => {
    expect(MUS_TICKS_PER_GAME_TIC).toBe(4);
    expect(MUS_TICK_HZ / 35).toBe(MUS_TICKS_PER_GAME_TIC);
  });

  it('MUS_DEFAULT_VELOCITY is 127 matching vanilla mus2mid channelvelocities[] seed', () => {
    expect(MUS_DEFAULT_VELOCITY).toBe(127);
  });

  it('MUS_CHANNEL_COUNT is 16 matching MUS channel-number range [0, 15]', () => {
    expect(MUS_CHANNEL_COUNT).toBe(16);
  });
});

describe('createMusScheduler', () => {
  it('seeds eventIndex=0, delayRemaining=0, finished=false, elapsedQuickticks=0', () => {
    const score = parseSynthetic([0x60]);
    const state = createMusScheduler(score);
    expect(state.eventIndex).toBe(0);
    expect(state.delayRemaining).toBe(0);
    expect(state.finished).toBe(false);
    expect(state.elapsedQuickticks).toBe(0);
  });

  it('defaults looping to false', () => {
    const score = parseSynthetic([0x60]);
    const state = createMusScheduler(score);
    expect(state.looping).toBe(false);
  });

  it('honors explicit looping: true', () => {
    const score = parseSynthetic([0x60]);
    const state = createMusScheduler(score, { looping: true });
    expect(state.looping).toBe(true);
  });

  it('seeds channelVelocities with MUS_DEFAULT_VELOCITY for every channel', () => {
    const score = parseSynthetic([0x60]);
    const state = createMusScheduler(score);
    expect(state.channelVelocities).toHaveLength(MUS_CHANNEL_COUNT);
    for (const v of state.channelVelocities) {
      expect(v).toBe(MUS_DEFAULT_VELOCITY);
    }
  });

  it('shares the events array with the parsed score (does not copy)', () => {
    const score = parseSynthetic([0x60]);
    const state = createMusScheduler(score);
    expect(state.events).toBe(score.events);
  });
});

describe('advanceMusScheduler input validation', () => {
  it('throws RangeError on negative quickticks', () => {
    const state = createMusScheduler(parseSynthetic([0x60]));
    expect(() => advanceMusScheduler(state, -1)).toThrow(RangeError);
  });

  it('throws RangeError on non-integer quickticks', () => {
    const state = createMusScheduler(parseSynthetic([0x60]));
    expect(() => advanceMusScheduler(state, 1.5)).toThrow(RangeError);
  });

  it('throws RangeError on NaN quickticks', () => {
    const state = createMusScheduler(parseSynthetic([0x60]));
    expect(() => advanceMusScheduler(state, Number.NaN)).toThrow(RangeError);
  });

  it('returns empty array and leaves state untouched when quickticks=0', () => {
    const state = createMusScheduler(parseSynthetic([0x60]));
    const dispatched = advanceMusScheduler(state, 0);
    expect(dispatched).toEqual([]);
    expect(state.eventIndex).toBe(0);
    expect(state.elapsedQuickticks).toBe(0);
    expect(state.finished).toBe(false);
  });
});

describe('advanceMusScheduler single-event dispatch', () => {
  it('dispatches the first event at quicktick 0 with zero delay', () => {
    const score = parseSynthetic([0x60]);
    const state = createMusScheduler(score);
    const dispatched = advanceMusScheduler(state, 1);
    expect(dispatched).toHaveLength(1);
    expect(Object.isFrozen(dispatched)).toBe(true);
    expect(dispatched[0]!.musQuicktick).toBe(0);
    expect(dispatched[0]!.event.kind).toBe(MusEventKind.ScoreEnd);
    expect(state.finished).toBe(true);
  });

  it('advances elapsedQuickticks by the supplied window even after finishing early', () => {
    const score = parseSynthetic([0x60]);
    const state = createMusScheduler(score);
    advanceMusScheduler(state, 10);
    expect(state.elapsedQuickticks).toBe(10);
  });
});

describe('advanceMusScheduler delay accumulation', () => {
  it('holds the next event until delayRemaining reaches 0', () => {
    const score = parseSynthetic([0x80, 60, 5, 0x60]);
    const state = createMusScheduler(score);

    const first = advanceMusScheduler(state, 2);
    expect(first).toHaveLength(1);
    expect(first[0]!.event.kind).toBe(MusEventKind.ReleaseNote);
    expect(first[0]!.musQuicktick).toBe(0);
    expect(state.elapsedQuickticks).toBe(2);
    expect(state.delayRemaining).toBe(3);
    expect(state.finished).toBe(false);

    const mid = advanceMusScheduler(state, 3);
    expect(mid).toHaveLength(1);
    const endEvent = mid[0]!.event;
    expect(endEvent.kind).toBe(MusEventKind.ScoreEnd);
    expect(mid[0]!.musQuicktick).toBe(5);
    expect(state.finished).toBe(true);
    expect(state.elapsedQuickticks).toBe(5);
  });

  it('fires an event exactly on its scheduled tick when delayRemaining == remaining', () => {
    const score = parseSynthetic([0x80, 60, 7, 0x60]);
    const state = createMusScheduler(score);
    advanceMusScheduler(state, 1);
    expect(state.delayRemaining).toBe(6);
    const dispatched = advanceMusScheduler(state, 6);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.musQuicktick).toBe(7);
    expect(dispatched[0]!.event.kind).toBe(MusEventKind.ScoreEnd);
  });
});

describe('advanceMusScheduler chained zero-delay events', () => {
  it('dispatches consecutive delay=0 events on the same quicktick', () => {
    const score = parseSynthetic([0x00, 60, 0x00, 72, 0x60]);
    const state = createMusScheduler(score);
    const dispatched = advanceMusScheduler(state, 1);
    expect(dispatched).toHaveLength(3);
    expect(dispatched.map((entry) => entry.musQuicktick)).toEqual([0, 0, 0]);
    expect(dispatched.map((entry) => entry.event.kind)).toEqual([MusEventKind.ReleaseNote, MusEventKind.ReleaseNote, MusEventKind.ScoreEnd]);
  });
});

describe('advanceMusScheduler velocity resolution', () => {
  it('explicit velocity on PlayNote updates the per-channel cache and dispatches the literal velocity', () => {
    const score = parseSynthetic([0x10, 64 | 0x80, 100, 0x60]);
    const state = createMusScheduler(score);
    const dispatched = advanceMusScheduler(state, 1);
    const play = dispatched[0]!.event;
    expect(play.kind).toBe(MusEventKind.PlayNote);
    if (play.kind === MusEventKind.PlayNote) {
      expect(play.velocity).toBe(100);
    }
    expect(state.channelVelocities[0]).toBe(100);
  });

  it('velocity=null on PlayNote resolves from the per-channel cache after a prior explicit velocity', () => {
    const score = parseSynthetic([0x10, 64 | 0x80, 90, 0x10, 62, 0x60]);
    const state = createMusScheduler(score);
    const dispatched = advanceMusScheduler(state, 1);
    expect(dispatched).toHaveLength(3);
    const [first, second] = dispatched as [DispatchedMusEventEntry, DispatchedMusEventEntry];
    expect(first.event.kind).toBe(MusEventKind.PlayNote);
    expect(second.event.kind).toBe(MusEventKind.PlayNote);
    if (first.event.kind === MusEventKind.PlayNote && second.event.kind === MusEventKind.PlayNote) {
      expect(first.event.velocity).toBe(90);
      expect(second.event.velocity).toBe(90);
    }
  });

  it('velocity=null on PlayNote resolves to MUS_DEFAULT_VELOCITY when the channel has never seen an explicit velocity', () => {
    const score = parseSynthetic([0x15, 55, 0x60]);
    const state = createMusScheduler(score);
    const dispatched = advanceMusScheduler(state, 1);
    const play = dispatched[0]!.event;
    expect(play.kind).toBe(MusEventKind.PlayNote);
    if (play.kind === MusEventKind.PlayNote) {
      expect(play.channel).toBe(5);
      expect(play.velocity).toBe(MUS_DEFAULT_VELOCITY);
    }
  });

  it('per-channel caches are independent: updating channel 1 does not change channel 2 resolution', () => {
    const score = parseSynthetic([0x11, 64 | 0x80, 40, 0x12, 60, 0x60]);
    const state = createMusScheduler(score);
    const dispatched = advanceMusScheduler(state, 1);
    expect(dispatched).toHaveLength(3);
    const second = dispatched[1]!.event;
    expect(second.kind).toBe(MusEventKind.PlayNote);
    if (second.kind === MusEventKind.PlayNote) {
      expect(second.channel).toBe(2);
      expect(second.velocity).toBe(MUS_DEFAULT_VELOCITY);
    }
    expect(state.channelVelocities[1]).toBe(40);
    expect(state.channelVelocities[2]).toBe(MUS_DEFAULT_VELOCITY);
  });

  it('explicit velocity overwrites the cache for subsequent null-velocity lookups on the same channel', () => {
    const score = parseSynthetic([0x10, 60 | 0x80, 90, 0x10, 61 | 0x80, 50, 0x10, 62, 0x60]);
    const state = createMusScheduler(score);
    const dispatched = advanceMusScheduler(state, 1);
    const third = dispatched[2]!.event;
    expect(third.kind).toBe(MusEventKind.PlayNote);
    if (third.kind === MusEventKind.PlayNote) {
      expect(third.velocity).toBe(50);
    }
  });
});

describe('advanceMusScheduler partial advance ordering', () => {
  it('two advance calls produce identical dispatch to one equivalent call', () => {
    const buildScore = (): MusScore => parseSynthetic([0x00, 60, 0xa0, 3, 61 | 0x80, 70, 0x60]);
    const combinedState = createMusScheduler(buildScore());
    const combined = advanceMusScheduler(combinedState, 10);

    const splitState = createMusScheduler(buildScore());
    const first = advanceMusScheduler(splitState, 2);
    const second = advanceMusScheduler(splitState, 8);
    const split = [...first, ...second];

    expect(split.length).toBe(combined.length);
    for (let i = 0; i < combined.length; i++) {
      expect(split[i]!.musQuicktick).toBe(combined[i]!.musQuicktick);
      expect(split[i]!.event.kind).toBe(combined[i]!.event.kind);
    }
  });
});

describe('advanceMusScheduler score-end termination', () => {
  it('sets finished=true after dispatching ScoreEnd and suppresses further dispatch', () => {
    const score = parseSynthetic([0x60]);
    const state = createMusScheduler(score);
    advanceMusScheduler(state, 1);
    expect(state.finished).toBe(true);
    const later = advanceMusScheduler(state, 100);
    expect(later).toEqual([]);
    expect(state.elapsedQuickticks).toBe(101);
  });
});

describe('advanceMusScheduler looping', () => {
  it('rewinds to the start after ScoreEnd when looping=true', () => {
    const score = parseSynthetic([0x00, 60, 0x60]);
    const state = createMusScheduler(score, { looping: true });
    const dispatched = advanceMusScheduler(state, 1);
    expect(dispatched).toHaveLength(2);
    expect(dispatched[1]!.event.kind).toBe(MusEventKind.ScoreEnd);
    expect(state.finished).toBe(false);
    expect(state.eventIndex).toBe(0);
    const more = advanceMusScheduler(state, 1);
    expect(more).toHaveLength(2);
    expect(more[0]!.event.kind).toBe(MusEventKind.ReleaseNote);
    expect(more[1]!.event.kind).toBe(MusEventKind.ScoreEnd);
  });

  it('preserves the per-channel velocity cache across loop boundaries', () => {
    const score = parseSynthetic([0x10, 60, 0x10, 61 | 0x80, 45, 0xe0, 2]);
    const state = createMusScheduler(score, { looping: true });
    const dispatched = advanceMusScheduler(state, 4);
    expect(state.channelVelocities[0]).toBe(45);
    const playNotes = dispatched.filter((entry) => entry.event.kind === MusEventKind.PlayNote);
    expect(playNotes.length).toBeGreaterThanOrEqual(3);
    const firstPre = playNotes[0]!.event;
    const secondPre = playNotes[1]!.event;
    const firstPost = playNotes[2]!.event;
    if (firstPre.kind === MusEventKind.PlayNote) {
      expect(firstPre.velocity).toBe(MUS_DEFAULT_VELOCITY);
    }
    if (secondPre.kind === MusEventKind.PlayNote) {
      expect(secondPre.velocity).toBe(45);
    }
    if (firstPost.kind === MusEventKind.PlayNote) {
      expect(firstPost.velocity).toBe(45);
    }
  });

  it('respects a non-zero ScoreEnd delay as the pause before replay', () => {
    const score = parseSynthetic([0x00, 60, 0xe0, 5]);
    const state = createMusScheduler(score, { looping: true });
    const dispatched = advanceMusScheduler(state, 10);
    expect(dispatched.map((entry) => ({ kind: entry.event.kind, tick: entry.musQuicktick }))).toEqual([
      { kind: MusEventKind.ReleaseNote, tick: 0 },
      { kind: MusEventKind.ScoreEnd, tick: 0 },
      { kind: MusEventKind.ReleaseNote, tick: 5 },
      { kind: MusEventKind.ScoreEnd, tick: 5 },
      { kind: MusEventKind.ReleaseNote, tick: 10 },
    ]);
    expect(state.elapsedQuickticks).toBe(10);
    expect(state.finished).toBe(false);
  });
});

describe('parity: DOOM1.WAD D_E1M1 dispatch', () => {
  const lump = lumpDataBuffer('D_E1M1');
  const score = parseMusScore(lump);

  it('dispatches every parsed event exactly once when run to completion', () => {
    const state = createMusScheduler(score);
    const totalDelay = score.totalDelay;
    const dispatched: DispatchedMusEventEntry[] = [];
    const window = MUS_TICK_HZ * 2;
    while (!state.finished) {
      const produced = advanceMusScheduler(state, window);
      dispatched.push(...produced);
    }
    expect(dispatched.length).toBe(score.events.length);
    for (let i = 0; i < score.events.length; i++) {
      expect(dispatched[i]!.event.kind).toBe(score.events[i]!.kind);
    }
    expect(dispatched.at(-1)!.event.kind).toBe(MusEventKind.ScoreEnd);
    expect(dispatched.at(-1)!.musQuicktick).toBe(totalDelay - score.events.at(-1)!.delay);
  });

  it('absolute quickticks are non-decreasing and the final tick equals the cumulative pre-end delay', () => {
    const state = createMusScheduler(score);
    const dispatched: DispatchedMusEventEntry[] = [];
    while (!state.finished) {
      const produced = advanceMusScheduler(state, MUS_TICK_HZ);
      dispatched.push(...produced);
    }
    for (let i = 1; i < dispatched.length; i++) {
      expect(dispatched[i]!.musQuicktick).toBeGreaterThanOrEqual(dispatched[i - 1]!.musQuicktick);
    }
    let cumulative = 0;
    for (let i = 0; i < score.events.length - 1; i++) {
      cumulative += score.events[i]!.delay;
    }
    expect(dispatched.at(-1)!.musQuicktick).toBe(cumulative);
  });

  it('produces PlayNote events with strictly positive, integer velocities after resolution', () => {
    const state = createMusScheduler(score);
    const dispatched: DispatchedMusEventEntry[] = [];
    while (!state.finished) {
      dispatched.push(...advanceMusScheduler(state, MUS_TICK_HZ));
    }
    const playNotes = dispatched.filter((entry) => entry.event.kind === MusEventKind.PlayNote);
    expect(playNotes.length).toBeGreaterThan(0);
    for (const entry of playNotes) {
      const event = entry.event;
      if (event.kind === MusEventKind.PlayNote) {
        expect(Number.isInteger(event.velocity)).toBe(true);
        expect(event.velocity).toBeGreaterThan(0);
        expect(event.velocity).toBeLessThanOrEqual(127);
      }
    }
  });
});

describe('parity-sensitive edge cases', () => {
  it('dispatches ScoreEnd with its original delay field preserved', () => {
    const score = parseSynthetic([0xe0, 3]);
    const state = createMusScheduler(score);
    const dispatched = advanceMusScheduler(state, 10);
    expect(dispatched).toHaveLength(1);
    const end = dispatched[0]!.event;
    expect(end.kind).toBe(MusEventKind.ScoreEnd);
    if (end.kind === MusEventKind.ScoreEnd) {
      expect(end.delay).toBe(3);
    }
  });

  it('does not mutate the events array passed in through the scheduler state', () => {
    const score = parseSynthetic([0x00, 60, 0xe0, 3]);
    const snapshot = score.events.map((e) => ({ ...e }));
    const state = createMusScheduler(score, { looping: true });
    advanceMusScheduler(state, 10);
    expect(score.events).toHaveLength(snapshot.length);
    for (let i = 0; i < snapshot.length; i++) {
      expect(score.events[i]).toEqual(snapshot[i] as MusEvent);
    }
  });

  it('emits entries whose dispatched event stores the resolved velocity on PlayNote only', () => {
    const score = parseSynthetic([0x10, 60 | 0x80, 99, 0x20, 200, 0x60]);
    const state = createMusScheduler(score);
    const dispatched = advanceMusScheduler(state, 1);
    const playEvent = dispatched[0]!.event;
    const pitchBendEvent = dispatched[1]!.event;
    expect(playEvent.kind).toBe(MusEventKind.PlayNote);
    expect(pitchBendEvent.kind).toBe(MusEventKind.PitchBend);
    if (playEvent.kind === MusEventKind.PlayNote) {
      expect(playEvent.velocity).toBe(99);
    }
    if (pitchBendEvent.kind === MusEventKind.PitchBend) {
      expect(pitchBendEvent.bend).toBe(200);
    }
  });
});

describe('scheduler state reuse', () => {
  it('a second advance call on a finished scheduler is a no-op for dispatch but still advances elapsedQuickticks', () => {
    const score = parseSynthetic([0x60]);
    const state: MusSchedulerState = createMusScheduler(score);
    advanceMusScheduler(state, 5);
    expect(state.finished).toBe(true);
    expect(state.elapsedQuickticks).toBe(5);
    const more = advanceMusScheduler(state, 7);
    expect(more).toEqual([]);
    expect(state.elapsedQuickticks).toBe(12);
  });
});
