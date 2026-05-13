import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../../src/core/fixed.ts';
import {
  VANILLA_BFG_DIRECT_DAMAGE_BASE,
  VANILLA_BFG_DIRECT_DAMAGE_MULTIPLIER_MAX,
  VANILLA_MISSILE_DEATH_TIC_RANDOM_MASK,
  VANILLA_MISSILE_HEIGHT_FIXED,
  VANILLA_ROCKET_BLAST_DAMAGE,
  adjustMissileDeathTics,
} from '../../../src/player/implement-projectile-spawn-and-explosion.ts';

describe('vanilla missile constants', () => {
  test('MISSILEHEIGHT = 32 fixed', () => {
    expect(VANILLA_MISSILE_HEIGHT_FIXED).toBe(32 << FRACBITS);
  });

  test('rocket blast damage = 128', () => {
    expect(VANILLA_ROCKET_BLAST_DAMAGE).toBe(128);
  });

  test('BFG direct damage base = 100, multiplier max = 8', () => {
    expect(VANILLA_BFG_DIRECT_DAMAGE_BASE).toBe(100);
    expect(VANILLA_BFG_DIRECT_DAMAGE_MULTIPLIER_MAX).toBe(8);
  });

  test('missile death tic random mask = 3', () => {
    expect(VANILLA_MISSILE_DEATH_TIC_RANDOM_MASK).toBe(3);
  });
});

describe('adjustMissileDeathTics', () => {
  test('subtracts low 2 bits of random byte from base tics', () => {
    expect(adjustMissileDeathTics(10, 0)).toBe(10);
    expect(adjustMissileDeathTics(10, 1)).toBe(9);
    expect(adjustMissileDeathTics(10, 3)).toBe(7);
    expect(adjustMissileDeathTics(10, 4)).toBe(10);
  });
});
