import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../../src/core/fixed.ts';
import {
  PLAYER_STATE_DEAD,
  PLAYER_STATE_LIVE,
  PLAYER_STATE_REBORN,
  VANILLA_DEAD_VIEWHEIGHT_DROP_FIXED,
  VANILLA_DEAD_VIEWHEIGHT_FIXED,
  VANILLA_DEATHMATCH_RESPAWN_DELAY_TICS,
  stepVanillaDeathThink,
} from '../../../src/player/implement-death-and-reborn-flow.ts';

describe('vanilla death and reborn constants', () => {
  test('dead viewheight floor is 6 fixed', () => {
    expect(VANILLA_DEAD_VIEWHEIGHT_FIXED).toBe(6 << FRACBITS);
  });

  test('dead viewheight drop is 1 fixed per tic', () => {
    expect(VANILLA_DEAD_VIEWHEIGHT_DROP_FIXED).toBe(1 << FRACBITS);
  });

  test('deathmatch respawn delay is 10 tics', () => {
    expect(VANILLA_DEATHMATCH_RESPAWN_DELAY_TICS).toBe(10);
  });

  test('player state enum values: live=0, dead=1, reborn=2', () => {
    expect(PLAYER_STATE_LIVE).toBe(0);
    expect(PLAYER_STATE_DEAD).toBe(1);
    expect(PLAYER_STATE_REBORN).toBe(2);
  });
});

describe('stepVanillaDeathThink', () => {
  test('decrements viewheight by 1 fixed per tic when above 6 fixed', () => {
    const result = stepVanillaDeathThink({ viewHeightFixed: 41 << FRACBITS, useButtonPressed: false });
    expect(result.viewHeightFixed).toBe((41 << FRACBITS) - (1 << FRACBITS));
  });

  test('clamps viewheight at 6 fixed', () => {
    const result = stepVanillaDeathThink({ viewHeightFixed: 6 << FRACBITS, useButtonPressed: false });
    expect(result.viewHeightFixed).toBe(6 << FRACBITS);
  });

  test('deltaViewHeightFixed reset to 0 each tic', () => {
    const result = stepVanillaDeathThink({ viewHeightFixed: 41 << FRACBITS, useButtonPressed: false });
    expect(result.deltaViewHeightFixed).toBe(0);
  });

  test('transitions to reborn when use button pressed', () => {
    expect(stepVanillaDeathThink({ viewHeightFixed: 6 << FRACBITS, useButtonPressed: true }).transitionsToReborn).toBe(true);
    expect(stepVanillaDeathThink({ viewHeightFixed: 6 << FRACBITS, useButtonPressed: false }).transitionsToReborn).toBe(false);
  });
});
