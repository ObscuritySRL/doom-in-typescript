import { describe, expect, test } from 'bun:test';

import { VANILLA_CACO_BITE_DAMAGE_BASE, VANILLA_CACO_BITE_DAMAGE_MULTIPLIER_MAX, VANILLA_MT_HEAD, VANILLA_MT_HEADSHOT, applyVanillaCacoAttack } from '../../../src/ai/implement-cacodemon-attack.ts';

describe('vanilla A_HeadAttack constants', () => {
  test('cacodemon bite damage base = 10', () => {
    expect(VANILLA_CACO_BITE_DAMAGE_BASE).toBe(10);
  });

  test('multiplier max = 6 (P_Random%6+1)', () => {
    expect(VANILLA_CACO_BITE_DAMAGE_MULTIPLIER_MAX).toBe(6);
  });

  test('MT_HEAD = 26, MT_HEADSHOT = 24', () => {
    expect(VANILLA_MT_HEAD).toBe(26);
    expect(VANILLA_MT_HEADSHOT).toBe(24);
  });
});

describe('applyVanillaCacoAttack', () => {
  test('melee: damage 10..60', () => {
    expect(applyVanillaCacoAttack({ inMeleeRange: true, randomByte: 0 }).damage).toBe(10);
    expect(applyVanillaCacoAttack({ inMeleeRange: true, randomByte: 5 }).damage).toBe(60);
  });

  test('missile: MT_HEADSHOT, zero damage', () => {
    const r = applyVanillaCacoAttack({ inMeleeRange: false, randomByte: 42 });
    expect(r.attackKind).toBe('missile');
    expect(r.missileType).toBe(VANILLA_MT_HEADSHOT);
    expect(r.damage).toBe(0);
  });
});
