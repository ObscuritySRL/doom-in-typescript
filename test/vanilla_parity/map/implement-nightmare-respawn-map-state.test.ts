import { describe, expect, test } from 'bun:test';

import { VANILLA_NIGHTMARE_RESPAWN_DELAY_TICS, VANILLA_NIGHTMARE_RESPAWN_LEVELTIME_MASK, VANILLA_NIGHTMARE_RESPAWN_RANDOM_THRESHOLD, shouldRespawnNightmareMonster } from '../../../src/map/implement-nightmare-respawn-map-state.ts';

describe('vanilla nightmare respawn constants', () => {
  test('delay is 35*12 = 420 tics (12*TICRATE)', () => {
    expect(VANILLA_NIGHTMARE_RESPAWN_DELAY_TICS).toBe(420);
  });

  test('leveltime mask is 31 (gates every 32 tics)', () => {
    expect(VANILLA_NIGHTMARE_RESPAWN_LEVELTIME_MASK).toBe(31);
  });

  test('random threshold is 4 (P_Random <= 4 respawns)', () => {
    expect(VANILLA_NIGHTMARE_RESPAWN_RANDOM_THRESHOLD).toBe(4);
  });
});

describe('shouldRespawnNightmareMonster gates', () => {
  test('returns false when respawn_monsters_enabled is false', () => {
    expect(shouldRespawnNightmareMonster({ tics_dead: 420, leveltime: 32, random_byte: 0, respawn_monsters_enabled: false })).toBe(false);
  });

  test('returns false when tics_dead < 420', () => {
    expect(shouldRespawnNightmareMonster({ tics_dead: 419, leveltime: 32, random_byte: 0, respawn_monsters_enabled: true })).toBe(false);
  });

  test('returns false when leveltime & 31 != 0', () => {
    expect(shouldRespawnNightmareMonster({ tics_dead: 420, leveltime: 33, random_byte: 0, respawn_monsters_enabled: true })).toBe(false);
    expect(shouldRespawnNightmareMonster({ tics_dead: 420, leveltime: 1, random_byte: 0, respawn_monsters_enabled: true })).toBe(false);
  });

  test('returns true when all three gates pass and random_byte <= 4', () => {
    expect(shouldRespawnNightmareMonster({ tics_dead: 420, leveltime: 0, random_byte: 0, respawn_monsters_enabled: true })).toBe(true);
    expect(shouldRespawnNightmareMonster({ tics_dead: 420, leveltime: 32, random_byte: 4, respawn_monsters_enabled: true })).toBe(true);
  });

  test('returns false when random_byte > 4', () => {
    expect(shouldRespawnNightmareMonster({ tics_dead: 420, leveltime: 0, random_byte: 5, respawn_monsters_enabled: true })).toBe(false);
    expect(shouldRespawnNightmareMonster({ tics_dead: 420, leveltime: 0, random_byte: 255, respawn_monsters_enabled: true })).toBe(false);
  });
});
