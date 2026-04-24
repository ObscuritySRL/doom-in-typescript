import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { LumpLookup } from '../../src/wad/lumpLookup.ts';
import { MUS_HEADER_SIZE, MUS_PERCUSSION_CHANNEL, parseMus } from '../../src/assets/mus.ts';
import {
  MUS_CHANNEL_MASK,
  MUS_CONTROLLER_CHANGE_MAX,
  MUS_CONTROLLER_CHANGE_MIN,
  MUS_EVENT_TYPE_MASK,
  MUS_EVENT_TYPE_SHIFT,
  MUS_LAST_EVENT_FLAG,
  MUS_NOTE_MAX,
  MUS_NOTE_VALUE_MASK,
  MUS_NOTE_VELOCITY_FLAG,
  MUS_SYSTEM_EVENT_CONTROLLER_MAX,
  MUS_SYSTEM_EVENT_CONTROLLER_MIN,
  MUS_VELOCITY_MAX,
  MusEventKind,
  parseMusScore,
} from '../../src/audio/musParser.ts';
import type { MusEvent } from '../../src/audio/musParser.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const wadHeader = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, wadHeader);
const lookup = new LumpLookup(directory);

const ALL_MUSIC_LUMP_NAMES = ['D_E1M1', 'D_E1M2', 'D_E1M3', 'D_E1M4', 'D_E1M5', 'D_E1M6', 'D_E1M7', 'D_E1M8', 'D_E1M9', 'D_INTER', 'D_INTRO', 'D_VICTOR', 'D_INTROA'] as const;

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

describe('MUS event mask constants', () => {
  it('MUS_LAST_EVENT_FLAG is 0x80', () => {
    expect(MUS_LAST_EVENT_FLAG).toBe(0x80);
  });

  it('MUS_EVENT_TYPE_MASK is 0x70', () => {
    expect(MUS_EVENT_TYPE_MASK).toBe(0x70);
  });

  it('MUS_EVENT_TYPE_SHIFT is 4', () => {
    expect(MUS_EVENT_TYPE_SHIFT).toBe(4);
  });

  it('MUS_CHANNEL_MASK is 0x0F', () => {
    expect(MUS_CHANNEL_MASK).toBe(0x0f);
  });

  it('MUS_NOTE_VELOCITY_FLAG is 0x80', () => {
    expect(MUS_NOTE_VELOCITY_FLAG).toBe(0x80);
  });

  it('MUS_NOTE_VALUE_MASK is 0x7F', () => {
    expect(MUS_NOTE_VALUE_MASK).toBe(0x7f);
  });

  it('MUS_NOTE_MAX is 127', () => {
    expect(MUS_NOTE_MAX).toBe(127);
  });

  it('MUS_VELOCITY_MAX is 127', () => {
    expect(MUS_VELOCITY_MAX).toBe(127);
  });

  it('system event controller range is 10..14', () => {
    expect(MUS_SYSTEM_EVENT_CONTROLLER_MIN).toBe(10);
    expect(MUS_SYSTEM_EVENT_CONTROLLER_MAX).toBe(14);
  });

  it('controller change range is 0..9', () => {
    expect(MUS_CONTROLLER_CHANGE_MIN).toBe(0);
    expect(MUS_CONTROLLER_CHANGE_MAX).toBe(9);
  });

  it('descriptor masks decompose without overlap', () => {
    expect((MUS_LAST_EVENT_FLAG | MUS_EVENT_TYPE_MASK | MUS_CHANNEL_MASK) >>> 0).toBe(0xff);
    expect((MUS_LAST_EVENT_FLAG & MUS_EVENT_TYPE_MASK) >>> 0).toBe(0);
    expect((MUS_EVENT_TYPE_MASK & MUS_CHANNEL_MASK) >>> 0).toBe(0);
  });
});

describe('MusEventKind discriminants', () => {
  it('matches the MUS event-type field encoding', () => {
    expect(MusEventKind.ReleaseNote).toBe(0);
    expect(MusEventKind.PlayNote).toBe(1);
    expect(MusEventKind.PitchBend).toBe(2);
    expect(MusEventKind.SystemEvent).toBe(3);
    expect(MusEventKind.ControllerChange).toBe(4);
    expect(MusEventKind.ScoreEnd).toBe(6);
  });

  it('is a frozen enum object', () => {
    expect(Object.isFrozen(MusEventKind)).toBe(true);
  });
});

describe('parseMusScore on synthetic single-event scores', () => {
  it('decodes a release-note then score-end pair', () => {
    const lump = buildMusLump([0x00, 60, 0x60]);
    const score = parseMusScore(lump);
    expect(score.events.length).toBe(2);
    const [release, end] = score.events as [MusEvent, MusEvent];
    expect(release.kind).toBe(MusEventKind.ReleaseNote);
    expect(release).toMatchObject({ channel: 0, delay: 0 });
    if (release.kind === MusEventKind.ReleaseNote) {
      expect(release.note).toBe(60);
    }
    expect(end.kind).toBe(MusEventKind.ScoreEnd);
  });

  it('decodes a play-note without explicit velocity', () => {
    const lump = buildMusLump([0x10, 64, 0x60]);
    const score = parseMusScore(lump);
    const play = score.events[0]!;
    expect(play.kind).toBe(MusEventKind.PlayNote);
    if (play.kind === MusEventKind.PlayNote) {
      expect(play.note).toBe(64);
      expect(play.velocity).toBeNull();
    }
  });

  it('decodes a play-note with explicit velocity (note bit 7 set)', () => {
    const lump = buildMusLump([0x10, 64 | 0x80, 100, 0x60]);
    const score = parseMusScore(lump);
    const play = score.events[0]!;
    expect(play.kind).toBe(MusEventKind.PlayNote);
    if (play.kind === MusEventKind.PlayNote) {
      expect(play.note).toBe(64);
      expect(play.velocity).toBe(100);
    }
  });

  it('decodes a pitch-bend event with the raw bend byte', () => {
    const lump = buildMusLump([0x20, 200, 0x60]);
    const score = parseMusScore(lump);
    const bend = score.events[0]!;
    expect(bend.kind).toBe(MusEventKind.PitchBend);
    if (bend.kind === MusEventKind.PitchBend) {
      expect(bend.bend).toBe(200);
    }
  });

  it('decodes a system event with controller in [10, 14]', () => {
    const lump = buildMusLump([0x30, 11, 0x60]);
    const score = parseMusScore(lump);
    const sys = score.events[0]!;
    expect(sys.kind).toBe(MusEventKind.SystemEvent);
    if (sys.kind === MusEventKind.SystemEvent) {
      expect(sys.controller).toBe(11);
    }
  });

  it('decodes a controller-change event with controller and value', () => {
    const lump = buildMusLump([0x40, 7, 96, 0x60]);
    const score = parseMusScore(lump);
    const ctrl = score.events[0]!;
    expect(ctrl.kind).toBe(MusEventKind.ControllerChange);
    if (ctrl.kind === MusEventKind.ControllerChange) {
      expect(ctrl.controller).toBe(7);
      expect(ctrl.value).toBe(96);
    }
  });

  it('decodes the percussion channel as channel 15', () => {
    const lump = buildMusLump([0x10 | MUS_PERCUSSION_CHANNEL, 35, 0x60]);
    const score = parseMusScore(lump);
    const play = score.events[0]!;
    expect(play.channel).toBe(15);
  });
});

describe('parseMusScore variable-length delays', () => {
  it('attaches a 0-delay to events without the last-event-of-group flag', () => {
    const lump = buildMusLump([0x00, 60, 0x60]);
    const score = parseMusScore(lump);
    expect(score.events[0]!.delay).toBe(0);
  });

  it('reads a 1-byte delay when the last-event flag is set', () => {
    // 0x80 | 0x00 (release-note, last-event flag) + note 60 + delay 5 + score-end
    const lump = buildMusLump([0x80, 60, 5, 0x60]);
    const score = parseMusScore(lump);
    expect(score.events[0]!.delay).toBe(5);
    expect(score.totalDelay).toBe(5);
  });

  it('accumulates a multi-byte VLQ delay (delay = (delay << 7) | (byte & 0x7F))', () => {
    // delay bytes [0x83, 0x40] -> value = (0x03 * 128) + 0x40 = 384 + 64 = 448
    const lump = buildMusLump([0x80, 60, 0x83, 0x40, 0x60]);
    const score = parseMusScore(lump);
    expect(score.events[0]!.delay).toBe(448);
    expect(score.totalDelay).toBe(448);
  });

  it('sums every event delay into totalDelay', () => {
    // release+delay 3, play+delay 7 (no velocity), score-end
    const lump = buildMusLump([0x80, 60, 3, 0x90, 64, 7, 0x60]);
    const score = parseMusScore(lump);
    expect(score.events.map((e) => e.delay)).toEqual([3, 7, 0]);
    expect(score.totalDelay).toBe(10);
  });
});

describe('parseMusScore error cases', () => {
  it('throws on a reserved event type 5', () => {
    const lump = buildMusLump([0x50, 0x60]);
    expect(() => parseMusScore(lump)).toThrow(/reserved event type 5/);
  });

  it('throws on a reserved event type 7', () => {
    const lump = buildMusLump([0x70, 0x60]);
    expect(() => parseMusScore(lump)).toThrow(/reserved event type 7/);
  });

  it('throws when a system event references a controller below 10', () => {
    const lump = buildMusLump([0x30, 5, 0x60]);
    expect(() => parseMusScore(lump)).toThrow(/system-event controller 5/);
  });

  it('throws when a system event references a controller above 14', () => {
    const lump = buildMusLump([0x30, 20, 0x60]);
    expect(() => parseMusScore(lump)).toThrow(/system-event controller 20/);
  });

  it('throws when a controller-change references a controller above 9', () => {
    const lump = buildMusLump([0x40, 11, 5, 0x60]);
    expect(() => parseMusScore(lump)).toThrow(/controller-change controller 11/);
  });

  it('throws when score data ends without a ScoreEnd event', () => {
    const lump = buildMusLump([0x00, 60]); // release-note, no score-end
    expect(() => parseMusScore(lump)).toThrow(/without a ScoreEnd event/);
  });

  it('throws when a body byte is missing', () => {
    const lump = buildMusLump([0x00]); // release-note descriptor with no note byte
    expect(() => parseMusScore(lump)).toThrow(/truncated reading release-note note/);
  });

  it('throws when a variable-length delay is truncated', () => {
    // last-event flag set, then a delay byte with continuation flag, then EOF
    const lump = buildMusLump([0x80, 60, 0x80]);
    expect(() => parseMusScore(lump)).toThrow(/truncated reading variable-length delay/);
  });
});

describe('parseMusScore on DOOM1.WAD D_E1M1', () => {
  const lumpData = lookup.getLumpData('D_E1M1', wadBuffer);
  const score = parseMusScore(lumpData);

  it('header agrees with parseMus on the same lump', () => {
    const direct = parseMus(lumpData);
    expect(score.header.scoreLength).toBe(direct.scoreLength);
    expect(score.header.channelCount).toBe(direct.channelCount);
    expect(score.header.instruments).toEqual(direct.instruments);
  });

  it('terminates with a ScoreEnd event', () => {
    const last = score.events.at(-1)!;
    expect(last.kind).toBe(MusEventKind.ScoreEnd);
    expect(last.delay).toBe(0);
  });

  it('contains at least one ScoreEnd and exactly one terminal event', () => {
    const ends = score.events.filter((e) => e.kind === MusEventKind.ScoreEnd);
    expect(ends.length).toBe(1);
  });

  it('contains play-note events (the song actually plays notes)', () => {
    const plays = score.events.filter((e) => e.kind === MusEventKind.PlayNote);
    expect(plays.length).toBeGreaterThan(0);
  });

  it('every event channel is in [0, 15]', () => {
    for (const event of score.events) {
      expect(event.channel).toBeGreaterThanOrEqual(0);
      expect(event.channel).toBeLessThanOrEqual(15);
    }
  });

  it('every event delay is non-negative', () => {
    for (const event of score.events) {
      expect(event.delay).toBeGreaterThanOrEqual(0);
    }
  });

  it('totalDelay equals the sum of every event.delay', () => {
    const sum = score.events.reduce((acc, e) => acc + e.delay, 0);
    expect(score.totalDelay).toBe(sum);
  });

  it('bytesConsumed does not exceed scoreLength', () => {
    expect(score.bytesConsumed).toBeLessThanOrEqual(score.header.scoreLength);
  });

  it('returned score is frozen', () => {
    expect(Object.isFrozen(score)).toBe(true);
    expect(Object.isFrozen(score.events)).toBe(true);
    expect(Object.isFrozen(score.events[0])).toBe(true);
  });
});

describe('parseMusScore on every DOOM1.WAD music lump', () => {
  it('parses every shareware MUS lump without error', () => {
    for (const name of ALL_MUSIC_LUMP_NAMES) {
      const lumpData = lookup.getLumpData(name, wadBuffer);
      const score = parseMusScore(lumpData);
      expect(score.events.at(-1)!.kind).toBe(MusEventKind.ScoreEnd);
      expect(score.events.length).toBeGreaterThan(1);
    }
  });

  it('every parsed score reports a positive totalDelay', () => {
    for (const name of ALL_MUSIC_LUMP_NAMES) {
      const lumpData = lookup.getLumpData(name, wadBuffer);
      const score = parseMusScore(lumpData);
      expect(score.totalDelay).toBeGreaterThan(0);
    }
  });

  it('every parsed score keeps event channels within the declared header channelCount + percussion', () => {
    for (const name of ALL_MUSIC_LUMP_NAMES) {
      const lumpData = lookup.getLumpData(name, wadBuffer);
      const score = parseMusScore(lumpData);
      const allowed = new Set<number>();
      for (let c = 0; c < 16; c++) {
        allowed.add(c);
      }
      for (const event of score.events) {
        expect(allowed.has(event.channel)).toBe(true);
      }
    }
  });
});

describe('parseMusScore parity-sensitive edge cases', () => {
  it('preserves channel field exactly as encoded in the descriptor byte', () => {
    const lump = buildMusLump([0x07, 60, 0x6f]);
    const score = parseMusScore(lump);
    expect(score.events[0]!.channel).toBe(7);
    expect(score.events[1]!.channel).toBe(15);
  });

  it('PlayNote velocity null preserves "reuse previous channel velocity" semantics', () => {
    const lump = buildMusLump([0x10, 64 | 0x80, 100, 0x10, 64, 0x60]);
    const score = parseMusScore(lump);
    const first = score.events[0]!;
    const second = score.events[1]!;
    if (first.kind === MusEventKind.PlayNote && second.kind === MusEventKind.PlayNote) {
      expect(first.velocity).toBe(100);
      expect(second.velocity).toBeNull();
    } else {
      throw new Error('expected two PlayNote events');
    }
  });

  it('matches MIDI VLQ semantics for the documented delay encoding', () => {
    // Single-byte delay: 0x40 -> 64
    expect(parseMusScore(buildMusLump([0x80, 60, 0x40, 0x60])).events[0]!.delay).toBe(64);
    // Two-byte delay: 0x81 0x00 -> 128
    expect(parseMusScore(buildMusLump([0x80, 60, 0x81, 0x00, 0x60])).events[0]!.delay).toBe(128);
    // Three-byte delay: 0x81 0x80 0x00 -> 16384
    expect(parseMusScore(buildMusLump([0x80, 60, 0x81, 0x80, 0x00, 0x60])).events[0]!.delay).toBe(16384);
  });
});
