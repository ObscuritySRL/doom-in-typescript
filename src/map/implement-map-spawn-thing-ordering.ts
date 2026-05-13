/**
 * Vanilla DOOM 1.9 P_SpawnMapThing ordering contract.
 *
 * P_LoadThings iterates THINGS lump records in lump order; each MAPTHING
 * record is 10 bytes (5 int16 fields: x, y, angle, type, options).
 * P_SpawnMapThing filters each thing by:
 *   - skill bits (MTF_EASY=1, MTF_NORMAL=2, MTF_HARD=4) — at least one bit
 *     for the active skill must be set.
 *   - MTF_NETGAME=16 means net-only; in single player the thing is skipped.
 * Player starts (mobj type 1..4) are saved without spawning; deathmatch
 * starts (type 11) are saved separately.
 */

export const VANILLA_MAPTHING_SIZE = 10;

export const VANILLA_MTF_EASY = 1;
export const VANILLA_MTF_NORMAL = 2;
export const VANILLA_MTF_HARD = 4;
export const VANILLA_MTF_AMBUSH = 8;
export const VANILLA_MTF_NETGAME = 16;

export const VANILLA_PLAYER_START_TYPES = Object.freeze([1, 2, 3, 4] as const);
export const VANILLA_DEATHMATCH_START_TYPE = 11;

export type MapSpawnSkill = 1 | 2 | 3 | 4 | 5;

export interface MapThingOptions {
  readonly options: number;
}

export function skillRequiresBit(skill: MapSpawnSkill): number {
  if (skill === 1) {
    return VANILLA_MTF_EASY;
  }
  if (skill === 2 || skill === 3) {
    return VANILLA_MTF_NORMAL;
  }
  return VANILLA_MTF_HARD;
}

export function mapThingMatchesSkill(thing: MapThingOptions, skill: MapSpawnSkill): boolean {
  return (thing.options & skillRequiresBit(skill)) !== 0;
}

export function mapThingIsNetOnly(thing: MapThingOptions): boolean {
  return (thing.options & VANILLA_MTF_NETGAME) !== 0;
}

export function shouldSpawnMapThingInSinglePlayer(thing: MapThingOptions, skill: MapSpawnSkill): boolean {
  if (mapThingIsNetOnly(thing)) {
    return false;
  }
  return mapThingMatchesSkill(thing, skill);
}

export function isPlayerStartType(thingType: number): boolean {
  return (VANILLA_PLAYER_START_TYPES as readonly number[]).includes(thingType);
}

export function isDeathmatchStartType(thingType: number): boolean {
  return thingType === VANILLA_DEATHMATCH_START_TYPE;
}
