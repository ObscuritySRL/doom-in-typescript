import { describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../../src/core/fixed.ts';
import { VANILLA_PLAYER_VIEWHEIGHT, computeSpawnedPlayerViewState } from '../../../src/player/implement-player-spawn-state.ts';

describe('vanilla P_SpawnPlayer view state', () => {
  test('VIEWHEIGHT is 41 * FRACUNIT (per p_user.c VIEWHEIGHT)', () => {
    expect(VANILLA_PLAYER_VIEWHEIGHT).toBe(41 * FRACUNIT);
  });

  test('viewz = mobj.z + VIEWHEIGHT on spawn', () => {
    const state = computeSpawnedPlayerViewState({ mobjZ: 100 * FRACUNIT, currentHealth: 100 });
    expect(state.viewz).toBe((100 * FRACUNIT + 41 * FRACUNIT) | 0);
  });

  test('viewheight resets to VIEWHEIGHT on spawn', () => {
    const state = computeSpawnedPlayerViewState({ mobjZ: 0, currentHealth: 100 });
    expect(state.viewheight).toBe(VANILLA_PLAYER_VIEWHEIGHT);
  });

  test('deltaviewheight resets to 0 on spawn', () => {
    const state = computeSpawnedPlayerViewState({ mobjZ: 0, currentHealth: 100 });
    expect(state.deltaviewheight).toBe(0);
  });

  test('bob resets to 0 on spawn', () => {
    const state = computeSpawnedPlayerViewState({ mobjZ: 0, currentHealth: 100 });
    expect(state.bob).toBe(0);
  });

  test('view state object is frozen', () => {
    const state = computeSpawnedPlayerViewState({ mobjZ: 0, currentHealth: 100 });
    expect(Object.isFrozen(state)).toBe(true);
  });
});
