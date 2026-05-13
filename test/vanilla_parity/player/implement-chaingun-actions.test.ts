import { describe, expect, test } from 'bun:test';

import { VANILLA_CHAINGUN_AMMO_PER_SHOT, VANILLA_CHAINGUN_BULLET_DAMAGE_BASE, VANILLA_CHAINGUN_BULLET_DAMAGE_MULTIPLIER_MAX, VANILLA_CHAINGUN_PSPRITE_FRAME_COUNT, applyChainGunFire } from '../../../src/player/implement-chaingun-actions.ts';

describe('vanilla chaingun constants', () => {
  test('1 clip ammo per shot', () => {
    expect(VANILLA_CHAINGUN_AMMO_PER_SHOT).toBe(1);
  });

  test('2 psprite frames (CHAIN1/CHAIN2)', () => {
    expect(VANILLA_CHAINGUN_PSPRITE_FRAME_COUNT).toBe(2);
  });

  test('bullet damage base=5, multiplier max=3', () => {
    expect(VANILLA_CHAINGUN_BULLET_DAMAGE_BASE).toBe(5);
    expect(VANILLA_CHAINGUN_BULLET_DAMAGE_MULTIPLIER_MAX).toBe(3);
  });
});

describe('applyChainGunFire', () => {
  test('damage is 5*(rng%3+1) yielding 5/10/15', () => {
    expect(applyChainGunFire({ refireSet: false, randomDamage: 0, randomAngleA: 0, randomAngleB: 0 }).damage).toBe(5);
    expect(applyChainGunFire({ refireSet: false, randomDamage: 1, randomAngleA: 0, randomAngleB: 0 }).damage).toBe(10);
    expect(applyChainGunFire({ refireSet: false, randomDamage: 2, randomAngleA: 0, randomAngleB: 0 }).damage).toBe(15);
  });

  test('no angle spread when refire is unset (first shot)', () => {
    const r = applyChainGunFire({ refireSet: false, randomDamage: 0, randomAngleA: 255, randomAngleB: 0 });
    expect(r.angleDelta).toBe(0);
  });

  test('angle spread (rng-rng)<<18 when refire is set', () => {
    const r = applyChainGunFire({ refireSet: true, randomDamage: 0, randomAngleA: 255, randomAngleB: 0 });
    expect(r.angleDelta).toBe(255 << 18);
  });

  test('signed angle delta', () => {
    const r = applyChainGunFire({ refireSet: true, randomDamage: 0, randomAngleA: 0, randomAngleB: 255 });
    expect(r.angleDelta).toBe((-255 << 18) | 0);
  });
});
