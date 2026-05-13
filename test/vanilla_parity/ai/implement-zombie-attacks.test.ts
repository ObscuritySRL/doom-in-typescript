import { describe, expect, test } from 'bun:test';

import {
  VANILLA_CPOS_ATTACK_BULLETS,
  VANILLA_POS_ATTACK_BULLETS,
  VANILLA_SPOS_ATTACK_BULLETS,
  VANILLA_ZOMBIE_BULLET_SPREAD_SHIFT,
  VANILLA_ZOMBIE_DAMAGE_MULTIPLIER,
  VANILLA_ZOMBIE_DAMAGE_RNG_MODULO,
  computeZombieBulletDamage,
  computeZombieBulletSpreadAngleDelta,
} from '../../../src/ai/implement-zombie-attacks.ts';

describe('vanilla zombie attack constants', () => {
  test('A_PosAttack fires 1 bullet', () => {
    expect(VANILLA_POS_ATTACK_BULLETS).toBe(1);
  });

  test('A_SPosAttack fires 3 bullets', () => {
    expect(VANILLA_SPOS_ATTACK_BULLETS).toBe(3);
  });

  test('A_CPosAttack fires 1 bullet per call (refires via state chain)', () => {
    expect(VANILLA_CPOS_ATTACK_BULLETS).toBe(1);
  });

  test('damage formula is ((rng%5)+1)*3 per p_enemy.c', () => {
    expect(VANILLA_ZOMBIE_DAMAGE_RNG_MODULO).toBe(5);
    expect(VANILLA_ZOMBIE_DAMAGE_MULTIPLIER).toBe(3);
  });

  test('bullet spread shift is 20 BAM (per vanilla zombie spread)', () => {
    expect(VANILLA_ZOMBIE_BULLET_SPREAD_SHIFT).toBe(20);
  });
});

describe('computeZombieBulletDamage', () => {
  test('produces 3..15 from rng 0..255 (5 discrete buckets)', () => {
    // rng=0: (0%5+1)*3=3; rng=1: (1%5+1)*3=6; rng=2: 9; rng=3: 12; rng=4: 15
    expect(computeZombieBulletDamage(0)).toBe(3);
    expect(computeZombieBulletDamage(1)).toBe(6);
    expect(computeZombieBulletDamage(2)).toBe(9);
    expect(computeZombieBulletDamage(3)).toBe(12);
    expect(computeZombieBulletDamage(4)).toBe(15);
  });

  test('rng wraps via %5: rng=5 yields 3, rng=255 yields 3', () => {
    expect(computeZombieBulletDamage(5)).toBe(3);
    expect(computeZombieBulletDamage(255)).toBe(3); // 255 % 5 = 0
  });

  test('damage is never less than 3 or greater than 15', () => {
    for (let r = 0; r < 256; r += 1) {
      const d = computeZombieBulletDamage(r);
      expect(d).toBeGreaterThanOrEqual(3);
      expect(d).toBeLessThanOrEqual(15);
    }
  });
});

describe('computeZombieBulletSpreadAngleDelta', () => {
  test('signed difference shifted left 20 (vanilla zombie spread)', () => {
    expect(computeZombieBulletSpreadAngleDelta(255, 0)).toBe(255 << 20);
    expect(computeZombieBulletSpreadAngleDelta(0, 0)).toBe(0);
  });
});
