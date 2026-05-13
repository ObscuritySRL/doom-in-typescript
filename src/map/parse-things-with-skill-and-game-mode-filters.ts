/**
 * Vanilla DOOM 1.9 THINGS lump parser with skill / game-mode / multiplayer filtering.
 *
 * THINGS lump: 10 bytes per thing (int16 x, int16 y, int16 angle, int16 type, int16 flags).
 * Vanilla flags from p_setup.c::P_SpawnMapThing:
 *   MTF_EASY      = 0x0001  spawn on skill 1+2 (ITYTD, HNTR)
 *   MTF_NORMAL    = 0x0002  spawn on skill 3   (HMP)
 *   MTF_HARD      = 0x0004  spawn on skill 4+5 (UV, NM)
 *   MTF_AMBUSH    = 0x0008  deaf monster
 *   MTF_NOTSINGLE = 0x0010  skip in single player
 */

export const VANILLA_THING_BYTES = 10;
export const VANILLA_MTF_EASY = 0x0001;
export const VANILLA_MTF_NORMAL = 0x0002;
export const VANILLA_MTF_HARD = 0x0004;
export const VANILLA_MTF_AMBUSH = 0x0008;
export const VANILLA_MTF_NOT_SINGLE = 0x0010;

export interface ThingLump {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly type: number;
  readonly flags: number;
}

function signed16(byte0: number, byte1: number): number {
  const value = byte0 | (byte1 << 8);
  return value > 0x7fff ? value - 0x10000 : value;
}

function unsigned16(byte0: number, byte1: number): number {
  return byte0 | (byte1 << 8);
}

export function parseThingLump(bytes: Uint8Array): readonly ThingLump[] {
  if (bytes.length % VANILLA_THING_BYTES !== 0) {
    throw new RangeError(`THINGS lump byte length ${bytes.length} is not a multiple of ${VANILLA_THING_BYTES}`);
  }
  const count = bytes.length / VANILLA_THING_BYTES;
  const things: ThingLump[] = [];
  for (let thingIndex = 0; thingIndex < count; thingIndex += 1) {
    const offset = thingIndex * VANILLA_THING_BYTES;
    things.push(
      Object.freeze({
        x: signed16(bytes[offset]!, bytes[offset + 1]!),
        y: signed16(bytes[offset + 2]!, bytes[offset + 3]!),
        angle: unsigned16(bytes[offset + 4]!, bytes[offset + 5]!),
        type: unsigned16(bytes[offset + 6]!, bytes[offset + 7]!),
        flags: unsigned16(bytes[offset + 8]!, bytes[offset + 9]!),
      } satisfies ThingLump),
    );
  }
  return Object.freeze(things);
}

export interface ThingSpawnDecisionInput {
  readonly thing: ThingLump;
  readonly skill: number;
  readonly multiplayer: boolean;
}

export function shouldThingSpawn(input: ThingSpawnDecisionInput): boolean {
  if (!input.multiplayer && (input.thing.flags & VANILLA_MTF_NOT_SINGLE) !== 0) {
    return false;
  }
  const skill = input.skill;
  if (skill <= 1) {
    return (input.thing.flags & VANILLA_MTF_EASY) !== 0;
  }
  if (skill === 2) {
    return (input.thing.flags & VANILLA_MTF_NORMAL) !== 0;
  }
  return (input.thing.flags & VANILLA_MTF_HARD) !== 0;
}
