import { describe, expect, test } from 'bun:test';

import {
  VANILLA_BRAIN_SPAWN_TABLE,
  VANILLA_MT_BOSSBRAIN,
  VANILLA_MT_BOSSSPIT,
  VANILLA_MT_BOSSTARGET,
  VANILLA_MT_KEEN,
  VANILLA_MT_SPAWNSHOT,
  isIconOfSinAllowedInGameMode,
  isKeenAllowedInGameMode,
} from '../../../src/ai/implement-keen-and-icon-paths-behind-doom-two-scope.ts';

describe('vanilla DOOM 2-only mobj type IDs', () => {
  test('MT_KEEN = 72', () => {
    expect(VANILLA_MT_KEEN).toBe(72);
  });

  test('icon of sin spawner ids', () => {
    expect(VANILLA_MT_BOSSBRAIN).toBe(78);
    expect(VANILLA_MT_BOSSSPIT).toBe(77);
    expect(VANILLA_MT_BOSSTARGET).toBe(76);
    expect(VANILLA_MT_SPAWNSHOT).toBe(74);
  });

  test('brain spawn table has 9 monster types', () => {
    expect(VANILLA_BRAIN_SPAWN_TABLE).toHaveLength(9);
  });
});

describe('gamemode gates', () => {
  test('keen only in commercial', () => {
    expect(isKeenAllowedInGameMode('commercial')).toBe(true);
    expect(isKeenAllowedInGameMode('shareware')).toBe(false);
    expect(isKeenAllowedInGameMode('retail')).toBe(false);
  });

  test('icon of sin only in commercial', () => {
    expect(isIconOfSinAllowedInGameMode('commercial')).toBe(true);
    expect(isIconOfSinAllowedInGameMode('registered')).toBe(false);
  });
});
