import { describe, expect, test } from 'bun:test';

import { VANILLA_CYBER_ROCKET_DAMAGE, VANILLA_MT_CYBORG, VANILLA_MT_ROCKET, getVanillaCyberAttackContract } from '../../../src/ai/implement-cyberdemon-attack-for-registered-iwad.ts';

describe('vanilla A_CyberAttack constants', () => {
  test('MT_CYBORG = 18', () => {
    expect(VANILLA_MT_CYBORG).toBe(18);
  });

  test('MT_ROCKET = 10', () => {
    expect(VANILLA_MT_ROCKET).toBe(10);
  });

  test('cyber rocket explosion damage = 128', () => {
    expect(VANILLA_CYBER_ROCKET_DAMAGE).toBe(128);
  });
});

describe('getVanillaCyberAttackContract', () => {
  test('returns MT_ROCKET with 128 explosion damage', () => {
    const c = getVanillaCyberAttackContract();
    expect(c.missileType).toBe(VANILLA_MT_ROCKET);
    expect(c.explosionDamage).toBe(128);
  });
});
