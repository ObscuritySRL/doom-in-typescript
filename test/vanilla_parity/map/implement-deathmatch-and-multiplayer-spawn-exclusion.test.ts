import { describe, expect, test } from 'bun:test';

import { classifySpawnOutcome } from '../../../src/map/implement-deathmatch-and-multiplayer-spawn-exclusion.ts';
import { VANILLA_MTF_NETGAME, VANILLA_MTF_NORMAL } from '../../../src/map/implement-map-spawn-thing-ordering.ts';

describe('vanilla spawn exclusion', () => {
  test('player start types 1..4 are saved, not spawned', () => {
    for (const type of [1, 2, 3, 4]) {
      expect(classifySpawnOutcome({ thingType: type, options: VANILLA_MTF_NORMAL, mode: 'single-player' })).toBe('save-player-start');
    }
  });

  test('DM start type 11 is saved as DM start', () => {
    expect(classifySpawnOutcome({ thingType: 11, options: VANILLA_MTF_NORMAL, mode: 'deathmatch' })).toBe('save-deathmatch-start');
  });

  test('MTF_NETGAME flagged thing is skipped in single-player', () => {
    expect(classifySpawnOutcome({ thingType: 2018, options: VANILLA_MTF_NETGAME | VANILLA_MTF_NORMAL, mode: 'single-player' })).toBe('skip-net-only-in-singleplayer');
  });

  test('MTF_NETGAME flagged thing spawns in cooperative', () => {
    expect(classifySpawnOutcome({ thingType: 2018, options: VANILLA_MTF_NETGAME | VANILLA_MTF_NORMAL, mode: 'cooperative' })).toBe('spawn');
  });

  test('MTF_NETGAME flagged thing spawns in deathmatch', () => {
    expect(classifySpawnOutcome({ thingType: 2018, options: VANILLA_MTF_NETGAME | VANILLA_MTF_NORMAL, mode: 'deathmatch' })).toBe('spawn');
  });

  test('normal pickup spawns in single-player', () => {
    expect(classifySpawnOutcome({ thingType: 2007, options: VANILLA_MTF_NORMAL, mode: 'single-player' })).toBe('spawn');
  });
});
