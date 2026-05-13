import { describe, expect, test } from 'bun:test';

import {
  VANILLA_DEATHMATCH_START_TYPE,
  VANILLA_MAPTHING_SIZE,
  VANILLA_MTF_AMBUSH,
  VANILLA_MTF_EASY,
  VANILLA_MTF_HARD,
  VANILLA_MTF_NETGAME,
  VANILLA_MTF_NORMAL,
  VANILLA_PLAYER_START_TYPES,
  isDeathmatchStartType,
  isPlayerStartType,
  mapThingIsNetOnly,
  mapThingMatchesSkill,
  shouldSpawnMapThingInSinglePlayer,
  skillRequiresBit,
} from '../../../src/map/implement-map-spawn-thing-ordering.ts';

describe('vanilla MAPTHING constants', () => {
  test('MAPTHING_SIZE is 10 bytes (5 int16 fields)', () => {
    expect(VANILLA_MAPTHING_SIZE).toBe(10);
  });

  test('option bit values match doomdata.h mapthing_e', () => {
    expect(VANILLA_MTF_EASY).toBe(1);
    expect(VANILLA_MTF_NORMAL).toBe(2);
    expect(VANILLA_MTF_HARD).toBe(4);
    expect(VANILLA_MTF_AMBUSH).toBe(8);
    expect(VANILLA_MTF_NETGAME).toBe(16);
  });

  test('player start types are 1..4 and DM start type is 11', () => {
    expect([...VANILLA_PLAYER_START_TYPES]).toEqual([1, 2, 3, 4]);
    expect(VANILLA_DEATHMATCH_START_TYPE).toBe(11);
  });
});

describe('skill filter', () => {
  test('skill 1 requires MTF_EASY, skill 2/3 requires MTF_NORMAL, skill 4/5 requires MTF_HARD', () => {
    expect(skillRequiresBit(1)).toBe(VANILLA_MTF_EASY);
    expect(skillRequiresBit(2)).toBe(VANILLA_MTF_NORMAL);
    expect(skillRequiresBit(3)).toBe(VANILLA_MTF_NORMAL);
    expect(skillRequiresBit(4)).toBe(VANILLA_MTF_HARD);
    expect(skillRequiresBit(5)).toBe(VANILLA_MTF_HARD);
  });

  test('matches skill when corresponding bit is set', () => {
    expect(mapThingMatchesSkill({ options: VANILLA_MTF_EASY }, 1)).toBe(true);
    expect(mapThingMatchesSkill({ options: VANILLA_MTF_NORMAL }, 2)).toBe(true);
    expect(mapThingMatchesSkill({ options: VANILLA_MTF_HARD }, 4)).toBe(true);
    expect(mapThingMatchesSkill({ options: VANILLA_MTF_EASY }, 4)).toBe(false);
  });
});

describe('net-only filter', () => {
  test('flags net-only when MTF_NETGAME bit is set', () => {
    expect(mapThingIsNetOnly({ options: VANILLA_MTF_NETGAME | VANILLA_MTF_EASY })).toBe(true);
    expect(mapThingIsNetOnly({ options: VANILLA_MTF_EASY })).toBe(false);
  });

  test('single-player skip net-only things regardless of skill bits', () => {
    const netOnly = { options: VANILLA_MTF_NETGAME | VANILLA_MTF_EASY | VANILLA_MTF_NORMAL | VANILLA_MTF_HARD };
    expect(shouldSpawnMapThingInSinglePlayer(netOnly, 2)).toBe(false);
  });

  test('single-player spawns when skill matches and not net-only', () => {
    expect(shouldSpawnMapThingInSinglePlayer({ options: VANILLA_MTF_NORMAL }, 2)).toBe(true);
  });

  test('single-player skips when skill does not match', () => {
    expect(shouldSpawnMapThingInSinglePlayer({ options: VANILLA_MTF_EASY }, 4)).toBe(false);
  });
});

describe('player and DM start identification', () => {
  test('isPlayerStartType', () => {
    expect(isPlayerStartType(1)).toBe(true);
    expect(isPlayerStartType(4)).toBe(true);
    expect(isPlayerStartType(5)).toBe(false);
    expect(isPlayerStartType(11)).toBe(false);
  });

  test('isDeathmatchStartType', () => {
    expect(isDeathmatchStartType(11)).toBe(true);
    expect(isDeathmatchStartType(1)).toBe(false);
  });
});
