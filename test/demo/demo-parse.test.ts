import { describe, expect, it } from 'bun:test';

import {
  DEMO_END_MARKER,
  DEMO_LONG_TICS_COMMAND_SIZE,
  DEMO_LONG_TICS_VERSION,
  DEMO_MAX_PLAYERS,
  DEMO_OLD_FORMAT_HEADER_SIZE,
  DEMO_TIC_RATE,
  DEMO_VANILLA_COMMAND_SIZE,
  DEMO_VANILLA_HEADER_SIZE,
  DEMO_VANILLA_VERSION_19,
  parseDemo,
} from '../../src/demo/demoParse.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { LumpLookup } from '../../src/wad/lumpLookup.ts';

const REFERENCE_WAD_PATH = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const REFERENCE_WAD_BUFFER = Buffer.from(await Bun.file(REFERENCE_WAD_PATH).arrayBuffer());
const REFERENCE_WAD_DIRECTORY = parseWadDirectory(REFERENCE_WAD_BUFFER, parseWadHeader(REFERENCE_WAD_BUFFER));
const REFERENCE_WAD_LOOKUP = new LumpLookup(REFERENCE_WAD_DIRECTORY);

function buildVersionedDemoBuffer(options: {
  readonly angleBytes: readonly number[];
  readonly buttons: number;
  readonly firstByte?: number;
  readonly forwardMove: number;
  readonly playersInGame: readonly boolean[];
  readonly sideMove: number;
}): Buffer {
  const versionByte = options.firstByte ?? DEMO_VANILLA_VERSION_19;
  const buffer = Buffer.alloc(DEMO_VANILLA_HEADER_SIZE + DEMO_LONG_TICS_COMMAND_SIZE + 1);
  let offset = 0;
  buffer[offset++] = versionByte;
  buffer[offset++] = 2;
  buffer[offset++] = 1;
  buffer[offset++] = 1;
  buffer[offset++] = 0;
  buffer[offset++] = 0;
  buffer[offset++] = 0;
  buffer[offset++] = 0;
  buffer[offset++] = 0;
  for (let playerIndex = 0; playerIndex < DEMO_MAX_PLAYERS; playerIndex++) {
    buffer[offset++] = options.playersInGame[playerIndex] ? 1 : 0;
  }
  buffer.writeInt8(options.forwardMove, offset++);
  buffer.writeInt8(options.sideMove, offset++);
  for (const angleByte of options.angleBytes) {
    buffer[offset++] = angleByte;
  }
  buffer[offset++] = options.buttons;
  buffer[offset++] = DEMO_END_MARKER;
  return buffer.subarray(0, offset);
}

function buildOldDemoBuffer(options: {
  readonly angleByte: number;
  readonly buttons: number;
  readonly episode: number;
  readonly forwardMove: number;
  readonly map: number;
  readonly playersInGame: readonly boolean[];
  readonly sideMove: number;
  readonly skill: number;
}): Buffer {
  const buffer = Buffer.alloc(DEMO_OLD_FORMAT_HEADER_SIZE + DEMO_VANILLA_COMMAND_SIZE + 1);
  let offset = 0;
  buffer[offset++] = options.skill;
  buffer[offset++] = options.episode;
  buffer[offset++] = options.map;
  for (let playerIndex = 0; playerIndex < DEMO_MAX_PLAYERS; playerIndex++) {
    buffer[offset++] = options.playersInGame[playerIndex] ? 1 : 0;
  }
  buffer.writeInt8(options.forwardMove, offset++);
  buffer.writeInt8(options.sideMove, offset++);
  buffer[offset++] = options.angleByte;
  buffer[offset++] = options.buttons;
  buffer[offset++] = DEMO_END_MARKER;
  return buffer.subarray(0, offset);
}

function getReferenceDemoLump(name: 'DEMO1' | 'DEMO2' | 'DEMO3'): Buffer {
  return REFERENCE_WAD_LOOKUP.getLumpData(name, REFERENCE_WAD_BUFFER);
}

describe('demo parser constants', () => {
  it('locks the vanilla version byte to 109', () => {
    expect(DEMO_VANILLA_VERSION_19).toBe(109);
  });

  it('locks the longtics version byte to 111', () => {
    expect(DEMO_LONG_TICS_VERSION).toBe(111);
  });

  it('locks the header widths to 7 and 13 bytes', () => {
    expect(DEMO_OLD_FORMAT_HEADER_SIZE).toBe(7);
    expect(DEMO_VANILLA_HEADER_SIZE).toBe(13);
  });

  it('locks the per-player command widths to 4 and 5 bytes', () => {
    expect(DEMO_VANILLA_COMMAND_SIZE).toBe(4);
    expect(DEMO_LONG_TICS_COMMAND_SIZE).toBe(5);
  });

  it('locks the player slot count at 4', () => {
    expect(DEMO_MAX_PLAYERS).toBe(4);
  });

  it('locks the end marker at 0x80', () => {
    expect(DEMO_END_MARKER).toBe(0x80);
  });

  it('locks the tic rate to PRIMARY_TARGET.ticRateHz', () => {
    expect(DEMO_TIC_RATE).toBe(PRIMARY_TARGET.ticRateHz);
  });
});

describe('parseDemo with bundled shareware demos', () => {
  const expectations = [
    { activePlayerCount: 1, episode: 1, map: 5, name: 'DEMO1' as const, ticCount: 5026 },
    { activePlayerCount: 1, episode: 1, map: 3, name: 'DEMO2' as const, ticCount: 3836 },
    { activePlayerCount: 1, episode: 1, map: 7, name: 'DEMO3' as const, ticCount: 2134 },
  ];

  it('parses all three bundled demos as vanilla 1.9 demos', () => {
    for (const expectation of expectations) {
      const parsedDemo = parseDemo(getReferenceDemoLump(expectation.name));
      expect(parsedDemo.format).toBe('vanilla');
      expect(parsedDemo.versionByte).toBe(DEMO_VANILLA_VERSION_19);
      expect(parsedDemo.headerByteLength).toBe(DEMO_VANILLA_HEADER_SIZE);
      expect(parsedDemo.commandByteLength).toBe(DEMO_VANILLA_COMMAND_SIZE);
    }
  });

  it('preserves the bundled header fields exactly', () => {
    for (const expectation of expectations) {
      const parsedDemo = parseDemo(getReferenceDemoLump(expectation.name));
      expect(parsedDemo.skill).toBe(2);
      expect(parsedDemo.episode).toBe(expectation.episode);
      expect(parsedDemo.map).toBe(expectation.map);
      expect(parsedDemo.deathmatch).toBe(0);
      expect(parsedDemo.respawnMonsters).toBe(0);
      expect(parsedDemo.fastMonsters).toBe(0);
      expect(parsedDemo.noMonsters).toBe(0);
      expect(parsedDemo.consolePlayer).toBe(0);
      expect(parsedDemo.playersInGame).toEqual([true, false, false, false]);
      expect(parsedDemo.activePlayerCount).toBe(expectation.activePlayerCount);
    }
  });

  it('derives the bundled tic counts and durations from the command stream', () => {
    for (const expectation of expectations) {
      const parsedDemo = parseDemo(getReferenceDemoLump(expectation.name));
      expect(parsedDemo.ticCount).toBe(expectation.ticCount);
      expect(parsedDemo.durationSeconds).toBe(expectation.ticCount / DEMO_TIC_RATE);
      expect(parsedDemo.commandsByTic.length).toBe(expectation.ticCount);
    }
  });

  it('places the end marker at header + ticCount * activePlayers * commandByteLength', () => {
    for (const expectation of expectations) {
      const demoBuffer = getReferenceDemoLump(expectation.name);
      const parsedDemo = parseDemo(demoBuffer);
      const expectedOffset = parsedDemo.headerByteLength + parsedDemo.ticCount * parsedDemo.activePlayerCount * parsedDemo.commandByteLength;
      expect(parsedDemo.endMarkerOffset).toBe(expectedOffset);
      expect(demoBuffer[expectedOffset]).toBe(DEMO_END_MARKER);
    }
  });

  it('returns frozen result, players array, and tic arrays', () => {
    const parsedDemo = parseDemo(getReferenceDemoLump('DEMO1'));
    expect(Object.isFrozen(parsedDemo)).toBe(true);
    expect(Object.isFrozen(parsedDemo.playersInGame)).toBe(true);
    expect(Object.isFrozen(parsedDemo.commandsByTic)).toBe(true);
    expect(Object.isFrozen(parsedDemo.commandsByTic[0])).toBe(true);
    expect(Object.isFrozen(parsedDemo.commandsByTic[0]![0])).toBe(true);
  });

  it('decodes the last DEMO1 tic before the marker as a real command, not as 0x80', () => {
    const parsedDemo = parseDemo(getReferenceDemoLump('DEMO1'));
    const lastCommand = parsedDemo.commandsByTic[parsedDemo.commandsByTic.length - 1]![0]!;
    expect(typeof lastCommand.forwardMove).toBe('number');
    expect(typeof lastCommand.sideMove).toBe('number');
    expect(typeof lastCommand.angleTurn).toBe('number');
    expect(typeof lastCommand.buttons).toBe('number');
  });
});

describe('parseDemo error handling', () => {
  it('rejects an empty buffer', () => {
    expect(() => parseDemo(Buffer.alloc(0))).toThrow(/at least 1 byte/);
  });

  it('rejects a versioned header truncated before 13 bytes', () => {
    expect(() => parseDemo(Buffer.alloc(4, DEMO_VANILLA_VERSION_19))).toThrow(/at least 13 bytes/);
  });

  it('rejects an old-format header truncated before 7 bytes', () => {
    const truncatedOldDemo = Buffer.from([2, 1, 1, 1, 0, 0]);
    expect(() => parseDemo(truncatedOldDemo)).toThrow(/at least 7 bytes/);
  });

  it('rejects demos with no active players', () => {
    const noPlayersBuffer = Buffer.alloc(DEMO_VANILLA_HEADER_SIZE + 1);
    noPlayersBuffer[0] = DEMO_VANILLA_VERSION_19;
    noPlayersBuffer[1] = 2;
    noPlayersBuffer[2] = 1;
    noPlayersBuffer[3] = 1;
    noPlayersBuffer[DEMO_VANILLA_HEADER_SIZE] = DEMO_END_MARKER;
    expect(() => parseDemo(noPlayersBuffer)).toThrow(/no active players/);
  });

  it('rejects a tic truncated before all active-player commands are present', () => {
    const truncatedTic = buildVersionedDemoBuffer({
      angleBytes: [0x20],
      buttons: 0x01,
      forwardMove: 1,
      playersInGame: [true, true, false, false],
      sideMove: -1,
    }).subarray(0, DEMO_VANILLA_HEADER_SIZE + 4);
    expect(() => parseDemo(truncatedTic)).toThrow(/truncated while reading player 1/);
  });

  it('rejects a demo that never terminates with 0x80', () => {
    const missingEndMarker = buildVersionedDemoBuffer({
      angleBytes: [0x20],
      buttons: 0x01,
      forwardMove: 1,
      playersInGame: [true, false, false, false],
      sideMove: -1,
    }).subarray(0, DEMO_VANILLA_HEADER_SIZE + 4);
    expect(() => parseDemo(missingEndMarker)).toThrow(/missing end marker/i);
  });
});

describe('parseDemo parity-sensitive edge cases from g_game.c', () => {
  it('treats leading bytes 0..4 as old demos without a version byte', () => {
    const oldFormatDemo = buildOldDemoBuffer({
      angleByte: 0x12,
      buttons: 0x34,
      episode: 1,
      forwardMove: 5,
      map: 3,
      playersInGame: [true, false, false, false],
      sideMove: -2,
      skill: 2,
    });

    const parsedDemo = parseDemo(oldFormatDemo);
    expect(parsedDemo.format).toBe('old');
    expect(parsedDemo.versionByte).toBeNull();
    expect(parsedDemo.headerByteLength).toBe(DEMO_OLD_FORMAT_HEADER_SIZE);
    expect(parsedDemo.commandByteLength).toBe(DEMO_VANILLA_COMMAND_SIZE);
    expect(parsedDemo.skill).toBe(2);
    expect(parsedDemo.episode).toBe(1);
    expect(parsedDemo.map).toBe(3);
    expect(parsedDemo.deathmatch).toBe(0);
    expect(parsedDemo.respawnMonsters).toBe(0);
    expect(parsedDemo.fastMonsters).toBe(0);
    expect(parsedDemo.noMonsters).toBe(0);
    expect(parsedDemo.consolePlayer).toBe(0);
  });

  it('left-shifts non-longtics angle bytes exactly like G_ReadDemoTiccmd', () => {
    const vanillaDemo = buildVersionedDemoBuffer({
      angleBytes: [0xff],
      buttons: 0x10,
      forwardMove: 1,
      playersInGame: [true, false, false, false],
      sideMove: 2,
    });

    const parsedDemo = parseDemo(vanillaDemo);
    expect(parsedDemo.commandsByTic[0]![0]!.angleTurn).toBe(-256);
  });

  it('reads longtics angle turns as signed 16-bit little-endian values', () => {
    const longTicsDemo = buildVersionedDemoBuffer({
      angleBytes: [0x00, 0x80],
      buttons: 0x10,
      firstByte: DEMO_LONG_TICS_VERSION,
      forwardMove: 1,
      playersInGame: [true, false, false, false],
      sideMove: 2,
    });

    const parsedDemo = parseDemo(longTicsDemo);
    expect(parsedDemo.format).toBe('longtics');
    expect(parsedDemo.commandByteLength).toBe(DEMO_LONG_TICS_COMMAND_SIZE);
    expect(parsedDemo.commandsByTic[0]![0]!.angleTurn).toBe(-32768);
  });

  it('packs active-player commands in active-player index order only', () => {
    const twoPlayerDemo = Buffer.alloc(DEMO_VANILLA_HEADER_SIZE + DEMO_VANILLA_COMMAND_SIZE * 2 + 1);
    let offset = 0;
    twoPlayerDemo[offset++] = DEMO_VANILLA_VERSION_19;
    twoPlayerDemo[offset++] = 2;
    twoPlayerDemo[offset++] = 1;
    twoPlayerDemo[offset++] = 1;
    twoPlayerDemo[offset++] = 0;
    twoPlayerDemo[offset++] = 0;
    twoPlayerDemo[offset++] = 0;
    twoPlayerDemo[offset++] = 0;
    twoPlayerDemo[offset++] = 0;
    twoPlayerDemo[offset++] = 1;
    twoPlayerDemo[offset++] = 0;
    twoPlayerDemo[offset++] = 1;
    twoPlayerDemo[offset++] = 0;
    twoPlayerDemo.writeInt8(10, offset++);
    twoPlayerDemo.writeInt8(-10, offset++);
    twoPlayerDemo[offset++] = 0x20;
    twoPlayerDemo[offset++] = 0x01;
    twoPlayerDemo.writeInt8(20, offset++);
    twoPlayerDemo.writeInt8(-20, offset++);
    twoPlayerDemo[offset++] = 0x40;
    twoPlayerDemo[offset++] = 0x02;
    twoPlayerDemo[offset++] = DEMO_END_MARKER;

    const parsedDemo = parseDemo(twoPlayerDemo.subarray(0, offset));
    expect(parsedDemo.activePlayerCount).toBe(2);
    expect(parsedDemo.playersInGame).toEqual([true, false, true, false]);
    expect(parsedDemo.commandsByTic[0]).toEqual([
      { angleTurn: 0x2000, buttons: 0x01, forwardMove: 10, sideMove: -10 },
      { angleTurn: 0x4000, buttons: 0x02, forwardMove: 20, sideMove: -20 },
    ]);
  });
});
