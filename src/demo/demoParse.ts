/**
 * Doom demo parser matching Chocolate Doom's playback header rules.
 *
 * Vanilla Doom supports three header variants during playback:
 *
 * - old demos with no version byte (`g_game.c` treats leading bytes
 *   `0..4` as the `skill` field and rewinds the cursor),
 * - versioned vanilla demos (such as the shareware `109` lumps in
 *   `DOOM1.WAD`), and
 * - the non-vanilla `111` longtics format where `angleturn` is stored
 *   as a full signed 16-bit little-endian value instead of a single
 *   byte shifted left by eight.
 *
 * This module preserves those header decisions and decodes the tic
 * command stream in the same byte order that `G_ReadDemoTiccmd`
 * consumes it.
 *
 * @example
 * ```ts
 * import { parseDemo } from '../src/demo/demoParse.ts';
 * const parsedDemo = parseDemo(await Bun.file('DEMO1.lmp').bytes().then(Buffer.from));
 * parsedDemo.ticCount;     // 5026 for the bundled shareware DEMO1
 * parsedDemo.format;       // 'vanilla'
 * parsedDemo.commandsByTic[0]?.[0]?.angleTurn;
 * ```
 */

import { BinaryReader } from '../core/binaryReader.ts';

/** End-of-demo marker byte written by `G_CheckDemoStatus`. */
export const DEMO_END_MARKER = 0x80;

/** Per-player tic command width for `DOOM_191_VERSION` longtics demos. */
export const DEMO_LONG_TICS_COMMAND_SIZE = 5;

/** Non-vanilla "Doom 1.91" longtics version byte. */
export const DEMO_LONG_TICS_VERSION = 111;

/** Maximum player slots encoded in Doom demo headers. */
export const DEMO_MAX_PLAYERS = 4;

/** Header width for pre-v1.4 demos that omit the version byte. */
export const DEMO_OLD_FORMAT_HEADER_SIZE = 7;

/** Leading-byte ceiling that signals the old no-version demo format. */
export const DEMO_OLD_FORMAT_MAX_SKILL = 4;

/** Doom's fixed 35 Hz tic rate. */
export const DEMO_TIC_RATE = 35;

/** Per-player tic command width for vanilla non-longtics demos. */
export const DEMO_VANILLA_COMMAND_SIZE = 4;

/** Header width for versioned vanilla demos such as Doom 1.9 format. */
export const DEMO_VANILLA_HEADER_SIZE = 13;

/** Version byte used by the bundled Doom 1.9 shareware demo lumps. */
export const DEMO_VANILLA_VERSION_19 = 109;

/** Demo formats accepted by `G_DoPlayDemo`. */
export type DemoFormat = 'longtics' | 'old' | 'vanilla';

/** One decoded tic command for one active player. */
export interface DemoTicCommand {
  /** Signed 16-bit angle delta after Doom's playback conversion. */
  readonly angleTurn: number;
  /** Raw button bitfield byte. */
  readonly buttons: number;
  /** Signed forward/backward movement byte. */
  readonly forwardMove: number;
  /** Signed strafe movement byte. */
  readonly sideMove: number;
}

/** Parsed demo header and full tic command stream. */
export interface ParsedDemo {
  /** Number of `playeringame[]` slots set to non-zero. */
  readonly activePlayerCount: number;
  /** Bytes consumed per active-player command during tic playback. */
  readonly commandByteLength: number;
  /** Tic commands grouped by tic, in active-player index order. */
  readonly commandsByTic: readonly (readonly DemoTicCommand[])[];
  /** `consoleplayer` from versioned headers, or `0` for old demos. */
  readonly consolePlayer: number;
  /** `deathmatch` flag byte, or `0` for old demos. */
  readonly deathmatch: number;
  /** Exact `ticCount / 35` duration. */
  readonly durationSeconds: number;
  /** Byte offset of the terminating `0x80` marker. */
  readonly endMarkerOffset: number;
  /** Episode number from the demo header. */
  readonly episode: number;
  /** `fastparm` flag byte, or `0` for old demos. */
  readonly fastMonsters: number;
  /** Header flavor selected from the first byte. */
  readonly format: DemoFormat;
  /** Header width in bytes for the selected format. */
  readonly headerByteLength: number;
  /** Map number from the demo header. */
  readonly map: number;
  /** `nomonsters` flag byte, or `0` for old demos. */
  readonly noMonsters: number;
  /** Frozen 4-slot `playeringame[]` bitmap. */
  readonly playersInGame: readonly boolean[];
  /** `respawnparm` flag byte, or `0` for old demos. */
  readonly respawnMonsters: number;
  /** Skill byte from the demo header. */
  readonly skill: number;
  /** Number of decoded tics before the end marker. */
  readonly ticCount: number;
  /** Version byte for versioned demos, or `null` for old demos. */
  readonly versionByte: number | null;
}

/**
 * Parse a Doom demo buffer using the same header branching rules that
 * Chocolate Doom applies in `G_DoPlayDemo`.
 *
 * @param demoBuffer - Raw demo bytes from a `.lmp` file or WAD lump.
 * @returns Frozen parsed demo metadata and command stream.
 */
export function parseDemo(demoBuffer: Buffer): Readonly<ParsedDemo> {
  if (demoBuffer.length < 1) {
    throw new RangeError('Demo buffer must contain at least 1 byte');
  }

  const reader = new BinaryReader(demoBuffer);
  const firstByte = reader.readUint8();

  let commandByteLength = DEMO_VANILLA_COMMAND_SIZE;
  let consolePlayer = 0;
  let deathmatch = 0;
  let episode = 0;
  let fastMonsters = 0;
  let format: DemoFormat = 'vanilla';
  let headerByteLength = DEMO_VANILLA_HEADER_SIZE;
  let map = 0;
  let noMonsters = 0;
  let respawnMonsters = 0;
  let skill = 0;
  let versionByte: number | null = firstByte;

  if (firstByte <= DEMO_OLD_FORMAT_MAX_SKILL) {
    format = 'old';
    headerByteLength = DEMO_OLD_FORMAT_HEADER_SIZE;
    skill = firstByte;
    versionByte = null;
    if (demoBuffer.length < headerByteLength) {
      throw new RangeError(`Old-format demo must be at least ${headerByteLength} bytes, got ${demoBuffer.length}`);
    }
    episode = reader.readUint8();
    map = reader.readUint8();
  } else {
    if (firstByte === DEMO_LONG_TICS_VERSION) {
      commandByteLength = DEMO_LONG_TICS_COMMAND_SIZE;
      format = 'longtics';
    }
    if (demoBuffer.length < headerByteLength) {
      throw new RangeError(`Versioned demo must be at least ${headerByteLength} bytes, got ${demoBuffer.length}`);
    }
    skill = reader.readUint8();
    episode = reader.readUint8();
    map = reader.readUint8();
    deathmatch = reader.readUint8();
    respawnMonsters = reader.readUint8();
    fastMonsters = reader.readUint8();
    noMonsters = reader.readUint8();
    consolePlayer = reader.readUint8();
  }

  const playersInGame: boolean[] = [];
  let activePlayerCount = 0;
  for (let playerIndex = 0; playerIndex < DEMO_MAX_PLAYERS; playerIndex++) {
    const isInGame = reader.readUint8() !== 0;
    playersInGame.push(isInGame);
    if (isInGame) {
      activePlayerCount += 1;
    }
  }

  if (activePlayerCount === 0) {
    throw new RangeError('Demo has no active players');
  }

  const commandsByTic: (readonly DemoTicCommand[])[] = [];
  let endMarkerOffset = -1;
  const isLongTics = format === 'longtics';

  while (true) {
    if (reader.remaining === 0) {
      throw new RangeError(`Demo is missing end marker 0x${DEMO_END_MARKER.toString(16).toUpperCase()} after ${commandsByTic.length} tics`);
    }

    if (demoBuffer[reader.position] === DEMO_END_MARKER) {
      endMarkerOffset = reader.position;
      break;
    }

    const ticCommands: DemoTicCommand[] = [];
    for (let playerIndex = 0; playerIndex < DEMO_MAX_PLAYERS; playerIndex++) {
      if (!playersInGame[playerIndex]) {
        continue;
      }

      if (reader.remaining < commandByteLength) {
        throw new RangeError(`Demo tic ${commandsByTic.length} truncated while reading player ${playerIndex}: need ${commandByteLength} bytes, got ${reader.remaining}`);
      }

      const forwardMove = reader.readInt8();
      const sideMove = reader.readInt8();
      let angleTurn: number;
      if (isLongTics) {
        angleTurn = reader.readInt16();
      } else {
        const shiftedAngleTurn = reader.readUint8() << 8;
        angleTurn = shiftedAngleTurn >= 0x8000 ? shiftedAngleTurn - 0x1_0000 : shiftedAngleTurn;
      }
      const buttons = reader.readUint8();

      ticCommands.push(
        Object.freeze({
          angleTurn,
          buttons,
          forwardMove,
          sideMove,
        }),
      );
    }

    commandsByTic.push(Object.freeze(ticCommands));
  }

  const ticCount = commandsByTic.length;
  const parsedDemo: ParsedDemo = {
    activePlayerCount,
    commandByteLength,
    commandsByTic: Object.freeze(commandsByTic),
    consolePlayer,
    deathmatch,
    durationSeconds: ticCount / DEMO_TIC_RATE,
    endMarkerOffset,
    episode,
    fastMonsters,
    format,
    headerByteLength,
    map,
    noMonsters,
    playersInGame: Object.freeze(playersInGame),
    respawnMonsters,
    skill,
    ticCount,
    versionByte,
  };

  return Object.freeze(parsedDemo);
}
