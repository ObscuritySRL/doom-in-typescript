import { describe, expect, test } from 'bun:test';

import { VANILLA_PLASMA_AMMO_PER_SHOT, VANILLA_PLASMA_MUZZLE_FLASH_STATE_COUNT, VANILLA_PLASMA_PROJECTILE_TYPE, pickPlasmaMuzzleFlashState } from '../../../src/player/implement-plasma-rifle-actions.ts';

describe('vanilla A_FirePlasma constants', () => {
  test('plasma consumes 1 cell per shot', () => {
    expect(VANILLA_PLASMA_AMMO_PER_SHOT).toBe(1);
  });

  test('projectile type is MT_PLASMA', () => {
    expect(VANILLA_PLASMA_PROJECTILE_TYPE).toBe('MT_PLASMA');
  });

  test('two muzzle flash states (PLS1, PLS2)', () => {
    expect(VANILLA_PLASMA_MUZZLE_FLASH_STATE_COUNT).toBe(2);
  });
});

describe('pickPlasmaMuzzleFlashState', () => {
  test('returns low bit of rng byte', () => {
    expect(pickPlasmaMuzzleFlashState(0)).toBe(0);
    expect(pickPlasmaMuzzleFlashState(1)).toBe(1);
    expect(pickPlasmaMuzzleFlashState(2)).toBe(0);
    expect(pickPlasmaMuzzleFlashState(255)).toBe(1);
  });
});
