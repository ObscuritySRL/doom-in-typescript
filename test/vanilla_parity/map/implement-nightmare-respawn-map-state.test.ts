import { describe, expect, test } from 'bun:test';

import { VANILLA_NIGHTMARE_RESPAWN_DELAY_TICS, VANILLA_NIGHTMARE_RESPAWN_RANDOM_GATE, shouldRespawnNightmareMonster } from '../../../src/map/implement-nightmare-respawn-map-state.ts';

describe('vanilla nightmare respawn', () => {
  test('respawn delay is 35*12 = 420 tics', () => {
    expect(VANILLA_NIGHTMARE_RESPAWN_DELAY_TICS).toBe(420);
  });

  test('random gate divisor is 4 (low 2 bits == 0)', () => {
    expect(VANILLA_NIGHTMARE_RESPAWN_RANDOM_GATE).toBe(4);
  });

  test('respawn requires respawn_monsters_enabled true', () => {
    expect(shouldRespawnNightmareMonster({ tics_dead: 420, random_byte: 0, respawn_monsters_enabled: false })).toBe(false);
  });

  test('does not respawn before 420 tics', () => {
    expect(shouldRespawnNightmareMonster({ tics_dead: 419, random_byte: 0, respawn_monsters_enabled: true })).toBe(false);
  });

  test('respawns at >= 420 tics when random low 2 bits == 0', () => {
    expect(shouldRespawnNightmareMonster({ tics_dead: 420, random_byte: 0, respawn_monsters_enabled: true })).toBe(true);
    expect(shouldRespawnNightmareMonster({ tics_dead: 420, random_byte: 4, respawn_monsters_enabled: true })).toBe(true);
  });

  test('does not respawn when random low 2 bits != 0', () => {
    expect(shouldRespawnNightmareMonster({ tics_dead: 420, random_byte: 1, respawn_monsters_enabled: true })).toBe(false);
    expect(shouldRespawnNightmareMonster({ tics_dead: 420, random_byte: 3, respawn_monsters_enabled: true })).toBe(false);
  });
});
