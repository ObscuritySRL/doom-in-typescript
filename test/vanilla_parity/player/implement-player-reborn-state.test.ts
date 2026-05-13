import { describe, expect, test } from 'bun:test';

import { VANILLA_INITIAL_BULLETS, VANILLA_INITIAL_HEALTH, VANILLA_MAX_AMMO_BY_TYPE, buildVanillaRebornFreshState } from '../../../src/player/implement-player-reborn-state.ts';

describe('vanilla G_PlayerReborn fresh state', () => {
  test('INITIAL_HEALTH is 100 (deh_initial_health)', () => {
    expect(VANILLA_INITIAL_HEALTH).toBe(100);
  });

  test('INITIAL_BULLETS is 50 (deh_initial_bullets)', () => {
    expect(VANILLA_INITIAL_BULLETS).toBe(50);
  });

  test('MAX_AMMO matches p_inter.c maxammo[] = [200, 50, 300, 50]', () => {
    expect([...VANILLA_MAX_AMMO_BY_TYPE]).toEqual([200, 50, 300, 50]);
  });

  test('reborn fresh state grants WP_FIST and WP_PISTOL, no other weapons', () => {
    const state = buildVanillaRebornFreshState();
    expect(state.hasFist).toBe(true);
    expect(state.hasPistol).toBe(true);
    expect(state.hasShotgun).toBe(false);
    expect(state.hasChaingun).toBe(false);
    expect(state.hasRocketLauncher).toBe(false);
    expect(state.hasPlasmaRifle).toBe(false);
    expect(state.hasBfg).toBe(false);
    expect(state.hasChainsaw).toBe(false);
  });

  test('reborn fresh state has INITIAL_HEALTH, INITIAL_BULLETS, no other ammo or armor', () => {
    const state = buildVanillaRebornFreshState();
    expect(state.health).toBe(100);
    expect(state.bullets).toBe(50);
    expect(state.shells).toBe(0);
    expect(state.cells).toBe(0);
    expect(state.missiles).toBe(0);
    expect(state.armorPoints).toBe(0);
    expect(state.armorType).toBe(0);
  });

  test('usedown and attackdown are true so input keys must release before firing', () => {
    const state = buildVanillaRebornFreshState();
    expect(state.usedown).toBe(true);
    expect(state.attackdown).toBe(true);
  });
});
