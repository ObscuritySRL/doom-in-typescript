import { describe, expect, test } from 'bun:test';

import {
  VANILLA_BRUISERSHOT_INFO_DAMAGE,
  VANILLA_BRUIS_CLAW_DAMAGE_BASE,
  VANILLA_BRUIS_CLAW_DAMAGE_MULTIPLIER_MAX,
  VANILLA_MT_BRUISER,
  VANILLA_MT_BRUISERSHOT,
  VANILLA_MT_KNIGHT,
  applyVanillaBaronAttack,
} from '../../../src/ai/implement-baron-attack.ts';

describe('vanilla A_BruisAttack constants', () => {
  test('claw damage = 10 * (rng%8 + 1) = 10..80', () => {
    expect(VANILLA_BRUIS_CLAW_DAMAGE_BASE).toBe(10);
    expect(VANILLA_BRUIS_CLAW_DAMAGE_MULTIPLIER_MAX).toBe(8);
  });

  test('MT_BRUISER=15, MT_KNIGHT=14, MT_BRUISERSHOT=22', () => {
    expect(VANILLA_MT_BRUISER).toBe(15);
    expect(VANILLA_MT_KNIGHT).toBe(14);
    expect(VANILLA_MT_BRUISERSHOT).toBe(22);
  });

  test('MT_BRUISERSHOT info.damage = 8', () => {
    expect(VANILLA_BRUISERSHOT_INFO_DAMAGE).toBe(8);
  });
});

describe('applyVanillaBaronAttack', () => {
  test('melee: damage 10..80', () => {
    expect(applyVanillaBaronAttack(true, 0).damage).toBe(10);
    expect(applyVanillaBaronAttack(true, 7).damage).toBe(80);
  });

  test('missile: MT_BRUISERSHOT, zero damage', () => {
    const r = applyVanillaBaronAttack(false, 100);
    expect(r.attackKind).toBe('missile');
    expect(r.missileType).toBe(VANILLA_MT_BRUISERSHOT);
    expect(r.damage).toBe(0);
  });
});
