import { describe, expect, test } from 'bun:test';

import { VANILLA_BFG_CELLS_PER_SHOT, VANILLA_BFG_PROJECTILE_TYPE, VANILLA_BFG_SPRAY_DAMAGE_MASK, VANILLA_BFG_SPRAY_DAMAGE_ROLLS, VANILLA_BFG_SPRAY_RAY_COUNT, computeBfgSprayRayDamage } from '../../../src/player/implement-bfg-actions.ts';

describe('vanilla BFG constants', () => {
  test('BFG consumes 40 cells per shot', () => {
    expect(VANILLA_BFG_CELLS_PER_SHOT).toBe(40);
  });

  test('projectile type is MT_BFG', () => {
    expect(VANILLA_BFG_PROJECTILE_TYPE).toBe('MT_BFG');
  });

  test('40 spray rays in 90-degree sweep', () => {
    expect(VANILLA_BFG_SPRAY_RAY_COUNT).toBe(40);
  });

  test('15 damage rolls per spray ray', () => {
    expect(VANILLA_BFG_SPRAY_DAMAGE_ROLLS).toBe(15);
  });

  test('damage roll mask is 7', () => {
    expect(VANILLA_BFG_SPRAY_DAMAGE_MASK).toBe(7);
  });
});

describe('computeBfgSprayRayDamage', () => {
  test('minimum damage 15 when all rolls are 0', () => {
    expect(computeBfgSprayRayDamage(new Array(15).fill(0))).toBe(15);
  });

  test('maximum damage 120 when all rolls are 7', () => {
    expect(computeBfgSprayRayDamage(new Array(15).fill(7))).toBe(120);
  });

  test('mid value when rolls produce mid', () => {
    // 15 rolls of 4: (4&7)+1=5 each, total 75
    expect(computeBfgSprayRayDamage(new Array(15).fill(4))).toBe(75);
  });
});
