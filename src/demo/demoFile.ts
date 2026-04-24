/**
 * Doom 1.9 demo lump parser.
 *
 * Parses a demo lump from a WAD file into its header metadata and tic
 * command stream.  The Doom 1.9 demo format has a 13-byte header followed
 * by 4 bytes per active player per tic, terminated by a 0x80 end marker.
 *
 * Header layout (13 bytes):
 * | Offset | Size | Field           |
 * | ------ | ---- | --------------- |
 * | 0      | 1    | demoVersion     |
 * | 1      | 1    | skill           |
 * | 2      | 1    | episode         |
 * | 3      | 1    | map             |
 * | 4      | 1    | deathmatch      |
 * | 5      | 1    | respawn         |
 * | 6      | 1    | fast            |
 * | 7      | 1    | nomonsters      |
 * | 8      | 1    | consoleplayer   |
 * | 9-12   | 4    | playeringame[4] |
 *
 * Each tic command is 4 bytes per active player:
 * | Offset | Size | Field       | Type   |
 * | ------ | ---- | ----------- | ------ |
 * | 0      | 1    | forwardmove | int8   |
 * | 1      | 1    | sidemove    | int8   |
 * | 2      | 1    | angleturn   | uint8  |
 * | 3      | 1    | buttons     | uint8  |
 *
 * The angleturn byte is shifted left 8 to produce the full 16-bit angle
 * delta during playback (G_ReadDemoTiccmd).
 *
 * @example
 * ```ts
 * import { parseDemoLump, DEMO_VERSION_19 } from "../src/demo/demoFile.ts";
 * const demo = parseDemoLump(demoLumpData);
 * console.log(demo.episode, demo.map);  // 1, 5
 * console.log(demo.ticCount);           // 5026
 * ```
 */

import { BinaryReader } from '../core/binaryReader.ts';

/** Demo version byte for Doom 1.9 format. */
export const DEMO_VERSION_19 = 109;

/** Size of the demo header in bytes. */
export const DEMO_HEADER_SIZE = 13;

/** Bytes per tic command per active player. */
export const DEMO_TIC_SIZE = 4;

/** End-of-demo marker byte. */
export const DEMO_END_MARKER = 0x80;

/** Maximum number of players in a Doom game. */
export const DEMO_MAX_PLAYERS = 4;

/** Doom tic rate in Hz. */
export const DEMO_TIC_RATE = 35;

/** A single tic command for one player. */
export interface DemoTicCommand {
  /** Forward/backward movement (-50 to 50, or -25 to 25 in SR50). */
  readonly forwardmove: number;
  /** Left/right strafe movement (-40 to 40, or -50 to 50 in SR50). */
  readonly sidemove: number;
  /** Stored angle turn byte (shifted left 8 during playback). */
  readonly angleturn: number;
  /** Button state bitfield (BT_ATTACK, BT_USE, BT_CHANGE, weapon bits). */
  readonly buttons: number;
}

/** Parsed demo lump with header metadata and tic command stream. */
export interface DemoFile {
  /** Demo format version (109 for Doom 1.9). */
  readonly version: number;
  /** Skill level (0-4: "I'm too young to die" through "Nightmare"). */
  readonly skill: number;
  /** Episode number (1-based for Doom 1 ExMy maps). */
  readonly episode: number;
  /** Map number (1-based). */
  readonly map: number;
  /** Deathmatch mode flag (0 = cooperative). */
  readonly deathmatch: number;
  /** Respawn monsters flag. */
  readonly respawn: number;
  /** Fast monsters flag. */
  readonly fast: number;
  /** No monsters flag. */
  readonly nomonsters: number;
  /** Index of the recording player (0-3). */
  readonly consoleplayer: number;
  /** Frozen array of 4 booleans indicating which players are present. */
  readonly playersPresent: readonly boolean[];
  /** Number of active players (sum of playersPresent). */
  readonly activePlayers: number;
  /** Total number of tics in the demo. */
  readonly ticCount: number;
  /** Duration in seconds (ticCount / 35). */
  readonly durationSeconds: number;
  /** Frozen array of tic command arrays (one array per tic, one command per active player in order). */
  readonly tics: readonly (readonly DemoTicCommand[])[];
}

/**
 * Parse a demo lump into header metadata and tic commands.
 *
 * @param lumpData - Raw demo lump data from a WAD.
 * @returns Frozen DemoFile with parsed header and tic stream.
 * @throws {RangeError} If the lump is too small or has an invalid format.
 */
export function parseDemoLump(lumpData: Buffer): Readonly<DemoFile> {
  if (lumpData.length < DEMO_HEADER_SIZE) {
    throw new RangeError(`Demo lump must be at least ${DEMO_HEADER_SIZE} bytes, got ${lumpData.length}`);
  }

  const reader = new BinaryReader(lumpData);

  const version = reader.readUint8();
  const skill = reader.readUint8();
  const episode = reader.readUint8();
  const map = reader.readUint8();
  const deathmatch = reader.readUint8();
  const respawn = reader.readUint8();
  const fast = reader.readUint8();
  const nomonsters = reader.readUint8();
  const consoleplayer = reader.readUint8();

  const playersPresent: boolean[] = new Array(DEMO_MAX_PLAYERS);
  let activePlayers = 0;
  for (let index = 0; index < DEMO_MAX_PLAYERS; index++) {
    const present = reader.readUint8() !== 0;
    playersPresent[index] = present;
    if (present) {
      activePlayers++;
    }
  }

  if (activePlayers === 0) {
    throw new RangeError('Demo has no active players');
  }

  const bytesPerTic = DEMO_TIC_SIZE * activePlayers;
  const tics: (readonly DemoTicCommand[])[] = [];
  let offset = reader.position;

  while (offset < lumpData.length) {
    if (lumpData[offset] === DEMO_END_MARKER) {
      break;
    }

    if (offset + bytesPerTic > lumpData.length) {
      throw new RangeError(`Demo lump truncated at tic ${tics.length}: need ${bytesPerTic} bytes at offset ${offset}, only ${lumpData.length - offset} remain`);
    }

    const ticCommands: DemoTicCommand[] = [];
    for (let player = 0; player < DEMO_MAX_PLAYERS; player++) {
      if (!playersPresent[player]) {
        continue;
      }
      const forwardmove = lumpData.readInt8(offset);
      const sidemove = lumpData.readInt8(offset + 1);
      const angleturn = lumpData.readUInt8(offset + 2);
      const buttons = lumpData.readUInt8(offset + 3);
      ticCommands.push(Object.freeze({ forwardmove, sidemove, angleturn, buttons }));
      offset += DEMO_TIC_SIZE;
    }
    tics.push(Object.freeze(ticCommands));
  }

  if (offset >= lumpData.length || lumpData[offset] !== DEMO_END_MARKER) {
    throw new RangeError(`Demo lump missing end marker 0x${DEMO_END_MARKER.toString(16).toUpperCase()} after ${tics.length} tics`);
  }

  const ticCount = tics.length;
  const durationSeconds = ticCount / DEMO_TIC_RATE;

  const demoFile: DemoFile = {
    version,
    skill,
    episode,
    map,
    deathmatch,
    respawn,
    fast,
    nomonsters,
    consoleplayer,
    playersPresent: Object.freeze(playersPresent),
    activePlayers,
    ticCount,
    durationSeconds,
    tics: Object.freeze(tics),
  };

  return Object.freeze(demoFile);
}
